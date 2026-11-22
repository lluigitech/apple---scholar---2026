import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import {
  User, Mail, IdCard, ShieldCheck, Lock, KeyRound, Bell,
  SlidersHorizontal, ListFilter, Rows3, Rows2, Eye, EyeOff, CheckCircle2, AlertTriangle, Save, X, Check, Circle,
  Megaphone, ClipboardList, QrCode, FileCheck, Undo2, Activity, RefreshCw,
} from 'lucide-react';
// TODO: i-adjust ang path na ito kung saan talaga naka-define ang API_BASE at authHeaders sa Staff side.
import { API_BASE, authHeaders } from '../../components/Officer/Reports/ReportsHelpers';
import {
  DEFAULT_STAFF_WORK_PREFERENCES,
  readStaffWorkPreferences,
  writeStaffWorkPreferences,
} from '../../utils/staffWorkPreferences';
import { getPasswordRequirementError, hasRequiredPasswordSymbol, isValidPassword, MIN_PASSWORD_LENGTH } from '../../utils/passwordPolicy';

/* ───────── CONTRACT (assumed — i-verify sa backend) ─────────
 * Relative sa API_BASE, gamit ang authHeaders() (Bearer token). Identity galing sa token sa server.
 * GET  /staff/profile -> { full_name, email, staff_id?, role, status? }
 * PUT  /staff/profile body { full_name, email, currentPassword }
 * POST /staff/change-password body { current_password, new_password }
 * POST /staff/settings/verify-password body { currentPassword }
 * GET/PUT /staff/settings/notifications -> { announcements, task_assignments, duty_attendance,
 *          submission_updates, makeup_requests, system_updates } (booleans)
 * Kapag 404/405 ang notifications endpoint -> local-only preferences (localStorage).
 * Work Preferences: browser-only (localStorage).
 */
const PROFILE_PATH = '/staff/profile';
const PASSWORD_PATH = '/staff/change-password';
const NOTIF_PATH = '/staff/settings/notifications';
const VERIFY_PASSWORD_PATH = '/staff/settings/verify-password';
const NOTIF_LOCAL_KEY = 'staff_notification_preferences';
const PROFILE_EDITABLE = true;

// ── Apple Scholar design system — same tokens as Officer Settings ──
const PRIMARY = '#6D2140';
const GOLD = '#A9784E';
const BG = '#F7F4EE';
const SURFACE = '#FFFDF9';
const BORDER = '#E7D8C7';
const INK = '#241512';
const MUTED = '#8A7A68';
const SUCCESS = '#3F8A55';
const WARNING = '#B8863F';
const DANGER = '#C1666B';
const SAND = '#F1E8DA';
const RADIUS = 16;
const SHADOW = '0 12px 28px -20px rgba(36,21,18,0.22)';

const display = { fontFamily: "'Lora', Georgia, 'Times New Roman', serif" };
const sans = { fontFamily: "'Inter', 'Segoe UI', sans-serif" };
const card = { background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: RADIUS, boxShadow: SHADOW };

const NOTIF_EVENTS = [
  { key: 'announcements', label: 'Announcements', note: 'New announcements posted to staff.', icon: Megaphone },
  { key: 'task_assignments', label: 'New Task Assignments', note: 'When a task is assigned to you.', icon: ClipboardList },
  { key: 'duty_attendance', label: 'Duty and Attendance Updates', note: 'Changes to duties and attendance records.', icon: QrCode },
  { key: 'submission_updates', label: 'Submission Updates', note: 'Status changes on scholar submissions.', icon: FileCheck },
  { key: 'makeup_requests', label: 'Compliance or Makeup-Duty Requests', note: 'Requests that need your attention.', icon: Undo2 },
  { key: 'system_updates', label: 'System Updates', note: 'Portal maintenance and feature notices.', icon: Activity },
];
const DEFAULT_NOTIFS = NOTIF_EVENTS.reduce((a, e) => ({ ...a, [e.key]: true }), {});
const loadLocalNotifs = () => {
  try { return { ...DEFAULT_NOTIFS, ...(JSON.parse(localStorage.getItem(NOTIF_LOCAL_KEY)) || {}) }; }
  catch { return DEFAULT_NOTIFS; }
};

const classify = (err) => {
  const status = err?.response?.status;
  const message = err?.response?.data?.message || err?.response?.data?.error || '';
  if (status === 401 || /invalid or expired token|no token provided/i.test(message)) return { kind: 'auth', message: 'Your sign-in session has expired.' };
  if (status === 404 || status === 405) return { kind: 'unsupported', message: 'This feature is not available on the server yet.' };
  return { kind: 'error', message: message || err?.message || 'Something went wrong. Please try again.' };
};

const initialsOf = (name) => String(name || '?').split(/\s+/).filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';

