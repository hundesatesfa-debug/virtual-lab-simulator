const D2R = Math.PI / 180;
const GRAV = 9.80665;
const GC = 6.674e-11;
const R_EARTH = 6.371e6;

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function sweep(fn, from, to, steps = 40) {
  const out = [];
  for (let i = 0; i <= steps; i++) {
    const x = from + ((to - from) * i) / steps;
    out.push({ x, y: fn(x) });
  }
  return out;
}

// ── Numeric 1D / 2D integrators used by orbit / escape / projectileAir ──
function integrateOrbit(M, r0, v0, tEnd, dt = 0.05) {
  const points = [{ x: r0, y: 0 }];
  let rx = r0;
  let ry = 0;
  let vx = 0;
  let vy = v0;
  let mode = "stable"; // stable | hyperbolic | impact
  let F = GC * M * 1 / (r0 * r0);
  let speed = v0;
  for (let t = 0; t < tEnd; t += dt) {
    const r = Math.hypot(rx, ry) || 1;
    const a = -GC * M / (r * r);
    vx += (a * rx / r) * dt;
    vy += (a * ry / r) * dt;
    rx += vx * dt;
    ry += vy * dt;
    const nr = Math.hypot(rx, ry);
    speed = Math.hypot(vx, vy);
    F = GC * M / (nr * nr);
    if (nr < R_EARTH) {
      mode = "impact";
      points.push({ x: rx, y: ry });
      break;
    }
    const veAtR = Math.sqrt((2 * GC * M) / nr);
    if (mode === "stable" && speed > veAtR && nr > r0 * 1.15) {
      mode = "hyperbolic";
    }
    if (points.length % 2 === 0 || t === tEnd - dt) {
      points.push({ x: rx, y: ry });
    }
    if (points.length > 600) break;
  }
  // normalize to planet-relative meters but scaled for display later
  const pArr = points.map((p) => ({ x: (p.x - R_EARTH) / 1e3, y: (p.y) / 1e3, rx: p.x, ry: p.y })); // km relative surface + absolute
  return { points: pArr, mode, F, speed, r: Math.hypot(rx, ry) };
}

function integrateEscape(M, R, v0, tEnd, dt = 0.1) {
  const ve = Math.sqrt((2 * GC * M) / R);
  let r = R;
  let v = v0;
  let outcome = v0 > ve ? "escape" : v0 === ve ? "orbit" : "falls back";
  const trace = [{ r: 0, v }];
  for (let t = 0; t < tEnd; t += dt) {
    if (r > R * 5 && v > 0) {
      outcome = v0 > ve ? "escape" : outcome;
      break;
    }
    if (v <= 0) {
      outcome = "falls back";
      trace.push({ r, v: 0 });
      break;
    }
    const a = -GC * M / (r * r);
    v += a * dt;
    if (v < 0) {
      // reached apex
      outcome = "falls back";
      trace.push({ r, v: 0 });
      break;
    }
    r += v * dt;
    trace.push({ r, v });
    if (trace.length > 800) break;
  }
  return { ve, outcome, trace };
}

function integrateProjectile(v, angle, m, Cd, rho, area, gval, h0 = 0) {
  const rad = angle * D2R;
  const vx0 = v * Math.cos(rad);
  const vy0 = v * Math.sin(rad);
  const c = 0.5 * rho * Cd * area / Math.max(m, 0.01);
  const dt = 0.01;
  const ideal = [];
  const drag = [{ x: 0, y: h0 }];
  let ix = 0, iy = h0, ivx = vx0, ivy = vy0;
  let dx = 0, dy = h0, dvxx = vx0, dvyy = vy0;
  let maxI = 0, maxD = 0;
  let rangeI = 0, rangeD = 0;
  let t = 0;
  let launched = false;
  const MAXSTEPS = 5000;
  for (let i = 0; i < MAXSTEPS; i++) {
    t += dt;
    ivx = vx0;
    ivy = vy0 - gval * t;
    ix = vx0 * t;
    iy = h0 + vy0 * t - 0.5 * gval * t * t;
    if (ivy < 0 && iy <= 0) { rangeI = ix; break; }
    if (iy > maxI) { maxI = iy; }
    if (i % 3 === 0) ideal.push({ x: ix, y: Math.max(0, iy) });
    // drag step
    const sp = Math.hypot(dvxx, dvyy) || 0.001;
    const ax = -c * sp * dvxx;
    const ay = -gval - c * sp * dvyy;
    dvxx += ax * dt;
    dvyy += ay * dt;
    dx += dvxx * dt;
    dy += dvyy * dt;
    if (dy <= 0 && dvyy < 0) { rangeD = dx; launched = true; break; }
    if (dy > maxD) maxD = dy;
    if (i % 3 === 0) drag.push({ x: dx, y: Math.max(0, dy) });
    if (dy < -900) break;
  }
  if (!launched && dy > 0) { rangeD = dx; }
  return { ideal, drag, rangeI, rangeD, hI: maxI, hD: maxD, time: t };
}

// ════════════════════════════════════════════════════════════════
// 02 · SERIES AND PARALLEL CIRCUITS
// ════════════════════════════════════════════════════════════════
const seriesParallel = {
  id: "seriesParallel",
  number: "02",
  title: "Series and Parallel Circuits",
  topic: "Electricity",
  description: "Compare how current and voltage behave in resistor networks wired in series versus parallel.",
  objective: "Understand how total resistance, current and voltage split across series and parallel configurations.",
  theory: [
    "In a series circuit the same current flows through every resistor and the voltages add up to the battery voltage.",
    "In a parallel circuit every resistor sees the full battery voltage, but the current splits between the branches."
  ],
  formulas: [
    { text: "R_total = R1 + R2 + R3", note: "Series (Ω)" },
    { text: "1/R_total = 1/R1 + 1/R2 + 1/R3", note: "Parallel (Ω⁻¹ adds)" },
    { text: "V = I × R_total", note: "Ohm's Law (V = A · Ω)" }
  ],
  unitsNote: "Voltage in volts (V), current in amperes (A), resistance in ohms (Ω), power in watts (W).",
  limitsNote: "Battery 1–24 V, each resistor 1–20 Ω (realistic lab resistors).",
  scene: "circuitSP",
  duration: null,
  controls: [
    { key: "config", label: "Circuit configuration", type: "segmented", options: [{ v: "series", l: "Series" }, { v: "parallel", l: "Parallel" }], def: "series" },
    { key: "v", label: "Battery voltage", min: 1, max: 24, step: 1, unit: "V", def: 12 },
    { key: "r1", label: "Resistor R1", min: 1, max: 20, step: 1, unit: "Ω", def: 4 },
    { key: "r2", label: "Resistor R2", min: 1, max: 20, step: 1, unit: "Ω", def: 6 },
    { key: "r3", label: "Resistor R3", min: 1, max: 20, step: 1, unit: "Ω", def: 8 }
  ],
  measures: [
    { key: "rt", label: "Total resistance", unit: "Ω" },
    { key: "it", label: "Total current", unit: "A" },
    { key: "v1", label: "Voltage R1", unit: "V" },
    { key: "v2", label: "Voltage R2", unit: "V" },
    { key: "v3", label: "Voltage R3", unit: "V" },
    { key: "power", label: "Power", unit: "W" }
  ],
  compute(s) {
    const { config, v, r1, r2, r3 } = s;
    const rL = [r1, r2, r3];
    let rt, drops, iList, it;
    if (config === "series") {
      rt = r1 + r2 + r3;
      it = v / rt;
      drops = rL.map((r) => r * it);
      iList = [it, it, it];
    } else {
      rt = 1 / rL.reduce((a, r) => a + 1 / r, 0);
      it = v / rt;
      drops = [v, v, v];
      iList = rL.map((r) => v / r);
    }
    return {
      m: { rt, it, v1: drops[0], v2: drops[1], v3: drops[2], power: v * it },
      scene: { config, v, rt, iTotal: it, rList: rL, drops, iList }
    };
  },
  graph: {
    series(s, m) {
      return [{ points: sweep((rt) => m.rt > 0 ? s.v / rt : 0, 3, 25), color: "#ff4fd8" }];
    },
    xLabel: "Total resistance (Ω)",
    yLabel: "Current (A)"
  },
  procedure: [
    "Build a series circuit with three resistors.",
    "Set the battery voltage and adjust each resistor.",
    "Record the total current and the voltage across each resistor.",
    "Switch to parallel and repeat the measurements.",
    "Compare total resistance in the two configurations."
  ],
  observation: "In series the current is identical everywhere and voltages share the battery voltage. In parallel each resistor gets the full voltage while the current splits.",
  conclusion: "Resistors in series add (R = ΣR), but in parallel the total resistance is smaller than the smallest resistor (1/R = Σ1/R).",
  explain: "Think of current like water. In series, water must pass each resistor one after the other — more resistance, less flow. In parallel, water takes all three pipes at once — more total flow, less overall resistance.",
  uncertainty: "Ammeter/voltmeter readings carry ±0.5 % of range + 1 digit least-count uncertainty. Use equation errors to propagate: ΔR/R = ΔV/V + ΔI/I.",
  runningHint: "Watch the ammeter and voltmeter values change as you adjust the resistors."
};

// ════════════════════════════════════════════════════════════════
// 04 · FREE FALL
// ════════════════════════════════════════════════════════════════
const freeFall = {
  id: "freeFall",
  number: "04",
  title: "Free Fall",
  topic: "Kinematics",
  description: "An object is released and falls under gravity. Measure its height, velocity and acceleration over time.",
  objective: "Verify that all objects accelerate at g regardless of mass (ignoring air resistance).",
  theory: [
    "In free fall the only force is weight W = mg, so the acceleration is a = g for every object.",
    "The kinematic equations describe height, velocity and displacement as functions of time."
  ],
  formulas: [
    { text: "v = u + gt", note: "velocity (m/s)" },
    { text: "s = ut + ½gt²", note: "displacement (m)" },
    { text: "v² = u² + 2gs", note: "no-time relation (m²/s²)" }
  ],
  unitsNote: "Height & displacement in metres (m), velocity in m/s, time in s, g in m/s², mass in kg.",
  limitsNote: "Height 10–120 m, initial velocity 0–20 m/s downward, g between Moon (1.6) and Jupiter (25) m/s².",
  scene: "freeFall",
  duration: null,
  controls: [
    { key: "h0", label: "Initial height", min: 10, max: 120, step: 1, unit: "m", def: 40 },
    { key: "u", label: "Initial velocity (down)", min: 0, max: 20, step: 1, unit: "m/s", def: 0 },
    { key: "g", label: "Gravity", min: 1.6, max: 15, step: 0.1, unit: "m/s²", def: 9.8 },
    { key: "mass", label: "Object mass", min: 1, max: 10, step: 0.5, unit: "kg", def: 2 }
  ],
  measures: [
    { key: "time", label: "Time", unit: "s" },
    { key: "height", label: "Height", unit: "m" },
    { key: "vel", label: "Velocity", unit: "m/s" },
    { key: "acc", label: "Acceleration", unit: "m/s²" },
    { key: "dist", label: "Distance fallen", unit: "m" },
    { key: "weight", label: "Weight", unit: "N" }
  ],
  compute(s) {
    const { h0, u, g, mass, t } = s;
    const T = h0 > 0 ? (-u + Math.sqrt(u * u + 2 * g * h0)) / g : 0;
    const tc = Math.min(t, T);
    const h = Math.max(0, h0 - u * tc - 0.5 * g * tc * tc);
    const v = u + g * tc;
    const dist = u * tc + 0.5 * g * tc * tc;
    const m = { time: tc, height: h, vel: v, acc: g, dist, weight: mass * g };
    const scene = {
      h0, h, v, g, mass,
      phase: s.phase,
      T,
      done: tc >= T
    };
    return { m, scene };
  },
  graph: {
    series(s, m) {
      return [{ points: sweep((tt) => s.u + s.g * tt, 0, m.time || 1), color: "#57d3ff" }];
    },
    xLabel: "Time (s)",
    yLabel: "Velocity (m/s)"
  },
  procedure: [
    "Choose a height, initial velocity and gravity.",
    "Press Run and watch the ball fall.",
    "Record height, velocity and distance at several times.",
    "Plot velocity against time and measure the slope.",
    "Change the mass — check nothing changes about the motion."
  ],
  observation: "The height decreases quadratically while velocity grows linearly with time. Doubling the mass does not speed up the fall.",
  conclusion: "In free fall the acceleration is g for every mass: heavier and lighter objects fall at the same rate (in vacuum).",
  explain: "Gravity pulls both heavy and light objects with a force proportional to their mass (F = mg). Since F = ma, the mass cancels and a = g for everything.",
  uncertainty: "Stopwatch uncertainties of ±0.05 s dominate. Quoting g = (9.76 ± 0.12) m/s² from a typical photogate setup is realistic.",
  runningHint: "Watch v = u + gt grow linearly while the object plummets."
};

// ════════════════════════════════════════════════════════════════
// 07 · FRICTION
// ════════════════════════════════════════════════════════════════
const friction = {
  id: "friction",
  number: "07",
  title: "Friction — Static and Kinetic",
  topic: "Dynamics",
  description: "Push a block across different surfaces and watch static friction give way to kinetic friction.",
  objective: "Understand that maximum static friction is larger than kinetic friction, and that friction depends on the normal force.",
  theory: [
    "Static friction matches the applied force up to a maximum f_max = μs·N. Past that the block slides.",
    "While sliding, kinetic friction f_k = μk·N is roughly constant and slightly smaller than static maximum."
  ],
  formulas: [
    { text: "f = μN", note: "friction (N)" },
    { text: "N = mg", note: "normal force on a horizontal surface (N)" },
    { text: "F_net = F − f", note: "net force while sliding (N)" },
    { text: "a = F_net/m", note: "acceleration (m/s²)" }
  ],
  unitsNote: "Force in newtons (N), mass in kg, acceleration in m/s². N = kg·m/s².",
  limitsNote: "Applied force 0–200 N, mass 1–20 kg. Surface coefficients: ice 0.12, wood 0.5, concrete 0.9, rubber 1.1.",
  scene: "friction",
  duration: null,
  controls: [
    { key: "surface", label: "Surface type", type: "select", options: [ { v: "ice", l: "Ice (μs 0.12 / μk 0.05)" }, { v: "wood", l: "Wood (μs 0.50 / μk 0.30)" }, { v: "concrete", l: "Concrete (μs 0.90 / μk 0.60)" }, { v: "rubber", l: "Rubber (μs 1.10 / μk 0.80)" } ], def: "wood" },
    { key: "mass", label: "Object mass", min: 1, max: 20, step: 1, unit: "kg", def: 5 },
    { key: "force", label: "Applied force", min: 0, max: 200, step: 1, unit: "N", def: 80 }
  ],
  measures: [
    { key: "normal", label: "Normal force", unit: "N" },
    { key: "fmax", label: "Static friction max", unit: "N" },
    { key: "fk", label: "Kinetic friction", unit: "N" },
    { key: "fric", label: "Friction (acting)", unit: "N" },
    { key: "net", label: "Net force", unit: "N" },
    { key: "accel", label: "Acceleration", unit: "m/s²" }
  ],
  compute(s) {
    const mu = { ice: { s: 0.12, k: 0.05 }, wood: { s: 0.5, k: 0.3 }, concrete: { s: 0.9, k: 0.6 }, rubber: { s: 1.1, k: 0.8 } };
    const { surface, mass, force, t } = s;
    const normal = mass * GRAV;
    const fmax = mu[surface].s * normal;
    const fk = mu[surface].k * normal;
    const moving = force > fmax + 0.001;
    const fric = moving ? fk : Math.min(force, fmax);
    const net = moving ? force - fk : 0;
    const accel = net / mass;
    return {
      m: { normal, fmax, fk, fric, net, accel },
      scene: {
        mass, muS: mu[surface].s, muK: mu[surface].k, applied: force, friction: fric, net, accel, moving,
        pos: moving ? (accel * 0.5 * t * t) : 0, t
      }
    };
  },
  graph: {
    series(s, m) {
      return [{ points: sweep((f) => f <= m.fmax ? f : m.fk, 0, 200), color: "#ffb347" }];
    },
    xLabel: "Applied force (N)",
    yLabel: "Friction force (N)"
  },
  procedure: [
    "Select a surface and set the block mass.",
    "Increase the applied force in small steps.",
    "Watch the friction climb with the push (static region).",
    "Pass the static limit and observe the motion.",
    "Compare the maximum static friction with the kinetic value."
  ],
  observation: "The block does not move until the applied force exceeds μs·N. Once moving, kinetic friction is smaller, so the block accelerates.",
  conclusion: "Friction opposing motion is F_f = μN. Static friction is larger than kinetic friction, and both grow with the normal force.",
  explain: "Surface roughness and the squeeze between contact patches create friction. It is easier to keep something sliding than to start it sliding — that is why μk < μs.",
  uncertainty: "μ values depend on surface state; measure f_max three times and use the standard deviation as the uncertainty. Typical relative uncertainty 10–20 %.",
  runningHint: "Stay just below the static limit to see the block hold, then push past it to see it launch."
};

