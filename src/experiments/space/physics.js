import * as THREE from "three";
import {
  ROCKET_DEFAULTS,
  ATM_SCALE,
  DRAG_K,
  EARTH_RADIUS,
  ISS_ORBIT_R,
  MARS_ORBIT_R,
  MOON_ORBIT_R,
  MOON_RADIUS,
  MARS_RADIUS,
  MU_EARTH,
  MU_MOON,
  MU_MARS,
  OMEGA_ISS,
  OMEGA_MARS,
  OMEGA_MOON,
  MISSION_TYPES
} from "./constants.js";

const tmp = new THREE.Vector3();
const tmp2 = new THREE.Vector3();

export function bodyPosition(orbitR, omega, phase, t, yUp = true) {
  const angle = omega * t + phase;
  const x = orbitR * Math.cos(angle);
  const z = orbitR * Math.sin(angle);
  return yUp ? new THREE.Vector3(x, 0, z) : new THREE.Vector3(x, z, 0);
}

export function atmosphereDensity(altitude) {
  if (altitude <= 0) return 1;
  return Math.exp(-altitude / ATM_SCALE);
}

function normalizeFuelShare(a, b, c) {
  const s = a + b + c;
  if (s <= 0) return [1 / 3, 1 / 3, 1 / 3];
  return [a / s, b / s, c / s];
}

export function createInitialState(params) {
  const {
    missionType,
    launchAngleDeg,
    launchTimePhase,
    fuelAllocation,
    payloadWeight,
    rocketConfig
  } = params;

  const rc = {
    ...ROCKET_DEFAULTS,
    ...rocketConfig,
    visual: {
      ...ROCKET_DEFAULTS.visual,
      ...(rocketConfig?.visual || {}),
      colors: { ...ROCKET_DEFAULTS.visual.colors, ...(rocketConfig?.visual?.colors || {}) }
    }
  };
  const vis = rc.visual;
  const u = rc.stageThrustPct ?? [100, 100, 100];
  const thrustBase = [11, 7.2, 4.8];
  const thrustPerStage = thrustBase.map((t, i) => t * ((u[i] ?? 100) / 100));

  const share = normalizeFuelShare(
    rc.stageFuelShare?.[0] ?? 40,
    rc.stageFuelShare?.[1] ?? 35,
    rc.stageFuelShare?.[2] ?? 25
  );

  const launchRad = (launchAngleDeg * Math.PI) / 180;
  const pad = new THREE.Vector3(EARTH_RADIUS, 0, 0);
  const radial = pad.clone().normalize();
  const tangent = new THREE.Vector3(0, 1, 0).cross(radial).normalize();
  const velDir = new THREE.Vector3()
    .addScaledVector(radial, Math.sin(launchRad))
    .addScaledVector(tangent, Math.cos(launchRad))
    .normalize();

  const len = vis.lengthScale ?? 1;
  const wid = vis.widthScale ?? 1;
  const baseMass = 1.2 + payloadWeight * 0.08 + (len - 1) * 0.12 + (wid - 1) * 0.18;
  const fuelTotal = 0.35 + fuelAllocation * 0.45;

  return {
    t: 0,
    pos: pad.clone(),
    vel: new THREE.Vector3(0, 0, 0),
    heading: velDir.clone(),
    heat: 0,
    missionType,
    launchAngleDeg,
    launchTimePhase,
    fuel: fuelTotal,
    fuelMax: fuelTotal,
    dryMass: baseMass * 0.35,
    mass: baseMass + fuelTotal,
    payloadWeight,
    stage: 1,
    stageSeparationAuto: true,
    /** Absolute thrust acceleration term per stage (before / mass) */
    thrustScale: thrustPerStage,
    stageFuelShare: share,
    dragCoeff: rc.dragCoeff ?? 1,
    rocketVisual: vis,
    thrustOn: false,
    phaseISS: launchTimePhase * Math.PI * 2,
    phaseMoon: launchTimePhase * Math.PI * 2 + 0.7,
    phaseMars: launchTimePhase * Math.PI * 2 + 2.1,
    autoStabilize: true,
    correctionFuel: 0.12 + fuelAllocation * 0.08,
    status: "planning",
    failureReason: "",
    dockProgress: 0,
    landed: false,
    trajectoryLog: [],
    ghostPoints: [],
    replayFrames: [],
    lastTrailTime: 0
  };
}

