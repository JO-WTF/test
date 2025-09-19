#!/bin/bash

set -euo pipefail

npm install
npm run build

echo "Build complete. Output available in ./dist"
