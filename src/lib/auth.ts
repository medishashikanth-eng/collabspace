import { cookies } from "next/headers";
import { prisma } from "./prisma";

export async function getCurrentUser() {
  const cookieStore = await cookies();

  const email = cookieStore.get("collabspace_user")?.value;

  if (!email) {
    return null;
  }

  return prisma.user.findUnique({
    where: { email },
  });
}