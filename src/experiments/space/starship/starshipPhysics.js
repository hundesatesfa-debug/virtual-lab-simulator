/**
 * Starship flight physics engine.
 *
 * 2D polar flight model around a spherical Earth.
 *
 * Position:
 *   x = ground-track distance (m)
 *   y = altitude above mean Earth radius (m)
 *
 * Velocity:
 *   x = local horizontal velocity (m/s)
 *   y = radial velocity (m/s)
 *
 * Educational model, not SpaceX flight software.
 */

export const PHYSICS = {
  EARTH_RADIUS: 6371000, // m
  MU: 3.986004418e14, // m³/s² (gravitational parameter)
  G0: 9.80665, // m/s² (standard gravity)
  MAX_INTEGRATION_STEP: 0.02, // s (20 milliseconds)
  ATMOSPHERE_LIMIT: 180000, // m (180 km)
  SEA_LEVEL_DENSITY: 1.225, // kg/m³
  HEATING_COEFFICIENT: 1.83e-4, // Sutton-Graves constant
  
  // Earth rotation
  EARTH_ROTATION_RATE: 7.2921159e-5, // rad/s (sidereal rotation)
  STARBASE_LATITUDE: 25.99677, // degrees North
  
  // Structural limits (educational estimates)
  MAX_DYNAMIC_PRESSURE_WARNING: 50000, // Pa (50 kPa - typical Max Q range)
  MAX_ACCELERATION_WARNING: 4.0, // g (typical max acceleration limit)
};

// Standard-atmosphere reference density values.
// Altitude in meters, density in kg/m³.
const ATMOSPHERE_TABLE = [
  [0, 1.225],
  [1000, 1.112],
  [2000, 1.007],
  [5000, 0.736],
  [8000, 0.526],
  [10000, 0.414],
  [12000, 0.312],
  [15000, 0.194],
  [20000, 0.088],
  [25000, 0.040],
  [30000, 0.0184],
  [40000, 0.003996],
  [50000, 0.001027],
  [60000, 0.00031],
  [70000, 0.0000828],
  [80000, 0.0000185],
  [90000, 0.0000034],
  [100000, 0.00000056],
  [120000, 0.000000025],
  [150000, 0.0000000008],
  [180000, 0],
];

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const radians = (degrees) => degrees * Math.PI / 180;
const degrees = (radiansValue) => radiansValue * 180 / Math.PI;
const magnitude = (x, y) => Math.hypot(x, y);

/**
 * Calculate Earth's surface rotation velocity at a given latitude.
 * 
 * @param {number} latitudeDegrees - Latitude in degrees
 * @returns {number} Eastward velocity in m/s
 */
export function calculateEarthRotationVelocity(latitudeDegrees = PHYSICS.STARBASE_LATITUDE) {
  const latitudeRad = radians(latitudeDegrees);
  // v = ω × r × cos(latitude)
  return PHYSICS.EARTH_ROTATION_RATE * PHYSICS.EARTH_RADIUS * Math.cos(latitudeRad);
}

/**
 * Check if vehicle has exceeded structural limits.
 * Returns warnings for dangerous flight conditions.
 * 
 * @param {Object} vehicle - Vehicle state
 * @returns {Object} Warning flags and messages
 */
export function checkStructuralLimits(vehicle) {
  const warnings = {
    maxQ: false,
    maxAcceleration: false,
    messages: [],
  };

  if (vehicle.dynamicPressure > PHYSICS.MAX_DYNAMIC_PRESSURE_WARNING) {
    warnings.maxQ = true;
    warnings.messages.push(
      `Dynamic pressure ${(vehicle.dynamicPressure / 1000).toFixed(1)} kPa exceeds nominal Max Q`
    );
  }

  const accelerationG = magnitude(vehicle.acceleration.x, vehicle.acceleration.y) / PHYSICS.G0;
  if (accelerationG > PHYSICS.MAX_ACCELERATION_WARNING) {
    warnings.maxAcceleration = true;
    warnings.messages.push(
      `Acceleration ${accelerationG.toFixed(1)}g exceeds structural limit`
    );
  }

  return warnings;
}

