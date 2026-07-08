export type TimeSlot = {
  id: string;
  label: string;
  start: string;
  end: string;
};

export const TIME_SLOTS: TimeSlot[] = [
  { id: 'slot_1', label: '8:45 AM - 9:35 AM', start: '08:45', end: '09:35' },
  { id: 'slot_2', label: '9:35 AM - 10:25 AM', start: '09:35', end: '10:25' },
  { id: 'slot_3', label: '10:45 AM - 11:35 AM', start: '10:45', end: '11:35' },
  { id: 'slot_4', label: '11:35 AM - 12:25 PM', start: '11:35', end: '12:25' },
  { id: 'slot_5', label: '1:10 PM - 2:00 PM', start: '13:10', end: '14:00' },
  { id: 'slot_6', label: '2:00 PM - 2:50 PM', start: '14:00', end: '14:50' },
  { id: 'slot_7', label: '3:00 PM - 3:50 PM', start: '15:00', end: '15:50' },
  { id: 'slot_8', label: '3:50 PM - 4:40 PM', start: '15:50', end: '16:40' }
];
