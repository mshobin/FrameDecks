#!/bin/bash
cd "$(dirname "$0")/../.."
if command -v python3 >/dev/null 2>&1; then
  python3 src/server.py
else
  echo "Python 3 was not found. Opening no-install mode (same browser only)."
  open "app/dashboard.html"
fi
