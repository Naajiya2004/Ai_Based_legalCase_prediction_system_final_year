import "./ToggleSwitch.css";
//import "../app.css"
export default function ToggleSwitch({ mode, setMode }) {
  return (
    <div className="toggle-container">
      <button
        className={mode === "ml" ? "active" : ""}
        onClick={() => setMode("ml")}
      >
        ML
      </button>

      <button
        className={mode === "genai" ? "active" : ""}
        onClick={() => setMode("genai")}
      >
        GenAI
      </button>

      <div className={`slider ${mode}`}></div>
    </div>
  );
}
