/**
 * Guidance Computer for Starship Launch and Orbital Insertion
 * 
 * Implements:
 * - Gravity turn autopilot
 * - Max Q throttle management
 * - Target orbit guidance
 * - Trajectory prediction
 */

import { PHYSICS, calculateOrbitalElements } from "./starshipPhysics.js";

/**
 * Gravity turn guidance algorithm.
 * 
 * Gradually pitches vehicle from vertical to horizontal during ascent.
 * The turn rate depends on altitude and velocity.
 * 
 * @param {Object} vehicle - Vehicle state
 * @param {Object} options - Guidance parameters
 * @returns {number} Commanded pitch angle in degrees
 */
export function calculateGravityTurnPitch(vehicle, options = {}) {
  const {
    turnStartAltitude = 1000,      // meters - start turn after clearing tower
    turnEndAltitude = 70000,       // meters - complete turn by 70 km
    maxPitchRate = 2.0,            // degrees per second
    targetOrbitAltitude = 200000,  // meters - LEO insertion altitude
  } = options;

  const altitude = vehicle.position.y;
  const velocity = vehicle.velocity;
  const speed = Math.hypot(velocity.x, velocity.y);

  // Before turn start: stay vertical
  if (altitude < turnStartAltitude) {
    return 0; // Vertical
  }

  // After turn complete: maintain horizontal
  if (altitude >= turnEndAltitude) {
    return 90; // Horizontal
  }

  // During turn: interpolate based on altitude
  const turnProgress = (altitude - turnStartAltitude) / (turnEndAltitude - turnStartAltitude);
  
  // Use a smooth S-curve for more realistic gravity turn
  const smoothProgress = 3 * turnProgress ** 2 - 2 * turnProgress ** 3;
  
  // Target pitch angle
  const targetPitch = smoothProgress * 90;

  // Limit rate of change
  const currentPitch = vehicle.pitchDeg;
  const maxDelta = maxPitchRate * 0.05; // Assuming 50ms update rate
  
  const deltaPitch = targetPitch - currentPitch;
  const limitedDelta = Math.max(-maxDelta, Math.min(maxDelta, deltaPitch));

  return currentPitch + limitedDelta;
}

/**
 * Max Q throttle management.
 * 
 * Reduces throttle when approaching/exceeding maximum dynamic pressure
 * to prevent structural damage.
 * 
 * @param {Object} vehicle - Vehicle state
 * @param {Object} options - Throttle parameters
 * @returns {number} Commanded throttle (0-1)
 */
export function calculateMaxQThrottle(vehicle, options = {}) {
  const {
    maxQLimit = 50000,           // Pa - maximum allowed dynamic pressure
    throttleDownMargin = 0.85,   // Start throttling at 85% of limit
    minThrottle = 0.5,           // Minimum throttle during Max Q
    normalThrottle = 1.0,        // Normal full throttle
  } = options;

  const q = vehicle.dynamicPressure;
  const qThreshold = maxQLimit * throttleDownMargin;

  // Below threshold: full throttle
  if (q < qThreshold) {
    return normalThrottle;
  }

  // Above limit: minimum throttle
  if (q >= maxQLimit) {
    return minThrottle;
  }

  // Transitioning: interpolate between normal and minimum
  const excessRatio = (q - qThreshold) / (maxQLimit - qThreshold);
  return normalThrottle - excessRatio * (normalThrottle - minThrottle);
}

/**
 * Combined autopilot guidance.
 * 
 * Integrates gravity turn and Max Q throttle management.
 * 
 * @param {Object} vehicle - Vehicle state
 * @param {Object} options - Guidance options
 * @returns {Object} Commanded pitch and throttle
 */
export function calculateAutopilotGuidance(vehicle, options = {}) {
  const {
    enableGravityTurn = true,
    enableMaxQThrottle = true,
    ...guidanceOptions
  } = options;

  let commandedPitch = vehicle.pitchDeg;
  let commandedThrottle = vehicle.throttle;

  if (enableGravityTurn) {
    commandedPitch = calculateGravityTurnPitch(vehicle, guidanceOptions);
  }

  if (enableMaxQThrottle) {
    commandedThrottle = calculateMaxQThrottle(vehicle, guidanceOptions);
  }

  return {
    pitch: commandedPitch,
    throttle: commandedThrottle,
    gravityTurnActive: enableGravityTurn && vehicle.position.y >= 1000 && vehicle.position.y < 70000,
    maxQThrottleActive: enableMaxQThrottle && vehicle.dynamicPressure >= 42500, // 85% of 50 kPa
  };
}

