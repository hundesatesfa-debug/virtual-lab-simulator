export function scoreRun({ attempts, elapsedSeconds, accuracy }) {
  const speedScore = Math.max(0, 100 - Math.floor(elapsedSeconds / 3));
  const attemptPenalty = Math.min(40, attempts * 8);
  const score = Math.max(0, Math.floor((accuracy * 0.6 + speedScore * 0.4) - attemptPenalty));
  const grade = score >= 85 ? "A" : score >= 70 ? "B" : score >= 55 ? "C" : "Needs Practice";
  return { score, grade };
}
