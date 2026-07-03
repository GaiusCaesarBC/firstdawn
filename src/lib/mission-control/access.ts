import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  createMissionControlSessionCookie,
  isMissionControlSessionCookieValid,
  MISSION_CONTROL_COOKIE_NAME,
  MISSION_CONTROL_DEFAULT_RETURN_PATH,
  MISSION_CONTROL_LOGIN_PATH,
  MISSION_CONTROL_SESSION_MAX_AGE_SECONDS,
} from "./session";

function getCookieOptions() {
  return {
    httpOnly: true,
    maxAge: MISSION_CONTROL_SESSION_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };
}

export async function isMissionControlAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(MISSION_CONTROL_COOKIE_NAME)?.value;
  return isMissionControlSessionCookieValid(cookieValue);
}

export async function requireMissionControl(
  returnTo = MISSION_CONTROL_DEFAULT_RETURN_PATH,
): Promise<void> {
  if (await isMissionControlAuthenticated()) {
    return;
  }

  const loginUrl = new URL(MISSION_CONTROL_LOGIN_PATH, "https://first-dawn.local");
  loginUrl.searchParams.set("returnTo", returnTo);
  redirect(`${loginUrl.pathname}${loginUrl.search}`);
}

export async function setMissionControlSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(
    MISSION_CONTROL_COOKIE_NAME,
    await createMissionControlSessionCookie(),
    getCookieOptions(),
  );
}

export async function clearMissionControlSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(MISSION_CONTROL_COOKIE_NAME, "", {
    ...getCookieOptions(),
    maxAge: 0,
  });
}
