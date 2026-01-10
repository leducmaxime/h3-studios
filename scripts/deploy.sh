#!/bin/bash
set -e

echo "Building..."
pnpm build

echo "Deploying to Cloudflare..."
npx wrangler deploy

echo "Purging Cloudflare cache..."
npx wrangler cache purge --zone h3-studios.amis-harmonie-sucy.workers.dev --all 2>/dev/null || echo "Cache purge skipped (zone not configured or no custom domain)"

echo "Deploy complete!"
