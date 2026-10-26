import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { publicSupabaseEnv, readSupabaseConfig } from "@/lib/supabase-config";

export type SignInProvider = "google" | "azure";

let client: SupabaseClient | null | undefined;

// One browser client per page; null when the project is not configured.
export function browserSupabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  const config = readSupabaseConfig(publicSupabaseEnv());
  client = config
    ? createClient(config.url, config.anonKey, {
        auth: { flowType: "pkce", persistSession: true, detectSessionInUrl: true },
      })
    : null;
  return client;
}

// Which external providers the project has switched on, so no button leads to a "provider is not enabled" error.
export async function enabledProviders(): Promise<SignInProvider[]> {
  const config = readSupabaseConfig(publicSupabaseEnv());
  if (!config) return [];
  try {
    const res = await fetch(`${config.url}/auth/v1/settings`, { headers: { apikey: config.anonKey } });
    if (!res.ok) return [];
    const settings = (await res.json()) as { external?: Record<string, boolean> };
    return (["google", "azure"] as const).filter((p) => settings.external?.[p] === true);
  } catch {
    return [];
  }
}

export function callbackUrl(): string {
  return `${window.location.origin}/auth/callback`;
}
