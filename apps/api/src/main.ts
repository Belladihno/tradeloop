import "reflect-metadata";
import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import helmet from "@fastify/helmet";
import { ZodValidationPipe } from "nestjs-zod";
import { AppModule } from "./app.module";
import { registerRequestIdHook } from "./common/middleware/request-id.middleware";
import { SanitizePipe } from "./common/pipes/sanitize.pipe";
import type { Env } from "./config/env.validation";
import { registerBullBoard } from "./queues/bull-board";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: true }),
    { bufferLogs: false, rawBody: true },
  );

  const config = app.get(ConfigService<Env, true>);
  const port = config.get("PORT", { infer: true });
  const webUrl = config.get("WEB_URL", { infer: true });
  const adminUrl = config.get("ADMIN_URL", { infer: true });

  await app.register(helmet);
  registerRequestIdHook(app.getHttpAdapter().getInstance());
  app.enableCors({ origin: [webUrl, adminUrl], credentials: true });
  app.setGlobalPrefix("api/v1");
  app.useGlobalPipes(new ZodValidationPipe(), new SanitizePipe());

  if (config.get("SWAGGER_ENABLED", { infer: true })) {
    await registerBullBoard(app);
  }

  await app.listen(port, "0.0.0.0");
  app.enableShutdownHooks();
  Logger.log(`API listening on port ${port}`, "Bootstrap");
}

void bootstrap();
