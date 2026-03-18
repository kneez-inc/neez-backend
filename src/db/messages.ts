import { getSupabaseClient } from './client.js';
import { createLogger } from '../logger.js';
import {
  AppError,
  NeezChatMessage,
  CreateNeezChatMessage,
  UpdateNeezChatMessage,
  ConversationMessage,
} from '../types/database.js';

const log = createLogger('db:messages');
const TABLE = 'neez_chat_messages';

export async function createMessage(
  data: CreateNeezChatMessage,
): Promise<NeezChatMessage> {
  log.info('Creating message record', { session_id: data.session_id });
  const { data: row, error } = await getSupabaseClient()
    .from(TABLE)
    .insert(data)
    .select()
    .single();

  if (error) {
    log.error('Failed to create message', { error: error.message });
    throw new AppError('MESSAGE_CREATE_FAILED', error.message);
  }
  log.info('Message record created', { session_id: row.session_id });
  return row as NeezChatMessage;
}

export async function getMessageBySessionId(
  sessionId: string,
): Promise<NeezChatMessage | null> {
  log.debug('Fetching messages for session', { session_id: sessionId });
  const { data: row, error } = await getSupabaseClient()
    .from(TABLE)
    .select('*')
    .eq('session_id', sessionId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    log.error('Failed to fetch message', { error: error.message });
    throw new AppError('MESSAGE_FETCH_FAILED', error.message);
  }
  return row as NeezChatMessage;
}

export async function appendMessage(
  sessionId: string,
  message: ConversationMessage,
): Promise<NeezChatMessage> {
  log.info('Appending message to conversation', {
    session_id: sessionId,
    role: message.role,
  });

  // Fetch current conversation, append, then update
  const existing = await getMessageBySessionId(sessionId);
  if (!existing) {
    log.error('Message record not found for append', { session_id: sessionId });
    throw new AppError('MESSAGE_NOT_FOUND', `No message record for session ${sessionId}`, 404);
  }

  const updated = [...existing.conversation_content, message];
  return updateMessage(sessionId, {
    conversation_content: updated,
  });
}

export async function updateMessage(
  sessionId: string,
  data: UpdateNeezChatMessage,
): Promise<NeezChatMessage> {
  log.info('Updating message record', {
    session_id: sessionId,
    fields: Object.keys(data),
  });

  const payload: Record<string, unknown> = { ...data, updated_at: new Date().toISOString() };

  const { data: row, error } = await getSupabaseClient()
    .from(TABLE)
    .update(payload)
    .eq('session_id', sessionId)
    .select()
    .single();

  if (error) {
    log.error('Failed to update message', { error: error.message });
    throw new AppError('MESSAGE_UPDATE_FAILED', error.message);
  }
  log.info('Message record updated', { session_id: sessionId });
  return row as NeezChatMessage;
}

export async function deleteMessage(sessionId: string): Promise<void> {
  log.info('Deleting message record', { session_id: sessionId });
  const { error } = await getSupabaseClient()
    .from(TABLE)
    .delete()
    .eq('session_id', sessionId);

  if (error) {
    log.error('Failed to delete message', { error: error.message });
    throw new AppError('MESSAGE_DELETE_FAILED', error.message);
  }
  log.info('Message record deleted', { session_id: sessionId });
}
