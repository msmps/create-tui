#!/bin/bash
set -euo pipefail

for template_dir in packages/templates/*; do
    if [[ ! -f "$template_dir/package.json" ]]; then
        continue
    fi

    template_name=$(basename "$template_dir")
    echo "Checking $template_name template..."
    (
        cd "$template_dir"
        bun install --frozen-lockfile
        bun run typecheck
    )
done
