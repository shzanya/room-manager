import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";

const root = process.cwd();

const directories = [
  "apps/bot/src/commands",
  "apps/bot/src/interactions",
  "apps/bot/src/events",
  "apps/bot/src/handlers",

  "apps/api/src/routes",
  "apps/api/src/plugins",
  "apps/api/src/middleware",
  "apps/api/src/websocket",

  "apps/dashboard/src/components",
  "apps/dashboard/src/pages",
  "apps/dashboard/src/features",
  "apps/dashboard/src/hooks",
  "apps/dashboard/src/lib",

  "packages/core/src/rooms",
  "packages/core/src/guilds",
  "packages/core/src/permissions",
  "packages/core/src/policies",
  "packages/core/src/events",

  "packages/database/src/schema",
  "packages/database/src/repositories",
  "packages/database/src/migrations",

  "packages/config/src",
  "packages/logger/src",

  "packages/contracts/src",
  "packages/shared/src/errors",
  "packages/shared/src/types",
  "packages/shared/src/constants",

  "tests/unit/rooms",
  "tests/unit/permissions",
  "tests/unit/policies",
  "tests/integration/database",
  "tests/integration/rooms",
  "tests/e2e",

  "docs/architecture",
  "docs/configuration",
  "docs/development",
  "docs/deployment",

  ".github/workflows",
  ".github/ISSUE_TEMPLATE",

  "docker",
  "drizzle",
];

const files = [
  "apps/bot/src/discord.ts",
  "apps/bot/src/index.ts",

  "apps/api/src/index.ts",

  "apps/dashboard/src/main.tsx",

  "packages/core/src/index.ts",

  "packages/database/src/client.ts",
  "packages/database/src/index.ts",

  "packages/config/src/env.ts",
  "packages/config/src/schema.ts",
  "packages/config/src/index.ts",

  "packages/logger/src/logger.ts",
  "packages/logger/src/index.ts",

  "packages/contracts/src/rooms.ts",
  "packages/contracts/src/guilds.ts",
  "packages/contracts/src/index.ts",

  "packages/shared/src/index.ts",

  "tests/e2e/.gitkeep",

  "drizzle/.gitkeep",

  ".github/workflows/ci.yml",
  ".github/workflows/release.yml",
  ".github/workflows/codeql.yml",
  ".github/pull_request_template.md",

  "docker/bot.Dockerfile",
  "docker/api.Dockerfile",

  ".env.example",
  ".gitignore",
  "biome.json",
  "bunfig.toml",
  "drizzle.config.ts",
  "docker-compose.yml",
  "package.json",
  "tsconfig.json",
  "turbo.json",

  "LICENSE",
  "README.md",
  "CONTRIBUTING.md",
  "SECURITY.md",
  "CODE_OF_CONDUCT.md",
];

for (const directory of directories) {
  await mkdir(join(root, directory), { recursive: true });
}

for (const file of files) {
  const path = join(root, file);

  await mkdir(dirname(path), { recursive: true });

  try {
    await Bun.write(path, "");
  } catch {
    // File may already exist.
  }
}

console.log("✓ Room Manager structure created");
console.log(`✓ ${directories.length} directories`);
console.log(`✓ ${files.length} files`);
