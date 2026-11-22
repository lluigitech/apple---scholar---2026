import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import OfficerNotifications from '../../components/Officer/OfficerNotifications';
import { API_BASE } from '../../components/Officer/Reports/ReportsHelpers';
import {
  Users, Clock, CheckCircle, XCircle, TrendingUp,
  Calendar,
  FileCheck, AlertTriangle, FileText, CalendarDays,
  ArrowUpRight, BarChart3, Megaphone, ChevronRight
} from 'lucide-react';

// ── Executive design tokens — same system as the Admin portal ──
const BG           = '#F7F4EE';
const SURFACE      = '#FFFDF9';
const BORDER       = '#E7D8C7';
const PRIMARY      = '#6D2140';
const PRIMARY_DEEP = '#4A1730';
const INK          = '#241512';
const INK_SOFT     = '#5C4E42';
const MUTED        = '#8A7A68';
const BRONZE       = '#A9784E';
const BRONZE_DARK  = '#8A5E38'; // readable bronze for small text
const SUCCESS      = '#6B8F71';
const WARNING      = '#C08A3E';
const DANGER       = '#A24A4A';
const SAND         = '#F1E8DA';
const RADIUS       = 16;
const SHADOW       = '0 1px 2px rgba(74, 23, 48, 0.04), 0 6px 18px rgba(74, 23, 48, 0.04)';

// Existing Officer Announcements route — must match the path registered in your router.
const OFFICER_ANNOUNCEMENTS_PATH = '/officer/announcements';

const serif = { fontFamily: "'Playfair Display', serif" };
const sans  = { fontFamily: "'Inter', sans-serif" };
const mono  = { fontFamily: "ui-monospace, 'SFMono-Regular', Menlo, monospace" };

const card = { background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: RADIUS, boxShadow: SHADOW };

function SkeletonBox({ h = 16, w = '100%', radius = 8 }) {
  return <div className="animate-pulse" style={{ height: h, width: w, borderRadius: radius, background: '#EFE6D8' }} />;
}

