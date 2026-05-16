import { env } from "cloudflare:workers";

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
  return usersKv().get<StoredUser>(userKey(username), "json");
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

  const session = await usersKv().get<SessionUser>(sessionKey(token), "json");
  if (!session) return null;

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
  allowedGroups: string[] | undefined;
}

export async function listUsers(): Promise<UserSummary[]> {
  const keys = await usersKv().list({ prefix: USER_PREFIX });
  const users = await Promise.all(
    keys.keys.map(async ({ name }) => {
      const record = await usersKv().get<StoredUser>(name, "json");
      if (!record) return null;
      const groups = Array.isArray(record.allowedGroups) ? record.allowedGroups : ["default"];
      return { username: name.slice(USER_PREFIX.length), fullName: record.fullName, role: record.role, allowedGroups: groups };
    })
  );

  return users
    .filter((u): u is UserSummary => u !== null)
    .sort((a, b) => a.username.localeCompare(b.username));
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
  const user = await getStoredUser(normalized);
  if (!user) return { ok: false, error: "user not found" };
  if (!allowedGroups || allowedGroups.length === 0) return { ok: false, error: "at least one allowed group is required" };

  const updated: StoredUser = { ...user, allowedGroups };
  await usersKv().put(userKey(normalized), JSON.stringify(updated));
  return { ok: true };
}

export async function deleteUser(username: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const normalized = normalizeUsername(username);

  const storedUser = await getStoredUser(normalized);
  if (!storedUser) return { ok: false, error: "user not found" };
  if (storedUser.role === "admin") return { ok: false, error: "cannot delete admin user" };

  const key = userKey(normalized);
  await usersKv().delete(key);

  const sessions = await usersKv().list({ prefix: SESSION_PREFIX });
  await Promise.all(
    sessions.keys.map(async ({ name }) => {
      const session = await usersKv().get<SessionUser>(name, "json");
      if (session?.username === normalized) {
        await usersKv().delete(name);
      }
    })
  );

  return { ok: true };
}
