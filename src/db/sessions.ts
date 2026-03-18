import { getSupabaseClient } from './client.js';
import { createLogger } from '../logger.js';
import {
  AppError,
  NeezChatSession,
  CreateNeezChatSession,
  UpdateNeezChatSession,
} from '../types/database.js';

const log = createLogger('db:sessions');
const TABLE = 'neez_chat_sessions';

export async function createSession(
  data: CreateNeezChatSession,
): Promise<NeezChatSession> {
  log.info('Creating session', { user_id: data.user_id });
  const { data: row, error } = await getSupabaseClient()
    .from(TABLE)
    .insert(data)
    .select()
    .single();

  if (error) {
    log.error('Failed to create session', { error: error.message });
    throw new AppError('SESSION_CREATE_FAILED', error.message);
  }
  log.info('Session created', { session_id: row.session_id });
  return row as NeezChatSession;
}

export async function getSessionById(
  sessionId: string,
): Promise<NeezChatSession | null> {
  log.debug('Fetching session', { session_id: sessionId });
  const { data: row, error } = await getSupabaseClient()
    .from(TABLE)
    .select('*')
    .eq('session_id', sessionId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    log.error('Failed to fetch session', { error: error.message });
    throw new AppError('SESSION_FETCH_FAILED', error.message);
  }
  return row as NeezChatSession;
}

export async function getSessionsByUserId(
  userId: string,
): Promise<NeezChatSession[]> {
  log.debug('Fetching sessions for user', { user_id: userId });
  const { data: rows, error } = await getSupabaseClient()
    .from(TABLE)
    .select('*')
    .eq('user_id', userId)
    .order('session_created_at', { ascending: false });

  if (error) {
    log.error('Failed to fetch sessions', { error: error.message });
    throw new AppError('SESSION_FETCH_FAILED', error.message);
  }
  return rows as NeezChatSession[];
}

export async function updateSession(
  sessionId: string,
  data: UpdateNeezChatSession,
): Promise<NeezChatSession> {
  log.info('Updating session', { session_id: sessionId, fields: Object.keys(data) });
  const { data: row, error } = await getSupabaseClient()
    .from(TABLE)
    .update(data)
    .eq('session_id', sessionId)
    .select()
    .single();

  if (error) {
    log.error('Failed to update session', { error: error.message });
    throw new AppError('SESSION_UPDATE_FAILED', error.message);
  }
  log.info('Session updated', { session_id: sessionId });
  return row as NeezChatSession;
}

export async function deleteSession(sessionId: string): Promise<void> {
  log.info('Deleting session', { session_id: sessionId });
  const { error } = await getSupabaseClient()
    .from(TABLE)
    .delete()
    .eq('session_id', sessionId);

  if (error) {
    log.error('Failed to delete session', { error: error.message });
    throw new AppError('SESSION_DELETE_FAILED', error.message);
  }
  log.info('Session deleted', { session_id: sessionId });
}
