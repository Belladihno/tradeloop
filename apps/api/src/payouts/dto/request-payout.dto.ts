import { createZodDto } from "nestjs-zod";
import { requestPayoutSchema } from "@tradeloop/validators";

export class RequestPayoutDto extends createZodDto(requestPayoutSchema) {}
