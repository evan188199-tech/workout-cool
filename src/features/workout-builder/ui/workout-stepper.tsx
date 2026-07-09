"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useQueryState } from "nuqs";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useI18n } from "locales/client";
import Trophy from "@public/images/trophy.png";
import { ExerciseAttributeValueEnum } from "@prisma/client";
import type { QuickTimeBudget } from "@/features/training-science/model/quick-session";

import { StepperStepProps } from "../types";
import { useWorkoutStepper } from "../hooks/use-workout-stepper";
import { useWorkoutSession } from "../../workout-session/model/use-workout-session";
import { TodayTrainingCard } from "./today-training-card";
import { StepperHeader } from "./stepper-header";
import { SessionFinisherCard } from "./session-finisher-card";
import { QuickTrainingCard } from "./quick-training-card";
import { QuickPlanSessionCard } from "./quick-plan-session-card";
import { MuscleSelection } from "./muscle-selection";
import { ExercisesSelection } from "./exercises-selection";
import { EquipmentSelection } from "./equipment-selection";
import { AddExerciseModal } from "./add-exercise-modal";


import type { DayRecommendationResult } from "@/features/training-science/actions/training-plan.action";
import type { ExerciseWithAttributes, WorkoutBuilderStep } from "../types";

import { quickTrainingLocal } from "@/shared/lib/workout-session/quick-training.local";
import useBoolean from "@/shared/hooks/useBoolean";
import { WorkoutSessionSets } from "@/features/workout-session/ui/workout-session-sets";
import { WorkoutSessionHeader } from "@/features/workout-session/ui/workout-session-header";
import { RestTimer } from "@/features/workout-session/ui/rest-timer";
import { WorkoutBuilderFooter } from "@/features/workout-builder/ui/workout-stepper-footer";
import { getFinishersForIntent } from "@/features/training-science/model/session-finisher";
import { env } from "@/env";
import { Button } from "@/components/ui/button";
import { HorizontalTopBanner, HorizontalBottomBanner } from "@/components/ads";