export function calculateGravity(altitudeMeters) {
  const radius = PHYSICS.EARTH_RADIUS + Math.max(0, altitudeMeters);
  return PHYSICS.MU / (radius * radius);
}

export function calculateAtmosphere(altitudeMeters) {
  const altitude = Math.max(0, altitudeMeters);

  if (altitude >= PHYSICS.ATMOSPHERE_LIMIT) {
    return { density: 0, pressure: 0 };
  }

  let lower = ATMOSPHERE_TABLE[0];
  let upper = ATMOSPHERE_TABLE[ATMOSPHERE_TABLE.length - 1];

  for (let i = 0; i < ATMOSPHERE_TABLE.length - 1; i++) {
    if (
      altitude >= ATMOSPHERE_TABLE[i][0] &&
      altitude <= ATMOSPHERE_TABLE[i + 1][0]
    ) {
      lower = ATMOSPHERE_TABLE[i];
      upper = ATMOSPHERE_TABLE[i + 1];
      break;
    }
  }

  const fraction =
    (altitude - lower[0]) / (upper[0] - lower[0]);

  const density =
    lower[1] > 0 && upper[1] > 0
      ? Math.exp(
          Math.log(lower[1]) +
          fraction * (Math.log(upper[1]) - Math.log(lower[1]))
        )
      : lower[1] * (1 - fraction) + upper[1] * fraction;

  const temperature = Math.max(
    180,
    288.15 - altitude * 0.0065
  );

  const pressure = density * 287.05 * temperature;

  return { density, pressure };
}

export function calculateAerodynamicDrag({
  altitude,
  velocityX,
  velocityY,
  dragCoefficient,
  referenceArea,
  noseRadius = 1,
  includeEarthRotation = true,
  latitudeDegrees = PHYSICS.STARBASE_LATITUDE,
}) {
  // Account for Earth's rotation in atmospheric reference frame
  let relativeVelocityX = velocityX;
  
  if (includeEarthRotation) {
    const atmosphereVelocity = calculateEarthRotationVelocity(latitudeDegrees);
    relativeVelocityX = velocityX - atmosphereVelocity;
  }

  const speed = magnitude(relativeVelocityX, velocityY);
  const atmosphere = calculateAtmosphere(altitude);

  if (speed < 0.001 || atmosphere.density <= 0) {
    return {
      forceX: 0,
      forceY: 0,
      dynamicPressure: 0,
      heatingRate: 0,
      speed,
      density: atmosphere.density,
    };
  }

  const dynamicPressure =
    0.5 * atmosphere.density * speed * speed;

  const dragForce =
    dynamicPressure * dragCoefficient * referenceArea;

  // Sutton-Graves-style approximate stagnation-point heating.
  const heatingRate =
    PHYSICS.HEATING_COEFFICIENT *
    Math.sqrt(atmosphere.density / Math.max(0.1, noseRadius)) *
    speed ** 3;

  return {
    forceX: -dragForce * relativeVelocityX / speed,
    forceY: -dragForce * velocityY / speed,
    dynamicPressure,
    heatingRate,
    speed,
    density: atmosphere.density,
  };
}

