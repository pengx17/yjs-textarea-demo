import Fastify, { FastifyInstance, RouteShorthandOptions } from "fastify";
import { Server, IncomingMessage, ServerResponse } from "http";
import { Buffer } from 'node:buffer'

const server: FastifyInstance = Fastify({});

import "./db";
import { addUpdate, getDoc, getUpdates } from "./db";

server.get("/updates", async (request, reply) => {
  console.log(await getUpdates());
  return { rows: await getUpdates() };
});

server.get("/doc", async (request, reply) => {
  const doc = await getDoc();
  reply.type("application/octet-stream");
  reply.send(Buffer.from(doc));
});

server.post("/updates", async (request, reply) => {
  const data = JSON.parse(request.body as string);
  let buf = Buffer.from(data);
  await addUpdate(buf as any);
  return { success: true };
});

const start = async () => {
  try {
    await server.listen({ port: 3000 });

    const address = server.server.address();
    const port = typeof address === "string" ? address : address?.port;
    console.log(`Server listening on port ${port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
