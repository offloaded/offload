import { createServiceSupabase } from "@/lib/supabase-server";

export async function logApiUsage(params: {
  user_id: string;
  service: string;
  model?: string;
  tokens_in?: number;
  tokens_out?: number;
  cost?: number;
  response_time_ms?: number;
}) {
  try {
    const supabase = createServiceSupabase();
    await supabase.from("api_usage").insert({
      user_id: params.user_id,
      service: params.service,
      model: params.model || null,
      tokens_in: params.tokens_in || 0,
      tokens_out: params.tokens_out || 0,
      cost: params.cost || 0,
      response_time_ms: params.response_time_ms || null,
    });
  } catch (err) {
    console.error("[api-usage] Failed to log:", err);
  }
}

/** Simple cost estimation based on model */
export function estimateCost(
  model: string,
  tokensIn: number,
  tokensOut: number
): number {
  const rates: Record<string, { input: number; output: number }> = {
    "claude-sonnet-4-5-20250929": {
      input: 3 / 1_000_000,
      output: 15 / 1_000_000,
    },
    "claude-haiku-4-5-20251001": {
      input: 0.8 / 1_000_000,
      output: 4 / 1_000_000,
    },
    "text-embedding-3-small": { input: 0.02 / 1_000_000, output: 0 },
  };
  const rate = rates[model] || { input: 3 / 1_000_000, output: 15 / 1_000_000 };
  return tokensIn * rate.input + tokensOut * rate.output;
}
