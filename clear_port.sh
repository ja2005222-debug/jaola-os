#!/bin/bash
PORT=4000
echo "Searching for active processes on port $PORT..."

PID=""

# 1. Try using lsof if available
if command -v lsof >/dev/null 2>&1; then
    PID=$(lsof -t -i:$PORT)
# 2. Try using fuser as a first fallback
elif command -v fuser >/dev/null 2>&1; then
    PID=$(fuser $PORT/tcp 2>/dev/null | awk '{print $1}')
# 3. Try using ss (default on most modern distros) as a second fallback
elif command -v ss >/dev/null 2>&1; then
    PID=$(ss -lptn "sport = :$PORT" 2>/dev/null | grep -o 'pid=[0-9]*' | cut -d= -f2 | head -n1)
fi

if [ -z "$PID" ]; then
    # If PID not found but port is active, attempt force kill with fuser
    if command -v fuser >/dev/null 2>&1; then
        echo "Port $PORT is active but PID not found. Attempting fuser force kill..."
        fuser -k $PORT/tcp >/dev/null 2>&1
        echo "Port $PORT cleared using fuser."
    else
        echo "Port $PORT is free and ready."
    fi
else
    echo "Found process $PID on port $PORT. Terminating..."
    kill -9 $PID
    echo "Port $PORT has been successfully cleared!"
fi
