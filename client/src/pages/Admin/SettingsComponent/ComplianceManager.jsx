import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
    Save, AlertTriangle, Hash, ListChecks, RotateCcw, CheckCircle2,
    FileText, UserX, CalendarClock, BarChart3, Lock,
} from 'lucide-react';
import AdminPageHeader from '../../../components/Admin/AdminPageHeader';

// ── Design tokens — single source of truth for this page ──
const BG = '#F7F4EE';
const SURFACE = '#FFFDF9';
const BORDER = '#E7D8C7';
const PRIMARY = '#6D2140';
const PRIMARY_TINT = 'rgba(109, 33, 64, 0.08)';
const INK = '#241512';
const MUTED = '#8A7A68';
const SUCCESS = '#6B8F71';
const SUCCESS_TINT = 'rgba(107,143,113,.12)';
const WARNING = '#C08A3E';
const DANGER = '#A24A4A';
const DANGER_TINT = 'rgba(162,74,74,.12)';
const BRONZE = '#A9784E';
const RADIUS = 16;

const display = { fontFamily: "'Playfair Display', Georgia, 'Times New Roman', serif" };
const body = { fontFamily: "'Inter', 'Segoe UI', sans-serif" };

const SETTING_FIELDS = [
    { key: 'missed_submission_deduction', label: 'Overdue required document', hint: 'Deduct points for each Admin-assigned document not submitted by its deadline. Late submissions are not accepted.', icon: FileText },
    { key: 'late_duty_deduction', label: 'Late to duty', hint: 'Deduct points each time staff records a scholar as late for duty attendance', icon: CalendarClock },
    { key: 'absent_duty_deduction', label: 'Duty marked absent', hint: 'Flags and deducts points for each duty attendance recorded as absent', icon: UserX },
    { key: 'late_submission_deduction', label: 'No submission for a long time', hint: 'If no submission is recorded for more than 30 days after the last submission or account creation, deduct points. Deduct the same amount every additional 30 days, up to twice the configured amount.', icon: CalendarClock },
    { key: 'quality_drop_deduction', label: 'Low average submission quality', hint: 'Flags and deducts points for each 10-point band below a 50% average quality score', icon: BarChart3 },
];

const RECOVERY_BONUS_FIELDS = [
    { key: 'early_submission_bonus', label: 'Early letter submission', hint: 'Award points when a monthly letter is submitted at least 7 days before month-end.', icon: FileText },
    { key: 'consecutive_early_bonus', label: 'Consecutive early submissions', hint: 'Award points for each additional consecutive month with an early letter.', icon: CalendarClock },
    { key: 'perfect_attendance_bonus', label: 'Perfect duty attendance', hint: 'Award points when all recorded duty attendance is present.', icon: CheckCircle2 },
];

const DEFAULT_SETTINGS = {
    min_compliance: '50',
    missed_submission_deduction: '5',
    late_duty_deduction: '2',
    absent_duty_deduction: '10',
    late_submission_deduction: '10',
    quality_drop_deduction: '5',
    good_maintenance_bonus: '5',
    recovery_enabled: true,
    early_submission_bonus: '0.50',
    consecutive_early_bonus: '1.00',
    perfect_attendance_bonus: '0.50',
    monthly_recovery_cap: '2.00',
};

const cardStyle = { background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: RADIUS };
const labelStyle = { ...body, fontSize: '0.78rem', fontWeight: 600, color: INK, display: 'block', marginBottom: 6 };
const helperStyle = { ...body, fontSize: '0.72rem', color: MUTED, marginTop: 6 };

const Skeleton = ({ style }) => (
    <div className="skeleton-pulse" style={{ background: '#EFE7D8', borderRadius: 8, ...style }} />
);

// ── Small presentational helpers (UI only) ──

const IconBadge = ({ icon: IconEl, size = 40 }) => (
    <span
        className="flex items-center justify-center shrink-0"
        style={{ width: size, height: size, borderRadius: '50%', background: PRIMARY_TINT, color: PRIMARY }}
    >
        <IconEl size={Math.round(size * 0.45)} strokeWidth={2} />
    </span>
);