const parseDueDate = value => {
  const date = value instanceof Date ? value : new Date(`${String(value || '').slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatTaskDueDate = value => {
  const date = parseDueDate(value);
  return date
    ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'Due date unavailable';
};

// "Today", "Tomorrow", "In 5 days" — with a colour that gets warmer as it gets closer
const getDueBadge = value => {
  const date = parseDueDate(value);
  if (!date) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((date.getTime() - today.getTime()) / 86400000);
  if (days < 0) return { label: 'Overdue', color: DANGER };
  if (days === 0) return { label: 'Today', color: DANGER };
  if (days === 1) return { label: 'Tomorrow', color: WARNING };
  if (days <= 3) return { label: `In ${days} days`, color: WARNING };
  return { label: `In ${days} days`, color: MUTED };
};

// Shared panel shell: icon chip + serif title + optional description.
function Panel({ icon: Icon, title, description, children, className = '', action = null }) {
  return (
    <section className={`min-w-0 ${className}`} style={{ ...card, padding: '20px 22px' }}>
      <div className="flex items-start gap-3" style={{ marginBottom: 16 }}>
        <span className="inline-flex flex-shrink-0 items-center justify-center rounded-full" style={{ width: 34, height: 34, background: `${PRIMARY}0F`, color: PRIMARY }}>
          <Icon size={16} strokeWidth={1.8} />
        </span>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ ...serif, fontSize: '1.08rem', fontWeight: 600, color: INK, lineHeight: 1.25 }}>{title}</h2>
          {description && <p style={{ ...sans, fontSize: '0.76rem', color: MUTED, marginTop: 2 }}>{description}</p>}
        </div>
        {action && <div className="ml-auto flex-shrink-0">{action}</div>}
      </div>
      {children}
    </section>
  );
}

// ─── StatisticsCards ───────────────────────────────────────────────────────

function StatisticsCards({ loading, totalScholars, pending, approved, rejected, onNavigate }) {
  const cards = [
    { label: 'Total Scholars', value: totalScholars, icon: Users, color: PRIMARY },
    { label: 'Pending Review', value: pending, icon: Clock, color: WARNING, path: '/officer/validation' },
    { label: 'Approved', value: approved, icon: CheckCircle, color: SUCCESS },
    { label: 'Rejected', value: rejected, icon: XCircle, color: DANGER },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {cards.map((c) => {
        const Tag = c.path ? 'button' : 'div';
        return (
          <Tag
            key={c.label}
            type={c.path ? 'button' : undefined}
            onClick={c.path ? () => onNavigate(c.path) : undefined}
            className="od-hover h-full min-w-0 p-5 text-left transition-opacity"
            style={{ ...card, cursor: c.path ? 'pointer' : 'default', width: '100%' }}
          >
            <div className="flex items-center justify-between gap-3">
              <p style={{ ...sans, fontSize: '0.8rem', fontWeight: 500, color: MUTED }}>{c.label}</p>
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full" style={{ background: `${c.color}14`, color: c.color }}>
                <c.icon size={16} />
              </span>
            </div>
            {loading
              ? <div style={{ marginTop: 14 }}><SkeletonBox h={30} w={56} /></div>
              : <p style={{ ...serif, fontSize: '2rem', fontWeight: 600, color: INK, lineHeight: 1.1, marginTop: 14 }}>{c.value}</p>}
          </Tag>
        );
      })}
    </div>
  );
}

// ─── QuickActions — one strip of shortcuts ─────────────────────────────────

function QuickActions({ onNavigate }) {
  const actions = [
    { label: 'Manual Validation', hint: 'Review pending submissions', icon: FileCheck, path: '/officer/validation', color: PRIMARY },
    { label: 'Task Progress', hint: 'Track deadlines and scholar submissions', icon: Calendar, path: '/officer/task-assignment', color: WARNING },
    { label: 'Reports', hint: 'Open compliance reports', icon: BarChart3, path: '/officer/reports', color: BRONZE },
    { label: 'Summary Report', hint: 'Generate a summary', icon: FileText, path: '/officer/summary-report', color: SUCCESS },
  ];

  return (
    <nav aria-label="Quick actions" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {actions.map((a) => (
        <button
          key={a.path}
          type="button"
          onClick={() => onNavigate(a.path)}
          className="od-hover group flex min-w-0 items-center gap-3.5 p-4 text-left transition-colors"
          style={{ ...card, cursor: 'pointer' }}
        >
          <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full transition-transform group-hover:scale-105" style={{ background: `${a.color}14`, color: a.color }}>
            <a.icon size={18} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate" style={{ ...sans, fontSize: '0.86rem', fontWeight: 700, color: INK }}>{a.label}</span>
            <span className="block truncate" style={{ ...sans, fontSize: '0.74rem', color: MUTED, marginTop: 2 }}>{a.hint}</span>
          </span>
          <ArrowUpRight size={15} style={{ color: BRONZE, flexShrink: 0 }} />
        </button>
      ))}
    </nav>
  );
}

// ─── Compliance (main panel) ───────────────────────────────────────────────

function ComplianceSeal({ loading, error, tasks }) {
  return (
    <Panel icon={TrendingUp} title="Overall Scholar Compliance" description="Latest Monthly Letter task and active Report Card, COR, and Other Documents tasks." className="h-full">
      {loading ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <SkeletonBox h={150} radius={12} />
          <SkeletonBox h={150} radius={12} />
        </div>
      ) : error ? (
        <p style={{ ...sans, fontSize: '0.8rem', color: DANGER }}>Couldn&apos;t load task compliance. It will retry automatically.</p>
      ) : tasks.length === 0 ? (
        <p className="py-6 text-center" style={{ ...sans, fontSize: '0.8rem', color: MUTED }}>No active tasks.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {tasks.map(task => {
            const stats = [
              { label: 'Submitted', value: task.submitted, color: SUCCESS },
              { label: 'Pending', value: task.pending, color: WARNING },
              { label: 'Not Submitted', value: task.notSubmitted, color: DANGER },
            ];
            const total = stats.reduce((sum, stat) => sum + stat.value, 0);
            const submittedPct = total > 0 ? Math.round((task.submitted / total) * 100) : 0;

            return (
              <div key={task.task_id} className="flex min-w-0 flex-col rounded-xl p-4" style={{ border: `1px solid ${BORDER}`, background: BG }}>
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 style={{ ...serif, fontSize: '0.96rem', fontWeight: 600, color: INK, overflowWrap: 'anywhere' }}>
                      {task.title || task.type}
                    </h3>
                    <p style={{ ...sans, fontSize: '0.7rem', color: MUTED, marginTop: 3, lineHeight: 1.5 }}>
                      {task.type === 'Monthly Report' ? 'Monthly Letter · Latest task' : task.type}
                      {' · '}Due {formatTaskDueDate(task.due_date)} · Task #{task.task_id}
                    </p>
                  </div>
                  <span className="flex-shrink-0 text-right" style={{ ...serif, fontSize: '1.3rem', fontWeight: 600, color: PRIMARY, lineHeight: 1 }}>
                    {submittedPct}%
                    <span className="block" style={{ ...sans, fontSize: '0.6rem', fontWeight: 500, color: MUTED, marginTop: 3 }}>submitted</span>
                  </span>
                </div>

                <div className="mt-3.5 grid grid-cols-3 gap-2">
                  {stats.map(stat => (
                    <div key={stat.label} className="min-w-0 rounded-lg p-2.5" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
                      <p className="flex items-center gap-1.5" style={{ ...sans, fontSize: '0.64rem', fontWeight: 600, color: MUTED }}>
                        <span className="inline-block rounded-full" style={{ width: 7, height: 7, background: stat.color }} />
                        <span style={{ overflowWrap: 'anywhere' }}>{stat.label}</span>
                      </p>
                      <p style={{ ...serif, fontSize: '1.3rem', fontWeight: 600, color: INK, lineHeight: 1, marginTop: 6 }}>{stat.value}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-3.5 flex h-2 w-full overflow-hidden rounded-full" style={{ background: '#E9DCC8' }} role="img" aria-label={`${task.title || task.type}: submitted, pending, and not submitted`}>
                  {total > 0 && stats.map(stat => stat.value > 0 && (
                    <div key={stat.label} style={{ width: `${(stat.value / total) * 100}%`, background: stat.color }} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

// ─── UpcomingDeadlines ─────────────────────────────────────────────────────

function UpcomingDeadlines({ loading, deadlines, onNavigate }) {
  return (
    <Panel
      icon={Calendar}
      title="Upcoming Deadlines"
      description="Next tasks due for your scholars."
      className="h-full"
      action={(
        <button type="button" onClick={() => onNavigate('/officer/task-assignment')} className="od-hover inline-flex items-center gap-1 rounded-full"
          style={{ ...sans, fontSize: '0.72rem', fontWeight: 700, color: PRIMARY, padding: '6px 12px', border: `1px solid ${BORDER}`, background: SURFACE, cursor: 'pointer' }}>
          Manage <ChevronRight size={13} />
        </button>
      )}
    >
      {loading ? (
        <div className="space-y-2.5">
          {[1, 2, 3, 4].map(i => <SkeletonBox key={i} h={52} radius={12} />)}
        </div>
      ) : deadlines.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Calendar size={28} className="mb-2" style={{ color: `${BRONZE}66` }} />
          <p style={{ ...sans, fontSize: '0.8rem', color: MUTED }}>No upcoming deadlines</p>
        </div>
      ) : (
        <ul>
          {deadlines.slice(0, 5).map((d, i) => {
            const dueValue = d.due_date || d.date;
            const badge = getDueBadge(dueValue);
            return (
              <li key={d.task_id ?? d.id ?? i} className="flex items-center gap-3 py-3" style={{ borderTop: i === 0 ? 'none' : `1px solid ${BORDER}` }}>
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full" style={{ background: `${PRIMARY}0F`, color: PRIMARY }}>
                  <Calendar size={14} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate" style={{ ...sans, fontSize: '0.82rem', fontWeight: 600, color: INK }}>{d.title || d.name}</p>
                  <p style={{ ...mono, fontSize: '0.68rem', color: MUTED, marginTop: 2 }}>{formatTaskDueDate(dueValue)}</p>
                </div>
                {badge && (
                  <span className="flex-shrink-0 rounded-full px-2.5 py-1" style={{ ...sans, fontSize: '0.64rem', fontWeight: 700, color: badge.color, background: `${badge.color}14` }}>
                    {badge.label}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

// ─── RecentAnnouncements ───────────────────────────────────────────────────

const PRIORITY_STYLES = {
  critical: { label: 'Critical', color: DANGER },
  important: { label: 'Important', color: WARNING },
  info: { label: 'Info', color: BRONZE },
};

const getRecentAnnouncements = (list, limit = 3) => {
  const time = item => {
    const t = new Date(item?.created_at).getTime();
    return Number.isNaN(t) ? -Infinity : t;
  };
  return [...list].sort((a, b) => time(b) - time(a)).slice(0, limit);
};

const formatAnnouncementDate = value => {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
};

const roleLabel = role => {
  const text = String(role || '').trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : '';
};

function RecentAnnouncements({ loading, error, announcements, onNavigate, onRetry }) {
  const recent = getRecentAnnouncements(announcements);
  const goToAnnouncements = () => onNavigate(OFFICER_ANNOUNCEMENTS_PATH);

  return (
    <Panel
      icon={Megaphone}
      title="Recent Announcements"
      description="Latest updates from the administration and staff."
      action={(
        <button type="button" onClick={goToAnnouncements} className="od-hover inline-flex items-center gap-1 rounded-full"
          style={{ ...sans, fontSize: '0.72rem', fontWeight: 700, color: PRIMARY, padding: '6px 12px', border: `1px solid ${BORDER}`, background: SURFACE, cursor: 'pointer' }}>
          View All <ChevronRight size={13} />
        </button>
      )}
    >
      {loading ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {[1, 2, 3].map(i => <SkeletonBox key={i} h={128} radius={12} />)}
        </div>
      ) : error && recent.length === 0 ? (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl p-3.5"
          style={{ border: `1px solid ${DANGER}35`, background: `${DANGER}0d`, ...sans, fontSize: '0.78rem', fontWeight: 600, color: DANGER }}>
          <span className="flex items-center gap-2"><AlertTriangle size={14} className="flex-shrink-0" />Announcements could not be loaded.</span>
          <button type="button" onClick={onRetry} style={{ ...sans, fontSize: '0.74rem', fontWeight: 700, color: DANGER, background: 'none', border: 'none', textDecoration: 'underline', cursor: 'pointer' }}>Retry</button>
        </div>
      ) : recent.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Megaphone size={28} className="mb-2" style={{ color: `${BRONZE}66` }} />
          <p style={{ ...sans, fontSize: '0.84rem', fontWeight: 700, color: INK }}>No announcements yet.</p>
          <p style={{ ...sans, fontSize: '0.76rem', color: MUTED, marginTop: 2 }}>New announcements will appear here when they are published.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {recent.map((a, i) => {
              const priority = PRIORITY_STYLES[String(a.priority || '').toLowerCase()];
              const source = [a.created_by_name, roleLabel(a.created_by_role)].filter(Boolean).join(' · ');
              const date = formatAnnouncementDate(a.created_at);
              return (
                <button key={a.id ?? i} type="button" onClick={goToAnnouncements}
                  className="od-hover flex h-full min-w-0 flex-col rounded-xl p-4 text-left transition-colors"
                  style={{ border: `1px solid ${BORDER}`, background: BG, cursor: 'pointer' }}>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    {priority ? (
                      <span style={{ ...sans, fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: priority.color, background: `${priority.color}1a`, border: `1px solid ${priority.color}40`, borderRadius: 999, padding: '2px 9px' }}>
                        {priority.label}
                      </span>
                    ) : <span />}
                    <ChevronRight size={14} style={{ color: BRONZE, flexShrink: 0 }} />
                  </div>
                  <p style={{ ...serif, fontSize: '0.96rem', fontWeight: 600, color: INK, lineHeight: 1.3, overflowWrap: 'anywhere', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {a.title || 'Untitled announcement'}
                  </p>
                  {a.content && (
                    <p style={{ ...sans, fontSize: '0.78rem', color: INK_SOFT, marginTop: 6, lineHeight: 1.55, overflowWrap: 'anywhere', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {a.content}
                    </p>
                  )}
                  {(source || date) && (
                    <p className="mt-auto" style={{ ...sans, fontSize: '0.7rem', color: MUTED, paddingTop: 10 }}>
                      {source}{source && date ? ' · ' : ''}{date && <span style={mono}>{date}</span>}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
          {error && (
            <p style={{ ...sans, fontSize: '0.72rem', color: MUTED, marginTop: 10 }}>Couldn&apos;t refresh announcements. Showing the last loaded ones.</p>
          )}
        </>
      )}
    </Panel>
  );
}

// ─── Main OfficerDashboard ─────────────────────────────────────────────────

const authHeader = () => {
  const token = localStorage.getItem('token');
  return { Authorization: `Bearer ${token}` };
};

const OfficerDashboard = () => {
  const name = localStorage.getItem('name');
  const navigate = useNavigate();
  const fetchInProgress = useRef(false);

  const [submissions, setSubmissions] = useState([]);
  const [validationCounts, setValidationCounts] = useState({ newSubmissions: 0, pendingReviews: 0 });
  const [scholars, setScholars] = useState([]);
  const [taskCompliance, setTaskCompliance] = useState([]);
  const [taskComplianceError, setTaskComplianceError] = useState(false);
  const [deadlines, setDeadlines] = useState([]);
  const [complianceReminders, setComplianceReminders] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [announcementsError, setAnnouncementsError] = useState(false);
  const [notificationDataError, setNotificationDataError] = useState(false);
  const [notificationPreferences, setNotificationPreferences] = useState({
    new_submissions: true,
    pending_reviews: true,
    deadlines: true,
    announcements: true,
  });
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchData = useCallback(async (showLoading = false) => {
    if (fetchInProgress.current) return;
    fetchInProgress.current = true;
    if (showLoading) setLoading(true);

    try {
      const endpoints = [
        ['submissions', `${API_BASE}/submission/all`],
        ['validationQueue', `${API_BASE}/submission/scholar-view`],
        ['scholars', `${API_BASE}/staff/pending`],
        ['tasks', `${API_BASE}/tasks`],
        ['taskCompliance', `${API_BASE}/officer/reports/task-compliance`],
        ['complianceReminders', `${API_BASE}/officer/notifications/compliance-due`],
        ['announcements', `${API_BASE}/officer/announcements`],
        ['preferences', `${API_BASE}/officer/settings/notifications`],
      ];
      const results = await Promise.allSettled(
        endpoints.map(([, url]) => axios.get(url, { headers: authHeader() }))
      );
      const data = {};
      results.forEach((result, index) => {
        const [key] = endpoints[index];
        if (result.status === 'fulfilled') {
          data[key] = result.value.data;
        } else {
          console.error(`Failed to refresh Officer dashboard ${key}:`, result.reason);
        }
      });

      const announcementsIndex = endpoints.findIndex(([key]) => key === 'announcements');
      setAnnouncementsError(results[announcementsIndex]?.status === 'rejected');
      const taskComplianceIndex = endpoints.findIndex(([key]) => key === 'taskCompliance');
      setTaskComplianceError(results[taskComplianceIndex]?.status === 'rejected');
      setNotificationDataError(
        ['validationQueue', 'complianceReminders', 'announcements', 'preferences']
          .some(key => results[endpoints.findIndex(([endpointKey]) => endpointKey === key)]?.status === 'rejected')
      );

      if (Array.isArray(data.submissions)) setSubmissions(data.submissions);
      if (Array.isArray(data.scholars)) setScholars(data.scholars);
      if (Array.isArray(data.taskCompliance)) setTaskCompliance(data.taskCompliance);
      if (Array.isArray(data.announcements)) setAnnouncements(data.announcements);
      if (data.preferences && typeof data.preferences === 'object') setNotificationPreferences(data.preferences);

      if (Array.isArray(data.validationQueue)) {
        const items = data.validationQueue.flatMap(scholar =>
          ['monthly_letters', 'report_cards', 'cors', 'other_documents', 'grades']
            .flatMap(category => Array.isArray(scholar[category]) ? scholar[category] : [])
        );
        setValidationCounts({
          newSubmissions: items.filter(item => String(item.status || '').toLowerCase() === 'pending').length,
          pendingReviews: items.filter(item => String(item.status || '').toLowerCase() === 'under_review').length,
        });
      }

      if (Array.isArray(data.complianceReminders)) setComplianceReminders(data.complianceReminders);
      if (Array.isArray(data.tasks)) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        setDeadlines(data.tasks.filter(task => {
          if (!task.due_date) return false;
          const dueDate = task.due_date instanceof Date
            ? new Date(task.due_date.getFullYear(), task.due_date.getMonth(), task.due_date.getDate())
            : new Date(`${String(task.due_date).slice(0, 10)}T00:00:00`);
          return !Number.isNaN(dueDate.getTime()) && dueDate >= today;
        }));
      }
    } catch (error) {
      console.error('Failed to process Officer dashboard refresh:', error);
    } finally {
      fetchInProgress.current = false;
      setLoading(false);
      setLastUpdated(new Date());
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

  const pending = submissions.filter(s => s.status === 'pending').length;
  const approved = submissions.filter(s => s.status === 'approved').length;
  const rejected = submissions.filter(s => s.status === 'rejected').length;

  const todayLabel = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div className="min-h-screen" style={{ background: BG, ...sans }}>
      <style>{`
        .od-hover:hover { background: ${SAND} !important; }
        .od-hover:focus-visible { outline: 2px solid ${BRONZE}; outline-offset: 2px; }
      `}</style>

      <div className="flex flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8" style={{ minWidth: 0 }}>

        {/* ── Page header — same layout as Announcements ──
            No overflow:hidden so the notifications dropdown is never clipped. */}
        <header
          className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"
          style={{ ...card, padding: 'clamp(14px, 3vw, 20px)', boxShadow: '0 12px 28px -20px rgba(36,21,18,0.22)', position: 'relative' }}
        >
          <div className="min-w-0">
            <p style={{ ...sans, fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', color: BRONZE }}>OFFICER PORTAL</p>
            <h1 style={{ fontFamily: "'Lora', Georgia, 'Times New Roman', serif", fontSize: 'clamp(1.6rem, 4vw, 2rem)', fontWeight: 700, color: PRIMARY, lineHeight: 1.15, marginTop: 3 }}>
              Dashboard
            </h1>
            <p style={{ ...sans, fontSize: '0.9rem', color: MUTED, marginTop: 6, lineHeight: 1.55 }}>
              Welcome back, <strong style={{ color: INK }}>{name || 'Officer'}</strong>. Here&apos;s an overview of your assigned scholars, submissions, and compliance.
              {lastUpdated && (
                <span style={{ ...mono, fontSize: '0.72rem', color: MUTED }}> · Updated {lastUpdated.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })}</span>
              )}
            </p>
          </div>

          <div
            className="flex flex-shrink-0 items-center gap-4 self-start lg:self-auto"
            style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '10px 14px', position: 'relative' }}
          >
            <span className="inline-flex flex-shrink-0 items-center justify-center rounded-full" style={{ width: 36, height: 36, background: `${PRIMARY}0F`, color: PRIMARY }}>
              <CalendarDays size={16} />
            </span>
            <div>
              <p style={{ ...sans, fontSize: '0.68rem', color: MUTED }}>Today</p>
              <p style={{ ...sans, fontSize: '0.88rem', fontWeight: 600, color: INK, whiteSpace: 'nowrap' }}>{todayLabel}</p>
            </div>
            <div aria-hidden="true" style={{ alignSelf: 'stretch', width: 1, background: BORDER, margin: '0 2px' }} />
            <OfficerNotifications
              loading={loading}
              pending={validationCounts.newSubmissions}
              pendingReviews={validationCounts.pendingReviews}
              deadlines={complianceReminders}
              announcements={announcements}
              preferences={notificationPreferences}
              error={notificationDataError}
              onRetry={() => fetchData(true)}
              onNavigate={navigate}
            />
          </div>
        </header>

        {/* ── 1. Overview numbers ── */}
        <StatisticsCards
          loading={loading}
          totalScholars={scholars.length}
          pending={pending}
          approved={approved}
          rejected={rejected}
          onNavigate={path => navigate(path)}
        />

        {/* ── 2. Shortcuts ── */}
        <QuickActions onNavigate={path => navigate(path)} />

        {/* ── 3. Compliance (main) + Upcoming Deadlines (side) ── */}
        <div className="grid grid-cols-1 items-stretch gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <ComplianceSeal loading={loading} error={taskComplianceError} tasks={taskCompliance} />
          <UpcomingDeadlines loading={loading} deadlines={deadlines} onNavigate={path => navigate(path)} />
        </div>

        {/* ── 4. Recent Announcements: three cards across ── */}
        <RecentAnnouncements
          loading={loading}
          error={announcementsError}
          announcements={announcements}
          onNavigate={path => navigate(path)}
          onRetry={() => fetchData(true)}
        />
      </div>
    </div>
  );
};

export default OfficerDashboard;