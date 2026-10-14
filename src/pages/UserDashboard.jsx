import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import "../App.css";

// =============================================
// Confidence Ring Component
// =============================================
function ConfidenceRing({ value, isWin }) {
    const numVal = parseFloat(value) || 0;
    const radius = 30;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (numVal / 100) * circumference;

    return (
        <div className="confidence-ring">
            <svg viewBox="0 0 72 72">
                <circle className="ring-bg" cx="36" cy="36" r={radius} />
                <circle
                    className="ring-fill"
                    cx="36"
                    cy="36"
                    r={radius}
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                />
            </svg>
            <div className="confidence-number">{Math.round(numVal)}%</div>
        </div>
    );
}

// =============================================
// Main Dashboard
// =============================================
export default function UserDashboard() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const [mode, setMode] = useState("ml");
    const [text, setText] = useState("");
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [activeTab, setActiveTab] = useState("predict");
    const [dbHistory, setDbHistory] = useState([]);

    useEffect(() => {
        setResult(null);
        setError("");
    }, [mode]);

    useEffect(() => {
        if (user) {
            fetchMyHistory();
        }
    }, [user]);

    const fetchMyHistory = async () => {
        try {
            const res = await fetch(`http://localhost:8081/api/cases/my/${user.id}`);
            if (res.ok) {
                const data = await res.json();
                setDbHistory(data);
            }
        } catch {
            // silent
        }
    };

    const normalizeForBackend = (data) => ({
        userId: user.id,
        userName: user.name,
        caseText: text,
        outcome: data.outcome.prediction,
        confidence: String(data.outcome.confidence),
        judgmentType: data.judgment_type,
        caseDuration: data.estimated_case_duration,
        legalReasoning: data.legal_reasoning || "",
        predictionSource: data.mode === "ML" ? "ML" : "GEN_AI",
        status: "PENDING"
    });

    const savePrediction = async (payload) => {
        try {
            await fetch("http://localhost:8081/api/cases", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
        } catch {
            // silent
        }
    };

    const handleSubmit = async () => {
        if (!text.trim()) {
            setError("Please enter a case description to analyze.");
            return;
        }

        setLoading(true);
        setError("");
        setResult(null);

        const endpoint =
            mode === "ml"
                ? "http://127.0.0.1:8000/predict/ml"
                : "http://127.0.0.1:8000/predict/genai";

        try {
            const res = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ case_description: text }),
            });

            if (!res.ok) throw new Error();

            const data = await res.json();
            setResult(data);

            const normalized = normalizeForBackend(data);
            await savePrediction(normalized);

            fetchMyHistory();
            setActiveTab("history"); // automatically jump to history to see it pending
        } catch {
            setError("Prediction failed. Make sure the backend server (AI) is running.");
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const getConfidenceNum = (conf) => parseFloat(String(conf).replace("%", "")) || 0;

    return (
        <div className="app-wrapper">
            <div className="particles">
                {[...Array(8)].map((_, i) => <div key={i} className="particle" />)}
            </div>

            {/* ===== NAVBAR ===== */}
            <nav className="navbar">
                <div className="brand">
                    <span className="brand-icon">⚖️</span>
                    <div>
                        <h1>VerdictVision AI</h1>
                        <div className="brand-subtitle">AI Legal Case Prediction</div>
                    </div>
                </div>

                <div className="nav-tabs" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <button
                        className={`nav-tab ${activeTab === "predict" ? "active" : ""}`}
                        onClick={() => setActiveTab("predict")}
                    >
                        ⚡ Predict
                    </button>
                    <button
                        className={`nav-tab ${activeTab === "history" ? "active" : ""}`}
                        onClick={() => setActiveTab("history")}
                    >
                        📜 My Cases
                    </button>
                    <div style={{ paddingLeft: '20px', borderLeft: '1px solid rgba(255,255,255,0.2)' }}>
                        <span style={{ fontSize: '0.85rem', color: '#d4af37', marginRight: '15px' }}>
                            👤 {user?.name}
                        </span>
                        <button
                            onClick={handleLogout}
                            style={{ background: 'transparent', border: 'none', color: '#fca5a5', cursor: 'pointer', fontSize: '0.85rem' }}
                        >
                            Sign out
                        </button>
                    </div>
                </div>
            </nav>

            {/* ===== MAIN CONTENT ===== */}
            <main className="main-content">
                {/* ===== PREDICT TAB ===== */}
                {activeTab === "predict" && (
                    <>
                        <div className="mode-section">
                            <span className={`mode-label ${mode === "ml" ? "ml-active" : "inactive"}`}>ML Engine</span>
                            <div className={`toggle-track ${mode}`} onClick={() => setMode(mode === "ml" ? "genai" : "ml")}>
                                <div className={`toggle-thumb ${mode}`} />
                            </div>
                            <span className={`mode-label ${mode === "genai" ? "genai-active" : "inactive"}`}>Gen AI</span>
                        </div>

                        <div className="input-section">
                            <div className="input-label">Case Description</div>
                            <textarea
                                className="case-textarea"
                                placeholder="Paste or type your legal case description here..."
                                value={text}
                                onChange={(e) => setText(e.target.value)}
                                disabled={loading}
                            />
                        </div>

                        <button className="predict-btn" onClick={handleSubmit} disabled={loading}>
                            <span className="btn-content">{loading ? "⏳ Analyzing..." : "⚖️ Analyze Case"}</span>
                        </button>

                        {loading && (
                            <div className="loading-overlay">
                                <div className="scale-loader">
                                    <div className="scale-bar" /><div className="scale-bar" /><div className="scale-bar" />
                                    <div className="scale-bar" /><div className="scale-bar" />
                                </div>
                                <span className="loading-text">Analyzing...</span>
                            </div>
                        )}

                        {error && <div className="error-toast">⚠️ {error}</div>}

                        {/* RESULTS PREVIEW (Just for immediate feedback, official history is in tab) */}
                        {!loading && result && (
                            <div className="result-section" style={{ border: '1px dashed rgba(212,175,55,0.3)', padding: '20px', borderRadius: '16px' }}>
                                <h4 style={{ color: '#d4af37', marginBottom: '15px' }}>Case Submitted for Judge Review</h4>
                                <p style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.6)' }}>
                                    AI Predicted: {result.outcome.prediction} ({result.outcome.confidence}).
                                    Check the "My Cases" tab for the official Judge ruling.
                                </p>
                            </div>
                        )}
                    </>
                )}

                {/* ===== HISTORY TAB ===== */}
                {activeTab === "history" && (
                    <div className="history-section">
                        <div className="history-group">
                            <div className="history-group-title">📦 My Submitted Cases</div>
                            {dbHistory.length === 0 && (
                                <div className="empty-history">
                                    <p>No predictions yet. Start analyzing cases!</p>
                                </div>
                            )}
                            {dbHistory.map((item) => (
                                <div key={item.id} className="history-card" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>

                                    {/* AI PREDICTION SECTION */}
                                    <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
                                        {/* Left Column: AI Prediction Summary */}
                                        <div style={{ minWidth: '150px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                            <div className={`history-outcome ${item.outcome?.toLowerCase()}`} style={{ fontSize: '1.1rem', padding: '8px 12px', textAlign: 'center' }}>
                                                {item.outcome === "Win" ? "✅" : "❌"} {item.outcome}
                                            </div>
                                            <div style={{ textAlign: 'center' }}>
                                                <ConfidenceRing value={item.confidence} isWin={item.outcome === 'Win'} />
                                                <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginTop: '5px' }}>
                                                    {item.predictionSource === "ML" ? "Machine Learning" : "Generative AI"}
                                                </div>
                                            </div>
                                            <div className="history-details" style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', marginTop: '5px' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                                    <span>Type:</span> <span style={{ color: '#fff' }}>{item.judgmentType}</span>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                                    <span>Duration:</span> <span style={{ color: '#fff' }}>{item.caseDuration}</span>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                                                    <span>Submitted:</span> <span style={{ color: '#fff' }}>{new Date(item.submittedAt).toLocaleDateString()}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Right Column: Case Details & Reasoning */}
                                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: '20px' }}>
                                            <div>
                                                <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px', color: '#d4af37', marginBottom: '5px' }}>
                                                    Case Description
                                                </h4>
                                                <div style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.8)', lineHeight: '1.5', background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '6px', maxHeight: '100px', overflowY: 'auto' }}>
                                                    {item.caseText}
                                                </div>
                                            </div>

                                            <div>
                                                <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px', color: '#60a5fa', marginBottom: '5px' }}>
                                                    AI Legal Reasoning
                                                </h4>
                                                <div style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.8)', lineHeight: '1.5', background: 'rgba(59, 130, 246, 0.05)', padding: '12px', borderRadius: '6px', borderLeft: '3px solid #3b82f6' }}>
                                                    {item.legalReasoning || "No detailed reasoning provided by the model."}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <hr style={{ borderColor: 'rgba(255,255,255,0.05)', margin: '15px 0' }} />

                                    {/* JUDGE VERDICT SECTION */}
                                    <div style={{
                                        background: item.status === 'REVIEWED' ? 'rgba(212,175,55,0.05)' : 'rgba(255,255,255,0.02)',
                                        padding: '15px',
                                        borderRadius: '8px',
                                        borderLeft: `4px solid ${item.status === 'REVIEWED' ? '#d4af37' : '#64748b'}`
                                    }}>
                                        <h4 style={{
                                            fontSize: '0.85rem',
                                            textTransform: 'uppercase',
                                            letterSpacing: '1px',
                                            color: item.status === 'REVIEWED' ? '#d4af37' : '#94a3b8',
                                            marginBottom: '10px'
                                        }}>
                                            {item.status === 'REVIEWED' ? `Official Verdict by ${item.judgeName}` : 'Status: Pending Judge Review'}
                                        </h4>

                                        {item.status === 'REVIEWED' ? (
                                            <div>
                                                <div style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '8px', color: item.judgeVerdict === 'Win' ? '#4ade80' : '#f87171' }}>
                                                    FINAL: {item.judgeVerdict}
                                                </div>
                                                <div style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.8)', fontStyle: 'italic' }}>
                                                    "{item.judgeRemarks}"
                                                </div>
                                            </div>
                                        ) : (
                                            <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.4)' }}>
                                                A human judge will review this AI prediction and provide an official ruling.
                                            </div>
                                        )}
                                    </div>

                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </main>

            <footer className="app-footer">
                <p><span className="gold">VerdictVision AI</span> — AI Legal Case Prediction System</p>
            </footer>
        </div>
    );
}
