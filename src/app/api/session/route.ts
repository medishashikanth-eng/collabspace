import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const demoUsers = [
  {
    email: "shashi@example.com",
    name: "Shashi",
  },
  {
    email: "alex@example.com",
    name: "Alex",
  },
];

export async function GET() {
  const response = NextResponse.json({ user: null });

  const email = response.cookies.get("collabspace_user")?.value;

  if (!email) {
    return response;
  }

  const user = await prisma.user.findUnique({
    where: { email },
  });

  return NextResponse.json({ user });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const selectedUser = demoUsers.find(
      (user) => user.email === body.email
    );

    if (!selectedUser) {
      return NextResponse.json(
        { error: "Invalid demo account" },
        { status: 400 }
      );
    }

    const user = await prisma.user.upsert({
      where: { email: selectedUser.email },
      update: {},
      create: selectedUser,
    });

    const response = NextResponse.json({ user });

    response.cookies.set("collabspace_user", user.email, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch {
    return NextResponse.json(
      { error: "Unable to create session" },
      { status: 500 }
    );
  }
}