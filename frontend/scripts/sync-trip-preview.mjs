import { spawn } from "node:child_process";
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildTripPreviewFrameSrc,
  tripPreviewBasePath,
  tripPreviewDefaultHashRoute,
} from "../../shared/tripsync-preview-contract.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(__dirname, "..");
const workspaceRoot = path.resolve(frontendRoot, "..");
const defaultTripRoot = path.join(workspaceRoot, "trip");
const defaultSourceDistDir = path.join(defaultTripRoot, "dist");
const defaultTargetDir = path.join(frontendRoot, "public", "trip-app");

async function ensureDirectoryExists(dirPath) {
  const details = await stat(dirPath).catch(() => null);
  if (!details?.isDirectory()) {
    throw new Error(`Directory not found: ${dirPath}`);
  }
}

async function ensureFileExists(filePath) {
  const details = await stat(filePath).catch(() => null);
  if (!details?.isFile()) {
    throw new Error(`File not found: ${filePath}`);
  }
}

async function listFiles(rootDir, currentDir = rootDir) {
  const entries = await readdir(currentDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolutePath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(rootDir, absolutePath)));
      continue;
    }
    files.push(path.relative(rootDir, absolutePath).replaceAll("\\", "/"));
  }

  return files.sort();
}

export async function buildTripPreviewManifest({
  sourceRoot = defaultTripRoot,
  sourceDistDir = defaultSourceDistDir,
  appBasePath = tripPreviewBasePath,
  defaultHashRoute = tripPreviewDefaultHashRoute,
} = {}) {
  const packageJsonPath = path.join(sourceRoot, "package.json");
  const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));

  return {
    appBasePath,
    defaultHashRoute,
    frameSrc: buildTripPreviewFrameSrc(defaultHashRoute),
    sourceApp: packageJson.name ?? path.basename(sourceRoot),
    sourceVersion: packageJson.version ?? null,
    syncedAt: new Date().toISOString(),
    files: await listFiles(sourceDistDir),
  };
}

export async function syncTripPreview({
  sourceRoot = defaultTripRoot,
  sourceDistDir = defaultSourceDistDir,
  targetDir = defaultTargetDir,
  manifestFilename = "embed-manifest.json",
} = {}) {
  await ensureDirectoryExists(sourceRoot);
  await ensureDirectoryExists(sourceDistDir);
  await ensureFileExists(path.join(sourceDistDir, "index.html"));

  await rm(targetDir, { force: true, recursive: true });
  await mkdir(targetDir, { recursive: true });
  await cp(sourceDistDir, targetDir, { recursive: true });

  const manifest = await buildTripPreviewManifest({ sourceRoot, sourceDistDir });
  await writeFile(
    path.join(targetDir, manifestFilename),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );

  return manifest;
}

export async function runTripBuild(sourceRoot = defaultTripRoot) {
  const useShell = process.platform === "win32";
  const command = useShell ? "npm run build" : "npm";
  const args = useShell ? [] : ["run", "build"];

  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: sourceRoot,
      stdio: "inherit",
      shell: useShell,
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`Trip build failed with exit code ${code ?? "unknown"}`));
    });

    child.on("error", reject);
  });
}

async function main(argv) {
  const shouldBuild = argv.includes("--build");
  if (shouldBuild) {
    await runTripBuild();
  }

  const manifest = await syncTripPreview();
  console.log(
    `Synced ${manifest.sourceApp}@${manifest.sourceVersion ?? "unknown"} to ${defaultTargetDir}`,
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
