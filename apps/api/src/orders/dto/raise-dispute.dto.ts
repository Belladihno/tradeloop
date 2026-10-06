import { createZodDto } from "nestjs-zod";
import { raiseDisputeSchema } from "@tradeloop/validators";

export class RaiseDisputeDto extends createZodDto(raiseDisputeSchema) {}
