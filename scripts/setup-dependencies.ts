import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();

const dependencies: Record<string, Record<string, string>> = {
  "packages/core": {
    "@room-manager/shared": "workspace:*",
    "@room-manager/contracts": "workspace:*",
  },

  "packages/database": {
    "@room-manager/config": "workspace:*",
    "@room-manager/shared": "workspace:*",
  },

  "packages/logger": {
    "@room-manager/config": "workspace:*",
    "@room-manager/shared": "workspace:*",
  },

  "packages/contracts": {
    "@room-manager/shared": "workspace:*",
  },

  "apps/bot": {
    "@room-manager/core": "workspace:*",
    "@room-manager/database": "workspace:*",
    "@room-manager/config": "workspace:*",
    "@room-manager/logger": "workspace:*",
    "@room-manager/contracts": "workspace:*",
    "@room-manager/shared": "workspace:*",
  },

  "apps/api": {
    "@room-manager/core": "workspace:*",
    "@room-manager/database": "workspace:*",
    "@room-manager/config": "workspace:*",
    "@room-manager/logger": "workspace:*",
    "@room-manager/contracts": "workspace:*",
    "@room-manager/shared": "workspace:*",
  },

  "apps/dashboard": {
    "@room-manager/contracts": "workspace:*",
    "@room-manager/shared": "workspace:*",
  },
};

for (const [relativePath, packageDependencies] of Object.entries(dependencies)) {
  const packagePath = join(root, relativePath, "package.json");

  const packageJson = JSON.parse(await readFile(packagePath, "utf8"));

  packageJson.dependencies = {
    ...packageJson.dependencies,
    ...packageDependencies,
  };

  await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);

  console.log(`✓ ${packageJson.name}`);
}

console.log("\n✓ Internal workspace dependencies configured");
