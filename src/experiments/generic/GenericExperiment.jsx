import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import ControlRow from "../../components/ControlRow";
import InstructionSteps from "../../components/InstructionSteps";
import LabGraph from "../../components/LabGraph";
import { drawScene, getStore } from "./scenes";

function dragValue(item, px, py) {
  const c = item.control;
  if (!c) return null;
  let frac;
  if (item.kind === "dial") {
    const ang = Math.atan2(py - item.cy, px - item.cx);
    let base = (ang - item.start) / item.span;
    for (const cand of [(ang + Math.PI * 2 - item.start) / item.span, (ang - Math.PI * 2 - item.start) / item.span]) {
      if (Math.abs(cand - item.frac) < Math.abs(base - item.frac)) base = cand;
    }
    frac = Math.max(0, Math.min(1, base));
  } else if (item.orient === "v") {
    frac = (item.y + item.h - py) / item.h;
    frac = Math.max(0, Math.min(1, frac));
  } else {
    frac = (px - item.x) / item.w;
    frac = Math.max(0, Math.min(1, frac));
  }
  let v = c.min + frac * (c.max - c.min);
  if (c.step) v = c.min + Math.round((v - c.min) / c.step) * c.step;
  if (c.max !== undefined) v = Math.max(c.min, Math.min(c.max, v));
  return v;
}

function controlsFromDefaults(controls) {
  return Object.fromEntries(
    controls.map((c) => {
      if (c.type === "select" || c.type === "segmented") return [c.key, c.def ?? c.options[0].v];
      if (c.type === "toggle") return [c.key, c.def ?? false];
      return [c.key, c.def ?? c.min];
    })
  );
}

function SelectControl({ control, value, onChange }) {
  if (control.type === "segmented") {
    return (
      <div className="segmented-row">
        <span>{control.label}</span>
        <div className="segmented">
          {control.options.map((o) => (
            <button
              key={o.v}
              className={value === o.v ? "active" : ""}
              onClick={() => onChange(o.v)}
            >
              {o.l}
            </button>
          ))}
        </div>
      </div>
    );
  }
  return (
    <label className="select-row">
      <span>{control.label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {control.options.map((o) => (
          <option key={o.v} value={o.v}>
            {o.l}
          </option>
        ))}
      </select>
    </label>
  );
}

function ToggleControl({ control, value, onChange }) {
  return (
    <label className="toggle-row">
      <span>{control.label}</span>
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        style={{ accentColor: "var(--neon)" }}
      />
      <strong>{value ? "ON" : "OFF"}</strong>
    </label>
  );
}

function ExperimentCanvas({ blueprint, state, live, running, speed, onDrag }) {
  const canvasRef = useRef(null);
  const animRef = useRef(0);
  const latest = useRef({ state, live, running });
  latest.current = { state, live, running };
  const ambientRef = useRef(0);
  const dragRef = useRef(null);

  const hitTest = useCallback((px, py) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const S = getStore(canvas);
    const items = S.ctl || [];
    for (const it of items) {
      if (it.kind === "slider") {
        if (px >= it.x && px <= it.x + it.w && py >= it.y && py <= it.y + it.h) return it;
      } else if (it.kind === "dial") {
        const dx = px - it.cx;
        const dy = py - it.cy;
        if (dx * dx + dy * dy <= it.hitR * it.hitR) return it;
      }
    }
    return null;
  }, []);

  const applyDrag = useCallback(
    (item, px, py) => {
      const v = dragValue(item, px, py);
      if (v !== null && onDrag) onDrag(item.key, v, item.frac);
    },
    [onDrag]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas._controls = blueprint.controls || [];
    canvas._onDrag = (key, value) => onDrag && onDrag(key, value, 0);
  }, [blueprint, onDrag]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const resize = () => {
      const rect = canvas.parentElement.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, rect.width * dpr);
      canvas.height = Math.max(1, rect.height * dpr);
      canvas.style.width = rect.width + "px";
      canvas.style.height = rect.height + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      const W = canvas.width / (window.devicePixelRatio || 1);
      const H = canvas.height / (window.devicePixelRatio || 1);
      const { state: st0, live: lv } = latest.current;
      const tAmb = ambientRef.current * 0.016;
      drawScene(ctx, blueprint.scene, lv.scene, W, H, tAmb, false, st0.running);
      ambientRef.current += 1;
      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [blueprint]);

  const toLocal = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return { px: e.clientX - rect.left, py: e.clientY - rect.top };
  };

  const onPointerDown = (e) => {
    const { px, py } = toLocal(e);
    const item = hitTest(px, py);
    if (!item) return;
    e.preventDefault();
    canvasRef.current.setPointerCapture && canvasRef.current.setPointerCapture(e.pointerId);
    const c = (canvasRef.current._controls || []).find((cc) => cc.key === item.key) || null;
    dragRef.current = { item: { ...item, control: c } };
    canvasRef.current.style.cursor = "grabbing";
    applyDrag(dragRef.current.item, px, py);
  };

  const onPointerMove = (e) => {
    const canvas = canvasRef.current;
    const { px, py } = toLocal(e);
    if (dragRef.current) {
      e.preventDefault();
      applyDrag(dragRef.current.item, px, py);
      return;
    }
    canvas.style.cursor = hitTest(px, py) ? "grab" : "default";
  };

  const onPointerUp = () => {
    dragRef.current = null;
    if (canvasRef.current) canvasRef.current.style.cursor = "default";
  };

  return (
    <canvas
      ref={canvasRef}
      className="viz-canvas interact-canvas"
      style={{ touchAction: "none" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerLeave={() => {
        dragRef.current = null;
        if (canvasRef.current) canvasRef.current.style.cursor = "default";
      }}
    />
  );
}

function InfoAccordion({ label, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`info-accordion ${open ? "open" : ""}`}>
      <button className="info-accordion-head" onClick={() => setOpen((o) => !o)}>
        <span>{label}</span>
        <span className="chevron">{open ? "▾" : "▸"}</span>
      </button>
      {open && <div className="info-accordion-body">{children}</div>}
    </div>
  );
}

