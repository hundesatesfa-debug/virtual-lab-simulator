import OhmsLawExperiment from "../experiments/OhmsLawExperiment";
import ProjectileExperiment from "../experiments/ProjectileExperiment";
import PendulumExperiment from "../experiments/PendulumExperiment";
import OpticsExperiment from "../experiments/OpticsExperiment";
import NewtonSecondLawExperiment from "../experiments/NewtonSecondLawExperiment";
import SpaceMissionExperiment from "../experiments/SpaceMissionExperiment";

export const experiments = [
  {
    id: "ohms",
    title: "Ohm's Law Experiment",
    topic: "Electricity",
    component: OhmsLawExperiment
  },
  {
    id: "projectile",
    title: "Projectile Motion Simulation",
    topic: "Kinematics",
    component: ProjectileExperiment
  },
  {
    id: "pendulum",
    title: "Simple Pendulum",
    topic: "Oscillations",
    component: PendulumExperiment
  },
  {
    id: "optics",
    title: "Refraction and Reflection of Light",
    topic: "Optics",
    component: OpticsExperiment
  },
  {
    id: "newton2",
    title: "Newton's Second Law",
    topic: "Dynamics",
    component: NewtonSecondLawExperiment
  },
  {
    id: "spaceMission",
    title: "Space Mission Control & Orbital Lab",
    topic: "Astrophysics",
    component: SpaceMissionExperiment
  }
];
