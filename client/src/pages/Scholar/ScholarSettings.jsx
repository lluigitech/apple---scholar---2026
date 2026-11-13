import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  User, Mail, Phone, Hash, GraduationCap, Lock, KeyRound, Bell, CalendarDays, Settings,
  Eye, EyeOff, CheckCircle2, AlertTriangle, Save, Check, Circle, X,
  ClipboardList, ClipboardCheck, Megaphone, CalendarClock, ShieldCheck,
} from 'lucide-react';

const API_BASE = 'http://localhost:5000/api';
const VERIFY_PASSWORD_PATH = '/scholar/settings/verify-password';
const NOTIF_LOCAL_KEY = 'notif_settings';
const MIN_PASSWORD_LENGTH = 8;

const YEAR_LEVEL_OPTIONS = [
  { value: 'grade_7', label: 'Grade 7' },
  { value: 'grade_8', label: 'Grade 8' },
  { value: 'grade_9', label: 'Grade 9' },
  { value: 'grade_10', label: 'Grade 10' },
  { value: 'grade_11', label: 'Grade 11' },
  { value: 'grade_12', label: 'Grade 12' },
  { value: 'college_1', label: '1st Year College' },
  { value: 'college_2', label: '2nd Year College' },
  { value: 'college_3', label: '3rd Year College' },
  { value: 'college_4', label: '4th Year College' },
  { value: 'college_5', label: '5th Year College' },
];

const normalizeYearLevelValue = (value) => {
  const normalized = String(value || '').trim().toLowerCase().replace(/\s+/g, '_');
  return YEAR_LEVEL_OPTIONS.find(o =>
    o.value === normalized || o.label.toLowerCase().replace(/\s+/g, '_') === normalized
  )?.value || '';
};

const authHeader = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

/* ── Same tokens as the Staff / Officer settings ── */
const BG = '#F7F4EE', SURFACE = '#FFFDF9', BORDER = '#E7D8C7', PRIMARY = '#6D2140', DEEP = '#4A1730';
const BRONZE = '#A9784E', SUCCESS = '#6B8F71', WARNING = '#C08A3E', DANGER = '#C0473F', INK = '#241512', MUTED = '#8A7A68';
const BLUSH = '#F3EAE2';
const serif = { fontFamily: "'Playfair Display', serif" };
const sans = { fontFamily: "'Inter', sans-serif" };
const tile = { background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 16, boxShadow: '0 8px 20px -16px rgba(36,21,18,0.35)' };

const NOTIF_EVENTS = [
  { key: 'deadline_reminders', label: 'Deadline Reminders', note: 'Get notified before submission deadlines.', icon: CalendarClock },
  { key: 'submission_updates', label: 'Submission Status Updates', note: 'Get notified when staff reviews your submission.', icon: ClipboardCheck },
  { key: 'announcement_alerts', label: 'Announcement Alerts', note: 'Get notified of new foundation announcements.', icon: Megaphone },
  { key: 'duty_reminders', label: 'Duty Reminders', note: 'Get notified of upcoming duty assignments.', icon: ClipboardList },
];
const DEFAULT_NOTIFS = NOTIF_EVENTS.reduce((a, e) => ({ ...a, [e.key]: true }), {});

const loadLocalNotifs = () => {
  try { return { ...DEFAULT_NOTIFS, ...(JSON.parse(localStorage.getItem(NOTIF_LOCAL_KEY)) || {}) }; }
  catch { return DEFAULT_NOTIFS; }
};

const initialsOf = (name = '') =>
  name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('') || '?';

