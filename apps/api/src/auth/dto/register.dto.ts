import { createZodDto } from "nestjs-zod";
import { registerSchema } from "@tradeloop/validators";

export class RegisterDto extends createZodDto(registerSchema) {}
