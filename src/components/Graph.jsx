export default function Graph({ points, xLabel, yLabel, color = "#00ffd5" }) {
  const width = 420;
  const height = 180;
  const maxX = Math.max(...points.map((p) => p.x), 1);
  const maxY = Math.max(...points.map((p) => p.y), 1);

  const path = points
    .map((p, index) => {
      const x = (p.x / maxX) * (width - 32) + 16;
      const y = height - (p.y / maxY) * (height - 32) - 16;
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");

  return (
    <div className="graph">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${yLabel} vs ${xLabel}`}>
        <rect x="0" y="0" width={width} height={height} fill="transparent" />
        <path d={path} fill="none" stroke={color} strokeWidth="3" />
      </svg>
      <small>
        {xLabel} vs {yLabel}
      </small>
    </div>
  );
}
