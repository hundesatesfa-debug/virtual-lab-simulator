import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { experiments } from "../data/experiments";

const categories = [
  { name: "Mechanics", icon: "↗" },
  { name: "Waves and Optics", icon: "〰" },
  { name: "Electricity and Magnetism", icon: "ϟ" },
  { name: "Thermodynamics", icon: "◉" },
  { name: "Astronomy and Space", icon: "✦" },
  { name: "Advanced Physics", icon: "◇" }
];

function getCategory(topic = "") {
  const value = topic.toLowerCase();
  if (value.includes("electric") || value.includes("magnet")) return "Electricity and Magnetism";
  if (value.includes("wave") || value.includes("optic") || value.includes("oscillation")) {
    return "Waves and Optics";
  }
  if (value.includes("thermo") || value.includes("kinetic theory")) return "Thermodynamics";
  if (value.includes("astro") || value.includes("space") || value.includes("orbit")) {
    return "Astronomy and Space";
  }
  if (
    value.includes("mechanic") || value.includes("kinematic") || value.includes("dynamic") ||
    value.includes("energy") || value.includes("momentum") || value.includes("elastic") ||
    value.includes("circular") || value.includes("fluid")
  ) {
    return "Mechanics";
  }
  return "Advanced Physics";
}

export default function Dashboard({ selected, onSelect, assessmentMode, onClose }) {
  const [query, setQuery] = useState("");
  const groupedExperiments = useMemo(() => {
    const search = query.trim().toLowerCase();
    return categories.map((category) => ({
      ...category,
      experiments: experiments.filter((experiment) => {
        const matchesCategory = getCategory(experiment.topic) === category.name;
        const matchesQuery =
          !search ||
          experiment.title.toLowerCase().includes(search) ||
          experiment.topic.toLowerCase().includes(search);
        return matchesCategory && matchesQuery;
      })
    })).filter((category) => category.experiments.length > 0);
  }, [query]);

  return (
    <motion.aside
      className="experiment-drawer"
      role="dialog"
      aria-modal="true"
      aria-labelledby="experiment-drawer-title"
      initial={{ x: -18, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -18, opacity: 0 }}
      transition={{ duration: 0.18 }}
    >
      <div className="drawer-heading">
        <div>
          <span className="context-label">VIRTUAL PHYSICS LAB</span>
          <h2 id="experiment-drawer-title">Experiments</h2>
        </div>
        <button className="icon-button" type="button" aria-label="Close experiment menu" onClick={onClose}>
          ×
        </button>
      </div>

      <label className="experiment-search">
        <span aria-hidden="true">⌕</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search experiments"
          aria-label="Search experiments"
        />
        <kbd>/</kbd>
      </label>

      <div className="experiment-categories">
        {groupedExperiments.map((category) => (
          <details className="experiment-category" key={category.name} open={Boolean(query)}>
            <summary>
              <span className="category-icon" aria-hidden="true">{category.icon}</span>
              <span>{category.name}</span>
              <span className="category-count">{category.experiments.length}</span>
              <span className="category-chevron" aria-hidden="true">⌄</span>
            </summary>
            <div className="category-experiments">
              {category.experiments.map((experiment) => {
                const active = experiment.id === selected;
                const index = experiments.findIndex((item) => item.id === experiment.id) + 1;
                return (
                  <motion.button
                    whileTap={{ scale: 0.99 }}
                    key={experiment.id}
                    className={`experiment-btn ${active ? "active" : ""}`}
                    onClick={() => onSelect(experiment.id)}
                    aria-current={active ? "true" : undefined}
                  >
                    <span className="experiment-index">{String(index).padStart(2, "0")}</span>
                    <span className="experiment-option-copy">
                      <span>{experiment.title}</span>
                      <small>{experiment.topic}</small>
                    </span>
                    {active && <span className="active-indicator" aria-hidden="true" />}
                  </motion.button>
                );
              })}
            </div>
          </details>
        ))}
        {groupedExperiments.length === 0 && (
          <p className="no-experiments">No experiments match “{query}”.</p>
        )}
      </div>

      <div className="drawer-footer">
        <span>{experiments.length} simulations</span>
        {assessmentMode && <span className="challenge-indicator">Challenge mode</span>}
      </div>
    </motion.aside>
  );
}
