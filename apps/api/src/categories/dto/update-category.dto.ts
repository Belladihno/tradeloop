import { createZodDto } from "nestjs-zod";
import { updateCategorySchema } from "@tradeloop/validators";

export class UpdateCategoryDto extends createZodDto(updateCategorySchema) {}
