import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(moduleDir, "..");

const envFiles = [path.join(backendRoot, ".env"), path.resolve(process.cwd(), ".env")];

envFiles.forEach((envPath) => {
  if (fs.existsSync(envPath)) {
    loadEnv({ path: envPath, override: false });
  }
});
