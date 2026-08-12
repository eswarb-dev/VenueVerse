import { CompositeScreenProps } from '@react-navigation/native';
import { BottomTabScreenProps, useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { addMonths, format, isBefore, startOfMonth } from 'date-fns';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Image, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Calendar, DateData } from 'react-native-calendars';
import { MarkedDates } from 'react-native-calendars/src/types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppButton } from '@/components/AppButton';
import { EmptyState } from '@/components/EmptyState';
import { ErrorView } from '@/components/ErrorView';
import { formatVenueDescription } from '@/components/HallCard';
import { LoadingView } from '@/components/LoadingView';
import { DEPARTMENT_OPTIONS } from '@/constants/departments';
import { colors, fontSizes, radius, spacing } from '@/constants/theme';
import { EXTRA_TAB_PADDING, TOP_SAFE_AREA_PADDING } from '@/constants/layout';
import { TIME_SLOTS, TimeSlot } from '@/constants/timeSlots';
import { normalizeVenueType, VENUE_TYPES } from '@/constants/venueTypes';
import { AppStackParamList, UserTabParamList } from '@/navigation/types';
import { getBookingDateKeysForRange, getBookingsForDate } from '@/services/bookingService';
import { getActiveHallsByDepartment } from '@/services/hallService';
import { BookedSlotInfo, BookingAvailability, Hall } from '@/types/venue';

type Props = CompositeScreenProps<
  BottomTabScreenProps<UserTabParamList, 'Book'>,
  NativeStackScreenProps<AppStackParamList>
>;
type HallAvailability = {
  hallId: string;
  isAvailable: boolean;
  reason?: string;
};

const capacityOptions = ['Any', '50+', '100+', '200+'];
const departmentOptions = ['All', ...DEPARTMENT_OPTIONS];

type FilterKey = 'capacity' | 'department' | 'venueType';

const filterTitles: Record<FilterKey, string> = {
  capacity: 'Select Capacity',
  department: 'Select Department',
  venueType: 'Select Venue Type'
};