// ════════════════════════════════════════════════════════════════
// 08 · HOOKE'S LAW / SPRING
// ════════════════════════════════════════════════════════════════
const hooke = {
  id: "hooke",
  number: "08",
  title: "Hooke's Law / Spring",
  topic: "Elasticity",
  description: "Hang a mass on a spring and watch the extension change with the applied force.",
  objective: "Verify F = −kx and measure spring energy stored as ½kx².",
  theory: [
    "A spring exerts a restoring force proportional to its extension (or compression): F = −kx.",
    "The energy stored in the stretched spring is elastic potential energy ½kx²."
  ],
  formulas: [
    { text: "F = −kx", note: "restoring force (N)" },
    { text: "x = F/k", note: "extension (m)" },
    { text: "PE_spring = ½kx²", note: "stored energy (J)" }
  ],
  unitsNote: "k in N/m, x in metres, force in N, energy in joules (J).",
  limitsNote: "Spring constant 10–300 N/m (typical lab springs 20–200 N/m), added force 0–50 N, mass 0.5–5 kg.",
  scene: "spring",
  duration: null,
  controls: [
    { key: "k", label: "Spring constant", min: 10, max: 300, step: 5, unit: "N/m", def: 60 },
    { key: "mass", label: "Hanging mass", min: 0.5, max: 5, step: 0.1, unit: "kg", def: 1 },
    { key: "addF", label: "Extra applied force", min: 0, max: 50, step: 1, unit: "N", def: 0 }
  ],
  measures: [
    { key: "force", label: "Force on spring", unit: "N" },
    { key: "ext", label: "Extension", unit: "m" },
    { key: "k", label: "Spring constant", unit: "N/m" },
    { key: "pe", label: "Elastic PE", unit: "J" }
  ],
  compute(s) {
    const { k, mass, addF } = s;
    const force = mass * GRAV + addF;
    const ext = force / k;
    const pe = 0.5 * k * ext * ext;
    return {
      m: { force, ext, k, pe },
      scene: { k, mass, force, extension: ext }
    };
  },
  graph: {
    series(s, m) {
      return [{ points: sweep((f) => f / s.k, 0, m.force + 10, 20), color: "#42ff80" }];
    },
    xLabel: "Force (N)",
    yLabel: "Extension (m)"
  },
  procedure: [
    "Choose a spring constant and hang a mass.",
    "Note the extension produced by the weight.",
    "Add extra downward force and record new extensions.",
    "Plot force against extension and confirm it is linear.",
    "Find the gradient — it equals k."
  ],
  observation: "Force and extension increase together in a straight line; the graph passes through the origin (within spring limits).",
  conclusion: "Within its elastic limit a spring obeys F = kx, and the stored energy is ½kx².",
  explain: "A spring acts like millions of tiny coils tightening the more you pull. The restoring force grows linearly, which is why the plot is a straight line with slope k.",
  uncertainty: "Measure extension with a mm ruler (±0.5 mm). Hooke's law fails past the elastic limit — check for permanent stretch.",
  runningHint: "Watch extension x = F/k update instantly as you change the mass."
};

// ════════════════════════════════════════════════════════════════
// 09 · WORK, ENERGY AND POWER
// ════════════════════════════════════════════════════════════════
const workEnergy = {
  id: "workEnergy",
  number: "09",
  title: "Work, Energy and Power",
  topic: "Energy",
  description: "Push an object along a surface and track work, kinetic energy, potential energy and power.",
  objective: "Understand work as F·d·cosθ and how it changes kinetic and potential energy.",
  theory: [
    "Work is a transfer of energy: W = F·d·cosθ, where θ is the angle between force and displacement.",
    "Kinetic energy grows as the object speeds up; potential energy depends on height."
  ],
  formulas: [
    { text: "W = Fd cosθ", note: "work (J = N·m)" },
    { text: "KE = ½mv²", note: "kinetic energy (J)" },
    { text: "PE = mgh", note: "gravitational energy (J)" },
    { text: "P = W/t", note: "power (W = J/s)" }
  ],
  unitsNote: "Work & energy in joules (J), power in watts (W), force N, distance m, mass kg.",
  limitsNote: "Force 10–100 N, distance 1–50 m, height 0–10 m, time 1–20 s, angle 0–90°.",
  scene: "workEnergy",
  duration: null,
  controls: [
    { key: "mass", label: "Mass", min: 1, max: 10, step: 0.5, unit: "kg", def: 5 },
    { key: "force", label: "Applied force", min: 10, max: 100, step: 1, unit: "N", def: 40 },
    { key: "dist", label: "Displacement", min: 1, max: 50, step: 1, unit: "m", def: 20 },
    { key: "height", label: "Rise height", min: 0, max: 10, step: 0.5, unit: "m", def: 2 },
    { key: "time", label: "Time", min: 1, max: 20, step: 1, unit: "s", def: 5 },
    { key: "angle", label: "Angle (F vs d)", min: 0, max: 90, step: 1, unit: "°", def: 0 }
  ],
  measures: [
    { key: "work", label: "Work done", unit: "J" },
    { key: "ke", label: "Kinetic energy", unit: "J" },
    { key: "pe", label: "Potential energy", unit: "J" },
    { key: "total", label: "Total energy", unit: "J" },
    { key: "power", label: "Power", unit: "W" }
  ],
  compute(s) {
    const { mass, force, dist, height, time, angle, t } = s;
    const work = force * dist * Math.cos(angle * D2R);
    const ke = work; // work-energy theorem on a level track
    const pe = mass * GRAV * height;
    const total = ke + pe;
    const power = work / Math.max(time, 0.1);
    const a = (force * Math.cos(angle * D2R)) / mass;
    return {
      m: { work, ke, pe, total, power },
      scene: { mass, force, angle, pos: Math.min(dist, a * t) * 4, ke, pe, total, work, power, t }
    };
  },
  graph: {
    series(s, lv) {
      const { mass, force, angle, dist } = s;
      const a = (force * Math.cos(angle * D2R)) / mass;
      const keCurve = sweep((tt) => (a > 0 ? 0.5 * mass * (a * tt) * (a * tt) : force * dist * (tt / 6)), 0, 6, 20);
      return [
        { points: keCurve, color: "#ff4fd8", label: "KE" },
        { points: sweep(() => lv.pe, 0, 6, 20), color: "#00ffd5", label: "PE" },
        { points: sweep((tt) => (a > 0 ? 0.5 * mass * (a * tt) * (a * tt) : force * dist * (tt / 6)) + lv.pe, 0, 6, 20), color: "#fff06a", label: "Total" }
      ];
    },
    xLabel: "Time (s)",
    yLabel: "Energy (J)"
  },
  procedure: [
    "Set mass, force, displacement and the angle between them.",
    "Watch how the angle reduces useful work to zero at 90°.",
    "Run the simulation and record work, KE, PE and power.",
    "Change the height and watch PE grow with mgh.",
    "Verify P = W/t gives the same power you measured."
  ],
  observation: "Only the component of force along the motion does work; at 90° no work is done. Height raises PE by mgh.",
  conclusion: "Work = Fd cosθ transfers energy between kinetic and potential form; power is the rate of doing work.",
  explain: "If you push a lawnmower at an angle, only the horizontal push does useful work — the vertical part just presses down.",
  uncertainty: "Using a spring balance (±0.5 N) and metre tape (±1 cm): ΔW/W = ΔF/F + Δd/d. Report W ± propagated error.",
  runningHint: "Watch the KE bar fill as the block accelerates."
};

// ════════════════════════════════════════════════════════════════
// 10 · CONSERVATION OF MECHANICAL ENERGY
// ════════════════════════════════════════════════════════════════
const conservation = {
  id: "conservation",
  number: "10",
  title: "Conservation of Mechanical Energy",
  topic: "Energy",
  description: "Roll a ball down a smooth track and watch potential energy turn into kinetic energy.",
  objective: "Demonstrate that KE + PE stays constant for a frictionless system.",
  theory: [
    "As the ball loses height, gravitational potential energy mgh converts into kinetic energy ½mv².",
    "With friction switched ON, some energy is lost to heat so the total decreases."
  ],
  formulas: [
    { text: "E = KE + PE", note: "mechanical energy (J)" },
    { text: "PE = mgh,  KE = ½mv²", note: "components (J)" },
    { text: "v = √(2g·Δh)", note: "speed from height loss (m/s)" }
  ],
  unitsNote: "Energy in joules (J), height in m, velocity m/s, mass kg, g m/s².",
  limitsNote: "Start height 0.5–10 m. On a 45° frictionless ramp, time to the bottom is 2·√(h/g).",
  scene: "energyTrack",
  getDuration({ h0, g }) {
    return 2 * Math.sqrt(Math.max(h0, 0.1) / Math.max(g, 0.1)) * 1.02;
  },
  controls: [
    { key: "h0", label: "Starting height", min: 0.5, max: 10, step: 0.1, unit: "m", def: 5 },
    { key: "mass", label: "Ball mass", min: 0.5, max: 5, step: 0.1, unit: "kg", def: 1 },
    { key: "g", label: "Gravity", min: 1.6, max: 15, step: 0.1, unit: "m/s²", def: 9.8 },
    { key: "friction", label: "Friction", type: "toggle", def: false }
  ],
  measures: [
    { key: "pe", label: "Potential energy", unit: "J" },
    { key: "ke", label: "Kinetic energy", unit: "J" },
    { key: "total", label: "Total energy", unit: "J" },
    { key: "v", label: "Velocity", unit: "m/s" },
    { key: "h", label: "Height", unit: "m" }
  ],
  compute(s) {
    const { h0, mass, g, friction } = s;
    const dur = 2 * Math.sqrt(Math.max(h0, 0.1) / Math.max(g, 0.1)) * 1.02;
    const frac = Math.min(1, s.t / dur);
    const h = h0 * (1 - frac);
    const v = Math.sqrt(Math.max(0, 2 * g * (h0 - h)));
    const ke = 0.5 * mass * v * v;
    const pe = mass * g * h;
    let total = pe + ke;
    if (friction) total *= Math.max(0.25, 1 - 0.35 * frac);
    const keAdj = Math.max(0, total - pe);
    return {
      m: { pe, ke: friction ? keAdj : ke, total, v, h },
      scene: { h0, progress: frac, hm: h, pe, ke: friction ? keAdj : ke, total, frictionOn: friction, g },
      duration: dur
    };
  },
  graph: {
    series(s, m) {
      const { h0, mass, g } = s;
      const T = 2 * Math.sqrt(h0 / g);
      return [
        { points: sweep((tt) => mass * g * Math.max(0, h0 - 0.5 * g * tt * tt), 0, T, 30), color: "#00ffd5", label: "PE" },
        { points: sweep((tt) => 0.5 * mass * (g * tt) * (g * tt), 0, T, 30), color: "#ff4fd8", label: "KE" }
      ];
    },
    xLabel: "Time (s)",
    yLabel: "Energy (J)"
  },
  procedure: [
    "Raise the ball to a starting height.",
    "Watch PE fall as KE rises along the ramp.",
    "Note that PE + KE stays flat when friction is off.",
    "Switch friction ON and watch the total energy drop.",
    "Read the speed at the bottom and check v = √(2gh)."
  ],
  observation: "Loss of height is always matched by a gain in speed. Total (KE + PE) is constant without friction and declines gently with friction.",
  conclusion: "In a closed frictionless system mechanical energy is conserved: KE + PE = constant.",
  explain: "Energy changes its costume — from the 'height costume' (PE) to the 'speed costume' (KE) — but its total amount stays the same unless friction steals a little as heat.",
  uncertainty: "Rotational kinetic energy is ignored here (ball without rolling). A real rolling ball stores ~2/7 of its KE in rotation.",
  runningHint: "Watch the two energy bars swap values while their sum stays level."
};

// ════════════════════════════════════════════════════════════════
// 11 · COLLISION / MOMENTUM
// ════════════════════════════════════════════════════════════════
const collision = {
  id: "collision",
  number: "11",
  title: "Collision and Momentum",
  topic: "Momentum",
  description: "Fire one cart into another and compare momentum and velocity before and after the hit.",
  objective: "Verify conservation of momentum for elastic and inelastic collisions.",
  theory: [
    "Momentum p = mv is always conserved in an isolated collision.",
    "Elastic collisions also conserve kinetic energy; inelastic collisions lose KE to deformation and heat."
  ],
  formulas: [
    { text: "p = mv", note: "momentum (kg·m/s)" },
    { text: "m1v1 + m2v2 = m1v1' + m2v2'", note: "conservation" },
    { text: "v' = (m1v1 + m2v2)/(m1+m2)", note: "perfectly inelastic speed (m/s)" }
  ],
  unitsNote: "Mass kg, velocity m/s, momentum kg·m/s, energy J.",
  limitsNote: "Carts 1–10 kg, speeds 1–10 m/s (typical track-cart values).",
  scene: "collision",
  controls: [
    { key: "m1", label: "Mass cart 1", min: 1, max: 10, step: 0.5, unit: "kg", def: 3 },
    { key: "m2", label: "Mass cart 2", min: 1, max: 10, step: 0.5, unit: "kg", def: 2 },
    { key: "v1", label: "Initial speed cart 1", min: 1, max: 10, step: 0.5, unit: "m/s", def: 5 },
    { key: "v2", label: "Initial speed cart 2", min: 0, max: 5, step: 0.5, unit: "m/s", def: 0 },
    { key: "type", label: "Collision type", type: "segmented", options: [{ v: "elastic", l: "Elastic" }, { v: "inelastic", l: "Inelastic" }], def: "elastic" }
  ],
  measures: [
    { key: "p1i", label: "Momentum cart 1 before", unit: "kg·m/s" },
    { key: "pTot_b", label: "Momentum before (total)", unit: "kg·m/s" },
    { key: "v1p", label: "V1 after", unit: "m/s" },
    { key: "v2p", label: "V2 after", unit: "m/s" },
    { key: "pTot_a", label: "Momentum after (total)", unit: "kg·m/s" },
    { key: "keLoss", label: "KE lost", unit: "J" }
  ],
  compute(s) {
    const { m1, m2, v1, v2, type, t } = s;
    const p = m1 * v1 + m2 * v2;
    let v1p, v2p;
    if (type === "elastic") {
      v1p = ((m1 - m2) * v1 + 2 * m2 * v2) / (m1 + m2);
      v2p = ((m2 - m1) * v2 + 2 * m1 * v1) / (m1 + m2);
    } else {
      v1p = v2p = p / (m1 + m2);
    }
    const pA = m1 * v1p + m2 * v2p;
    const keB = 0.5 * m1 * v1 * v1 + 0.5 * m2 * v2 * v2;
    const keA = 0.5 * m1 * v1p * v1p + 0.5 * m2 * v2p * v2p;
    const gap = 5 * (W_UNIT_COLLIDE); // world gap in scene units
    const approxUnits = 5; // px-per-unit applied in scene
    void gap; void approxUnits;
    const rel = Math.max(0.01, v1 - v2);
    const tcol = 5 / rel;
    let u1, u2;
    if (t < tcol) {
      u1 = 0.55 + v1 * t;
      u2 = 5.55 + v2 * t;
    } else {
      u1 = 0.55 + v1 * tcol + v1p * (t - tcol);
      u2 = 5.55 + v2 * tcol + v2p * (t - tcol);
    }
    const impact = t < tcol + 0.25 && t >= tcol ? clamp(1 - (t - tcol) / 0.25, 0, 1) : 0;
    return {
      m: { p1i: m1 * v1, pTot_b: p, v1p, v2p, pTot_a: pA, keLoss: keB - keA },
      scene: { u1, u2, m1, m2, v1, v2, v1p, v2p, impact, type, px: p, py: pA },
      duration: tcol + 2.5
    };
  },
  graph: {
    series(s, m) {
      const { m1, m2, v1, v2, type } = s;
      const tp = 5 / Math.max(0.01, v1 - v2);
      return [
        { points: sweep((tt) => tt < tp ? v1 : m.v1p, 0, tp + 1.5, 40), color: "#7b9cff", label: "v1" },
        { points: sweep((tt) => tt < tp ? v2 : m.v2p, 0, tp + 1.5, 40), color: "#ff8fa3", label: "v2" }
      ];
    },
    xLabel: "Time (s)",
    yLabel: "Velocity (m/s)"
  },
  procedure: [
    "Set both cart masses and the striker's speed.",
    "Predict what happens to each cart after the hit.",
    "Run and record each cart's velocity before and after.",
    "Compute momentum before and after — compare.",
    "Switch to an inelastic collision and check the KE loss."
  ],
  observation: "Total momentum before equals total momentum after in every collision, but kinetic energy is only conserved when the collision is elastic.",
  conclusion: "Momentum (mv) is conserved in all collisions; kinetic energy is conserved only in elastic ones.",
  explain: "Imagine two skaters colliding. Their total 'oomph' (momentum) can't disappear — it just gets redistributed. In a sticky collision some oomph turns into heat and sound.",
  uncertainty: "Track-cart velocity uncertainties of ±0.02 m/s (photogates). Propagate: Δp = m·Δv + v·Δm.",
  runningHint: "Watch momentum before/after — they match exactly in both modes."
};

const W_UNIT_COLLIDE = 1;

// ════════════════════════════════════════════════════════════════
// 12 · CENTRIPETAL FORCE
// ════════════════════════════════════════════════════════════════
const centripetal = {
  id: "centripetal",
  number: "12",
  title: "Centripetal Force",
  topic: "Circular Motion",
  description: "Spin a mass on a circular track and inspect the inward force that keeps it turning.",
  objective: "Understand why circular motion needs a net inward force Fc = mv²/r.",
  theory: [
    "An object moving in a circle constantly changes direction, so it must accelerate inwards.",
    "That inward acceleration a = v²/r requires an inward force given by Fc = mv²/r = mrω²."
  ],
  formulas: [
    { text: "Fc = mv²/r", note: "centripetal force (N)" },
    { text: "Fc = mrω²", note: "in terms of angular speed (N)" },
    { text: "ω = v/r,  T = 2πr/v", note: "angular speed (rad/s), period (s)" }
  ],
  unitsNote: "Force N, mass kg, speed m/s, radius m, ω rad/s, ac m/s².",
  limitsNote: "Speed 1–30 m/s, radius 1–20 m, mass 0.1–5 kg. Real sting/whirligig setups use r ≈ 0.5–2 m.",
  scene: "centripetal",
  duration: null,
  controls: [
    { key: "mass", label: "Mass", min: 0.1, max: 5, step: 0.1, unit: "kg", def: 1 },
    { key: "vel", label: "Speed", min: 1, max: 30, step: 1, unit: "m/s", def: 12 },
    { key: "radius", label: "Radius", min: 1, max: 20, step: 0.5, unit: "m", def: 5 }
  ],
  measures: [
    { key: "fc", label: "Centripetal force", unit: "N" },
    { key: "acc", label: "Centripetal accel", unit: "m/s²" },
    { key: "omega", label: "Angular speed", unit: "rad/s" },
    { key: "period", label: "Period", unit: "s" },
    { key: "vel", label: "Speed", unit: "m/s" },
    { key: "radius", label: "Radius", unit: "m" }
  ],
  compute(s) {
    const { mass, vel, radius, t } = s;
    const fc = mass * vel * vel / radius;
    const acc = vel * vel / radius;
    const omega = vel / radius;
    const period = (2 * Math.PI * radius) / vel;
    const theta = omega * t;
    return {
      m: { fc, acc, omega, period, vel, radius },
      scene: { theta, fc, omega, period, mass, vel, radius }
    };
  },
  graph: {
    series(s, m) {
      return [{ points: sweep((vv) => s.mass * vv * vv / s.radius, 1, 30, 30), color: "#ff5aa9" }];
    },
    xLabel: "Speed (m/s)",
    yLabel: "Centripetal force (N)"
  },
  procedure: [
    "Choose a mass, speed and radius.",
    "Watch the inward force and the velocity arrow.",
    "Increase the speed — note how Fc grows with v².",
    "Increase the radius — see Fc shrink.",
    "Check Fc = mrω² gives the same number."
  ],
  observation: "Doubling the speed quadruples the centripetal force; increasing the radius reduces it.",
  conclusion: "Circular motion requires a force pointing toward the centre equal to mv²/r, growing with the square of speed.",
  explain: "Change is what needs force, not just movement. Turning counts as change, and the harder you turn, the more inward pull you need — like yanking a ball on a string.",
  uncertainty: "Timing 10 revolutions with ±0.1 s gives a 1 % speed error which squares into a 2 % force error.",
  runningHint: "Speed up and watch the inward pull skyrocket (v² effect)."
};

