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
  ]
};

export function getAdaptiveHint(experimentId, mistakeCount, assessmentMode) {
  if (assessmentMode) return "Focus on equations and observations.";
  const pool = hints[experimentId] ?? ["Try one variable at a time."];
  return pool[Math.min(pool.length - 1, Math.floor(mistakeCount / 2))];
}
