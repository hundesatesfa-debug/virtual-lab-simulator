import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import ControlRow from "../components/ControlRow";
import InstructionSteps from "../components/InstructionSteps";
import SpaceMissionCanvas from "./space/SpaceMissionCanvas.jsx";
import { CAMERA_MODES, MISSION_TYPES, ROCKET_DEFAULTS } from "./space/constants.js";
import {
  computeSuccessProbability,
  createInitialState,
  gravitationalInfluence,
  interceptHint,
  predictTrajectory
} from "./space/physics.js";
import * as THREE from "three";

const steps = ["Plan mission", "Configure launch", "Ignition & ascent", "Rendezvous or landing"];

const missionLabels = {
  [MISSION_TYPES.station]: "Dock with Space Station (LEO)",
  [MISSION_TYPES.moonOrbit]: "Lunar orbit insertion",
  [MISSION_TYPES.moonLand]: "Land on the Moon",
  [MISSION_TYPES.mars]: "Mars transfer & capture"
};

function speak(text) {
  if (typeof window !== "undefined" && window.speechSynthesis) {
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.05;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  }
}

function playRumble() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.value = 62;
    gain.gain.value = 0.06;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
    osc.stop(ctx.currentTime + 1.2);
  } catch {
    /* ignore */
  }
}

