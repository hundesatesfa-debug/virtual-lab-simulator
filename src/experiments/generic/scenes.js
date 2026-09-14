const STORE = new WeakMap();

function getStore(canvas) {
  if (!STORE.has(canvas)) STORE.set(canvas, {});
  return STORE.get(canvas);
}

function st(ctx, size, family = "'Orbitron', sans-serif", weight = "bold") {
  ctx.font = `${weight} ${Math.max(7, size)}px ${family}`;
}

function stars(ctx, W, H, t, n = 50) {
  for (let i = 0; i < n; i++) {
    const sx = ((i * 173.7) % W);
    const sy = ((i * 89.3) % H);
    ctx.fillStyle = `rgba(180, 200, 255, ${0.12 + 0.18 * Math.sin(t * 0.02 + i * 1.3)})`;
    ctx.beginPath();
    ctx.arc(sx, sy, 0.7, 0, Math.PI * 2);
    ctx.fill();
  }
}

function background(ctx, W, H) {
  const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.75);
  g.addColorStop(0, "#0c1220");
  g.addColorStop(1, "#040810");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

function ground(ctx, W, H, y = H * 0.85) {
  const gg = ctx.createLinearGradient(0, y, 0, H);
  gg.addColorStop(0, "#16233a");
  gg.addColorStop(1, "#0a1322");
  ctx.fillStyle = gg;
  ctx.fillRect(0, y, W, H - y);
  ctx.strokeStyle = "rgba(0, 255, 213, 0.25)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(W, y);
  ctx.stroke();
}

function arrow(ctx, fromX, fromY, toX, toY, color, width = 3, head = 8) {
  const ang = Math.atan2(toY - fromY, toX - fromX);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.lineTo(toX, toY);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(toX, toY);
  ctx.lineTo(toX - head * Math.cos(ang - 0.4), toY - head * Math.sin(ang - 0.4));
  ctx.lineTo(toX - head * Math.cos(ang + 0.4), toY - head * Math.sin(ang + 0.4));
  ctx.closePath();
  ctx.fill();
}

function fadingTrail(S, key, x, y, max = 60, fade = 0.94) {
  if (!S) return;
  if (S.trailKey !== key) {
    S.trail = [];
    S.trailKey = key;
  }
  S.trail.push({ x, y, a: 1 });
  if (S.trail.length > max) S.trail.shift();
  S.trail.forEach((p) => {
    p.a *= fade;
    if (p.a < 0.01) p.a = 0;
  });
  return S.trail;
}

function drawTrail(ctx, trail, color) {
  trail.forEach((p) => {
    if (p.a <= 0) return;
    ctx.fillStyle = color.replace("ALPHA", p.a.toFixed(3));
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
    ctx.fill();
  });
}

function equationFooter(ctx, W, H, text, full) {
  st(ctx, full ? 16 : 11);
  ctx.fillStyle = "rgba(255,255,255,0.2)";
  ctx.textAlign = "center";
  ctx.fillText(text, W / 2, H - (full ? 26 : 14));
}

function hsl(color) {
  return color;
}

// ─────────────────────────────────────────────────────────────
// 02 · SERIES / PARALLEL CIRCUITS
// ─────────────────────────────────────────────────────────────
function circuitSP(ctx, scene, W, H, t, full, S) {
  background(ctx, W, H);
  stars(ctx, W, H, t, 30);
  const margin = W * 0.12;
  const top = H * 0.24;
  const bottom = H * 0.7;
  const left = margin;
  const right = W - margin;
  const mid = (top + bottom) / 2;
  const glow = Math.min(1, (scene.i || scene.iTotal || 0) / 4);
  const wire = `rgba(0, 255, 213, ${0.4 + glow * 0.4})`;

  ctx.strokeStyle = wire;
  ctx.lineWidth = 3;
  ctx.shadowColor = `rgba(0,255,213,${glow * 0.4})`;
  ctx.shadowBlur = 8;

  const battery = (x, y) => {
    ctx.fillStyle = "rgba(60,70,90,0.9)";
    ctx.fillRect(x - 14, y - 30, 28, 60);
    ctx.strokeStyle = "rgba(255,255,255,0.4)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x - 14, y - 30, 28, 60);
    ctx.fillStyle = "#ff4444";
    ctx.fillRect(x - 10, y - 36, 7, 6);
    ctx.fillStyle = "#4444ff";
    ctx.fillRect(x + 3, y - 36, 7, 6);
    st(ctx, full ? 14 : 10);
    ctx.fillStyle = "#ffc832";
    ctx.textAlign = "center";
    ctx.fillText(`${scene.v}V`, x, y + 4);
  };

  const resistor = (x, y, ohms) => {
    ctx.save();
    ctx.strokeStyle = `rgba(255, ${Math.max(0, 190 - ohms * 8)}, 80, 0.9)`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x - 24, y);
    for (let i = 0; i < 6; i++) {
      const yy = y - 26 + (i + 0.5) * (52 / 6);
      ctx.lineTo(x + (i % 2 === 0 ? 7 : -7), yy);
    }
    ctx.lineTo(x + 24, y + 26);
    ctx.lineTo(x + 24, y);
    ctx.stroke();
    st(ctx, full ? 13 : 9);
    ctx.fillStyle = "rgba(255,170,90,0.95)";
    ctx.textAlign = "center";
    ctx.fillText(`${ohms}Ω`, x + 26, y - 4);
    ctx.restore();
  };

  const voltmeter = (x, y, text) => {
    ctx.beginPath();
    ctx.arc(x, y, full ? 22 : 16, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(20,30,50,0.95)";
    ctx.fill();
    ctx.strokeStyle = "#57d3ff";
    ctx.lineWidth = 2;
    ctx.stroke();
    st(ctx, full ? 11 : 8, "'Inter', sans-serif", "bold");
    ctx.fillStyle = "#57d3ff";
    ctx.textAlign = "center";
    ctx.fillText(text, x, y + 3);
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.fillText("V", x, y - (full ? 24 : 18));
  };

  if (scene.config === "series") {
    // Main loop
    ctx.beginPath();
    ctx.moveTo(left, top);
    ctx.lineTo(right, top);
    ctx.lineTo(right, bottom);
    ctx.lineTo(left, bottom);
    ctx.lineTo(left, top);
    ctx.stroke();
    ctx.shadowBlur = 0;

    battery(left, mid);

    const rW = (right - left - 40) / 3;
    const drops = scene.drops || [];
    const resistors = scene.rList || [5, 6, 7];
    resistors.forEach((rr, i) => {
      const x = left + 60 + rW * i + rW / 2;
      ctx.beginPath();
      ctx.moveTo(i === 0 ? left : left + 60 + rW * (i - 1) + rW, top);
      ctx.lineTo(x - 24, top);
      ctx.stroke();
      resistor(x, top - 6, rr);
      voltmeter(x, bottom + (full ? 26 : 20), (drops[i] ?? 0).toFixed(1));
      ctx.strokeStyle = "rgba(124,97,255,0.5)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(x, top + 6);
      ctx.lineTo(x, bottom);
      ctx.stroke();
      ctx.setLineDash([]);
    });
    // Ammeter
    const amX = right;
    ctx.beginPath();
    ctx.arc(amX, mid, full ? 22 : 16, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(20,30,50,0.95)";
    ctx.fill();
    ctx.strokeStyle = "#00ffd5";
    ctx.lineWidth = 2;
    ctx.stroke();
    st(ctx, full ? 11 : 8, "'Inter', sans-serif", "bold");
    ctx.fillStyle = "#00ffd5";
    ctx.textAlign = "center";
    ctx.fillText((scene.iTotal ?? 0).toFixed(2), amX, mid + 3);
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.fillText("A", amX, mid - (full ? 24 : 18));

    st(ctx, full ? 13 : 10);
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillText(`R_total = ${scene.rt.toFixed(1)} Ω   I = ${scene.iTotal.toFixed(2)} A`, W / 2, H * 0.12);
  } else {
    // Parallel: three vertical branches from top rail to bottom rail
    ctx.beginPath();
    ctx.moveTo(left, top);
    ctx.lineTo(right, top);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(left, bottom);
    ctx.lineTo(right, bottom);
    ctx.stroke();
    ctx.shadowBlur = 0;

    battery(left, mid);

    const branches = scene.rList || [5, 6, 7];
    const bSpacing = (right - left - 30) / branches.length;
    (scene.iList || []).forEach((bi, i) => {
      const x = left + 30 + bSpacing * i + bSpacing / 2;
      ctx.strokeStyle = wire;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x, bottom);
      ctx.stroke();
      resistor(x, mid - 8, branches[i]);
      st(ctx, full ? 11 : 8, "'Inter', sans-serif", "bold");
      ctx.fillStyle = "#ff4fd8";
      ctx.textAlign = "center";
      ctx.fillText(`I=${bi.toFixed(2)}A`, x, bottom + (full ? 24 : 18));
    });

    const amX = right;
    ctx.beginPath();
    ctx.arc(amX, mid, full ? 22 : 16, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(20,30,50,0.95)";
    ctx.fill();
    ctx.strokeStyle = "#00ffd5";
    ctx.lineWidth = 2;
    ctx.stroke();
    st(ctx, full ? 11 : 8, "'Inter', sans-serif", "bold");
    ctx.fillStyle = "#00ffd5";
    ctx.textAlign = "center";
    ctx.fillText((scene.iTotal ?? 0).toFixed(2), amX, mid + 3);
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.fillText("A", amX, mid - (full ? 24 : 18));

    st(ctx, full ? 13 : 10);
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillText(`R_total = ${scene.rt.toFixed(2)} Ω   1/R = Σ 1/R${"i".toLowerCase()}   I = ${scene.iTotal.toFixed(2)} A`, W / 2, H * 0.12);
  }

  equationFooter(ctx, W, H, scene.config === "series" ? "R = R1 + R2 + R3" : "1/R = 1/R1 + 1/R2 + 1/R3", full);
}

// ─────────────────────────────────────────────────────────────
// 04 · FREE FALL
// ─────────────────────────────────────────────────────────────
function freeFall(ctx, scene, W, H, t, full, S) {
  background(ctx, W, H);
  stars(ctx, W, H, t, 40);
  const groundY = H * 0.82;
  ground(ctx, W, H, groundY);
  const scale = (groundY - H * 0.08) / Math.max(scene.h0, 1);
  const startY = H * 0.08;
  const fallDist = Math.min(scene.h0, scene.h || 0);
  const by = startY + fallDist * scale;
  st(ctx, full ? 12 : 9);
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.textAlign = "left";
  ctx.fillText(`h₀ = ${scene.h0} m`, W * 0.05, H * 0.1);
  // Height markers
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = "rgba(255,255,255,0.15)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(W * 0.15, startY);
  ctx.lineTo(W * 0.15, groundY);
  ctx.stroke();
  ctx.setLineDash([]);
  // Object
  const radius = full ? 16 : 12;
  const glow = ctx.createRadialGradient(W * 0.3, by, 0, W * 0.3, by, radius * 3);
  glow.addColorStop(0, "rgba(255,200,80,0.5)");
  glow.addColorStop(1, "transparent");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(W * 0.3, by, radius * 3, 0, Math.PI * 2);
  ctx.fill();
  const grad = ctx.createRadialGradient(W * 0.3 - 3, by - 3, 0, W * 0.3, by, radius);
  grad.addColorStop(0, "#ffe9a8");
  grad.addColorStop(0.6, "#ffb347");
  grad.addColorStop(1, "#e07020");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(W * 0.3, by, radius, 0, Math.PI * 2);
  ctx.fill();
  // Velocity arrow
  if (scene.phase !== "ready" && fallDist >= 0) {
    const vLen = Math.min(H * 0.4, (scene.v || 0) * 3.5);
    arrow(ctx, W * 0.3 + radius, by, W * 0.3 + radius, by + vLen, "rgba(87,211,255,0.9)", 3, 9);
    st(ctx, full ? 12 : 9);
    ctx.fillStyle = "#57d3ff";
    ctx.textAlign = "left";
    ctx.fillText(`v = ${(scene.v || 0).toFixed(1)} m/s`, W * 0.3 + radius + 10, by + vLen / 2);
  }
  st(ctx, full ? 12 : 9);
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.textAlign = "left";
  ctx.fillText(`y = ${(scene.h ?? 0).toFixed(1)} m`, W * 0.3 + radius + 10, by);
  // Acceleration glyph
  st(ctx, full ? 13 : 10);
  ctx.fillStyle = "rgba(255,120,100,0.85)";
  ctx.textAlign = "right";
  ctx.fillText(`a = g = ${scene.g.toFixed(1)} m/s²`, W - W * 0.04, H * 0.1);
  equationFooter(ctx, W, H, "v = u + gt      s = ut + ½gt²      v² = u² + 2gs", full);
}

// ─────────────────────────────────────────────────────────────
// 07 · FRICTION
// ─────────────────────────────────────────────────────────────
function friction(ctx, scene, W, H, t, full, S) {
  background(ctx, W, H);
  stars(ctx, W, H, t, 30);
  const groundY = H * 0.72;
  ground(ctx, W, H, groundY);
  const size = full ? 70 : 52;
  const maxX = W * 0.8;
  const trackLen = 60; // displayed track length in metres
  const x = W * 0.1 + (((scene.pos || 0) % trackLen) / trackLen) * (maxX - W * 0.1);
  const y = groundY - size;
  // Surface texture lines
  ctx.strokeStyle = "rgba(255,255,255,0.1)";
  ctx.lineWidth = 1;
  for (let i = W * 0.06; i < W * 0.94; i += 14) {
    ctx.beginPath();
    ctx.moveTo(i, groundY + 6);
    ctx.lineTo(i + 6, groundY + 14);
    ctx.stroke();
  }
  // Block
  const grad = ctx.createLinearGradient(x, y, x + size, y + size);
  grad.addColorStop(0, "#7b9cff");
  grad.addColorStop(1, "#3a57c9");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.roundRect(x, y, size, size, 8);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.4)";
  ctx.lineWidth = 2;
  ctx.stroke();
  st(ctx, full ? 14 : 10);
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.fillText(`${scene.mass} kg`, x + size / 2, y + size / 2 + 4);
  // Applied force arrow (right)
  const Fsc = Math.min(W * 0.3, scene.applied * 1.4);
  arrow(ctx, x + size + 6, y + size / 2, x + size + 6 + Fsc, y + size / 2, scene.moving ? "rgba(255,120,90,0.9)" : "rgba(255,150,120,0.6)", 4, 10);
  st(ctx, full ? 12 : 9);
  ctx.fillStyle = "#ff9a76";
  ctx.textAlign = "left";
  ctx.fillText(`F = ${scene.applied.toFixed(0)} N`, x + size + 10 + Fsc * 0.1, y + size / 2 - 10);
  // Friction arrow (left)
  if (scene.friction > 0.01) {
    const fsc = Math.min(W * 0.28, scene.friction * 1.5);
    arrow(ctx, x - 10, y + size / 2, x - 10 - fsc, y + size / 2, scene.moving ? "rgba(87,211,255,0.9)" : "rgba(150,190,255,0.7)", 4, 10);
    st(ctx, full ? 12 : 9);
    ctx.fillStyle = "#57d3ff";
    ctx.textAlign = "right";
    ctx.fillText(`f = ${scene.friction.toFixed(1)} N`, x - 14 - fsc, y + size / 2 - 10);
  }
  // Phase label
  st(ctx, full ? 16 : 12);
  ctx.fillStyle = scene.moving ? "#42ff80" : "rgba(255,196,111,0.9)";
  ctx.textAlign = "center";
  ctx.fillText(scene.moving ? "KINETIC FRICTION" : "STATIC FRICTION", W / 2, H * 0.1);
  // Net / acceleration
  st(ctx, full ? 13 : 10);
  ctx.fillStyle = "rgba(255,255,255,0.65)";
  ctx.fillText(
    `F_net = ${scene.net.toFixed(1)} N   a = ${scene.accel.toFixed(2)} m/s²   (μs=${scene.muS.toFixed(2)} μk=${scene.muK.toFixed(2)})`,
    W / 2,
    H * 0.16
  );
  equationFooter(ctx, W, H, "F = μN    N = mg", full);
}