export function computeSuccessProbability(params) {
  const { missionType, launchAngleDeg, launchTimePhase, fuelAllocation, payloadWeight } = params;
  const idealAngle = missionType === MISSION_TYPES.station ? 52 : missionType === MISSION_TYPES.mars ? 48 : 45;
  const angleScore = Math.cos(((launchAngleDeg - idealAngle) * Math.PI) / 180);
  const windowScore = Math.cos((launchTimePhase - 0.22) * Math.PI * 2);
  const fuelScore = 0.55 + fuelAllocation * 0.4;
  const payloadPenalty = Math.max(0, 1 - payloadWeight * 0.06);
  let p = 42 + 18 * angleScore + 14 * windowScore + 16 * fuelScore;
  p *= payloadPenalty;
  if (missionType === MISSION_TYPES.mars) p -= 6;
  if (missionType === MISSION_TYPES.moonLand) p -= 4;
  return Math.max(8, Math.min(96, Math.round(p)));
}

export function predictTrajectory(state, duration = 28, steps = 220) {
  const points = [];
  const dt = duration / steps;
  let pos = state.pos.clone();
  let vel = state.heading.clone().multiplyScalar(0.06);
  const thrustDir = state.heading.clone();
  const idx = Math.min(2, Math.max(0, state.stage - 1));
  const thrustMag = state.thrustScale[idx] ?? 9.5;

  for (let i = 0; i < steps; i++) {
    points.push(pos.clone());
    const accel = gravityAt(pos, state.t + i * dt, {
      phaseMoon: state.phaseMoon,
      phaseMars: state.phaseMars
    });
    const stillBoost = i * dt < 9 && state.fuel > 0.002;
    if (stillBoost) {
      accel.addScaledVector(thrustDir, thrustMag / state.mass);
    }
    vel.addScaledVector(accel, dt);
    pos.addScaledVector(vel, dt);
    if (pos.length() < EARTH_RADIUS * 0.98) break;
  }
  return points;
}

function gravityAt(pos, time, phases = {}) {
  const { phaseMoon = 0, phaseMars = 0 } = phases;
  const acc = new THREE.Vector3(0, 0, 0);
  const r = pos.length();
  acc.addScaledVector(pos, -MU_EARTH / (r * r * r));

  const moon = bodyPosition(MOON_ORBIT_R, OMEGA_MOON, phaseMoon, time);
  tmp.copy(pos).sub(moon);
  const dm = tmp.length();
  if (dm > 0.05) acc.addScaledVector(tmp, -MU_MOON / (dm * dm * dm));

  const mars = bodyPosition(MARS_ORBIT_R, OMEGA_MARS, phaseMars, time);
  tmp.copy(pos).sub(mars);
  const dM = tmp.length();
  if (dM > 0.08) acc.addScaledVector(tmp, -MU_MARS / (dM * dM * dM));

  return acc;
}

export function interceptHint(state) {
  const iss = bodyPosition(ISS_ORBIT_R, OMEGA_ISS, state.phaseISS, state.t);
  const moon = bodyPosition(MOON_ORBIT_R, OMEGA_MOON, state.phaseMoon, state.t);
  const mars = bodyPosition(MARS_ORBIT_R, OMEGA_MARS, state.phaseMars, state.t);
  const map = {
    [MISSION_TYPES.station]: iss,
    [MISSION_TYPES.moonOrbit]: moon,
    [MISSION_TYPES.moonLand]: moon,
    [MISSION_TYPES.mars]: mars
  };
  return map[state.missionType].clone();
}

