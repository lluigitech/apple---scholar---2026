import { useEffect, useState } from 'react';
import axios from 'axios';
import { AlertCircle, ArrowRight, Eye, EyeOff, KeyRound, ShieldCheck, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getEducationStage } from '../utils/educationStage';

// Official Apple Scholar logo — also the way back to the landing page
import appleLogo from '../assets/logo/applelogo.png';

const API_BASE = `${(import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '').replace(/\/api$/, '')}/api`;

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
const SUCCESS = '#3F8A55';
const ERROR_BG = '#FBEAEA';
const ERROR_TEXT = '#8E2631';

const display = { fontFamily: "'Playfair Display', Georgia, serif" };
const sans = { fontFamily: "'Inter', 'Segoe UI', sans-serif" };

const initialDetails = {
    full_name: '',
    email: '',
    birth_date: '',
    phone: '',
    address: '',
    course: '',
    track_strand: '',
    school: '',
    year_level: '',
};

const yearLevels = [
    ['grade_7', 'Grade 7'], ['grade_8', 'Grade 8'], ['grade_9', 'Grade 9'],
    ['grade_10', 'Grade 10'], ['grade_11', 'Grade 11'], ['grade_12', 'Grade 12'],
    ['college_1', '1st Year College'], ['college_2', '2nd Year College'],
    ['college_3', '3rd Year College'], ['college_4', '4th Year College'],
    ['college_5', '5th Year College'],
];

/* ---------- Small building blocks ---------- */
const Field = ({ label, htmlFor, span2, children }) => (
    <div className={span2 ? 'sa-field sa-span2' : 'sa-field'}>
        <label className="sa-label" htmlFor={htmlFor}>{label}</label>
        {children}
    </div>
);

const PasswordField = ({ id, label, value, onChange, show, onToggle, autoComplete }) => (
    <Field label={label} htmlFor={id}>
        <div className="sa-password">
            <input
                id={id}
                type={show ? 'text' : 'password'}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                autoComplete={autoComplete}
                required
                className="sa-input"
                style={{ paddingRight: 46 }}
            />
            <button
                type="button"
                aria-label={show ? `Hide ${label}` : `Show ${label}`}
                onClick={onToggle}
                className="sa-eye"
                tabIndex={-1}
            >
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
        </div>
    </Field>
);

const SectionHeading = ({ icon: Icon, id, title, description }) => (
    <div className="sa-section-head">
        <span className="sa-chip-icon"><Icon size={18} strokeWidth={1.8} /></span>
        <div className="sa-section-head-text">
            <h2 id={id} className="sa-section-title" style={display}>{title}</h2>
            <p className="sa-section-desc">{description}</p>
        </div>
    </div>
);

const LogoButton = ({ onClick }) => (
    <div className="sa-logo-wrap">
        <button type="button" onClick={onClick} aria-label="Back to Apple Scholar home" className="sa-logo-link">
            <img src={appleLogo} alt="Apple Scholar" className="sa-logo-img" />
        </button>
    </div>
);

