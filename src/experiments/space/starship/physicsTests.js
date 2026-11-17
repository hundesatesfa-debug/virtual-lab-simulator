/**
 * Physics validation tests for Starship simulator.
 * 
 * These tests validate that the physics engine produces
 * physically correct results for known scenarios.
 */

import {
  PHYSICS,
  calculateGravity,
  calculateAtmosphere,
  calculateAerodynamicDrag,
  calculateOrbitalElements,
  calculateEarthRotationVelocity,
  createVehicle,
  setEngineState,
  setThrottle,
  setPitch,
  stepVehicle,
  getTelemetry,
} from "./starshipPhysics.js";

/**
 * Test result structure
 */
function testResult(name, passed, expected, actual, tolerance, message) {
  return {
    name,
    passed,
    expected,
    actual,
    tolerance,
    message: passed ? `✓ ${name}` : `✗ ${name}: ${message}`,
  };
}

/**
 * Check if value is within tolerance of expected
 */
function withinTolerance(actual, expected, tolerance = 0.01) {
  if (expected === 0) return Math.abs(actual) < tolerance;
  return Math.abs((actual - expected) / expected) < tolerance;
}

/**
 * Test 1: Gravity at sea level
 * Should be approximately 9.81 m/s²
 */
export function testGravityAtSeaLevel() {
  const g = calculateGravity(0);
  const expected = 9.81; // m/s²
  const passed = withinTolerance(g, expected, 0.01);
  
  return testResult(
    "Gravity at sea level",
    passed,
    expected,
    g.toFixed(3),
    "±1%",
    `Expected ~${expected} m/s², got ${g.toFixed(3)} m/s²`
  );
}

/**
 * Test 2: Gravity decreases with altitude
 * At 400 km altitude, gravity should be ~8.7 m/s²
 */
export function testGravityDecreasesWithAltitude() {
  const gSeaLevel = calculateGravity(0);
  const g400km = calculateGravity(400000);
  
  const expected = 8.7; // Approximate value at ISS altitude
  const passed = g400km < gSeaLevel && withinTolerance(g400km, expected, 0.05);
  
  return testResult(
    "Gravity decreases with altitude",
    passed,
    expected,
    g400km.toFixed(3),
    "±5%",
    `At 400km: expected ~${expected} m/s², got ${g400km.toFixed(3)} m/s²`
  );
}

/**
 * Test 3: Atmospheric density at sea level
 * Should be approximately 1.225 kg/m³
 */
export function testAtmosphericDensitySeaLevel() {
  const atm = calculateAtmosphere(0);
  const expected = 1.225;
  const passed = withinTolerance(atm.density, expected, 0.01);
  
  return testResult(
    "Atmospheric density at sea level",
    passed,
    expected,
    atm.density.toFixed(4),
    "±1%",
    `Expected ${expected} kg/m³, got ${atm.density.toFixed(4)} kg/m³`
  );
}

/**
 * Test 4: Atmospheric density decreases with altitude
 */
export function testAtmosphericDensityDecrease() {
  const atmSeaLevel = calculateAtmosphere(0);
  const atm10km = calculateAtmosphere(10000);
  const atm100km = calculateAtmosphere(100000);
  
  const passed = atm10km.density < atmSeaLevel.density && 
                 atm100km.density < atm10km.density &&
                 atm100km.density < 0.001;
  
  return testResult(
    "Atmospheric density decreases with altitude",
    passed,
    "Decreasing",
    `0m: ${atmSeaLevel.density.toFixed(3)}, 10km: ${atm10km.density.toFixed(3)}, 100km: ${atm100km.density.toFixed(6)}`,
    "N/A",
    "Density should decrease with altitude"
  );
}

/**
 * Test 5: Earth rotation velocity at Starbase
 * At 26°N latitude, should be ~410 m/s
 */
export function testEarthRotationVelocity() {
  const velocity = calculateEarthRotationVelocity(PHYSICS.STARBASE_LATITUDE);
  const expected = 410; // Approximate value at 26°N
  const passed = withinTolerance(velocity, expected, 0.10);
  
  return testResult(
    "Earth rotation velocity at Starbase",
    passed,
    expected,
    velocity.toFixed(1),
    "±10%",
    `Expected ~${expected} m/s, got ${velocity.toFixed(1)} m/s`
  );
}

/**
 * Test 6: Propellant mass decreases under thrust
 */
export function testPropellantConsumption() {
  const vehicle = createVehicle({
    name: "Test Vehicle",
    dryMassKg: 1000,
    propellantMassKg: 1000,
    engines: { thrustN: 10000, ispSeconds: 350, count: 1 },
  });
  
  const initialFuel = vehicle.propellantMassKg;
  
  setEngineState(vehicle, true);
  setThrottle(vehicle, 1.0);
  setPitch(vehicle, 0);
  
  stepVehicle(vehicle, 1.0); // 1 second of burn
  
  const fuelConsumed = initialFuel - vehicle.propellantMassKg;
  const expectedConsumption = 10000 / (350 * PHYSICS.G0); // F / (Isp * g0)
  
  const passed = withinTolerance(fuelConsumed, expectedConsumption, 0.02);
  
  return testResult(
    "Propellant consumption under thrust",
    passed,
    expectedConsumption.toFixed(2),
    fuelConsumed.toFixed(2),
    "±2%",
    `Expected ${expectedConsumption.toFixed(2)} kg/s, got ${fuelConsumed.toFixed(2)} kg/s`
  );
}