/* ─── Full-screen flight view ─── */
function FlightView({
  stateRef, controlsRef, cameraMode, setCameraMode,
  earthTick, showGhost, ghostPoints, trailPoints,
  thrustOn, setThrustOn, replayMode, showSceneGrid, setShowSceneGrid,
  rocketVisual, sim, successPct, onExit,
  manualSeparate, correctionBurn, setCorrectionBurn,
  rotateRate, setRotateRate, autoStage, setAutoStage,
  autoStab, setAutoStab, timeWarp, setTimeWarp,
  slowMotion, speed, accel, distTarget, alignment, grav,
  hint, explainBeginner, setExplainBeginner, beginnerText,
  setMistakeCount, setLastFeedback, replay, resetSim,
  showHud, setShowHud
}) {
  return (
    <div className={`fullscreen-overlay ${!showHud ? "hud-minimized" : ""}`}>
      <div className="fullscreen-canvas-area">
        <SpaceMissionCanvas
          stateRef={stateRef}
          controlsRef={controlsRef}
          cameraMode={cameraMode}
          earthRotation={earthTick * 0.012}
          showGhost={showGhost && sim?.status === "planning"}
          ghostPoints={ghostPoints}
          trailPoints={trailPoints}
          thrustOn={thrustOn}
          replayMode={replayMode}
          showSceneGrid={showSceneGrid}
          rocketVisual={rocketVisual}
        />
        <div className="fullscreen-hud">
          {/* Top bar */}
          <div className="hud-top">
            <h2>Space Mission — {sim?.status === "flight" ? "IN FLIGHT" : sim?.status === "success" ? "MISSION SUCCESS" : sim?.status === "failed" ? "MISSION FAILED" : "LAUNCH READY"}</h2>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button className="btn btn-neon mobile-only" onClick={() => setShowHud(!showHud)}>
                {showHud ? "👁 Hide HUD" : "👁 Show HUD"}
              </button>
              <button className="btn btn-neon" onClick={onExit}>✕ Exit to Setup</button>
            </div>
          </div>

          {showHud && (
            <>
              {/* Left: flight controls */}
              <div className="hud-left">
                <div className="hud-mini-control">
                  <label>Thrust</label>
                  <button
                    className={`btn ${thrustOn ? "btn-neon" : ""}`}
                    style={{ width: "100%", fontSize: "0.75rem" }}
                    onClick={() => setThrustOn(t => !t)}
                  >
                    {thrustOn ? "🔥 ON" : "OFF"}
                  </button>
                </div>
                <div className="hud-mini-control">
                  <button className="btn" style={{ width: "100%", fontSize: "0.75rem" }} onClick={manualSeparate}>
                    Stage Separate
                  </button>
                </div>
                <div className="hud-mini-control">
                  <button
                    className={`btn ${correctionBurn ? "btn-neon" : ""}`}
                    style={{ width: "100%", fontSize: "0.75rem" }}
                    onClick={() => setCorrectionBurn(c => !c)}
                  >
                    Mid-course Burn
                  </button>
                </div>
                <div className="hud-mini-control">
                  <label>Yaw: {rotateRate.toFixed(1)} rad/s</label>
                  <input type="range" min={-20} max={20} value={Math.round(rotateRate * 10)} onChange={e => setRotateRate(e.target.value / 10)} />
                </div>
                <div className="hud-mini-control">
                  <label style={{ cursor: "pointer", fontSize: "0.7rem" }}>
                    <input type="checkbox" checked={autoStage} onChange={e => setAutoStage(e.target.checked)} style={{ accentColor: "var(--neon)" }} /> Auto staging
                  </label>
                  <label style={{ cursor: "pointer", fontSize: "0.7rem" }}>
                    <input type="checkbox" checked={autoStab} onChange={e => setAutoStab(e.target.checked)} style={{ accentColor: "var(--neon)" }} /> Auto-stabilize
                  </label>
                </div>
                <div className="hud-mini-control">
                  <label>Camera</label>
                  <div style={{ display: "flex", gap: "0.25rem" }}>
                    {[{ m: CAMERA_MODES.orbit, l: "Free" }, { m: CAMERA_MODES.follow, l: "Chase" }, { m: CAMERA_MODES.ground, l: "Pad" }].map(c => (
                      <button key={c.m} className={`btn ${cameraMode === c.m ? "btn-neon" : ""}`} style={{ flex: 1, fontSize: "0.65rem", padding: "0.3rem" }} onClick={() => setCameraMode(c.m)}>{c.l}</button>
                    ))}
                  </div>
                </div>
                <div className="hud-mini-control">
                  <label>Time Warp</label>
                  <div style={{ display: "flex", gap: "0.25rem" }}>
                    {[1, 5, 10].map(w => (
                      <button key={w} className={`btn ${timeWarp === w ? "btn-neon" : ""}`} style={{ flex: 1, fontSize: "0.65rem", padding: "0.3rem" }} onClick={() => setTimeWarp(w)}>{w}x</button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right: coaching */}
              <div className="hud-right">
                <div className="hud-mini-control">
                  <label>Coaching</label>
                  <p style={{ fontSize: "0.72rem", margin: "0.25rem 0 0", color: "var(--text)", lineHeight: 1.3 }}>{hint}</p>
                </div>
                {sim?.status === "failed" && (
                  <div className="hud-mini-control" style={{ borderColor: "rgba(255, 68, 68, 0.4)" }}>
                    <p style={{ fontSize: "0.72rem", color: "var(--warning)", margin: 0 }}>{sim.failureReason || "Review launch window and thrust profile."}</p>
                  </div>
                )}
                {sim?.status === "success" && (
                  <div className="hud-mini-control" style={{ borderColor: "rgba(0, 255, 213, 0.4)" }}>
                    <p style={{ fontSize: "0.72rem", color: "var(--neon)", margin: 0 }}>🎉 Mission success — trajectory captured.</p>
                  </div>
                )}
                <div className="hud-mini-control">
                  <div style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap" }}>
                    <button className="btn" style={{ flex: 1, fontSize: "0.65rem", padding: "0.3rem" }} onClick={() => setExplainBeginner(v => !v)}>
                      {explainBeginner ? "Hide tip" : "Beginner tip"}
                    </button>
                    <button className="btn" style={{ flex: 1, fontSize: "0.65rem", padding: "0.3rem" }} onClick={replay}>
                      Replay
                    </button>
                    <button className="btn" style={{ flex: 1, fontSize: "0.65rem", padding: "0.3rem" }} onClick={resetSim}>
                      Reset
                    </button>
                  </div>
                </div>
                {explainBeginner && (
                  <div className="hud-mini-control">
                    <p style={{ fontSize: "0.68rem", margin: 0, color: "var(--muted)", lineHeight: 1.3 }}>{beginnerText}</p>
                  </div>
                )}
                <div className="hud-mini-control">
                  <label style={{ cursor: "pointer", fontSize: "0.7rem" }}>
                    <input type="checkbox" checked={showSceneGrid} onChange={e => setShowSceneGrid(e.target.checked)} style={{ accentColor: "var(--neon)" }} /> Floor grid
                  </label>
                </div>
              </div>

              {/* Bottom: telemetry HUD */}
              <div className="hud-bottom">
                <div className="hud-stats">
                  <div className="hud-stat">
                    <div className="hud-stat-label">Velocity</div>
                    <div className="hud-stat-value">{speed.toFixed(2)}<span className="hud-stat-unit">u/s</span></div>
                  </div>
                  <div className="hud-stat">
                    <div className="hud-stat-label">Accel</div>
                    <div className="hud-stat-value">{accel.toFixed(2)}<span className="hud-stat-unit">u/s²</span></div>
                  </div>
                  <div className="hud-stat">
                    <div className="hud-stat-label">Range</div>
                    <div className="hud-stat-value">{distTarget.toFixed(1)}<span className="hud-stat-unit">u</span></div>
                  </div>
                  <div className="hud-stat">
                    <div className="hud-stat-label">Fuel</div>
                    <div className="hud-stat-value">{sim ? ((sim.fuel / sim.fuelMax) * 100).toFixed(0) : 0}<span className="hud-stat-unit">%</span></div>
                  </div>
                  <div className="hud-stat">
                    <div className="hud-stat-label">Alignment</div>
                    <div className="hud-stat-value">{alignment.toFixed(1)}<span className="hud-stat-unit">°</span></div>
                  </div>
                  <div className="hud-stat">
                    <div className="hud-stat-label">Heat</div>
                    <div className="hud-stat-value">{sim ? (sim.heat * 100).toFixed(0) : 0}<span className="hud-stat-unit">%</span></div>
                  </div>
                  <div className="hud-stat">
                    <div className="hud-stat-label">Stage</div>
                    <div className="hud-stat-value">{sim?.stage ?? 1}</div>
                  </div>
                  <div className="hud-stat">
                    <div className="hud-stat-label">Success</div>
                    <div className="hud-stat-value">{successPct}<span className="hud-stat-unit">%</span></div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Main experiment component ─── */
export default function SpaceMissionExperiment({
  assessmentMode,
  setAttempts,
  setMistakeCount,
  setLastFeedback,
  slowMotion
}) {
  const [missionType, setMissionType] = useState(MISSION_TYPES.station);
  const [launchAngle, setLaunchAngle] = useState(48);
  const [launchTime, setLaunchTime] = useState(0.22);
  const [fuelAlloc, setFuelAlloc] = useState(0.72);
  const [payload, setPayload] = useState(4);
  const [stepIndex, setStepIndex] = useState(0);
  const [cameraMode, setCameraMode] = useState(CAMERA_MODES.orbit);
  const [showSceneGrid, setShowSceneGrid] = useState(true);
  const [stageThrust1, setStageThrust1] = useState(100);
  const [stageThrust2, setStageThrust2] = useState(100);
  const [stageThrust3, setStageThrust3] = useState(100);
  const [fuelS1, setFuelS1] = useState(40);
  const [fuelS2, setFuelS2] = useState(35);
  const [dragCoeff, setDragCoeff] = useState(1);
  const [lengthScale, setLengthScale] = useState(1);
  const [widthScale, setWidthScale] = useState(1);
  const [finCount, setFinCount] = useState(4);
  const [fairing, setFairing] = useState("standard");
  const [nose, setNose] = useState("cone");
  const [colBody, setColBody] = useState(ROCKET_DEFAULTS.visual.colors.body);
  const [colAccent, setColAccent] = useState(ROCKET_DEFAULTS.visual.colors.accent);
  const [colFairing, setColFairing] = useState(ROCKET_DEFAULTS.visual.colors.fairing);
  const [colBooster, setColBooster] = useState(ROCKET_DEFAULTS.visual.colors.booster);
  const [timeWarp, setTimeWarp] = useState(1);
  const [thrustOn, setThrustOn] = useState(false);
  const [autoStage, setAutoStage] = useState(true);
  const [autoStab, setAutoStab] = useState(true);
  const [correctionBurn, setCorrectionBurn] = useState(false);
  const [rotateRate, setRotateRate] = useState(0);
  const [explainBeginner, setExplainBeginner] = useState(false);
  const [showGhost, setShowGhost] = useState(true);
  const [replayMode, setReplayMode] = useState(false);
  const [earthTick, setEarthTick] = useState(0);
  const [uiTick, setUiTick] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const controlsRef = useRef({
    thrustRequested: false,
    manualStageSep: false,
    rotateYaw: 0,
    correctionBurn: false,
    timeWarp: 1
  });
  const lastVel = useRef(new THREE.Vector3());
  const replaySnapshots = useRef([]);
  const ghostRef = useRef([]);

  const stateRef = useRef(
    createInitialState({
      missionType: MISSION_TYPES.station,
      launchAngleDeg: 48,
      launchTimePhase: 0.22,
      fuelAllocation: 0.72,
      payloadWeight: 4,
      rocketConfig: {
        stageThrustPct: [100, 100, 100],
        stageFuelShare: [40, 35, 25],
        dragCoeff: 1,
        visual: ROCKET_DEFAULTS.visual
      }
    })
  );
  if (ghostRef.current.length === 0 && stateRef.current) {
    ghostRef.current = predictTrajectory(stateRef.current);
  }

  const rocketConfig = useMemo(
    () => ({
      stageThrustPct: [stageThrust1, stageThrust2, stageThrust3],
      stageFuelShare: [fuelS1, fuelS2, Math.max(5, 100 - fuelS1 - fuelS2)],
      dragCoeff,
      visual: {
        lengthScale, widthScale, finCount, fairing, nose,
        colors: { body: colBody, accent: colAccent, fairing: colFairing, booster: colBooster }
      }
    }),
    [stageThrust1, stageThrust2, stageThrust3, fuelS1, fuelS2, dragCoeff,
      lengthScale, widthScale, finCount, fairing, nose, colBody, colAccent, colFairing, colBooster]
  );

  const baseParams = useMemo(
    () => ({
      missionType,
      launchAngleDeg: launchAngle,
      launchTimePhase: launchTime,
      fuelAllocation: assessmentMode ? fuelAlloc * 0.88 : fuelAlloc,
      payloadWeight: assessmentMode ? payload + 2 : payload,
      rocketConfig
    }),
    [missionType, launchAngle, launchTime, fuelAlloc, payload, assessmentMode, rocketConfig]
  );

  const resetSim = useCallback(() => {
    const next = createInitialState(baseParams);
    next.stageSeparationAuto = autoStage;
    next.autoStabilize = autoStab;
    stateRef.current = next;
    lastVel.current.copy(stateRef.current.vel);
    replaySnapshots.current = [];
    ghostRef.current = predictTrajectory(stateRef.current);
    setThrustOn(false);
    setReplayMode(false);
    setStepIndex(0);
  }, [baseParams, autoStage, autoStab]);

  useEffect(() => { resetSim(); }, [resetSim]);

  useEffect(() => {
    if (stateRef.current) {
      stateRef.current.stageSeparationAuto = autoStage;
      stateRef.current.autoStabilize = autoStab;
    }
  }, [autoStage, autoStab]);

  useEffect(() => {
    const id = setInterval(() => {
      setUiTick(t => t + 1);
      setEarthTick(t => t + 1);
    }, slowMotion ? 200 : 95);
    return () => clearInterval(id);
  }, [slowMotion]);

  useEffect(() => {
    if (stateRef.current?.status === "success") setStepIndex(3);
  }, [uiTick]);

  useEffect(() => {
    controlsRef.current.thrustRequested = thrustOn;
    controlsRef.current.correctionBurn = correctionBurn;
    controlsRef.current.rotateYaw = rotateRate;
    controlsRef.current.timeWarp = timeWarp * (slowMotion ? 0.35 : 1);
  }, [thrustOn, correctionBurn, rotateRate, timeWarp, slowMotion]);

  useEffect(() => {
    const s = stateRef.current;
    if (!s || s.status !== "flight") return;
    replaySnapshots.current.push({ t: s.t, pos: s.pos.clone(), vel: s.vel.clone() });
    if (replaySnapshots.current.length > 520) replaySnapshots.current.shift();
  }, [uiTick]);

  const sim = stateRef.current;
  const successPct = useMemo(() => computeSuccessProbability(baseParams), [baseParams]);

  const target = sim ? interceptHint(sim) : new THREE.Vector3();
  const distTarget = sim ? sim.pos.distanceTo(target) : 0;
  const speed = sim ? sim.vel.length() : 0;
  const dtEst = slowMotion ? 0.2 : 0.095;
  const accel = sim ? sim.vel.clone().sub(lastVel.current).length() / dtEst : 0;
  if (sim) lastVel.current.copy(sim.vel);

  const alignDir = sim ? target.clone().sub(sim.pos) : new THREE.Vector3(1, 0, 0);
  if (alignDir.lengthSq() < 1e-8) alignDir.set(1, 0, 0);
  alignDir.normalize();

  const grav = sim ? gravitationalInfluence(sim.pos) : { earth: 0 };
  const alignment = sim
    ? THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(sim.heading.dot(alignDir), -1, 1)))
    : 0;

  const trailPoints = useMemo(() => {
    const s = stateRef.current;
    if (!s?.trajectoryLog?.length) return [];
    return s.trajectoryLog.map(p => p.clone());
  }, [uiTick, sim?.status]);

  const hint = useMemo(() => {
    if (!sim) return "";
    if (sim.status === "planning") {
      if (launchTime < 0.12 || launchTime > 0.42) return "Launch window: align the clock so the target is in-plane.";
      if (Math.abs(launchAngle - 45) > 18) return "For LEO and transfers, ~45–55° from the pad often works well.";
    }
    if (sim.status === "flight") {
      if (sim.stage === 1) return "Stage 1: climb through the atmosphere; watch heat and keep thrust on.";
      if (sim.stage === 2) return "Stage 2: shape insertion; enable auto-stabilize or steer gently.";
      return "Stage 3: transfer burn; use short correction burns if alignment drifts.";
    }
    if (sim.status === "success") return "Mission objectives satisfied. Replay to review trajectory.";
    if (sim.status === "failed") return sim.failureReason || "Trajectory did not meet constraints.";
    return "";
  }, [sim, launchAngle, launchTime, uiTick]);

  const beginLaunch = () => {
    if (!stateRef.current) return;
    setAttempts(v => v + 1);
    const s = stateRef.current;
    s.status = "flight";
    s.thrustOn = true;
    s.vel.copy(s.heading.clone().multiplyScalar(0.1));
    setThrustOn(true);
    setStepIndex(2);
    setIsFullscreen(true);
    speak("Main engine start. Guidance nominal.");
    playRumble();
    document.body.classList.add("launch-shake");
    setTimeout(() => document.body.classList.remove("launch-shake"), 900);
    ghostRef.current = predictTrajectory(s);
    setLastFeedback(`Predicted success likelihood: ${successPct}%.`);
  };

  const manualSeparate = () => {
    if (!stateRef.current) return;
    controlsRef.current.manualStageSep = true;
    setTimeout(() => { controlsRef.current.manualStageSep = false; }, 80);
  };

  const replay = () => {
    if (!replaySnapshots.current.length) {
      setLastFeedback("No replay data yet — launch once first.");
      return;
    }
    setReplayMode(true);
    setLastFeedback("Replay: scrubbing stored trajectory.");
    let i = 0;
    const id = setInterval(() => {
      const snap = replaySnapshots.current[i];
      if (!snap || !stateRef.current) { clearInterval(id); setReplayMode(false); return; }
      stateRef.current.pos.copy(snap.pos);
      stateRef.current.vel.copy(snap.vel);
      stateRef.current.t = snap.t;
      i += 2;
      if (i >= replaySnapshots.current.length) { clearInterval(id); setReplayMode(false); }
    }, 40);
  };

  const beginnerText = "Orbits are about speed sideways, not height. Launch timing rotates where the target sits. Fuel is mass — more mass needs more push.";

  const rv = sim?.rocketVisual ?? ROCKET_DEFAULTS.visual;

  const [showHud, setShowHud] = useState(true);

  /* ─── FULLSCREEN FLIGHT VIEW ─── */
  if (isFullscreen) {
    return createPortal(
      <FlightView
        stateRef={stateRef} controlsRef={controlsRef}
        cameraMode={cameraMode} setCameraMode={setCameraMode}
        earthTick={earthTick} showGhost={showGhost}
        ghostPoints={ghostRef.current} trailPoints={trailPoints}
        thrustOn={thrustOn} setThrustOn={setThrustOn}
        replayMode={replayMode} showSceneGrid={showSceneGrid} setShowSceneGrid={setShowSceneGrid}
        rocketVisual={rv} sim={sim} successPct={successPct}
        onExit={() => setIsFullscreen(false)}
        manualSeparate={manualSeparate}
        correctionBurn={correctionBurn} setCorrectionBurn={setCorrectionBurn}
        rotateRate={rotateRate} setRotateRate={setRotateRate}
        autoStage={autoStage} setAutoStage={setAutoStage}
        autoStab={autoStab} setAutoStab={setAutoStab}
        timeWarp={timeWarp} setTimeWarp={setTimeWarp}
        slowMotion={slowMotion}
        speed={speed} accel={accel} distTarget={distTarget}
        alignment={alignment} grav={grav}
        hint={hint}
        explainBeginner={explainBeginner} setExplainBeginner={setExplainBeginner}
        beginnerText={beginnerText}
        setMistakeCount={setMistakeCount} setLastFeedback={setLastFeedback}
        replay={replay} resetSim={resetSim}
        showHud={showHud} setShowHud={setShowHud}
      />,
      document.body
    );
  }

  /* ─── SETUP VIEW ─── */
  return (
    <div className="space-mission experiment">
      <h2>Space Mission Control & Orbital Mechanics Lab</h2>
      <p className="muted small">
        Configure your vehicle and mission, then launch into the full flight view.
      </p>
      <InstructionSteps steps={steps} currentStep={stepIndex} />

      {/* Small preview of 3D scene */}
      <div className="setup-preview" style={{ height: 220, marginBottom: "0.75rem" }}>
        <SpaceMissionCanvas
          stateRef={stateRef}
          controlsRef={controlsRef}
          cameraMode={cameraMode}
          earthRotation={earthTick * 0.012}
          showGhost={showGhost && sim?.status === "planning"}
          ghostPoints={ghostRef.current}
          trailPoints={trailPoints}
          thrustOn={thrustOn}
          replayMode={replayMode}
          showSceneGrid={showSceneGrid}
          rocketVisual={rv}
        />
      </div>

      <div className="space-mission-grid">
        <div className="space-panel glass" style={{ padding: "0.75rem" }}>
          <h3 className="section-title">Mission Planning</h3>
          <label className="field-label">Mission type</label>
          <div className="mission-type-row">
            {Object.entries(missionLabels).map(([id, label]) => (
              <button
                key={id} type="button"
                className={`btn mission-chip ${missionType === id ? "active" : ""}`}
                onClick={() => { setMissionType(id); setStepIndex(0); }}
              >
                {label}
              </button>
            ))}
          </div>

          <ControlRow label="Launch angle" value={launchAngle} min={28} max={72} unit="°" onChange={setLaunchAngle} />
          <ControlRow label="Launch window" value={Math.round(launchTime * 100)} min={0} max={100} unit="%" onChange={v => setLaunchTime(v / 100)} />
          <ControlRow label="Fuel allocation" value={Math.round(fuelAlloc * 100)} min={35} max={100} unit="%" onChange={v => setFuelAlloc(v / 100)} />
          <ControlRow label="Payload" value={payload} min={1} max={12} unit="t" onChange={setPayload} />

          <h3 className="section-title">Vehicle & Stages</h3>
          <p className="muted small">Tune thrust, fuel split, aero, and looks.</p>
          <ControlRow label="Stage 1 thrust" value={stageThrust1} min={50} max={150} unit="%" onChange={setStageThrust1} />
          <ControlRow label="Stage 2 thrust" value={stageThrust2} min={50} max={150} unit="%" onChange={setStageThrust2} />
          <ControlRow label="Stage 3 thrust" value={stageThrust3} min={50} max={150} unit="%" onChange={setStageThrust3} />
          <ControlRow label="Fuel share S1" value={fuelS1} min={10} max={60} unit="%" onChange={setFuelS1} />
          <ControlRow label="Fuel share S2" value={fuelS2} min={10} max={60} unit="%" onChange={setFuelS2} />
          <p className="muted small">S3 share: {Math.max(5, 100 - fuelS1 - fuelS2)}% (auto)</p>
          <ControlRow label="Drag coeff." value={Math.round(dragCoeff * 100)} min={70} max={130} unit="%" onChange={v => setDragCoeff(v / 100)} />

          <h4 className="subsection-title">Rocket Shape & Paint</h4>
          <ControlRow label="Length scale" value={Math.round(lengthScale * 100)} min={75} max={140} unit="%" onChange={v => setLengthScale(v / 100)} />
          <ControlRow label="Width scale" value={Math.round(widthScale * 100)} min={75} max={135} unit="%" onChange={v => setWidthScale(v / 100)} />
          <ControlRow label="Fins" value={finCount} min={0} max={4} unit="" onChange={setFinCount} />

          <label className="field-label">Fairing</label>
          <div className="panel-actions wrap">
            {["sleek", "standard", "heavy"].map(f => (
              <button key={f} type="button" className={`btn ${fairing === f ? "btn-neon" : ""}`} onClick={() => setFairing(f)}>{f}</button>
            ))}
          </div>
          <label className="field-label">Nose</label>
          <div className="panel-actions wrap">
            {["cone", "ogive", "blunt"].map(n => (
              <button key={n} type="button" className={`btn ${nose === n ? "btn-neon" : ""}`} onClick={() => setNose(n)}>{n}</button>
            ))}
          </div>
          <div className="color-row">
            <label>Body <input type="color" value={colBody} onChange={e => setColBody(e.target.value)} /></label>
            <label>Accent <input type="color" value={colAccent} onChange={e => setColAccent(e.target.value)} /></label>
            <label>Fairing <input type="color" value={colFairing} onChange={e => setColFairing(e.target.value)} /></label>
            <label>Booster <input type="color" value={colBooster} onChange={e => setColBooster(e.target.value)} /></label>
          </div>

          <div className="prediction-block">
            <p><strong>Success probability:</strong> {successPct}%</p>
            <p className="muted small">Ghost path shows predicted trajectory based on your configuration.</p>
          </div>

          <div className="panel-actions wrap" style={{ marginTop: "0.5rem" }}>
            <button className="btn" type="button" onClick={resetSim}>Reset Plan</button>
            <button className="btn" type="button" onClick={() => setShowGhost(g => !g)}>
              {showGhost ? "Hide Ghost" : "Show Ghost"}
            </button>
          </div>

          {/* Big launch button */}
          <button className="run-experiment-btn" onClick={beginLaunch} disabled={sim?.status === "flight"} style={{ marginTop: "0.75rem" }}>
            🚀 Launch Mission — Full View
          </button>
        </div>
      </div>
    </div>
  );
}
