#!/usr/bin/env bash
set -euo pipefail

api=stream-langgraph-api-1
postgres=stream-langgraph-postgres-1
redis=stream-langgraph-redis-1
network=stream_default

if ! docker container inspect "$api" "$postgres" "$redis" >/dev/null; then
  echo 'Create the Stream containers with the LangGraph setup command in README.md.' >&2
  exit 1
fi
docker network inspect "$network" >/dev/null

wait_healthy() {
  local container=$1 status deadline=$((SECONDS + 120))
  while (( SECONDS < deadline )); do
    status=$(docker inspect --format '{{.State.Status}}{{if .State.Health}}:{{.State.Health.Status}}{{end}}' "$container")
    case "$status" in
      running:healthy) return 0 ;;
      exited:*|exited|dead:*) break ;;
    esac
    sleep 1
  done
  echo "$container did not become healthy. Check docker logs $container." >&2
  return 1
}

docker start "$postgres" "$redis" >/dev/null
wait_healthy "$postgres"
wait_healthy "$redis"

# Repair a missing endpoint before the API tries to resolve Compose service names.
attached=$(docker inspect --format "{{if index .NetworkSettings.Networks \"$network\"}}yes{{end}}" "$api")
if [[ "$attached" != yes ]]; then
  echo "Reconnecting $api to $network."
  docker network connect --alias langgraph-api "$network" "$api"
fi

docker start "$api" >/dev/null
wait_healthy "$api"
curl --fail --silent --show-error --max-time 10 http://127.0.0.1:8123/ok
printf '\n'
