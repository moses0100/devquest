# DevQuest

พื้นที่ส่วนตัวสำหรับติดตามการฝึกเขียนโค้ด: เป้าหมาย → งานย่อย → บันทึกการเรียน → Dashboard

โปรเจกต์ฝึก Full Stack และ Vibe Coding ด้วย **Next.js App Router · TypeScript · Tailwind CSS · PostgreSQL · Prisma**

![DevQuest Dashboard](docs/devquest-desktop.png)

## เริ่มทดลอง

ต้องมี Node.js 24 และ npm

```powershell
npm ci
Copy-Item .env.example .env
npm run db:generate
npm run dev
```

เปิด http://127.0.0.1:3000 โหมดเริ่มต้นคือ `demo`: มีตัวอย่างที่แก้ไขได้ เก็บข้อมูลใน localStorage ของเบราว์เซอร์ ไม่ต้องเปิดฐานข้อมูล ไม่มีบัญชีผู้ใช้ และไม่ซิงก์ข้ามเครื่อง

หากเปิดหลายแท็บแล้วรายการถูกลบไปก่อน การเปลี่ยนสถานะหรือลบรายการเดิมจะขึ้น “ไม่พบรายการ กรุณาโหลดข้อมูลใหม่” แทนการแจ้งบันทึกสำเร็จ โดยข้อมูลล่าสุดใน localStorage ไม่ถูกเขียนทับจากคำสั่งที่ล้าสมัย

- เพิ่มและลบเป้าหมาย พร้อมหมวดหมู่และความคืบหน้าจากงานจริง
- เพิ่มงาน กรองตามเป้าหมาย และเปลี่ยนสถานะในบอร์ด
- เขียนบันทึก ระบุวันที่ เวลา และสิ่งที่เรียนรู้
- Dashboard สรุปงาน เวลาเรียน กราฟ 7 วัน และจำนวนวันที่เรียนต่อเนื่อง
- ค้นหาในหน้าปัจจุบัน และส่งออก JSON ผ่านการตั้งค่า
- รองรับมือถือ คีย์บอร์ด และผู้ใช้ที่ลดการเคลื่อนไหวหน้าจอ

## ใช้ PostgreSQL จริง

ต้องมี Docker ที่เปิดใช้งานแล้ว หรือ PostgreSQL ที่เตรียมเอง

```powershell
docker compose up -d
npm run db:migrate
```

แก้ `.env` แล้ว restart dev server:

```dotenv
NEXT_PUBLIC_DATA_MODE=database
DATABASE_URL=postgresql://devquest:devquest_local@localhost:5432/devquest
DEVQUEST_ACCESS_KEY=replace-with-a-long-random-secret
```

เปิดการตั้งค่าในหน้าเว็บแล้วกรอก Access key เดียวกัน ระบบจะเก็บ key ใน sessionStorage เฉพาะแท็บนั้น ฐานข้อมูลใหม่เริ่มว่าง: ข้อมูลทดลองไม่ถูกย้ายเข้าฐานข้อมูลอัตโนมัติ

API คือ `GET /api/quests` และ `POST /api/quests` โดย POST รับ action ที่ตรวจด้วย Zod เช่น:

```json
{ "type": "goal.create", "title": "เรียน TypeScript", "category": "Frontend" }
```

schema และ migration อยู่ใน `prisma/`; API ใช้ Prisma ป้องกัน SQL injection, ระบุฟิลด์ที่จะเขียนอย่างชัดเจน, ตรวจ origin ของคำขอแก้ไข และจำกัดขนาด request body เป้าหมายที่ถูกลบจะลบงานย่อย แต่เก็บบันทึกโดยยกเลิกการผูกเป้าหมาย

## ตรวจคุณภาพ

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

GitHub Actions รันชุดตรวจนี้พร้อม integration test กับ PostgreSQL เมื่อ push หรือเปิด pull request การทดสอบ domain ครอบคลุมความสัมพันธ์หลังลบเป้าหมาย ข้อมูลไม่ถูกต้อง การเปลี่ยนสถานะ และ streak ที่ไม่ซ้ำวัน

เมื่อเปิด dev server และฐานข้อมูลแล้ว รัน `npm run test:api` เพื่อทดสอบ CRUD, validation, origin, ขนาด request และการลบข้อมูลที่สัมพันธ์กันกับ PostgreSQL จริง ใช้ `API_BASE` และ `API_KEY` หากเปลี่ยนพอร์ตหรือตั้ง Access key การทดสอบสร้างและลบเฉพาะข้อมูลทดสอบที่มีชื่อ UUID

ล็อก Prisma ที่ 6.19.3 และ override `deepmerge-ts` เป็น 8.0.2 เพื่อแก้ dependency advisory ของ CLI; ตรวจความเข้ากันได้ผ่าน generate, migration และ build ก่อนอัปเดตรุ่นควรรันชุดตรวจทั้งหมดและ `npm audit` ซ้ำ

## โครงสร้าง

```text
src/app/                 หน้าเว็บและ API
src/components/          Dashboard และฟอร์ม
src/lib/domain.ts        กฎข้อมูลร่วมระหว่าง demo กับ API
src/lib/db.ts            Prisma client
prisma/                  schema และ migration
tests/                   ทดสอบกฎข้อมูล
.github/workflows/       CI
```

## ฝึกทำงานกับ GitHub

สร้าง repository ว่างชื่อ `devquest` บน GitHub แล้วแทน `YOUR_USERNAME` ด้วยบัญชีของคุณ:

```powershell
git add .
git commit -m "feat: build DevQuest learning dashboard"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/devquest.git
git push -u origin main
```

สำหรับฟีเจอร์ถัดไป แยก branch เช่น `codex/user-auth` แล้วเปิด pull request อธิบายปัญหา สิ่งที่เปลี่ยน และผลการทดสอบ ห้าม commit `.env`, Access key หรือข้อมูลส่วนตัว ตรวจ `git diff --staged` ก่อน commit

## ขอบเขตเวอร์ชันแรกและการ deploy

นี่คือพื้นที่ส่วนตัวของเจ้าของคนเดียว ยังไม่มีระบบสมาชิกหรือสิทธิ์แยกผู้ใช้ Database API ใน production จะปิดหากไม่มี `DEVQUEST_ACCESS_KEY`; หากตั้ง key ต้องใช้ HTTPS และแชร์เฉพาะกับเจ้าของ ห้ามใส่ secret ในตัวแปรที่ขึ้นต้น `NEXT_PUBLIC_` โหมด demo เหมาะสำหรับเผยแพร่ตัวอย่างให้ผู้อื่นทดลอง เพราะข้อมูลแยกตามเบราว์เซอร์

สำหรับ Node hosting ใช้ `npm ci`, `npm run db:migrate`, `npm run build` แล้ว `npx next start --hostname 0.0.0.0` ภายในระบบ hosting ตั้งตัวแปร production เองและใช้ PostgreSQL ที่มีรหัสผ่านเฉพาะ production รหัสผ่านใน compose เป็นสำหรับเครื่องพัฒนาเท่านั้น ค่า `NEXT_PUBLIC_DATA_MODE` ถูกฝังตอน build ต้อง rebuild เมื่อเปลี่ยนโหมด

ฟีเจอร์ถัดไปที่เหมาะสำหรับฝึก: Login และข้อมูลแยกบัญชี → แก้ไขรายการ → import ข้อมูลสำรอง → GitHub integration → automated browser tests
