import { describe, expect, it } from "vitest";
import { NotificationStream } from "./notification-stream";
import type { Notification } from "./entities/notification.entity";
import { NotificationChannel, NotificationStatus } from "@tradeloop/types";

function record(userId: string): Notification {
  return {
    id: "n-1",
    userId,
    channel: NotificationChannel.IN_APP,
    subject: "Hi",
    body: "There",
    data: null,
    status: NotificationStatus.SENT,
    sentAt: new Date(),
    createdAt: new Date(),
  } as Notification;
}

describe("NotificationStream", () => {
  it("delivers published events to that user's subscriber only", async () => {
    const stream = new NotificationStream();
    const mine: unknown[] = [];
    const theirs: unknown[] = [];
    stream.subscribe("user-1").subscribe((event) => mine.push(event));
    stream.subscribe("user-2").subscribe((event) => theirs.push(event));

    stream.publish("user-1", record("user-1"));

    expect(mine).toHaveLength(1);
    expect(theirs).toHaveLength(0);
  });

  it("reuses the same subject for repeat subscribers", () => {
    const stream = new NotificationStream();
    expect(stream.subscribe("user-1")).toBe(stream.subscribe("user-1"));
  });
});
