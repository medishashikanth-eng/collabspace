import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

type Context = { params: Promise<{ id: string }> };

export async function GET(
  request: NextRequest,
  { params }: Context
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    const document = await prisma.document.findFirst({
      where: {
        id,
        OR: [
          { ownerId: user.id },
          { shares: { some: { userId: user.id } } },
        ],
      },
      include: {
        owner: true,
        shares: { include: { user: true } },
      },
    });

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    return NextResponse.json({ document });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Unable to retrieve document" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: Context
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await request.json();

    const document = await prisma.document.findFirst({
      where: {
        id,
        OR: [
          { ownerId: user.id },
          { shares: { some: { userId: user.id, role: "EDITOR" } } },
        ],
      },
    });

    if (!document) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const updated = await prisma.document.update({
      where: { id },
      data: {
        ...(typeof body.title === "string" ? { title: body.title } : {}),
        ...(typeof body.content === "string" ? { content: body.content } : {}),
      },
    });

    return NextResponse.json({ document: updated });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Unable to update document" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: Context
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    const document = await prisma.document.findFirst({
      where: { id, ownerId: user.id },
    });

    if (!document) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    await prisma.document.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Unable to delete document" }, { status: 500 });
  }
}