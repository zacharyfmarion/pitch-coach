import { useCallback, useEffect, useState } from "react";
import type { ExerciseId } from "../domain/contracts";
import { isExerciseId } from "../domain/exercise";

const APP_BASE_PATH = normalizeBasePath(import.meta.env.BASE_URL);

export type AppRoute =
  | {
      screen: "library";
      fromAppNavigation: boolean;
    }
  | {
      screen: "practice";
      exerciseId: ExerciseId;
      fromAppNavigation: boolean;
    }
  | {
      screen: "songs";
      fromAppNavigation: boolean;
    };

type RouteLocation =
  | {
      screen: "library";
    }
  | {
      screen: "practice";
      exerciseId: ExerciseId;
    }
  | {
      screen: "songs";
    };

type ParsedRoute = {
  route: RouteLocation;
  invalid: boolean;
};

type PitchCoachHistoryState = {
  pitchCoach?: {
    fromAppNavigation: boolean;
  };
};

export function usePitchCoachRouter() {
  const [route, setRoute] = useState<AppRoute>(() => readCurrentRoute());

  useEffect(() => {
    const syncRoute = () => {
      const parsed = parsePathname(window.location.pathname);
      if (parsed.invalid) {
        window.history.replaceState(createHistoryState(false), "", routePath({ screen: "library" }));
        setRoute({
          screen: "library",
          fromAppNavigation: false
        });
        return;
      }

      if (!isPitchCoachHistoryState(window.history.state)) {
        window.history.replaceState(
          createHistoryState(false),
          "",
          routePath(parsed.route)
        );
      }

      setRoute(readCurrentRoute());
    };

    syncRoute();
    window.addEventListener("popstate", syncRoute);
    return () => window.removeEventListener("popstate", syncRoute);
  }, []);

  const navigateToLibrary = useCallback((options: { replace?: boolean } = {}) => {
    const nextRoute = {
      screen: "library" as const,
      fromAppNavigation: true
    };
    const state = createHistoryState(true);
    if (options.replace) {
      window.history.replaceState(state, "", routePath({ screen: "library" }));
    } else {
      window.history.pushState(state, "", routePath({ screen: "library" }));
    }
    setRoute(nextRoute);
  }, []);

  const navigateToExercise = useCallback(
    (exerciseId: ExerciseId, options: { replace?: boolean; fromAppNavigation?: boolean } = {}) => {
      const nextRoute = {
        screen: "practice" as const,
        exerciseId,
        fromAppNavigation: options.fromAppNavigation ?? true
      };
      const state = createHistoryState(nextRoute.fromAppNavigation);
      const path = routePath({ screen: "practice", exerciseId });
      if (options.replace) {
        window.history.replaceState(state, "", path);
      } else {
        window.history.pushState(state, "", path);
      }
      setRoute(nextRoute);
    },
    []
  );

  const navigateToSongs = useCallback((options: { replace?: boolean } = {}) => {
    const nextRoute = {
      screen: "songs" as const,
      fromAppNavigation: true
    };
    const state = createHistoryState(true);
    if (options.replace) {
      window.history.replaceState(state, "", routePath({ screen: "songs" }));
    } else {
      window.history.pushState(state, "", routePath({ screen: "songs" }));
    }
    setRoute(nextRoute);
  }, []);

  const goBackToLibraryFallback = useCallback(() => {
    if ((route.screen === "practice" || route.screen === "songs") && route.fromAppNavigation) {
      window.history.back();
      return;
    }

    navigateToLibrary({ replace: true });
  }, [navigateToLibrary, route]);

  return {
    route,
    navigateToLibrary,
    navigateToExercise,
    navigateToSongs,
    goBackToLibraryFallback
  };
}

function readCurrentRoute(): AppRoute {
  const parsed = parsePathname(window.location.pathname);
  if (parsed.invalid) {
    return {
      screen: "library",
      fromAppNavigation: false
    };
  }

  return {
    ...parsed.route,
    fromAppNavigation: isPitchCoachHistoryState(window.history.state)
      ? window.history.state.pitchCoach.fromAppNavigation
      : false
  };
}

function parsePathname(pathname: string): ParsedRoute {
  const appPathname = stripAppBase(pathname);

  if (appPathname === "/" || appPathname === "") {
    return {
      route: { screen: "library" },
      invalid: false
    };
  }

  if (appPathname === "/songs" || appPathname === "/songs/") {
    return {
      route: { screen: "songs" },
      invalid: false
    };
  }

  const exerciseMatch = appPathname.match(/^\/exercises\/([^/]+)\/?$/);
  if (!exerciseMatch) {
    return {
      route: { screen: "library" },
      invalid: true
    };
  }

  let exerciseId: string;
  try {
    exerciseId = decodeURIComponent(exerciseMatch[1]);
  } catch {
    return {
      route: { screen: "library" },
      invalid: true
    };
  }

  if (!isExerciseId(exerciseId)) {
    return {
      route: { screen: "library" },
      invalid: true
    };
  }

  return {
    route: {
      screen: "practice",
      exerciseId
    },
    invalid: false
  };
}

function routePath(route: RouteLocation) {
  const pathname =
    route.screen === "library" ? "/" : route.screen === "songs" ? "/songs" : `/exercises/${route.exerciseId}`;
  return withAppBase(pathname);
}

function createHistoryState(fromAppNavigation: boolean): PitchCoachHistoryState {
  return {
    pitchCoach: {
      fromAppNavigation
    }
  };
}

function isPitchCoachHistoryState(value: unknown): value is Required<PitchCoachHistoryState> {
  return (
    typeof value === "object" &&
    value !== null &&
    "pitchCoach" in value &&
    typeof (value as PitchCoachHistoryState).pitchCoach?.fromAppNavigation === "boolean"
  );
}

function normalizeBasePath(baseUrl: string) {
  const pathname = new URL(baseUrl, "https://pitch-coach.local").pathname;
  if (!pathname || pathname === "/") {
    return "/";
  }

  return pathname.endsWith("/") ? pathname : `${pathname}/`;
}

function stripAppBase(pathname: string) {
  if (APP_BASE_PATH === "/") {
    return pathname || "/";
  }

  const baseWithoutTrailingSlash = APP_BASE_PATH.replace(/\/$/, "");
  if (pathname === baseWithoutTrailingSlash) {
    return "/";
  }

  if (pathname.startsWith(`${baseWithoutTrailingSlash}/`)) {
    return pathname.slice(baseWithoutTrailingSlash.length) || "/";
  }

  return pathname;
}

function withAppBase(pathname: string) {
  if (APP_BASE_PATH === "/") {
    return pathname;
  }

  if (pathname === "/" || pathname === "") {
    return APP_BASE_PATH;
  }

  return `${APP_BASE_PATH.replace(/\/$/, "")}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
}
