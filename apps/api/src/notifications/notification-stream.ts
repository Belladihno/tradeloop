import { Injectable } from "@nestjs/common";
import { Subject } from "rxjs";
import type { Notification } from "./entities/notification.entity";

export interface InAppEvent {
  id: string;
  subject: string;
  body: string;
  data: Record<string, unknown> | null;
  createdAt: Date;
}

@Injectable()
export class NotificationStream {
  private readonly subjects = new Map<string, Subject<InAppEvent>>();

  subscribe(userId: string): Subject<InAppEvent> {
    let subject = this.subjects.get(userId);
    if (!subject) {
      subject = new Subject<InAppEvent>();
      this.subjects.set(userId, subject);
    }
    return subject;
  }

  publish(userId: string, notification: Notification): void {
    this.subjects.get(userId)?.next({
      id: notification.id,
      subject: notification.subject,
      body: notification.body,
      data: notification.data,
      createdAt: notification.createdAt,
    });
  }
}
