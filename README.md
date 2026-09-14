# Virtual Physics Lab Trainer

Scalable MVP web app for Grade 9-12 physics practice with:

- 40 experiment simulations (6 hand-built + 34 data-driven generic experiments)
- Real-time equations and graph updates
- Futuristic glassmorphism UI with dark/light mode
- Animated concept visuals (current flow, projectile path, pendulum, refraction rays, force vectors, wavefronts)
- Smart tutor hints, ELI5 mode, challenge mode, replay and slow motion

## Tech Stack

- React + Vite
- Three.js via React Three Fiber + Drei
- Framer Motion animations

## Experiments Included

1. Ohm's Law
2. Series and Parallel Circuits *
3. Simple Pendulum
4. Free Fall (Accelerated Motion) *
5. Projectile Motion
6. Newton's Second Law
7. Friction — Static and Kinetic *
8. Hooke's Law / Springs *
9. Work, Energy and Power *
10. Conservation of Mechanical Energy *
11. Collision and Momentum *
12. Centripetal Force *
13. Waves on a String *
14. Sound Wave *
15. Refraction and Reflection
16. (combined in #15)
17. Lens Experiment (Converging Lens) *
18. Electromagnetic Induction *
19. Magnetic Force on a Charge *
20. RC Circuit — Capacitor Charging *
21. Heat Transfer (Calorimetry) *
22. Ideal Gas Law *
23. Simple Harmonic Motion *
24. Doppler Effect *
25. Gravitational Orbit *
26. Planetary Gravity Comparison *
27. Escape Velocity *
28. Projectile Motion with Air Resistance *
29. Viscous Flow / Fluid Motion *
30. Buoyancy (Archimedes' Principle) *
31. Pressure in Liquids *
32. Bernoulli's Principle *
33. Electric Motor *
34. Electric Generator *
35. Solar Panel Energy *
36. Energy Conversion & Efficiency *
37. Measurement & Uncertainty *
38. Dimensional Analysis *
39. Vector Addition *
40. Target Challenge (Projectile Range) *
- Space Mission Control & Orbital Lab (3D rocket builder, staging, transfer timing)

_* = rendered by the generic data-driven experiment engine (blueprint + canvas scene)._

## Run Locally

1. Install Node.js 18+
2. In project directory:
   - `npm install`
   - `npm run dev`
3. Open the URL from terminal (usually `http://localhost:5173`)

## Architecture Notes

- `src/data/experiments.js`: registry for all experiment modules (easy to extend)
- `src/data/genericExperiments.js`: 34 declarative experiment blueprints (controls, measures, compute function, graph, procedure, theory)
- `src/experiments/generic/GenericExperiment.jsx`: engine that renders any blueprint (runs the sim, live readings, record table, graph, fullscreen view)
- `src/experiments/generic/scenes.js`: canvas scene-drawing library dispatched per blueprint (`scene` key)
- `src/experiments/`: one component per hand-built experiment module
- `src/components/`: reusable UI/simulation primitives (graphs, controls, instructions, panels)
- `src/context/`: theme and progress state
- `src/utils/`: tutor adaptation and assessment scoring logic
