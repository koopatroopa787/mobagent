// Entry point for the FieldFix daemon.
//
// Phase 0: starts the Fastify server and a placeholder
// /test-completion route that forwards to LiteLLM.
//
// See docs/ROADMAP.md Phase 0 for what to build here first.

import { buildServer } from "./server.js";

const server = buildServer();

server.listen({ port: 7890 }, (err, address) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`FieldFix daemon listening at ${address}`);
});
