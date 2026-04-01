import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import ControlRow from "../components/ControlRow";
import InstructionSteps from "../components/InstructionSteps";

const steps = ["Set angle and speed", "Launch projectile", "Observe trajectory", "Analyze range & height"];

function ProjectileCanvas({ angle, speed, gravity, isFullscreen, isLaunched }) {
  const canvasRef = useRef(null);
  const animRef = useRef(0);
  const timeRef = useRef(0);
  const simTimeRef = useRef(0);
  const trailRef = useRef([]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width;
    const H = canvas.height;
    const t = timeRef.current;

    // Background - night sky
    const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0, "#020610");
    bgGrad.addColorStop(0.4, "#081428");
    bgGrad.addColorStop(0.85, "#0a1a30");
    bgGrad.addColorStop(1, "#102030");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // Stars
    for (let i = 0; i < 70; i++) {
      const sx = ((i * 163.7) % W);
      const sy = ((i * 67.3) % (H * 0.5));
      ctx.fillStyle = `rgba(200, 220, 255, ${0.15 + 0.25 * Math.sin(t * 0.01 + i * 1.1)})`;
      ctx.beginPath();
      ctx.arc(sx, sy, 0.7, 0, Math.PI * 2);
      ctx.fill();
    }

    // Ground
    const groundY = H * 0.78;
    const groundGrad = ctx.createLinearGradient(0, groundY, 0, H);
    groundGrad.addColorStop(0, "#1a2a40");
    groundGrad.addColorStop(1, "#0d1a2a");
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, groundY, W, H - groundY);

    // Ground line
    ctx.strokeStyle = "rgba(0, 255, 213, 0.2)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(W, groundY);
    ctx.stroke();

    // Grid on ground
    ctx.strokeStyle = "rgba(0, 255, 213, 0.05)";
    ctx.lineWidth = 1;
    for (let i = 0; i < W; i += 50) {
      ctx.beginPath();
      ctx.moveTo(i, groundY);
      ctx.lineTo(i, H);
      ctx.stroke();
    }

    // Physics
    const rad = (angle * Math.PI) / 180;
    const totalFlightTime = (2 * speed * Math.sin(rad)) / gravity;
    const maxRange = (speed * speed * Math.sin(2 * rad)) / gravity;
    const maxHeight = (speed * speed * Math.sin(rad) * Math.sin(rad)) / (2 * gravity);

    // Scale factors
    const scaleX = (W * 0.75) / Math.max(maxRange, 1);
    const scaleY = (H * 0.55) / Math.max(maxHeight, 1);
    const scale = Math.min(scaleX, scaleY);
    const launchX = W * 0.1;

    // Draw trajectory path (ghost)
    ctx.strokeStyle = "rgba(255, 79, 216, 0.15)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    for (let st = 0; st <= totalFlightTime; st += totalFlightTime / 80) {
      const px = launchX + speed * Math.cos(rad) * st * scale;
      const py = groundY - (speed * Math.sin(rad) * st - 0.5 * gravity * st * st) * scale;
      if (st === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Launch platform
    ctx.fillStyle = "rgba(60, 80, 100, 0.8)";
    ctx.fillRect(launchX - 15, groundY - 5, 30, 10);
    ctx.strokeStyle = "rgba(0, 255, 213, 0.4)";
    ctx.lineWidth = 1;
    ctx.strokeRect(launchX - 15, groundY - 5, 30, 10);

    // Launch angle indicator
    const indicatorLen = 50;
    ctx.strokeStyle = "rgba(255, 200, 100, 0.5)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(launchX, groundY);
    ctx.lineTo(launchX + Math.cos(rad) * indicatorLen, groundY - Math.sin(rad) * indicatorLen);
    ctx.stroke();

    // Angle arc
    ctx.beginPath();
    ctx.arc(launchX, groundY, 25, -rad, 0);
    ctx.strokeStyle = "rgba(255, 200, 100, 0.4)";
    ctx.stroke();
    ctx.font = `${isFullscreen ? 12 : 9}px 'Orbitron', sans-serif`;
    ctx.fillStyle = "rgba(255, 200, 100, 0.7)";
    ctx.textAlign = "left";
    ctx.fillText(`${angle}°`, launchX + 30, groundY - 8);

    // Animated projectile
    if (isLaunched) {
      simTimeRef.current += 0.018;
      if (simTimeRef.current > totalFlightTime) simTimeRef.current = 0;

      const st = simTimeRef.current;
      const projX = launchX + speed * Math.cos(rad) * st * scale;
      const projY = groundY - (speed * Math.sin(rad) * st - 0.5 * gravity * st * st) * scale;

      // Trail
      trailRef.current.push({ x: projX, y: projY, alpha: 1 });
      if (trailRef.current.length > 100) trailRef.current.shift();

      // Draw trail
      for (let i = 0; i < trailRef.current.length; i++) {
        const p = trailRef.current[i];
        p.alpha *= 0.96;
        if (p.alpha < 0.01) continue;

        ctx.fillStyle = `rgba(255, 79, 216, ${p.alpha * 0.5})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
        ctx.fill();
      }
      trailRef.current = trailRef.current.filter(p => p.alpha > 0.01);

      if (projY <= groundY) {
        // Projectile glow
        const projGlow = ctx.createRadialGradient(projX, projY, 0, projX, projY, 25);
        projGlow.addColorStop(0, "rgba(255, 79, 216, 0.5)");
        projGlow.addColorStop(1, "transparent");
        ctx.fillStyle = projGlow;
        ctx.beginPath();
        ctx.arc(projX, projY, 25, 0, Math.PI * 2);
        ctx.fill();

        // Projectile
        const pGrad = ctx.createRadialGradient(projX - 2, projY - 2, 0, projX, projY, 8);
        pGrad.addColorStop(0, "#ffa0e0");
        pGrad.addColorStop(1, "#ff4fd8");
        ctx.fillStyle = pGrad;
        ctx.beginPath();
        ctx.arc(projX, projY, isFullscreen ? 8 : 6, 0, Math.PI * 2);
        ctx.fill();

        // Velocity vector
        const vx = speed * Math.cos(rad);
        const vy = speed * Math.sin(rad) - gravity * st;
        const vLen = Math.sqrt(vx * vx + vy * vy);
        const vnx = vx / vLen * 30;
        const vny = -vy / vLen * 30;

        ctx.strokeStyle = "rgba(0, 255, 213, 0.5)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(projX, projY);
        ctx.lineTo(projX + vnx, projY + vny);
        ctx.stroke();

        // Current height / distance markers
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(projX, projY);
        ctx.lineTo(projX, groundY);
        ctx.stroke();
        ctx.setLineDash([]);

        const currentH = (speed * Math.sin(rad) * st - 0.5 * gravity * st * st);
        if (currentH > 0) {
          ctx.font = `${isFullscreen ? 11 : 8}px 'Orbitron', sans-serif`;
          ctx.fillStyle = "rgba(0, 255, 213, 0.6)";
          ctx.textAlign = "left";
          ctx.fillText(`h = ${currentH.toFixed(1)}m`, projX + 12, projY);
        }
      }
    }

    // Range marker on ground
    const rangeEndX = launchX + maxRange * scale;
    ctx.fillStyle = "rgba(255, 79, 216, 0.3)";
    ctx.beginPath();
    ctx.arc(rangeEndX, groundY, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = `${isFullscreen ? 11 : 8}px 'Orbitron', sans-serif`;
    ctx.fillStyle = "rgba(255, 79, 216, 0.6)";
    ctx.textAlign = "center";
    ctx.fillText(`R = ${maxRange.toFixed(1)}m`, rangeEndX, groundY + 18);

    // Max height marker
    const peakT = speed * Math.sin(rad) / gravity;
    const peakX = launchX + speed * Math.cos(rad) * peakT * scale;
    const peakY = groundY - maxHeight * scale;

    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = "rgba(255, 200, 100, 0.2)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(peakX, peakY);
    ctx.lineTo(peakX, groundY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = "rgba(255, 200, 100, 0.5)";
    ctx.textAlign = "center";
    ctx.fillText(`H = ${maxHeight.toFixed(1)}m`, peakX, peakY - 10);

    // Equation
    ctx.font = `${isFullscreen ? 14 : 10}px 'Orbitron', sans-serif`;
    ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
    ctx.textAlign = "center";
    ctx.fillText("R = v²sin(2θ)/g", W / 2, H - 15);

    timeRef.current++;
    animRef.current = requestAnimationFrame(draw);
  }, [angle, speed, gravity, isFullscreen, isLaunched]);

  useEffect(() => {
    simTimeRef.current = 0;
    trailRef.current = [];
  }, [angle, speed, gravity]);

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

export default function ProjectileExperiment({ setAttempts, setMistakeCount, setLastFeedback }) {
  const [angle, setAngle] = useState(45);
  const [speed, setSpeed] = useState(24);
  const [gravity, setGravity] = useState(9.8);
  const [stepIndex, setStepIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLaunched, setIsLaunched] = useState(false);

  const rad = (angle * Math.PI) / 180;
  const range = (speed * speed * Math.sin(2 * rad)) / gravity;
  const maxHeight = (speed * speed * Math.sin(rad) * Math.sin(rad)) / (2 * gravity);
  const flightTime = (2 * speed * Math.sin(rad)) / gravity;

  const launch = () => {
    setAttempts((v) => v + 1);
    if (angle < 5 || angle > 85) {
      setMistakeCount((m) => m + 1);
      setLastFeedback("Try an angle between 15 and 75 degrees for better trajectory.");
      return;
    }
    setStepIndex((s) => Math.min(steps.length - 1, s + 1));
    setIsLaunched(true);
    setLastFeedback(`Range: ${range.toFixed(2)}m | Max Height: ${maxHeight.toFixed(2)}m | Flight Time: ${flightTime.toFixed(2)}s`);
  };

  const launchFullscreen = () => {
    setIsFullscreen(true);
    setIsLaunched(true);
    launch();
  };

  if (isFullscreen) {
    return createPortal(
      <div className="fullscreen-overlay">
        <div className="fullscreen-canvas-area">
          <ProjectileCanvas angle={angle} speed={speed} gravity={gravity} isFullscreen={true} isLaunched={isLaunched} />
          <div className="fullscreen-hud">
            <div className="hud-top">
              <h2>Projectile Motion Lab</h2>
              <button className="btn btn-neon" onClick={() => setIsFullscreen(false)}>✕ Exit</button>
            </div>

            <div className="hud-left">
              <div className="hud-mini-control">
                <label>Angle: {angle}°</label>
                <input type="range" min={5} max={85} value={angle} onChange={(e) => setAngle(Number(e.target.value))} />
              </div>
              <div className="hud-mini-control">
                <label>Speed: {speed} m/s</label>
                <input type="range" min={5} max={40} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} />
              </div>
              <div className="hud-mini-control">
                <label>Gravity: {gravity} m/s²</label>
                <input type="range" min={16} max={150} value={Math.round(gravity * 10)} onChange={(e) => setGravity(e.target.value / 10)} />
              </div>
            </div>

            <div className="hud-bottom">
              <div className="hud-stats">
                <div className="hud-stat">
                  <div className="hud-stat-label">Angle</div>
                  <div className="hud-stat-value">{angle}<span className="hud-stat-unit">°</span></div>
                </div>
                <div className="hud-stat">
                  <div className="hud-stat-label">Speed</div>
                  <div className="hud-stat-value">{speed}<span className="hud-stat-unit">m/s</span></div>
                </div>
                <div className="hud-stat">
                  <div className="hud-stat-label">Range</div>
                  <div className="hud-stat-value">{range.toFixed(1)}<span className="hud-stat-unit">m</span></div>
                </div>
                <div className="hud-stat">
                  <div className="hud-stat-label">Max Height</div>
                  <div className="hud-stat-value">{maxHeight.toFixed(1)}<span className="hud-stat-unit">m</span></div>
                </div>
                <div className="hud-stat">
                  <div className="hud-stat-label">Flight Time</div>
                  <div className="hud-stat-value">{flightTime.toFixed(2)}<span className="hud-stat-unit">s</span></div>
                </div>
                <div className="hud-stat">
                  <div className="hud-stat-label">Gravity</div>
                  <div className="hud-stat-value">{gravity}<span className="hud-stat-unit">m/s²</span></div>
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
      <h2>Projectile Motion</h2>
      <InstructionSteps steps={steps} currentStep={stepIndex} />

      <div className="setup-phase">
        <div className="setup-preview">
          <ProjectileCanvas angle={angle} speed={speed} gravity={gravity} isFullscreen={false} isLaunched={isLaunched} />
        </div>

        <ControlRow label="Angle" value={angle} min={5} max={85} unit="°" onChange={setAngle} />
        <ControlRow label="Speed" value={speed} min={5} max={40} unit="m/s" onChange={setSpeed} />
        <ControlRow label="Gravity" value={gravity} min={1.6} max={15} step={0.1} unit="m/s²" onChange={setGravity} />

        <p style={{ fontSize: "0.85rem" }}>
          Range: <strong style={{ color: "var(--accent3)" }}>{range.toFixed(2)} m</strong> | Max H: <strong>{maxHeight.toFixed(2)} m</strong>
        </p>

        <div className="panel-actions">
          <button className="btn" onClick={launch}>Launch</button>
          <button className="run-experiment-btn" onClick={launchFullscreen}>
            ▶ Launch Full View
          </button>
        </div>
      </div>
    </div>
  );
}
