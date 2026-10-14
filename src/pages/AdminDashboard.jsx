import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { ShieldAlert, Trash2, UserPlus, Users } from 'lucide-react';
import "../App.css";

export default function AdminDashboard() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [users, setUsers] = useState([]);

    // New Judge State
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (user?.role !== 'ADMIN') {
            navigate('/login');
            return;
        }
        fetchUsers();
    }, [user, navigate]);

    const fetchUsers = async () => {
        try {
            const res = await fetch('http://localhost:8081/api/admin/users', {
                headers: { 'X-User-Role': 'ADMIN' }
            });
            if (res.ok) setUsers(await res.json());
        } catch (e) {
            console.error(e);
        }
    };

    const createJudge = async (e) => {
        e.preventDefault();
        if (!name || !email || !password) return setError("All fields required");

        setLoading(true);
        setError("");
        setSuccess("");

        try {
            const res = await fetch('http://localhost:8081/api/admin/create-judge', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-Role': 'ADMIN'
                },
                body: JSON.stringify({ name, email, password })
            });

            if (!res.ok) throw new Error((await res.json()).error);

            setSuccess("Judge account created successfully!");
            setName(""); setEmail(""); setPassword("");
            fetchUsers();
        } catch (e) {
            setError(e.message || "Failed to create judge");
        } finally {
            setLoading(false);
        }
    };

    const deleteUser = async (id) => {
        if (!window.confirm("Delete this user?")) return;
        try {
            const res = await fetch(`http://localhost:8081/api/admin/users/${id}`, {
                method: 'DELETE',
                headers: { 'X-User-Role': 'ADMIN' }
            });
            if (res.ok) fetchUsers();
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <div className="app-wrapper">
            <nav className="navbar" style={{ background: 'rgba(10, 10, 15, 0.95)' }}>
                <div className="brand">
                    <ShieldAlert size={28} color="#ef4444" />
                    <div>
                        <h1 style={{ background: 'linear-gradient(135deg, #ef4444, #fca5a5)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>SYSTEM ADMIN</h1>
                        <div className="brand-subtitle">VerdictVision AI Court system</div>
                    </div>
                </div>
                <div className="nav-tabs" style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.85rem', color: '#ef4444' }}>{user?.email}</span>
                    <button onClick={() => { logout(); navigate('/login'); }} className="predict-btn" style={{ padding: '8px 16px', minWidth: 'auto', background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: 'white' }}>Logout</button>
                </div>
            </nav>

            <main className="main-content" style={{ display: 'flex', gap: '30px', maxWidth: '1200px' }}>

                {/* LEFT: Create Judge */}
                <div style={{ flex: '1' }}>
                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '30px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                            <UserPlus size={20} color="#d4af37" /> Create Judge Account
                        </h3>

                        {error && <div className="error-toast" style={{ marginBottom: '15px' }}>{error}</div>}
                        {success && <div style={{ background: 'rgba(74, 222, 128, 0.1)', color: '#4ade80', padding: '10px', borderRadius: '8px', marginBottom: '15px' }}>{success}</div>}

                        <form onSubmit={createJudge}>
                            <div className="input-section">
                                <div className="input-label">Judge Name</div>
                                <input type="text" className="case-textarea" style={{ minHeight: 'auto', padding: '12px' }} value={name} onChange={e => setName(e.target.value)} />
                            </div>
                            <div className="input-section">
                                <div className="input-label">Email</div>
                                <input type="email" className="case-textarea" style={{ minHeight: 'auto', padding: '12px' }} value={email} onChange={e => setEmail(e.target.value)} />
                            </div>
                            <div className="input-section">
                                <div className="input-label">Password</div>
                                <input type="password" className="case-textarea" style={{ minHeight: 'auto', padding: '12px' }} value={password} onChange={e => setPassword(e.target.value)} />
                            </div>

                            <button type="submit" className="predict-btn" disabled={loading} style={{ marginTop: '10px' }}>
                                <span className="btn-content">{loading ? 'Creating...' : 'Register Judge'}</span>
                            </button>
                        </form>
                    </div>
                </div>

                {/* RIGHT: User List */}
                <div style={{ flex: '2', background: 'rgba(255,255,255,0.02)', padding: '30px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', maxHeight: '75vh', overflowY: 'auto' }}>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                        <Users size={20} color="#60a5fa" /> System Users ({users.length})
                    </h3>

                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                <th style={{ padding: '10px', color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem', textTransform: 'uppercase' }}>ID</th>
                                <th style={{ padding: '10px', color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Name</th>
                                <th style={{ padding: '10px', color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Email</th>
                                <th style={{ padding: '10px', color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Role</th>
                                <th style={{ padding: '10px', color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map(u => (
                                <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                    <td style={{ padding: '15px 10px' }}>{u.id}</td>
                                    <td style={{ padding: '15px 10px', fontWeight: 'bold' }}>{u.name}</td>
                                    <td style={{ padding: '15px 10px', color: 'rgba(255,255,255,0.7)' }}>{u.email}</td>
                                    <td style={{ padding: '15px 10px' }}>
                                        <span style={{
                                            padding: '4px 10px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 'bold',
                                            background: u.role === 'ADMIN' ? 'rgba(239, 68, 68, 0.1)' : u.role === 'JUDGE' ? 'rgba(212, 175, 55, 0.1)' : 'rgba(96, 165, 250, 0.1)',
                                            color: u.role === 'ADMIN' ? '#f87171' : u.role === 'JUDGE' ? '#d4af37' : '#60a5fa'
                                        }}>
                                            {u.role}
                                        </span>
                                    </td>
                                    <td style={{ padding: '15px 10px' }}>
                                        {u.role !== 'ADMIN' && (
                                            <button onClick={() => deleteUser(u.id)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#f87171' }}>
                                                <Trash2 size={18} />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

            </main>
        </div>
    );
}
