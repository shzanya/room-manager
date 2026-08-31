import type { Server } from "node:http";

import { getMetrics, getMetricsContentType } from "./metrics";

export interface HealthServerDeps {
  port: number;
  logger: {
    info: (msg: string) => void;
    error: (msg: string, err?: unknown) => void;
  };
  checks: Record<string, () => Promise<boolean>>;
}

export function startHealthServer(deps: HealthServerDeps): Server {
  const http = require("node:http");

  const server = http.createServer(async (req, res) => {
    if (req.url === "/health") {
      await handleHealth(req, res, deps.checks);
    } else if (req.url === "/metrics") {
      await handleMetrics(req, res);
    } else {
      res.writeHead(404);
      res.end("Not Found");
    }
  });

  server.listen(deps.port, () => {
    deps.logger.info(`Health server listening on :${deps.port}`);
  });

  return server;
}

async function handleHealth(
  req: unknown,
  res: { writeHead: (code: number, headers?: Record<string, string>) => void; end: (body: string) => void },
  checks: Record<string, () => Promise<boolean>>,
): Promise<void> {
  const results: Record<string, boolean> = {};
  let allHealthy = true;

  for (const [name, check] of Object.entries(checks)) {
    try {
      results[name] = await check();
    } catch {
      results[name] = false;
      allHealthy = false;
    }
  }

  const statusCode = allHealthy ? 200 : 503;

  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      status: allHealthy ? "healthy" : "degraded",
      checks: results,
      timestamp: new Date().toISOString(),
    }),
  );
}

async function handleMetrics(
  req: unknown,
  res: { writeHead: (code: number, headers?: Record<string, string>) => void; end: (body: string) => void },
): Promise<void> {
  try {
    const metrics = await getMetrics();
    const contentType = await getMetricsContentType();

    res.writeHead(200, { "Content-Type": contentType });
    res.end(metrics);
  } catch (err) {
    res.writeHead(500);
    res.end("Error collecting metrics");
  }
}

export function createHealthChecker(checks: Record<string, () => Promise<boolean>>) {
  return checks;
}
