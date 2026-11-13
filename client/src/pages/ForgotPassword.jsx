import { useMemo, useState } from 'react';
import axios from 'axios';
import { ArrowLeft, ArrowRight, CheckCircle2, AlertCircle, Mail, Lock, ShieldCheck } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

// Official Apple Scholar logo — also the way back to the landing page
import appleLogo from '../assets/logo/applelogo.png';

const API_BASE = `${(import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '').replace(/\/api$/, '')}/api`;

/* ---------- Same token system as the redesigned Login ---------- */
const BURGUNDY = '#6D2140';
const BURGUNDY_DEEP = '#4A1730';
const GOLD = '#B98B4E';
const GOLD_DARK = '#8F6A35';
const CARD = '#FFFDF9';
const BORDER = '#E7D8C7';
const SAND = '#FBF1E6';
const INK = '#241512';
const TEXT_SOFT = '#5C4E42';
const MUTED = '#8A7A68';
const SUCCESS = '#3F8A55';
const DANGER_BG = '#FBEAEA';
const DANGER_TEXT = '#8E2631';

const recoverySteps = [
    { n: 1, label: 'Verify Email' },
    { n: 2, label: 'Receive Secure Link' },
    { n: 3, label: 'Create New Password' },
];

const securityNotices = [
    'Link expires in 15 minutes',
    'One-time verification',
    'Encrypted authentication',
];

const display = { fontFamily: "'Playfair Display', Georgia, serif" };
const sans = { fontFamily: "'Inter', 'Segoe UI', sans-serif" };
const mono = { fontFamily: "'IBM Plex Mono', monospace" };

