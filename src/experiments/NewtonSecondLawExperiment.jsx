import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ControlRow from "../components/ControlRow";
import Graph from "../components/Graph";
import InstructionSteps from "../components/InstructionSteps";

const steps = ["Set mass", "Apply force", "Observe acceleration", "Validate F = ma"];

function NewtonCanvas({ mass, force, acceleration, isFullscreen, isSimRunning }) {
  const canvasRef = useRef(null);
  const animRef = useRef(0);
  const timeRef = useRef(0);
  const objectPosRef = useRef(0);
  const objectVelRef = useRef(0);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width;
    const H = canvas.height;
    const t = timeRef.current;

    // Background - space station interior
    const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0, "#0a0f1e");
    bgGrad.addColorStop(0.5, "#0d1428");
    bgGrad.addColorStop(1, "#060a14");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // Grid floor
    const groundY = H * 0.72;
    ctx.strokeStyle = "rgba(0, 255, 213, 0.08)";
    ctx.lineWidth = 1;
    for (let i = 0; i < W; i += 40) {
      ctx.beginPath();
      ctx.moveTo(i, groundY);
      ctx.lineTo(i, H);
      ctx.stroke();
    }
    for (let j = groundY; j < H; j += 20) {
      ctx.beginPath();
      ctx.moveTo(0, j);
      ctx.lineTo(W, j);
      ctx.stroke();
    }

    // Floor surface
    ctx.fillStyle = "rgba(10, 20, 40, 0.8)";
    ctx.fillRect(0, groundY, W, H - groundY);
    ctx.strokeStyle = "rgba(0, 255, 213, 0.3)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(W, groundY);
    ctx.stroke();

    // Object physics
    if (isSimRunning) {
      objectVelRef.current += acceleration * 0.016;
      objectPosRef.current += objectVelRef.current * 0.5;
      if (objectPosRef.current > W * 0.85) {
        objectPosRef.current = W * 0.15;
        objectVelRef.current = 0;
      }
    }

    const objX = W * 0.15 + objectPosRef.current;
    const objSize = 20 + mass * 2.5;
    const objY = groundY - objSize;

    // Object shadow
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.beginPath();
    ctx.ellipse(objX, groundY, objSize * 0.8, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Object (mass block)
    const massColor = `hsl(${200 - mass * 5}, 70%, ${60 - mass * 1.5}%)`;
    const objGrad = ctx.createLinearGradient(objX - objSize / 2, objY, objX + objSize / 2, objY + objSize);
    objGrad.addColorStop(0, massColor);
    objGrad.addColorStop(1, `hsl(${200 - mass * 5}, 70%, ${35 - mass}%)`);
    ctx.fillStyle = objGrad;

    ctx.beginPath();
    ctx.roundRect(objX - objSize / 2, objY, objSize, objSize, 4);
    ctx.fill();

    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Mass label on block
    ctx.font = `bold ${Math.max(10, isFullscreen ? 14 : 11)}px 'Orbitron', sans-serif`;
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.textAlign = "center";
    ctx.fillText(`${mass}kg`, objX, objY + objSize / 2 + 4);

    // Force arrow
    if (force > 0) {
      const arrowLen = Math.min(W * 0.35, force * 2.5);
      const arrowY = objY + objSize / 2;
      const arrowStartX = objX + objSize / 2 + 5;
      const arrowEndX = arrowStartX + arrowLen;

      // Arrow shaft glow
      ctx.shadowColor = "rgba(255, 80, 80, 0.5)";
      ctx.shadowBlur = 15;

      const forceGrad = ctx.createLinearGradient(arrowStartX, 0, arrowEndX, 0);
      forceGrad.addColorStop(0, "rgba(255, 80, 80, 0.9)");
      forceGrad.addColorStop(1, "rgba(255, 50, 50, 0.6)");

      ctx.strokeStyle = forceGrad;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(arrowStartX, arrowY);
      ctx.lineTo(arrowEndX, arrowY);
      ctx.stroke();

      // Arrowhead
      ctx.fillStyle = "rgba(255, 80, 80, 0.9)";
      ctx.beginPath();
      ctx.moveTo(arrowEndX + 12, arrowY);
      ctx.lineTo(arrowEndX - 4, arrowY - 8);
      ctx.lineTo(arrowEndX - 4, arrowY + 8);
      ctx.closePath();
      ctx.fill();

      ctx.shadowBlur = 0;

      // Force label
      ctx.font = `bold ${isFullscreen ? 16 : 12}px 'Orbitron', sans-serif`;
      ctx.fillStyle = "rgba(255, 120, 100, 0.9)";
      ctx.textAlign = "center";
      ctx.fillText(`F = ${force} N`, arrowStartX + arrowLen / 2, arrowY - 15);
    }

    // Acceleration arrow (below object)
    if (acceleration > 0) {
      const accelLen = Math.min(W * 0.3, acceleration * 15);
      const accelY = groundY + 25;
      const accelStartX = objX;

      ctx.shadowColor = "rgba(0, 255, 213, 0.4)";
      ctx.shadowBlur = 10;

      const accelGrad = ctx.createLinearGradient(accelStartX, 0, accelStartX + accelLen, 0);
      accelGrad.addColorStop(0, "rgba(0, 255, 213, 0.9)");
      accelGrad.addColorStop(1, "rgba(0, 255, 213, 0.4)");

      ctx.strokeStyle = accelGrad;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(accelStartX, accelY);
      ctx.lineTo(accelStartX + accelLen, accelY);
      ctx.stroke();

      // Arrowhead
      ctx.fillStyle = "rgba(0, 255, 213, 0.9)";
      ctx.beginPath();
      ctx.moveTo(accelStartX + accelLen + 10, accelY);
      ctx.lineTo(accelStartX + accelLen - 3, accelY - 6);
      ctx.lineTo(accelStartX + accelLen - 3, accelY + 6);
      ctx.closePath();
      ctx.fill();

      ctx.shadowBlur = 0;

      ctx.font = `bold ${isFullscreen ? 14 : 11}px 'Orbitron', sans-serif`;
      ctx.fillStyle = "rgba(0, 255, 213, 0.9)";
      ctx.textAlign = "center";
      ctx.fillText(`a = ${acceleration.toFixed(2)} m/s²`, accelStartX + accelLen / 2, accelY + 18);
    }

    // Velocity trail particles
    if (isSimRunning && objectVelRef.current > 0.5) {
      for (let i = 0; i < 8; i++) {
        const px = objX - objSize / 2 - Math.random() * objectVelRef.current * 10;
        const py = objY + Math.random() * objSize;
        const alpha = Math.random() * 0.3;
        ctx.fillStyle = `rgba(150, 200, 255, ${alpha})`;
        ctx.beginPath();
        ctx.arc(px, py, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Motion blur lines
    if (isSimRunning && objectVelRef.current > 2) {
      for (let i = 0; i < 5; i++) {
        const lineY = objY + Math.random() * objSize;
        const lineLen = objectVelRef.current * 3;
        ctx.strokeStyle = `rgba(0, 255, 213, ${0.1})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(objX - objSize - lineLen, lineY);
        ctx.lineTo(objX - objSize, lineY);
        ctx.stroke();
      }
    }

    // Equation display
    ctx.font = `${isFullscreen ? 18 : 13}px 'Orbitron', sans-serif`;
    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    ctx.textAlign = "center";
    ctx.fillText("F = m × a", W / 2, H * 0.12);

    ctx.font = `${isFullscreen ? 14 : 10}px 'Inter', sans-serif`;
    ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
    ctx.fillText(`${force} N = ${mass} kg × ${acceleration.toFixed(2)} m/s²`, W / 2, H * 0.12 + (isFullscreen ? 25 : 18));

    timeRef.current++;
    animRef.current = requestAnimationFrame(draw);
  }, [mass, force, acceleration, isFullscreen, isSimRunning]);

  useEffect(() => {
    objectPosRef.current = 0;
    objectVelRef.current = 0;
  }, [mass, force]);

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

export default function NewtonSecondLawExperiment({ setAttempts, setMistakeCount, setLastFeedback }) {
  const [mass, setMass] = useState(4);
  const [force, setForce] = useState(20);
  const [stepIndex, setStepIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSimRunning, setIsSimRunning] = useState(false);

  const acceleration = force / mass;

  const points = useMemo(
    () =>
      Array.from({ length: 20 }, (_, i) => {
        const f = i * 3 + 1;
        return { x: f, y: f / mass };
      }),
    [mass]
  );

  const validate = () => {
    setAttempts((v) => v + 1);
    if (mass <= 0) {
      setMistakeCount((m) => m + 1);
      setLastFeedback("Mass must be greater than zero.");
      return;
    }
    setStepIndex((s) => Math.min(steps.length - 1, s + 1));
    setIsSimRunning(true);
    setLastFeedback(`Acceleration is ${acceleration.toFixed(2)} m/s². F = ${force}N, m = ${mass}kg.`);
  };

  const launchFullscreen = () => {
    setIsFullscreen(true);
    setIsSimRunning(true);
    validate();
  };

  if (isFullscreen) {
    return (
      <div className="fullscreen-overlay">
        <div className="fullscreen-canvas-area">
          <NewtonCanvas mass={mass} force={force} acceleration={acceleration} isFullscreen={true} isSimRunning={isSimRunning} />
          <div className="fullscreen-hud">
            <div className="hud-top">
              <h2>Newton's Second Law — F = ma</h2>
              <button className="btn btn-neon" onClick={() => setIsFullscreen(false)}>✕ Exit</button>
            </div>

            <div className="hud-left">
              <div className="hud-mini-control">
                <label>Mass: {mass} kg</label>
                <input type="range" min={1} max={20} value={mass} onChange={(e) => setMass(Number(e.target.value))} />
              </div>
              <div className="hud-mini-control">
                <label>Force: {force} N</label>
                <input type="range" min={1} max={120} value={force} onChange={(e) => setForce(Number(e.target.value))} />
              </div>
              <div className="hud-mini-control">
                <button className="btn btn-neon" onClick={() => { setIsSimRunning(false); setTimeout(() => setIsSimRunning(true), 50); }} style={{ width: "100%" }}>
                  ↻ Reset Motion
                </button>
              </div>
            </div>

            <div className="hud-bottom">
              <div className="hud-stats">
                <div className="hud-stat">
                  <div className="hud-stat-label">Mass</div>
                  <div className="hud-stat-value">{mass}<span className="hud-stat-unit">kg</span></div>
                </div>
                <div className="hud-stat">
                  <div className="hud-stat-label">Force</div>
                  <div className="hud-stat-value">{force}<span className="hud-stat-unit">N</span></div>
                </div>
                <div className="hud-stat">
                  <div className="hud-stat-label">Acceleration</div>
                  <div className="hud-stat-value">{acceleration.toFixed(2)}<span className="hud-stat-unit">m/s²</span></div>
                </div>
                <div className="hud-stat">
                  <div className="hud-stat-label">Weight</div>
                  <div className="hud-stat-value">{(mass * 9.8).toFixed(1)}<span className="hud-stat-unit">N</span></div>
                </div>
                <div className="hud-stat">
                  <div className="hud-stat-label">Momentum Rate</div>
                  <div className="hud-stat-value">{force.toFixed(0)}<span className="hud-stat-unit">kg·m/s²</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="experiment">
      <h2>Newton's Second Law</h2>
      <InstructionSteps steps={steps} currentStep={stepIndex} />

      <div className="setup-phase">
        <div className="setup-preview">
          <NewtonCanvas mass={mass} force={force} acceleration={acceleration} isFullscreen={false} isSimRunning={isSimRunning} />
        </div>

        <ControlRow label="Mass" value={mass} min={1} max={20} unit="kg" onChange={setMass} />
        <ControlRow label="Force" value={force} min={1} max={120} unit="N" onChange={setForce} />

        <p style={{ fontSize: "0.85rem" }}>
          Acceleration: <strong style={{ color: "var(--neon)" }}>{acceleration.toFixed(2)} m/s²</strong>
        </p>

        <div className="panel-actions">
          <button className="btn" onClick={validate}>Validate</button>
          <button className="run-experiment-btn" onClick={launchFullscreen}>
            ▶ Launch Full View
          </button>
        </div>

        <Graph points={points} xLabel="Force (N)" yLabel="Acceleration (m/s²)" color="#ffb347" />
      </div>
    </div>
  );
}