// ─────────────────────────────────────────────────────────────
// 08 · HOOKE'S LAW  /  23 · SHM  (spring scenes)
// ─────────────────────────────────────────────────────────────
function springVertical(ctx, scene, W, H, t, full, S, isSHM) {
  background(ctx, W, H);
  stars(ctx, W, H, t, 25);
  const top = H * 0.1;
  const pivotX = W / 2;
  const restY = isSHM ? H * 0.5 : H * 0.4;
  // Support
  ctx.fillStyle = "rgba(80,90,110,0.9)";
  ctx.fillRect(pivotX - W * 0.18, top - 8, W * 0.36, 12);
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.lineWidth = 1;
  ctx.strokeRect(pivotX - W * 0.18, top - 8, W * 0.36, 12);
  // extension
  const ext = scene.extension ?? 0; // meters
  const extPx = ext * Math.min(H * 0.4, full ? 28 : 18);
  const bobY = restY + extPx;
  // Spring zigzag
  const coils = 9;
  const springTop = top + 8;
  ctx.strokeStyle = "rgba(210,214,235,0.9)";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(pivotX, springTop);
  const coilH = (bobY - springTop) / coils;
  for (let i = 0; i < coils; i++) {
    const y1 = springTop + i * coilH;
    const y2 = y1 + coilH;
    ctx.lineTo(pivotX + (full ? 10 : 7), y1);
    ctx.lineTo(pivotX - (full ? 10 : 7), (y1 + y2) / 2);
    ctx.lineTo(pivotX + (full ? 10 : 7), y2);
  }
  ctx.lineTo(pivotX, bobY);
  ctx.stroke();
  // Bob
  const r = full ? 22 : 16;
  const grad = ctx.createRadialGradient(pivotX - 4, bobY - 4, 0, pivotX, bobY, r);
  grad.addColorStop(0, "#9affb4");
  grad.addColorStop(1, "#1fcc56");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(pivotX, bobY, r, 0, Math.PI * 2);
  ctx.fill();
  st(ctx, full ? 13 : 10);
  ctx.fillStyle = "#04240f";
  ctx.textAlign = "center";
  ctx.fillText(`${scene.mass ?? scene.m ?? 0} kg`, pivotX, bobY + 3);
  if (isSHM) {
    // reference circle on side
    const oy = H * 0.3;
    const ox = W * 0.85;
    ctx.strokeStyle = "rgba(0,255,213,0.25)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(ox, oy, full ? 34 : 26, 0, Math.PI * 2);
    ctx.stroke();
    const ph = scene.phaseAngle ?? 0;
    const px = ox + Math.cos(ph) * (full ? 34 : 26);
    const py = oy - Math.sin(ph) * (full ? 34 : 26);
    ctx.fillStyle = "rgba(66,255,128,0.9)";
    ctx.beginPath();
    ctx.arc(px, py, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(66,255,128,0.4)";
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px, oy);
    ctx.stroke();
    ctx.setLineDash([]);
    st(ctx, full ? 10 : 8);
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillText("ref. circle", ox, oy + (full ? 46 : 36));
  }
  // Force arrow
  const flen = Math.min(H * 0.3, (scene.force ?? 0) * 2);
  arrow(ctx, pivotX, bobY + r + 6, pivotX, bobY + r + 6 + flen, "rgba(255,90,90,0.85)", 3, 9);
  st(ctx, full ? 12 : 9);
  ctx.fillStyle = "rgba(255,120,100,0.9)";
  ctx.textAlign = "left";
  ctx.fillText(`F = ${(scene.force ?? 0).toFixed(1)} N`, pivotX + 10, bobY + r + 6 + flen / 2);
  // extension marker
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = "rgba(0,255,213,0.3)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pivotX + (full ? 26 : 20), restY);
  ctx.lineTo(pivotX + (full ? 26 : 20), bobY);
  ctx.stroke();
  ctx.setLineDash([]);
  st(ctx, full ? 11 : 8);
  ctx.fillStyle = "rgba(0,255,213,0.7)";
  ctx.textAlign = "left";
  ctx.fillText(`x = ${(scene.extension ?? 0).toFixed(3)} m`, pivotX + (full ? 32 : 26), (restY + bobY) / 2);
  st(ctx, full ? 13 : 10);
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.textAlign = "center";
  ctx.fillText(`k = ${(scene.k ?? 0).toFixed(0)} N/m`, W / 2, H * 0.05);
  equationFooter(ctx, W, H, isSHM ? "x = A cos(ωt + φ)   ω = √(k/m)" : "F = -kx   PE = ½kx²", full);
  if (scene.minHeight !== undefined) {
    const mh = scene.minHeight ?? 0;
    ctx.strokeStyle = "rgba(255,79,216,0.5)";
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(pivotX - (full ? 26 : 20), restY - mh);
    ctx.lineTo(pivotX + (full ? 26 : 20), restY - mh);
    ctx.stroke();
    st(ctx, full ? 10 : 8);
    ctx.fillStyle = "rgba(255,79,216,0.7)";
    ctx.fillText("-A", pivotX + (full ? 34 : 28), restY - mh + 3);
  }
}

// ─────────────────────────────────────────────────────────────
// 09 · WORK, ENERGY AND POWER
// ─────────────────────────────────────────────────────────────
function workEnergy(ctx, scene, W, H, t, full, S) {
  background(ctx, W, H);
  stars(ctx, W, H, t, 25);
  const groundY = H * 0.7;
  ground(ctx, W, H, groundY);
  const size = full ? 56 : 42;
  const x = W * 0.15 + (scene.pos || 0);
  const y = groundY - size;
  const grad = ctx.createLinearGradient(x, y, x + size, y + size);
  grad.addColorStop(0, "#b09cff");
  grad.addColorStop(1, "#6339e4");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.roundRect(x, y, size, size, 8);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.4)";
  ctx.stroke();
  st(ctx, full ? 12 : 9);
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.fillText(`${scene.mass} kg`, x + size / 2, y + size / 2 + 4);
  const Fsc = Math.min(W * 0.22, scene.force * 1.2);
  arrow(ctx, x + size + 4, y + size / 2, x + size + 4 + Fsc, y + size / 2, "rgba(255,80,80,0.85)", 3.5, 10);
  st(ctx, full ? 11 : 8);
  ctx.fillStyle = "rgba(255,120,100,0.9)";
  ctx.textAlign = "left";
  ctx.fillText(`F=${scene.force}N θ=${scene.angle}°`, x + size + 8 + Fsc, y + size / 2 - 12);
  // Energy bars (right side)
  const barsX = W * 0.78;
  const barsW = full ? 60 : 44;
  const barsBottom = groundY - 8;
  const barsTop = H * 0.06;
  const maxE = Math.max(scene.ke ?? 0, scene.pe ?? 0, 1);
  const bars = [
    { label: "KE", v: scene.ke ?? 0, color: "#ff4fd8" },
    { label: "PE", v: scene.pe ?? 0, color: "#00ffd5" },
    { label: "Total", v: scene.total ?? 0, color: "#fff06a" }
  ];
  bars.forEach((b, i) => {
    const bx = barsX + i * (barsW + 8);
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.lineWidth = 1;
    ctx.strokeRect(bx, barsTop, barsW, barsBottom - barsTop);
    const bh = ((barsBottom - barsTop) * b.v) / maxE;
    ctx.fillStyle = b.color + "aa";
    ctx.fillRect(bx, barsBottom - bh, barsW, bh);
    st(ctx, full ? 11 : 8);
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.textAlign = "center";
    ctx.fillText(`${b.label} ${b.v.toFixed(0)}`, bx + barsW / 2, barsBottom + (full ? 18 : 13));
  });
  st(ctx, full ? 13 : 10);
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.textAlign = "left";
  ctx.fillText(`W = ${scene.work.toFixed(1)} J   P = ${scene.power.toFixed(1)} W   t = ${scene.t.toFixed(1)} s`, W * 0.05, H * 0.09);
  equationFooter(ctx, W, H, "W = Fd cosθ   KE = ½mv²   PE = mgh   P = W/t", full);
}

// ─────────────────────────────────────────────────────────────
// 10 · CONSERVATION OF MECHANICAL ENERGY (ball on slide)
// ─────────────────────────────────────────────────────────────
function energyTrack(ctx, scene, W, H, t, full, S) {
  background(ctx, W, H);
  stars(ctx, W, H, t, 25);
  const base = H * 0.78;
  const left = W * 0.05;
  const right = W * 0.9;
  const peak = base - (scene.h0 / (scene.h0 + 1)) * H * 0.55;
  // Track polyline: start high left, down to base right
  const track = [];
  const steps = 60;
  for (let i = 0; i <= steps; i++) {
    const px = left + (right - left) * (i / steps);
    const py = base - (peak - base) * Math.pow(1 - i / steps, 1.65);
    track.push([px, py]);
  }
  ctx.strokeStyle = "rgba(87,211,255,0.7)";
  ctx.lineWidth = full ? 5 : 4;
  ctx.beginPath();
  track.forEach(([px, py], i) => (i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)));
  ctx.stroke();
  // Ball position along track based on progress
  const prog = scene.progress ?? 0; // 0..1
  const idx = Math.floor(prog * steps);
  const bx = track[idx][0];
  const by = track[idx][1] - (full ? 14 : 11);
  // Height fraction annotation
  const hfrac = scene.fracH ?? 1;
  ctx.fillStyle = (hfrac * 255).toFixed(0) > 200 ? "rgba(255,200,50,0.2)" : "rgba(0,255,213,0.2)";
  ctx.fillRect(0, 0, W, H);
  const grad = ctx.createRadialGradient(bx, by, 0, bx, by, full ? 26 : 20);
  grad.addColorStop(0, "#fff06a");
  grad.addColorStop(1, "#ff9d2e");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(bx, by, full ? 14 : 11, 0, Math.PI * 2);
  ctx.fill();
  st(ctx, full ? 12 : 9);
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillText(`h = ${scene.hm.toFixed(2)} m`, bx, by - (full ? 22 : 18));
  // Energy bars
  const barsX = W * 0.06;
  const barsW = full ? 120 : 90;
  const barsBottom = base - 10;
  const barsTop = H * 0.1;
  const maxE = Math.max(scene.pe ?? 0, 1);
  const rows = [
    { label: "PE = mgh", v: scene.pe ?? 0, color: "#00ffd5" },
    { label: "KE = ½mv²", v: scene.ke ?? 0, color: "#ff4fd8" },
    { label: "Total", v: scene.total ?? 0, color: "#fff06a" }
  ];
  rows.forEach((row, i) => {
    const bx0 = barsX;
    const by0 = barsTop + i * (full ? 44 : 34);
    st(ctx, full ? 11 : 8);
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.textAlign = "left";
    ctx.fillText(row.label, bx0, by0);
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.strokeRect(bx0, by0 + 3, barsW, full ? 14 : 10);
    const bw = (barsW * row.v) / maxE;
    ctx.fillStyle = row.color + "cc";
    ctx.fillRect(bx0, by0 + 3, bw, full ? 14 : 10);
  });
  st(ctx, full ? 13 : 10);
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.textAlign = "right";
  ctx.fillText(`E_total = ${scene.total.toFixed(1)} J ${scene.frictionOn ? "  (with friction → decreases)" : " (no friction → constant)"}`, W - W * 0.04, H * 0.08);
  equationFooter(ctx, W, H, "E = KE + PE = constant  (if frictionless)", full);
}

