#!/bin/bash
set -e

echo "=== 1. Initializing package.json ==="
cat << 'PKG' > package.json
{
  "name": "flowen-platform",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "15.2.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "stripe": "^17.5.0",
    "nodemailer": "^6.9.16"
  },
  "devDependencies": {
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "@types/nodemailer": "^6.4.17",
    "postcss": "^8",
    "tailwindcss": "^4.0.0",
    "typescript": "^5"
  }
}
PKG

echo "=== 2. Installing Dependencies ==="
npm install

echo "=== 3. Running Next.js Build Verification ==="
npm run build

echo "=== 4. Triggering Vercel Production Deployment ==="
vercel --prod

echo "=== DEPLOYMENT COMPLETE SUCCESSFULLY ==="
