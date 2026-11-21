import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import OfficerNotifications from '../../components/Officer/OfficerNotifications';
import { API_BASE } from '../../components/Officer/Reports/ReportsHelpers';
import {
  Users, Clock, CheckCircle, XCircle, TrendingUp,
  Calendar, Zap,
  FileCheck, AlertTriangle, FileText, CalendarDays,
  ArrowUpRight, BarChart3, Megaphone, ChevronRight
} from 'lucide-react';

// ── Token system — shared across the whole portal ──
const MAROON = '#7f2d3a';
const MAROON_DEEP = '#4f1620';
const GOLD = '#b98b4e';
const GOLD_LIGHT = '#d4af7a';
const IVORY = '#FBF7F2';
const INK = '#241512';
const SAGE = '#6b8f71';
const CLAY = '#c1666b';
const AMBER = '#b8863f';
const PAPER = '#F6EFE4';
const RULE = '#e8dccb';
const ROSE = '#F5E8EA';

// Existing Officer Announcements route — must match the path registered in your router.
const OFFICER_ANNOUNCEMENTS_PATH = '/officer/announcements';

const serif = { fontFamily: "'Playfair Display', serif" };
const sans = { fontFamily: "'DM Sans', sans-serif" };
const mono = { fontFamily: "ui-monospace, 'SFMono-Regular', Menlo, monospace" };

const tile = {
  background: '#fff',
  border: `1px solid ${RULE}`,
  borderRadius: 14,
  boxShadow: '0 8px 20px -16px rgba(36,21,18,0.35)',
};

function SkeletonBox({ h = 16, w = '100%', radius = 6 }) {
  return <div className="animate-pulse" style={{ height: h, width: w, borderRadius: radius, background: PAPER }} />;
}

