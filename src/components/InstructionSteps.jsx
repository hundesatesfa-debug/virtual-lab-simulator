export default function InstructionSteps({ steps, currentStep }) {
  return (
    <ol className="steps">
      {steps.map((step, idx) => (
        <li key={step} className={idx === currentStep ? "active" : ""}>
          {step}
        </li>
      ))}
    </ol>
  );
}
