#!/usr/bin/env bash
set -euo pipefail

script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)
promotion_script="$script_dir/promote-release.sh"
temp_root=$(cd "${TMPDIR:-/tmp}" && pwd -P)
context=$(mktemp -d "$temp_root/arcade-promotion-check.XXXXXXXX")

cleanup() {
  local resolved
  resolved=$(cd "$context" && pwd -P)
  case "$resolved" in
    "$temp_root"/arcade-promotion-check.*) rm -rf -- "$resolved" ;;
    *) echo "Refusing to remove unexpected temporary directory: $resolved" >&2 ;;
  esac
}
trap cleanup EXIT

git init --bare --initial-branch=main "$context/remote.git" >/dev/null
git clone --quiet "$context/remote.git" "$context/author"
(
  cd "$context/author"
  git config user.name 'Arcade Release Test'
  git config user.email 'arcade-release-test@example.invalid'
  mkdir -p scripts
  cp "$promotion_script" scripts/promote-release.sh
  printf '%s\n' '# Arcade test repository' > README.md
  git add .
  git commit --quiet -m 'Create main'
  git push --quiet origin main
)

run_promotion() {
  local bump=$1
  local runner="$context/runner-${bump}-$(date +%s%N)"
  git clone --quiet --branch main "$context/remote.git" "$runner"
  (
    cd "$runner"
    git config user.name 'Arcade Release Test'
    git config user.email 'arcade-release-test@example.invalid'
    BUMP="$bump" bash scripts/promote-release.sh
  )
}

assert_release() {
  local version=$1
  local release_tag="v${version}"
  local release_commit
  local tag_commit
  release_commit=$(git --git-dir="$context/remote.git" rev-parse refs/heads/release)
  tag_commit=$(git --git-dir="$context/remote.git" rev-parse "refs/tags/${release_tag}^{commit}")
  test "$release_commit" = "$tag_commit"
  test "$(git --git-dir="$context/remote.git" show "${release_tag}:release-version.txt")" = "$version"
}

run_promotion patch
assert_release 0.1.0

# A release-only setting must survive future main promotions.
git clone --quiet --branch release "$context/remote.git" "$context/release-author"
(
  cd "$context/release-author"
  git config user.name 'Arcade Release Test'
  git config user.email 'arcade-release-test@example.invalid'
  printf '%s\n' 'keep this setting' > release-only-setting.txt
  git add release-only-setting.txt
  git commit --quiet -m 'Keep a release setting'
  git push --quiet origin release
)

git clone --quiet --branch main "$context/remote.git" "$context/main-author"
(
  cd "$context/main-author"
  git config user.name 'Arcade Release Test'
  git config user.email 'arcade-release-test@example.invalid'
  printf '%s\n' 'Second main change' >> README.md
  git commit --quiet -am 'Add another game'
  git push --quiet origin main
)

run_promotion minor
assert_release 0.2.0
test "$(git --git-dir="$context/remote.git" show refs/heads/release:release-only-setting.txt)" = 'keep this setting'

git clone --quiet --branch main "$context/remote.git" "$context/main-author-patch"
(
  cd "$context/main-author-patch"
  git config user.name 'Arcade Release Test'
  git config user.email 'arcade-release-test@example.invalid'
  printf '%s\n' 'Third main change' >> README.md
  git commit --quiet -am 'Tune the game'
  git push --quiet origin main
)

run_promotion patch
assert_release 0.2.1

run_promotion major
assert_release 1.0.0

echo 'Release promotion checks passed.'
