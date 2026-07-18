import { buildServer } from "./server.js";

const port = parseInt(process.env.PAIRING_PORT ?? "7890", 10);
const server = buildServer();

const shutdown = async () => {
  await server.close();
  process.exit(0);
};
process.once("SIGTERM", () => void shutdown());
process.once("SIGINT",  () => void shutdown());

server.listen({ port, host: "0.0.0.0" }, (err) => {
  if (err) { console.error(err); process.exit(1); }
  console.log(`FieldFix daemon listening on http://0.0.0.0:${port}`);
  console.log(`  Dashboard : http://localhost:${port}/`);
  console.log(`  Pair phone: http://localhost:${port}/pair`);
});
