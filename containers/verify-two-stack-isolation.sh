#!/bin/sh
# Host-side Git/Docker orchestration only. Project processes run in containers.
set -eu

[ "$#" -ge 4 ] && [ "$#" -le 5 ] || { echo "Usage: $0 WORKTREE_A RUN_ID_A WORKTREE_B RUN_ID_B [EVIDENCE_DIR]" >&2; exit 2; }
worktree_a=$1; run_a=$2; worktree_b=$3; run_b=$4
evidence_dir=${5:-/tmp/temporal-heist-isolation-$run_a-$run_b}
[ "$worktree_a" != "$worktree_b" ] && [ "$run_a" != "$run_b" ]
case "$run_a$run_b" in *[!a-z0-9-]*) exit 2;; esac
worktree_a=$(cd "$worktree_a" && pwd -P); worktree_b=$(cd "$worktree_b" && pwd -P)
head_a=$(git -C "$worktree_a" rev-parse HEAD); head_b=$(git -C "$worktree_b" rev-parse HEAD)
[ "$head_a" = "$head_b" ]
[ -z "$(git -C "$worktree_a" status --porcelain)" ]; [ -z "$(git -C "$worktree_b" status --porcelain)" ]
if [ -d /Applications/Docker.app/Contents/Resources/bin ]; then PATH="/Applications/Docker.app/Contents/Resources/bin:$PATH"; export PATH; fi
project_a=th-$run_a; project_b=th-$run_b
mkdir -p "$evidence_dir"; evidence_dir=$(cd "$evidence_dir" && pwd -P)
log_a=$evidence_dir/visual-a.log; log_b=$evidence_dir/visual-b.log
compose_a() { (cd "$worktree_a" && sh container "$run_a" "$@"); }
compose_b() { (cd "$worktree_b" && sh container "$run_b" "$@"); }
pid_a=; pid_b=
cleanup() {
  [ -z "$pid_a" ] || kill "$pid_a" >/dev/null 2>&1 || true
  [ -z "$pid_b" ] || kill "$pid_b" >/dev/null 2>&1 || true
  compose_a down --volumes --remove-orphans >/dev/null 2>&1 || true
  compose_b down --volumes --remove-orphans >/dev/null 2>&1 || true
}
trap cleanup EXIT HUP INT TERM
containers() { docker ps -q --filter "label=com.docker.compose.project=$1" | sort; }
networks() { docker network ls -q --filter "label=com.docker.compose.project=$1" | sort; }
volumes() { docker volume ls -q --filter "label=com.docker.compose.project=$1" | sort; }
service_id() { docker ps -q --filter "label=com.docker.compose.project=$1" --filter "label=com.docker.compose.service=$2"; }
assert_disjoint() { [ -z "$(printf '%s\n%s\n' "$1" "$2" | sed '/^$/d' | sort | uniq -d)" ]; }
published_ports() {
  for service in visual-browser-a visual-browser-b; do
    id=$(service_id "$1" "$service"); [ -n "$id" ]
    docker inspect "$id" --format '{{(index (index .NetworkSettings.Ports "6080/tcp") 0).HostIp}}:{{(index (index .NetworkSettings.Ports "6080/tcp") 0).HostPort}}'
  done | sort
}
json_array() { result=''; for value in $1; do [ -z "$result" ] || result="$result,"; result="$result\"$value\""; done; printf '[%s]' "$result"; }
export_visual_artifacts() {
  compose_command=$1; export_run_id=$2; destination=$3
  mkdir -p "$destination"
  "$compose_command" --profile visual run --rm --no-deps --entrypoint sh \
    -v "$destination:/evidence" visual-browser-a \
    -c 'find /evidence -mindepth 1 -delete && cp -R /artifacts/. /evidence/' >/dev/null
  for player in 1 2; do
    test -s "$destination/visual-$export_run_id/player-$player-lobby.png"
    test -s "$destination/visual-$export_run_id/player-$player-metadata.json"
  done
}

