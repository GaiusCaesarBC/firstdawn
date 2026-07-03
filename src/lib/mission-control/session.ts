export const MISSION_CONTROL_COOKIE_NAME = "first_dawn_mission_control";
export const MISSION_CONTROL_LOGIN_PATH = "/mission-control";
export const MISSION_CONTROL_DEFAULT_RETURN_PATH = "/worlds";
export const MISSION_CONTROL_SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

export const MISSION_CONTROL_PROTECTED_PREFIXES = [
  "/worlds",
  "/admin",
  "/developer",
  "/internal",
] as const;

type MissionControlEnvironment = {
  MISSION_CONTROL_KEY?: string;
  MISSION_CONTROL_REQUIRE_LOGIN?: string;
  NODE_ENV?: string;
};

type MissionControlSessionPayload = {
  access: "mission-control";
  expiresAt: number;
  issuedAt: number;
  roles: string[];
  subject: "internal";
  version: 1;
};

const SESSION_VERSION = "v1";
const ENCRYPTION_ALGORITHM = "AES-GCM";
const SESSION_CLOCK_SKEW_MS = 30_000;
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function getEnvironment(env: MissionControlEnvironment = process.env): MissionControlEnvironment {
  return env;
}

function getMissionControlKey(env?: MissionControlEnvironment): string | null {
  const key = getEnvironment(env).MISSION_CONTROL_KEY?.trim();
  return key ? key : null;
}

export function shouldBypassMissionControlInDevelopment(env?: MissionControlEnvironment): boolean {
  const environment = getEnvironment(env);
  return (
    environment.NODE_ENV === "development" &&
    environment.MISSION_CONTROL_REQUIRE_LOGIN !== "true"
  );
}

export function isMissionControlProtectedPath(pathname: string): boolean {
  return MISSION_CONTROL_PROTECTED_PREFIXES.some((prefix) =>
    pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function normalizeMissionControlReturnTo(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return MISSION_CONTROL_DEFAULT_RETURN_PATH;
  }

  try {
    const url = new URL(value, "https://first-dawn.local");
    return isMissionControlProtectedPath(url.pathname)
      ? `${url.pathname}${url.search}${url.hash}`
      : MISSION_CONTROL_DEFAULT_RETURN_PATH;
  } catch {
    return MISSION_CONTROL_DEFAULT_RETURN_PATH;
  }
}

function constantTimeEquals(left: string, right: string): boolean {
  const leftBytes = textEncoder.encode(left);
  const rightBytes = textEncoder.encode(right);
  const maxLength = Math.max(leftBytes.length, rightBytes.length);
  let difference = leftBytes.length ^ rightBytes.length;

  for (let index = 0; index < maxLength; index += 1) {
    difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }

  return difference === 0;
}

export function isMissionControlAccessKeyValid(
  accessKey: string,
  env?: MissionControlEnvironment,
): boolean {
  const configuredKey = getMissionControlKey(env);
  return Boolean(configuredKey) && constantTimeEquals(accessKey.trim(), configuredKey ?? "");
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

async function getSessionCryptoKey(secret: string): Promise<CryptoKey> {
  const digest = await crypto.subtle.digest("SHA-256", textEncoder.encode(secret));
  return crypto.subtle.importKey("raw", digest, ENCRYPTION_ALGORITHM, false, [
    "decrypt",
    "encrypt",
  ]);
}

function createSessionPayload(now = Date.now()): MissionControlSessionPayload {
  return {
    access: "mission-control",
    expiresAt: now + MISSION_CONTROL_SESSION_MAX_AGE_SECONDS * 1000,
    issuedAt: now,
    roles: ["administrator"],
    subject: "internal",
    version: 1,
  };
}

function isValidSessionPayload(value: unknown, now = Date.now()): value is MissionControlSessionPayload {
  if (!value || typeof value !== "object") {
    return false;
  }

  const payload = value as Partial<MissionControlSessionPayload>;

  return (
    payload.version === 1 &&
    payload.access === "mission-control" &&
    payload.subject === "internal" &&
    Array.isArray(payload.roles) &&
    typeof payload.issuedAt === "number" &&
    typeof payload.expiresAt === "number" &&
    payload.issuedAt <= now + SESSION_CLOCK_SKEW_MS &&
    payload.expiresAt > now
  );
}

export async function createMissionControlSessionCookie(
  env?: MissionControlEnvironment,
  now = Date.now(),
): Promise<string> {
  const secret = getMissionControlKey(env);

  if (!secret) {
    throw new Error("MISSION_CONTROL_KEY is required to create a Mission Control session.");
  }

  const key = await getSessionCryptoKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const payload = textEncoder.encode(JSON.stringify(createSessionPayload(now)));
  const encryptedPayload = await crypto.subtle.encrypt(
    { iv, name: ENCRYPTION_ALGORITHM },
    key,
    payload,
  );

  return [
    SESSION_VERSION,
    bytesToBase64Url(iv),
    bytesToBase64Url(new Uint8Array(encryptedPayload)),
  ].join(".");
}

export async function isMissionControlSessionCookieValid(
  cookieValue: string | undefined,
  env?: MissionControlEnvironment,
  now = Date.now(),
): Promise<boolean> {
  if (shouldBypassMissionControlInDevelopment(env)) {
    return true;
  }

  const secret = getMissionControlKey(env);

  if (!secret || !cookieValue) {
    return false;
  }

  const [version, encodedIv, encodedPayload] = cookieValue.split(".");

  if (version !== SESSION_VERSION || !encodedIv || !encodedPayload) {
    return false;
  }

  try {
    const key = await getSessionCryptoKey(secret);
    const iv = base64UrlToBytes(encodedIv);
    const encryptedPayload = base64UrlToBytes(encodedPayload);
    const decrypted = await crypto.subtle.decrypt(
      { iv, name: ENCRYPTION_ALGORITHM },
      key,
      encryptedPayload,
    );
    const payload = JSON.parse(textDecoder.decode(decrypted)) as unknown;

    return isValidSessionPayload(payload, now);
  } catch {
    return false;
  }
}
