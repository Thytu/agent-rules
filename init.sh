#!/usr/bin/env bash
set -euo pipefail

# Materializes this template into a product repository: a language-neutral
# core, the selected languages, and the selected add-ons. It validates the full
# output in a temporary directory before replacing anything, rolls back on
# failure, and removes the generator. Written for bash 3.2 (macOS).

while IFS='=' read -r name _value; do case "$name" in GIT_*) unset "$name" ;; esac; done < <(env)
export GIT_CONFIG_NOSYSTEM=1
export GIT_CONFIG_GLOBAL=/dev/null
root="$(cd "$(dirname "$0")" && pwd -P)"
git_cmd() { git -c core.fsmonitor=false -c protocol.ext.allow=never -C "$root" "$@"; }

if [ -t 2 ] && [ -z "${NO_COLOR:-}" ]; then
	bold=$'\033[1m' dim=$'\033[2m' red=$'\033[31m' green=$'\033[32m' reset=$'\033[0m'
else
	bold='' dim='' red='' green='' reset=''
fi

# usage_error MESSAGE [HINT...]: a problem with the request itself (exit 2).
usage_error() {
	printf '%sinit:%s %s\n' "$red" "$reset" "$1" >&2
	shift
	local hint
	for hint in "$@"; do printf '  %s\n' "$hint" >&2; done
	exit 2
}
# fail MESSAGE [HINT...]: the repository or a step refused (exit 1).
fail() {
	printf '%sinit:%s %s\n' "$red" "$reset" "$1" >&2
	shift
	local hint
	for hint in "$@"; do printf '  %s\n' "$hint" >&2; done
	exit 1
}

languages_catalog="python rust typescript"
addons_catalog="react nextjs tailwind database"

language_summary() {
	case "$1" in
		python) echo "Python 3.13 with uv, Ruff, Pyright, pytest, and coverage floors" ;;
		rust) echo "Rust 1.98 workspace with Clippy, cargo-deny, and coverage floors" ;;
		typescript) echo "TypeScript on Node 22 with pnpm, ESLint, Biome, and coverage floors" ;;
	esac
}

conf() {
	local file="$root/template/addons/$1/addon.conf"
	[ -f "$file" ] || return 0
	sed -n "s/^$2=//p" "$file" | head -n 1
}

param_values() {
	find "$root/template/addons" -mindepth 1 -maxdepth 1 -type d -name "$1@*" | sed 's#.*@##' | sort
}

contains() {
	local item="$1" word
	shift
	for word in $*; do [ "$word" = "$item" ] && return 0; done
	return 1
}

# suggest TOKEN prints the canonical spelling a mistyped name most likely meant.
suggest() {
	local token="$1" name
	case "$token" in
		ts | js | javascript | node | tsx) echo typescript; return ;;
		py | python3) echo python; return ;;
		rs | cargo) echo rust; return ;;
		next | next.js | nextjs16) echo nextjs; return ;;
		react.js | reactjs | jsx) echo react; return ;;
		tw | tailwindcss) echo tailwind; return ;;
		postgres | pg | postgresql) echo database=postgresql; return ;;
		sqlite | sqlite3 | d1 | libsql | turso) echo database=sqlite; return ;;
		db | drizzle | orm | sql) echo "database=postgresql or database=sqlite"; return ;;
	esac
	for name in $languages_catalog $addons_catalog; do
		case "$name" in "$token"*) echo "$name"; return ;; esac
	done
}

usage() {
	cat <<EOF
${bold}Usage${reset}
  ./init.sh                                  choose interactively (in a terminal)
  ./init.sh LANGUAGES [--with ADD-ONS]       initialize directly
  ./init.sh LANGUAGES [--with ADD-ONS] --dry-run
                                             show the plan and files; change nothing
  ./init.sh --list                           describe every language and add-on

${bold}Arguments${reset}
  LANGUAGES   one or more of: python, rust, typescript (comma-separated, any order)
  --with      TypeScript add-ons, comma-separated: react, nextjs, tailwind,
              database=postgresql, database=sqlite
  --dry-run   print the plan and the files that would be created, then exit
  --yes       skip the confirmation question in interactive mode

${bold}Examples${reset}
  ./init.sh typescript
  ./init.sh typescript --with nextjs,tailwind,database=postgresql
  ./init.sh python,typescript --with react

Initialization runs once, on a fresh copy of the template; choose add-ons now.
EOF
}

