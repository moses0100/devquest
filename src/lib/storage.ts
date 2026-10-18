import { stateSchema, type QuestState } from "./domain";

/** Never replace a removed or malformed snapshot with a stale in-memory copy. */
export function parseSavedState(saved: string | null): QuestState {
  if (saved === null) throw new Error("ข้อมูลในเบราว์เซอร์ถูกลบแล้ว กรุณาโหลดหน้าใหม่");
  return stateSchema.parse(JSON.parse(saved));
}