const CardHeader = ({ icon, title, subtitle, right }) => (
    <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
            <IconBadge icon={icon} />
            <div className="min-w-0">
                <h2 style={{ ...display, fontSize: '1.1rem', fontWeight: 600, color: INK, lineHeight: 1.2 }}>{title}</h2>
                <p style={{ ...body, fontSize: '0.8rem', color: MUTED, marginTop: 2 }}>{subtitle}</p>
            </div>
        </div>
        {right}
    </div>
);

// Input with a unit label inside the box. `variant="field"` = full width, `variant="row"` = compact right-aligned cell.
const UnitInput = ({ id, value, onChange, unit, min, max, step, disabled, text, variant = 'row', ariaLabel }) => (
    <div
        className={`unit-box ${variant === 'row' ? 'unit-row' : ''} flex items-stretch overflow-hidden`}
        style={{
            border: `1px solid ${BORDER}`, borderRadius: 10, background: disabled ? BG : '#fff',
            width: variant === 'row' ? undefined : '100%', opacity: disabled ? 0.6 : 1,
        }}
    >
        <input
            id={id}
            aria-label={ariaLabel}
            type={text ? 'text' : 'number'}
            inputMode={text ? 'decimal' : undefined}
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            style={{ ...body, fontSize: '0.88rem', color: INK, background: 'transparent', border: 'none', outline: 'none', minWidth: 0, flex: 1, padding: '9px 12px', height: 40 }}
        />
        {unit && (
            <span
                className="flex items-center"
                style={{
                    ...body, fontSize: '0.78rem', color: MUTED, padding: '0 12px', whiteSpace: 'nowrap',
                    background: variant === 'row' ? BG : 'transparent', borderLeft: variant === 'row' ? `1px solid ${BORDER}` : 'none',
                }}
            >
                {unit}
            </span>
        )}
    </div>
);

const RuleRow = ({ icon, label, hint, children }) => (
    <div className="rule-row flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" style={{ padding: '14px 4px' }}>
        <div className="flex items-start sm:items-center gap-3 min-w-0">
            <IconBadge icon={icon} size={34} />
            <div className="min-w-0">
                <p style={{ ...body, fontSize: '0.86rem', fontWeight: 600, color: INK }}>{label}</p>
                <p style={{ ...body, fontSize: '0.75rem', color: MUTED, marginTop: 1, lineHeight: 1.5 }}>{hint}</p>
            </div>
        </div>
        <div className="w-full sm:w-auto sm:shrink-0">{children}</div>
    </div>
);

const Switch = ({ checked, onChange, label }) => (
    <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className="shrink-0"
        style={{ width: 44, height: 26, borderRadius: 999, border: 'none', padding: 3, cursor: 'pointer', background: checked ? PRIMARY : '#D9CBB8', transition: 'background .2s ease' }}
    >
        <span style={{ display: 'block', width: 20, height: 20, borderRadius: '50%', background: '#fff', transform: checked ? 'translateX(18px)' : 'translateX(0)', transition: 'transform .2s ease' }} />
    </button>
);

const RiskBar = ({ minimum }) => {
    const parsedMinimum = parseFloat(minimum);
    const score = Number.isFinite(parsedMinimum) ? Math.max(0, Math.min(100, parsedMinimum)) : 50;
    const scoreLabel = score.toFixed(2);
    return (
        <div>
            <div
                role="img"
                aria-label={`High risk below ${scoreLabel} points, medium risk at or above ${scoreLabel} points`}
                className="flex overflow-hidden"
                style={{ height: 10, borderRadius: 999 }}
            >
                <span style={{ width: `${score}%`, background: DANGER }} />
                <span style={{ flex: 1, background: WARNING }} />
            </div>
            <div className="flex justify-between gap-3 mt-1.5" style={{ ...body, fontSize: '0.72rem', color: MUTED }}>
                <span>High risk · below {scoreLabel} points</span>
                <span>Medium risk · {scoreLabel} points and above</span>
            </div>
        </div>
    );
};

