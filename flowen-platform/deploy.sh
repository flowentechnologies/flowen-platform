#!/bin/bash
echo "Starting Flowen deployment sequence..."
npx supabase db push
npm run build
vercel --prod