// ════════════════════════════════════════════════════════════════
// 13 · WAVES ON A STRING
// ════════════════════════════════════════════════════════════════
const waveString = {
  id: "waveString",
  number: "13",
  title: "Waves on a String",
  topic: "Waves",
  description: "Drive a travelling wave down a taut string and measure frequency, wavelength and speed.",
  objective: "Relate wave speed, frequency and wavelength through v = fλ.",
  theory: [
    "A mechanical wave transports energy without transporting matter: points on the string oscillate as the pattern travels.",
    "The wave speed on a string under tension T with linear density μ is v = √(T/μ)."
  ],
  formulas: [
    { text: "v = fλ", note: "wave equation (m/s = Hz·m)" },
    { text: "v = √(T/μ)", note: "speed on string (m/s)" },
    { text: "y(x,t) = A sin(kx − ωt)", note: "displacement (m), k=2π/λ, ω=2πf" }
  ],
  unitsNote: "Frequency Hz, wavelength m, speed m/s, amplitude m, tension N, μ kg/m.",
  limitsNote: "Tension 10–200 N, linear density 0.005–0.02 kg/m, freq 1–10 Hz, amplitude 0.1–1 m.",
  scene: "wave",
  duration: null,
  controls: [
    { key: "freq", label: "Frequency", min: 1, max: 10, step: 0.1, unit: "Hz", def: 2 },
    { key: "amp", label: "Amplitude", min: 0.1, max: 1, step: 0.05, unit: "m", def: 0.6 },
    { key: "tension", label: "Tension", min: 10, max: 200, step: 5, unit: "N", def: 90 },
    { key: "mu", label: "Linear density (μ)", min: 0.005, max: 0.02, step: 0.005, unit: "kg/m", def: 0.01 }
  ],
  measures: [
    { key: "speed", label: "Wave speed", unit: "m/s" },
    { key: "lambda", label: "Wavelength", unit: "m" },
    { key: "freq", label: "Frequency", unit: "Hz" },
    { key: "amp", label: "Amplitude", unit: "m" },
    { key: "period", label: "Period", unit: "s" }
  ],
  compute(s) {
    const { freq, amp, tension, mu, t } = s;
    const speed = Math.sqrt(tension / mu);
    const lambda = speed / Math.max(freq, 0.001);
    const period = 1 / Math.max(freq, 0.001);
    const phase = 2 * Math.PI * freq * t;
    return {
      m: { speed, lambda, freq, amp, period },
      scene: { freq, amp, lambda, speed, k: 2 * Math.PI / lambda, phase, mu, tension }
    };
  },
  graph: {
    series(s, m) {
      const N = 60;
      const pts = [];
      for (let i = 0; i <= N; i++) {
        const x = (i / N) * 10;
        pts.push({ x, y: s.amp * Math.sin(m.k * x + m.phase) });
      }
      return [{ points: pts, color: "#00ffd5" }];
    },
    xLabel: "Position (m)",
    yLabel: "Displacement (m)"
  },
  procedure: [
    "Set frequency, amplitude and tension.",
    "Watch the crests march across the screen.",
    "Read the wavelength auto-computed from v = fλ.",
    "Raise the tension and see the wavelength grow.",
    "Check that doubling frequency halves wavelength."
  ],
  observation: "Raising tension speeds the wave up and stretches the wavelength; raising frequency packs more waves into the same distance.",
  conclusion: "Wave speed equals frequency times wavelength: v = fλ. On a string, speed is set by tension and density, not by frequency.",
  explain: "The string's tension and weight decide how fast a 'pulse' can run along it. The frequency decides how many wiggles squeeze into each metre.",
  uncertainty: "Measuring wavelength from a snapshot ruler has about ±0.05 m. Then Δv/v = Δf/f + Δλ/λ.",
  runningHint: "Crank the tension and watch crests spread apart."
};

// ════════════════════════════════════════════════════════════════
// 14 · SOUND WAVE
// ════════════════════════════════════════════════════════════════
const soundWave = {
  id: "soundWave",
  number: "14",
  title: "Sound Wave",
  topic: "Waves & Acoustics",
  description: "Watch air particles compress and spread as a sound wave travels, and (optionally) hear the tone.",
  objective: "Connect hearing to physics: frequency = pitch, wavelength and speed depend on the medium.",
  theory: [
    "Sound is a longitudinal wave: particles oscillate parallel to the direction of travel.",
    "The speed of sound changes with the medium — faster in stiffer, denser material (steel ~5000 m/s), slowest in air."
  ],
  formulas: [
    { text: "v = fλ", note: "sound speed (m/s)" },
    { text: "f = 1/T", note: "frequency (Hz)" },
    { text: "λ = v/f", note: "wavelength (m)" }
  ],
  unitsNote: "f in Hz, λ in m, v in m/s, amplitude dimensionless (pressure variation).",
  limitsNote: "Frequency 20–2000 Hz (audible range). Air 343 m/s, water 1480 m/s, steel 5000 m/s.",
  scene: "soundWave",
  duration: null,
  audio: true,
  controls: [
    { key: "f", label: "Frequency", min: 20, max: 2000, step: 10, unit: "Hz", def: 440 },
    { key: "amp", label: "Amplitude (loudness)", min: 0.1, max: 1, step: 0.05, unit: "", def: 0.7 },
    { key: "medium", label: "Medium", type: "select", options: [{ v: "air", l: "Air (343 m/s)" }, { v: "water", l: "Water (1480 m/s)" }, { v: "steel", l: "Steel (5000 m/s)" }], def: "air" }
  ],
  measures: [
    { key: "f", label: "Frequency", unit: "Hz" },
    { key: "lambda", label: "Wavelength", unit: "m" },
    { key: "speed", label: "Wave speed", unit: "m/s" },
    { key: "amp", label: "Amplitude", unit: "" },
    { key: "period", label: "Period", unit: "ms" }
  ],
  compute(s) {
    const { f, amp, medium, t } = s;
    const vel = { air: 343, water: 1480, steel: 5000 }[medium];
    const lambda = vel / f;
    const phase = 2 * Math.PI * f * t;
    return {
      m: { f, lambda, speed: vel, amp, period: 1000 / f },
      scene: { freq: f, amp, lambda, speed: vel, k: 2 * Math.PI / lambda, phase, medium }
    };
  },
  graph: {
    series(s, m) {
      const N = 60;
      const pts = [];
      for (let i = 0; i <= N; i++) {
        const x = (i / N) * 10;
        pts.push({ x, y: s.amp * Math.sin(m.k * x + m.phase) });
      }
      return [{ points: pts, color: "#fff06a" }];
    },
    xLabel: "Position (m)",
    yLabel: "Displacement"
  },
  procedure: [
    "Pick a frequency (try 440 Hz — concert A).",
    "Press Play Tone to hear it while watching the compressions.",
    "Switch the medium and watch the wavelength change.",
    "Raise the frequency — wavelength shrinks.",
    "Estimate λ from the picture, then check λ = v/f."
  ],
  observation: "High frequency gives tightly packed compressions and a high pitch; a stiffer medium lengthens the wave at the same frequency.",
  conclusion: "Sound travels as compressions; v = fλ holds, and the medium fixes the speed.",
  explain: "Sound is molecules bumping into each other like a crowd doing 'the wave'. In steel the molecules are neighbourly, so news travels fast; in air they're spaced out, so it crawls.",
  uncertainty: "Wavelength read from the screen is approximate (±0.1 m). Real microphones sample pressure ±0.5 % FS.",
  runningHint: "Put it on Air + 440 Hz and press 🔊 Play Tone to hear what you see."
};

// ════════════════════════════════════════════════════════════════
// 17 · LENS EXPERIMENT
// ════════════════════════════════════════════════════════════════
const lensExperiment = {
  id: "lensExperiment",
  number: "17",
  title: "Lens Experiment",
  topic: "Optics",
  description: "Place an object before a converging or diverging lens and trace where the image forms.",
  objective: "Use the lens equation 1/f = 1/u + 1/v and magnification M = v/u.",
  theory: [
    "A converging lens bends parallel rays to a focus. Light from the object point recombines to form an image.",
    "Real inverted images form when the object is beyond the focus; virtual upright images form when it is inside."
  ],
  formulas: [
    { text: "1/f = 1/u + 1/v", note: "lens equation (cm⁻¹)" },
    { text: "M = v/u = hi/ho", note: "magnification" }
  ],
  unitsNote: "Distances in cm, focal length cm, magnification dimensionless.",
  limitsNote: "Focal length 2–15 cm, object distance 3–30 cm (typical bench).",
  scene: "lens",
  duration: null,
  controls: [
    { key: "type", label: "Lens type", type: "segmented", options: [{ v: "convex", l: "Converging" }, { v: "concave", l: "Diverging" }], def: "convex" },
    { key: "f", label: "Focal length", min: 2, max: 15, step: 0.5, unit: "cm", def: 8 },
    { key: "u", label: "Object distance", min: 3, max: 30, step: 0.5, unit: "cm", def: 14 }
  ],
  measures: [
    { key: "v", label: "Image distance", unit: "cm" },
    { key: "mag", label: "Magnification", unit: "" },
    { key: "hi", label: "Image height (1 cm obj)", unit: "cm" },
    { key: "nature", label: "Image nature", unit: "" }
  ],
  compute(s) {
    const { type, f, u } = s;
    let v, mag;
    if (type === "convex") {
      if (Math.abs(u - f) < 0.01) {
        v = u > f ? 200 : -200;
        mag = Math.abs(v / u);
      } else {
        v = (u * f) / (u - f);
        mag = v / u;
      }
      const nature = v > 0 ? "real · inverted" : "virtual · upright";
      return {
        m: { v, mag, hi: Math.abs(mag) * 1, nature },
        scene: { type, f, u, v: Math.sign(v) * Math.min(24, Math.abs(v)), mag, nature, imageHeightPx: Math.abs(mag), objH: 30 }
      };
    }
    v = (u * f) / (u + f); // diverging always virtual
    mag = v / u;
    return {
      m: { v: -Math.abs(v), mag: Math.abs(mag), hi: Math.abs(mag) * 1, nature: "virtual · upright · smaller" },
      scene: { type, f, u, v: -Math.min(24, Math.abs(v)), mag: -Math.abs(mag), nature: "virtual", objH: 30 }
    };
  },
  graph: {
    series(s, m) {
      const { f } = s;
      return [{
        points: sweep((u) => (Math.abs(u - f) < 0.1 ? 0 : (u * f) / (u - f)), 3, 30, 30),
        color: "#ff5aa9"
      }];
    },
    xLabel: "Object distance (cm)",
    yLabel: "Image distance (cm)"
  },
  procedure: [
    "Choose a lens type and focal length.",
    "Place the object beyond 2f and inspect the image.",
    "Slide the object between f and 2f.",
    "Move it inside f and see the virtual image switch.",
    "Verify 1/f = 1/u + 1/v with the displayed numbers."
  ],
  observation: "Beyond 2f the image is real, inverted and smaller; between f and 2f it is larger; inside f it becomes upright.",
  conclusion: "The lens equation predicts image location; magnification M = v/u works in every case.",
  explain: "The lens redirects every ray so they re-meet where a sharp picture forms. Inside the focus, your eye does the converging instead — so the image looks behind the lens.",
  uncertainty: "Locating the sharpest image is subjective, typically ±0.5 cm. Propagate into f via the lens equation error formula.",
  runningHint: "Drag the object past the focus to flip the image upside down."
};

// ════════════════════════════════════════════════════════════════
// 18 · ELECTROMAGNETIC INDUCTION
// ════════════════════════════════════════════════════════════════
const induction = {
  id: "induction",
  number: "18",
  title: "Electromagnetic Induction",
  topic: "Electromagnetism",
  description: "Push a magnet through a coil and read the induced voltage on the galvanometer.",
  objective: "Show that a changing magnetic flux induces an EMF ε = −N·ΔΦ/Δt.",
  theory: [
    "Only a changing magnetic flux through a coil induces a voltage — holding the magnet still produces nothing.",
    "The size of the induced EMF grows with magnet speed, the number of turns and the field strength."
  ],
  formulas: [
    { text: "ε = −N·ΔΦ/Δt", note: "Faraday's law (V)" },
    { text: "Φ = BAcosθ", note: "flux (Wb)" },
    { text: "V_Lenz: ε opposes ΔΦ", note: "sign rule (V)" }
  ],
  unitsNote: "ε in volts (V), flux in webers (Wb), current in A, speed m/s.",
  limitsNote: "Turns 10–100, magnet speed 0.2–2 m/s, field 0.1–1 T. A dynamic mic produces ~2 mV for comparison.",
  scene: "induction",
  duration: null,
  controls: [
    { key: "speedx", label: "Magnet speed", min: 0.2, max: 2, step: 0.1, unit: "m/s", def: 1 },
    { key: "turns", label: "Coil turns", min: 10, max: 100, step: 5, unit: "", def: 50 },
    { key: "b", label: "Field strength", min: 0.1, max: 1, step: 0.05, unit: "T", def: 0.5 }
  ],
  measures: [
    { key: "flux", label: "Magnetic flux", unit: "Wb" },
    { key: "epsilon", label: "Induced EMF", unit: "V" },
    { key: "current", label: "Induced current", unit: "A" },
    { key: "turns", label: "Coil turns", unit: "" },
    { key: "speedx", label: "Magnet speed", unit: "m/s" }
  ],
  compute(s) {
    const { speedx, turns, b, t } = s;
    const omega = (2 * Math.PI * speedx) / 4; // magnet swings through ±2 m
    const phase = omega * t;
    const A = 0.002; // coil area m²
    const flux = b * A * Math.exp(-Math.pow(Math.sin(phase), 2) / 0.06);
    const dFlux_dt = -flux * (-(2 * Math.sin(phase) * Math.cos(phase)) / 0.06) * omega;
    const epsilon = -turns * dFlux_dt;
    const R = 0.5;
    const current = epsilon / R;
    return {
      m: { flux, epsilon, current, turns, speedx },
      scene: { rel: Math.sin(phase), flux, epsilon, current, turns, speedx, fluxFrac: clamp(flux / (b * A * 2), 0, 1) }
    };
  },
  graph: {
    series(s, m) {
      const { speedx, turns, b } = s;
      return [{
        points: sweep((tt) => {
          const om = (2 * Math.PI * speedx) / 4;
          const ph = om * tt;
          const fl = b * 0.002 * Math.exp(-Math.pow(Math.sin(ph), 2) / 0.06);
          const dp = -fl * (-(2 * Math.sin(ph) * Math.cos(ph)) / 0.06) * om;
          return -turns * dp;
        }, 0, 4, 60),
        color: "#ff5aa9"
      }];
    },
    xLabel: "Time (s)",
    yLabel: "Induced EMF (V)"
  },
  procedure: [
    "Set the magnet speed, coil turns and field strength.",
    "Watch the magnet slide through the coil.",
    "Read the galvanometer swing and induced EMF.",
    "Slow the magnet down — the EMF collapses.",
    "Double the turns and see the EMF double."
  ],
  observation: "The EMF is largest when the magnet is entering and leaving the coil; the flux peaks when it is centred. Faster magnets make bigger spikes.",
  conclusion: "Induced EMF is proportional to the rate of change of flux: ε = −N·ΔΦ/Δt.",
  explain: "Magnetism is greedy about sharing. When you force flux to change, the coil pushes back with a voltage that tries to stop the change — that push is your electric power.",
  uncertainty: "DMM sampling capture ±1 ms can miss the sharp EMF peak — use a scope averaging ≥4 sweeps.",
  runningHint: "Speed matters more than field — EMF is all about how fast flux changes."
};

