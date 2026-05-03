import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import ControlRow from "../components/ControlRow";
import Graph from "../components/Graph";
import InstructionSteps from "../components/InstructionSteps";

const steps = ["Set voltage", "Set resistance", "Observe current flow", "Analyze V-I relationship"];

function CircuitCanvas({ voltage, resistance, current, isFullscreen }) {
  const canvasRef = useRef(null);
  const animRef = useRef(0);
  const timeRef = useRef(0);
  const electronsRef = useRef([]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width;
    const H = canvas.height;
    const t = timeRef.current;

    // Background
    const bgGrad = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.7);
    bgGrad.addColorStop(0, "#0c1220");
    bgGrad.addColorStop(1, "#040810");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // Stars
    for (let i = 0; i < 40; i++) {
      const sx = ((i * 173.7) % W);
      const sy = ((i * 89.3) % H);
      ctx.fillStyle = `rgba(180, 200, 255, ${0.15 + 0.2 * Math.sin(t * 0.015 + i)})`;
      ctx.beginPath();
      ctx.arc(sx, sy, 0.7, 0, Math.PI * 2);
      ctx.fill();
    }

    // Circuit dimensions
    const margin = W * 0.12;
    const circLeft = margin;
    const circRight = W - margin;
    const circTop = H * 0.2;
    const circBottom = H * 0.75;
    const wireW = circRight - circLeft;
    const wireH = circBottom - circTop;

    // Wire glow intensity based on current
    const glowIntensity = Math.min(1, current / 6);
    const wireColor = `rgba(0, 255, 213, ${0.3 + glowIntensity * 0.5})`;
    const wireGlow = `rgba(0, 255, 213, ${glowIntensity * 0.3})`;

    // Draw circuit wires
    ctx.lineWidth = 3;
    ctx.strokeStyle = wireColor;
    ctx.shadowColor = wireGlow;
    ctx.shadowBlur = 10 + glowIntensity * 15;

    // Circuit path: rectangle
    ctx.beginPath();
    ctx.moveTo(circLeft, circTop);
    ctx.lineTo(circRight, circTop);
    ctx.lineTo(circRight, circBottom);
    ctx.lineTo(circLeft, circBottom);
    ctx.lineTo(circLeft, circTop);
    ctx.stroke();

    ctx.shadowBlur = 0;

    // Battery on left side
    const batX = circLeft;
    const batY = (circTop + circBottom) / 2;
    const batH = 35;

    // Battery body
    ctx.fillStyle = "rgba(60, 60, 80, 0.8)";
    ctx.fillRect(batX - 12, batY - batH, 24, batH * 2);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(batX - 12, batY - batH, 24, batH * 2);

    // Battery terminals
    ctx.fillStyle = "#ff4444";
    ctx.fillRect(batX - 8, batY - batH - 6, 6, 6);
    ctx.fillStyle = "#4444ff";
    ctx.fillRect(batX + 2, batY - batH - 6, 6, 6);

    // Battery voltage label
    ctx.font = `bold ${isFullscreen ? 16 : 12}px 'Orbitron', sans-serif`;
    ctx.fillStyle = "rgba(255, 200, 50, 0.9)";
    ctx.textAlign = "center";
    ctx.fillText(`${voltage}V`, batX, batY + 5);

    // Resistor on right side
    const resX = circRight;
    const resY = (circTop + circBottom) / 2;
    const zigzagW = 10;
    const zigzagSegments = 6;
    const segH = 50 / zigzagSegments;

    ctx.strokeStyle = `rgba(255, ${Math.max(0, 180 - resistance * 8)}, 80, 0.9)`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(resX, resY - 30);
    for (let i = 0; i < zigzagSegments; i++) {
      const y = resY - 30 + (i + 0.5) * segH;
      const xOff = i % 2 === 0 ? zigzagW : -zigzagW;
      ctx.lineTo(resX + xOff, y);
    }
    ctx.lineTo(resX, resY + 30);
    ctx.stroke();

    // Resistor heat glow
    if (current > 1) {
      const heatGlow = ctx.createRadialGradient(resX, resY, 0, resX, resY, 40 + current * 5);
      heatGlow.addColorStop(0, `rgba(255, 100, 50, ${Math.min(0.3, current * 0.03)})`);
      heatGlow.addColorStop(1, "transparent");
      ctx.fillStyle = heatGlow;
      ctx.fillRect(resX - 50, resY - 50, 100, 100);
    }

    // Resistor label
    ctx.font = `bold ${isFullscreen ? 16 : 12}px 'Orbitron', sans-serif`;
    ctx.fillStyle = "rgba(255, 160, 80, 0.9)";
    ctx.textAlign = "center";
    ctx.fillText(`${resistance}Ω`, resX + (isFullscreen ? 45 : 35), resY + 5);

    // Ammeter on top wire
    const amX = (circLeft + circRight) / 2;
    const amY = circTop;
    const amR = isFullscreen ? 28 : 22;

    ctx.beginPath();
    ctx.arc(amX, amY, amR, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(20, 30, 50, 0.9)";
    ctx.fill();
    ctx.strokeStyle = "rgba(0, 255, 213, 0.6)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Ammeter reading
    ctx.font = `bold ${isFullscreen ? 14 : 10}px 'Orbitron', sans-serif`;
    ctx.fillStyle = "#00ffd5";
    ctx.textAlign = "center";
    ctx.fillText(`${current.toFixed(2)}`, amX, amY + 2);
    ctx.font = `${isFullscreen ? 8 : 6}px 'Orbitron', sans-serif`;
    ctx.fillStyle = "rgba(0, 255, 213, 0.6)";
    ctx.fillText("AMPS", amX, amY + (isFullscreen ? 14 : 11));

    // Electron flow
    const totalPathLength = 2 * wireW + 2 * wireH;
    const electronCount = Math.min(50, Math.max(8, Math.round(current * 5)));
    const speed = current * 0.003;

    while (electronsRef.current.length < electronCount) {
      electronsRef.current.push({ progress: Math.random(), size: 2 + Math.random() * 2 });
    }
    while (electronsRef.current.length > electronCount) {
      electronsRef.current.pop();
    }

    electronsRef.current.forEach((e) => {
      e.progress = (e.progress + speed) % 1;
      const dist = e.progress * totalPathLength;
      let ex, ey;

      if (dist < wireW) {
        // Top wire (left to right)
        ex = circLeft + dist;
        ey = circTop;
      } else if (dist < wireW + wireH) {
        // Right wire (top to bottom)
        ex = circRight;
        ey = circTop + (dist - wireW);
      } else if (dist < 2 * wireW + wireH) {
        // Bottom wire (right to left)
        ex = circRight - (dist - wireW - wireH);
        ey = circBottom;
      } else {
        // Left wire (bottom to top)
        ex = circLeft;
        ey = circBottom - (dist - 2 * wireW - wireH);
      }

      // Electron glow
      const eGlow = ctx.createRadialGradient(ex, ey, 0, ex, ey, e.size * 3);
      eGlow.addColorStop(0, `rgba(100, 200, 255, ${0.6 + glowIntensity * 0.4})`);
      eGlow.addColorStop(1, "transparent");
      ctx.fillStyle = eGlow;
      ctx.fillRect(ex - e.size * 3, ey - e.size * 3, e.size * 6, e.size * 6);

      ctx.fillStyle = `rgba(150, 220, 255, ${0.8 + glowIntensity * 0.2})`;
      ctx.beginPath();
      ctx.arc(ex, ey, e.size, 0, Math.PI * 2);
      ctx.fill();
    });

    // Power indicator
    const power = voltage * current;
    ctx.font = `${isFullscreen ? 14 : 11}px 'Orbitron', sans-serif`;
    ctx.fillStyle = "rgba(255, 200, 50, 0.7)";
    ctx.textAlign = "center";
    ctx.fillText(`P = ${power.toFixed(1)} W`, W / 2, circBottom + (isFullscreen ? 40 : 30));

    // Labels
    ctx.font = `${isFullscreen ? 11 : 9}px 'Inter', sans-serif`;
    ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
    ctx.fillText("I = V / R", W / 2, H - 15);

    timeRef.current++;
    animRef.current = requestAnimationFrame(draw);
  }, [voltage, resistance, current, isFullscreen]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const rect = canvas.parentElement.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      canvas.style.width = rect.width + "px";
      canvas.style.height = rect.height + "px";
      const ctx = canvas.getContext("2d");
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };

    resize();
    window.addEventListener("resize", resize);

    animRef.current = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [draw]);

  return <canvas ref={canvasRef} className="viz-canvas" />;
}

