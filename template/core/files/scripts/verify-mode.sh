# Sourced by each scripts/verify-<language>.sh with its name and arguments.
# Sets `mode` to full (default) or commit.
verifier="$1"
shift
mode=full
case "${1:-}" in
	"" | --full) ;;
	--commit) mode=commit ;;
	*) echo "$verifier: unknown argument $1 (expected --full or --commit)" >&2; exit 2 ;;
esac