list_catalog() {
	local language addon value
	printf '%sLanguages%s\n' "$bold" "$reset"
	for language in $languages_catalog; do printf '  %-12s %s\n' "$language" "$(language_summary "$language")"; done
	printf '\n%sAdd-ons%s (TypeScript)\n' "$bold" "$reset"
	for addon in $addons_catalog; do
		printf '  %-12s %s\n' "$addon" "$(conf "$addon" summary)"
		[ -z "$(conf "$addon" implies)" ] || printf '  %-12s %sincludes %s%s\n' "" "$dim" "$(conf "$addon" implies)" "$reset"
		if [ -n "$(conf "$addon" param)" ]; then
			for value in $(param_values "$addon"); do
				printf '  %-12s %s%s=%s: %s%s\n' "" "$dim" "$addon" "$value" "$(conf "$addon@$value" title)" "$reset"
			done
		fi
	done
}

# ---- selection --------------------------------------------------------------

selected_languages=""
selected_addons=""
selected_params=""
implied_notes=""
problem=""

param_of() {
	local entry
	for entry in $selected_params; do
		case "$entry" in "$1="*) echo "${entry#*=}"; return ;; esac
	done
}

# parse_languages LIST sets selected_languages, or problem on bad input.
parse_languages() {
	local token hint ordered="" language
	problem=""
	for token in $(printf '%s' "$1" | tr 'A-Z,' 'a-z '); do
		if ! contains "$token" "$languages_catalog"; then
			hint="$(suggest "$token")"
			problem="invalid language selection: '$token' is not a language${hint:+. Did you mean '$hint'?}"
			return 1
		fi
	done
	for language in $languages_catalog; do
		contains "$language" "$(printf '%s' "$1" | tr 'A-Z,' 'a-z ')" && ordered="$ordered $language"
	done
	selected_languages="${ordered# }"
	[ -n "$selected_languages" ] || { problem="choose at least one language: python, rust, or typescript"; return 1; }
}

# parse_addons LIST sets selected_addons and selected_params, or problem.
parse_addons() {
	local token name value hint values ordered="" addon previous
	problem=""
	for token in $(printf '%s' "$1" | tr 'A-Z,' 'a-z '); do
		name="${token%%=*}"
		value=""
		[ "$name" = "$token" ] || value="${token#*=}"
		if ! contains "$name" "$addons_catalog"; then
			hint="$(suggest "$token")"
			problem="unknown add-on '$token'${hint:+. Did you mean '$hint'?}"
			return 1
		fi
		if [ -n "$value" ] && [ -z "$(conf "$name" param)" ]; then
			problem="the $name add-on takes no value; use '$name'"
			return 1
		fi
		if [ -n "$value" ]; then
			values="$(param_values "$name" | tr '\n' ' ')"
			contains "$value" "$values" || { problem="unknown $(conf "$name" param) '$value' for $name; choose $(printf '%s' "${values% }" | sed 's/ / or /g')"; return 1; }
			previous="$(param_of "$name")"
			if [ -n "$previous" ] && [ "$previous" != "$value" ]; then
				problem="choose one $(conf "$name" param) for $name, not both $previous and $value"
				return 1
			fi
			[ -n "$previous" ] || selected_params="$selected_params $name=$value"
		fi
		selected_addons="$selected_addons $name"
	done
	for addon in $addons_catalog; do contains "$addon" "$selected_addons" && ordered="$ordered $addon"; done
	selected_addons="${ordered# }"
}

# resolve_addons adds implied add-ons and checks language requirements.
resolve_addons() {
	local addon implied required ordered=""
	problem=""
	for addon in $selected_addons; do
		for implied in $(conf "$addon" implies | tr ',' ' '); do
			if ! contains "$implied" "$selected_addons"; then
				selected_addons="$selected_addons $implied"
				implied_notes="$implied_notes $implied:$addon"
			fi
		done
	done
	for addon in $addons_catalog; do contains "$addon" "$selected_addons" && ordered="$ordered $addon"; done
	selected_addons="${ordered# }"
	for addon in $selected_addons; do
		for required in $(conf "$addon" requires | tr ',' ' '); do
			if ! contains "$required" "$selected_languages"; then
				problem="the $addon add-on needs $required"
				return 1
			fi
		done
	done
}

missing_params() {
	local addon
	for addon in $selected_addons; do
		[ -z "$(conf "$addon" param)" ] || [ -n "$(param_of "$addon")" ] || printf '%s\n' "$addon"
	done
	return 0
}

