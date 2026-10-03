import { createZodDto } from "nestjs-zod";
import { rejectSellerSchema } from "@tradeloop/validators";

export class RejectSellerDto extends createZodDto(rejectSellerSchema) {}