const formatTaskDueDate = value => {
  const date = value instanceof Date ? value : new Date(`${String(value || '').slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? 'Due date unavailable'
    : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

// Shared panel shell: icon chip + serif title + optional description.
function Panel({ icon: Icon, title, description, children, className = '', style = {}, action = null }) {
  return (
    <section className={`min-w-0 ${className}`} style={{ ...tile, padding: '18px 20px', ...style }}>
      <div className="flex items-start gap-3" style={{ marginBottom: 14 }}>
        <span className="inline-flex flex-shrink-0 items-center justify-center rounded-lg" style={{ width: 34, height: 34, background: `${GOLD}1a` }}>
          <Icon size={17} strokeWidth={1.75} style={{ color: GOLD }} />
        </span>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ ...serif, fontSize: '1.02rem', fontWeight: 700, color: MAROON, lineHeight: 1.25 }}>{title}</h2>
          {description && <p style={{ ...sans, fontSize: '0.76rem', color: '#a89890', marginTop: 2 }}>{description}</p>}
        </div>
        {action && <div className="ml-auto flex-shrink-0">{action}</div>}
      </div>
      {children}
    </section>
  );
}

function ComplianceSeal({ loading, error, tasks, monthLabel }) {
  return (
    <Panel icon={TrendingUp} title="Overall Scholar Compliance" description={`Task status breakdown for ${monthLabel}.`} className="h-full">
      {loading ? (
        <div className="space-y-3">
          <SkeletonBox h={104} />
          <SkeletonBox h={104} />
        </div>
      ) : error ? (
        <p style={{ ...sans, fontSize: '0.8rem', color: CLAY }}>Couldn&apos;t load task compliance. It will retry automatically.</p>
      ) : tasks.length === 0 ? (
        <p style={{ ...sans, fontSize: '0.8rem', color: '#a89890' }}>No active tasks due this month.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {tasks.map(task => {
            const stats = [
              { label: 'Submitted', value: task.submitted, color: SAGE },
              { label: 'Pending', value: task.pending, color: AMBER },
              { label: 'Not Submitted', value: task.notSubmitted, color: CLAY },
            ];
            const total = stats.reduce((sum, stat) => sum + stat.value, 0);

            return (
              <div key={task.task_id} className="rounded-xl p-3.5" style={{ border: `1px solid ${RULE}`, background: '#fff' }}>
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 style={{ ...serif, fontSize: '0.9rem', fontWeight: 700, color: MAROON, overflowWrap: 'anywhere' }}>
                      {task.title || task.type}
                    </h3>
                    <p style={{ ...sans, fontSize: '0.68rem', color: '#a89890', marginTop: 2 }}>
                      {task.type} · Due {formatTaskDueDate(task.due_date)} · Task #{task.task_id}
                    </p>
                  </div>
                  <Calendar size={15} style={{ flexShrink: 0, color: GOLD }} />
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2">
                  {stats.map(stat => (
                    <div key={stat.label} className="min-w-0 rounded-lg p-2" style={{ background: `${stat.color}12`, border: `1px solid ${stat.color}30` }}>
                      <p style={{ ...serif, fontSize: '1.2rem', fontWeight: 700, color: stat.color, lineHeight: 1 }}>{stat.value}</p>
                      <p style={{ ...sans, fontSize: '0.65rem', fontWeight: 600, color: '#6b6058', marginTop: 4, overflowWrap: 'anywhere' }}>{stat.label}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-3 flex h-2 w-full overflow-hidden rounded-full" style={{ background: RULE }} role="img" aria-label={`${task.title || task.type}: submitted, pending, and not submitted`}>
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

// ─── StatisticsCards ───────────────────────────────────────────────────────

function StatisticsCards({ loading, totalScholars, pending, approved, rejected }) {
  const cards = [
    { label: 'Total Scholars', value: totalScholars, icon: Users, color: MAROON },
    { label: 'Pending Review', value: pending, icon: Clock, color: AMBER },
    { label: 'Approved', value: approved, icon: CheckCircle, color: SAGE },
    { label: 'Rejected', value: rejected, icon: XCircle, color: CLAY },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {cards.map((card) => (
        <div key={card.label} className="flex h-full items-center gap-3.5" style={{ ...tile, padding: '16px 18px', minWidth: 0 }}>
          <span className="inline-flex flex-shrink-0 items-center justify-center rounded-full" style={{ width: 46, height: 46, background: `${card.color}1a` }}>
            <card.icon size={20} strokeWidth={1.75} style={{ color: card.color }} />
          </span>
          <div style={{ minWidth: 0 }}>
            <p className="truncate" style={{ ...sans, fontSize: '0.64rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#a89890' }}>{card.label}</p>
            {loading ? <div style={{ marginTop: 6 }}><SkeletonBox h={26} w={44} /></div>
              : <p style={{ ...serif, fontSize: '1.75rem', fontWeight: 700, color: INK, lineHeight: 1.15 }}>{card.value}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── NeedsAttention ───────────────────────────────────────────────────────

function NeedsAttention({ loading, pending, deadlines, onNavigate }) {
  const items = [
    { label: 'Pending reviews', value: pending, note: 'Submissions waiting for action', path: '/officer/validation', icon: Clock, color: AMBER },
    { label: 'Upcoming tasks', value: deadlines.length, note: 'Active deadlines to monitor', path: '/officer/task-assignment', icon: Calendar, color: MAROON },
  ];

  return (
    <Panel icon={Zap} title="Needs Attention" description="Items waiting in your officer queue." className="h-full">
      <div className="grid grid-cols-1 gap-3">
        {items.map(item => (
          <button key={item.path} type="button" onClick={() => onNavigate(item.path)}
            className="od-card flex items-center gap-3 rounded-xl p-3.5 text-left transition-colors"
            style={{ border: `1px solid ${RULE}`, borderLeft: `3px solid ${item.color}`, background: '#fff', cursor: 'pointer' }}>
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg" style={{ background: `${item.color}14`, color: item.color }}>
              <item.icon size={17} />
            </div>
            <div className="min-w-0 flex-1">
              {loading ? <SkeletonBox h={20} w={30} /> : <p style={{ ...serif, fontSize: '1.2rem', fontWeight: 700, color: item.color, lineHeight: 1 }}>{item.value}</p>}
              <p className="truncate" style={{ ...sans, fontSize: '0.78rem', fontWeight: 700, color: INK, marginTop: 3 }}>{item.label}</p>
              <p className="truncate" style={{ ...sans, fontSize: '0.7rem', color: '#a89890' }}>{item.note}</p>
            </div>
            <ArrowUpRight size={15} style={{ color: '#c9b9b0', flexShrink: 0 }} />
          </button>
        ))}
      </div>
    </Panel>
  );
}

// ─── UpcomingDeadlines ─────────────────────────────────────────────────────

function UpcomingDeadlines({ loading, deadlines }) {
  return (
    <Panel icon={Calendar} title="Upcoming Deadlines" description="Next tasks due for your scholars." className="h-full">
      {loading ? (
        <div className="space-y-2.5">
          {[1, 2, 3].map(i => <SkeletonBox key={i} h={44} radius={10} />)}
        </div>
      ) : deadlines.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Calendar size={26} style={{ color: '#e9d9dc' }} className="mb-2" />
          <p style={{ ...sans, fontSize: '0.78rem', color: '#a89890' }}>No upcoming deadlines</p>
        </div>
      ) : (
        <div className="space-y-2">
          {deadlines.slice(0, 5).map((d, i) => (
            <div key={i} className="od-row flex items-center gap-3 rounded-lg p-3 transition-colors" style={{ background: PAPER }}>
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg" style={{ background: ROSE, color: MAROON }}>
                <Calendar size={13} />
              </div>
              <div className="min-w-0">
                <p className="truncate" style={{ ...sans, fontSize: '0.8rem', fontWeight: 700, color: INK }}>{d.title || d.name}</p>
                <p style={{ ...mono, fontSize: '0.68rem', color: '#a89890' }}>{d.date || d.due_date}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

// ─── QuickActions ──────────────────────────────────────────────────────────

function QuickActions() {
  const navigate = useNavigate();

  const actions = [
    { label: 'Manual Validation', icon: FileCheck, path: '/officer/validation', color: MAROON },
    { label: 'Reports', icon: BarChart3, path: '/officer/reports', color: GOLD },
    { label: 'Summary Report', icon: FileText, path: '/officer/summary-report', color: SAGE },
  ];

  return (
    <Panel icon={Zap} title="Quick Actions" description="Common tasks and navigation." className="h-full">
      <div className="flex flex-col gap-2.5">
        {actions.map((a) => (
          <button key={a.path} type="button" onClick={() => navigate(a.path)}
            className="od-card group flex items-center gap-3 rounded-xl p-3.5 text-left transition-colors"
            style={{ border: `1px solid ${RULE}`, background: '#fff', cursor: 'pointer' }}>
            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg transition-transform group-hover:scale-105" style={{ background: `${a.color}14`, color: a.color }}>
              <a.icon size={18} />
            </span>
            <span className="flex-1" style={{ ...sans, fontSize: '0.82rem', fontWeight: 700, color: '#4b3f38', lineHeight: 1.25 }}>{a.label}</span>
            <ArrowUpRight size={14} style={{ color: '#c9b9b0', flexShrink: 0 }} />
          </button>
        ))}
      </div>
    </Panel>
  );
}

// ─── RecentAnnouncements ───────────────────────────────────────────────────

const PRIORITY_STYLES = {
  critical: { label: 'Critical', color: CLAY },
  important: { label: 'Important', color: AMBER },
  info: { label: 'Info', color: GOLD },
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
        <button type="button" onClick={goToAnnouncements} className="od-card inline-flex items-center gap-1 rounded-lg"
          style={{ ...sans, fontSize: '0.74rem', fontWeight: 700, color: MAROON, padding: '6px 10px', border: `1px solid ${RULE}`, background: '#fff', cursor: 'pointer' }}>
          View All <ChevronRight size={14} />
        </button>
      )}
    >
      {loading ? (
        <div className="space-y-2.5">
          {[1, 2, 3].map(i => <SkeletonBox key={i} h={64} radius={10} />)}
        </div>
      ) : error && recent.length === 0 ? (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg p-3"
          style={{ borderLeft: `3px solid ${CLAY}`, background: `${CLAY}0d`, ...sans, fontSize: '0.78rem', fontWeight: 600, color: CLAY }}>
          <span className="flex items-center gap-2"><AlertTriangle size={14} className="flex-shrink-0" />Announcements could not be loaded.</span>
          <button type="button" onClick={onRetry} style={{ ...sans, fontSize: '0.74rem', fontWeight: 700, color: CLAY, background: 'none', border: 'none', textDecoration: 'underline', cursor: 'pointer' }}>Retry</button>
        </div>
      ) : recent.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Megaphone size={26} style={{ color: '#e9d9dc' }} className="mb-2" />
          <p style={{ ...sans, fontSize: '0.82rem', fontWeight: 700, color: INK }}>No announcements yet.</p>
          <p style={{ ...sans, fontSize: '0.74rem', color: '#a89890', marginTop: 2 }}>New announcements will appear here when they are published.</p>
        </div>
      ) : (
        <>
          <div className="space-y-2.5">
            {recent.map((a, i) => {
              const priority = PRIORITY_STYLES[String(a.priority || '').toLowerCase()];
              const accent = priority ? priority.color : GOLD;
              const source = [a.created_by_name, roleLabel(a.created_by_role)].filter(Boolean).join(' · ');
              const date = formatAnnouncementDate(a.created_at);
              return (
                <button key={a.id ?? i} type="button" onClick={goToAnnouncements}
                  className="od-card flex w-full items-center gap-3 rounded-xl p-3.5 text-left transition-colors"
                  style={{ border: `1px solid ${RULE}`, borderLeft: `3px solid ${accent}`, background: '#fff', cursor: 'pointer', minWidth: 0 }}>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p style={{ ...sans, fontSize: '0.84rem', fontWeight: 700, color: INK, overflowWrap: 'anywhere' }}>{a.title || 'Untitled announcement'}</p>
                      {priority && (
                        <span style={{ ...sans, fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: priority.color, background: `${priority.color}1a`, border: `1px solid ${priority.color}40`, borderRadius: 999, padding: '2px 8px' }}>
                          {priority.label}
                        </span>
                      )}
                    </div>
                    {a.content && (
                      <p style={{ ...sans, fontSize: '0.76rem', color: '#6b6058', marginTop: 3, lineHeight: 1.5, overflowWrap: 'anywhere', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {a.content}
                      </p>
                    )}
                    {(source || date) && (
                      <p style={{ ...sans, fontSize: '0.7rem', color: '#a89890', marginTop: 5 }}>
                        {source}{source && date ? ' · ' : ''}{date && <span style={mono}>{date}</span>}
                      </p>
                    )}
                  </div>
                  <ChevronRight size={15} style={{ color: '#c9b9b0', flexShrink: 0 }} />
                </button>
              );
            })}
          </div>
          {error && (
            <p style={{ ...sans, fontSize: '0.7rem', color: '#a89890', marginTop: 8 }}>Couldn&apos;t refresh announcements. Showing the last loaded ones.</p>
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
      const currentDate = new Date();
      const currentMonth = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
      const endpoints = [
        ['submissions', `${API_BASE}/submission/all`],
        ['validationQueue', `${API_BASE}/submission/scholar-view`],
        ['scholars', `${API_BASE}/staff/pending`],
        ['tasks', `${API_BASE}/tasks`],
        ['taskCompliance', `${API_BASE}/officer/reports/task-compliance?month=${currentMonth}`],
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
  const monthLabel = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="min-h-screen" style={{ background: IVORY, ...sans }}>
      <style>{`
        .od-card:hover, .od-row:hover { background: #faf6ee !important; }
        .od-card:focus-visible { outline: 2px solid ${GOLD}; outline-offset: 2px; }
      `}</style>

      <div className="flex flex-col gap-4 px-4 py-5 sm:px-6 lg:px-8" style={{ minWidth: 0 }}>

        {/* ── Standard Officer header: title card + date card (+ notifications) ──
            No overflow:hidden anywhere here so the notifications dropdown is never clipped. */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_auto]">
          <div style={{ ...tile, padding: '20px 24px' }}>
            <p style={{ ...sans, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.1em', color: GOLD }}>OFFICER PORTAL</p>
            <h1 style={{ ...serif, fontSize: '1.75rem', fontWeight: 700, color: MAROON_DEEP, marginTop: 4, lineHeight: 1.2 }}>Dashboard</h1>
            <p style={{ ...sans, fontSize: '0.84rem', color: '#a89890', marginTop: 6, maxWidth: 640 }}>
              Here&apos;s an overview of your assigned scholars, submissions, and compliance.
            </p>
            <p style={{ ...sans, fontSize: '0.76rem', color: '#7a6a62', marginTop: 8 }}>
              Welcome back, <strong style={{ color: INK }}>{name || 'Officer'}</strong>
              {lastUpdated && (
                <span style={{ ...mono, color: '#a89890' }}> · Updated {lastUpdated.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })}</span>
              )}
            </p>
          </div>

          <div className="flex items-stretch gap-3">
            <div className="flex items-center gap-4" style={{ ...tile, padding: '16px 18px', position: 'relative' }}>
              <span className="inline-flex flex-shrink-0 items-center justify-center" style={{ width: 42, height: 42, borderRadius: 12, background: `${MAROON}10` }}>
                <CalendarDays size={19} style={{ color: MAROON }} />
              </span>
              <div>
                <p style={{ ...sans, fontSize: '0.68rem', color: '#a89890' }}>Today</p>
                <p style={{ ...sans, fontSize: '0.92rem', fontWeight: 600, color: INK, whiteSpace: 'nowrap' }}>{todayLabel}</p>
              </div>
              <div aria-hidden="true" style={{ alignSelf: 'stretch', width: 1, background: RULE, margin: '0 2px' }} />
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
          </div>
        </div>

        {/* ── KPI cards ── */}
        <StatisticsCards
          loading={loading}
          totalScholars={scholars.length}
          pending={pending}
          approved={approved}
          rejected={rejected}
        />

        {/* ── Overall Scholar Compliance (left) + Quick Actions (right) ── */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <ComplianceSeal loading={loading} error={taskComplianceError} tasks={taskCompliance} monthLabel={monthLabel} />
          <QuickActions />
        </div>

        {/* ── Needs Attention + Upcoming Deadlines ── */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <NeedsAttention
            loading={loading}
            pending={pending}
            deadlines={deadlines}
            onNavigate={path => navigate(path)}
          />
          <UpcomingDeadlines loading={loading} deadlines={deadlines} />
        </div>

        {/* ── Recent Announcements (full width) ── */}
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