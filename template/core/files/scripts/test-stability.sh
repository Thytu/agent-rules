#!/usr/bin/env bash
set -euo pipefail

# Runs every selected language's tests three times and fails when any test's
# outcome differs between runs. A test that fails every time is a plain failure
# for the quality gate; this check reports only outcomes that change.
root="$(cd "$(dirname "$0")/.." && pwd -P)"
runs=3
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

languages=()
for language in python rust typescript; do
	[ -x "$root/scripts/verify-$language.sh" ] && languages+=("$language")
done
[ "${#languages[@]}" -gt 0 ] || { echo "test-stability: no language tooling is selected"; exit 0; }

for language in "${languages[@]}"; do
	for run in $(seq 1 "$runs"); do
		echo "test-stability: $language run $run of $runs"
		# A failing run is an outcome to compare, not a reason to stop.
		"$root/scripts/verify-$language.sh" --test-results "$work/$language.$run" || true
		[ -f "$work/$language.$run" ] || : > "$work/$language.$run"
	done
done

report="$work/report.md"
status=0
for language in "${languages[@]}"; do
	# awk reads "run=N FILE" pairs, so an empty file still counts as a run.
	operands=()
	for run in $(seq 1 "$runs"); do operands+=("run=$run" "$work/$language.$run"); done
	# Each line is "outcome<TAB>test id". A test missing from a run counts as
	# "absent" there, which catches crashes and tests that sometimes vanish.
	awk -F '\t' -v runs="$runs" -v language="$language" -v counts="$work/$language.counts" '
		NF >= 2 { outcome[$2, run] = $1; seen[$2] = 1 }
		END {
			for (id in seen) {
				first = ""; changed = 0; line = ""
				for (r = 1; r <= runs; r++) {
					value = ((id, r) in outcome) ? outcome[id, r] : "absent"
					if (r == 1) first = value; else if (value != first) changed = 1
					line = line " | " value
				}
				if (changed) { printf "| %s | `%s`%s |\n", language, id, line; flaky++ }
				total++
			}
			printf "%d\t%d\n", total, flaky > counts
		}' "${operands[@]}" >> "$report.rows"
	read -r total flaky < "$work/$language.counts"
	echo "test-stability: $language: ${flaky:-0} of ${total:-0} tests changed outcome across $runs runs"
	[ "${flaky:-0}" -eq 0 ] || status=1
done

if [ "$status" -ne 0 ]; then
	{
		echo "## Flaky tests"
		echo
		echo "These tests did not produce the same outcome in every run. Fix the nondeterminism (shared state, real time, ordering, network) rather than retrying."
		echo
		header="| Language | Test"
		divider="| --- | ---"
		for run in $(seq 1 "$runs"); do header="$header | Run $run"; divider="$divider | ---"; done
		echo "$header |"
		echo "$divider |"
		sort "$report.rows"
	} > "$report"
	cat "$report"
	[ -z "${GITHUB_STEP_SUMMARY:-}" ] || cat "$report" >> "$GITHUB_STEP_SUMMARY"
	exit 1
fi
[ -z "${GITHUB_STEP_SUMMARY:-}" ] || echo "## Test stability: every test produced the same outcome in $runs runs" >> "$GITHUB_STEP_SUMMARY"
echo "test-stability: every test produced the same outcome in $runs runs"
