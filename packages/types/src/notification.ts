export enum NotificationChannel {
  EMAIL = "EMAIL",
  IN_APP = "IN_APP",
}

export enum NotificationStatus {
  PENDING = "PENDING",
  SENT = "SENT",
  FAILED = "FAILED",
}

export interface Notification {
  id: string;
  userId: string;
  channel: NotificationChannel;
  subject: string;
  body: string;
  data: Record<string, unknown> | null;
  status: NotificationStatus;
  sentAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotifyInput {
  userId: string;
  channels: NotificationChannel[];
  subject: string;
  body: string;
  data?: Record<string, unknown>;
}
