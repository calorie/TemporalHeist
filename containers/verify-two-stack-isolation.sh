#!/bin/sh
# Host-side Docker/Git orchestration only. Application commands run in containers.
set -eu

usage() {
  echo "Usage: sh containers/verify-two-stack-isolation.sh WORKTREE_A RUN_ID_A WORKTREE_B RUN_ID_B [EVIDENCE_DIR]" >&2
  exit 2
}

[ "$#" -ge 4 ] && [ "$#" -le 5 ] || usage
worktree_a=$1
run_a=$2
worktree_b=$3
run_b=$4
evidence_dir=${5:-/tmp/temporal-heist-isolation-$run_a-$run_b}

[ -e "$worktree_a/.git" ] || { echo "Not a Git worktree: $worktree_a" >&2; exit 2; }
[ -e "$worktree_b/.git" ] || { echo "Not a Git worktree: $worktree_b" >&2; exit 2; }
[ "$worktree_a" != "$worktree_b" ] || { echo 'Worktrees must be distinct' >&2; exit 2; }
[ "$run_a" != "$run_b" ] || { echo 'Run IDs must be distinct' >&2; exit 2; }
case "$run_a$run_b" in *[!a-z0-9-]*) echo 'Run IDs must contain only a-z, 0-9, and hyphens' >&2; exit 2;; esac
worktree_a=$(cd "$worktree_a" && pwd -P)
worktree_b=$(cd "$worktree_b" && pwd -P)
[ "$worktree_a" != "$worktree_b" ] || { echo 'Worktrees resolve to the same path' >&2; exit 2; }
head_a=$(git -C "$worktree_a" rev-parse HEAD)
head_b=$(git -C "$worktree_b" rev-parse HEAD)

if [ -d /Applications/Docker.app/Contents/Resources/bin ]; then
  PATH="/Applications/Docker.app/Contents/Resources/bin:$PATH"
  export PATH
fi

project_a=th-$run_a
project_b=th-$run_b
mkdir -p "$evidence_dir"
log_a=$evidence_dir/acceptance-a.log
log_b=$evidence_dir/acceptance-b.log

compose_a() { (cd "$worktree_a" && sh container "$run_a" "$@"); }
compose_b() { (cd "$worktree_b" && sh container "$run_b" "$@"); }
pid_a=
pid_b=
cleanup() {
  [ -z "$pid_a" ] || kill "$pid_a" >/dev/null 2>&1 || true
  [ -z "$pid_b" ] || kill "$pid_b" >/dev/null 2>&1 || true
  compose_a down --volumes --remove-orphans >/dev/null 2>&1 || true
  compose_b down --volumes --remove-orphans >/dev/null 2>&1 || true
}
trap cleanup EXIT HUP INT TERM

project_containers() { docker ps -q --filter "label=com.docker.compose.project=$1" | sort; }
project_networks() { docker network ls -q --filter "label=com.docker.compose.project=$1" | sort; }
project_volumes() { docker volume ls -q --filter "label=com.docker.compose.project=$1" | sort; }
browser_running() {
  [ -n "$(docker ps -q \
    --filter "label=com.docker.compose.project=$1" \
    --filter 'label=com.docker.compose.service=browser')" ]
}
assert_disjoint() {
  left=$1
  right=$2
  [ -z "$(printf '%s\n%s\n' "$left" "$right" | sed '/^$/d' | sort | uniq -d)" ]
}
assert_no_published_ports() {
  for container_id in $(project_containers "$1"); do
    bindings=$(docker inspect --format '{{json .HostConfig.PortBindings}}' "$container_id")
    [ "$bindings" = '{}' ] || [ "$bindings" = 'null' ] || {
      echo "Container $container_id publishes host ports: $bindings" >&2
      return 1
    }
  done
}
json_array() {
  result=''
  for value in $1; do
    [ -z "$result" ] || result="$result,"
    result="$result\"$value\""
  done
  printf '[%s]' "$result"
}

echo "Starting isolated acceptance stacks $project_a and $project_b"
(compose_a acceptance >"$log_a" 2>&1) &
pid_a=$!
(compose_b acceptance >"$log_b" 2>&1) &
pid_b=$!

