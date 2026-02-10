#!/usr/bin/env bash
set -euo pipefail

repo_root=$(git rev-parse --show-toplevel)
assets_dir="$repo_root/docs/assets"

mkdir -p "$assets_dir"

touch "$repo_root/docs/.nojekyll"

sources=(
  "$repo_root/ontology/vcf-rdfizer-vocabulary.ttl"
  "$repo_root/shacl/vcf-rdfizer-vocabulary.shacl.ttl"
  "$repo_root/examples/example-headers.ttl"
  "$repo_root/examples/example-minimal-record.ttl"
)

for src in "${sources[@]}"; do
  if [[ ! -f "$src" ]]; then
    echo "Missing source file: $src" >&2
    exit 1
  fi
  cp -f "$src" "$assets_dir/$(basename "$src")"
done