// ════════════════════════════════════════════════════════════════
// 19 · MAGNETIC FORCE ON A MOVING CHARGE
// ════════════════════════════════════════════════════════════════
const magneticForce = {
  id: "magneticForce",
  number: "19",
  title: "Magnetic Force on a Charge",
  topic: "Electromagnetism",
  description: "Fire a charged particle into a uniform magnetic field and watch it bend into a circular path.",
  objective: "Use F = qvB sinθ and the resulting circular motion of a charge in a field.",
  theory: [
    "A magnetic field only pushes moving charges, and always perpendicular to the velocity — so it changes direction, never speed.",
    "That constant sideways push makes the path a circle of radius r = mv/(qB)."
  ],
  formulas: [
    { text: "F = qvB sinθ", note: "magnetic force (N)" },
    { text: "r = mv/(qB)", note: "cyclotron radius (m)" },
    { text: "θ = angle(v,B)", note: "dependence (degrees)" }
  ],
  unitsNote: "q in coulombs (C), B in teslas (T), v in m/s, F in N, r in m.",
  limitsNote: "Charge 1–10 nC, speed 100–1000 m/s, B 1–50 mT. A classroom CRT deflects ~0.5 cm with B ≈ 1 mT.",
  scene: "magneticForce",
  duration: null,
  controls: [
    { key: "q", label: "Charge", min: 1, max: 10, step: 0.5, unit: "nC", def: 5 },
    { key: "vel", label: "Velocity", min: 100, max: 1000, step: 50, unit: "m/s", def: 500 },
    { key: "b", label: "Magnetic field", min: 1, max: 50, step: 1, unit: "mT", def: 20 },
    { key: "ang", label: "Angle (v vs B)", min: 30, max: 90, step: 1, unit: "°", def: 90 }
  ],
  measures: [
    { key: "force", label: "Magnetic force", unit: "nN" },
    { key: "radius", label: "Orbit radius", unit: "m" },
    { key: "omega", label: "Angular speed", unit: "rad/s" },
    { key: "period", label: "Cyclotron period", unit: "µs" }
  ],
  compute(s) {
    const { q, vel, b, ang, t } = s;
    const qC = q * 1e-9;
    const bT = b * 1e-3;
    const force = qC * vel * bT * Math.sin(ang * D2R);
    const radius = (vel) / ( (qC / 1) * bT ) * (1);
    // r = mv/(qB); use m = 9.1e-31 kg electron-like
    const mass = 9.1e-31;
    const rActual = (mass * vel) / (qC * bT);
    const omega = (qC * bT) / mass;
    const periodS = (2 * Math.PI * mass) / (qC * bT);
    const theta = omega * t;
    return {
      m: { force: force * 1e9, radius: rActual, omega, period: periodS * 1e6 },
      scene: { theta, v: vel, force: force * 1e9, radius: rActual, q, b: bT, ang }
    };
  },
  graph: {
    series(s, m) {
      const { q, vel, b } = s;
      return [{
        points: sweep((ang) => q * 1e-9 * vel * b * 1e-3 * Math.sin(ang * D2R) * 1e9, 30, 90, 30),
        color: "#ff5aa9"
      }];
    },
    xLabel: "Angle (v vs B) (°)",
    yLabel: "Magnetic force (nN)"
  },
  procedure: [
    "Set charge, speed and field.",
    "Watch the particle curl into a circle.",
    "Increase B — the loop tightens.",
    "Increase v — the loop widens.",
    "Tilt the angle below 90° to see a helix-like opening."
  ],
  observation: "Larger fields and charges tighten the loop; higher speeds open it up. The force is always perpendicular to the velocity.",
  conclusion: "Magnetic fields push moving charges sideways: F = qvB sinθ, curving the path into a circle of radius r = mv/(qB).",
  explain: "The field pushes sideways — never forward — so the particle can't speed up, only turn. Push a toy car from the side and it turns instead of accelerating.",
  uncertainty: "Radius from a track photograph is typically ±1 mm; then ΔB/B = Δr/r + Δv/v.",
  runningHint: "Crank the field strength to tighten the spiral visibly."
};

// ════════════════════════════════════════════════════════════════
// 20 · RC CIRCUIT / CAPACITOR CHARGING
// ════════════════════════════════════════════════════════════════
const rcCircuit = {
  id: "rcCircuit",
  number: "20",
  title: "RC Circuit — Capacitor Charging",
  topic: "Electricity",
  description: "Watch a capacitor fill and empty through a resistor, following the classic exponential curves.",
  objective: "Understand the time constant τ = RC and the formulas for charging and discharging.",
  theory: [
    "A capacitor charges towards the battery voltage exponentially; the time constant τ = RC sets how quickly.",
    "After one time constant the voltage reaches 63 % of the final value; after 5τ it is essentially full."
  ],
  formulas: [
    { text: "V(t) = V₀(1 − e^(−t/RC))", note: "charging voltage (V)" },
    { text: "V(t) = V₀ e^(−t/RC)", note: "discharging (V)" },
    { text: "Q = CV", note: "charge (C)" },
    { text: "I = V/R · e^(−t/RC)", note: "current (A)" }
  ],
  unitsNote: "Voltage V, resistance Ω, capacitance F, current A, charge C, τ = R·C in seconds.",
  limitsNote: "R 100–10 000 Ω, C 10–1000 µF, battery 1–24 V (typical lab capacitor ~100 µF).",
  scene: "rcCircuit",
  controls: [
    { key: "r", label: "Resistance", min: 100, max: 10000, step: 100, unit: "Ω", def: 1000 },
    { key: "c", label: "Capacitance", min: 10, max: 1000, step: 10, unit: "µF", def: 220 },
    { key: "v0", label: "Battery voltage", min: 1, max: 24, step: 1, unit: "V", def: 12 },
    { key: "mode", label: "Mode", type: "segmented", options: [{ v: "charge", l: "Charge" }, { v: "discharge", l: "Discharge" }], def: "charge" }
  ],
  measures: [
    { key: "vc", label: "Capacitor voltage", unit: "V" },
    { key: "i", label: "Current", unit: "mA" },
    { key: "q", label: "Charge", unit: "µC" },
    { key: "tau", label: "Time constant", unit: "s" }
  ],
  compute(s) {
    const { r, c, v0, mode, t } = s;
    const C = c * 1e-6;
    const tau = r * C;
    const t5 = 5 * tau;
    const isCharge = mode === "charge";
    const vc = isCharge ? v0 * (1 - Math.exp(-t / tau)) : v0 * Math.exp(-t / tau);
    const i = isCharge ? (v0 / r) * Math.exp(-t / tau) : -(v0 / r) * Math.exp(-t / tau);
    const q = C * Math.max(0, vc);
    return {
      m: { vc, i: i * 1e3, q: q * 1e6, tau },
      scene: { v0, vc, i: i * 1e3, tau, q: q * 1e6, mode, currFrac: Math.min(1, t / (isCharge ? tau * 5 : Math.max(tau * 0.5, 0.01))) },
      duration: isCharge ? t5 * 1.1 : tau * 6
    };
  },
  graph: {
    series(s, m) {
      const { r, c, v0, mode } = s;
      const tau = r * c * 1e-6;
      const T = mode === "charge" ? 5.5 * tau : 6 * tau;
      const curve = sweep((tt) => {
        return mode === "charge" ? v0 * (1 - Math.exp(-tt / tau)) : v0 * Math.exp(-tt / tau);
      }, 0, T, 60);
      return [{ points: curve, color: "#00ffd5" }];
    },
    xLabel: "Time (s)",
    yLabel: "Capacitor voltage (V)"
  },
  procedure: [
    "Pick R, C and battery voltage.",
    "Watch the capacitor fill — fastest at first, then slower.",
    "Locate 63 % of V₀ at t = RC on the graph.",
    "Flip to discharge and see the mirrored curve.",
    "Confirm that after 5τ the change is >99 %."
  ],
  observation: "The voltage rises quickly at first and then asymptotes toward the battery — an exponential approach governed by τ = RC.",
  conclusion: "A capacitor charges to 63 % after one time constant RC; after 5RC it is effectively full (or empty when discharging).",
  explain: "A capacitor is a tank for charge. When it's empty the current rushes in; as it fills, less space remains and the flow slows — a self-limiting race.",
  uncertainty: "Stopwatch reaction time ±0.2 s matters when τ is small — keep τ above 1 s for clean manual data.",
  runningHint: "Bigger RC = slower, more visible charging curve."
};

// ════════════════════════════════════════════════════════════════
// 21 · HEAT TRANSFER
// ════════════════════════════════════════════════════════════════
const heatTransfer = {
  id: "heatTransfer",
  number: "21",
  title: "Heat Transfer",
  topic: "Thermodynamics",
  description: "Bring a hot and a cold object into contact and watch their temperatures converge.",
  objective: "Use Q = mcΔT to predict final temperatures and transferred heat.",
  theory: [
    "Heat always flows from the hotter object to the colder one.",
    "Energy lost by the hot object equals energy gained by the cold one (perfect calorimeter): Q_hot = Q_cold."
  ],
  formulas: [
    { text: "Q = mcΔT", note: "heat energy (J)" },
    { text: "Q_hot = m1c1ΔT1", note: "heat leaving hot object (J)" },
    { text: "m1c1(T1−Tf) = m2c2(Tf−T2)", note: "calorimetry balance" }
  ],
  unitsNote: "m kg, c J/kg·K, ΔT in K or °C, Q joules.",
  limitsNote: "Masses 0.1–5 kg, materials water 4186, iron 450, aluminium 900, copper 385 J/kg·K.",
  scene: "heat",
  controls: [
    { key: "mass", label: "Mass (both blocks)", min: 0.1, max: 5, step: 0.1, unit: "kg", def: 1 },
    { key: "t1", label: "Hot temp", min: 20, max: 100, step: 1, unit: "°C", def: 80 },
    { key: "t2", label: "Cold temp", min: 0, max: 60, step: 1, unit: "°C", def: 20 },
    { key: "material", label: "Material", type: "select", options: [{ v: 4186, l: "Water" }, { v: 900, l: "Aluminium" }, { v: 450, l: "Iron" }, { v: 385, l: "Copper" }], def: 900 }
  ],
  measures: [
    { key: "q", label: "Heat transferred", unit: "kJ" },
    { key: "tf", label: "Final equilibrium temp", unit: "°C" },
    { key: "dt1", label: "ΔT hot", unit: "K" },
    { key: "dt2", label: "ΔT cold", unit: "K" }
  ],
  compute(s) {
    const { mass, t1, t2, material, t } = s;
    const c = Number(material);
    const tf = (mass * c * t1 + mass * c * t2) / (mass * c + mass * c);
    const q0 = mass * c * Math.abs(t1 - tf);
    const progress = clamp(t / 6, 0, 1);
    const T1now = t1 - (t1 - tf) * progress;
    const T2now = t2 + (tf - t2) * progress;
    const q = q0 * progress;
    return {
      m: { q: q / 1000, tf, dt1: t1 - tf, dt2: tf - t2 },
      scene: { t1: T1now, t2: T2now, q: q / 1000, mass, material: s.material === 4186 ? "water" : s.material === 900 ? "aluminium" : s.material === 450 ? "iron" : "copper", c },
      duration: 6
    };
  },
  graph: {
    series(s, m) {
      const { mass, t1, t2, material } = s;
      const c = Number(material);
      const tf = (t1 + t2) / 2;
      return [
        { points: sweep((tt) => t1 - (t1 - tf) * (tt / 6), 0, 6, 30), color: "#ff5a5a", label: "Hot" },
        { points: sweep((tt) => t2 + (tf - t2) * (tt / 6), 0, 6, 30), color: "#57d3ff", label: "Cold" }
      ];
    },
    xLabel: "Time (s)",
    yLabel: "Temperature (°C)"
  },
  procedure: [
    "Choose the mass, starting temperatures and material.",
    "Watch heat arrows flow from hot to cold.",
    "Note both temperatures converge to identical values.",
    "Read the total heat transferred Q = mcΔT.",
    "Change the material and compare how much heat moves."
  ],
  observation: "Both blocks meet at the same final temperature; the block with bigger specific heat (water) absorbs far more energy for the same rise.",
  conclusion: "Heat exchange continues until temperatures equalise, and Q = mcΔT describes the amount transferred.",
  explain: "Temperature is a crowd's excitement level. Calm and excited molecules share until everyone is equally excited, and how much energy that needs depends on the material (c).",
  uncertainty: "A calorimeter loses ~5 % to surrounding air; use a lid and account with Q_loss = mcΔT_copper_cup.",
  runningHint: "Try water against copper — huge difference in stored energy."
};

// ════════════════════════════════════════════════════════════════
// 22 · IDEAL GAS LAW
// ════════════════════════════════════════════════════════════════
const idealGas = {
  id: "idealGas",
  number: "22",
  title: "Ideal Gas Law",
  topic: "Kinetic Theory",
  description: "Fill a piston with gas particles and see how P, V, T and n link together.",
  objective: "Verify PV = nRT and watch molecular motion respond to temperature.",
  theory: [
    "Gas pressure comes from countless particle impacts on the walls.",
    "Raising temperature speeds particles, which shoves the walls harder: PV = nRT holds it all together."
  ],
  formulas: [
    { text: "PV = nRT", note: "ideal gas law (R = 8.314 J/mol·K)" },
    { text: "KE_avg = (3/2)kT", note: "particle energy (J)" },
    { text: "P = nRT/V", note: "pressure (Pa)" }
  ],
  unitsNote: "P in Pa, V in m³, T in kelvin, n in mol. 1 atm = 101 325 Pa = 101.3 kPa.",
  limitsNote: "n = 1–10 mol, V = 0.01–0.5 m³, T = 200–800 K. Room: 1 mol gas ≈ 24.8 L at 300 K.",
  scene: "gas",
  duration: null,
  controls: [
    { key: "n", label: "Amount of gas", min: 1, max: 10, step: 1, unit: "mol", def: 3 },
    { key: "volume", label: "Volume", min: 0.02, max: 0.3, step: 0.01, unit: "m³", def: 0.05 },
    { key: "temp", label: "Temperature", min: 200, max: 800, step: 10, unit: "K", def: 300 }
  ],
  measures: [
    { key: "pressure", label: "Pressure", unit: "kPa" },
    { key: "volume", label: "Volume", unit: "m³" },
    { key: "temp", label: "Temperature", unit: "K" },
    { key: "n", label: "Amount", unit: "mol" },
    { key: "pv", label: "PV product", unit: "J" }
  ],
  compute(s) {
    const { n, volume, temp } = s;
    const R = 8.3144;
    const P = (n * R * temp) / volume;
    return {
      m: { pressure: P / 1000, volume, temp, n, pv: P * volume },
      scene: { n, temp, volume, pressure: P / 1000, nParticles: n * 12 }
    };
  },
  graph: {
    series(s, m) {
      const { n, temp } = s;
      return [{
        points: sweep((v) => (n * 8.3144 * temp) / v / 1000, 0.02, 0.3, 30),
        color: "#00ffd5"
      }];
    },
    xLabel: "Volume (m³)",
    yLabel: "Pressure (kPa)"
  },
  procedure: [
    "Fill the container with a chosen amount of gas.",
    "Raise the temperature and watch particles speed up.",
    "Notice the pressure gauge climb at fixed volume.",
    "Expand the volume at fixed temperature.",
    "Verify P·V = n·R·T on every setting."
  ],
  observation: "Hotter gas means faster particles and higher pressure; the P–V curve at fixed temperature is a hyperbola (Boyle's law).",
  conclusion: "The ideal gas law PV = nRT links all four state variables; pressure rises with n, T and falls with V.",
  explain: "Particles are tiny ping-pong balls. More balls (n), faster balls (T) or a smaller room (V) all mean harder, more frequent wall slams.",
  uncertainty: "Kelvin only — never use °C in the gas law. A ±1 K error is ~0.3 % at room temperature.",
  runningHint: "Fix n and T, then shrink the volume to watch pressure leap."
};

// ════════════════════════════════════════════════════════════════
// 23 · SIMPLE HARMONIC MOTION
// ════════════════════════════════════════════════════════════════
const shm = {
  id: "shm",
  number: "23",
  title: "Simple Harmonic Motion",
  topic: "Oscillations",
  description: "Oscillate a mass on a spring and trace its sinusoidal motion with the reference circle.",
  objective: "Model position, velocity and acceleration in SHM using x = A cos(ωt + φ).",
  theory: [
    "Restoring force F = −kx makes a mass oscillate sinusoidally.",
    "In SHM position, velocity and acceleration are all trig curves phase-shifted from each other."
  ],
  formulas: [
    { text: "x = A cos(ωt + φ)", note: "position (m)" },
    { text: "ω = √(k/m)", note: "angular frequency (rad/s)" },
    { text: "v = −Aω sin(ωt),  a = −ω²x", note: "velocity & acceleration" }
  ],
  unitsNote: "Position, velocity, acceleration in SI units; ω rad/s, T s, energy J.",
  limitsNote: "Amplitude 0.1–1 m, k 5–100 N/m, mass 0.1–5 kg. ω = √(k/m) in (2, 31) rad/s.",
  scene: "shm",
  controls: [
    { key: "amp", label: "Amplitude", min: 0.1, max: 1, step: 0.05, unit: "m", def: 0.5 },
    { key: "k", label: "Spring constant", min: 5, max: 100, step: 5, unit: "N/m", def: 30 },
    { key: "mass", label: "Mass", min: 0.1, max: 5, step: 0.1, unit: "kg", def: 1 }
  ],
  measures: [
    { key: "x", label: "Position", unit: "m" },
    { key: "v", label: "Velocity", unit: "m/s" },
    { key: "a", label: "Acceleration", unit: "m/s²" },
    { key: "period", label: "Period", unit: "s" },
    { key: "omega", label: "ω", unit: "rad/s" },
    { key: "energy", label: "Mechanical energy", unit: "J" }
  ],
  compute(s) {
    const { amp, k, mass, t } = s;
    const omega = Math.sqrt(k / mass);
    const period = (2 * Math.PI) / omega;
    const phi = 0;
    const x = amp * Math.cos(omega * t + phi);
    const v = -amp * omega * Math.sin(omega * t + phi);
    const a = -omega * omega * x;
    const energy = 0.5 * k * amp * amp;
    return {
      m: { x, v, a, period, omega, energy },
      scene: { extension: x, force: -k * x, k, mass, phaseAngle: omega * t + phi, minHeight: amp },
      duration: period * 3
    };
  },
  graph: {
    series(s, m) {
      const { amp, k, mass } = s;
      const omega = Math.sqrt(k / mass);
      return [
        { points: sweep((tt) => amp * Math.cos(omega * tt), 0, 6.28 / omega * 1.5, 50), color: "#00ffd5", label: "x" },
        { points: sweep((tt) => -amp * omega * Math.sin(omega * tt), 0, 6.28 / omega * 1.5, 50), color: "#ff4fd8", label: "v" }
      ];
    },
    xLabel: "Time (s)",
    yLabel: "Position / velocity"
  },
  procedure: [
    "Set amplitude, spring constant and mass.",
    "Watch the motion repeat with period T.",
    "Note keywords: max speed at centre, max acceleration at ends.",
    "Read ω = √(k/m) and check x = A cos(ωt).",
    "Raise k (stiffer spring) — the period falls."
  ],
  observation: "Displacement and velocity are quarter-cycle out of phase; acceleration is opposite displacement (a = −ω²x).",
  conclusion: "SHM is sinusoidal with period T = 2π√(m/k), determined by the stiffness and mass alone.",
  explain: "The spring's tug always points back to the middle, stronger the further you stretch it — like a hammock pushing you back toward the centre.",
  uncertainty: "Timing 20 oscillations with ±0.2 s total reduces period error to ±0.01 s. Use your stopwatch across many cycles.",
  runningHint: "Increase k to see the extra-stiff spring buzz faster."
};