export default function OhmsLawExperiment({ setAttempts, setMistakeCount, setLastFeedback }) {
  const [voltage, setVoltage] = useState(12);
  const [resistance, setResistance] = useState(6);
  const [stepIndex, setStepIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showHud, setShowHud] = useState(true);
  const current = voltage / resistance;

  const points = useMemo(
    () =>
      Array.from({ length: 10 }, (_, i) => {
        const v = (i + 1) * 2;
        return { x: v, y: v / resistance };
      }),
    [resistance]
  );

  const checkStep = () => {
    setAttempts((v) => v + 1);
    if (resistance <= 0) {
      setMistakeCount((m) => m + 1);
      setLastFeedback("Resistance cannot be zero or negative.");
      return;
    }
    setStepIndex((s) => Math.min(steps.length - 1, s + 1));
    setLastFeedback(`Current is ${current.toFixed(2)} A. Power dissipated: ${(voltage * current).toFixed(1)} W. Using I = V/R.`);
  };

  const launchFullscreen = () => {
    setIsFullscreen(true);
    setShowHud(true);
    checkStep();
  };

  if (isFullscreen) {
    const power = voltage * current;
    return createPortal(
      <div className={`fullscreen-overlay ${!showHud ? "hud-minimized" : ""}`}>
        <div className="fullscreen-canvas-area">
          <CircuitCanvas voltage={voltage} resistance={resistance} current={current} isFullscreen={true} />
          <div className="fullscreen-hud">
            <div className="hud-top">
              <h2>Ohm's Law — Electric Circuit</h2>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button className="btn btn-neon mobile-only" onClick={() => setShowHud(!showHud)}>
                  {showHud ? "👁 Hide HUD" : "👁 Show HUD"}
                </button>
                <button className="btn btn-neon" onClick={() => setIsFullscreen(false)}>✕ Exit</button>
              </div>
            </div>

            {showHud && (
              <>
                <div className="hud-left">
                  <div className="hud-mini-control">
                    <label>Voltage: {voltage}V</label>
                    <input type="range" min={1} max={24} value={voltage} onChange={(e) => setVoltage(Number(e.target.value))} />
                  </div>
                  <div className="hud-mini-control">
                    <label>Resistance: {resistance}Ω</label>
                    <input type="range" min={1} max={20} value={resistance} onChange={(e) => setResistance(Number(e.target.value))} />
                  </div>
                </div>

                <div className="hud-bottom">
                  <div className="hud-stats">
                    <div className="hud-stat">
                      <div className="hud-stat-label">Voltage</div>
                      <div className="hud-stat-value">{voltage}<span className="hud-stat-unit">V</span></div>
                    </div>
                    <div className="hud-stat">
                      <div className="hud-stat-label">Resistance</div>
                      <div className="hud-stat-value">{resistance}<span className="hud-stat-unit">Ω</span></div>
                    </div>
                    <div className="hud-stat">
                      <div className="hud-stat-label">Current</div>
                      <div className="hud-stat-value">{current.toFixed(2)}<span className="hud-stat-unit">A</span></div>
                    </div>
                    <div className="hud-stat">
                      <div className="hud-stat-label">Power</div>
                      <div className="hud-stat-value">{power.toFixed(1)}<span className="hud-stat-unit">W</span></div>
                    </div>
                    <div className="hud-stat">
                      <div className="hud-stat-label">Electron Speed</div>
                      <div className="hud-stat-value">{(current * 0.1).toFixed(2)}<span className="hud-stat-unit">m/s</span></div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>,
      document.body
    );
  }

  return (
    <div className="experiment">
      <h2>Ohm's Law</h2>
      <InstructionSteps steps={steps} currentStep={stepIndex} />

      <div className="setup-phase">
        <div className="setup-preview">
          <CircuitCanvas voltage={voltage} resistance={resistance} current={current} isFullscreen={false} />
        </div>

        <ControlRow label="Voltage" value={voltage} min={1} max={24} unit="V" onChange={setVoltage} />
        <ControlRow label="Resistance" value={resistance} min={1} max={20} unit="Ω" onChange={setResistance} />

        <p style={{ fontSize: "0.85rem" }}>
          Current: <strong style={{ color: "var(--neon)" }}>{current.toFixed(2)} A</strong> | Power: <strong>{(voltage * current).toFixed(1)} W</strong>
        </p>

        <div className="panel-actions">
          <button className="btn" onClick={checkStep}>Validate Step</button>
          <button className="run-experiment-btn" onClick={launchFullscreen}>
            ▶ Launch Full View
          </button>
        </div>

        <Graph points={points} xLabel="Voltage (V)" yLabel="Current (A)" />
      </div>
    </div>
  );
}
