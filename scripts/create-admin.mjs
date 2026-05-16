import { execSync } from "node:child_process";
import crypto from "node:crypto";

const ALGO = "sha256";
const ITERATIONS = 100_000;
const KEYLEN = 32;

function toHex(bytes) {
  return Buffer.from(bytes).toString("hex");
}

function usage() {
  console.error("Usage: pnpm create-admin [--remote] <username> <password> <fullName>");
  process.exit(1);
}

const remoteIdx = process.argv.indexOf("--remote");
const isRemote = remoteIdx !== -1;
if (isRemote) process.argv.splice(remoteIdx, 1);

const username = process.argv[2];
const password = process.argv[3];
const fullName = process.argv[4];

if (!username || !password || !fullName) usage();

const normalized = username.trim().toLowerCase();

if (!/^(?=.{3,32}$)[a-z0-9](?:[a-z0-9._-]*[a-z0-9])$/.test(normalized)) {
  console.error("Error: username must be 3-32 chars, start/end with a lowercase letter or number, and only use lowercase letters, numbers, dots, underscores, or hyphens");
  process.exit(1);
}

if (password.length < 8) {
  console.error("Error: password must be at least 8 characters");
  process.exit(1);
}

if (!fullName.trim()) {
  console.error("Error: full name is required");
  process.exit(1);
}

const salt = crypto.randomBytes(16).toString("hex");
const saltBytes = Buffer.from(salt, "hex");
const passwordHash = toHex(crypto.pbkdf2Sync(password, saltBytes, ITERATIONS, KEYLEN, ALGO));

const payload = JSON.stringify({
  fullName: fullName.trim(),
  role: "admin",
  allowedGroups: ["Adams Family"],
  passwordHash,
  salt,
});

const remoteFlag = isRemote ? " --remote" : "";

console.log(`Creating admin user: ${normalized}`);
execSync(
  `npx wrangler kv key put --binding SESSION "user:${normalized}" '${payload}'${remoteFlag}`,
  { stdio: "inherit" }
);

console.log(`Admin user "${normalized}" created successfully.`);
