import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TelemetryPayload {
  session_id: string;
  disfluency_type: "block" | "repetition" | "prolongation" | "easy_onset";
  confidence_score: number;
  audio_base64?: string;
  acoustic_embedding?: number[];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization Header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload: TelemetryPayload = await req.json();

    const { data: profile } = await supabase
      .from("profiles")
      .select("opt_in_telemetry")
      .eq("id", user.id)
      .single();

    if (!profile?.opt_in_telemetry) {
      return new Response(JSON.stringify({ status: "skipped", reason: "user_opted_out" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let audioR2Path: string | null = null;

    if (payload.audio_base64) {
      const binaryString = atob(payload.audio_base64);
      const clipBuffer = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        clipBuffer[i] = binaryString.charCodeAt(i);
      }
      const fileName = `diffs/${user.id}/${payload.session_id}_${Date.now()}.wav`;

      const { error: storageError } = await supabase.storage
        .from("disfluency-telemetry")
        .upload(fileName, clipBuffer, { contentType: "audio/wav" });

      if (!storageError) {
        audioR2Path = fileName;
      }
    }

    const { error: dbError } = await supabase.from("telemetry_logs").insert({
      session_id: payload.session_id,
      user_id: user.id,
      disfluency_type: payload.disfluency_type,
      confidence_score: payload.confidence_score,
      audio_clip_r2_path: audioR2Path,
      acoustic_embedding: payload.acoustic_embedding ?? null,
    });

    if (dbError) throw dbError;

    return new Response(JSON.stringify({ success: true, path: audioR2Path }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
