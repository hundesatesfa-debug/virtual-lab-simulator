import { Canvas } from "@react-three/fiber";
import { OrbitControls, Float } from "@react-three/drei";
import { Suspense } from "react";

function Equipment({ experimentId }) {
  const colorMap = {
    ohms: "#00ffd5",
    projectile: "#ff4fd8",
    pendulum: "#42ff80",
    optics: "#5ea9ff",
    newton2: "#ffb347",
    spaceMission: "#66ccff",
    seriesParallel: "#00ffd5",
    freeFall: "#ffb347",
    friction: "#ffb347",
    hooke: "#42ff80",
    workEnergy: "#b09cff",
    conservation: "#00ffd5",
    collision: "#ff8fa3",
    centripetal: "#ff5aa9",
    waveString: "#00ffd5",
    soundWave: "#fff06a",
    lensExperiment: "#5ea9ff",
    induction: "#9f7bff",
    magneticForce: "#ff5aa9",
    rcCircuit: "#ffb347",
    heatTransfer: "#ff7b6b",
    idealGas: "#7bd6d6",
    shm: "#42ff80",
    doppler: "#fff06a",
    orbit: "#66ccff",
    planetFall: "#66ccff",
    escapeVelocity: "#66ccff",
    projectileAir: "#ff4fd8",
    viscousFlow: "#5ea9ff",
    buoyancy: "#5ea9ff",
    pressureLiquids: "#5ea9ff",
    bernoulli: "#5ea9ff",
    motor: "#ffb347",
    generator: "#ffb347",
    solar: "#fff06a",
    energyConversion: "#b09cff",
    measurement: "#9cb1d4",
    dimensional: "#9cb1d4",
    vectorAddition: "#7bff9e",
    targetChallenge: "#ff4fd8"
  };
  const color = colorMap[experimentId] ?? "#00ffd5";

  return (
    <group>
      <mesh position={[0, -1.2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[9, 9]} />
        <meshStandardMaterial color="#0f1724" metalness={0.6} roughness={0.3} />
      </mesh>
      <Float speed={2} rotationIntensity={0.4}>
        <mesh position={[0, 0.3, 0]}>
          <boxGeometry args={[1.8, 0.8, 1]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.28} />
        </mesh>
      </Float>
      <mesh position={[0, 0.95, 0]}>
        <torusGeometry args={[0.7, 0.08, 12, 50]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
    </group>
  );
}

export default function LabScene({ experimentId }) {
  return (
    <div className="scene glass">
      <Canvas camera={{ position: [2.3, 2.1, 2.8], fov: 55 }}>
        <ambientLight intensity={0.6} />
        <directionalLight intensity={1.4} position={[3, 5, 4]} />
        <Suspense fallback={null}>
          <Equipment experimentId={experimentId} />
        </Suspense>
        <OrbitControls enablePan={false} />
      </Canvas>
    </div>
  );
}
