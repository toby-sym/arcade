#!/usr/bin/env bash
set -euo pipefail

repo_root=$(git rev-parse --show-toplevel)
cd "$repo_root"

bump=${BUMP:-patch}
case "$bump" in
  patch|minor|major) ;;
  *) echo "BUMP must be patch, minor, or major." >&2; exit 2 ;;
esac

git fetch origin --prune --tags
git fetch origin refs/heads/main:refs/remotes/origin/main
git switch --detach refs/remotes/origin/main

latest_tag=$(git tag --list 'v[0-9]*' --sort=-version:refname | while IFS= read -r candidate; do
  if [[ "$candidate" =~ ^v(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$ ]]; then
    printf '%s\n' "$candidate"
    break
  fi
done)

if [[ -z "$latest_tag" ]]; then
  release_version=0.1.0
else
  IFS=. read -r major minor patch_number <<< "${latest_tag#v}"
  case "$bump" in
    patch) patch_number=$((patch_number + 1)) ;;
    minor) minor=$((minor + 1)); patch_number=0 ;;
    major) major=$((major + 1)); minor=0; patch_number=0 ;;
  esac
  release_version="${major}.${minor}.${patch_number}"
fi

release_tag="v${release_version}"
if git show-ref --verify --quiet "refs/tags/${release_tag}"; then
  echo "Tag ${release_tag} already exists; refusing to overwrite it." >&2
  exit 1
fi

if git ls-remote --exit-code --heads origin release >/dev/null 2>&1; then
  git fetch origin refs/heads/release:refs/remotes/origin/release
  git switch --create release --track refs/remotes/origin/release
  git merge --no-edit refs/remotes/origin/main
else
  git switch --create release refs/remotes/origin/main
fi

printf '%s\n' "$release_version" > release-version.txt
git add release-version.txt
git commit --message "Record version ${release_version} for deployment"
git tag --annotate "$release_tag" --message "Arcade ${release_tag}"

# Publish the versioned branch and its tag together so production never sees
# an unversioned release commit followed by a second version-only push.
git push --atomic origin HEAD:refs/heads/release "refs/tags/${release_tag}"

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  printf 'version=%s\n' "$release_version" >> "$GITHUB_OUTPUT"
  printf 'tag=%s\n' "$release_tag" >> "$GITHUB_OUTPUT"
fi

printf 'Published Arcade %s on release with tag %s.\n' "$release_version" "$release_tag"
