"use client";

import { useWorkoutBuilderStore } from "../model/workout-builder.store";

export function useWorkoutStepper() {
  const {
    currentStep,
    selectedEquipment,
    selectedMuscles,
    selectedGoal,
    selectedDaysPerWeek,
    exercisesByMuscle,
    isLoadingExercises,
    exercisesError,
    exercisesOrder,
    shufflingExerciseId,
    setStep,
    nextStep,
    prevStep,
    toggleEquipment,
    clearEquipment,
    toggleMuscle,
    clearMuscles,
    setGoal,
    setDaysPerWeek,
    fetchExercises,
    setExercisesOrder,
    shuffleExercise,
    pickExercise,
    deleteExercise,
    loadFromSession,
  } = useWorkoutBuilderStore();

  const canProceedToStep2 = selectedEquipment.length > 0;
  const canProceedToStep3 = selectedMuscles.length > 0;

  return {
    currentStep,
    selectedEquipment,
    selectedMuscles,
    selectedGoal,
    selectedDaysPerWeek,
    exercisesByMuscle,
    isLoadingExercises,
    exercisesError,
    goToStep: setStep,
    nextStep,
    prevStep,
    toggleEquipment,
    clearEquipment,
    toggleMuscle,
    clearMuscles,
    setGoal,
    setDaysPerWeek,
    canProceedToStep2,
    canProceedToStep3,
    fetchExercises,
    exercisesOrder,
    setExercisesOrder,
    shuffleExercise,
    shufflingExerciseId,
    pickExercise,
    deleteExercise,
    loadFromSession,
  };
}
