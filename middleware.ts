import { type NextRequest, NextResponse } from "next/server";

import {
  isMissionControlProtectedPath,
  isMissionControlSessionCookieValid,
  MISSION_CONTROL_COOKIE_NAME,
  MISSION_CONTROL_LOGIN_PATH,
  normalizeMissionControlReturnTo,
} from "./src/lib/mission-control/session";

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (!isMissionControlProtectedPath(pathname)) {
    return NextResponse.next();
  }

  const cookieValue = request.cookies.get(MISSION_CONTROL_COOKIE_NAME)?.value;

  if (await isMissionControlSessionCookieValid(cookieValue)) {
    return NextResponse.next();
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = MISSION_CONTROL_LOGIN_PATH;
  loginUrl.search = "";
  loginUrl.searchParams.set("returnTo", normalizeMissionControlReturnTo(`${pathname}${search}`));

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/worlds",
    "/worlds/:path*",
    "/admin",
    "/admin/:path*",
    "/developer",
    "/developer/:path*",
    "/internal",
    "/internal/:path*",
  ],
};
