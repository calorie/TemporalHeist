#!/bin/sh
set -eu

version=${TH_RELEASE_VERSION:?release metadata is required}
revision=${TH_RELEASE_REVISION:?release metadata is required}
created=${TH_RELEASE_CREATED:?release metadata is required}
source=${TH_RELEASE_SOURCE:?release metadata is required}

assert_image() {
  role=$1
  expected_user=$2
  image="temporal-heist-$role:$version"

  test "$(docker image inspect "$image" --format '{{.Config.User}}')" = "$expected_user"
  test "$(docker image inspect "$image" --format '{{index .Config.Labels "org.opencontainers.image.source"}}')" = "$source"
  test "$(docker image inspect "$image" --format '{{index .Config.Labels "org.opencontainers.image.revision"}}')" = "$revision"
  test "$(docker image inspect "$image" --format '{{index .Config.Labels "org.opencontainers.image.version"}}')" = "$version"
  test "$(docker image inspect "$image" --format '{{index .Config.Labels "org.opencontainers.image.created"}}')" = "$created"

  docker run --rm --read-only --tmpfs /tmp:size=16m,mode=1777 \
    --cap-drop ALL --security-opt no-new-privileges --entrypoint sh "$image" -eu -c '
      for tool in cargo rustc node npm git; do
        if command -v "$tool" >/dev/null 2>&1; then
          echo "forbidden development tool: $tool" >&2
          exit 1
        fi
      done
      for source_path in /workspace /app /src /usr/src/app; do
        test ! -e "$source_path"
      done
      if touch /rootfs-write-test 2>/dev/null; then
        echo "root filesystem is writable" >&2
        exit 1
      fi
      test "$(id -u)" != 0
      test "$(id -g)" != 0
      touch /tmp/runtime-write-test
    '
}

assert_image authority 65532:65532
assert_image web 101:101
echo 'release runtime image contract passed'
