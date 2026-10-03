import { createZodDto } from "nestjs-zod";
import { updateCommissionSchema } from "@tradeloop/validators";

export class UpdateCommissionDto extends createZodDto(updateCommissionSchema) {}