// ─────────────────────────────────────────────────────────────
// 11 · COLLISION / MOMENTUM
// ─────────────────────────────────────────────────────────────
function collision(ctx, scene, W, H, t, full, S) {
  background(ctx, W, H);
  stars(ctx, W, H, t, 25);
  const groundY = H * 0.78;
  ground(ctx, W, H, groundY);
  const uScale = W * 0.065;
  const trackStart = W * 0.08;
  const pos1 = scene.u1 != null ? trackStart + scene.u1 * uScale : W * 0.15;
  const pos2 = scene.u2 != null ? trackStart + scene.u2 * uScale : W * 0.7;
  const size1 = 20 + scene.m1 * 1.5;
  const size2 = 20 + scene.m2 * 1.5;
  const y1 = groundY - size1;
  const y2 = groundY - size2;
  [size1, size2].forEach((sz, idx) => {
    const x = idx === 0 ? pos1 : pos2;
    const yy = idx === 0 ? y1 : y2;
    const g = ctx.createLinearGradient(x, yy, x + sz, yy + sz);
    if (idx === 0) { g.addColorStop(0, "#7b9cff"); g.addColorStop(1, "#3a57c9"); }
    else { g.addColorStop(0, "#ff8fa3"); g.addColorStop(1, "#c23b5c"); }
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.roundRect(x, yy, sz, sz, 8);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.stroke();
    st(ctx, full ? 13 : 9);
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.fillText(`${idx === 0 ? scene.m1 : scene.m2} kg`, x + sz / 2, yy + sz / 2 + 4);
    const v = idx === 0 ? scene.v1 : scene.v2;
    const va = Math.abs(v);
    if (va > 0.01) {
      const vlen = Math.min(W * 0.25, va * 12);
      const dir = v > 0 ? 1 : -1;
      arrow(ctx, x + (dir > 0 ? sz : 0), yy + sz / 2, x + (dir > 0 ? sz : 0) + dir * vlen, yy + sz / 2, "rgba(0,255,213,0.9)", 3, 9);
    }
  });
  // impact flash
  if (scene.impact) {
    const mx = (pos1 + size1 + pos2) / 2;
    const my = groundY - size1 / 2;
    ctx.strokeStyle = `rgba(255,240,106,${0.6 * (1 - scene.impact)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(mx, my, 20 + scene.impact * 25, 0, Math.PI * 2);
    ctx.stroke();
  }
  st(ctx, full ? 13 : 10);
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.textAlign = "center";
  ctx.fillText(
    `p_before = ${scene.px.toFixed(1)} kg·m/s   p_after = ${scene.py.toFixed(1)} kg·m/s   ${scene.type}`,
    W / 2,
    H * 0.07
  );
  st(ctx, full ? 12 : 9);
  ctx.fillStyle = "rgba(87,211,255,0.85)";
  ctx.fillText(`v1': ${scene.v1p.toFixed(2)} m/s   v2': ${scene.v2p.toFixed(2)} m/s`, W / 2, H * 0.13);
  equationFooter(ctx, W, H, "m1v1 + m2v2 = m1v1' + m2v2'", full);
}

// ─────────────────────────────────────────────────────────────
// 12 · CENTRIPETAL FORCE
// ─────────────────────────────────────────────────────────────
function centripetal(ctx, scene, W, H, t, full, S) {
  background(ctx, W, H);
  stars(ctx, W, H, t, 30);
  const cx = W * 0.5;
  const cy = H * 0.48;
  const r = Math.min(W, H) * 0.28;
  ctx.strokeStyle = "rgba(0,255,213,0.35)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  // tick marks
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    ctx.strokeStyle = "rgba(0,255,213,0.18)";
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * (r - 6), cy + Math.sin(a) * (r - 6));
    ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    ctx.stroke();
  }
  const theta = scene.theta ?? 0;
  const px = cx + Math.cos(theta) * r;
  const py = cy + Math.sin(theta) * r;
  // center glow
  ctx.fillStyle = "rgba(255,240,106,0.4)";
  ctx.beginPath();
  ctx.arc(cx, cy, 4, 0, Math.PI * 2);
  ctx.fill();
  // ball
  const grad = ctx.createRadialGradient(px - 4, py - 4, 0, px, py, full ? 18 : 13);
  grad.addColorStop(0, "#ffe9a8");
  grad.addColorStop(1, "#ff9d2e");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(px, py, full ? 18 : 13, 0, Math.PI * 2);
  ctx.fill();
  // velocity tangent vector
  const vt = theta + Math.PI / 2;
  ctx.strokeStyle = "rgba(66,255,128,0.85)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.lineTo(px + Math.cos(vt) * r * 0.35, py + Math.sin(vt) * r * 0.35);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(px + Math.cos(vt) * r * 0.35, py + Math.sin(vt) * r * 0.35, 4, 0, Math.PI * 2);
  ctx.fill();
  st(ctx, full ? 11 : 8);
  ctx.fillStyle = "#42ff80";
  ctx.fillText("v", px + Math.cos(vt) * r * 0.42, py + Math.sin(vt) * r * 0.42);
  // centripetal (to center)
  arrow(ctx, px, py, cx, cy, "rgba(255,90,169,0.9)", 3, 9);
  st(ctx, full ? 11 : 8);
  ctx.fillStyle = "#ff5aa9";
  ctx.fillText("Fc", (px + cx) / 2, (py + cy) / 2 - 4);
  st(ctx, full ? 13 : 10);
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.textAlign = "center";
  ctx.fillText(`Fc = ${scene.fc.toFixed(1)} N   ω = ${scene.omega.toFixed(2)} rad/s   T = ${scene.period.toFixed(2)} s`, W / 2, H * 0.08);
  equationFooter(ctx, W, H, "Fc = mv²/r = mrω²", full);
}

// ─────────────────────────────────────────────────────────────
// 13 · WAVES ON A STRING
// ─────────────────────────────────────────────────────────────
function wave(ctx, scene, W, H, t, full, S) {
  background(ctx, W, H);
  stars(ctx, W, H, t, 25);
  const mid = H * 0.5;
  const left = W * 0.06;
  const right = W * 0.94;
  const lambda = Math.max(scene.lambda ?? 1, 0.2);
  const ampM = scene.amp ?? 0.6;
  const ampPx = Math.max(6, Math.min(H * 0.28, ampM * H * 0.22));
  const phase = scene.phase ?? 0;
  const worldSpan = lambda * 2; // show exactly 2 wavelengths on screen
  const wlPx = (right - left) / 2;
  const strands = 6;
  for (let s = 1; s < strands; s++) {
    ctx.beginPath();
    for (let i = 0; i <= 80; i++) {
      const wx = (i / 80) * worldSpan;
      const x = left + ((right - left) * i) / 80;
      const y = mid + ((s - strands / 2) * (H * 0.012)) + Math.sin(scene.k * wx - phase) * ampPx;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.strokeStyle = `rgba(0,255,213,${0.05 * strands})`;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.beginPath();
  for (let i = 0; i <= 120; i++) {
    const wx = (i / 120) * worldSpan;
    const x = left + ((right - left) * i) / 120;
    const y = mid + Math.sin(scene.k * wx - phase) * ampPx;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.strokeStyle = "#00ffd5";
  ctx.lineWidth = 3;
  ctx.shadowColor = "rgba(0,255,213,0.6)";
  ctx.shadowBlur = 12;
  ctx.stroke();
  ctx.shadowBlur = 0;
  // midline
  ctx.setLineDash([6, 6]);
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(left, mid);
  ctx.lineTo(right, mid);
  ctx.stroke();
  ctx.setLineDash([]);
  // amplitude marker
  ctx.strokeStyle = "rgba(255,79,216,0.6)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(right * 0.16, mid);
  ctx.lineTo(right * 0.16, mid - ampPx);
  ctx.stroke();
  arrow(ctx, right * 0.16, mid, right * 0.16, mid + ampPx, "rgba(255,79,216,0.7)", 1.5, 6);
  st(ctx, full ? 11 : 8);
  ctx.fillStyle = "rgba(255,79,216,0.8)";
  ctx.fillText(`A = ${ampM.toFixed(2)} m`, right * 0.16 + 8, mid - ampPx * 0.5);
  // wavelength marker (one wavelength = wlPx on screen)
  const wlStart = W * 0.3;
  const wlY = mid + H * 0.26;
  ctx.strokeStyle = "rgba(255,240,106,0.7)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(wlStart, wlY);
  ctx.lineTo(wlStart + wlPx, wlY);
  ctx.stroke();
  arrow(ctx, wlStart, wlY, wlStart + 10, wlY, "rgba(255,240,106,0.7)", 2, 6);
  arrow(ctx, wlStart + wlPx, wlY, wlStart + wlPx - 10, wlY, "rgba(255,240,106,0.7)", 2, 6);
  ctx.fillStyle = "rgba(255,240,106,0.85)";
  st(ctx, full ? 11 : 8);
  ctx.fillText(`λ = ${lambda.toFixed(2)} m`, wlStart + wlPx / 2, wlY - 6);
  st(ctx, full ? 13 : 10);
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.textAlign = "center";
  ctx.fillText(`f = ${scene.freq.toFixed(2)} Hz   v = ${scene.speed.toFixed(1)} m/s   v = f·λ`, W / 2, H * 0.07);
  equationFooter(ctx, W, H, "v = fλ", full);
}

// ─────────────────────────────────────────────────────────────
// 14 · SOUND WAVE (particles)
// ─────────────────────────────────────────────────────────────
function soundWave(ctx, scene, W, H, t, full, S) {
  background(ctx, W, H);
  stars(ctx, W, H, t, 25);
  const mid = H * 0.55;
  const left = W * 0.08;
  const right = W * 0.92;
  const n = 60;
  const lambda = Math.max(scene.lambda ?? 0.5, 0.05);
  const ampM = scene.amp ?? 0.7;
  const ampPx = Math.max(6, Math.min(H * 0.16, ampM * H * 0.12));
  const phase = scene.phase ?? 0;
  const worldSpan = lambda * 1.5; // 1.5 wavelengths on screen
  // displacement wave
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const wx = (i / n) * worldSpan;
    const x = left + ((right - left) * i) / n;
    const y = mid - Math.sin(scene.k * wx - phase) * ampPx;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.strokeStyle = "rgba(255,240,106,0.6)";
  ctx.lineWidth = 2;
  ctx.stroke();
  // particles oscillating about equilibrium line
  for (let i = 0; i < n; i++) {
    const wx = (i / n) * worldSpan;
    const x0 = left + ((right - left) * i) / n;
    const dx = Math.sin(scene.k * wx - phase) * ampPx;
    const x = x0 + dx;
    const y = mid + H * 0.16;
    ctx.fillStyle = `rgba(87,211,255,${(0.4 + 0.5 * Math.abs(Math.sin(scene.k * wx - phase))).toFixed(2)})`;
    ctx.beginPath();
    ctx.arc(x, y, full ? 4.5 : 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // equilibrium line
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(left, mid);
  ctx.lineTo(right, mid);
  ctx.stroke();
  // compression labels
  st(ctx, full ? 11 : 8);
  ctx.fillStyle = "rgba(255,240,106,0.9)";
  ctx.textAlign = "left";
  ctx.fillText("compression", left + 8, mid - ampPx - 12);
  ctx.fillStyle = "rgba(87,211,255,0.9)";
  ctx.fillText("rarefaction", left + W * 0.3, mid + ampPx + 12);
  st(ctx, full ? 13 : 10);
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.textAlign = "center";
  ctx.fillText(`f = ${scene.freq} Hz   λ = ${lambda.toFixed(2)} m   v = ${scene.speed} m/s  (${scene.medium})`, W / 2, H * 0.07);
  equationFooter(ctx, W, H, "v = fλ", full);
}

// ─────────────────────────────────────────────────────────────
// 17 · LENS EXPERIMENT
// ─────────────────────────────────────────────────────────────
function lens(ctx, scene, W, H, t, full, S) {
  background(ctx, W, H);
  stars(ctx, W, H, t, 22);
  const cx = W * 0.55;
  const cy = H * 0.5;
  const principalY = cy;
  const maxH = H * 0.3;
  // principal axis
  ctx.strokeStyle = "rgba(255,255,255,0.15)";
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.moveTo(W * 0.03, principalY);
  ctx.lineTo(W * 0.97, principalY);
  ctx.stroke();
  ctx.setLineDash([]);
  // lens
  ctx.lineWidth = full ? 4 : 3;
  if (scene.type === "convex") {
    ctx.beginPath();
    ctx.arc(cx - 16, cy, 34, -Math.PI / 2, Math.PI / 2);
    ctx.arc(cx + 16, cy, 34, Math.PI / 2, -Math.PI / 2);
    ctx.strokeStyle = "rgba(0,255,213,0.9)";
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(cx - 24, cy - 46);
    ctx.lineTo(cx + 24, cy);
    ctx.lineTo(cx - 24, cy + 46);
    ctx.moveTo(cx + 24, cy - 46);
    ctx.lineTo(cx - 24, cy);
    ctx.lineTo(cx + 24, cy + 46);
    ctx.strokeStyle = "rgba(255,200,100,0.9)";
    ctx.stroke();
  }
  // focal points
  ctx.fillStyle = "rgba(255,240,106,0.7)";
  [cx - scene.f * 60, cx + scene.f * 60].forEach((fx) => {
    ctx.beginPath();
    ctx.arc(fx, cy, 4, 0, Math.PI * 2);
    ctx.fill();
  });
  st(ctx, full ? 10 : 8);
  ctx.fillStyle = "rgba(255,240,106,0.8)";
  ctx.textAlign = "center";
  ctx.fillText("F", cx - scene.f * 60, cy + 14);
  ctx.fillText("F", cx + scene.f * 60, cy + 14);
  ctx.fillStyle = "rgba(0,255,213,0.85)";
  ctx.fillText("f = " + scene.f.toFixed(2), cx, cy - 58);
  // Object
  const ox = W * 0.12;
  const objH = maxH * 0.6;
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.fillRect(ox - 4, principalY - objH, 8, objH);
  st(ctx, full ? 11 : 8);
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.textAlign = "left";
  ctx.fillText("object", ox - 10, principalY - objH - 8);
  // Ray 1: parallel → through focal point after lens
  const vx = scene.v; // image distance in px
  const imgX = cx + vx * 60;
  const imgH = scene.imageHeightPx > 0 ? Math.min(0.75, scene.mag) * objH * 0.2 * 60 : (objH * Math.abs(scene.mag));
  const rayLines = [
    [ox, principalY - objH, ox + (cx - 16 - ox), principalY - objH, cx, principalY, imgX, principalY - imgH],
  ];
  // simpler: three ray segments drawn separately
  ctx.strokeStyle = "rgba(255,240,106,0.75)";
  ctx.lineWidth = 2;
  // Ray1: parallel to axis
  ctx.beginPath();
  ctx.moveTo(ox, principalY - objH);
  ctx.lineTo(cx - 16, principalY - objH);
  ctx.lineTo(cx + scene.f * 60 * 0.8 > cx + 40 ? cx + scene.f * 60 : cx + 40, principalY - objH);
  ctx.stroke();
  // Ray1b through focal going down a bit
  ctx.beginPath();
  ctx.moveTo(cx - 16, principalY - objH);
  ctx.lineTo(cx + scene.f * 60, principalY - objH + (principalY - objH) * 0.1);
  ctx.stroke();
  ctx.strokeStyle = "rgba(0,255,213,0.7)";
  // Ray2: through center
  ctx.beginPath();
  ctx.moveTo(ox, principalY - objH);
  ctx.lineTo(cx, principalY);
  ctx.lineTo(imgX, principalY - imgH);
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,90,169,0.7)";
  // Ray3: through focal point toward parallel after
  ctx.beginPath();
  ctx.moveTo(ox, principalY - objH);
  ctx.lineTo(cx - scene.f * 60, principalY);
  ctx.lineTo(cx + 20, principalY - objH);
  ctx.stroke();
  // Image
  const invertDir = scene.mag > 0 ? 1 : -1;
  ctx.fillStyle = "rgba(255,90,169,0.95)";
  ctx.fillRect(imgX - 4, principalY - imgH * invertDir, 8, Math.max(4, imgH * invertDir));
  st(ctx, full ? 11 : 8);
  ctx.fillStyle = "rgba(255,90,169,0.9)";
  ctx.textAlign = "left";
  ctx.fillText("image", imgX + 8, principalY - imgH * invertDir - 6);
  st(ctx, full ? 12 : 9);
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.textAlign = "right";
  ctx.fillText(`u = ${scene.u.toFixed(1)} cm   v = ${scene.v.toFixed(1)} cm   mag = ${scene.mag.toFixed(2)}`, W - W * 0.04, H * 0.08);
  equationFooter(ctx, W, H, "1/f = 1/u + 1/v   M = v/u", full);
}

// ─────────────────────────────────────────────────────────────
// 18 · ELECTROMAGNETIC INDUCTION
// ─────────────────────────────────────────────────────────────
function induction(ctx, scene, W, H, t, full, S) {
  background(ctx, W, H);
  stars(ctx, W, H, t, 25);
  const cy = H * 0.5;
  const magnetY = cy;
  // coil loops
  const coilX = W * 0.55;
  const mx = scene.rel != null ? coilX - W * 0.18 + scene.rel * W * 0.22 : scene.magnetX ?? W * 0.16;
  const loops = scene.turns ?? 1;
  ctx.strokeStyle = "rgba(210,150,240,0.85)";
  ctx.lineWidth = full ? 3 : 2;
  for (let i = 0; i < Math.min(8, loops); i++) {
    const rx = coilX + i * 3 - 10;
    ctx.beginPath();
    ctx.ellipse(rx, cy, 9, full ? 34 : 26, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  // magnet (bar with + -)
  const mw = full ? 46 : 34;
  const mh = full ? 22 : 16;
  const grad = ctx.createLinearGradient(mx - mw / 2, 0, mx + mw / 2, 0);
  grad.addColorStop(0, "#ff4f6d");
  grad.addColorStop(1, "#3d8dff");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.roundRect(mx - mw / 2, magnetY - mh / 2, mw, mh, 5);
  ctx.fill();
  st(ctx, full ? 12 : 9);
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.fillText("N", mx - mw / 4, magnetY + 3);
  ctx.fillText("S", mx + mw / 4, magnetY + 3);
  // flux lines between magnet and coil
  const fcx = (mx + mw / 2 + coilX) / 2;
  ctx.strokeStyle = `rgba(87,211,255,${0.55 * scene.fluxFrac})`;
  ctx.lineWidth = 2;
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(mx + mw / 2, magnetY + i * 8);
    ctx.bezierCurveTo(fcx, magnetY + i * 20, fcx, magnetY + i * 20, coilX - 10, magnetY + i * 8);
    ctx.stroke();
  }
  // galvanometer
  const gx = W * 0.85;
  ctx.beginPath();
  ctx.arc(gx, cy, full ? 24 : 18, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(20,30,50,0.95)";
  ctx.fill();
  ctx.strokeStyle = "#ff5aa9";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(gx, cy);
  const swing = scene.epsilon ?? 0;
  ctx.lineTo(gx + Math.sin(swing * 0.4) * (full ? 14 : 10), cy - Math.cos(swing * 0.4) * (full ? 14 : 10));
  ctx.strokeStyle = "#ff5aa9";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(gx - 5, cy);
  ctx.lineTo(gx + 5, cy);
  ctx.stroke();
  ctx.fillStyle = "rgba(0,255,213,0.8)";
  st(ctx, full ? 15 : 12);
  ctx.fillText("G", gx, cy + 4);
  st(ctx, full ? 12 : 9);
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.textAlign = "center";
  ctx.fillText(`Φ = ${scene.flux.toFixed(2)} Wb   ε = ${scene.epsilon.toFixed(2)} V   I = ${scene.current.toFixed(2)} A`, W / 2, H * 0.08);
  st(ctx, full ? 11 : 8);
  ctx.fillStyle = "rgba(255,200,100,0.85)";
  ctx.fillText(`turns N = ${loops}   magnet speed = ${scene.speedx.toFixed(1)} m/s`, W / 2, H * 0.14);
  if (Math.abs(scene.epsilon) > 0.1) {
    ctx.fillStyle = "rgba(255,240,106,0.85)";
    ctx.fillText("✨ induced current!", W / 2, H * 0.02);
  }
  equationFooter(ctx, W, H, "ε = -N·ΔΦ/Δt", full);
}

// ─────────────────────────────────────────────────────────────
// 19 · MAGNETIC FORCE (charge in B)
// ─────────────────────────────────────────────────────────────
function magneticForce(ctx, scene, W, H, t, full, S) {
  background(ctx, W, H);
  stars(ctx, W, H, t, 25);
  const cx = W * 0.5;
  const cy = H * 0.5;
  const r = scene.radiusPx || Math.min(W, H) * 0.22;
  const theta = scene.theta ?? 0;
  const px = cx + r * Math.cos(theta);
  const py = cy + r * Math.sin(theta);
  // magnetic field dots (into screen)
  for (let i = 0; i < 5; i++) {
    for (let j = 0; j < 4; j++) {
      const bx = W * 0.1 + i * W * 0.2;
      const by = H * 0.12 + j * H * 0.24;
      ctx.fillStyle = "rgba(255,255,255,0.28)";
      ctx.beginPath();
      ctx.arc(bx, by, 1.4, 0, Math.PI * 2);
      ctx.fill();
      const cxm = bx - 1.2;
      const cym = by - 1.2;
      ctx.strokeStyle = "rgba(255,255,255,0.2)";
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(cxm + 2.4, cym);
      ctx.lineTo(cxm, cym);
      ctx.lineTo(cxm, cym + 2.4);
      ctx.stroke();
    }
  }
  st(ctx, full ? 11 : 8);
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.textAlign = "left";
  ctx.fillText("B ⊗ (into screen)", W * 0.04, H * 0.06);
  // circular path
  ctx.setLineDash([6, 4]);
  ctx.strokeStyle = "rgba(255,90,169,0.3)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  // particle
  const vrad = theta - Math.PI / 2; // velocity tangent (clockwise)
  const velx = Math.cos(vrad);
  const vely = Math.sin(vrad);
  ctx.strokeStyle = "rgba(0,255,213,0.85)";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.lineTo(px - velx * 46, py - vely * 46);
  ctx.stroke();
  st(ctx, full ? 10 : 8);
  ctx.fillStyle = "#00ffd5";
  ctx.fillText("v", px - velx * 54, py - vely * 54);
  // force to center
  arrow(ctx, px, py, cx, cy, "rgba(255,90,169,0.9)", 3, 9);
  st(ctx, full ? 10 : 8);
  ctx.fillStyle = "#ff5aa9";
  ctx.fillText("F = qvB", (px + cx) / 2 - 4, (py + cy) / 2 + 4);
  const grad = ctx.createRadialGradient(px - 3, py - 3, 0, px, py, full ? 14 : 10);
  grad.addColorStop(0, "#ffffff");
  grad.addColorStop(1, "#ff4fd8");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(px, py, full ? 14 : 10, 0, Math.PI * 2);
  ctx.fill();
  st(ctx, full ? 12 : 9);
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.textAlign = "center";
  ctx.fillText(`F = ${scene.force.toFixed(2)} N   r = ${scene.radius.toFixed(2)} m   v = ${scene.v.toFixed(1)} m/s`, W / 2, H * 0.07);
  equationFooter(ctx, W, H, "F = qvB sinθ   r = mv/(qB)", full);
}

// ─────────────────────────────────────────────────────────────
// 20 · RC CIRCUIT
// ─────────────────────────────────────────────────────────────
function rcCircuit(ctx, scene, W, H, t, full, S) {
  background(ctx, W, H);
  stars(ctx, W, H, t, 25);
  const top = H * 0.25;
  const bottom = H * 0.68;
  const left = W * 0.14;
  const right = W * 0.86;
  const mid = (top + bottom) / 2;
  ctx.strokeStyle = "rgba(0,255,213,0.6)";
  ctx.lineWidth = 3;
  ctx.shadowColor = "rgba(0,255,213,0.4)";
  ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.moveTo(left, top);
  ctx.lineTo(right, top);
  ctx.lineTo(right, bottom);
  ctx.lineTo(left, bottom);
  ctx.lineTo(left, top);
  ctx.stroke();
  ctx.shadowBlur = 0;
  // battery
  ctx.fillStyle = "rgba(60,70,90,0.9)";
  ctx.fillRect(left - 14, mid - 30, 28, 60);
  ctx.strokeStyle = "rgba(255,255,255,0.4)";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(left - 14, mid - 30, 28, 60);
  ctx.fillStyle = "#ff4444";
  ctx.fillRect(left - 10, mid - 36, 7, 6);
  ctx.fillStyle = "#4444ff";
  ctx.fillRect(left + 3, mid - 36, 7, 6);
  st(ctx, full ? 13 : 10);
  ctx.fillStyle = "#ffc832";
  ctx.textAlign = "center";
  ctx.fillText(`${scene.v0}V`, left, mid + 4);
  // resistor zigzag on top
  const rxx = (left + right) / 2;
  ctx.strokeStyle = "rgba(255,160,90,0.9)";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(rxx - 20, top);
  for (let i = 0; i < 6; i++) {
    const yy = top + 8 + i * 8;
    ctx.lineTo(rxx + (i % 2 === 0 ? 8 : -8), yy);
  }
  ctx.lineTo(rxx + 20, top + 55);
  ctx.stroke();
  // capacitor plates on right side
  const cX = right;
  const fill = scene.vc / Math.max(scene.v0, 0.001);
  const cH = H * 0.3;
  ctx.fillStyle = "rgba(87,211,255,0.25)";
  ctx.fillRect(cX - 12, bottom - cH * fill, 24, cH * fill);
  st(ctx, full ? 11 : 8);
  ctx.fillStyle = "rgba(87,211,255,0.9)";
  ctx.textAlign = "center";
  ctx.fillText("C", cX, mid);
  // current arrow
  const cur = scene.i;
  if (cur > 0.01) {
    arrow(ctx, cX, top + 12, cX, top + 44, "rgba(0,255,213,0.85)", 3, 8);
  }
  st(ctx, full ? 13 : 10);
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.textAlign = "center";
  ctx.fillText(`Vc = ${scene.vc.toFixed(2)} V   I = ${scene.i.toFixed(3)} A   τ = RC = ${scene.tau.toFixed(1)} s`, W / 2, H * 0.08);
  st(ctx, full ? 11 : 8);
  ctx.fillStyle = "rgba(255,240,106,0.85)";
  ctx.fillText(`q = ${scene.q.toFixed(4)} C   ${scene.mode === "charge" ? "CHARGING" : "DISCHARGING"}`, W / 2, H * 0.15);
  equationFooter(ctx, W, H, "charge: V = V₀(1-e^(-t/RC))   discharge: V = V₀ e^(-t/RC)", full);
}

// ─────────────────────────────────────────────────────────────
// 21 · HEAT TRANSFER
// ─────────────────────────────────────────────────────────────
function heat(ctx, scene, W, H, t, full, S) {
  background(ctx, W, H);
  stars(ctx, W, H, t, 20);
  const boxW = full ? 100 : 74;
  const boxH = full ? 120 : 92;
  const y0 = H * 0.26;
  const x1 = W * 0.22;
  const x2 = W * 0.62;
  const bar = (x, y, h, color, temp) => {
    ctx.fillStyle = color + "66";
    ctx.beginPath();
    ctx.roundRect(x, y, boxW, boxH, 12);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    const f = Math.max(0.05, h);
    ctx.fillStyle = color + "cc";
    ctx.beginPath();
    ctx.roundRect(x + boxW * 0.22, y + boxH - boxH * f, boxW * 0.56, boxH * f, 6);
    ctx.fill();
    st(ctx, full ? 15 : 11);
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.fillText(`${temp.toFixed(0)}°C`, x + boxW / 2, y + boxH + (full ? 26 : 20));
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.fillText("temperature", x + boxW / 2, y - 8);
  };
  const h1 = Math.max(0.04, scene.t1 / 100);
  const h2 = Math.max(0.04, scene.t2 / 100);
  bar(x1, y0, h1, "#ff5a5a", scene.t1);
  bar(x2, y0, h2, "#57d3ff", scene.t2);
  // heat flow arrows
  const midY = y0 + boxH / 2;
  const nArr = 4;
  for (let i = 0; i < nArr; i++) {
    const yy = y0 + 20 + i * (boxH / (nArr + 1));
    const frac = 0.5 + 0.5 * Math.sin(t * 0.05 + i);
    const fx = x1 + boxW + 12 + frac * (x2 - x1 - boxW * 2 - 24);
    arrow(ctx, fx - 12, yy, fx + 6, yy, "rgba(255,240,106,0.75)", 2.5, 7);
  }
  st(ctx, full ? 12 : 9);
  ctx.fillStyle = "rgba(255,240,106,0.9)";
  ctx.textAlign = "center";
  ctx.fillText(`Q = ${scene.q.toFixed(1)} kJ transferred   m = ${scene.mass} kg`, W / 2, H * 0.08);
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.fillText(`material: ${scene.material}  c = ${scene.c.toFixed(1)} J/kg·K`, W / 2, H * 0.15);
  equationFooter(ctx, W, H, "Q = mcΔT", full);
  // thermometer side rail
  const tx = W * 0.88;
  const ty0 = y0;
  const ty1 = y0 + boxH;
  ctx.strokeStyle = "rgba(255,255,255,0.3)";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(tx, ty0);
  ctx.lineTo(tx, ty1);
  ctx.stroke();
  const tf = (scene.t2 / 100) * (ty1 - ty0);
  ctx.strokeStyle = "#ff3b3b";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(tx, ty1);
  ctx.lineTo(tx, ty1 - tf);
  ctx.stroke();
  st(ctx, full ? 10 : 8);
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.fillText("T", tx, ty0 - 6);
}

// ─────────────────────────────────────────────────────────────
// 22 · IDEAL GAS
// ─────────────────────────────────────────────────────────────
function gas(ctx, scene, W, H, t, full, S) {
  background(ctx, W, H);
  stars(ctx, W, H, t, 20);
  const boxL = W * 0.12;
  const boxR = W * 0.68;
  const boxT = H * 0.12;
  const boxB = H * 0.78;
  ctx.fillStyle = scene.pressure > 3 ? "rgba(120,60,180,0.14)" : "rgba(87,211,255,0.1)";
  ctx.beginPath();
  ctx.roundRect(boxL, boxT, boxR - boxL, boxB - boxT, 12);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.4)";
  ctx.lineWidth = 2;
  ctx.stroke();
  const st0 = getStore(ctx.canvas);
  const key = `gas-${scene.n}-${scene.temp}`;
  if (st0.gasKey !== key) {
    st0.gas = [];
    st0.gasKey = key;
    for (let i = 0; i < Math.min(120, scene.n); i++) {
      st0.gas.push({ x: boxL + Math.random() * (boxR - boxL), y: boxT + Math.random() * (boxB - boxT), a: Math.random() * 6.28, sp: (0.8 + Math.random() * 1.5) * (scene.temp / 300) });
    }
  }
  const particles = st0.gas || [];
  const speedF = 0.8 + (scene.temp / 300);
  particles.forEach((p) => {
    p.a += p.sp * 0.01 * (speedF / 1.2);
    p.x += Math.cos(p.a) * p.sp * 1.2;
    p.y += Math.sin(p.a) * p.sp * 1.2;
    if (p.x < boxL + 3) { p.x = boxL + 3; p.a = Math.PI - p.a; }
    if (p.x > boxR - 3) { p.x = boxR - 3; p.a = Math.PI - p.a; }
    if (p.y < boxT + 3) { p.y = boxT + 3; p.a = -p.a; }
    if (p.y > boxB - 3) { p.y = boxB - 3; p.a = -p.a; }
    ctx.fillStyle = `rgba(255,${Math.min(255, 150 + scene.temp * 0.4)},${Math.max(0, 255 - scene.temp * 0.9)},0.85)`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, full ? 3 : 2.4, 0, Math.PI * 2);
    ctx.fill();
  });
  // piston top
  ctx.fillStyle = "rgba(120,130,160,0.95)";
  ctx.fillRect(boxL - 6, boxT - 8, boxR - boxL + 12, 8);
  // gauge
  const gx = W * 0.82;
  const gy = H * 0.4;
  ctx.beginPath();
  ctx.arc(gx, gy, full ? 34 : 26, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(15,25,40,0.9)";
  ctx.fill();
  ctx.strokeStyle = "rgba(0,255,213,0.5)";
  ctx.lineWidth = 2;
  ctx.stroke();
  for (let i = 0; i <= 10; i++) {
    const a = Math.PI * 1.2 + (i / 10) * Math.PI * 1.6;
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(gx + Math.cos(a) * (full ? 22 : 16), gy + Math.sin(a) * (full ? 22 : 16));
    ctx.lineTo(gx + Math.cos(a) * (full ? 26 : 20), gy + Math.sin(a) * (full ? 26 : 20));
    ctx.stroke();
  }
  const needle = Math.PI * 1.2 + Math.min(1, scene.pressure / 6) * Math.PI * 1.6;
  ctx.strokeStyle = "#ff5aa9";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(gx, gy);
  ctx.lineTo(gx + Math.cos(needle) * (full ? 24 : 18), gy + Math.sin(needle) * (full ? 24 : 18));
  ctx.stroke();
  st(ctx, full ? 11 : 8);
  ctx.fillStyle = "#ff5aa9";
  ctx.textAlign = "center";
  ctx.fillText("P = " + scene.pressure.toFixed(2), gx, gy + (full ? 46 : 36));
  st(ctx, full ? 13 : 10);
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.textAlign = "center";
  ctx.fillText(`V = ${scene.volume.toFixed(2)} m³   T = ${scene.temp} K   n = ${scene.n} mol`, W / 2, H * 0.88);
  equationFooter(ctx, W, H, "PV = nRT", full);
}

// ─────────────────────────────────────────────────────────────
// 25 · GRAVITATIONAL ORBIT
// ─────────────────────────────────────────────────────────────
function orbit(ctx, scene, W, H, t, full, S) {
  background(ctx, W, H);
  stars(ctx, W, H, t, 60);
  const R_KM = 6371;
  const pts = scene.points && scene.points.length ? scene.points : null;
  const satR = Math.max(scene.r ?? R_KM + 400, R_KM + 100);
  const s = Math.min(W, H) * 0.42 / satR; // px per km → orbit roughly 0.42·min(W,H)
  const cx = W / 2 - R_KM * s; // planet centre in display coords
  const cy = H / 2;
  // planet
  const pr = Math.min(R_KM * s, full ? 30 : 24);
  const grad = ctx.createRadialGradient(cx - pr * 0.35, cy - pr * 0.35, 0, cx, cy, pr);
  grad.addColorStop(0, "#9ce6ff");
  grad.addColorStop(0.6, "#3d8dff");
  grad.addColorStop(1, "#1c4fb3");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, pr, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx - pr * 0.25, cy - pr * 0.25, pr * 0.45, 0.4, Math.PI * 1.1);
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = Math.max(2, pr * 0.12);
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.beginPath();
  ctx.arc(cx + pr * 0.35, cy - pr * 0.15, Math.max(1.5, pr * 0.1), 0, Math.PI * 2);
  ctx.fill();
  // trajectory trace
  if (pts) {
    ctx.strokeStyle = scene.mode === "impact" ? "rgba(255,120,90,0.8)" : "rgba(0,255,213,0.75)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    pts.forEach((p, i) => {
      const px = cx + p.x * s;
      const py = cy - p.y * s;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    });
    ctx.stroke();
  }
  // satellite at last trace point
  const lastP = pts ? pts[pts.length - 1] : null;
  const sx = cx + (lastP ? lastP.x * s : satR * s);
  const sy = cy - (lastP ? lastP.y * s : 0);
  // velocity tangent from last segment
  let vx = -Math.sin(0), vy = Math.cos(0);
  if (pts && pts.length > 1) {
    const a = pts[pts.length - 2];
    const b = pts[pts.length - 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    vx = dx / len; vy = -dy / len;
  }
  ctx.strokeStyle = "rgba(66,255,128,0.8)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(sx + vx * 34, sy + vy * 34);
  ctx.stroke();
  arrow(ctx, sx, sy, sx + vx * 46, sy + vy * 46, "rgba(66,255,128,0.9)", 2, 7);
  st(ctx, full ? 9 : 7);
  ctx.fillStyle = "#42ff80";
  ctx.fillText("v", sx + vx * 54, sy + vy * 54 + 4);
  // force to center
  arrow(ctx, sx, sy, cx, cy, "rgba(255,90,169,0.85)", 2, 8);
  // satellite marker
  const sgrad = ctx.createRadialGradient(sx - 2, sy - 2, 0, sx, sy, full ? 8 : 6);
  sgrad.addColorStop(0, "#fff");
  sgrad.addColorStop(1, "#c0c8e0");
  ctx.fillStyle = sgrad;
  ctx.beginPath();
  ctx.arc(sx, sy, full ? 8 : 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(sx - 3, sy - 12);
  ctx.lineTo(sx + 3, sy - 12);
  ctx.lineTo(sx + 1, sy - 3);
  ctx.lineTo(sx - 1, sy - 3);
  ctx.closePath();
  ctx.fillStyle = "rgba(200,210,235,0.8)";
  ctx.fill();
  st(ctx, full ? 10 : 8);
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.textAlign = "center";
  ctx.fillText(`F = ${scene.F ? scene.F.toFixed(1) : "--"} N    r = ${scene.r ? scene.r.toFixed(0) : "--"} km    T = ${scene.T ? scene.T.toFixed(1) : "--"} s  (${scene.mode})`, W / 2, H * 0.08);
  equationFooter(ctx, W, H, "F = Gm1m2/r²", full);
}

// ─────────────────────────────────────────────────────────────
// 26 · PLANETARY GRAVITY COMPARISON
// ─────────────────────────────────────────────────────────────
function planetFall(ctx, scene, W, H, t, full, S) {
  background(ctx, W, H);
  stars(ctx, W, H, t, 50);
  // planet sphere bottom-left
  const px = W * 0.24;
  const py = H * 1.02;
  const pr = H * 1.05;
  const grad = ctx.createRadialGradient(px - pr * 0.2, py - pr * 0.3, 0, px, py, pr);
  grad.addColorStop(0, scene.colorHi || "#8ed1ff");
  grad.addColorStop(1, scene.colorLo || "#1a4d8f");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(px, py, pr, 0, Math.PI * 2);
  ctx.fill();
  const groundY = H * 0.8;
  const scale = (H * 0.6) / Math.max(scene.h0, 1);
  const ballY = groundY - (scene.h ?? scene.h0) * scale;
  const grad2 = ctx.createRadialGradient(W * 0.55 - 3, ballY - 3, 0, W * 0.55, ballY, full ? 16 : 12);
  grad2.addColorStop(0, "#ffe9a8");
  grad2.addColorStop(1, "#e07020");
  ctx.fillStyle = grad2;
  ctx.beginPath();
  ctx.arc(W * 0.55, ballY, full ? 16 : 12, 0, Math.PI * 2);
  ctx.fill();
  arrow(ctx, W * 0.55, ballY, W * 0.55, ballY + Math.min(H * 0.4, scene.v * 3), "rgba(255,110,100,0.9)", 3, 9);
  st(ctx, full ? 12 : 9);
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.textAlign = "left";
  ctx.fillText(`g = ${scene.g.toFixed(2)} m/s²`, W * 0.55 + 12, ballY - 8);
  ctx.fillStyle = "rgba(87,211,255,0.9)";
  ctx.fillText(`v = ${scene.v.toFixed(1)} m/s`, W * 0.55 + 12, ballY + 10);
  st(ctx, full ? 16 : 12);
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.textAlign = "center";
  ctx.fillText(scene.planet, W / 2, H * 0.07);
  ctx.fillStyle = "rgba(255,240,106,0.85)";
  ctx.fillText(`Weight = ${scene.weight.toFixed(1)} N`, W / 2, H * 0.14);
  equationFooter(ctx, W, H, "W = mg    v² = 2gs", full);
}

// ─────────────────────────────────────────────────────────────
// 27 · ESCAPE VELOCITY
// ─────────────────────────────────────────────────────────────
function escape(ctx, scene, W, H, t, full, S) {
  background(ctx, W, H);
  stars(ctx, W, H, t, 55);
  const px = W * 0.3;
  const py = H * 1.0;
  const pr = H * 0.95;
  const grad = ctx.createRadialGradient(px - pr * 0.2, py - pr * 0.3, 0, px, py, pr);
  grad.addColorStop(0, "#ffe08a");
  grad.addColorStop(0.4, "#f4a03c");
  grad.addColorStop(1, "#a04a10");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(px, py, pr, 0, Math.PI * 2);
  ctx.fill();
  const groundY = H * 0.82;
  // rocket
  const rx = W * 0.55;
  const ry = groundY - scene.progress * H * 0.65;
  ctx.strokeStyle = "rgba(210,214,235,0.9)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(rx, ry - 22);
  ctx.lineTo(rx + 8, ry - 8);
  ctx.lineTo(rx + 5, ry + 8);
  ctx.lineTo(rx - 5, ry + 8);
  ctx.lineTo(rx - 8, ry - 8);
  ctx.closePath();
  ctx.fillStyle = "rgba(180,190,215,0.9)";
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#ff5a5a";
  ctx.beginPath();
  ctx.arc(rx, ry + 8, 3.5, 0, Math.PI * 2);
  ctx.fill();
  // flame
  ctx.fillStyle = "rgba(255,150,60,0.8)";
  ctx.beginPath();
  ctx.moveTo(rx - 4, ry + 9);
  ctx.lineTo(rx + 4, ry + 9);
  ctx.lineTo(rx + 1, ry + 15 + Math.sin(t * 0.2) * 4);
  ctx.lineTo(rx, ry + 18 + Math.sin(t * 0.15) * 5);
  ctx.lineTo(rx - 1, ry + 15 + Math.sin(t * 0.25) * 4);
  ctx.closePath();
  ctx.fill();
  st(ctx, full ? 12 : 9);
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.textAlign = "center";
  ctx.fillText(`v_launch = ${scene.v.toFixed(1)} km/s   v_escape = ${scene.ve.toFixed(1)} km/s`, W / 2, H * 0.08);
  ctx.fillStyle = `rgba(${scene.outcome === "escape" ? "66,255,128" : scene.outcome === "orbit" ? "255,240,106" : "255,90,90"},0.9)`;
  st(ctx, full ? 15 : 11);
  ctx.fillText(`${scene.outcome.toUpperCase()}`, W / 2, H * 0.16);
  equationFooter(ctx, W, H, "vₑ = √(2GM/R)", full);
}

// ─────────────────────────────────────────────────────────────
// 28 · PROJECTILE WITH AIR RESISTANCE
// ─────────────────────────────────────────────────────────────
function projectileAir(ctx, scene, W, H, t, full, S) {
  background(ctx, W, H);
  stars(ctx, W, H, t, 40);
  const groundY = H * 0.8;
  ground(ctx, W, H, groundY);
  const launchX = W * 0.1;
  const scale = Math.max((scene.rangeIdeal || 0), (scene.rangeDrag || 0), 1) > 0 ? (W * 0.78) / Math.max(scene.rangeIdeal, scene.rangeDrag, 1) : 1;
  const heightScale = (H * 0.6) / Math.max(scene.hIdeal, scene.hDrag, 1);
  // ideal (dashed)
  ctx.strokeStyle = "rgba(87,211,255,0.4)";
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  (scene.ideal || []).forEach(([d, h], i) => {
    const x = launchX + d * scale;
    const y = groundY - h * heightScale;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.stroke();
  ctx.setLineDash([]);
  // drag (solid)
  ctx.strokeStyle = "rgba(255,90,169,0.9)";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  (scene.drag || []).forEach(([d, h], i) => {
    const x = launchX + d * scale;
    const y = groundY - h * heightScale;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.stroke();
  // labels
  st(ctx, full ? 11 : 8);
  ctx.fillStyle = "#57d3ff";
  ctx.textAlign = "left";
  ctx.fillText("ideal (no drag)", W * 0.6, H * 0.18);
  ctx.fillStyle = "#ff5aa9";
  ctx.fillText(`with drag  b=${scene.b.toFixed(2)}`, W * 0.6, H * 0.26);
  // projectile along drag trajectory
  const dp = scene.dragProj;
  if (dp) {
    const x = launchX + dp[0] * scale;
    const y = groundY - dp[1] * heightScale;
    const gl = ctx.createRadialGradient(x, y, 0, x, y, 18);
    gl.addColorStop(0, "rgba(255,90,169,0.5)");
    gl.addColorStop(1, "transparent");
    ctx.fillStyle = gl;
    ctx.beginPath();
    ctx.arc(x, y, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ff4fd8";
    ctx.beginPath();
    ctx.arc(x, y, full ? 7 : 5, 0, Math.PI * 2);
    ctx.fill();
  }
  st(ctx, full ? 13 : 10);
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.textAlign = "center";
  ctx.fillText(`R_ideal = ${scene.rangeIdeal.toFixed(1)} m   R_drag = ${scene.rangeDrag.toFixed(1)} m   ΔR = ${scene.dR.toFixed(1)} m`, W / 2, H * 0.07);
  equationFooter(ctx, W, H, "drag: F_D = ½ρ·C·A·v²", full);
}

// ─────────────────────────────────────────────────────────────
// 29 · VISCOUS FLOW / FLUID MOTION
// ─────────────────────────────────────────────────────────────
function fluid(ctx, scene, W, H, t, full, S) {
  background(ctx, W, H);
  stars(ctx, W, H, t, 20);
  const tubeW = W * 0.3;
  const tubeX = W * 0.5;
  const top = H * 0.1;
  const bottom = H * 0.85;
  // fluid fill
  const fc = scene.color || "#2a86e0";
  const grad = ctx.createLinearGradient(tubeX, 0, tubeX + tubeW, 0);
  grad.addColorStop(0, fc + "55");
  grad.addColorStop(1, fc + "99");
  ctx.fillStyle = grad;
  ctx.fillRect(tubeX, top, tubeW, bottom - top);
  ctx.strokeStyle = "rgba(255,255,255,0.4)";
  ctx.lineWidth = 2;
  ctx.strokeRect(tubeX, top, tubeW, bottom - top);
  // bubbles
  const st0 = getStore(ctx.canvas);
  const key = `fluid-${scene.eta}`;
  if (st0.fluidKey !== key) {
    st0.fluidBubbles = [];
    st0.fluidKey = key;
    for (let i = 0; i < 14; i++) {
      st0.fluidBubbles.push({ x: tubeX + Math.random() * tubeW, y: top + Math.random() * (bottom - top), vy: 0.2 + Math.random() * 0.5, a: 0 });
    }
  }
  (st0.fluidBubbles || []).forEach((b) => {
    b.y = top + ((b.y - top - b.vy) % (bottom - top) + (bottom - top)) % (bottom - top);
    b.a += 0.05;
    ctx.fillStyle = "rgba(255,255,255,0.14)";
    ctx.beginPath();
    ctx.arc(b.x + Math.sin(b.a) * 2, b.y, full ? 4 : 3, 0, Math.PI * 2);
    ctx.fill();
  });
  // falling ball
  const ballY = top + ((scene.t * scene.fallSpeed + top) % (bottom - top - 40));
  const ballX = tubeX + tubeW / 2;
  ctx.fillStyle = "#ff9d2e";
  ctx.beginPath();
  ctx.arc(ballX, ballY, full ? 12 : 9, 0, Math.PI * 2);
  ctx.fill();
  arrow(ctx, ballX, ballY + (full ? 14 : 11), ballX, ballY + (full ? 34 : 26), "rgba(255,90,90,0.9)", 2.5, 8);
  arrow(ctx, ballX, ballY - (full ? 14 : 11), ballX, ballY - (full ? 34 : 26), "rgba(87,211,255,0.9)", 2.5, 8);
  st(ctx, full ? 13 : 10);
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.textAlign = "center";
  ctx.fillText(`F_drag = ${scene.Fd.toFixed(2)} N   η = ${scene.eta.toFixed(2)} Pa·s   fluid: ${scene.name}`, W / 2, H * 0.07);
  equationFooter(ctx, W, H, "F_d = 6πηrv (Stokes)", full);
}

// ─────────────────────────────────────────────────────────────
// 30 · ARCHIMEDES' PRINCIPLE
// ─────────────────────────────────────────────────────────────
function buoyancy(ctx, scene, W, H, t, full, S) {
  background(ctx, W, H);
  stars(ctx, W, H, t, 20);
  const tankX = W * 0.16;
  const tankW = W * 0.34;
  const waterLine = H * 0.72;
  const tankTop = H * 0.3;
  const tankBottom = H * 0.82;
  // tank
  ctx.strokeStyle = "rgba(255,255,255,0.4)";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(tankX, tankTop);
  ctx.lineTo(tankX, tankBottom);
  ctx.lineTo(tankX + tankW, tankBottom);
  ctx.lineTo(tankX + tankW, tankTop);
  ctx.stroke();
  // water
  const wg = ctx.createLinearGradient(0, waterLine, 0, tankBottom);
  wg.addColorStop(0, "rgba(87,175,255,0.28)");
  wg.addColorStop(1, "rgba(40,90,180,0.55)");
  ctx.fillStyle = wg;
  ctx.fillRect(tankX + 2, waterLine, tankW - 4, tankBottom - waterLine);
  const surfaceY = H * 0.18;
  // displacement arrow
  ctx.strokeStyle = "rgba(255,240,106,0.6)";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 4]);
  const disp = scene.displacedH ?? 0;
  ctx.beginPath();
  ctx.moveTo(tankX - 14, waterLine - disp);
  ctx.lineTo(tankX - 14, waterLine);
  ctx.stroke();
  ctx.setLineDash([]);
  arrow(ctx, tankX - 14, waterLine, tankX - 14, waterLine - 8, "rgba(255,240,106,0.8)", 2, 6);
  st(ctx, full ? 10 : 8);
  ctx.fillStyle = "rgba(255,240,106,0.85)";
  ctx.textAlign = "right";
  ctx.fillText("displaced vol", tankX - 20, (waterLine + waterLine - disp) / 2);
  // object: a sphere at some depth
  const ballR = full ? 17 : 13;
  const objY = scene.submergedF > 0.4 ? H * 0.5 : waterLine - ballR * 1.1;
  const moving = scene.outcome;
  const objY2 = moving === "sink" ? H * 0.72 : moving === "rise" ? H * 0.42 : H * 0.55;
  const grad = ctx.createRadialGradient(W * 0.33 - 3, objY2 - 3, 0, W * 0.33, objY2, ballR);
  grad.addColorStop(0, "#ffffff");
  grad.addColorStop(1, scene.objDensity > scene.fluidDensity ? "#ff6b6b" : "#42d4b4");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(W * 0.33, objY2, ballR, 0, Math.PI * 2);
  ctx.fill();
  // forces on object
  if (moving === "float") {
    arrow(ctx, W * 0.33, objY2 - ballR - 4, W * 0.33, objY2 - ballR - 4 - 28, "rgba(87,211,255,0.9)", 4, 9);
    arrow(ctx, W * 0.33, objY2 + ballR + 4, W * 0.33, objY2 + ballR + 4 + 28, "rgba(255,90,90,0.9)", 4, 9);
  } else {
    arrow(ctx, W * 0.33, objY2 - ballR - 4, W * 0.33, objY2 - ballR - 4 - 40, "rgba(87,211,255,0.9)", 4, 9);
    arrow(ctx, W * 0.33, objY2 + ballR + 4, W * 0.33, objY2 + ballR + 4 + 40, "rgba(255,90,90,0.9)", 4, 9);
  }
  st(ctx, full ? 11 : 8);
  ctx.fillStyle = "#57d3ff";
  ctx.textAlign = "left";
  ctx.fillText("Buoyancy", W * 0.33 + ballR + 6, objY2 - ballR - 4);
  ctx.fillStyle = "#ff7777";
  ctx.fillText(`Weight=${scene.weight.toFixed(1)}N`, W * 0.33 - ballR - 6, objY2 + ballR + 34);
  // readouts right
  st(ctx, full ? 13 : 10);
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.textAlign = "left";
  ctx.fillText(`ρ_obj = ${scene.objDensity.toFixed(0)} kg/m³`, W * 0.62, H * 0.18);
  ctx.fillStyle = "rgba(87,211,255,0.9)";
  ctx.fillText(`F_b = ${scene.Fb.toFixed(1)} N`, W * 0.62, H * 0.3);
  ctx.fillStyle = "rgba(255,90,90,0.9)";
  ctx.fillText(`W = ${scene.weight.toFixed(1)} N`, W * 0.62, H * 0.42);
  ctx.fillStyle = "rgba(255,240,106,0.95)";
  ctx.fillText(`${(scene.submergedF * 100).toFixed(0)}% submerged`, W * 0.62, H * 0.54);
  ctx.fillStyle = `rgba(${moving === "float" ? "66,255,128" : moving === "sink" ? "255,90,90" : "255,240,106"},0.95)`;
  ctx.fillText(`${scene.outcome.toUpperCase()}`, W * 0.62, H * 0.66);
  equationFooter(ctx, W, H, "Fb = ρVg", full);
}

// ─────────────────────────────────────────────────────────────
// 31 · PRESSURE IN LIQUIDS
// ─────────────────────────────────────────────────────────────
function pressure(ctx, scene, W, H, t, full, S) {
  background(ctx, W, H);
  stars(ctx, W, H, t, 20);
  const tankX = W * 0.2;
  const tankW = W * 0.3;
  const tankTop = H * 0.12;
  const tankBottom = H * 0.78;
  // tank with gradient
  const wg = ctx.createLinearGradient(0, tankTop, 0, tankBottom);
  wg.addColorStop(0, "rgba(87,175,255,0.2)");
  wg.addColorStop(1, "rgba(30,70,150,0.7)");
  ctx.fillStyle = wg;
  ctx.fillRect(tankX, tankTop, tankW, tankBottom - tankTop);
  ctx.strokeStyle = "rgba(255,255,255,0.4)";
  ctx.lineWidth = 2;
  ctx.strokeRect(tankX, tankTop, tankW, tankBottom - tankTop);
  // depth lines left
  const depth = scene.depth || 0;
  const maxD = scene.maxDepth || 10;
  const probeY = tankBottom - (depth / maxD) * (tankBottom - tankTop);
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = "rgba(255,240,106,0.5)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(tankX - 16, probeY);
  ctx.lineTo(tankX + tankW + 16, probeY);
  ctx.stroke();
  ctx.setLineDash([]);
  // probe dot
  ctx.fillStyle = "#fff06a";
  ctx.beginPath();
  ctx.arc(tankX + 12, probeY, 5, 0, Math.PI * 2);
  ctx.fill();
  st(ctx, full ? 11 : 8);
  ctx.fillStyle = "#fff06a";
  ctx.textAlign = "left";
  ctx.fillText(`depth = ${depth.toFixed(1)} m`, tankX + tankW + 20, probeY);
  // gauge
  const gx = W * 0.78;
  const gy = H * 0.5;
  ctx.beginPath();
  ctx.arc(gx, gy, full ? 40 : 30, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(15,25,40,0.9)";
  ctx.fill();
  ctx.strokeStyle = "rgba(0,255,213,0.5)";
  ctx.lineWidth = 2;
  ctx.stroke();
  for (let i = 0; i <= 12; i++) {
    const a = Math.PI * 1.1 + (i / 12) * Math.PI * 1.8;
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(gx + Math.cos(a) * (full ? 28 : 20), gy + Math.sin(a) * (full ? 28 : 20));
    ctx.lineTo(gx + Math.cos(a) * (full ? 34 : 25), gy + Math.sin(a) * (full ? 34 : 25));
    ctx.stroke();
  }
  const pMax = scene.rho * scene.g * maxD;
  const nmax = Math.PI * 1.1 + Math.min(1, scene.p / Math.max(pMax, 1)) * Math.PI * 1.8;
  ctx.strokeStyle = "#ff5aa9";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(gx, gy);
  ctx.lineTo(gx + Math.cos(nmax) * (full ? 32 : 24), gy + Math.sin(nmax) * (full ? 32 : 24));
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  st(ctx, full ? 12 : 9);
  ctx.textAlign = "center";
  ctx.fillText(`P = ${scene.p.toFixed(2)} kPa`, gx, gy + (full ? 56 : 44));
  st(ctx, full ? 11 : 8);
  ctx.fillStyle = "rgba(87,211,255,0.9)";
  ctx.fillText(`liquid: ${scene.name}  ρ = ${scene.rho.toFixed(0)} kg/m³`, W / 2, H * 0.08);
  equationFooter(ctx, W, H, "P = ρgh", full);
}

// ─────────────────────────────────────────────────────────────
// 32 · BERNOULLI
// ─────────────────────────────────────────────────────────────
function bernoulli(ctx, scene, W, H, t, full, S) {
  background(ctx, W, H);
  stars(ctx, W, H, t, 20);
  const y0 = H * 0.3;
  const tubeStart = W * 0.08;
  const tubeEnd = W * 0.92;
  // pipe shape: wider left, narrower middle, wider right
  const shape = (x) => {
    if (x < W * 0.28) return 44;
    if (x > W * 0.72) return 44;
    return 18 + (Math.abs(x - W * 0.5) / (W * 0.22)) * 26;
  };
  ctx.strokeStyle = "rgba(200,210,235,0.5)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let i = 0; i <= 60; i++) {
    const x = tubeStart + ((tubeEnd - tubeStart) * i) / 60;
    const h = shape(x) * 0.5;
    const yy = y0 - h;
    i === 0 ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy);
  }
  ctx.lineTo(tubeEnd, y0 + shape(tubeEnd) * 0.5);
  for (let i = 60; i >= 0; i--) {
    const x = tubeStart + ((tubeEnd - tubeStart) * i) / 60;
    const yy = y0 + shape(x) * 0.5;
    ctx.lineTo(x, yy);
  }
  ctx.closePath();
  ctx.stroke();
  // particles flowing with speed proportional to inverse area
  const st0 = getStore(ctx.canvas);
  const key = `bern-${scene.v1}`;
  if (st0.bernKey !== key) {
    st0.bernP = [];
    st0.bernKey = key;
    for (let i = 0; i < 26; i++) {
      st0.bernP.push({ x: tubeStart + Math.random() * (tubeEnd - tubeStart), a: Math.random() * 6.28, sp: 1 + Math.random() * 1.2 });
    }
  }
  (st0.bernP || []).forEach((p) => {
    const areaF = 44 / Math.max(12, shape(p.x));
    p.x += p.sp * areaF * (scene.v1 / 10);
    const h = shape(p.x) * 0.5;
    const span = h * 0.9;
    p.y = y0 - span + ((p.a - 0) % (2 * span) + 2 * span) % (2 * span);
    if (p.x > tubeEnd - 2) p.x = tubeStart + 2;
    ctx.fillStyle = `rgba(0,255,213,${0.3 + (areaF - 1) * 0.2})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, areaF > 1.5 ? 2.4 : 3, 0, Math.PI * 2);
    ctx.fill();
  });
  // pressure readouts at 3 points
  const pts = [W * 0.18, W * 0.5, W * 0.82];
  const ps = [scene.p1, scene.p2, scene.p3];
  pts.forEach((px, i) => {
    const h = shape(px) * 0.5;
    ctx.fillStyle = "rgba(255,240,106,0.9)";
    ctx.beginPath();
    ctx.arc(px, y0, 4.5, 0, Math.PI * 2);
    ctx.fill();
    st(ctx, full ? 11 : 8);
    ctx.textAlign = "center";
    ctx.fillText(`P${i + 1}=${ps[i].toFixed(1)}`, px, y0 + h + (full ? 22 : 16));
  });
  st(ctx, full ? 13 : 10);
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.textAlign = "center";
  ctx.fillText(`v1 = ${scene.v1.toFixed(1)} m/s   v2 = ${scene.v2.toFixed(1)} m/s   Q = ${scene.flow.toFixed(2)} m³/s`, W / 2, H * 0.08);
  equationFooter(ctx, W, H, "P + ½ρv² + ρgh = constant", full);
}

