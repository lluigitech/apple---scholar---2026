import { useEffect, useState } from 'react';
import axios from 'axios';
import { AlertCircle, ArrowRight, Eye, EyeOff, KeyRound, ShieldCheck, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getEducationStage } from '../utils/educationStage';

const API_BASE = `${(import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '').replace(/\/api$/, '')}/api`;

/* ---------- Apple Scholar design tokens (same as the Scholar Dashboard) ---------- */
const BG = '#F7F4EE';
const SURFACE = '#FFFDF9';
const BORDER = '#E7D8C7';
const PRIMARY = '#6D2140';
const PRIMARY_DEEP = '#4A1730';
const ACCENT = '#7C2D4C';
const BRONZE = '#A9784E';
const BRONZE_LIGHT = '#E4C28F';
const SUCCESS = '#6B8F71';
const DANGER = '#C0473F';
const INK = '#241512';
const MUTED = '#8A7A68';

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
                style={{ paddingRight: 44 }}
            />
            <button
                type="button"
                aria-label={show ? `Hide ${label}` : `Show ${label}`}
                onClick={onToggle}
                className="sa-eye"
            >
                {show ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
        </div>
    </Field>
);

const CardHeading = ({ icon: Icon, title, description }) => (
    <div className="sa-card-head">
        <span className="sa-icon-bubble"><Icon size={20} /></span>
        <div className="sa-card-head-text">
            <h2 className="sa-card-title">{title}</h2>
            <p className="sa-card-desc">{description}</p>
        </div>
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
        <main className="sa-page">
            <GlobalStyle />

            {isComplete ? (
                <div className="sa-success-wrap">
                    <div className="sa-success-card">
                        <span className="sa-success-badge"><ShieldCheck size={34} strokeWidth={1.8} /></span>
                        <span className="sa-verified-pill">Verified</span>
                        <h1 className="sa-heading sa-success-title">Your file is complete.</h1>
                        <p className="sa-file-chip">File No. {fileNo}</p>
                        <p className="sa-success-text">
                            Details are saved to File No. {fileNo}, and the temporary password on record has been replaced.
                        </p>
                        <button type="button" onClick={() => navigate('/scholar', { replace: true })} className="sa-submit">
                            Enter Scholar Portal <ArrowRight size={16} />
                        </button>
                    </div>
                </div>
            ) : (
                <div className="sa-container">
                    {/* ── Hero ── */}
                    <header className="sa-hero">
                        <span className="sa-hero-orb sa-hero-orb-a" aria-hidden="true" />
                        <span className="sa-hero-orb sa-hero-orb-b" aria-hidden="true" />
                        <div className="sa-hero-body">
                            <p className="sa-hero-label">Scholar Portal</p>
                            <h1 className="sa-heading sa-hero-title">Complete Your Scholar File</h1>
                            <p className="sa-hero-text">
                                Confirm your personal and academic information, then replace your temporary password to activate your Scholar Portal access.
                            </p>
                            <div className="sa-chips">
                                <span className="sa-chip">File No. {fileNo}</span>
                                <span className="sa-chip sa-chip-pending"><span className="sa-dot" aria-hidden="true" />Pending Verification</span>
                            </div>
                        </div>
                    </header>

                    {error && (
                        <div role="alert" className="sa-error">
                            <AlertCircle size={18} className="sa-error-icon" />
                            <span>{error}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit}>
                        <div className="sa-layout">
                            {/* ── 01 Personal & Academic ── */}
                            <section className="sa-card sa-card-main" aria-labelledby="section-01">
                                <CardHeading
                                    icon={UserRound}
                                    title={<span id="section-01">01 — Personal &amp; Academic Details</span>}
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
                            <section className="sa-card sa-card-side" aria-labelledby="section-02">
                                <CardHeading
                                    icon={ShieldCheck}
                                    title={<span id="section-02">02 — Security Credentials</span>}
                                    description="Replace the temporary password provided by the administrator with your own secure password."
                                />
                                <div className="sa-info">
                                    <KeyRound size={16} className="sa-info-icon" />
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
                            <button type="submit" disabled={isLoading} className="sa-submit">
                                {isLoading ? 'Filing details...' : 'Save details and continue'} <ArrowRight size={16} />
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </main>
    );
};

/* ---------- Visual system ---------- */
const GlobalStyle = () => (
    <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;1,600&family=Inter:wght@400;500;600;700&display=swap');

        .sa-page {
            min-height: 100vh;
            padding: clamp(16px, 4vw, 48px) clamp(14px, 3vw, 24px);
            background: ${BG};
            color: ${INK};
            font-family: 'Inter', 'Segoe UI', sans-serif;
            display: flex;
            justify-content: center;
            box-sizing: border-box;
            overflow-x: hidden;
        }
        .sa-page *, .sa-page *::before, .sa-page *::after { box-sizing: border-box; }

        .sa-container { width: 100%; max-width: 1040px; display: flex; flex-direction: column; gap: 20px; min-width: 0; }

        .sa-heading { margin: 0; font-family: 'Playfair Display', Georgia, serif; font-weight: 700; line-height: 1.15; letter-spacing: -0.01em; }

        /* ── Hero ── */
        .sa-hero {
            position: relative;
            overflow: hidden;
            border-radius: 20px;
            padding: clamp(24px, 5vw, 44px);
            background: linear-gradient(135deg, ${PRIMARY_DEEP} 0%, ${PRIMARY} 100%);
            color: #fff;
            box-shadow: 0 18px 40px -24px rgba(74, 23, 48, 0.55);
        }
        .sa-hero-orb { position: absolute; border-radius: 50%; pointer-events: none; }
        .sa-hero-orb-a { width: 260px; height: 260px; right: -70px; top: -110px; border: 1px solid rgba(228, 194, 143, 0.35); }
        .sa-hero-orb-b { width: 150px; height: 150px; right: 40px; bottom: -80px; background: rgba(228, 194, 143, 0.12); }
        .sa-hero-body { position: relative; max-width: 620px; }
        .sa-hero-label {
            margin: 0 0 8px;
            color: ${BRONZE_LIGHT};
            font-size: 0.7rem;
            font-weight: 700;
            letter-spacing: 0.2em;
            text-transform: uppercase;
        }
        .sa-hero-title { font-size: clamp(1.7rem, 5vw, 2.5rem); color: #fff; }
        .sa-hero-text { margin: 12px 0 0; color: rgba(255, 255, 255, 0.82); font-size: 0.92rem; line-height: 1.65; }
        .sa-chips { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 20px; }
        .sa-chip {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 7px 14px;
            border-radius: 999px;
            background: rgba(255, 255, 255, 0.12);
            border: 1px solid rgba(255, 255, 255, 0.22);
            color: #fff;
            font-size: 0.74rem;
            font-weight: 600;
        }
        .sa-chip-pending { color: ${BRONZE_LIGHT}; border-color: rgba(228, 194, 143, 0.45); }
        .sa-dot { width: 7px; height: 7px; border-radius: 50%; background: ${BRONZE_LIGHT}; }

        /* ── Error ── */
        .sa-error {
            display: flex;
            align-items: flex-start;
            gap: 10px;
            padding: 13px 16px;
            border-radius: 12px;
            border: 1px solid rgba(192, 71, 63, 0.35);
            border-left: 4px solid ${DANGER};
            background: rgba(192, 71, 63, 0.08);
            color: #8e2f29;
            font-size: 0.84rem;
            font-weight: 500;
            line-height: 1.5;
        }
        .sa-error-icon { flex-shrink: 0; margin-top: 1px; color: ${DANGER}; }

        /* ── Layout ── */
        .sa-layout { display: grid; grid-template-columns: 1fr; gap: 20px; }
        @media (min-width: 900px) {
            .sa-layout { grid-template-columns: 1.45fr 1fr; align-items: start; }
        }

        .sa-card {
            min-width: 0;
            padding: clamp(20px, 3vw, 28px);
            background: ${SURFACE};
            border: 1px solid ${BORDER};
            border-radius: 18px;
            box-shadow: 0 1px 2px rgba(74, 23, 48, 0.04), 0 8px 24px -16px rgba(74, 23, 48, 0.12);
        }

        .sa-card-head { display: flex; align-items: flex-start; gap: 14px; margin-bottom: 22px; }
        .sa-card-head-text { min-width: 0; }
        .sa-icon-bubble {
            flex-shrink: 0;
            width: 42px; height: 42px;
            display: flex; align-items: center; justify-content: center;
            border-radius: 50%;
            background: rgba(109, 33, 64, 0.08);
            color: ${PRIMARY};
        }
        .sa-card-title { margin: 0; font-family: 'Playfair Display', Georgia, serif; font-size: 1.1rem; font-weight: 700; color: ${PRIMARY}; line-height: 1.3; }
        .sa-card-desc { margin: 4px 0 0; color: ${MUTED}; font-size: 0.8rem; line-height: 1.55; }

        /* ── Form ── */
        .sa-grid { display: grid; grid-template-columns: 1fr; gap: 18px; }
        @media (min-width: 640px) {
            .sa-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px 20px; }
            .sa-span2 { grid-column: 1 / -1; }
        }
        .sa-stack { display: flex; flex-direction: column; gap: 18px; }
        .sa-field { min-width: 0; }

        .sa-label { display: block; margin-bottom: 7px; color: ${INK}; font-size: 0.76rem; font-weight: 600; }

        .sa-input {
            display: block;
            width: 100%;
            min-height: 46px;
            padding: 11px 14px;
            border: 1px solid ${BORDER};
            border-radius: 12px;
            background: #fff;
            color: ${INK};
            font-family: 'Inter', 'Segoe UI', sans-serif;
            font-size: 0.88rem;
            outline: none;
            transition: border-color 160ms ease, box-shadow 160ms ease;
        }
        .sa-input:focus { border-color: ${PRIMARY}; box-shadow: 0 0 0 3px rgba(109, 33, 64, 0.12); }
        .sa-textarea { resize: vertical; min-height: 92px; line-height: 1.5; }
        .sa-select { appearance: auto; }

        .sa-password { position: relative; }
        .sa-eye {
            position: absolute; top: 50%; right: 6px; transform: translateY(-50%);
            width: 36px; height: 36px;
            display: flex; align-items: center; justify-content: center;
            border: 0; border-radius: 10px;
            background: transparent; color: ${MUTED}; cursor: pointer;
            transition: background-color 160ms ease, color 160ms ease;
        }
        .sa-eye:hover { background: rgba(109, 33, 64, 0.07); color: ${PRIMARY}; }

        .sa-info {
            display: flex; align-items: flex-start; gap: 10px;
            margin-bottom: 20px;
            padding: 13px 14px;
            border-radius: 12px;
            border: 1px solid ${BORDER};
            background: rgba(169, 120, 78, 0.08);
            color: ${PRIMARY_DEEP};
            font-size: 0.8rem;
            line-height: 1.55;
        }
        .sa-info p { margin: 0; }
        .sa-info-icon { flex-shrink: 0; margin-top: 2px; color: ${BRONZE}; }

        /* ── Submit ── */
        .sa-actions { display: flex; justify-content: flex-end; margin-top: 20px; }
        .sa-submit {
            display: inline-flex; align-items: center; justify-content: center; gap: 9px;
            min-height: 48px;
            padding: 13px 26px;
            border: 0;
            border-radius: 12px;
            background: linear-gradient(120deg, ${PRIMARY}, ${PRIMARY_DEEP});
            color: #fff;
            font-family: 'Inter', 'Segoe UI', sans-serif;
            font-size: 0.86rem;
            font-weight: 600;
            cursor: pointer;
            box-shadow: 0 10px 22px -14px ${PRIMARY};
            transition: transform 160ms ease, box-shadow 160ms ease, opacity 160ms ease;
        }
        .sa-submit:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 14px 26px -14px ${PRIMARY}; }
        .sa-submit:disabled { opacity: 0.6; cursor: not-allowed; }
        @media (max-width: 639px) {
            .sa-actions .sa-submit { width: 100%; }
        }

        .sa-page button:focus-visible,
        .sa-page a:focus-visible { outline: 2px solid ${PRIMARY}; outline-offset: 2px; }

        /* ── Success ── */
        .sa-success-wrap { width: 100%; display: flex; align-items: center; justify-content: center; }
        .sa-success-card {
            width: 100%; max-width: 480px;
            padding: clamp(28px, 6vw, 48px) clamp(20px, 5vw, 40px);
            display: flex; flex-direction: column; align-items: center; text-align: center;
            background: ${SURFACE};
            border: 1px solid ${BORDER};
            border-top: 4px solid ${BRONZE};
            border-radius: 20px;
            box-shadow: 0 1px 2px rgba(74, 23, 48, 0.04), 0 24px 48px -28px rgba(74, 23, 48, 0.3);
        }
        .sa-success-badge {
            width: 76px; height: 76px;
            display: flex; align-items: center; justify-content: center;
            border-radius: 50%;
            background: rgba(107, 143, 113, 0.14);
            border: 1px solid rgba(107, 143, 113, 0.4);
            color: ${SUCCESS};
        }
        .sa-verified-pill {
            margin-top: 16px;
            padding: 5px 14px;
            border-radius: 999px;
            background: rgba(107, 143, 113, 0.14);
            color: #4d7355;
            font-size: 0.7rem;
            font-weight: 700;
            letter-spacing: 0.1em;
            text-transform: uppercase;
        }
        .sa-success-title { margin-top: 16px; font-size: clamp(1.7rem, 5vw, 2.2rem); color: ${PRIMARY}; }
        .sa-file-chip {
            margin: 14px 0 0;
            padding: 6px 14px;
            border-radius: 999px;
            border: 1px solid ${BORDER};
            background: ${BG};
            color: ${BRONZE};
            font-size: 0.76rem;
            font-weight: 600;
        }
        .sa-success-text { margin: 14px 0 26px; color: ${MUTED}; font-size: 0.88rem; line-height: 1.7; max-width: 380px; }

        @media (prefers-reduced-motion: reduce) {
            .sa-submit, .sa-input, .sa-eye { transition: none; }
            .sa-submit:hover:not(:disabled) { transform: none; }
        }
    `}</style>
);

export default New;