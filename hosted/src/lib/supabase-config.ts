export type Role = "owner" | "admin" | "member";

export type Organization = {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
};

export type Membership = {
  organization_id: string;
  user_id: string;
  role: Role;
  created_at: string;
};

export type Profile = {
  user_id: string;
  display_name: string | null;
  created_at: string;
};

export type SupabaseConfig = { url: string; anonKey: string };

// Next.js inlines NEXT_PUBLIC_ values into browser code only where each is named in full,
// so browser code passes this object instead of process.env.
export function publicSupabaseEnv(): Record<string, string | undefined> {
  return {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
}

// Returns null until the project is configured, so the hosted shell keeps working without credentials.
export function readSupabaseConfig(
  env: Record<string, string | undefined> = process.env,
): SupabaseConfig | null {
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return null;
  } catch {
    return null;
  }
  return { url, anonKey };
}
