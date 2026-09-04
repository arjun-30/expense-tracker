import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getStorageProvider } from "@/lib/storage";
import { canViewExpense } from "@/lib/rbac";

export async function GET(_req: Request, { params }: { params: Promise<{ key: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { key } = await params;

  // storageKey isn't unique-constrained, but it's a random per-upload
  // identifier, so findFirst is effectively a lookup by key.
  const attachment = await prisma.expenseAttachment.findFirst({
    where: { storageKey: key },
    include: { expense: { select: { employeeId: true, departmentId: true, companyId: true } } },
  });
  if (!attachment) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Attachments are only as visible as the expense they belong to — without
  // this, any authenticated user who obtained a storage key (e.g. by copying
  // a link) could fetch a file from an expense they can't otherwise see.
  if (!canViewExpense(session, attachment.expense)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const data = await getStorageProvider().read(attachment.storageKey, attachment.fileType);
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": attachment.fileType ?? "application/octet-stream",
        "Content-Disposition": `inline; filename="${encodeURIComponent(attachment.fileName)}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
