export default function LabGraph({ series, xLabel, yLabel }) {
  const width = 420;
  const height = 180;
  const padL = 42;
  const padR = 10;
  const padT = 10;
  const padB = 28;

  const allPoints = (series || []).flatMap((srs) => srs.points || []);
  const maxX = Math.max(...allPoints.map((p) => p.x), 1);
  const minX = Math.min(...allPoints.map((p) => p.x), 0);
  const maxY = Math.max(...allPoints.map((p) => p.y), 1);
  const minY = Math.min(...allPoints.map((p) => p.y), 0);

  const px = (x) => padL + ((x - minX) / (maxX - minX || 1)) * (width - padL - padR);
  const py = (y) => height - padB - ((y - minY) / (maxY - minY || 1)) * (height - padT - padB);

  const gridX = 5;
  const gridY = 5;

  return (
    <div className="graph">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${yLabel} vs ${xLabel}`}>
        <rect x="0" y="0" width={width} height={height} fill="transparent" />

        {Array.from({ length: gridX + 1 }, (_, i) => {
          const x = padL + (i / gridX) * (width - padL - padR);
          return <line key={`gx${i}`} x1={x} y1={padT} x2={x} y2={height - padB} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />;
        })}
        {Array.from({ length: gridY + 1 }, (_, i) => {
          const y = padT + (i / gridY) * (height - padT - padB);
          return <line key={`gy${i}`} x1={padL} y1={y} x2={width - padR} y2={y} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />;
        })}

        <line x1={padL} y1={height - padB} x2={width - padR} y2={height - padB} stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
        <line x1={padL} y1={padT} x2={padL} y2={height - padB} stroke="rgba(255,255,255,0.25)" strokeWidth="1" />

        {Array.from({ length: gridX + 1 }, (_, i) => {
          const v = minX + (i / gridX) * (maxX - minX);
          return (
            <text key={`tx${i}`} x={padL + (i / gridX) * (width - padL - padR)} y={height - padB + 14} fontSize="8" fill="rgba(255,255,255,0.4)" textAnchor="middle">
              {v.toFixed(1)}
            </text>
          );
        })}
        {Array.from({ length: gridY + 1 }, (_, i) => {
          const v = minY + (i / gridY) * (maxY - minY);
          return (
            <text key={`ty${i}`} x={padL - 6} y={height - padB - (i / gridY) * (height - padT - padB) + 3} fontSize="8" fill="rgba(255,255,255,0.4)" textAnchor="end">
              {v.toFixed(1)}
            </text>
          );
        })}

        {(series || []).map((srs, si) => {
          const pts = srs.points || [];
          if (pts.length === 0) return null;
          const path = pts
            .map((p, index) => {
              const x = px(p.x);
              const y = py(p.y);
              return `${index === 0 ? "M" : "L"} ${x} ${y}`;
            })
            .join(" ");
          return (
            <g key={si}>
              <path d={path} fill="none" stroke={srs.color || "#00ffd5"} strokeWidth="2.5" />
              {srs.pointsOnly &&
                pts.map((p, i) => (
                  <circle key={i} cx={px(p.x)} cy={py(p.y)} r="3" fill={srs.color || "#00ffd5"} />
                ))}
            </g>
          );
        })}
      </svg>

      {(series || []).filter((srs) => srs.label).length > 1 && (
        <div className="graph-legend">
          {(series || []).map((srs, i) => (
            <span key={i} className="legend-item">
              <i style={{ background: srs.color || "#00ffd5" }} />
              {srs.label}
            </span>
          ))}
        </div>
      )}
      <small>
        {yLabel} vs {xLabel}
      </small>
    </div>
  );
}