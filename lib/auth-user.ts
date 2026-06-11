import { auth } from "../auth";
import { prisma } from "./prisma";

export async function getUserId() {
  const session = await auth();
  if (session?.user?.id) return session.user.id;

  if (!session?.user?.email) return null;

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });

  return user?.id ?? null;
}
