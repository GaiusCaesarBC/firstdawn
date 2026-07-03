import { describe, expect, it } from "vitest";

import {
  createMissionControlSessionCookie,
  isMissionControlAccessKeyValid,
  isMissionControlProtectedPath,
  isMissionControlSessionCookieValid,
  MISSION_CONTROL_SESSION_MAX_AGE_SECONDS,
  normalizeMissionControlReturnTo,
  shouldBypassMissionControlInDevelopment,
} from "../../src/lib/mission-control/session";

const testEnv = {
  MISSION_CONTROL_KEY: "test-access-key",
  NODE_ENV: "production",
};

describe("Mission Control access", () => {
  it("protects internal route families only", () => {
    expect(isMissionControlProtectedPath("/worlds")).toBe(true);
    expect(isMissionControlProtectedPath("/worlds/map")).toBe(true);
    expect(isMissionControlProtectedPath("/admin")).toBe(true);
    expect(isMissionControlProtectedPath("/developer/tools")).toBe(true);
    expect(isMissionControlProtectedPath("/internal/diagnostics")).toBe(true);

    expect(isMissionControlProtectedPath("/")).toBe(false);
    expect(isMissionControlProtectedPath("/world")).toBe(false);
    expect(isMissionControlProtectedPath("/about")).toBe(false);
    expect(isMissionControlProtectedPath("/worlds-public")).toBe(false);
  });

  it("allows development bypass unless login is explicitly required", () => {
    expect(shouldBypassMissionControlInDevelopment({ NODE_ENV: "development" })).toBe(true);
    expect(
      shouldBypassMissionControlInDevelopment({
        MISSION_CONTROL_REQUIRE_LOGIN: "true",
        NODE_ENV: "development",
      }),
    ).toBe(false);
    expect(shouldBypassMissionControlInDevelopment({ NODE_ENV: "production" })).toBe(false);
  });

  it("validates the configured access key without accepting blanks", () => {
    expect(isMissionControlAccessKeyValid("test-access-key", testEnv)).toBe(true);
    expect(isMissionControlAccessKeyValid("wrong-key", testEnv)).toBe(false);
    expect(isMissionControlAccessKeyValid("", { NODE_ENV: "production" })).toBe(false);
  });

  it("stores an encrypted authenticated session cookie", async () => {
    const now = Date.UTC(2026, 0, 1);
    const cookie = await createMissionControlSessionCookie(testEnv, now);

    expect(cookie).toMatch(/^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(cookie).not.toContain("test-access-key");
    expect(await isMissionControlSessionCookieValid(cookie, testEnv, now)).toBe(true);
  });

  it("rejects tampered and expired session cookies", async () => {
    const now = Date.UTC(2026, 0, 1);
    const cookie = await createMissionControlSessionCookie(testEnv, now);
    const [version, iv, encryptedPayload] = cookie.split(".");
    const replacement = encryptedPayload.startsWith("A") ? "B" : "A";
    const tamperedCookie = `${version}.${iv}.${replacement}${encryptedPayload.slice(1)}`;
    const expiredNow = now + MISSION_CONTROL_SESSION_MAX_AGE_SECONDS * 1000 + 1;

    expect(await isMissionControlSessionCookieValid(tamperedCookie, testEnv, now)).toBe(false);
    expect(await isMissionControlSessionCookieValid(cookie, testEnv, expiredNow)).toBe(false);
  });

  it("normalizes login return paths to protected internal routes", () => {
    expect(normalizeMissionControlReturnTo("/worlds/map?world=alpha")).toBe(
      "/worlds/map?world=alpha",
    );
    expect(normalizeMissionControlReturnTo("/world")).toBe("/worlds");
    expect(normalizeMissionControlReturnTo("https://example.com/worlds")).toBe("/worlds");
    expect(normalizeMissionControlReturnTo("//example.com/worlds")).toBe("/worlds");
  });
});
