import { API_ORIGIN } from '../../utils/apiConfig.js';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import StaffNotifications from '../../components/Staff/StaffNotifications';
import {
  ClipboardList, CalendarCheck, Users, TrendingUp,
  Megaphone, Calendar, MapPin, Clock,
  ChevronRight, CheckCircle, XCircle, AlertTriangle,
  FileSpreadsheet, AlertCircle, Info, BarChart3, PieChart,
} from 'lucide-react';

// ── Apple Scholar design system — same tokens as OfficerAnnouncement,
// StaffAnnouncement, Scholar Portfolio, Staff Duty Assignment and Staff Attendance. ──
const PRIMARY = '#6D2140';
const PRIMARY_DEEP = '#4A1730';
const GOLD = '#A9784E';
const BG = '#F3EEE6';
const SURFACE = '#FFFDF9';
const BORDER = '#E7D8C7';
const INK = '#241512';
const MUTED = '#8A7A68';
const SUCCESS = '#3F8A55';
const WARNING = '#B8863F';
const DANGER = '#C1666B';
const SLATE = '#5c7487';
const GRAPHITE = '#6b625c';
const RADIUS = 16;

const API = `${API_ORIGIN}/api`;
const token = () => localStorage.getItem('token');
const authHeaders = () => ({ headers: { Authorization: `Bearer ${token()}` } });

const display = { fontFamily: "'Lora', Georgia, 'Times New Roman', serif" };
const body = { fontFamily: "'Inter', 'Segoe UI', sans-serif" };
const mono = { fontFamily: "'IBM Plex Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace" };

const cardShadow = { boxShadow: '0 12px 28px -20px rgba(36,21,18,0.22)' };
const cardWrap = { background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: RADIUS, ...cardShadow };

const PRIORITY_CFG = {
  critical:  { color: DANGER,  label: 'Critical',  icon: <AlertCircle size={16} /> },
  important: { color: WARNING, label: 'Important', icon: <AlertTriangle size={16} /> },
  info:      { color: GOLD,    label: 'Info',      icon: <Info size={16} /> },
};

const STATUS_CFG = {
  present: { label: 'Present', icon: <CheckCircle size={11} />, color: SUCCESS },
  absent:  { label: 'Absent',  icon: <XCircle size={11} />,     color: DANGER },
};

const DUTY_STATUS_COLORS = {
  upcoming:  SLATE,
  ongoing:   SUCCESS,
  completed: GRAPHITE,
  cancelled: DANGER,
};

// Presentation helper — safe short date (returns '' for missing/invalid values).
const shortDate = (value, opts = { month: 'short', day: 'numeric' }) => {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-PH', opts);
};

const getComputedDutyStatus = (duty, now = new Date()) => {
  const storedStatus = String(duty.status || '').trim().toLowerCase();
  if (storedStatus === 'completed' || storedStatus === 'cancelled') return storedStatus;

  const rawDutyDate = String(duty.duty_date || '');
  const parsedDutyDate = duty.duty_date instanceof Date ? duty.duty_date : new Date(duty.duty_date);
  const dutyDate = /^\d{4}-\d{2}-\d{2}$/.test(rawDutyDate)
    ? rawDutyDate
    : Number.isNaN(parsedDutyDate.getTime())
      ? ''
      : `${parsedDutyDate.getFullYear()}-${String(parsedDutyDate.getMonth() + 1).padStart(2, '0')}-${String(parsedDutyDate.getDate()).padStart(2, '0')}`;

  if (!dutyDate) return ['upcoming', 'ongoing'].includes(storedStatus) ? storedStatus : 'upcoming';

  const start = new Date(`${dutyDate}T${duty.time_start || '00:00:00'}`);
  const end = new Date(`${dutyDate}T${duty.time_end || '23:59:59'}`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return ['upcoming', 'ongoing'].includes(storedStatus) ? storedStatus : 'upcoming';
  }

  if (now > end) return 'completed';
  if (now >= start) return 'ongoing';
  return 'upcoming';
};

function SkeletonBox({ h = 'h-4', w = 'w-full', rounded = 'rounded' }) {
  return <div className={`${h} ${w} ${rounded} animate-pulse`} style={{ background: `${BORDER}99` }} />;
}

// ─── Shared building blocks ────────────────────────────────────────────────

