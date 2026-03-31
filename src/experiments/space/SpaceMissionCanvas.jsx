import { useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { GizmoHelper, GizmoViewport, Grid, Line, OrbitControls, Stars } from "@react-three/drei";
import * as THREE from "three";
import {
  EARTH_RADIUS,
  ISS_ORBIT_R,
  MOON_ORBIT_R,
  MARS_ORBIT_R,
  MOON_RADIUS,
  MARS_RADIUS,
  OMEGA_ISS,
  OMEGA_MOON,
  OMEGA_MARS,
  ROCKET_DEFAULTS
} from "./constants.js";
import { bodyPosition, interceptHint, stepSimulation } from "./physics.js";

function EarthMesh({ rotation }) {
  const ref = useRef();
  useFrame(() => {
    if (ref.current) ref.current.rotation.y = rotation;
  });
  return (
    <mesh ref={ref} castShadow>
      <sphereGeometry args={[EARTH_RADIUS, 64, 64]} />
      <meshStandardMaterial
        color="#1a6bcc"
        emissive="#020814"
        metalness={0.25}
        roughness={0.6}
      />
    </mesh>
  );
}

function CelestialSphere({ position, radius, color, emissive }) {
  return (
    <mesh position={position}>
      <sphereGeometry args={[radius, 32, 32]} />
      <meshStandardMaterial color={color} emissive={emissive || "#000000"} emissiveIntensity={0.12} />
    </mesh>
  );
}

/** Multi-stage rocket: materials from `rocketVisual` prop; stage jettison from simulation state. */
function ConfigurableRocket({ stateRef, rocketVisual }) {
  const group = useRef();
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const vis = rocketVisual || ROCKET_DEFAULTS.visual;
  const c = vis.colors || ROCKET_DEFAULTS.visual.colors;

  useFrame(() => {
    const s = stateRef.current;
    if (!group.current) return;
    group.current.position.copy(s.pos);
    const h = s.heading.clone().normalize();
    group.current.quaternion.setFromUnitVectors(up, h);

    const L = (vis.lengthScale ?? 1) * 0.95;
    const W = vis.widthScale ?? 1;
    group.current.scale.set(W, L, W);

    const heat = s.heat ?? 0;
    const boosterGroup = group.current.getObjectByName("booster");
    const shell = boosterGroup?.children?.[0];
    if (shell?.material?.emissiveIntensity !== undefined) {
      shell.material.emissiveIntensity = 0.06 + heat * 2;
    }

    const st = s.stage ?? 1;
    const booster = group.current.getObjectByName("booster");
    const inter = group.current.getObjectByName("interstage");
    const stage2 = group.current.getObjectByName("stage2");
    const fins = group.current.getObjectByName("fins");
    if (booster) booster.visible = st < 2;
    if (inter) inter.visible = st < 2;
    if (stage2) stage2.visible = st < 3;
    if (fins) fins.visible = st < 2;
  });

  return (
    <group ref={group}>
      <group name="booster" position={[0, -0.32, 0]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.1, 0.12, 0.38, 24]} />
          <meshStandardMaterial color={c.booster} metalness={0.5} roughness={0.45} emissive="#1a0500" emissiveIntensity={0.06} />
        </mesh>
        <mesh position={[0, -0.22, 0]} castShadow>
          <cylinderGeometry args={[0.04, 0.1, 0.12, 16]} />
          <meshStandardMaterial color="#2a2f38" metalness={0.6} roughness={0.35} emissive="#ff4400" emissiveIntensity={0.15} />
        </mesh>
      </group>

      <mesh name="interstage" position={[0, -0.08, 0]} castShadow>
        <cylinderGeometry args={[0.09, 0.095, 0.08, 18]} />
        <meshStandardMaterial color={c.accent} metalness={0.55} roughness={0.4} emissive="#331100" emissiveIntensity={0.05} />
      </mesh>

      <group name="stage2" position={[0, 0.12, 0]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.085, 0.09, 0.28, 22]} />
          <meshStandardMaterial color={c.body} metalness={0.45} roughness={0.42} emissive="#0a1020" emissiveIntensity={0.04} />
        </mesh>
      </group>

      <group position={[0, 0.38, 0]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.075, 0.085, 0.26, 22]} />
          <meshStandardMaterial color={c.body} metalness={0.45} roughness={0.42} emissive="#ff6a2d" emissiveIntensity={0.08} />
        </mesh>
      </group>

      <FairingAndNose rocketVisual={vis} />

      <Fins rocketVisual={vis} />
    </group>
  );
}