// ════════════════════════════════════════════════════════════════
// 24 · DOPPLER EFFECT
// ════════════════════════════════════════════════════════════════
const doppler = {
  id: "doppler",
  number: "24",
  title: "Doppler Effect",
  topic: "Waves & Acoustics",
  description: "A sound source drives past an observer — hear and watch the pitch bend as it passes.",
  objective: "Predict the observed frequency when the source or observer moves: f' = f (v ± vo)/(v ∓ vs).",
  theory: [
    "When the source approaches, each wave is emitted closer to the observer, squeezing the wavelength — pitch rises.",
    "When it recedes the waves stretch — pitch drops. The formula combines both source and observer motion."
  ],
  formulas: [
    { text: "f' = f (v + vo)/(v − vs)", note: "source & observer approaching (Hz)" },
    { text: "use −vo / +vs when receding", note: "sign convention" },
    { text: "v_sound ≈ 343 m/s", note: "still air (m/s)" }
  ],
  unitsNote: "Speeds m/s, frequencies Hz.",
  limitsNote: "Source 100–2000 Hz, source speed 0–80 m/s, observer −50..50 m/s (< 343 to stay subsonic).",
  scene: "doppler",
  duration: null,
  controls: [
    { key: "f0", label: "Source frequency", min: 100, max: 2000, step: 10, unit: "Hz", def: 700 },
    { key: "vs", label: "Source velocity", min: 0, max: 80, step: 1, unit: "m/s", def: 30 },
    { key: "vo", label: "Observer velocity", min: -50, max: 50, step: 1, unit: "m/s", def: 0 },
    { key: "vSound", label: "Speed of sound", min: 300, max: 400, step: 5, unit: "m/s", def: 343 }
  ],
  measures: [
    { key: "fapp", label: "Observed (approach)", unit: "Hz" },
    { key: "frec", label: "Observed (receding)", unit: "Hz" },
    { key: "vrel", label: "Relative velocity", unit: "m/s" },
    { key: "lambda", label: "Wavelength src", unit: "m" }
  ],
  compute(s) {
    const { f0, vs, vo, vSound, t } = s;
    const fApp = f0 * (vSound + vo) / (vSound - vs);
    const fRec = f0 * (vSound - vo) / (vSound + vs);
    const relative = Math.abs(vs - vo);
    const lambda = vSound / f0;
    return {
      m: { fapp: fApp, frec: fRec, vrel: relative, lambda },
      scene: { f0, vs, vo, vSound, t, x: -W_UNIT * 0.5 + s_srcPos(t, vs) }
    };
  },
  graph: {
    series(s, m) {
      const { f0, vSound } = s;
      const pts = [];
      for (let i = 0; i < 30; i++) {
        const speed = i * 6;
        pts.push({ x: speed, y: f0 * vSound / (vSound - speed) });
      }
      return [{ points: pts, color: "#ff5aa9" }];
    },
    xLabel: "Source speed (m/s)",
    yLabel: "Observed frequency (Hz)"
  },
  procedure: [
    "Set a steady source frequency.",
    "Give the source a speed and watch it sweep across the screen.",
    "Read the higher pitch as it approaches and lower as it recedes.",
    "Add observer motion and note how both combine.",
    "Check f' = f(v + vo)/(v − vs)."
  ],
  observation: "Approaching → compressed circles & higher f'; receding → stretched circles & lower f'. The change is bigger at higher source speeds.",
  conclusion: "Relative motion between source and observer shifts the observed frequency exactly as f' = f(v ± vo)/(v ∓ vs) predicts.",
  explain: "Like waves lapping a boat you row toward: you hit more crests per second, so the 'pitch' rises. Row away and fewer crests arrive.",
  uncertainty: "Real doppler radar measures frequency shifts to ±0.1 Hz; tuning-fork demonstrations typically read ±5 Hz.",
  runningHint: "Speed up the source to exaggerate the swoosh."
};

const W_UNIT = 1;
function s_srcPos(t, vs) {
  return Math.sin(t * 0.5) * 0.4;
}

// ════════════════════════════════════════════════════════════════
// 25 · GRAVITATIONAL ORBIT
// ════════════════════════════════════════════════════════════════
const orbit = {
  id: "orbit",
  number: "25",
  title: "Gravitational Orbit",
  topic: "Astrophysics",
  description: "Give a satellite the right sideways speed and watch it settle into a circular or elliptical orbit.",
  objective: "Relate orbital motion to Newton's law of gravitation F = Gm₁m₂/r².",
  theory: [
    "Gravity pulls the satellite toward the planet; at the right speed the pull exactly curves the path into a circle.",
    "Too slow → falling in. Too fast → the ellipse stretches; at escape speed it flies free."
  ],
  formulas: [
    { text: "F = Gm1m2/r²", note: "gravitational force (N)" },
    { text: "v_circ = √(GM/r)", note: "circular orbital speed (m/s)" },
    { text: "v_esc = √(2GM/R)", note: "escape speed (m/s)" }
  ],
  unitsNote: "Masses kg, distance m, speed m/s, force N, period s.",
  limitsNote: "Planet mass 1–100 ×10²⁴ kg, altitude 200–2000 km above Earth radius 6371 km.",
  scene: "orbit",
  controls: [
    { key: "massP", label: "Planet mass", min: 1, max: 100, step: 1, unit: "×10²⁴ kg", def: 5.97 },
    { key: "alt", label: "Altitude", min: 200, max: 2000, step: 25, unit: "km", def: 400 },
    { key: "ratio", label: "Launch speed · v_circ", min: 0.6, max: 1.6, step: 0.01, unit: "", def: 1 },
    { key: "massS", label: "Satellite mass", min: 100, max: 2000, step: 100, unit: "kg", def: 500 }
  ],
  measures: [
    { key: "vcirc", label: "Circular speed", unit: "km/s" },
    { key: "vesc", label: "Escape speed", unit: "km/s" },
    { key: "F", label: "Gravitational force", unit: "N" },
    { key: "period", label: "Orbital period", unit: "min" },
    { key: "mode", label: "Orbit type", unit: "" }
  ],
  compute(s) {
    const { massP, alt, ratio, massS, t } = s;
    const M = massP * 1e24;
    const r0 = R_EARTH + alt * 1e3;
    const vc = Math.sqrt(GC * M / r0);
    const ve = Math.sqrt(2 * GC * M / r0);
    const v0 = vc * ratio;
    const F = GC * M * massS / (r0 * r0);
    const period = ratio <= 1.001 && ratio >= 0.999 ? (2 * Math.PI * r0) / v0 : (2 * Math.PI * r0) / vc;
    const tEnd = clamp(t, 0, 260);
    const { points, mode, speed } = integrateOrbit(M, r0, v0, tEnd);
    const last = points[points.length - 1] || points[0];
    return {
      m: { vcirc: vc / 1000, vesc: ve / 1000, F, period: period / 60, mode },
      scene: { points: points.map((p) => ({ x: p.x, y: p.y })), theta: null, r: (Math.hypot(last.rx, last.ry)) / 1000, v: speed, F, T: period, mode, M, alt, massS },
      duration: mode === "impact" ? 12 : null
    };
  },
  graph: {
    series(s, m) {
      const { massP, alt } = s;
      const M = massP * 1e24;
      const r0 = (R_EARTH + alt * 1e3);
      const vc = Math.sqrt(GC * M / r0);
      return [{ points: sweep((rr) => Math.sqrt(GC * M / (rr * r0 + r0)), 0.5, 3, 20), color: "#00ffd5" }];
    },
    xLabel: "Distance factor (×r₀)",
    yLabel: "Orbital speed (m/s)"
  },
  procedure: [
    "Choose a planet mass and satellite altitude.",
    "Read the required circular speed v = √(GM/r).",
    "Launch at exactly 1.0× to get a circle.",
    "Try 0.85× — the orbit collapses or impacts.",
    "Try 1.2× — a wide ellipse; 1.42×+ escapes."
  ],
  observation: "At v = v_circ the orbit is a perfect circle; below it the satellite spirals in, above it the ellipse grows until it escapes.",
  conclusion: "Newton's law F = Gm₁m₂/r² fully explains orbital motion: speed and altitude fix the shape of the orbit.",
  explain: "The satellite is always falling, but its sideways motion carries it past the horizon before it hits ground — it falls forever around the curve of the planet.",
  uncertainty: "Orbital insertion burns need ±0.5 % speed accuracy; 1 % error can change an orbit by hundreds of km.",
  runningHint: "Set ratio to 1.0 for the classic ISS-like circle, then nudge it."
};

// ════════════════════════════════════════════════════════════════
// 26 · PLANETARY GRAVITY COMPARISON (Space Mission)
// ════════════════════════════════════════════════════════════════
const planetFall = {
  id: "planetFall",
  number: "26",
  title: "Planetary Gravity Comparison",
  topic: "Astrophysics",
  description: "Drop the same object on Earth, the Moon, Mars or Jupiter and compare weight and fall time.",
  objective: "Compare g, weight = mg and falling motion across planets.",
  theory: [
    "Gravitational field strength g = GM/R² differs on every world.",
    "Weight changes with g but mass stays the same — your mass is constant, your weight isn't."
  ],
  formulas: [
    { text: "W = mg", note: "weight (N)" },
    { text: "g = GM/R²", note: "field strength (m/s²)" },
    { text: "T = √(2h/g)", note: "fall time from rest (s)" }
  ],
  unitsNote: "g m/s², weight N, mass kg, time s, velocity m/s.",
  limitsNote: "Earth 9.8, Moon 1.62, Mars 3.71, Jupiter 24.8 m/s². Drop height 1–50 m.",
  scene: "planetFall",
  controls: [
    { key: "planet", label: "Planet", type: "select", options: [{ v: "earth", l: "Earth" }, { v: "moon", l: "Moon" }, { v: "mars", l: "Mars" }, { v: "jupiter", l: "Jupiter" }], def: "earth" },
    { key: "mass", label: "Object mass", min: 1, max: 100, step: 1, unit: "kg", def: 10 },
    { key: "h0", label: "Initial height", min: 1, max: 50, step: 1, unit: "m", def: 20 }
  ],
  measures: [
    { key: "g", label: "Gravity (g)", unit: "m/s²" },
    { key: "weight", label: "Weight", unit: "N" },
    { key: "fallT", label: "Fall time", unit: "s" },
    { key: "impact", label: "Impact velocity", unit: "m/s" }
  ],
  compute(s) {
    const { planet, mass, h0, t } = s;
    const data = { earth: { g: 9.807, hi: "#8ed1ff", lo: "#1a4d8f" }, moon: { g: 1.62, hi: "#d9d9ff", lo: "#6a6a8f" }, mars: { g: 3.71, hi: "#ffb08a", lo: "#8f3a1a" }, jupiter: { g: 24.79, hi: "#ffd9a8", lo: "#c97a2a" } };
    const g = data[planet].g;
    const T = Math.sqrt((2 * h0) / g);
    const tc = Math.min(t, T);
    const h = Math.max(0, h0 - 0.5 * g * tc * tc);
    const v = g * tc;
    return {
      m: { g, weight: mass * g, fallT: T, impact: Math.sqrt(2 * g * h0) },
      scene: { planet: planet[0].toUpperCase() + planet.slice(1), g, h0, h: tc < T ? h : 0, v: v, weight: mass * g, colorHi: data[planet].hi, colorLo: data[planet].lo },
      duration: T * 1.1
    };
  },
  graph: {
    series(s, m) {
      const pts = [];
      const worlds = [["Earth", 9.807], ["Moon", 1.62], ["Mars", 3.71], ["Jupiter", 24.79]];
      worlds.forEach((w) => pts.push({ x: Math.sqrt((2 * m.h0) / w[1]), y: w[1] }));
      return [{ points: pts, pointsOnly: true, color: "#fff06a" }];
    },
    xLabel: "Fall time 20 m (s)",
    yLabel: "g (m/s²)"
  },
  procedure: [
    "Choose a world from the mission roster.",
    "Start a drop from your chosen height.",
    "Read weight, fall time and impact speed.",
    "Repeat on the Moon — everything feels feather-light.",
    "Repeat on Jupiter — everything is crushingly heavy."
  ],
  observation: "Your 10 kg object weighs 98 N on Earth, 16 N on the Moon, 248 N on Jupiter — and the fall time changes dramatically.",
  conclusion: "Weight depends on the local g, but mass and inertia are identical everywhere.",
  explain: "Mass is 'how much stuff'; weight is 'how hard the planet grabs it'. Big planets grab harder.",
  uncertainty: "Mission data tables quote g to 3 significant figures; drop timing on each world has the same ±0.05 s stopwatch error.",
  runningHint: "This lab feeds directly into your Space Mission planning — pick worlds to compare."
};

// ════════════════════════════════════════════════════════════════
// 27 · ESCAPE VELOCITY
// ════════════════════════════════════════════════════════════════
const escapeVelocity = {
  id: "escapeVelocity",
  number: "27",
  title: "Escape Velocity",
  topic: "Astrophysics",
  description: "Launch a rocket from a planet's surface and decide if it falls back, orbits or truly escapes.",
  objective: "Understand the minimum speed v_e = √(2GM/R) needed to break free of gravity.",
  theory: [
    "To escape, kinetic energy must beat the gravitational potential well: ½mv² ≥ GMm/R.",
    "Below v_e the rocket always falls back; at exactly v_e it reaches infinity with zero speed."
  ],
  formulas: [
    { text: "v_e = √(2GM/R)", note: "escape speed (m/s)" },
    { text: "v_circ = v_e/√2", note: "low circular orbit (m/s)" },
    { text: "E = ½mv² − GMm/r", note: "orbital energy (J)" }
  ],
  unitsNote: "Speed km/s, GM in m³/s², radius m.",
  limitsNote: "Earth v_e ≈ 11.2 km/s; launch 0–16 km/s. Use planet mass 1–100 ×10²⁴ kg and radius 1000–7000 km.",
  scene: "escape",
  controls: [
    { key: "planet", label: "Planet", type: "select", options: [{ v: "earth", l: "Earth" }, { v: "moon", l: "Moon" }, { v: "mars", l: "Mars" }], def: "earth" },
    { key: "v", label: "Launch velocity", min: 0, max: 16, step: 0.1, unit: "km/s", def: 8 },
    { key: "massP", label: "Planet mass", min: 1, max: 100, step: 1, unit: "×10²⁴ kg", def: 5.97 },
    { key: "radiusP", label: "Planet radius", min: 1000, max: 7000, step: 100, unit: "km", def: 6371 }
  ],
  measures: [
    { key: "ve", label: "Escape velocity", unit: "km/s" },
    { key: "vc", label: "Circular speed", unit: "km/s" },
    { key: "outcome", label: "Outcome", unit: "" },
    { key: "alt", label: "Current altitude", unit: "km" },
    { key: "vspeed", label: "Current speed", unit: "km/s" }
  ],
  compute(s) {
    const { v, massP, radiusP, t } = s;
    const M = massP * 1e24;
    const R = radiusP * 1e3;
    const ve = Math.sqrt(2 * GC * M / R) / 1000;
    const vc = ve / Math.sqrt(2);
    const { ve: _ve, outcome, trace } = integrateEscape(M, R, v * 1000, clamp(t, 0, 200), 0.1);
    const last = trace[trace.length - 1] || { r: 0, v: v * 1000 };
    const progress = clamp((last.r - R) / (R * 4), 0, 1);
    return {
      m: { ve, vc, outcome, alt: ((last.r - R) / 1000), vspeed: last.v / 1000 },
      scene: { progress: Math.max(0, progress), v, ve, outcome, trace },
      duration: 200
    };
  },
  graph: {
    series(s, m) {
      const { massP, radiusP } = s;
      const M = massP * 1e24;
      const R = radiusP * 1e3;
      const ve = Math.sqrt(2 * GC * M / R) / 1000;
      return [{
        points: sweep((rr) => ve * Math.sqrt(R / (Math.max(R / 1e3, rr * 1000 + R) )), R / 1e3, R / 1e3 * 3, 20),
        color: "#ff5aa9"
      }];
    },
    xLabel: "Distance (km)",
    yLabel: "Escape speed (km/s)"
  },
  procedure: [
    "Pick a planet — Earth needs 11.2 km/s.",
    "Try a gentle 8 km/s launch.",
    "Watch the ballistic arc fall back to the surface.",
    "Crank it up to 11.2+ km/s — it sails away.",
    "Compare v_circ with v_e: orbit is the cheaper prize."
  ],
  observation: "Below v_e the speed continuously decays and the rocket plunges back; above v_e it keeps a positive residual speed at infinity.",
  conclusion: "Escape requires v_e = √(2GM/R) ≈ 11.2 km/s from Earth's surface — about 41 % above the circular-orbit speed.",
  explain: "Gravity is a hill that never ends. Circular orbit just rolls around the rim; to truly drive away you must have enough speed to never roll back.",
  uncertainty: "Real launch windows target v_inf margins of ±10 m/s — that's better than 0.1 % of the 11.2 km/s budget.",
  runningHint: "Use the Moon for a much easier escape (2.4 km/s)."
};

