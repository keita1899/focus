import { auth } from "../auth";
import HomeClient from "../components/HomeClient";
import { prisma } from "../lib/prisma";

const plannerKey = "focus-planner-state-v1";

function getPlannerKey(userId: string) {
  return `${userId}:${plannerKey}`;
}

export default async function HomePage() {
  const session = await auth();
  let initialPlannerValue = null;

  if (session?.user?.id) {
    const state = await prisma.appState.findUnique({
      where: { key: getPlannerKey(session.user.id) },
    });

    if (state) {
      initialPlannerValue = JSON.parse(state.value);
    }
  }

  return <HomeClient initialPlannerValue={initialPlannerValue} />;
}
