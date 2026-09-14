const hints = {
  ohms: [
    "Keep resistance fixed, then vary voltage to see direct proportionality.",
    "Current increases when voltage rises if resistance stays constant."
  ],
  projectile: [
    "At 45 degrees you often get near maximum range on level ground.",
    "Too steep or too shallow angles reduce horizontal distance."
  ],
  pendulum: [
    "Longer pendulum means longer period.",
    "Gravity affects swing timing."
  ],
  optics: [
    "Light bends toward the normal when entering a denser medium.",
    "Reflected angle equals incident angle."
  ],
  newton2: [
    "Acceleration is force divided by mass.",
    "Higher mass reduces acceleration for the same force."
  ],
  spaceMission: [
    "Use Free 3D camera to drag the view; Chase/Pad lock the camera to the rocket.",
    "Adjust each stage's thrust and fuel share before launch — wider rocket increases drag.",
    "Pick fairing and nose for your look; length and width change mass and how big you appear in 3D."
  ],
  seriesParallel: [
    "Series resistances simply add; parallel totals are less than the smallest resistor.",
    "In parallel every resistor sees the full battery voltage — currents add up."
  ],
  freeFall: [
    "Fall time depends only on height: t = √(2h/g).",
    "In a vacuum, all objects fall at the same rate regardless of mass."
  ],
  friction: [
    "The block only starts moving once the push exceeds μs·N.",
    "Kinetic friction is smaller than static, so the block then accelerates."
  ],
  hooke: [
    "Spring extension is proportional to force: F = kx.",
    "Wait for the spring to settle before recording the extension."
  ],
  workEnergy: [
    "Only the force component along the motion does work: W = Fd cosθ.",
    "At 90° the applied force does zero work."
  ],
  conservation: [
    "Watch PE and KE trade places while the total stays flat.",
    "Switch friction ON to see the total energy slowly leak away."
  ],
  collision: [
    "Total momentum before always equals total momentum after.",
    "Elastic collisions keep kinetic energy; inelastic ones lose it to heat and deformation."
  ],
  centripetal: [
    "Doubling the speed quadruples the centripetal force (v²).",
    "Tighter radius means a bigger inward force at the same speed."
  ],
  waveString: [
    "Speed on a string is √(T/μ) — frequency does not change it.",
    "Higher tension stretches the wavelength when frequency is fixed."
  ],
  soundWave: [
    "The compressions are exactly one wavelength apart.",
    "A stiffer medium lengthens the wave at the same frequency."
  ],
  lensExperiment: [
    "Inside the focal length you get a virtual, upright image.",
    "Beyond 2f the image is real, inverted and smaller."
  ],
  induction: [
    "Only a *changing* flux induces EMF — a still magnet gives nothing.",
    "Push the magnet faster or add turns to boost the induced voltage."
  ],
  magneticForce: [
    "The magnetic force is always sideways — it curves the path, never speeds the charge up.",
    "Stronger field tightly curls the trajectory."
  ],
  rcCircuit: [
    "τ = RC: after one time constant the capacitor reaches ~63 % of its charge.",
    "Bigger R or C makes the charging curve stretch out."
  ],
  heatTransfer: [
    "Heat always flows from hot to cold until temperatures meet.",
    "A bigger temperature difference drives faster transfer."
  ],
  idealGas: [
    "PV = nRT: at fixed temperature, squeezing the volume raises the pressure.",
    "Heating a fixed volume increases its pressure."
  ],
  shm: [
    "The SHM period is independent of amplitude: T = 2π√(m/k).",
    "More mass or a softer spring means slower swings."
  ],
  doppler: [
    "Pitch rises while the source approaches, and falls as it recedes.",
    "Faster source speed makes the frequency shift bigger."
  ],
  orbit: [
    "Launching at exactly v = √(GM/r) gives a circular orbit.",
    "Below that speed the satellite spirals in; above it the orbit stretches."
  ],
  planetFall: [
    "Weight differences come from g = GM/R², never from the mass.",
    "Denser/larger planets with small radius pull hardest at their surface."
  ],
  escapeVelocity: [
    "Below v_esc the object always falls back; at v_esc it coasts to infinity.",
    "Escape speed grows if the planet is more massive or denser."
  ],
  projectileAir: [
    "Air resistance lowers both the range and peak height of the ideal parabola.",
    "A larger cross-section or drag coefficient shortens the flight."
  ],
  viscousFlow: [
    "Flow rate drops with tube radius to the fourth power — narrow tubes choke flow.",
    "Thicker (more viscous) liquids need more pressure to move."
  ],
  buoyancy: [
    "Upthrust equals the weight of displaced fluid: F = ρ·V·g.",
    "An object sinks when its density exceeds the fluid's."
  ],
  pressureLiquids: [
    "Hydrostatic pressure grows with depth — shape of the container doesn't matter.",
    "P = P₀ + ρgh."
  ],
  bernoulli: [
    "Where flow speeds up, pressure drops (same height).",
    "Narrowing the pipe accelerates the fluid."
  ],
  motor: [
    "A current-carrying coil inside a magnetic field feels a turning force.",
    "More current or a stronger magnet spins it harder."
  ],
  generator: [
    "Spinning a coil in a magnetic field induces alternating current.",
    "Faster rotation raises both frequency and output voltage."
  ],
  solar: [
    "Panel power scales with irradiance and panel area.",
    "Pointing the panel at 90° to the sun captures the maximum."
  ],
  energyConversion: [
    "Energy changes form but is never created or destroyed.",
    "Every conversion leaks a little energy as heat."
  ],
  measurement: [
    "Repeat readings and average to reduce random error.",
    "Record to the finest reliable division of the instrument."
  ],
  dimensional: [
    "Every term in a correct equation must share the same dimensions.",
    "Check with [M], [L], [T] before trusting any formula."
  ],
  vectorAddition: [
    "Add vectors tip-to-tail; the resultant is the closing diagonal.",
    "Perpendicular components combine by Pythagoras: R = √(x² + y²)."
  ],
  targetChallenge: [
    "Range = v²·sin(2θ)/g — 45° reaches farthest on level ground.",
    "Two different angles can give the same range: θ and 90° − θ."
  ]
};

export function getAdaptiveHint(experimentId, mistakeCount, assessmentMode) {
  if (assessmentMode) return "Focus on equations and observations.";
  const pool = hints[experimentId] ?? ["Try one variable at a time."];
  return pool[Math.min(pool.length - 1, Math.floor(mistakeCount / 2))];
}
