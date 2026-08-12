import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);
const SECURE_STORE_CHUNK_SIZE = 1500;
const SECURE_STORE_CHUNK_PREFIX = 'chunked:';

if (!hasSupabaseConfig) {
  console.error(
    'Missing Supabase environment variables. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY before building the app.'
  );
}

async function readSecureValue(key: string) {
  const value = await SecureStore.getItemAsync(key);
  if (value === null) return null;
  if (!value.startsWith(SECURE_STORE_CHUNK_PREFIX)) return value;

  const chunkCount = Number(value.slice(SECURE_STORE_CHUNK_PREFIX.length));
  if (!Number.isInteger(chunkCount) || chunkCount < 1) return null;

  const chunks = await Promise.all(
    Array.from({ length: chunkCount }, (_, index) => SecureStore.getItemAsync(getChunkKey(key, index)))
  );

  if (chunks.some((chunk) => chunk === null)) return null;
  return chunks.join('');
}

async function writeSecureValue(key: string, value: string) {
  await clearSecureValue(key);

  if (value.length <= SECURE_STORE_CHUNK_SIZE) {
    await SecureStore.setItemAsync(key, value);
    return;
  }

  const chunks = value.match(new RegExp(`.{1,${SECURE_STORE_CHUNK_SIZE}}`, 'g')) ?? [];
  await Promise.all(chunks.map((chunk, index) => SecureStore.setItemAsync(getChunkKey(key, index), chunk)));
  await SecureStore.setItemAsync(key, `${SECURE_STORE_CHUNK_PREFIX}${chunks.length}`);
}

async function clearSecureValue(key: string) {
  const existingValue = await SecureStore.getItemAsync(key).catch(() => null);
  if (existingValue?.startsWith(SECURE_STORE_CHUNK_PREFIX)) {
    const chunkCount = Number(existingValue.slice(SECURE_STORE_CHUNK_PREFIX.length));
    if (Number.isInteger(chunkCount) && chunkCount > 0) {
      await Promise.all(
        Array.from({ length: chunkCount }, (_, index) =>
          Promise.all([
            SecureStore.deleteItemAsync(getChunkKey(key, index)).catch(() => undefined),
            SecureStore.deleteItemAsync(getLegacyChunkKey(key, index)).catch(() => undefined)
          ])
        )
      );
    }
  }

  await SecureStore.deleteItemAsync(key);
}

function getChunkKey(key: string, index: number) {
  return `${key}.chunk.${index}`;
}

function getLegacyChunkKey(key: string, index: number) {
  return `${key}:chunk:${index}`;
}

const secureSessionStorage = {
  async getItem(key: string) {
    try {
      const value = await readSecureValue(key);
      if (value !== null) return value;

      const legacyValue = await AsyncStorage.getItem(key);
      if (legacyValue !== null) {
        await writeSecureValue(key, legacyValue).catch(() => undefined);
        await AsyncStorage.removeItem(key);
      }

      return legacyValue;
    } catch (error) {
      console.warn('Unable to restore secure auth session.', error);
      return null;
    }
  },
  async setItem(key: string, value: string) {
    try {
      await writeSecureValue(key, value);
      await AsyncStorage.removeItem(key).catch(() => undefined);
    } catch (error) {
      console.warn('Unable to persist secure auth session.', error);
      if (__DEV__) {
        await AsyncStorage.setItem(key, value).catch(() => undefined);
      }
    }
  },
  async removeItem(key: string) {
    try {
      await clearSecureValue(key);
    } catch (error) {
      console.warn('Unable to clear secure auth session.', error);
    }

    await AsyncStorage.removeItem(key).catch(() => undefined);
  }
};

export const supabase = createClient(
  supabaseUrl ?? 'https://missing-supabase-url.supabase.co',
  supabaseAnonKey ?? 'missing-supabase-anon-key',
  {
    auth: {
      storage: secureSessionStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false
    }
  }
);
