import { describe, expect, it, vi } from "vitest";
import { NotificationChannel, NotificationStatus } from "@tradeloop/types";
import { NotificationsRepository } from "./notifications.repository";
import { NotificationsService } from "./notifications.service";
import { EmailChannel } from "./email.channel";
import { NotificationStream } from "./notification-stream";

function setup() {
  const stored: Record<string, unknown>[] = [];
  const notifications = {
    create: vi.fn(async (data: Record<string, unknown>) => {
      const record = { id: `n-${stored.length + 1}`, ...data };
      stored.push(record);
      return record;
    }),
    findById: vi.fn(async (id: string) => stored.find((r) => r.id === id) ?? null),
    findByUser: vi.fn(),
    save: vi.fn(async (record: unknown) => record),
  };
  const email = { send: vi.fn() };
  const stream = { publish: vi.fn(), subscribe: vi.fn() };
  const queue = { add: vi.fn(async () => ({ id: "job-1" })) };
  const service = new NotificationsService(
    notifications as unknown as NotificationsRepository,
    email as unknown as EmailChannel,
    stream as unknown as NotificationStream,
    queue as never,
  );
  return { service, notifications, email, stream, queue, stored };
}

const INPUT = {
  userId: "user-1",
  channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
  subject: "Hello",
  body: "World",
};

describe("NotificationsService", () => {
  it("stores one pending row per channel and enqueues delivery", async () => {
    const { service, notifications, queue } = setup();

    const created = await service.notify(INPUT);

    expect(created).toHaveLength(2);
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: NotificationStatus.PENDING, channel: NotificationChannel.EMAIL }),
    );
    expect(queue.add).toHaveBeenCalledTimes(2);
    expect(queue.add).toHaveBeenCalledWith("send", { notificationId: "n-1" });
  });

  it("sends email notifications through the email channel", async () => {
    const { service, email } = setup();
    const [record] = await service.notify({
      userId: "user-1",
      channels: [NotificationChannel.EMAIL],
      subject: "Hi",
      body: "There",
    });

    expect(await service.send(record.id)).toBe("sent");
    expect(email.send).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-1", subject: "Hi" }),
    );
    expect(record.status).toBe(NotificationStatus.SENT);
  });

  it("publishes in-app notifications to the live stream", async () => {
    const { service, stream, email } = setup();
    const [record] = await service.notify({
      userId: "user-1",
      channels: [NotificationChannel.IN_APP],
      subject: "Hi",
      body: "There",
    });

    expect(await service.send(record.id)).toBe("sent");
    expect(stream.publish).toHaveBeenCalledWith("user-1", record);
    expect(email.send).not.toHaveBeenCalled();
  });

  it("treats resends as duplicates", async () => {
    const { service, email } = setup();
    const [record] = await service.notify({
      userId: "user-1",
      channels: [NotificationChannel.EMAIL],
      subject: "Hi",
      body: "There",
    });
    await service.send(record.id);

    expect(await service.send(record.id)).toBe("duplicate");
    expect(await service.send("missing")).toBe("duplicate");
    expect(email.send).toHaveBeenCalledTimes(1);
  });

  it("marks failed deliveries instead of throwing", async () => {
    const { service, email } = setup();
    email.send.mockRejectedValue(new Error("SMTP down"));
    const [record] = await service.notify({
      userId: "user-1",
      channels: [NotificationChannel.EMAIL],
      subject: "Hi",
      body: "There",
    });

    expect(await service.send(record.id)).toBe("failed");
    expect(record.status).toBe(NotificationStatus.FAILED);
  });
});
