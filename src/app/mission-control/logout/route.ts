import { redirect } from "next/navigation";

import { clearMissionControlSession } from "../../../lib/mission-control/access";

export async function GET() {
  await clearMissionControlSession();
  redirect("/mission-control?loggedOut=1");
}
