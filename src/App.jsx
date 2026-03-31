import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ThemeProvider, useTheme } from "./context/ThemeContext";
import { ProgressProvider, useProgress } from "./context/ProgressContext";
import { experiments } from "./data/experiments";
import Dashboard from "./components/Dashboard";
import LabScene from "./components/LabScene";
import TutorPanel from "./components/TutorPanel";
import AssessmentPanel from "./components/AssessmentPanel";
import VoiceControls from "./components/VoiceControls";
import { getAdaptiveHint } from "./utils/tutor";

function Header({ selected, setSelected, assessmentMode, setAssessmentMode }) {
  const { theme, toggleTheme } = useTheme();
  const { progress } = useProgress();
  const current = experiments.find((item) => item.id === selected) ?? experiments[0];

  return (
    <header className="topbar glass">
      <div>
        <h1>Virtual Physics Lab</h1>
        <p>Interactive experiments for Grade 9-12</p>
      </div>
      <div className="topbar-actions">
        <button className="btn" onClick={() => setAssessmentMode(!assessmentMode)}>
          {assessmentMode ? "✕ Exit Challenge" : "⚡ Challenge Mode"}
        </button>
        <button className="btn btn-neon" onClick={toggleTheme}>
          {theme === "dark" ? "☀" : "🌙"} {theme === "dark" ? "Light" : "Dark"}
        </button>
      </div>
      <div className="meta">
        <span>Level: {progress.level}</span>
        <span>Badges: {progress.badges.length}</span>
        <span>Running: {current.title}</span>
      </div>
    </header>
  );
}

function LabApp() {
  const [selected, setSelected] = useState(experiments[0].id);
  const [runKey, setRunKey] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [startTime, setStartTime] = useState(Date.now());
  const [assessmentMode, setAssessmentMode] = useState(false);
  const [mistakeCount, setMistakeCount] = useState(0);
  const [lastFeedback, setLastFeedback] = useState("");
  const [slowMotion, setSlowMotion] = useState(false);

  const selectedExperiment = experiments.find((exp) => exp.id === selected) ?? experiments[0];
  const hint = useMemo(
    () => getAdaptiveHint(selectedExperiment.id, mistakeCount, assessmentMode),
    [selectedExperiment.id, mistakeCount, assessmentMode]
  );

  const onSwitchExperiment = (id) => {
    setSelected(id);
    setRunKey((k) => k + 1);
    setAttempts(0);
    setMistakeCount(0);
    setStartTime(Date.now());
    setLastFeedback("");
  };

  return (
    <div className={`app-shell ${slowMotion ? "slow-motion" : ""}`}>
      <Header
        selected={selected}
        setSelected={setSelected}
        assessmentMode={assessmentMode}
        setAssessmentMode={setAssessmentMode}
      />
      <div className="utility-row">
        <button className="btn" onClick={() => setRunKey((k) => k + 1)}>
          ↻ Replay
        </button>
        <button className="btn" onClick={() => setSlowMotion((v) => !v)}>
          {slowMotion ? "▶ Normal" : "◐ Slow-Mo"}
        </button>
      </div>
      <main className="layout">
        <Dashboard
          selected={selected}
          onSelect={onSwitchExperiment}
          assessmentMode={assessmentMode}
        />
        <section className={`workbench ${selectedExperiment.id === "spaceMission" ? "workbench--space" : ""}`}>
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedExperiment.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="glass experiment-card"
            >
              <selectedExperiment.component
                key={`${selectedExperiment.id}-${runKey}`}
                assessmentMode={assessmentMode}
                attempts={attempts}
                setAttempts={setAttempts}
                setMistakeCount={setMistakeCount}
                setLastFeedback={setLastFeedback}
                startTime={startTime}
                slowMotion={slowMotion}
              />
            </motion.div>
          </AnimatePresence>
          <VoiceControls text={`${selectedExperiment.title}. ${hint}`} />
        </section>
        <aside className="sidebar">
          <TutorPanel
            hint={hint}
            feedback={lastFeedback}
            assessmentMode={assessmentMode}
            onELI5={() =>
              setLastFeedback(
                "ELI5: Think of this experiment like a game where changing one knob changes another result."
              )
            }
          />
          <AssessmentPanel
            experiment={selectedExperiment}
            attempts={attempts}
            elapsedSeconds={Math.round((Date.now() - startTime) / 1000)}
            assessmentMode={assessmentMode}
          />
        </aside>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ProgressProvider>
        <LabApp />
      </ProgressProvider>
    </ThemeProvider>
  );
}