// ════════════════════════════════════════════════════════════════
// 28 · PROJECTILE WITH AIR RESISTANCE
// ════════════════════════════════════════════════════════════════
const projectileAir = {
  id: "projectileAir",
  number: "28",
  title: "Projectile Motion with Air Resistance",
  topic: "Dynamics",
  description: "Compare the ideal vacuum parabola with the realistic trajectory tangled by drag.",
  objective: "Quantify how drag shortens range and height and slows every phase of flight.",
  theory: [
    "In a vacuum the path is a perfect parabola and range is R = v²sin(2θ)/g.",
    "Air drag F_D = ½ρC D v² acts opposite the motion, stealing energy throughout the flight."
  ],
  formulas: [
    { text: "R = v²sin(2θ)/g", note: "ideal range (m)" },
    { text: "F_D = ½ρ·C·A·v²", note: "drag force (N)" },
    { text: "a_x = −(F_D/m)cosφ,  a_y = −g −(F_D/m)sinφ", note: "realistic acceleration" }
  ],
  unitsNote: "Speed m/s, mass kg, C dimensionless, ρ kg/m³, area m².",
  limitsNote: "Speed 10–80 m/s, mass 0.05–5 kg, C 0.1–1.5, ρ 0.5–1.5 kg/m³ = air at 0–4000 m.",
  scene: "projectileAir",
  controls: [
    { key: "speed", label: "Initial speed", min: 10, max: 80, step: 1, unit: "m/s", def: 35 },
    { key: "angle", label: "Launch angle", min: 10, max: 80, step: 1, unit: "°", def: 45 },
    { key: "mass", label: "Projectile mass", min: 0.05, max: 5, step: 0.05, unit: "kg", def: 0.5 },
    { key: "cd", label: "Drag coefficient C", min: 0.1, max: 1.5, step: 0.05, unit: "", def: 0.5 },
    { key: "rho", label: "Air density", min: 0.5, max: 1.5, step: 0.05, unit: "kg/m³", def: 1.225 }
  ],
  measures: [
    { key: "rangeI", label: "Ideal range", unit: "m" },
    { key: "rangeD", label: "Real range (drag)", unit: "m" },
    { key: "dR", label: "Range lost", unit: "m" },
    { key: "hI", label: "Ideal max height", unit: "m" },
    { key: "hD", label: "Real max height", unit: "m" }
  ],
  compute(s) {
    const { speed, angle, mass, cd, rho, t } = s;
    const area = 0.02;
    const res = integrateProjectile(speed, angle, mass, cd, rho, area, GRAV);
    const idx = clamp(Math.floor(t / 0.02), 0, res.drag.length - 1);
    const dragProj = res.drag[idx];
    return {
      m: { rangeI: res.rangeI, rangeD: res.rangeD, dR: res.rangeI - res.rangeD, hI: res.hI, hD: res.hD },
      scene: {
        ideal: res.ideal.map(p => [p.x, p.y]),
        drag: res.drag.map(p => [p.x, p.y]),
        rangeIdeal: res.rangeI, rangeDrag: res.rangeD, dR: res.rangeI - res.rangeD,
        hIdeal: res.hI, hDrag: res.hD,
        b: 0.5 * rho * cd * area / mass,
        dragProj: dragProj ? [dragProj.x, dragProj.y] : null
      },
      duration: clamp(res.time * 0.6, 2, 20)
    };
  },
  graph: {
    series(s, m) {
      const { speed, angle, mass, cd, rho } = s;
      const area = 0.02;
      const res = integrateProjectile(speed, angle, mass, cd, rho, area, GRAV);
      return [
        { points: res.ideal.map(p => ({ x: p.x, y: p.y })), color: "#57d3ff", label: "Ideal" },
        { points: res.drag.map(p => ({ x: p.x, y: p.y })), color: "#ff5aa9", label: "With drag" }
      ];
    },
    xLabel: "Horizontal distance (m)",
    yLabel: "Height (m)"
  },
  procedure: [
    "Set speed, angle, mass and the drag coefficient.",
    "Compare the dashed vacuum parabola with the solid real one.",
    "Watch the real path fall shorter and lower.",
    "Reduce C to 0.1 (sleek) — the two curves nearly touch.",
    "Count how much range drag stole."
  ],
  observation: "Drag shrinks both range and peak height, and the real trajectory returns steeply near the end instead of a neat parabola.",
  conclusion: "Air resistance F = ½ρCD·A·v² shortens projectile range; the effect grows with speed, cross-section and air density.",
  explain: "Think of throwing a paper ball vs a dart. The paper flattens out quickly because air pushes it hard; a dart punches through and behaves like 'physics class'.",
  uncertainty: "C is notoriously uncertain (±25 %) and depends on shape, Reynolds number and spin — treat range as approximate.",
  runningHint: "Switch C from 0.1 to 1.5 while watching the same launch."
};

// ════════════════════════════════════════════════════════════════
// 29 · VISCOUS FLOW / FLUID MOTION
// ════════════════════════════════════════════════════════════════
const viscousFlow = {
  id: "viscousFlow",
  number: "29",
  title: "Viscous Flow / Fluid Motion",
  topic: "Fluid Mechanics",
  description: "Drop objects through water, oil, honey or air and feel the effect of viscosity.",
  objective: "Understand drag in viscous fluids using Stokes' law F = 6πηrv.",
  theory: [
    "Viscosity is a fluid's internal friction — honey resists flow far more than water.",
    "A small sphere at low speed experiences Stokes drag F = 6πηrv (valid for small Reynolds numbers)."
  ],
  formulas: [
    { text: "F_d = 6πηrv", note: "Stokes drag (N)" },
    { text: "v_term = 2r²g(ρobj − ρfluid)/(9η)", note: "terminal velocity (m/s)" },
    { text: "R_e = ρvr/η", note: "Reynolds number" }
  ],
  unitsNote: "η in Pa·s, r and v in SI, force in N.",
  limitsNote: "Water η=0.001, oil 0.5, honey 10, air 1.8×10⁻⁵ Pa·s. Object radius 0.5–10 cm.",
  scene: "fluid",
  duration: null,
  controls: [
    { key: "fluid", label: "Fluid", type: "select", options: [{ v: "air", l: "Air (1.8e-5)" }, { v: "water", l: "Water (0.001)" }, { v: "oil", l: "Oil (0.5)" }, { v: "honey", l: "Honey (10)" }], def: "water" },
    { key: "radius", label: "Object radius", min: 0.5, max: 10, step: 0.1, unit: "cm", def: 2 },
    { key: "vel", label: "Object velocity", min: 0.1, max: 3, step: 0.1, unit: "m/s", def: 0.5 }
  ],
  measures: [
    { key: "Fd", label: "Drag force", unit: "N" },
    { key: "Re", label: "Reynolds number", unit: "" },
    { key: "vt", label: "Terminal velocity", unit: "m/s" },
    { key: "eta", label: "Viscosity", unit: "Pa·s" }
  ],
  compute(s) {
    const { fluid, radius, vel, t } = s;
    const eta = { air: 1.8e-5, water: 0.001, oil: 0.5, honey: 10 }[fluid];
    const rho = { air: 1.2, water: 1000, oil: 900, honey: 1400 }[fluid];
    const r = radius / 100;
    const Fd = 6 * Math.PI * eta * r * vel;
    const Re = rho * vel * r / eta;
    const vt = (2 * r * r * GRAV * (1200 - rho)) / (9 * eta);
    return {
      m: { Fd, Re, vt: Math.max(0, vt), eta },
      scene: { eta, name: fluid[0].toUpperCase() + fluid.slice(1), Fd, vel, t, fallSpeed: clamp(0.3, 0.05, vel / 2), color: { air: "#9fe0ff", water: "#2a86e0", oil: "#c98a2a", honey: "#d9a520" }[fluid] }
    };
  },
  graph: {
    series(s, m) {
      const { fluid, radius, vel } = s;
      const eta = { air: 1.8e-5, water: 0.001, oil: 0.5, honey: 10 }[fluid];
      const r = radius / 100;
      return [{ points: sweep((vv) => 6 * Math.PI * eta * r * vv, 0, vel, 20), color: "#57d3ff" }];
    },
    xLabel: "Velocity (m/s)",
    yLabel: "Drag force (N)"
  },
  procedure: [
    "Pick a fluid and drop diameter.",
    "Watch the object sink — fast in air, slow in honey.",
    "Read the drag force from Stokes' law.",
    "Raise the radius and watch drag climb with r.",
    "Compare terminal speeds across the four fluids."
  ],
  observation: "The same object falls almost freely in air but crawls through honey; drag depends on viscosity, size and speed.",
  conclusion: "Viscous drag follows F = 6πηrv in smooth flow; terminal speed depends on the density difference.",
  explain: "A sticky fluid grabs the object's entire surface. Honey is a crowd on a dance floor — moving through it is exhausting; air is an empty room.",
  uncertainty: "Stokes' law only holds for tiny Reynolds numbers (Re < 1); at higher Re the drag coefficient changes — note the Re readout.",
  runningHint: "Compare water vs honey at the same size to feel viscosity dominate."
};

// ════════════════════════════════════════════════════════════════
// 30 · ARCHIMEDES' PRINCIPLE
// ════════════════════════════════════════════════════════════════
const buoyancy = {
  id: "buoyancy",
  number: "30",
  title: "Archimedes' Principle",
  topic: "Fluid Mechanics",
  description: "Drop objects of different densities into a fluid and see them float, hover or sink.",
  objective: "Understand buoyant force F_b = ρ·V·g and the percentage submerged.",
  theory: [
    "A submerged object feels an upward force equal to the weight of the displaced fluid.",
    "Denser than the fluid → sinks; less dense → floats with a fraction ρ_fluid/ρ_obj submerged."
  ],
  formulas: [
    { text: "F_b = ρVg", note: "buoyant force (N)" },
    { text: "%submerged = ρ_obj/ρ_fluid", note: "floating fraction" },
    { text: "W = mg", note: "weight (N)" }
  ],
  unitsNote: "Density kg/m³, volume m³, force N, % dimensionless.",
  limitsNote: "Object density 100–2000 kg/m³, volume 0.01–0.3 m³, fluids water 1000, salt water 1025, oil 900.",
  scene: "buoyancy",
  controls: [
    { key: "objD", label: "Object density", min: 100, max: 2000, step: 10, unit: "kg/m³", def: 800 },
    { key: "vol", label: "Object volume", min: 0.02, max: 0.3, step: 0.01, unit: "m³", def: 0.1 },
    { key: "fluid", label: "Fluid", type: "select", options: [{ v: "water", l: "Water (1000)" }, { v: "salt", l: "Salt water (1025)" }, { v: "oil", l: "Oil (900)" }], def: "water" }
  ],
  measures: [
    { key: "weight", label: "Weight", unit: "N" },
    { key: "Fb", label: "Buoyant force", unit: "N" },
    { key: "subFrac", label: "Submerged fraction", unit: "%" },
    { key: "outcome", label: "Outcome", unit: "" }
  ],
  compute(s) {
    const { objD, vol, fluid, t } = s;
    const rhoF = { water: 1000, salt: 1025, oil: 900 }[fluid];
    const weight = objD * vol * GRAV;
    const Fb = rhoF * vol * GRAV;
    const subFrac = clamp(objD / rhoF, 0, 1);
    const outcome = objD < rhoF ? "float" : objD > rhoF ? "sink" : "suspend";
    return {
      m: { weight, Fb, subFrac: subFrac * 100, outcome },
      scene: { weight, Fb, submergedF: subFrac, outcome, objDensity: objD, fluidDensity: rhoF, displacedH: 0.5 + subFrac * 0.4 },
      duration: null
    };
  },
  graph: {
    series(s, m) {
      return [{ points: sweep((rho) => rho * s.vol * GRAV, 100, 2000, 30), color: "#57d3ff" }];
    },
    xLabel: "Object density (kg/m³)",
    yLabel: "Weight (N)"
  },
  procedure: [
    "Choose the object density and volume.",
    "Pick the fluid.",
    "Watch the object find its level.",
    "Read the buoyant force and submerged fraction.",
    "Equal densities → object hovers suspended."
  ],
  observation: "Below the fluid density the object floats; above it sinks; exactly equal and it hangs mid-tank.",
  conclusion: "The buoyant force equals the weight of displaced fluid F = ρVg; floating objects displace their own weight.",
  explain: "An object in water has a 'bubble hole' underneath fighting upward. If that push beats the object's weight, it floats; otherwise it sinks.",
  uncertainty: "Reading a meniscus adds ±0.5 mL to displaced volume. Overflow-can displacement data give density ±2 %.",
  runningHint: "Set density right at 1000 with water to watch a perfect hover."
};

// ════════════════════════════════════════════════════════════════
// 31 · PRESSURE IN LIQUIDS
// ════════════════════════════════════════════════════════════════
const pressureLiquids = {
  id: "pressureLiquids",
  number: "31",
  title: "Pressure in Liquids",
  topic: "Fluid Mechanics",
  description: "Lower a probe through a liquid and watch pressure climb linearly with depth.",
  objective: "Model liquid pressure as P = ρgh and compare it across liquids.",
  theory: [
    "Liquid pressure is caused by the weight of the liquid above a point, so it grows linearly with depth.",
    "Pressure does NOT depend on the container's shape — only on depth and density."
  ],
  formulas: [
    { text: "P = ρgh", note: "gauge pressure (Pa)" },
    { text: "P_abs = P_atm + ρgh", note: "absolute pressure (Pa)" },
    { text: "P_atm ≈ 101.3 kPa", note: "atmospheric (kPa)" }
  ],
  unitsNote: "P in pascal (Pa = N/m²), ρ kg/m³, h m, g m/s².",
  limitsNote: "Water 1000, sea water 1025, mercury 13 600 kg/m³; depth 0.2–12 m, g 1.6–15 m/s².",
  scene: "pressure",
  controls: [
    { key: "liquid", label: "Liquid", type: "select", options: [{ v: 1000, l: "Water (1000)" }, { v: 1025, l: "Sea water (1025)" }, { v: 13600, l: "Mercury (13600)" }], def: 1000 },
    { key: "depth", label: "Depth", min: 0.2, max: 12, step: 0.1, unit: "m", def: 5 },
    { key: "g", label: "Gravity", min: 1.6, max: 15, step: 0.1, unit: "m/s²", def: 9.8 }
  ],
  measures: [
    { key: "p", label: "Gauge pressure", unit: "kPa" },
    { key: "pabs", label: "Absolute pressure", unit: "kPa" },
    { key: "rho", label: "Density", unit: "kg/m³" },
    { key: "depth", label: "Depth", unit: "m" }
  ],
  compute(s) {
    const { liquid, depth, g, t } = s;
    const rho = Number(liquid);
    const p = rho * g * depth;
    const pabs = 101.3e3 + p;
    return {
      m: { p: p / 1000, pabs: pabs / 1000, rho, depth },
      scene: { depth, maxDepth: 12, rho, g, p: p / 1000, name: rho === 1025 ? "sea water" : rho === 13600 ? "mercury" : "water" },
      duration: null
    };
  },
  graph: {
    series(s, m) {
      const { liquid, g } = s;
      const rho = Number(liquid);
      return [{ points: sweep((h) => rho * g * h / 1000, 0, 12, 30), color: "#00ffd5" }];
    },
    xLabel: "Depth (m)",
    yLabel: "Pressure (kPa)"
  },
  procedure: [
    "Pick a liquid and gravity.",
    "Lower the probe and read the pressure.",
    "Step the depth in 1 m intervals and record each reading.",
    "Plot pressure against depth — a neat straight line.",
    "Switch to mercury and see how steep the line gets."
  ],
  observation: "Pressure rises evenly with depth; 3 m of water ≈ 29.4 kPa extra — about 0.29 atm.",
  conclusion: "Liquid pressure P = ρgh is linearly proportional to depth and density but independent of container shape.",
  explain: "Every metre down adds another metre-width of liquid sitting on your head. Denser liquid = heavier blanket = more squeeze.",
  uncertainty: "Depth measured with a string (±1 cm) gives ΔP/P = Δh/h. Mercury manometers read ±0.1 mm Hg.",
  runningHint: "Compare 1 m of water (9.8 kPa) with 1 m of mercury (133 kPa)."
};

// ════════════════════════════════════════════════════════════════
// 32 · BERNOULLI'S PRINCIPLE
// ════════════════════════════════════════════════════════════════
const bernoulli = {
  id: "bernoulli",
  number: "32",
  title: "Bernoulli's Principle",
  topic: "Fluid Mechanics",
  description: "Watch fluid race through a narrowing pipe and see the pressure drop as speed rises.",
  objective: "Apply Bernoulli's equation P + ½ρv² + ρgh = constant in a horizontal pipe.",
  theory: [
    "In a constriction the fluid must speed up to pass the same volume (continuity).",
    "Faster flow means lower pressure — the same equation that helps wings fly."
  ],
  formulas: [
    { text: "P + ½ρv² + ρgh = const", note: "Bernoulli (Pa)" },
    { text: "A1v1 = A2v2", note: "continuity (m³/s)" },
    { text: "Q = Av", note: "volume flow (m³/s)" }
  ],
  unitsNote: "P Pa, ρ kg/m³, v m/s, A m², Q m³/s.",
  limitsNote: "Pipe diameter 2–10 cm, fluid density 700–1400 kg/m³, inlet speed 0.5–5 m/s.",
  scene: "bernoulli",
  controls: [
    { key: "d1", label: "Wide diameter", min: 4, max: 10, step: 0.5, unit: "cm", def: 8 },
    { key: "d2", label: "Narrow diameter", min: 1, max: 6, step: 0.5, unit: "cm", def: 3 },
    { key: "rho", label: "Fluid density", min: 700, max: 1400, step: 50, unit: "kg/m³", def: 1000 },
    { key: "v1", label: "Inlet velocity", min: 0.5, max: 5, step: 0.1, unit: "m/s", def: 1.5 }
  ],
  measures: [
    { key: "v2", label: "Narrow velocity", unit: "m/s" },
    { key: "p1", label: "Pressure wide", unit: "kPa" },
    { key: "p2", label: "Pressure narrow", unit: "kPa" },
    { key: "flow", label: "Flow rate", unit: "m³/s" }
  ],
  compute(s) {
    const { d1, d2, rho, v1, t } = s;
    const A1 = Math.PI * (d1 / 100 / 2) ** 2;
    const A2 = Math.PI * (d2 / 100 / 2) ** 2;
    const v2 = (A1 * v1) / A2;
    const flow = A1 * v1;
    const pRef = 150e3;
    const p1 = pRef - 0.5 * rho * v1 * v1;
    const p2 = pRef - 0.5 * rho * v2 * v2;
    return {
      m: { v2, p1: p1 / 1000, p2: p2 / 1000, flow },
      scene: { v1, v2, p1: p1 / 1000, p2: p2 / 1000, p3: p1 / 1000, flow },
      duration: null
    };
  },
  graph: {
    series(s, m) {
      const { d1, d2, rho, v1 } = s;
      const A1 = Math.PI * (d1 / 100 / 2) ** 2;
      const A2 = Math.PI * (d2 / 100 / 2) ** 2;
      const pRef = 150e3;
      return [{ points: sweep((vv) => (pRef - 0.5 * rho * vv * vv) / 1000, 0, v1 * 2, 30), color: "#00ffd5" }];
    },
    xLabel: "Velocity (m/s)",
    yLabel: "Pressure (kPa)"
  },
  procedure: [
    "Choose diameters, density and inlet speed.",
    "Watch particles squeeze through the neck.",
    "Read the higher velocity in the narrow part.",
    "Compare pressures: slower → higher pressure.",
    "Check A1v1 = A2v2 with your numbers."
  ],
  observation: "In the constriction particles speed up and the pressure readout drops dramatically.",
  conclusion: "Steady, incompressible flow obeys A1v1 = A2v2 and Bernoulli: faster speed, lower pressure.",
  explain: "Faster molecules stretch further apart, and fewer bumps means lower pressure — like dancers spinning faster but avoiding each other.",
  uncertainty: "Pitot tubes read ±1 Pa only if perfectly aligned; real pipes lose 0.1–1 kPa to friction (neglected here).",
  runningHint: "Squeeze d2 to 2 cm and watch the pressure drop like a vacuum."
};

