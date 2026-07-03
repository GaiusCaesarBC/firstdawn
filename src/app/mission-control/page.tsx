import Link from "next/link";
import { redirect } from "next/navigation";

import {
  clearMissionControlSession,
  isMissionControlAuthenticated,
  setMissionControlSession,
} from "../../lib/mission-control/access";
import {
  isMissionControlAccessKeyValid,
  MISSION_CONTROL_DEFAULT_RETURN_PATH,
  normalizeMissionControlReturnTo,
} from "../../lib/mission-control/session";

export const dynamic = "force-dynamic";

type MissionControlLoginPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function readSearchParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
): string | null {
  const value = params[key];
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function readFormString(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  return typeof value === "string" ? value : null;
}

function buildDeniedUrl(returnTo: string): string {
  const url = new URL("/mission-control", "https://first-dawn.local");
  url.searchParams.set("returnTo", returnTo);
  url.searchParams.set("denied", "1");
  return `${url.pathname}${url.search}`;
}

async function submitMissionControlLogin(formData: FormData) {
  "use server";

  const accessKey = readFormString(formData, "accessKey");
  const returnTo = normalizeMissionControlReturnTo(
    readFormString(formData, "returnTo") ?? MISSION_CONTROL_DEFAULT_RETURN_PATH,
  );

  if (!accessKey || !isMissionControlAccessKeyValid(accessKey)) {
    await clearMissionControlSession();
    redirect(buildDeniedUrl(returnTo));
  }

  await setMissionControlSession();
  redirect(returnTo);
}

export default async function MissionControlLoginPage({
  searchParams,
}: MissionControlLoginPageProps) {
  const params = searchParams ? await searchParams : {};
  const returnTo = normalizeMissionControlReturnTo(readSearchParam(params, "returnTo"));
  const denied = readSearchParam(params, "denied") === "1";
  const loggedOut = readSearchParam(params, "loggedOut") === "1";
  const authenticated = await isMissionControlAuthenticated();

  return (
    <main className="min-h-screen bg-[#05070a] px-6 py-10 text-stone-100 sm:px-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-5xl items-center justify-center">
        <section className="w-full max-w-md border border-white/10 bg-[#090d12] p-8 shadow-[0_28px_90px_rgba(0,0,0,0.55)]">
          <div className="border-b border-white/10 pb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-dawn-gold">
              First Dawn
            </p>
            <h1 className="mt-4 font-display text-4xl leading-tight text-white">
              Mission Control
            </h1>
            <p className="mt-3 text-sm leading-6 text-stone-400">
              Internal observatory and simulation systems.
            </p>
          </div>

          {denied ? (
            <p className="mt-6 border border-red-400/30 bg-red-950/30 px-4 py-3 text-sm text-red-100">
              Access denied.
            </p>
          ) : null}

          {loggedOut ? (
            <p className="mt-6 border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-stone-300">
              Mission Control session closed.
            </p>
          ) : null}

          {authenticated ? (
            <div className="mt-6 space-y-3">
              <Link
                className="flex w-full items-center justify-center border border-dawn-gold/50 bg-dawn-gold/10 px-4 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-dawn-amber transition hover:border-dawn-gold hover:bg-dawn-gold/20 hover:text-white"
                href={returnTo}
              >
                Enter Mission Control
              </Link>
              <Link
                className="flex w-full items-center justify-center border border-white/10 px-4 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-stone-300 transition hover:border-white/25 hover:text-white"
                href="/mission-control/logout"
              >
                Log Out
              </Link>
            </div>
          ) : (
            <form action={submitMissionControlLogin} className="mt-6 space-y-5">
              <input name="returnTo" type="hidden" value={returnTo} />
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-400">
                  Mission Control Access Key
                </span>
                <input
                  autoComplete="current-password"
                  autoFocus
                  className="mt-3 w-full border border-white/10 bg-black/40 px-4 py-3 font-mono text-base text-white outline-none transition placeholder:text-stone-600 focus:border-dawn-gold/70 focus:bg-black/60"
                  name="accessKey"
                  type="password"
                />
              </label>
              <button
                className="w-full border border-dawn-gold/50 bg-dawn-gold/10 px-4 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-dawn-amber transition hover:border-dawn-gold hover:bg-dawn-gold/20 hover:text-white"
                type="submit"
              >
                Authorize
              </button>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