export function calculateOrbitalElements(vehicle) {
  const radius = PHYSICS.EARTH_RADIUS + vehicle.position.y;
  const horizontal = vehicle.velocity.x;
  const radial = vehicle.velocity.y;

  const speedSquared = horizontal ** 2 + radial ** 2;
  const energy = speedSquared / 2 - PHYSICS.MU / radius;
  const angularMomentum = radius * horizontal;

  const eccentricitySquared =
    1 +
    (2 * energy * angularMomentum ** 2) /
    (PHYSICS.MU ** 2);

  const eccentricity = Math.sqrt(
    Math.max(0, eccentricitySquared)
  );

  const bound = energy < 0 && eccentricity < 1;

  if (!bound || angularMomentum === 0) {
    return {
      specificEnergy: energy,
      eccentricity,
      semiMajorAxis: null,
      apoapsisAltitude: null,
      periapsisAltitude: null,
      orbitalPeriod: null,
      orbitPossible: false,
    };
  }

  const semiMajorAxis = -PHYSICS.MU / (2 * energy);

  const apoapsisRadius = semiMajorAxis * (1 + eccentricity);
  const periapsisRadius = semiMajorAxis * (1 - eccentricity);

  const orbitalPeriod =
    2 * Math.PI *
    Math.sqrt(semiMajorAxis ** 3 / PHYSICS.MU);

  return {
    specificEnergy: energy,
    eccentricity,
    semiMajorAxis,
    apoapsisAltitude: apoapsisRadius - PHYSICS.EARTH_RADIUS,
    periapsisAltitude: periapsisRadius - PHYSICS.EARTH_RADIUS,
    orbitalPeriod,
    orbitPossible: true,
  };
}

export function createVehicle({
  name = "Starship",
  dryMassKg,
  propellantMassKg,
  engines,
  dragCoefficient = 0.35,
  referenceArea = 50,
  noseRadius = 1,
  altitude = 0,
  downrange = 0,
  includeEarthRotation = true,
  latitudeDegrees = PHYSICS.STARBASE_LATITUDE,
}) {
  if (!(dryMassKg > 0)) {
    throw new Error("Vehicle dry mass must be positive.");
  }

  if (!(propellantMassKg >= 0)) {
    throw new Error("Invalid propellant mass.");
  }

  if (
    !engines ||
    !(engines.thrustN > 0) ||
    !(engines.ispSeconds > 0) ||
    !(engines.count > 0)
  ) {
    throw new Error("Invalid engine configuration.");
  }

  // Initial horizontal velocity from Earth rotation
  const initialVelocityX = includeEarthRotation 
    ? calculateEarthRotationVelocity(latitudeDegrees)
    : 0;

  return {
    name,

    dryMassKg,
    propellantMassKg,
    initialPropellantMassKg: propellantMassKg,
    totalMassKg: dryMassKg + propellantMassKg,

    engines: { ...engines },

    dragCoefficient,
    referenceArea,
    noseRadius,
    
    includeEarthRotation,
    latitudeDegrees,

    position: {
      x: downrange,
      y: altitude,
    },

    velocity: { x: initialVelocityX, y: 0 },
    acceleration: { x: 0, y: 0 },

    throttle: 0,
    pitchDeg: 0,
    engineOn: false,

    elapsedTime: 0,

    maxAltitude: altitude,
    maxDynamicPressure: 0,
    maxHeatingRate: 0,

    dynamicPressure: 0,
    heatingRate: 0,
    gravity: calculateGravity(altitude),

    totalThrustN: 0,
    massFlowRateKgS: 0,

    status: "READY",
    landed: false,
    engineCutoff: false,
    fuelDepleted: false,
    
    warnings: {
      maxQ: false,
      maxAcceleration: false,
      messages: [],
    },
  };
}

export function setEngineState(vehicle, enabled) {
  if (vehicle.landed || vehicle.fuelDepleted) return;

  vehicle.engineOn = Boolean(enabled);

  if (!vehicle.engineOn) {
    vehicle.throttle = 0;
  }

  vehicle.status = vehicle.engineOn ? "ENGINE ACTIVE" : "ENGINE OFF";
}

export function setThrottle(vehicle, throttle) {
  vehicle.throttle = clamp(throttle, 0, 1);
}

export function setPitch(vehicle, pitchDeg) {
  // 0 = vertical, 90 = horizontal, 180 = vertically downward.
  vehicle.pitchDeg = clamp(pitchDeg, 0, 180);
}