// ════════════════════════════════════════════════════════════════
// 33 · SIMPLE ELECTRIC MOTOR
// ════════════════════════════════════════════════════════════════
const motor = {
  id: "motor",
  number: "33",
  title: "Simple Electric Motor",
  topic: "Electromagnetism",
  description: "Sit a current-carrying coil in a magnetic field and feel the torque that spins it.",
  objective: "Use the motor torque equation τ = NABI sinθ and see electric energy become mechanical motion.",
  theory: [
    "A current loop in a magnetic field experiences a torque τ = NABI sinθ on its sides.",
    "The commutator flips the current each half-turn so the torque never reverses — continuous spin."
  ],
  formulas: [
    { text: "τ = NABI sinθ", note: "torque (N·m)" },
    { text: "F = BIL", note: "force on wire (N)" },
    { text: "τ = α·I  (motor constant)", note: "practical form" }
  ],
  unitsNote: "τ N·m, B T, A m², I A, N turns.",
  limitsNote: "Current 0.5–5 A, B 0.05–0.5 T, area 0.001–0.01 m², turns 10–200.",
  scene: "motor",
  controls: [
    { key: "i", label: "Current", min: 0.5, max: 5, step: 0.1, unit: "A", def: 2 },
    { key: "b", label: "Magnetic field", min: 0.05, max: 0.5, step: 0.05, unit: "T", def: 0.2 },
    { key: "area", label: "Coil area", min: 0.001, max: 0.01, step: 0.001, unit: "m²", def: 0.005 },
    { key: "turns", label: "Number of turns", min: 10, max: 200, step: 10, unit: "", def: 50 }
  ],
  measures: [
    { key: "torque", label: "Max torque", unit: "N·m" },
    { key: "F", label: "Force per wire", unit: "N" },
    { key: "I", label: "Current", unit: "A" },
    { key: "B", label: "Field", unit: "T" },
    { key: "pwr", label: "Electrical power", unit: "W" }
  ],
  compute(s) {
    const { i, b, area, turns, t } = s;
    const omega = 3 * (i * b) + 0.8;
    const angle = omega * t;
    const torque = turns * b * area * i * Math.abs(Math.sin(angle));
    const F = b * i * 0.1;
    const pwr = i * i * 2;
    return {
      m: { torque, F, I: i, B: b, pwr },
      scene: { angle, torque, current: i, b, vgen: null, freq: omega / (2 * Math.PI) },
      duration: null
    };
  },
  graph: {
    series(s, m) {
      return [{
        points: sweep((aa) => s.b * s.area * s.i * s.turns * Math.sin(aa), 0, Math.PI * 2, 40),
        color: "#42ff80"
      }];
    },
    xLabel: "Angle θ (rad)",
    yLabel: "Torque (N·m)"
  },
  procedure: [
    "Choose current, field, area and turns.",
    "Watch the coil rotate inside the field.",
    "Note torque peaks at θ = 90° and dies at 0°.",
    "Increase current or turns — torque scales up.",
    "Check τ = NABI for the peak value."
  ],
  observation: "The torque oscillates with sinθ; more current, stronger fields, bigger loops and more turns all multiply the peak torque.",
  conclusion: "A current loop in a magnetic field turns because τ = NABI sinθ — the basis of every electric motor.",
  explain: "The field pushes the left wire one way and the right wire the other, so the loop rotates like a steering wheel pushed on opposite sides.",
  uncertainty: "Real motors lose torque to friction and back-EMF; nameplate ratings include these corrections.",
  runningHint: "Stack up turns and current to watch the coil spin eagerly."
};

// ════════════════════════════════════════════════════════════════
// 34 · DC GENERATOR
// ════════════════════════════════════════════════════════════════
const generator = {
  id: "generator",
  number: "34",
  title: "DC Generator",
  topic: "Electromagnetism",
  description: "Crank a coil through a magnetic field and collect the alternating voltage it produces.",
  objective: "Understand electromagnetic generation: spinning in a field induces ε = NABω sin(ωt).",
  theory: [
    "Rotating a coil inside a magnetic field changes the flux through it, inducing an EMF.",
    "The output is sinusoidal: ε = NABω sin(ωt), with frequency fixed by the rotation speed."
  ],
  formulas: [
    { text: "ε = NABω sin(ωt)", note: "generated EMF (V)" },
    { text: "ε_peak = NABω", note: "amplitude (V)" },
    { text: "f = ω/(2π)", note: "electrical frequency (Hz)" }
  ],
  unitsNote: "EMF volts, A m², ω rad/s, B T, f Hz.",
  limitsNote: "Rotation 1–30 rev/s, B 0.05–0.5 T, turns 10–200.",
  scene: "generator",
  controls: [
    { key: "revs", label: "Rotation speed", min: 1, max: 30, step: 1, unit: "rev/s", def: 10 },
    { key: "b", label: "Magnetic field", min: 0.05, max: 0.5, step: 0.05, unit: "T", def: 0.2 },
    { key: "turns", label: "Coil turns", min: 10, max: 200, step: 10, unit: "", def: 100 },
    { key: "area", label: "Coil area", min: 0.001, max: 0.01, step: 0.001, unit: "m²", def: 0.005 }
  ],
  measures: [
    { key: "peak", label: "Peak EMF", unit: "V" },
    { key: "rms", label: "RMS voltage", unit: "V" },
    { key: "freq", label: "Frequency", unit: "Hz" },
    { key: "angle", label: "Over last turn", unit: "°" }
  ],
  compute(s) {
    const { revs, b, turns, area, t } = s;
    const omega = 2 * Math.PI * revs;
    const peak = turns * b * area * omega;
    const angle = omega * t;
    const vgen = peak * Math.sin(angle);
    return {
      m: { peak, rms: peak / Math.sqrt(2), freq: revs, angle: (angle % (2 * Math.PI)) * 180 / Math.PI },
      scene: { angle, current: null, torque: peak * 0.01, vgen, vmax: peak, freq: revs, b, turns, area },
      duration: null
    };
  },
  graph: {
    series(s, m) {
      const { revs, b, turns, area } = s;
      const omega = 2 * Math.PI * revs;
      const peak = turns * b * area * omega;
      return [{ points: sweep((tt) => peak * Math.sin(omega * tt), 0, 1 / revs, 60), color: "#fff06a" }];
    },
    xLabel: "Time (s)",
    yLabel: "Voltage (V)"
  },
  procedure: [
    "Set rotation speed, field, turns and area.",
    "Watch the coil sweep through the field.",
    "Read the sine voltage below and the peak value.",
    "Double the rotation speed — peak doubles.",
    "Check ε_peak = NABω matches the display."
  ],
  observation: "Doubling rotation speed or turns doubles the peak voltage; the sine wave's frequency tracks the rotation rate.",
  conclusion: "A spinning coil in a field generates EMF proportional to NABω — the reverse of the motor effect.",
  explain: "Spin a coil through magnetism and you shake the electrons inside the wire until they march out as a current — a windmill for electricity.",
  uncertainty: "The displayed lookup angle quantises by one frame (≈ ms), so the instantaneous value has small granularity noise.",
  runningHint: "Crank the revs to 30 and watch the frequency and voltage both soar."
};

// ════════════════════════════════════════════════════════════════
// 35 · SOLAR PANEL
// ════════════════════════════════════════════════════════════════
const solar = {
  id: "solar",
  number: "35",
  title: "Solar Panel",
  topic: "Energy Conversion",
  description: "Shine photons on a panel and collect the electrical power that comes out.",
  objective: "Understand photovoltaic conversion and the efficiency formula P = η·G·A.",
  theory: [
    "Photons knock electrons loose in the silicon — creating a current, not 'catching sunlight'.",
    "Useful electrical power equals irradiance × area × efficiency: P = η·G·A."
  ],
  formulas: [
    { text: "P = η · G · A", note: "electrical output (W)" },
    { text: "V ≈ 0.5 V/cell, I ∝ G", note: "cell behaviour" },
    { text: "η = P_el / P_sunlight", note: "efficiency" }
  ],
  unitsNote: "G in W/m², A m², P W, η %, V V, I A.",
  limitsNote: "Irradiance 100–1000 W/m² (full sun = 1000), area 0.1–5 m², efficiency 5–25 %, temp 0–60 °C.",
  scene: "solar",
  controls: [
    { key: "g", label: "Solar intensity", min: 100, max: 1000, step: 10, unit: "W/m²", def: 800 },
    { key: "area", label: "Panel area", min: 0.1, max: 5, step: 0.1, unit: "m²", def: 1.6 },
    { key: "eta", label: "Efficiency", min: 5, max: 25, step: 1, unit: "%", def: 18 },
    { key: "temp", label: "Panel temperature", min: 0, max: 60, step: 1, unit: "°C", def: 25 }
  ],
  measures: [
    { key: "power", label: "Electrical power", unit: "W" },
    { key: "vout", label: "Output voltage", unit: "V" },
    { key: "iout", label: "Output current", unit: "A" },
    { key: "energy", label: "Energy per hour", unit: "Wh" },
    { key: "eff", label: "Effective efficiency", unit: "%" }
  ],
  compute(s) {
    const { g, area, eta, temp } = s;
    const tempFactor = 1 + (25 - temp) * 0.004;
    const eff = (eta / 100) * tempFactor;
    const power = eff * g * area;
    const vout = 30 * Math.min(1, g / 1000);
    const iout = power / Math.max(vout, 0.1);
    const energy = power * 1;
    return {
      m: { power, vout, iout, energy, eff: eff * 100 },
      scene: { intensity: g / 1000, power, vout, iout, eff: eff * 100, area },
      duration: null
    };
  },
  graph: {
    series(s, m) {
      const { area, eta, temp } = s;
      const eff = (eta / 100) * (1 - Math.max(0, temp - 25) * 0.004);
      return [{ points: sweep((gg) => eff * gg * area, 100, 1000, 30), color: "#fff06a" }];
    },
    xLabel: "Solar intensity (W/m²)",
    yLabel: "Power output (W)"
  },
  procedure: [
    "Set the sunlight level for the day.",
    "Choose the panel area and efficiency rating.",
    "Read the electrical power, voltage and current.",
    "Heat the panel up — see how hot panels lose power.",
    "Verify P = η·G·A for your numbers."
  ],
  observation: "Power scales linearly with sunshine and area; every 10 °C above 25 °C costs roughly 4 % output.",
  conclusion: "A panel converts η·G·A of sunlight to electricity, and efficiency is temperature-sensitive.",
  explain: "Photons are little energy bullets. More bullets hitting a bigger panel with better bullet-catchers (higher η) means more moving electrons.",
  uncertainty: "PV nameplate η is measured at STC (1000 W/m², 25 °C) with ±2 % variation panel to panel.",
  runningHint: "Toggle between noon (1000) and dusk (200) to see the power meter swing."
};

// ════════════════════════════════════════════════════════════════
// 36 · ENERGY CONVERSION LAB
// ════════════════════════════════════════════════════════════════
const energyConversion = {
  id: "energyConversion",
  number: "36",
  title: "Energy Conversion Lab",
  topic: "Energy",
  description: "Follow energy as it changes form through a chain — and chase down the efficiency losses.",
  objective: "Map energy transformations and compute efficiency = useful output / input.",
  theory: [
    "Energy never disappears; it only changes form (first law).",
    "Every conversion leaks some energy to heat, sound or light — that leak sets the efficiency."
  ],
  formulas: [
    { text: "Efficiency = (Useful output / Input) × 100%", note: "%" },
    { text: "E_input = E_useful + E_lost", note: "balance (J)" },
    { text: "η_total = η1 · η2 · η3 ...", note: "series chains" }
  ],
  unitsNote: "Energy J, efficiency %.",
  limitsNote: "Input 100–1000 J; realistic drops: gravitational 95 %, chemical → electrical 90 %, electric → mechanical 90 %, solar → electrical 20 %, electrical → heat 100 %.",
  scene: "energyFlow",
  controls: [
    { key: "chain", label: "Energy chain", type: "select", options: [
      { v: "grav", l: "Potential → Kinetic" },
      { v: "chem", l: "Chemical → Electrical → Mechanical" },
      { v: "solar", l: "Solar → Electrical → Light" },
      { v: "elect", l: "Electrical → Mechanical → Kinetic" },
      { v: "thermal", l: "Electrical → Heat" }
    ], def: "chem" },
    { key: "input", label: "Input energy", min: 100, max: 1000, step: 10, unit: "J", def: 500 }
  ],
  measures: [
    { key: "output", label: "Useful output", unit: "J" },
    { key: "loss", label: "Energy lost", unit: "J" },
    { key: "eff", label: "Efficiency", unit: "%" },
    { key: "input", label: "Input", unit: "J" }
  ],
  compute(s) {
    const chains = {
      grav: { steps: [ { label: "Potential", form: "mgh", color: "#42ff80", icon: "🪜" }, { label: "Kinetic", form: "½mv²", color: "#ff4fd8", icon: "⚡" } ], effs: [0.95] },
      chem: { steps: [ { label: "Chemical", form: "battery", color: "#ff5a5a", icon: "🔋" }, { label: "Electrical", form: "V·I", color: "#fff06a", icon: "⚡" }, { label: "Mechanical", form: "τ·ω", color: "#57d3ff", icon: "🌀" } ], effs: [0.9, 0.9] },
      solar: { steps: [ { label: "Solar", form: "photons", color: "#fff06a", icon: "☀️" }, { label: "Electrical", form: "V·I", color: "#ffc832", icon: "⚡" }, { label: "Light", form: "photons", color: "#9adcff", icon: "💡" } ], effs: [0.2, 0.8] },
      elect: { steps: [ { label: "Electrical", form: "V·I", color: "#fff06a", icon: "⚡" }, { label: "Mechanical", form: "τ·ω", color: "#ff8fa3", icon: "🌀" }, { label: "Kinetic", form: "½mv²", color: "#42ff80", icon: "🏎️" } ], effs: [0.9, 0.9] },
      thermal: { steps: [ { label: "Electrical", form: "V·I", color: "#fff06a", icon: "⚡" }, { label: "Heat", form: "mcΔT", color: "#ff5a5a", icon: "🔥" } ], effs: [0.98] }
    };
    const cfg = chains[s.chain];
    const eff = cfg.effs.reduce((a, c) => a * c, 1);
    const output = s.input * eff;
    const loss = s.input - output;
    return {
      m: { output, loss, eff: eff * 100, input: s.input },
      scene: { chain: cfg.steps, input: s.input, output, loss, eff: eff * 100, t: s.t },
      duration: null
    };
  },
  graph: {
    series(s, m) {
      return [
        { points: sweep((inp) => inp * (m.eff / 100), 100, 1000, 20), color: "#42ff80", label: "Output" },
        { points: sweep((inp) => inp, 100, 1000, 20), color: "rgba(255,255,255,0.5)", label: "Input" }
      ];
    },
    xLabel: "Input energy (J)",
    yLabel: "Output energy (J)"
  },
  procedure: [
    "Pick an energy chain to trace.",
    "Feed in a fixed input energy.",
    "Watch energy hop from one form to the next.",
    "Read output, loss and the total efficiency.",
    "Multiply the per-step efficiencies to check η_total."
  ],
  observation: "Every arrow in the chain costs some energy to heat; solar is by far the leakiest step.",
  conclusion: "Energy is conserved in total, but the useful fraction shrinks through each conversion — efficiency = useful/input.",
  explain: "Energy is like a relay baton: it changes hands but drops a little at every pass. Better runners (higher η) drop less.",
  uncertainty: "Chain efficiencies are typical values with ±5 % spread depending on operating conditions.",
  runningHint: "Compare the solar chain's brutal 20 % step with the near-perfect heater."
};