// ── Small UI ──
const inputBase = { ...sans, width: '100%', height: 40, padding: '0 12px 0 36px', border: `1px solid ${BORDER}`, borderRadius: 10, background: SURFACE, fontSize: '0.84rem', color: INK, outline: 'none' };
const primaryBtn = (disabled) => ({ ...sans, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 40, padding: '0 16px', borderRadius: 10, border: 'none', background: PRIMARY, color: '#fff', fontSize: '0.78rem', fontWeight: 700, whiteSpace: 'nowrap', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1 });
const ghostBtn = (disabled) => ({ ...sans, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 40, padding: '0 16px', borderRadius: 10, border: `1px solid ${PRIMARY}`, background: '#fff', color: PRIMARY, fontSize: '0.78rem', fontWeight: 700, whiteSpace: 'nowrap', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1 });
const linkBtn = { ...sans, fontSize: '0.74rem', fontWeight: 700, color: DANGER, background: 'none', border: 'none', textDecoration: 'underline', cursor: 'pointer', minHeight: 32 };

const IconChip = ({ icon: Icon, size = 32, tone = PRIMARY }) => (
  <span className="inline-flex flex-shrink-0 items-center justify-center rounded-full" style={{ width: size, height: size, background: `${tone}12`, color: tone }}>
    <Icon size={Math.round(size * 0.48)} strokeWidth={1.8} />
  </span>
);

const Card = ({ icon, title, description, children, className = '', footer, tone = GOLD }) => (
  <section className={`flex min-w-0 flex-col ${className}`} style={{ ...card, padding: 'clamp(14px, 3vw, 22px)' }}>
    <div className="flex items-start gap-3" style={{ marginBottom: 16 }}>
      <IconChip icon={icon} size={34} tone={tone} />
      <div style={{ minWidth: 0 }}>
        <h2 style={{ ...display, fontSize: '1.08rem', fontWeight: 700, color: INK, lineHeight: 1.25 }}>{title}</h2>
        {description && <p style={{ ...sans, fontSize: '0.76rem', color: MUTED, marginTop: 2 }}>{description}</p>}
      </div>
    </div>
    <div className="flex-1">{children}</div>
    {footer && (
      <div className="grid grid-cols-2 gap-2.5 sm:flex sm:flex-wrap sm:items-center sm:justify-end" style={{ marginTop: 18, paddingTop: 16, borderTop: `1px solid ${BORDER}` }}>
        {footer}
      </div>
    )}
  </section>
);

const Label = ({ htmlFor, children }) => (
  <label htmlFor={htmlFor} style={{ ...sans, display: 'block', fontSize: '0.7rem', fontWeight: 600, color: MUTED, marginBottom: 6 }}>{children}</label>
);

const IconInput = ({ id, icon: Icon, label, readOnly, error, children, ...rest }) => (
  <div style={{ minWidth: 0 }}>
    <Label htmlFor={id}>{label}</Label>
    <div style={{ position: 'relative' }}>
      <Icon size={15} style={{ position: 'absolute', left: 12, top: 12.5, color: '#B8A999', pointerEvents: 'none' }} />
      {children || (
        <input id={id} className="ss-field" readOnly={readOnly} {...rest}
          style={{ ...inputBase, background: readOnly ? BG : SURFACE, color: readOnly ? MUTED : INK, borderColor: error ? `${DANGER}99` : BORDER, paddingRight: readOnly ? 34 : 12, textTransform: readOnly && id === 'ss-role' ? 'capitalize' : undefined }} aria-invalid={!!error} />
      )}
      {readOnly && <Lock size={13} style={{ position: 'absolute', right: 12, top: 13.5, color: '#B8A999' }} aria-label="Read-only" />}
    </div>
    {error && <p style={{ ...sans, fontSize: '0.7rem', color: DANGER, marginTop: 4 }}>{error}</p>}
  </div>
);

const SelectInput = ({ id, icon, label, value, onChange, options, disabled }) => (
  <IconInput id={id} icon={icon} label={label}>
    <select id={id} className="ss-field" value={value} onChange={onChange} disabled={disabled} style={{ ...inputBase, cursor: 'pointer' }}>
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  </IconInput>
);

const Banner = ({ tone, children, action }) => {
  const color = tone === 'success' ? SUCCESS : tone === 'warn' ? WARNING : DANGER;
  const Icon = tone === 'success' ? CheckCircle2 : AlertTriangle;
  return (
    <div role={tone === 'success' ? 'status' : 'alert'} className="flex items-center justify-between gap-3"
      style={{ borderLeft: `3px solid ${color}`, background: `${color}0d`, borderRadius: 12, padding: '10px 14px', ...sans, fontSize: '0.78rem', fontWeight: 600, color }}>
      <span className="flex items-start gap-2"><Icon size={14} className="flex-shrink-0" style={{ marginTop: 2 }} /><span>{children}</span></span>
      {action}
    </div>
  );
};

const Toggle = ({ checked, onChange, label, disabled }) => (
  <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)} className="ss-toggle"
    style={{ width: 44, height: 26, borderRadius: 999, border: 'none', padding: 3, background: checked ? PRIMARY : BORDER, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1, transition: 'background 120ms', flexShrink: 0 }}>
    <span style={{ display: 'block', width: 20, height: 20, borderRadius: '50%', background: '#fff', transform: checked ? 'translateX(18px)' : 'translateX(0)', transition: 'transform 120ms', boxShadow: '0 1px 2px rgba(0,0,0,.25)' }} />
  </button>
);

