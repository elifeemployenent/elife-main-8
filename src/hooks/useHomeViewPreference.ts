import { useCallback, useEffect, useState } from "react";
import {
  HOME_VIEW_CHANGE_EVENT,
  HOME_VIEW_STORAGE_KEY,
  type HomeView,
  readHomeViewPreference,
  saveHomeViewPreference,
} from "@/lib/homeViewPreference";

export function useHomeViewPreference() {
  const [view, setViewState] = useState<HomeView>(readHomeViewPreference);

  useEffect(() => {
    const updateFromStorage = () => setViewState(readHomeViewPreference());
    const updateFromOtherTab = (event: StorageEvent) => {
      if (event.key === HOME_VIEW_STORAGE_KEY || event.key === null) updateFromStorage();
    };

    window.addEventListener(HOME_VIEW_CHANGE_EVENT, updateFromStorage);
    window.addEventListener("storage", updateFromOtherTab);
    return () => {
      window.removeEventListener(HOME_VIEW_CHANGE_EVENT, updateFromStorage);
      window.removeEventListener("storage", updateFromOtherTab);
    };
  }, []);

  const setView = useCallback((nextView: HomeView) => {
    setViewState(nextView);
    saveHomeViewPreference(nextView);
  }, []);

  return { view, setView };
}