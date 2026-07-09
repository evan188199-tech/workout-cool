-- Standalone user training plan (one active plan per user, userId is unique)
CREATE TABLE "user_training_plans" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "intent" TEXT NOT NULL,
    "daysPerWeek" INTEGER NOT NULL,
    "splitType" TEXT NOT NULL,
    "currentDay" INTEGER NOT NULL DEFAULT 1,
    "completedSessions" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_training_plans_pkey" PRIMARY KEY ("id")
);

-- One active plan per user (userId is unique)
CREATE UNIQUE INDEX "user_training_plans_userId_key" ON "user_training_plans"("userId");

-- Foreign key to user
ALTER TABLE "user_training_plans"
    ADD CONSTRAINT "user_training_plans_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
