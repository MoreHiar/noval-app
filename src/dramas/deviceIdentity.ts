import * as SecureStore from 'expo-secure-store';

const KEY = 'noval.drama.identity.v1';

export type DramaIdentity = { deviceId: string; userId: string };

export async function readDramaIdentity(): Promise<DramaIdentity> {
  const raw = await SecureStore.getItemAsync(KEY);
  if (!raw) return { deviceId: '', userId: '' };
  try {
    const value: unknown = JSON.parse(raw);
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const fields = value as Record<string, unknown>;
      return {
        deviceId: typeof fields.deviceId === 'string' ? fields.deviceId : '',
        userId: typeof fields.userId === 'string' ? fields.userId : '',
      };
    }
  } catch { /* Treat an unreadable local record as empty. */ }
  return { deviceId: '', userId: '' };
}

export async function saveDramaIdentity(identity: DramaIdentity): Promise<DramaIdentity> {
  const deviceId = identity.deviceId.trim();
  const userId = identity.userId.trim();
  if (deviceId && !/^\d{10,30}$/.test(deviceId)) throw new Error('deviceId 应为 10 至 30 位数字');
  if (userId && !/^\d{1,30}$/.test(userId)) throw new Error('userId 应为 1 至 30 位数字');
  if (!deviceId && !userId) await SecureStore.deleteItemAsync(KEY);
  else await SecureStore.setItemAsync(KEY, JSON.stringify({ deviceId, userId }));
  return { deviceId, userId };
}