addon_label() {
	local addon="$1" details="" note value
	value="$(param_of "$addon")"
	[ -z "$value" ] || details="$(conf "$addon@$value" title)"
	for note in $implied_notes; do
		[ "${note%%:*}" = "$addon" ] && details="${details:+$details; }included by ${note#*:}"
	done
	printf '%s%s' "$addon" "${details:+ ($details)}"
}

canonical_command() {
	local command="./init.sh $(printf '%s' "$selected_languages" | tr ' ' ',')" addon list="" value implied_only note
	for addon in $selected_addons; do
		implied_only=false
		for note in $implied_notes; do [ "${note%%:*}" = "$addon" ] && implied_only=true; done
		[ "$implied_only" = false ] || continue
		value="$(param_of "$addon")"
		list="$list,$addon${value:+=$value}"
	done
	[ -z "$list" ] || command="$command --with ${list#,}"
	printf '%s' "$command"
}

# ---- interactive mode -------------------------------------------------------

ask() {
	printf '%s' "$1" >&2
	IFS= read -r answer || fail "no answer received; run ./init.sh --help for the non-interactive form"
	# A typed answer ends its own line; a piped one does not.
	[ -t 0 ] || printf '\n' >&2
	printf '%s' "$answer"
}

# choose_from "WORDS" ANSWER translates numbers into words; names pass through.
choose_from() {
	local words="$1" token result="" index word
	for token in $(printf '%s' "$2" | tr ',' ' '); do
		case "$token" in
			*[!0-9]*) result="$result,$token" ;;
			*)
				index=0
				for word in $words; do
					index=$((index + 1))
					[ "$index" = "$token" ] && result="$result,$word"
				done
				[ "$token" -ge 1 ] && [ "$token" -le "$index" ] || result="$result,#$token"
				;;
		esac
	done
	printf '%s' "${result#,}"
}

interactive_selection() {
	local index language addon answer choice value values
	printf '%sagent-rules%s: initialize this repository\n\n%sLanguages%s\n' "$bold" "$reset" "$bold" "$reset" >&2
	index=0
	for language in $languages_catalog; do
		index=$((index + 1))
		printf '  %d) %-11s %s\n' "$index" "$language" "$(language_summary "$language")" >&2
	done
	while :; do
		answer="$(ask "Choose one or more, by number or name (for example 3 or 1,3): ")"
		choice="$(choose_from "$languages_catalog" "$answer")"
		case "$choice" in *'#'*) printf '  %s is not one of the numbers above\n' "$answer" >&2; continue ;; esac
		parse_languages "$choice" && break
		printf '  %s\n' "$problem" >&2
	done
	if contains typescript "$selected_languages"; then
		printf '\n%sAdd-ons%s for TypeScript (optional)\n' "$bold" "$reset" >&2
		index=0
		for addon in $addons_catalog; do
			index=$((index + 1))
			printf '  %d) %-10s %s\n' "$index" "$addon" "$(conf "$addon" summary)" >&2
		done
		while :; do
			answer="$(ask "Choose any, by number or name, or press Enter for none: ")"
			choice="$(choose_from "$addons_catalog" "$answer")"
			case "$choice" in *'#'*) printf '  %s is not one of the numbers above\n' "$answer" >&2; continue ;; esac
			selected_addons=""
			selected_params=""
			parse_addons "$choice" && break
			printf '  %s\n' "$problem" >&2
		done
	fi
	resolve_addons || usage_error "$problem"
	for addon in $(missing_params); do
		values="$(param_values "$addon" | tr '\n' ' ')"
		printf '\n%s%s%s\n' "$bold" "$(conf "$addon" param_prompt)" "$reset" >&2
		index=0
		for value in $values; do
			index=$((index + 1))
			printf '  %d) %-10s %s\n' "$index" "$value" "$(conf "$addon@$value" title)" >&2
		done
		while :; do
			answer="$(ask "Choose one: ")"
			value="$(choose_from "$values" "$answer")"
			contains "$value" "$values" && break
			printf '  choose one of the numbers or names above\n' >&2
		done
		selected_params="$selected_params $addon=$value"
	done
}

# ---- plan -------------------------------------------------------------------

gate_list() {
	local key="$1" addon items=""
	for addon in $selected_addons; do
		[ -z "$(conf "$addon" "$key")" ] || items="$items; $(conf "$addon" "$key")"
	done
	printf '%s' "${items#; }"
}

