import { createZodDto } from "nestjs-zod";
import { resolveDisputeSchema } from "@tradeloop/validators";

export class ResolveDisputeDto extends createZodDto(resolveDisputeSchema) {}
