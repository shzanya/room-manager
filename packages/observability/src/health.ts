import { createServer, type Server, type ServerResponse } from "node:http";

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
  const server = createServer(async (req, res) => {
    if (req.url === "/health") {
      await handleHealth(res, deps.checks);
    } else if (req.url === "/metrics") {
      await handleMetrics(res);
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
  res: ServerResponse,
  checks: Record<string, () => Promise<boolean>>,
): Promise<void> {
  const results: Record<string, boolean> = {};
  let isHealthy = true;

  for (const [name, check] of Object.entries(checks)) {
    try {
      results[name] = await check();
    } catch {
      results[name] = false;
    }
    isHealthy &&= results[name];
  }

  res.writeHead(isHealthy ? 200 : 503, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      status: isHealthy ? "healthy" : "degraded",
      checks: results,
      timestamp: new Date().toISOString(),
    }),
  );
}

async function handleMetrics(res: ServerResponse): Promise<void> {
  try {
    const metrics = await getMetrics();
    const contentType = await getMetricsContentType();

    res.writeHead(200, { "Content-Type": contentType });
    res.end(metrics);
  } catch {
    res.writeHead(500);
    res.end("Error collecting metrics");
  }
}

export function createHealthChecker(checks: Record<string, () => Promise<boolean>>) {
  return checks;
}
