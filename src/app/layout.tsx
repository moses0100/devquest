import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "DevQuest — ทุกก้าวของการเรียนรู้", description: "ติดตามเป้าหมาย งาน และบันทึกการเรียนเขียนโค้ดของคุณ" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="th"><body>{children}</body></html>;
}
