import { BadRequestException } from "@nestjs/common";

export class InsufficientFundsException extends BadRequestException {
  constructor() {
    super({
      message: "Wallet balance is insufficient for this operation",
      error: "INSUFFICIENT_FUNDS",
    });
  }
}