print_plan() {
	local addon labels="" extra
	for addon in $selected_addons; do labels="$labels, $(addon_label "$addon")"; done
	printf '\n%sPlan%s\n' "$bold" "$reset"
	printf '  %-12s %s\n' Languages "$(printf '%s' "$selected_languages" | sed 's/ /, /g')"
	[ -n "$labels" ] && labels="${labels#, }" || labels=none
	printf '  %-12s %s\n' Add-ons "$labels"
	printf '  %-12s %s\n' Command "$(canonical_command)"
	printf '\n%sGates%s\n' "$bold" "$reset"
	extra="$(gate_list commit_gates)"
	printf '  %-12s %s\n' Commit "format, lint, types, tests with coverage floors, staged secrets, file sizes, duplication${extra:+; $extra}"
	extra="$(gate_list full_gates)"
	printf '  %-12s %s\n' "Push and CI" "the commit gate plus dependency advisories and a full-history secret scan${extra:+; $extra}"
	extra="$(gate_list ci_gates)"
	[ -z "$extra" ] || printf '  %-12s %s\n' "CI only" "$extra"
	printf '\n'
}

# ---- repository preconditions ----------------------------------------------

precondition_problem() {
	local toplevel origin normalized status empty_dir
	toplevel="$(git_cmd rev-parse --show-toplevel 2>/dev/null || true)"
	[ -n "$toplevel" ] && [ "$(cd "$toplevel" && pwd -P)" = "$root" ] || { echo "run from the root of its own Git repository"; return; }
	[ "$(git_cmd branch --show-current)" = main ] || { echo "branch must be main"; return; }
	origin="$(git_cmd remote get-url origin 2>/dev/null || true)"
	normalized="$(printf '%s' "$origin" | tr '[:upper:]' '[:lower:]' | sed -E 's#/*$##; s#\.git$##; s#/*$##')"
	case "$normalized" in *github.com[:/]thytu/agent-rules) echo "canonical agent-rules source cannot materialize itself; create a repository from the template first"; return ;; esac
	git_cmd diff --quiet || { echo "tracked files differ from HEAD"; return; }
	git_cmd diff --cached --quiet || { echo "index differs from HEAD"; return; }
	status="$(git_cmd status --porcelain=v1 --untracked-files=all --ignored)"
	[ -z "$status" ] || { printf 'checkout contains untracked or ignored entries:\n%s' "$status"; return; }
	empty_dir="$(find "$root" -path "$root/.git" -prune -o -type d -empty -print -quit)"
	[ -z "$empty_dir" ] || { echo "checkout contains untracked empty directory ${empty_dir#$root/}"; return; }
}

# ---- arguments --------------------------------------------------------------

# The selection is split into words; no word may expand as a file pattern.
set -f
positional=""
with=""
dry_run=false
interactive=false
assume_yes=false
while [ "$#" -gt 0 ]; do
	case "$1" in
		-h | --help) usage; exit 0 ;;
		--list) list_catalog; exit 0 ;;
		--dry-run) dry_run=true ;;
		--interactive) interactive=true ;;
		-y | --yes) assume_yes=true ;;
		--with)
			shift
			[ "$#" -gt 0 ] || usage_error "--with needs a list of add-ons, such as --with nextjs,tailwind"
			with="$with,$1"
			;;
		--with=*) with="$with,${1#--with=}" ;;
		-*)
			hint=""
			for option in --with --dry-run --list --help --yes --interactive; do
				case "$option" in "${1:0:4}"*) hint="$option" ;; esac
			done
			usage_error "unknown option $1${hint:+. Did you mean $hint?}" "Run ./init.sh --help for usage."
			;;
		*) positional="$positional,$1" ;;
	esac
	shift
done

if [ -z "$positional" ]; then
	[ -z "$with" ] || usage_error "name the languages too, for example: ./init.sh typescript --with ${with#,}" "Run ./init.sh --help for usage."
	if [ "$interactive" = true ] || { [ -t 0 ] && [ -t 2 ]; }; then
		interactive=true
		interactive_selection
	else
		usage >&2
		exit 2
	fi
