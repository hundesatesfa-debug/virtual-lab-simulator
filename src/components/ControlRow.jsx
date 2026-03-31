export default function ControlRow({ label, value, min, max, step = 1, unit, onChange, disabled }) {
  return (
    <label className={`control-row ${disabled ? "disabled" : ""}`}>
      <span>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <strong>
        {value}
        {unit}
      </strong>
    </label>
  );
}