export function HallListScreen({ navigation }: Props) {
  const tabBarHeight = useBottomTabBarHeight();
  const insets = useSafeAreaInsets();
  const [halls, setHalls] = useState<Hall[]>([]);
  const [selectedCapacity, setSelectedCapacity] = useState('Any');
  const [selectedDepartment, setSelectedDepartment] = useState('All');
  const [selectedVenueType, setSelectedVenueType] = useState('All');
  const [selectedHallId, setSelectedHallId] = useState<string | null>(null);
  const [openFilter, setOpenFilter] = useState<FilterKey | null>(null);
  const [hallPickerVisible, setHallPickerVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => getLocalDateString());
  const [selectedSlotIds, setSelectedSlotIds] = useState<string[]>([]);
  const [draftSlotIds, setDraftSlotIds] = useState<string[]>([]);
  const [timeSlotPickerVisible, setTimeSlotPickerVisible] = useState(false);
  const [timeSlotPickerError, setTimeSlotPickerError] = useState('');
  const [selectedDateBookings, setSelectedDateBookings] = useState<BookingAvailability[]>([]);
  const [bookingDateKeys, setBookingDateKeys] = useState<string[]>([]);
  const [visibleMonth, setVisibleMonth] = useState(() => getLocalDateString(startOfMonth(new Date())));
  const [loading, setLoading] = useState(true);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [loadingCalendarMarks, setLoadingCalendarMarks] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [selectionError, setSelectionError] = useState('');
  const availabilityRequestRef = useRef(0);
  const calendarRequestRef = useRef(0);

  const loadHalls = useCallback(async (forceRefresh = false) => {
    setError('');
    if (selectedDepartment === 'All') {
      setHalls([]);
      return;
    }
    const nextHalls = await getActiveHallsByDepartment(selectedDepartment, { forceRefresh });
    setHalls(nextHalls);
  }, [selectedDepartment]);

  useEffect(() => {
    setLoading(true);
    loadHalls()
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Unable to load halls.'))
      .finally(() => setLoading(false));
  }, [loadHalls]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadHalls(true);
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : 'Unable to refresh halls.');
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!selectedDate || !selectedHallId) {
      setSelectedDateBookings([]);
      return;
    }

    const startOfDayIso = getDayStart(selectedDate).toISOString();
    const nextDayStartIso = getNextDayStart(selectedDate).toISOString();
    const requestId = availabilityRequestRef.current + 1;
    availabilityRequestRef.current = requestId;
    setLoadingAvailability(true);
    getBookingsForDate({ startOfDay: startOfDayIso, endOfDay: nextDayStartIso, hallId: selectedHallId })
      .then((bookings) => {
        if (availabilityRequestRef.current === requestId) setSelectedDateBookings(bookings);
      })
      .catch((availabilityError) => {
        if (availabilityRequestRef.current === requestId) setError(availabilityError instanceof Error ? availabilityError.message : 'Failed to load booking availability.');
      })
      .finally(() => {
        if (availabilityRequestRef.current === requestId) setLoadingAvailability(false);
      });
  }, [selectedDate, selectedHallId]);

  useEffect(() => {
    const monthStart = getDayStart(visibleMonth);
    const nextMonthStart = addMonths(monthStart, 1);
    const requestId = calendarRequestRef.current + 1;
    calendarRequestRef.current = requestId;
    setLoadingCalendarMarks(true);
    getBookingDateKeysForRange({
      startDate: monthStart.toISOString(),
      endDate: nextMonthStart.toISOString()
    })
      .then((dateKeys) => {
        if (calendarRequestRef.current === requestId) setBookingDateKeys(dateKeys);
      })
      .catch((calendarError) => {
        if (calendarRequestRef.current === requestId) setError(calendarError instanceof Error ? calendarError.message : 'Failed to load calendar markings.');
      })
      .finally(() => {
        if (calendarRequestRef.current === requestId) setLoadingCalendarMarks(false);
      });
  }, [visibleMonth]);

  useEffect(() => {
    setHalls([]);
    setSelectedVenueType('All');
    setSelectedHallId(null);
    setSelectedSlotIds([]);
    setDraftSlotIds([]);
  }, [selectedDepartment]);

  const selectableHalls = useMemo(() => {
    return getRelevantHallsForAvailability({
      halls,
      selectedCapacity,
      selectedDepartment,
      selectedVenueType,
      requireDepartment: true
    });
  }, [halls, selectedCapacity, selectedDepartment, selectedVenueType]);

  const selectedHall = useMemo(
    () => selectableHalls.find((hall) => hall.id === selectedHallId) ?? null,
    [selectableHalls, selectedHallId]
  );

  useEffect(() => {
    if (!selectedHallId) return;
    if (selectableHalls.some((hall) => hall.id === selectedHallId)) return;
    setSelectedHallId(null);
    setSelectedSlotIds([]);
    setDraftSlotIds([]);
  }, [selectableHalls, selectedHallId]);

  const baseFilteredHalls = useMemo(() => {
    return selectedHall ? [selectedHall] : [];
  }, [selectedHall]);

  const relevantHallsForSlots = useMemo(() => (selectedHall ? [selectedHall] : []), [selectedHall]);

  const selectedSlots = useMemo(() => getSelectedSlots(selectedSlotIds), [selectedSlotIds]);
  const selectedSlotsAreContinuous = useMemo(() => areSlotsContinuous(selectedSlots), [selectedSlots]);
  const selectedTimeRange = useMemo(() => {
    if (!selectedDate || selectedSlots.length === 0 || !selectedSlotsAreContinuous) return null;
    return getCombinedTimeRange(selectedSlots, selectedDate);
  }, [selectedDate, selectedSlots, selectedSlotsAreContinuous]);

  const hallAvailability = useMemo(() => {
    const result = new Map<string, HallAvailability>();
    baseFilteredHalls.forEach((hall) => {
      const isAvailable = Boolean(
        selectedTimeRange && isHallAvailableForRange(hall, selectedDateBookings, selectedTimeRange.startTime, selectedTimeRange.endTime)
      );
      result.set(hall.id, {
        hallId: hall.id,
        isAvailable,
        reason: isAvailable ? undefined : 'Booked / Pending Approval'
      });
    });
    return result;
  }, [baseFilteredHalls, selectedDateBookings, selectedTimeRange]);

  const filteredHalls = useMemo(() => {
    if (!selectedDate || selectedSlots.length === 0 || !selectedSlotsAreContinuous || !selectedTimeRange) return [];
    return [...baseFilteredHalls].sort((first, second) => {
      const firstAvailable = hallAvailability.get(first.id)?.isAvailable ? 1 : 0;
      const secondAvailable = hallAvailability.get(second.id)?.isAvailable ? 1 : 0;
      return secondAvailable - firstAvailable;
    });
  }, [baseFilteredHalls, hallAvailability, selectedDate, selectedSlots.length, selectedSlotsAreContinuous, selectedTimeRange]);

  const slotAvailability = useMemo(() => {
    const result = new Map<string, boolean>();
    TIME_SLOTS.forEach((slot) => {
      if (!selectedDate || isSlotPassed(selectedDate, slot)) {
        result.set(slot.id, false);
        return;
      }

      if (relevantHallsForSlots.length === 0) {
        result.set(slot.id, false);
        return;
      }

      const { startTime, endTime } = buildSlotDateTimes(selectedDate, slot);
      const isSlotFullyBooked = relevantHallsForSlots.every((hall) => (
        isHallBookedForRange(hall.id, startTime, endTime, selectedDateBookings)
      ));
      result.set(slot.id, !isSlotFullyBooked);
    });
    return result;
  }, [relevantHallsForSlots, selectedDate, selectedDateBookings]);

  const bookedSlotInfo = useMemo(() => {
    const result = new Map<string, BookedSlotInfo>();
    if (!selectedDate || !selectedHallId) return result;

    TIME_SLOTS.forEach((slot) => {
      const { startTime, endTime } = buildSlotDateTimes(selectedDate, slot);
      const booking = findBookedSlotInfo(selectedHallId, startTime, endTime, selectedDateBookings);
      if (!booking) return;

      result.set(slot.id, {
        bookingId: booking.id,
        eventTitle: booking.eventTitle ?? 'Venue booking',
        requesterName: booking.requesterName ?? null,
        requesterDepartment: booking.requesterDepartment ?? null,
        status: booking.status
      });
    });

    return result;
  }, [selectedDate, selectedDateBookings, selectedHallId]);

  const markedDates = useMemo<MarkedDates>(() => {
    const marks: MarkedDates = {};
    bookingDateKeys.forEach((dateKey) => {
      marks[dateKey] = {
        marked: true,
        dotColor: colors.status.pending
      };
    });

    if (selectedDate) {
      marks[selectedDate] = {
        ...(marks[selectedDate] ?? {}),
        selected: true,
        selectedColor: colors.primary,
        selectedTextColor: colors.surface,
        marked: Boolean(marks[selectedDate]?.marked),
        dotColor: marks[selectedDate]?.dotColor ?? colors.status.pending
      };
    }

    return marks;
  }, [bookingDateKeys, selectedDate]);

  const selectedDateLabel = selectedDate ? format(parseDateKey(selectedDate), 'EEEE, dd MMMM yyyy') : 'Select a date';

  const onSelectDate = (day: DateData) => {
    if (isBefore(parseDateKey(day.dateString), getDayStart(getLocalDateString()))) return;
    setSelectedDate(day.dateString);
    setSelectedSlotIds([]);
    setDraftSlotIds([]);
    setSelectionError('');
  };

  const openTimeSlotPicker = () => {
    if (!selectedHall) {
      setSelectionError('Please select a venue/hall.');
      return;
    }
    setDraftSlotIds(selectedSlotIds);
    setTimeSlotPickerError('');
    setTimeSlotPickerVisible(true);
  };

  const closeTimeSlotPicker = () => {
    setTimeSlotPickerVisible(false);
    setTimeSlotPickerError('');
  };

  const toggleDraftSlot = (slotId: string) => {
    const slot = TIME_SLOTS.find((item) => item.id === slotId);
    if (!slot || slotAvailability.get(slot.id) === false) return;

    setDraftSlotIds((current) => (
      current.includes(slotId) ? current.filter((id) => id !== slotId) : [...current, slotId]
    ));
    setTimeSlotPickerError('');
  };

  const applyTimeSlots = () => {
    const nextSlots = getSelectedSlots(draftSlotIds);
    if (nextSlots.some((slot) => slotAvailability.get(slot.id) === false)) {
      setTimeSlotPickerError('One or more selected slots are no longer available.');
      return;
    }

    if (!areSlotsContinuous(nextSlots)) {
      setTimeSlotPickerError('Please select continuous time slots only.');
      return;
    }

    setSelectedSlotIds(draftSlotIds);
    setSelectionError('');
    closeTimeSlotPicker();
  };

  const onSelectHall = (hallId: string) => {
    if (!selectedHall || selectedHall.id !== hallId) {
      setSelectionError('Please select a venue/hall.');
      return;
    }

    if (!selectedDate) {
      setSelectionError('Please select a booking date');
      return;
    }

    if (selectedSlots.length === 0) {
      setSelectionError('Please select at least one time slot');
      return;
    }

    if (selectedSlots.some((slot) => isSlotPassed(selectedDate, slot))) {
      setSelectionError('Selected time slot has already passed');
      return;
    }

    if (!selectedSlotsAreContinuous || !selectedTimeRange) {
      setSelectionError('Please select continuous time slots only.');
      return;
    }

    if (hallAvailability.get(hallId)?.isAvailable !== true) {
      setSelectionError('This venue is already booked or awaiting approval for the selected time.');
      return;
    }

    navigation.navigate('BookHall', {
      hallId,
      bookingDate: selectedDate,
      startTime: selectedTimeRange.startTime,
      endTime: selectedTimeRange.endTime,
      slotLabel: selectedSlots.map((slot) => slot.label).join(', ')
    });
  };

  const venueTypeOptions = useMemo(() => getVenueTypeOptionsForDepartment(halls, selectedDepartment), [halls, selectedDepartment]);
  const activeOptions = openFilter ? getFilterOptions(openFilter, venueTypeOptions) : [];
  const activeValue = openFilter
    ? getFilterValueFromState(openFilter, {
        selectedCapacity,
        selectedDepartment,
        selectedVenueType
      })
    : '';
  const handleFilterSelect = (value: string) => {
    if (openFilter === 'capacity') setSelectedCapacity(value);
    if (openFilter === 'department') {
      setSelectedDepartment(value);
    }
    if (openFilter === 'venueType') {
      setSelectedVenueType(value);
      setSelectedHallId(null);
      setSelectedSlotIds([]);
      setDraftSlotIds([]);
    }
    setOpenFilter(null);
  };
  const venueTypeDisabled = selectedDepartment === 'All';
  const hallSelectorDisabled = selectedDepartment === 'All' || selectableHalls.length === 0;
  const hallSelectorValue = getHallSelectorValue({
    selectedDepartment,
    selectedHall,
    selectableHalls,
    selectedVenueType
  });

  if (loading) return <LoadingView message="Loading active halls..." />;

  const emptyState = getEmptyState({
    selectedDepartment,
    selectedHall,
    selectedDate,
    selectedSlotCount: selectedSlots.length,
    selectedSlotsAreContinuous,
    totalHalls: halls.length,
    selectableCount: selectableHalls.length,
    baseCount: baseFilteredHalls.length,
    filteredCount: filteredHalls.length
  });
  const selectedSlotLabel = getSelectedSlotLabel(selectedSlots, selectedSlotsAreContinuous);

  return (
    <FlatList
      style={styles.root}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + TOP_SAFE_AREA_PADDING,
          paddingBottom: tabBarHeight + EXTRA_TAB_PADDING
        }
      ]}
      data={filteredHalls}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListHeaderComponent={
        <View style={styles.headerContent}>
          {error ? <ErrorView message={error} onRetry={() => void onRefresh()} /> : null}
          <View style={styles.filterCard}>
            <FilterDropdownRow label="Capacity" value={selectedCapacity} onPress={() => setOpenFilter('capacity')} />
            <FilterDropdownRow label="Department" value={selectedDepartment} onPress={() => setOpenFilter('department')} />
            <FilterDropdownRow
              label="Venue Type"
              value={venueTypeDisabled ? 'Select department first' : selectedVenueType}
              disabled={venueTypeDisabled}
              onPress={() => setOpenFilter('venueType')}
            />
            <FilterDropdownRow
              label="Venue / Hall"
              value={hallSelectorValue}
              disabled={hallSelectorDisabled}
              onPress={() => setHallPickerVisible(true)}
            />
          </View>
          <OptionPickerModal
            visible={Boolean(openFilter)}
            title={openFilter ? filterTitles[openFilter] : ''}
            options={activeOptions}
            selectedValue={activeValue}
            onSelect={handleFilterSelect}
            onClose={() => setOpenFilter(null)}
          />
          <HallPickerModal
            visible={hallPickerVisible}
            halls={selectableHalls}
            selectedHallId={selectedHallId}
            onSelect={(hall) => {
              setSelectedHallId(hall.id);
              setSelectedSlotIds([]);
              setDraftSlotIds([]);
              setSelectionError('');
              setHallPickerVisible(false);
            }}
            onClose={() => setHallPickerVisible(false)}
          />
          <View style={styles.calendarSection}>
            <Text style={styles.filterTitle}>Select Date</Text>
            <Calendar
              current={selectedDate}
              minDate={getLocalDateString()}
              markedDates={markedDates}
              onDayPress={onSelectDate}
              onMonthChange={(month) => setVisibleMonth(month.dateString)}
              theme={{
                calendarBackground: colors.surface,
                textSectionTitleColor: colors.textMuted,
                selectedDayBackgroundColor: colors.primary,
                selectedDayTextColor: colors.surface,
                todayTextColor: colors.primary,
                dayTextColor: colors.text,
                textDisabledColor: colors.textMuted,
                arrowColor: colors.primary,
                monthTextColor: colors.text,
                textMonthFontWeight: '900',
                textDayFontWeight: '700',
                textDayHeaderFontWeight: '900'
              }}
            />
            {loadingCalendarMarks ? <Text style={styles.resultsMeta}>Loading calendar markings...</Text> : null}
          </View>
          <Text style={styles.selectedDate}>{selectedDateLabel}</Text>
          <View style={styles.section}>
            <Text style={styles.filterTitle}>Select Time Slot</Text>
            <Text style={styles.sectionHint}>{selectedHall ? 'Select one or more continuous slots' : 'Select a venue to view available slots.'}</Text>
            <MultiSelectDropdownRow label="Time Slot" value={selectedHall ? selectedSlotLabel : 'Select venue first'} disabled={!selectedHall} onPress={openTimeSlotPicker} />
            {selectedSlots.length > 0 && !selectedSlotsAreContinuous ? (
              <Text style={styles.slotWarning}>Selected slots must be continuous.</Text>
            ) : null}
          </View>
          <TimeSlotPickerModal
            visible={timeSlotPickerVisible}
            selectedSlotIds={draftSlotIds}
            error={timeSlotPickerError}
            onToggleSlot={toggleDraftSlot}
            onBlockedSlot={() => setTimeSlotPickerError('This venue is already booked for this slot.')}
            onApply={applyTimeSlots}
            onClose={closeTimeSlotPicker}
            isSlotDisabled={(slot) => !selectedDate || slotAvailability.get(slot.id) === false}
            getSlotStatus={(slot) => getSlotStatus(slot, selectedDate, slotAvailability)}
            getBookedSlotInfo={(slot) => bookedSlotInfo.get(slot.id) ?? null}
          />
          {selectionError ? <Text style={styles.selectionError}>{selectionError}</Text> : null}
          <View style={styles.resultsHeader}>
            <Text style={styles.resultsTitle}>Selected Venue</Text>
            {loadingAvailability ? <Text style={styles.resultsMeta}>Checking availability...</Text> : null}
          </View>
        </View>
      }
      ListEmptyComponent={
        <EmptyState title={emptyState.title} message={emptyState.message} />
      }
      renderItem={({ item }) => (
        <VenueAvailabilityCard
          hall={item}
          availability={hallAvailability.get(item.id) ?? { hallId: item.id, isAvailable: false, reason: 'Unavailable' }}
          slotsSelected={selectedSlots.length > 0 && selectedSlotsAreContinuous}
          onPress={() => onSelectHall(item.id)}
        />
      )}
    />
  );
}