else
	parse_languages "${positional#,}" || usage_error "$problem" "Run ./init.sh --list to see every choice."
	parse_addons "${with#,}" || usage_error "$problem" "Run ./init.sh --list to see every choice."
	if ! resolve_addons; then
		message="$problem"
		suggested="$selected_languages"
		for addon in $selected_addons; do
			for required in $(conf "$addon" requires | tr ',' ' '); do contains "$required" "$suggested" || suggested="$suggested $required"; done
		done
		parse_languages "$suggested"
		usage_error "$message" "Try: $(canonical_command)"
	fi
	for addon in $(missing_params); do
		options=""
		for value in $(param_values "$addon"); do options="$options or $addon=$value"; done
		selected_params="$selected_params $addon=$(param_values "$addon" | head -n 1)"
		usage_error "choose a $(conf "$addon" param) for the $addon add-on: ${options# or }" "For example: $(canonical_command)"
	done
fi

set +f

# Units are the add-on directories to apply, in order: each add-on, its chosen
# variant, then every combination whose members are all selected.
units=()
for addon in $selected_addons; do
	units+=("$addon")
	value="$(param_of "$addon")"
	[ -z "$value" ] || units+=("$addon@$value")
done
for combination in "$root"/template/addons/*+*; do
	[ -d "$combination" ] || continue
	members="$(basename "$combination" | tr '+' ' ')"
	all=true
	for member in $members; do contains "$member" "$selected_addons" || all=false; done
	[ "$all" = false ] || units+=("$(basename "$combination")")
done

print_plan

problem="$(precondition_problem)"
if [ "$dry_run" = false ] && [ -n "$problem" ]; then fail "$problem"; fi

# ---- build the output in a temporary directory -----------------------------

tmp="$(mktemp -d "${TMPDIR:-/tmp}/agent-rules-init.XXXXXX")"
out="$tmp/output"
tools="$tmp/tools"
backup="$tmp/backup"
mkdir -p "$out" "$tools" "$backup"
cleanup() { rm -rf "$tmp"; }
trap cleanup EXIT

# copy_tree SOURCE DESTINATION [REPLACEABLE...]: merge a tree into the output;
# a file may land on an existing one only when it is listed as replaceable.
copy_tree() {
	local source="$1" destination="$2" entry rel
	shift 2
	[ -d "$source" ] || fail "missing overlay $source"
	while IFS= read -r -d '' entry; do
		rel="${entry#$source/}"
		if [ -d "$entry" ] && [ -d "$destination/$rel" ]; then continue; fi
		if [ -e "$destination/$rel" ] || [ -L "$destination/$rel" ]; then
			contains "$rel" "$*" || fail "overlay collision at $rel"
			rm -f "$destination/$rel"
		fi
	done < <(find "$source" -mindepth 1 -print0)
	mkdir -p "$destination"
	cp -a "$source/." "$destination/"
}

copy_tree "$root/template/core/files" "$out"
mkdir -p "$out/docs/rules"
cp -a "$root/docs/rules/." "$out/docs/rules/"
gitignore_fragments=("$root/template/core/gitignore.entries")
map_fragments=()
for language in $selected_languages; do
	copy_tree "$root/template/$language/files" "$out"
	gitignore_fragments+=("$root/template/$language/gitignore.entries")
	map_fragments+=("$root/template/$language/agent-map.rows")
	if [ "$language" = typescript ]; then
		copy_tree "$root/tooling/eslint-rules" "$out/tooling/eslint-rules"
		copy_tree "$root/test/eslint" "$out/test/eslint"
		cp "$root/template/typescript/lock/pnpm-lock.yaml" "$out/pnpm-lock.yaml"
	fi
done
for unit in ${units[@]+"${units[@]}"}; do
	dir="$root/template/addons/$unit"
	[ ! -d "$dir/files" ] || copy_tree "$dir/files" "$out" $(conf "$unit" replaces | tr ',' ' ')
	[ ! -f "$dir/gitignore.entries" ] || gitignore_fragments+=("$dir/gitignore.entries")
	[ ! -f "$dir/agent-map.rows" ] || map_fragments+=("$dir/agent-map.rows")
done

map_rows="$tmp/agent-map.rows"
: > "$map_rows"
for fragment in ${map_fragments[@]+"${map_fragments[@]}"}; do cat "$fragment" >> "$map_rows"; done
awk -v rows="$map_rows" '$0 == "<!-- LANGUAGE_ROWS -->" { while ((getline line < rows) > 0) print line; close(rows); next } { print }' "$out/AGENTS.md" > "$tmp/AGENTS.md"
mv "$tmp/AGENTS.md" "$out/AGENTS.md"
{
	for fragment in "${gitignore_fragments[@]}"; do cat "$fragment"; echo; done
} | awk 'NF == 0 { pending = seen; next } !lines[$0]++ { if (pending) print ""; pending = 0; seen = 1; print }' > "$out/.gitignore"
selection_line="Materialized with: \`$(canonical_command)\`."
awk -v line="$selection_line" '$0 == "<!-- SELECTION -->" { print line; next } { print }' "$out/README.md" > "$tmp/README.md"
mv "$tmp/README.md" "$out/README.md"

if [ "$dry_run" = true ]; then
	printf '%sFiles%s\n' "$bold" "$reset"
	(cd "$out" && find . -mindepth 1 \( -type f -o -type l \) | sed 's#^\./#  #' | sort)
	printf '\n%sDry run:%s nothing changed.' "$bold" "$reset"
	if [ -n "$problem" ]; then
		printf ' Initialization would stop now because:\n  %s\n' "$problem"
		exit 1
	fi
	printf ' Run the command above to initialize.\n'
	exit 0
fi

if [ "$interactive" = true ] && [ "$assume_yes" = false ]; then
	answer="$(ask "Initialize this repository now? [Y/n] ")"
	case "$answer" in "" | y | Y | yes | YES | Yes) ;; *) printf 'init: nothing changed\n' >&2; exit 1 ;; esac
fi

if contains typescript "$selected_languages"; then
	printf 'init: composing the TypeScript configuration\n'
	"$out/scripts/setup-typescript.sh" --toolchain-only --tools-dir "$tools" > "$tmp/toolchain.log" 2>&1 || { cat "$tmp/toolchain.log" >&2; fail "could not install the pinned Node and pnpm; nothing was changed"; }
	(
		export PATH="$tools/node/bin:$PATH" COREPACK_HOME="$tools/corepack"
		node "$root/template/init/compose.mjs" apply "$root/template" "$out" ${units[@]+"${units[@]}"}
		cd "$out"
		# The committed lockfile pins every add-on; pruning keeps only this
		# selection's packages, at those exact versions.
		node "$tools/run-bounded.cjs" 300000 pnpm install --lockfile-only --ignore-scripts > "$tmp/lock.log" 2>&1 || { cat "$tmp/lock.log" >&2; exit 1; }
	) || fail "could not compose the TypeScript configuration; nothing was changed"
fi

"$out/scripts/setup.sh" --structure-only --tools-dir "$tools"
ACTIONLINT_BIN="$tools/actionlint" "$out/scripts/verify.sh" --structure-only

# ---- replace the template with rollback protection --------------------------

shopt -s dotglob nullglob
for entry in "$root"/*; do
	[ "$(basename "$entry")" = .git ] && continue
	cp -a "$entry" "$backup/"
done
shopt -u dotglob nullglob
cp -p "$root/.git/config" "$tmp/git-config"

rollback() {
	trap - ERR INT TERM
	shopt -s dotglob nullglob
	for entry in "$root"/*; do [ "$(basename "$entry")" = .git ] || rm -rf "$entry"; done
	for entry in "$backup"/*; do cp -a "$entry" "$root/"; done
	cp -p "$tmp/git-config" "$root/.git/config"
	shopt -u dotglob nullglob
	echo "init: replacement failed; original checkout restored" >&2
}
trap rollback ERR INT TERM
shopt -s dotglob nullglob
for entry in "$root"/*; do [ "$(basename "$entry")" = .git ] || rm -rf "$entry"; done
cp -a "$out/." "$root/"
shopt -u dotglob nullglob
diff -qr -x .git "$out" "$root" >/dev/null

"$root/scripts/setup.sh"
if [ -x "$root/node_modules/.bin/biome" ]; then
	# The composer writes plain JSON; the pinned Biome owns its final layout.
	(cd "$root" && PATH="$root/.agent-rules/tools/node/bin:$PATH" node_modules/.bin/biome format --write tsconfig.json biome.json .c8rc.json > /dev/null)
fi
"$root/scripts/verify.sh" --structure-only
for language in python rust typescript; do
	[ ! -x "$root/scripts/verify-$language.sh" ] || "$root/scripts/verify-$language.sh"
done
trap - ERR INT TERM

printf '\n%sinit:%s materialized %s\n' "$green" "$reset" "$(canonical_command | sed 's#^\./init\.sh ##')"
cat <<EOF
Next:
  1. git add -A && git commit -m "chore: initialize repository"
     The commit gate verifies exactly the committed tree.
  2. git push
     The push gate runs the full verification, including dependency advisories.
  3. bash scripts/setup-github.sh
     Rulesets, required checks, and vulnerability alerts for the GitHub repository.
EOF
