import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Calendar, DateData } from 'react-native-calendars';
import { MarkedDates } from 'react-native-calendars/src/types';
import { EmptyState } from '@/components/EmptyState';
import { StatusBadge } from '@/components/StatusBadge';
import { colors, fontSizes, radius, shadows, spacing } from '@/constants/theme';
import { AppStackParamList } from '@/navigation/types';
import { getBookedHallsForDate } from '@/services/bookingService';
import { BookedHallForDate, TodayBookedHall } from '@/types/venue';
import { normalizeVenueType } from '@/constants/venueTypes';

type Props = NativeStackScreenProps<AppStackParamList, 'VenueSchedule'>;

export function VenueScheduleScreen(_props: Props) {
  const [selectedDate, setSelectedDate] = useState(() => getTomorrowDateKey());
  const [bookings, setBookings] = useState<BookedHallForDate[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const requestRef = useRef(0);

  const loadBookedVenues = useCallback(async (dateKey: string, forceRefresh = false) => {
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    setError('');
    setLoading(true);

    try {
      const nextBookings = await getBookedHallsForDate(dateKey, { forceRefresh });
      if (requestRef.current !== requestId) return;
      setBookings(nextBookings);
    } catch (loadError) {
      if (requestRef.current !== requestId) return;
      setError(loadError instanceof Error ? loadError.message : 'Couldn\'t load booked venues for this date.');
      setBookings([]);
    } finally {
      if (requestRef.current === requestId) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBookedVenues(selectedDate);
  }, [loadBookedVenues, selectedDate]);

  const handleDateSelect = useCallback((day: DateData) => {
    const nextDate = day.dateString;
    setSelectedDate(nextDate);
    setBookings([]);
    setError('');
    setLoading(true);
  }, []);

  const markedDates = useMemo<MarkedDates>(() => ({
    [selectedDate]: {
      selected: true,
      selectedColor: colors.primary,
      selectedTextColor: colors.surface
    }
  }), [selectedDate]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadBookedVenues(selectedDate, true);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.headerCard}>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Venue Schedule</Text>
          <Text style={styles.subtitle}>Choose a date to view booked venues</Text>
        </View>
        <Ionicons name="calendar-number-outline" size={28} color={colors.primary} />
      </View>

      <View style={styles.card}>
        <Calendar
          current={selectedDate}
          markedDates={markedDates}
          onDayPress={handleDateSelect}
          theme={{
            backgroundColor: colors.surface,
            calendarBackground: colors.surface,
            selectedDayBackgroundColor: colors.primary,
            selectedDayTextColor: colors.surface,
            todayTextColor: colors.primary,
            arrowColor: colors.primary,
            monthTextColor: colors.text,
            textMonthFontWeight: '900',
            textDayFontWeight: '700',
            textDisabledColor: colors.placeholder
          }}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.selectedDate}>{formatSelectedDate(selectedDate)}</Text>
        <View style={styles.list}>
          {loading ? (
            <Text style={styles.infoText}>Loading booked venues for this date...</Text>
          ) : error ? (
            <View style={styles.errorCard}>
              <Text style={styles.errorText}>Couldn't load booked venues for this date.</Text>
              <Pressable accessibilityRole="button" onPress={() => void loadBookedVenues(selectedDate, true)} style={styles.retryButton}>
                <Text style={styles.retryButtonText}>Retry</Text>
              </Pressable>
            </View>
          ) : bookings.length === 0 ? (
            <EmptyState title="No booked venues for this date" message="No venue bookings were found for this date." />
          ) : (
            bookings.map((booking) => <BookedVenueCard key={booking.bookingId} booking={booking} />)
          )}
        </View>
      </View>
    </ScrollView>
  );
}

function BookedVenueCard({ booking }: { booking: BookedHallForDate }) {
  const displayName = getBookedHallDisplayName(booking);
  const venueType = normalizeVenueType(booking.venueType);
  const departmentLine = [booking.department, venueType].filter(Boolean).join(' • ') || 'Campus venue';

  return (
    <View style={styles.bookingCard}>
      <View style={styles.bookingHeader}>
        <Text style={styles.bookingTitle}>{displayName}</Text>
        <StatusBadge status={booking.status} />
      </View>
      <Text style={styles.bookingMeta}>{departmentLine}</Text>
      <Text style={styles.eventTitle}>{booking.eventTitle}</Text>
      <Text style={styles.timeText}>{formatTimeRange(booking.startTime, booking.endTime)}</Text>
    </View>
  );
}

function formatTimeRange(startTime: string, endTime: string) {
  return `${format(new Date(startTime), 'h:mm a')} - ${format(new Date(endTime), 'h:mm a')}`;
}

function formatSelectedDate(dateKey: string) {
  return format(parseLocalDateKey(dateKey), 'EEEE, d MMMM yyyy');
}

function getTomorrowDateKey() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return getLocalDateKey(tomorrow);
}

function getLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseLocalDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1, 0, 0, 0, 0);
}

function getBookedHallDisplayName(booking: TodayBookedHall) {
  const venueType = normalizeVenueType(booking.venueType);
  if (booking.department === 'Library') return 'Library Seminar Hall';
  if (booking.department === 'Others' && venueType === 'Auditorium') return 'Others Auditorium';
  if (booking.department && venueType) return `${booking.department} ${venueType}`;
  return booking.hallName;
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
  headerCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.lg,
    padding: spacing.md,
    ...shadows.card
  },
  headerCopy: {
    flex: 1,
    gap: spacing.xs
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
    lineHeight: 20
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.md,
    ...shadows.card
  },
  selectedDate: {
    color: colors.primary,
    fontSize: fontSizes.md,
    fontWeight: '900'
  },
  list: {
    gap: spacing.sm
  },
  infoText: {
    color: colors.textMuted,
    fontSize: fontSizes.sm,
    fontWeight: '700'
  },
  errorText: {
    color: colors.status.rejected,
    fontSize: fontSizes.sm,
    fontWeight: '800'
  },
  errorCard: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm
  },
  retryButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs
  },
  retryButtonText: {
    color: colors.primary,
    fontSize: fontSizes.sm,
    fontWeight: '900'
  },
  bookingCard: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs
  },
  bookingHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md
  },
  bookingTitle: {
    flex: 1,
    color: colors.text,
    fontSize: fontSizes.md,
    fontWeight: '900'
  },
  bookingMeta: {
    color: colors.textMuted,
    fontSize: fontSizes.sm,
    fontWeight: '600'
  },
  eventTitle: {
    color: colors.text,
    fontSize: fontSizes.sm,
    fontWeight: '800',
    lineHeight: 20
  },
  timeText: {
    color: colors.primary,
    fontSize: fontSizes.sm,
    fontWeight: '900'
  }
});