deadline=$(($(date +%s) + ${TH_ISOLATION_OBSERVE_TIMEOUT_SECONDS:-1200}))
while :; do
  if browser_running "$project_a" && browser_running "$project_b"; then
    break
  fi
  if ! kill -0 "$pid_a" 2>/dev/null || ! kill -0 "$pid_b" 2>/dev/null; then
    echo "An acceptance run ended before both browser services were live; see $evidence_dir" >&2
    exit 1
  fi
  [ "$(date +%s)" -lt "$deadline" ] || {
    echo "Timed out waiting for both browser services; see $evidence_dir" >&2
    exit 1
  }
  sleep 2
done

live_containers_a=$(project_containers "$project_a")
live_containers_b=$(project_containers "$project_b")
networks_a=$(project_networks "$project_a")
networks_b=$(project_networks "$project_b")
volumes_a=$(project_volumes "$project_a")
volumes_b=$(project_volumes "$project_b")
[ -n "$live_containers_a" ] && [ -n "$live_containers_b" ]
[ -n "$networks_a" ] && [ -n "$networks_b" ]
[ -n "$volumes_a" ] && [ -n "$volumes_b" ]
assert_disjoint "$live_containers_a" "$live_containers_b"
assert_disjoint "$networks_a" "$networks_b"
assert_disjoint "$volumes_a" "$volumes_b"
assert_no_published_ports "$project_a"
assert_no_published_ports "$project_b"

status_a=0
status_b=0
wait "$pid_a" || status_a=$?
wait "$pid_b" || status_b=$?
[ "$status_a" -eq 0 ] && [ "$status_b" -eq 0 ] || {
  echo "Acceptance failed (A=$status_a, B=$status_b); see $evidence_dir" >&2
  exit 1
}

containers_b_before=$(project_containers "$project_b")
networks_b_before=$(project_networks "$project_b")
volumes_b_before=$(project_volumes "$project_b")
for service in relay authority web; do
  [ -n "$(docker ps -q \
    --filter "label=com.docker.compose.project=$project_b" \
    --filter "label=com.docker.compose.service=$service")" ] || {
    echo "Stack B service is not running: $service" >&2
    exit 1
  }
done

compose_a down --volumes --remove-orphans >/dev/null
[ -z "$(docker ps -aq --filter "label=com.docker.compose.project=$project_a")" ]
[ -z "$(project_networks "$project_a")" ]
[ -z "$(project_volumes "$project_a")" ]
[ "$containers_b_before" = "$(project_containers "$project_b")" ]
[ "$networks_b_before" = "$(project_networks "$project_b")" ]
[ "$volumes_b_before" = "$(project_volumes "$project_b")" ]

compose_b exec -T web node -e \
  "fetch('http://web:5173/healthz').then(r => { if (!r.ok) throw new Error(String(r.status)) })"

cat >"$evidence_dir/evidence.json" <<EOF
{
  "schema_version": 1,
  "result": "passed",
  "projects": ["$project_a", "$project_b"],
  "worktrees": [
    {"path": "$worktree_a", "head": "$head_a", "run_id": "$run_a", "room_id": "$run_a"},
    {"path": "$worktree_b", "head": "$head_b", "run_id": "$run_b", "room_id": "$run_b"}
  ],
  "both_browsers_observed_live": true,
  "no_published_ports": true,
  "live_container_ids_a": $(json_array "$live_containers_a"),
  "live_container_ids_b": $(json_array "$live_containers_b"),
  "network_ids_a": $(json_array "$networks_a"),
  "network_ids_b": $(json_array "$networks_b"),
  "volume_names_a": $(json_array "$volumes_a"),
  "volume_names_b": $(json_array "$volumes_b"),
  "acceptance_exit_a": $status_a,
  "acceptance_exit_b": $status_b,
  "stack_a_removed_with_volumes": true,
  "stack_b_resource_ids_preserved": true,
  "stack_b_health_after_a_removal": "passed"
}
EOF

echo "Two-stack isolation passed; evidence: $evidence_dir/evidence.json"