/**
 * Predict trajectory for next N seconds.
 * 
 * Simulates forward in time without modifying vehicle state.
 * Useful for trajectory visualization and guidance decisions.
 * 
 * @param {Object} vehicle - Current vehicle state (will not be modified)
 * @param {number} duration - Seconds to predict forward
 * @param {number} timeStep - Simulation step size
 * @returns {Array} Array of {time, x, y, vx, vy} waypoints
 */
export function predictTrajectory(vehicle, duration = 60, timeStep = 1.0) {
  // Clone vehicle to avoid modifying original
  const clone = {
    ...vehicle,
    position: { ...vehicle.position },
    velocity: { ...vehicle.velocity },
    acceleration: { ...vehicle.acceleration },
    engines: { ...vehicle.engines },
  };

  const waypoints = [];
  let time = 0;

  // Simple ballistic prediction (engines off, drag considered)
  // For more accuracy, could import and use stepVehicle
  while (time < duration && clone.position.y >= 0) {
    waypoints.push({
      time,
      x: clone.position.x,
      y: clone.position.y,
      vx: clone.velocity.x,
      vy: clone.velocity.y,
    });

    // Simplified integration (no thrust, basic gravity)
    const radius = PHYSICS.EARTH_RADIUS + Math.max(0, clone.position.y);
    const gravity = PHYSICS.MU / (radius * radius);

    // Polar coordinate accelerations (simplified, no drag)
    const radialAccel = (clone.velocity.x ** 2 / radius) - gravity;
    const tangentialAccel = -(clone.velocity.y * clone.velocity.x / radius);

    clone.velocity.y += radialAccel * timeStep;
    clone.velocity.x += tangentialAccel * timeStep;

    clone.position.x += (PHYSICS.EARTH_RADIUS / radius) * clone.velocity.x * timeStep;
    clone.position.y += clone.velocity.y * timeStep;

    time += timeStep;

    // Safety limit
    if (waypoints.length > 1000) break;
  }

  return waypoints;
}

/**
 * Calculate required delta-V to reach target orbit.
 * 
 * @param {Object} currentState - Current vehicle state
 * @param {Object} targetOrbit - Target orbit parameters
 * @returns {Object} Delta-V requirements and guidance
 */
export function calculateOrbitalInsertionGuidance(currentState, targetOrbit = {}) {
  const {
    targetAltitude = 200000,     // meters - target orbital altitude
    targetEccentricity = 0,      // 0 = circular
  } = targetOrbit;

  const currentAltitude = currentState.position.y;
  const currentOrbital = calculateOrbitalElements(currentState);

  const targetRadius = PHYSICS.EARTH_RADIUS + targetAltitude;
  const circularVelocity = Math.sqrt(PHYSICS.MU / targetRadius);

  const currentSpeed = Math.hypot(currentState.velocity.x, currentState.velocity.y);
  const horizontalVelocity = currentState.velocity.x;

  // Simple delta-V estimate (assumes current altitude ≈ target altitude)
  const requiredDeltaV = circularVelocity - horizontalVelocity;

  const guidance = {
    targetCircularVelocity: circularVelocity,
    currentHorizontalVelocity: horizontalVelocity,
    requiredDeltaV,
    burnDirection: requiredDeltaV > 0 ? "PROGRADE" : "RETROGRADE",
    altitudeError: targetAltitude - currentAltitude,
    isInTargetOrbit: currentOrbital.orbitPossible && 
                     Math.abs(currentOrbital.periapsisAltitude - targetAltitude) < 10000 &&
                     Math.abs(currentOrbital.apoapsisAltitude - targetAltitude) < 10000,
  };

  return guidance;
}

/**
 * Determine optimal staging point based on current trajectory.
 * 
 * @param {Object} vehicle - Current combined vehicle state
 * @param {number} boosterFuelRemaining - Remaining booster propellant fraction
 * @returns {Object} Staging recommendation
 */
