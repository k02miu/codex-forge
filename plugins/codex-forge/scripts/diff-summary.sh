#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: diff-summary.sh [-h|--help] [base]

Summarize the changes on HEAD relative to a base revision, plus the
working tree state, for use by the forge skills.

Arguments:
  base        Any Git revision that names a commit (branch, remote branch,
              tag, SHA, HEAD~N, ...). When omitted, the first existing ref of
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
  0  summary or NO_CHANGES printed, or help shown
  1  not a git repository, base not found, or no base could be detected
USAGE
}

die() {
  printf 'error: %s\n' "$1" >&2
  exit 1
}

case "${1:-}" in
  -h | --help)
    usage
    exit 0
    ;;
esac

git rev-parse --git-dir >/dev/null 2>&1 || die 'not a git repository'

resolve_base() {
  if [ -n "${1:-}" ]; then
    # A leading '-' would be parsed as an option, and no ref can start with one.
    case "$1" in -*) die "base '$1' not found" ;; esac
    git rev-parse --verify --quiet "$1^{commit}" >/dev/null 2>&1 ||
      die "base '$1' not found"
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
