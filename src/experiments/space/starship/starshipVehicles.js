
import { createVehicle } from "./starshipPhysics.js";

/**
 * Approximate educational vehicle specifications.
 * These are simulation assumptions, not official
 * SpaceX internal vehicle specifications.
 */

export const SUPER_HEAVY_CONFIG = {
  name: "Super Heavy Booster",

  dryMassKg: 250_000,
  propellantMassKg: 3_400_000,

  engines: {
    thrustN: 2_300_000,
    ispSeconds: 330,
    count: 33,
  },

  dragCoefficient: 0.45,
  referenceArea: 80,
};

export const STARSHIP_CONFIG = {
  name: "Starship Upper Stage",

  dryMassKg: 100_000,
  propellantMassKg: 1_200_000,

  engines: {
    thrustN: 2_000_000,
    ispSeconds: 380,
    count: 6,
  },

  dragCoefficient: 0.35,
  referenceArea: 50,
};

/**
 * Create independently simulated vehicles.
 */
export function createSuperHeavy() {
  return createVehicle(SUPER_HEAVY_CONFIG);
}

export function createStarship() {
  return createVehicle(STARSHIP_CONFIG);
}

/**
 * Approximate fully fueled launch stack mass.
 */
export function getLaunchStackMass() {
  return (
    SUPER_HEAVY_CONFIG.dryMassKg +
    SUPER_HEAVY_CONFIG.propellantMassKg +
    STARSHIP_CONFIG.dryMassKg +
    STARSHIP_CONFIG.propellantMassKg
  );
}