function Panel({ icon, title, subtitle, action, children }) {
  return (
    <section className="flex h-full min-w-0 flex-col" style={{ ...cardWrap, padding: 'clamp(14px, 3vw, 22px)' }}>
      <div className="flex items-start justify-between gap-3" style={{ marginBottom: 16 }}>
        <div className="flex items-start gap-3 min-w-0">
          <span className="shrink-0 flex items-center justify-center"
            style={{ width: 34, height: 34, borderRadius: 10, background: `${PRIMARY}12`, color: PRIMARY }}>
            {icon}
          </span>
          <div className="min-w-0">
            <h2 style={{ ...display, fontSize: '1.1rem', fontWeight: 600, color: INK, lineHeight: 1.25 }}>{title}</h2>
            {subtitle && <p style={{ ...body, fontSize: '0.76rem', color: MUTED, marginTop: 2 }}>{subtitle}</p>}
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function PanelAction({ onClick, children }) {
  return (
    <button type="button" onClick={onClick} className="sd-action">
      {children} <ChevronRight size={13} />
    </button>
  );
}

function EmptyState({ icon, children }) {
  return (
    <div className="sd-empty">
      <span className="sd-empty-icon">{icon}</span>
      <p style={{ ...body, fontSize: '0.84rem', color: MUTED, fontWeight: 600 }}>{children}</p>
    </div>
  );
}

function ListSkeleton({ rows = 3, h = 'h-14' }) {
  return (
    <div className="sd-list">
      {Array(rows).fill(0).map((_, i) => (
        <div key={i} className="animate-pulse" style={{ background: `${BORDER}66`, height: 64, borderBottom: '1px solid #fff' }} />
      ))}
    </div>
  );
}

// ─── KPI cards ─────────────────────────────────────────────────────────────

function StatisticsCards({ loading, totalDuties, upcoming, ongoing, totalGroups, attendanceRate, announcements }) {
  const cards = [
    { label: 'Total duties',    sub: 'All assigned duties',     value: totalDuties,           icon: <ClipboardList size={20} />, color: PRIMARY },
    { label: 'Upcoming',        sub: 'Scheduled duties',        value: upcoming,              icon: <Calendar size={20} />,      color: SLATE },
    { label: 'Ongoing',         sub: 'Currently active',        value: ongoing,               icon: <CalendarCheck size={20} />, color: SUCCESS },
    { label: 'Scholar groups',  sub: 'Across the program',      value: totalGroups,           icon: <Users size={20} />,         color: GOLD },
    { label: 'Attendance rate', sub: 'Present of all records',  value: `${attendanceRate}%`,  icon: <TrendingUp size={20} />,    color: PRIMARY_DEEP },
    { label: 'Announcements',   sub: 'Posted updates',          value: announcements,         icon: <Megaphone size={20} />,     color: GRAPHITE },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2.5 sm:gap-4 mb-5">
      {cards.map((card) => (
        <div key={card.label} className="min-w-0 h-full" style={{ ...cardWrap, padding: 'clamp(14px, 3vw, 18px)' }}>
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="flex items-center justify-center flex-shrink-0"
              style={{ width: 44, height: 44, borderRadius: 12, background: `${card.color}18`, color: card.color }}>
              {card.icon}
            </div>
            <div className="min-w-0 flex-1">
              {loading ? (
                <>
                  <SkeletonBox h="h-6" w="w-12" />
                  <div className="mt-2"><SkeletonBox h="h-2.5" w="w-full" /></div>
                </>
              ) : (
                <>
                  <p style={{ ...display, fontSize: 'clamp(1.35rem, 4vw, 1.7rem)', fontWeight: 700, color: PRIMARY, lineHeight: 1 }}>{card.value}</p>
                  <p className="truncate" style={{ ...body, fontSize: '0.78rem', fontWeight: 600, color: INK, marginTop: 6 }}>{card.label}</p>
                  <p className="truncate" style={{ ...body, fontSize: '0.68rem', color: MUTED, marginTop: 1 }}>{card.sub}</p>
                </>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Weekly attendance chart (daily attendance rate, pure CSS bar chart) ───

// Parse a value into a valid local Date, or null. Date-only strings (YYYY-MM-DD)
// are treated as LOCAL dates so they never shift to the previous/next day.
const parseAttendanceDate = (value) => {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value !== 'string') return null;

  const s = value.trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) {
    const y = +m[1], mo = +m[2] - 1, day = +m[3];
    const d = new Date(y, mo, day);
    return d.getFullYear() === y && d.getMonth() === mo && d.getDate() === day ? d : null;
  }
  const d = new Date(/^\d{4}-\d{2}-\d{2} /.test(s) ? s.replace(' ', 'T') : s);
  return Number.isNaN(d.getTime()) ? null : d;
};

// Use the scheduled duty date first so weekly attendance follows the duty week,
// not the time an admin later records an attendance correction.
const getAttendanceDate = (record) => {
  for (const field of ['date', 'duty_date', 'marked_at']) {
    const d = parseAttendanceDate(record?.[field]);
    if (d) return d;
  }
  return null;
};

const localDayKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const rateColor = (rate) => (rate >= 75 ? SUCCESS : rate >= 50 ? GOLD : DANGER);

function WeeklyAttendanceChart({ loading, records }) {
  const [active, setActive] = useState(null);

  // Last 7 calendar weeks, Monday through Sunday, oldest → current week.
  const today = new Date();
  const currentWeekStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  currentWeekStart.setDate(currentWeekStart.getDate() - ((currentWeekStart.getDay() + 6) % 7));
  const buckets = Array.from({ length: 7 }).map((_, i) => {
    const startDate = new Date(currentWeekStart);
    startDate.setDate(startDate.getDate() - (6 - i) * 7);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6);
    return { startDate, endDate, key: localDayKey(startDate), present: 0, absent: 0 };
  });
  const byKey = Object.fromEntries(buckets.map((b) => [b.key, b]));

  (Array.isArray(records) ? records : []).forEach((r) => {
    const d = getAttendanceDate(r);
    if (!d) return; // invalid / missing date → not counted
    const weekStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
    const bucket = byKey[localDayKey(weekStart)];
    if (!bucket) return; // outside the last 7 weeks
    const rawStatus = String(r?.status ?? '').toLowerCase();
    const status = rawStatus === 'excused' ? 'absent' : rawStatus;
    if (status === 'present' || status === 'absent') bucket[status] += 1;
  });

  buckets.forEach((b) => {
    b.total = b.present + b.absent;
    b.rate = b.total > 0 ? Math.round((b.present / b.total) * 100) : null; // null = unavailable
  });

  const hasData = buckets.some((b) => b.total > 0);
  const PLOT_H = 190;
  const colGap = 'gap-2 sm:gap-3';
  const sidePad = { padding: '0 8px' };

  const legend = (
    <div className="flex items-center gap-3 flex-wrap" style={{ ...body, fontSize: '0.7rem', color: MUTED }}>
      <span className="flex items-center gap-1.5"><span style={{ width: 8, height: 8, borderRadius: '50%', background: SUCCESS, display: 'inline-block' }} /> 75%+</span>
      <span className="flex items-center gap-1.5"><span style={{ width: 8, height: 8, borderRadius: '50%', background: GOLD, display: 'inline-block' }} /> 50–74%</span>
      <span className="flex items-center gap-1.5"><span style={{ width: 8, height: 8, borderRadius: '50%', background: DANGER, display: 'inline-block' }} /> Below 50%</span>
    </div>
  );

  return (
    <Panel
      icon={<BarChart3 size={17} />}
      title="Weekly attendance rate"
      subtitle="Present ÷ total records, per duty week over the last 7 weeks"
      action={<div className="hidden sm:block shrink-0" style={{ paddingTop: 4 }}>{legend}</div>}
    >
      <div className="sm:hidden" style={{ marginTop: -6, marginBottom: 12 }}>{legend}</div>

      {loading ? (
        <div className="flex items-end gap-3" style={{ height: 220 }}>
          {Array(7).fill(0).map((_, i) => (
            <SkeletonBox key={i} h="h-full" w="w-full" />
          ))}
        </div>
      ) : !hasData ? (
        <div className="sd-chart-empty">
          <EmptyState icon={<BarChart3 size={24} />}>No attendance records in the last 7 weeks</EmptyState>
        </div>
      ) : (
        <div className="flex gap-2">
          {/* Y axis: 0–100% */}
          <div className="shrink-0 relative" style={{ width: 34, height: PLOT_H, marginTop: 16 }} aria-hidden="true">
            {[0, 25, 50, 75, 100].map((t) => (
              <span key={t} style={{ ...mono, position: 'absolute', right: 0, bottom: `${t}%`, transform: 'translateY(50%)', fontSize: '0.62rem', color: MUTED }}>
                {t}%
              </span>
            ))}
          </div>

          <div className="flex-1 min-w-0">
            {/* Plot area */}
            <div className={`relative flex items-stretch justify-between ${colGap}`}
              style={{ ...sidePad, height: PLOT_H, marginTop: 16, borderBottom: `1px solid ${BORDER}` }}>
              {[25, 50, 75, 100].map((t) => (
                <div key={t} aria-hidden="true"
                  style={{ position: 'absolute', left: 0, right: 0, bottom: `${t}%`, borderTop: `1px dashed ${BORDER}`, pointerEvents: 'none' }} />
              ))}

              {buckets.map((b, i) => {
                const available = b.rate !== null;
                const color = available ? rateColor(b.rate) : BORDER;
                const dateLong = `${b.startDate.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })} – ${b.endDate.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}`;
                const tipPos = i <= 1 ? { left: 0 } : i >= 5 ? { right: 0 } : { left: '50%', transform: 'translateX(-50%)' };
                return (
                  <div key={b.key}
                    className="flex-1 min-w-0 relative sd-bar-col"
                    style={{ cursor: 'default' }}
                    tabIndex={0}
                    role="img"
                    aria-label={available
                      ? `${dateLong}: ${b.rate}% attendance rate, ${b.present} present, ${b.absent} absent, ${b.total} records`
                      : `${dateLong}: no attendance records`}
                    onMouseEnter={() => setActive(i)}
                    onMouseLeave={() => setActive(null)}
                    onFocus={() => setActive(i)}
                    onBlur={() => setActive(null)}
                    onClick={() => setActive((cur) => (cur === i ? null : i))}>
                    {available ? (
                      <>
                        <div className="transition-all"
                          style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 44, height: `${b.rate}%`, minHeight: b.rate > 0 ? 3 : 0, background: color, borderRadius: '8px 8px 0 0', opacity: active === null || active === i ? 1 : 0.5 }} />
                        <span style={{ ...mono, position: 'absolute', left: 0, right: 0, textAlign: 'center', bottom: `calc(${b.rate}% + 4px)`, fontSize: '0.64rem', fontWeight: 700, color: INK }}>
                          {b.rate}%
                        </span>
                      </>
                    ) : (
                      <span style={{ ...mono, position: 'absolute', left: 0, right: 0, bottom: 4, textAlign: 'center', fontSize: '0.62rem', color: MUTED }}>
                        n/a
                      </span>
                    )}

                    {active === i && (
                      <div role="tooltip"
                        style={{ ...body, position: 'absolute', top: 4, ...tipPos, zIndex: 20, width: 190, background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '10px 12px', boxShadow: '0 16px 32px -18px rgba(36,21,18,0.35)', pointerEvents: 'none', fontSize: '0.72rem', color: INK }}>
                        <p style={{ fontWeight: 700, color: PRIMARY, marginBottom: 6 }}>{dateLong}</p>
                        {available ? (
                          <>
                            <div className="flex justify-between"><span style={{ color: MUTED }}>Attendance rate</span><b>{b.rate}%</b></div>
                            <div className="flex justify-between"><span style={{ color: SUCCESS }}>Present</span><b>{b.present}</b></div>
                            <div className="flex justify-between"><span style={{ color: DANGER }}>Absent</span><b>{b.absent}</b></div>
                            <div className="flex justify-between" style={{ borderTop: `1px solid ${BORDER}`, marginTop: 4, paddingTop: 4 }}>
                              <span style={{ color: MUTED }}>Total records</span><b>{b.total}</b>
                            </div>
                          </>
                        ) : (
                          <p style={{ color: MUTED }}>No attendance records</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* X axis labels (same gap/padding as the plot so they align) */}
            <div className={`flex justify-between ${colGap}`} style={{ ...sidePad, marginTop: 8 }}>
              {buckets.map((b) => (
                <div key={b.key} className="flex-1 min-w-0 text-center">
                  <p style={{ ...mono, fontSize: '0.66rem', color: INK, fontWeight: 700 }}>
                    {b.startDate.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                  </p>
                  <p style={{ ...mono, fontSize: '0.62rem', color: MUTED }}>
                    {b.endDate.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </Panel>
  );
}

// ─── Duty status donut (pure SVG) ──────────────────────────────────────────

function DutyStatusDonut({ loading, duties }) {
  const counts = {
    upcoming:  duties.filter(d => d.status === 'upcoming').length,
    ongoing:   duties.filter(d => d.status === 'ongoing').length,
    completed: duties.filter(d => d.status === 'completed').length,
    cancelled: duties.filter(d => d.status === 'cancelled').length,
  };
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  let offsetAcc = 0;

  const segments = Object.entries(counts)
    .filter(([, v]) => v > 0)
    .map(([key, value]) => {
      const pct = total > 0 ? value / total : 0;
      const dash = pct * circumference;
      const seg = {
        key,
        color: DUTY_STATUS_COLORS[key],
        dash,
        gap: circumference - dash,
        offset: -offsetAcc,
        value,
        pct: Math.round(pct * 100),
      };
      offsetAcc += dash;
      return seg;
    });

  return (
    <Panel icon={<PieChart size={17} />} title="Duty status" subtitle="Duties by current status">
      {loading ? (
        <div className="flex items-center justify-center" style={{ minHeight: 170 }}>
          <div className="w-32 h-32 rounded-full animate-pulse" style={{ background: `${BORDER}99` }} />
        </div>
      ) : total === 0 ? (
        <EmptyState icon={<ClipboardList size={24} />}>No duties yet</EmptyState>
      ) : (
        <div className="flex items-center gap-5 flex-wrap justify-center">
          <div className="relative shrink-0" style={{ width: 128, height: 128 }}>
            <svg width="128" height="128" viewBox="0 0 112 112" className="-rotate-90" role="img"
              aria-label={`Duty status: ${segments.map(s => `${s.value} ${s.key}`).join(', ')}`}>
              <circle cx="56" cy="56" r={radius} fill="none" stroke={BG} strokeWidth="14" />
              {segments.map((s) => (
                <circle
                  key={s.key}
                  cx="56" cy="56" r={radius}
                  fill="none"
                  stroke={s.color}
                  strokeWidth="14"
                  strokeDasharray={`${s.dash} ${s.gap}`}
                  strokeDashoffset={s.offset}
                  strokeLinecap="butt"
                  style={{ transition: 'stroke-dasharray 0.6s ease' }}
                />
              ))}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span style={{ ...display, fontSize: '1.5rem', fontWeight: 700, color: PRIMARY, lineHeight: 1 }}>{total}</span>
              <span style={{ ...body, fontSize: '0.66rem', color: MUTED, marginTop: 3 }}>Duties</span>
            </div>
          </div>
          <div className="flex-1 min-w-[150px]">
            {Object.entries(counts).filter(([, v]) => v > 0).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between gap-3"
                style={{ fontSize: '0.8rem', padding: '8px 0', borderBottom: `1px solid ${BORDER}` }}>
                <div className="flex items-center gap-2">
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: DUTY_STATUS_COLORS[key], display: 'inline-block' }} />
                  <span style={{ ...body, fontWeight: 600, color: '#5c4a3f', textTransform: 'capitalize' }}>{key}</span>
                </div>
                <span style={{ ...body, color: MUTED }}>
                  <span style={{ ...display, fontWeight: 700, color: INK }}>{value}</span>
                  {' '}({segments.find(s => s.key === key)?.pct}%)
                </span>
              </div>
            ))}
            <div className="flex items-center justify-between" style={{ paddingTop: 8, fontSize: '0.8rem' }}>
              <span style={{ ...body, fontWeight: 600, color: MUTED }}>Total</span>
              <span style={{ ...display, fontWeight: 700, color: PRIMARY }}>{total}</span>
            </div>
          </div>
        </div>
      )}
    </Panel>
  );
}

// ─── Attendance by group ───────────────────────────────────────────────────

function GroupAttendanceChart({ loading, groups, records }) {
  const summaries = new Map(
    groups.map(group => [group.group_name, {
      name: group.group_name,
      present: 0,
      absent: 0,
    }])
  );

  records.forEach(record => {
    const name = record.group_name || 'Unassigned';
    if (!summaries.has(name)) summaries.set(name, { name, present: 0, absent: 0 });
    const rawStatus = String(record.status || '').toLowerCase();
    const status = rawStatus === 'excused' ? 'absent' : rawStatus;
    if (status === 'present' || status === 'absent') summaries.get(name)[status] += 1;
  });

  const rows = [...summaries.values()]
    .map(group => {
      const total = group.present + group.absent;
      return { ...group, total, rate: total ? Math.round(group.present / total * 100) : null };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <Panel icon={<Users size={17} />} title="Attendance by group" subtitle="Present ÷ recorded attendance for each assigned scholar group">
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <SkeletonBox key={i} h="h-12" rounded="rounded-xl" />)}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState icon={<Users size={24} />}>No scholar groups assigned yet</EmptyState>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
          {rows.map(group => (
            <div key={group.name} className="min-w-0">
              <div className="flex items-center justify-between gap-3 mb-1.5">
                <p className="truncate" style={{ ...body, fontSize: '0.82rem', fontWeight: 700, color: INK }}>{group.name}</p>
                <p className="shrink-0" style={{ ...mono, fontSize: '0.72rem', fontWeight: 700, color: group.rate === null ? MUTED : rateColor(group.rate) }}>
                  {group.rate === null ? 'No records' : `${group.rate}%`}
                </p>
              </div>
              <div role="img"
                aria-label={`${group.name}: ${group.present} present, ${group.absent} absent, ${group.total} total records`}
                style={{ display: 'flex', height: 10, overflow: 'hidden', borderRadius: 999, background: BG }}>
                {group.total > 0 && (
                  <>
                    <span style={{ width: `${group.present / group.total * 100}%`, background: SUCCESS }} />
                    <span style={{ width: `${group.absent / group.total * 100}%`, background: DANGER }} />
                  </>
                )}
              </div>
              <p style={{ ...body, fontSize: '0.7rem', color: MUTED, marginTop: 5 }}>
                {group.present} present · {group.absent} absent · {group.total} total
              </p>
            </div>
          ))}
          <div className="md:col-span-2 flex flex-wrap gap-x-4 gap-y-1 pt-3" style={{ borderTop: `1px solid ${BORDER}`, ...body, fontSize: '0.7rem', color: MUTED }}>
            <span className="flex items-center gap-1.5"><span style={{ width: 8, height: 8, borderRadius: '50%', background: SUCCESS }} /> Present</span>
            <span className="flex items-center gap-1.5"><span style={{ width: 8, height: 8, borderRadius: '50%', background: DANGER }} /> Absent</span>
          </div>
        </div>
      )}
    </Panel>
  );
}

// ─── Upcoming duties ───────────────────────────────────────────────────────

function UpcomingDuties({ loading, duties, navigate }) {
  return (
    <Panel
      icon={<Calendar size={17} />}
      title="Upcoming duties"
      subtitle="Upcoming and ongoing, soonest first"
      action={<PanelAction onClick={() => navigate('/staff/task-assignment')}>View all</PanelAction>}
    >
      {loading ? (
        <ListSkeleton rows={3} />
      ) : duties.length === 0 ? (
        <EmptyState icon={<Calendar size={24} />}>No upcoming duties</EmptyState>
      ) : (
        <div className="sd-list">
          {duties.slice(0, 5).map((d) => {
            const color = DUTY_STATUS_COLORS[d.status] || SLATE;
            const day = shortDate(d.duty_date, { day: 'numeric' });
            const month = shortDate(d.duty_date, { month: 'short' });
            return (
              <div key={d.id} className="sd-row">
                <div className="sd-date-tile" style={{ background: `${color}14`, color }}>
                  {day ? (
                    <>
                      <span style={{ ...display, fontSize: '1.05rem', fontWeight: 700, lineHeight: 1 }}>{day}</span>
                      <span style={{ ...body, fontSize: '0.62rem', fontWeight: 600, marginTop: 2 }}>{month}</span>
                    </>
                  ) : <Calendar size={16} />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate" style={{ ...display, fontSize: '0.95rem', fontWeight: 700, color: INK }}>{d.title}</p>
                    <span className="shrink-0 capitalize"
                      style={{ ...body, fontSize: '0.66rem', fontWeight: 700, color, background: `${color}16`, borderRadius: 999, padding: '2px 9px' }}>
                      {d.status}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1" style={{ marginTop: 4 }}>
                    {d.time_start && (
                      <span className="flex items-center gap-1" style={{ ...body, fontSize: '0.72rem', color: MUTED }}>
                        <Clock size={11} /> {d.time_start}
                      </span>
                    )}
                    {d.location && (
                      <span className="flex items-center gap-1 min-w-0" style={{ ...body, fontSize: '0.72rem', color: MUTED }}>
                        <MapPin size={11} className="shrink-0" /> <span className="truncate">{d.location}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

// ─── Recent attendance ─────────────────────────────────────────────────────

function RecentAttendance({ loading, records, navigate }) {
  return (
    <Panel
      icon={<CalendarCheck size={17} />}
      title="Recent attendance"
      subtitle="Latest records, newest first"
      action={<PanelAction onClick={() => navigate('/staff/attendance-reports')}>Full report</PanelAction>}
    >
      {loading ? (
        <ListSkeleton rows={4} />
      ) : records.length === 0 ? (
        <EmptyState icon={<FileSpreadsheet size={24} />}>No attendance records yet</EmptyState>
      ) : (
        <div className="sd-list">
          {records.slice(0, 5).map((r, i) => {
            const badge = STATUS_CFG[r.status] || STATUS_CFG.absent;
            return (
              <div key={i} className="sd-row" style={{ alignItems: 'center' }}>
                <div className="shrink-0 flex items-center justify-center rounded-full"
                  style={{ width: 38, height: 38, ...display, fontSize: '0.95rem', fontWeight: 700, color: PRIMARY, background: `${PRIMARY}12`, border: `1px solid ${PRIMARY}26` }}>
                  {r.scholar?.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate" style={{ ...body, fontSize: '0.86rem', fontWeight: 700, color: INK }}>{r.scholar}</p>
                  <p className="truncate" style={{ ...body, fontSize: '0.72rem', color: MUTED, marginTop: 1 }}>{r.duty}</p>
                  <p className="truncate" style={{ ...body, fontSize: '0.68rem', color: GOLD, marginTop: 2, fontWeight: 600 }}>
                    {r.group_name || 'Unassigned'}
                  </p>
                </div>
                <span className="shrink-0 inline-flex items-center gap-1"
                  style={{ padding: '4px 10px', borderRadius: 999, background: `${badge.color}16`, ...body, fontSize: '0.7rem', fontWeight: 700, color: badge.color }}>
                  {badge.icon} {badge.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

// ─── Recent announcements ──────────────────────────────────────────────────

function RecentAnnouncements({ loading, announcements, navigate }) {
  return (
    <Panel
      icon={<Megaphone size={17} />}
      title="Recent announcements"
      subtitle="Latest updates, newest first"
      action={<PanelAction onClick={() => navigate('/staff/announcements')}>View all</PanelAction>}
    >
      {loading ? (
        <ListSkeleton rows={4} />
      ) : announcements.length === 0 ? (
        <EmptyState icon={<Megaphone size={24} />}>No announcements yet</EmptyState>
      ) : (
        <div className="sd-list">
          {announcements.slice(0, 5).map((announcement) => {
            const cfg = PRIORITY_CFG[announcement.priority] || PRIORITY_CFG.info;
            const dateText = shortDate(announcement.created_at, { year: 'numeric', month: 'short', day: 'numeric' });
            return (
              <div key={announcement.id} className="sd-row" style={{ alignItems: 'flex-start' }}>
                <span className="sd-icon" style={{ background: `${cfg.color}18`, color: cfg.color }} aria-hidden="true">
                  {cfg.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate" style={{ ...display, fontSize: '0.95rem', fontWeight: 700, color: INK }}>{announcement.title}</p>
                  <p style={{ ...body, fontSize: '0.78rem', color: '#5c4a3f', lineHeight: 1.5, marginTop: 2, display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{announcement.content}</p>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1" style={{ ...body, fontSize: '0.72rem', color: MUTED, marginTop: 5 }}>
                    <span style={{ color: cfg.color, fontWeight: 700 }}>{cfg.label}</span>
                    {announcement.created_by && (
                      <>
                        <span className="sd-sep" />
                        <span style={{ color: INK, fontWeight: 600 }}>{announcement.created_by}</span>
                      </>
                    )}
                    {dateText && (
                      <>
                        <span className="sd-sep" />
                        <span>{dateText}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

// ─── Main StaffDashboard ───────────────────────────────────────────────────

const StaffDashboard = () => {
  const name = localStorage.getItem('name');
  const navigate = useNavigate();
  const fetchInProgress = useRef(false);

  const [duties, setDuties] = useState([]);
  const [groups, setGroups] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [makeupSources, setMakeupSources] = useState([]);
  const [notificationPreferences, setNotificationPreferences] = useState({});
  const [notificationError, setNotificationError] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async (showLoading = false) => {
    if (fetchInProgress.current) return;
    fetchInProgress.current = true;
    if (showLoading) setLoading(true);
    try {
      const endpoints = [
        ['duties', `${API}/duties`],
        ['groups', `${API}/staff/groups`],
        ['attendance', `${API}/staff/reports/duty-attendance`],
        ['announcements', `${API}/staff/announcements`],
        ['makeup', `${API}/staff/makeup-request-data`],
        ['preferences', `${API}/staff/settings/notifications`],
      ];
      const results = await Promise.allSettled(
        endpoints.map(([, url]) => axios.get(url, authHeaders()))
      );
      const data = {};
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          data[endpoints[index][0]] = result.value.data;
        } else {
          console.error(`Failed to refresh Staff dashboard ${endpoints[index][0]}:`, result.reason);
        }
      });

      setNotificationError(['duties', 'announcements', 'makeup', 'preferences']
        .some(key => results[endpoints.findIndex(([endpointKey]) => endpointKey === key)]?.status === 'rejected'));
      if (Array.isArray(data.duties)) setDuties(data.duties);
      if (Array.isArray(data.groups)) setGroups(data.groups);
      if (Array.isArray(data.attendance)) setAttendanceRecords(data.attendance);
      if (Array.isArray(data.announcements)) setAnnouncements(data.announcements);
      if (Array.isArray(data.makeup?.sources)) setMakeupSources(data.makeup.sources);
      if (data.preferences && typeof data.preferences === 'object') setNotificationPreferences(data.preferences);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      fetchInProgress.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialRefresh = window.setTimeout(() => fetchData(true), 0);
    const refreshInterval = window.setInterval(() => fetchData(), 60_000);
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') fetchData();
    };
    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      window.clearTimeout(initialRefresh);
      window.clearInterval(refreshInterval);
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [fetchData]);

  const normalizedDuties = duties.map(d => ({ ...d, status: getComputedDutyStatus(d) }));
  const upcoming = normalizedDuties.filter(d => d.status === 'upcoming').length;
  const ongoing = normalizedDuties.filter(d => d.status === 'ongoing').length;

  const upcomingDutiesSorted = normalizedDuties
    .filter(d => d.status === 'upcoming' || d.status === 'ongoing')
    .sort((a, b) => new Date(a.duty_date) - new Date(b.duty_date));

  const recentAttendanceSorted = [...attendanceRecords]
    .sort((a, b) => new Date(b.marked_at || b.date) - new Date(a.marked_at || a.date));

  const recentAnnouncementsSorted = [...announcements]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const presentCount = attendanceRecords.filter(r => r.status === 'present').length;
  const attendanceRate = attendanceRecords.length > 0
    ? Math.round((presentCount / attendanceRecords.length) * 100)
    : 0;

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const now = new Date();
  const todayLabel = now.toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <div className="staff-hub" style={{ ...body, background: BG }}>
      <div className="hub-inner">

        {/* ── Page header: title + greeting on the left, date and notifications on the right ── */}
        <div className="mb-5">
          <div
            className="staff-page-header-card flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 min-w-0"
            style={{ ...cardWrap, padding: 'clamp(14px, 3vw, 20px)' }}
          >
            <div className="min-w-0">
              <p className="staff-page-eyebrow">STAFF PORTAL</p>
              <h1 className="staff-page-title">Dashboard</h1>
              <p className="staff-page-description">Your daily overview of duties, attendance, and announcements.</p>
              <p style={{ ...body, fontSize: '0.84rem', color: INK, marginTop: 8 }}>
                {getGreeting()}, <span style={{ color: PRIMARY, fontWeight: 700 }}>{name || 'Staff'}</span>
              </p>
            </div>

            <div className="flex items-center gap-4 flex-shrink-0 sd-header-aside">
              <span className="shrink-0 flex items-center justify-center"
                style={{ width: 44, height: 44, borderRadius: 12, background: `${GOLD}1F`, color: GOLD }}>
                <Calendar size={20} />
              </span>
              <div className="min-w-0">
                <span className="sd-date-label">Today</span>
                <span className="sd-date-value">{todayLabel}</span>
              </div>
              <div aria-hidden="true" style={{ alignSelf: 'stretch', width: 1, background: BORDER, margin: '0 2px' }} />
              <StaffNotifications
                loading={loading}
                duties={normalizedDuties}
                announcements={recentAnnouncementsSorted}
                makeupSources={makeupSources}
                preferences={notificationPreferences}
                error={notificationError}
                onRetry={() => fetchData(true)}
                onNavigate={navigate}
              />
            </div>
          </div>
        </div>

        {/* ── KPI cards ── */}
        <StatisticsCards
          loading={loading}
          totalDuties={normalizedDuties.length}
          upcoming={upcoming}
          ongoing={ongoing}
          totalGroups={groups.length}
          attendanceRate={attendanceRate}
          announcements={announcements.length}
        />

        {/* ── Main (analytics) + aside (what needs attention next) ── */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 mb-4">
          <div className="order-3 min-w-0 xl:order-1 xl:col-span-8 xl:col-start-1 xl:row-start-1">
            <WeeklyAttendanceChart loading={loading} records={attendanceRecords} />
          </div>
          <div className="order-1 min-w-0 xl:order-2 xl:col-span-4 xl:col-start-9 xl:row-start-1">
            <DutyStatusDonut loading={loading} duties={normalizedDuties} />
          </div>
          <div className="order-4 min-w-0 xl:order-3 xl:col-span-8 xl:col-start-1 xl:row-start-2">
            <GroupAttendanceChart loading={loading} groups={groups} records={attendanceRecords} />
          </div>
          <div className="order-2 min-w-0 xl:order-4 xl:col-span-4 xl:col-start-9 xl:row-start-2">
            <UpcomingDuties loading={loading} duties={upcomingDutiesSorted} navigate={navigate} />
          </div>
        </div>

        {/* ── Activity feeds ── */}
        <div className="grid grid-cols-1 items-stretch lg:grid-cols-2 gap-4">
          <div className="h-full min-w-0"><RecentAttendance loading={loading} records={recentAttendanceSorted} navigate={navigate} /></div>
          <div className="h-full min-w-0"><RecentAnnouncements loading={loading} announcements={recentAnnouncementsSorted} navigate={navigate} /></div>
        </div>
      </div>

      <style>{`
        .staff-hub { width: 100%; min-height: 100vh; overflow-x: hidden; }
        .hub-inner { box-sizing: border-box; padding: 16px 16px 48px; width: 100%; max-width: none; margin: 0; }
        @media (min-width: 640px) { .hub-inner { padding: 24px 24px 48px; } }
        @media (min-width: 1024px) { .hub-inner { padding: 32px 32px 48px; } }

        .staff-hub button:focus-visible,
        .staff-hub [tabindex]:focus-visible { outline: 2px solid ${GOLD}; outline-offset: 2px; }

        /* Same class names as StaffAnnouncement / OfficerAnnouncement. :where() keeps these at zero
           specificity, so the shared staff-page-* styles win whenever they are loaded. */
        :where(.staff-page-eyebrow) { font-family: 'Inter', 'Segoe UI', sans-serif; font-size: 0.7rem; font-weight: 700; letter-spacing: 0.1em; color: ${GOLD}; }
        :where(.staff-page-title) { font-family: 'Lora', Georgia, 'Times New Roman', serif; font-size: clamp(1.6rem, 4vw, 2rem); font-weight: 700; color: ${PRIMARY}; line-height: 1.15; margin-top: 3px; }
        :where(.staff-page-description) { font-family: 'Inter', 'Segoe UI', sans-serif; font-size: 0.9rem; color: ${MUTED}; margin-top: 6px; line-height: 1.55; }

        .sd-header-aside { padding-top: 14px; border-top: 1px solid ${BORDER}; }
        @media (min-width: 1024px) { .sd-header-aside { padding-top: 0; border-top: none; } }
        .sd-date-label { display: block; font-family: 'Inter', 'Segoe UI', sans-serif; font-size: 0.7rem; font-weight: 600; color: ${MUTED}; }
        .sd-date-value { display: block; font-family: 'Lora', Georgia, serif; font-size: 0.95rem; font-weight: 600; color: ${INK}; margin-top: 2px; }

        .sd-action {
          display: inline-flex; align-items: center; gap: 2px; flex-shrink: 0;
          padding: 6px 10px; border-radius: 999px; border: 1px solid ${BORDER}; background: #fff;
          font-family: 'Inter', 'Segoe UI', sans-serif; font-size: 0.74rem; font-weight: 700; color: ${PRIMARY};
          cursor: pointer; white-space: nowrap; transition: background-color 150ms ease;
        }
        .sd-action:hover { background: ${BG}; }

        /* ── Lists: one bordered block, rows divided by hairlines (same as the officer feed) ── */
        .sd-list { background: #fff; border: 1px solid ${BORDER}; border-radius: 14px; overflow: hidden; }
        .sd-row { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-bottom: 1px solid ${BORDER}; transition: background-color 150ms ease; }
        .sd-row:last-child { border-bottom: none; }
        .sd-row:hover { background: #FCFAF5; }
        .sd-icon { width: 36px; height: 36px; border-radius: 12px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
        .sd-date-tile { width: 44px; height: 46px; border-radius: 12px; flex-shrink: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
        .sd-sep { width: 3px; height: 3px; border-radius: 50%; background: ${BORDER}; flex-shrink: 0; }

        .sd-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 36px 16px; border: 1.5px dashed ${BORDER}; background: #fff; border-radius: 14px; }
        .sd-empty-icon { width: 48px; height: 48px; border-radius: 14px; background: ${GOLD}18; color: ${GOLD}; display: flex; align-items: center; justify-content: center; margin-bottom: 12px; }
        .sd-chart-empty { min-height: 200px; display: flex; align-items: stretch; }
        .sd-chart-empty > * { flex: 1; }

        .sd-bar-col { outline: none; border-radius: 6px; }
        .sd-bar-col:focus-visible { outline: 2px solid ${GOLD}; outline-offset: 2px; }

        @media (prefers-reduced-motion: reduce) {
          .staff-hub * { transition: none !important; animation-duration: 0.01ms !important; }
        }
      `}</style>
    </div>
  );
};

export default StaffDashboard;