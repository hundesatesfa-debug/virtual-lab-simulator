import { scoreRun } from "../utils/assessment";

export default function AssessmentPanel({ experiment, attempts, elapsedSeconds, assessmentMode }) {
  const result = scoreRun({ attempts, elapsedSeconds, accuracy: Math.max(50, 100 - attempts * 12) });

  return (
    <section className="glass panel">
      <h3>Assessment</h3>
      <p>{assessmentMode ? "Challenge mode active: no hints." : "Practice mode: hints enabled."}</p>
      <ul className="stat-list">
        <li>Experiment: {experiment.title}</li>
        <li>Attempts: {attempts}</li>
        <li>Time: {elapsedSeconds}s</li>
        <li>Score: {result.score}</li>
        <li>Grade: {result.grade}</li>
      </ul>
    </section>
  );
}
