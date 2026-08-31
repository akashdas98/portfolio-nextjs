import { createClient } from "@supabase/supabase-js";

import { supabasePublishableKey, supabaseUrl } from "./config";

const RETRYABLE_STATUS_CODES = new Set([502, 503, 504, 522, 523, 524]);
const PUBLIC_REQUEST_TIMEOUT_MS = 4_000;

async function fetchWithTransientRetry(input: RequestInfo | URL, init?: RequestInit) {
  const attempts = 2;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const timeoutSignal = AbortSignal.timeout(PUBLIC_REQUEST_TIMEOUT_MS);
    const signal = init?.signal
      ? AbortSignal.any([init.signal, timeoutSignal])
      : timeoutSignal;

    try {
      const response = await fetch(input, { ...init, signal });
      if (!RETRYABLE_STATUS_CODES.has(response.status) || attempt === attempts - 1) {
        return response;
      }
    } catch (error) {
      if (attempt === attempts - 1 || init?.signal?.aborted) throw error;
    }

    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  throw new Error("The public data request did not complete.");
}

export function createSupabasePublicClient() {
  if (!supabaseUrl || !supabasePublishableKey) return null;

  return createClient(supabaseUrl, supabasePublishableKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
    global: {
      fetch: fetchWithTransientRetry,
    },
  });
}
