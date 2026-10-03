import { ConflictException } from "@nestjs/common";

export class InsufficientStockException extends ConflictException {
  constructor() {
    super({
      message: "This product does not have enough stock for the requested quantity",
      error: "INSUFFICIENT_STOCK",
    });
  }
}