function FairingAndNose({ rocketVisual }) {
  const v = rocketVisual || ROCKET_DEFAULTS.visual;
  const c = v.colors || ROCKET_DEFAULTS.visual.colors;
  const fairing = v.fairing || "standard";
  const nose = v.nose || "cone";

  return (
    <group position={[0, 0.62, 0]}>
      {fairing === "sleek" && (
        <mesh castShadow position={[0, 0.08, 0]}>
          <cylinderGeometry args={[0.052, 0.075, 0.26, 18]} />
          <meshStandardMaterial color={c.fairing} metalness={0.38} roughness={0.36} />
        </mesh>
      )}
      {fairing === "heavy" && (
        <mesh castShadow position={[0, 0.04, 0]}>
          <cylinderGeometry args={[0.08, 0.095, 0.18, 20]} />
          <meshStandardMaterial color={c.fairing} metalness={0.28} roughness={0.45} />
        </mesh>
      )}
      {fairing === "standard" && (
        <mesh castShadow position={[0, 0.06, 0]}>
          <cylinderGeometry args={[0.065, 0.082, 0.22, 20]} />
          <meshStandardMaterial color={c.fairing} metalness={0.35} roughness={0.38} />
        </mesh>
      )}
      <group position={[0, 0.28, 0]}>
        {nose === "cone" && (
          <mesh castShadow>
            <coneGeometry args={[0.07, 0.2, 18]} />
            <meshStandardMaterial color={c.fairing} metalness={0.42} roughness={0.34} />
          </mesh>
        )}
        {nose === "ogive" && (
          <mesh castShadow>
            <coneGeometry args={[0.065, 0.32, 18]} />
            <meshStandardMaterial color={c.fairing} metalness={0.42} roughness={0.34} />
          </mesh>
        )}
        {nose === "blunt" && (
          <mesh castShadow>
            <sphereGeometry args={[0.08, 18, 18]} />
            <meshStandardMaterial color={c.fairing} metalness={0.35} roughness={0.4} />
          </mesh>
        )}
      </group>
    </group>
  );
}

function Fins({ rocketVisual }) {
  const v = rocketVisual || ROCKET_DEFAULTS.visual;
  const n = Math.min(4, Math.max(0, v.finCount ?? 4));
  const c = v.colors || ROCKET_DEFAULTS.visual.colors;
  const fins = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    fins.push(
      <mesh
        key={i}
        visible={i < n}
        position={[Math.cos(a) * 0.14, -0.28, Math.sin(a) * 0.14]}
        rotation={[0, -a, 0.35]}
        castShadow
      >
        <boxGeometry args={[0.02, 0.12, 0.08]} />
        <meshStandardMaterial color={c.booster} metalness={0.4} roughness={0.5} />
      </mesh>
    );
  }
  return (
    <group name="fins">
      {fins}
    </group>
  );
}

function ExhaustParticles({ stateRef, thrustOn }) {
  const ref = useRef();
  const count = 48;
  const positions = useMemo(() => new Float32Array(count * 3), [count]);
  useFrame(() => {
    const s = stateRef.current;
    if (!ref.current) return;
    const active = thrustOn && s.fuel > 0 && (s.status === "flight" || s.status === "approach");
    const posAttr = ref.current.geometry.attributes.position;
    for (let i = 0; i < count; i++) {
      const t = Math.random();
      const back = s.heading.clone().multiplyScalar(-(0.18 + t * 0.55));
      const jitter = new THREE.Vector3((Math.random() - 0.5) * 0.1, (Math.random() - 0.5) * 0.1, (Math.random() - 0.5) * 0.1);
      const p = s.pos.clone().add(back).add(jitter);
      posAttr.setXYZ(i, p.x, p.y, p.z);
    }
    posAttr.needsUpdate = true;
    ref.current.visible = active;
  });
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial color="#ffcc66" size={0.055} transparent opacity={0.9} depthWrite={false} sizeAttenuation />
    </points>
  );
}

function TargetMarker({ stateRef }) {
  const ref = useRef();
  useFrame(() => {
    const s = stateRef.current;
    if (!ref.current || !s) return;
    const t = interceptHint(s);
    ref.current.position.copy(t);
  });
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.26, 0.34, 32]} />
      <meshBasicMaterial color="#00ffd5" transparent opacity={0.75} side={THREE.DoubleSide} />
    </mesh>
  );
}

function OrbitRing({ radius, color }) {
  const pts = useMemo(() => {
    const arr = [];
    for (let i = 0; i <= 128; i++) {
      const a = (i / 128) * Math.PI * 2;
      arr.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius));
    }
    return arr;
  }, [radius]);
  return <Line points={pts} color={color} lineWidth={1.4} transparent opacity={0.4} />;
}

function Bodies({ stateRef }) {
  const issRef = useRef();
  const moonRef = useRef();
  const marsRef = useRef();
  useFrame(() => {
    const s = stateRef.current;
    const t = s.t;
    const iss = bodyPosition(ISS_ORBIT_R, OMEGA_ISS, s.phaseISS, t);
    const moon = bodyPosition(MOON_ORBIT_R, OMEGA_MOON, s.phaseMoon, t);
    const mars = bodyPosition(MARS_ORBIT_R, OMEGA_MARS, s.phaseMars, t);
    if (issRef.current) issRef.current.position.copy(iss);
    if (moonRef.current) moonRef.current.position.copy(moon);
    if (marsRef.current) marsRef.current.position.copy(mars);
  });
  return (
    <>
      <group ref={issRef}>
        <mesh castShadow>
          <boxGeometry args={[0.14, 0.07, 0.2]} />
          <meshStandardMaterial color="#dde8ff" emissive="#88aaff" emissiveIntensity={0.45} />
        </mesh>
      </group>
      <group ref={moonRef}>
        <CelestialSphere position={[0, 0, 0]} radius={MOON_RADIUS} color="#b8b8c8" emissive="#222" />
      </group>
      <group ref={marsRef}>
        <CelestialSphere position={[0, 0, 0]} radius={MARS_RADIUS} color="#c04a2c" emissive="#2a0800" />
      </group>
    </>
  );
}

