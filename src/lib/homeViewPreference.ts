export type HomeView = "virtual-office" | "classic";

export const HOME_VIEW_STORAGE_KEY = "elife_home_view";
export const HOME_VIEW_CHANGE_EVENT = "elife:home-view-change";
export const HOME_PANCHAYATH_STORAGE_KEY = "elife_home_panchayath";

export interface PanchayathLinkOption {
  id: string;
  name: string;
  code?: string | null;
}

export function parseHomeViewPreference(value: string | null): HomeView {
  return value === "classic" ? "classic" : "virtual-office";
}

export function readHomeViewPreference(): HomeView {
  try {
    return parseHomeViewPreference(window.localStorage.getItem(HOME_VIEW_STORAGE_KEY));
  } catch {
    return "virtual-office";
  }
}

export function saveHomeViewPreference(view: HomeView): void {
  try {
    window.localStorage.setItem(HOME_VIEW_STORAGE_KEY, view);
    window.dispatchEvent(new Event(HOME_VIEW_CHANGE_EVENT));
  } catch {
    // Keep the selected view usable when browser storage is unavailable.
  }
}

export function readHomePanchayathPreference(): string | null {
  try {
    return window.localStorage.getItem(HOME_PANCHAYATH_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function saveHomePanchayathPreference(panchayathId: string): void {
  try {
    window.localStorage.setItem(HOME_PANCHAYATH_STORAGE_KEY, panchayathId);
  } catch {
    // The current selection remains usable for this visit.
  }
}

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function resolveDirectPanchayath<T extends PanchayathLinkOption>(
  value: string | null,
  options: T[],
): T | null {
  const requested = value?.trim().toLowerCase();
  if (!requested) return null;

  const requestedSlug = slugify(requested);
  return options.find((option) => {
    const code = option.code?.trim().toLowerCase();
    return (
      option.id.toLowerCase() === requested ||
      code === requested ||
      option.name.trim().toLowerCase() === requested ||
      slugify(option.name) === requestedSlug
    );
  }) ?? null;
}