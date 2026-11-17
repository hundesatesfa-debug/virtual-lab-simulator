import { useEffect, useRef, useState } from "react";

import {
  Viewer,
  Ion,
  Cartesian3,
  Cartesian2,
  Math as CesiumMath,
  Color,
  ImageryLayer,
  createWorldTerrainAsync,
  createWorldImageryAsync,
  createOsmBuildingsAsync,
  SkyAtmosphere,
} from "cesium";

import "cesium/Build/Cesium/Widgets/widgets.css";

const STARBASE = {
  longitude: -97.15799,
  latitude: 25.99677,
};

export default function StarbaseScene({ missionTelemetry, children }) {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const viewerRef = useRef(null);
  const vehicleEntityRef = useRef(null);

  const [status, setStatus] = useState("Loading Starbase...");
  const [error, setError] = useState("");
  const [fullscreen, setFullscreen] = useState(false);
  const [viewerReady, setViewerReady] = useState(false);
  const [vehicleTracking, setVehicleTracking] = useState(false);
  const [trackedVehicle, setTrackedVehicle] = useState("starship");

  const vehicleTelemetry = missionTelemetry?.phase !== "PAD"
    ? missionTelemetry?.separated
      ? missionTelemetry[trackedVehicle]
      : missionTelemetry?.booster
    : null;
  const vehicleName = missionTelemetry?.separated
    ? trackedVehicle === "booster" ? "Super Heavy Booster" : "Starship"
    : "Starship Stack";
  const vehicleLabel = missionTelemetry?.separated
    ? trackedVehicle === "booster" ? "BOOSTER" : "STARSHIP"
    : "STACK";

  useEffect(() => {
    let cancelled = false;
    let viewer;
    let resizeObserver;

    const handleFullscreenChange = () => {
      setFullscreen(document.fullscreenElement === sceneRef.current);
    };

    async function initialize() {
      try {
        const token = import.meta.env.VITE_CESIUM_ION_TOKEN;

        if (!token) {
          throw new Error("Cesium token is missing. Check .env.local.");
        }

        Ion.defaultAccessToken = token;

        setStatus("Loading satellite imagery and Texas terrain...");

        const [terrainProvider, imageryProvider] = await Promise.all([
          createWorldTerrainAsync({
            requestVertexNormals: true,
            requestWaterMask: true,
          }),
          createWorldImageryAsync(),
        ]);

        if (cancelled) return;

        const baseLayer =
          ImageryLayer.fromProviderAsync(
            Promise.resolve(imageryProvider)
          );

        viewer = new Viewer(containerRef.current, {
          terrainProvider,
          baseLayer,

          animation: false,
          timeline: false,
          geocoder: false,
          homeButton: true,
          sceneModePicker: false,
          navigationHelpButton: false,
          baseLayerPicker: false,
          fullscreenButton: false,
          infoBox: false,
          selectionIndicator: false,
          shouldAnimate: true,
        });

        viewerRef.current = viewer;
        setViewerReady(true);
        resizeObserver = new ResizeObserver(() => {
          if (!viewer.isDestroyed()) {
            viewer.resize();
            viewer.scene.requestRender();
          }
        });
        resizeObserver.observe(containerRef.current);
        document.addEventListener("fullscreenchange", handleFullscreenChange);

        viewer.scene.globe.enableLighting = true;
        viewer.scene.globe.showGroundAtmosphere = true;
        viewer.scene.skyAtmosphere = new SkyAtmosphere();

        viewer.scene.screenSpaceCameraController.minimumZoomDistance = 80;
        viewer.scene.screenSpaceCameraController.maximumZoomDistance = 5000000;

        viewer.camera.setView({
          destination: Cartesian3.fromDegrees(
            STARBASE.longitude,
            STARBASE.latitude,
            1800
          ),
          orientation: {
            heading: CesiumMath.toRadians(0),
            pitch: CesiumMath.toRadians(-45),
            roll: 0,
          },
        });

        setStatus("Satellite imagery loaded. Loading 3D buildings...");

        const buildings = await createOsmBuildingsAsync();

        if (cancelled || viewer.isDestroyed()) return;

        viewer.scene.primitives.add(buildings);

        setStatus("Starbase geographical environment loaded.");
      } catch (err) {
        console.error("Starbase initialization error:", err);

        if (!cancelled) {
          setError(err.message || "Unable to load Starbase.");
          setStatus("Scene loading failed.");
        }
      }
    }

    initialize();

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      setViewerReady(false);
      vehicleEntityRef.current = null;

      if (viewer && !viewer.isDestroyed()) {
        viewer.destroy();
      }

      viewerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewerReady || !viewer || viewer.isDestroyed()) return;

    if (!vehicleTelemetry) {
      if (vehicleEntityRef.current) {
        viewer.entities.remove(vehicleEntityRef.current);
        vehicleEntityRef.current = null;
      }
      if (viewer.trackedEntity) viewer.trackedEntity = undefined;
      return;
    }

    const latitudeRadians = CesiumMath.toRadians(STARBASE.latitude);
    const longitude = STARBASE.longitude +
      vehicleTelemetry.downrangeMeters / (111320 * Math.cos(latitudeRadians));
    const position = Cartesian3.fromDegrees(
      longitude,
      STARBASE.latitude,
      Math.max(0, vehicleTelemetry.altitudeMeters)
    );

    if (!vehicleEntityRef.current) {
      vehicleEntityRef.current = viewer.entities.add({
        name: vehicleName,
        position,
        point: {
          pixelSize: 10,
          color: Color.CYAN,
          outlineColor: Color.WHITE,
          outlineWidth: 2,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: {
          text: vehicleLabel,
          font: "11px Inter, sans-serif",
          fillColor: Color.WHITE,
          outlineColor: Color.BLACK,
          outlineWidth: 3,
          pixelOffset: new Cartesian2(0, -18),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });
    } else {
      vehicleEntityRef.current.position = position;
      vehicleEntityRef.current.name = vehicleName;
      vehicleEntityRef.current.label.text = vehicleLabel;
    }

    if (vehicleTracking) {
      viewer.trackedEntity = vehicleEntityRef.current;
    } else if (viewer.trackedEntity === vehicleEntityRef.current) {
      viewer.trackedEntity = undefined;
    }
    viewer.scene.requestRender();
  }, [missionTelemetry, trackedVehicle, vehicleTelemetry, vehicleTracking, viewerReady]);

  function flyTo(height, pitch = -45) {
    const viewer = viewerRef.current;

    if (!viewer || viewer.isDestroyed()) return;
    setVehicleTracking(false);
    viewer.trackedEntity = undefined;

    viewer.camera.flyTo({
      destination: Cartesian3.fromDegrees(
        STARBASE.longitude,
        STARBASE.latitude,
        height
      ),
      orientation: {
        heading: CesiumMath.toRadians(0),
        pitch: CesiumMath.toRadians(pitch),
        roll: 0,
      },
      duration: 2,
    });
  }

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement === sceneRef.current) {
        await document.exitFullscreen();
      } else {
        await sceneRef.current?.requestFullscreen();
      }
    } catch (err) {
      setError(err.message || "Unable to change fullscreen mode.");
    }
  }

  return (
    <div className="starbase-scene" ref={sceneRef}>
      <div className="starbase-toolbar">
        <div>
          <strong><span className="scene-live-dot" /> STARBASE · TEXAS</strong>
          <span>{status}</span>
        </div>

        <div className="starbase-actions">
          <button type="button" onClick={() => flyTo(450, -35)}>
            Launch Pad
          </button>

          <button type="button" onClick={() => flyTo(1800, -45)}>
            Wide View
          </button>

          <button type="button" onClick={() => flyTo(120000, -60)}>
            Regional View
          </button>

          {missionTelemetry?.separated && (
            <select
              aria-label="Vehicle to track"
              value={trackedVehicle}
              onChange={(event) => {
                setTrackedVehicle(event.target.value);
                setVehicleTracking(true);
              }}
            >
              <option value="starship">Starship</option>
              <option value="booster">Booster</option>
            </select>
          )}

          <button
            type="button"
            disabled={!vehicleTelemetry}
            className={vehicleTracking ? "is-tracking" : ""}
            onClick={() => setVehicleTracking((tracking) => !tracking)}
          >
            {vehicleTracking ? "Stop tracking" : "Track vehicle"}
          </button>

          <button type="button" onClick={toggleFullscreen}>
            {fullscreen ? "Exit fullscreen" : "Fullscreen"}
          </button>
        </div>
      </div>

      {error && (
        <div className="starbase-error">
          {error}
        </div>
      )}

      <div
        ref={containerRef}
        className="starbase-globe"
        aria-label="Interactive Cesium map of Starbase, Texas"
      />
      {children}
    </div>
  );
}
