import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { publicSupabaseEnv, readSupabaseConfig } from "@/lib/supabase-config";
import { deviceStorage } from "@/lib/trusted-device";

let client: SupabaseClient | null | undefined;

// One browser client per page; null when the project is not configured.
export function browserSupabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  const config = readSupabaseConfig(publicSupabaseEnv());
  client = config
    ? createClient(config.url, config.anonKey, {
        // 9.8 the session stays in this tab until the device is trusted (lib/trusted-device.ts)
        auth: { flowType: "pkce", persistSession: true, detectSessionInUrl: true, storage: deviceStorage() },
      })
    : null;
  return client;
}

export function callbackUrl(): string {
  return `${window.location.origin}/auth/callback`;
}