const PasswordConfirmDialog = ({ password, onPasswordChange, busy, error, onCancel, onConfirm }) => (
    <div
        className="fixed inset-0 flex items-center justify-center p-4"
        style={{ background: 'rgba(36,21,18,0.45)', zIndex: 60 }}
        onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onCancel(); }}
    >
        <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="compliance-password-title"
            className="w-full"
            onSubmit={onConfirm}
            style={{ maxWidth: 420, background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: RADIUS, padding: 22, boxShadow: '0 12px 32px rgba(74,23,48,0.2)' }}
        >
            <div className="flex items-start gap-3">
                <IconBadge icon={Lock} />
                <div className="min-w-0">
                    <h2 id="compliance-password-title" style={{ ...display, fontSize: '1.1rem', fontWeight: 700, color: INK }}>Confirm your password</h2>
                    <p style={{ ...body, fontSize: '0.78rem', color: MUTED, marginTop: 3 }}>Enter your current password to save compliance settings.</p>
                </div>
            </div>
            <label htmlFor="compliance-current-password" style={{ ...labelStyle, marginTop: 16 }}>Current password</label>
            <input
                id="compliance-current-password"
                type="password"
                autoComplete="current-password"
                autoFocus
                required
                value={password}
                onChange={(e) => onPasswordChange(e.target.value)}
                style={{ ...body, width: '100%', minHeight: 40, padding: '9px 12px', border: `1px solid ${BORDER}`, borderRadius: 10, background: '#fff', color: INK, fontSize: '0.84rem' }}
            />
            {error && <p role="alert" style={{ ...body, color: DANGER, background: DANGER_TINT, borderRadius: 10, padding: '8px 12px', marginTop: 12, fontSize: '0.78rem' }}>{error}</p>}
            <div className="flex justify-end gap-2" style={{ marginTop: 18 }}>
                <button
                    type="button"
                    onClick={onCancel}
                    disabled={busy}
                    style={{ ...body, minHeight: 40, padding: '9px 16px', border: `1px solid ${BORDER}`, borderRadius: 10, background: SURFACE, color: PRIMARY, fontSize: '0.8rem', fontWeight: 600, cursor: busy ? 'wait' : 'pointer' }}
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={busy || !password}
                    style={{ ...body, minHeight: 40, padding: '9px 18px', border: 0, borderRadius: 10, background: PRIMARY, color: '#fff', fontSize: '0.8rem', fontWeight: 700, cursor: busy ? 'wait' : 'pointer', opacity: busy || !password ? 0.6 : 1 }}
                >
                    {busy ? 'Confirming…' : 'Confirm & Save'}
                </button>
            </div>
        </form>
    </div>
);

