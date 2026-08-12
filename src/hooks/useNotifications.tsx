import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import { configureAndroidNotificationChannel, subscribeToPushNotificationReceived } from '@/lib/notifications';
import { supabase } from '@/lib/supabase';
import {
  getUnreadNotificationCount,
  getUserNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  subscribeToNotifications
} from '@/services/notificationService';
import { useAuth } from '@/store/AuthContext';
import { AppNotification } from '@/types/notification';

type NotificationsContextValue = {
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  refreshing: boolean;
  updating: boolean;
  error: string;
  fetchNotifications: (options?: { forceRefresh?: boolean }) => Promise<void>;
  fetchUnreadCount: (options?: { forceRefresh?: boolean }) => Promise<void>;
  refresh: () => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
};

const NotificationsContext = createContext<NotificationsContextValue | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { profile, user } = useAuth();
  const userId = profile?.id ?? user?.id ?? null;
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState('');

  const fetchNotifications = useCallback(async (options?: { forceRefresh?: boolean }) => {
    if (!userId) {
      setNotifications([]);
      return;
    }

    setError('');
    setNotifications(await getUserNotifications(userId, options));
  }, [userId]);

  const fetchUnreadCount = useCallback(async (options?: { forceRefresh?: boolean }) => {
    if (!userId) {
      setUnreadCount(0);
      return;
    }

    setUnreadCount(await getUnreadNotificationCount(userId, options));
  }, [userId]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([fetchNotifications({ forceRefresh: true }), fetchUnreadCount({ forceRefresh: true })]);
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : 'Unable to refresh notifications.');
      throw refreshError;
    } finally {
      setRefreshing(false);
    }
  }, [fetchNotifications, fetchUnreadCount]);

  const markAsRead = useCallback(
    async (notificationId: string) => {
      try {
        setUpdating(true);
        await markNotificationRead(notificationId);
        setNotifications((current) => current.map((item) => item.id === notificationId ? { ...item, isRead: true } : item));
        setUnreadCount((current) => Math.max(0, current - 1));
      } catch (markError) {
        setError(markError instanceof Error ? markError.message : 'Unable to mark notification as read.');
        throw markError;
      } finally {
        setUpdating(false);
      }
    },
    [fetchNotifications, fetchUnreadCount]
  );

  const markAllAsRead = useCallback(async () => {
    if (!userId) return;

    try {
      setUpdating(true);
      await markAllNotificationsRead(userId);
      setNotifications((current) => current.map((item) => ({ ...item, isRead: true })));
      setUnreadCount(0);
    } catch (markError) {
      setError(markError instanceof Error ? markError.message : 'Unable to mark all notifications as read.');
      throw markError;
    } finally {
      setUpdating(false);
    }
  }, [fetchNotifications, fetchUnreadCount, userId]);

  useEffect(() => {
    let active = true;

    configureAndroidNotificationChannel().catch((channelError) => {
      if (__DEV__) console.log('[notifications] startup channel setup failed', channelError);
    });

    setLoading(true);
    Promise.all([fetchNotifications(), fetchUnreadCount()])
      .catch((loadError) => {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load notifications.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [fetchNotifications, fetchUnreadCount]);

  useEffect(() => {
    if (!userId) return;

    const channel = subscribeToNotifications(userId, {
      onInsert: (notification) => {
        if (__DEV__) console.log('[realtime] notification insert received', notification.id);
        setNotifications((current) => {
          if (current.some((item) => item.id === notification.id)) return current;
          return [notification, ...current];
        });
        if (!notification.isRead) {
          setUnreadCount((current) => current + 1);
        }
      },
      onUpdate: (notification) => {
        setNotifications((current) => {
          const nextNotifications = current.map((item) => (item.id === notification.id ? notification : item));
          setUnreadCount(nextNotifications.filter((item) => !item.isRead).length);
          return nextNotifications;
        });
      },
      onStatus: (status) => {
        if (__DEV__) console.log('[realtime] notifications status', status);
      }
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    const receivedSubscription = subscribeToPushNotificationReceived(() => {
      void refresh().catch(() => undefined);
    });

    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      if (__DEV__) console.log('[app-state] active refresh');
      void refresh().catch(() => undefined);
    });

    return () => {
      receivedSubscription.remove();
      appStateSubscription.remove();
    };
  }, [refresh, userId]);

  const value = useMemo(
    () => ({
      notifications,
      unreadCount,
      loading,
      refreshing,
      updating,
      error,
      fetchNotifications,
      fetchUnreadCount,
      refresh,
      markAsRead,
      markAllAsRead
    }),
    [
      error,
      fetchNotifications,
      fetchUnreadCount,
      loading,
      markAllAsRead,
      markAsRead,
      notifications,
      refresh,
      refreshing,
      unreadCount,
      updating
    ]
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications() {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
}
