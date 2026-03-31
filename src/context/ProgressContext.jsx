import { createContext, useContext, useMemo, useState } from "react";

const ProgressContext = createContext(null);

export function ProgressProvider({ children }) {
  const [progress, setProgress] = useState({
    points: 0,
    level: 1,
    badges: ["Starter Scientist"]
  });

  const value = useMemo(
    () => ({
      progress,
      completeExperiment: (score) =>
        setProgress((prev) => {
          const points = prev.points + score;
          const level = Math.min(10, Math.floor(points / 100) + 1);
          const badges = [...prev.badges];
          if (score > 80 && !badges.includes("Precision Pro")) badges.push("Precision Pro");
          return { points, level, badges };
        })
    }),
    [progress]
  );

  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>;
}

export function useProgress() {
  const context = useContext(ProgressContext);
  if (!context) throw new Error("useProgress must be used in ProgressProvider");
  return context;
}
