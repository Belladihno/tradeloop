import { ConflictException } from "@nestjs/common";

export class InvalidStateTransitionException extends ConflictException {
  constructor(from: string, to: string) {
    super({
      message: `Cannot transition from ${from} to ${to}`,
      error: "INVALID_STATE_TRANSITION",
    });
  }
}
