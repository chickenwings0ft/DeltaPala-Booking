import { createClient } from '@supabase/supabase-js';

// En producción, estas variables estarían en un .env
const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL || 'https://tu-proyecto.supabase.co';
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY || 'tu-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