function VenueAvailabilityCard({
  hall,
  availability,
  slotsSelected,
  onPress
}: {
  hall: Hall;
  availability: HallAvailability;
  slotsSelected: boolean;
  onPress: () => void;
}) {
  const visibleFacilities = getVisibleFacilities(hall.facilities);
  const buttonDisabled = !slotsSelected || !availability.isAvailable;
  const buttonTitle = !slotsSelected ? 'Select slot first' : availability.isAvailable ? 'Book Venue' : 'Unavailable';

  return (
    <View style={[styles.venueCard, !availability.isAvailable && styles.unavailableWrap]}>
      {hall.imageUrl ? <Image source={{ uri: hall.imageUrl }} style={styles.venueImage} /> : null}
      <View style={styles.venueHeader}>
        <Text style={styles.venueName}>{hall.name}</Text>
        <View style={[styles.availabilityBadge, availability.isAvailable ? styles.availableBadge : styles.unavailableBadge]}>
          <Text style={[styles.availabilityText, availability.isAvailable ? styles.availableText : styles.unavailableText]}>
            {availability.isAvailable ? 'Available' : 'Unavailable'}
          </Text>
        </View>
      </View>
      <Text style={styles.venueMeta}>{normalizeVenueType(hall.venueType) || 'Venue'} • {formatVenueDescription(hall)}</Text>
      <Text style={styles.venueCapacity}>{hall.capacity} seats</Text>
      <View style={styles.facilityRow}>
        {visibleFacilities.items.map((facility) => (
          <Text key={facility} style={styles.facilityChip}>{facility}</Text>
        ))}
        {visibleFacilities.remaining > 0 ? <Text style={styles.facilityChip}>+{visibleFacilities.remaining} more</Text> : null}
      </View>
      <AppButton title={buttonTitle} disabled={buttonDisabled} onPress={onPress} />
    </View>
  );
}

