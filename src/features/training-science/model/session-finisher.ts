import type { UserIntent } from "./user-intent";

/**
 * An optional post-session task appended to a generated workout (not part of
 * the strength sets itself). Returns an array so future intents can stack
 * multiple finishers (e.g. cardio + mobility + nutrition tip).
 *
 * The UI renders this as a pure dumb component: read data, display card.
 */
export interface SessionFinisher {
  type: "cardio" | "mobility" | "nutrition";
  title: string;
  durationMin?: number;
  rationale: string;
}
/**
 * Rotating at-home cardio options for the fat-loss finisher. Post-strength
 * blood glucose is depleted, so any of these burns fat preferentially. Every
 * option is doable right where you just trained — no stepping outside, no
 * equipment, no stairs — because the real enemy of consistency is a finisher
 * the user can't actually do without changing location.
 */
const FAT_LOSS_CARDIO_OPTIONS: Omit<SessionFinisher, "type">[] = [
  {
    title: "Jog in place",
    durationMin: 15,
    rationale:
      "Light jogging on the spot keeps heart rate in the fat-burning zone. Keep it conversational — if you can't talk, ease off.",
  },
  {
    title: "Shadow boxing",
    durationMin: 15,
    rationale:
      "Throw steady, relaxed punches at the air. It is zero-impact, needs no space, and stays interesting far longer than jogging on the spot.",
  },
  {
    title: "Slow jumping jacks",
    durationMin: 15,
    rationale:
      "Slow, controlled jumping jacks keep you moving without spiking heart rate. Aim for a pace where you could still hold a conversation.",
  },
  {
    title: "High knees",
    durationMin: 12,
    rationale:
      "Marching knees high, at a brisk but steady tempo. Shorter than the others because the intensity creeps up — stop if you lose your breath.",
  },
];

/**
 * A concise, actionable nutrition reminder. Visceral fat responds fastest to a
 * sustained calorie deficit, so each session ends with one habit the user can
 * act on today. Rotating keeps the advice from going stale.
 */
const FAT_LOSS_NUTRITION_OPTIONS: Omit<SessionFinisher, "type">[] = [
  {
    title: "Prioritise protein today",
    rationale:
      "Aim for a palm-sized portion of protein at each meal. It keeps you full and protects the muscle you train, the engine that burns fat.",
  },
  {
    title: "Cut liquid calories",
    rationale:
      "Sugary drinks and alcohol are the fastest route to visceral fat. Swap them for water or black coffee today and you have already created a deficit.",
  },
  {
    title: "Fill half your plate with veg",
    rationale:
      "Fibre and volume from vegetables fill you up on fewer calories. Visceral fat shrinks fastest when you stay in a deficit without feeling starved.",
  },
  {
    title: "Skip the late-night snack",
    rationale:
      "Eating close to bedtime extends your insulin window and blunts overnight fat burning. Finish eating 2-3 hours before sleep tonight.",
  },
];

/**
 * Generate finishers for a given user intent.
 *
 * Only `lose_fat` produces finishers today, but the structure supports adding
 * mobility/nutrition for any intent without changing the rendering component.
 *
 * `sessionIndex` (0-based) rotates which cardio and nutrition variant is shown
 * so repeat sessions stay varied. Pass `completedSessions` from the training
 * plan to get natural variety as the user trains more.
 */
export function getFinishersForIntent(intent: UserIntent, sessionIndex = 0): SessionFinisher[] {
  const finishers: SessionFinisher[] = [];

  if (intent === "lose_fat") {
    const cardio = FAT_LOSS_CARDIO_OPTIONS[sessionIndex % FAT_LOSS_CARDIO_OPTIONS.length];
    finishers.push({ type: "cardio", ...cardio });

    const nutrition = FAT_LOSS_NUTRITION_OPTIONS[sessionIndex % FAT_LOSS_NUTRITION_OPTIONS.length];
    finishers.push({ type: "nutrition", ...nutrition });
  }

  return finishers;
}