function CameraRig({ mode, stateRef }) {
  const { camera } = useThree();
  useFrame(() => {
    if (mode === "orbit") return;
    const s = stateRef.current;
    const p = s.pos;
    if (mode === "follow") {
      const dist = 2.85;
      const off = s.heading.clone().multiplyScalar(-dist).add(new THREE.Vector3(0, 0.55, 0));
      camera.position.lerp(p.clone().add(off), 0.12);
      const look = p.clone().add(s.heading.clone().multiplyScalar(0.4));
      camera.lookAt(look);
    } else if (mode === "ground") {
      const pad = new THREE.Vector3(EARTH_RADIUS + 0.35, 0.55, 0.95);
      camera.position.lerp(pad, 0.08);
      camera.lookAt(p);
    }
  });
  return null;
}

function SimulationLoop({ stateRef, controlsRef, replayMode }) {
  useFrame((_, delta) => {
    if (replayMode) return;
    const c = controlsRef.current;
    stepSimulation(stateRef.current, Math.min(delta, 0.05), c);
  });
  return null;
}

function SceneLights() {
  return (
    <>
      <ambientLight intensity={0.42} />
      <hemisphereLight args={["#c8d8ff", "#080a12", 0.55]} position={[0, 40, 0]} />
      <directionalLight castShadow position={[22, 18, 14]} intensity={1.45} shadow-mapSize={[1536, 1536]} />
      <pointLight position={[-14, 8, -10]} intensity={0.55} color="#6688ff" />
    </>
  );
}

export default function SpaceMissionCanvas({
  stateRef,
  controlsRef,
  cameraMode,
  earthRotation,
  showGhost,
  ghostPoints,
  trailPoints,
  thrustOn,
  replayMode,
  showSceneGrid,
  rocketVisual
}) {
  const linePoints = useMemo(() => ghostPoints || [], [ghostPoints]);
  const orbitOn = cameraMode === "orbit";

  return (
    <Canvas
      shadows
      camera={{ position: [10, 6.5, 10], fov: 54, near: 0.08, far: 500 }}
      gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
      dpr={[1, 2]}
      style={{ width: "100%", height: "100%", touchAction: "none" }}
    >
      <color attach="background" args={["#03060e"]} />
      <SceneLights />
      <Stars radius={100} depth={50} count={6000} factor={2.8} saturation={0} fade speed={0.35} />
      <EarthMesh rotation={earthRotation} />
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -EARTH_RADIUS - 0.02, 0]}>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#050810" transparent opacity={0.42} />
      </mesh>
      {showSceneGrid && (
        <Grid
          position={[0, -0.015, 0]}
          cellSize={0.65}
          cellThickness={0.6}
          sectionSize={3.5}
          fadeDistance={42}
          infiniteGrid
          sectionColor="#3a5078"
          cellColor="#1f2d48"
        />
      )}
      <OrbitRing radius={ISS_ORBIT_R} color="#66ccff" />
      <OrbitRing radius={MOON_ORBIT_R} color="#aaaacc" />
      <OrbitRing radius={MARS_ORBIT_R} color="#ff8866" />
      <Bodies stateRef={stateRef} />
      <ConfigurableRocket stateRef={stateRef} rocketVisual={rocketVisual} />
      <ExhaustParticles stateRef={stateRef} thrustOn={thrustOn} />
      {showGhost && linePoints.length > 1 && (
        <Line points={linePoints} color="#44ffcc" lineWidth={1.4} transparent opacity={0.5} />
      )}
      {trailPoints && trailPoints.length > 2 && (
        <Line points={trailPoints} color="#ff66aa" lineWidth={1.6} transparent opacity={0.58} />
      )}
      <TargetMarker stateRef={stateRef} />
      <SimulationLoop stateRef={stateRef} controlsRef={controlsRef} replayMode={replayMode} />
      <CameraRig mode={cameraMode} stateRef={stateRef} />
      <OrbitControls
        makeDefault
        enablePan={orbitOn}
        enableRotate={orbitOn}
        enabled={orbitOn}
        minDistance={1.8}
        maxDistance={55}
        enableDamping
        dampingFactor={0.08}
        zoomSpeed={0.85}
      />
      <GizmoHelper alignment="bottom-right" margin={[72, 72]}>
        <GizmoViewport axisColors={["#ff4b81", "#3dff9d", "#4db8ff"]} labelColor="#e8f0ff" />
      </GizmoHelper>
    </Canvas>
  );
}