// `embedded` = rendered inside the Settings page, which already shows the page header and tabs.
const ComplianceManager = ({ embedded = false }) => {
    const [minCompliance, setMinCompliance] = useState(DEFAULT_SETTINGS.min_compliance);
    const [settings, setSettings] = useState(DEFAULT_SETTINGS);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [saved, setSaved] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
    const [currentPassword, setCurrentPassword] = useState('');
    const [passwordError, setPasswordError] = useState('');

    const snapshotRef = useRef(null);
    const pendingPayloadRef = useRef(null);

    const RAW_API = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    const API = RAW_API.replace(/\/+$/, '').replace(/\/api$/, '') + '/api';

    useEffect(() => {
        let mounted = true;
        const fetchSettings = async () => {
            try {
                const token = localStorage.getItem('token');
                const headers = token ? { Authorization: `Bearer ${token}` } : {};
                const res = await axios.get(`${API}/admin/compliance-settings`, { headers });
                if (!mounted) return;

                const nextMin = String(res.data.min_compliance ?? DEFAULT_SETTINGS.min_compliance);
                const nextSettings = {
                    missed_submission_deduction: String(res.data.missed_submission_deduction ?? DEFAULT_SETTINGS.missed_submission_deduction),
                    late_duty_deduction: String(res.data.late_duty_deduction ?? DEFAULT_SETTINGS.late_duty_deduction),
                    absent_duty_deduction: String(res.data.absent_duty_deduction ?? DEFAULT_SETTINGS.absent_duty_deduction),
                    late_submission_deduction: String(res.data.late_submission_deduction ?? DEFAULT_SETTINGS.late_submission_deduction),
                    quality_drop_deduction: String(res.data.quality_drop_deduction ?? DEFAULT_SETTINGS.quality_drop_deduction),
                    recovery_enabled: res.data.recovery_enabled === undefined
                        ? DEFAULT_SETTINGS.recovery_enabled
                        : res.data.recovery_enabled === true || res.data.recovery_enabled === 1
                            || res.data.recovery_enabled === '1' || res.data.recovery_enabled === 'true',
                    early_submission_bonus: String(res.data.early_submission_bonus ?? DEFAULT_SETTINGS.early_submission_bonus),
                    consecutive_early_bonus: String(res.data.consecutive_early_bonus ?? DEFAULT_SETTINGS.consecutive_early_bonus),
                    perfect_attendance_bonus: String(res.data.perfect_attendance_bonus ?? DEFAULT_SETTINGS.perfect_attendance_bonus),
                    monthly_recovery_cap: String(res.data.monthly_recovery_cap ?? DEFAULT_SETTINGS.monthly_recovery_cap),
                };

                setMinCompliance(nextMin);
                setSettings(nextSettings);
                snapshotRef.current = { min: nextMin, settings: nextSettings };
                setDirty(false);
            } catch (e) {
                console.error('Failed to load compliance settings', e);
                setError('Failed to load compliance settings.');
            } finally {
                if (mounted) setLoading(false);
            }
        };
        fetchSettings();
        return () => { mounted = false; };
    }, [API]);

    const markDirty = () => setDirty(true);

    const handleSettingChange = (key, value) => {
        setSettings((prev) => ({ ...prev, [key]: value }));
        markDirty();
    };

    const handleMinComplianceChange = (v) => { setMinCompliance(v); markDirty(); };
    const handleReset = () => {
        if (!snapshotRef.current) return;
        setMinCompliance(snapshotRef.current.min);
        setSettings(snapshotRef.current.settings);
        setError('');
        setDirty(false);
    };

    const buildSavePayload = () => {
        setError('');

        const parsedCompliance = parseFloat(minCompliance);
        if (Number.isNaN(parsedCompliance) || parsedCompliance < 0 || parsedCompliance > 100) {
            setError('Minimum overall compliance must be a number between 0 and 100.');
            return null;
        }

        const parsedSettings = {};
        for (const field of SETTING_FIELDS) {
            const rawValue = settings[field.key];
            const value = field.key === 'quality_drop_deduction'
                ? parseFloat(rawValue)
                : parseInt(rawValue, 10);
            const maxValue = 1000;

            if (Number.isNaN(value) || value < 0 || value > maxValue) {
                setError(`${field.label} must be a non-negative number.`);
                return null;
            }
            parsedSettings[field.key] = value;
        }

        parsedSettings.good_maintenance_bonus = parseInt(settings.good_maintenance_bonus ?? DEFAULT_SETTINGS.good_maintenance_bonus, 10);
        const parsedRecoverySettings = {
            recovery_enabled: Boolean(settings.recovery_enabled),
            early_submission_bonus: parseFloat(settings.early_submission_bonus),
            consecutive_early_bonus: parseFloat(settings.consecutive_early_bonus),
            perfect_attendance_bonus: parseFloat(settings.perfect_attendance_bonus),
            monthly_recovery_cap: parseFloat(settings.monthly_recovery_cap),
        };
        const invalidRecoverySetting = Object.entries(parsedRecoverySettings)
            .filter(([key]) => key !== 'recovery_enabled')
            .find(([, value]) => Number.isNaN(value) || value < 0 || value > 99.99);
        if (invalidRecoverySetting) {
            setError(`${invalidRecoverySetting[0]} must be between 0 and 99.99 points.`);
            return null;
        }

        return {
            min_compliance: parsedCompliance.toFixed(2),
            allowed_missed: 0,
            ...parsedSettings,
            ...parsedRecoverySettings,
        };
    };

    const handleSave = () => {
        const payload = buildSavePayload();
        if (!payload) return;

        pendingPayloadRef.current = payload;
        setCurrentPassword('');
        setPasswordError('');
        setPasswordDialogOpen(true);
    };

    const handleConfirmSave = async (event) => {
        event.preventDefault();
        if (!currentPassword || !pendingPayloadRef.current) return;

        setSaving(true);
        setError('');
        setSaved(false);

        try {
            const token = localStorage.getItem('token');
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            await axios.post(`${API}/admin/compliance-settings`, {
                ...pendingPayloadRef.current,
                currentPassword,
            }, { headers });

            snapshotRef.current = { min: minCompliance, settings };
            setDirty(false);
            setSaved(true);
            setTimeout(() => setSaved(false), 2500);
            setPasswordDialogOpen(false);
            pendingPayloadRef.current = null;
            setCurrentPassword('');
        } catch (e) {
            console.error('Failed to save compliance settings:', e.response?.data?.message || e.message || 'Request failed');
            if (e.response?.status === 401) {
                setCurrentPassword('');
                setPasswordError(e.response.data?.message || 'Incorrect password. Please try again.');
            } else if (e.response?.status === 403) {
                setPasswordError(e.response.data?.message || 'Only administrators can save compliance settings.');
            } else if (e.response && e.response.data && e.response.data.message) {
                setError(e.response.data.message);
                setPasswordDialogOpen(false);
                setCurrentPassword('');
                pendingPayloadRef.current = null;
            } else {
                setError('Failed to save settings.');
                setPasswordDialogOpen(false);
                setCurrentPassword('');
                pendingPayloadRef.current = null;
            }
        } finally {
            setSaving(false);
        }
    };

    const cancelPasswordConfirmation = () => {
        setPasswordDialogOpen(false);
        setCurrentPassword('');
        setPasswordError('');
        pendingPayloadRef.current = null;
    };

    const activeRuleCount = SETTING_FIELDS.length + (settings.recovery_enabled ? RECOVERY_BONUS_FIELDS.length + 1 : 0);
    const minScoreNumber = parseFloat(minCompliance);
    const minScoreLabel = Number.isNaN(minScoreNumber) ? `${minCompliance} points` : `${minScoreNumber.toFixed(2)} points`;
    const riskBandExplanation = 'Low risk is 75+ points, medium risk is 50–74 points, and high risk is below 50 points.';
    const parsedLateDeduction = parseFloat(settings.late_submission_deduction);
    const lateDeductionPoints = Number.isFinite(parsedLateDeduction) ? Math.max(0, parsedLateDeduction) : 10;
    const latePenaltyMaximum = lateDeductionPoints * 2;

    const kpiCards = [
        { key: 'min', label: 'Minimum Score', value: minScoreLabel, icon: Hash },
        { key: 'rules', label: 'Active Policy Rules', value: activeRuleCount, icon: ListChecks },
    ];

    return (
        <section className="min-h-full" style={{ background: embedded ? 'transparent' : BG }}>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;1,600&family=Inter:wght@400;500;600;700&display=swap');

                .unit-box:focus-within { border-color: ${PRIMARY} !important; box-shadow: 0 0 0 3px ${PRIMARY_TINT}; }
                .unit-row { width: 100%; }
                @media (min-width: 640px) { .unit-row { width: 150px; } }

                .skeleton-pulse { animation: exec-pulse 1.4s ease-in-out infinite; }
                @keyframes exec-pulse { 0%, 100% { opacity: 0.55; } 50% { opacity: 1; } }

                .rule-row + .rule-row { border-top: 1px solid ${BORDER}; }
                .rule-row:hover { background: #FBF7EE; }

                .savebar { position: sticky; bottom: 0; z-index: 20; }
                @media (max-width: 1023px) { .savebar { position: static; } }
            `}</style>

            <div
                className={embedded ? 'w-full' : 'w-full px-4 sm:px-6 lg:px-8 pb-14'}
                style={embedded ? { paddingBottom: 16 } : undefined}
            >
                {!embedded && (
                    <AdminPageHeader
                        title="Compliance Settings"
                        description="Configure scholar compliance thresholds, penalty rules, and recovery points."
                    />
                )}
                {error && (
                    <div role="alert" className="mb-5 flex items-start gap-2.5 px-4 py-3" style={{ background: DANGER_TINT, borderRadius: 14 }}>
                        <AlertTriangle size={16} style={{ color: DANGER, marginTop: 1, flexShrink: 0 }} />
                        <span style={{ ...body, fontSize: '0.83rem', color: DANGER }}>{error}</span>
                    </div>
                )}
                {saved && (
                    <div role="status" className="mb-5 flex items-center gap-2.5 px-4 py-3" style={{ background: SUCCESS_TINT, borderRadius: 14 }}>
                        <CheckCircle2 size={16} style={{ color: SUCCESS, flexShrink: 0 }} />
                        <span style={{ ...body, fontSize: '0.83rem', color: SUCCESS }}>Policy saved successfully.</span>
                    </div>
                )}

                {/* ── 1. Summary cards ── */}
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2" style={{ marginBottom: 20 }}>
                    {loading ? (
                        Array.from({ length: kpiCards.length }).map((_, i) => (
                            <div key={i} className="flex items-center gap-4" style={{ ...cardStyle, padding: '16px 20px' }}>
                                <Skeleton style={{ width: 44, height: 44, borderRadius: '50%' }} />
                                <div style={{ flex: 1 }}>
                                    <Skeleton style={{ width: '50%', height: 22 }} />
                                    <Skeleton style={{ width: '70%', height: 10, marginTop: 8 }} />
                                </div>
                            </div>
                        ))
                    ) : (
                        kpiCards.map(({ key, label, value, icon }) => (
                            <div key={key} className="flex items-center gap-4" style={{ ...cardStyle, padding: '16px 20px' }}>
                                <IconBadge icon={icon} size={44} />
                                <div className="min-w-0">
                                    <p style={{ ...display, fontSize: '1.5rem', fontWeight: 700, color: INK, lineHeight: 1.1 }}>{value}</p>
                                    <p style={{ ...body, fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: MUTED, marginTop: 4 }}>
                                        {label}
                                    </p>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {loading ? (
                    <div className="flex flex-col gap-5">
                        {[110, 260, 240].map((h, i) => (
                            <div key={i} style={{ ...cardStyle, padding: 20 }}>
                                <Skeleton style={{ width: 220, height: 16 }} />
                                <Skeleton style={{ width: '100%', height: h - 60, marginTop: 16 }} />
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col gap-5">

                        {/* ── 2. Core requirement + risk bar ── */}
                        <div style={{ ...cardStyle, padding: 20 }}>
                            <CardHeader icon={FileText} title="Core Compliance Requirement" subtitle="The score below which a scholar is treated as high risk." />
                            <div className="grid gap-5 md:grid-cols-[minmax(0,260px)_1fr] items-center" style={{ marginTop: 18 }}>
                                <div>
                                    <label htmlFor="min-compliance" style={labelStyle}>Minimum Compliance Score</label>
                                    <UnitInput id="min-compliance" variant="field" value={minCompliance} onChange={handleMinComplianceChange} unit="points" min="0" max="100" step="0.01" />
                                    <p style={helperStyle}>Minimum overall compliance points</p>
                                </div>
                                <RiskBar minimum={minCompliance} />
                            </div>
                        </div>

                        {/* ── 3. Flagging rules ── */}
                        <div style={{ ...cardStyle, padding: 20 }}>
                            <CardHeader icon={AlertTriangle} title="Flagging Rules" subtitle={`Only scores below ${minScoreLabel} appear in Flagged Scholars.`} />
                            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4" style={{ marginTop: 16 }}>
                                {[
                                    { n: '01', title: 'Score starts at 100', text: 'Penalties lower it. Eligible maintenance credit may offset deductions.' },
                                    { n: '02', title: 'Overdue tasks deduct points', text: 'An overdue task does not create a flag by itself.' },
                                    { n: '03', title: `Below ${minScoreLabel} is flagged`, text: 'Active issues are shown as review details but do not add above-threshold scholars to the list.' },
                                    { n: '04', title: 'Negative sentiment review', text: 'Flag after negative letters in 5 different months or 3 consecutive months within the account year. This does not deduct compliance points.' },
                                ].map((step) => (
                                    <div key={step.n} style={{ background: BG, borderRadius: 12, padding: '14px 16px' }}>
                                        <span style={{ ...display, fontSize: '1.5rem', fontWeight: 600, color: BRONZE, lineHeight: 1 }}>{step.n}</span>
                                        <p style={{ ...body, fontSize: '0.84rem', fontWeight: 600, color: INK, marginTop: 8 }}>{step.title}</p>
                                        <p style={{ ...body, fontSize: '0.76rem', color: MUTED, marginTop: 3, lineHeight: 1.5 }}>{step.text}</p>
                                    </div>
                                ))}
                            </div>
                            <p style={{ ...body, fontSize: '0.76rem', color: MUTED, marginTop: 12, lineHeight: 1.55 }}>
                                {riskBandExplanation} Risk level describes the score band. Flagged Scholars only lists scholars below the configured minimum; active issues appear as details and do not change list eligibility.
                                Overdue tasks, late or absent duty attendance, prolonged gaps between submissions, and low submission quality affect the score. Their settings are in Penalty Rules below. Negative sentiment can trigger a separate review flag, but it does not affect the score.
                            </p>
                        </div>

                        {/* ── 4. Penalty Rules ── */}
                        <div style={{ ...cardStyle, padding: 20 }}>
                            <CardHeader icon={AlertTriangle} title="Penalty Rules" subtitle="Points are deducted for policy violations. Admin-assigned documents are not accepted after their deadline." />
                            <div style={{ marginTop: 14 }}>
                                {SETTING_FIELDS.map(({ key, label, hint, icon, unit }) => {
                                    const ruleHint = key === 'late_submission_deduction'
                                        ? `If no submission is recorded for more than 30 days after the last submission or account creation, deduct ${lateDeductionPoints} points. Deduct another ${lateDeductionPoints} points every additional 30 days, up to ${latePenaltyMaximum} points total.`
                                        : key === 'missed_submission_deduction'
                                            ? `Deduct ${settings.missed_submission_deduction} points for each Admin-assigned document not submitted by its deadline. Late submissions are not accepted.`
                                            : hint;
                                    return (
                                        <RuleRow key={key} icon={icon} label={label} hint={ruleHint}>
                                            <UnitInput
                                                ariaLabel={`${label} ${unit || 'points'}`}
                                                value={settings[key]}
                                                onChange={(v) => handleSettingChange(key, v)}
                                                unit={unit || 'points'}
                                                min="0" max="1000"
                                                step={key === 'quality_drop_deduction' ? '0.1' : '1'}
                                            />
                                        </RuleRow>
                                    );
                                })}
                            </div>
                        </div>

                        {/* ── 5. Recovery Points ── */}
                        <div style={{ ...cardStyle, padding: 20 }}>
                            <CardHeader icon={Hash} title="Recovery Points" subtitle="Configure optional bonus points that can offset compliance deductions." />
                            <div className="flex items-center justify-between gap-4" style={{ marginTop: 18, padding: '12px 4px', borderBottom: `1px solid ${BORDER}` }}>
                                <div className="min-w-0">
                                    <p style={{ ...body, fontSize: '0.86rem', fontWeight: 600, color: INK }}>Enable recovery points</p>
                                    <p style={{ ...body, fontSize: '0.75rem', color: MUTED, marginTop: 2 }}>Award the bonuses below when scholars meet the listed conditions.</p>
                                </div>
                                <Switch
                                    checked={settings.recovery_enabled}
                                    onChange={(value) => handleSettingChange('recovery_enabled', value)}
                                    label="Enable recovery points"
                                />
                            </div>
                            <div style={{ marginTop: 4, opacity: settings.recovery_enabled ? 1 : 0.55 }}>
                                {RECOVERY_BONUS_FIELDS.map(({ key, label, hint, icon }) => (
                                    <RuleRow key={key} icon={icon} label={label} hint={hint}>
                                        <UnitInput
                                            ariaLabel={`${label} points`}
                                            value={settings[key]}
                                            onChange={(v) => handleSettingChange(key, v)}
                                            unit="points"
                                            min="0"
                                            max="99.99"
                                            step="0.01"
                                            disabled={!settings.recovery_enabled}
                                        />
                                    </RuleRow>
                                ))}
                                <RuleRow
                                    icon={ListChecks}
                                    label="Recovery points cap"
                                    hint="Maximum recovery bonus earned per scholar, per calendar month. Earned monthly points accumulate in the current compliance score."
                                >
                                    <UnitInput
                                        ariaLabel="Recovery points cap"
                                        value={settings.monthly_recovery_cap}
                                        onChange={(value) => handleSettingChange('monthly_recovery_cap', value)}
                                        unit="points"
                                        min="0"
                                        max="99.99"
                                        step="0.01"
                                        disabled={!settings.recovery_enabled}
                                    />
                                </RuleRow>
                            </div>
                        </div>

                    </div>
                )}
            </div>

            {/* ── 5. Action bar ── */}
            <div
                className="savebar"
                style={embedded
                    ? { background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: RADIUS }
                    : { background: SURFACE, borderTop: `1px solid ${BORDER}` }}
            >
                <div className="w-full flex flex-wrap items-center justify-between gap-3" style={{ minHeight: 64, padding: embedded ? '10px 20px' : '10px 32px' }}>
                    <div className="flex items-center gap-2">
                        {dirty ? (
                            <>
                                <span style={{ width: 7, height: 7, borderRadius: '50%', background: WARNING, display: 'inline-block' }} />
                                <span style={{ ...body, fontSize: '0.8rem', fontWeight: 600, color: WARNING }}>Unsaved changes</span>
                            </>
                        ) : (
                            <>
                                <CheckCircle2 size={14} style={{ color: SUCCESS }} />
                                <span style={{ ...body, fontSize: '0.8rem', fontWeight: 600, color: MUTED }}>All changes saved</span>
                            </>
                        )}
                    </div>

                    <div className="flex items-center gap-3 ml-auto">
                        <button
                            type="button"
                            onClick={handleReset}
                            disabled={!dirty || saving}
                            className="flex items-center gap-2"
                            style={{
                                ...body, fontSize: '0.82rem', fontWeight: 600, color: dirty ? PRIMARY : MUTED,
                                background: SURFACE, border: `1px solid ${dirty ? PRIMARY : BORDER}`,
                                borderRadius: 10, height: 40, padding: '0 16px',
                                cursor: dirty ? 'pointer' : 'default', opacity: dirty ? 1 : 0.6,
                            }}
                        >
                            <RotateCcw size={14} /> Reset Changes
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={saving || loading}
                            className="flex items-center gap-2"
                            style={{
                                ...body, fontSize: '0.82rem', fontWeight: 700, color: '#fff',
                                background: PRIMARY, border: 'none', borderRadius: 10, height: 40, padding: '0 18px',
                                cursor: saving || loading ? 'wait' : 'pointer', opacity: saving || loading ? 0.7 : 1,
                            }}
                        >
                            <Save size={14} /> {saving ? 'Saving…' : saved ? 'Saved' : 'Save Settings'}
                        </button>
                    </div>
                </div>
            </div>
            {passwordDialogOpen && (
                <PasswordConfirmDialog
                    password={currentPassword}
                    onPasswordChange={(value) => { setCurrentPassword(value); setPasswordError(''); }}
                    busy={saving}
                    error={passwordError}
                    onCancel={cancelPasswordConfirmation}
                    onConfirm={handleConfirmSave}
                />
            )}
        </section>
    );
};

export default ComplianceManager;