export function stepSimulation(state, dt, controls) {
  const {
    thrustRequested,
    manualStageSep,
    rotateYaw,
    correctionBurn,
    timeWarp
  } = controls;
  const warp = timeWarp || 1;
  const hdt = dt * warp;

  if (state.status !== "flight" && state.status !== "approach") {
    return;
  }

  state.t += hdt;

  const pos = state.pos;
  const vel = state.vel;

  const altitude = pos.length() - EARTH_RADIUS;
  const air = atmosphereDensity(Math.max(0, altitude));

  const acc = gravityAt(pos, state.t, {
    phaseMoon: state.phaseMoon,
    phaseMars: state.phaseMars
  });

  const speed = vel.length();
  const dragMult = (state.dragCoeff ?? 1) * (state.rocketVisual?.widthScale ?? 1) * 0.92 + 0.08;
  if (altitude < 0.35 && speed > 0.02) {
    tmp.copy(vel).normalize();
    acc.addScaledVector(tmp, (-DRAG_K * dragMult * air * speed * speed) / Math.max(state.mass, 0.1));
  }

  state.heat = Math.min(
    1,
    state.heat * 0.985 + air * speed * speed * 0.0008 * hdt * 60
  );

  if (state.heat > 0.92 && altitude < 0.25 && missionNeedsAtmosphere(state)) {
    state.status = "failed";
    state.failureReason =
      "Thermal limit exceeded during ascent. Your ascent angle was too shallow or speed too high in dense air.";
    return;
  }

  const thrustActive =
    thrustRequested && state.fuel > 0 && state.stage <= 3;

  if (thrustActive) {
    const stageIdx = state.stage - 1;
    const baseThrust = state.thrustScale[stageIdx] ?? 8;
    const share = state.stageFuelShare ?? [1 / 3, 1 / 3, 1 / 3];
    const shareFactor = (1 / 3) / Math.max(0.12, share[stageIdx] ?? 1 / 3);
    const burnRate = 0.045 * (state.stage === 1 ? 1.2 : 1) * warp * shareFactor;
    if (state.fuel > 0) {
      state.fuel = Math.max(0, state.fuel - burnRate * hdt);
      state.mass = state.dryMass + state.payloadWeight * 0.08 + state.fuel;
      const dir = state.heading.clone().normalize();
      acc.addScaledVector(dir, baseThrust / Math.max(state.mass, 0.08));
    }
  }

  if (correctionBurn && state.correctionFuel > 0 && state.stage >= 2) {
    const burn = Math.min(state.correctionFuel, 0.015 * hdt * warp);
    state.correctionFuel -= burn;
    const target = interceptHint(state);
    tmp.copy(target).sub(pos).normalize();
    acc.addScaledVector(tmp, (420 * burn) / Math.max(state.mass, 0.1));
  }

  if (state.autoStabilize && state.stage >= 2) {
    const target = interceptHint(state);
    tmp.copy(target).sub(pos).normalize();
    state.heading.lerp(tmp, 0.08 * warp);
    state.heading.normalize();
  } else if (rotateYaw !== 0) {
    state.heading.applyAxisAngle(new THREE.Vector3(0, 1, 0), rotateYaw * hdt * 0.9);
    state.heading.normalize();
  }

  vel.addScaledVector(acc, hdt);
  pos.addScaledVector(vel, hdt);

  if (manualStageSep && state.stage < 3) {
    state.stage += 1;
    state.mass *= 0.92;
    state.dryMass *= 0.9;
  }

  if (state.stageSeparationAuto) {
    if (state.stage === 1 && altitude > 0.22 && speed > 1.1) {
      state.stage = 2;
      state.mass *= 0.88;
      state.dryMass *= 0.88;
    } else if (state.stage === 2 && altitude > 0.55 && pos.length() > EARTH_RADIUS + 0.48) {
      state.stage = 3;
      state.mass *= 0.9;
      state.dryMass *= 0.9;
    }
  }

  if (state.fuel <= 0 && state.stage >= 3 && pos.length() > EARTH_RADIUS + 0.2 && speed < 0.35) {
    state.failureReason = state.failureReason || "Propellant depleted before completing the rendezvous.";
  }

  evaluateMission(state);

  state.lastTrailTime += hdt;
  if (state.lastTrailTime > 0.12) {
    state.lastTrailTime = 0;
    state.trajectoryLog.push(pos.clone());
    if (state.trajectoryLog.length > 420) state.trajectoryLog.shift();
  }
}

