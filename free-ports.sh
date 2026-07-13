#!/usr/bin/env bash
# Free the given TCP ports by killing whatever is listening on them.
# Usage: bash free-ports.sh 3001 5173
for port in "$@"; do
  pids=$(lsof -ti tcp:"$port" 2>/dev/null)
  if [ -n "$pids" ]; then
    echo "$pids" | xargs kill -9 2>/dev/null
    echo "freed port $port"
  fi
done
