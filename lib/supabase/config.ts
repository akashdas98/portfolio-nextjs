export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export const hasSupabaseConfig = Boolean(supabaseUrl && supabasePublishableKey);
export const hasSupabaseAdminConfig = Boolean(supabaseUrl && supabaseSecretKey);

export const missingSupabaseConfig = [
  ["NEXT_PUBLIC_SUPABASE_URL", supabaseUrl],
  ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", supabasePublishableKey],
].filter(([, value]) => !value).map(([key]) => key);

export const missingSupabaseAdminConfig = [
  ["NEXT_PUBLIC_SUPABASE_URL", supabaseUrl],
  ["SUPABASE_SECRET_KEY", supabaseSecretKey],
].filter(([, value]) => !value).map(([key]) => key);
