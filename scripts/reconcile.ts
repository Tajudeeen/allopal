import { setTimeout } from "node:timers/promises";
import { reconcileBatch } from "../lib/payments/lifecycle";
import { prisma } from "../lib/db/prisma";
const shutdown = new AbortController();
process.once("SIGTERM", () => shutdown.abort());
process.once("SIGINT", () => shutdown.abort());
async function main() {
  do {
    const checked = await reconcileBatch();
    console.log(
      JSON.stringify({
        event: "reconciliation_complete",
        checked,
        timestamp: new Date().toISOString(),
      }),
    );
    if (process.argv.includes("--once")) break;
    await setTimeout(30_000, undefined, { signal: shutdown.signal }).catch(
      () => undefined,
    );
  } while (!shutdown.signal.aborted);
}
main()
  .catch(() => {
    console.error(
      "Reconciliation worker failed. Reservations are retained for the next run.",
    );
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