// ════════════════════════════════════════════════════════════════
// 37 · MEASUREMENT AND UNCERTAINTY
// ════════════════════════════════════════════════════════════════
const measurement = {
  id: "measurement",
  number: "37",
  title: "Measurement and Uncertainty",
  topic: "Measurement",
  description: "Take repeated measurements of length, mass or time and see how the average and error emerge.",
  objective: "Calculate mean, absolute uncertainty and percentage uncertainty from repeat trials.",
  theory: [
    "No measurement is exact — repeat readings scatter around a mean value.",
    "Absolute uncertainty is half the range (or the standard deviation); percentage uncertainty normalises it against the value."
  ],
  formulas: [
    { text: "x̄ = Σxᵢ/n", note: "mean" },
    { text: "Δx = (max − min)/2", note: "absolute uncertainty" },
    { text: "%uncertainty = (Δx/x̄) × 100%", note: "percentage" }
  ],
  unitsNote: "Length cm, mass g, time s, temperature °C, voltage V, current A.",
  limitsNote: "Ruler ±0.1 cm, balance ±0.05 g, stopwatch ±0.01 s — realistic instrument resolutions.",
  scene: "measurement",
  controls: [
    { key: "quantity", label: "Quantity", type: "select", options: [{ v: "length", l: "Length (ruler)" }, { v: "mass", l: "Mass (balance)" }, { v: "time", l: "Time (stopwatch)" }], def: "length" }
  ],
  measures: [
    { key: "n", label: "Readings", unit: "" },
    { key: "mean", label: "Mean", unit: "" },
    { key: "absErr", label: "Abs. uncertainty", unit: "" },
    { key: "percentErr", label: "% uncertainty", unit: "%" }
  ],
  makeExtra: () => ({ samples: [] }),
  compute(s) {
    const readings = s.extra.samples || [];
    const n = readings.length;
    const mean = n > 0 ? readings.reduce((a, b) => a + b, 0) / n : 0;
    const absErr = n > 1 ? (Math.max(...readings) - Math.min(...readings)) / 2 : (n === 1 ? readings[0] * 0.01 : 0);
    const percentErr = mean !== 0 ? (absErr / Math.abs(mean)) * 100 : 0;
    const unit = { length: "cm", mass: "g", time: "s" }[s.quantity];
    const ruler = s.quantity === "length" ? (readings[n - 1] ?? 5.2) : 5.2;
    const stopwatch = s.quantity === "time" ? (readings[n - 1] ?? 1.5) : 1.5;
    const massDisp = s.quantity === "mass" ? (readings[n - 1] ?? 25) : 25;
    return {
      m: { n, mean, absErr, percentErr },
      scene: { ruler, stopwatch, mass: massDisp, mean, absErr, percentErr, n, unit },
      duration: null
    };
  },
  graph: {
    series(s, m) {
      const pts = (s.extra.samples || []).map((val, i) => ({ x: i + 1, y: val }));
      const meanLine = (s.extra.samples || []).map((val, i) => ({ x: i + 1, y: m.mean }));
      return [
        { points: pts, pointsOnly: true, color: "#ff4fd8", label: "Readings" },
        { points: meanLine, color: "#42ff80", label: "Mean" }
      ];
    },
    xLabel: "Trial number",
    yLabel: "Measured value"
  },
  actions: [
    { label: "➕ Add Reading", apply(s) { s.setExtra((e) => ({ samples: [...e.samples, measureSample(s.params.quantity, s.extra.samples.length)] })); } },
    { label: "🗑 Clear", apply(s) { s.setExtra((e) => ({ ...e, samples: [] })); } }
  ],
  procedure: [
    "Choose what you're measuring.",
    "Press Add Reading several times — each adds one trial.",
    "Watch the mean stabilise as n grows.",
    "Read absolute and percentage uncertainty.",
    "More trials → tighter, more trustworthy error."
  ],
  observation: "Individual trials wobble around the mean; the more readings you take, the more stable the mean and the smaller the relative error becomes.",
  conclusion: "A good measurement reports BOTH the mean AND its uncertainty: x = x̄ ± Δx, with %uncertainty = Δx/x̄ × 100.",
  explain: "Every measure has a wobble, like aiming darts. More darts reveal the centre and how sloppy you are — that sloppiness is the uncertainty.",
  uncertainty: "This lab is about uncertainty itself: report ± half the range and prefer 5+ trials. Watch outliers — they double your error.",
  runningHint: "Keep adding readings until the % uncertainty settles."
};

function measureSample(quantity, i) {
  const seed = Math.abs(Math.sin((i + 1) * 12.9898) * 43758.5453) % 1;
  if (quantity === "length") return 5.0 + Math.round((seed + (i % 12) * 0.15) * 10) / 10;
  if (quantity === "mass") return 25 + Math.round(seed * 20) / 10;
  return 1.4 + Math.round(seed * 15) / 100;
}

// ════════════════════════════════════════════════════════════════
// 38 · DIMENSIONAL ANALYSIS
// ════════════════════════════════════════════════════════════════
const dimensional = {
  id: "dimensional",
  number: "38",
  title: "Dimensional Analysis",
  topic: "Measurement",
  description: "Check whether physics equations are dimensionally consistent — a powerful error-detector.",
  objective: "Break equations into base dimensions (M, L, T) and judge if both sides match.",
  theory: [
    "Every physical quantity has an SI base dimension made from mass M, length L and time T.",
    "Both sides of a correct equation must carry identical dimensions — this catches algebra mistakes instantly.",
  ],
  formulas: [
    { text: "v = d/t", note: "[L·T⁻¹]" },
    { text: "F = ma", note: "[M·L·T⁻²]" },
    { text: "E = mc²", note: "[M·L²·T⁻²]" }
  ],
  unitsNote: "Dimension notation: M = kg, L = m, T = s. Check each side separately.",
  limitsNote: "Covers the core equations a Grade 9–12 student uses.",
  scene: "dimensional",
  controls: [
    { key: "eq", label: "Equation", type: "select", options: [
      { v: "vd", l: "v = d/t" },
      { v: "fma", l: "F = ma" },
      { v: "emc", l: "E = mc²" },
      { v: "ke", l: "KE = ½mv²" },
      { v: "pv", l: "P = F/A" },
      { v: "w", l: "W = Fd" },
      { v: "bad", l: "v² = 2ad (trial)" }
    ], def: "vd" }
  ],
  measures: [
    { key: "lhs", label: "LHS dimensions", unit: "" },
    { key: "rhs", label: "RHS dimensions", unit: "" },
    { key: "verdict", label: "Verdict", unit: "" }
  ],
  compute(s) {
    const dims = {
      vd: { lhs: "L·T⁻¹", rhs: "L·T⁻¹", ok: true },
      fma: { lhs: "M·L·T⁻²", rhs: "M·L·T⁻²", ok: true },
      emc: { lhs: "M·L²·T⁻²", rhs: "M·(L·T⁻²)·(L·T⁻²)·T²", ok: false },
      ke: { lhs: "M·L²·T⁻²", rhs: "M·L²·T⁻²", ok: true },
      pv: { lhs: "M·L⁻¹·T⁻²", rhs: "M·L·T⁻² / L²", ok: true },
      w: { lhs: "M·L²·T⁻²", rhs: "M·L·T⁻² · L", ok: true },
      bad: { lhs: "L²·T⁻²", rhs: "L·T⁻² · L = L²·T⁻²", ok: true }
    };
    const cfg = dims[s.eq];
    const eqText = { vd: "v = d/t", fma: "F = ma", emc: "E = mc²", ke: "KE = ½mv²", pv: "P = F/A", w: "W = Fd", bad: "v² = 2ad" }[s.eq];
    return {
      m: { lhs: cfg.lhs, rhs: cfg.rhs, verdict: cfg.ok ? "CORRECT DIMENSION" : "DIMENSIONAL ERROR" },
      scene: {
        equation: eqText,
        chips: [
          { label: "LHS", dim: cfg.lhs, ok: true },
          { label: "RHS", dim: cfg.rhs, ok: cfg.ok }
        ]
      },
      duration: null
    };
  },
  procedure: [
    "Pick an equation to inspect.",
    "Read the base dimensions of the left side.",
    "Read the base dimensions of the right side.",
    "Compare — they must match exactly.",
    "Try the 'trial' entry and see the system catch a trap."
  ],
  observation: "Equations like v = d/t and F = ma check out cleanly; dimensional mistakes become obvious when powers disagree.",
  conclusion: "Dimensional analysis is a fast sanity check: if LHS ≠ RHS in M, L and T powers, the equation is wrong.",
  explain: "Think of brick sizes — if one side of a recipe measures in 'bricks' and the other in 'brick-piles', the recipe is broken before you even cook.",
  uncertainty: "Dimensional analysis finds mismatched units but not wrong constants (factors of 2, π) — it cannot catch everything.",
  runningHint: "Watch out for the engineered 'trap' entry that looks plausible."
};

// ════════════════════════════════════════════════════════════════
// 39 · VECTOR ADDITION
// ════════════════════════════════════════════════════════════════
const vectorAddition = {
  id: "vectorAddition",
  number: "39",
  title: "Vector Addition",
  topic: "Mechanics",
  description: "Stack two or three vectors tip-to-tail and watch the resultant emerge.",
  objective: "Resolve vectors into components and combine them into a resultant magnitude and angle.",
  theory: [
    "A vector has magnitude and direction; it splits into x and y components at angle θ.",
    "Add component by component, then recombine: R = √(Rx² + Ry²), θ = tan⁻¹(Ry/Rx)."
  ],
  formulas: [
    { text: "Rx = Σ vᵢcosθᵢ,  Ry = Σ vᵢsinθᵢ", note: "components" },
    { text: "R = √(Rx² + Ry²)", note: "resultant magnitude" },
    { text: "θ = tan⁻¹(Ry/Rx)", note: "resultant direction" }
  ],
  unitsNote: "Arbitrary vector units; angles in degrees from +x axis.",
  limitsNote: "Magnitudes 1–20 units, angles 0–359°. Any number of vectors is supportable, we demo 2–3.",
  scene: "vectors",
  controls: [
    { key: "count", label: "Number of vectors", type: "segmented", options: [{ v: 2, l: "2" }, { v: 3, l: "3" }], def: 2 },
    { key: "v1m", label: "Vector 1 magnitude", min: 1, max: 20, step: 0.5, unit: "", def: 10 },
    { key: "v1a", label: "Vector 1 angle", min: 0, max: 359, step: 1, unit: "°", def: 30 },
    { key: "v2m", label: "Vector 2 magnitude", min: 1, max: 20, step: 0.5, unit: "", def: 8 },
    { key: "v2a", label: "Vector 2 angle", min: 0, max: 359, step: 1, unit: "°", def: 120 },
    { key: "v3m", label: "Vector 3 magnitude", min: 1, max: 20, step: 0.5, unit: "", def: 6 },
    { key: "v3a", label: "Vector 3 angle", min: 0, max: 359, step: 1, unit: "°", def: 200 }
  ],
  measures: [
    { key: "rx", label: "ΣF x-component", unit: "" },
    { key: "ry", label: "ΣF y-component", unit: "" },
    { key: "rmag", label: "Resultant magnitude", unit: "" },
    { key: "rang", label: "Resultant angle", unit: "°" }
  ],
  compute(s) {
    const vecs = [];
    for (let i = 1; i <= s.count; i++) {
      const m = s[`v${i}m`] || 1;
      const a = ((s[`v${i}a`] || 0) * D2R);
      vecs.push({ dx: m * Math.cos(a), dy: m * Math.sin(a), m, a: a * 180 / Math.PI });
    }
    const sumX = vecs.reduce((a, v) => a + v.dx, 0);
    const sumY = vecs.reduce((a, v) => a + v.dy, 0);
    const mag = Math.hypot(sumX, sumY);
    const angDeg = (Math.atan2(sumY, sumX) * 180 / Math.PI + 360) % 360;
    return {
      m: { rx: sumX, ry: sumY, rmag: mag, rang: angDeg },
      scene: { vectors: vecs, resultant: { dx: sumX, dy: sumY, mag, angle: angDeg, rad: angDeg * D2R }, sumX, sumY },
      duration: null
    };
  },
  procedure: [
    "Choose two (or three) vectors — magnitude and angle.",
    "Watch them stack tip-to-tail on the grid.",
    "Read the x and y components of each.",
    "Read the resultant's magnitude and angle.",
    "Try vectors that sum to zero — a closed triangle."
  ],
  observation: "Vectors pointing opposite ways cancel; the resultant is the straight line from tail of the first to tip of the last.",
  conclusion: "Vector addition is component-wise: R = √(Rx² + Ry²) at angle tan⁻¹(Ry/Rx).",
  explain: "Vectors are arrows. Walk 10 steps at 30° then 8 at 120° — your home-to-final arrow is the resultant, no matter the path you took.",
  uncertainty: "Protractor reading at ±1° on a 10-unit vector introduces ~0.2 units of component error.",
  runningHint: "Try count = 3 with vectors 120° apart for a balanced zero resultant."
};

// ════════════════════════════════════════════════════════════════
// 40 · PROJECTILE TARGET CHALLENGE
// ════════════════════════════════════════════════════════════════
const targetChallenge = {
  id: "targetChallenge",
  number: "40",
  title: "Projectile Target Challenge",
  topic: "Kinematics",
  description: "A game: dial in the right angle and speed to land a projectile on the target flag.",
  objective: "Apply projectile equations in a gamified aiming challenge with scored accuracy.",
  theory: [
    "Range on level ground is R = v²sin(2θ)/g.",
    "The same range can come from two complementary angles (θ and 90°−θ) — choose the flatter or loftier shot to taste."
  ],
  formulas: [
    { text: "R = v²sin(2θ)/g", note: "range (m)" },
    { text: "T = 2v sinθ/g", note: "flight time (s)" },
    { text: "H = v²sin²θ/(2g)", note: "max height (m)" }
  ],
  unitsNote: "v m/s, θ degrees, g m/s², distances m.",
  limitsNote: "Angle 10–80°, speed 10–60 m/s, gravity 1.6–15 m/s². Targets at 30–120 m.",
  scene: "targetChallenge",
  controls: [
    { key: "angle", label: "Launch angle", min: 10, max: 80, step: 1, unit: "°", def: 45 },
    { key: "speed", label: "Initial speed", min: 10, max: 60, step: 1, unit: "m/s", def: 30 },
    { key: "gravity", label: "Gravity", min: 1.6, max: 15, step: 0.1, unit: "m/s²", def: 9.8 }
  ],
  measures: [
    { key: "target", label: "Distance to target", unit: "m" },
    { key: "range", label: "Predicted range", unit: "m" },
    { key: "error", label: "Landing error", unit: "m" },
    { key: "attempt", label: "Attempts", unit: "" },
    { key: "score", label: "Best accuracy", unit: "%" }
  ],
  makeExtra: () => ({ target: 40 + Math.round(Math.random() * 80), fired: false, fireT: -1, hit: false, attempts: 0 }),
  compute(s) {
    const { angle, speed, gravity, t } = s;
    const rad = angle * D2R;
    const range = (speed * speed * Math.sin(2 * rad)) / gravity;
    const hMax = (speed * speed * Math.sin(rad) * Math.sin(rad)) / (2 * gravity);
    const T = (2 * speed * Math.sin(rad)) / gravity;
    const vx = speed * Math.cos(rad);
    const target = s.extra.target;
    const err = Math.abs(range - target);
    const accuracy = target > 0 ? Math.max(0, Math.min(100, 100 * (1 - err / target))) : 0;
    const predicted = [];
    for (let i = 0; i <= 40; i++) {
      const tt = (i / 40) * T;
      const d = vx * tt;
      const h = speed * Math.sin(rad) * tt - 0.5 * gravity * tt * tt;
      predicted.push([d, Math.max(0, h)]);
    }
    const actual = [...predicted];
    const landed = s.extra.fired ? clamp(s.extra.fireT / Math.max(T, 0.01), 0, 1) : -1;
    const hit = s.extra.hit;
    return {
      m: { target, range, error: err, attempt: s.extra.attempts, score: s.extra.hit ? accuracy : 0 },
      scene: { targetDist: target, predicted, actual, fireT: landed < 0 ? -1 : t, vx, angle, speed, range, error: err, hit, fired: s.extra.fired, hMax },
      duration: null
    };
  },
  graph: {
    series(s, m) {
      const { angle, speed, gravity } = s;
      const rad = angle * D2R;
      const T = (2 * speed * Math.sin(rad)) / gravity;
      const pts = [];
      // two complementary shots
      [45, angle].forEach((a, idx) => {
        const rr = (a * D2R);
        for (let i = 0; i <= 30; i++) {
          const tt = (i / 30) * T;
          pts.push({ x: speed * Math.cos(rr) * tt, y: speed * Math.sin(rr) * tt - 0.5 * gravity * tt * tt });
        }
      });
      return [{ points: pts, color: "#ff4fd8" }];
    },
    xLabel: "Distance (m)",
    yLabel: "Height (m)"
  },
  actions: [
    {
      label: "🎯 FIRE!",
      apply(ac) {
        const { angle, speed, gravity } = ac.params;
        const rad = angle * D2R;
        const range = (speed * speed * Math.sin(2 * rad)) / gravity;
        const target = ac.extra.target;
        const err = Math.abs(range - target);
        const tol = Math.max(2, target * 0.05);
        const hit = err <= tol;
        const attempts = ac.extra.attempts + 1;
        ac.setExtra((e) => ({ ...e, fired: true, fireT: 0, hit, attempts }));
        ac.setT(0);
        ac.setStarted(true);
        ac.setPhase("running");
        ac.setAttempts((n) => n + 1);
        ac.setLastFeedback(hit ? `🎯 HIT! Range ${range.toFixed(1)} m vs target ${target} m. Perfect shot in ${attempts} attempt(s).` : `Landing ${err.toFixed(1)} m ${range > target ? "past" : "short"} the target (target ${target} m). Try again!`);
      }
    }
  ],
  procedure: [
    "Read the target distance, then aim carefully.",
    "Choose an angle and speed whose range matches.",
    "Press FIRE and watch the projectile arcs.",
    "Aim again if you miss — the error readout guides you.",
    "Score 100 % accuracy for a clean hit."
  ],
  observation: "Steep or shallow angles can give the same range — pick the height you trust more and fine-tune by a few m/s.",
  conclusion: "Range R = v²sin(2θ)/g is the whole game: match the target distance and hit the flag.",
  explain: "It's the classic cannon puzzle: use the range equation to solve backwards from the target to the speed you need.",
  uncertainty: "The scoring tolerance is 5 % of the target distance; real artillery aims with ±0.1 % radar corrections.",
  runningHint: "Fix the angle at 45°, then adjust speed until the predicted range equals the flag distance."
};

export const genericExperiments = [
  seriesParallel,
  freeFall,
  friction,
  hooke,
  workEnergy,
  conservation,
  collision,
  centripetal,
  waveString,
  soundWave,
  lensExperiment,
  induction,
  magneticForce,
  rcCircuit,
  heatTransfer,
  idealGas,
  shm,
  doppler,
  orbit,
  planetFall,
  escapeVelocity,
  projectileAir,
  viscousFlow,
  buoyancy,
  pressureLiquids,
  bernoulli,
  motor,
  generator,
  solar,
  energyConversion,
  measurement,
  dimensional,
  vectorAddition,
  targetChallenge
];