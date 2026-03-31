import { motion } from "framer-motion";
import { experiments } from "../data/experiments";

export default function Dashboard({ selected, onSelect, assessmentMode }) {
  return (
    <nav className="dashboard glass">
      <h2>Experiments</h2>
      {experiments.map((exp) => {
        const active = exp.id === selected;
        return (
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
            key={exp.id}
            className={`experiment-btn ${active ? "active" : ""}`}
            onClick={() => onSelect(exp.id)}
          >
            <span>{exp.title}</span>
            <small>{exp.topic}</small>
          </motion.button>
        );
      })}
      {assessmentMode && <p className="warning">Challenge mode: hints are reduced.</p>}
    </nav>
  );
}