function integrateStep(vehicle, dt) {
  if (vehicle.landed) return;

  const altitude = Math.max(0, vehicle.position.y);
  const radius = PHYSICS.EARTH_RADIUS + altitude;

  const mass = vehicle.dryMassKg + vehicle.propellantMassKg;
  const gravity = PHYSICS.MU / (radius * radius);

  const drag = calculateAerodynamicDrag({
    altitude,
    velocityX: vehicle.velocity.x,
    velocityY: vehicle.velocity.y,
    dragCoefficient: vehicle.dragCoefficient,
    referenceArea: vehicle.referenceArea,
    noseRadius: vehicle.noseRadius,
    includeEarthRotation: vehicle.includeEarthRotation,
    latitudeDegrees: vehicle.latitudeDegrees,
  });

  let thrust = 0;
  let massFlowRate = 0;

  if (
    vehicle.engineOn &&
    !vehicle.engineCutoff &&
    vehicle.propellantMassKg > 0
  ) {
    thrust =
      vehicle.engines.thrustN *
      vehicle.engines.count *
      vehicle.throttle;

    massFlowRate =
      thrust / (vehicle.engines.ispSeconds * PHYSICS.G0);

    const maximumFlow = vehicle.propellantMassKg / dt;

    if (massFlowRate > maximumFlow) {
      massFlowRate = maximumFlow;
      thrust =
        massFlowRate *
        vehicle.engines.ispSeconds *
        PHYSICS.G0;
    }
  }

  const pitch = radians(vehicle.pitchDeg);

  const thrustHorizontal = thrust * Math.sin(pitch);
  const thrustRadial = thrust * Math.cos(pitch);

  // Polar-coordinate equations of motion.
  // Horizontal velocity is tangential to Earth.
  // Vertical velocity is radial relative to Earth.
  const radialAcceleration =
    (vehicle.velocity.x ** 2 / radius) -
    gravity +
    (thrustRadial + drag.forceY) / mass;

  const horizontalAcceleration =
    -(vehicle.velocity.y * vehicle.velocity.x / radius) +
    (thrustHorizontal + drag.forceX) / mass;

  vehicle.velocity.y += radialAcceleration * dt;
  vehicle.velocity.x += horizontalAcceleration * dt;

  // Convert tangential velocity to ground-track distance.
  vehicle.position.x +=
    (PHYSICS.EARTH_RADIUS / radius) *
    vehicle.velocity.x * dt;

  vehicle.position.y += vehicle.velocity.y * dt;

  const consumed = Math.min(
    vehicle.propellantMassKg,
    massFlowRate * dt
  );

  vehicle.propellantMassKg = Math.max(
    0,
    vehicle.propellantMassKg - consumed
  );

  vehicle.totalMassKg =
    vehicle.dryMassKg + vehicle.propellantMassKg;

  vehicle.acceleration.x = horizontalAcceleration;
  vehicle.acceleration.y = radialAcceleration;

  vehicle.gravity = gravity;

  vehicle.totalThrustN = thrust;
  vehicle.massFlowRateKgS = massFlowRate;

  vehicle.dynamicPressure = drag.dynamicPressure;
  vehicle.heatingRate = drag.heatingRate;

  vehicle.maxDynamicPressure = Math.max(
    vehicle.maxDynamicPressure,
    drag.dynamicPressure
  );

  vehicle.maxHeatingRate = Math.max(
    vehicle.maxHeatingRate,
    drag.heatingRate
  );

  vehicle.maxAltitude = Math.max(
    vehicle.maxAltitude,
    vehicle.position.y
  );

  vehicle.elapsedTime += dt;
  
  // Check structural limits
  vehicle.warnings = checkStructuralLimits(vehicle);

  if (vehicle.propellantMassKg <= 0 && massFlowRate > 0) {
    vehicle.propellantMassKg = 0;
    vehicle.engineOn = false;
    vehicle.throttle = 0;
    vehicle.engineCutoff = true;
    vehicle.fuelDepleted = true;
    vehicle.status = "ENGINE CUTOFF - FUEL DEPLETED";
  }

  if (vehicle.position.y <= 0 && vehicle.velocity.y < 0) {
    vehicle.position.y = 0;
    vehicle.velocity.y = 0;
    vehicle.velocity.x = 0;

    vehicle.engineOn = false;
    vehicle.throttle = 0;
    vehicle.landed = true;
    vehicle.status = "GROUND CONTACT";
  } else if (vehicle.engineOn) {
    vehicle.status = "POWERED FLIGHT";
  } else {
    vehicle.status = "COASTING";
  }
}

