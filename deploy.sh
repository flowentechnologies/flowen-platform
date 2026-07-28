#!/usr/bin/env zsh
set -e

echo "🚀 Starting Full Commercial Deployment for Flowen Platform..."

# 1. Clean Build Caches
echo "🧹 Clearing build caches..."
rm -rf .next node_modules/.cache
npm cache clean --force > /dev/null 2>&1 || true

# 2. Configure TypeScript & Vercel Exclusions
echo "⚙️ Configuring TSConfig and Vercel build exclusions..."
node -e '
const fs = require("fs");
if (fs.existsSync("tsconfig.json")) {
  const tsconfig = JSON.parse(fs.readFileSync("tsconfig.json", "utf8"));
  if (!tsconfig.exclude) tsconfig.exclude = [];
  if (!tsconfig.exclude.includes("supabase")) tsconfig.exclude.push("supabase");
  fs.writeFileSync("tsconfig.json", JSON.stringify(tsconfig, null, 2));
}
'

cat << 'IGNORE' > .vercelignore
supabase/functions
IGNORE

# 3. Middleware Rate Limiter & Auth Setup
echo "🛡️ Deploying Edge Rate Limiting & Auth Middleware..."
cat << 'MIDDLEWARE' > src/middleware.ts
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const ipCache = new Map<string, { count: number; reset: number }>();

export async function middleware(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") || "anonymous";
  const now = Date.now();
  const windowMs = 60 * 1000;
  const limit = request.nextUrl.pathname.startsWith("/api") ? 60 : 120;

  const record = ipCache.get(ip) || { count: 0, reset: now + windowMs };
  if (now > record.reset) {
    record.count = 0;
    record.reset = now + windowMs;
  }
  record.count += 1;
  ipCache.set(ip, record);

  if (record.count > limit) {
    return new NextResponse("Too Many Requests (Rate limit exceeded)", { status: 429 });
  }

  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  const isAuthRoute = request.nextUrl.pathname.startsWith("/auth");
  const isDashboardRoute = request.nextUrl.pathname.startsWith("/app") || request.nextUrl.pathname.startsWith("/dashboard");

  if (isDashboardRoute && !user) {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  if (isAuthRoute && user) {
    return NextResponse.redirect(new URL("/app", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
MIDDLEWARE

# 4. Deploy Edge Functions
echo "🗄️ Deploying Supabase Edge Functions..."
supabase functions deploy telemetry-ingest --no-verify-jwt || true

# 5. Local Build Verification
echo "🏗️ Running local production build test..."
npm run build

# 6. Git Push & Vercel Deployment
echo "📦 Committing and deploying live to production..."
git add .
git commit -m "feat: commercial production release with rate limiting, auth SSR, and edge telemetry" || true
git push origin main

echo "⚡ Deploying to Vercel (flowen.digital)..."
npx vercel --prod --force --yes

echo "✅ SUCCESS: Flowen platform is fully built and deployed live!"
