import { formatDistanceToNow } from 'date-fns';
import { Modal, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useState } from 'react';
import { AppButton } from '@/components/AppButton';
import { EmptyState } from '@/components/EmptyState';
import { ErrorView } from '@/components/ErrorView';
import { LoadingView } from '@/components/LoadingView';
import { colors, fontSizes, radius, shadows, spacing } from '@/constants/theme';
import { useNotifications } from '@/hooks/useNotifications';
import { getNotificationBookingDetails, NotificationBookingDetails } from '@/services/notificationService';
import { AppNotification } from '@/types/notification';

export function NotificationsScreen() {
  const {
    notifications,
    unreadCount,
    loading,
    refreshing,
    updating,
    error,
    refresh,
    markAsRead,
    markAllAsRead
  } = useNotifications();
  const [details, setDetails] = useState<NotificationBookingDetails | null>(null);
  const [detailsMessage, setDetailsMessage] = useState('');
  const [detailsVisible, setDetailsVisible] = useState(false);

  const onRefresh = async () => {
    await refresh().catch(() => undefined);
  };

  const onMarkRead = async (notification: AppNotification) => {
    await markAsRead(notification.id).catch(() => undefined);

    if (!notification.bookingId) {
      setDetails(null);
      setDetailsMessage('Booking details are unavailable for this notification.');
      setDetailsVisible(true);
      return;
    }

    try {
      const bookingDetails = await getNotificationBookingDetails(notification.bookingId);
      if (bookingDetails) {
        setDetails(bookingDetails);
        setDetailsMessage('');
      } else {
        setDetails(null);
        setDetailsMessage('Booking details are unavailable for this notification.');
      }
    } catch {
      setDetails(null);
      setDetailsMessage('Booking details are unavailable for this notification.');
    } finally {
      setDetailsVisible(true);
    }
  };

  const onMarkAllRead = async () => {
    await markAllAsRead().catch(() => undefined);
  };

  if (loading) return <LoadingView message="Loading notifications..." />;

  return (
    <>
      <FlatList
        style={styles.root}
        contentContainerStyle={styles.content}
        data={notifications}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={
          <View style={styles.header}>
            {error ? <ErrorView message={error} onRetry={() => void onRefresh()} /> : null}
            <View style={styles.summary}>
              <View>
                <Text style={styles.title}>Notifications</Text>
                <Text style={styles.subtitle}>{unreadCount} unread</Text>
              </View>
              <View style={styles.actionWrap}>
                <AppButton title="Mark All Read" variant="secondary" loading={updating} disabled={updating || unreadCount === 0} onPress={onMarkAllRead} />
              </View>
            </View>
          </View>
        }
        ListEmptyComponent={<EmptyState title="No notifications" message="Booking updates and announcements will appear here." />}
        renderItem={({ item }) => (
          <NotificationCard notification={item} disabled={updating} onMarkRead={() => onMarkRead(item)} />
        )}
      />
      <BookingDetailsModal
        visible={detailsVisible}
        details={details}
        message={detailsMessage}
        onClose={() => setDetailsVisible(false)}
      />
    </>
  );
}

function BookingDetailsModal({
  visible,
  details,
  message,
  onClose
}: {
  visible: boolean;
  details: NotificationBookingDetails | null;
  message: string;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Booking Details</Text>
          {details ? (
            <>
              <Detail label="Booked Hall" value={details.bookedHall} />
              <Detail label="Session Name" value={details.sessionName} />
            </>
          ) : (
            <Text style={styles.modalMessage}>{message}</Text>
          )}
          <AppButton title="Close" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detail}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function NotificationCard({
  notification,
  disabled,
  onMarkRead
}: {
  notification: AppNotification;
  disabled: boolean;
  onMarkRead: () => void;
}) {
  return (
    <View style={[styles.card, !notification.isRead && styles.unreadCard]}>
      <View style={styles.cardHeader}>
        <View style={styles.titleWrap}>
          {!notification.isRead ? <View style={styles.unreadDot} /> : null}
          <Text style={styles.cardTitle}>{notification.title}</Text>
        </View>
        <Text style={styles.time}>{formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}</Text>
      </View>
      <Text style={styles.message}>{notification.message}</Text>
      <Pressable disabled={disabled} onPress={onMarkRead} style={({ pressed }) => [styles.markButton, pressed && styles.pressed]}>
        <Text style={styles.markText}>READ</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background
  },
  content: {
    padding: spacing.md,
    gap: spacing.md
  },
  header: {
    gap: spacing.md
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadows.card
  },
  title: {
    color: colors.text,
    fontSize: fontSizes.xl,
    fontWeight: '900'
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: fontSizes.sm,
    fontWeight: '700',
    marginTop: spacing.xs
  },
  actionWrap: {
    minWidth: 148
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadows.card
  },
  unreadCard: {
    borderColor: colors.primary,
    backgroundColor: colors.unreadSurface
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md
  },
  titleWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.primary
  },
  cardTitle: {
    flex: 1,
    color: colors.text,
    fontSize: fontSizes.md,
    fontWeight: '900'
  },
  time: {
    color: colors.textMuted,
    fontSize: fontSizes.xs,
    fontWeight: '700'
  },
  message: {
    color: colors.text,
    fontSize: fontSizes.sm,
    lineHeight: 21
  },
  markButton: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.sm
  },
  pressed: {
    opacity: 0.65
  },
  markText: {
    color: colors.primary,
    fontSize: fontSizes.sm,
    fontWeight: '900'
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(7, 43, 76, 0.45)',
    padding: spacing.lg
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.card
  },
  modalTitle: {
    color: colors.text,
    fontSize: fontSizes.lg,
    fontWeight: '900'
  },
  modalMessage: {
    color: colors.textMuted,
    fontSize: fontSizes.sm,
    fontWeight: '700',
    lineHeight: 20
  },
  detail: {
    gap: spacing.xs
  },
  detailLabel: {
    color: colors.textMuted,
    fontSize: fontSizes.xs,
    fontWeight: '900',
    textTransform: 'uppercase'
  },
  detailValue: {
    color: colors.text,
    fontSize: fontSizes.md,
    fontWeight: '800',
    lineHeight: 22
  }
});