/* ── Small UI (identical pattern to Staff / Officer) ── */
const inputBase = { ...sans, width: '100%', height: 40, padding: '0 12px 0 36px', border: `1px solid ${BORDER}`, borderRadius: 10, background: SURFACE, fontSize: '0.84rem', color: INK, outline: 'none' };
const primaryBtn = (disabled) => ({ ...sans, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 38, padding: '0 16px', borderRadius: 10, border: 'none', background: PRIMARY, color: '#fff', fontSize: '0.78rem', fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1 });
const ghostBtn = (disabled) => ({ ...sans, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 38, padding: '0 16px', borderRadius: 10, border: `1px solid ${PRIMARY}`, background: SURFACE, color: PRIMARY, fontSize: '0.78rem', fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1 });

const IconChip = ({ icon: Icon, size = 32 }) => (
  <span className="inline-flex flex-shrink-0 items-center justify-center" style={{ width: size, height: size, borderRadius: 10, background: BLUSH, color: PRIMARY }}>
    <Icon size={size * 0.5} strokeWidth={1.8} />
  </span>
);

const Card = ({ id, icon: Icon, title, description, children, footer }) => (
  <section id={id} className="flex min-w-0 flex-col" style={{ ...tile, padding: '18px 20px' }}>
    <div className="flex items-start gap-3" style={{ marginBottom: 14 }}>
      <IconChip icon={Icon} size={38} />
      <div style={{ minWidth: 0 }}>
        <h2 style={{ ...serif, fontSize: '1.08rem', fontWeight: 700, color: INK, lineHeight: 1.25 }}>{title}</h2>
        {description && <p style={{ ...sans, fontSize: '0.74rem', color: MUTED, marginTop: 2 }}>{description}</p>}
      </div>
    </div>
    <div className="flex-1">{children}</div>
    {footer && <div className="flex flex-wrap items-center justify-end gap-2.5" style={{ marginTop: 14 }}>{footer}</div>}
  </section>
);

const Label = ({ htmlFor, children }) => (
  <label htmlFor={htmlFor} style={{ ...sans, display: 'block', fontSize: '0.72rem', fontWeight: 600, color: '#6b5a52', marginBottom: 5 }}>{children}</label>
);

const IconInput = ({ id, icon: Icon, label, readOnly, error, children, ...rest }) => (
  <div style={{ minWidth: 0 }}>
    <Label htmlFor={id}>{label}</Label>
    <div style={{ position: 'relative' }}>
      <Icon size={15} style={{ position: 'absolute', left: 12, top: 12.5, color: MUTED, pointerEvents: 'none' }} />
      {children || (
        <input id={id} className="ss-field" readOnly={readOnly} {...rest}
          style={{ ...inputBase, background: readOnly ? BLUSH : SURFACE, color: readOnly ? '#6b6058' : INK, borderColor: error ? `${DANGER}99` : BORDER, paddingRight: readOnly ? 34 : 12 }}
          aria-invalid={!!error} aria-describedby={error ? `${id}-err` : undefined} />
      )}
      {readOnly && <Lock size={13} style={{ position: 'absolute', right: 12, top: 13.5, color: MUTED }} aria-label="Read-only" />}
    </div>
    {error && <p id={`${id}-err`} style={{ ...sans, fontSize: '0.7rem', color: DANGER, marginTop: 4 }}>{error}</p>}
  </div>
);

const Banner = ({ tone, children, action }) => {
  const color = tone === 'success' ? SUCCESS : tone === 'warn' ? WARNING : DANGER;
  const Icon = tone === 'success' ? CheckCircle2 : AlertTriangle;
  return (
    <div role={tone === 'success' ? 'status' : 'alert'} className="flex items-center justify-between gap-3"
      style={{ borderLeft: `3px solid ${color}`, background: `${color}0d`, borderRadius: '0 10px 10px 0', padding: '9px 12px', ...sans, fontSize: '0.78rem', fontWeight: 600, color }}>
      <span className="flex items-center gap-2"><Icon size={14} className="flex-shrink-0" />{children}</span>
      {action}
    </div>
  );
};