/**
 * Test 7: Thrust produces acceleration
 * F = ma, so a = F/m
 */
export function testThrustProducesAcceleration() {
  const vehicle = createVehicle({
    name: "Test Vehicle",
    dryMassKg: 1000,
    propellantMassKg: 0, // No fuel consumption for this test
    engines: { thrustN: 10000, ispSeconds: 350, count: 1 },
    altitude: 200000, // High altitude to minimize drag/gravity
    includeEarthRotation: false,
  });
  
  const mass = vehicle.totalMassKg;
  const thrust = 10000;
  const expectedAcceleration = thrust / mass; // F/m in vertical direction
  
  setEngineState(vehicle, true);
  setThrottle(vehicle, 1.0);
  setPitch(vehicle, 0); // Vertical
  
  // Small time step to get initial acceleration
  stepVehicle(vehicle, 0.001);
  
  const telemetry = getTelemetry(vehicle);
  const actualAcceleration = telemetry.acceleration;
  
  // At high altitude with vertical thrust, should be close to F/m
  const passed = withinTolerance(actualAcceleration, expectedAcceleration, 0.15);
  
  return testResult(
    "Thrust produces acceleration (F=ma)",
    passed,
    expectedAcceleration.toFixed(2),
    actualAcceleration.toFixed(2),
    "±15%",
    `Expected ${expectedAcceleration.toFixed(2)} m/s², got ${actualAcceleration.toFixed(2)} m/s²`
  );
}

/**
 * Test 8: Vehicle mass conservation
 * Total mass = dry mass + propellant mass
 */
export function testMassConservation() {
  const vehicle = createVehicle({
    name: "Test Vehicle",
    dryMassKg: 1000,
    propellantMassKg: 500,
    engines: { thrustN: 5000, ispSeconds: 350, count: 1 },
  });
  
  const initialTotal = vehicle.totalMassKg;
  const initialDry = vehicle.dryMassKg;
  const initialPropellant = vehicle.propellantMassKg;
  
  setEngineState(vehicle, true);
  setThrottle(vehicle, 1.0);
  setPitch(vehicle, 0);
  
  stepVehicle(vehicle, 1.0);
  
  const finalTotal = vehicle.totalMassKg;
  const finalDry = vehicle.dryMassKg;
  const finalPropellant = vehicle.propellantMassKg;
  
  const massConserved = Math.abs((finalDry + finalPropellant) - finalTotal) < 0.001;
  const dryMassConstant = Math.abs(finalDry - initialDry) < 0.001;
  const propellantDecreased = finalPropellant < initialPropellant;
  
  const passed = massConserved && dryMassConstant && propellantDecreased;
  
  return testResult(
    "Vehicle mass conservation",
    passed,
    "Conserved",
    `Initial: ${initialTotal.toFixed(1)}, Final: ${finalTotal.toFixed(1)}`,
    "N/A",
    passed ? "Mass equation holds" : "Mass conservation violated"
  );
}

/**
 * Test 9: Drag opposes motion
 */
export function testDragOpposesMotion() {
  const velocityX = 1000; // m/s horizontal
  const velocityY = 0;
  
  const drag = calculateAerodynamicDrag({
    altitude: 10000, // 10 km altitude
    velocityX,
    velocityY,
    dragCoefficient: 0.5,
    referenceArea: 50,
    includeEarthRotation: false,
  });
  
  // Drag force should oppose velocity direction
  const dragOpposesX = drag.forceX < 0; // Velocity is positive, drag should be negative
  const dragMagnitudePositive = drag.dynamicPressure > 0;
  
  const passed = dragOpposesX && dragMagnitudePositive;
  
  return testResult(
    "Drag opposes motion",
    passed,
    "Negative",
    `Force X: ${drag.forceX.toFixed(1)} N`,
    "N/A",
    passed ? "Drag correctly opposes velocity" : "Drag direction incorrect"
  );
}

/**
 * Test 10: Dynamic pressure peaks during ascent
 * Max Q should occur somewhere in the atmosphere, not at ground or in space
 */