// ─────────────────────────────────────────────────────────────
// 33 · SIMPLE ELECTRIC MOTOR  /  34 · DC GENERATOR
// ─────────────────────────────────────────────────────────────
function motor(ctx, scene, W, H, t, full, S, isGen) {
  background(ctx, W, H);
  stars(ctx, W, H, t, 25);
  const cx = W * 0.42;
  const cy = H * 0.46;
  const ang = scene.angle ?? 0;
  // B field horizontal lines
  ctx.setLineDash([3, 6]);
  ctx.strokeStyle = "rgba(87,211,255,0.35)";
  ctx.lineWidth = 1.5;
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(W * 0.04, cy + i * 22);
    ctx.lineTo(W * 0.96, cy + i * 22);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  st(ctx, full ? 11 : 8);
  ctx.fillStyle = "rgba(87,211,255,0.75)";
  ctx.textAlign = "center";
  ctx.fillText("B  —————→", W * 0.9, H * 0.08);
  // rotating coil
  const w = full ? 64 : 46;
  const h = full ? 42 : 30;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(ang);
  ctx.strokeStyle = "rgba(210,150,240,0.95)";
  ctx.lineWidth = 3;
  ctx.strokeRect(-w / 2, -h / 2, w, h);
  ctx.strokeStyle = "rgba(210,150,240,0.5)";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(-w / 2 - 3, -h / 2 - 3, w + 6, h + 6);
  ctx.restore();
  // axis
  ctx.strokeStyle = "rgba(255,255,255,0.4)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - w, cy);
  ctx.lineTo(cx + w, cy);
  ctx.stroke();
  // torque indicator
  const tor = scene.torque || 0;
  ctx.fillStyle = "rgba(66,255,128,0.9)";
  st(ctx, full ? 15 : 11);
  ctx.textAlign = "center";
  ctx.fillText(`τ = ${tor.toFixed(2)} N·m${isGen ? "" : `   I = ${scene.current?.toFixed(2) ?? "--"} A`}`, W / 2, H * 0.08);
  if (isGen && scene.vgen !== undefined) {
    ctx.fillStyle = "rgba(255,240,106,0.9)";
    ctx.fillText(`V_gen = ${scene.vgen.toFixed(2)} V   f = ${scene.freq.toFixed(1)} Hz`, W / 2, H * 0.15);
  }
  if (!isGen) {
    ctx.fillStyle = scene.current > 0.5 ? "rgba(0,255,213,0.9)" : "rgba(255,255,255,0.4)";
    ctx.fillText("electric → mechanical", W * 0.82, H * 0.92 - (full ? 20 : 10));
  } else {
    ctx.fillStyle = "rgba(255,240,106,0.9)";
    ctx.fillText("mechanical → electric", W * 0.82, H * 0.92 - (full ? 20 : 10));
  }
  // arrow rotation
  const arrowR = full ? 44 : 34;
  const a1 = ang + Math.PI / 2;
  ctx.strokeStyle = "rgba(66,255,128,0.7)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, arrowR, a1, a1 + 1.2);
  ctx.stroke();
  arrow(ctx, cx + Math.cos(a1 + 1.2) * arrowR, cy + Math.sin(a1 + 1.2) * arrowR, cx + Math.cos(a1 + 1.35) * arrowR + 8, cy + Math.sin(a1 + 1.35) * arrowR, "rgba(66,255,128,0.9)", 2, 7);
  // over time voltage sine overlay bottom
  if (isGen) {
    const vx0 = W * 0.1;
    const vx1 = W * 0.9;
    const vy = H * 0.8;
    const amp = Math.min(H * 0.12, scene.vmax * 4);
    ctx.strokeStyle = "rgba(255,240,106,0.7)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= 60; i++) {
      const x = vx0 + ((vx1 - vx0) * i) / 60;
      const y = vy - Math.sin((i / 60) * Math.PI * 2 * 3) * amp;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
    st(ctx, full ? 10 : 8);
    ctx.fillStyle = "rgba(255,240,106,0.6)";
    ctx.fillText("V(t) sine wave", vx0 + (vx1 - vx0) / 2, vy + 14);
  }
  equationFooter(ctx, W, H, isGen ? "ε = NABω sin(ωt)" : "τ = NABI sinθ", full);
}