function FilterDropdownRow({
  label,
  value,
  onPress,
  disabled = false
}: {
  label: string;
  value: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable disabled={disabled} onPress={onPress} style={[styles.dropdownRow, disabled && styles.dropdownRowDisabled]}>
      <Text style={[styles.dropdownLabel, disabled && styles.dropdownTextDisabled]}>{label}</Text>
      <View style={styles.dropdownValueWrap}>
        <Text numberOfLines={1} style={[styles.dropdownValue, disabled && styles.dropdownTextDisabled]}>{value}</Text>
        <Text style={[styles.dropdownArrow, disabled && styles.dropdownTextDisabled]}>{disabled ? '' : 'v'}</Text>
      </View>
    </Pressable>
  );
}

function MultiSelectDropdownRow({ label, value, onPress, disabled = false }: { label: string; value: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable disabled={disabled} onPress={onPress} style={[styles.timeSlotDropdown, disabled && styles.dropdownRowDisabled]}>
      <Text style={[styles.dropdownLabel, disabled && styles.dropdownTextDisabled]}>{label}</Text>
      <View style={styles.timeSlotDropdownValueWrap}>
        <Text numberOfLines={1} style={[styles.dropdownValue, disabled && styles.dropdownTextDisabled]}>{value}</Text>
        <Text style={[styles.dropdownArrow, disabled && styles.dropdownTextDisabled]}>{disabled ? '' : 'v'}</Text>
      </View>
    </Pressable>
  );
}

