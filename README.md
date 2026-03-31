# Virtual Physics Lab Trainer

Scalable MVP web app for Grade 9-12 physics practice with:

- 5 modular experiment simulations
- Real-time equations and graph updates
- Futuristic glassmorphism UI with dark/light mode
- Animated concept visuals (current flow, projectile path, pendulum, refraction rays, force vectors)
- Smart tutor hints, ELI5 mode, challenge mode, replay and slow motion

## Tech Stack

- React + Vite
- Three.js via React Three Fiber + Drei
- Framer Motion animations

## Experiments Included

- Ohm's Law
- Projectile Motion
- Simple Pendulum
- Refraction and Reflection
- Newton's Second Law
- Space Mission Control & Orbital Lab (3D rocket builder, staging, transfer timing)

## Run Locally

1. Install Node.js 18+
2. In project directory:
   - `npm install`
   - `npm run dev`
3. Open the URL from terminal (usually `http://localhost:5173`)

## Architecture Notes

- `src/data/experiments.js`: registry for all experiment modules (easy to extend)
- `src/experiments/`: one component per experiment module
- `src/components/`: reusable UI/simulation primitives (graphs, controls, instructions, panels)
- `src/context/`: theme and progress state
- `src/utils/`: tutor adaptation and assessment scoring logic
