import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import {
  User, Mail, IdCard, ShieldCheck, Users, Lock, KeyRound, Bell,
  SlidersHorizontal, ListFilter, Rows3, Eye, EyeOff, CheckCircle2, AlertTriangle, Save, X,
  FileCheck, Hourglass, Megaphone, AlarmClock, Rows2,
} from 'lucide-react';
import { API_BASE, authHeaders } from '../../components/Officer/Reports/ReportsHelpers';
import { formatYearLevelLabel } from '../../utils/yearLevelLabels';
import {
  DEFAULT_OFFICER_WORK_PREFERENCES,
  readOfficerWorkPreferences,
  writeOfficerWorkPreferences,
} from '../../utils/officerWorkPreferences';
import { getPasswordRequirementError, isValidPassword } from '../../utils/passwordPolicy';

/* ───────── CONTRACT — i-match sa backend (hindi ko ma-inspect ang project mo) ─────────
 * Relative sa API_BASE, gamit ang authHeaders() (Bearer token). Identity ay galing sa token sa server.
 * GET  /officer/profile -> { full_name, email, officer_id?, role, assigned_year_levels?: string[], created_at?, last_login? }
 * PUT  /officer/profile body { full_name, email, currentPassword }   (hindi tatanggap ng role/officer_id/assignments)
 * POST /officer/change-password body { current_password, new_password }  (server verifies + hashes)
 * GET/PUT /officer/settings/notifications -> { new_submissions, pending_reviews, deadlines, announcements } (booleans)
 * Work Preferences: browser-only (localStorage).
 */
const PROFILE_PATH = '/officer/profile';
const PASSWORD_PATH = '/officer/change-password';
const NOTIF_PATH = '/officer/settings/notifications';
const VERIFY_PASSWORD_PATH = '/officer/settings/verify-password';

// ── Apple Scholar design system — same tokens as the other Officer pages ──
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
  { key: 'new_submissions', label: 'New scholar submissions', note: 'Alert when a scholar submits a record.', icon: FileCheck },
  { key: 'pending_reviews', label: 'Pending reviews', note: 'Reminders for submissions awaiting action.', icon: Hourglass },
  { key: 'deadlines', label: 'Compliance due soon', note: 'Within 3 days, for scholars who still need to submit or resubmit.', icon: AlarmClock },
  { key: 'announcements', label: 'Important announcements', note: 'Announcements posted for officers.', icon: Megaphone },
];

const DEFAULT_WORK = DEFAULT_OFFICER_WORK_PREFERENCES;

const classify = (err) => {
  const status = err?.response?.status;
  const message = err?.response?.data?.message || err?.response?.data?.error || '';
  if (status === 401 || /invalid or expired token|no token provided/i.test(message)) return { kind: 'auth', message: 'Your sign-in session has expired.' };
  if (status === 404 || status === 405) return { kind: 'unsupported', message: 'This feature is not available on the server yet.' };
  return { kind: 'error', message: message || err?.message || 'Something went wrong. Please try again.' };
};

const fmtDateTime = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleString('en-PH', { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' });
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
        <input id={id} className="os-field" readOnly={readOnly} {...rest}
          style={{ ...inputBase, background: readOnly ? BG : SURFACE, color: readOnly ? MUTED : INK, borderColor: error ? `${DANGER}99` : BORDER, paddingRight: readOnly ? 34 : 12, textTransform: readOnly && id === 'os-role' ? 'capitalize' : undefined }} aria-invalid={!!error} />
      )}
      {readOnly && <Lock size={13} style={{ position: 'absolute', right: 12, top: 13.5, color: '#B8A999' }} aria-label="Read-only" />}
    </div>
    {error && <p style={{ ...sans, fontSize: '0.7rem', color: DANGER, marginTop: 4 }}>{error}</p>}
  </div>
);

const SelectInput = ({ id, icon, label, value, onChange, options }) => (
  <IconInput id={id} icon={icon} label={label}>
    <select id={id} className="os-field" value={value} onChange={onChange} style={{ ...inputBase, cursor: 'pointer' }}>
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
  <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)} className="os-toggle"
    style={{ width: 44, height: 26, borderRadius: 999, border: 'none', padding: 3, background: checked ? PRIMARY : BORDER, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1, transition: 'background 120ms', flexShrink: 0 }}>
    <span style={{ display: 'block', width: 20, height: 20, borderRadius: '50%', background: '#fff', transform: checked ? 'translateX(18px)' : 'translateX(0)', transition: 'transform 120ms', boxShadow: '0 1px 2px rgba(0,0,0,.25)' }} />
  </button>
);

