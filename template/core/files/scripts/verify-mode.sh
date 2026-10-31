# Sourced by each scripts/verify-<language>.sh with its name and arguments.
# Sets `mode` to full (default), commit, or results, and `results` to the
# output file of --test-results.
verifier="$1"
shift
mode=full
results=
case "${1:-}" in
	"" | --full) ;;
	--commit) mode=commit ;;
	--test-results)
		mode=results
		results="${2:?$verifier: --test-results requires an output file}"
		;;
	*) echo "$verifier: unknown argument $1 (expected --full, --commit, or --test-results FILE)" >&2; exit 2 ;;
esac
