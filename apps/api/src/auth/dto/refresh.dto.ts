import { createZodDto } from "nestjs-zod";
import { refreshSchema } from "@tradeloop/validators";

export class RefreshDto extends createZodDto(refreshSchema) {}
