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
       no work tree (bare repository or inside .git) or a repository Git
       refuses to use (dubious ownership; see git config safe.directory)
USAGE
}

die() {
  printf 'error: %s\n' "$1" >&2
  exit 1
}

# Escape backslashes and control characters so a message stays on one line.
escape() {
  local LC_ALL=C s="$1" out='' c i
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
}

case "${1:-}" in
  -h | --help)
    usage
    exit 0
    ;;
esac

# Classify with untranslated messages; anything other than "not a git
# repository" (e.g. dubious ownership) is re-run so Git's own diagnostic,
# in the user's locale, reaches the user with Git's exit status.
if ! repo_error="$(LC_ALL=C git rev-parse --git-dir 2>&1 >/dev/null)"; then
  case "$repo_error" in
    'fatal: not a git repository'*) die 'not a git repository' ;;
  esac
  git rev-parse --git-dir >/dev/null
fi

resolve_base() {
  if [ -n "${1:-}" ]; then
    local oid
    # A leading '-' would be parsed as an option, and no ref can start with one.
    case "$1" in -*) die "base '$(escape "$1")' not found" ;; esac
    # Resolve the expression as given first (so ":/<message>" is not
    # extended by "^{commit}"), then peel the object ID to a commit.
    if ! oid="$(git rev-parse --verify --quiet "$1" 2>/dev/null)" ||
      ! git rev-parse --verify --quiet "$oid^{commit}" >/dev/null 2>&1; then
      die "base '$(escape "$1")' not found"
    fi
    printf '%s\n' "$1"
    return
  fi
  local candidate
  for candidate in origin/HEAD origin/main origin/master origin/develop; do
    if git rev-parse --verify --quiet "$candidate" >/dev/null; then
      printf '%s\n' "$candidate"
      return
    fi
  done
  die 'base branch not found; pass one explicitly'
}

base="$(resolve_base "${1:-}")"
merge_base="$(git merge-base HEAD "$base")"
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
