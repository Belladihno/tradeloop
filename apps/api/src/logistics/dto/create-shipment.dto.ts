import { createZodDto } from "nestjs-zod";
import { createShipmentSchema } from "@tradeloop/validators";

export class CreateShipmentDto extends createZodDto(createShipmentSchema) {}
