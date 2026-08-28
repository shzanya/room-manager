import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();

const packages = [
  {
    name: "@room-manager/core",
    path: "packages/core",
  },
  {
    name: "@room-manager/shared",
    path: "packages/shared",
  },
  {
    name: "@room-manager/contracts",
    path: "packages/contracts",
  },
  {
    name: "@room-manager/config",
    path: "packages/config",
  },
  {
    name: "@room-manager/logger",
    path: "packages/logger",
  },
  {
    name: "@room-manager/database",
    path: "packages/database",
  },
];

const apps = [
  {
    name: "@room-manager/bot",
    path: "apps/bot",
  },
  {
    name: "@room-manager/api",
    path: "apps/api",
  },
  {
    name: "@room-manager/dashboard",
    path: "apps/dashboard",
  },
];

type PackageJson = {
  name?: string;
  private?: boolean;
  type?: string;
  scripts?: Record<string, string>;
  exports?: Record<string, string>;
};

function createPackageJson(name: string): PackageJson {
  return {
    name,
    private: true,
    type: "module",
    scripts: {
      typecheck: "tsc --noEmit",
    },
    exports: {
      ".": "./src/index.ts",
    },
  };
}

function createAppPackageJson(name: string): PackageJson {
  return {
    name,
    private: true,
    type: "module",
    scripts: {
      typecheck: "tsc --noEmit",
    },
  };
}

async function writeWorkspace(
  name: string,
  relativePath: string,
  isApp = false,
): Promise<void> {
  const directory = join(root, relativePath);
  const packagePath = join(directory, "package.json");

  await mkdir(directory, {
    recursive: true,
  });

  let packageJson: PackageJson;

  try {
    const existing = await Bun.file(packagePath).json();

    packageJson = {
      ...existing,
      name,
      private: true,
      type: "module",
      scripts: {
        ...existing.scripts,
        typecheck: "tsc --noEmit",
      },
    };
  } catch {
    packageJson = isApp ? createAppPackageJson(name) : createPackageJson(name);
  }

  if (!isApp) {
    packageJson.exports ??= {
      ".": "./src/index.ts",
    };
  }

  await Bun.write(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);

  console.log(`✓ ${name}`);
}

console.log("Setting up Room Manager workspaces...\n");

for (const pkg of packages) {
  await writeWorkspace(pkg.name, pkg.path);
}

console.log();

for (const app of apps) {
  await writeWorkspace(app.name, app.path, true);
}

console.log("\n✓ Workspace packages configured");
console.log("✓ Typecheck scripts configured");