export function calculateStagingGuidance(vehicle, boosterFuelRemaining) {
  const altitude = vehicle.position.y;
  const speed = Math.hypot(vehicle.velocity.x, vehicle.velocity.y);
  const dynamicPressure = vehicle.dynamicPressure;

  // Staging criteria (educational approximations)
  const minAltitude = 50000;           // 50 km minimum
  const maxDynamicPressure = 5000;     // 5 kPa max during staging
  const minSpeed = 1500;               // 1.5 km/s minimum velocity
  const fuelThreshold = 0.05;          // Stage when < 5% fuel remains

  const shouldStage = 
    altitude >= minAltitude &&
    dynamicPressure <= maxDynamicPressure &&
    speed >= minSpeed &&
    boosterFuelRemaining <= fuelThreshold;

  return {
    shouldStage,
    ready: altitude >= minAltitude && dynamicPressure <= maxDynamicPressure,
    altitude,
    speed,
    dynamicPressure,
    fuelRemaining: boosterFuelRemaining,
    reason: shouldStage 
      ? "Staging criteria met"
      : !ready
        ? "Awaiting safe staging conditions"
        : "Awaiting fuel depletion",
  };
}

/**
 * Landing guidance for booster return.
 * 
 * @param {Object} booster - Booster vehicle state
 * @param {Object} landingSite - Target landing coordinates
 * @returns {Object} Landing burn guidance
 */
export function calculateLandingGuidance(booster, landingSite = { x: 0, y: 0 }) {
  const altitude = booster.position.y;
  const verticalVelocity = booster.velocity.y;
  const downrange = booster.position.x - landingSite.x;

  const g = booster.gravity || 9.81;
  const thrust = booster.engines.thrustN * booster.engines.count;
  const mass = booster.totalMassKg;
  
  // Maximum deceleration available
  const maxAccel = (thrust / mass) - g;

  // Time to impact at current velocity (if no thrust)
  const timeToImpact = verticalVelocity < 0 
    ? altitude / Math.abs(verticalVelocity)
    : Infinity;

  // Required deceleration to stop at surface
  const requiredDecel = verticalVelocity < 0
    ? (verticalVelocity ** 2) / (2 * altitude)
    : 0;

  // Suicide burn altitude (latest safe ignition point)
  const suicideBurnAltitude = maxAccel > 0
    ? (verticalVelocity ** 2) / (2 * maxAccel)
    : 0;

  const shouldStartLandingBurn = 
    altitude <= suicideBurnAltitude * 1.2 && // 20% safety margin
    verticalVelocity < -10 && // Descending at > 10 m/s
    booster.propellantMassKg > 0;

  return {
    shouldStartLandingBurn,
    altitude,
    verticalVelocity,
    downrange,
    timeToImpact,
    suicideBurnAltitude,
    requiredThrottle: maxAccel > 0 ? Math.min(1.0, requiredDecel / maxAccel) : 1.0,
    withinCatchZone: Math.abs(downrange) < 1000 && altitude < 100,
  };
}

/**
 * Generate human-readable guidance message.
 * 
 * @param {Object} vehicle - Vehicle state
 * @param {string} phase - Mission phase
 * @returns {string} Guidance message
 */
export function getGuidanceMessage(vehicle, phase) {
  const altitude = vehicle.position.y;
  const speed = Math.hypot(vehicle.velocity.x, vehicle.velocity.y);
  
  if (phase === "POWERED ASCENT") {
    if (altitude < 1000) {
      return "Tower clear. Initiating gravity turn.";
    } else if (altitude < 10000) {
      return "Approaching Max Q. Monitor dynamic pressure.";
    } else if (altitude < 30000) {
      return "Max Q passed. Continuing ascent.";
    } else if (altitude < 70000) {
      return "Completing gravity turn. Approaching staging.";
    } else {
      return "Atmospheric ascent complete. Prepare for staging.";
    }
  }

  if (phase === "STAGE SEPARATION") {
    return "Hot staging complete. Both vehicles independent.";
  }

  if (phase === "BOOSTER BOOSTBACK") {
    return "Booster executing boostback burn to return site.";
  }

  if (phase === "BOOSTER DESCENT") {
    return "Booster descending. Preparing landing burn.";
  }

  if (phase === "BOOSTER LANDING BURN") {
    return "Booster landing burn active. Decelerating for catch.";
  }

  if (phase === "STARSHIP ORBITAL INSERTION") {
    const orbital = calculateOrbitalElements(vehicle);
    if (orbital.orbitPossible) {
      return `Orbit achieved: ${(orbital.periapsisAltitude / 1000).toFixed(0)}×${(orbital.apoapsisAltitude / 1000).toFixed(0)} km`;
    }
    return "Starship orbital insertion burn in progress.";
  }

  if (phase === "STARSHIP COAST") {
    return "Starship in stable orbit. Coasting.";
  }

  return `Phase: ${phase}`;
}
