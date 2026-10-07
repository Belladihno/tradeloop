import { Controller, Get, Sse, UseGuards } from "@nestjs/common";
import type { Observable } from "rxjs";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { RequestUser } from "../auth/types";
import { NotificationStream, type InAppEvent } from "./notification-stream";
import { NotificationsService } from "./notifications.service";

@Controller("notifications")
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly stream: NotificationStream,
  ) {}

  @Sse("stream")
  streamEvents(@CurrentUser() user: RequestUser): Observable<InAppEvent> {
    return this.stream.subscribe(user.id).asObservable();
  }

  @Get("mine")
  listMine(@CurrentUser() user: RequestUser) {
    return this.notifications.listMine(user.id);
  }
}
