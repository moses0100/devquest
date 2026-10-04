CREATE TABLE "Goal" (
  "id" TEXT NOT NULL, "title" VARCHAR(120) NOT NULL, "category" VARCHAR(40) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "Goal_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Task" (
  "id" TEXT NOT NULL, "title" VARCHAR(160) NOT NULL, "status" VARCHAR(16) NOT NULL DEFAULT 'todo',
  "goalId" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Task_pkey" PRIMARY KEY ("id"), CONSTRAINT "Task_status_check" CHECK ("status" IN ('todo','doing','done'))
);
CREATE TABLE "Entry" (
  "id" TEXT NOT NULL, "title" VARCHAR(120) NOT NULL, "content" TEXT NOT NULL, "minutes" INTEGER NOT NULL,
  "date" VARCHAR(10) NOT NULL, "goalId" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Entry_pkey" PRIMARY KEY ("id"), CONSTRAINT "Entry_minutes_check" CHECK ("minutes" BETWEEN 1 AND 1440)
);
CREATE INDEX "Task_goalId_status_idx" ON "Task"("goalId", "status");
CREATE INDEX "Entry_date_idx" ON "Entry"("date");
CREATE INDEX "Entry_goalId_idx" ON "Entry"("goalId");
ALTER TABLE "Task" ADD CONSTRAINT "Task_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Entry" ADD CONSTRAINT "Entry_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
