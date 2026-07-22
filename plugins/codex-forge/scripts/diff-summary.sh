#!/usr/bin/env bash
set -euo pipefail

resolve_base() {
  if [ -n "${1:-}" ]; then
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
  printf '%s\n' "error: base branch not found; pass one explicitly" >&2
  exit 1
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
