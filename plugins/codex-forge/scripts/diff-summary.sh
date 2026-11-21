#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: diff-summary.sh [-h|--help] [base]

Summarize the changes on HEAD relative to a base revision, plus the
working tree state, for use by the forge skills.

Arguments:
  base        Any Git revision that names a commit (branch, remote branch,
              tag, SHA, HEAD~N, :/<message>, ...). When omitted, the first
              existing ref of
              origin/HEAD, origin/main, origin/master, origin/develop is used.
  -h, --help  Show this help and exit.

Output (stdout):
  NO_CHANGES when there is no diff from the merge-base and the working tree
  is clean. Otherwise these sections, in this order:
    ## base           the base revision used
    ## merge-base     merge-base of HEAD and base
    ## changed files  git diff --name-status from the merge-base
    ## working tree   git status --short
    ## diffstat       git diff --stat from the merge-base

Exit status:
  0    summary or NO_CHANGES printed, or help shown
  1    not a git repository, base not found, or no base could be detected
       (one "error: ..." line on stderr); also when HEAD and base have
       no common ancestor (nothing is printed in that case)
  128  Git itself failed and its own diagnostic is shown on stderr, e.g.
       no work tree (bare repository or inside .git), a repository Git
       refuses to use (dubious ownership; see git config safe.directory),
       or GIT_DIR set to a path that is not a repository
USAGE
}

die() {
  printf 'error: %s\n' "$1" >&2
  exit 1
}

# Escape backslashes and control characters so a message stays on one line.
# Runs in a subshell so switching to the C locale never touches the caller's
# locale (restoring an unusable one would make bash print a warning).
escape() (
  LC_ALL=C
  local s="$1" out='' c i
  for ((i = 0; i < ${#s}; i++)); do
    c="${s:i:1}"
    case "$c" in
      \\) out+="\\\\" ;;
      $'\n') out+='\n' ;;
      $'\r') out+='\r' ;;
      $'\t') out+='\t' ;;
      [[:cntrl:]]) out+="$(printf '\\x%02X' "'$c")" ;;
      *) out+="$c" ;;
    esac
  done
  printf '%s' "$out"
)

case "${1:-}" in
  -h | --help)
    usage
    exit 0
    ;;
esac

# Classify with untranslated messages. Only a failed repository discovery
# ("not a git repository (or any ...") gets the fixed error; anything else
# (dubious ownership, a GIT_DIR that is not a repository: "not a git
# repository: '<path>'", ...) is re-run so Git's own diagnostic, in the
# user's locale, reaches the user with Git's exit status. env(1) sets the
# locale for Git only, so bash itself never switches locale here.
if ! repo_error="$(env LC_ALL=C git rev-parse --git-dir 2>&1 >/dev/null)"; then
  case "$repo_error" in
    'fatal: not a git repository ('*) die 'not a git repository' ;;
  esac
  git rev-parse --git-dir >/dev/null
fi

# Sets base (shown in "## base") and base_rev (what merge-base uses).
# For an explicit base, base_rev is the commit ID it was validated as, so
# the expression is not re-resolved differently later (e.g. a trailing
# newline in ":/<text>"). base is shown like before: as given, minus any
# trailing newlines.
resolve_base() {
  if [ -n "${1:-}" ]; then
    local oid commit
    # A leading '-' would be parsed as an option, and no ref can start with one.
    case "$1" in -*) die "base '$(escape "$1")' not found" ;; esac
    # Resolve the expression as given first (so ":/<message>" is not
    # extended by "^{commit}"), then peel the object ID to a commit.
    if ! oid="$(git rev-parse --verify --quiet "$1" 2>/dev/null)" ||
      ! commit="$(git rev-parse --verify --quiet "$oid^{commit}" 2>/dev/null)"; then
      die "base '$(escape "$1")' not found"
    fi
    base="$(printf '%s' "$1")"
    base_rev="$commit"
    return
  fi
  local candidate
  for candidate in origin/HEAD origin/main origin/master origin/develop; do
    if git rev-parse --verify --quiet "$candidate" >/dev/null; then
      base="$candidate"
      base_rev="$candidate"
      return
    fi
  done
  die 'base branch not found; pass one explicitly'
}

resolve_base "${1:-}"
merge_base="$(git merge-base HEAD "$base_rev")"
name_status="$(git diff --name-status "$merge_base")"
untracked="$(git status --short)"

if [ -z "$name_status" ] && [ -z "$untracked" ]; then
  printf '%s\n' NO_CHANGES
  exit 0
fi

printf '## base\n%s\n\n' "$base"
printf '## merge-base\n%s\n\n' "$merge_base"
printf '## changed files\n%s\n\n' "${name_status:-(none)}"
printf '## working tree\n%s\n\n' "${untracked:-(none)}"
printf '## diffstat\n'
git diff --stat "$merge_base"
