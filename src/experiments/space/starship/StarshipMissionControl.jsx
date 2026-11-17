import { useCallback, useEffect, useRef, useState } from "react";
import {
  createLaunchStack,
  getStackTelemetry,
  igniteBooster,
  separateStages,
  setStackPitch,
  setStackThrottle,
  stepLaunchStack,
  stepSeparatedVehicles,
} from "./launchStack.js";
import {
  setBoosterFlightControls,
  setStarshipFlightControls,
  startBoosterBoostback,
  startBoosterDescent,
  startBoosterLandingBurn,
  startStarshipCoast,
  startStarshipOrbitalBurn,
  startStarshipRecoveryBurn,
  recordMissionEvent,
} from "./stageMissions.js";
import StarbaseScene from "../starbase/StarbaseScene.jsx";

const SIMULATION_STEP = 0.05;

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

function TelemetryValue({ label, value, unit }) {
  return (
    <div className="mission-telemetry-value">
      <span>{label}</span>
      <strong>{value}<small>{unit}</small></strong>
    </div>
  );
}

function VehicleTelemetry({ title, data }) {
  return (
    <section className="vehicle-telemetry">
      <div className="vehicle-telemetry-heading">
        <strong>{title}</strong>
        <span>{data.status}</span>
      </div>
      <div className="mission-telemetry-grid">
        <TelemetryValue label="Altitude" value={(data.altitudeMeters / 1000).toFixed(1)} unit="km" />
        <TelemetryValue label="Velocity" value={(data.speed / 1000).toFixed(2)} unit="km/s" />
        <TelemetryValue label="Acceleration" value={data.accelerationG.toFixed(2)} unit="g" />
        <TelemetryValue label="Throttle" value={(data.throttle * 100).toFixed(0)} unit="%" />
        <TelemetryValue label="Propellant" value={(data.propellantKg / 1000).toFixed(0)} unit="t" />
        <TelemetryValue label="Dynamic pressure" value={(data.dynamicPressurePa / 1000).toFixed(1)} unit="kPa" />
        <TelemetryValue label="Heating" value={(data.heatingRateWm2 / 1e6).toFixed(2)} unit="MW/m²" />
        <TelemetryValue label="Mission time" value={formatTime(data.elapsedTime)} unit="" />
      </div>
    </section>
  );
}

