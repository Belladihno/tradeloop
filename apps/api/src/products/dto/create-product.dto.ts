import { createZodDto } from "nestjs-zod";
import { createProductSchema } from "@tradeloop/validators";

export class CreateProductDto extends createZodDto(createProductSchema) {}