function HallPickerModal({
  visible,
  halls,
  selectedHallId,
  onSelect,
  onClose
}: {
  visible: boolean;
  halls: Hall[];
  selectedHallId: string | null;
  onSelect: (hall: Hall) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.optionSheet}>
          <View style={styles.optionHeader}>
            <Text style={styles.optionTitle}>Select Venue</Text>
            <Pressable onPress={onClose} style={styles.optionCloseButton}>
              <Text style={styles.optionCloseText}>Cancel</Text>
            </Pressable>
          </View>
          <ScrollView style={styles.optionList} contentContainerStyle={styles.optionListContent}>
            {halls.map((hall) => {
              const selected = hall.id === selectedHallId;
              return (
                <Pressable
                  key={hall.id}
                  onPress={() => onSelect(hall)}
                  style={[styles.hallOptionItem, selected && styles.optionItemSelected]}
                >
                  <View style={styles.hallOptionTextWrap}>
                    <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{hall.name}</Text>
                    <Text style={styles.hallOptionMeta}>
                      {normalizeVenueType(hall.venueType) || 'Venue'} • {formatVenueDescription(hall)}
                    </Text>
                    <Text style={styles.hallOptionCapacity}>Capacity: {hall.capacity}</Text>
                  </View>
                  {selected ? <Text style={styles.optionCheck}>Selected</Text> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function OptionPickerModal({
  visible,
  title,
  options,
  selectedValue,
  onSelect,
  onClose
}: {
  visible: boolean;
  title: string;
  options: string[];
  selectedValue: string;
  onSelect: (value: string) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.optionSheet}>
          <View style={styles.optionHeader}>
            <Text style={styles.optionTitle}>{title}</Text>
            <Pressable onPress={onClose} style={styles.optionCloseButton}>
              <Text style={styles.optionCloseText}>Cancel</Text>
            </Pressable>
          </View>
          <ScrollView style={styles.optionList} contentContainerStyle={styles.optionListContent}>
            {options.map((option) => {
              const selected = option === selectedValue;
              return (
                <Pressable
                  key={option}
                  onPress={() => onSelect(option)}
                  style={[styles.optionItem, selected && styles.optionItemSelected]}
                >
                  <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{option}</Text>
                  {selected ? <Text style={styles.optionCheck}>Selected</Text> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function TimeSlotPickerModal({
  visible,
  selectedSlotIds,
  error,
  onToggleSlot,
  onBlockedSlot,
  onApply,
  onClose,
  isSlotDisabled,
  getSlotStatus,
  getBookedSlotInfo
}: {
  visible: boolean;
  selectedSlotIds: string[];
  error: string;
  onToggleSlot: (slotId: string) => void;
  onBlockedSlot: () => void;
  onApply: () => void;
  onClose: () => void;
  isSlotDisabled: (slot: TimeSlot) => boolean;
  getSlotStatus: (slot: TimeSlot) => 'Select date' | 'Available' | 'Booked' | 'Passed';
  getBookedSlotInfo: (slot: TimeSlot) => BookedSlotInfo | null;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.optionSheet}>
          <View style={styles.optionHeader}>
            <Text style={styles.optionTitle}>Select Time Slots</Text>
          </View>
          <ScrollView style={styles.optionList} contentContainerStyle={styles.optionListContent}>
            {TIME_SLOTS.map((slot) => {
              const selected = selectedSlotIds.includes(slot.id);
              const disabled = isSlotDisabled(slot);
              const status = getSlotStatus(slot);
              const statusLabel = selected && !disabled ? 'Selected' : status;
              const bookingInfo = status === 'Booked' ? getBookedSlotInfo(slot) : null;
              return (
                <Pressable
                  key={slot.id}
                  onPress={() => disabled ? onBlockedSlot() : onToggleSlot(slot.id)}
                  style={[styles.slotOptionItem, selected && styles.optionItemSelected, disabled && styles.slotOptionDisabled]}
                >
                  <Text style={[styles.slotCheckbox, selected && styles.slotCheckboxSelected, disabled && styles.slotOptionMuted]}>
                    {selected ? '✓' : ''}
                  </Text>
                  <View style={styles.slotOptionCopy}>
                    <Text style={[styles.slotOptionLabel, disabled && styles.slotOptionMuted]}>{slot.label}</Text>
                    {bookingInfo ? (
                      <>
                        <Text style={styles.slotBookingMeta}>
                          Booked by {bookingInfo.requesterName ?? 'Requester'}{bookingInfo.requesterDepartment ? ` • ${bookingInfo.requesterDepartment}` : ''}
                        </Text>
                        <Text style={styles.slotBookingEvent} numberOfLines={1}>
                          {bookingInfo.eventTitle}
                        </Text>
                      </>
                    ) : null}
                  </View>
                  <Text
                    style={[
                      styles.slotOptionStatus,
                      (statusLabel === 'Available' || statusLabel === 'Selected') && styles.slotOptionAvailable,
                      disabled && styles.slotOptionMuted
                    ]}
                  >
                    {statusLabel}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          {error ? <Text style={styles.slotModalError}>{error}</Text> : null}
          <View style={styles.modalActions}>
            <AppButton title="Cancel" variant="secondary" onPress={onClose} />
            <AppButton title="Apply" onPress={onApply} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function getFilterOptions(filter: FilterKey, venueTypeOptions: string[]) {
  if (filter === 'capacity') return capacityOptions;
  if (filter === 'department') return departmentOptions;
  return venueTypeOptions;
}

function getFilterValueFromState(
  filter: FilterKey,
  values: {
    selectedCapacity: string;
    selectedDepartment: string;
    selectedVenueType: string;
  }
) {
  if (filter === 'capacity') return values.selectedCapacity;
  if (filter === 'department') return values.selectedDepartment;
  return values.selectedVenueType;
}

function getMinimumCapacity(value: string) {
  if (value === '50+') return 50;
  if (value === '100+') return 100;
  if (value === '200+') return 200;
  return 0;
}

function getVenueTypeOptionsForDepartment(halls: Hall[], selectedDepartment: string) {
  if (selectedDepartment === 'All') return ['All'];

  const availableTypes = new Set(
    halls
      .filter((hall) => hall.isActive && hall.department === selectedDepartment)
      .map((hall) => normalizeVenueType(hall.venueType))
      .filter(Boolean)
  );
  const sortedTypes = VENUE_TYPES.filter((type) => availableTypes.has(type));
  const customTypes = [...availableTypes].filter((type) => !VENUE_TYPES.includes(type as (typeof VENUE_TYPES)[number])).sort();

  return ['All', ...sortedTypes, ...customTypes];
}

function getHallSelectorValue({
  selectedDepartment,
  selectedHall,
  selectableHalls,
  selectedVenueType
}: {
  selectedDepartment: string;
  selectedHall: Hall | null;
  selectableHalls: Hall[];
  selectedVenueType: string;
}) {
  if (selectedDepartment === 'All') return 'Select department first';
  if (selectableHalls.length === 0) {
    return selectedVenueType === 'All' ? 'No venues available' : 'No venues for selected type';
  }
  return selectedHall?.name ?? 'Select venue';
}

function getSelectedSlots(selectedSlotIds: string[]) {
  return TIME_SLOTS.filter((slot) => selectedSlotIds.includes(slot.id));
}

function areSlotsContinuous(selectedSlots: TimeSlot[]) {
  if (selectedSlots.length <= 1) return true;
  const slotIndexes = selectedSlots
    .map((slot) => TIME_SLOTS.findIndex((item) => item.id === slot.id))
    .sort((first, second) => first - second);

  return slotIndexes.every((slotIndex, index) => index === 0 || slotIndex === slotIndexes[index - 1] + 1);
}

function getCombinedTimeRange(selectedSlots: TimeSlot[], selectedDate: string) {
  const sortedSlots = [...selectedSlots].sort(
    (first, second) => TIME_SLOTS.findIndex((slot) => slot.id === first.id) - TIME_SLOTS.findIndex((slot) => slot.id === second.id)
  );
  const firstSlot = sortedSlots[0];
  const lastSlot = sortedSlots[sortedSlots.length - 1];

  return {
    startTime: buildLocalIso(selectedDate, firstSlot.start),
    endTime: buildLocalIso(selectedDate, lastSlot.end)
  };
}

function isHallAvailableForRange(hall: Hall, bookings: BookingAvailability[], startTime: string, endTime: string) {
  return !isHallBookedForRange(hall.id, startTime, endTime, bookings);
}

function getVisibleFacilities(facilities: string[]) {
  return {
    items: facilities.slice(0, 3),
    remaining: Math.max(facilities.length - 3, 0)
  };
}

function getSelectedSlotLabel(selectedSlots: TimeSlot[], isContinuous: boolean) {
  if (selectedSlots.length === 0) return 'Select slots';
  if (selectedSlots.length === 1) return selectedSlots[0].label;
  if (!isContinuous) return `${selectedSlots.length} slots selected`;

  const sortedSlots = [...selectedSlots].sort(
    (first, second) => TIME_SLOTS.findIndex((slot) => slot.id === first.id) - TIME_SLOTS.findIndex((slot) => slot.id === second.id)
  );
  return `${getSlotStartLabel(sortedSlots[0])} - ${getSlotEndLabel(sortedSlots[sortedSlots.length - 1])}`;
}

function getSlotStartLabel(slot: TimeSlot) {
  return slot.label.split(' - ')[0];
}

function getSlotEndLabel(slot: TimeSlot) {
  return slot.label.split(' - ')[1] ?? slot.label;
}

function getSlotStatus(slot: TimeSlot, selectedDate: string, slotAvailability: Map<string, boolean>) {
  if (!selectedDate) return 'Select date';
  if (isSlotPassed(selectedDate, slot)) return 'Passed';
  return slotAvailability.get(slot.id) === false ? 'Booked' : 'Available';
}

function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function buildSlotDateTimes(dateKey: string, slot: TimeSlot) {
  return {
    startTime: buildLocalIso(dateKey, slot.start),
    endTime: buildLocalIso(dateKey, slot.end)
  };
}

function buildLocalIso(dateKey: string, time: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  return new Date(year, month - 1, day, hour, minute, 0, 0).toISOString();
}

function getDayStart(dateKey: string) {
  const date = parseDateKey(dateKey);
  date.setHours(0, 0, 0, 0);
  return date;
}

function getNextDayStart(dateKey: string) {
  const date = getDayStart(dateKey);
  date.setDate(date.getDate() + 1);
  return date;
}

function isSlotPassed(selectedDate: string, slot: TimeSlot) {
  const [year, month, day] = selectedDate.split('-').map(Number);
  const [endHour, endMinute] = slot.end.split(':').map(Number);
  const slotEndDateTime = new Date(year, month - 1, day, endHour, endMinute, 0, 0);

  return slotEndDateTime.getTime() <= Date.now();
}

function isHallBookedForRange(hallId: string, rangeStart: string, rangeEnd: string, bookings: BookingAvailability[]) {
  const selectedStart = new Date(rangeStart).getTime();
  const selectedEnd = new Date(rangeEnd).getTime();

  return bookings.some((booking) => {
    if (booking.hallId !== hallId) return false;
    if (!['pending', 'approved'].includes(booking.status)) return false;

    const bookingStart = new Date(booking.startTime).getTime();
    const bookingEnd = new Date(booking.endTime).getTime();

    return bookingStart < selectedEnd && bookingEnd > selectedStart;
  });
}

function findBookedSlotInfo(hallId: string, rangeStart: string, rangeEnd: string, bookings: BookingAvailability[]) {
  const selectedStart = new Date(rangeStart).getTime();
  const selectedEnd = new Date(rangeEnd).getTime();

  return bookings.find((booking) => {
    if (booking.hallId !== hallId) return false;
    if (!['pending', 'approved'].includes(booking.status)) return false;

    const bookingStart = new Date(booking.startTime).getTime();
    const bookingEnd = new Date(booking.endTime).getTime();

    return bookingStart < selectedEnd && bookingEnd > selectedStart;
  });
}

function getRelevantHallsForAvailability({
  halls,
  selectedCapacity,
  selectedDepartment,
  selectedVenueType,
  requireDepartment
}: {
  halls: Hall[];
  selectedCapacity: string;
  selectedDepartment: string;
  selectedVenueType: string;
  requireDepartment: boolean;
}) {
  if (requireDepartment && selectedDepartment === 'All') return [];

  const minimumCapacity = getMinimumCapacity(selectedCapacity);
  return halls.filter((hall) => {
    const departmentMatch = selectedDepartment === 'All' || hall.department === selectedDepartment;
    const venueTypeMatch = selectedVenueType === 'All' || normalizeVenueType(hall.venueType) === normalizeVenueType(selectedVenueType);
    const capacityMatch = hall.capacity >= minimumCapacity;

    return departmentMatch && venueTypeMatch && capacityMatch && hall.isActive;
  });
}

function getEmptyState(params: {
  selectedDepartment: string;
  selectedHall: Hall | null;
  selectedDate: string;
  selectedSlotCount: number;
  selectedSlotsAreContinuous: boolean;
  totalHalls: number;
  selectableCount: number;
  baseCount: number;
  filteredCount: number;
}) {
  if (params.selectedDepartment === 'All') {
    return { title: 'Select department', message: 'Please select a department to view available venues.' };
  }
  if (params.totalHalls === 0) {
    return { title: 'No venues', message: 'No venues have been added yet.' };
  }
  if (params.selectableCount === 0) {
    return { title: 'No active venues found', message: 'No active venues found for this department and venue type.' };
  }
  if (!params.selectedHall) {
    return { title: 'Select venue', message: 'Select a Venue / Hall to view available slots.' };
  }
  if (!params.selectedDate) {
    return { title: 'Select date', message: 'Select a date to view available slots.' };
  }
  if (params.selectedSlotCount === 0) {
    return { title: 'Select time slot', message: 'Select one or more continuous time slots to view available venues.' };
  }
  if (!params.selectedSlotsAreContinuous) {
    return { title: 'Invalid time slot selection', message: 'Please select continuous time slots only.' };
  }
  if (params.filteredCount === 0) {
    return { title: 'No available halls', message: 'No venues are available for the selected department, date, and time slots.' };
  }

  return { title: 'No halls found', message: 'No halls found. Try changing your filters.' };
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
  headerContent: {
    gap: spacing.md
  },
  filterTitle: {
    color: colors.text,
    fontSize: fontSizes.sm,
    fontWeight: '900'
  },
  filterCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    overflow: 'hidden'
  },
  dropdownRow: {
    minHeight: 52,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  dropdownRowDisabled: {
    backgroundColor: colors.surfaceMuted
  },
  dropdownLabel: {
    color: colors.text,
    fontSize: fontSizes.sm,
    fontWeight: '900'
  },
  dropdownValueWrap: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 1,
    gap: spacing.sm,
    justifyContent: 'flex-end',
    marginLeft: spacing.md,
    maxWidth: '62%'
  },
  dropdownValue: {
    color: colors.textMuted,
    flexShrink: 1,
    fontSize: fontSizes.sm,
    fontWeight: '800',
    textAlign: 'right'
  },
  dropdownArrow: {
    color: colors.primary,
    fontSize: fontSizes.sm,
    fontWeight: '900'
  },
  dropdownTextDisabled: {
    color: colors.textMuted
  },
  timeSlotDropdown: {
    minHeight: 52,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  timeSlotDropdownValueWrap: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 1,
    gap: spacing.sm,
    justifyContent: 'flex-end',
    marginLeft: spacing.md,
    maxWidth: '68%'
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end'
  },
  optionSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '72%',
    paddingBottom: spacing.md
  },
  optionHeader: {
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md
  },
  optionTitle: {
    color: colors.text,
    fontSize: fontSizes.md,
    fontWeight: '900'
  },
  optionCloseButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  optionCloseText: {
    color: colors.primary,
    fontSize: fontSizes.sm,
    fontWeight: '900'
  },
  optionList: {
    maxHeight: 420
  },
  optionListContent: {
    padding: spacing.md,
    gap: spacing.sm
  },
  optionItem: {
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  optionItemSelected: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary
  },
  optionText: {
    color: colors.text,
    flex: 1,
    fontSize: fontSizes.sm,
    fontWeight: '800'
  },
  optionTextSelected: {
    color: colors.primary
  },
  optionCheck: {
    color: colors.primary,
    fontSize: fontSizes.xs,
    fontWeight: '900'
  },
  hallOptionItem: {
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
    minHeight: 76,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  hallOptionTextWrap: {
    flex: 1,
    gap: spacing.xs
  },
  hallOptionMeta: {
    color: colors.textMuted,
    fontSize: fontSizes.xs,
    fontWeight: '800'
  },
  hallOptionCapacity: {
    color: colors.primary,
    fontSize: fontSizes.xs,
    fontWeight: '900'
  },
  slotOptionItem: {
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 52,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  slotOptionDisabled: {
    backgroundColor: colors.borderSoft,
    borderColor: colors.borderSoft
  },
  slotCheckbox: {
    width: 24,
    height: 24,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    color: colors.surface,
    fontSize: fontSizes.sm,
    fontWeight: '900',
    lineHeight: 22,
    overflow: 'hidden',
    textAlign: 'center'
  },
  slotCheckboxSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  slotOptionLabel: {
    color: colors.text,
    fontSize: fontSizes.sm,
    fontWeight: '800'
  },
  slotOptionCopy: {
    flex: 1,
    gap: 2
  },
  slotBookingMeta: {
    color: colors.textMuted,
    fontSize: fontSizes.xs,
    fontWeight: '800'
  },
  slotBookingEvent: {
    color: colors.text,
    fontSize: fontSizes.xs,
    fontWeight: '700'
  },
  slotOptionStatus: {
    color: colors.textMuted,
    fontSize: fontSizes.xs,
    fontWeight: '900'
  },
  slotOptionAvailable: {
    color: colors.status.approved
  },
  slotOptionMuted: {
    color: colors.textMuted
  },
  slotModalError: {
    backgroundColor: colors.errorSurface,
    borderColor: colors.errorBorder,
    borderWidth: 1,
    borderRadius: radius.md,
    color: colors.status.rejected,
    fontSize: fontSizes.sm,
    fontWeight: '800',
    marginHorizontal: spacing.md,
    padding: spacing.sm
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md
  },
  section: {
    gap: spacing.sm
  },
  sectionHint: {
    color: colors.textMuted,
    fontSize: fontSizes.sm,
    fontWeight: '700'
  },
  calendarSection: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.sm,
    gap: spacing.sm
  },
  selectedDate: {
    color: colors.textMuted,
    fontSize: fontSizes.sm,
    fontWeight: '700'
  },
  slotWarning: {
    backgroundColor: colors.errorSurface,
    borderColor: colors.errorBorder,
    borderWidth: 1,
    borderRadius: radius.md,
    color: colors.status.rejected,
    fontSize: fontSizes.sm,
    fontWeight: '800',
    padding: spacing.sm
  },
  selectionError: {
    backgroundColor: colors.errorSurface,
    borderColor: colors.errorBorder,
    borderWidth: 1,
    borderRadius: radius.md,
    color: colors.status.rejected,
    fontSize: fontSizes.sm,
    fontWeight: '700',
    padding: spacing.md
  },
  resultsHeader: {
    gap: spacing.xs
  },
  resultsTitle: {
    color: colors.text,
    fontSize: fontSizes.lg,
    fontWeight: '900'
  },
  resultsMeta: {
    color: colors.textMuted,
    fontSize: fontSizes.sm,
    fontWeight: '700'
  },
  venueCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.lg,
    gap: spacing.sm,
    padding: spacing.md
  },
  venueImage: {
    width: '100%',
    height: 132,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight
  },
  venueHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between'
  },
  venueName: {
    color: colors.text,
    flex: 1,
    fontSize: fontSizes.lg,
    fontWeight: '900'
  },
  venueMeta: {
    color: colors.textMuted,
    fontSize: fontSizes.sm,
    fontWeight: '700'
  },
  venueCapacity: {
    color: colors.primary,
    fontSize: fontSizes.sm,
    fontWeight: '900'
  },
  facilityRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.xs
  },
  facilityChip: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.pill,
    color: colors.primary,
    fontSize: fontSizes.xs,
    fontWeight: '800',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  unavailableWrap: {
    opacity: 0.72
  },
  availabilityBadge: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs
  },
  availableBadge: {
    backgroundColor: colors.primaryLight
  },
  unavailableBadge: {
    backgroundColor: colors.borderSoft
  },
  availabilityText: {
    fontSize: fontSizes.xs,
    fontWeight: '900'
  },
  availableText: {
    color: colors.status.approved
  },
  unavailableText: {
    color: colors.textMuted
  }
});
