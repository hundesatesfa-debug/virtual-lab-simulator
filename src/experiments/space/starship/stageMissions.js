import {
  setEngineState,
  setThrottle,
  setPitch,
  stepVehicle,
  getTelemetry,
} from "./starshipPhysics.js";

export function startBoosterBoostback(stack, pitchDeg = 150) {
  if (!stack.separated) {
    throw new Error("Booster must be separated first.");
  }

  const booster = stack.booster;

  if (booster.propellantMassKg <= 0) {
    throw new Error("Booster has no remaining propellant.");
  }

  setPitch(booster, pitchDeg);
  setEngineState(booster, true);
  setThrottle(booster, 0.75);

  booster.status = "BOOSTBACK BURN";
  stack.phase = "BOOSTER BOOSTBACK";

  recordMissionEvent(stack, "Booster boostback burn initiated.");
}

export function startBoosterDescent(stack) {
  setEngineState(stack.booster, false);
  setThrottle(stack.booster, 0);

  stack.booster.status = "ATMOSPHERIC DESCENT";
  stack.phase = "BOOSTER DESCENT";

  recordMissionEvent(stack, "Booster descent initiated.");
}

export function startBoosterLandingBurn(stack) {
  const booster = stack.booster;

  if (booster.propellantMassKg <= 0) {
    throw new Error("No booster landing propellant remains.");
  }

  setPitch(booster, 0);
  setEngineState(booster, true);
  setThrottle(booster, 1);

  booster.status = "LANDING BURN";
  stack.phase = "BOOSTER LANDING BURN";

  recordMissionEvent(stack, "Booster landing burn initiated.");
}

export function startStarshipOrbitalBurn(stack) {
  if (!stack.separated) {
    throw new Error("Starship must be separated first.");
  }

  const ship = stack.starship;

  if (ship.propellantMassKg <= 0) {
    throw new Error("Starship has no remaining propellant.");
  }

  setPitch(ship, 90);
  setEngineState(ship, true);
  setThrottle(ship, 1);

  ship.status = "ORBITAL INSERTION";
  stack.phase = "STARSHIP ORBITAL INSERTION";

  recordMissionEvent(stack, "Starship orbital insertion burn initiated.");
}

export function startStarshipCoast(stack) {
  setEngineState(stack.starship, false);

  stack.starship.status = "ORBITAL COAST";
  stack.phase = "STARSHIP COAST";

  recordMissionEvent(stack, "Starship engines shut down. Coasting.");
}

export function startStarshipRecoveryBurn(stack) {
  if (!stack.separated) {
    throw new Error("Starship must be separated first.");
  }

  const ship = stack.starship;

  if (ship.propellantMassKg <= 0) {
    throw new Error("Starship has no remaining propellant.");
  }

  setPitch(ship, 0);
  setEngineState(ship, true);
  setThrottle(ship, 1);

  ship.status = "RECOVERY BURN";
  stack.phase = "STARSHIP RECOVERY BURN";

  recordMissionEvent(stack, "Starship recovery burn initiated.");
}

export function setBoosterFlightControls(stack, { throttle, pitchDeg } = {}) {
  if (!stack.separated) {
    throw new Error("Booster must be separated first.");
  }

  if (Number.isFinite(throttle)) {
    setThrottle(stack.booster, throttle);
  }

  if (Number.isFinite(pitchDeg)) {
    setPitch(stack.booster, pitchDeg);
  }
}

export function setStarshipFlightControls(stack, { throttle, pitchDeg } = {}) {
  if (!stack.separated) {
    throw new Error("Starship must be separated first.");
  }

  if (Number.isFinite(throttle)) {
    setThrottle(stack.starship, throttle);
  }

  if (Number.isFinite(pitchDeg)) {
    setPitch(stack.starship, pitchDeg);
  }
}

export function advanceMission(stack, dt) {
  if (!stack.separated) {
    throw new Error("Stages have not separated.");
  }

  stepVehicle(stack.booster, dt);
  stepVehicle(stack.starship, dt);

  stack.missionTime += dt;

  return {
    booster: getTelemetry(stack.booster),
    starship: getTelemetry(stack.starship),
    missionTime: stack.missionTime,
  };
}

export function recordMissionEvent(stack, message) {
  stack.events.push({
    time: stack.missionTime,
    message,
  });
}
