import { API_ORIGIN } from '../../utils/apiConfig.js';
import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
  QrCode, CheckCircle2, X, Users, ListChecks,
  Search, Clock, Hourglass, XCircle,
  RefreshCw, Printer, CalendarClock, CalendarDays, MapPin, AlertCircle, ChevronDown, LogOut, UserX,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { formatYearLevelLabel } from '../../utils/yearLevelLabels';

const API = `${API_ORIGIN}/api`;
const token = () => localStorage.getItem('token');
const authHeaders = () => ({ headers: { Authorization: `Bearer ${token()}` } });

// ── Design tokens — Apple Scholar premium system ──
const BG = '#F3EEE6';
const CARD = '#FFFDF9';
const BORDER = '#E7D8C7';
const MAROON = '#6D2140';
const GOLD = '#A9784E';
const INK = '#241512';
const MUTED = '#8A7A68';
const SUCCESS = '#3F8A55';
const SUCCESS_BG = '#EAF6EC';
const AMBER = '#C77F1F';
const AMBER_BG = '#FBF1DF';
const CLAY = '#C0473F';
const CLAY_BG = '#FBEAE8';
const RADIUS = 16;

const display = { fontFamily: "'Lora', Georgia, 'Times New Roman', serif" };
const body = { fontFamily: "'Inter', 'Segoe UI', sans-serif" };
const mono = { fontFamily: "'IBM Plex Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace" };

const cardShadow = { boxShadow: '0 12px 28px -20px rgba(36,21,18,0.22)' };
const cardWrap = { background: CARD, border: `1px solid ${BORDER}`, borderRadius: RADIUS, ...cardShadow, overflow: 'hidden' };
const bordField = { width: '100%', padding: '10px 12px', border: `1px solid ${BORDER}`, borderRadius: 10, backgroundColor: '#fff', ...body, fontSize: '0.85rem', color: INK, outline: 'none', appearance: 'none', cursor: 'pointer' };
const fieldLabel = { ...body, fontSize: '0.72rem', fontWeight: 600, color: INK, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 };
const solidBtn = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px 0', border: 'none', borderRadius: 10, background: MAROON, color: '#fff', ...body, fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', width: '100%' };

const iconBadge = (color) => ({ width: 36, height: 36, borderRadius: 11, background: `${color}16`, color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 });

const initials = (name = '') =>
  name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();

// Presentation-only: "13:00" / "13:00:00" -> "01:00 PM". Falls back to the raw value.
const formatTime = (value) => {
  if (!value) return '';
  const match = String(value).match(/^(\d{1,2}):(\d{2})/);
  if (!match) return String(value);
  const h = Number(match[1]);
  if (Number.isNaN(h) || h > 23) return String(value);
  return `${String(h % 12 === 0 ? 12 : h % 12).padStart(2, '0')}:${match[2]} ${h >= 12 ? 'PM' : 'AM'}`;
};

// Accepts an ISO string, Date or timestamp. Never renders "Invalid Date".
const formatAttendanceTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
};

const getDutyEndTimestamp = (duty, extraHours = 0) => {
  if (!duty?.duty_date) return null;
  const dutyDate = duty.duty_date instanceof Date
    ? duty.duty_date
    : /^\d{4}-\d{2}-\d{2}$/.test(String(duty.duty_date))
      ? new Date(`${duty.duty_date}T00:00:00`)
      : new Date(duty.duty_date);
  if (Number.isNaN(dutyDate.getTime())) return null;
  const year = dutyDate.getFullYear();
  const month = dutyDate.getMonth() + 1;
  const day = dutyDate.getDate();
  const [hours, minutes, seconds = 0] = String(duty.time_end || '23:59:59').split(':').map(Number);
  const endTime = new Date(year, month - 1, day, hours, minutes, seconds + extraHours * 60 * 60).getTime();
  return Number.isFinite(endTime) ? endTime : null;
};

const getCheckInLockTimestamp = (duty) => {
  if (!duty?.duty_date) return null;
  const dutyDate = duty.duty_date instanceof Date
    ? duty.duty_date
    : /^\d{4}-\d{2}-\d{2}$/.test(String(duty.duty_date))
      ? new Date(`${duty.duty_date}T00:00:00`)
      : new Date(duty.duty_date);
  if (Number.isNaN(dutyDate.getTime())) return null;
  const [hours, minutes, seconds = 0] = String(duty.time_start || '00:00:00').split(':').map(Number);
  const lockTime = new Date(
    dutyDate.getFullYear(),
    dutyDate.getMonth(),
    dutyDate.getDate(),
    hours,
    minutes,
    seconds + 3 * 60 * 60
  ).getTime();
  return Number.isFinite(lockTime) ? lockTime : null;
};

const hasDutyEnded = (duty, now = Date.now()) => {
  const lockTime = getDutyEndTimestamp(duty, 3);
  return lockTime !== null && now >= lockTime;
};

const STATUS_STAMPS = [
  { key: 'present', label: 'Present', short: 'P', icon: <CheckCircle2 size={12} />, color: SUCCESS },
  { key: 'late',    label: 'Late',    short: 'L', icon: <Clock size={12} />,       color: AMBER },
  { key: 'absent',  label: 'Absent',  short: 'A', icon: <X size={12} />,            color: CLAY },
];

const ROSTER_PAGE_SIZE = 8;

// Duties that already finished stay selectable in the Manual tab for this many days,
// because check-out only opens once the scheduled duty has ended.
const CHECKOUT_WINDOW_DAYS = 3;

// ---------------------------------------------------------------------------
// Presentational-only helpers
// ---------------------------------------------------------------------------

const KPICard = ({ icon: Icon, label, value, accent, sub, progress }) => (
  <div className="min-w-0 h-full" style={{ ...cardWrap, padding: 'clamp(14px, 3vw, 18px)' }}>
    <div className="flex items-center gap-3 sm:gap-4">
      <div className="flex items-center justify-center flex-shrink-0" style={{ width: 46, height: 46, borderRadius: 13, background: `${accent}16`, color: accent }}>
        <Icon size={20} />
      </div>
      <div className="min-w-0 flex-1">
        <p style={{ ...display, fontSize: 'clamp(1.35rem, 4vw, 1.7rem)', fontWeight: 700, color: MAROON, lineHeight: 1 }}>{value}</p>
        <p style={{ ...body, fontSize: '0.78rem', color: MUTED, marginTop: 5 }}>{label}</p>
      </div>
    </div>
    {sub && (
      <div style={{ marginTop: 12 }}>
        {progress !== undefined && (
          <div style={{ height: 5, background: `${accent}1f`, borderRadius: 3, overflow: 'hidden', marginBottom: 5 }}>
            <div style={{ height: '100%', width: `${progress}%`, background: accent, borderRadius: 3, transition: 'width 0.5s' }} />
          </div>
        )}
        <p style={{ ...body, fontSize: '0.7rem', color: accent, fontWeight: 600 }}>{sub}</p>
      </div>
    )}
  </div>
);

const StatusBadge = ({ status, checkedOut = false }) => {
  const normalizedStatus = status === 'excused' ? 'absent' : status;
  const map = {
    present: { label: 'Checked In', color: SUCCESS, background: SUCCESS_BG },
    late:    { label: 'Late',       color: AMBER,   background: AMBER_BG },
    absent:  { label: 'Absent',     color: CLAY,    background: CLAY_BG },
  };
  const isCheckedOut = checkedOut && (normalizedStatus === 'present' || normalizedStatus === 'late');
  const cfg = isCheckedOut
    ? { label: 'Checked Out', color: MAROON, background: `${MAROON}12` }
    : (map[normalizedStatus] || { label: 'Waiting', color: MUTED, background: BG });
  return (
    <span style={{ ...body, fontSize: '0.68rem', fontWeight: 700, borderRadius: 999, padding: '4px 12px', background: cfg.background, color: cfg.color, whiteSpace: 'nowrap', display: 'inline-block' }}>
      {cfg.label}
    </span>
  );
};

const SectionHead = ({ icon: Icon, title, subtitle, color = MAROON }) => (
  <div className="flex items-center gap-3 min-w-0">
    <span style={iconBadge(color)}><Icon size={17} /></span>
    <div className="min-w-0">
      <h2 style={{ ...display, fontSize: '1.05rem', fontWeight: 600, color: INK }}>{title}</h2>
      {subtitle && <p style={{ ...body, fontSize: '0.74rem', color: MUTED, marginTop: 2 }}>{subtitle}</p>}
    </div>
  </div>
);

const Banner = ({ tone = 'warning', icon: Icon, children }) => {
  const map = { danger: [CLAY, CLAY_BG], success: [SUCCESS, SUCCESS_BG], warning: [AMBER, AMBER_BG] };
  const [color, bg] = map[tone] || map.warning;
  return (
    <div role="status" style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 14px', borderRadius: 10, borderLeft: `3px solid ${color}`, background: bg, color, ...body, fontSize: '0.78rem', fontWeight: 600, lineHeight: 1.5 }}>
      {Icon && <Icon size={15} style={{ flexShrink: 0, marginTop: 2 }} />}
      <span>{children}</span>
    </div>
  );
};