const skeletons = (n, h) => <div className="space-y-3">{Array.from({ length: n }).map((_, i) => <div key={i} className="animate-pulse" style={{ height: h, borderRadius: 10, background: '#EFE6D8' }} />)}</div>;

// ─────────────────────────────────────────────────────────────
const StaffSettings = () => {
  const navigate = useNavigate();
  const [initialWorkPreferences] = useState(() => {
    try {
      return { preferences: readStaffWorkPreferences(), error: '' };
    } catch (error) {
      console.error('Failed to read Staff work preferences:', error);
      return {
        preferences: { ...DEFAULT_STAFF_WORK_PREFERENCES },
        error: 'Saved work preferences could not be loaded from this browser. Check browser storage, then save your preferences again.',
      };
    }
  });

  const [authExpired, setAuthExpired] = useState(false);
  const signInAgain = () => {
    ['token', 'role', 'name', 'email', 'id', 'must_change_password'].forEach(k => localStorage.removeItem(k));
    navigate('/login', { replace: true });
  };

  // ── Profile ──
  const [profile, setProfile] = useState(null);
  const [profileState, setProfileState] = useState('loading');
  const [profileMsg, setProfileMsg] = useState('');
  const [draft, setDraft] = useState({ full_name: '', email: '' });
  const canEdit = PROFILE_EDITABLE;

  const loadProfile = useCallback(async () => {
    setProfileState('loading'); setProfileMsg('');
    try {
      const res = await axios.get(`${API_BASE}${PROFILE_PATH}`, authHeaders());
      const data = res.data || {};
      setProfile(data);
      setDraft({ full_name: data.full_name || '', email: data.email || '' });
      setProfileState('ready');
    } catch (e) {
      const c = classify(e);
      if (c.kind === 'auth') setAuthExpired(true);
      setProfileState(c.kind === 'unsupported' ? 'unsupported' : 'error'); setProfileMsg(c.message);
    }
  }, []);

  const profileDirty = !!profile && (draft.full_name !== (profile.full_name || '') || draft.email !== (profile.email || ''));
  const emailValid = /^\S+@\S+\.\S+$/.test(draft.email.trim());
  const profileValid = draft.full_name.trim().length > 0 && emailValid;

  // ── Password change modal ──
  const [pwOpen, setPwOpen] = useState(false);
  const [pwDone, setPwDone] = useState(false);
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [showPw, setShowPw] = useState({ current: false, next: false, confirm: false });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwFeedback, setPwFeedback] = useState(null);

  const checks = useMemo(() => ([
    { label: `At least ${MIN_PASSWORD_LENGTH} characters`, ok: pw.next.length >= MIN_PASSWORD_LENGTH, required: true },
    { label: 'Upper and lowercase letters', ok: /[a-z]/.test(pw.next) && /[A-Z]/.test(pw.next) },
    { label: 'At least one number', ok: /\d/.test(pw.next) },
    { label: 'At least one symbol', ok: hasRequiredPasswordSymbol(pw.next), required: true },
  ]), [pw.next]);
  const strength = pw.next ? Math.max(1, checks.filter(c => c.ok).length) : 0;
  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong'][strength];

  const pwErrors = {
    next: pw.next ? getPasswordRequirementError(pw.next) || (pw.next === pw.current ? 'New password must differ from the current one.' : '') : '',
    confirm: pw.confirm && pw.confirm !== pw.next ? 'Passwords do not match.' : '',
  };
  const pwReady = !!pw.current && isValidPassword(pw.next) && pw.next === pw.confirm && pw.next !== pw.current;

  const closePw = useCallback(() => {
    if (pwSaving) return;
    setPwOpen(false); setPw({ current: '', next: '', confirm: '' }); setShowPw({ current: false, next: false, confirm: false }); setPwFeedback(null);
  }, [pwSaving]);

  const savePassword = async () => {
    if (!pwReady || pwSaving) return;
    setPwSaving(true); setPwFeedback(null);
    try {
      await axios.post(`${API_BASE}${PASSWORD_PATH}`, { current_password: pw.current, new_password: pw.next }, authHeaders());
      setPw({ current: '', next: '', confirm: '' });
      setShowPw({ current: false, next: false, confirm: false });
      setPwOpen(false); setPwDone(true);
    } catch (e) {
      const c = classify(e);
      if (c.kind === 'auth') setAuthExpired(true);
      setPwFeedback({ tone: c.kind === 'unsupported' ? 'warn' : 'error', text: c.kind === 'unsupported' ? `${c.message} The change-password endpoint still needs to be added.` : c.message });
    } finally { setPwSaving(false); }
  };

  // ── Notifications ──
  const [notifSaved, setNotifSaved] = useState(null);
  const [notifDraft, setNotifDraft] = useState(null);
  const [notifState, setNotifState] = useState('loading');
  const [notifLocal, setNotifLocal] = useState(false);
  const [notifMsg, setNotifMsg] = useState('');

  const loadNotifs = useCallback(async () => {
    setNotifState('loading'); setNotifMsg('');
    try {
      const res = await axios.get(`${API_BASE}${NOTIF_PATH}`, authHeaders());
      const data = NOTIF_EVENTS.reduce((acc, ev) => ({ ...acc, [ev.key]: !!res.data?.[ev.key] }), {});
      setNotifLocal(false); setNotifSaved(data); setNotifDraft(data); setNotifState('ready');
    } catch (e) {
      const c = classify(e);
      if (c.kind === 'auth') setAuthExpired(true);
      if (c.kind === 'unsupported') { // walang server endpoint -> local UI preferences
        const data = loadLocalNotifs();
        setNotifLocal(true); setNotifSaved(data); setNotifDraft(data); setNotifState('ready');
      } else { setNotifState('error'); setNotifMsg(c.message); }
    }
  }, []);
  const notifDirty = !!notifSaved && NOTIF_EVENTS.some(ev => notifDraft?.[ev.key] !== notifSaved[ev.key]);

  // ── Work preferences (browser-only) ──
  const [workSaved, setWorkSaved] = useState(initialWorkPreferences.preferences);
  const [workDraft, setWorkDraft] = useState(() => ({ ...initialWorkPreferences.preferences }));
  const [workStorageError, setWorkStorageError] = useState(initialWorkPreferences.error);
  const workDirty = Object.keys(DEFAULT_STAFF_WORK_PREFERENCES).some(key => workDraft[key] !== workSaved[key]);

  // ── One save for every section ──
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsFeedback, setSettingsFeedback] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [confirmError, setConfirmError] = useState('');
  const [confirmBusy, setConfirmBusy] = useState(false);

  const settingsDirty = (canEdit && profileDirty) || notifDirty || workDirty;
  const cannotSave = (profileDirty && !profileValid) || settingsSaving || confirmBusy;
  const resetAllSettings = () => {
    if (profile) setDraft({ full_name: profile.full_name || '', email: profile.email || '' });
    setWorkDraft(workSaved);
    if (notifSaved) setNotifDraft(notifSaved);
    setSettingsFeedback(null);
  };

  const saveSettings = async (currentPassword) => {
    if (settingsSaving || !settingsDirty || (profileDirty && !profileValid)) return;
    setSettingsSaving(true);
    setSettingsFeedback(null);

    const profileDraft = { full_name: draft.full_name.trim(), email: draft.email.trim() };
    const notificationDraft = notifDraft ? { ...notifDraft } : null;
    const workPreferencesDraft = { ...workDraft };
    const tasks = [];
    if (canEdit && profileDirty) {
      tasks.push({
        key: 'profile',
        save: () => axios.put(`${API_BASE}${PROFILE_PATH}`, { ...profileDraft, currentPassword }, authHeaders()),
      });
    }
    if (notifDirty && notificationDraft) {
      tasks.push({
        key: 'notifications',
        save: () => notifLocal
          ? Promise.resolve(localStorage.setItem(NOTIF_LOCAL_KEY, JSON.stringify(notificationDraft)))
          : axios.put(`${API_BASE}${NOTIF_PATH}`, { ...notificationDraft, currentPassword }, authHeaders()),
      });
    }
    if (workDirty) {
      tasks.push({
        key: 'work',
        save: () => Promise.resolve(writeStaffWorkPreferences(workPreferencesDraft)),
      });
    }

    try {
      const outcomes = await Promise.all(tasks.map(async task => {
        try {
          return { key: task.key, response: await task.save() };
        } catch (error) {
          return { key: task.key, error };
        }
      }));

      const labelFor = key => ({ profile: 'Profile', notifications: 'Notification preferences', work: 'Work preferences' }[key]);
      const failures = [];
      outcomes.forEach(outcome => {
        if (outcome.error) {
          const classified = classify(outcome.error);
          if (classified.kind === 'auth') setAuthExpired(true);
          failures.push(`${labelFor(outcome.key)}: ${classified.message}`);
          return;
        }

        if (outcome.key === 'profile') {
          const next = {
            ...profile,
            ...profileDraft,
            ...(outcome.response.data && typeof outcome.response.data === 'object' ? outcome.response.data : {}),
          };
          setProfile(next);
          setDraft({ full_name: next.full_name || '', email: next.email || '' });
        } else if (outcome.key === 'notifications') {
          setNotifSaved(notificationDraft);
        } else {
          setWorkSaved(workPreferencesDraft);
          setWorkStorageError('');
        }
      });

      if (failures.length) {
        const successful = outcomes.filter(outcome => !outcome.error).map(outcome => labelFor(outcome.key));
        const failureMessage = failures.join(' ');
        setSettingsFeedback({
          tone: 'error',
          text: `${successful.length ? `${successful.join(' and ')} saved. ` : ''}${failureMessage}`,
        });
        setConfirmError(failureMessage);
      } else {
        setSettingsFeedback({
          tone: 'success',
          text: tasks.every(task => task.key === 'work' || (task.key === 'notifications' && notifLocal))
            ? 'Settings saved on this browser.'
            : 'Settings saved.',
        });
      }
      return failures.length === 0;
    } finally {
      setSettingsSaving(false);
    }
  };

  const closeSettingsConfirmation = useCallback(() => {
    if (confirmBusy) return;
    setConfirmOpen(false);
    setConfirmPassword('');
    setConfirmError('');
  }, [confirmBusy]);

  const confirmSettingsSave = async (event) => {
    event.preventDefault();
    if (!confirmPassword || confirmBusy) return;
    setConfirmBusy(true);
    setConfirmError('');
    try {
      await axios.post(`${API_BASE}${VERIFY_PASSWORD_PATH}`, { currentPassword: confirmPassword }, authHeaders());
      const saved = await saveSettings(confirmPassword);
      if (saved) {
        setConfirmOpen(false);
        setConfirmPassword('');
      }
    } catch (error) {
      const message = error.response?.data?.error || 'Unable to verify your current password. Please try again.';
      if (error.response?.status === 401 && /invalid or expired token|no token provided/i.test(message)) setAuthExpired(true);
      setConfirmError(message);
    } finally {
      setConfirmBusy(false);
    }
  };

  useEffect(() => {
    if (!confirmOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') closeSettingsConfirmation(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirmOpen, closeSettingsConfirmation]);

  useEffect(() => {
    if (!pwOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') closePw(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pwOpen, closePw]);

  useEffect(() => { loadProfile(); loadNotifs(); }, [loadProfile, loadNotifs]);

  const densityOptions = [
    { key: 'comfortable', title: 'Comfortable', note: 'Default spacing', icon: Rows3 },
    { key: 'compact', title: 'Compact', note: 'Tighter spacing', icon: Rows2 },
  ];

  const pwInput = (k, id, label, autoComplete, error) => (
    <IconInput id={id} icon={Lock} label={label} error={error}>
      <input id={id} className="ss-field" type={showPw[k] ? 'text' : 'password'} autoComplete={autoComplete} value={pw[k]}
        onChange={e => { setPw(p => ({ ...p, [k]: e.target.value })); setPwFeedback(null); }}
        style={{ ...inputBase, paddingRight: 44, borderColor: error ? `${DANGER}99` : BORDER }} aria-invalid={!!error} />
      <button type="button" onClick={() => setShowPw(s => ({ ...s, [k]: !s[k] }))} aria-label={showPw[k] ? `Hide ${label}` : `Show ${label}`} className="ss-btn"
        style={{ position: 'absolute', right: 4, top: 0, height: 40, width: 38, background: 'none', border: 'none', cursor: 'pointer', color: MUTED }}>
        {showPw[k] ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </IconInput>
  );

  const unsupported = (msg, what) => <Banner tone="warn">{msg} The {what} endpoint still needs to be added.</Banner>;

  const displayName = profile?.full_name || localStorage.getItem('name') || 'Staff';

  return (
    <div className="ss-page" style={{ background: BG, ...sans }}>
      <style>{`
        .ss-page { width: 100%; min-height: 100vh; overflow-x: hidden; box-sizing: border-box; padding: 16px 16px 48px; }
        @media (min-width: 640px) { .ss-page { padding: 24px 24px 48px; } }
        @media (min-width: 1024px) { .ss-page { padding: 32px 32px 48px; } }

        .ss-field:focus { border-color: ${PRIMARY} !important; box-shadow: 0 0 0 3px rgba(109,33,64,.10); }
        .ss-btn:focus-visible, .ss-opt:focus-visible, .ss-toggle:focus-visible { outline: 2px solid ${GOLD}; outline-offset: 2px; }
        .ss-opt { transition: background-color 150ms ease; }
        .ss-opt:hover { background: ${SAND}; }
        .ss-nrow { border-top: 1px solid ${BORDER}; }
        .ss-nrow:first-child { border-top: none; }
        @media (min-width: 1024px) { .ss-nrow:nth-child(2) { border-top: none; } }

        .ss-sheet { border-radius: 20px 20px 0 0; }
        @media (min-width: 640px) { .ss-sheet { border-radius: 16px; } }

        @media (max-width: 639px) {
          /* 16px prevents iOS Safari from zooming in when a field is focused */
          .ss-field { font-size: 16px !important; height: 44px !important; }
          .ss-btn { min-height: 44px !important; }
        }
        @media (prefers-reduced-motion: reduce) { .ss-page * { transition: none !important; } }
      `}</style>

      <div className="flex flex-col gap-5" style={{ minWidth: 0 }}>

        {/* ── Page header — same layout as the other portal pages ── */}
        <header
          className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"
          style={{ ...card, padding: 'clamp(14px, 3vw, 20px)' }}
        >
          <div className="min-w-0">
            <p style={{ ...sans, fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: GOLD }}>Staff Portal</p>
            <h1 style={{ ...display, fontSize: 'clamp(1.6rem, 4vw, 2rem)', fontWeight: 700, color: PRIMARY, lineHeight: 1.15, marginTop: 3 }}>Settings</h1>
            <p style={{ ...sans, fontSize: '0.9rem', color: MUTED, marginTop: 6, lineHeight: 1.55 }}>Manage your account, security, notifications, and work preferences.</p>
          </div>
        </header>

        {authExpired && (
          <Banner tone="error" action={<button onClick={signInAgain} className="ss-btn" style={linkBtn}>Sign in again</button>}>
            Your sign-in session has expired or is invalid.
          </Banner>
        )}
        {pwDone && <Banner tone="success" action={<button onClick={() => setPwDone(false)} className="ss-btn" style={{ ...linkBtn, color: SUCCESS }}>Dismiss</button>}>Password updated.</Banner>}

        {/* ── Row 1: Staff Profile + Work Preferences ── */}
        <div className="grid grid-cols-1 items-stretch gap-5 lg:grid-cols-2">
          <Card icon={User} title="Staff Profile" description={canEdit ? 'Update your name and email.' : 'Your account information.'}>
            {profileState === 'loading' && skeletons(3, 44)}
            {profileState === 'unsupported' && unsupported(profileMsg, 'profile')}
            {profileState === 'error' && <Banner tone="error" action={<button onClick={loadProfile} className="ss-btn" style={linkBtn}>Retry</button>}>{profileMsg}</Banner>}
            {profileState === 'ready' && (
              <div className="flex flex-col gap-4">
                {/* Identity strip */}
                <div className="flex items-center gap-3.5" style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '12px 14px' }}>
                  <span className="flex flex-shrink-0 items-center justify-center rounded-full" style={{ width: 46, height: 46, background: PRIMARY, color: '#fff', ...display, fontSize: '1rem', fontWeight: 700 }}>
                    {initialsOf(displayName)}
                  </span>
                  <div className="min-w-0">
                    <p style={{ ...display, fontSize: '1rem', fontWeight: 700, color: INK, lineHeight: 1.25, overflowWrap: 'anywhere' }}>{displayName}</p>
                    <span className="mt-1 inline-flex items-center gap-1.5 capitalize" style={{ ...sans, fontSize: '0.66rem', fontWeight: 700, color: PRIMARY, background: `${PRIMARY}12`, border: `1px solid ${PRIMARY}30`, borderRadius: 999, padding: '2px 9px' }}>
                      <ShieldCheck size={11} /> {profile?.role || 'Staff'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                  <IconInput id="ss-name" icon={User} label="Display name" readOnly={!canEdit} disabled={settingsSaving}
                    value={canEdit ? draft.full_name : (profile?.full_name || '—')}
                    onChange={e => { setDraft(d => ({ ...d, full_name: e.target.value })); setSettingsFeedback(null); }}
                    autoComplete="name" error={canEdit && !draft.full_name.trim() ? 'Name is required.' : ''} />
                  <IconInput id="ss-email" icon={Mail} label="Email address" type="email" readOnly={!canEdit} disabled={settingsSaving}
                    value={canEdit ? draft.email : (profile?.email || '—')}
                    onChange={e => { setDraft(d => ({ ...d, email: e.target.value })); setSettingsFeedback(null); }}
                    autoComplete="email" error={canEdit && draft.email && !emailValid ? 'Enter a valid email address.' : ''} />
                  <IconInput id="ss-role" icon={ShieldCheck} label="Role" readOnly value={profile?.role || '—'} />
                  <IconInput id="ss-staff-id" icon={IdCard} label="Staff ID" readOnly value={profile?.staff_id || '—'} />
                  {profile?.status && (
                    <div className="sm:col-span-2">
                      <IconInput id="ss-status" icon={CheckCircle2} label="Account status" readOnly value={profile.status} />
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between" style={{ borderTop: `1px solid ${BORDER}` }}>
                  <div className="flex min-w-0 items-center gap-3">
                    <IconChip icon={KeyRound} tone={GOLD} />
                    <div style={{ minWidth: 0 }}>
                      <p style={{ ...sans, fontSize: '0.84rem', fontWeight: 700, color: INK }}>Password</p>
                      <p style={{ ...sans, fontSize: '0.72rem', color: MUTED }}>Change the password you use to log in.</p>
                    </div>
                  </div>
                  <button type="button" className="ss-btn flex-shrink-0" onClick={() => { setPwOpen(true); setPwFeedback(null); }} style={ghostBtn(false)}><KeyRound size={14} /> Change Password</button>
                </div>
              </div>
            )}
          </Card>

          <Card icon={SlidersHorizontal} title="Work Preferences" description="Default attendance report view. Saved on this browser only.">
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                <SelectInput id="ss-work-status" icon={ListFilter} label="Default attendance status" value={workDraft.attendanceStatus} disabled={settingsSaving}
                  onChange={e => { setWorkDraft(d => ({ ...d, attendanceStatus: e.target.value })); setSettingsFeedback(null); }}
                  options={[['all', 'All statuses'], ['present', 'Present'], ['late', 'Late'], ['absent', 'Absent']]} />
                <SelectInput id="ss-work-page-size" icon={Rows3} label="Default page size" value={workDraft.pageSize} disabled={settingsSaving}
                  onChange={e => { setWorkDraft(d => ({ ...d, pageSize: Number(e.target.value) })); setSettingsFeedback(null); }}
                  options={[10, 20, 50].map(n => [n, `${n} rows`])} />
              </div>

              <div>
                <Label>Table density</Label>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2" role="radiogroup" aria-label="Table density">
                  {densityOptions.map(o => {
                    const active = workDraft.density === o.key;
                    return (
                      <button key={o.key} type="button" role="radio" aria-checked={active} disabled={settingsSaving}
                        onClick={() => { setWorkDraft(d => ({ ...d, density: o.key })); setSettingsFeedback(null); }} className="ss-opt flex items-center gap-3 text-left"
                        style={{ padding: '10px 12px', minHeight: 56, borderRadius: 12, cursor: 'pointer', background: active ? `${PRIMARY}0d` : SURFACE, border: `1.5px solid ${active ? PRIMARY : BORDER}` }}>
                        <IconChip icon={o.icon} />
                        <span style={{ minWidth: 0 }}>
                          <span className="block" style={{ ...sans, fontSize: '0.82rem', fontWeight: 700, color: active ? PRIMARY : INK }}>{o.title}</span>
                          <span className="block" style={{ ...sans, fontSize: '0.7rem', color: MUTED }}>{o.note}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
              {workStorageError && <Banner tone="error">{workStorageError}</Banner>}
            </div>
          </Card>
        </div>

        {/* ── Row 2: Notifications ── */}
        <Card icon={Bell} title="Notifications"
          description={notifLocal ? 'Saved on this browser only. These are UI preferences, not email, SMS, or push subscriptions.' : 'Choose which staff events notify you in the portal.'}>
          {notifState === 'loading' && skeletons(4, 52)}
          {notifState === 'error' && <Banner tone="error" action={<button onClick={loadNotifs} className="ss-btn" style={linkBtn}><RefreshCw size={12} style={{ display: 'inline', marginRight: 4 }} />Retry</button>}>{notifMsg}</Banner>}
          {notifState === 'ready' && (
            <div className="grid grid-cols-1 gap-x-10 lg:grid-cols-2">
              {NOTIF_EVENTS.map(ev => (
                <div key={ev.key} className="ss-nrow flex items-center gap-3 py-3">
                  <IconChip icon={ev.icon} />
                  <div className="flex-1" style={{ minWidth: 0 }}>
                    <p style={{ ...sans, fontSize: '0.84rem', fontWeight: 700, color: INK }}>{ev.label}</p>
                    <p style={{ ...sans, fontSize: '0.72rem', color: MUTED, marginTop: 1 }}>{ev.note}</p>
                  </div>
                  <Toggle checked={!!notifDraft?.[ev.key]} disabled={settingsSaving} label={ev.label} onChange={v => { setNotifDraft(d => ({ ...d, [ev.key]: v })); setSettingsFeedback(null); }} />
                </div>
              ))}
            </div>
          )}
        </Card>

        {settingsFeedback && <Banner tone={settingsFeedback.tone}>{settingsFeedback.text}</Banner>}

        {/* ── Sticky actions ── */}
        <div role="region" aria-label="Settings actions" className="flex justify-end"
          style={{ position: 'sticky', bottom: 16, zIndex: 20, ...card, padding: '12px 16px', boxShadow: '0 16px 36px -16px rgba(36,21,18,0.35)' }}>
          <div className="grid w-full grid-cols-2 gap-2.5 sm:flex sm:w-auto sm:items-center">
            <button type="button" className="ss-btn" onClick={resetAllSettings} disabled={!settingsDirty || settingsSaving || confirmBusy} style={ghostBtn(!settingsDirty || settingsSaving || confirmBusy)}>Reset Changes</button>
            <button type="button" className="ss-btn" onClick={() => { setConfirmOpen(true); setConfirmPassword(''); setConfirmError(''); }} disabled={!settingsDirty || cannotSave} style={primaryBtn(!settingsDirty || cannotSave)}>
              <Save size={14} /> {settingsSaving ? 'Saving…' : 'Save Settings'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Confirm password modal ── */}
      {confirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4"
          style={{ background: 'rgba(36,21,18,0.55)' }}
          onMouseDown={event => { if (event.target === event.currentTarget) closeSettingsConfirmation(); }}
        >
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="ss-confirm-title"
            onSubmit={confirmSettingsSave}
            className="ss-sheet w-full"
            style={{ background: SURFACE, border: `1px solid ${BORDER}`, maxWidth: 440, padding: 20, paddingBottom: 'max(20px, env(safe-area-inset-bottom))', boxShadow: '0 28px 60px -24px rgba(36,21,18,0.5)' }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <IconChip icon={Lock} size={36} tone={GOLD} />
                <div>
                  <h2 id="ss-confirm-title" style={{ ...display, fontSize: '1.1rem', fontWeight: 700, color: PRIMARY }}>Confirm your password</h2>
                  <p style={{ ...sans, fontSize: '0.76rem', color: MUTED, marginTop: 2 }}>Enter your current password to save these settings.</p>
                </div>
              </div>
              <button type="button" onClick={closeSettingsConfirmation} disabled={confirmBusy} aria-label="Close" className="ss-btn flex-shrink-0" style={{ ...ghostBtn(confirmBusy), padding: 0, width: 40, borderColor: BORDER, color: MUTED }}><X size={15} /></button>
            </div>
            <div style={{ marginTop: 16 }}>
              <IconInput id="ss-confirm-current-password" icon={Lock} label="Current password">
                <input
                  id="ss-confirm-current-password"
                  className="ss-field"
                  type="password"
                  autoComplete="current-password"
                  autoFocus
                  required
                  value={confirmPassword}
                  onChange={event => { setConfirmPassword(event.target.value); setConfirmError(''); }}
                  style={inputBase}
                />
              </IconInput>
            </div>
            {confirmError && <div style={{ marginTop: 12 }}><Banner tone="error">{confirmError}</Banner></div>}
            <div className="grid grid-cols-2 gap-2.5 sm:flex sm:justify-end" style={{ marginTop: 18 }}>
              <button type="button" onClick={closeSettingsConfirmation} disabled={confirmBusy} className="ss-btn" style={ghostBtn(confirmBusy)}>Cancel</button>
              <button type="submit" disabled={confirmBusy || !confirmPassword} className="ss-btn" style={primaryBtn(confirmBusy || !confirmPassword)}>
                {confirmBusy ? 'Confirming…' : 'Confirm & Save'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Change Password modal ── */}
      {pwOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" style={{ background: 'rgba(36,21,18,0.55)' }} onClick={closePw}>
          <div role="dialog" aria-modal="true" aria-labelledby="ss-pw-title" onClick={e => e.stopPropagation()} className="ss-sheet flex w-full flex-col"
            style={{ background: SURFACE, border: `1px solid ${BORDER}`, maxWidth: 460, maxHeight: '92vh', overflow: 'hidden', boxShadow: '0 28px 60px -24px rgba(36,21,18,0.5)' }}>
            <div className="flex flex-shrink-0 items-start justify-between gap-3" style={{ padding: '18px 20px', borderBottom: `1px solid ${BORDER}` }}>
              <div className="flex items-start gap-3">
                <IconChip icon={KeyRound} size={36} tone={GOLD} />
                <div>
                  <h2 id="ss-pw-title" style={{ ...display, fontSize: '1.1rem', fontWeight: 700, color: PRIMARY }}>Change Password</h2>
                  <p style={{ ...sans, fontSize: '0.76rem', color: MUTED, marginTop: 2 }}>Enter your current password, then choose a new one.</p>
                </div>
              </div>
              <button type="button" onClick={closePw} disabled={pwSaving} aria-label="Close" className="ss-btn flex-shrink-0" style={{ ...ghostBtn(pwSaving), padding: 0, width: 40, borderColor: BORDER, color: MUTED }}><X size={15} /></button>
            </div>
            <div className="flex flex-col gap-3.5 overflow-y-auto" style={{ padding: 20 }}>
              {pwInput('current', 'ss-pw-current', 'Current password', 'current-password')}
              {pwInput('next', 'ss-pw-new', 'New password', 'new-password', pwErrors.next)}
              {pw.next && (
                <div aria-live="polite">
                  <div className="flex items-center gap-1.5" aria-hidden>
                    {[1, 2, 3, 4].map(i => <span key={i} style={{ flex: 1, height: 5, borderRadius: 999, background: i <= strength ? GOLD : BORDER, transition: 'background 120ms' }} />)}
                  </div>
                  <p style={{ ...sans, fontSize: '0.7rem', color: MUTED, marginTop: 4 }}>Password strength: <strong style={{ color: GOLD }}>{strengthLabel}</strong></p>
                </div>
              )}
              {pwInput('confirm', 'ss-pw-confirm', 'Confirm new password', 'new-password', pwErrors.confirm)}
              <div style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '10px 12px' }}>
                <p style={{ ...sans, fontSize: '0.72rem', fontWeight: 700, color: INK, marginBottom: 6 }}>Password requirements</p>
                <ul className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {checks.map(check => (
                    <li key={check.label} className="flex items-center gap-1.5" style={{ ...sans, fontSize: '0.72rem', color: check.ok ? SUCCESS : MUTED }}>
                      {check.ok ? <Check size={13} /> : <Circle size={11} />}
                      <span>{check.label}{check.required ? '' : ' (recommended)'}</span>
                    </li>
                  ))}
                </ul>
              </div>
              {pwFeedback && <Banner tone={pwFeedback.tone}>{pwFeedback.text}</Banner>}
            </div>
            <div className="grid flex-shrink-0 grid-cols-2 gap-2.5 sm:flex sm:justify-end" style={{ padding: '14px 20px', paddingBottom: 'max(14px, env(safe-area-inset-bottom))', borderTop: `1px solid ${BORDER}` }}>
              <button type="button" className="ss-btn" onClick={closePw} disabled={pwSaving} style={ghostBtn(pwSaving)}>Cancel</button>
              <button type="button" className="ss-btn" onClick={savePassword} disabled={!pwReady || pwSaving} style={primaryBtn(!pwReady || pwSaving)}>{pwSaving ? 'Updating…' : 'Update Password'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffSettings;