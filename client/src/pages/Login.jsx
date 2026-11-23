import { API_ORIGIN } from '../utils/apiConfig.js';
import { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, AlertCircle, ShieldCheck, UserRound } from 'lucide-react';

// Official Apple Scholar logo — also the way back to the landing page
import appleLogo from '../assets/logo/applelogo.png';

// ── Token system — Portal Login (centered, burgundy + gold + cream) ──
const PRIMARY = '#6D2140';
const PRIMARY_DEEP = '#4A1730';
const ACCENT = '#B98B4E';
const ACCENT_DARK = '#8F6A35';
const CARD = '#FFFDF9';
const BORDER = '#E7D8C7';
const SAND = '#FBF1E6';
const INK = '#241512';
const INK_SOFT = '#5C4E42';
const MUTED = '#8A7A68';
const ERROR_BG = '#FBEAEA';
const ERROR_TEXT = '#8E2631';

const display = { fontFamily: "'Playfair Display', Georgia, serif" };
const sans = { fontFamily: "'Inter', 'Segoe UI', sans-serif" };

const Login = () => {
    const [loginId, setLoginId] = useState(() => {
        try {
            const rememberedLogin = localStorage.getItem('remembered_login') || '';
            return rememberedLogin.includes('@') ? '' : rememberedLogin;
        } catch { return ''; }
    });
    const [email, setEmail] = useState(() => {
        try {
            return localStorage.getItem('remembered_email')
                || (localStorage.getItem('remembered_login')?.includes('@') ? localStorage.getItem('remembered_login') : '')
                || '';
        } catch { return ''; }
    });
    const [rememberMe, setRememberMe] = useState(() => {
        try { return !!(localStorage.getItem('remembered_login') || localStorage.getItem('remembered_email')); } catch { return false; }
    });
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        try {
            const res = await axios.post(`${API_ORIGIN}/api/login`, { loginId, email, password });
            if (res.data.status === "Success") {
                const userRole = res.data.role.toLowerCase().trim();
                localStorage.setItem('token', res.data.token);
                localStorage.setItem('role', userRole);
                localStorage.setItem('name', res.data.name);
                localStorage.setItem('email', res.data.email || email);
                localStorage.setItem('id', res.data.id);
                localStorage.setItem('scholar_id', res.data.scholar_id);
                if (res.data.must_change_password) {
                    localStorage.setItem('must_change_password', 'true');
                } else {
                    localStorage.removeItem('must_change_password');
                }

                const rolesMapping = {
                    admin: '/admin',
                    staff: '/staff',
                    scholar: '/scholar',
                    officer: '/officer',
                };
                navigate(res.data.must_change_password ? '/account/setup' : (rolesMapping[userRole] || '/scholar'));
            } else {
                setError('Invalid credentials. Please try again.');
            }
        } catch (err) {
            if (err.response?.status === 401) {
                setError('User ID, email, or password is incorrect.');
            } else if (err.response?.status === 404) {
                setError('Account not found.');
            } else {
                setError('Cannot connect to server. Please try again later.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    // Runs before the login handler: stores or clears the remembered account identifiers.
    const handleSubmit = (e) => {
        try {
            if (rememberMe) {
                localStorage.setItem('remembered_login', loginId);
                localStorage.setItem('remembered_email', email);
            } else {
                localStorage.removeItem('remembered_login');
                localStorage.removeItem('remembered_email');
            }
        } catch { /* storage unavailable — ignore */ }
        handleLogin(e);
    };

    return (
        <div className="login-root" style={{ ...sans, color: INK }}>
            <GlobalStyle />

            {/* ── Background: cream → blush → maroon blend with gold line ── */}
            <div className="login-bg" aria-hidden="true">
                <svg viewBox="0 0 1440 900" preserveAspectRatio="none" className="bg-svg">
                    <path d="M1440,0 C1260,90 1180,210 1210,360 C1240,520 1330,600 1440,640 Z" fill={PRIMARY_DEEP} opacity="0.35" />
                    <path d="M0,120 C260,60 520,200 760,150 C1000,100 1200,40 1440,110" fill="none" stroke={ACCENT} strokeWidth="1.5" opacity="0.6" vectorEffect="non-scaling-stroke" />
                </svg>
            </div>

            <div className="login-inner">
                {/* ── Centered login card ── */}
                <main className="login-main">
                    <div className="auth-card">
                        {/* Logo inside the card — click to go back to the landing page */}
                        <div className="card-logo-wrap">
                            <button
                                type="button"
                                onClick={() => navigate('/')}
                                aria-label="Back to Apple Scholar home"
                                className="logo-link"
                            >
                                <img src={appleLogo} alt="Apple Scholar" className="logo-img" />
                            </button>
                        </div>

                        <p className="auth-eyebrow">Kalinga Foundation</p>
                        <h1 className="auth-title" style={display}>Access Portal</h1>
                        <p className="auth-sub">Log in to continue to your account.</p>

                        {error && (
                            <div className="error-alert" role="alert">
                                <AlertCircle size={16} color={ERROR_TEXT} style={{ flexShrink: 0, marginTop: 2 }} />
                                <span>{error}</span>
                            </div>
                        )}

                        <form onSubmit={handleSubmit}>
                            <div className="field-group">
                                <label className="field-label" htmlFor="login-id">User ID</label>
                                <div className="input-wrap">
                                    <UserRound size={18} color={PRIMARY} className="input-icon" />
                                    <input
                                        id="login-id"
                                        type="text" required placeholder="Enter your User ID"
                                        value={loginId} onChange={(e) => setLoginId(e.target.value)}
                                        autoComplete="username"
                                        className="portal-input"
                                        style={sans}
                                    />
                                </div>
                            </div>

                            <div className="field-group" style={{ marginTop: 'var(--gap)' }}>
                                <label className="field-label" htmlFor="login-email">Email address</label>
                                <div className="input-wrap">
                                    <Mail size={18} color={PRIMARY} className="input-icon" />
                                    <input
                                        id="login-email"
                                        type="email" required placeholder="yourname@kalinga.org"
                                        value={email} onChange={(e) => setEmail(e.target.value)}
                                        autoComplete="email"
                                        className="portal-input"
                                        style={sans}
                                    />
                                </div>
                            </div>

                            <div className="field-group" style={{ marginTop: 'var(--gap)' }}>
                                <label className="field-label" htmlFor="login-password">Password</label>
                                <div className="input-wrap">
                                    <Lock size={18} color={PRIMARY} className="input-icon" />
                                    <input
                                        id="login-password"
                                        type={showPassword ? 'text' : 'password'} required placeholder="Enter your password"
                                        value={password} onChange={(e) => setPassword(e.target.value)}
                                        autoComplete="current-password"
                                        className="portal-input"
                                        style={{ ...sans, paddingRight: 46 }}
                                    />
                                    <button
                                        type="button" onClick={() => setShowPassword((s) => !s)}
                                        className="visibility-toggle"
                                        tabIndex={-1}
                                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                                    >
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            <div className="forgot-row">
                                <label className="remember-label">
                                    <input
                                        type="checkbox"
                                        checked={rememberMe}
                                        onChange={(e) => setRememberMe(e.target.checked)}
                                        className="remember-box"
                                    />
                                    <span>Remember me</span>
                                </label>
                                <button type="button" onClick={() => navigate('/forgot-password')} className="forgot-link" style={sans}>
                                    Forgot password?
                                </button>
                            </div>

                            <button type="submit" disabled={isLoading} className="submit-btn" style={sans}>
                                {isLoading ? (
                                    <>
                                        <span className="spinner" />
                                        Logging in…
                                    </>
                                ) : (
                                    'Log in'
                                )}
                            </button>
                        </form>

                        <div className="secure-note">
                            <span className="secure-chip">
                                <ShieldCheck size={20} color={PRIMARY} strokeWidth={1.8} />
                            </span>
                            <div className="secure-text">
                                <p className="secure-note-title">Secure Access</p>
                                <p className="secure-note-meta">Authorized scholars, staff, officers &amp; administrators</p>
                            </div>
                        </div>
                    </div>

                    <p className="year-note">Academic Year 2026–2027 · Scholarship Compliance Tracking System</p>
                </main>
            </div>
        </div>
    );
};

const GlobalStyle = () => (
    <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap');

        @keyframes spin { to { transform: rotate(360deg); } }
        html, body, #root {
            width: 100%; height: 100%; min-height: 100%; margin: 0; overflow: hidden;
            background: linear-gradient(170deg, #FFFDF9 0%, #F6E9E1 28%, #B25A78 62%, ${PRIMARY} 85%, ${PRIMARY_DEEP} 100%);
        }
        .login-root {
            --logo-w: clamp(78px, 15vh, 124px);
            --pad-y: clamp(14px, 3vh, 28px);
            --pad-x: clamp(22px, 2.4vw, 36px);
            --gap: clamp(8px, 1.6vh, 14px);
            --input-h: clamp(38px, 5.8vh, 48px);
            --title-fs: clamp(22px, 4.4vh, 32px);
            position: fixed; inset: 0; width: 100%; height: 100vh; height: 100svh;
            min-height: 0; box-sizing: border-box; overflow: hidden;
            background: linear-gradient(115deg, #FFFDF9 0%, #F6E9E1 30%, #B25A78 66%, #6D2140 84%, ${PRIMARY_DEEP} 100%);
        }
        .login-bg { position: absolute; inset: 0; overflow: hidden; pointer-events: none; z-index: 0; }
        .bg-svg { position: absolute; inset: 0; width: 100%; height: 100%; }

        .login-inner {
            position: relative; z-index: 1;
            width: 100%; height: 100%; min-height: 0;
            display: flex; flex-direction: column; align-items: center;
            padding: clamp(10px, 2.4vh, 28px) 16px; box-sizing: border-box;
        }

        .card-logo-wrap { display: flex; justify-content: center; margin-bottom: calc(var(--gap) * 0.6); }
        .logo-link {
            background: none; border: none; padding: 0; margin: 0; cursor: pointer;
            display: block; line-height: 0; border-radius: 10px; transition: transform 0.2s ease;
        }
        .logo-link:hover { transform: none; }
        .logo-link:focus-visible { outline: 2px solid ${ACCENT}; outline-offset: 5px; }
        .logo-img { width: var(--logo-w); height: auto; display: block; object-fit: contain; }

        .login-main {
            flex: 1; width: 100%;
            display: flex; flex-direction: column; align-items: center; justify-content: center;
        }

        .auth-card {
            width: 100%; max-width: 440px; box-sizing: border-box;
            background: ${CARD}; border: 1px solid ${BORDER}; border-top: 3px solid ${ACCENT};
            border-radius: 22px; padding: var(--pad-y) var(--pad-x);
            box-shadow: 0 34px 70px -26px rgba(30,8,18,0.6);
            animation: none;
        }
        .auth-eyebrow {
            font-size: 11px; font-weight: 600; letter-spacing: 0.24em; text-transform: uppercase;
            color: ${ACCENT_DARK}; text-align: center; margin: 0 0 calc(var(--gap) * 0.4);
        }
        .auth-title {
            font-size: var(--title-fs); font-weight: 600; color: ${PRIMARY_DEEP};
            text-align: center; margin: 0 0 calc(var(--gap) * 0.4); line-height: 1.15;
        }
        .auth-sub { font-size: 13px; line-height: 1.5; color: ${INK_SOFT}; text-align: center; margin: 0 0 var(--gap); }

        .error-alert {
            display: flex; align-items: flex-start; gap: 9px; border-radius: 10px;
            background: ${ERROR_BG}; color: ${ERROR_TEXT}; border-left: 3px solid ${PRIMARY};
            padding: 9px 12px; font-size: 0.8rem; line-height: 1.4; font-weight: 500; margin-bottom: var(--gap);
        }

        .field-group { display: flex; flex-direction: column; }
        .field-label { font-size: 0.78rem; font-weight: 600; color: ${INK}; margin-bottom: 5px; }
        .input-wrap { position: relative; display: flex; align-items: center; }
        .input-icon { position: absolute; left: 15px; pointer-events: none; }
        .portal-input {
            width: 100%; height: var(--input-h); border-radius: 12px; border: 1px solid ${BORDER};
            background: ${CARD}; padding: 0 16px 0 42px; font-size: 0.92rem; color: ${INK};
            outline: none; transition: border-color 0.2s ease, box-shadow 0.2s ease; box-sizing: border-box;
        }
        .portal-input::placeholder { color: #B7A99E; }
        .portal-input:focus { border-color: ${PRIMARY}; box-shadow: 0 0 0 4px rgba(109,33,64,0.12); }
        .portal-input:-webkit-autofill,
        .portal-input:-webkit-autofill:hover,
        .portal-input:-webkit-autofill:focus {
            -webkit-text-fill-color: ${INK};
            -webkit-box-shadow: 0 0 0px 1000px ${CARD} inset;
            transition: background-color 9999s ease-in-out 0s;
        }
        .visibility-toggle {
            position: absolute; right: 14px; color: ${MUTED}; display: flex;
            background: none; border: none; cursor: pointer; transition: color 0.15s ease;
        }
        .visibility-toggle:hover { color: ${INK}; }

        .forgot-row { display: flex; align-items: center; justify-content: space-between; gap: 6px 12px; margin: var(--gap) 0 var(--gap); flex-wrap: wrap; }
        .remember-label { display: inline-flex; align-items: center; gap: 8px; font-size: 0.82rem; color: ${INK_SOFT}; cursor: pointer; }
        .remember-box { width: 16px; height: 16px; accent-color: ${PRIMARY}; cursor: pointer; }
        .forgot-link { font-size: 0.82rem; font-weight: 600; color: ${PRIMARY}; background: none; border: none; cursor: pointer; padding: 0; }
        .forgot-link:hover { text-decoration: underline; color: ${PRIMARY_DEEP}; }

        .submit-btn {
            width: 100%; height: var(--input-h); border-radius: 12px; border: none;
            background: linear-gradient(90deg, ${PRIMARY}, ${PRIMARY_DEEP}); color: #FFFFFF;
            font-size: 0.94rem; font-weight: 600;
            display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer;
            box-shadow: 0 12px 24px -14px rgba(109,33,64,0.6);
            transition: transform 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease;
        }
        .submit-btn:hover:not(:disabled) { transform: none; box-shadow: 0 16px 28px -14px rgba(74,23,48,0.65); }
        .submit-btn:disabled { opacity: 0.65; cursor: default; }
        .submit-btn:focus-visible, .forgot-link:focus-visible, .visibility-toggle:focus-visible { outline: 2px solid ${ACCENT}; outline-offset: 3px; }

        .spinner {
            width: 16px; height: 16px; border-radius: 50%;
            border: 2px solid rgba(255,255,255,0.35); border-top-color: #fff;
            display: inline-block; animation: spin 0.7s linear infinite;
        }

        .secure-note {
            display: flex; align-items: center; justify-content: center; gap: 12px;
            margin-top: var(--gap); padding: clamp(7px, 1.4vh, 11px) 14px; border-radius: 14px; background: ${SAND};
        }
        .secure-chip {
            width: clamp(30px, 4.6vh, 36px); height: clamp(30px, 4.6vh, 36px); border-radius: 50%; flex-shrink: 0;
            display: flex; align-items: center; justify-content: center; background: rgba(185,139,78,0.22);
        }
        .secure-text { min-width: 0; text-align: center; }
        .secure-note-title { font-size: 0.86rem; font-weight: 700; color: ${PRIMARY_DEEP}; margin: 0; }
        .secure-note-meta { font-size: 0.74rem; color: ${INK_SOFT}; margin: 2px 0 0; line-height: 1.4; }

        .year-note { font-size: 0.74rem; font-weight: 600; color: #FFFDF9; text-align: center; margin: clamp(8px, 1.6vh, 18px) 0 0; line-height: 1.5; }

        /* Tablet / desktop: everything fits one screen, no page scroll */
        @media (min-width: 640px) {
            .login-inner { height: 100%; min-height: 0; }
            .login-main { min-height: 0; }
            .auth-card { max-height: 100%; overflow-y: auto; scrollbar-width: none; }
            .auth-card::-webkit-scrollbar { display: none; }
        }
        /* Short screens: drop the least important lines */
        @media (max-height: 760px) { .secure-note-meta { display: none; } .auth-sub { display: none; } }
        @media (max-height: 620px) { .auth-eyebrow, .secure-note { display: none; } }
        @media (max-height: 540px) { .logo-img { width: 64px; } }
        /* Keep the mobile auth page fixed to the viewport; only the card scrolls if content cannot fit. */
        @media (max-width: 639px) {
            .login-root {
                background: linear-gradient(170deg, #FFFDF9 0%, #F6E9E1 28%, #B25A78 62%, ${PRIMARY} 85%, ${PRIMARY_DEEP} 100%);
            }
            .login-inner {
                height: 100%; min-height: 0;
                padding: max(8px, env(safe-area-inset-top)) 12px max(8px, env(safe-area-inset-bottom));
            }
            .login-main { min-height: 0; }
            .auth-card { max-height: calc(100% - 34px); overflow-y: auto; scrollbar-width: none; }
            .auth-card::-webkit-scrollbar { display: none; }
            .login-root { --logo-w: clamp(56px, 11vh, 84px); --pad-y: clamp(10px, 2vh, 18px); --gap: clamp(6px, 1.2vh, 10px); }
            .year-note { font-size: 0.68rem; }
        }

        @media (prefers-reduced-motion: reduce) {
            .submit-btn, .logo-link { transition: none; }
        }
    `}</style>
);

export default Login;