const New = () => {
    const navigate = useNavigate();
    const [details, setDetails] = useState(initialDetails);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isComplete, setIsComplete] = useState(false);
    const [fileNo, setFileNo] = useState('000000');
    const educationStage = getEducationStage(details.year_level);

    useEffect(() => {
        const token = localStorage.getItem('token');
        const role = localStorage.getItem('role');
        if (!token || role !== 'scholar') {
            navigate('/login', { replace: true });
            return;
        }

        const userId = localStorage.getItem('id');
        setFileNo(String(userId ?? '0').padStart(6, '0'));
        axios.get(`${API_BASE}/scholar/profile/${userId}`, {
            headers: { Authorization: `Bearer ${token}` },
        }).then(({ data }) => {
            setDetails({
                full_name: data.full_name ?? '',
                email: data.email ?? '',
                birth_date: data.birth_date ? String(data.birth_date).slice(0, 10) : '',
                phone: data.phone ?? '',
                address: data.address ?? '',
                course: data.course ?? '',
                track_strand: data.track_strand ?? '',
                school: data.school ?? '',
                year_level: data.year_level ?? '',
            });
        }).catch(() => setError('We could not load your account details. Please try again.'));
    }, [navigate]);

    const updateDetail = (field, value) => setDetails((current) => ({ ...current, [field]: value }));

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError('');

        if (newPassword.length < 8) {
            setError('Your new password must be at least 8 characters.');
            return;
        }
        if (newPassword !== confirmPassword) {
            setError('The new password and confirmation do not match.');
            return;
        }

        const token = localStorage.getItem('token');
        const userId = localStorage.getItem('id');
        setIsLoading(true);
        try {
            await axios.patch(`${API_BASE}/scholar/profile/${userId}`, {
                full_name: details.full_name,
                email: details.email,
                birth_date: details.birth_date || null,
                phone: details.phone,
                address: details.address,
                course: educationStage === 'college' || educationStage === 'other' ? details.course : '',
                track_strand: educationStage === 'senior_high' ? details.track_strand : '',
                school: details.school,
                year_level: details.year_level,
            }, { headers: { Authorization: `Bearer ${token}` } });

            await axios.post(`${API_BASE}/change-password`, {
                current_password: currentPassword,
                new_password: newPassword,
            }, { headers: { Authorization: `Bearer ${token}` } });

            localStorage.removeItem('must_change_password');
            localStorage.setItem('name', details.full_name);
            localStorage.setItem('email', details.email);
            setIsComplete(true);
        } catch (requestError) {
            setError(requestError.response?.data?.error || requestError.response?.data?.message || 'Unable to finish account setup. Please check your details and try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="sa-root" style={{ ...sans, color: INK }}>
            <GlobalStyle />

            {/* ── Background: cream → blush → maroon blend (same as Login) ── */}
            <div className="sa-bg" aria-hidden="true">
                <svg viewBox="0 0 1440 900" preserveAspectRatio="none" className="sa-bg-svg">
                    <path d="M1440,0 C1260,90 1180,210 1210,360 C1240,520 1330,600 1440,640 Z" fill={PRIMARY_DEEP} opacity="0.35" />
                </svg>
            </div>

            <div className="sa-inner">
                <main className="sa-main">
                    {isComplete ? (
                        <div className="sa-card sa-card-narrow sa-success">
                            <LogoButton onClick={() => navigate('/')} />
                            <span className="sa-success-icon"><ShieldCheck size={30} color="#fff" strokeWidth={2} /></span>
                            <p className="sa-eyebrow">Verified</p>
                            <h1 className="sa-title" style={display}>Your file is complete</h1>
                            <p className="sa-file-chip">File No. {fileNo}</p>
                            <p className="sa-sub">
                                Details are saved to File No. {fileNo}, and the temporary password on record has been replaced.
                            </p>
                            <button type="button" onClick={() => navigate('/scholar', { replace: true })} className="sa-submit" style={sans}>
                                Enter Scholar Portal <ArrowRight size={18} />
                            </button>
                        </div>
                    ) : (
                        <div className="sa-card">
                            <LogoButton onClick={() => navigate('/')} />

                            <p className="sa-eyebrow">Scholar Portal</p>
                            <h1 className="sa-title" style={display}>Complete Your Scholar File</h1>
                            <p className="sa-sub">
                                Confirm your personal and academic information, then replace your temporary password to activate your Scholar Portal access.
                            </p>

                            <div className="sa-chips">
                                <span className="sa-chip">File No. {fileNo}</span>
                                <span className="sa-chip sa-chip-pending"><span className="sa-dot" aria-hidden="true" />Pending Verification</span>
                            </div>

                            {error && (
                                <div role="alert" className="sa-error">
                                    <AlertCircle size={16} color={ERROR_TEXT} style={{ flexShrink: 0, marginTop: 2 }} />
                                    <span>{error}</span>
                                </div>
                            )}

                            <form onSubmit={handleSubmit}>
                                <div className="sa-layout">
                                    {/* ── 01 Personal & Academic ── */}
                                    <section className="sa-panel" aria-labelledby="section-01">
                                        <SectionHeading
                                            icon={UserRound}
                                            id="section-01"
                                            title="01 — Personal & Academic Details"
                                            description="Review and confirm the information associated with your scholarship account."
                                        />
                                        <div className="sa-grid">
                                            <Field label="Full name" htmlFor="sa-full-name">
                                                <input id="sa-full-name" className="sa-input" value={details.full_name} onChange={(e) => updateDetail('full_name', e.target.value)} required />
                                            </Field>
                                            <Field label="Email" htmlFor="sa-email">
                                                <input id="sa-email" className="sa-input" type="email" value={details.email} onChange={(e) => updateDetail('email', e.target.value)} required />
                                            </Field>
                                            <Field label="Birthday" htmlFor="sa-birthday">
                                                <input id="sa-birthday" className="sa-input" type="date" value={details.birth_date} onChange={(e) => updateDetail('birth_date', e.target.value)} required />
                                            </Field>
                                            <Field label="Phone number" htmlFor="sa-phone">
                                                <input id="sa-phone" className="sa-input" type="tel" value={details.phone} onChange={(e) => updateDetail('phone', e.target.value)} required />
                                            </Field>
                                            <Field label="Year level" htmlFor="sa-year-level">
                                                <select id="sa-year-level" className="sa-input sa-select" value={details.year_level} onChange={(e) => updateDetail('year_level', e.target.value)} required>
                                                    <option value="">Select year level</option>
                                                    {yearLevels.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                                                </select>
                                            </Field>
                                            {educationStage === 'senior_high' && (
                                                <Field label="Track / Strand" htmlFor="sa-track-strand">
                                                    <input id="sa-track-strand" className="sa-input" value={details.track_strand} onChange={(e) => updateDetail('track_strand', e.target.value)} placeholder="e.g. STEM, ABM, HUMSS, GAS, or TVL" required />
                                                </Field>
                                            )}
                                            {(educationStage === 'college' || educationStage === 'other') && (
                                                <Field label="Course" htmlFor="sa-course">
                                                    <input id="sa-course" className="sa-input" value={details.course} onChange={(e) => updateDetail('course', e.target.value)} placeholder="e.g. BS Computer Science" required />
                                                </Field>
                                            )}
                                            <Field label="School" htmlFor="sa-school" span2>
                                                <input id="sa-school" className="sa-input" value={details.school} onChange={(e) => updateDetail('school', e.target.value)} required />
                                            </Field>
                                            <Field label="Address" htmlFor="sa-address" span2>
                                                <textarea id="sa-address" className="sa-input sa-textarea" rows="3" value={details.address} onChange={(e) => updateDetail('address', e.target.value)} required />
                                            </Field>
                                        </div>
                                    </section>

                                    {/* ── 02 Security ── */}
                                    <section className="sa-panel sa-panel-side" aria-labelledby="section-02">
                                        <SectionHeading
                                            icon={ShieldCheck}
                                            id="section-02"
                                            title="02 — Security Credentials"
                                            description="Replace the temporary password provided by the administrator with your own secure password."
                                        />
                                        <div className="sa-info">
                                            <span className="sa-info-chip"><KeyRound size={16} color={PRIMARY} strokeWidth={1.8} /></span>
                                            <p>Use the temporary password from the administrator&rsquo;s email as your current password.</p>
                                        </div>
                                        <div className="sa-stack">
                                            <PasswordField id="sa-current-password" label="Current password" value={currentPassword} onChange={setCurrentPassword} show={showCurrent} onToggle={() => setShowCurrent((v) => !v)} autoComplete="current-password" />
                                            <PasswordField id="sa-new-password" label="New password" value={newPassword} onChange={setNewPassword} show={showNew} onToggle={() => setShowNew((v) => !v)} autoComplete="new-password" />
                                            <PasswordField id="sa-confirm-password" label="Confirm new password" value={confirmPassword} onChange={setConfirmPassword} show={showConfirm} onToggle={() => setShowConfirm((v) => !v)} autoComplete="new-password" />
                                        </div>
                                    </section>
                                </div>

                                <div className="sa-actions">
                                    <button type="submit" disabled={isLoading} className="sa-submit" style={sans}>
                                        {isLoading ? (
                                            <>
                                                <span className="sa-spinner" />
                                                Filing details…
                                            </>
                                        ) : (
                                            <>Save details and continue <ArrowRight size={18} /></>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                    <p className="sa-year-note">Academic Year 2026–2027 · Scholarship Compliance Tracking System</p>
                </main>
            </div>
        </div>
    );
};

/* ---------- Visual system ---------- */
const GlobalStyle = () => (
    <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap');

        @keyframes sa-spin { to { transform: rotate(360deg); } }
        @keyframes sa-slide-up {
            from { opacity: 0; transform: translateY(18px); }
            to   { opacity: 1; transform: translateY(0); }
        }

        .sa-root {
            position: relative; width: 100%;
            min-height: 100vh; min-height: 100dvh;
            overflow-x: clip;
            background: linear-gradient(115deg, #FFFDF9 0%, #F6E9E1 30%, #B25A78 66%, #6D2140 84%, ${PRIMARY_DEEP} 100%);
            background-attachment: fixed;
        }
        .sa-root *, .sa-root *::before, .sa-root *::after { box-sizing: border-box; }
        .sa-bg { position: fixed; inset: 0; overflow: hidden; pointer-events: none; z-index: 0; }
        .sa-bg-svg { position: absolute; inset: 0; width: 100%; height: 100%; }

        .sa-inner {
            position: relative; z-index: 1;
            min-height: 100vh; min-height: 100dvh;
            display: flex; flex-direction: column; align-items: center;
            padding: clamp(16px, 4vh, 40px) 16px clamp(20px, 4vh, 36px);
        }
        .sa-main { flex: 1; width: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; }

        /* ── Card ── */
        .sa-card {
            width: 100%; max-width: 1000px;
            background: ${CARD}; border: 1px solid ${BORDER}; border-top: 3px solid ${ACCENT};
            border-radius: 22px; padding: clamp(22px, 4vh, 38px) clamp(20px, 3.4vw, 40px);
            box-shadow: 0 34px 70px -26px rgba(30,8,18,0.6);
            animation: sa-slide-up 0.6s cubic-bezier(.16,1,.3,1) forwards;
        }
        .sa-card-narrow { max-width: 440px; }

        .sa-logo-wrap { display: flex; justify-content: center; margin-bottom: 10px; }
        .sa-logo-link {
            background: none; border: none; padding: 0; margin: 0; cursor: pointer;
            display: block; line-height: 0; border-radius: 10px; transition: transform 0.2s ease;
        }
        .sa-logo-link:hover { transform: translateY(-2px); }
        .sa-logo-img { width: clamp(70px, 11vh, 100px); height: auto; display: block; object-fit: contain; }

        .sa-eyebrow {
            font-size: 11px; font-weight: 600; letter-spacing: 0.24em; text-transform: uppercase;
            color: ${ACCENT_DARK}; text-align: center; margin: 0 0 6px;
        }
        .sa-title {
            font-size: clamp(24px, 4.6vw, 34px); font-weight: 600; color: ${PRIMARY_DEEP};
            text-align: center; margin: 0 0 8px; line-height: 1.15;
        }
        .sa-sub { font-size: 0.84rem; line-height: 1.6; color: ${INK_SOFT}; text-align: center; margin: 0 auto 14px; max-width: 560px; }

        .sa-chips { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; margin-bottom: 22px; }
        .sa-chip {
            display: inline-flex; align-items: center; gap: 8px; padding: 6px 14px; border-radius: 999px;
            background: ${SAND}; border: 1px solid ${BORDER}; color: ${PRIMARY_DEEP}; font-size: 0.74rem; font-weight: 600;
        }
        .sa-chip-pending { color: ${ACCENT_DARK}; }
        .sa-dot { width: 7px; height: 7px; border-radius: 50%; background: ${ACCENT}; }

        .sa-error {
            display: flex; align-items: flex-start; gap: 9px; border-radius: 10px;
            background: ${ERROR_BG}; color: ${ERROR_TEXT}; border-left: 3px solid ${PRIMARY};
            padding: 10px 14px; font-size: 0.82rem; line-height: 1.45; font-weight: 500; margin-bottom: 18px;
        }

        /* ── Layout ── */
        .sa-layout { display: grid; grid-template-columns: 1fr; gap: 24px; }
        @media (min-width: 900px) {
            .sa-layout { grid-template-columns: 1.45fr 1fr; gap: 0; align-items: start; }
            .sa-panel { padding-right: 32px; }
            .sa-panel-side { padding-right: 0; padding-left: 32px; border-left: 1px solid ${BORDER}; }
        }
        .sa-panel { min-width: 0; }
        @media (max-width: 899px) {
            .sa-panel-side { padding-top: 22px; border-top: 1px solid ${BORDER}; }
        }

        .sa-section-head { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 18px; }
        .sa-section-head-text { min-width: 0; }
        .sa-chip-icon {
            flex-shrink: 0; width: 36px; height: 36px; border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
            background: rgba(185,139,78,0.22); color: ${PRIMARY};
        }
        .sa-section-title { margin: 0; font-size: 1.08rem; font-weight: 600; color: ${PRIMARY_DEEP}; line-height: 1.3; }
        .sa-section-desc { margin: 3px 0 0; color: ${MUTED}; font-size: 0.78rem; line-height: 1.55; }

        /* ── Form ── */
        .sa-grid { display: grid; grid-template-columns: 1fr; gap: 14px; }
        @media (min-width: 640px) {
            .sa-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px 16px; }
            .sa-span2 { grid-column: 1 / -1; }
        }
        .sa-stack { display: flex; flex-direction: column; gap: 14px; }
        .sa-field { min-width: 0; }
        .sa-label { display: block; margin-bottom: 5px; color: ${INK}; font-size: 0.78rem; font-weight: 600; }

        .sa-input {
            display: block; width: 100%; height: 46px; padding: 0 16px;
            border: 1px solid ${BORDER}; border-radius: 12px; background: ${CARD};
            color: ${INK}; font-family: 'Inter', 'Segoe UI', sans-serif; font-size: 0.92rem;
            outline: none; transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }
        .sa-input::placeholder { color: #B7A99E; }
        .sa-input:focus { border-color: ${PRIMARY}; box-shadow: 0 0 0 4px rgba(109,33,64,0.12); }
        .sa-textarea { height: auto; min-height: 92px; padding: 12px 16px; resize: vertical; line-height: 1.5; }
        .sa-select { appearance: auto; padding: 0 12px; }

        .sa-password { position: relative; display: flex; align-items: center; }
        .sa-eye {
            position: absolute; right: 14px; display: flex; background: none; border: none; padding: 0;
            color: ${MUTED}; cursor: pointer; transition: color 0.15s ease;
        }
        .sa-eye:hover { color: ${INK}; }

        .sa-info {
            display: flex; align-items: center; gap: 12px; margin-bottom: 18px;
            padding: 10px 14px; border-radius: 14px; background: ${SAND};
            color: ${INK_SOFT}; font-size: 0.78rem; line-height: 1.5;
        }
        .sa-info p { margin: 0; }
        .sa-info-chip {
            flex-shrink: 0; width: 32px; height: 32px; border-radius: 50%;
            display: flex; align-items: center; justify-content: center; background: rgba(185,139,78,0.22);
        }

        /* ── Submit ── */
        .sa-actions { display: flex; justify-content: flex-end; margin-top: 24px; padding-top: 20px; border-top: 1px solid ${BORDER}; }
        .sa-submit {
            display: inline-flex; align-items: center; justify-content: center; gap: 8px;
            height: 48px; padding: 0 28px; border: none; border-radius: 12px;
            background: linear-gradient(90deg, ${PRIMARY}, ${PRIMARY_DEEP}); color: #fff;
            font-size: 0.94rem; font-weight: 600; cursor: pointer;
            box-shadow: 0 12px 24px -14px rgba(109,33,64,0.6);
            transition: transform 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease;
        }
        .sa-submit:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 16px 28px -14px rgba(74,23,48,0.65); }
        .sa-submit:disabled { opacity: 0.65; cursor: default; }
        @media (max-width: 639px) { .sa-actions .sa-submit, .sa-success .sa-submit { width: 100%; } }

        .sa-spinner {
            width: 16px; height: 16px; border-radius: 50%;
            border: 2px solid rgba(255,255,255,0.35); border-top-color: #fff;
            display: inline-block; animation: sa-spin 0.7s linear infinite;
        }

        .sa-root button:focus-visible { outline: 2px solid ${ACCENT}; outline-offset: 3px; }

        /* ── Success ── */
        .sa-success { text-align: center; display: flex; flex-direction: column; align-items: center; }
        .sa-success-icon {
            width: 56px; height: 56px; border-radius: 50%; margin-bottom: 12px;
            background: linear-gradient(135deg, ${SUCCESS} 0%, #2F6B41 100%);
            display: flex; align-items: center; justify-content: center;
        }
        .sa-file-chip {
            margin: 0 0 12px; padding: 6px 14px; border-radius: 999px;
            border: 1px solid ${BORDER}; background: ${SAND}; color: ${ACCENT_DARK};
            font-size: 0.76rem; font-weight: 600;
        }
        .sa-success .sa-sub { margin-bottom: 22px; max-width: 360px; }

        .sa-year-note {
            font-size: 0.74rem; font-weight: 600; color: #FFFDF9; text-align: center;
            margin: 18px 0 0; line-height: 1.5;
        }

        @media (max-width: 639px) {
            .sa-root {
                background: linear-gradient(170deg, #FFFDF9 0%, #F6E9E1 28%, #B25A78 62%, ${PRIMARY} 85%, ${PRIMARY_DEEP} 100%);
                background-attachment: fixed;
            }
        }

        @media (prefers-reduced-motion: reduce) {
            .sa-card { animation: none; }
            .sa-submit, .sa-input, .sa-eye, .sa-logo-link { transition: none; }
            .sa-submit:hover:not(:disabled) { transform: none; }
        }
    `}</style>
);

export default New;