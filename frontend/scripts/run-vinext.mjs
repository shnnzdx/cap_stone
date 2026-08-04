import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const command = process.argv[2];

if (!command) {
  console.error("Usage: node scripts/run-vinext.mjs <dev|build|start> [...args]");
  process.exit(1);
}

const cliPath = path.join(rootDir, "node_modules", "vinext", "dist", "cli.js");

if (!existsSync(cliPath)) {
  console.error("vinext CLI not found. Run an install first.");
  process.exit(1);
}

const child = spawn(
  process.execPath,
  [cliPath, command, ...process.argv.slice(3)],
  {
    cwd: rootDir,
    stdio: "inherit",
    env: {
      ...process.env,
      WRANGLER_LOG_PATH: process.env.WRANGLER_LOG_PATH ?? ".wrangler/wrangler.log",
    },
  },
);

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});

