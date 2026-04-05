#!/bin/bash
# Wrapper script to ensure devDependencies are available during build
# even when NODE_ENV=production
set -e

echo "=== Build wrapper: installing devDependencies explicitly ==="
npm install --include=dev --ignore-scripts

echo "=== Running build ==="
npm run build
