import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    const document = await prisma.document.findFirst({
      where: { id, ownerId: user.id },
    });

    if (!document) {
      return NextResponse.json(
        { error: "Only the owner can share this document" },
        { status: 403 }
      );
    }

    const email = String(body.email || "").trim().toLowerCase();
    const role = body.role === "EDITOR" ? "EDITOR" : "VIEWER";

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { error: "Enter a valid email address" },
        { status: 400 }
      );
    }

    if (email === user.email.toLowerCase()) {
      return NextResponse.json(
        { error: "You cannot share with yourself" },
        { status: 400 }
      );
    }

    const recipient = await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email },
    });

    const share = await prisma.documentShare.upsert({
      where: {
        documentId_userId: {
          documentId: id,
          userId: recipient.id,
        },
      },
      update: { role },
      create: {
        documentId: id,
        userId: recipient.id,
        role,
      },
    });

    return NextResponse.json({ share });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Unable to share document" },
      { status: 500 }
    );
  }
}