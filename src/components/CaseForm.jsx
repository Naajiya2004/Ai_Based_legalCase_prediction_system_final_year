import { useState } from "react";
import { predictCase } from "../api";

function CaseForm() {
  const [caseText, setCaseText] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const data = await predictCase(caseText);
      setResult(data);
    } catch (err) {
      setError("Failed to get prediction");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <h2>AI Legal Case Prediction System</h2>

      <form onSubmit={handleSubmit}>
        <textarea
          rows="8"
          placeholder="Enter legal case description..."
          value={caseText}
          onChange={(e) => setCaseText(e.target.value)}
          required
        />

        <button type="submit" disabled={loading}>
          {loading ? "Predicting..." : "Predict"}
        </button>
      </form>

      {error && <p className="error">{error}</p>}

      {result && (
        <div className="result">
          <h3>Prediction Result</h3>
          <p><strong>Outcome:</strong> {result.outcome.prediction}</p>
          <p><strong>Confidence:</strong> {result.outcome.confidence}</p>
          <p><strong>Judgment Type:</strong> {result.judgment_type}</p>
          <p><strong>Case Duration:</strong> {result.estimated_case_duration}</p>
        </div>
      )}
    </div>
  );
}

export default CaseForm;
