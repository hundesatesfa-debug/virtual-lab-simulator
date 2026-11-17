
import {
  createVehicle,
  stepVehicle,
  setEngineState,
  setThrottle,
  setPitch,
  getTelemetry,
} from "./starshipPhysics.js";

import {
  SUPER_HEAVY_CONFIG,
  STARSHIP_CONFIG,
} from "./starshipVehicles.js";

function copyFlightState(source, destination) {
  destination.position = { ...source.position };
  destination.velocity = { ...source.velocity };
  destination.acceleration = { ...source.acceleration };

  destination.elapsedTime = source.elapsedTime;
  destination.maxAltitude = source.maxAltitude;
  destination.maxDynamicPressure = source.maxDynamicPressure;
  destination.dynamicPressure = source.dynamicPressure;
  destination.gravity = source.gravity;
}

/**
 * Create the complete fueled launch stack.
 *
 * During initial ascent, the booster engine system
 * accelerates the combined mass of both vehicles.
 */
export function createLaunchStack({
  boosterFuelPercent = 100,
  starshipFuelPercent = 100,
} = {}) {
  const boosterFuelMass =
    SUPER_HEAVY_CONFIG.propellantMassKg *
    Math.max(0, Math.min(100, boosterFuelPercent)) / 100;
  const starshipFuelMass =
    STARSHIP_CONFIG.propellantMassKg *
    Math.max(0, Math.min(100, starshipFuelPercent)) / 100;
  const booster = createVehicle({
    ...SUPER_HEAVY_CONFIG,
    propellantMassKg: boosterFuelMass,
  });
  const starship = createVehicle({
    ...STARSHIP_CONFIG,
    propellantMassKg: starshipFuelMass,
  });

  const ascentVehicle = createVehicle({
    name: "Complete Starship Launch Stack",

    // Both dry masses plus Starship's own propellant.
    dryMassKg:
      SUPER_HEAVY_CONFIG.dryMassKg +
      STARSHIP_CONFIG.dryMassKg +
      starshipFuelMass,

    // Only booster propellant is consumed during this phase.
    propellantMassKg: boosterFuelMass,

    engines: SUPER_HEAVY_CONFIG.engines,

    dragCoefficient: 0.45,
    referenceArea: 80,
  });

  return {
    booster,
    starship,
    ascentVehicle,
    starshipPropellantMassKg: starshipFuelMass,

    separated: false,
    missionTime: 0,

    phase: "PAD",

    events: [
      {
        time: 0,
        message: "Launch stack initialized.",
      },
    ],
  };
}

/**
 * Ignite the booster engines.
 */
export function igniteBooster(stack) {
  if (stack.separated) {
    throw new Error("Booster has already separated.");
  }

  setEngineState(stack.ascentVehicle, true);
  setThrottle(stack.ascentVehicle, 1);

  stack.phase = "POWERED ASCENT";

  stack.events.push({
    time: stack.missionTime,
    message: "Super Heavy engines ignited.",
  });
}

/**
 * Control launch-stack throttle.
 */
export function setStackThrottle(stack, throttle) {
  if (stack.separated) return;

  setThrottle(stack.ascentVehicle, throttle);
}

/**
 * Control launch-stack pitch.
 */
export function setStackPitch(stack, pitchDeg) {
  if (stack.separated) return;

  setPitch(stack.ascentVehicle, pitchDeg);
}

/**
 * Advance the combined vehicle during ascent.
 */
export function stepLaunchStack(stack, dt) {
  if (stack.separated) {
    return stack;
  }

  stepVehicle(stack.ascentVehicle, dt);

  stack.missionTime += dt;

  // Keep both stage representations synchronized
  // while they remain physically attached.
  copyFlightState(stack.ascentVehicle, stack.booster);
  copyFlightState(stack.ascentVehicle, stack.starship);

  stack.booster.propellantMassKg =
    stack.ascentVehicle.propellantMassKg;

  stack.booster.totalMassKg =
    stack.booster.dryMassKg +
    stack.booster.propellantMassKg;

  // Starship fuel remains untouched during booster ascent.
  stack.starship.propellantMassKg =
    stack.starshipPropellantMassKg;

  stack.starship.totalMassKg =
    STARSHIP_CONFIG.dryMassKg +
    stack.starshipPropellantMassKg;

  if (stack.ascentVehicle.fuelDepleted) {
    stack.phase = "BOOSTER FUEL DEPLETED";
  }

  return stack;
}

/**
 * Separate the two stages.
 *
 * Both vehicles inherit the same position and velocity
 * at the instant of separation.
 */
export function separateStages(stack) {
  if (stack.separated) {
    throw new Error("Stages are already separated.");
  }

  const ascent = stack.ascentVehicle;

  if (ascent.position.y <= 0) {
    throw new Error("Cannot stage while on the launch pad.");
  }

  setEngineState(ascent, false);

  copyFlightState(ascent, stack.booster);
  copyFlightState(ascent, stack.starship);

  stack.booster.propellantMassKg =
    ascent.propellantMassKg;

  stack.booster.totalMassKg =
    stack.booster.dryMassKg +
    stack.booster.propellantMassKg;

  // Starship retains its own independent fuel supply.
  stack.starship.propellantMassKg =
    stack.starshipPropellantMassKg;

  stack.starship.totalMassKg =
    STARSHIP_CONFIG.dryMassKg +
    stack.starshipPropellantMassKg;

  stack.booster.status = "STAGE SEPARATED";
  stack.starship.status = "STAGE SEPARATED";

  stack.separated = true;
  stack.phase = "STAGE SEPARATION";

  stack.events.push({
    time: stack.missionTime,
    message: "Hot staging: Starship separated from Super Heavy.",
  });

  return {
    booster: stack.booster,
    starship: stack.starship,
  };
}

/**
 * Independently advance either stage after separation.
 */
export function stepSeparatedVehicles(stack, dt) {
  if (!stack.separated) {
    throw new Error("Separate the stages first.");
  }

  stepVehicle(stack.booster, dt);
  stepVehicle(stack.starship, dt);

  stack.missionTime += dt;

  return stack;
}

/**
 * Read the launch stack's live telemetry.
 */
export function getStackTelemetry(stack) {
  return {
    phase: stack.phase,
    missionTime: stack.missionTime,
    separated: stack.separated,

    booster: getTelemetry(
      stack.separated ? stack.booster : stack.ascentVehicle
    ),

    starship: getTelemetry(stack.starship),

    events: [...stack.events],
  };
}