export default function GenericExperiment({
  blueprint,
  setAttempts,
  setMistakeCount,
  setLastFeedback,
  assessmentMode,
  startTime,
  slowMotion
}) {
  const defaults = useMemo(() => controlsFromDefaults(blueprint.controls), [blueprint]);
  const makeExtra = useMemo(() => (typeof blueprint.makeExtra === "function" ? blueprint.makeExtra : () => blueprint.initialExtra || {}), [blueprint]);
  const [params, setParams] = useState(defaults);
  const [t, setT] = useState(0);
  const [running, setRunning] = useState(false);
  const [started, setStarted] = useState(false);
  const [phase, setPhase] = useState("ready");
  const [rows, setRows] = useState([]);
  const [extra, setExtra] = useState(() => makeExtra());
  const [fullscreen, setFullscreen] = useState(false);
  const [showHud, setShowHud] = useState(true);
  const [audioOn, setAudioOn] = useState(false);

  const speed = slowMotion ? 0.35 : 1;
  const runningRef = useRef(false);
  runningRef.current = running;
  const tRef = useRef(0);
  tRef.current = t;

  const duration = useMemo(
    () =>
      typeof blueprint.getDuration === "function"
        ? Math.max(0.25, blueprint.getDuration(params))
        : blueprint.duration,
    [blueprint, params]
  );

  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let last = null;
    const loop = (now) => {
      if (last === null) last = now;
      const dt = Math.min(0.05, (now - last) / 1000) * speed;
      last = now;
      const next = tRef.current + dt;
      if (duration && next >= duration) {
        setT(duration);
        setRunning(false);
        setPhase("done");
        setLastFeedback(`${blueprint.title}: simulation complete. Review the readings & graph.`);
        return;
      }
      setT(next);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [running, speed, blueprint, duration, setLastFeedback]);

  const effT = duration ? Math.min(t, duration) : t;
  const s = useMemo(() => ({ ...params, t: effT, running, phase, extra }), [params, effT, running, phase, extra]);
  const computed = useMemo(() => blueprint.compute(s), [blueprint, s]);
  const live = computed?.m ?? {};
  const scene = computed?.scene ?? {};

  // Audio tone for sound experiments
  useEffect(() => {
    if (!audioOn || !blueprint.audio) return;
    let ctx = null;
    let osc = null;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = params.f || 440;
      gain.gain.value = 0.08;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
    } catch (e) {
      /* audio not supported */
    }
    return () => {
      try {
        osc && osc.stop();
        ctx && ctx.close();
      } catch (e) {
        /* noop */
      }
    };
  }, [audioOn, blueprint.audio, params.f]);

  const setParam = (key, value) => {
    setParams((p) => ({ ...p, [key]: value }));
    setPhase((ph) => {
      if (ph === "done" && !duration) {
        setT(0);
        return "ready";
      }
      return ph;
    });
  };

  const start = useCallback(() => {
    setAttempts((v) => v + 1);
    if (duration && t >= duration) setT(0);
    setStarted(true);
    setRunning(true);
    setPhase("running");
    setLastFeedback(`${blueprint.title}: running. ${blueprint.runningHint || "Watch the live readings."}`);
  }, [blueprint, duration, t, setAttempts, setLastFeedback]);

  const pause = useCallback(() => {
    setRunning(false);
    setPhase("paused");
    setLastFeedback("Simulation paused.");
  }, [setLastFeedback]);

  const resume = useCallback(() => {
    setRunning(true);
    setPhase("running");
    setLastFeedback("Simulation resumed.");
  }, [setLastFeedback]);

  const reset = useCallback(() => {
    setParams(defaults);
    setT(0);
    setRows([]);
    setRunning(false);
    setStarted(false);
    setPhase("ready");
    setExtra(makeExtra());
    setAudioOn(false);
    setLastFeedback("Simulation reset. Adjust parameters and press Run.");
  }, [defaults, blueprint, setLastFeedback]);

  const record = useCallback(() => {
    setAttempts((v) => v + 1);
    const row = { t: effT };
    blueprint.measures.forEach((m) => {
      row[m.key] = live[m.key];
    });
    setRows((r) => [...r, row]);
    setLastFeedback(`Reading recorded at t = ${effT.toFixed(2)} s (${rows.length + 1} total).`);
  }, [effT, live, rows, blueprint, setAttempts, setLastFeedback]);

  const actionsContext = {
    params,
    setParams,
    t: effT,
    setT,
    extra,
    setExtra,
    setRunning,
    setPhase,
    setRows,
    setLastFeedback,
    setMistakeCount,
    setAttempts,
    setStarted
  };

  const graphData = useMemo(() => {
    const g = blueprint.graph;
    if (!g) return null;
    if (g.series) return { series: g.series(s, live, scene), xLabel: g.xLabel, yLabel: g.yLabel };
    if (g.points) return { series: [{ points: g.points(s, live, scene), color: g.color || "#00ffd5" }], xLabel: g.xLabel, yLabel: g.yLabel };
    return null;
  }, [blueprint, s, live, scene]);

  const measuresInfo = blueprint.measures || [];
  const controls = blueprint.controls || [];

  return (
    <div className="experiment generic-experiment">
      <div className="exp-head">
        <h2>
          {blueprint.number && <span className="exp-number">{blueprint.number}.</span>} {blueprint.title}
        </h2>
        <p className="exp-desc">{blueprint.description}</p>
      </div>

      <InfoAccordion label="📘 About · Objective & Theory">
        <p className="exp-objective">
          <strong>Learning objective:</strong> {blueprint.objective}
        </p>
        {(blueprint.theory || []).map((para, i) => (
          <p key={i} className="exp-theory">
            {para}
          </p>
        ))}
        <div className="formula-block">
          {(blueprint.formulas || []).map((f, i) => (
            <div key={i} className="formula-item">
              <code>{f.text}</code>
              {f.note && <span>{f.note}</span>}
            </div>
          ))}
        </div>
        {blueprint.unitsNote && <p className="exp-units">Units: {blueprint.unitsNote}</p>}
        {blueprint.limitsNote && <p className="exp-limits">Realistic limits: {blueprint.limitsNote}</p>}
      </InfoAccordion>

      <div className="experiment-toolbar">
        {!running && !started && (
          <button className="btn btn-neon" onClick={start}>
            ▶ Run
          </button>
        )}
        {running && (
          <button className="btn" onClick={pause}>
            ⏸ Pause
          </button>
        )}
        {started && !running && phase !== "done" && (
          <button className="btn btn-neon" onClick={resume}>
            ▶ Resume
          </button>
        )}
        {phase === "done" && (
          <button className="btn btn-neon" onClick={start}>
            ↻ Run Again
          </button>
        )}
        <button className="btn" onClick={reset}>
          ⟲ Reset
        </button>
        <button className="btn" onClick={record}>
          📋 Record Reading
        </button>
        {blueprint.audio && (
          <button className={`btn ${audioOn ? "btn-neon" : ""}`} onClick={() => setAudioOn((a) => !a)}>
            {audioOn ? "⏹ Stop Tone" : "🔊 Play Tone"}
          </button>
        )}
        <button className="btn" onClick={() => setFullscreen(true)}>
          🖥 Full View
        </button>
      </div>

      {(blueprint.actions || []).map((a, i) => (
        <button key={i} className="btn btn-launch" onClick={() => a.apply(actionsContext)}>
          {a.label}
        </button>
      ))}

      <div className="setup-phase">
        <div className="setup-preview setup-preview--tall">
          <ExperimentCanvas
            blueprint={blueprint}
            state={s}
            live={{ scene }}
            running={running}
            speed={speed}
            onDrag={setParam}
          />
          <div className="phase-badge">{phase.toUpperCase()}</div>
        </div>

        <InstructionSteps steps={blueprint.procedure} currentStep={Math.min(blueprint.procedure.length - 1, Math.floor(stageProg(duration, effT) * blueprint.procedure.length))} />

        {controls.map((c) => {
          if (c.type === "select" || c.type === "segmented") {
            return <SelectControl key={c.key} control={c} value={params[c.key]} onChange={(v) => setParam(c.key, v)} />;
          }
          if (c.type === "toggle") {
            return <ToggleControl key={c.key} control={c} value={params[c.key]} onChange={(v) => setParam(c.key, v)} />;
          }
          return (
            <ControlRow
              key={c.key}
              label={c.label}
              value={params[c.key]}
              min={c.min}
              max={c.max}
              step={c.step ?? 1}
              unit={c.unit ?? ""}
              onChange={(v) => setParam(c.key, v)}
            />
          );
        })}

        <div className="measures">
          <h4 className="measures-title">Live Measurements</h4>
          <div className="measure-grid">
            {measuresInfo.map((m) => {
              const v = live[m.key];
              const disp = v === undefined || v === null ? "--" : Number(v).toFixed(m.precision ?? 2);
              return (
                <div className="measure-chip" key={m.key}>
                  <div className="measure-value">
                    {disp}
                    <span className="measure-unit">{m.unit}</span>
                  </div>
                  <div className="measure-label">{m.label}</div>
                </div>
              );
            })}
          </div>
        </div>

        <InfoAccordion label="🧭 Procedure · Step by Step">
          <ol className="procedure-list">
            {blueprint.procedure.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        </InfoAccordion>

        <InfoAccordion label="👀 Observation">
          <p>{blueprint.observation}</p>
        </InfoAccordion>

        <InfoAccordion label="✅ Conclusion">
          <p>{blueprint.conclusion}</p>
        </InfoAccordion>

        <InfoAccordion label="💡 Explain Physics">
          <p>{blueprint.explain}</p>
        </InfoAccordion>

        {blueprint.uncertainty && (
          <InfoAccordion label="⚠ Error & Uncertainty">
            <p>{blueprint.uncertainty}</p>
          </InfoAccordion>
        )}

        {graphData && (
          <div className="graph-wrap">
            <h4 className="measures-title">Graph</h4>
            <LabGraph series={graphData.series} xLabel={graphData.xLabel} yLabel={graphData.yLabel} />
          </div>
        )}

        {measuresInfo.length > 0 && (
          <div className="record-table-wrap">
            <h4 className="measures-title">
              Results Table <span className="muted">({rows.length} readings)</span>
            </h4>
            {rows.length === 0 ? (
              <p className="muted small">No readings yet — press “Record Reading” while the experiment runs.</p>
            ) : (
              <table className="record-table">
                <thead>
                  <tr>
                    <th>t (s)</th>
                    {measuresInfo.map((m) => (
                      <th key={m.key}>
                        {m.label}
                        <small> ({m.unit})</small>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i}>
                      <td>{r.t.toFixed(2)}</td>
                      {measuresInfo.map((m) => (
                        <td key={m.key}>
                          {Number(r[m.key] ?? 0).toFixed(m.precision ?? 2)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {fullscreen &&
        createPortal(
          <div className={`fullscreen-overlay ${!showHud ? "hud-minimized" : ""}`}>
            <div className="fullscreen-canvas-area">
              <ExperimentCanvas
                blueprint={blueprint}
                state={s}
                live={{ scene }}
                running={running}
                speed={speed}
                onDrag={setParam}
              />
              <div className="fullscreen-hud">
                <div className="hud-top">
                  <h2>
                    {blueprint.number && `${blueprint.number}. `}
                    {blueprint.title}
                  </h2>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    {!running && (
                      <button className="btn btn-neon" onClick={start}>
                        ▶ Run
                      </button>
                    )}
                    {running && (
                      <button className="btn" onClick={pause}>
                        ⏸
                      </button>
                    )}
                    <button className="btn" onClick={reset}>
                      ⟲
                    </button>
                    <button className="btn btn-neon mobile-only" onClick={() => setShowHud(!showHud)}>
                      {showHud ? "👁 Hide HUD" : "👁 Show HUD"}
                    </button>
                    <button className="btn btn-neon" onClick={() => setFullscreen(false)}>
                      ✕ Exit
                    </button>
                  </div>
                </div>
                {showHud && (
                  <>
                    <div className="hud-left">
                      {controls.map((c) => {
                        if (c.type === "select" || c.type === "segmented") {
                          return (
                            <div className="hud-mini-control" key={c.key}>
                              <label>{c.label}</label>
                              <select value={params[c.key]} onChange={(e) => setParam(c.key, e.target.value)}>
                                {c.options.map((o) => (
                                  <option key={o.v} value={o.v}>
                                    {o.l}
                                  </option>
                                ))}
                              </select>
                            </div>
                          );
                        }
                        if (c.type === "toggle") {
                          return (
                            <div className="hud-mini-control" key={c.key}>
                              <label>
                                <input type="checkbox" checked={params[c.key]} onChange={(e) => setParam(c.key, e.target.checked)} /> {c.label}
                              </label>
                            </div>
                          );
                        }
                        return (
                          <div className="hud-mini-control" key={c.key}>
                            <label>
                              {c.label}: {params[c.key]}
                              {c.unit}
                            </label>
                            <input
                              type="range"
                              min={c.min}
                              max={c.max}
                              step={c.step ?? 1}
                              value={params[c.key]}
                              onChange={(e) => setParam(c.key, Number(e.target.value))}
                            />
                          </div>
                        );
                      })}
                    </div>
                    <div className="hud-right">
                      <div className="hud-mini-control">
                        <label>Phase</label>
                        <strong className="phase-badge-static">{phase.toUpperCase()}</strong>
                      </div>
                      <div className="hud-mini-control">
                        <label>Readings</label>
                        <strong>{rows.length}</strong>
                      </div>
                    </div>
                    <div className="hud-bottom">
                      <div className="hud-stats">
                        {measuresInfo.map((m) => {
                          const v = live[m.key];
                          const disp = v === undefined || v === null ? "--" : Number(v).toFixed(m.precision ?? 2);
                          return (
                            <div className="hud-stat" key={m.key}>
                              <div className="hud-stat-label">{m.label}</div>
                              <div className="hud-stat-value">
                                {disp}
                                <span className="hud-stat-unit">{m.unit}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

function stageProg(dur, effT) {
  if (!dur || dur <= 0) return 1;
  return Math.max(0, Math.min(1, effT / dur));
}