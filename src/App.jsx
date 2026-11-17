import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ThemeProvider, useTheme } from "./context/ThemeContext";
import { ProgressProvider, useProgress } from "./context/ProgressContext";
import { experiments } from "./data/experiments";
import Dashboard from "./components/Dashboard";
import TutorPanel from "./components/TutorPanel";
import AssessmentPanel from "./components/AssessmentPanel";
import VoiceControls from "./components/VoiceControls";
import { getAdaptiveHint } from "./utils/tutor";

function Header({
  selected,
  menuOpen,
  setMenuOpen,
  assessmentMode,
  setAssessmentMode,
  slowMotion,
  setSlowMotion,
  onReplay,
  insightsOpen,
  setInsightsOpen
}) {
  const { theme, toggleTheme } = useTheme();
  const { progress } = useProgress();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const current = experiments.find((item) => item.id === selected) ?? experiments[0];

  return (
    <header className="topbar glass">
      <button
        className="menu-trigger"
        type="button"
        aria-label="Browse experiments"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((open) => !open)}
      >
        <span className="menu-glyph" aria-hidden="true"><i /><i /><i /></span>
        <span className="menu-trigger-label">Experiments</span>
      </button>

      <div className="brand-lockup" aria-label="Virtual Physics Lab">
        <span className="brand-mark" aria-hidden="true">V</span>
        <span className="brand-name">Virtual Physics Lab</span>
      </div>

      <div className="topbar-divider" />

      <div className="current-context">
        <span className="context-label">CURRENT SIMULATION</span>
        <strong title={current.title}>{current.title}</strong>
      </div>

      <div className="topbar-right">
        <div className="system-status"><span /> Simulation ready</div>
        <span className="level-chip" title={`${progress.badges.length} badges`}>
          <span>LVL</span> {progress.level}
        </span>
        <button
          className={`icon-button ${insightsOpen ? "is-active" : ""}`}
          type="button"
          aria-label="Toggle learning insights"
          aria-expanded={insightsOpen}
          title="Learning insights"
          onClick={() => setInsightsOpen((open) => !open)}
        >
          <span aria-hidden="true">▤</span>
        </button>
        <div className="settings-wrap">
          <button
            className={`icon-button ${settingsOpen ? "is-active" : ""}`}
            type="button"
            aria-label="Settings"
            aria-expanded={settingsOpen}
            title="Settings"
            onClick={() => setSettingsOpen((open) => !open)}
          >
            <span aria-hidden="true">⚙</span>
          </button>
          <AnimatePresence>
            {settingsOpen && (
              <motion.div
                className="settings-menu"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15 }}
              >
                <span className="popover-heading">SIMULATION SETTINGS</span>
                <button type="button" className="settings-item" onClick={toggleTheme}>
                  <span>{theme === "dark" ? "Light appearance" : "Dark appearance"}</span>
                  <span className="settings-value">{theme === "dark" ? "☼" : "◐"}</span>
                </button>
                <button
                  type="button"
                  className="settings-item"
                  onClick={() => setAssessmentMode((active) => !active)}
                >
                  <span>Challenge mode</span>
                  <span className={`setting-switch ${assessmentMode ? "on" : ""}`} />
                </button>
                <button
                  type="button"
                  className="settings-item"
                  onClick={() => setSlowMotion((active) => !active)}
                >
                  <span>Slow motion</span>
                  <span className={`setting-switch ${slowMotion ? "on" : ""}`} />
                </button>
                <div className="settings-separator" />
                <button
                  type="button"
                  className="settings-item"
                  onClick={() => {
                    onReplay();
                    setSettingsOpen(false);
                  }}
                >
                  <span>Restart simulation</span>
                  <span className="settings-value" aria-hidden="true">↻</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [insightsOpen, setInsightsOpen] = useState(false);

  const selectedExperiment = experiments.find((exp) => exp.id === selected) ?? experiments[0];
  const hint = useMemo(
    () => getAdaptiveHint(selectedExperiment.id, mistakeCount, assessmentMode),
    [selectedExperiment.id, mistakeCount, assessmentMode]
  );

  const onSwitchExperiment = (id) => {
    setSelected(id);
    setRunKey((key) => key + 1);
    setAttempts(0);
    setMistakeCount(0);
    setStartTime(Date.now());
    setLastFeedback("");
    setMenuOpen(false);
    setInsightsOpen(false);
  };

  const replay = () => {
    setRunKey((key) => key + 1);
    setAttempts(0);
    setMistakeCount(0);
    setStartTime(Date.now());
    setLastFeedback("");
  };

  return (
    <div className={`app-shell ${slowMotion ? "slow-motion" : ""}`}>
      <Header
        selected={selected}
        menuOpen={menuOpen}
        setMenuOpen={setMenuOpen}
        assessmentMode={assessmentMode}
        setAssessmentMode={setAssessmentMode}
        slowMotion={slowMotion}
        setSlowMotion={setSlowMotion}
        onReplay={replay}
        insightsOpen={insightsOpen}
        setInsightsOpen={setInsightsOpen}
      />

      <AnimatePresence>
        {menuOpen && (
          <div className="drawer-layer">
            <motion.button
              className="drawer-backdrop"
              type="button"
              aria-label="Close experiment menu"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMenuOpen(false)}
            />
            <Dashboard
              selected={selected}
              onSelect={onSwitchExperiment}
              assessmentMode={assessmentMode}
              onClose={() => setMenuOpen(false)}
            />
          </div>
        )}
      </AnimatePresence>

      <main className={`layout ${insightsOpen ? "layout--insights" : ""}`}>
        <section
          className={`workbench ${selectedExperiment.id === "spaceMission" ? "workbench--space" : ""}`}
          aria-label={`${selectedExperiment.title} workspace`}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedExperiment.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="glass experiment-card"
            >
              <selectedExperiment.component
                key={`${selectedExperiment.id}-${runKey}`}
                blueprint={selectedExperiment.blueprint}
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

        <AnimatePresence>
          {insightsOpen && (
            <motion.aside
              className="sidebar insights-panel"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ duration: 0.18 }}
            >
              <div className="insights-heading">
                <div>
                  <span className="context-label">LEARNING TOOLS</span>
                  <h2>Insights</h2>
                </div>
                <button
                  className="icon-button"
                  type="button"
                  aria-label="Close learning insights"
                  onClick={() => setInsightsOpen(false)}
                >
                  ×
                </button>
              </div>
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
            </motion.aside>
          )}
        </AnimatePresence>
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
