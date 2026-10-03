import { createZodDto } from "nestjs-zod";
import { loginSchema } from "@tradeloop/validators";

export class LoginDto extends createZodDto(loginSchema) {}