function missionNeedsAtmosphere(state) {
  return state.missionType !== MISSION_TYPES.station || state.t < 40;
}

function evaluateMission(state) {
  const pos = state.pos;
  const vel = state.vel;
  const r = pos.length();
  const v = vel.length();

  const iss = bodyPosition(ISS_ORBIT_R, OMEGA_ISS, state.phaseISS, state.t);
  const moon = bodyPosition(MOON_ORBIT_R, OMEGA_MOON, state.phaseMoon, state.t);
  const mars = bodyPosition(MARS_ORBIT_R, OMEGA_MARS, state.phaseMars, state.t);

  const relIss = tmp.copy(pos).sub(iss);
  const relMoon = tmp2.copy(pos).sub(moon);
  const relMars = tmp.copy(pos).sub(mars);

  if (state.status === "failed" || state.status === "success") return;

  if (r < EARTH_RADIUS * 0.96 && state.t > 3) {
    state.status = "failed";
    state.failureReason = "Impact with Earth. Velocity was insufficient for orbit or re-entry was uncontrolled.";
    return;
  }

  switch (state.missionType) {
    case MISSION_TYPES.station: {
      const d = relIss.length();
      const issVel = new THREE.Vector3(-OMEGA_ISS * iss.z, 0, OMEGA_ISS * iss.x);
      const relV = vel.clone().sub(issVel);
      if (d < 0.16 && relV.length() < 0.22) {
        state.dockProgress = Math.min(1, state.dockProgress + 0.055);
        state.status = "approach";
        if (state.dockProgress >= 1) {
          state.status = "success";
          state.failureReason = "";
        }
      }
      if (d < 0.35 && relV.length() > 0.55) {
        state.status = "failed";
        state.failureReason =
          "Closing velocity too high for docking. Match station speed and tangent direction.";
      }
      break;
    }
    case MISSION_TYPES.moonOrbit: {
      const d = relMoon.length();
      if (d < MOON_RADIUS + 0.55 && d > MOON_RADIUS + 0.06 && v < 0.55 && v > 0.05) {
        state.status = "success";
      }
      if (d < MOON_RADIUS * 1.02 && v > 0.55) {
        state.status = "failed";
        state.failureReason = "Lunar impact at excessive speed. Brake earlier in approach.";
      }
      break;
    }
    case MISSION_TYPES.moonLand: {
      const d = relMoon.length();
      if (d < MOON_RADIUS + 0.06 && v < 0.09) {
        state.status = "success";
        state.landed = true;
      }
      if (d < MOON_RADIUS + 0.04 && v >= 0.09) {
        state.status = "failed";
        state.failureReason = "Hard landing on the Moon. Reduce vertical speed during final descent.";
      }
      break;
    }
    case MISSION_TYPES.mars: {
      const d = relMars.length();
      if (d < MARS_RADIUS + 0.75 && d > MARS_RADIUS + 0.1 && v < 0.48) {
        state.status = "success";
      }
      if (d < MARS_RADIUS * 1.05 && v > 0.62) {
        state.status = "failed";
        state.failureReason = "Mars entry too fast. Use a longer transfer and correction burns.";
      }
      break;
    }
    default:
      break;
  }

  if (r > 28 && state.t > 30 && state.missionType !== MISSION_TYPES.mars && state.missionType !== MISSION_TYPES.station) {
    state.status = "failed";
    state.failureReason =
      "You are on an escape trajectory away from the Earth–Moon system. Check launch timing and thrust profile.";
  }
}

export function explainFailure(code, state) {
  if (state.failureReason) return state.failureReason;
  if (code === "early")
    return "You launched too early. The target moved out of alignment before intercept.";
  if (code === "late")
    return "You launched too late. The target is now ahead of your transfer plane.";
  if (code === "fuel") return "Your velocity was insufficient for orbit because fuel ran out too soon.";
  return "Mission parameters did not satisfy orbital constraints.";
}

export function gravitationalInfluence(pos) {
  const r = pos.length();
  const earth = MU_EARTH / (r * r);
  return { earth };
}
