import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config.js';
import { createLogger } from '../logger.js';

const log = createLogger('db:client');

let supabase: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (supabase) return supabase;

  if (!config.SUPABASE_URL || !config.SUPABASE_ANON_KEY) {
    log.error('Supabase credentials not configured');
    throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY must be set');
  }

  supabase = createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);
  log.info('Supabase client initialised');
  return supabase;
}
