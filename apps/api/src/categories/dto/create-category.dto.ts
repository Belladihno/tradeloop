import { createZodDto } from "nestjs-zod";
import { createCategorySchema } from "@tradeloop/validators";

export class CreateCategoryDto extends createZodDto(createCategorySchema) {}