// ─────────────────────────────────────────────────────────────
// 35 · SOLAR PANEL
// ─────────────────────────────────────────────────────────────
function solar(ctx, scene, W, H, t, full, S) {
  background(ctx, W, H);
  stars(ctx, W, H, t, 25);
  // sun top-left
  const sx = W * 0.18;
  const sy = H * 0.16;
  const sr = scene.intensity >= 0.7 ? 30 : 22 + scene.intensity * 10;
  const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr * 2);
  sg.addColorStop(0, "rgba(255,240,120,0.9)");
  sg.addColorStop(0.4, "rgba(255,200,80,0.35)");
  sg.addColorStop(1, "transparent");
  ctx.fillStyle = sg;
  ctx.fillRect(sx - sr * 2, sy - sr * 2, sr * 4, sr * 4);
  ctx.fillStyle = "#fff06a";
  ctx.beginPath();
  ctx.arc(sx, sy, sr, 0, Math.PI * 2);
  ctx.fill();
  // rays
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    ctx.strokeStyle = "rgba(255,240,120,0.5)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sx + Math.cos(a) * (sr + 8), sy + Math.sin(a) * (sr + 8));
    ctx.lineTo(sx + Math.cos(a) * (sr + 16), sy + Math.sin(a) * (sr + 16));
    ctx.stroke();
  }
  // photon particles to panel
  const st0 = getStore(ctx.canvas);
  const key = `solar-${scene.intensity}`;
  if (st0.solarKey !== key) {
    st0.solarP = [];
    st0.solarKey = key;
    for (let i = 0; i < 12; i++) st0.solarP.push({ p: Math.random(), sp: 0.004 + Math.random() * 0.006 });
  }
  (st0.solarP || []).forEach((p) => {
    p.p += p.sp * scene.intensity;
    if (p.p > 1) p.p = 0;
    const x = sx + (W * 0.45 - sx) * p.p;
    const y = sy + (H * 0.42 - sy) * p.p;
    ctx.fillStyle = `rgba(255,240,120,${0.35 + 0.5 * scene.intensity})`;
    ctx.beginPath();
    ctx.arc(x, y, 2, 0, Math.PI * 2);
    ctx.fill();
  });
  // panel
  const panelX = W * 0.44;
  const panelY = H * 0.42;
  const pw = full ? 70 : 56;
  const ph = full ? 44 : 34;
  const pg = ctx.createLinearGradient(panelX, panelY, panelX, panelY + ph);
  pg.addColorStop(0, "#0a2a5a");
  pg.addColorStop(1, "#10284a");
  ctx.fillStyle = pg;
  ctx.beginPath();
  ctx.roundRect(panelX, panelY, pw, ph, 6);
  ctx.fill();
  ctx.strokeStyle = "rgba(87,211,255,0.7)";
  ctx.lineWidth = 2;
  ctx.stroke();
  for (let i = 0; i < 3; i++) {
    ctx.strokeStyle = "rgba(87,211,255,0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(panelX + (i + 1) * (pw / 4), panelY + 4);
    ctx.lineTo(panelX + (i + 1) * (pw / 4), panelY + ph - 4);
    ctx.stroke();
  }
  st(ctx, full ? 9 : 7);
  ctx.fillStyle = "rgba(87,211,255,0.85)";
  ctx.textAlign = "center";
  ctx.fillText("PANEL", panelX + pw / 2, panelY + ph + 12);
  // wires
  ctx.strokeStyle = "rgba(200,200,220,0.5)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(panelX + pw / 2, panelY + ph);
  ctx.lineTo(panelX + pw / 2, H * 0.7);
  ctx.lineTo(W * 0.7, H * 0.7);
  ctx.stroke();
  // bulb
  const bx = W * 0.78;
  const by = H * 0.62;
  const gl = scene.power > 10 ? 0.4 + scene.power / 100 : 0.05;
  ctx.fillStyle = `rgba(255,240,120,${gl})`;
  ctx.beginPath();
  ctx.arc(bx, by, full ? 24 : 18, Math.PI, 0);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,240,120,0.9)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(bx, by, full ? 24 : 18, Math.PI, 0);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(bx - full * 14 - 4, by);
  ctx.lineTo(bx - full * 14 - 4, by + 12);
  ctx.moveTo(bx + full * 14 + 4, by);
  ctx.lineTo(bx + full * 14 + 4, by + 12);
  ctx.stroke();
  st(ctx, full ? 13 : 10);
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.textAlign = "center";
  ctx.fillText(`P = ${scene.power.toFixed(1)} W   V = ${scene.vout.toFixed(1)} V   I = ${scene.iout.toFixed(2)} A   eff = ${scene.eff.toFixed(0)}%`, W / 2, H * 0.07);
  equationFooter(ctx, W, H, "P = η · G · A", full);
}

