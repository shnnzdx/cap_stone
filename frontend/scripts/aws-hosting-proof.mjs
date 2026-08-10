import { access, readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(frontendRoot, "..");

const expectedStaticHtml = [
  "index.html",
  "login/index.html",
  "product/index.html",
  "how-it-works/index.html",
  "trip/index.html",
];

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function listFiles(rootDir, currentDir = rootDir) {
  const entries = await readdir(currentDir, { withFileTypes: true }).catch(() => []);
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

async function main() {
  const packageJson = JSON.parse(
    await readFile(path.join(frontendRoot, "package.json"), "utf8"),
  );
  const clientDir = path.join(frontendRoot, "dist", "client");
  const serverDir = path.join(frontendRoot, "dist", "server");
  const tripManifestPath = path.join(clientDir, "trip-app", "embed-manifest.json");

  const clientExists = (await stat(clientDir).catch(() => null))?.isDirectory() ?? false;
  const serverExists = (await stat(serverDir).catch(() => null))?.isDirectory() ?? false;
  const clientFiles = clientExists ? await listFiles(clientDir) : [];
  const missingStaticHtml = [];

  for (const relativePath of expectedStaticHtml) {
    if (!(await exists(path.join(clientDir, relativePath)))) {
      missingStaticHtml.push(relativePath);
    }
  }

  const tripManifest = (await exists(tripManifestPath))
    ? JSON.parse(await readFile(tripManifestPath, "utf8"))
    : null;

  const result = {
    frontendRoot: path.relative(repoRoot, frontendRoot).replaceAll("\\", "/"),
    frameworkSignals: {
      vinext: packageJson.devDependencies?.vinext ?? null,
      next: packageJson.dependencies?.next ?? null,
      nodeEngine: packageJson.engines?.node ?? null,
    },
    buildOutput: {
      clientDir: clientExists,
      serverDir: serverExists,
      clientHtmlFiles: clientFiles.filter((file) => file.endsWith(".html")),
      missingStaticHtml,
      embeddedTripManifest: Boolean(tripManifest),
      embeddedTripFiles: tripManifest?.files ?? [],
    },
    conclusion: {
      staticOnlyHostingReady: missingStaticHtml.length === 0 && !serverExists,
      requiresSsrCompute: serverExists || missingStaticHtml.length > 0,
      recommendedAwsProofPath:
        serverExists || missingStaticHtml.length > 0
          ? "SSR compute compatibility proof required before choosing Amplify Hosting."
          : "Static hosting proof can proceed with S3/CloudFront style assets.",
    },
  };

  console.log(JSON.stringify(result, null, 2));

  if (!clientExists) {
    console.error("frontend/dist/client is missing. Run npm run build first.");
    process.exit(1);
  }

  if (!tripManifest) {
    console.error("Embedded trip manifest is missing from dist/client/trip-app.");
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
