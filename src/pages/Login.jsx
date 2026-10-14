import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Scale, Mail, Lock } from 'lucide-react';
import '../App.css'; // Reuse premium styles

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        if (!email || !password) {
            setError('Please enter both email and password');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const res = await fetch('http://localhost:8081/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || 'Login failed');
            }

            const userData = await res.json();
            login(userData);

            // Redirect based on role
            if (userData.role === 'ADMIN') navigate('/admin');
            else if (userData.role === 'JUDGE') navigate('/judge');
            else navigate('/dashboard');

        } catch (err) {
            setError(err.message || 'Server error. Please try again later.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="app-wrapper" style={{ justifyContent: 'center' }}>
            <div className="particles">
                {[...Array(8)].map((_, i) => <div key={i} className="particle" />)}
            </div>

            <div className="glass" style={{ maxWidth: '450px', padding: '40px 30px' }}>
                <div style={{ textAlign: 'center', marginBottom: '30px' }}>
                    <Scale size={48} color="#d4af37" style={{ marginBottom: '10px' }} />
                    <h1 style={{ marginBottom: '5px' }}>VerdictVision AI</h1>
                    <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem', letterSpacing: '2px', textTransform: 'uppercase' }}>
                        Portal Access
                    </p>
                </div>

                {error && <div className="error-toast" style={{ width: '100%', marginBottom: '20px' }}>⚠️ {error}</div>}

                <form onSubmit={handleLogin} style={{ width: '100%' }}>
                    <div className="input-section">
                        <div className="input-label"><Mail size={16} /> Email Address</div>
                        <input
                            type="email"
                            className="case-textarea"
                            style={{ minHeight: 'auto', padding: '15px' }}
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="Enter your email"
                            disabled={loading}
                        />
                    </div>

                    <div className="input-section">
                        <div className="input-label"><Lock size={16} /> Password</div>
                        <input
                            type="password"
                            className="case-textarea"
                            style={{ minHeight: 'auto', padding: '15px' }}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter your password"
                            disabled={loading}
                        />
                    </div>

                    <button type="submit" className="predict-btn" disabled={loading} style={{ marginTop: '10px' }}>
                        <span className="btn-content">
                            {loading ? 'Authenticating...' : 'Sign In'}
                        </span>
                    </button>
                </form>

                <div style={{ marginTop: '25px', fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)' }}>
                    Common citizen? <Link to="/register" style={{ color: '#d4af37', textDecoration: 'none', fontWeight: '600' }}>Create an account</Link>
                </div>
            </div>
        </div>
    );
}