const EmptyBlock = ({ icon: Icon, title, hint, pad = 48 }) => (
  <div className="da-empty" style={{ padding: `${pad}px 20px` }}>
    <span className="da-empty-icon"><Icon size={22} /></span>
    <p style={{ ...body, fontSize: '0.88rem', fontWeight: 700, color: INK }}>{title}</p>
    {hint && <p style={{ ...body, fontSize: '0.78rem', color: MUTED, marginTop: 3 }}>{hint}</p>}
  </div>
);

const StatTile = ({ label, value, color }) => (
  <div style={{ background: `${color}10`, border: `1px solid ${color}30`, borderRadius: 12, padding: '10px 14px', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
    <span style={{ ...body, fontSize: '0.74rem', fontWeight: 600, color }}>{label}</span>
    <span style={{ ...display, fontSize: '1.3rem', fontWeight: 700, color }}>{value}</span>
  </div>
);

const MetaCell = ({ label, value }) => (
  <div className="min-w-0">
    <p style={{ ...body, fontSize: '0.64rem', fontWeight: 600, color: MUTED }}>{label}</p>
    <p className="truncate" style={{ ...mono, fontSize: '0.72rem', color: INK, marginTop: 2 }}>{value}</p>
  </div>
);

const StaffDutyAttendance = () => {
  const [duties, setDuties] = useState([]);
  const [recentCompleted, setRecentCompleted] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [subTab, setSubTab] = useState('qr');

  const [qrDuty, setQrDuty] = useState('');
  const [dutyQR, setDutyQR] = useState(null);
  const [qrScholars, setQrScholars] = useState([]);
  const [qrLoading, setQrLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [manualDuty, setManualDuty] = useState('');
  const [scholars, setScholars] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [saveMsg, setSaveMsg] = useState('');
  const [savingScholarId, setSavingScholarId] = useState('');
  const [checkingOutScholar, setCheckingOutScholar] = useState('');

  // ---- Check-Out tab (separate from manual check-in) ----
  const [outDuty, setOutDuty] = useState('');
  const [outScholars, setOutScholars] = useState([]);
  const [outLoading, setOutLoading] = useState(false);
  const [outRefreshing, setOutRefreshing] = useState(false);
  const [outSearch, setOutSearch] = useState('');
  const [outFeedback, setOutFeedback] = useState(null); // { tone: 'success' | 'error', text }
  const [manualLoading, setManualLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  // ---- Presentation-only: roster search, status filter and pagination over
  // the already-loaded live roster (qrScholars). No extra requests.
  const [rosterSearch, setRosterSearch] = useState('');
  const [rosterFilter, setRosterFilter] = useState('all');
  const [rosterPage, setRosterPage] = useState(1);
  const [makeupSources, setMakeupSources] = useState([]);
  const [makeupOpen, setMakeupOpen] = useState(true);
  const [makeupLoading, setMakeupLoading] = useState(true);
  const [makeupRefreshing, setMakeupRefreshing] = useState(false);
  const [makeupError, setMakeupError] = useState('');

  const fetchMakeupRequestData = async (isManualRefresh = false) => {
    if (isManualRefresh) setMakeupRefreshing(true);
    try {
      const res = await axios.get(`${API}/staff/makeup-request-data`, authHeaders());
      setMakeupSources(res.data.sources || []);
      setMakeupError('');
    } catch (err) {
      console.error('Failed to fetch make-up duty requests:', err);
      setMakeupError(err.response?.data?.error || 'Unable to load make-up duty requests.');
    } finally {
      setMakeupLoading(false);
      if (isManualRefresh) setMakeupRefreshing(false);
    }
  };

  useEffect(() => {
    let active = true;
    const loadMakeupRequestData = () => {
      axios.get(`${API}/staff/makeup-request-data`, authHeaders())
        .then(res => {
          if (!active) return;
          setMakeupSources(res.data.sources || []);
          setMakeupError('');
        })
        .catch(err => {
          if (!active) return;
          console.error('Failed to fetch make-up duty requests:', err);
          setMakeupError(err.response?.data?.error || 'Unable to load make-up duty requests.');
        })
        .finally(() => {
          if (active) setMakeupLoading(false);
        });
    };

    loadMakeupRequestData();
    const intervalId = setInterval(loadMakeupRequestData, 60 * 1000);
    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    axios.get(`${API}/duties`, authHeaders())
      .then(res => {
        const all = Array.isArray(res.data) ? res.data : [];
        setDuties(all.filter(d => d.status === 'upcoming' || d.status === 'ongoing'));
        // Check-out only opens after a duty ends, so recently finished duties must stay reachable.
        const cutoff = Date.now() - CHECKOUT_WINDOW_DAYS * 24 * 60 * 60 * 1000;
        setRecentCompleted(all.filter(d => d.status === 'completed' && (getDutyEndTimestamp(d) ?? 0) >= cutoff));
      })
      .catch(err => console.error('Failed to fetch duties:', err));

    axios.get(`${API}/staff/reports/duty-attendance`, authHeaders())
      .then(res => setAttendanceRecords(Array.isArray(res.data) ? res.data : []))
      .catch(err => console.error('Failed to fetch attendance follow-up records:', err));
  }, []);

  useEffect(() => {
    const initializeTimeout = setTimeout(() => setCurrentTime(Date.now()), 0);
    const intervalId = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => {
      clearTimeout(initializeTimeout);
      clearInterval(intervalId);
    };
  }, []);

  useEffect(() => { setRosterPage(1); setRosterFilter('all'); setRosterSearch(''); }, [qrDuty]);

  const loadQRDuty = async (dutyId) => {
    setQrDuty(dutyId);
    setDutyQR(null);
    setQrScholars([]);
    if (!dutyId) return;
    setQrLoading(true);
    try {
      const [qrRes, scholarsRes] = await Promise.all([
        axios.get(`${API}/staff/duties/${dutyId}/qr`, authHeaders()),
        axios.get(`${API}/staff/duties/${dutyId}/scholars`, authHeaders()),
      ]);
      setDutyQR(qrRes.data);
      setQrScholars(scholarsRes.data);
    } catch (err) {
      console.error('Failed to load duty QR/scholars:', err);
    } finally {
      setQrLoading(false);
    }
  };

  const refreshQRScholars = async () => {
    if (!qrDuty) return;
    setRefreshing(true);
    try {
      const res = await axios.get(`${API}/staff/duties/${qrDuty}/scholars`, authHeaders());
      setQrScholars(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setTimeout(() => setRefreshing(false), 400);
    }
  };

  useEffect(() => {
    if (!qrDuty) return undefined;
    const intervalId = setInterval(async () => {
      try {
        const res = await axios.get(`${API}/staff/duties/${qrDuty}/scholars`, authHeaders());
        setQrScholars(res.data);
      } catch (err) {
        console.error(`Failed to refresh attendance for duty ${qrDuty}:`, err);
      }
    }, 60 * 1000);
    return () => clearInterval(intervalId);
  }, [qrDuty]);

  const handlePrintQR = () => {
    if (!dutyQR) return;
    const svgEl = document.getElementById('duty-qr-svg');
    if (!svgEl) return;
    const svgData = new XMLSerializer().serializeToString(svgEl);

    const printWindow = window.open('', '_blank', 'width=500,height=650');
    printWindow.document.write(`
      <html>
        <head>
          <title>Duty QR Code — ${dutyQR.title}</title>
          <style>
            body { font-family: 'DM Sans', Arial, sans-serif; display: flex; flex-direction: column;
                   align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
            h2 { color: #6D2140; margin-bottom: 4px; }
            p { color: #64748b; font-size: 13px; margin: 2px 0 20px; }
            .box { border: 2px dashed #A9784E; border-radius: 16px; padding: 24px; }
          </style>
        </head>
        <body>
          <h2>${dutyQR.title}</h2>
          <p>${new Date(dutyQR.duty_date).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}${dutyQR.location ? ' • ' + dutyQR.location : ''}</p>
          <div class="box">${svgData}</div>
          <p style="margin-top:20px;">I-scan gamit ang Apple Scholar app para mag-check-in. I-scan muli ang parehong QR pagkatapos ng duty para mag-check-out. Para sa make-up duty, mag-check-out isang oras pagkatapos ng nakatakdang oras ng pagtatapos.</p>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 250);
  };

  const checkedIn = qrScholars.filter(s => s.attendance_status === 'present' || s.attendance_status === 'late');
  const notYet = qrScholars.filter(s => s.attendance_status !== 'present' && s.attendance_status !== 'late');
  const qrPercent = qrScholars.length ? Math.round((checkedIn.length / qrScholars.length) * 100) : 0;

  const loadScholars = async (dutyId) => {
    setManualDuty(dutyId);
    setAttendance({});
    setSearchQuery('');
    setSaveMsg('');
    if (!dutyId) { setScholars([]); return; }
    setManualLoading(true);
    try {
      const res = await axios.get(`${API}/staff/duties/${dutyId}/scholars`, authHeaders());
      const list = res.data;
      setScholars(list);
      const init = {};
      list.forEach(s => { init[s.scholar_id] = s.attendance_status || null; });
      setAttendance(init);
    } catch (err) {
      console.error('Failed to fetch scholars:', err);
    } finally {
      setManualLoading(false);
    }
  };

  const refreshManualScholars = async (dutyId) => {
    const res = await axios.get(`${API}/staff/duties/${dutyId}/scholars`, authHeaders());
    const list = res.data;
    setScholars(list);
    setAttendance(previous => {
      const next = { ...previous };
      list.forEach(scholar => {
        if (scholar.attendance_status) {
          next[scholar.scholar_id] = scholar.attendance_status === 'excused' ? 'absent' : scholar.attendance_status;
        }
      });
      return next;
    });
    return list;
  };

  useEffect(() => {
    if (subTab !== 'manual' || !manualDuty) return undefined;
    const intervalId = setInterval(() => {
      refreshManualScholars(manualDuty).catch(err =>
        console.error(`Failed to refresh manual attendance for duty ${manualDuty}:`, err)
      );
    }, 60 * 1000);
    return () => clearInterval(intervalId);
  }, [subTab, manualDuty]);

  // ---- Check-Out tab: load / refresh the roster of the selected duty ----
  const loadOutScholars = async (dutyId) => {
    setOutDuty(dutyId);
    setOutScholars([]);
    setOutSearch('');
    setOutFeedback(null);
    if (!dutyId) return;
    setOutLoading(true);
    try {
      const res = await axios.get(`${API}/staff/duties/${dutyId}/scholars`, authHeaders());
      setOutScholars(res.data);
    } catch (err) {
      console.error('Failed to load scholars for check-out:', err);
      setOutFeedback({ tone: 'error', text: 'Unable to load the scholars for this duty.' });
    } finally {
      setOutLoading(false);
    }
  };

  const refreshOutScholars = async (dutyId) => {
    const res = await axios.get(`${API}/staff/duties/${dutyId}/scholars`, authHeaders());
    setOutScholars(res.data);
  };

  const setScholarStatus = async (scholarId, status) => {
    const scholar = scholars.find(item => item.scholar_id === scholarId);
    if (!manualDuty || manualCheckInLocked || scholar?.attendance_status || savingScholarId) return;
    setSavingScholarId(scholarId);
    setSaveMsg('');
    try {
      const response = await axios.post(`${API}/staff/duties/${manualDuty}/attendance/bulk`, {
        records: [{ scholar_id: scholarId, status, method: 'manual' }],
      }, authHeaders());
      const refreshedScholars = await refreshManualScholars(manualDuty);
      const savedStatus = response.data?.records?.find(record => record.scholar_id === scholarId)?.status
        || refreshedScholars.find(record => record.scholar_id === scholarId)?.attendance_status
        || status;
      setSaveMsg(`${scholar?.full_name || scholarId} saved as ${savedStatus}.`);
      setTimeout(() => setSaveMsg(''), 3500);
    } catch (err) {
      setSaveMsg(err.response?.data?.error
        ? `Error: ${err.response.data.error}`
        : 'Error saving. Please try again.');
    } finally {
      setSavingScholarId('');
    }
  };

  const checkOutScholar = async (scholarId) => {
    if (!outDuty) return;
    setCheckingOutScholar(scholarId);
    setOutFeedback(null);
    try {
      await axios.post(
        `${API}/staff/duties/${outDuty}/attendance/${encodeURIComponent(scholarId)}/checkout`,
        {},
        authHeaders()
      );
      setOutFeedback({ tone: 'success', text: 'Scholar checked out successfully.' });
      try {
        await refreshOutScholars(outDuty);
      } catch (refreshErr) {
        console.error('Check-out saved, but the roster could not refresh:', refreshErr);
        setOutFeedback({ tone: 'error', text: 'Scholar checked out, but the list could not refresh. Press the refresh button.' });
      }
    } catch (err) {
      setOutFeedback({ tone: 'error', text: err.response?.data?.error || 'Unable to record check-out. Please try again.' });
    } finally {
      setCheckingOutScholar('');
    }
  };

  const reloadOutScholars = async () => {
    if (!outDuty) return;
    setOutRefreshing(true);
    try {
      await refreshOutScholars(outDuty);
    } catch (err) {
      console.error(err);
    } finally {
      setTimeout(() => setOutRefreshing(false), 400);
    }
  };

  // Keep the Check-Out list fresh (scholars may also check out by QR).
  useEffect(() => {
    if (subTab !== 'checkout' || !outDuty) return undefined;
    const intervalId = setInterval(() => {
      refreshOutScholars(outDuty).catch(err => console.error(`Failed to refresh check-out list for duty ${outDuty}:`, err));
    }, 60 * 1000);
    return () => clearInterval(intervalId);
  }, [subTab, outDuty]);

  const filteredScholars = scholars.filter(s =>
    s.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.scholar_id?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const scholarCounts = {
    present: Object.values(attendance).filter(v => v === 'present').length,
    late:    Object.values(attendance).filter(v => v === 'late').length,
    absent:  Object.values(attendance).filter(v => v === 'absent').length,
  };

  const manualDuties = [...duties, ...recentCompleted];

  const dutySelect = (value, onChange, ariaLabel, placeholder = '-- Select a duty --', list = duties) => (
    <select value={value} onChange={e => onChange(e.target.value)} aria-label={ariaLabel} className="da-select" style={bordField}>
      <option value="">{placeholder}</option>
      {list.map(d => (
        <option key={d.id} value={d.id}>
          {d.title} — {new Date(d.duty_date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
          {d.status === 'completed'
            ? ' (Completed)'
            : currentTime && hasDutyEnded(d, currentTime) ? ' (Attendance locked)' : ''}
        </option>
      ))}
    </select>
  );

  // ---- Presentation-only derived values for KPIs, roster search/filter/pagination ----
  const rosterMatches = (s) => !rosterSearch.trim() ||
    s.full_name?.toLowerCase().includes(rosterSearch.toLowerCase()) ||
    s.scholar_id?.toLowerCase().includes(rosterSearch.toLowerCase());

  const filteredRoster = {
    checkedIn: checkedIn.filter(rosterMatches),
    notYet: notYet.filter(rosterMatches),
  };

  const lateCount = qrScholars.filter(s => s.attendance_status === 'late').length;
  const absentCount = qrScholars.filter(s => s.attendance_status === 'absent' || s.attendance_status === 'excused').length;
  const pct = (n) => (qrScholars.length ? Math.round((n / qrScholars.length) * 1000) / 10 : 0);

  const ROSTER_FILTERS = [
    { key: 'all',     label: 'All',            count: qrScholars.length, dot: MAROON,  match: () => true },
    { key: 'present', label: 'Checked In',     count: qrScholars.filter(s => s.attendance_status === 'present').length, dot: SUCCESS, match: s => s.attendance_status === 'present' },
    { key: 'late',    label: 'Late',           count: lateCount,         dot: AMBER,   match: s => s.attendance_status === 'late' },
    { key: 'absent',  label: 'Absent',         count: absentCount,        dot: CLAY,   match: s => s.attendance_status === 'absent' || s.attendance_status === 'excused' },
  ];
  const activeFilter = ROSTER_FILTERS.find(f => f.key === rosterFilter) || ROSTER_FILTERS[0];

  const rosterRows = [...filteredRoster.checkedIn, ...filteredRoster.notYet].filter(activeFilter.match);
  const totalPages = Math.max(1, Math.ceil(rosterRows.length / ROSTER_PAGE_SIZE));
  const currentPage = Math.min(rosterPage, totalPages);
  const pageStart = (currentPage - 1) * ROSTER_PAGE_SIZE;
  const pagedRows = rosterRows.slice(pageStart, pageStart + ROSTER_PAGE_SIZE);

  const selectedDuty = duties.find(d => String(d.id) === String(qrDuty));
  const selectedManualDuty = manualDuties.find(d => String(d.id) === String(manualDuty));
  const manualCheckInLockTime = getCheckInLockTimestamp(selectedManualDuty);
  const manualCheckInLocked = Boolean(selectedManualDuty && (
    !currentTime || (manualCheckInLockTime !== null && currentTime >= manualCheckInLockTime)
  ));
  const qrCheckInLockTime = getCheckInLockTimestamp(selectedDuty);
  const qrCheckInLocked = Boolean(selectedDuty && currentTime > 0
    && qrCheckInLockTime !== null && currentTime >= qrCheckInLockTime);
  // ---- Check-Out tab derived values ----
  const selectedOutDuty = manualDuties.find(d => String(d.id) === String(outDuty));
  const outOpensAt = getDutyEndTimestamp(selectedOutDuty, 0);
  const outIsOpen = currentTime > 0 && outOpensAt !== null && currentTime >= outOpensAt;
  const outLocksAt = getDutyEndTimestamp(selectedOutDuty, 3);
  const outIsLocked = currentTime > 0 && outLocksAt !== null && currentTime >= outLocksAt;
  const outCheckedIn = outScholars.filter(s => ['present', 'late'].includes(s.attendance_status));
  const outDoneCount = outCheckedIn.filter(s => s.check_out_at).length;
  const outRows = outCheckedIn.filter(s =>
    !outSearch.trim() ||
    s.full_name?.toLowerCase().includes(outSearch.toLowerCase()) ||
    s.scholar_id?.toLowerCase().includes(outSearch.toLowerCase())
  );

  const followUp = useMemo(() => {
    const counts = new Map();
    attendanceRecords.forEach(record => {
      if (String(record.status || '').toLowerCase() !== 'absent') return;
      const key = `${record.scholar || 'Unknown'}::${record.scholar_id || '—'}`;
      if (!counts.has(key)) {
        counts.set(key, {
          name: record.scholar || 'Unknown Scholar',
          scholarId: record.scholar_id || '—',
          count: 0,
        });
      }
      counts.get(key).count += 1;
    });
    return [...counts.values()].sort((a, b) => b.count - a.count).slice(0, 4);
  }, [attendanceRecords]);

  const thStyle = { ...body, fontSize: '0.72rem', fontWeight: 600, color: MUTED, textAlign: 'left', padding: '11px 12px', borderBottom: `1px solid ${BORDER}`, background: '#FCFAF5', whiteSpace: 'nowrap' };
  const tdStyle = { ...body, fontSize: '0.78rem', color: INK, padding: '10px 12px', borderBottom: `1px solid ${BORDER}`, verticalAlign: 'middle' };

  const searchBox = (value, onChange, label) => (
    <div className="da-search">
      <Search size={14} style={{ color: MUTED, flexShrink: 0 }} aria-hidden="true" />
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder="Name or scholar ID…"
        aria-label={label}
        style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'none', ...body, fontSize: '0.85rem', color: INK }}
      />
    </div>
  );

  const iconBtn = (onClick, label, spinning) => (
    <button type="button" onClick={onClick} aria-label={label} className="da-icon-btn">
      <RefreshCw size={15} className={spinning ? 'animate-spin' : ''} />
    </button>
  );

  const TABS = [
    { key: 'qr',       label: 'QR check-in / out', short: 'QR',        icon: QrCode },
    { key: 'manual',   label: 'Manual check-in',   short: 'Check-in',  icon: ListChecks },
    { key: 'checkout', label: 'Manual check-out',  short: 'Check-out', icon: LogOut },
  ];

  return (
    <div className="da-hub" style={{ background: BG, ...body }}>
      <div className="da-inner">

        {/* ── Standard Staff page header ── */}
        <div className="mb-5">
          <div className="staff-page-header-card flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 min-w-0" style={{ ...cardWrap, padding: 'clamp(14px, 3vw, 20px)' }}>
            <div className="min-w-0">
              <p className="staff-page-eyebrow">STAFF PORTAL</p>
              <h1 className="staff-page-title">Duty Attendance</h1>
              <p className="staff-page-description">
                Record and monitor scholar attendance for assigned duties.
              </p>
            </div>
          </div>

        </div>

        {/* ── KPI cards (real counts from the loaded roster) ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 mb-5">
          <KPICard icon={Users} label="Assigned scholars" value={qrScholars.length || '—'} accent={MAROON}
            sub={qrScholars.length ? 'On the selected duty' : 'Select a duty to load'} />
          <KPICard icon={CheckCircle2} label="Checked in" value={qrScholars.length ? checkedIn.length : '—'} accent={SUCCESS}
            sub={qrScholars.length ? `${qrPercent}% attendance rate` : undefined} progress={qrScholars.length ? qrPercent : undefined} />
          <KPICard icon={Hourglass} label="Late" value={qrScholars.length ? lateCount : '—'} accent={AMBER}
            sub={qrScholars.length ? `${pct(lateCount)}% of roster` : undefined} progress={qrScholars.length ? pct(lateCount) : undefined} />
          <KPICard icon={XCircle} label="Absent" value={qrScholars.length ? absentCount : '—'} accent={CLAY}
            sub={qrScholars.length ? `${pct(absentCount)}% of roster` : undefined} progress={qrScholars.length ? pct(absentCount) : undefined} />
        </div>

        {/* ── Workspace: underline tabs, then a duty bar, then the work area ── */}
        <section style={{ ...cardWrap }}>
          <div role="tablist" aria-label="Attendance mode" className="da-tabs">
            {TABS.map(t => {
              const Icon = t.icon;
              const active = subTab === t.key;
              return (
                <button key={t.key} type="button" role="tab" id={`tab-${t.key}`} aria-selected={active} aria-controls={`panel-${t.key}`}
                  onClick={() => setSubTab(t.key)} className={`da-tab ${active ? 'da-tab-active' : ''}`}>
                  <Icon size={16} />
                  <span className="da-tab-long">{t.label}</span>
                  <span className="da-tab-short">{t.short}</span>
                </button>
              );
            })}
          </div>

          <div className="da-body">

            {/* ═════════ QR CHECK-IN TAB ═════════ */}
            {subTab === 'qr' && (
              <div id="panel-qr" role="tabpanel" aria-labelledby="tab-qr" className="flex flex-col gap-4">
                <div className="da-bar">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={fieldLabel}><CalendarClock size={13} style={{ color: GOLD }} /> Duty schedule</span>
                    {dutySelect(qrDuty, loadQRDuty, 'Select duty for QR code')}
                  </div>
                </div>

                {qrCheckInLocked && (
                  <Banner tone="danger" icon={AlertCircle}>
                    QR check-in is locked three hours after the scheduled start. Scholars without attendance are automatically marked Absent and become available for admin make-up assignment.
                  </Banner>
                )}

                <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-4 items-start">

                  {/* LEFT — QR code and duty information */}
                  <div className="da-card min-w-0">
                    <SectionHead icon={QrCode} title="Duty QR code" subtitle="Scholars scan to check in, then scan again to check out." />
                    <div style={{ marginTop: 16 }}>
                      {qrLoading ? (
                        <div className="animate-pulse" style={{ background: `${BORDER}88`, height: 260, borderRadius: 12 }} />
                      ) : dutyQR ? (
                        <>
                          <div className="da-qr-frame">
                            <QRCodeSVG id="duty-qr-svg" value={dutyQR.qr_token} size={176} fgColor={GOLD} />
                          </div>

                          {/* Duty information (only fields returned by the existing endpoints) */}
                          <div style={{ marginTop: 14 }}>
                            <p style={{ ...display, fontSize: '1.05rem', fontWeight: 700, color: INK, wordBreak: 'break-word' }}>{dutyQR.title}</p>
                            <div className="da-info">
                              {dutyQR.duty_date && (
                                <span className="da-info-row">
                                  <CalendarDays size={14} style={{ color: GOLD, flexShrink: 0 }} />
                                  {new Date(dutyQR.duty_date).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}
                                </span>
                              )}
                              {selectedDuty?.time_start && (
                                <span className="da-info-row">
                                  <Clock size={14} style={{ color: GOLD, flexShrink: 0 }} />
                                  {formatTime(selectedDuty.time_start)}{selectedDuty.time_end ? ` – ${formatTime(selectedDuty.time_end)}` : ''}
                                </span>
                              )}
                              {dutyQR.location && (
                                <span className="da-info-row" style={{ alignItems: 'flex-start' }}>
                                  <MapPin size={14} style={{ color: GOLD, flexShrink: 0, marginTop: 2 }} />
                                  <span style={{ wordBreak: 'break-word' }}>{dutyQR.location}</span>
                                </span>
                              )}
                            </div>
                          </div>

                          <p style={{ ...body, fontSize: '0.74rem', color: MUTED, marginTop: 14, lineHeight: 1.55 }}>
                            I-print at i-post ito sa duty location. Ang scholar ang mag-sscan nito para mag-check-in.
                          </p>
                          <button type="button" onClick={handlePrintQR} style={{ ...solidBtn, marginTop: 14 }} className="da-hover">
                            <Printer size={15} /> Print QR code
                          </button>
                        </>
                      ) : (
                        <EmptyBlock icon={QrCode} title="Select a duty first" hint="Generate a QR code to begin attendance." pad={40} />
                      )}
                    </div>
                  </div>

                  {/* RIGHT — Live attendance */}
                  <div className="da-card min-w-0">
                    <div className="flex flex-col 2xl:flex-row 2xl:items-center 2xl:justify-between gap-3">
                      <SectionHead icon={Users} title="Live attendance" subtitle="Scholars assigned to the selected duty" />
                      {qrDuty && qrScholars.length > 0 && (
                        <div className="flex items-center gap-2 w-full 2xl:w-auto">
                          <div className="da-search flex-1 2xl:flex-none 2xl:w-64">
                            <Search size={14} style={{ color: MUTED, flexShrink: 0 }} aria-hidden="true" />
                            <input
                              type="text"
                              value={rosterSearch}
                              onChange={e => { setRosterSearch(e.target.value); setRosterPage(1); }}
                              placeholder="Search scholar name or ID…"
                              aria-label="Search live roster by name or ID"
                              style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'none', ...body, fontSize: '0.82rem', color: INK }}
                            />
                          </div>
                          {iconBtn(refreshQRScholars, 'Refresh live roster', refreshing)}
                        </div>
                      )}
                    </div>

                    {qrScholars.length === 0 ? (
                      <div style={{ marginTop: 16 }}>
                        <EmptyBlock icon={Users} title="No roster yet" hint="Select a duty to see who is assigned." pad={56} />
                      </div>
                    ) : (
                      <>
                        {/* Status filters */}
                        <div className="flex items-center gap-2 flex-wrap" role="group" aria-label="Filter roster by status" style={{ marginTop: 16 }}>
                          {ROSTER_FILTERS.map(f => {
                            const active = f.key === activeFilter.key;
                            return (
                              <button
                                key={f.key}
                                type="button"
                                aria-pressed={active}
                                onClick={() => { setRosterFilter(f.key); setRosterPage(1); }}
                                className="flex items-center gap-2 flex-shrink-0"
                                style={{
                                  ...body, fontSize: '0.74rem', fontWeight: 600, borderRadius: 999, padding: '6px 14px', cursor: 'pointer', whiteSpace: 'nowrap',
                                  border: `1px solid ${active ? MAROON : BORDER}`,
                                  background: active ? MAROON : '#fff',
                                  color: active ? '#fff' : INK,
                                }}
                              >
                                <span style={{ width: 7, height: 7, borderRadius: '50%', background: active ? '#fff' : f.dot, flexShrink: 0 }} />
                                {f.label} ({f.count})
                              </button>
                            );
                          })}
                        </div>

                        {/* Table */}
                        <div className="da-list" style={{ marginTop: 14 }}>
                          {rosterRows.length === 0 ? (
                            <div className="text-center" style={{ padding: '36px 16px' }}>
                              <p style={{ ...body, fontSize: '0.8rem', color: MUTED }}>
                                {rosterSearch.trim() ? `No scholars match "${rosterSearch}".` : 'No scholars in this status.'}
                              </p>
                            </div>
                          ) : (
                            <>
                            <div className="hidden md:block" style={{ overflowX: 'auto' }}>
                              <table style={{ width: '100%', minWidth: 600, borderCollapse: 'collapse' }}>
                                <thead>
                                  <tr>
                                    <th scope="col" style={{ ...thStyle, width: 40 }}>#</th>
                                    <th scope="col" style={thStyle}>Scholar</th>
                                    <th scope="col" style={thStyle}>Year level</th>
                                    <th scope="col" style={thStyle}>Time in</th>
                                    <th scope="col" style={thStyle}>Time out</th>
                                    <th scope="col" style={thStyle}>Status</th>
                                    <th scope="col" style={thStyle}>Make-up</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {pagedRows.map((s, i) => {
                                    const hasTime = (s.attendance_status === 'present' || s.attendance_status === 'late') && s.marked_at;
                                    const checked = s.attendance_status === 'present' || s.attendance_status === 'late';
                                    return (
                                      <tr key={s.scholar_id} className="da-tr">
                                        <td style={{ ...tdStyle, color: MUTED }}>{pageStart + i + 1}</td>
                                        <td style={{ ...tdStyle, minWidth: 190 }}>
                                          <div className="flex items-center gap-3 min-w-0">
                                            <span style={{ width: 34, height: 34, borderRadius: '50%', background: checked ? `${MAROON}12` : BG, color: checked ? MAROON : MUTED, border: checked ? `1px solid ${MAROON}26` : `1px solid ${BORDER}`, ...body, fontSize: '0.64rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                              {initials(s.full_name)}
                                            </span>
                                            <div className="min-w-0">
                                              <p style={{ ...body, fontSize: '0.82rem', fontWeight: 600, color: checked ? INK : MUTED }} className="truncate">{s.full_name}</p>
                                              <p style={{ ...mono, fontSize: '0.64rem', color: MUTED }}>{s.scholar_id}</p>
                                            </div>
                                          </div>
                                        </td>
                                        <td style={{ ...tdStyle, color: MUTED, whiteSpace: 'nowrap' }}>{s.year_level ? formatYearLevelLabel(s.year_level) : '—'}</td>
                                        <td style={{ ...tdStyle, ...mono, fontSize: '0.72rem', color: MUTED, whiteSpace: 'nowrap' }}>
                                          {hasTime ? formatAttendanceTime(s.marked_at) : '—'}
                                        </td>
                                        <td style={{ ...tdStyle, ...mono, fontSize: '0.72rem', color: MUTED, whiteSpace: 'nowrap' }}>
                                          {formatAttendanceTime(s.check_out_at)}
                                        </td>
                                        <td style={tdStyle}><StatusBadge status={s.attendance_status} checkedOut={Boolean(s.check_out_at)} /></td>
                                        <td style={{ ...tdStyle, color: MUTED }}>{Number(s.is_makeup) === 1 ? 'Make-up' : '—'}</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>

                            {/* Mobile: one card per scholar */}
                            <div className="md:hidden">
                              {pagedRows.map((s) => {
                                const checked = s.attendance_status === 'present' || s.attendance_status === 'late';
                                const hasTime = checked && s.marked_at;
                                return (
                                  <div key={s.scholar_id} className="da-row">
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="flex items-center gap-3 min-w-0">
                                        <span style={{ width: 34, height: 34, borderRadius: '50%', background: checked ? `${MAROON}12` : BG, color: checked ? MAROON : MUTED, border: checked ? `1px solid ${MAROON}26` : `1px solid ${BORDER}`, ...body, fontSize: '0.64rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                          {initials(s.full_name)}
                                        </span>
                                        <div className="min-w-0">
                                          <p style={{ ...body, fontSize: '0.84rem', fontWeight: 600, color: checked ? INK : MUTED }} className="truncate">{s.full_name}</p>
                                          <p style={{ ...mono, fontSize: '0.64rem', color: MUTED }}>{s.scholar_id}</p>
                                        </div>
                                      </div>
                                      <StatusBadge status={s.attendance_status} checkedOut={Boolean(s.check_out_at)} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3" style={{ marginTop: 10 }}>
                                      <MetaCell label="Time in" value={hasTime ? formatAttendanceTime(s.marked_at) : '—'} />
                                      <MetaCell label="Time out" value={formatAttendanceTime(s.check_out_at)} />
                                      <MetaCell label="Year level" value={s.year_level ? formatYearLevelLabel(s.year_level) : '—'} />
                                      <MetaCell label="Make-up" value={Number(s.is_makeup) === 1 ? 'Make-up' : '—'} />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                            </>
                          )}
                        </div>

                        {/* Pagination (client-side over the loaded roster) */}
                        {rosterRows.length > 0 && (
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3" style={{ marginTop: 14 }}>
                            <p style={{ ...body, fontSize: '0.74rem', color: MUTED }}>
                              Showing {pageStart + 1} – {Math.min(pageStart + ROSTER_PAGE_SIZE, rosterRows.length)} of {rosterRows.length} scholars
                            </p>
                            {totalPages > 1 && (
                              <nav aria-label="Roster pages" className="flex items-center gap-1.5 flex-wrap">
                                <button type="button" aria-label="Previous page" disabled={currentPage === 1} onClick={() => setRosterPage(currentPage - 1)}
                                  style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${BORDER}`, background: '#fff', color: MAROON, cursor: currentPage === 1 ? 'not-allowed' : 'pointer', opacity: currentPage === 1 ? 0.5 : 1 }}>‹</button>
                                {Array.from({ length: totalPages }, (_, idx) => idx + 1).map(n => (
                                  <button key={n} type="button" aria-label={`Page ${n}`} aria-current={n === currentPage ? 'page' : undefined} onClick={() => setRosterPage(n)}
                                    style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${n === currentPage ? MAROON : BORDER}`, background: n === currentPage ? MAROON : '#fff', color: n === currentPage ? '#fff' : INK, ...body, fontSize: '0.76rem', fontWeight: 600, cursor: 'pointer' }}>{n}</button>
                                ))}
                                <button type="button" aria-label="Next page" disabled={currentPage === totalPages} onClick={() => setRosterPage(currentPage + 1)}
                                  style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${BORDER}`, background: '#fff', color: MAROON, cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', opacity: currentPage === totalPages ? 0.5 : 1 }}>›</button>
                              </nav>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ═════════ MANUAL CHECK-IN TAB ═════════ */}
            {subTab === 'manual' && (
              <div id="panel-manual" role="tabpanel" aria-labelledby="tab-manual" className="flex flex-col gap-4">
                <div className="da-bar">
                  <div style={{ flex: '1 1 280px', minWidth: 0 }}>
                    <span style={fieldLabel}><CalendarClock size={13} style={{ color: GOLD }} /> Duty schedule</span>
                    {dutySelect(manualDuty, loadScholars, 'Select duty for manual check-in', undefined, manualDuties)}
                  </div>
                  {scholars.length > 0 && (
                    <div style={{ flex: '1 1 240px', minWidth: 0 }}>
                      <span style={fieldLabel}><Search size={13} style={{ color: GOLD }} /> Search scholar</span>
                      {searchBox(searchQuery, e => setSearchQuery(e.target.value), 'Search scholar by name or ID')}
                    </div>
                  )}
                </div>

                <p style={{ ...body, fontSize: '0.76rem', color: MUTED, marginTop: -4 }}>
                  Choose a status to save it immediately. Saved attendance cannot be changed. Check-in after 15 minutes from the scheduled start is automatically recorded as Late. Check-out is done in the Manual check-out tab.
                </p>

                {manualCheckInLocked && (
                  <Banner tone="danger" icon={AlertCircle}>
                    Manual check-in is locked three hours after the scheduled start. Use the Manual check-out tab when the duty ends.
                  </Banner>
                )}
                {saveMsg && (
                  <Banner tone={saveMsg.startsWith('Error') || saveMsg.startsWith('Walang') ? 'danger' : 'success'}>{saveMsg}</Banner>
                )}

                {manualLoading ? (
                  <div className="animate-pulse space-y-3">
                    <div style={{ background: `${BORDER}88`, height: 52, borderRadius: 12 }} />
                    <div style={{ background: `${BORDER}88`, height: 220, borderRadius: 12 }} />
                  </div>
                ) : scholars.length > 0 ? (
                  <>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
                      <StatTile label="Present" value={scholarCounts.present} color={SUCCESS} />
                      <StatTile label="Late" value={scholarCounts.late} color={AMBER} />
                      <StatTile label="Absent" value={scholarCounts.absent} color={CLAY} />
                      <StatTile label="Marked" value={`${scholars.filter(s => s.attendance_status).length}/${scholars.length}`} color={MAROON} />
                    </div>

                    <div className="da-card min-w-0">
                      <SectionHead icon={Users} title="Scholar roll call" subtitle="Mark each scholar Present, Late or Absent" color={SUCCESS} />
                      <div className="da-list" style={{ marginTop: 14, maxHeight: 560, overflowY: 'auto' }}>
                        {filteredScholars.length === 0 ? (
                          <div className="text-center" style={{ padding: '28px 16px' }}>
                            <p style={{ ...body, fontSize: '0.8rem', color: MUTED }}>No results for "{searchQuery}"</p>
                          </div>
                        ) : filteredScholars.map(s => {
                          const status = attendance[s.scholar_id];
                          const isMakeup = Number(s.is_makeup) === 1;
                          const isCheckedOut = Boolean(s.check_out_at);
                          const isAttendanceSaved = Boolean(s.attendance_status);
                          return (
                            <div key={s.scholar_id} className="da-row flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                              <div className="flex items-center gap-3 min-w-0 flex-1" style={{ minWidth: 200 }}>
                                <span style={{ width: 34, height: 34, borderRadius: '50%', background: isAttendanceSaved ? `${MAROON}12` : BG, color: isAttendanceSaved ? MAROON : MUTED, border: `1px solid ${isAttendanceSaved ? `${MAROON}26` : BORDER}`, ...body, fontSize: '0.64rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  {initials(s.full_name)}
                                </span>
                                <div className="min-w-0">
                                  <p style={{ ...body, fontSize: '0.84rem', fontWeight: 600, color: INK }} className="truncate">{s.full_name}</p>
                                  <p style={{ ...mono, fontSize: '0.64rem', color: MUTED }}>
                                    {s.scholar_id}{isMakeup ? ' · Make-up' : ''}
                                  </p>
                                  <p style={{ ...mono, fontSize: '0.62rem', color: MUTED, marginTop: 2 }}>
                                    In {formatAttendanceTime(s.marked_at)}
                                  </p>
                                </div>
                              </div>

                              <div className="da-actions flex flex-wrap items-center justify-end gap-2" style={{ marginLeft: 'auto' }}>
                                {isCheckedOut && (
                                  <span className="inline-flex items-center gap-1" style={{ ...body, fontSize: '0.66rem', fontWeight: 700, color: MAROON, background: `${MAROON}12`, borderRadius: 999, padding: '4px 10px', whiteSpace: 'nowrap' }}>
                                    <LogOut size={11} /> Checked out
                                  </span>
                                )}
                                {isAttendanceSaved && (
                                  <span style={{ ...body, fontSize: '0.66rem', fontWeight: 700, color: SUCCESS, whiteSpace: 'nowrap' }}>
                                    Attendance saved
                                  </span>
                                )}

                                <div className="da-seg" role="group" aria-label={`Attendance for ${s.full_name}`}>
                                  {STATUS_STAMPS.map(stamp => {
                                    const active = status === stamp.key;
                                    const isSaving = savingScholarId === s.scholar_id;
                                    const disabled = manualCheckInLocked || isAttendanceSaved || isCheckedOut || Boolean(savingScholarId);
                                    return (
                                      <button
                                        key={stamp.key}
                                        type="button"
                                        onClick={() => setScholarStatus(s.scholar_id, stamp.key)}
                                        disabled={disabled}
                                        title={stamp.label}
                                        aria-label={`Mark ${s.full_name} ${stamp.label}`}
                                        aria-pressed={active}
                                        className="da-seg-btn"
                                        style={{
                                          background: active ? stamp.color : 'transparent',
                                          color: active ? '#fff' : MUTED,
                                          cursor: disabled ? 'not-allowed' : 'pointer',
                                          opacity: disabled && !active ? 0.5 : 1,
                                        }}
                                      >
                                        {isSaving ? '…' : <>{stamp.icon} {stamp.short}</>}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </>
                ) : (
                  <EmptyBlock icon={ListChecks} title="Select a duty first" hint="to begin manual attendance." pad={56} />
                )}
              </div>
            )}

            {/* ═════════ CHECK-OUT TAB ═════════ */}
            {subTab === 'checkout' && (
              <div id="panel-checkout" role="tabpanel" aria-labelledby="tab-checkout" className="flex flex-col gap-4">
                <div className="da-bar">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={fieldLabel}><CalendarClock size={13} style={{ color: GOLD }} /> Duty schedule</span>
                    {dutySelect(outDuty, loadOutScholars, 'Select duty for check-out', undefined, manualDuties)}
                  </div>
                </div>

                {selectedOutDuty && (
                  <Banner tone={outIsLocked ? 'danger' : outIsOpen ? 'success' : 'warning'} icon={outIsLocked ? AlertCircle : outIsOpen ? CheckCircle2 : Clock}>
                    {outIsLocked
                      ? 'The manual check-out window is closed.'
                      : outIsOpen
                        ? 'Check-out is open. Any remaining check-ins will be automatically checked out after 15 minutes.'
                        : `Check-out opens at ${outOpensAt !== null ? formatAttendanceTime(outOpensAt) : 'the end of the duty'}.`}
                  </Banner>
                )}
                {outFeedback && (
                  <Banner tone={outFeedback.tone === 'error' ? 'danger' : 'success'}>{outFeedback.text}</Banner>
                )}

                <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] gap-4 items-start">

                  {/* LEFT — totals and the rules */}
                  <div className="flex flex-col gap-4 min-w-0">
                    {outLoading ? (
                      <div className="animate-pulse" style={{ background: `${BORDER}88`, height: 120, borderRadius: 12 }} />
                    ) : outCheckedIn.length > 0 && (
                      <div className="grid grid-cols-3 xl:grid-cols-1 gap-2.5">
                        <StatTile label="Checked in" value={outCheckedIn.length} color={SUCCESS} />
                        <StatTile label="Checked out" value={outDoneCount} color={MAROON} />
                        <StatTile label="Still inside" value={outCheckedIn.length - outDoneCount} color={AMBER} />
                      </div>
                    )}

                    <div className="da-card">
                      <SectionHead icon={LogOut} title="How check-out works" color={GOLD} />
                      <ol style={{ ...body, fontSize: '0.78rem', color: INK, margin: '12px 0 0', paddingLeft: 18, lineHeight: 1.65 }}>
                        <li>The scholar must already be checked in (Present or Late).</li>
                        <li>Check-out opens when the scheduled duty ends.</li>
                        <li>For a make-up duty, it opens one hour after the scheduled end.</li>
                        <li>If not manually checked out, it is recorded automatically 15 minutes after check-out opens, using the scheduled check-out time.</li>
                        <li>Manual check-out closes three hours after the scheduled duty end.</li>
                      </ol>
                    </div>
                  </div>

                  {/* RIGHT — only scholars who are checked in appear here */}
                  <div className="da-card min-w-0">
                    <div className="flex flex-col 2xl:flex-row 2xl:items-center 2xl:justify-between gap-3">
                      <SectionHead icon={Users} title="Scholars to check out" subtitle="Scholars who are checked in for the selected duty" color={SUCCESS} />
                      {outDuty && outCheckedIn.length > 0 && (
                        <div className="flex items-center gap-2 w-full 2xl:w-auto">
                          <div className="da-search flex-1 2xl:flex-none 2xl:w-64">
                            <Search size={14} style={{ color: MUTED, flexShrink: 0 }} aria-hidden="true" />
                            <input
                              type="text"
                              value={outSearch}
                              onChange={e => setOutSearch(e.target.value)}
                              placeholder="Search scholar name or ID…"
                              aria-label="Search scholars to check out"
                              style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'none', ...body, fontSize: '0.82rem', color: INK }}
                            />
                          </div>
                          {iconBtn(reloadOutScholars, 'Refresh check-out list', outRefreshing)}
                        </div>
                      )}
                    </div>

                    {!outDuty ? (
                      <div style={{ marginTop: 16 }}>
                        <EmptyBlock icon={LogOut} title="Select a duty first" hint="to see who can be checked out." pad={56} />
                      </div>
                    ) : outCheckedIn.length === 0 && !outLoading ? (
                      <div style={{ marginTop: 16 }}>
                        <EmptyBlock icon={Users} title="No one is checked in yet" hint="Check scholars in first, by QR or in the Manual check-in tab." pad={56} />
                      </div>
                    ) : (
                      <div className="da-list" style={{ marginTop: 14, maxHeight: 560, overflowY: 'auto' }}>
                        {outRows.length === 0 ? (
                          <div className="text-center" style={{ padding: '28px 16px' }}>
                            <p style={{ ...body, fontSize: '0.8rem', color: MUTED }}>No results for "{outSearch}"</p>
                          </div>
                        ) : outRows.map(s => {
                          const isMakeup = Number(s.is_makeup) === 1;
                          const opensAt = getDutyEndTimestamp(selectedOutDuty, isMakeup ? 1 : 0);
                          const lockAt = getDutyEndTimestamp(selectedOutDuty, 3);
                          const canCheckOut = currentTime > 0 && opensAt !== null && lockAt !== null
                            && currentTime >= opensAt && currentTime < lockAt;
                          const isOut = Boolean(s.check_out_at);
                          const busy = checkingOutScholar === s.scholar_id;
                          return (
                            <div key={s.scholar_id} className="da-row flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                              <div className="flex items-center gap-3 min-w-0 flex-1" style={{ minWidth: 200 }}>
                                <span style={{ width: 34, height: 34, borderRadius: '50%', background: isOut ? `${MAROON}12` : BG, color: isOut ? MAROON : MUTED, border: `1px solid ${isOut ? `${MAROON}26` : BORDER}`, ...body, fontSize: '0.64rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  {initials(s.full_name)}
                                </span>
                                <div className="min-w-0">
                                  <p style={{ ...body, fontSize: '0.84rem', fontWeight: 600, color: INK }} className="truncate">{s.full_name}</p>
                                  <p style={{ ...mono, fontSize: '0.64rem', color: MUTED }}>{s.scholar_id}{isMakeup ? ' · Make-up' : ''}</p>
                                  <p style={{ ...mono, fontSize: '0.62rem', color: MUTED, marginTop: 2 }}>
                                    In {formatAttendanceTime(s.marked_at)} · Out {formatAttendanceTime(s.check_out_at)}
                                  </p>
                                </div>
                              </div>

                              <div className="da-actions flex items-center justify-end" style={{ marginLeft: 'auto' }}>
                                {isOut ? (
                                  <span className="inline-flex items-center gap-1" style={{ ...body, fontSize: '0.68rem', fontWeight: 700, color: MAROON, background: `${MAROON}12`, borderRadius: 999, padding: '5px 12px', whiteSpace: 'nowrap' }}>
                                    <CheckCircle2 size={12} /> Checked out
                                  </span>
                                ) : canCheckOut ? (
                                  <button
                                    type="button"
                                    onClick={() => checkOutScholar(s.scholar_id)}
                                    disabled={busy}
                                    className="da-hover"
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, border: 'none', background: MAROON, color: '#fff', ...body, fontSize: '0.74rem', fontWeight: 700, cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.6 : 1, whiteSpace: 'nowrap' }}
                                  >
                                    <LogOut size={13} /> {busy ? 'Checking out…' : 'Check out'}
                                  </button>
                                ) : outIsLocked ? (
                                  <span className="inline-flex items-center gap-1" title="The manual check-out window closed three hours after the scheduled duty end." style={{ ...body, fontSize: '0.7rem', color: MUTED, whiteSpace: 'nowrap' }}>
                                    <Clock size={12} /> Check-out locked
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ── Needs follow-up ── */}
        <section className="mt-5 min-w-0" style={{ ...cardWrap, padding: 'clamp(14px, 3vw, 22px)' }}>
          <div className="flex items-center gap-3" style={{ marginBottom: 14 }}>
            <span className="flex items-center justify-center flex-shrink-0" style={{ width: 36, height: 36, borderRadius: 11, background: `${AMBER}18`, color: AMBER }}>
              <UserX size={16} />
            </span>
            <div className="min-w-0">
              <h2 style={{ ...display, fontSize: '1.05rem', fontWeight: 600, color: INK, margin: 0 }}>Needs follow-up</h2>
              <p style={{ ...body, fontSize: '0.76rem', color: MUTED, marginTop: 2 }}>Scholars with the most absences in attendance records.</p>
            </div>
          </div>
          {followUp.length === 0 ? (
            <div className="flex items-center gap-2" style={{ padding: 18, border: `1.5px dashed ${BORDER}`, borderRadius: 12, background: CARD, fontSize: '0.8rem', color: MUTED }}>
              <Users size={16} style={{ color: GOLD }} /> No repeat absences found.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
              {followUp.map(s => (
                <div key={`${s.name}-${s.scholarId}`} className="flex min-w-0 items-center gap-2.5" style={{ padding: 12, background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12 }}>
                  <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full" style={{ background: `${MAROON}12`, border: `1px solid ${MAROON}26`, ...body, fontSize: '0.68rem', fontWeight: 700, color: MAROON }}>
                    {String(s.name).split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || '?'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate" style={{ ...body, fontSize: '0.82rem', fontWeight: 700, color: INK }}>{s.name}</p>
                    <p className="truncate" style={{ ...mono, fontSize: '0.68rem', color: MUTED, marginTop: 2 }}>{s.scholarId}</p>
                  </div>
                  <span className="flex-shrink-0" style={{ ...body, fontSize: '0.7rem', fontWeight: 700, color: CLAY, background: `${CLAY}16`, borderRadius: 999, padding: '4px 10px' }}>{s.count}x absent</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Make-up duty requests ── */}
        <section className="mt-5 min-w-0" style={{ ...cardWrap }}>
          <div className="flex flex-wrap items-center gap-3" style={{ padding: 'clamp(14px, 3vw, 20px)' }}>
            <div className="flex items-center justify-center flex-shrink-0" style={{ width: 42, height: 42, borderRadius: 12, background: `${CLAY}16`, color: CLAY }}>
              <AlertCircle size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <h2 style={{ ...display, fontSize: '1.05rem', fontWeight: 600, color: INK }}>Make-up duty requests</h2>
              <p style={{ ...body, fontSize: '0.76rem', color: MUTED, marginTop: 3 }}>
                Absent attendance awaiting an admin-assigned make-up duty.
              </p>
            </div>
            <span style={{ ...body, fontSize: '0.72rem', fontWeight: 700, color: MAROON, background: `${MAROON}12`, borderRadius: 999, padding: '5px 10px' }}>
              {makeupSources.length} awaiting assignment
            </span>
            {iconBtn(() => fetchMakeupRequestData(true), 'Refresh make-up duty requests', makeupRefreshing)}
            <button
              type="button"
              onClick={() => setMakeupOpen(open => !open)}
              aria-expanded={makeupOpen}
              aria-controls="attendance-makeup-panel"
              aria-label={makeupOpen ? 'Collapse make-up duty requests' : 'Expand make-up duty requests'}
              className="da-icon-btn"
            >
              <ChevronDown size={18} style={{ transform: makeupOpen ? 'rotate(180deg)' : 'none', transition: 'transform 180ms ease' }} />
            </button>
          </div>
          {makeupOpen && (
            <div id="attendance-makeup-panel" role="region" aria-label="Make-up duty requests" style={{ borderTop: `1px solid ${BORDER}`, padding: 'clamp(14px, 3vw, 20px)' }}>
              {makeupLoading ? (
                <p style={{ ...body, fontSize: '0.8rem', color: MUTED }}>Loading make-up duty requests…</p>
              ) : makeupError ? (
                <Banner tone="danger" icon={AlertCircle}>{makeupError}</Banner>
              ) : makeupSources.length === 0 ? (
                <EmptyBlock icon={CheckCircle2} title="Nothing awaiting assignment" hint="No absent scholars are waiting for a make-up duty." pad={32} />
              ) : (
                <>
                  <p className="mb-4" style={{ ...body, fontSize: '0.76rem', color: MUTED }}>
                    These absences were recorded for your assigned groups. Admin chooses and assigns the make-up duty.
                  </p>
                  <div className="da-list hidden md:block overflow-x-auto">
                    <table style={{ width: '100%', minWidth: 560, borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          <th scope="col" style={thStyle}>Scholar</th>
                          <th scope="col" style={thStyle}>Missed duty</th>
                          <th scope="col" style={thStyle}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {makeupSources.map(source => (
                          <tr key={`${source.scholar_id}-${source.source_duty_id}`} className="da-tr">
                            <td style={tdStyle}>{source.scholar_name}</td>
                            <td style={tdStyle}>{source.source_duty_title}</td>
                            <td style={{ ...tdStyle, fontSize: '0.72rem', fontWeight: 700, color: CLAY, textTransform: 'capitalize' }}>{source.source_status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="da-list md:hidden">
                    {makeupSources.map(source => (
                      <div key={`m-${source.scholar_id}-${source.source_duty_id}`} className="da-row">
                        <div className="flex items-start justify-between gap-3">
                          <p style={{ ...body, fontSize: '0.84rem', fontWeight: 600, color: INK }}>{source.scholar_name}</p>
                          <span style={{ ...body, fontSize: '0.68rem', fontWeight: 700, color: CLAY, background: CLAY_BG, borderRadius: 999, padding: '3px 10px', textTransform: 'capitalize', whiteSpace: 'nowrap' }}>{source.source_status}</span>
                        </div>
                        <p style={{ ...body, fontSize: '0.76rem', color: MUTED, marginTop: 4 }}>Missed: {source.source_duty_title}</p>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </section>
      </div>

      <style>{`
        .da-hub { width: 100%; min-height: 100vh; overflow-x: hidden; }
        .da-inner { box-sizing: border-box; padding: 16px 16px 48px; width: 100%; max-width: none; margin: 0; }
        @media (min-width: 640px) { .da-inner { padding: 24px 24px 48px; } }
        @media (min-width: 1024px) { .da-inner { padding: 32px 32px 48px; } }

        .da-hub button:focus-visible, .da-hub input:focus-visible, .da-hub select:focus-visible { outline: 2px solid ${GOLD}; outline-offset: 2px; }

        /* Same class names as the other Staff pages. :where() keeps these at zero specificity,
           so the shared staff-page-* styles win whenever they are loaded. */
        :where(.staff-page-eyebrow) { font-family: 'Inter', 'Segoe UI', sans-serif; font-size: 0.7rem; font-weight: 700; letter-spacing: 0.1em; color: ${GOLD}; }
        :where(.staff-page-title) { font-family: 'Lora', Georgia, 'Times New Roman', serif; font-size: clamp(1.6rem, 4vw, 2rem); font-weight: 700; color: ${MAROON}; line-height: 1.15; margin-top: 3px; }
        :where(.staff-page-description) { font-family: 'Inter', 'Segoe UI', sans-serif; font-size: 0.9rem; color: ${MUTED}; margin-top: 6px; line-height: 1.55; }

        /* Tabs: underline style, scrolls sideways on small screens */
        .da-tabs { display: flex; width: 100%; border-bottom: 1px solid ${BORDER}; overflow: hidden; background: #FCFAF5; }
        .da-tab {
          flex: 1 1 0; min-width: 0; display: inline-flex; align-items: center; justify-content: center; gap: 8px;
          padding: 16px 10px; margin-bottom: -1px; border: none; border-bottom: 2px solid transparent; background: none;
          font-family: 'Inter', 'Segoe UI', sans-serif; font-size: 0.86rem; font-weight: 600; color: ${MUTED}; cursor: pointer;
          transition: color 150ms ease, border-color 150ms ease, background-color 150ms ease;
        }
        .da-tab:hover { color: ${MAROON}; background: ${BG}66; }
        .da-tab-active { color: ${MAROON}; border-bottom-color: ${MAROON}; font-weight: 700; background: ${CARD}; }
        .da-tab-short { display: none; }
        @media (max-width: 639px) {
          .da-tab { flex-direction: column; gap: 4px; padding: 10px 4px 11px; font-size: 0.7rem; }
          .da-tab-long { display: none; }
          .da-tab-short { display: inline; }
        }
        .da-body { padding: clamp(14px, 3vw, 22px); }

        /* Duty bar + cards */
        .da-bar { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 14px; padding: clamp(12px, 2.5vw, 16px); background: ${BG}; border: 1px solid ${BORDER}; border-radius: 14px; }
        .da-card { background: ${CARD}; border: 1px solid ${BORDER}; border-radius: 14px; padding: clamp(14px, 3vw, 18px); }
        .da-select {
          padding-right: 34px !important;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238A7A68' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
          background-repeat: no-repeat; background-position: right 12px center;
        }
        .da-search { display: flex; align-items: center; gap: 8px; padding: 10px 12px; background: #fff; border: 1px solid ${BORDER}; border-radius: 10px; }
        .da-search:focus-within { border-color: ${GOLD}; }
        .da-icon-btn { display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; flex-shrink: 0; border: 1px solid ${BORDER}; border-radius: 10px; background: #fff; color: ${MAROON}; cursor: pointer; }
        .da-icon-btn:hover { background: ${BG}; }
        .da-hover { transition: opacity 160ms ease; }
        .da-hover:hover:not(:disabled) { opacity: 0.9; }

        /* QR */
        .da-qr-frame { display: flex; align-items: center; justify-content: center; padding: 20px; background: #fff; border: 1.5px dashed ${GOLD}; border-radius: 14px; }
        .da-info { margin-top: 10px; border-top: 1px solid ${BORDER}; }
        .da-info-row { display: flex; align-items: center; gap: 10px; padding: 9px 0; border-bottom: 1px solid ${BORDER}; font-family: 'Inter', 'Segoe UI', sans-serif; font-size: 0.8rem; color: ${INK}; }

        /* Lists and tables: one bordered block, hairline dividers */
        .da-list { background: #fff; border: 1px solid ${BORDER}; border-radius: 14px; overflow: hidden; }
        .da-row { padding: 11px 14px; border-bottom: 1px solid ${BORDER}; transition: background-color 150ms ease; }
        .da-row:last-child { border-bottom: none; }
        .da-row:hover { background: #FCFAF5; }
        .da-tr:hover td { background: #FCFAF5; }
        .da-tr:last-child td { border-bottom: none; }

        /* Segmented P / L / A control */
        .da-seg { display: inline-flex; border: 1px solid ${BORDER}; border-radius: 10px; overflow: hidden; background: #fff; }
        .da-seg-btn { display: inline-flex; align-items: center; gap: 4px; padding: 7px 12px; border: none; border-right: 1px solid ${BORDER}; font-family: 'Inter', 'Segoe UI', sans-serif; font-size: 0.7rem; font-weight: 700; }
        .da-seg-btn:last-child { border-right: none; }

        .da-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; background: #fff; border: 1.5px dashed ${BORDER}; border-radius: 14px; }
        .da-empty-icon { width: 48px; height: 48px; border-radius: 14px; background: ${GOLD}18; color: ${GOLD}; display: flex; align-items: center; justify-content: center; margin-bottom: 12px; }

        @media (max-width: 639px) {
          .da-bar { padding: 12px; gap: 12px; }
          .da-card { padding: 14px 12px; }
          .da-actions { width: 100%; margin-left: 0 !important; justify-content: space-between; }
          .da-seg { width: 100%; }
          .da-seg-btn { flex: 1; justify-content: center; padding: 9px 12px; }
          .da-actions > .da-hover { flex: 1; justify-content: center; }
          .da-qr-frame { padding: 14px; }
          .da-qr-frame svg { max-width: 100%; height: auto; }
        }

        @media (prefers-reduced-motion: reduce) {
          .da-hub * { transition: none !important; animation-duration: 0.01ms !important; }
        }
      `}</style>
    </div>
  );
};

export default StaffDutyAttendance;