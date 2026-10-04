import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { actionSchema } from "@/lib/domain";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function authorize(request: NextRequest) {
  const key = process.env.DEVQUEST_ACCESS_KEY;
  if (!key && process.env.NODE_ENV === "production") return NextResponse.json({ error: "ตั้งค่า DEVQUEST_ACCESS_KEY บนเซิร์ฟเวอร์ก่อนใช้โหมดฐานข้อมูล" }, { status: 503 });
  if (key) {
    const supplied = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
    const a = Buffer.from(key), b = Buffer.from(supplied);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return NextResponse.json({ error: "Access key ไม่ถูกต้อง เปิดการตั้งค่าเพื่อกรอกใหม่" }, { status: 401 });
  }
  if (request.method !== "GET") {
    // Next may normalize nextUrl to localhost internally; compare the public Host instead.
    let sameHost = false;
    try {
      const origin = new URL(request.headers.get("origin") ?? "");
      sameHost = ["http:", "https:"].includes(origin.protocol) && origin.host === request.headers.get("host");
    } catch { /* Missing or malformed origins are rejected. */ }
    if (!sameHost) return NextResponse.json({ error: "คำขอมาจาก origin ที่ไม่ได้รับอนุญาต" }, { status: 403 });
  }
}
export async function GET(request: NextRequest) {
  const denied = authorize(request); if (denied) return denied;
  try {
    const db = getDb();
    const [goals, tasks, entries] = await db.$transaction([db.goal.findMany({ orderBy: { createdAt: "desc" } }), db.task.findMany({ orderBy: { createdAt: "desc" } }), db.entry.findMany({ orderBy: [{ date: "desc" }, { createdAt: "desc" }] })]);
    return NextResponse.json({ goals, tasks, entries }, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "เชื่อมต่อฐานข้อมูลไม่ได้ ตรวจ DATABASE_URL และรัน migration" }, { status: 503 }); }
}
export async function POST(request: NextRequest) {
  const denied = authorize(request); if (denied) return denied;
  let raw: unknown;
  try {
    // Bound the body before JSON parsing, including requests without Content-Length.
    const reader = request.body?.getReader();
    if (!reader) return NextResponse.json({ error: "ไม่มีข้อมูล" }, { status: 400 });
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > 32768) { await reader.cancel(); return NextResponse.json({ error: "ข้อมูลใหญ่เกินไป" }, { status: 413 }); } chunks.push(value); }
    raw = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch { return NextResponse.json({ error: "ข้อมูล JSON ไม่ถูกต้อง" }, { status: 400 }); }
  const parsed = actionSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  try {
    const db = getDb(), action = parsed.data;
    switch (action.type) {
      case "goal.create": await db.goal.create({ data: { title: action.title, category: action.category } }); break;
      case "goal.delete": await db.goal.delete({ where: { id: action.id } }); break;
      case "task.create": await db.task.create({ data: { title: action.title, goalId: action.goalId } }); break;
      case "task.status": await db.task.update({ where: { id: action.id }, data: { status: action.status } }); break;
      case "task.delete": await db.task.delete({ where: { id: action.id } }); break;
      case "entry.create": await db.entry.create({ data: { title: action.title, content: action.content, minutes: action.minutes, date: action.date, goalId: action.goalId } }); break;
      case "entry.delete": await db.entry.delete({ where: { id: action.id } }); break;
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2025", "P2003"].includes(error.code)) return NextResponse.json({ error: "ไม่พบรายการหรือเป้าหมาย กรุณาโหลดข้อมูลใหม่" }, { status: 409 });
    return NextResponse.json({ error: "บันทึกไม่สำเร็จ กรุณาตรวจการเชื่อมต่อฐานข้อมูล" }, { status: 503 });
  }
}
