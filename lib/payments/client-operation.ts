const PREFIX = "allopal:operation:";
type Entry = { key: string; attemptId?: string };
export function operationKey(scope: string) {
  const stored = sessionStorage.getItem(PREFIX + scope);
  if (stored) return (JSON.parse(stored) as Entry).key;
  const key = crypto.randomUUID();
  sessionStorage.setItem(PREFIX + scope, JSON.stringify({ key }));
  return key;
}
export function rememberOperation(
  scope: string,
  result: { status?: string; attemptId?: string },
) {
  if (
    [
      "COMPLETED",
      "DENIED",
      "CANCELLED",
      "FAILED",
      "REFUNDED",
      "REVERSED",
    ].includes(result.status || "")
  )
    sessionStorage.removeItem(PREFIX + scope);
  else {
    const stored = sessionStorage.getItem(PREFIX + scope);
    if (stored && result.attemptId)
      sessionStorage.setItem(
        PREFIX + scope,
        JSON.stringify({ ...JSON.parse(stored), attemptId: result.attemptId }),
      );
  }
}
export function clearSettledOperations(
  transactions: Array<{ id: string; status: string }>,
) {
  const terminalIds = new Set(
    transactions
      .filter((t) =>
        ["COMPLETED", "FAILED", "CANCELLED", "REFUNDED", "REVERSED"].includes(
          t.status,
        ),
      )
      .map((t) => t.id),
  );
  for (const name of Object.keys(sessionStorage)) {
    if (!name.startsWith(PREFIX)) continue;
    try {
      if (
        terminalIds.has(
          JSON.parse(sessionStorage.getItem(name) || "{}").attemptId,
        )
      )
        sessionStorage.removeItem(name);
    } catch {
      sessionStorage.removeItem(name);
    }
  }
}
