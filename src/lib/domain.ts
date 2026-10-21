import { z } from "zod";

export const statuses = ["todo", "doing", "done"] as const;
export type Status = (typeof statuses)[number];
export type Goal = { id: string; title: string; category: string; createdAt: string };
export type Task = { id: string; title: string; status: Status; goalId: string; createdAt: string };
export type Entry = { id: string; title: string; content: string; minutes: number; date: string; goalId: string | null; createdAt: string };
export type QuestState = { goals: Goal[]; tasks: Task[]; entries: Entry[] };
const title = (max: number) => z.string().trim().min(1, "กรุณากรอกข้อความ").max(max, `ไม่เกิน ${max} ตัวอักษร`);
// PostgreSQL UUIDs are case-insensitive; use the same identity in demo snapshots.
const id = z.uuid().toLowerCase();
export const dateSchema = z.iso.date();
export const actionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("goal.create"), title: title(120), category: title(40) }),
  z.object({ type: z.literal("goal.delete"), id }),
  z.object({ type: z.literal("task.create"), title: title(160), goalId: id }),
  z.object({ type: z.literal("task.status"), id, status: z.enum(statuses) }),
  z.object({ type: z.literal("task.delete"), id }),
  z.object({ type: z.literal("entry.create"), title: title(120), content: title(4000), minutes: z.number().int().min(1).max(1440), date: dateSchema, goalId: id.nullable() }),
  z.object({ type: z.literal("entry.delete"), id }),
]);
export type Action = z.infer<typeof actionSchema>;
export const stateSchema = z.object({
  goals: z.array(z.object({ id, title: title(120), category: title(40), createdAt: z.iso.datetime() })),
  tasks: z.array(z.object({ id, title: title(160), status: z.enum(statuses), goalId: id, createdAt: z.iso.datetime() })),
  entries: z.array(z.object({ id, title: title(120), content: title(4000), minutes: z.number().int().min(1).max(1440), date: dateSchema, goalId: id.nullable(), createdAt: z.iso.datetime() })),
}).superRefine((state, context) => {
  // Validate the snapshot as a whole before displaying or changing persisted data.
  for (const collection of ["goals", "tasks", "entries"] as const) {
    const seen = new Set<string>();
    state[collection].forEach((record, index) => {
      if (seen.has(record.id)) context.addIssue({ code: "custom", path: [collection, index, "id"], message: "พบรหัสรายการซ้ำ กรุณาตรวจข้อมูลที่บันทึกไว้" });
      seen.add(record.id);
    });
  }
  const goalIds = new Set(state.goals.map(goal => goal.id));
  for (const collection of ["tasks", "entries"] as const) {
    state[collection].forEach((record, index) => {
      if (record.goalId !== null && !goalIds.has(record.goalId)) context.addIssue({ code: "custom", path: [collection, index, "goalId"], message: "ไม่พบเป้าหมายของรายการ กรุณาตรวจข้อมูลที่บันทึกไว้" });
    });
  }
});
export function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function applyAction(state: QuestState, raw: Action, newId = crypto.randomUUID(), now = new Date().toISOString()): QuestState {
  const action = actionSchema.parse(raw);
  // Another tab may have deleted the target since this view was rendered.
  // Reject stale actions before changing state instead of reporting a successful no-op.
  if (action.type === "goal.delete" && !state.goals.some(goal => goal.id === action.id)
    || (action.type === "task.status" || action.type === "task.delete") && !state.tasks.some(task => task.id === action.id)
    || action.type === "entry.delete" && !state.entries.some(entry => entry.id === action.id)) {
    throw new Error("ไม่พบรายการ กรุณาโหลดข้อมูลใหม่");
  }
  switch (action.type) {
    case "goal.create": return { ...state, goals: [{ id: newId, title: action.title, category: action.category, createdAt: now }, ...state.goals] };
    case "goal.delete": return { goals: state.goals.filter(g => g.id !== action.id), tasks: state.tasks.filter(t => t.goalId !== action.id), entries: state.entries.map(e => e.goalId === action.id ? { ...e, goalId: null } : e) };
    case "task.create": {
      if (!state.goals.some(g => g.id === action.goalId)) throw new Error("ไม่พบเป้าหมาย กรุณาโหลดข้อมูลใหม่");
      return { ...state, tasks: [{ id: newId, title: action.title, status: "todo", goalId: action.goalId, createdAt: now }, ...state.tasks] };
    }
    case "task.status": return { ...state, tasks: state.tasks.map(t => t.id === action.id ? { ...t, status: action.status } : t) };
    case "task.delete": return { ...state, tasks: state.tasks.filter(t => t.id !== action.id) };
    case "entry.create": {
      if (action.goalId && !state.goals.some(g => g.id === action.goalId)) throw new Error("ไม่พบเป้าหมาย กรุณาโหลดข้อมูลใหม่");
      return { ...state, entries: [{ id: newId, title: action.title, content: action.content, minutes: action.minutes, date: action.date, goalId: action.goalId, createdAt: now }, ...state.entries] };
    }
    case "entry.delete": return { ...state, entries: state.entries.filter(e => e.id !== action.id) };
  }
}
export function streak(entries: Entry[], today = new Date()): number {
  const dates = new Set(entries.map(e => e.date));
  const cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12);
  if (!dates.has(localDate(cursor))) cursor.setDate(cursor.getDate() - 1);
  let count = 0;
  while (dates.has(localDate(cursor))) { count++; cursor.setDate(cursor.getDate() - 1); }
  return count;
}
export function seedState(): QuestState {
  const createdAt = new Date().toISOString();
  const goalId = "a0000000-0000-4000-8000-000000000001";
  const secondId = "a0000000-0000-4000-8000-000000000002";
  return {
    goals: [ { id: goalId, title: "สร้างเว็บแรกด้วย Next.js", category: "Frontend", createdAt }, { id: secondId, title: "ฝึก Git & GitHub ให้คล่อง", category: "DevOps", createdAt } ],
    tasks: [
      { id: "b0000000-0000-4000-8000-000000000001", title: "ทำความเข้าใจ Component และ Props", status: "done", goalId, createdAt },
      { id: "b0000000-0000-4000-8000-000000000002", title: "สร้างหน้า Dashboard ที่รองรับมือถือ", status: "doing", goalId, createdAt },
      { id: "b0000000-0000-4000-8000-000000000003", title: "เชื่อมต่อ API กับฐานข้อมูล", status: "todo", goalId, createdAt },
      { id: "b0000000-0000-4000-8000-000000000004", title: "สร้าง branch และเปิด Pull Request แรก", status: "todo", goalId: secondId, createdAt },
    ],
    entries: [{ id: "c0000000-0000-4000-8000-000000000001", title: "ก้าวแรกของ DevQuest", content: "วันนี้เริ่มเรียนรู้ว่า Component ช่วยแบ่งหน้าเว็บเป็นส่วนเล็ก ๆ ที่นำกลับมาใช้ได้\nพรุ่งนี้จะลองสร้าง Component ของตัวเอง", minutes: 30, date: localDate(), goalId, createdAt }],
  };
}
