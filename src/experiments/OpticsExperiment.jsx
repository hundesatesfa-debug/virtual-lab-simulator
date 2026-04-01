import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import ControlRow from "../components/ControlRow";
import InstructionSteps from "../components/InstructionSteps";

const steps = ["Configure light source", "Set medium properties", "Observe refraction & reflection", "Analyze color dispersion"];

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}

function wavelengthToColor(wl) {
  let r, g, b;
  if (wl >= 380 && wl < 440) { r = -(wl - 440) / 60; g = 0; b = 1; }
  else if (wl >= 440 && wl < 490) { r = 0; g = (wl - 440) / 50; b = 1; }
  else if (wl >= 490 && wl < 510) { r = 0; g = 1; b = -(wl - 510) / 20; }
  else if (wl >= 510 && wl < 580) { r = (wl - 510) / 70; g = 1; b = 0; }
  else if (wl >= 580 && wl < 645) { r = 1; g = -(wl - 645) / 65; b = 0; }
  else if (wl >= 645 && wl <= 780) { r = 1; g = 0; b = 0; }
  else { r = 0; g = 0; b = 0; }
  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
}

function OpticsCanvas({ incident, n1, n2, lightColor, intensity, wavelength, showDispersion, isFullscreen }) {
  const canvasRef = useRef(null);
  const animRef = useRef(0);
  const timeRef = useRef(0);
  const particlesRef = useRef([]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width;
    const H = canvas.height;
    const t = timeRef.current;

    // Background - deep space
    const bgGrad = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.7);
    bgGrad.addColorStop(0, "#0a0e1a");
    bgGrad.addColorStop(1, "#020408");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // Stars
    for (let i = 0; i < 60; i++) {
      const sx = ((i * 137.5) % W);
      const sy = ((i * 97.3) % H);
      const brightness = 0.2 + 0.3 * Math.sin(t * 0.02 + i);
      ctx.fillStyle = `rgba(200, 220, 255, ${brightness})`;
      ctx.beginPath();
      ctx.arc(sx, sy, 0.8, 0, Math.PI * 2);
      ctx.fill();
    }

    const cx = W * 0.45;
    const cy = H * 0.5;
    const surfaceWidth = 4;

    // Medium boundary surface
    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
    ctx.lineWidth = surfaceWidth;
    ctx.beginPath();
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx, H);
    ctx.stroke();

    // Medium labels
    ctx.font = `${isFullscreen ? 16 : 12}px 'Orbitron', sans-serif`;
    ctx.fillStyle = "rgba(0, 255, 213, 0.6)";
    ctx.textAlign = "center";
    ctx.fillText(`n₁ = ${n1.toFixed(2)}`, cx * 0.5, 30);
    ctx.fillText(`n₂ = ${n2.toFixed(2)}`, cx + (W - cx) * 0.5, 30);

    // Medium 1 fill
    ctx.fillStyle = `rgba(30, 60, 120, ${0.1 * n1})`;
    ctx.fillRect(0, 0, cx, H);

    // Medium 2 fill
    ctx.fillStyle = `rgba(40, 80, 160, ${0.15 * n2})`;
    ctx.fillRect(cx, 0, W - cx, H);

    // Normal line (dashed)
    ctx.setLineDash([6, 6]);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, cy - H * 0.4);
    ctx.lineTo(cx, cy + H * 0.4);
    ctx.stroke();
    ctx.setLineDash([]);

    // Physics calculations
    const incidentRad = (incident * Math.PI) / 180;
    const sinR = (n1 / n2) * Math.sin(incidentRad);
    const totalInternalReflection = Math.abs(sinR) > 1;
    const refractedAngle = totalInternalReflection ? null : Math.asin(sinR);
    const reflectedAngle = incidentRad;

    const rgb = hexToRgb(lightColor);
    const beamLength = W * 0.42;

    // Light source glow
    const srcX = cx - Math.cos(incidentRad) * beamLength;
    const srcY = cy - Math.sin(incidentRad) * beamLength;
    const srcGlow = ctx.createRadialGradient(srcX, srcY, 0, srcX, srcY, 30);
    srcGlow.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${intensity * 0.8})`);
    srcGlow.addColorStop(1, "transparent");
    ctx.fillStyle = srcGlow;
    ctx.fillRect(srcX - 35, srcY - 35, 70, 70);

    // Incident beam - draw from source to surface
    const beamWidth = 3 + intensity * 4;
    const incGrad = ctx.createLinearGradient(srcX, srcY, cx, cy);
    incGrad.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${intensity * 0.3})`);
    incGrad.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${intensity})`);

    ctx.strokeStyle = incGrad;
    ctx.lineWidth = beamWidth;
    ctx.shadowColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${intensity * 0.5})`;
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.moveTo(srcX, srcY);
    ctx.lineTo(cx, cy);
    ctx.stroke();

    // Beam glow
    ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${intensity * 0.15})`;
    ctx.lineWidth = beamWidth * 4;
    ctx.beginPath();
    ctx.moveTo(srcX, srcY);
    ctx.lineTo(cx, cy);
    ctx.stroke();

    ctx.shadowBlur = 0;

    // Impact point glow
    const impactGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 40);
    impactGlow.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${intensity * 0.6})`);
    impactGlow.addColorStop(0.5, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${intensity * 0.15})`);
    impactGlow.addColorStop(1, "transparent");
    ctx.fillStyle = impactGlow;
    ctx.beginPath();
    ctx.arc(cx, cy, 40, 0, Math.PI * 2);
    ctx.fill();

    // Reflected beam
    const refEndX = cx - Math.cos(reflectedAngle) * beamLength;
    const refEndY = cy + Math.sin(reflectedAngle) * beamLength;

    const reflectedIntensity = totalInternalReflection ? intensity : intensity * 0.4 * ((n2 - n1) / (n2 + n1)) ** 2 + intensity * 0.1;

    ctx.strokeStyle = `rgba(255, 90, 169, ${reflectedIntensity})`;
    ctx.lineWidth = beamWidth * (totalInternalReflection ? 1 : 0.6);
    ctx.shadowColor = `rgba(255, 90, 169, ${reflectedIntensity * 0.5})`;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(refEndX, refEndY);
    ctx.stroke();

    // Reflected glow
    ctx.strokeStyle = `rgba(255, 90, 169, ${reflectedIntensity * 0.12})`;
    ctx.lineWidth = beamWidth * 3;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(refEndX, refEndY);
    ctx.stroke();

    ctx.shadowBlur = 0;

    // Refracted beam (if no total internal reflection)
    if (!totalInternalReflection && refractedAngle !== null) {
      if (showDispersion) {
        // Dispersion: show rainbow split
        const colors = [
          { wl: 700, color: "rgba(255, 0, 0," },
          { wl: 620, color: "rgba(255, 165, 0," },
          { wl: 575, color: "rgba(255, 255, 0," },
          { wl: 530, color: "rgba(0, 255, 0," },
          { wl: 480, color: "rgba(0, 150, 255," },
          { wl: 430, color: "rgba(75, 0, 130," },
          { wl: 380, color: "rgba(148, 0, 211," },
        ];

        colors.forEach((c, i) => {
          const dispN2 = n2 + (i - 3) * 0.012;
          const dispSinR = (n1 / dispN2) * Math.sin(incidentRad);
          if (Math.abs(dispSinR) > 1) return;
          const dispAngle = Math.asin(dispSinR);
          const refX = cx + Math.cos(dispAngle) * beamLength;
          const refY = cy + Math.sin(dispAngle) * beamLength;

          ctx.strokeStyle = `${c.color}${intensity * 0.7})`;
          ctx.lineWidth = 2;
          ctx.shadowColor = `${c.color}${intensity * 0.3})`;
          ctx.shadowBlur = 8;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(refX, refY);
          ctx.stroke();
        });
      } else {
        const refX = cx + Math.cos(refractedAngle) * beamLength;
        const refY = cy + Math.sin(refractedAngle) * beamLength;

        ctx.strokeStyle = `rgba(87, 211, 255, ${intensity})`;
        ctx.lineWidth = beamWidth * 0.8;
        ctx.shadowColor = `rgba(87, 211, 255, ${intensity * 0.5})`;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(refX, refY);
        ctx.stroke();

        // Glow
        ctx.strokeStyle = `rgba(87, 211, 255, ${intensity * 0.12})`;
        ctx.lineWidth = beamWidth * 3;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(refX, refY);
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
    }

    // Photon particles animation along beams
    if (particlesRef.current.length < 30) {
      particlesRef.current.push({
        progress: Math.random(),
        speed: 0.005 + Math.random() * 0.008,
        beam: Math.random() > 0.5 ? "incident" : "refracted",
        size: 1.5 + Math.random() * 2,
      });
    }

    particlesRef.current.forEach((p) => {
      p.progress += p.speed * intensity;
      if (p.progress > 1) { p.progress = 0; p.beam = Math.random() > 0.5 ? "incident" : "refracted"; }

      let px, py;
      if (p.beam === "incident") {
        px = srcX + (cx - srcX) * p.progress;
        py = srcY + (cy - srcY) * p.progress;
        ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${intensity * (1 - p.progress * 0.5)})`;
      } else if (!totalInternalReflection && refractedAngle !== null) {
        const refX = cx + Math.cos(refractedAngle) * beamLength;
        const refY = cy + Math.sin(refractedAngle) * beamLength;
        px = cx + (refX - cx) * p.progress;
        py = cy + (refY - cy) * p.progress;
        ctx.fillStyle = `rgba(87, 211, 255, ${intensity * (1 - p.progress * 0.5)})`;
      } else {
        px = cx + (refEndX - cx) * p.progress;
        py = cy + (refEndY - cy) * p.progress;
        ctx.fillStyle = `rgba(255, 90, 169, ${intensity * (1 - p.progress * 0.5)})`;
      }

      ctx.beginPath();
      ctx.arc(px, py, p.size, 0, Math.PI * 2);
      ctx.fill();
    });

    // Angle arc indicators
    const arcRadius = 50;

    // Incident angle arc
    ctx.strokeStyle = "rgba(255, 240, 106, 0.5)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, arcRadius, -Math.PI / 2, -Math.PI / 2 + incidentRad, false);
    ctx.stroke();

    // Angle labels
    ctx.font = `${isFullscreen ? 14 : 11}px 'Orbitron', sans-serif`;
    ctx.fillStyle = "rgba(255, 240, 106, 0.8)";
    ctx.textAlign = "left";
    ctx.fillText(`θᵢ = ${incident}°`, cx - arcRadius - 60, cy - 10);

    if (!totalInternalReflection && refractedAngle !== null) {
      const refDeg = (refractedAngle * 180 / Math.PI).toFixed(1);
      ctx.strokeStyle = "rgba(87, 211, 255, 0.5)";
      ctx.beginPath();
      ctx.arc(cx, cy, arcRadius, Math.PI / 2 - refractedAngle, Math.PI / 2, false);
      ctx.stroke();
      ctx.fillStyle = "rgba(87, 211, 255, 0.8)";
      ctx.fillText(`θᵣ = ${refDeg}°`, cx + 15, cy + arcRadius + 15);
    }

    if (totalInternalReflection) {
      ctx.fillStyle = "rgba(255, 90, 169, 0.9)";
      ctx.font = `${isFullscreen ? 18 : 13}px 'Orbitron', sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText("TOTAL INTERNAL REFLECTION", W / 2, H - 30);
    }

    // Wavelength indicator bar
    const barY = H - 15;
    const barW = W * 0.3;
    const barX = (W - barW) / 2;
    for (let i = 0; i < barW; i++) {
      const wl = 380 + (i / barW) * 400;
      const c = wavelengthToColor(wl);
      ctx.fillStyle = `rgba(${c.r}, ${c.g}, ${c.b}, 0.4)`;
      ctx.fillRect(barX + i, barY, 1, 8);
    }
    // Wavelength marker
    const markerX = barX + ((wavelength - 380) / 400) * barW;
    ctx.fillStyle = "#fff";
    ctx.fillRect(markerX - 1, barY - 2, 3, 12);

    timeRef.current++;
    animRef.current = requestAnimationFrame(draw);
  }, [incident, n1, n2, lightColor, intensity, wavelength, showDispersion, isFullscreen]);

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

export default function OpticsExperiment({ setAttempts, setMistakeCount, setLastFeedback }) {
  const [incident, setIncident] = useState(35);
  const [n1, setN1] = useState(1);
  const [n2, setN2] = useState(1.5);
  const [lightColor, setLightColor] = useState("#fff06a");
  const [intensity, setIntensity] = useState(0.8);
  const [wavelength, setWavelength] = useState(580);
  const [showDispersion, setShowDispersion] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const incidentRad = (incident * Math.PI) / 180;
  const sinR = (n1 / n2) * Math.sin(incidentRad);
  const refracted = sinR <= 1 ? (Math.asin(sinR) * 180) / Math.PI : null;
  const reflected = incident;

  const trace = () => {
    setAttempts((v) => v + 1);
    if (refracted === null) {
      setMistakeCount((m) => m + 1);
      setLastFeedback("Total internal reflection! The light cannot pass into the second medium at this angle.");
      return;
    }
    setStepIndex((s) => Math.min(steps.length - 1, s + 1));
    setLastFeedback(`Refracted angle: ${refracted.toFixed(2)}°. Reflected angle: ${reflected.toFixed(2)}°. Snell's Law: n₁·sin(θ₁) = n₂·sin(θ₂)`);
  };

  const launchFullscreen = () => {
    setIsFullscreen(true);
    trace();
  };

  if (isFullscreen) {
    return createPortal(
      <div className="fullscreen-overlay">
        <div className="fullscreen-canvas-area">
          <OpticsCanvas
            incident={incident}
            n1={n1}
            n2={n2}
            lightColor={lightColor}
            intensity={intensity}
            wavelength={wavelength}
            showDispersion={showDispersion}
            isFullscreen={true}
          />
          <div className="fullscreen-hud">
            <div className="hud-top">
              <h2>Optics Lab — Refraction & Reflection</h2>
              <button className="btn btn-neon" onClick={() => setIsFullscreen(false)}>✕ Exit</button>
            </div>

            <div className="hud-left">
              <div className="hud-mini-control">
                <label>Incident Angle: {incident}°</label>
                <input type="range" min={1} max={89} value={incident} onChange={(e) => setIncident(Number(e.target.value))} />
              </div>
              <div className="hud-mini-control">
                <label>Medium 1 (n₁): {n1.toFixed(1)}</label>
                <input type="range" min={1} max={2} step={0.1} value={n1} onChange={(e) => setN1(Number(e.target.value))} />
              </div>
              <div className="hud-mini-control">
                <label>Medium 2 (n₂): {n2.toFixed(1)}</label>
                <input type="range" min={1} max={2.5} step={0.1} value={n2} onChange={(e) => setN2(Number(e.target.value))} />
              </div>
              <div className="hud-mini-control">
                <label>Intensity: {(intensity * 100).toFixed(0)}%</label>
                <input type="range" min={10} max={100} value={Math.round(intensity * 100)} onChange={(e) => setIntensity(e.target.value / 100)} />
              </div>
            </div>

            <div className="hud-right">
              <div className="hud-mini-control">
                <label>Light Color</label>
                <input type="color" value={lightColor} onChange={(e) => setLightColor(e.target.value)} />
              </div>
              <div className="hud-mini-control">
                <label>Wavelength: {wavelength}nm</label>
                <input type="range" min={380} max={780} value={wavelength} onChange={(e) => setWavelength(Number(e.target.value))} />
              </div>
              <div className="hud-mini-control">
                <label style={{ cursor: "pointer" }}>
                  <input type="checkbox" checked={showDispersion} onChange={(e) => setShowDispersion(e.target.checked)} style={{ accentColor: "var(--neon)" }} />
                  {" "}Dispersion
                </label>
              </div>
            </div>

            <div className="hud-bottom">
              <div className="hud-stats">
                <div className="hud-stat">
                  <div className="hud-stat-label">Incident</div>
                  <div className="hud-stat-value">{incident}<span className="hud-stat-unit">°</span></div>
                </div>
                <div className="hud-stat">
                  <div className="hud-stat-label">Refracted</div>
                  <div className="hud-stat-value">{refracted !== null ? refracted.toFixed(1) : "TIR"}<span className="hud-stat-unit">{refracted !== null ? "°" : ""}</span></div>
                </div>
                <div className="hud-stat">
                  <div className="hud-stat-label">Reflected</div>
                  <div className="hud-stat-value">{reflected}<span className="hud-stat-unit">°</span></div>
                </div>
                <div className="hud-stat">
                  <div className="hud-stat-label">Intensity</div>
                  <div className="hud-stat-value">{(intensity * 100).toFixed(0)}<span className="hud-stat-unit">%</span></div>
                </div>
                <div className="hud-stat">
                  <div className="hud-stat-label">Snell Ratio</div>
                  <div className="hud-stat-value">{(n1 / n2).toFixed(3)}</div>
                </div>
                <div className="hud-stat">
                  <div className="hud-stat-label">Critical Angle</div>
                  <div className="hud-stat-value">{n1 < n2 ? "N/A" : (Math.asin(n2 / n1) * 180 / Math.PI).toFixed(1)}<span className="hud-stat-unit">{n1 >= n2 ? "°" : ""}</span></div>
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
      <h2>Refraction & Reflection of Light</h2>
      <InstructionSteps steps={steps} currentStep={stepIndex} />

      <div className="setup-phase">
        <div className="setup-preview">
          <OpticsCanvas
            incident={incident}
            n1={n1}
            n2={n2}
            lightColor={lightColor}
            intensity={intensity}
            wavelength={wavelength}
            showDispersion={showDispersion}
            isFullscreen={false}
          />
        </div>

        <ControlRow label="Incident Angle" value={incident} min={1} max={89} unit="°" onChange={setIncident} />
        <ControlRow label="Medium 1 (n₁)" value={n1} min={1} max={2} step={0.1} unit="" onChange={setN1} />
        <ControlRow label="Medium 2 (n₂)" value={n2} min={1} max={2.5} step={0.1} unit="" onChange={setN2} />
        <ControlRow label="Intensity" value={Math.round(intensity * 100)} min={10} max={100} unit="%" onChange={(v) => setIntensity(v / 100)} />
        <ControlRow label="Wavelength" value={wavelength} min={380} max={780} unit="nm" onChange={setWavelength} />

        <div className="color-row">
          <label>Light Color <input type="color" value={lightColor} onChange={(e) => setLightColor(e.target.value)} /></label>
          <label className="toggle"><input type="checkbox" checked={showDispersion} onChange={(e) => setShowDispersion(e.target.checked)} /> Show Dispersion</label>
        </div>

        <p style={{ fontSize: "0.82rem", color: "var(--muted)" }}>
          {refracted !== null
            ? `θ refracted: ${refracted.toFixed(2)}° | θ reflected: ${reflected}°`
            : "⚠ Total Internal Reflection at this angle"}
        </p>

        <div className="panel-actions">
          <button className="btn" onClick={trace}>Trace Rays</button>
          <button className="run-experiment-btn" onClick={launchFullscreen}>
            ▶ Launch Full View
          </button>
        </div>
      </div>
    </div>
  );
}