export function WorkoutStepper({ serverRecommendation }: { serverRecommendation?: DayRecommendationResult | null }) {
  const { loadSessionFromLocal } = useWorkoutSession();

  const t = useI18n();
  const router = useRouter();
  const [fromSession, setFromSession] = useQueryState("fromSession");
  const {
    currentStep,
    selectedEquipment,
    selectedMuscles,
    exercisesByMuscle,
    isLoadingExercises,
    exercisesError,
    nextStep,
    prevStep,
    toggleEquipment,
    clearEquipment,
    toggleMuscle,
    canProceedToStep2,
    canProceedToStep3,
    fetchExercises,
    exercisesOrder,
    shuffleExercise,
    pickExercise,
    shufflingExerciseId,
    goToStep,
    deleteExercise,
    isUsingBodyweightOnlyMode,
    refreshWorkoutPreferences,
    quickMode,
    quickSetScheme,
    quickTimeBudget,
    setQuickTimeBudget,
    setRecommendedPlanMinutes,
    generateQuickSession,
    isGeneratingQuick,
    quickError,
    isGeneratingPlanSession,
    planSessionError,
    generatePlanSession,
    selectedSplitDay,
    selectSplitDay,
    selectedIntent,
    recommendedPlanMinutes,
    restIntervalSeconds,
    setRestIntervalSeconds,
    warmupRoutineEnabled,
    warmupExerciseCount,
    setWarmupRoutineEnabled,
    setWarmupExerciseCount,
    warmupReps,
    setWarmupReps,
    cooldownRoutineEnabled,
    cooldownExerciseCount,
    setCooldownRoutineEnabled,
    setCooldownExerciseCount,
    cooldownHoldSeconds,
    setCooldownHoldSeconds,
  } = useWorkoutStepper();

  const handleStartRecommendedDay = async (dayNumber: number, muscles: ExerciseAttributeValueEnum[]) => {
    if (serverRecommendation) {
      await generatePlanSession(dayNumber, muscles, serverRecommendation.recommendedDurationMin);
    } else {
      selectSplitDay(dayNumber, muscles);
      nextStep();
    }
  };

  useEffect(() => {
    refreshWorkoutPreferences();
  }, []);

  useEffect(() => {
    loadSessionFromLocal();
  }, []);

  useEffect(() => {
    const saved = quickTrainingLocal.getTimeBudget();
    if (saved !== quickTimeBudget) {
      setQuickTimeBudget(saved);
    }
  }, []);

  const [flatExercises, setFlatExercises] = useState<{ id: string; muscle: string; exercise: ExerciseWithAttributes }[]>([]);

  useEffect(() => {
    if (exercisesByMuscle.length > 0) {
      const flat = exercisesByMuscle.flatMap((group) =>
        group.exercises.map((exercise: ExerciseWithAttributes) => ({
          id: exercise.id,
          muscle: group.muscle,
          exercise,
        })),
      );
      setFlatExercises(flat);
    }
  }, [exercisesByMuscle]);
  const pendingPlannedMinutesRef = useRef<number | null>(null);
  const pendingRestSecondsRef = useRef<number | null>(null);
  const pendingWarmupExerciseCountRef = useRef<number | null>(null);
  const pendingWarmupRepsRef = useRef<number | null>(null);
  const pendingCooldownExerciseCountRef = useRef<number | null>(null);
  const pendingCooldownHoldSecondsRef = useRef<number | null>(null);

 useEffect(() => {
   if (currentStep === 3 && !fromSession) {
      // Skip the regular exercise fetch when the quick-session generator
      // already populated exercises (otherwise it overwrites the whitelisted
      // results with an unfiltered BODY_ONLY query).
      if (!quickMode) {
        fetchExercises();
      }
   }
  }, [currentStep, selectedEquipment, selectedMuscles, fromSession]);

  const { isWorkoutActive, session, startWorkout, quitWorkout } = useWorkoutSession();
  const canGeneratePlanFromRecommendation = selectedEquipment.length > 0 || isUsingBodyweightOnlyMode;

  const canContinue = currentStep === 1 ? canProceedToStep2 : currentStep === 2 ? canProceedToStep3 : exercisesByMuscle.length > 0;
  const normalizedPlannedMinutes = Math.max(20, Math.min(serverRecommendation?.recommendedDurationMin ?? recommendedPlanMinutes, 60));
  const recommendedWorkoutMinutes = quickMode
    ? quickTimeBudget
    : normalizedPlannedMinutes;
  const commitRecommendedPlanMinutesFromSlider = () => {
    const pending = pendingPlannedMinutesRef.current;
    if (pending === null) return;
    pendingPlannedMinutesRef.current = null;
    setRecommendedPlanMinutes(Math.max(20, Math.min(60, pending)));
  };

  const commitRestIntervalFromSlider = () => {
    const pending = pendingRestSecondsRef.current;
    if (pending === null) return;
    pendingRestSecondsRef.current = null;
    setRestIntervalSeconds(Math.max(5, Math.min(180, pending)));
  };

  const commitWarmupExerciseCountFromSlider = () => {
    const pending = pendingWarmupExerciseCountRef.current;
    if (pending === null) return;
    pendingWarmupExerciseCountRef.current = null;
    setWarmupExerciseCount(Math.max(1, Math.min(4, pending)));
  };

  const commitWarmupRepsFromSlider = () => {
    const pending = pendingWarmupRepsRef.current;
    if (pending === null) return;
    pendingWarmupRepsRef.current = null;
    setWarmupReps(Math.max(6, Math.min(15, pending)));
  };

  const commitCooldownExerciseCountFromSlider = () => {
    const pending = pendingCooldownExerciseCountRef.current;
    if (pending === null) return;
    pendingCooldownExerciseCountRef.current = null;
    setCooldownExerciseCount(Math.max(1, Math.min(4, pending)));
  };

  const commitCooldownHoldSecondsFromSlider = () => {
    const pending = pendingCooldownHoldSecondsRef.current;
    if (pending === null) return;
    pendingCooldownHoldSecondsRef.current = null;
    setCooldownHoldSeconds(Math.max(20, Math.min(40, pending)));
  };

  const adjustRecommendedPlanMinutes = (delta: number) => {
    setRecommendedPlanMinutes(Math.max(20, Math.min(60, recommendedWorkoutMinutes + delta)));
  };

  const adjustRestIntervalSeconds = (delta: number) => {
    setRestIntervalSeconds(Math.max(5, Math.min(180, restIntervalSeconds + delta)));
  };

  const adjustWarmupExerciseCount = (delta: number) => {
    setWarmupExerciseCount(Math.max(1, Math.min(4, warmupExerciseCount + delta)));
  };

  const adjustWarmupReps = (delta: number) => {
    setWarmupReps(Math.max(6, Math.min(15, warmupReps + delta)));
  };

  const adjustCooldownExerciseCount = (delta: number) => {
    setCooldownExerciseCount(Math.max(1, Math.min(4, cooldownExerciseCount + delta)));
  };

  const adjustCooldownHoldSeconds = (delta: number) => {
    setCooldownHoldSeconds(Math.max(20, Math.min(40, cooldownHoldSeconds + delta)));
  };

  const quickDurationOptions: QuickTimeBudget[] = [5, 10, 15, 20, 25];
  const durationOptions = quickMode
    ? quickDurationOptions
    : (() => {
        const source = recommendedWorkoutMinutes;
        const range = serverRecommendation?.recommendedDurationRange;
        const durationOptionSet = new Set<number>([
          20,
          25,
          30,
          35,
          40,
          45,
          50,
          60,
          source,
          Math.max(20, source - 10),
          Math.max(20, source - 5),
          Math.min(60, source + 5),
          Math.min(60, source + 10),
          recommendedPlanMinutes,
          range?.min ?? source,
          range?.max ?? source,
        ]);
        return Array.from(durationOptionSet).filter((value) => value >= 20 && value <= 60).sort((a, b) => a - b);
      })();

  const restIntervalOptions = [5, 10, 15, 20, 25, 30, 40, 50, 60, 75, 90, 120, 180].filter(
    (seconds) => seconds >= 5 && seconds <= 180,
  );
  const warmupExerciseCountOptions = [1, 2, 3, 4];
  const warmupRepsOptions = [6, 8, 10, 12, 14, 15];
  const cooldownExerciseCountOptions = [1, 2, 3, 4];
  const cooldownHoldSecondsOptions = [20, 25, 30, 35, 40];

  const sessionPrescriptionSummary = [
    {
      label: t("workout_builder.session.target_duration_label"),
      value: `${recommendedWorkoutMinutes} ${t("workout_builder.session.time_unit_min")}`,
      disabled: false,
    },
    {
      label: t("workout_builder.session.prescription_rest_label"),
      value: t("workout_builder.session.prescription_rest_value", { seconds: restIntervalSeconds }),
      disabled: false,
    },
    {
      label: t("workout_builder.session.prescription_warmup_label"),
      value: warmupRoutineEnabled
        ? t("workout_builder.session.prescription_warmup_value", {
            sets: warmupExerciseCount,
            reps: warmupReps,
          })
        : t("workout_builder.session.prescription_feature_disabled"),
      disabled: !warmupRoutineEnabled,
    },
    {
      label: t("workout_builder.session.prescription_cooldown_label"),
      value: cooldownRoutineEnabled
        ? t("workout_builder.session.prescription_cooldown_value", {
            sets: cooldownExerciseCount,
            seconds: cooldownHoldSeconds,
          })
        : t("workout_builder.session.prescription_feature_disabled"),
      disabled: !cooldownRoutineEnabled,
    },
  ];

  const handleShuffleExercise = async (exerciseId: string, muscle: string) => {
    try {
      const muscleEnum = muscle as ExerciseAttributeValueEnum;
      await shuffleExercise(exerciseId, muscleEnum);
    } catch (error) {
      console.error("Error shuffling exercise:", error);
      alert(t("workout_builder.session.error_shuffling_exercise"));
    }
  };

  const handlePickExercise = async (exerciseId: string) => {
    try {
      await pickExercise(exerciseId);
      console.log("Exercise picked successfully!");
    } catch (error) {
      console.error("Error picking exercise:", error);
      alert(t("workout_builder.session.error_picking_exercise"));
    }
  };

  const handleDeleteExercise = (exerciseId: string) => {
    deleteExercise(exerciseId);
  };

  const addExerciseModal = useBoolean();

  const handleAddExercise = () => {
    addExerciseModal.setTrue();
  };

  // Fix: Use flatExercises as the source of truth, respecting exercisesOrder when possible
  const orderedExercises = useMemo(() => {
    if (flatExercises.length === 0) return [];

    if (exercisesOrder.length === 0) {
      // No custom order, use flatExercises as-is
      return flatExercises.map((item) => item.exercise);
    }

    // Create a map for quick lookup
    const exerciseMap = new Map(flatExercises.map((item) => [item.id, item.exercise]));

    // Get ordered exercises that exist in flatExercises
    const orderedResults = exercisesOrder.map((id) => exerciseMap.get(id)).filter(Boolean) as ExerciseWithAttributes[];

    // Add any remaining exercises from flatExercises that aren't in exercisesOrder
    const remainingExercises = flatExercises.filter((item) => !exercisesOrder.includes(item.id)).map((item) => item.exercise);

    return [...orderedResults, ...remainingExercises];
  }, [flatExercises, exercisesOrder]);

  const handleStartWorkout = () => {
  if (orderedExercises.length > 0) {
      startWorkout(
        orderedExercises,
        selectedEquipment,
        selectedMuscles,
        selectedSplitDay,
        recommendedWorkoutMinutes,
        quickMode ? quickSetScheme : null,
        {
          restIntervalSeconds,
          warmupRoutineEnabled,
          warmupExerciseCount,
          warmupReps,
          cooldownRoutineEnabled,
          cooldownExerciseCount,
          cooldownHoldSeconds,
        },
      );
   } else {
     console.log("🚀 [WORKOUT-STEPPER] No exercises to start workout with!");
   }
 };

  const [showCongrats, setShowCongrats] = useState(false);

  const goToProfile = () => {
    router.push("/profile");
  };

  const stepperContentRef = useRef<HTMLDivElement>(null);

  const handleCongrats = () => {
    setShowCongrats(true);
  };

  const handleToggleEquipment = (equipment: ExerciseAttributeValueEnum) => {
    toggleEquipment(equipment);
    if (fromSession) setFromSession(null);
  };

  const handleClearEquipment = () => {
    clearEquipment();
    if (fromSession) setFromSession(null);
  };

  const handleToggleMuscle = (muscle: ExerciseAttributeValueEnum) => {
    toggleMuscle(muscle);
    if (fromSession) setFromSession(null);
  };

  const handleStepClick = (stepNumber: number) => {
    if (stepNumber < currentStep) {
      goToStep(stepNumber as WorkoutBuilderStep);
    }
  };

  if (showCongrats && !isWorkoutActive) {
   // Finishers (e.g. fat-loss cardio + nutrition) only show for relevant intents.
   // Prefer the intent from the saved training plan, fall back to the store.
   const finisherIntent = serverRecommendation?.intent ?? selectedIntent;
   const sessionIndex = serverRecommendation?.plan?.completedSessions ?? 0;
   const finishers = finisherIntent ? getFinishersForIntent(finisherIntent, sessionIndex) : [];

   return (
     <>
     <div className="flex flex-col items-center justify-center py-16 h-full">
         <Image alt={t("workout_builder.session.congrats_image_alt")} className="w-56 h-56" src={Trophy} />
         <h2 className="text-2xl font-bold mb-2 text-center">{t("workout_builder.session.congrats")}</h2>
         <p className="text-lg text-slate-600 mb-6">{t("workout_builder.session.congrats_subtitle")}</p>
         {finishers.length > 0 && (
           <div className="w-full max-w-md mb-6">
             <SessionFinisherCard finishers={finishers} />
           </div>
         )}
         <Button onClick={goToProfile}>{t("commons.go_to_profile")}</Button>
       </div>
     </>
   );
 }

  if (isWorkoutActive && session) {
    return (
      <div className="w-full max-w-6xl mx-auto">
        {(env.NEXT_PUBLIC_TOP_WORKOUT_SESSION_BANNER_AD_SLOT || env.NEXT_PUBLIC_EZOIC_TOP_WORKOUT_SESSION_PLACEMENT_ID) && (
          <HorizontalTopBanner
            adSlot={env.NEXT_PUBLIC_TOP_WORKOUT_SESSION_BANNER_AD_SLOT}
            ezoicPlacementId={env.NEXT_PUBLIC_EZOIC_TOP_WORKOUT_SESSION_PLACEMENT_ID}
          />
        )}
        {!showCongrats && <WorkoutSessionHeader onQuitWorkout={quitWorkout} />}
       <WorkoutSessionSets isWorkoutActive={isWorkoutActive} onCongrats={handleCongrats} showCongrats={showCongrats} />
       <RestTimer />
     </div>
    );
  }

  const STEPPER_STEPS: StepperStepProps[] = [
    {
      stepNumber: 1,
      title: t("workout_builder.steps.equipment.title"),
      description: t("workout_builder.steps.equipment.description"),
      isActive: false,
      isCompleted: false,
    },
    {
      stepNumber: 2,
      title: t("workout_builder.steps.muscles.title"),
      description: t("workout_builder.steps.muscles.description"),
      isActive: false,
      isCompleted: false,
    },
    {
      stepNumber: 3,
      title: t("workout_builder.steps.exercises.title"),
      description: t("workout_builder.steps.exercises.description"),
      isActive: false,
      isCompleted: false,
    },
  ];

  const steps = STEPPER_STEPS.map((step) => ({
    ...step,
    isActive: step.stepNumber === currentStep,
    isCompleted: step.stepNumber < currentStep,
  }));

  const renderStepContent = () => {
    switch (currentStep) {
     case 1:
       if (isUsingBodyweightOnlyMode && selectedEquipment.includes(ExerciseAttributeValueEnum.BODY_ONLY)) {
         return (
           <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200">
             {t("workout_builder.stepper_bodyweight_mode_notice")}
            </div>
           );
         }
       return (
         <EquipmentSelection
           onClearEquipment={handleClearEquipment}
           onToggleEquipment={handleToggleEquipment}
           selectedEquipment={selectedEquipment}
         />
       );
     case 2:
       return (
          <div className="space-y-4">
            {selectedSplitDay && (
              <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 px-4 py-2 text-sm text-emerald-700 dark:text-emerald-300">
                {t("workout_builder.stepper_split_day_hint", { day: selectedSplitDay })}
              </div>
            )}
         <MuscleSelection onToggleMuscle={handleToggleMuscle} selectedEquipment={selectedEquipment} selectedMuscles={selectedMuscles} />
          </div>
       );
      case 3:
        return (
          <ExercisesSelection
            error={exercisesError}
            exercisesByMuscle={exercisesByMuscle}
            isLoading={isLoadingExercises}
            onAdd={handleAddExercise}
            onDelete={handleDeleteExercise}
            onPick={handlePickExercise}
            onShuffle={handleShuffleExercise}
            shufflingExerciseId={shufflingExerciseId}
          />
        );
      default:
        return null;
    }
  };

  const renderBottomBanner = () => {
    if (currentStep === 1 && (env.NEXT_PUBLIC_EQUIPMENT_SELECTION_BANNER_AD_SLOT || env.NEXT_PUBLIC_EZOIC_EQUIPMENT_SELECTION_PLACEMENT_ID)) {
      return (
        <HorizontalBottomBanner
          adSlot={env.NEXT_PUBLIC_EQUIPMENT_SELECTION_BANNER_AD_SLOT}
          ezoicPlacementId={env.NEXT_PUBLIC_EZOIC_EQUIPMENT_SELECTION_PLACEMENT_ID}
        />
      );
    }
    if (currentStep === 2 && (env.NEXT_PUBLIC_MUSCLE_SELECTION_BANNER_AD_SLOT || env.NEXT_PUBLIC_EZOIC_MUSCLE_SELECTION_PLACEMENT_ID)) {
      return (
        <HorizontalBottomBanner
          adSlot={env.NEXT_PUBLIC_MUSCLE_SELECTION_BANNER_AD_SLOT}
          ezoicPlacementId={env.NEXT_PUBLIC_EZOIC_MUSCLE_SELECTION_PLACEMENT_ID}
        />
      );
    }
    if (currentStep === 3 && (env.NEXT_PUBLIC_EXERCISE_SELECTION_BANNER_AD_SLOT || env.NEXT_PUBLIC_EZOIC_EXERCISES_SELECTION_PLACEMENT_ID)) {
      return (
        <HorizontalBottomBanner
          adSlot={env.NEXT_PUBLIC_EXERCISE_SELECTION_BANNER_AD_SLOT}
          ezoicPlacementId={env.NEXT_PUBLIC_EZOIC_EXERCISES_SELECTION_PLACEMENT_ID}
        />
      );
    }
  };

  const handleJumpToEquipment = () => {
    goToStep(1 as WorkoutBuilderStep);
    requestAnimationFrame(() => {
      stepperContentRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const renderTopBanner = () => {
    if (currentStep === 1) {
      // if (locale === "fr") {
      //   return <NutripureAffiliateBanner />;
      // }

      if (env.NEXT_PUBLIC_TOP_STEPPER_STEP_1_BANNER_AD_SLOT || env.NEXT_PUBLIC_EZOIC_TOP_STEPPER_STEP_1_PLACEMENT_ID) {
        return (
          <HorizontalTopBanner
            adSlot={env.NEXT_PUBLIC_TOP_STEPPER_STEP_1_BANNER_AD_SLOT}
            ezoicPlacementId={env.NEXT_PUBLIC_EZOIC_TOP_STEPPER_STEP_1_PLACEMENT_ID}
          />
        );
      }
    }

    if (currentStep === 2) {
      // if (locale === "fr") {
      //   return <NutripureAffiliateBanner />;
      // }

      if (env.NEXT_PUBLIC_TOP_STEPPER_STEP_2_BANNER_AD_SLOT || env.NEXT_PUBLIC_EZOIC_TOP_STEPPER_STEP_2_PLACEMENT_ID) {
        return (
          <HorizontalTopBanner
            adSlot={env.NEXT_PUBLIC_TOP_STEPPER_STEP_2_BANNER_AD_SLOT}
            ezoicPlacementId={env.NEXT_PUBLIC_EZOIC_TOP_STEPPER_STEP_2_PLACEMENT_ID}
          />
        );
      }
    }

    if (currentStep === 3) {
      // if (locale === "fr") {
      //   return <NutripureAffiliateBanner />;
      // }

      if (env.NEXT_PUBLIC_TOP_STEPPER_STEP_3_BANNER_AD_SLOT || env.NEXT_PUBLIC_EZOIC_TOP_STEPPER_STEP_3_PLACEMENT_ID) {
        return (
          <HorizontalTopBanner
            adSlot={env.NEXT_PUBLIC_TOP_STEPPER_STEP_3_BANNER_AD_SLOT}
            ezoicPlacementId={env.NEXT_PUBLIC_EZOIC_TOP_STEPPER_STEP_3_PLACEMENT_ID}
          />
        );
      }
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto h-full">
      {renderTopBanner()}

      {currentStep === 1 && serverRecommendation && (
        <div className="mb-6">
          <TodayTrainingCard
            canGenerate={canGeneratePlanFromRecommendation}
            isGenerating={isGeneratingPlanSession}
            onRequireEquipment={handleJumpToEquipment}
            onStartDay={handleStartRecommendedDay}
            recommendation={serverRecommendation}
          />
        </div>
      )}

      {currentStep === 1 && (
        <div className="mb-6">
          {isUsingBodyweightOnlyMode && selectedEquipment.length === 0 ? (
            <p className="mb-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200">
              {t("workout_builder.stepper_bodyweight_preference_notice")}
            </p>
          ) : null}
          <QuickTrainingCard
            error={quickError}
            isGenerating={isGeneratingQuick}
            onGenerate={() => generateQuickSession()}
            onTimeBudgetChange={setQuickTimeBudget}
            selectedTimeBudget={quickTimeBudget}
          />
        </div>
      )}

      {currentStep === 1 && serverRecommendation && (
        <div className="mb-6">
          <QuickPlanSessionCard
            canGenerate={selectedEquipment.length > 0 || isUsingBodyweightOnlyMode}
            error={planSessionError}
            isGenerating={isGeneratingPlanSession}
            onGenerate={() =>
              generatePlanSession(
                serverRecommendation.recommendedDay,
                serverRecommendation.muscles,
                serverRecommendation.recommendedDurationMin,
              )
            }
            onNeedEquipment={handleJumpToEquipment}
            recommendation={serverRecommendation}
          />
        </div>
      )}

      {currentStep === 1 && (
        <div className="mb-6">
          <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 dark:border-indigo-900/60 dark:bg-indigo-950/30">
            <p className="mb-2 text-sm font-semibold text-indigo-900 dark:text-indigo-200">
              {t("workout_builder.session.prescription_card_title")}
            </p>
            <div className="flex flex-wrap gap-2">
              {sessionPrescriptionSummary.map((item) => (
                <span
                  className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                    item.disabled
                      ? "border border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200"
                      : "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-200"
                  }`}
                  key={item.label}
                >
                  {item.label}: {item.value}
                </span>
              ))}
            </div>
            <div className="mt-3 space-y-4">
              <div>
                <p className="mb-2 text-xs font-medium text-indigo-900 dark:text-indigo-200">
                  {t("workout_builder.session.target_duration_label")}
                </p>
                <div className="flex flex-wrap gap-2">
                  {durationOptions.map((minutes) => (
                    <Button
                      className={minutes === recommendedWorkoutMinutes ? "bg-indigo-600 text-white" : "bg-indigo-100 text-indigo-700"}
                      key={`duration-${minutes}`}
                      onClick={() => {
                        if (quickMode) {
                          setQuickTimeBudget(minutes as QuickTimeBudget);
                          return;
                        }
                        setRecommendedPlanMinutes(minutes);
                      }}
                      size="small"
                      variant="outline"
                    >
                    {minutes}
                    {t("workout_builder.session.time_unit_min")}
                    </Button>
                  ))}
                </div>
                {!quickMode && (
                <div className="mt-2 px-1">
                  <div className="mb-1 text-[11px] text-indigo-900/80 dark:text-indigo-200/80">
                    {recommendedWorkoutMinutes}
                    {t("workout_builder.session.time_unit_min")}
                  </div>
                  <div className="mb-2 flex items-center gap-2">
                    <Button
                      className="h-7 px-2 rounded-full text-[11px] bg-slate-100 text-slate-700"
                      onClick={() => adjustRecommendedPlanMinutes(-5)}
                      size="small"
                      type="button"
                      variant="outline"
                      disabled={recommendedWorkoutMinutes <= 20}
                    >
                      -5
                    </Button>
                    <Button
                      className="h-7 px-2 rounded-full text-[11px] bg-slate-100 text-slate-700"
                      onClick={() => adjustRecommendedPlanMinutes(5)}
                      size="small"
                      type="button"
                      variant="outline"
                      disabled={recommendedWorkoutMinutes >= 60}
                    >
                      +5
                    </Button>
                    <Button
                      className="h-7 px-2 rounded-full text-[11px] bg-slate-100 text-slate-700"
                      disabled={recommendedWorkoutMinutes <= 20}
                      onClick={() => adjustRecommendedPlanMinutes(-10)}
                      size="small"
                      type="button"
                      variant="outline"
                    >
                      -10
                    </Button>
                    <Button
                      className="h-7 px-2 rounded-full text-[11px] bg-slate-100 text-slate-700"
                      disabled={recommendedWorkoutMinutes >= 60}
                      onClick={() => adjustRecommendedPlanMinutes(10)}
                      size="small"
                      type="button"
                      variant="outline"
                    >
                      +10
                    </Button>
                  </div>
                  <input
                    aria-label={t("workout_builder.session.target_duration_label")}
                    className="h-2 w-full cursor-pointer accent-indigo-500"
                    max={60}
                    min={20}
                    onChange={(event) => {
                      pendingPlannedMinutesRef.current = Number(event.target.value);
                      setRecommendedPlanMinutes(Number(event.target.value));
                    }}
                    onBlur={commitRecommendedPlanMinutesFromSlider}
                    onKeyUp={commitRecommendedPlanMinutesFromSlider}
                    onMouseUp={commitRecommendedPlanMinutesFromSlider}
                    onPointerUp={commitRecommendedPlanMinutesFromSlider}
                    onPointerDown={() => {
                      pendingPlannedMinutesRef.current = recommendedWorkoutMinutes;
                    }}
                    onTouchEnd={commitRecommendedPlanMinutesFromSlider}
                    step={5}
                    type="range"
                    value={recommendedWorkoutMinutes}
                  />
                </div>
                )}
              </div>
              <div>
                <p className="mb-2 text-xs font-medium text-indigo-900 dark:text-indigo-200">
                  {t("workout_builder.session.prescription_rest_label")}
                </p>
                <div className="flex flex-wrap gap-2">
                  {restIntervalOptions.map((seconds) => (
                    <Button
                      className={seconds === restIntervalSeconds ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"}
                      key={`rest-${seconds}`}
                      onClick={() => setRestIntervalSeconds(seconds)}
                      size="small"
                      variant="outline"
                    >
                    {seconds}
                    {t("workout_builder.session.time_unit_seconds")}
                  </Button>
                ))}
                </div>
                <div className="mt-2 px-1">
                  <div className="mb-1 text-[11px] text-indigo-900/80 dark:text-indigo-200/80">
                    {restIntervalSeconds}
                    {t("workout_builder.session.time_unit_seconds")}
                  </div>
                  <div className="mb-2 flex items-center gap-2">
                    <Button
                      className="h-7 px-2 rounded-full text-[11px] bg-slate-100 text-slate-700"
                      onClick={() => adjustRestIntervalSeconds(-5)}
                      size="small"
                      type="button"
                      variant="outline"
                      disabled={restIntervalSeconds <= 5}
                    >
                      -5
                    </Button>
                    <Button
                      className="h-7 px-2 rounded-full text-[11px] bg-slate-100 text-slate-700"
                      onClick={() => adjustRestIntervalSeconds(5)}
                      size="small"
                      type="button"
                      variant="outline"
                      disabled={restIntervalSeconds >= 180}
                    >
                      +5
                    </Button>
                    <Button
                      className="h-7 px-2 rounded-full text-[11px] bg-slate-100 text-slate-700"
                      disabled={restIntervalSeconds <= 5}
                      onClick={() => adjustRestIntervalSeconds(-10)}
                      size="small"
                      type="button"
                      variant="outline"
                    >
                      -10
                    </Button>
                    <Button
                      className="h-7 px-2 rounded-full text-[11px] bg-slate-100 text-slate-700"
                      disabled={restIntervalSeconds >= 180}
                      onClick={() => adjustRestIntervalSeconds(10)}
                      size="small"
                      type="button"
                      variant="outline"
                    >
                      +10
                    </Button>
                  </div>
                    <input
                      aria-label={t("workout_builder.session.prescription_rest_label")}
                      className="h-2 w-full cursor-pointer accent-blue-500"
                      max={180}
                      min={5}
                      onChange={(event) => {
                        pendingRestSecondsRef.current = Number(event.target.value);
                        setRestIntervalSeconds(Number(event.target.value));
                      }}
                      onBlur={commitRestIntervalFromSlider}
                      onKeyUp={commitRestIntervalFromSlider}
                      onMouseUp={commitRestIntervalFromSlider}
                      onPointerUp={commitRestIntervalFromSlider}
                      onPointerDown={() => {
                        pendingRestSecondsRef.current = restIntervalSeconds;
                      }}
                      onTouchEnd={commitRestIntervalFromSlider}
                      step={5}
                      type="range"
                      value={restIntervalSeconds}
                  />
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs font-medium text-indigo-900 dark:text-indigo-200">
                  <label className="inline-flex items-center gap-2">
                    <input
                      checked={warmupRoutineEnabled}
                      onChange={() => {
                        setWarmupRoutineEnabled(!warmupRoutineEnabled);
                      }}
                      type="checkbox"
                    />
                    {t("workout_builder.session.prescription_warmup_label")}
                  </label>
                </p>
                <div className="flex flex-wrap gap-2">
                  {warmupExerciseCountOptions.map((count) => (
                    <Button
                      className={
                        warmupRoutineEnabled && warmupExerciseCount === count
                          ? "bg-emerald-600 text-white"
                          : "bg-slate-100 text-slate-700"
                      }
                      disabled={!warmupRoutineEnabled}
                      key={`warmup-count-${count}`}
                      onClick={() => setWarmupExerciseCount(count)}
                      size="small"
                      variant="outline"
                    >
                      {count}
                    </Button>
                  ))}
                  <div className="w-full px-1 mt-2">
                    <div className="mb-1 text-[11px] text-indigo-900/80 dark:text-indigo-200/80">
                      {t("workout_builder.session.prescription_warmup_value", {
                        sets: warmupExerciseCount,
                        reps: warmupReps,
                      })}
                    </div>
                    <div className="mb-2 flex items-center gap-2">
                      <Button
                        className="h-7 px-2 rounded-full text-[11px] bg-slate-100 text-slate-700"
                        disabled={!warmupRoutineEnabled || warmupExerciseCount <= 1}
                        onClick={() => adjustWarmupExerciseCount(-1)}
                        size="small"
                        type="button"
                        variant="outline"
                      >
                        -1
                      </Button>
                      <Button
                        className="h-7 px-2 rounded-full text-[11px] bg-slate-100 text-slate-700"
                        disabled={!warmupRoutineEnabled || warmupExerciseCount >= 4}
                        onClick={() => adjustWarmupExerciseCount(1)}
                        size="small"
                        type="button"
                        variant="outline"
                      >
                        +1
                      </Button>
                    </div>
                    <input
                      aria-label={t("workout_builder.session.prescription_warmup_label")}
                      className="h-2 w-full cursor-pointer accent-emerald-500"
                      disabled={!warmupRoutineEnabled}
                      max={4}
                      min={1}
                      onChange={(event) => {
                        pendingWarmupExerciseCountRef.current = Number(event.target.value);
                        setWarmupExerciseCount(Number(event.target.value));
                      }}
                      onBlur={commitWarmupExerciseCountFromSlider}
                      onKeyUp={commitWarmupExerciseCountFromSlider}
                      onMouseUp={commitWarmupExerciseCountFromSlider}
                      onPointerUp={commitWarmupExerciseCountFromSlider}
                      onPointerDown={() => {
                        pendingWarmupExerciseCountRef.current = warmupExerciseCount;
                      }}
                      onTouchEnd={commitWarmupExerciseCountFromSlider}
                      step={1}
                      type="range"
                      value={warmupExerciseCount}
                    />
                  </div>
                  {warmupRepsOptions.map((reps) => (
                    <Button
                      className={
                        warmupRoutineEnabled && warmupReps === reps ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-700"
                      }
                      disabled={!warmupRoutineEnabled}
                      key={`warmup-reps-${reps}`}
                      onClick={() => setWarmupReps(reps)}
                      size="small"
                      variant="outline"
                    >
                      {reps}
                      {t("workout_builder.session.reps")}
                    </Button>
                  ))}
                  <div className="w-full px-1 mt-2">
                    <div className="mb-1 text-[11px] text-indigo-900/80 dark:text-indigo-200/80">
                      {warmupReps}
                      {t("workout_builder.session.reps")}
                    </div>
                    <div className="mb-2 flex items-center gap-2">
                      <Button
                        className="h-7 px-2 rounded-full text-[11px] bg-slate-100 text-slate-700"
                        disabled={!warmupRoutineEnabled || warmupReps <= 6}
                        onClick={() => adjustWarmupReps(-1)}
                        size="small"
                        type="button"
                        variant="outline"
                      >
                        -1
                      </Button>
                      <Button
                        className="h-7 px-2 rounded-full text-[11px] bg-slate-100 text-slate-700"
                        disabled={!warmupRoutineEnabled || warmupReps >= 15}
                        onClick={() => adjustWarmupReps(1)}
                        size="small"
                        type="button"
                        variant="outline"
                      >
                        +1
                      </Button>
                    </div>
                    <input
                      aria-label={t("workout_builder.session.reps")}
                      className="h-2 w-full cursor-pointer accent-emerald-500"
                      disabled={!warmupRoutineEnabled}
                      max={15}
                      min={6}
                      onChange={(event) => {
                        pendingWarmupRepsRef.current = Number(event.target.value);
                        setWarmupReps(Number(event.target.value));
                      }}
                      onBlur={commitWarmupRepsFromSlider}
                      onKeyUp={commitWarmupRepsFromSlider}
                      onMouseUp={commitWarmupRepsFromSlider}
                      onPointerUp={commitWarmupRepsFromSlider}
                      onPointerDown={() => {
                        pendingWarmupRepsRef.current = warmupReps;
                      }}
                      onTouchEnd={commitWarmupRepsFromSlider}
                      step={1}
                      type="range"
                      value={warmupReps}
                    />
                  </div>
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs font-medium text-indigo-900 dark:text-indigo-200">
                  <label className="inline-flex items-center gap-2">
                    <input
                      checked={cooldownRoutineEnabled}
                      onChange={() => {
                        setCooldownRoutineEnabled(!cooldownRoutineEnabled);
                      }}
                      type="checkbox"
                    />
                    {t("workout_builder.session.prescription_cooldown_label")}
                  </label>
                </p>
                <div className="flex flex-wrap gap-2">
                  {cooldownExerciseCountOptions.map((count) => (
                    <Button
                      className={
                        cooldownRoutineEnabled && cooldownExerciseCount === count
                          ? "bg-indigo-600 text-white"
                          : "bg-slate-100 text-slate-700"
                      }
                      disabled={!cooldownRoutineEnabled}
                      key={`cooldown-count-${count}`}
                      onClick={() => setCooldownExerciseCount(count)}
                      size="small"
                      variant="outline"
                    >
                      {count}
                    </Button>
                  ))}
                  <div className="w-full px-1 mt-2">
                    <div className="mb-1 text-[11px] text-indigo-900/80 dark:text-indigo-200/80">
                      {cooldownExerciseCount}
                      {cooldownExerciseCount > 1
                        ? t("set#other", { count: cooldownExerciseCount })
                        : t("set#one", { count: cooldownExerciseCount })}
                    </div>
                    <div className="mb-2 flex items-center gap-2">
                      <Button
                        className="h-7 px-2 rounded-full text-[11px] bg-slate-100 text-slate-700"
                        disabled={!cooldownRoutineEnabled || cooldownExerciseCount <= 1}
                        onClick={() => adjustCooldownExerciseCount(-1)}
                        size="small"
                        type="button"
                        variant="outline"
                      >
                        -1
                      </Button>
                      <Button
                        className="h-7 px-2 rounded-full text-[11px] bg-slate-100 text-slate-700"
                        disabled={!cooldownRoutineEnabled || cooldownExerciseCount >= 4}
                        onClick={() => adjustCooldownExerciseCount(1)}
                        size="small"
                        type="button"
                        variant="outline"
                      >
                        +1
                      </Button>
                    </div>
                    <input
                      aria-label={t("workout_builder.session.prescription_cooldown_label")}
                      className="h-2 w-full cursor-pointer accent-indigo-500"
                      disabled={!cooldownRoutineEnabled}
                      max={4}
                      min={1}
                      onChange={(event) => {
                        pendingCooldownExerciseCountRef.current = Number(event.target.value);
                        setCooldownExerciseCount(Number(event.target.value));
                      }}
                      onBlur={commitCooldownExerciseCountFromSlider}
                      onKeyUp={commitCooldownExerciseCountFromSlider}
                      onMouseUp={commitCooldownExerciseCountFromSlider}
                      onPointerUp={commitCooldownExerciseCountFromSlider}
                      onPointerDown={() => {
                        pendingCooldownExerciseCountRef.current = cooldownExerciseCount;
                      }}
                      onTouchEnd={commitCooldownExerciseCountFromSlider}
                      step={1}
                      type="range"
                      value={cooldownExerciseCount}
                    />
                  </div>
                  {cooldownHoldSecondsOptions.map((seconds) => (
                    <Button
                      className={
                        cooldownRoutineEnabled && cooldownHoldSeconds === seconds
                          ? "bg-indigo-600 text-white"
                          : "bg-slate-100 text-slate-700"
                      }
                      disabled={!cooldownRoutineEnabled}
                      key={`cooldown-hold-${seconds}`}
                      onClick={() => setCooldownHoldSeconds(seconds)}
                      size="small"
                      variant="outline"
                    >
                      {seconds}
                      {t("workout_builder.session.time_unit_seconds")}
                    </Button>
                  ))}
                  <div className="w-full px-1 mt-2">
                    <div className="mb-1 text-[11px] text-indigo-900/80 dark:text-indigo-200/80">
                      {cooldownHoldSeconds}
                      {t("workout_builder.session.time_unit_seconds")}
                    </div>
                    <div className="mb-2 flex items-center gap-2">
                      <Button
                        className="h-7 px-2 rounded-full text-[11px] bg-slate-100 text-slate-700"
                        disabled={!cooldownRoutineEnabled || cooldownHoldSeconds <= 20}
                        onClick={() => adjustCooldownHoldSeconds(-5)}
                        size="small"
                        type="button"
                        variant="outline"
                      >
                        -5
                      </Button>
                      <Button
                        className="h-7 px-2 rounded-full text-[11px] bg-slate-100 text-slate-700"
                        disabled={!cooldownRoutineEnabled || cooldownHoldSeconds >= 40}
                        onClick={() => adjustCooldownHoldSeconds(5)}
                        size="small"
                        type="button"
                        variant="outline"
                      >
                        +5
                      </Button>
                    </div>
                    <input
                      aria-label={t("workout_builder.session.prescription_cooldown_label")}
                      className="h-2 w-full cursor-pointer accent-indigo-500"
                      disabled={!cooldownRoutineEnabled}
                      max={40}
                      min={20}
                      onChange={(event) => {
                        pendingCooldownHoldSecondsRef.current = Number(event.target.value);
                        setCooldownHoldSeconds(Number(event.target.value));
                      }}
                      onBlur={commitCooldownHoldSecondsFromSlider}
                      onKeyUp={commitCooldownHoldSecondsFromSlider}
                      onMouseUp={commitCooldownHoldSecondsFromSlider}
                      onPointerUp={commitCooldownHoldSecondsFromSlider}
                      onPointerDown={() => {
                        pendingCooldownHoldSecondsRef.current = cooldownHoldSeconds;
                      }}
                      onTouchEnd={commitCooldownHoldSecondsFromSlider}
                      step={1}
                      type="range"
                      value={cooldownHoldSeconds}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <StepperHeader currentStep={currentStep} onStepClick={handleStepClick} steps={steps} />

      <div className="px-2 sm:px-6" ref={stepperContentRef}>
        {renderStepContent()}
      </div>

      <WorkoutBuilderFooter
        bottomBanner={renderBottomBanner()}
        canContinue={canContinue}
        currentStep={currentStep}
        onNext={nextStep}
        onPrevious={prevStep}
        onStartWorkout={handleStartWorkout}
        totalSteps={STEPPER_STEPS.length}
      />

      <AddExerciseModal isOpen={addExerciseModal.value} onClose={addExerciseModal.setFalse} selectedEquipment={selectedEquipment} />
    </div>
  );
}
