export type BookingStatus = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'completed';

export type Hall = {
  id: string;
  name: string;
  department: string | null;
  venueType: string | null;
  location: string | null;
  block: string | null;
  floor: string | null;
  capacity: number;
  facilities: string[];
  imageUrl: string | null;
  isActive: boolean;
};

export type HallFormInput = {
  name: string;
  department: string;
  venueType: string;
  location: string;
  block: string;
  floor: string;
  capacity: number;
  facilities: string[];
  imageUrl: string | null;
  isActive: boolean;
};

export type BookingPreview = {
  id: string;
  eventTitle: string;
  status: BookingStatus;
  startTime: string;
  endTime: string;
  hallName: string | null;
  createdAt?: string;
};

export type AvailabilitySlot = {
  id: string;
  eventTitle: string;
  status: Extract<BookingStatus, 'pending' | 'approved'>;
  startTime: string;
  endTime: string;
};

export type BookingAvailability = {
  id: string;
  hallId: string | null;
  status: Extract<BookingStatus, 'pending' | 'approved'>;
  startTime: string;
  endTime: string;
};

export type BookingDetails = {
  id: string;
  hallId: string | null;
  requesterId?: string | null;
  eventTitle: string;
  eventType: string | null;
  department: string | null;
  facultyCoordinator: string | null;
  startTime: string;
  endTime: string;
  status: BookingStatus;
  adminRemarks: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  hall: Pick<Hall, 'name' | 'block' | 'floor' | 'capacity' | 'facilities' | 'imageUrl'> | null;
  approvedBy: {
    fullName: string;
    email: string;
  } | null;
  requester?: {
    fullName: string;
    email: string;
    department: string | null;
  } | null;
};

export type AdminBookingSummary = BookingPreview & {
  requesterName: string | null;
  requesterDepartment: string | null;
  resolvedDepartment: string | null;
  updatedAt?: string | null;
};

export type AdminDashboardStats = {
  pending: number;
  approved: number;
  rejected: number;
  activeHalls: number;
};

export type CreateBookingInput = {
  hallId: string;
  userId: string;
  eventTitle: string;
  eventType: string;
  department: string;
  facultyCoordinator: string;
  startTime: string;
  endTime: string;
};

export type BookingStats = {
  pending: number;
  approved: number;
  rejected: number;
};

export type TodayBookedHall = {
  bookingId: string;
  hallId: string | null;
  hallName: string;
  department: string | null;
  venueType: string | null;
  location: string | null;
  eventTitle: string;
  startTime: string;
  endTime: string;
  status: Extract<BookingStatus, 'pending' | 'approved'>;
};
