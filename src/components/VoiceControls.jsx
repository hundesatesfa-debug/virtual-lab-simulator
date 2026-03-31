export default function VoiceControls({ text }) {
  const speak = () => {
    if (!window.speechSynthesis) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="voice-row">
      <button className="btn btn-neon" onClick={speak}>
        Voice Instructions
      </button>
    </div>
  );
}