export function stepVehicle(vehicle, dt) {
  if (!Number.isFinite(dt) || dt <= 0) {
    throw new Error("Time step must be positive.");
  }

  const steps = Math.ceil(dt / PHYSICS.MAX_INTEGRATION_STEP);
  const h = dt / steps;

  for (let i = 0; i < steps; i++) {
    integrateStep(vehicle, h);
  }

  return vehicle;
}

export function getTelemetry(vehicle) {
  const speed = magnitude(
    vehicle.velocity.x,
    vehicle.velocity.y
  );

  const acceleration = magnitude(
    vehicle.acceleration.x,
    vehicle.acceleration.y
  );

  const fuelPercentage =
    vehicle.initialPropellantMassKg > 0
      ? 100 * vehicle.propellantMassKg /
        vehicle.initialPropellantMassKg
      : 0;

  const orbital = calculateOrbitalElements(vehicle);
  
  // Calculate velocity relative to ground (subtract Earth rotation if applicable)
  const groundRelativeVelocityX = vehicle.includeEarthRotation
    ? vehicle.velocity.x - calculateEarthRotationVelocity(vehicle.latitudeDegrees)
    : vehicle.velocity.x;
  
  const groundRelativeSpeed = magnitude(groundRelativeVelocityX, vehicle.velocity.y);

  return {
    name: vehicle.name,

    altitudeMeters: vehicle.position.y,
    downrangeMeters: vehicle.position.x,

    horizontalVelocity: vehicle.velocity.x,
    verticalVelocity: vehicle.velocity.y,
    speed,
    
    groundRelativeSpeed,
    inertialSpeed: speed,

    acceleration,
    accelerationG: acceleration / PHYSICS.G0,

    gravity: vehicle.gravity,

    massKg: vehicle.totalMassKg,
    propellantKg: vehicle.propellantMassKg,
    fuelPercentage,

    thrustN: vehicle.totalThrustN,
    throttle: vehicle.throttle,
    massFlowRateKgS: vehicle.massFlowRateKgS,

    dynamicPressurePa: vehicle.dynamicPressure,
    maxDynamicPressurePa: vehicle.maxDynamicPressure,

    heatingRateWm2: vehicle.heatingRate,
    maxHeatingRateWm2: vehicle.maxHeatingRate,

    maxAltitudeMeters: vehicle.maxAltitude,
    pitchDeg: vehicle.pitchDeg,

    elapsedTime: vehicle.elapsedTime,

    engineOn: vehicle.engineOn,
    engineCutoff: vehicle.engineCutoff,
    fuelDepleted: vehicle.fuelDepleted,
    landed: vehicle.landed,
    
    warnings: vehicle.warnings,

    orbital,

    status: vehicle.status,
  };
}

/**
 * Create a deep copy of vehicle state for validation or testing.
 */
export function cloneVehicle(vehicle) {
  return {
    ...vehicle,
    position: { ...vehicle.position },
    velocity: { ...vehicle.velocity },
    acceleration: { ...vehicle.acceleration },
    engines: { ...vehicle.engines },
    warnings: { ...vehicle.warnings, messages: [...vehicle.warnings.messages] },
  };
}