export default function StarshipMissionControl() {
  const stackRef = useRef(createLaunchStack());
  const eventFlagsRef = useRef({ boosterLanded: false, starshipLanded: false });
  const [telemetry, setTelemetry] = useState(() => getStackTelemetry(stackRef.current));
  const [boosterFuel, setBoosterFuel] = useState(100);
  const [starshipFuel, setStarshipFuel] = useState(100);
  const [prepared, setPrepared] = useState(true);
  const [countdown, setCountdown] = useState(null);
  const [missionOpen, setMissionOpen] = useState(true);
  const [telemetryOpen, setTelemetryOpen] = useState(true);
  const [eventsOpen, setEventsOpen] = useState(false);
  const [error, setError] = useState("");

  const publishTelemetry = useCallback(() => {
    const next = getStackTelemetry(stackRef.current);
    setTelemetry(next);
  }, []);

  const perform = useCallback((action) => {
    setError("");
    try {
      action(stackRef.current);
      publishTelemetry();
    } catch (err) {
      setError(err.message || "Mission command could not be completed.");
    }
  }, [publishTelemetry]);

  useEffect(() => {
    if (countdown === null) return undefined;

    if (countdown === 0) {
      const timer = window.setTimeout(() => {
        perform(igniteBooster);
        setCountdown(null);
      }, 650);
      return () => window.clearTimeout(timer);
    }

    const timer = window.setTimeout(() => setCountdown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [countdown, perform]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const stack = stackRef.current;
      if (stack.phase === "PAD") return;

      if (stack.separated) {
        stepSeparatedVehicles(stack, SIMULATION_STEP);
      } else {
        stepLaunchStack(stack, SIMULATION_STEP);
      }

      if (stack.separated && stack.booster.landed && !eventFlagsRef.current.boosterLanded) {
        recordMissionEvent(stack, "Super Heavy booster recovery complete.");
        eventFlagsRef.current.boosterLanded = true;
      }
      if (stack.separated && stack.starship.landed && !eventFlagsRef.current.starshipLanded) {
        recordMissionEvent(stack, "Starship recovery complete.");
        eventFlagsRef.current.starshipLanded = true;
      }

      setTelemetry(getStackTelemetry(stack));
    }, 50);

    return () => window.clearInterval(timer);
  }, []);

  const applyVehiclePreparation = () => {
    const stack = createLaunchStack({
      boosterFuelPercent: boosterFuel,
      starshipFuelPercent: starshipFuel,
    });
    recordMissionEvent(
      stack,
      `Vehicle prepared with ${boosterFuel}% booster and ${starshipFuel}% Starship propellant.`
    );
    stackRef.current = stack;
    eventFlagsRef.current = { boosterLanded: false, starshipLanded: false };
    setPrepared(true);
    setCountdown(null);
    setError("");
    publishTelemetry();
  };

  const startCountdown = () => {
    setError("");
    recordMissionEvent(stackRef.current, "Terminal countdown initiated.");
    publishTelemetry();
    setCountdown(3);
  };

  const updateAscentControl = (key, value) => {
    const stack = stackRef.current;
    if (key === "throttle") setStackThrottle(stack, value / 100);
    else setStackPitch(stack, value);
    setTelemetry(getStackTelemetry(stack));
  };

  const updateSeparatedControl = (vehicle, key, value) => {
    const stack = stackRef.current;
    const controls = {
      [key]: key === "throttle" ? value / 100 : value,
    };

    if (vehicle === "booster") setBoosterFlightControls(stack, controls);
    else setStarshipFlightControls(stack, controls);
    setTelemetry(getStackTelemetry(stack));
  };

  const resetMission = () => {
    stackRef.current = createLaunchStack({
      boosterFuelPercent: boosterFuel,
      starshipFuelPercent: starshipFuel,
    });
    eventFlagsRef.current = { boosterLanded: false, starshipLanded: false };
    setPrepared(true);
    setCountdown(null);
    setError("");
    publishTelemetry();
  };

  const toggleEvents = () => {
    setEventsOpen((open) => {
      const opening = !open;
      if (opening && window.matchMedia("(max-width: 680px)").matches) {
        setMissionOpen(false);
      }
      return opening;
    });
  };

  const booster = telemetry.booster;
  const starship = telemetry.starship;
  const isReady = telemetry.phase === "PAD";
  const isAscent = !telemetry.separated && !isReady;

  return (
    <StarbaseScene missionTelemetry={telemetry}>
    <div className="mission-overlay">
      <section className={`mission-console ${missionOpen ? "is-open" : ""}`}>
        <button
          type="button"
          className="mission-panel-toggle"
          aria-expanded={missionOpen}
          onClick={() => setMissionOpen((open) => !open)}
        >
          <span>
            <span className="mission-panel-eyebrow">STARSHIP · FLIGHT CONTROL</span>
            <strong>Mission control</strong>
          </span>
          <span className="mission-phase-badge">{telemetry.phase}</span>
          <span className="panel-chevron" aria-hidden="true">{missionOpen ? "−" : "+"}</span>
        </button>

        {missionOpen && (
          <div className="mission-console-body">
            {isReady && (
              <>
                <section className="mission-control-group">
                  <h3>Vehicle preparation</h3>
                  <div className="mission-slider">
                    <label htmlFor="booster-fuel">Booster propellant</label>
                    <strong>{boosterFuel}%</strong>
                    <input
                      id="booster-fuel"
                      type="range"
                      min="20"
                      max="100"
                      step="5"
                      value={boosterFuel}
                      disabled={countdown !== null}
                      onChange={(event) => {
                        setBoosterFuel(Number(event.target.value));
                        setPrepared(false);
                      }}
                    />
                  </div>
                  <div className="mission-slider">
                    <label htmlFor="starship-fuel">Starship propellant</label>
                    <strong>{starshipFuel}%</strong>
                    <input
                      id="starship-fuel"
                      type="range"
                      min="20"
                      max="100"
                      step="5"
                      value={starshipFuel}
                      disabled={countdown !== null}
                      onChange={(event) => {
                        setStarshipFuel(Number(event.target.value));
                        setPrepared(false);
                      }}
                    />
                  </div>
                  <button
                    className="mission-command secondary"
                    type="button"
                    onClick={applyVehiclePreparation}
                    disabled={prepared}
                  >
                    {prepared ? "Vehicle ready" : "Apply propellant load"}
                  </button>
                </section>

                <section className="mission-control-group">
                  <h3>Countdown & launch</h3>
                  {countdown !== null ? (
                    <div className="countdown-readout">T−{countdown}</div>
                  ) : (
                    <button
                      className="mission-command primary"
                      type="button"
                      onClick={startCountdown}
                      disabled={!prepared}
                    >
                      Begin terminal countdown
                    </button>
                  )}
                </section>
              </>
            )}

            {isAscent && (
              <>
                <section className="mission-control-group">
                  <h3>Ascent flight controls</h3>
                  <div className="mission-slider">
                    <label htmlFor="stack-throttle">Throttle</label>
                    <strong>{Math.round(booster.throttle * 100)}%</strong>
                    <input
                      id="stack-throttle"
                      type="range"
                      min="0"
                      max="100"
                      value={Math.round(booster.throttle * 100)}
                      onChange={(event) => updateAscentControl("throttle", Number(event.target.value))}
                    />
                  </div>
                  <div className="mission-slider">
                    <label htmlFor="stack-pitch">Pitch</label>
                    <strong>{Math.round(booster.pitchDeg)}°</strong>
                    <input
                      id="stack-pitch"
                      type="range"
                      min="0"
                      max="90"
                      value={Math.round(booster.pitchDeg)}
                      onChange={(event) => updateAscentControl("pitch", Number(event.target.value))}
                    />
                  </div>
                  <button
                    className="mission-command secondary"
                    type="button"
                    disabled={booster.altitudeMeters < 1000}
                    onClick={() => perform(separateStages)}
                  >
                    Separate stages
                  </button>
                </section>
              </>
            )}

            {telemetry.separated && (
              <>
                {!booster.landed && (
                  <section className="mission-control-group">
                    <h3>Booster recovery</h3>
                    <div className="mission-slider">
                      <label htmlFor="booster-throttle">Booster throttle</label>
                      <strong>{Math.round(booster.throttle * 100)}%</strong>
                      <input
                        id="booster-throttle"
                        type="range"
                        min="0"
                        max="100"
                        value={Math.round(booster.throttle * 100)}
                        onChange={(event) =>
                          updateSeparatedControl("booster", "throttle", Number(event.target.value))
                        }
                      />
                    </div>
                    <div className="mission-command-row">
                      {booster.engineOn && (
                        <button className="mission-command secondary" type="button" onClick={() => perform(startBoosterDescent)}>
                          Cutoff · begin descent
                        </button>
                      )}
                      {!booster.engineOn &&
                        booster.propellantKg > 0 &&
                        (booster.altitudeMeters < 50000 && booster.verticalVelocity < 0 ? (
                          <button className="mission-command primary" type="button" onClick={() => perform(startBoosterLandingBurn)}>
                            Landing burn
                          </button>
                        ) : (
                          <button className="mission-command secondary" type="button" onClick={() => perform(startBoosterBoostback)}>
                            Boostback burn
                          </button>
                        ))}
                    </div>
                  </section>
                )}

                {!starship.landed && (
                  <section className="mission-control-group">
                    <h3>Starship flight & recovery</h3>
                    <div className="mission-slider">
                      <label htmlFor="starship-pitch">Pitch</label>
                      <strong>{Math.round(starship.pitchDeg)}°</strong>
                      <input
                        id="starship-pitch"
                        type="range"
                        min="0"
                        max="180"
                        value={Math.round(starship.pitchDeg)}
                        onChange={(event) =>
                          updateSeparatedControl("starship", "pitchDeg", Number(event.target.value))
                        }
                      />
                    </div>
                    <div className="mission-command-row">
                      {!starship.engineOn && starship.propellantKg > 0 && (
                        starship.verticalVelocity < 0 && starship.altitudeMeters < 120000 ? (
                          <button className="mission-command primary" type="button" onClick={() => perform(startStarshipRecoveryBurn)}>
                            Recovery burn
                          </button>
                        ) : (
                          <button className="mission-command secondary" type="button" onClick={() => perform(startStarshipOrbitalBurn)}>
                            Orbital insertion
                          </button>
                        )
                      )}
                      {starship.engineOn && (
                        <button className="mission-command secondary" type="button" onClick={() => perform(startStarshipCoast)}>
                          Cutoff · coast
                        </button>
                      )}
                    </div>
                  </section>
                )}
              </>
            )}

            {error && <p className="mission-error" role="alert">{error}</p>}
            {!isReady && (
              <button className="mission-command secondary" type="button" onClick={resetMission}>
                Reset mission
              </button>
            )}
          </div>
        )}
      </section>

      <section className="mission-telemetry-panel">
        <button
          type="button"
          className="telemetry-panel-toggle"
          aria-expanded={telemetryOpen}
          onClick={() => setTelemetryOpen((open) => !open)}
        >
          <span><i /> LIVE TELEMETRY</span>
          <span>{formatTime(telemetry.missionTime)}</span>
          <span className="panel-chevron" aria-hidden="true">{telemetryOpen ? "−" : "+"}</span>
        </button>
        {telemetryOpen && (
          <div className="telemetry-vehicles">
            <VehicleTelemetry title={telemetry.separated ? "SUPER HEAVY · BOOSTER" : "STARSHIP STACK"} data={booster} />
            {telemetry.separated && <VehicleTelemetry title="STARSHIP · UPPER STAGE" data={starship} />}
          </div>
        )}
      </section>

      <section className={`mission-event-panel ${eventsOpen ? "is-open" : ""}`}>
        <button
          type="button"
          className="event-panel-toggle"
          aria-expanded={eventsOpen}
          onClick={toggleEvents}
        >
          <span>Mission events</span>
          <span className="event-count">{telemetry.events.length}</span>
          <span className="panel-chevron" aria-hidden="true">{eventsOpen ? "−" : "+"}</span>
        </button>
        {eventsOpen && (
          <ol className="mission-event-list" aria-live="polite">
            {[...telemetry.events].reverse().slice(0, 8).map((event, index) => (
              <li key={`${event.time}-${index}`}>
                <time>{formatTime(event.time)}</time>
                <span>{event.message}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
    </StarbaseScene>
  );
}