const ForgotPassword = () => {
    const [params] = useSearchParams();
    const navigate = useNavigate();
    const resetToken = params.get('token');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const claimNo = useMemo(() => String(Date.now()).slice(-6), []);

    // Presentation only: which step of the recovery journey the person is on.
    const activeStep = resetToken ? 3 : message ? 2 : 1;

    const handleSubmit = async (event) => {
        event.preventDefault();
        setMessage('');
        setError('');
        if (resetToken && password !== confirmPassword) {
            setError('The new password and confirmation do not match.');
            return;
        }
        if (resetToken && password.length < 8) {
            setError('Your new password must be at least 8 characters.');
            return;
        }

        setIsLoading(true);
        try {
            if (resetToken) {
                await axios.post(`${API_BASE}/reset-password`, { token: resetToken, new_password: password });
                setMessage('Your password has been reset. You can now sign in with your new password.');
            } else {
                await axios.post(`${API_BASE}/forgot-password`, { email });
                setMessage('If an account uses that email, a password reset link has been sent. Check your inbox.');
            }
        } catch (requestError) {
            setError(requestError.response?.data?.error || 'Unable to process your request. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    // ── Success view — replaces the form once `message` is set ──
    const successView = (
        <div className="success-view">
            <div className="success-icon">
                <CheckCircle2 size={30} color="#fff" strokeWidth={2} />
            </div>
            <h3 className="success-title" style={display}>
                {resetToken ? 'Password Reset' : 'Recovery Email Sent'}
            </h3>
            <p className="success-desc" style={sans}>
                {resetToken ? 'You can now sign in with your new password.' : 'Check your inbox and spam folder.'}
            </p>
            <p className="success-detail" style={sans}>{message}</p>

            <Link to="/login" className="submit-btn" style={sans}>
                Return to Login <ArrowRight size={18} />
            </Link>

            {!resetToken && (
                <p className="success-retry" style={sans}>Didn't receive it? Try again after 60 seconds.</p>
            )}
        </div>
    );

    // ── Recovery form ──
    const recoveryForm = (
        <form onSubmit={handleSubmit}>
            {!resetToken ? (
                <div className="field-group">
                    <label className="field-label" htmlFor="fp-email">Account email</label>
                    <div className="input-wrap">
                        <Mail size={17} color={BURGUNDY} className="input-icon" />
                        <input
                            id="fp-email"
                            type="email" required value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            autoComplete="email" placeholder="yourname@kalinga.org"
                            className="enterprise-input"
                            style={sans}
                        />
                    </div>
                </div>
            ) : (
                <>
                    <div className="field-group">
                        <label className="field-label" htmlFor="fp-new">New password</label>
                        <div className="input-wrap">
                            <Lock size={17} color={BURGUNDY} className="input-icon" />
                            <input
                                id="fp-new"
                                type="password" required minLength="8" value={password}
                                onChange={(event) => setPassword(event.target.value)}
                                autoComplete="new-password"
                                className="enterprise-input"
                                style={sans}
                            />
                        </div>
                    </div>
                    <div className="field-group" style={{ marginTop: 'var(--gap)' }}>
                        <label className="field-label" htmlFor="fp-confirm">Confirm new password</label>
                        <div className="input-wrap">
                            <Lock size={17} color={BURGUNDY} className="input-icon" />
                            <input
                                id="fp-confirm"
                                type="password" required minLength="8" value={confirmPassword}
                                onChange={(event) => setConfirmPassword(event.target.value)}
                                autoComplete="new-password"
                                className="enterprise-input"
                                style={sans}
                            />
                        </div>
                    </div>
                </>
            )}

            <button type="submit" disabled={isLoading} className="submit-btn" style={sans}>
                {isLoading ? (
                    <>
                        <span className="spinner" />
                        Please wait…
                    </>
                ) : (
                    <>{resetToken ? 'Reset password' : 'Send Reset Link'} <ArrowRight size={18} /></>
                )}
            </button>
        </form>
    );

    return (
        <div className="fp-root" style={{ ...sans, color: INK }}>
            <GlobalStyle />

            {/* ── Background: cream → blush → maroon blend, bottom waves (same as Login) ── */}
            <div className="fp-bg" aria-hidden="true">
                <svg viewBox="0 0 1440 900" preserveAspectRatio="none" className="bg-svg">
                    <path d="M1440,0 C1260,90 1180,210 1210,360 C1240,520 1330,600 1440,640 Z" fill={BURGUNDY_DEEP} opacity="0.35" />
                    <path d="M0,790 C300,750 560,830 860,800 C1120,772 1300,810 1440,780 L1440,900 L0,900 Z" fill="#F4ECE0" opacity="0.9" />
                    <path d="M0,812 C300,780 560,850 860,826 C1120,804 1300,838 1440,812" fill="none" stroke={GOLD} strokeWidth="1.8" vectorEffect="non-scaling-stroke" />
                    <path d="M0,830 C320,806 580,872 880,852 C1140,834 1320,866 1440,846 L1440,900 L0,900 Z" fill={BURGUNDY} />
                    <path d="M0,872 C340,856 600,890 900,884 C1160,878 1340,892 1440,884 L1440,900 L0,900 Z" fill={BURGUNDY_DEEP} />
                </svg>
            </div>

            <div className="fp-inner">
                <main className="fp-main">
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
                        <h1 className="auth-title" style={display}>
                            {resetToken ? 'Create New Password' : 'Recover Your Account'}
                        </h1>
                        <p className="auth-subtitle" style={sans}>
                            {resetToken
                                ? 'Set a new password for your Scholar Portal account.'
                                : "Enter your registered email and we'll send you a secure link to reset your password."}
                        </p>

                        {error && (
                            <div role="alert" className="alert alert-error" style={sans}>
                                <AlertCircle size={16} color={BURGUNDY} style={{ flexShrink: 0, marginTop: 2 }} />
                                <span>{error}</span>
                            </div>
                        )}

                        {message ? successView : recoveryForm}

                        {!message && (
                            <div className="secure-note">
                                <div className="secure-head">
                                    <span className="secure-chip">
                                        <ShieldCheck size={18} color={BURGUNDY} strokeWidth={1.8} />
                                    </span>
                                    <div>
                                        <p className="secure-note-title">Secure Recovery</p>
                                        <p className="secure-note-text">Your information is protected.</p>
                                    </div>
                                </div>
                                <ul className="secure-list">
                                    {securityNotices.map((n, i) => (
                                        <li key={i}>{n}</li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {!message && (
                            <div className="back-row">
                                <span className="back-line" />
                                <Link to="/login" className="return-nav" style={sans}>
                                    <ArrowLeft size={15} /> Back to Login
                                </Link>
                                <span className="back-line" />
                            </div>
                        )}

                        {/* Progress steps */}
                        <ol className="steps" aria-label="Recovery progress">
                            {recoverySteps.map((s, i) => {
                                const done = s.n <= activeStep;
                                return (
                                    <li
                                        key={s.n}
                                        className="step"
                                        aria-current={s.n === activeStep ? 'step' : undefined}
                                    >
                                        {i > 0 && <span className={`step-line ${done ? 'step-line-done' : ''}`} />}
                                        <span className={`step-dot ${done ? 'step-dot-done' : ''}`}>0{s.n}</span>
                                        <span className="step-label" style={sans}>{s.label}</span>
                                    </li>
                                );
                            })}
                        </ol>

                        <div className="card-footer" style={sans}>
                            <span>Kalinga Foundation · Recovery Center</span>
                            <span className="ref-id">
                                Ref. <span style={mono}>REF-{claimNo}</span>
                            </span>
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
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600;700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap');

        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes card-slide-up {
            from { opacity: 0; transform: translateY(18px); }
            to   { opacity: 1; transform: translateY(0); }
        }

        .fp-root {
            --logo-w: clamp(70px, 12vh, 110px);
            --pad-y: clamp(12px, 2.6vh, 26px);
            --pad-x: clamp(22px, 2.4vw, 34px);
            --gap: clamp(7px, 1.4vh, 14px);
            --input-h: clamp(38px, 5.6vh, 48px);
            --title-fs: clamp(20px, 3.8vh, 28px);
            --dot: clamp(24px, 3.6vh, 30px);
            position: relative; width: 100%;
            min-height: 100vh; min-height: 100dvh;
            overflow-x: clip;
            background: linear-gradient(115deg, #FFFDF9 0%, #F6E9E1 30%, #B25A78 66%, #6D2140 84%, ${BURGUNDY_DEEP} 100%);
        }
        .fp-bg { position: absolute; inset: 0; overflow: hidden; pointer-events: none; z-index: 0; }
        .bg-svg { position: absolute; inset: 0; width: 100%; height: 100%; }

        .fp-inner {
            position: relative; z-index: 1;
            min-height: 100vh; min-height: 100dvh;
            display: flex; flex-direction: column; align-items: center;
            padding: clamp(10px, 2.2vh, 26px) 16px clamp(30px, 7vh, 70px); box-sizing: border-box;
        }
        .fp-main {
            flex: 1; width: 100%;
            display: flex; flex-direction: column; align-items: center; justify-content: center;
        }

        .card-logo-wrap { display: flex; justify-content: center; margin-bottom: calc(var(--gap) * 0.5); }
        .logo-link {
            background: none; border: none; padding: 0; margin: 0; cursor: pointer;
            display: block; line-height: 0; border-radius: 10px; transition: transform 0.2s ease;
        }
        .logo-link:hover { transform: translateY(-2px); }
        .logo-link:focus-visible { outline: 2px solid ${GOLD}; outline-offset: 5px; }
        .logo-img { width: var(--logo-w); height: auto; display: block; object-fit: contain; }

        .auth-card {
            width: 100%; max-width: 400px; box-sizing: border-box;
            background: ${CARD}; border: 1px solid ${BORDER}; border-top: 3px solid ${GOLD};
            border-radius: 22px; padding: var(--pad-y) var(--pad-x);
            box-shadow: 0 34px 70px -26px rgba(30,8,18,0.6);
            animation: card-slide-up 0.6s cubic-bezier(.16,1,.3,1) forwards;
        }
        .auth-eyebrow {
            font-size: 11px; font-weight: 600; letter-spacing: 0.24em; text-transform: uppercase;
            color: ${GOLD_DARK}; text-align: center; margin: 0 0 calc(var(--gap) * 0.4);
        }
        .auth-title {
            font-size: var(--title-fs); font-weight: 600; color: ${BURGUNDY_DEEP};
            text-align: center; margin: 0 0 calc(var(--gap) * 0.4); line-height: 1.15;
        }
        .auth-subtitle {
            font-size: 12.5px; line-height: 1.45; color: ${TEXT_SOFT};
            text-align: center; margin: 0 0 var(--gap);
        }

        .alert {
            display: flex; align-items: flex-start; gap: 9px; border-radius: 10px;
            padding: 9px 12px; font-size: 0.8rem; line-height: 1.4; margin-bottom: var(--gap);
        }
        .alert-error { background: ${DANGER_BG}; color: ${DANGER_TEXT}; border-left: 3px solid ${BURGUNDY}; }

        .field-group { display: flex; flex-direction: column; }
        .field-label { font-size: 0.78rem; font-weight: 600; color: ${INK}; margin-bottom: 5px; }
        .input-wrap { position: relative; display: flex; align-items: center; }
        .input-icon { position: absolute; left: 15px; pointer-events: none; }
        .enterprise-input {
            width: 100%; height: var(--input-h); border-radius: 12px; border: 1px solid ${BORDER};
            background: ${CARD}; padding: 0 16px 0 42px; font-size: 0.92rem; color: ${INK};
            outline: none; transition: border-color 0.2s ease, box-shadow 0.2s ease; box-sizing: border-box;
        }
        .enterprise-input::placeholder { color: #B7A99E; }
        .enterprise-input:focus { border-color: ${BURGUNDY}; box-shadow: 0 0 0 4px rgba(109,33,64,0.12); }
        .enterprise-input:-webkit-autofill,
        .enterprise-input:-webkit-autofill:hover,
        .enterprise-input:-webkit-autofill:focus {
            -webkit-text-fill-color: ${INK};
            -webkit-box-shadow: 0 0 0px 1000px ${CARD} inset;
            transition: background-color 9999s ease-in-out 0s;
        }

        .submit-btn {
            width: 100%; height: var(--input-h); margin-top: var(--gap); border-radius: 12px; border: none;
            background: linear-gradient(90deg, ${BURGUNDY}, ${BURGUNDY_DEEP}); color: #FFFFFF;
            font-size: 0.94rem; font-weight: 600; box-sizing: border-box;
            display: flex; align-items: center; justify-content: center; gap: 8px;
            cursor: pointer; text-decoration: none;
            box-shadow: 0 12px 24px -14px rgba(109,33,64,0.6);
            transition: transform 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease;
        }
        .submit-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 16px 28px -14px rgba(74,23,48,0.65); }
        .submit-btn:disabled { opacity: 0.65; cursor: default; }
        .submit-btn:focus-visible, .return-nav:focus-visible { outline: 2px solid ${GOLD}; outline-offset: 3px; }

        .spinner {
            width: 16px; height: 16px; border-radius: 50%;
            border: 2px solid rgba(255,255,255,0.35); border-top-color: #fff;
            display: inline-block; animation: spin 0.7s linear infinite;
        }

        /* Secure recovery panel */
        .secure-note { margin-top: var(--gap); padding: clamp(7px, 1.3vh, 12px) 14px; border-radius: 14px; background: ${SAND}; }
        .secure-head { display: flex; align-items: center; gap: 12px; }
        .secure-chip {
            width: clamp(28px, 4.4vh, 36px); height: clamp(28px, 4.4vh, 36px); border-radius: 50%; flex-shrink: 0;
            display: flex; align-items: center; justify-content: center; background: rgba(185,139,78,0.22);
        }
        .secure-note-title { font-size: 0.86rem; font-weight: 700; color: ${BURGUNDY_DEEP}; margin: 0; }
        .secure-note-text { font-size: 0.76rem; color: ${TEXT_SOFT}; margin: 1px 0 0; }
        .secure-list { margin: clamp(4px, 0.9vh, 8px) 0 0; padding: 0; list-style: none; display: flex; flex-wrap: wrap; gap: 2px 14px; }
        .secure-list li { position: relative; padding-left: 11px; font-size: 0.72rem; color: ${MUTED}; line-height: 1.4; }
        .secure-list li::before {
            content: ''; position: absolute; left: 0; top: 6px; width: 4px; height: 4px; border-radius: 50%; background: ${GOLD};
        }

        /* Back to login */
        .back-row { display: flex; align-items: center; gap: 12px; margin-top: var(--gap); }
        .back-line { flex: 1; height: 1px; background: ${BORDER}; }
        .return-nav {
            display: inline-flex; align-items: center; gap: 7px; color: ${BURGUNDY};
            font-size: 0.86rem; font-weight: 600; text-decoration: none; white-space: nowrap;
        }
        .return-nav:hover { color: ${BURGUNDY_DEEP}; text-decoration: underline; }

        /* Progress steps */
        .steps { list-style: none; margin: var(--gap) 0 0; padding: 0; display: flex; }
        .step { flex: 1; position: relative; display: flex; flex-direction: column; align-items: center; gap: 4px; text-align: center; min-width: 0; }
        .step-line { position: absolute; top: calc(var(--dot) / 2); right: 50%; width: 100%; height: 1px; background: ${BORDER}; z-index: 0; }
        .step-line-done { background: ${BURGUNDY}; }
        .step-dot {
            position: relative; z-index: 1; width: var(--dot); height: var(--dot); border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
            font-size: 0.7rem; font-weight: 700; background: ${SAND}; color: ${BURGUNDY}; border: 1px solid ${BORDER};
        }
        .step-dot-done { background: ${BURGUNDY}; color: #fff; border-color: ${BURGUNDY}; }
        .step-label { font-size: 0.66rem; color: ${TEXT_SOFT}; line-height: 1.25; max-width: 84px; }

        .card-footer {
            display: flex; flex-wrap: wrap; justify-content: space-between; gap: 4px 12px;
            margin-top: var(--gap); padding-top: calc(var(--gap) * 0.6); border-top: 1px solid ${BORDER};
            font-size: 0.66rem; color: ${MUTED};
        }
        .ref-id { white-space: nowrap; }

        /* Success view */
        .success-view { text-align: center; padding: 2px 0 0; }
        .success-icon {
            width: 52px; height: 52px; border-radius: 50%;
            background: linear-gradient(135deg, ${SUCCESS} 0%, #2F6B41 100%);
            display: flex; align-items: center; justify-content: center; margin: 0 auto 10px;
        }
        .success-title { font-size: 1.25rem; font-weight: 700; color: ${INK}; margin: 0 0 6px; }
        .success-desc { font-size: 0.86rem; color: #3f2f28; margin: 0 0 4px; }
        .success-detail { font-size: 0.78rem; color: ${MUTED}; margin: 0 0 4px; line-height: 1.5; }
        .success-retry { font-size: 0.74rem; color: ${MUTED}; margin: 10px 0 0; }

        .year-note { font-size: 0.74rem; font-weight: 600; color: #FFFDF9; text-align: center; margin: clamp(8px, 1.6vh, 18px) 0 0; line-height: 1.5; }

        /* Tablet / desktop: everything fits one screen, no page scroll */
        @media (min-width: 640px) {
            .fp-root { height: 100vh; height: 100dvh; min-height: 0; overflow: hidden; }
            .fp-inner { height: 100%; min-height: 0; }
            .fp-main { min-height: 0; }
            .auth-card { max-height: 100%; overflow-y: auto; scrollbar-width: none; }
            .auth-card::-webkit-scrollbar { display: none; }
        }
        /* Short screens: drop the least important lines */
        @media (max-height: 780px) { .secure-list, .auth-eyebrow { display: none; } }
        @media (max-height: 680px) { .auth-subtitle, .card-footer { display: none; } }
        @media (max-height: 580px) { .secure-note { display: none; } }
        @media (max-height: 540px) { .logo-img { width: 56px; } }

        /* Mobile: page scrolls if needed; gradient shifts so the year note stays readable */
        @media (max-width: 639px) {
            .fp-root { background: linear-gradient(170deg, #FFFDF9 0%, #F6E9E1 28%, #B25A78 62%, ${BURGUNDY} 85%, ${BURGUNDY_DEEP} 100%); }
        }

        @media (prefers-reduced-motion: reduce) {
            .auth-card { animation: none; }
            .submit-btn, .logo-link { transition: none; }
        }
    `}</style>
);

export default ForgotPassword;