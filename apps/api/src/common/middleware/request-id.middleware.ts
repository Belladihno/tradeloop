import { FastifyInstance, FastifyRequest } from "fastify";
import { nanoid } from "nanoid";

declare module "fastify" {
  interface FastifyRequest {
    requestId?: string;
    rawBody?: Buffer;
  }
}

export function registerRequestIdHook(instance: FastifyInstance): void {
  instance.addHook("onRequest", (request: FastifyRequest, reply, done) => {
    request.requestId = nanoid();
    void reply.header("X-Request-Id", request.requestId);
    done();
  });
}
