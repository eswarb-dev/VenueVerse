export type AppNotification = {
  id: string;
  userId: string;
  title: string;
  message: string;
  isRead: boolean;
  bookingId: string | null;
  createdAt: string;
};