const Toggle = ({ checked, onChange, label, disabled }) => (
  <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)} className="ss-btn"
    style={{ width: 42, height: 24, borderRadius: 999, border: 'none', padding: 2, background: checked ? PRIMARY : BORDER, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1, transition: 'background 120ms', flexShrink: 0 }}>
    <span style={{ display: 'block', width: 20, height: 20, borderRadius: '50%', background: '#fff', transform: checked ? 'translateX(18px)' : 'translateX(0)', transition: 'transform 120ms', boxShadow: '0 1px 2px rgba(0,0,0,.25)' }} />
  </button>
);

const skeletons = (n, h) => (
  <div className="space-y-3">{Array.from({ length: n }).map((_, i) => <div key={i} className="animate-pulse" style={{ height: h, borderRadius: 10, background: BLUSH }} />)}</div>
);

const pickEditable = (p) => ({ fullName: p.fullName, email: p.email, phone: p.phone, yearLevel: p.yearLevel });

// ─────────────────────────────────────────────────────────────
const ScholarSettings = () => {
  const userId = localStorage.getItem('id');

  /* ── Profile ── */
  const [initialProfile] = useState(() => ({
    fullName: localStorage.getItem('name') || '',
    email: localStorage.getItem('email') || '',
    phone: localStorage.getItem('phone') || '',
    studentId: localStorage.getItem('scholar_id') || '',
    yearLevel: normalizeYearLevelValue(localStorage.getItem('year_level')),
    status: 'Active',
  }));
  const [profile, setProfile] = useState(initialProfile);
  const [savedProfile, setSavedProfile] = useState(() => pickEditable(initialProfile));
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsFeedback, setSettingsFeedback] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [confirmError, setConfirmError] = useState('');
  const [confirmBusy, setConfirmBusy] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!userId) {
        setLoadError('Scholar credentials not found. Please log in again.');
        setLoading(false);
        return;
      }
      try {
        const res = await axios.get(`${API_BASE}/scholar/profile/${userId}`, { headers: authHeader() });
        if (!mounted) return;
        const data = res.data || {};
        const next = {
          ...initialProfile,
          fullName: data.full_name || initialProfile.fullName,
          email: data.email || initialProfile.email,
          phone: data.phone ?? initialProfile.phone,
          studentId: data.scholar_id || initialProfile.studentId,
          yearLevel: normalizeYearLevelValue(data.year_level) || initialProfile.yearLevel,
          status: data.status || initialProfile.status,
        };
        setProfile(next);
        setSavedProfile(pickEditable(next));
        if (data.year_level) localStorage.setItem('year_level', data.year_level);
      } catch (err) {
        if (!mounted) return;
        console.error('Error loading scholar profile', err);
        setLoadError('Unable to load profile data. Please refresh or log in again.');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [userId, initialProfile]);

  const profileDirty = ['fullName', 'email', 'phone', 'yearLevel'].some(k => profile[k] !== savedProfile[k]);
  const emailValid = /^\S+@\S+\.\S+$/.test(profile.email.trim());
  const profileValid = profile.fullName.trim().length > 0 && emailValid;

  const updateProfile = (key) => (e) => {
    setProfile(p => ({ ...p, [key]: e.target.value }));
    setSettingsFeedback(null);
  };

  /* ── Password modal ── */
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
    { label: 'At least one symbol', ok: /[^A-Za-z0-9]/.test(pw.next) },
  ]), [pw.next]);
  const strength = pw.next ? Math.max(1, checks.filter(c => c.ok).length) : 0;
  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong'][strength];
  const pwErrors = {
    next: pw.next && pw.next.length < MIN_PASSWORD_LENGTH ? `Use at least ${MIN_PASSWORD_LENGTH} characters.` : pw.next && pw.next === pw.current ? 'New password must differ from the current one.' : '',
    confirm: pw.confirm && pw.confirm !== pw.next ? 'Passwords do not match.' : '',
  };
  const pwReady = !!pw.current && pw.next.length >= MIN_PASSWORD_LENGTH && pw.next === pw.confirm && pw.next !== pw.current;

  const closePasswordModal = () => {
    if (pwSaving) return;
    setPwOpen(false);
    setPw({ current: '', next: '', confirm: '' });
    setShowPw({ current: false, next: false, confirm: false });
    setPwFeedback(null);
  };

  useEffect(() => {
    if (!pwOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') closePasswordModal(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pwOpen, pwSaving]);

  const savePassword = async () => {
    if (!pwReady || pwSaving) return;
    setPwSaving(true);
    setPwFeedback(null);
    try {
      await axios.post(`${API_BASE}/change-password`, { current_password: pw.current, new_password: pw.next }, { headers: authHeader() });
      setPwSaving(false);
      closePasswordModal();
      setPwDone(true);
    } catch (err) {
      setPwFeedback({ tone: 'error', text: err.response?.data?.error || err.response?.data?.message || 'Unable to change password. Please try again.' });
      setPwSaving(false);
    }
  };

  /* ── Notifications (browser-only) ── */
  const [notifSaved, setNotifSaved] = useState(loadLocalNotifs);
  const [notifDraft, setNotifDraft] = useState(loadLocalNotifs);
  const notifDirty = NOTIF_EVENTS.some(ev => notifDraft[ev.key] !== notifSaved[ev.key]);

  /* ── One Save for profile + notifications (password has its own dialog) ── */
  const settingsDirty = profileDirty || notifDirty;
  const canSave = settingsDirty && (!profileDirty || profileValid) && !settingsSaving && !loading;

  const resetSettings = () => {
    setProfile(p => ({ ...p, ...savedProfile }));
    setNotifDraft(notifSaved);
    setSettingsFeedback(null);
  };

  const saveSettings = async () => {
    if (!canSave) return;
    setSettingsSaving(true);
    setSettingsFeedback(null);

    const tasks = [];
    if (profileDirty) {
      const updates = { full_name: profile.fullName.trim(), email: profile.email.trim(), phone: profile.phone };
      if (profile.yearLevel) updates.year_level = profile.yearLevel;
      tasks.push({
        key: 'profile',
        updates,
        save: () => axios.patch(`${API_BASE}/scholar/settings/profile/${userId}`, { ...updates, currentPassword: confirmPassword }, { headers: authHeader() }),
      });
    }
    if (notifDirty) {
      const draft = { ...notifDraft };
      tasks.push({
        key: 'notifications',
        draft,
        save: async () => localStorage.setItem(NOTIF_LOCAL_KEY, JSON.stringify(draft)),
      });
    }

    try {
      const outcomes = await Promise.all(tasks.map(async t => {
        try { return { task: t, response: await t.save() }; }
        catch (error) { return { task: t, error }; }
      }));

      const saved = [];
      const failures = [];
      outcomes.forEach(({ task, response, error }) => {
        const label = task.key === 'profile' ? 'Profile' : 'Notification preferences';
        if (error) {
          console.error(`Failed to save ${task.key}:`, error);
          const msg = error.response?.data?.error || error.response?.data?.message || 'Please try again.';
          failures.push(`${label}: ${msg}`);
          return;
        }
        saved.push(label);
        if (task.key === 'profile') {
          const data = response?.data || {};
          const next = {
            ...profile,
            fullName: data.full_name || task.updates.full_name,
            email: data.email || task.updates.email,
            phone: data.phone ?? task.updates.phone,
            yearLevel: normalizeYearLevelValue(data.year_level) || profile.yearLevel,
          };
          setProfile(next);
          setSavedProfile(pickEditable(next));
          localStorage.setItem('name', next.fullName);
          localStorage.setItem('email', next.email);
          if (data.year_level) localStorage.setItem('year_level', data.year_level);
        } else {
          setNotifSaved(task.draft);
        }
      });

      setSettingsFeedback(failures.length
        ? { tone: 'error', text: `${saved.length ? `${saved.join(' and ')} saved. ` : ''}${failures.join(' ')}` }
        : { tone: 'success', text: 'Settings saved.' });
      setConfirmError(failures.join(' '));
      return failures.length === 0;
    } finally {
      setSettingsSaving(false);
    }
  };

  const closeSettingsConfirmation = () => {
    if (confirmBusy || settingsSaving) return;
    setConfirmOpen(false);
    setConfirmPassword('');
    setConfirmError('');
  };

  const confirmSettingsSave = async (event) => {
    event.preventDefault();
    if (!confirmPassword || confirmBusy || !canSave) return;
    setConfirmBusy(true);
    setConfirmError('');
    try {
      await axios.post(
        `${API_BASE}${VERIFY_PASSWORD_PATH}`,
        { currentPassword: confirmPassword },
        { headers: authHeader() }
      );
      const saved = await saveSettings();
      if (saved) {
        setConfirmOpen(false);
        setConfirmPassword('');
        setConfirmError('');
      }
    } catch (error) {
      setConfirmError(error.response?.data?.error || error.response?.data?.message || 'Unable to verify your current password. Please try again.');
    } finally {
      setConfirmBusy(false);
    }
  };

  const yearLabel = YEAR_LEVEL_OPTIONS.find(o => o.value === profile.yearLevel)?.label || 'Not set';
  const todayLabel = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

  const pwInput = (k, id, label, autoComplete, error) => (
    <IconInput id={id} icon={Lock} label={label} error={error}>
      <input id={id} className="ss-field" type={showPw[k] ? 'text' : 'password'} autoComplete={autoComplete} value={pw[k]}
        onChange={e => { setPw(p => ({ ...p, [k]: e.target.value })); setPwFeedback(null); }}
        style={{ ...inputBase, paddingRight: 40, borderColor: error ? `${DANGER}99` : BORDER }}
        aria-invalid={!!error} aria-describedby={error ? `${id}-err` : undefined} />
      <button type="button" className="ss-btn" onClick={() => setShowPw(s => ({ ...s, [k]: !s[k] }))}
        aria-label={showPw[k] ? `Hide ${label}` : `Show ${label}`}
        style={{ position: 'absolute', right: 6, top: 0, height: 40, width: 32, background: 'none', border: 'none', cursor: 'pointer', color: MUTED }}>
        {showPw[k] ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </IconInput>
  );

  return (
    <div className="min-h-screen" style={{ background: BG, ...sans }}>
      <style>{`
        .ss-field:focus { border-color: ${BRONZE} !important; box-shadow: 0 0 0 3px rgba(169,120,78,.15); }
        .ss-btn:focus-visible { outline: 2px solid ${BRONZE}; outline-offset: 2px; }
        .ss-nrow { border-top: 1px solid ${BORDER}; }
        .ss-nrow:first-child { border-top: none; }
        @media (min-width: 1024px) { .ss-nrow:nth-child(2) { border-top: none; } }
      `}</style>

      <div className="flex flex-col gap-4 px-4 py-5 sm:px-6 lg:px-8" style={{ minWidth: 0 }}>

        {/* ── Header ── */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_auto]">
          <div className="relative flex items-center gap-4 overflow-hidden" style={{ ...tile, padding: '22px 24px', background: `linear-gradient(135deg, ${SURFACE} 0%, ${BLUSH} 100%)` }}>
            <span aria-hidden style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${PRIMARY}, ${BRONZE})` }} />
            <IconChip icon={Settings} size={46} />
            <div style={{ minWidth: 0 }}>
              <p style={{ ...sans, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.1em', color: BRONZE }}>SCHOLAR PORTAL</p>
              <h1 style={{ ...serif, fontSize: '1.75rem', fontWeight: 700, color: PRIMARY, marginTop: 4, lineHeight: 1.2 }}>Settings</h1>
              <p style={{ ...sans, fontSize: '0.84rem', color: MUTED, marginTop: 6, maxWidth: 640 }}>Manage your account, security, and notification preferences.</p>
            </div>
          </div>
          <div className="flex items-center gap-3" style={{ ...tile, padding: '16px 24px' }}>
            <span className="inline-flex flex-shrink-0 items-center justify-center" style={{ width: 42, height: 42, borderRadius: 12, background: `${PRIMARY}10` }}>
              <CalendarDays size={19} style={{ color: PRIMARY }} />
            </span>
            <div>
              <p style={{ ...sans, fontSize: '0.68rem', color: MUTED }}>Today</p>
              <p style={{ ...sans, fontSize: '0.92rem', fontWeight: 600, color: INK, whiteSpace: 'nowrap' }}>{todayLabel}</p>
            </div>
          </div>
        </div>

        {loadError && <Banner tone="error">{loadError}</Banner>}
        {pwDone && (
          <Banner tone="success" action={<button onClick={() => setPwDone(false)} className="ss-btn" style={{ ...sans, fontSize: '0.74rem', fontWeight: 700, color: SUCCESS, background: 'none', border: 'none', textDecoration: 'underline', cursor: 'pointer' }}>Dismiss</button>}>
            Password updated.
          </Banner>
        )}

        {/* ── Account & Profile ── */}
        <Card id="account" icon={User} title="Account & Profile" description="Update your name, contact details, and year level.">
          {loading ? skeletons(4, 40) : (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <span aria-hidden className="inline-flex flex-shrink-0 items-center justify-center" style={{ width: 48, height: 48, borderRadius: '50%', background: PRIMARY, color: '#fff', ...serif, fontWeight: 700, fontSize: '1rem' }}>{initialsOf(savedProfile.fullName)}</span>
                <div style={{ minWidth: 0 }}>
                  <p style={{ ...sans, fontSize: '0.92rem', fontWeight: 700, color: INK, overflowWrap: 'anywhere' }}>{savedProfile.fullName || '—'}</p>
                  <p style={{ ...sans, fontSize: '0.74rem', color: MUTED, overflowWrap: 'anywhere' }}>{savedProfile.email || '—'}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                <IconInput id="ss-name" icon={User} label="Full Name" value={profile.fullName} onChange={updateProfile('fullName')} autoComplete="name" disabled={settingsSaving}
                  error={!profile.fullName.trim() ? 'Name is required.' : ''} />
                <IconInput id="ss-email" icon={Mail} label="Email Address" type="email" value={profile.email} onChange={updateProfile('email')} autoComplete="email" disabled={settingsSaving}
                  error={profile.email && !emailValid ? 'Enter a valid email address.' : ''} />
                <IconInput id="ss-phone" icon={Phone} label="Phone" type="tel" value={profile.phone} onChange={updateProfile('phone')} autoComplete="tel" disabled={settingsSaving} />
                <div>
                  <IconInput id="ss-year" icon={GraduationCap} label="Year Level">
                    <select id="ss-year" className="ss-field" value={profile.yearLevel} onChange={updateProfile('yearLevel')} disabled={settingsSaving}
                      style={{ ...inputBase, cursor: 'pointer' }}>
                      <option value="">Select year level</option>
                      {YEAR_LEVEL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </IconInput>
                </div>
                <IconInput id="ss-student-id" icon={Hash} label="Student ID" readOnly value={profile.studentId || '—'} />
                <IconInput id="ss-status" icon={ShieldCheck} label="Account Status" readOnly value={profile.status || 'Active'} style={{ textTransform: 'capitalize' }} />
              </div>
              <p style={{ ...sans, fontSize: '0.72rem', color: MUTED, marginTop: -6 }}>
                Currently {yearLabel}. Update your year level when you advance to a new school year.
              </p>

              <div className="flex items-center justify-between gap-3 pt-3.5" style={{ borderTop: `1px solid ${BORDER}` }}>
                <div className="flex items-center gap-3" style={{ minWidth: 0 }}>
                  <IconChip icon={KeyRound} />
                  <div style={{ minWidth: 0 }}>
                    <p style={{ ...sans, fontSize: '0.84rem', fontWeight: 700, color: INK }}>Password</p>
                    <p style={{ ...sans, fontSize: '0.72rem', color: MUTED }}>Change the password you use to log in.</p>
                  </div>
                </div>
                <button type="button" className="ss-btn flex-shrink-0" onClick={() => { setPwOpen(true); setPwFeedback(null); }} style={ghostBtn(false)}>
                  <KeyRound size={14} /> Change Password
                </button>
              </div>

            </div>
          )}
        </Card>

        {settingsFeedback && <Banner tone={settingsFeedback.tone}>{settingsFeedback.text}</Banner>}

        {/* ── Notification Preferences ── */}
        <Card id="notifications" icon={Bell} title="Notification Preferences"
          description="Choose which alerts you want to receive. Saved on this browser only."
          footer={
            <>
              <button type="button" className="ss-btn" disabled={!settingsDirty || settingsSaving} onClick={resetSettings} style={ghostBtn(!settingsDirty || settingsSaving)}>Reset to Saved</button>
              <button
                type="button"
                className="ss-btn"
                disabled={!canSave}
                onClick={() => { setConfirmOpen(true); setConfirmPassword(''); setConfirmError(''); }}
                style={primaryBtn(!canSave)}
              >
                <Save size={14} /> Save Preferences
              </button>
            </>
          }>
          <div className="grid grid-cols-1 gap-x-10 lg:grid-cols-2">
            {NOTIF_EVENTS.map(ev => (
              <div key={ev.key} className="ss-nrow flex items-center gap-3 py-2.5">
                <IconChip icon={ev.icon} />
                <div className="flex-1" style={{ minWidth: 0 }}>
                  <p style={{ ...sans, fontSize: '0.84rem', fontWeight: 700, color: INK }}>{ev.label}</p>
                  <p style={{ ...sans, fontSize: '0.72rem', color: MUTED }}>{ev.note}</p>
                </div>
                <Toggle checked={!!notifDraft[ev.key]} label={ev.label} disabled={settingsSaving}
                  onChange={v => { setNotifDraft(d => ({ ...d, [ev.key]: v })); setSettingsFeedback(null); }} />
              </div>
            ))}
          </div>
        </Card>
      </div>

      {confirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(36,21,18,0.5)' }}
          onMouseDown={event => { if (event.target === event.currentTarget) closeSettingsConfirmation(); }}
        >
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="ss-confirm-title"
            onSubmit={confirmSettingsSave}
            className="w-full"
            style={{ ...tile, maxWidth: 420, padding: 20, boxShadow: '0 28px 60px -24px rgba(36,21,18,0.5)' }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <IconChip icon={Lock} size={38} />
                <div>
                  <h2 id="ss-confirm-title" style={{ ...serif, fontSize: '1.08rem', fontWeight: 700, color: INK }}>Confirm your password</h2>
                  <p style={{ ...sans, fontSize: '0.74rem', color: MUTED, marginTop: 2 }}>Enter your current password to save these preferences.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeSettingsConfirmation}
                disabled={confirmBusy || settingsSaving}
                aria-label="Close"
                className="ss-btn"
                style={{ ...ghostBtn(confirmBusy || settingsSaving), padding: 0, width: 34, height: 34, borderColor: BORDER, color: MUTED }}
              >
                <X size={15} />
              </button>
            </div>
            <div style={{ marginTop: 16 }}>
              <IconInput id="ss-confirm-current-password" icon={Lock} label="Current Password">
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
            {confirmError && (
              <p role="alert" style={{ ...sans, color: DANGER, background: `${DANGER}12`, border: `1px solid ${DANGER}44`, borderRadius: 10, padding: '8px 12px', marginTop: 12, fontSize: '0.78rem' }}>
                {confirmError}
              </p>
            )}
            <div className="flex justify-end gap-2" style={{ marginTop: 18 }}>
              <button type="button" onClick={closeSettingsConfirmation} disabled={confirmBusy || settingsSaving} className="ss-btn" style={ghostBtn(confirmBusy || settingsSaving)}>Cancel</button>
              <button type="submit" disabled={confirmBusy || settingsSaving || !confirmPassword} className="ss-btn" style={primaryBtn(confirmBusy || settingsSaving || !confirmPassword)}>
                {confirmBusy || settingsSaving ? 'Saving…' : 'Confirm & Save'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Change Password modal ── */}
      {pwOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(36,21,18,0.5)' }} onClick={closePasswordModal}>
          <div role="dialog" aria-modal="true" aria-labelledby="ss-pw-title" onClick={e => e.stopPropagation()} className="flex w-full flex-col"
            style={{ ...tile, maxWidth: 440, maxHeight: '90vh', overflow: 'hidden', boxShadow: '0 28px 60px -24px rgba(36,21,18,0.5)' }}>
            <div className="flex flex-shrink-0 items-start justify-between gap-3" style={{ padding: '18px 20px', borderBottom: `1px solid ${BORDER}` }}>
              <div className="flex items-start gap-3">
                <IconChip icon={KeyRound} size={38} />
                <div>
                  <h2 id="ss-pw-title" style={{ ...serif, fontSize: '1.08rem', fontWeight: 700, color: INK }}>Change Password</h2>
                  <p style={{ ...sans, fontSize: '0.74rem', color: MUTED, marginTop: 2 }}>Enter your current password, then choose a new one.</p>
                </div>
              </div>
              <button type="button" onClick={closePasswordModal} disabled={pwSaving} aria-label="Close" className="ss-btn"
                style={{ ...ghostBtn(pwSaving), padding: 0, width: 36, height: 36, borderColor: BORDER, color: MUTED }}><X size={15} /></button>
            </div>

            <div className="flex flex-col gap-3.5 overflow-y-auto" style={{ padding: 20 }}>
              {pwInput('current', 'ss-pw-current', 'Current Password', 'current-password')}
              {pwInput('next', 'ss-pw-new', 'New Password', 'new-password', pwErrors.next)}
              {pw.next && (
                <div aria-live="polite">
                  <div className="flex items-center gap-1.5" aria-hidden>
                    {[1, 2, 3, 4].map(i => <span key={i} style={{ flex: 1, height: 5, borderRadius: 999, background: i <= strength ? BRONZE : BORDER, transition: 'background 120ms' }} />)}
                  </div>
                  <p style={{ ...sans, fontSize: '0.7rem', color: MUTED, marginTop: 4 }}>Password strength: <strong style={{ color: BRONZE }}>{strengthLabel}</strong></p>
                </div>
              )}
              {pwInput('confirm', 'ss-pw-confirm', 'Confirm New Password', 'new-password', pwErrors.confirm)}
              <div style={{ background: BLUSH, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '10px 12px' }}>
                <p style={{ ...sans, fontSize: '0.72rem', fontWeight: 700, color: DEEP, marginBottom: 6 }}>Password requirements</p>
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

            <div className="flex flex-shrink-0 justify-end gap-2.5" style={{ padding: '14px 20px', borderTop: `1px solid ${BORDER}` }}>
              <button type="button" className="ss-btn" onClick={closePasswordModal} disabled={pwSaving} style={ghostBtn(pwSaving)}>Cancel</button>
              <button type="button" className="ss-btn" onClick={savePassword} disabled={!pwReady || pwSaving} style={primaryBtn(!pwReady || pwSaving)}>{pwSaving ? 'Updating…' : 'Update Password'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScholarSettings;