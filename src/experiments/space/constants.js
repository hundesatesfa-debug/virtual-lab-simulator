/** Scaled simulation units: distances in "sim units", time in seconds. */

export const EARTH_RADIUS = 0.52;
export const ISS_ORBIT_R = 0.72;
export const MOON_ORBIT_R = 4.2;
export const MARS_ORBIT_R = 9.5;

export const T_ISS = 20;
export const T_MOON = 60;
export const T_MARS = 180;

export const OMEGA_ISS = (2 * Math.PI) / T_ISS;
export const OMEGA_MOON = (2 * Math.PI) / T_MOON;
export const OMEGA_MARS = (2 * Math.PI) / T_MARS;

/** Gravitational parameter chosen so ISS circular speed matches kinematic orbit. */
export const MU_EARTH = OMEGA_ISS ** 2 * ISS_ORBIT_R ** 3;

export const MU_MOON = MU_EARTH * 0.012;
export const MU_MARS = MU_EARTH * 0.107;

export const MOON_RADIUS = 0.14;
export const MARS_RADIUS = 0.22;

/** Atmosphere scale height (sim units). */
export const ATM_SCALE = 0.08;
export const DRAG_K = 0.35;

export const MISSION_TYPES = {
  station: "station",
  moonOrbit: "moonOrbit",
  moonLand: "moonLand",
  mars: "mars"
};

export const CAMERA_MODES = {
  /** Full orbit — drag to rotate/pan/zoom the 3D scene */
  orbit: "orbit",
  ground: "ground",
  follow: "follow"
};

export const ROCKET_DEFAULTS = {
  stageThrustPct: [100, 100, 100],
  /** Relative propellant load per stage (normalized in physics) */
  stageFuelShare: [40, 35, 25],
  dragCoeff: 1,
  visual: {
    lengthScale: 1,
    widthScale: 1,
    finCount: 4,
    fairing: "standard",
    nose: "cone",
    colors: {
      body: "#c8d0e0",
      accent: "#ff6a2d",
      fairing: "#e8ecf8",
      booster: "#6a7388"
    }
  }
};
