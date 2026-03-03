import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "./AuthContext";

export type ActivityItem = {
  id: string;
  type: string;
  action: string;
  name: string;
  date: string;
};

type ActivityContextType = {
  activities: ActivityItem[];
  recordActivity: (activity: Omit<ActivityItem, "id" | "date"> & { id?: string; date?: string }) => void;
  clearActivities: () => void;
};

const ActivityContext = createContext<ActivityContextType | undefined>(undefined);

function storageKey(userId: string) {
  return `sb_recent_activity:${userId}`;
}

export function ActivityProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [activities, setActivities] = useState<ActivityItem[]>([]);

  useEffect(() => {
    if (!user?.id) {
      setActivities([]);
      return;
    }

    try {
      const raw = localStorage.getItem(storageKey(user.id));
      const parsed = raw ? JSON.parse(raw) : [];
      setActivities(Array.isArray(parsed) ? parsed : []);
    } catch {
      setActivities([]);
    }
  }, [user?.id]);

  const persist = (next: ActivityItem[]) => {
    setActivities(next);
    if (!user?.id) return;
    localStorage.setItem(storageKey(user.id), JSON.stringify(next));
  };

  const value = useMemo<ActivityContextType>(
    () => ({
      activities,
      recordActivity: (activity) => {
        const nextItem: ActivityItem = {
          id: activity.id ?? `${activity.type}:${activity.action}:${activity.name}:${Date.now()}`,
          type: activity.type,
          action: activity.action,
          name: activity.name,
          date: activity.date ?? new Date().toISOString(),
        };

        const deduped = activities.filter((item) => item.id !== nextItem.id);
        persist([nextItem, ...deduped].slice(0, 50));
      },
      clearActivities: () => persist([]),
    }),
    [activities, user?.id]
  );

  return <ActivityContext.Provider value={value}>{children}</ActivityContext.Provider>;
}

export function useActivity() {
  const context = useContext(ActivityContext);
  if (!context) {
    throw new Error("useActivity must be used within an ActivityProvider");
  }
  return context;
}