(compose_a visual >"$log_a" 2>&1) & pid_a=$!
(compose_b visual >"$log_b" 2>&1) & pid_b=$!
status_a=0; status_b=0
wait "$pid_a" || status_a=$?; pid_a=
wait "$pid_b" || status_b=$?; pid_b=
[ "$status_a" -eq 0 ] && [ "$status_b" -eq 0 ] || { echo "Visual stack failed (A=$status_a B=$status_b); see $evidence_dir" >&2; exit 1; }
export_visual_artifacts compose_a "$run_a" "$evidence_dir/artifacts/$run_a"
export_visual_artifacts compose_b "$run_b" "$evidence_dir/artifacts/$run_b"
artifacts_a=$(cd "$evidence_dir" && find "artifacts/$run_a" -type f | sort)
artifacts_b=$(cd "$evidence_dir" && find "artifacts/$run_b" -type f | sort)
for project in "$project_a" "$project_b"; do
  for service in relay authority web visual-browser-a visual-browser-b; do
    [ -n "$(service_id "$project" "$service")" ] || { echo "Missing $project service=$service" >&2; exit 1; }
  done
done
containers_a=$(containers "$project_a"); containers_b=$(containers "$project_b")
networks_a=$(networks "$project_a"); networks_b=$(networks "$project_b")
volumes_a=$(volumes "$project_a"); volumes_b=$(volumes "$project_b")
published_ports_a=$(published_ports "$project_a"); published_ports_b=$(published_ports "$project_b")
assert_disjoint "$containers_a" "$containers_b"; assert_disjoint "$networks_a" "$networks_b"
assert_disjoint "$volumes_a" "$volumes_b"; assert_disjoint "$published_ports_a" "$published_ports_b"
if printf '%s\n%s\n' "$published_ports_a" "$published_ports_b" | grep -v '^127\.0\.0\.1:'; then exit 1; fi
containers_b_before=$containers_b; networks_b_before=$networks_b; volumes_b_before=$volumes_b
compose_a down --volumes --remove-orphans >/dev/null
[ -z "$(docker ps -aq --filter "label=com.docker.compose.project=$project_a")" ]
[ -z "$(networks "$project_a")" ]; [ -z "$(volumes "$project_a")" ]
[ "$containers_b_before" = "$(containers "$project_b")" ]; [ "$networks_b_before" = "$(networks "$project_b")" ]; [ "$volumes_b_before" = "$(volumes "$project_b")" ]
compose_b exec -T web wget -qO- http://web:5173/healthz >/dev/null
compose_b exec -T visual-browser-a node containers/visual-display-check.mjs >/dev/null
compose_b exec -T visual-browser-b node containers/visual-display-check.mjs >/dev/null
stack_b_display_after_a_removal=passed
cat >"$evidence_dir/manifest.json" <<EOF_JSON
{
  "schemaVersion": 1,
  "result": "passed",
  "command": "sh container ${run_a%-a} two-stack-isolation",
  "sourceSha": "$head_a",
  "projects": ["$project_a", "$project_b"],
  "worktrees": [{"path":"$worktree_a","runId":"$run_a"},{"path":"$worktree_b","runId":"$run_b"}],
  "containersA": $(json_array "$containers_a"),
  "containersB": $(json_array "$containers_b"),
  "networksA": $(json_array "$networks_a"),
  "networksB": $(json_array "$networks_b"),
  "volumesA": $(json_array "$volumes_a"),
  "volumesB": $(json_array "$volumes_b"),
  "publishedPortsA": $(json_array "$published_ports_a"),
  "publishedPortsB": $(json_array "$published_ports_b"),
  "browserProfiles": ["${project_a}_visual-profile-a","${project_a}_visual-profile-b","${project_b}_visual-profile-a","${project_b}_visual-profile-b"],
  "artifactLogs": ["visual-a.log", "visual-b.log"],
  "artifactsA": $(json_array "$artifacts_a"),
  "artifactsB": $(json_array "$artifacts_b"),
  "stackARemovedWithVolumes": true,
  "stackBResourceIdsPreserved": true,
  "stackBDisplayAfterARemoval": "$stack_b_display_after_a_removal"
}
EOF_JSON
echo "Two-stack isolation passed: $evidence_dir/manifest.json"
