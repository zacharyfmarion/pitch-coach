import { useEffect } from "react";
import { ExerciseLibraryScreen } from "../features/exercises/ExerciseLibraryScreen";
import { ExercisePracticeScreen } from "../features/exercises/ExercisePracticeScreen";
import { SongPracticeScreen } from "../features/songs/SongPracticeScreen";
import type { SongModeServices } from "../song/types";
import { usePitchCoachTheme } from "./theme";
import { usePitchCoachController, type PitchCoachControllerOptions } from "./usePitchCoachController";
import { usePitchCoachRouter } from "./routes";

export type PitchCoachAppProps = PitchCoachControllerOptions & {
  songServices?: SongModeServices;
};

export function PitchCoachApp(props: PitchCoachAppProps) {
  const router = usePitchCoachRouter();

  if (router.route.screen === "songs") {
    return (
      <SongPracticeScreen
        services={props.songServices}
        onBackToLibrary={() => router.goBackToLibraryFallback()}
      />
    );
  }

  const { songServices: _songServices, ...coachOptions } = props;
  return <ExercisePracticeApp router={router} coachOptions={coachOptions} />;
}

type ExercisePracticeAppProps = {
  router: ReturnType<typeof usePitchCoachRouter>;
  coachOptions: PitchCoachControllerOptions;
};

function ExercisePracticeApp({ router, coachOptions }: ExercisePracticeAppProps) {
  const coach = usePitchCoachController({
    ...coachOptions,
    initialExerciseId: router.route.screen === "practice" ? router.route.exerciseId : undefined
  });
  const activeTheme = usePitchCoachTheme(coach.settings.themePreference);

  useEffect(() => {
    if (
      router.route.screen === "practice" &&
      router.route.exerciseId !== coach.selectedExercise.id
    ) {
      coach.selectExercise(router.route.exerciseId);
    }
  }, [coach.selectedExercise.id, coach.selectExercise, router.route]);

  useEffect(() => {
    if (router.route.screen === "library") {
      void coach.stopAttempt();
    }
  }, [coach.stopAttempt, router.route.screen]);

  const openExercise = (exerciseId: (typeof coach.exercises)[number]["id"]) => {
    if (router.route.screen === "practice" && exerciseId === coach.selectedExercise.id) {
      return;
    }

    coach.selectExercise(exerciseId);
    router.navigateToExercise(exerciseId, {
      replace: router.route.screen === "practice",
      fromAppNavigation:
        router.route.screen === "practice" ? router.route.fromAppNavigation : true
    });
  };

  const backToLibrary = async () => {
    await coach.stopAttempt();
    router.goBackToLibraryFallback();
  };

  if (router.route.screen === "library") {
    return (
      <ExerciseLibraryScreen
        coach={coach}
        onOpenExercise={openExercise}
        onOpenSongs={() => router.navigateToSongs()}
      />
    );
  }

  return (
    <ExercisePracticeScreen
      coach={coach}
      activeThemeName={activeTheme.name}
      onBackToLibrary={backToLibrary}
      onOpenExercise={openExercise}
    />
  );
}
