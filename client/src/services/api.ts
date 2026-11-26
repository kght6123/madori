import { ApiSession, NotificationEntry } from '../types';

async function request<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  if (res.status === 204) return undefined as unknown as T;
  return res.json() as Promise<T>;
}

export const api = {
  async getSessions(): Promise<ApiSession[]> {
    const data = await request<{ sessions: ApiSession[] }>('/api/sessions');
    return data.sessions;
  },

  async createSession(params: { name?: string; cwd?: string } = {}): Promise<ApiSession> {
    const data = await request<{ session: ApiSession }>('/api/sessions', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    return data.session;
  },

  async deleteSession(id: string): Promise<void> {
    await request<void>(`/api/sessions/${id}`, { method: 'DELETE' });
  },

  async patchSession(
    id: string,
    updates: { name?: string; memo?: string }
  ): Promise<ApiSession> {
    const data = await request<{ session: ApiSession }>(`/api/sessions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
    return data.session;
  },

  async getNotifications(): Promise<NotificationEntry[]> {
    const data = await request<{ notifications: NotificationEntry[] }>('/api/notifications');
    return data.notifications;
  },
};
