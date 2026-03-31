export default function TutorPanel({ hint, feedback, assessmentMode, onELI5 }) {
  return (
    <section className="glass panel">
      <h3>Smart Tutor</h3>
      <p>{assessmentMode ? "Hints are minimized in challenge mode." : hint}</p>
      {feedback && <div className="feedback">{feedback}</div>}
      <div className="panel-actions">
        <button className="btn" onClick={onELI5}>
          Explain Like I am 5
        </button>
      </div>
    </section>
  );
}
