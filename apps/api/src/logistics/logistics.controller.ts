import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { RequestUser } from "../auth/types";
import { CreateShipmentDto } from "./dto/create-shipment.dto";
import { ShippingRateDto } from "./dto/shipping-rate.dto";
import { LogisticsService } from "./logistics.service";

@Controller("shipments")
@UseGuards(JwtAuthGuard)
export class LogisticsController {
  constructor(private readonly logistics: LogisticsService) {}

  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateShipmentDto) {
    return this.logistics.createShipment(user.id, dto);
  }

  @Get("rate")
  rate(@Query() query: ShippingRateDto) {
    return this.logistics.calculateRate(query);
  }

  @Get(":trackingNumber/track")
  track(@Param("trackingNumber") trackingNumber: string) {
    return this.logistics.trackShipment(trackingNumber);
  }
}