// ─────────────────────────────────────────────────────────────
// 36 · ENERGY CONVERSION LAB
// ─────────────────────────────────────────────────────────────
function energyFlow(ctx, scene, W, H, t, full, S) {
  background(ctx, W, H);
  stars(ctx, W, H, t, 20);
  const chain = scene.chain || [];
  const n = chain.length;
  const bw = full ? 84 : 58;
  const bx0 = W * 0.06;
  const by = H * 0.34;
  const gap = (W - W * 0.12 - n * bw) / Math.max(1, n - 1);
  const cols = ["#ff5a5a", "#ffc832", "#42ff80", "#57d3ff", "#ff5aa9", "#9a7bff"];
  chain.forEach((c, i) => {
    const x = bx0 + i * (bw + gap);
    const glowOn = scene.input > 0 ? 1 : 0.35;
    ctx.fillStyle = c.color + "44";
    ctx.beginPath();
    ctx.roundRect(x, by, bw, bw * 0.8, 10);
    ctx.fill();
    ctx.strokeStyle = c.color;
    ctx.lineWidth = 2;
    ctx.stroke();
    st(ctx, full ? 12 : 9);
    ctx.fillStyle = c.color + "ff";
    ctx.textAlign = "center";
    ctx.fillText(c.label, x + bw / 2, by + 12);
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    st(ctx, full ? 9 : 7, "'Inter', sans-serif", "normal");
    ctx.fillText(c.form, x + bw / 2, by + bw * 0.45);
    // icon emoji
    ctx.font = `${full ? 26 : 20}px 'Inter', sans-serif`;
    ctx.fillText(c.icon || "⚡", x + bw / 2, by + bw * 0.62);
    // arrows
    if (i < n - 1) {
      const ax = x + bw + gap / 2;
      const pulse = 0.5 + 0.5 * Math.sin(t * 0.06 + i);
      arrow(ctx, x + bw, by + bw * 0.4, ax + gap / 2, by + bw * 0.4, `rgba(${scene.input > 0 ? "66,255,128" : "255,255,255"},${0.35 + 0.55 * pulse})`, 3, 9);
    }
  });
  // efficiency bar
  const effX = W * 0.12;
  const effW = W * 0.76;
  const effY = H * 0.68;
  ctx.fillStyle = "rgba(255,255,255,0.15)";
  ctx.beginPath();
  ctx.roundRect(effX, effY, effW, 16, 8);
  ctx.fill();
  ctx.fillStyle = "rgba(66,255,128,0.85)";
  ctx.beginPath();
  ctx.roundRect(effX, effY, effW * Math.min(1, scene.eff / 100), 16, 8);
  ctx.fill();
  st(ctx, full ? 13 : 10);
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.textAlign = "center";
  ctx.fillText(`Input ${scene.input.toFixed(0)} J   →   Output ${scene.output.toFixed(0)} J   Loss ${scene.loss.toFixed(0)} J    Efficiency ${scene.eff.toFixed(0)}%`, W / 2, H * 0.08);
  equationFooter(ctx, W, H, "Efficiency = (useful output / input) × 100%", full);
}

