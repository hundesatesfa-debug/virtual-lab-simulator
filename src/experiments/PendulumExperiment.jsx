import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import ControlRow from "../components/ControlRow";
import Graph from "../components/Graph";
import InstructionSteps from "../components/InstructionSteps";

const steps = ["Set pendulum length", "Set gravity", "Release pendulum", "Measure period"];

function PendulumCanvas({ length, gravity, period, isFullscreen, isSwinging }) {
  const canvasRef = useRef(null);
  const animRef = useRef(0);
  const timeRef = useRef(0);
  const trailRef = useRef([]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width;
    const H = canvas.height;
    const t = timeRef.current * 0.025;

    // Background
    const bgGrad = ctx.createRadialGradient(W / 2, 0, 0, W / 2, H / 2, W * 0.7);
    bgGrad.addColorStop(0, "#0e1530");
    bgGrad.addColorStop(1, "#040810");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // Stars
    for (let i = 0; i < 50; i++) {
      const sx = ((i * 157.3) % W);
      const sy = ((i * 73.7) % H);
      ctx.fillStyle = `rgba(180, 200, 255, ${0.15 + 0.2 * Math.sin(t + i * 0.7)})`;
      ctx.beginPath();
      ctx.arc(sx, sy, 0.6, 0, Math.PI * 2);
      ctx.fill();
    }

    const pivotX = W / 2;
    const pivotY = H * 0.12;
    const stringLen = Math.min(H * 0.55, length * (isFullscreen ? 160 : 100));
    const bobRadius = isFullscreen ? 18 : 14;
    const maxAngle = 30 * Math.PI / 180;

    // Pendulum angle
    const angle = isSwinging
      ? maxAngle * Math.cos((2 * Math.PI * t) / period)
      : maxAngle * 0.3;

    const bobX = pivotX + Math.sin(angle) * stringLen;
    const bobY = pivotY + Math.cos(angle) * stringLen;

    // Trail
    if (isSwinging) {
      trailRef.current.push({ x: bobX, y: bobY, alpha: 1 });
      if (trailRef.current.length > 80) trailRef.current.shift();
    }

    // Draw trail
    trailRef.current.forEach((p, i) => {
      p.alpha *= 0.97;
      if (p.alpha < 0.01) return;
      ctx.fillStyle = `rgba(66, 255, 128, ${p.alpha * 0.4})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
    });
    trailRef.current = trailRef.current.filter(p => p.alpha > 0.01);

    // Arc path indicator
    ctx.strokeStyle = "rgba(66, 255, 128, 0.08)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(pivotX, pivotY, stringLen, Math.PI / 2 - maxAngle, Math.PI / 2 + maxAngle);
    ctx.stroke();
    ctx.setLineDash([]);

    // Support beam
    ctx.fillStyle = "rgba(80, 90, 110, 0.8)";
    ctx.fillRect(pivotX - W * 0.15, pivotY - 8, W * 0.3, 10);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
    ctx.lineWidth = 1;
    ctx.strokeRect(pivotX - W * 0.15, pivotY - 8, W * 0.3, 10);

    // Pivot point
    const pivotGlow = ctx.createRadialGradient(pivotX, pivotY, 0, pivotX, pivotY, 12);
    pivotGlow.addColorStop(0, "rgba(0, 255, 213, 0.8)");
    pivotGlow.addColorStop(1, "transparent");
    ctx.fillStyle = pivotGlow;
    ctx.beginPath();
    ctx.arc(pivotX, pivotY, 12, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#00ffd5";
    ctx.beginPath();
    ctx.arc(pivotX, pivotY, 5, 0, Math.PI * 2);
    ctx.fill();

    // String
    ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
    ctx.lineWidth = 2;
    ctx.shadowColor = "rgba(255, 255, 255, 0.2)";
    ctx.shadowBlur = 5;
    ctx.beginPath();
    ctx.moveTo(pivotX, pivotY);
    ctx.lineTo(bobX, bobY);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Bob shadow
    ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
    ctx.beginPath();
    ctx.ellipse(bobX + 3, bobY + bobRadius + 5, bobRadius * 0.7, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Bob
    const bobGrad = ctx.createRadialGradient(bobX - 4, bobY - 4, 0, bobX, bobY, bobRadius);
    bobGrad.addColorStop(0, "#7aff9e");
    bobGrad.addColorStop(0.7, "#42ff80");
    bobGrad.addColorStop(1, "#1fcc56");
    ctx.fillStyle = bobGrad;
    ctx.beginPath();
    ctx.arc(bobX, bobY, bobRadius, 0, Math.PI * 2);
    ctx.fill();

    // Bob glow
    const bobGlow = ctx.createRadialGradient(bobX, bobY, bobRadius, bobX, bobY, bobRadius * 2.5);
    bobGlow.addColorStop(0, "rgba(66, 255, 128, 0.15)");
    bobGlow.addColorStop(1, "transparent");
    ctx.fillStyle = bobGlow;
    ctx.beginPath();
    ctx.arc(bobX, bobY, bobRadius * 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Angle indicator
    if (Math.abs(angle) > 0.01) {
      const angleDeg = (angle * 180 / Math.PI).toFixed(1);
      ctx.strokeStyle = "rgba(255, 200, 100, 0.4)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(pivotX, pivotY);
      ctx.lineTo(pivotX, pivotY + stringLen * 0.3);
      ctx.stroke();

      ctx.beginPath();
      const startAngle = Math.PI / 2 - Math.abs(angle);
      const endAngle = Math.PI / 2;
      if (angle > 0) {
        ctx.arc(pivotX, pivotY, stringLen * 0.2, startAngle, endAngle);
      } else {
        ctx.arc(pivotX, pivotY, stringLen * 0.2, Math.PI - endAngle, Math.PI - startAngle);
      }
      ctx.strokeStyle = "rgba(255, 200, 100, 0.5)";
      ctx.stroke();

      ctx.font = `${isFullscreen ? 13 : 10}px 'Orbitron', sans-serif`;
      ctx.fillStyle = "rgba(255, 200, 100, 0.7)";
      ctx.textAlign = angle > 0 ? "left" : "right";
      ctx.fillText(`${angleDeg}°`, pivotX + (angle > 0 ? 1 : -1) * stringLen * 0.25, pivotY + stringLen * 0.15);
    }

    // Gravity vector on bob
    const gArrowLen = gravity * (isFullscreen ? 3.5 : 2.5);
    ctx.strokeStyle = "rgba(255, 100, 100, 0.6)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(bobX, bobY + bobRadius + 5);
    ctx.lineTo(bobX, bobY + bobRadius + 5 + gArrowLen);
    ctx.stroke();
    ctx.fillStyle = "rgba(255, 100, 100, 0.6)";
    ctx.beginPath();
    ctx.moveTo(bobX, bobY + bobRadius + 5 + gArrowLen + 6);
    ctx.lineTo(bobX - 4, bobY + bobRadius + 5 + gArrowLen - 2);
    ctx.lineTo(bobX + 4, bobY + bobRadius + 5 + gArrowLen - 2);
    ctx.closePath();
    ctx.fill();

    ctx.font = `${isFullscreen ? 11 : 9}px 'Orbitron', sans-serif`;
    ctx.fillStyle = "rgba(255, 100, 100, 0.7)";
    ctx.textAlign = "left";
    ctx.fillText(`g = ${gravity}`, bobX + 8, bobY + bobRadius + gArrowLen);

    // Length label
    const midX = (pivotX + bobX) / 2;
    const midY = (pivotY + bobY) / 2;
    ctx.font = `${isFullscreen ? 12 : 9}px 'Orbitron', sans-serif`;
    ctx.fillStyle = "rgba(0, 255, 213, 0.6)";
    ctx.textAlign = "center";
    ctx.fillText(`L = ${length}m`, midX - 30, midY);

    // Equation
    ctx.font = `${isFullscreen ? 16 : 12}px 'Orbitron', sans-serif`;
    ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
    ctx.textAlign = "center";
    ctx.fillText("T = 2π√(L/g)", W / 2, H - (isFullscreen ? 30 : 20));

    timeRef.current++;
    animRef.current = requestAnimationFrame(draw);
  }, [length, gravity, period, isFullscreen, isSwinging]);

  useEffect(() => {
    trailRef.current = [];
  }, [length, gravity]);

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

export default function PendulumExperiment({ setAttempts, setMistakeCount, setLastFeedback }) {
  const [length, setLength] = useState(1);
  const [gravity, setGravity] = useState(9.8);
  const [stepIndex, setStepIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSwinging, setIsSwinging] = useState(true);

  const period = 2 * Math.PI * Math.sqrt(length / gravity);

  const wavePoints = useMemo(
    () =>
      Array.from({ length: 80 }, (_, i) => {
        const t = i / 10;
        return { x: t, y: Math.sin((2 * Math.PI * t) / period) + 1.2 };
      }),
    [period]
  );

  const measure = () => {
    setAttempts((v) => v + 1);
    if (length < 0.2) {
      setMistakeCount((m) => m + 1);
      setLastFeedback("Length too short. Increase length for a clear measurement.");
      return;
    }
    setStepIndex((s) => Math.min(steps.length - 1, s + 1));
    setIsSwinging(true);
    setLastFeedback(`Period: ${period.toFixed(2)} s. Frequency: ${(1 / period).toFixed(3)} Hz.`);
  };

  const launchFullscreen = () => {
    setIsFullscreen(true);
    setIsSwinging(true);
    measure();
  };

  if (isFullscreen) {
    return createPortal(
      <div className="fullscreen-overlay">
        <div className="fullscreen-canvas-area">
          <PendulumCanvas length={length} gravity={gravity} period={period} isFullscreen={true} isSwinging={isSwinging} />
          <div className="fullscreen-hud">
            <div className="hud-top">
              <h2>Simple Pendulum Lab</h2>
              <button className="btn btn-neon" onClick={() => setIsFullscreen(false)}>✕ Exit</button>
            </div>

            <div className="hud-left">
              <div className="hud-mini-control">
                <label>Length: {length}m</label>
                <input type="range" min={20} max={300} value={Math.round(length * 100)} onChange={(e) => setLength(e.target.value / 100)} />
              </div>
              <div className="hud-mini-control">
                <label>Gravity: {gravity} m/s²</label>
                <input type="range" min={16} max={150} value={Math.round(gravity * 10)} onChange={(e) => setGravity(e.target.value / 10)} />
              </div>
            </div>

            <div className="hud-bottom">
              <div className="hud-stats">
                <div className="hud-stat">
                  <div className="hud-stat-label">Length</div>
                  <div className="hud-stat-value">{length}<span className="hud-stat-unit">m</span></div>
                </div>
                <div className="hud-stat">
                  <div className="hud-stat-label">Gravity</div>
                  <div className="hud-stat-value">{gravity}<span className="hud-stat-unit">m/s²</span></div>
                </div>
                <div className="hud-stat">
                  <div className="hud-stat-label">Period</div>
                  <div className="hud-stat-value">{period.toFixed(2)}<span className="hud-stat-unit">s</span></div>
                </div>
                <div className="hud-stat">
                  <div className="hud-stat-label">Frequency</div>
                  <div className="hud-stat-value">{(1 / period).toFixed(3)}<span className="hud-stat-unit">Hz</span></div>
                </div>
                <div className="hud-stat">
                  <div className="hud-stat-label">Max Speed</div>
                  <div className="hud-stat-value">{(length * 2 * Math.PI / period * Math.sin(30 * Math.PI / 180)).toFixed(2)}<span className="hud-stat-unit">m/s</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  return (
    <div className="experiment">
      <h2>Simple Pendulum</h2>
      <InstructionSteps steps={steps} currentStep={stepIndex} />

      <div className="setup-phase">
        <div className="setup-preview">
          <PendulumCanvas length={length} gravity={gravity} period={period} isFullscreen={false} isSwinging={isSwinging} />
        </div>

        <ControlRow label="Length" value={length} min={0.2} max={3} step={0.1} unit="m" onChange={setLength} />
        <ControlRow label="Gravity" value={gravity} min={1.6} max={15} step={0.1} unit="m/s²" onChange={setGravity} />

        <p style={{ fontSize: "0.85rem" }}>
          Period: <strong style={{ color: "var(--neon)" }}>{period.toFixed(2)} s</strong> | Freq: <strong>{(1/period).toFixed(3)} Hz</strong>
        </p>

        <div className="panel-actions">
          <button className="btn" onClick={measure}>Measure</button>
          <button className="run-experiment-btn" onClick={launchFullscreen}>
            ▶ Launch Full View
          </button>
        </div>

        <Graph points={wavePoints} xLabel="Time" yLabel="Displacement" color="#42ff80" />
      </div>
    </div>
  );
}
