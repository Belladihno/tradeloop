import { Body, Controller, HttpCode, Post, Req } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { WebhookHandlerService, type FlutterwaveChargeEvent, type PaystackChargeEvent } from "./webhook-handler.service";

@Controller("webhooks")
export class WebhooksController {
  constructor(private readonly handler: WebhookHandlerService) {}

  @Post("paystack")
  @HttpCode(200)
  async paystack(
    @Req() req: FastifyRequest & { rawBody?: Buffer },
    @Body() body: PaystackChargeEvent,
  ): Promise<{ status: string }> {
    const signature = req.headers["x-paystack-signature"] as string | undefined;
    const status = await this.handler.handlePaystackEvent(body, req.rawBody, signature);
    return { status };
  }

  @Post("flutterwave")
  @HttpCode(200)
  async flutterwave(
    @Req() req: FastifyRequest,
    @Body() body: FlutterwaveChargeEvent,
  ): Promise<{ status: string }> {
    const signature = req.headers["verif-hash"] as string | undefined;
    const status = await this.handler.handleFlutterwaveEvent(body, signature);
    return { status };
  }
}
