import { env } from "cloudflare:workers";
import { storedUserSchema, sessionUserSchema } from "./validation";

export const AUTH_COOKIE = "auth_session";

const USER_PREFIX = "user:";
const SESSION_PREFIX = "session:";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
const PASSWORD_ITERATIONS = 100_000;
const PASSWORD_HASH_ALGO = "PBKDF2";
const PASSWORD_DIGEST = "SHA-256";
const MAX_PASSWORD_LENGTH = 128;

export interface SessionUser {
  username: string;
  fullName: string;
  role: "admin" | "user";
  allowedGroups: string[];
}

interface StoredUser {
  fullName: string;
  role: "admin" | "user";
  allowedGroups: string[];
  passwordHash: string;
  salt: string;
}

const encoder = new TextEncoder();

const usersKv = () => env.SESSION;

function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

function userKey(username: string): string {
  return `${USER_PREFIX}${normalizeUsername(username)}`;
}

function sessionKey(token: string): string {
  return `${SESSION_PREFIX}${token}`;
}

function getCookieValue(request: Request, key: string): string | null {
  const cookie = request.headers.get("cookie") ?? "";
  const found = cookie.split(";").find((c) => c.trim().startsWith(`${key}=`));
  if (!found) return null;
  const [, value = ""] = found.trim().split("=");
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function isKvRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function resolveDisplayName(value: unknown, username: string): string {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  return normalizeUsername(username);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

function validateUsername(username: string): boolean {
  return /^(?=.{3,32}$)[a-z0-9](?:[a-z0-9._-]*[a-z0-9])$/.test(username);
}

async function hashPassword(password: string, saltHex: string): Promise<string> {
  if (!/^[a-f0-9]{32}$/.test(saltHex)) {
    throw new Error("invalid password salt: expected 32-character hexadecimal string");
  }

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    PASSWORD_HASH_ALGO,
    false,
    ["deriveBits"]
  );
  const saltBytes = Uint8Array.from((saltHex.match(/.{1,2}/g) ?? []).map((hex) => parseInt(hex, 16)));
  const bits = await crypto.subtle.deriveBits(
    { name: PASSWORD_HASH_ALGO, salt: saltBytes, iterations: PASSWORD_ITERATIONS, hash: PASSWORD_DIGEST },
    keyMaterial,
    256
  );
  return toHex(new Uint8Array(bits));
}

async function getStoredUser(username: string): Promise<StoredUser | null> {
  const raw = await usersKv().get(userKey(username), "json");
  if (!isKvRecord(raw)) return null;
  const parsed = storedUserSchema.safeParse(raw);
  if (parsed.success) return parsed.data;

  const fallback = raw as {
    fullName?: unknown;
    role?: unknown;
    allowedGroups?: unknown;
    passwordHash?: unknown;
    salt?: unknown;
  };

  if (typeof fallback.passwordHash !== "string" || typeof fallback.salt !== "string") {
    return null;
  }

  const fallbackGroups = Array.isArray(fallback.allowedGroups)
    ? fallback.allowedGroups.filter((group): group is string => typeof group === "string" && group.trim().length > 0)
    : [];

  return {
    fullName: resolveDisplayName(fallback.fullName, username),
    role: fallback.role === "admin" ? "admin" : "user",
    allowedGroups: fallbackGroups.length > 0 ? fallbackGroups : ["default"],
    passwordHash: fallback.passwordHash,
    salt: fallback.salt,
  };
}

function normalizeUserSummary(raw: unknown, username: string): UserSummary | null {
  if (!isKvRecord(raw)) return null;
  const record = raw as { fullName?: unknown; role?: unknown; allowedGroups?: unknown };

  const fullName = resolveDisplayName(record.fullName, username);
  const role: "admin" | "user" = record.role === "admin" ? "admin" : "user";
  const allowedGroups = Array.isArray(record.allowedGroups)
    ? record.allowedGroups.filter((group): group is string => typeof group === "string" && group.trim().length > 0)
    : [];

  return {
    username: normalizeUsername(username),
    fullName,
    role,
    allowedGroups: allowedGroups.length > 0 ? allowedGroups : ["default"],
  };
}

export async function authenticateUser(username: string, password: string): Promise<SessionUser | null> {
  const normalized = normalizeUsername(username);
  const user = await getStoredUser(normalized);
  if (!user) return null;

  const passwordHash = await hashPassword(password, user.salt);
  if (!timingSafeEqual(passwordHash, user.passwordHash)) return null;

  return {
    username: normalized,
    fullName: user.fullName,
    role: user.role,
    allowedGroups: Array.isArray(user.allowedGroups) ? user.allowedGroups : ["default"],
  };
}

export async function createSession(user: SessionUser): Promise<string> {
  const token = crypto.randomUUID();
  await usersKv().put(sessionKey(token), JSON.stringify(user), { expirationTtl: SESSION_TTL_SECONDS });
  return token;
}

export async function destroySession(token: string): Promise<void> {
  await usersKv().delete(sessionKey(token));
}

export async function getSessionFromRequest(request: Request): Promise<SessionUser | null> {
  const token = getCookieValue(request, AUTH_COOKIE);
  if (!token) return null;

  const raw = await usersKv().get(sessionKey(token), "json");
  if (!raw) return null;
  const sessionParsed = sessionUserSchema.safeParse(raw);
  if (!sessionParsed.success) {
    await destroySession(token);
    return null;
  }
  const session = sessionParsed.data;

  const user = await getStoredUser(session.username);
  if (!user) {
    await destroySession(token);
    return null;
  }

  return { ...session, role: user.role, allowedGroups: Array.isArray(user.allowedGroups) ? user.allowedGroups : ["default"] };
}

export async function isAuthenticated(request: Request): Promise<boolean> {
  const session = await getSessionFromRequest(request);
  return session !== null;
}

export function isAdminUser(user: SessionUser): boolean {
  return user.role === "admin";
}

export function buildAuthSetCookie(token: string): string {
  return `${AUTH_COOKIE}=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax; Secure; Max-Age=${SESSION_TTL_SECONDS}`;
}

export function buildAuthClearCookie(): string {
  return `${AUTH_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Secure; Max-Age=0`;
}

export interface UserSummary {
  username: string;
  fullName: string;
  role: "admin" | "user";
  allowedGroups: string[];
}

export async function listUsers(): Promise<UserSummary[]> {
  const keyNames: string[] = [];
  let cursor: string | undefined;

  do {
    const page = await usersKv().list({ prefix: USER_PREFIX, cursor });
    keyNames.push(...page.keys.map((key: { name: string }) => key.name));
    if (page.list_complete) break;
    cursor = page.cursor;
  } while (true);

  const users = await Promise.all(
    keyNames.map(async (keyName: string) => {
      const raw = await usersKv().get(keyName, "json");
      const username = keyName.slice(USER_PREFIX.length);
      return normalizeUserSummary(raw, username);
    })
  );

  return users
    .filter((u): u is UserSummary => u !== null)
    .sort((a: UserSummary, b: UserSummary) => a.username.localeCompare(b.username));
}

async function listSessionKeys(): Promise<string[]> {
  const keyNames: string[] = [];
  let cursor: string | undefined;

  do {
    const page = await usersKv().list({ prefix: SESSION_PREFIX, cursor });
    keyNames.push(...page.keys.map((key: { name: string }) => key.name));
    if (page.list_complete) break;
    cursor = page.cursor;
  } while (true);

  return keyNames;
}

async function invalidateUserSessions(username: string): Promise<void> {
  const normalized = normalizeUsername(username);
  const sessionKeys = await listSessionKeys();
  await Promise.all(
    sessionKeys.map(async (sessionKeyName: string) => {
      const rawSession = await usersKv().get(sessionKeyName, "json");
      if (!rawSession) return;
      const parsed = sessionUserSchema.safeParse(rawSession);
      if (parsed.success && parsed.data.username === normalized) {
        await usersKv().delete(sessionKeyName);
      }
    })
  );
}

export async function createUser(
  username: string,
  password: string,
  fullName: string,
  allowedGroups: string[],
  role: "admin" | "user" = "user"
): Promise<{ ok: true } | { ok: false; error: string }> {
  const normalized = normalizeUsername(username);
  const trimmedFullName = fullName.trim();

  if (!validateUsername(normalized)) {
    return {
      ok: false,
      error: "username must be 3-32 chars, start/end with a lowercase letter or number, and only use lowercase letters, numbers, dots, underscores, or hyphens",
    };
  }
  if (password.length < 8) return { ok: false, error: "password must be at least 8 characters" };
  if (password.length > MAX_PASSWORD_LENGTH) {
    return { ok: false, error: `password must be ${MAX_PASSWORD_LENGTH} characters or fewer` };
  }
  if (!trimmedFullName) return { ok: false, error: "full name is required" };
  if (!allowedGroups || allowedGroups.length === 0) return { ok: false, error: "at least one allowed group is required" };

  const key = userKey(normalized);
  const existing = await usersKv().get(key);
  if (existing) return { ok: false, error: "username already exists" };

  const saltBytes = new Uint8Array(16);
  crypto.getRandomValues(saltBytes);
  const salt = toHex(saltBytes);
  const passwordHash = await hashPassword(password, salt);

  const payload: StoredUser = {
    fullName: trimmedFullName,
    passwordHash,
    salt,
    role,
    allowedGroups,
  };

  await usersKv().put(key, JSON.stringify(payload));
  return { ok: true };
}

export async function updateUserGroups(
  username: string,
  allowedGroups: string[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  const normalized = normalizeUsername(username);
  const stored = await getStoredUser(normalized);
  if (!stored) return { ok: false, error: "user not found or record is invalid" };
  if (!allowedGroups || allowedGroups.length === 0) return { ok: false, error: "at least one allowed group is required" };

  const updated: StoredUser = { ...stored, allowedGroups };
  await usersKv().put(userKey(normalized), JSON.stringify(updated));
  return { ok: true };
}

export async function resetUserPassword(
  username: string,
  password: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const normalized = normalizeUsername(username);
  if (password.length < 8) return { ok: false, error: "password must be at least 8 characters" };
  if (password.length > MAX_PASSWORD_LENGTH) {
    return { ok: false, error: `password must be ${MAX_PASSWORD_LENGTH} characters or fewer` };
  }

  const user = normalizeUserSummary(await usersKv().get(userKey(normalized), "json"), normalized);
  if (!user) return { ok: false, error: "user not found" };

  const saltBytes = new Uint8Array(16);
  crypto.getRandomValues(saltBytes);
  const salt = toHex(saltBytes);
  const passwordHash = await hashPassword(password, salt);

  const updated: StoredUser = {
    fullName: user.fullName,
    role: user.role,
    allowedGroups: user.allowedGroups,
    passwordHash,
    salt,
  };
  await usersKv().put(userKey(normalized), JSON.stringify(updated));
  await invalidateUserSessions(normalized);

  return { ok: true };
}

export async function deleteUser(username: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const normalized = normalizeUsername(username);

  const storedUser = await getStoredUser(normalized);
  if (!storedUser) return { ok: false, error: "user not found" };
  if (storedUser.role === "admin") return { ok: false, error: "cannot delete admin user" };

  const key = userKey(normalized);
  await usersKv().delete(key);
  await invalidateUserSessions(normalized);

  return { ok: true };
}
