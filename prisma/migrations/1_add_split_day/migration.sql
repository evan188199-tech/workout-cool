-- Add splitDay column to track which day of the user's training split
-- a workout session belonged to (null for free-mode workouts).
ALTER TABLE "workout_sessions" ADD COLUMN "splitDay" INTEGER;
