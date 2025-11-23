import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

try {
  // Basic validation to catch common misconfigurations early
  const url = new URL(String(supabaseUrl));
  if (!/^https:/i.test(url.protocol)) {
    throw new Error('Invalid Supabase URL: must start with https://');
  }
  if (String(supabaseAnonKey).length < 20) {
    throw new Error('Invalid Supabase anon key: value is too short');
  }
} catch (e) {
  throw e instanceof Error ? e : new Error('Invalid Supabase configuration');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
  },
});
