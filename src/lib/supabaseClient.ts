import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("As variáveis VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY não foram encontradas no .env");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);