export function testDynamicPressurePeak() {
  const vehicle = createVehicle({
    name: "Test Vehicle",
    dryMassKg: 10000,
    propellantMassKg: 50000,
    engines: { thrustN: 200000, ispSeconds: 330, count: 1 },
    includeEarthRotation: false,
  });
  
  setEngineState(vehicle, true);
  setThrottle(vehicle, 1.0);
  setPitch(vehicle, 0);
  
  let maxQ = 0;
  let altitudeAtMaxQ = 0;
  
  // Simulate 60 seconds of flight
  for (let t = 0; t < 60; t += 0.1) {
    stepVehicle(vehicle, 0.1);
    if (vehicle.dynamicPressure > maxQ) {
      maxQ = vehicle.dynamicPressure;
      altitudeAtMaxQ = vehicle.position.y;
    }
    if (vehicle.fuelDepleted) break;
  }
  
  // Max Q should occur between 8-15 km for typical rockets
  const passed = altitudeAtMaxQ > 5000 && altitudeAtMaxQ < 20000 && maxQ > 10000;
  
  return testResult(
    "Dynamic pressure peaks during ascent",
    passed,
    "8-15 km",
    `${(altitudeAtMaxQ / 1000).toFixed(1)} km (${(maxQ / 1000).toFixed(1)} kPa)`,
    "N/A",
    passed ? "Max Q occurs at realistic altitude" : "Max Q altitude unrealistic"
  );
}

/**
 * Test 11: Orbital elements calculation
 * For circular orbit at 400 km, eccentricity should be ~0
 */
export function testOrbitalElementsCircular() {
  const altitude = 400000; // 400 km
  const radius = PHYSICS.EARTH_RADIUS + altitude;
  const circularVelocity = Math.sqrt(PHYSICS.MU / radius); // Circular orbit velocity
  
  const vehicle = createVehicle({
    name: "Test Vehicle",
    dryMassKg: 10000,
    propellantMassKg: 0,
    engines: { thrustN: 10000, ispSeconds: 350, count: 1 },
    altitude,
    includeEarthRotation: false,
  });
  
  vehicle.velocity.x = circularVelocity;
  vehicle.velocity.y = 0;
  
  const orbital = calculateOrbitalElements(vehicle);
  
  const passed = orbital.orbitPossible && 
                 orbital.eccentricity < 0.01 &&
                 Math.abs(orbital.periapsisAltitude - altitude) < 1000 &&
                 Math.abs(orbital.apoapsisAltitude - altitude) < 1000;
  
  return testResult(
    "Orbital elements for circular orbit",
    passed,
    "e ≈ 0",
    `e = ${orbital.eccentricity.toFixed(4)}`,
    "±0.01",
    passed ? "Circular orbit detected correctly" : "Orbital calculation incorrect"
  );
}

/**
 * Test 12: Ground impact detection
 */
export function testGroundImpactDetection() {
  const vehicle = createVehicle({
    name: "Test Vehicle",
    dryMassKg: 1000,
    propellantMassKg: 0,
    engines: { thrustN: 5000, ispSeconds: 350, count: 1 },
    altitude: 100,
    includeEarthRotation: false,
  });
  
  vehicle.velocity.y = -10; // Falling at 10 m/s
  
  // Step until landed
  for (let i = 0; i < 100; i++) {
    if (vehicle.landed) break;
    stepVehicle(vehicle, 0.1);
  }
  
  const passed = vehicle.landed && 
                 vehicle.position.y === 0 &&
                 vehicle.velocity.y === 0;
  
  return testResult(
    "Ground impact detection",
    passed,
    "Landed",
    vehicle.status,
    "N/A",
    passed ? "Ground contact detected correctly" : "Landing detection failed"
  );
}

/**
 * Run all physics tests and return results
 */
export function runAllPhysicsTests() {
  const tests = [
    testGravityAtSeaLevel,
    testGravityDecreasesWithAltitude,
    testAtmosphericDensitySeaLevel,
    testAtmosphericDensityDecrease,
    testEarthRotationVelocity,
    testPropellantConsumption,
    testThrustProducesAcceleration,
    testMassConservation,
    testDragOpposesMotion,
    testDynamicPressurePeak,
    testOrbitalElementsCircular,
    testGroundImpactDetection,
  ];
  
  const results = tests.map(test => test());
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;
  
  return {
    results,
    summary: {
      total,
      passed,
      failed,
      passRate: (passed / total * 100).toFixed(1),
    },
  };
}

/**
 * Format test results for console output
 */
export function formatTestResults(testResults) {
  const lines = [];
  
  lines.push("=".repeat(60));
  lines.push("STARSHIP PHYSICS VALIDATION TESTS");
  lines.push("=".repeat(60));
  lines.push("");
  
  testResults.results.forEach((result, index) => {
    lines.push(`Test ${index + 1}: ${result.message}`);
    if (!result.passed) {
      lines.push(`  Expected: ${result.expected}`);
      lines.push(`  Actual: ${result.actual}`);
      lines.push(`  Tolerance: ${result.tolerance}`);
    }
    lines.push("");
  });
  
  lines.push("=".repeat(60));
  lines.push(`SUMMARY: ${testResults.summary.passed}/${testResults.summary.total} tests passed (${testResults.summary.passRate}%)`);
  lines.push("=".repeat(60));
  
  return lines.join("\n");
}

/**
 * Convenience function to run tests and log results
 */
export function runAndLogTests() {
  const results = runAllPhysicsTests();
  console.log(formatTestResults(results));
  return results;
}
