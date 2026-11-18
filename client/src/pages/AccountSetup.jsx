import { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Eye, EyeOff, KeyRound, ShieldCheck, UserRound } from 'lucide-react';
import { API_ORIGIN } from '../utils/apiConfig.js';
import { getPasswordRequirementError, isValidPassword } from '../utils/passwordPolicy.js';

// Official Apple Scholar logo — also the way back to the landing page
import appleLogo from '../assets/logo/applelogo.png';

/* ---------- Same token system as Login / ForgotPassword ---------- */
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

const ROLE_HOME = { admin: '/admin', staff: '/staff', officer: '/officer' };
const ROLE_LABEL = { admin: 'Administrator', staff: 'Staff', officer: 'Officer' };

const display = { fontFamily: "'Playfair Display', Georgia, serif" };
const sans = { fontFamily: "'Inter', 'Segoe UI', sans-serif" };

const AccountSetup = () => {
    const navigate = useNavigate();
    const [profile, setProfile] = useState({ login_id: '', full_name: '', email: '', role: '' });
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPasswords, setShowPasswords] = useState(false);
    const [error, setError] = useState('');
    const [loadingProfile, setLoadingProfile] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const token = localStorage.getItem('token');
        axios.get(`${API_ORIGIN}/api/account/setup`, {
            headers: { Authorization: `Bearer ${token}` },
        }).then(({ data }) => {
            setProfile(data);
        }).catch((requestError) => {
            setError(requestError.response?.data?.error || 'Unable to load your account details.');
        }).finally(() => setLoadingProfile(false));
    }, []);

    const updateProfile = (field, value) => {
        setProfile((current) => ({ ...current, [field]: value }));
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError('');
        if (!isValidPassword(newPassword)) {
            setError(getPasswordRequirementError(newPassword));
            return;
        }
        if (newPassword !== confirmPassword) {
            setError('Your new password and confirmation do not match.');
            return;
        }

        setSaving(true);
        try {
            const token = localStorage.getItem('token');
            await axios.post(`${API_ORIGIN}/api/account/setup`, {
                full_name: profile.full_name,
                email: profile.email,
                current_password: currentPassword,
                new_password: newPassword,
            }, { headers: { Authorization: `Bearer ${token}` } });

            localStorage.removeItem('must_change_password');
            localStorage.setItem('name', profile.full_name.trim());
            localStorage.setItem('email', profile.email.trim());
            navigate(ROLE_HOME[profile.role] || '/login', { replace: true });
        } catch (requestError) {
            setError(requestError.response?.data?.error || 'Unable to save your account setup.');
        } finally {
            setSaving(false);
        }
    };

    const passwordFields = [
        ['current-password', 'Temporary password', currentPassword, setCurrentPassword, 'current-password'],
        ['new-password', 'New password', newPassword, setNewPassword, 'new-password'],
        ['confirm-password', 'Confirm new password', confirmPassword, setConfirmPassword, 'new-password'],
    ];

    return (
        <div className="as-root" style={{ ...sans, color: INK }}>
            <GlobalStyle />

            {/* ── Background: cream → blush → maroon blend (same as Login) ── */}
            <div className="as-bg" aria-hidden="true">
                <svg viewBox="0 0 1440 900" preserveAspectRatio="none" className="as-bg-svg">
                    <path d="M1440,0 C1260,90 1180,210 1210,360 C1240,520 1330,600 1440,640 Z" fill={PRIMARY_DEEP} opacity="0.35" />
                </svg>
            </div>

            <div className="as-inner">
                <main className="as-main">
                    <div className="as-card">
                        {/* Logo inside the card — click to go back to the landing page */}
                        <div className="as-logo-wrap">
                            <button type="button" onClick={() => navigate('/')} aria-label="Back to Apple Scholar home" className="as-logo-link">
                                <img src={appleLogo} alt="Apple Scholar" className="as-logo-img" />
                            </button>
                        </div>

                        <p className="as-eyebrow">Account setup · {ROLE_LABEL[profile.role] || 'Team Portal'}</p>
                        <h1 className="as-title" style={display}>Complete Your Account</h1>
                        <p className="as-sub">
                            Confirm your contact details and replace the temporary password before entering your portal.
                        </p>

                        {profile.login_id && (
                            <div className="as-chips">
                                <span className="as-chip">User ID: {profile.login_id}</span>
                            </div>
                        )}

                        {error && (
                            <div role="alert" className="as-error">
                                <AlertCircle size={16} color={ERROR_TEXT} style={{ flexShrink: 0, marginTop: 2 }} />
                                <span>{error}</span>
                            </div>
                        )}

                        {loadingProfile ? (
                            <div className="as-loading">
                                <span className="as-spinner as-spinner-dark" />
                                Loading your account details…
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit}>
                                <div className="as-layout">
                                    {/* ── Contact details ── */}
                                    <section className="as-panel" aria-labelledby="as-contact">
                                        <div className="as-section-head">
                                            <span className="as-chip-icon"><UserRound size={18} strokeWidth={1.8} /></span>
                                            <h2 id="as-contact" className="as-section-title" style={display}>Contact details</h2>
                                        </div>
                                        <div className="as-stack">
                                            <div className="as-field">
                                                <label className="as-label" htmlFor="as-full-name">Full name</label>
                                                <input id="as-full-name" className="as-input" value={profile.full_name} onChange={(e) => updateProfile('full_name', e.target.value)} autoComplete="name" required maxLength={255} />
                                            </div>
                                            <div className="as-field">
                                                <label className="as-label" htmlFor="as-email">Email address</label>
                                                <input id="as-email" className="as-input" type="email" value={profile.email} onChange={(e) => updateProfile('email', e.target.value)} autoComplete="email" required maxLength={255} />
                                            </div>
                                        </div>
                                    </section>

                                    {/* ── Password ── */}
                                    <section className="as-panel as-panel-side" aria-labelledby="as-password">
                                        <div className="as-section-head">
                                            <span className="as-chip-icon"><ShieldCheck size={18} strokeWidth={1.8} /></span>
                                            <h2 id="as-password" className="as-section-title" style={display}>Set a new password</h2>
                                        </div>
                                        <div className="as-info">
                                            <span className="as-info-chip"><KeyRound size={16} color={PRIMARY} strokeWidth={1.8} /></span>
                                            <p>Use the temporary password sent by your administrator as your current password. Your new password must be at least 8 characters and include a special character, such as ! or @.</p>
                                        </div>
                                        <div className="as-stack">
                                            {passwordFields.map(([id, label, value, setValue, autoComplete]) => (
                                                <div key={id} className="as-field">
                                                    <label className="as-label" htmlFor={id}>{label}</label>
                                                    <div className="as-password">
                                                        <input
                                                            id={id}
                                                            className="as-input"
                                                            style={{ paddingRight: 46 }}
                                                            type={showPasswords ? 'text' : 'password'}
                                                            value={value}
                                                            onChange={(e) => setValue(e.target.value)}
                                                            autoComplete={autoComplete}
                                                            required
                                                            minLength={id === 'current-password' ? undefined : 8}
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => setShowPasswords((visible) => !visible)}
                                                            aria-label={showPasswords ? 'Hide passwords' : 'Show passwords'}
                                                            className="as-eye"
                                                            tabIndex={-1}
                                                        >
                                                            {showPasswords ? <EyeOff size={18} /> : <Eye size={18} />}
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </section>
                                </div>

                                <div className="as-actions">
                                    <button type="submit" disabled={saving} className="as-submit" style={sans}>
                                        {saving ? (
                                            <>
                                                <span className="as-spinner" />
                                                Saving account…
                                            </>
                                        ) : (
                                            'Save details and continue'
                                        )}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>

                    <p className="as-year-note">Academic Year 2026–2027 · Scholarship Compliance Tracking System</p>
                </main>
            </div>
        </div>
    );
};

const GlobalStyle = () => (
    <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap');

        @keyframes as-spin { to { transform: rotate(360deg); } }
        @keyframes as-slide-up {
            from { opacity: 0; transform: translateY(18px); }
            to   { opacity: 1; transform: translateY(0); }
        }

        .as-root {
            position: relative; width: 100%;
            min-height: 100vh; min-height: 100dvh;
            overflow-x: clip;
            background: linear-gradient(115deg, #FFFDF9 0%, #F6E9E1 30%, #B25A78 66%, #6D2140 84%, ${PRIMARY_DEEP} 100%);
            background-attachment: fixed;
        }
        .as-root *, .as-root *::before, .as-root *::after { box-sizing: border-box; }
        .as-bg { position: fixed; inset: 0; overflow: hidden; pointer-events: none; z-index: 0; }
        .as-bg-svg { position: absolute; inset: 0; width: 100%; height: 100%; }

        .as-inner {
            position: relative; z-index: 1;
            min-height: 100vh; min-height: 100dvh;
            display: flex; flex-direction: column; align-items: center;
            padding: clamp(16px, 4vh, 40px) 16px clamp(20px, 4vh, 36px);
        }
        .as-main { flex: 1; width: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; }

        /* ── Card ── */
        .as-card {
            width: 100%; max-width: 860px;
            background: ${CARD}; border: 1px solid ${BORDER}; border-top: 3px solid ${ACCENT};
            border-radius: 22px; padding: clamp(22px, 4vh, 36px) clamp(20px, 3.4vw, 40px);
            box-shadow: 0 34px 70px -26px rgba(30,8,18,0.6);
            animation: as-slide-up 0.6s cubic-bezier(.16,1,.3,1) forwards;
        }

        .as-logo-wrap { display: flex; justify-content: center; margin-bottom: 10px; }
        .as-logo-link {
            background: none; border: none; padding: 0; margin: 0; cursor: pointer;
            display: block; line-height: 0; border-radius: 10px; transition: transform 0.2s ease;
        }
        .as-logo-link:hover { transform: translateY(-2px); }
        .as-logo-img { width: clamp(70px, 11vh, 100px); height: auto; display: block; object-fit: contain; }

        .as-eyebrow {
            font-size: 11px; font-weight: 600; letter-spacing: 0.24em; text-transform: uppercase;
            color: ${ACCENT_DARK}; text-align: center; margin: 0 0 6px;
        }
        .as-title {
            font-size: clamp(24px, 4.6vw, 34px); font-weight: 600; color: ${PRIMARY_DEEP};
            text-align: center; margin: 0 0 8px; line-height: 1.15;
        }
        .as-sub { font-size: 0.84rem; line-height: 1.6; color: ${INK_SOFT}; text-align: center; margin: 0 auto 14px; max-width: 520px; }

        .as-chips { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; margin-bottom: 20px; }
        .as-chip {
            display: inline-flex; align-items: center; padding: 6px 14px; border-radius: 999px;
            background: ${SAND}; border: 1px solid ${BORDER}; color: ${PRIMARY_DEEP}; font-size: 0.74rem; font-weight: 600;
        }

        .as-error {
            display: flex; align-items: flex-start; gap: 9px; border-radius: 10px;
            background: ${ERROR_BG}; color: ${ERROR_TEXT}; border-left: 3px solid ${PRIMARY};
            padding: 10px 14px; font-size: 0.82rem; line-height: 1.45; font-weight: 500; margin-bottom: 18px;
        }

        .as-loading {
            display: flex; align-items: center; justify-content: center; gap: 10px;
            padding: 28px 0 12px; font-size: 0.86rem; color: ${MUTED};
        }

        /* ── Layout ── */
        .as-layout { display: grid; grid-template-columns: 1fr; gap: 24px; }
        .as-panel { min-width: 0; }
        @media (min-width: 760px) {
            .as-layout { grid-template-columns: 1fr 1fr; gap: 0; align-items: start; }
            .as-panel { padding-right: 30px; }
            .as-panel-side { padding-right: 0; padding-left: 30px; border-left: 1px solid ${BORDER}; }
        }
        @media (max-width: 759px) {
            .as-panel-side { padding-top: 22px; border-top: 1px solid ${BORDER}; }
        }

        .as-section-head { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
        .as-chip-icon {
            flex-shrink: 0; width: 36px; height: 36px; border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
            background: rgba(185,139,78,0.22); color: ${PRIMARY};
        }
        .as-section-title { margin: 0; font-size: 1.08rem; font-weight: 600; color: ${PRIMARY_DEEP}; line-height: 1.3; }

        /* ── Form ── */
        .as-stack { display: flex; flex-direction: column; gap: 14px; }
        .as-field { min-width: 0; display: flex; flex-direction: column; }
        .as-label { font-size: 0.78rem; font-weight: 600; color: ${INK}; margin-bottom: 5px; }

        .as-input {
            display: block; width: 100%; height: 46px; padding: 0 16px;
            border: 1px solid ${BORDER}; border-radius: 12px; background: ${CARD};
            color: ${INK}; font-family: 'Inter', 'Segoe UI', sans-serif; font-size: 0.92rem;
            outline: none; transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }
        .as-input::placeholder { color: #B7A99E; }
        .as-input:focus { border-color: ${PRIMARY}; box-shadow: 0 0 0 4px rgba(109,33,64,0.12); }

        .as-password { position: relative; display: flex; align-items: center; }
        .as-eye {
            position: absolute; right: 14px; display: flex; background: none; border: none; padding: 0;
            color: ${MUTED}; cursor: pointer; transition: color 0.15s ease;
        }
        .as-eye:hover { color: ${INK}; }

        .as-info {
            display: flex; align-items: center; gap: 12px; margin-bottom: 16px;
            padding: 10px 14px; border-radius: 14px; background: ${SAND};
            color: ${INK_SOFT}; font-size: 0.78rem; line-height: 1.5;
        }
        .as-info p { margin: 0; }
        .as-info-chip {
            flex-shrink: 0; width: 32px; height: 32px; border-radius: 50%;
            display: flex; align-items: center; justify-content: center; background: rgba(185,139,78,0.22);
        }

        /* ── Submit ── */
        .as-actions { display: flex; justify-content: flex-end; margin-top: 24px; padding-top: 20px; border-top: 1px solid ${BORDER}; }
        .as-submit {
            display: inline-flex; align-items: center; justify-content: center; gap: 8px;
            height: 48px; padding: 0 28px; border: none; border-radius: 12px;
            background: linear-gradient(90deg, ${PRIMARY}, ${PRIMARY_DEEP}); color: #fff;
            font-size: 0.94rem; font-weight: 600; cursor: pointer;
            box-shadow: 0 12px 24px -14px rgba(109,33,64,0.6);
            transition: transform 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease;
        }
        .as-submit:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 16px 28px -14px rgba(74,23,48,0.65); }
        .as-submit:disabled { opacity: 0.65; cursor: default; }
        @media (max-width: 639px) { .as-actions .as-submit { width: 100%; } }

        .as-spinner {
            width: 16px; height: 16px; border-radius: 50%;
            border: 2px solid rgba(255,255,255,0.35); border-top-color: #fff;
            display: inline-block; animation: as-spin 0.7s linear infinite;
        }
        .as-spinner-dark { border-color: rgba(109,33,64,0.2); border-top-color: ${PRIMARY}; }

        .as-root button:focus-visible { outline: 2px solid ${ACCENT}; outline-offset: 3px; }

        .as-year-note {
            font-size: 0.74rem; font-weight: 600; color: #FFFDF9; text-align: center;
            margin: 18px 0 0; line-height: 1.5;
        }

        @media (max-width: 639px) {
            .as-root {
                background: linear-gradient(170deg, #FFFDF9 0%, #F6E9E1 28%, #B25A78 62%, ${PRIMARY} 85%, ${PRIMARY_DEEP} 100%);
                background-attachment: fixed;
            }
        }

        @media (prefers-reduced-motion: reduce) {
            .as-card { animation: none; }
            .as-submit, .as-input, .as-eye, .as-logo-link { transition: none; }
            .as-submit:hover:not(:disabled) { transform: none; }
        }
    `}</style>
);

export default AccountSetup;