const skeletons = (n, h) => <div className="space-y-3">{Array.from({ length: n }).map((_, i) => <div key={i} className="animate-pulse" style={{ height: h, borderRadius: 10, background: '#EFE6D8' }} />)}</div>;

// ─────────────────────────────────────────────────────────────
const OfficerSettings = () => {
  const navigate = useNavigate();

  const [authExpired, setAuthExpired] = useState(false);
  const signInAgain = () => {
    ['token', 'role', 'name', 'email', 'id', 'scholar_id', 'must_change_password'].forEach(k => localStorage.removeItem(k));
    navigate('/login', { replace: true });
  };

  // ── Profile ──
  const [profile, setProfile] = useState(null);
  const [profileState, setProfileState] = useState('loading');
  const [profileMsg, setProfileMsg] = useState('');
  const [draft, setDraft] = useState({ full_name: '', email: '' });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileFeedback, setProfileFeedback] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [confirmError, setConfirmError] = useState('');
  const [confirmBusy, setConfirmBusy] = useState(false);

  const requestSettingsConfirmation = (action) => {
    setConfirmAction(action);
    setConfirmPassword('');
    setConfirmError('');
  };

  const closeSettingsConfirmation = () => {
    if (confirmBusy) return;
    setConfirmAction(null);
    setConfirmPassword('');
    setConfirmError('');
  };

  useEffect(() => {
    if (!confirmAction) return undefined;
    const onKeyDown = event => {
      if (event.key === 'Escape') closeSettingsConfirmation();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [confirmAction, confirmBusy]);

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

  const saveProfile = async (currentPassword) => {
    if (!profileDirty || !profileValid || profileSaving) return;
    setProfileSaving(true); setProfileFeedback(null);
    try {
      const body = { full_name: draft.full_name.trim(), email: draft.email.trim() };
      const res = await axios.put(`${API_BASE}${PROFILE_PATH}`, { ...body, currentPassword }, authHeaders());
      const next = { ...profile, ...body, ...(res.data && typeof res.data === 'object' ? res.data : {}) };
      setProfile(next);
      setDraft({ full_name: next.full_name || '', email: next.email || '' });
      setProfileFeedback({ tone: 'success', text: 'Profile updated.' });
      return true;
    } catch (e) {
      const message = e.response?.data?.error;
      if (e.response?.status === 401 && /password/i.test(message || '')) {
        setConfirmError(message);
        setProfileFeedback({ tone: 'error', text: message });
      } else {
        const c = classify(e);
        if (c.kind === 'auth') setAuthExpired(true);
        setProfileFeedback({ tone: 'error', text: c.message });
        setConfirmError(c.message);
      }
      return false;
    } finally { setProfileSaving(false); }
  };

  const confirmSettingsChange = async (event) => {
    event.preventDefault();
    if (!confirmAction || !confirmPassword || confirmBusy) return;
    setConfirmBusy(true); setConfirmError('');
    try {
      let ok = true;
      if (profileDirty) ok = (await saveProfile(confirmPassword)) === true;
      if (ok && notifDirty) ok = (await saveNotifs(confirmPassword)) === true;
      if (ok && workDirty) {
        // Profile/notification saves already verify the password; verify separately only if they didn't run.
        if (!profileDirty && !notifDirty) {
          await axios.post(`${API_BASE}${VERIFY_PASSWORD_PATH}`, { currentPassword: confirmPassword }, authHeaders());
        }
        ok = saveWork();
      }
      if (ok) {
        setConfirmAction(null);
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

  // ── Password (modal) ──
  const [pwOpen, setPwOpen] = useState(false);
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [showPw, setShowPw] = useState({ current: false, next: false, confirm: false });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwFeedback, setPwFeedback] = useState(null);
  const [pwDone, setPwDone] = useState(false);
  const pwErrors = {
    next: pw.next ? getPasswordRequirementError(pw.next) || (pw.next === pw.current ? 'New password must differ from the current one.' : '') : '',
    confirm: pw.confirm && pw.confirm !== pw.next ? 'Passwords do not match.' : '',
  };
  const pwReady = pw.current && isValidPassword(pw.next) && pw.next === pw.confirm && pw.next !== pw.current;

  const closePw = useCallback(() => {
    if (pwSaving) return;
    setPwOpen(false); setPw({ current: '', next: '', confirm: '' }); setShowPw({ current: false, next: false, confirm: false }); setPwFeedback(null);
  }, [pwSaving]);

  useEffect(() => {
    if (!pwOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') closePw(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pwOpen, closePw]);

  const savePassword = async () => {
    if (!pwReady || pwSaving) return;
    setPwSaving(true); setPwFeedback(null);
    try {
      await axios.post(`${API_BASE}${PASSWORD_PATH}`, { current_password: pw.current, new_password: pw.next }, authHeaders());
      setPw({ current: '', next: '', confirm: '' });
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
  const [notifMsg, setNotifMsg] = useState('');
  const [notifSaving, setNotifSaving] = useState(false);
  const [notifFeedback, setNotifFeedback] = useState(null);

  const loadNotifs = useCallback(async () => {
    setNotifState('loading'); setNotifMsg('');
    try {
      const res = await axios.get(`${API_BASE}${NOTIF_PATH}`, authHeaders());
      const data = NOTIF_EVENTS.reduce((acc, ev) => ({ ...acc, [ev.key]: !!res.data?.[ev.key] }), {});
      setNotifSaved(data); setNotifDraft(data); setNotifState('ready');
    } catch (e) {
      const c = classify(e);
      if (c.kind === 'auth') setAuthExpired(true);
      setNotifState(c.kind === 'unsupported' ? 'unsupported' : 'error'); setNotifMsg(c.message);
    }
  }, []);
  const notifDirty = !!notifSaved && NOTIF_EVENTS.some(ev => notifDraft?.[ev.key] !== notifSaved[ev.key]);

  const saveNotifs = async (currentPassword) => {
    if (!notifDirty || notifSaving) return;
    setNotifSaving(true); setNotifFeedback(null);
    try {
      await axios.put(`${API_BASE}${NOTIF_PATH}`, { ...notifDraft, currentPassword }, authHeaders());
      setNotifSaved(notifDraft);
      setNotifFeedback({ tone: 'success', text: 'Notification preferences saved.' });
      return true;
    } catch (e) {
      const message = e.response?.data?.error;
      if (e.response?.status === 401 && /password/i.test(message || '')) {
        setConfirmError(message);
        setNotifFeedback({ tone: 'error', text: message });
      } else {
        const c = classify(e);
        if (c.kind === 'auth') setAuthExpired(true);
        setNotifFeedback({ tone: 'error', text: c.message });
        setConfirmError(c.message);
      }
      return false;
    } finally { setNotifSaving(false); }
  };

  // ── Work preferences (browser-only) ──
  const [workSaved, setWorkSaved] = useState(readOfficerWorkPreferences);
  const [workDraft, setWorkDraft] = useState(readOfficerWorkPreferences);
  const [workFeedback, setWorkFeedback] = useState(null);
  const workDirty = Object.keys(DEFAULT_WORK).some(k => workDraft[k] !== workSaved[k]);
  const saveWork = () => {
    try {
      writeOfficerWorkPreferences(workDraft);
      setWorkSaved(workDraft);
      setWorkFeedback({ tone: 'success', text: 'Preferences saved on this browser.' });
      return true;
    } catch (error) {
      console.error('Failed to save Officer work preferences:', error);
      setWorkFeedback({ tone: 'error', text: 'Could not save preferences in this browser.' });
      setConfirmError('Could not save preferences in this browser.');
      return false;
    }
  };

  // One save for every section
  const anyDirty = profileDirty || workDirty || notifDirty;
  const cannotSave = (profileDirty && !profileValid) || profileSaving || notifSaving || confirmBusy;
  const dirtyLabels = [profileDirty && 'profile', workDirty && 'work preferences', notifDirty && 'notifications'].filter(Boolean).join(', ');
  const discardAll = () => {
    if (profile) setDraft({ full_name: profile.full_name || '', email: profile.email || '' });
    setWorkDraft(workSaved);
    if (notifSaved) setNotifDraft(notifSaved);
    setProfileFeedback(null); setWorkFeedback(null); setNotifFeedback(null);
  };

  useEffect(() => { loadProfile(); loadNotifs(); }, [loadProfile, loadNotifs]);

  const yearLevels = useMemo(() => (Array.isArray(profile?.assigned_year_levels) ? profile.assigned_year_levels.map(formatYearLevelLabel).join(', ') : ''), [profile]);
  const densityOptions = [
    { key: 'comfortable', title: 'Comfortable', note: 'Default spacing', icon: Rows3 },
    { key: 'compact', title: 'Compact', note: 'Tighter spacing', icon: Rows2 },
  ];

  const pwInput = (k, id, label, autoComplete, error) => (
    <IconInput id={id} icon={Lock} label={label} error={error}>
      <input id={id} className="os-field" type={showPw[k] ? 'text' : 'password'} autoComplete={autoComplete} value={pw[k]}
        onChange={e => setPw(p => ({ ...p, [k]: e.target.value }))} style={{ ...inputBase, paddingRight: 44, borderColor: error ? `${DANGER}99` : BORDER }} aria-invalid={!!error} />
      <button type="button" onClick={() => setShowPw(s => ({ ...s, [k]: !s[k] }))} aria-label={showPw[k] ? 'Hide password' : 'Show password'} className="os-btn"
        style={{ position: 'absolute', right: 4, top: 0, height: 40, width: 38, background: 'none', border: 'none', cursor: 'pointer', color: MUTED }}>
        {showPw[k] ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </IconInput>
  );

  const unsupported = (msg, what) => <Banner tone="warn">{msg} The {what} endpoint still needs to be added.</Banner>;

  const displayName = profile?.full_name || localStorage.getItem('name') || 'Officer';
  const createdAt = fmtDateTime(profile?.created_at);
  const lastLogin = fmtDateTime(profile?.last_login);

  return (
    <div className="os-page" style={{ background: BG, ...sans }}>
      <style>{`
        .os-page { width: 100%; min-height: 100vh; overflow-x: hidden; box-sizing: border-box; padding: 16px 16px 48px; }
        @media (min-width: 640px) { .os-page { padding: 24px 24px 48px; } }
        @media (min-width: 1024px) { .os-page { padding: 32px 32px 48px; } }

        .os-field:focus { border-color: ${PRIMARY} !important; box-shadow: 0 0 0 3px rgba(109,33,64,.10); }
        .os-btn:focus-visible, .os-opt:focus-visible, .os-toggle:focus-visible { outline: 2px solid ${GOLD}; outline-offset: 2px; }
        .os-opt { transition: background-color 150ms ease; }
        .os-opt:hover { background: ${SAND}; }
        .os-nrow { border-top: 1px solid ${BORDER}; }
        .os-nrow:first-child { border-top: none; }
        @media (min-width: 1024px) { .os-nrow:nth-child(2) { border-top: none; } }

        .os-sheet { border-radius: 20px 20px 0 0; }
        @media (min-width: 640px) { .os-sheet { border-radius: 16px; } }

        @media (max-width: 639px) {
          /* 16px prevents iOS Safari from zooming in when a field is focused */
          .os-field { font-size: 16px !important; height: 44px !important; }
          .os-btn { min-height: 44px !important; }
        }
        @media (prefers-reduced-motion: reduce) { .os-page * { transition: none !important; } }
      `}</style>

      <div className="flex flex-col gap-5" style={{ minWidth: 0 }}>

        {/* ── Page header — same layout as the other Officer pages ── */}
        <header
          className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"
          style={{ ...card, padding: 'clamp(14px, 3vw, 20px)' }}
        >
          <div className="min-w-0">
            <p style={{ ...sans, fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: GOLD }}>Officer Portal</p>
            <h1 style={{ ...display, fontSize: 'clamp(1.6rem, 4vw, 2rem)', fontWeight: 700, color: PRIMARY, lineHeight: 1.15, marginTop: 3 }}>Settings</h1>
            <p style={{ ...sans, fontSize: '0.9rem', color: MUTED, marginTop: 6, lineHeight: 1.55 }}>Manage your account, security, notifications, and work preferences.</p>
          </div>
        </header>

        {authExpired && (
          <Banner tone="error" action={<button onClick={signInAgain} className="os-btn" style={linkBtn}>Sign in again</button>}>
            Your sign-in session has expired or is invalid.
          </Banner>
        )}
        {pwDone && <Banner tone="success" action={<button onClick={() => setPwDone(false)} className="os-btn" style={{ ...linkBtn, color: SUCCESS }}>Dismiss</button>}>Password updated.</Banner>}

        {/* ── Row 1: Officer Profile + Work Preferences ── */}
        <div className="grid grid-cols-1 items-stretch gap-5 lg:grid-cols-2">
          <Card icon={User} title="Officer Profile" description="Update your name and email.">
            {profileState === 'loading' && skeletons(3, 44)}
            {profileState === 'unsupported' && unsupported(profileMsg, 'profile')}
            {profileState === 'error' && <Banner tone="error" action={<button onClick={loadProfile} className="os-btn" style={linkBtn}>Retry</button>}>{profileMsg}</Banner>}
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
                      <ShieldCheck size={11} /> {profile?.role || 'Officer'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                  <IconInput id="os-name" icon={User} label="Display name" value={draft.full_name} onChange={e => { setDraft(d => ({ ...d, full_name: e.target.value })); setProfileFeedback(null); }} autoComplete="name" />
                  <IconInput id="os-email" icon={Mail} label="Email address" type="email" value={draft.email} onChange={e => { setDraft(d => ({ ...d, email: e.target.value })); setProfileFeedback(null); }} autoComplete="email" error={draft.email && !emailValid ? 'Enter a valid email address.' : ''} />
                  <IconInput id="os-role" icon={ShieldCheck} label="Role" readOnly value={profile?.role || '—'} />
                  <IconInput id="os-officer-id" icon={IdCard} label="Officer ID" readOnly value={profile?.officer_id || '—'} />
                  <div className="sm:col-span-2">
                    <IconInput id="os-years" icon={Users} label="Assigned year levels" readOnly value={yearLevels || '—'} />
                  </div>
                </div>

                <div className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between" style={{ borderTop: `1px solid ${BORDER}` }}>
                  <div className="flex min-w-0 items-center gap-3">
                    <IconChip icon={KeyRound} tone={GOLD} />
                    <div style={{ minWidth: 0 }}>
                      <p style={{ ...sans, fontSize: '0.84rem', fontWeight: 700, color: INK }}>Password</p>
                      <p style={{ ...sans, fontSize: '0.72rem', color: MUTED }}>Change the password you use to log in.</p>
                    </div>
                  </div>
                  <button type="button" className="os-btn flex-shrink-0" onClick={() => setPwOpen(true)} style={ghostBtn(false)}><KeyRound size={14} /> Change Password</button>
                </div>

                {(createdAt || lastLogin) && (
                  <p style={{ ...sans, fontSize: '0.72rem', color: MUTED, lineHeight: 1.6 }}>
                    {createdAt && <>Account created {createdAt}</>}
                    {createdAt && lastLogin && ' · '}
                    {lastLogin && <>Last login {lastLogin}</>}
                  </p>
                )}
                {profileFeedback && <Banner tone={profileFeedback.tone}>{profileFeedback.text}</Banner>}
              </div>
            )}
          </Card>

          <Card icon={SlidersHorizontal} title="Work Preferences" description="Default filters and display options. Saved on this browser only.">
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                <SelectInput id="os-wp-status" icon={ListFilter} label="Default review status" value={workDraft.reviewStatus} onChange={e => { setWorkDraft(d => ({ ...d, reviewStatus: e.target.value })); setWorkFeedback(null); }}
                  options={[['all', 'All'], ['pending', 'Pending'], ['approved', 'Approved'], ['returned', 'Returned']]} />
                <SelectInput id="os-wp-size" icon={Rows3} label="Default page size" value={workDraft.pageSize} onChange={e => { setWorkDraft(d => ({ ...d, pageSize: Number(e.target.value) })); setWorkFeedback(null); }}
                  options={[10, 20, 50].map(n => [n, `${n} rows`])} />
              </div>

              <div>
                <Label>Table density</Label>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2" role="radiogroup" aria-label="Table density">
                  {densityOptions.map(o => {
                    const active = workDraft.density === o.key;
                    return (
                      <button key={o.key} type="button" role="radio" aria-checked={active} onClick={() => { setWorkDraft(d => ({ ...d, density: o.key })); setWorkFeedback(null); }} className="os-opt flex items-center gap-3 text-left"
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
              {workFeedback && <Banner tone={workFeedback.tone}>{workFeedback.text}</Banner>}
            </div>
          </Card>
        </div>

        {/* ── Row 2: Notifications ── */}
        <Card icon={Bell} title="Notifications" description="Choose which officer events notify you in the portal.">
          {notifState === 'loading' && skeletons(4, 52)}
          {notifState === 'unsupported' && unsupported(notifMsg, 'notification settings')}
          {notifState === 'error' && <Banner tone="error" action={<button onClick={loadNotifs} className="os-btn" style={linkBtn}>Retry</button>}>{notifMsg}</Banner>}
          {notifState === 'ready' && (
            <div>
              <div className="grid grid-cols-1 gap-x-10 lg:grid-cols-2">
                {NOTIF_EVENTS.map(ev => (
                  <div key={ev.key} className="os-nrow flex items-center gap-3 py-3">
                    <IconChip icon={ev.icon} />
                    <div className="flex-1" style={{ minWidth: 0 }}>
                      <p style={{ ...sans, fontSize: '0.84rem', fontWeight: 700, color: INK }}>{ev.label}</p>
                      <p style={{ ...sans, fontSize: '0.72rem', color: MUTED, marginTop: 1 }}>{ev.note}</p>
                    </div>
                    <Toggle checked={!!notifDraft?.[ev.key]} disabled={notifSaving} label={ev.label} onChange={v => { setNotifDraft(d => ({ ...d, [ev.key]: v })); setNotifFeedback(null); }} />
                  </div>
                ))}
              </div>
              {notifFeedback && <div style={{ marginTop: 10 }}><Banner tone={notifFeedback.tone}>{notifFeedback.text}</Banner></div>}
            </div>
          )}
        </Card>

        <div role="region" aria-label="Settings actions" className="flex justify-end"
          style={{ position: 'sticky', bottom: 16, zIndex: 20, ...card, padding: '12px 16px', boxShadow: '0 16px 36px -16px rgba(36,21,18,0.35)' }}>
          <div className="grid w-full grid-cols-2 gap-2.5 sm:flex sm:w-auto sm:items-center">
            <button type="button" className="os-btn" onClick={discardAll} disabled={!anyDirty || confirmBusy} style={ghostBtn(!anyDirty || confirmBusy)}>Reset Changes</button>
            <button type="button" className="os-btn" onClick={() => requestSettingsConfirmation('all')} disabled={!anyDirty || cannotSave} style={primaryBtn(!anyDirty || cannotSave)}>
              <Save size={14} /> Save Settings
            </button>
          </div>
        </div>
      </div>

      {/* ── Confirm password modal ── */}
      {confirmAction && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4"
          style={{ background: 'rgba(36,21,18,0.55)' }}
          onMouseDown={event => { if (event.target === event.currentTarget) closeSettingsConfirmation(); }}
        >
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="os-confirm-title"
            onSubmit={confirmSettingsChange}
            className="os-sheet w-full"
            style={{ background: SURFACE, border: `1px solid ${BORDER}`, maxWidth: 440, padding: 20, paddingBottom: 'max(20px, env(safe-area-inset-bottom))', boxShadow: '0 28px 60px -24px rgba(36,21,18,0.5)' }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <IconChip icon={Lock} size={36} tone={GOLD} />
                <div>
                  <h2 id="os-confirm-title" style={{ ...display, fontSize: '1.1rem', fontWeight: 700, color: PRIMARY }}>Confirm your password</h2>
                  <p style={{ ...sans, fontSize: '0.76rem', color: MUTED, marginTop: 2 }}>Enter your current password to save these settings.</p>
                </div>
              </div>
              <button type="button" onClick={closeSettingsConfirmation} disabled={confirmBusy} aria-label="Close" className="os-btn flex-shrink-0" style={{ ...ghostBtn(confirmBusy), padding: 0, width: 40, borderColor: BORDER, color: MUTED }}><X size={15} /></button>
            </div>
            <div style={{ marginTop: 16 }}>
              <IconInput id="os-confirm-current-password" icon={Lock} label="Current password">
                <input
                  id="os-confirm-current-password"
                  className="os-field"
                  type="password"
                  autoComplete="current-password"
                  autoFocus
                  required
                  value={confirmPassword}
                  onChange={event => setConfirmPassword(event.target.value)}
                  style={inputBase}
                />
              </IconInput>
            </div>
            {confirmError && <div style={{ marginTop: 12 }}><Banner tone="error">{confirmError}</Banner></div>}
            <div className="grid grid-cols-2 gap-2.5 sm:flex sm:justify-end" style={{ marginTop: 18 }}>
              <button type="button" onClick={closeSettingsConfirmation} disabled={confirmBusy} className="os-btn" style={ghostBtn(confirmBusy)}>Cancel</button>
              <button type="submit" disabled={confirmBusy || !confirmPassword} className="os-btn" style={primaryBtn(confirmBusy || !confirmPassword)}>
                {confirmBusy ? 'Confirming…' : 'Confirm & Save'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Change Password modal ── */}
      {pwOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" style={{ background: 'rgba(36,21,18,0.55)' }} onClick={closePw}>
          <div role="dialog" aria-modal="true" aria-labelledby="os-pw-title" onClick={e => e.stopPropagation()} className="os-sheet flex w-full flex-col"
            style={{ background: SURFACE, border: `1px solid ${BORDER}`, maxWidth: 460, maxHeight: '92vh', overflow: 'hidden', boxShadow: '0 28px 60px -24px rgba(36,21,18,0.5)' }}>
            <div className="flex flex-shrink-0 items-start justify-between gap-3" style={{ padding: '18px 20px', borderBottom: `1px solid ${BORDER}` }}>
              <div className="flex items-start gap-3">
                <IconChip icon={KeyRound} size={36} tone={GOLD} />
                <div>
                  <h2 id="os-pw-title" style={{ ...display, fontSize: '1.1rem', fontWeight: 700, color: PRIMARY }}>Change Password</h2>
                  <p style={{ ...sans, fontSize: '0.76rem', color: MUTED, marginTop: 2 }}>Enter your current password, then choose a new one.</p>
                </div>
              </div>
              <button type="button" onClick={closePw} disabled={pwSaving} aria-label="Close" className="os-btn flex-shrink-0" style={{ ...ghostBtn(pwSaving), padding: 0, width: 40, borderColor: BORDER, color: MUTED }}><X size={15} /></button>
            </div>
            <div className="flex flex-col gap-3.5 overflow-y-auto" style={{ padding: 20 }}>
              {pwInput('current', 'os-pw-current', 'Current password', 'current-password')}
              {pwInput('next', 'os-pw-new', 'New password', 'new-password', pwErrors.next)}
              <p style={{ ...sans, margin: '-8px 0 0', fontSize: 12, color: MUTED }}>
                Use at least 8 characters and include a special character, such as ! or @.
              </p>
              {pwInput('confirm', 'os-pw-confirm', 'Confirm new password', 'new-password', pwErrors.confirm)}
              {pwFeedback && <Banner tone={pwFeedback.tone}>{pwFeedback.text}</Banner>}
            </div>
            <div className="grid flex-shrink-0 grid-cols-2 gap-2.5 sm:flex sm:justify-end" style={{ padding: '14px 20px', paddingBottom: 'max(14px, env(safe-area-inset-bottom))', borderTop: `1px solid ${BORDER}` }}>
              <button type="button" className="os-btn" onClick={closePw} disabled={pwSaving} style={ghostBtn(pwSaving)}>Cancel</button>
              <button type="button" className="os-btn" onClick={savePassword} disabled={!pwReady || pwSaving} style={primaryBtn(!pwReady || pwSaving)}>{pwSaving ? 'Updating…' : 'Update Password'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OfficerSettings;