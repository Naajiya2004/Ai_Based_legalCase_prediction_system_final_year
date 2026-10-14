import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { Gavel, CheckCircle, Clock } from 'lucide-react';
import "../App.css";

export default function JudgeDashboard() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [pendingCases, setPendingCases] = useState([]);
    const [reviewedCases, setReviewedCases] = useState([]);
    const [activeTab, setActiveTab] = useState("pending");
    const [loading, setLoading] = useState(true);
    const [generatingRemarks, setGeneratingRemarks] = useState(false);

    // Verdict state for active case
    const [activeCase, setActiveCase] = useState(null);
    const [verdict, setVerdict] = useState("");
    const [remarks, setRemarks] = useState("");

    useEffect(() => {
        if (user?.role !== 'JUDGE' && user?.role !== 'ADMIN') {
            navigate('/login');
            return;
        }
        fetchCases();
    }, [user, navigate]);

    const fetchCases = async () => {
        setLoading(true);
        try {
            const [pendingRes, reviewedRes] = await Promise.all([
                fetch('http://localhost:8081/api/cases/pending', { headers: { 'X-User-Role': user.role } }),
                fetch('http://localhost:8081/api/cases/reviewed')
            ]);

            if (pendingRes.ok) setPendingCases(await pendingRes.json());
            if (reviewedRes.ok) setReviewedCases(await reviewedRes.json());
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const generateRemarks = async () => {
        if (!verdict) {
            alert("Please select a verdict (Win/Lose) first before generating remarks.");
            return;
        }

        setGeneratingRemarks(true);
        try {
            const res = await fetch('http://localhost:8000/predict/judge-remarks', {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    case_description: activeCase.caseText || "No text provided",
                    ai_prediction: activeCase.outcome,
                    ai_reasoning: activeCase.legalReasoning || "None",
                    judge_verdict: verdict
                })
            });

            if (res.ok) {
                const data = await res.json();
                setRemarks(data.remarks);
            } else {
                alert("Failed to generate AI remarks.");
            }
        } catch (e) {
            alert("Error connecting to AI backend.");
        } finally {
            setGeneratingRemarks(false);
        }
    };

    const submitVerdict = async () => {
        if (!verdict || !remarks.trim()) {
            alert("Verdict and remarks are required.");
            return;
        }

        try {
            const res = await fetch(`http://localhost:8081/api/cases/${activeCase.id}/verdict`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-User-Id": user.id,
                    "X-User-Role": user.role,
                },
                body: JSON.stringify({ verdict, remarks })
            });

            if (res.ok) {
                setActiveCase(null);
                setVerdict("");
                setRemarks("");
                fetchCases(); // refresh
            } else {
                alert("Failed to submit verdict");
            }
        } catch (e) {
            alert("Error saving verdict");
        }
    };

    return (
        <div className="app-wrapper">
            <div className="particles">
                {[...Array(5)].map((_, i) => <div key={i} className="particle" />)}
            </div>

            <nav className="navbar" style={{ background: 'rgba(10, 10, 15, 0.95)' }}>
                <div className="brand">
                    <Gavel size={28} color="#d4af37" />
                    <div>
                        <h1>JUDGE PANEL</h1>
                        <div className="brand-subtitle">VerdictVision AI Court system</div>
                    </div>
                </div>
                <div className="nav-tabs" style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.85rem', color: '#d4af37' }}>Hon. {user?.name}</span>
                    <button
                        onClick={() => { logout(); navigate('/login'); }}
                        className="predict-btn"
                        style={{ padding: '8px 16px', minWidth: 'auto', background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: 'white', fontSize: '0.8rem' }}
                    >
                        Logout
                    </button>
                </div>
            </nav>

            <main className="main-content" style={{ display: 'flex', gap: '30px', maxWidth: '1300px' }}>

                {/* LEFT: Case List */}
                <div style={{ flex: '1', display: 'flex', flexDirection: 'column' }}>
                    <div className="nav-tabs" style={{ marginBottom: '20px', display: 'flex' }}>
                        <button className={`nav-tab ${activeTab === 'pending' ? 'active' : ''}`} onClick={() => setActiveTab('pending')}>
                            <Clock size={14} style={{ marginRight: '6px' }} /> Pending ({pendingCases.length})
                        </button>
                        <button className={`nav-tab ${activeTab === 'reviewed' ? 'active' : ''}`} onClick={() => setActiveTab('reviewed')}>
                            <CheckCircle size={14} style={{ marginRight: '6px' }} /> Reviewed ({reviewedCases.length})
                        </button>
                    </div>

                    <div style={{ overflowY: 'auto', maxHeight: '75vh', paddingRight: '10px' }}>
                        {loading ? <p>Loading cases...</p> : null}

                        {activeTab === 'pending' && pendingCases.map(c => (
                            <div
                                key={c.id}
                                className="history-card"
                                style={{ cursor: 'pointer', border: activeCase?.id === c.id ? '1px solid #d4af37' : '' }}
                                onClick={() => { setActiveCase(c); setActiveTab('pending'); }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                                    <span style={{ fontWeight: 'bold' }}>Case #{c.id} - {c.userName}</span>
                                    <span className={`history-source-badge ${c.predictionSource === 'ML' ? 'ml' : 'genai'}`}>{c.predictionSource}</span>
                                </div>
                                <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }}>
                                    AI predicted: <span style={{ color: c.outcome === 'Win' ? '#4ade80' : '#f87171' }}>{c.outcome} ({c.confidence})</span>
                                </div>
                            </div>
                        ))}

                        {activeTab === 'reviewed' && reviewedCases.map(c => (
                            <div
                                key={c.id}
                                className="history-card"
                                style={{ cursor: 'pointer', border: activeCase?.id === c.id ? '1px solid #d4af37' : '' }}
                                onClick={() => { setActiveCase(c); setActiveTab('reviewed'); }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                                    <span style={{ fontWeight: 'bold' }}>Case #{c.id} - {c.userName}</span>
                                    <span style={{ fontSize: '0.75rem', color: '#d4af37' }}>Reviewed by {c.judgeName}</span>
                                </div>
                                <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }}>
                                    Final Verdict: <span style={{ color: c.judgeVerdict === 'Win' ? '#4ade80' : '#f87171' }}>{c.judgeVerdict}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* RIGHT: Active Case Details & Verdict Form */}
                <div style={{ flex: '2', background: 'rgba(255,255,255,0.03)', borderRadius: '16px', padding: '30px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    {activeCase ? (
                        <>
                            <h2 style={{ fontFamily: 'Playfair Display', color: '#d4af37', marginBottom: '20px' }}>Case Details #{activeCase.id}</h2>

                            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '20px', borderRadius: '12px', marginBottom: '20px' }}>
                                <h4 style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', marginBottom: '10px' }}>Case Description</h4>
                                <p style={{ fontSize: '0.95rem', lineHeight: '1.6', color: '#e8e6e3', maxHeight: '200px', overflowY: 'auto' }}>
                                    {activeCase.caseText || "No text provided (legacy case)"}
                                </p>
                            </div>

                            <div style={{ display: 'flex', gap: '20px', marginBottom: '30px' }}>
                                {/* Left Side: AI Output Summary */}
                                <div style={{ flex: '0 0 250px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                    <div style={{ padding: '20px', background: 'rgba(74, 222, 128, 0.05)', borderRadius: '12px', border: '1px solid rgba(74, 222, 128, 0.1)', textAlign: 'center' }}>
                                        <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', marginBottom: '10px', letterSpacing: '1px' }}>AI Prediction</div>
                                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '15px' }}>
                                            <div style={{ position: 'relative', width: '80px', height: '80px' }}>
                                                <svg viewBox="0 0 72 72" style={{ transform: 'rotate(-90deg)' }}>
                                                    <circle cx="36" cy="36" r="30" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="6" />
                                                    <circle cx="36" cy="36" r="30" fill="none" stroke={activeCase.outcome === 'Win' ? '#4ade80' : '#f87171'} strokeWidth="6"
                                                        strokeDasharray={2 * Math.PI * 30}
                                                        strokeDashoffset={(2 * Math.PI * 30) - ((parseFloat(activeCase.confidence) || 0) / 100) * (2 * Math.PI * 30)}
                                                        style={{ transition: 'stroke-dashoffset 1s ease-in-out' }}
                                                    />
                                                </svg>
                                                <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', fontWeight: 'bold', color: activeCase.outcome === 'Win' ? '#4ade80' : '#f87171' }}>
                                                    {Math.round(parseFloat(activeCase.confidence) || 0)}%
                                                </div>
                                            </div>
                                        </div>
                                        <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: activeCase.outcome === 'Win' ? '#4ade80' : '#f87171', marginBottom: '5px' }}>
                                            {activeCase.outcome === "Win" ? "✅ Win" : "❌ Lose"}
                                        </div>
                                    </div>

                                    <div style={{ padding: '15px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.85rem' }}>
                                            <span style={{ color: 'rgba(255,255,255,0.5)' }}>Engine:</span>
                                            <span style={{ color: '#fff' }}>{activeCase.predictionSource === "ML" ? "Machine Learning" : "Generative AI"}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.85rem' }}>
                                            <span style={{ color: 'rgba(255,255,255,0.5)' }}>Type:</span>
                                            <span style={{ color: '#fff' }}>{activeCase.judgmentType}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '0.85rem' }}>
                                            <span style={{ color: 'rgba(255,255,255,0.5)' }}>Duration:</span>
                                            <span style={{ color: '#fff' }}>{activeCase.caseDuration}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Right Side: AI Reasoning details */}
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                                    <h4 style={{ fontSize: '0.85rem', color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>
                                        AI Legal Reasoning
                                    </h4>
                                    <div style={{ flex: 1, background: 'rgba(59, 130, 246, 0.05)', padding: '20px', borderRadius: '12px', borderLeft: '4px solid #3b82f6', fontSize: '0.95rem', lineHeight: '1.7', color: 'rgba(255,255,255,0.8)', overflowY: 'auto', maxHeight: '310px' }}>
                                        {activeCase.legalReasoning || "No detailed reasoning was provided by the model for this prediction."}
                                    </div>
                                </div>
                            </div>

                            {/* ACTION AREA */}
                            {activeCase.status === 'PENDING' ? (
                                <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '20px' }}>
                                    <h3 style={{ marginBottom: '15px', color: '#fff' }}>Provide Final Verdict</h3>

                                    <div style={{ display: 'flex', gap: '15px', marginBottom: '20px' }}>
                                        <button
                                            onClick={() => setVerdict('Win')}
                                            style={{ flex: 1, padding: '15px', background: verdict === 'Win' ? 'rgba(74,222,128,0.2)' : 'rgba(255,255,255,0.05)', border: `1px solid ${verdict === 'Win' ? '#4ade80' : 'rgba(255,255,255,0.2)'}`, borderRadius: '8px', color: 'white', cursor: 'pointer', fontWeight: 'bold' }}
                                        >
                                            ✅ Rule in Favor (Win)
                                        </button>
                                        <button
                                            onClick={() => setVerdict('Lose')}
                                            style={{ flex: 1, padding: '15px', background: verdict === 'Lose' ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.05)', border: `1px solid ${verdict === 'Lose' ? '#ef4444' : 'rgba(255,255,255,0.2)'}`, borderRadius: '8px', color: 'white', cursor: 'pointer', fontWeight: 'bold' }}
                                        >
                                            ❌ Dismiss (Lose)
                                        </button>
                                    </div>

                                    <div style={{ position: 'relative' }}>
                                        <textarea
                                            placeholder={generatingRemarks ? "✨ AI is drafting remarks..." : "Enter official legal remarks and reasoning here..."}
                                            className="case-textarea"
                                            style={{ minHeight: '130px', marginBottom: '20px', paddingRight: '40px' }}
                                            value={remarks}
                                            onChange={(e) => setRemarks(e.target.value)}
                                            disabled={generatingRemarks}
                                        />
                                        <button
                                            onClick={generateRemarks}
                                            disabled={generatingRemarks || !verdict}
                                            title="Generate AI Remarks based on verdict"
                                            style={{
                                                position: 'absolute',
                                                bottom: '35px',
                                                right: '15px',
                                                background: generatingRemarks ? 'rgba(212,175,55,0.5)' : '#d4af37',
                                                border: 'none',
                                                borderRadius: '50%',
                                                width: '36px',
                                                height: '36px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                cursor: (generatingRemarks || !verdict) ? 'not-allowed' : 'pointer',
                                                boxShadow: '0 4px 12px rgba(212,175,55,0.3)',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            <span style={{ fontSize: '1.2rem', animation: generatingRemarks ? 'pulse 1s infinite' : 'none' }}>✨</span>
                                        </button>
                                    </div>

                                    <button className="predict-btn" onClick={submitVerdict} disabled={generatingRemarks}>
                                        <span className="btn-content">⚖️ Seal Verdict & Publish</span>
                                    </button>
                                </div>
                            ) : (
                                <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '20px' }}>
                                    <h3 style={{ marginBottom: '15px', color: '#d4af37' }}>Official Judgment (Sealed)</h3>
                                    <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: activeCase.judgeVerdict === 'Win' ? '#4ade80' : '#f87171', marginBottom: '10px' }}>
                                        Final Verdict: {activeCase.judgeVerdict}
                                    </div>
                                    <div style={{ fontSize: '0.95rem', fontStyle: 'italic', color: 'rgba(255,255,255,0.8)', padding: '15px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                                        "{activeCase.judgeRemarks}"
                                    </div>
                                    <div style={{ marginTop: '15px', fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)' }}>
                                        Presiding Judge: {activeCase.judgeName}
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)' }}>
                            Select a case from the list to review details and provide verdict.
                        </div>
                    )}
                </div>

            </main>
        </div>
    );
}