// ─────────────────────────────────────────────────────────────
// 37 · MEASUREMENT AND UNCERTAINTY
// ─────────────────────────────────────────────────────────────
function measurement(ctx, scene, W, H, t, full, S) {
  background(ctx, W, H);
  stars(ctx, W, H, t, 18);
  // ruler
  const rx = W * 0.08;
  const ry = H * 0.12;
  const rl = W * 0.84;
  ctx.fillStyle = "rgba(220,225,240,0.12)";
  ctx.fillRect(rx, ry, rl, full ? 30 : 24);
  ctx.strokeStyle = "rgba(255,255,255,0.4)";
  ctx.lineWidth = 1;
  ctx.strokeRect(rx, ry, rl, full ? 30 : 24);
  for (let i = 0; i <= 100; i++) {
    const x = rx + (rl * i) / 100;
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.fillRect(x, ry, 1, i % 10 === 0 ? 14 : i % 5 === 0 ? 10 : 6);
  }
  st(ctx, full ? 12 : 9);
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.textAlign = "center";
  ctx.fillText(`Ruler reads ${scene.ruler.toFixed(1)} ± 0.1 cm`, W / 2, ry + (full ? 48 : 40));
  // stopwatch readout
  const swx = W * 0.74;
  const swy = H * 0.42;
  ctx.beginPath();
  ctx.arc(swx, swy, full ? 40 : 30, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(15,25,40,0.9)";
  ctx.fill();
  ctx.strokeStyle = "rgba(0,255,213,0.5)";
  ctx.lineWidth = 2;
  ctx.stroke();
  st(ctx, full ? 16 : 12);
  ctx.fillStyle = "#00ffd5";
  ctx.textAlign = "center";
  ctx.fillText(scene.stopwatch.toFixed(2), swx, swy + 4);
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  st(ctx, full ? 9 : 7);
  ctx.fillText("± 0.01 s", swx, swy + (full ? 52 : 40));
  // balance bars
  const bbx = W * 0.1;
  const bby = H * 0.52;
  ctx.fillStyle = "rgba(255,255,255,0.1)";
  ctx.fillRect(bbx, bby, W * 0.4, full ? 26 : 20);
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.strokeRect(bbx, bby, W * 0.4, full ? 26 : 20);
  const frac = Math.min(1, scene.mass / 100);
  ctx.fillStyle = "rgba(255,240,106,0.7)";
  ctx.fillRect(bbx, bby, W * 0.4 * frac, full ? 26 : 20);
  st(ctx, full ? 10 : 8);
  ctx.fillStyle = "rgba(255,240,106,0.85)";
  ctx.textAlign = "center";
  ctx.fillText(`${scene.mass.toFixed(2)} ± 0.05 g`, bbx + W * 0.16, bby + (full ? 42 : 34));
  // mean / uncertainty table at bottom
  st(ctx, full ? 13 : 10);
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.textAlign = "center";
  ctx.fillText(`mean = ${scene.mean.toFixed(2)}   Δx = ${scene.absErr.toFixed(2)}   %err = ${scene.percentErr.toFixed(1)}%  (n=${scene.n} readings)`, W / 2, H * 0.8);
  equationFooter(ctx, W, H, "%uncertainty = (uncertainty / measured) × 100%", full);
}

// ─────────────────────────────────────────────────────────────
// 38 · DIMENSIONAL ANALYSIS
// ─────────────────────────────────────────────────────────────
function dimensional(ctx, scene, W, H, t, full, S) {
  background(ctx, W, H);
  stars(ctx, W, H, t, 18);
  const cx = W / 2;
  const eqY = H * 0.24;
  // equation
  st(ctx, full ? 26 : 18);
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.textAlign = "center";
  ctx.fillText(scene.equation, cx, eqY);
  // dimension chips
  const chips = scene.chips || [];
  const cw = full ? 130 : 96;
  const wx0 = cx - (chips.length * cw) / 2 - (chips.length - 1) * 10;
  chips.forEach((c, i) => {
    const x = wx0 + i * (cw + 20);
    const y = H * 0.42;
    ctx.fillStyle = "rgba(20,30,50,0.9)";
    ctx.beginPath();
    ctx.roundRect(x, y, cw, full ? 70 : 56, 10);
    ctx.fill();
    ctx.strokeStyle = c.ok ? "rgba(66,255,128,0.6)" : "rgba(255,90,90,0.6)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    st(ctx, full ? 11 : 8);
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.textAlign = "center";
    ctx.fillText(c.label, x + cw / 2, y + 12);
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    st(ctx, full ? 13 : 10);
    ctx.fillText(c.dim, x + cw / 2, y + (full ? 32 : 26));
    ctx.fillStyle = c.ok ? "#42ff80" : "#ff5a5a";
    st(ctx, full ? 9 : 7);
    ctx.fillText(c.ok ? "✓" : "✗", x + cw / 2, y + (full ? 52 : 44));
  });
  const ok = chips.every((c) => c.ok);
  ctx.fillStyle = ok ? "rgba(66,255,128,0.95)" : "rgba(255,90,90,0.95)";
  st(ctx, full ? 20 : 14);
  ctx.textAlign = "center";
  ctx.fillText(ok ? "CORRECT DIMENSION ✓" : "DIMENSIONAL ERROR ✗", cx, H * 0.84);
  equationFooter(ctx, W, H, "M, L, T — fundamental dimensions", full);
}

// ─────────────────────────────────────────────────────────────
// 39 · VECTOR ADDITION
// ─────────────────────────────────────────────────────────────
function vectors(ctx, scene, W, H, t, full, S) {
  background(ctx, W, H);
  stars(ctx, W, H, t, 20);
  const orx = W * 0.32;
  const ory = H * 0.6;
  const scale = W * 0.008;
  // axes
  ctx.strokeStyle = "rgba(255,255,255,0.2)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(W * 0.04, ory);
  ctx.lineTo(W * 0.96, ory);
  ctx.moveTo(orx, H * 0.06);
  ctx.lineTo(orx, H * 0.96);
  ctx.stroke();
  // grid
  ctx.strokeStyle = "rgba(255,255,255,0.05)";
  for (let i = -6; i <= 6; i++) {
    if (i === 0) continue;
    ctx.beginPath();
    ctx.moveTo(orx + i * scale * 25, H * 0.06);
    ctx.lineTo(orx + i * scale * 25, H * 0.96);
    ctx.moveTo(orx, ory + i * scale * 25);
    ctx.lineTo(W * 0.96, ory + i * scale * 25);
    ctx.stroke();
  }
  // vectors tip to tail
  const vecs = scene.vectors || [];
  let cxv = orx;
  let cyv = ory;
  const colors = ["#ff5a5a", "#ffc832", "#42ff80", "#57d3ff", "#ff5aa9"];
  vecs.forEach((v, i) => {
    const ex = cxv + v.dx * scale;
    const ey = cyv - v.dy * scale;
    ctx.fillStyle = colors[i % colors.length];
    ctx.strokeStyle = colors[i % colors.length];
    ctx.lineWidth = 3;
    arrow(ctx, cxv, cyv, ex, ey, colors[i % colors.length], 3, 10);
    st(ctx, full ? 10 : 8);
    ctx.textAlign = "center";
    ctx.fillText(`V${i + 1}`, (cxv + ex) / 2, (cyv + ey) / 2 - 6);
    cxv = ex;
    cyv = ey;
  });
  // resultant
  if (scene.resultant) {
    ctx.setLineDash([6, 4]);
    arrow(ctx, orx, ory, orx + scene.resultant.dx * scale, ory - scene.resultant.dy * scale, "rgba(255,255,255,0.9)", 3.5, 12);
    ctx.setLineDash([]);
    st(ctx, full ? 13 : 10);
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.textAlign = "left";
    ctx.fillText(`R = ${scene.resultant.mag.toFixed(1)} @ ${scene.resultant.angle.toFixed(1)}°`, W * 0.55, H * 0.2);
    // angle arc
    const rx0 = orx + scene.resultant.dx * scale;
    const ry0 = ory - scene.resultant.dy * scale;
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.beginPath();
    ctx.arc(orx, ory, Math.min(40, Math.hypot(rx0 - orx, ry0 - ory) * 0.4), -scene.resultant.rad, 0);
    ctx.stroke();
  }
  // components table
  st(ctx, full ? 11 : 8);
  ctx.fillStyle = "rgba(87,211,255,0.85)";
  ctx.textAlign = "center";
  ctx.fillText(`ΣFx = ${scene.sumX.toFixed(2)}   ΣFy = ${scene.sumY.toFixed(2)}`, W / 2, H * 0.06);
  equationFooter(ctx, W, H, "R = √(Rx² + Ry²)   θ = tan⁻¹(Ry/Rx)", full);
}

// ─────────────────────────────────────────────────────────────
// 40 · PROJECTILE TARGET CHALLENGE
// ─────────────────────────────────────────────────────────────
function targetChallenge(ctx, scene, W, H, t, full, S) {
  background(ctx, W, H);
  stars(ctx, W, H, t, 40);
  const groundY = H * 0.85;
  ground(ctx, W, H, groundY);
  const launchX = W * 0.08;
  const scale = (W * 0.8) / Math.max(scene.targetDist, 100);
  const heightScale = (H * 0.6) / Math.max(scene.hMax, 10);
  // target flag
  const tx = launchX + scene.targetDist * scale;
  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(tx, groundY);
  ctx.lineTo(tx, groundY - 40);
  ctx.stroke();
  ctx.fillStyle = "#ff5a5a";
  ctx.beginPath();
  ctx.moveTo(tx, groundY - 40);
  ctx.lineTo(tx + 18, groundY - 33);
  ctx.lineTo(tx, groundY - 26);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(255,90,90,0.8)";
  ctx.font = `${full ? 12 : 9}px 'Orbitron', sans-serif`;
  ctx.fillText(`TARGET ${scene.targetDist.toFixed(0)} m`, tx + 22, groundY - 30);
  // predicted trajectory (dashed)
  if (scene.predicted) {
    ctx.strokeStyle = "rgba(87,211,255,0.4)";
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    scene.predicted.forEach(([d, h], i) => {
      const x = launchX + d * scale;
      const y = groundY - h * heightScale;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.setLineDash([]);
  }
  // actual trajectory
  if (scene.actual && scene.fireT !== undefined) {
    ctx.strokeStyle = "rgba(255,90,169,0.9)";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    scene.actual.forEach(([d, h], i) => {
      if (scene.fireT > 0 && d > scene.fireT * scene.vx) return;
      const x = launchX + d * scale;
      const y = groundY - h * heightScale;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();
    const px = launchX + Math.min(scene.fireT * scene.vx, scene.actual[scene.actual.length - 1][0]) * scale;
    const pidx = Math.max(1, Math.floor(scene.fireT / 0.05)) - 1;
    const p = scene.actual[Math.min(pidx, scene.actual.length - 1)];
    if (p) {
      const x = launchX + p[0] * scale;
      const y = groundY - p[1] * heightScale;
      const gl = ctx.createRadialGradient(x, y, 0, x, y, 18);
      gl.addColorStop(0, "rgba(255,90,169,0.5)");
      gl.addColorStop(1, "transparent");
      ctx.fillStyle = gl;
      ctx.beginPath();
      ctx.arc(x, y, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ff4fd8";
      ctx.beginPath();
      ctx.arc(x, y, full ? 7 : 5, 0, Math.PI * 2);
      ctx.fill();
    }
    // launch platform
    ctx.fillStyle = "rgba(255,150,60,0.8)";
    ctx.font = `${full ? 12 : 9}px 'Orbitron', sans-serif`;
    ctx.fillText(`θ=${scene.angle}° v=${scene.speed}m/s`, launchX - 5, groundY + 16);
  }
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  st(ctx, full ? 13 : 10);
  ctx.textAlign = "center";
  ctx.fillText(`Range predicted ${scene.range.toFixed(1)} m   Error ${scene.error.toFixed(1)} m   ${scene.fired ? "Fired!" : "Set angle & speed, press FIRE"}`, W / 2, H * 0.07);
  if (scene.hit) {
    ctx.fillStyle = "rgba(66,255,128,0.95)";
    st(ctx, full ? 20 : 14);
    ctx.fillText("🎯 TARGET HIT!", W / 2, H * 0.82);
  }
  equationFooter(ctx, W, H, "R = v²sin(2θ)/g", full);
}

// ─────────────────────────────────────────────────────────────
// 24 · DOPPLER EFFECT
// ─────────────────────────────────────────────────────────────
function doppler(ctx, scene, W, H, t, full, S) {
  background(ctx, W, H);
  stars(ctx, W, H, t, 40);
  const f0 = scene.f0 ?? 700;
  const vs = scene.vs ?? 30;
  const vSound = scene.vSound ?? 343;
  const simT = scene.t ?? 0;
  const ySrc = H * 0.42;
  const obsX = W * 0.82;
  // Source sweeps back and forth past the observer
  const srcX = W * 0.48 + Math.sin(simT * 0.55) * W * 0.34;
  // Wavefront store
  const d = S.doppler = S.doppler || { fronts: [], prevT: 0 };
  const dt = Math.max(0, Math.min(0.05, simT - d.prevT));
  d.prevT = simT;
  const vPx = W * 0.55; // px travelled by a front per second (tuned visually)
  const lambdaPx = vPx / Math.max(f0, 1);
  // emit a front every period
  const tick = Math.floor(simT * f0);
  if (d.fronts.length === 0 || tick !== d.nTick) {
    d.nTick = tick;
    d.fronts.push({ x: srcX, born: simT });
    if (d.fronts.length > 42) d.fronts.shift();
  }
  // moving horizontal road line
  ctx.strokeStyle = "rgba(255,255,255,0.1)";
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 8]);
  ctx.beginPath();
  ctx.moveTo(W * 0.04, ySrc);
  ctx.lineTo(W * 0.96, ySrc);
  ctx.stroke();
  ctx.setLineDash([]);
  // wavefronts — naturally compressed ahead, stretched behind
  d.fronts.forEach((fr, i) => {
    const r = (simT - fr.born) * vPx;
    const push = 1 - i / d.fronts.length;
    ctx.strokeStyle = `rgba(0,255,213,${(0.05 + 0.22 * push).toFixed(3)})`;
    ctx.lineWidth = full ? 1.6 : 1.2;
    ctx.beginPath();
    ctx.arc(fr.x, ySrc, Math.max(0, r), 0, Math.PI * 2);
    ctx.stroke();
  });
  // observer
  st(ctx, full ? 16 : 12);
  ctx.fillStyle = "#ff5aa9";
  ctx.textAlign = "center";
  ctx.fillText("👂", obsX, ySrc - 8);
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  st(ctx, full ? 11 : 8);
  ctx.fillText("observer", obsX, ySrc + full ? 22 : 18);
  // source
  const sgrad = ctx.createRadialGradient(srcX - 3, ySrc - 3, 0, srcX, ySrc, full ? 16 : 12);
  sgrad.addColorStop(0, "#fff06a");
  sgrad.addColorStop(1, "#e07020");
  ctx.fillStyle = sgrad;
  ctx.beginPath();
  ctx.arc(srcX, ySrc, full ? 16 : 12, 0, Math.PI * 2);
  ctx.fill();
  st(ctx, full ? 11 : 8);
  ctx.fillStyle = "#fff06a";
  ctx.textAlign = "center";
  ctx.fillText(`source ${vs} m/s →`, srcX, ySrc + (full ? 30 : 24));
  // relative pitch side labels
  const opposing = Math.sign(Math.sin(simT * 0.55));
  ctx.fillStyle = opposing >= 0 ? "#42ff80" : "rgba(255,240,106,0.85)";
  st(ctx, full ? 13 : 10);
  ctx.fillText(
    opposing >= 0 ? "APPROACHING → pitch RISES  f' > f₀" : "RECEDING → pitch FALLS  f' < f₀",
    W / 2,
    H * 0.1
  );
  st(ctx, full ? 12 : 9);
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.fillText(`f₀ = ${f0} Hz   λ = ${(vSound / f0).toFixed(2)} m   v_sound = ${vSound} m/s`, W / 2, H * 0.16);
  equationFooter(ctx, W, H, "f' = f (v + vo)/(v − vs)", full);
}

// ─────────────────────────────────────────────────────────────
// DISPATCH
// ─────────────────────────────────────────────────────────────
export function drawScene(ctx, kind, scene, W, H, tAmb, full, isRunning) {
  // `tAmb` in seconds-ish for ambient animation
  const S = getStore(ctx.canvas);
  switch (kind) {
    case "circuitSP": return circuitSP(ctx, scene, W, H, tAmb, full, S);
    case "freeFall": return freeFall(ctx, scene, W, H, tAmb, full, S);
    case "friction": return friction(ctx, scene, W, H, tAmb, full, S);
    case "spring": return springVertical(ctx, scene, W, H, tAmb, full, S, false);
    case "shm": return springVertical(ctx, scene, W, H, tAmb, full, S, true);
    case "workEnergy": return workEnergy(ctx, scene, W, H, tAmb, full, S);
    case "energyTrack": return energyTrack(ctx, scene, W, H, tAmb, full, S);
    case "collision": return collision(ctx, scene, W, H, tAmb, full, S);
    case "centripetal": return centripetal(ctx, scene, W, H, tAmb, full, S);
    case "wave": return wave(ctx, scene, W, H, tAmb, full, S);
    case "soundWave": return soundWave(ctx, scene, W, H, tAmb, full, S);
    case "doppler": return doppler(ctx, scene, W, H, tAmb, full, S);
    case "lens": return lens(ctx, scene, W, H, tAmb, full, S);
    case "induction": return induction(ctx, scene, W, H, tAmb, full, S);
    case "magneticForce": return magneticForce(ctx, scene, W, H, tAmb, full, S);
    case "rcCircuit": return rcCircuit(ctx, scene, W, H, tAmb, full, S);
    case "heat": return heat(ctx, scene, W, H, tAmb, full, S);
    case "gas": return gas(ctx, scene, W, H, tAmb, full, S);
    case "orbit": return orbit(ctx, scene, W, H, tAmb, full, S);
    case "planetFall": return planetFall(ctx, scene, W, H, tAmb, full, S);
    case "escape": return escape(ctx, scene, W, H, tAmb, full, S);
    case "projectileAir": return projectileAir(ctx, scene, W, H, tAmb, full, S);
    case "fluid": return fluid(ctx, scene, W, H, tAmb, full, S);
    case "buoyancy": return buoyancy(ctx, scene, W, H, tAmb, full, S);
    case "pressure": return pressure(ctx, scene, W, H, tAmb, full, S);
    case "bernoulli": return bernoulli(ctx, scene, W, H, tAmb, full, S);
    case "motor": return motor(ctx, scene, W, H, tAmb, full, S, false);
    case "generator": return motor(ctx, scene, W, H, tAmb, full, S, true);
    case "solar": return solar(ctx, scene, W, H, tAmb, full, S);
    case "energyFlow": return energyFlow(ctx, scene, W, H, tAmb, full, S);
    case "measurement": return measurement(ctx, scene, W, H, tAmb, full, S);
    case "dimensional": return dimensional(ctx, scene, W, H, tAmb, full, S);
    case "vectors": return vectors(ctx, scene, W, H, tAmb, full, S);
    case "targetChallenge": return targetChallenge(ctx, scene, W, H, tAmb, full, S);
    default: {
      background(ctx, W, H);
      stars(ctx, W, H, tAmb, 20);
      st(ctx, 14);
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.textAlign = "center";
      ctx.fillText("Simulation visualization", W / 2, H / 2);
    }
  }
}

const trailing = null;
const norad = null;
const rgb = null;
export { stars as drawStars, background as drawBackground, ground as drawGround, arrow as drawArrow, equationFooter, hsl as drawColor };