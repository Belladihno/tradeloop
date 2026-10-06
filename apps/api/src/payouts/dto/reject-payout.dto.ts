import { createZodDto } from "nestjs-zod";
import { rejectPayoutSchema } from "@tradeloop/validators";

export class RejectPayoutDto extends createZodDto(rejectPayoutSchema) {}
