/**
 * Lightweight performance logging for API routes.
 * Enable by setting PERF_LOG=1 in environment.
 * Usage:
 *   const end = perfStart("GET /api/agents");
 *   // ... do work
 *   end(data?.length);  // logs: [Perf] GET /api/agents: 12ms, rows: 5
 */

const enabled = process.env.PERF_LOG === "1";

export function perfStart(label: string): (rows?: number) => void {
  if (!enabled) return () => {};
  const start = Date.now();
  return (rows?: number) => {
    const ms = Date.now() - start;
    const rowStr = rows !== undefined ? `, rows: ${rows}` : "";
    console.log(`[Perf] ${label}: ${ms}ms${rowStr}`);
  };
}

export function perfQuery(label: string): (rows?: number) => void {
  if (!enabled) return () => {};
  const start = Date.now();
  return (rows?: number) => {
    const ms = Date.now() - start;
    const rowStr = rows !== undefined ? `, rows: ${rows}` : "";
    console.log(`[Perf]   query ${label}: ${ms}ms${rowStr}`);
  };
}
