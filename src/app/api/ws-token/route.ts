import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  let response = NextResponse.next({ request: req });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
          response = NextResponse.next({ request: req });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("brand, tier, daily_practice_limit_mins")
    .eq("id", user.id)
    .single();

  const wsAuthToken = {
    sub: user.id,
    brand: profile?.brand || "flowen",
    tier: profile?.tier || "standard",
    exp: Math.floor(Date.now() / 1000) + 60 * 30,
  };

  const jsonString = JSON.stringify(wsAuthToken);
  const tokenBytes = new TextEncoder().encode(jsonString);
  let binary = "";
  for (let i = 0; i < tokenBytes.length; i++) {
    binary += String.fromCharCode(tokenBytes[i]);
  }
  const tokenBase64 = btoa(binary);

  return NextResponse.json({
    token: tokenBase64,
    gateway_url: process.env.INFERENCE_GATEWAY_WS_URL || "wss://edge-inference.flowen.app/v1/stream",
    profile,
  });
}
