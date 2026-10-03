import { BadRequestException } from "@nestjs/common";

export class DiscountRejectedException extends BadRequestException {
  constructor(message: string) {
    super({ message, error: "DISCOUNT_REJECTED" });
  }
}
