export type AppNotification = {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: string | null;
  data: Record<string, unknown>;
  isRead: boolean;
  bookingId: string | null;
  createdAt: string;
};
