#!/bin/bash
# Publish glider-scout to github.com/Dinerbone3912/glider-scout (creates repo if missing).
set -e
cd "$(dirname "$0")"
REPO=glider-scout
if ! git remote get-url origin >/dev/null 2>&1; then
  gh repo create "Dinerbone3912/$REPO" --public --source=. --remote=origin --push 2>/dev/null \
    || git remote add origin "https://github.com/Dinerbone3912/$REPO.git"
fi
git add -A
git -c user.email=glider@local -c user.name=Glider commit -m "publish: $(date -u +%Y-%m-%dT%H:%MZ)" || echo "(nothing to commit)"
git push -u origin HEAD 2>&1 | tail -3
echo "Pushed -> https://github.com/Dinerbone3912/$REPO"
