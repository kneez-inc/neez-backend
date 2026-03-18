import { getSupabaseClient } from './client.js';
import { createLogger } from '../logger.js';
import {
  AppError,
  NeezUser,
  CreateNeezUser,
  UpdateNeezUser,
} from '../types/database.js';

const log = createLogger('db:users');
const TABLE = 'neez_users';

export async function createUser(data: CreateNeezUser): Promise<NeezUser> {
  log.info('Creating user', { user_id: data.user_id, email: data.email });
  const { data: row, error } = await getSupabaseClient()
    .from(TABLE)
    .insert(data)
    .select()
    .single();

  if (error) {
    log.error('Failed to create user', { error: error.message });
    throw new AppError('USER_CREATE_FAILED', error.message);
  }
  log.info('User created', { user_id: row.user_id });
  return row as NeezUser;
}

export async function getUserById(userId: string): Promise<NeezUser | null> {
  log.debug('Fetching user by id', { user_id: userId });
  const { data: row, error } = await getSupabaseClient()
    .from(TABLE)
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // not found
    log.error('Failed to fetch user', { error: error.message });
    throw new AppError('USER_FETCH_FAILED', error.message);
  }
  return row as NeezUser;
}

export async function getUserByEmail(email: string): Promise<NeezUser | null> {
  log.debug('Fetching user by email', { email });
  const { data: row, error } = await getSupabaseClient()
    .from(TABLE)
    .select('*')
    .eq('email', email)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    log.error('Failed to fetch user by email', { error: error.message });
    throw new AppError('USER_FETCH_FAILED', error.message);
  }
  return row as NeezUser;
}

export async function updateUser(
  userId: string,
  data: UpdateNeezUser,
): Promise<NeezUser> {
  log.info('Updating user', { user_id: userId, fields: Object.keys(data) });
  const { data: row, error } = await getSupabaseClient()
    .from(TABLE)
    .update(data)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    log.error('Failed to update user', { error: error.message });
    throw new AppError('USER_UPDATE_FAILED', error.message);
  }
  log.info('User updated', { user_id: userId });
  return row as NeezUser;
}

export async function deleteUser(userId: string): Promise<void> {
  log.info('Deleting user', { user_id: userId });
  const { error } = await getSupabaseClient()
    .from(TABLE)
    .delete()
    .eq('user_id', userId);

  if (error) {
    log.error('Failed to delete user', { error: error.message });
    throw new AppError('USER_DELETE_FAILED', error.message);
  }
  log.info('User deleted', { user_id: userId });
}
