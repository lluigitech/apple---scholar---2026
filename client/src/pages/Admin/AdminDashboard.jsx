import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import {
    Cell, BarChart, Bar, AreaChart, Area, LabelList,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
    Users, ShieldCheck, Megaphone,
    AlertTriangle, Clock,
    ArrowRight, MessageSquare, ShieldAlert, CalendarDays,
    ClipboardList, Settings, Star, BarChart3, TrendingUp, UserPlus, Gauge,
} from 'lucide-react';
import { formatAdminDate, formatAdminMonth } from '../../utils/adminPreferences';
import AdminNotifications from '../../components/Admin/AdminNotifications';

// ── Executive design tokens ──────────────────────────────────────
const BG           = '#F7F4EE';
const SURFACE      = '#FFFDF9';
const BORDER       = '#E7D8C7';
const PRIMARY      = '#6D2140';
const PRIMARY_DEEP = '#4A1730';
const INK          = '#241512';
const MUTED        = '#8A7A68';
const BRONZE       = '#A9784E';
const SUCCESS      = '#6B8F71';
const WARNING      = '#C08A3E';
const DANGER       = '#A24A4A';
const RADIUS       = 18;
const SHADOW       = '0 1px 2px rgba(74, 23, 48, 0.04), 0 8px 24px -16px rgba(74, 23, 48, 0.12)';
const QUALITY_SCORE_BANDS = [
    { key: 'excellent', name: 'Excellent (90–100)', color: SUCCESS },
    { key: 'good', name: 'Good (75–89)', color: '#4B91A8' },
    { key: 'needsImprovement', name: 'Needs Improvement (50–74)', color: WARNING },
    { key: 'nonCompliant', name: 'Non-Compliant (0–49)', color: DANGER },
];
const SUBMISSION_STATUS_SERIES = [
    { key: 'approved', name: 'Approved', color: SUCCESS },
    { key: 'pending', name: 'Pending', color: WARNING },
    { key: 'rejected', name: 'Rejected', color: DANGER },
];
const DUTY_ATTENDANCE_SERIES = [
    { key: 'present', name: 'Present', color: SUCCESS },
    { key: 'late', name: 'Late', color: WARNING },
    { key: 'absent', name: 'Absent', color: DANGER },
];

// ── Operations routes ────────────────────────────────────────────
// NOTE: verify these two against your router config (the sidebar's
// "Task Assignment" and "Duty Assignment" links) and adjust if they differ.
const TASK_ASSIGNMENT_PATH = '/admin/task-assignment';
const DUTY_ASSIGNMENT_PATH = '/admin/duty-assignment';
const API_BASE = (import.meta.env?.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
const API = API_BASE.endsWith('/api') ? API_BASE : `${API_BASE}/api`;

const serif = { fontFamily: "'Playfair Display', serif" };
const sans  = { fontFamily: "'Inter', sans-serif" };

const gridProps = { strokeDasharray: '3 3', stroke: BORDER };
const axisStyle = { fontFamily: "'Inter', sans-serif", fontSize: '0.7rem', fill: MUTED };

const cardStyle = { background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: RADIUS, boxShadow: SHADOW };

const authConfig = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
});

// ── Custom tooltip matching the cream/burgundy theme ──────────────
const ChartTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '8px 12px', boxShadow: SHADOW, ...sans, fontSize: '0.78rem' }}>
            {label && <p style={{ fontWeight: 600, color: INK, marginBottom: 4 }}>{label}</p>}
            {payload.map((p) => (
                <p key={p.dataKey || p.name} style={{ color: p.color || p.payload?.color || p.fill, fontWeight: 500 }}>{p.name}: {p.value}</p>
            ))}
        </div>
    );
};

const buildRecentMonthSeries = (rows, fields) => {
    const recordsByMonth = new Map((Array.isArray(rows) ? rows : []).map((row) => [row.month, row]));
    const now = new Date();
    return Array.from({ length: 6 }, (_, index) => {
        const monthDate = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1);
        const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
        const record = recordsByMonth.get(monthKey) || {};
        return {
            month: formatAdminMonth(monthDate, { month: 'short', year: '2-digit' }),
            ...Object.fromEntries(fields.map((field) => [field, Number(record[field]) || 0])),
        };
    });
};

const ChartSeriesLegend = ({ series }) => (
    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5" style={{ listStyle: 'none', marginBottom: 0, padding: 0 }}>
        {series.map((item) => (
            <li key={item.key} className="flex items-center gap-1.5" style={{ ...sans, fontSize: '0.68rem', color: MUTED }}>
                <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 3, background: item.color, flexShrink: 0 }} />
                {item.name}
            </li>
        ))}
    </ul>
);

const Skeleton = ({ className }) => (
    <div className={`animate-pulse rounded-2xl ${className}`} style={{ background: '#EFE6D8' }} />
);

const IconBubble = ({ icon: Icon, color = PRIMARY, size = 40, iconSize = 18 }) => (
    <span className="flex items-center justify-center rounded-full flex-shrink-0"
        style={{ width: size, height: size, background: `${color}14`, color }}>
        <Icon size={iconSize} />
    </span>
);

const EmptyState = ({ children }) => (
    <div className="flex items-center justify-center text-center" style={{ minHeight: 200 }}>
        <p style={{ ...sans, fontSize: '0.82rem', color: MUTED, maxWidth: 260, lineHeight: 1.5 }}>{children}</p>
    </div>
);

// ── KPI card (top summary strip) ──────────────────────────────────
const KpiCard = ({ icon, label, value, note, color = PRIMARY, loading }) => (
    <div className="min-w-0 p-3.5 sm:p-5" style={cardStyle}>
        <div className="flex items-start justify-between gap-2">
            <p style={{ ...sans, fontSize: '0.74rem', fontWeight: 600, color: MUTED, lineHeight: 1.3 }}>{label}</p>
            <IconBubble icon={icon} color={color} size={32} iconSize={15} />
        </div>
        {loading ? (
            <div className="animate-pulse mt-3" style={{ height: 30, width: '55%', borderRadius: 8, background: '#EFE6D8' }} />
        ) : (
            <p style={{ ...serif, fontWeight: 700, color: INK, lineHeight: 1.1, marginTop: 10 }} className="text-[1.5rem] sm:text-[1.9rem]">{value}</p>
        )}
        <p style={{ ...sans, fontSize: '0.7rem', color: MUTED, marginTop: 6, lineHeight: 1.35 }}>{loading ? '\u00A0' : note}</p>
    </div>
);

// ── Chart card ────────────────────────────────────────────────────
const ChartCard = ({ icon, title, subtitle, headerAction, children, className = '' }) => (
    <div className={`min-w-0 p-4 sm:p-6 ${className}`} style={cardStyle}>
        <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
            <div className="flex min-w-0 flex-1 items-center gap-3" style={{ minWidth: 180 }}>
                <IconBubble icon={icon} color={PRIMARY} size={40} iconSize={18} />
                <div className="min-w-0">
                    <h3 style={{ ...serif, fontSize: '1.02rem', fontWeight: 700, color: PRIMARY, lineHeight: 1.25 }}>{title}</h3>
                    {subtitle && <p style={{ ...sans, fontSize: '0.74rem', color: MUTED, marginTop: 1, lineHeight: 1.4 }}>{subtitle}</p>}
                </div>
            </div>
            {headerAction}
        </div>
        {children}
    </div>
);

// ── Panel with icon header (lists + operations) ───────────────────
const PanelHeader = ({ icon, title, subtitle, action }) => (
    <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
            <IconBubble icon={icon} color={PRIMARY} size={40} iconSize={18} />
            <div className="min-w-0">
                <h3 style={{ ...serif, fontSize: '1.02rem', fontWeight: 700, color: PRIMARY, lineHeight: 1.25 }}>{title}</h3>
                {subtitle && <p style={{ ...sans, fontSize: '0.74rem', color: MUTED, marginTop: 1, lineHeight: 1.4 }}>{subtitle}</p>}
            </div>
        </div>
        {action}
    </div>
);

const OutlineButton = ({ onClick, children, full = false }) => (
    <button type="button" onClick={onClick}
        className={`dash-focus inline-flex items-center justify-center gap-1.5 flex-shrink-0 transition-colors hover:bg-[#6D21400D] ${full ? 'w-full sm:w-auto' : ''}`}
        style={{ ...sans, fontSize: '0.74rem', fontWeight: 600, color: PRIMARY, background: SURFACE, border: `1px solid ${PRIMARY}55`, borderRadius: 10, padding: '9px 14px', minHeight: 40, cursor: 'pointer', whiteSpace: 'nowrap' }}>
        {children} <ArrowRight size={12} />
    </button>
);

const AdminDashboard = () => {
    const navigate = useNavigate();
    const name = localStorage.getItem('name');

    const [stats, setStats] = useState({ activeAnnouncements: 0, activeTasks: 0, upcomingDuties: 0 });
    const [recentUsers, setRecentUsers] = useState([]);
    const [recentActivity, setRecentActivity] = useState([]);
    const [notificationLogs, setNotificationLogs] = useState([]);
    const [notificationError, setNotificationError] = useState(false);
    const [notificationLoading, setNotificationLoading] = useState(true);
    const [notificationSummary, setNotificationSummary] = useState(null);
    const notificationRequestInFlight = useRef(false);
    const [loading, setLoading] = useState(true);
    const [dashboardError, setDashboardError] = useState('');

    const [scholarGrowth, setScholarGrowth] = useState([]);
    const [submissionStatusByMonth, setSubmissionStatusByMonth] = useState([]);
    const [dutyAttendanceByMonth, setDutyAttendanceByMonth] = useState([]);
    const [qualityScoreByMonthLevel, setQualityScoreByMonthLevel] = useState([]);
    const [selectedScoringMonth, setSelectedScoringMonth] = useState('');
    const [qualityScoreAvailable, setQualityScoreAvailable] = useState(false);
    const [riskDistribution, setRiskDistribution] = useState([]);
    const [sentimentBreakdown, setSentimentBreakdown] = useState([]);

    // UI-only: narrower chart axes / heights on phones.
    const [isNarrow, setIsNarrow] = useState(() => typeof window !== 'undefined' && window.innerWidth < 640);
    useEffect(() => {
        const onResize = () => setIsNarrow(window.innerWidth < 640);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const config = authConfig();
                setDashboardError('');
                const [summaryRes, flaggedScholarsRes] = await Promise.all([
                    axios.get(`${API}/admin/dashboard-summary`, config),
                    axios.get(`${API}/flagged/scholars`, config),
                ]);
                const summary = summaryRes.data;
                const flaggedScholars = flaggedScholarsRes.data;
                setNotificationSummary(summary);

                setStats({
                    activeAnnouncements: summary.announcements.active,
                    activeTasks: summary.tasks.active,
                    upcomingDuties: summary.duties.upcoming,
                });
                setRecentUsers(summary.recentUsers);

                setScholarGrowth(buildRecentMonthSeries(summary.scholarGrowth, ['total']));
                setSubmissionStatusByMonth(buildRecentMonthSeries(
                    summary.submissions.statusByMonth,
                    SUBMISSION_STATUS_SERIES.map(({ key }) => key)
                ));
                setDutyAttendanceByMonth(buildRecentMonthSeries(
                    summary.duties.attendanceByMonth,
                    [...DUTY_ATTENDANCE_SERIES.map(({ key }) => key), 'makeup']
                ));

                const qualityScore = summary.submissions.qualityScore;
                const qualityScoreFields = ['scoredRecords', 'excellent', 'good', 'needsImprovement', 'nonCompliant', 'average'];
                const hasQualityScore = qualityScore
                    && qualityScoreFields.every((field) => qualityScore[field] !== null
                        && qualityScore[field] !== undefined
                        && Number.isFinite(Number(qualityScore[field])));
                const monthlyQualityScores = summary.submissions.qualityScoreByMonthLevel;
                const hasMonthlyQualityScores = Array.isArray(monthlyQualityScores);
                setQualityScoreAvailable(Boolean(hasQualityScore && hasMonthlyQualityScores));
                setQualityScoreByMonthLevel(hasMonthlyQualityScores ? monthlyQualityScores : []);
                if (hasMonthlyQualityScores) {
                    const availableMonths = monthlyQualityScores.map((item) => item.month);
                    setSelectedScoringMonth((current) => (
                        availableMonths.includes(current) ? current : [...new Set(availableMonths)].sort().reverse()[0] || ''
                    ));
                }

                const riskLevels = [
                    { level: 'Medium', riskLevel: 'medium', value: 0, color: WARNING },
                    { level: 'High', riskLevel: 'high', value: 0, color: DANGER },
                    { level: 'Low', riskLevel: 'low', value: 0, color: SUCCESS },
                ];
                flaggedScholars.forEach(({ risk_level: riskLevel }) => {
                    const level = riskLevels.find((item) => item.riskLevel === riskLevel);
                    if (level) level.value += 1;
                });
                setRiskDistribution(riskLevels);

                setSentimentBreakdown([
                    { label: 'Positive', value: summary.submissions.sentiment.positive },
                    { label: 'Neutral', value: summary.submissions.sentiment.neutral },
                    { label: 'Negative', value: summary.submissions.sentiment.negative },
                ]);
                setRecentActivity(summary.recentActivity.map((item) => ({
                    id: item.id,
                    message: item.details?.trim() || String(item.action || 'System event').replace(/[_-]+/g, ' '),
                    time: formatAdminDate(item.created_at, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }),
                    type: item.module || item.action,
                    status: item.result === 'failure' ? 'warning' : 'success',
                })));
            } catch (err) {
                console.error(err);
                setDashboardError('Dashboard data could not be loaded. Please try again later.');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
        let refreshTimer;
        const updateRefreshTimer = () => {
            window.clearInterval(refreshTimer);
            let autoRefresh = true;
            try {
                const preferences = JSON.parse(localStorage.getItem('admin-system-settings') || 'null');
                if (typeof preferences?.autoRefresh === 'boolean') autoRefresh = preferences.autoRefresh;
            } catch (error) {
                console.error('Unable to read dashboard refresh preference:', error);
            }
            if (autoRefresh) refreshTimer = window.setInterval(fetchData, 5 * 60 * 1000);
        };
        updateRefreshTimer();
        window.addEventListener('admin-settings-updated', updateRefreshTimer);
        return () => {
            window.clearInterval(refreshTimer);
            window.removeEventListener('admin-settings-updated', updateRefreshTimer);
        };
    }, []);

    const fetchNotificationData = useCallback(async () => {
        if (notificationRequestInFlight.current) return;
        notificationRequestInFlight.current = true;
        try {
            const { data } = await axios.get(`${API}/admin/notifications/logs?limit=50`, authConfig());
            if (!Array.isArray(data)) throw new Error('Notification logs response was not a list.');
            const adminEmail = localStorage.getItem('email')?.toLowerCase();
            setNotificationLogs(adminEmail
                ? data.filter(item => item.status === 'sent' && item.recipient?.toLowerCase() === adminEmail)
                : []);
            setNotificationError(false);
        } catch (error) {
            console.error('Unable to load Administrator dashboard notifications:', error);
            setNotificationError(true);
        } finally {
            notificationRequestInFlight.current = false;
            setNotificationLoading(false);
        }
    }, []);

    useEffect(() => {
        const initialLoadTimer = window.setTimeout(fetchNotificationData, 0);
        const refresh = () => fetchNotificationData();
        const timer = window.setInterval(refresh, 60_000);
        window.addEventListener('focus', refresh);
        return () => {
            window.clearTimeout(initialLoadTimer);
            window.clearInterval(timer);
            window.removeEventListener('focus', refresh);
        };
    }, [fetchNotificationData]);

    const quickLinks = [
        { label: 'User Registry', desc: 'Manage access roles', path: '/admin/users', icon: Users },
        { label: 'Flagged Focus', desc: 'Review critical risk', path: '/admin/flagged', icon: AlertTriangle },
        { label: 'NLP Evaluator', desc: 'Sift emotional vibes', path: '/admin/correspondence', icon: MessageSquare },
        { label: 'Security Audit', desc: 'Privacy trail records', path: '/admin/security', icon: ShieldAlert },
    ];

    const activityDotColor = (status) => {
        if (status === 'success') return SUCCESS;
        if (status === 'warning') return WARNING;
        return PRIMARY;
    };

    const getRoleBadge = (role) => {
        if (role === 'admin') return { background: PRIMARY, color: '#fff' };
        if (role === 'scholar') return { background: `${BRONZE}18`, color: BRONZE };
        return { background: `${SUCCESS}18`, color: SUCCESS };
    };

    const sentimentColor = { Positive: SUCCESS, Neutral: WARNING, Negative: DANGER };

    const operationsCards = [
        { title: 'Announcements', icon: Megaphone, path: '/admin/announcements', action: 'View Announcements',
          desc: 'Manage published announcements and communications.', count: stats.activeAnnouncements },
        // No reliable task/duty count source exists in this component, so none is shown.
        { title: 'Task Assignment', icon: ClipboardList, path: TASK_ASSIGNMENT_PATH, action: 'View Tasks',
          desc: 'Manage assigned requirements and submission deadlines.', count: stats.activeTasks },
        { title: 'Duty Assignment', icon: CalendarDays, path: DUTY_ASSIGNMENT_PATH, action: 'View Duties',
          desc: 'Coordinate scholar duty schedules and assignments.', count: stats.upcomingDuties },
    ];

    const scoringMonths = [...new Set(qualityScoreByMonthLevel.map((item) => item.month))].sort().reverse();
    const activeScoringMonth = scoringMonths.includes(selectedScoringMonth) ? selectedScoringMonth : scoringMonths[0] || '';
    const scoreRowsByLevel = new Map();
    qualityScoreByMonthLevel
        .filter((item) => item.month === activeScoringMonth)
        .forEach((item) => {
            const rawLevel = String(item.yearLevel || 'Unspecified').trim();
            const normalizedLevel = rawLevel.toLowerCase().replace(/[_-]/g, ' ').replace(/\s+/g, ' ');
            const collegeNumber = normalizedLevel.match(/^(?:college\s+([1-5])|(1st|2nd|3rd|4th|5th)\s+year(?:\s+college)?)$/);
            const gradeNumber = normalizedLevel.match(/^grade\s*(\d+)$/);
            const collegeOrdinal = collegeNumber
                ? collegeNumber[1]
                    ? { 1: '1st', 2: '2nd', 3: '3rd', 4: '4th', 5: '5th' }[collegeNumber[1]]
                    : collegeNumber[2]
                : '';
            const level = collegeNumber
                ? `${collegeOrdinal} Year College`
                : gradeNumber ? `Grade ${gradeNumber[1]}` : rawLevel || 'Unspecified';
            const current = scoreRowsByLevel.get(level) || {
                yearLevel: level,
                scoredRecords: 0,
                totalScore: 0,
                excellent: 0,
                good: 0,
                needsImprovement: 0,
                nonCompliant: 0,
            };
            const scoredRecords = Number(item.scoredRecords) || 0;
            current.scoredRecords += scoredRecords;
            current.totalScore += (Number(item.average) || 0) * scoredRecords;
            QUALITY_SCORE_BANDS.forEach(({ key }) => { current[key] += Number(item[key]) || 0; });
            scoreRowsByLevel.set(level, current);
        });
    const monthlyScoreByLevel = [...scoreRowsByLevel.values()]
        .map(({ totalScore, ...item }) => ({ ...item, average: item.scoredRecords ? Math.round(totalScore / item.scoredRecords) : 0 }))
        .sort((left, right) => left.yearLevel.localeCompare(right.yearLevel, undefined, { numeric: true }));
    const selectedMonthScoredTotal = monthlyScoreByLevel.reduce((sum, item) => sum + item.scoredRecords, 0);
    const selectedMonthAverageScore = selectedMonthScoredTotal
        ? Math.round(monthlyScoreByLevel.reduce((sum, item) => sum + item.average * item.scoredRecords, 0) / selectedMonthScoredTotal)
        : 0;
    const todayLabel = formatAdminDate(new Date(), { weekday: 'long' });

    // ── Presentation-only derived values for the KPI strip (existing state only) ──
    const flaggedTotal = riskDistribution.reduce((sum, item) => sum + item.value, 0);
    const highRiskTotal = riskDistribution.find((item) => item.riskLevel === 'high')?.value || 0;
    const newScholarsTotal = scholarGrowth.reduce((sum, item) => sum + item.total, 0);
    const lettersTotal = sentimentBreakdown.reduce((sum, item) => sum + item.value, 0);
    const negativeLetters = sentimentBreakdown.find((item) => item.label === 'Negative')?.value || 0;
    const hasAverage = qualityScoreAvailable && selectedMonthScoredTotal > 0;
    const hasSubmissionStatusData = submissionStatusByMonth.some((month) =>
        SUBMISSION_STATUS_SERIES.some(({ key }) => month[key] > 0)
    );
    const hasDutyAttendanceData = dutyAttendanceByMonth.some((month) =>
        DUTY_ATTENDANCE_SERIES.some(({ key }) => month[key] > 0)
    );
    const makeUpAttendanceTotal = dutyAttendanceByMonth.reduce((sum, month) => sum + month.makeup, 0);

    const chartHeight = isNarrow ? 220 : 250;

    return (
        <div className="min-h-screen w-full max-w-full min-w-0" style={{ background: BG, ...sans, overflowX: 'hidden' }}>
            <style>{`
                .dash-focus:focus-visible { outline: 2px solid ${PRIMARY}; outline-offset: 2px; }
                .dash-hover { transition: border-color .15s ease, box-shadow .15s ease, transform .15s ease; }
                .dash-hover:hover { border-color: ${PRIMARY}55 !important; box-shadow: 0 10px 24px -14px ${PRIMARY}55 !important; transform: translateY(-1px); }
                @media (prefers-reduced-motion: reduce) { .dash-hover { transition: none; } .dash-hover:hover { transform: none; } }
            `}</style>
            <div className="w-full max-w-full min-w-0 px-3 sm:px-6 lg:px-8 py-4 sm:py-8 flex flex-col gap-3 sm:gap-5">

                {/* ── Page header (unchanged design; only made responsive) ── */}
                <header className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 sm:gap-5">
                    <div className="min-w-0">
                        <span style={{ ...sans, fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.24em', textTransform: 'uppercase', color: BRONZE }}>Admin Portal</span>
                        <h1 style={{ ...serif, fontWeight: 700, color: PRIMARY, marginTop: 4, letterSpacing: '-0.01em', lineHeight: 1.15 }} className="text-[1.55rem] sm:text-[2rem]">Executive Intelligence Dashboard</h1>
                        <p style={{ ...sans, fontSize: '0.85rem', color: MUTED, marginTop: 6, maxWidth: 640 }}>
                            Real-time operational overview of scholars, compliance, governance, security, and institutional performance.
                        </p>
                        <p style={{ ...sans, fontSize: '0.8rem', color: MUTED, marginTop: 8 }}>Welcome back, {name || 'Admin'}.</p>
                    </div>
                    <div className="flex items-center justify-between lg:justify-start gap-4 px-4 py-3 w-full lg:w-auto flex-shrink-0" style={{ ...cardStyle, borderRadius: 14 }}>
                        <div className="flex items-center gap-3 min-w-0">
                            <CalendarDays size={18} style={{ color: BRONZE, flexShrink: 0 }} />
                            <div className="min-w-0">
                                <p style={{ ...sans, fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: MUTED }}>Today</p>
                                <p style={{ ...sans, fontSize: '0.8rem', fontWeight: 600, color: INK, whiteSpace: 'nowrap' }}>{todayLabel}</p>
                            </div>
                        </div>
                        <div aria-hidden="true" style={{ alignSelf: 'stretch', width: 1, background: BORDER, margin: '0 2px' }} />
                        <AdminNotifications
                            loading={notificationLoading}
                            summary={notificationSummary}
                            logs={notificationLogs}
                            error={notificationError}
                            onRetry={fetchNotificationData}
                            onNavigate={navigate}
                        />
                    </div>
                </header>
                {dashboardError && (
                    <p role="alert" style={{ ...sans, color: DANGER, background: `${DANGER}12`, border: `1px solid ${DANGER}44`, borderRadius: 10, padding: '10px 14px', fontSize: '0.8rem', lineHeight: 1.5 }}>
                        {dashboardError}
                    </p>
                )}

                {/* ── 1. KPI strip — at-a-glance numbers ── */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
                    <KpiCard icon={AlertTriangle} color={DANGER} label="Flagged scholars" loading={loading}
                        value={flaggedTotal} note={`${highRiskTotal} high risk`} />
                    <KpiCard icon={Gauge} color={SUCCESS} label="Average letter score" loading={loading}
                        value={hasAverage ? `${selectedMonthAverageScore}%` : '—'}
                        note={hasAverage ? `${selectedMonthScoredTotal} scored this month` : 'No scored letters yet'} />
                    <KpiCard icon={UserPlus} color={PRIMARY} label="New scholars" loading={loading}
                        value={newScholarsTotal} note="Registered in the last 6 months" />
                    <KpiCard icon={TrendingUp} color={WARNING} label="Negative letters" loading={loading}
                        value={negativeLetters} note={`Out of ${lettersTotal} letters analysed`} />
                </div>

                {/* ── 2. Quick access: Operations (wide) + Governance (side) ── */}
                <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] gap-3 sm:gap-5 items-stretch">

                    {/* Operations Overview */}
                    <section aria-labelledby="ops-heading" className="min-w-0 p-4 sm:p-6 flex flex-col" style={cardStyle}>
                        <div className="flex items-center gap-3 mb-4">
                            <IconBubble icon={Settings} color={PRIMARY} size={40} iconSize={18} />
                            <div className="min-w-0">
                                <h2 id="ops-heading" style={{ ...serif, fontSize: '1.02rem', fontWeight: 700, color: PRIMARY, lineHeight: 1.25 }}>Operations Overview</h2>
                                <p style={{ ...sans, fontSize: '0.74rem', color: MUTED, marginTop: 1, lineHeight: 1.4 }}>Quick access to key administrative operations.</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3 flex-1">
                            {operationsCards.map((card) => {
                                const showCount = card.count !== null && card.count !== undefined && !loading;
                                const count = showCount && (
                                    <span style={{ ...serif, fontSize: '1.7rem', fontWeight: 700, color: INK, lineHeight: 1 }}>{card.count}</span>
                                );
                                return (
                                    <button key={card.title} type="button" onClick={() => navigate(card.path)}
                                        aria-label={card.action}
                                        className="dash-focus dash-hover text-left min-w-0 flex items-center sm:items-stretch sm:flex-col gap-3 p-3.5 sm:p-4"
                                        style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 14, cursor: 'pointer' }}>
                                        <div className="flex items-center justify-between sm:w-full flex-shrink-0">
                                            <IconBubble icon={card.icon} color={PRIMARY} size={42} iconSize={19} />
                                            <span className="hidden sm:block">{count}</span>
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <h3 style={{ ...serif, fontSize: '0.98rem', fontWeight: 700, color: PRIMARY, lineHeight: 1.25 }}>{card.title}</h3>
                                            <p style={{ ...sans, fontSize: '0.74rem', color: MUTED, marginTop: 3, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{card.desc}</p>
                                        </div>
                                        <span className="sm:hidden flex-shrink-0">{count}</span>
                                        <span className="hidden sm:flex items-center gap-1.5 pt-3" style={{ ...sans, fontSize: '0.74rem', fontWeight: 600, color: PRIMARY, borderTop: `1px solid ${BORDER}` }}>
                                            {card.action} <ArrowRight size={12} />
                                        </span>
                                        <ArrowRight size={14} className="sm:hidden flex-shrink-0" style={{ color: PRIMARY }} />
                                    </button>
                                );
                            })}
                        </div>
                    </section>

                    {/* Governance Shortcuts */}
                    <section className="min-w-0 p-4 sm:p-6 flex flex-col" style={cardStyle}>
                        <PanelHeader icon={Star} title="Governance Shortcuts" subtitle="Quick access to commonly used tools." />
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-2.5 flex-1 content-start">
                            {quickLinks.map(link => {
                                const Icon = link.icon;
                                return (
                                    <button key={link.path} type="button" onClick={() => navigate(link.path)}
                                        className="dash-focus dash-hover flex items-center gap-3 p-3 text-left min-w-0"
                                        style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 14, cursor: 'pointer', minHeight: 60 }}>
                                        <IconBubble icon={Icon} color={PRIMARY} size={38} iconSize={16} />
                                        <div className="flex-1 min-w-0">
                                            <p style={{ ...sans, fontSize: '0.82rem', fontWeight: 700, color: INK }}>{link.label}</p>
                                            <p style={{ ...sans, fontSize: '0.7rem', color: MUTED, marginTop: 1 }}>{link.desc}</p>
                                        </div>
                                        <ArrowRight size={14} style={{ color: PRIMARY, flexShrink: 0 }} />
                                    </button>
                                );
                            })}
                        </div>
                    </section>
                </div>

                {/* ── Analytics, ordered by priority ── */}
                {loading ? (
                    <div className="grid grid-cols-1 gap-3 sm:gap-5">
                        <Skeleton className="h-64 sm:h-72" />
                        <Skeleton className="h-64 sm:h-72" />
                    </div>
                ) : (
                    <>
                        {/* 3. Needs attention: Risk + Submission status */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-5">
                            <ChartCard icon={ShieldCheck} title="Risk Distribution" subtitle="Flagged scholars by risk level.">
                                {flaggedTotal === 0 ? (
                                    <EmptyState>No risk data yet.</EmptyState>
                                ) : (
                                    <ResponsiveContainer width="100%" height={chartHeight}>
                                        <BarChart data={riskDistribution} layout="vertical" margin={{ top: 4, left: 4, right: 36, bottom: 0 }}>
                                            <CartesianGrid {...gridProps} horizontal={false} />
                                            <XAxis type="number" tick={axisStyle} stroke={BORDER} allowDecimals={false} />
                                            <YAxis type="category" dataKey="level" tick={axisStyle} stroke={BORDER} width={isNarrow ? 60 : 72} />
                                            <Tooltip content={<ChartTooltip />} cursor={{ fill: `${BORDER}55` }} />
                                            <Bar dataKey="value" name="Scholars" radius={[0, 6, 6, 0]} barSize={20}>
                                                {riskDistribution.map((entry) => (
                                                    <Cell key={entry.level} fill={entry.color} />
                                                ))}
                                                <LabelList dataKey="value" position="right" style={{ ...axisStyle, fontWeight: 600, fill: INK }} />
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                )}
                            </ChartCard>

                            <ChartCard
                                icon={ClipboardList}
                                title="Submission Status"
                                subtitle="Monthly submission records by current review status."
                            >
                                {!hasSubmissionStatusData ? (
                                    <EmptyState>No submissions in the last six months.</EmptyState>
                                ) : (
                                    <>
                                        <ResponsiveContainer width="100%" height={chartHeight}>
                                            <BarChart data={submissionStatusByMonth} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                                                <CartesianGrid {...gridProps} vertical={false} />
                                                <XAxis dataKey="month" tick={axisStyle} stroke={BORDER} />
                                                <YAxis tick={axisStyle} stroke={BORDER} allowDecimals={false} />
                                                <Tooltip content={<ChartTooltip />} cursor={{ fill: `${BORDER}55` }} />
                                                {SUBMISSION_STATUS_SERIES.map((series, index) => (
                                                    <Bar
                                                        key={series.key}
                                                        dataKey={series.key}
                                                        name={series.name}
                                                        stackId="submission-status"
                                                        fill={series.color}
                                                        radius={index === SUBMISSION_STATUS_SERIES.length - 1 ? [5, 5, 0, 0] : undefined}
                                                        maxBarSize={40}
                                                    />
                                                ))}
                                            </BarChart>
                                        </ResponsiveContainer>
                                        <ChartSeriesLegend series={SUBMISSION_STATUS_SERIES} />
                                    </>
                                )}
                            </ChartCard>
                        </div>

                        {/* 4. Letter quality: Scoring + Sentiment */}
                        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] gap-3 sm:gap-5">
                            <ChartCard
                                icon={BarChart3}
                                title="Scoring Status"
                                subtitle="Monthly letter score bands by scholar year level."
                                headerAction={qualityScoreAvailable && scoringMonths.length > 0 && (
                                    <select
                                        aria-label="Filter scoring by month"
                                        value={activeScoringMonth}
                                        onChange={(event) => setSelectedScoringMonth(event.target.value)}
                                        className="dash-focus min-w-0 rounded-lg px-3 py-2 w-full sm:w-auto"
                                        style={{ ...sans, border: `1px solid ${BORDER}`, background: SURFACE, color: INK, fontSize: '0.8rem', minHeight: 40 }}
                                    >
                                        {scoringMonths.map((month) => (
                                            <option key={month} value={month}>
                                                {formatAdminMonth(new Date(`${month}-01T12:00:00`), { month: 'short', year: 'numeric' })}
                                            </option>
                                        ))}
                                    </select>
                                )}
                            >
                                {!qualityScoreAvailable ? (
                                    <EmptyState>Scoring data is unavailable. Ensure the backend is updated, then reload.</EmptyState>
                                ) : monthlyScoreByLevel.length === 0 ? (
                                    <EmptyState>No scored submissions for this month.</EmptyState>
                                ) : (
                                    <div>
                                        <p style={{ ...sans, fontSize: '0.76rem', color: MUTED, marginBottom: 8 }}>
                                            {selectedMonthScoredTotal} scored submissions · average {selectedMonthAverageScore}%
                                        </p>
                                        <ResponsiveContainer width="100%" height={Math.max(chartHeight - 20, monthlyScoreByLevel.length * 48)}>
                                            <BarChart data={monthlyScoreByLevel} layout="vertical" margin={{ top: 4, right: 12, left: 4, bottom: 0 }}>
                                                <CartesianGrid {...gridProps} horizontal={false} />
                                                <XAxis type="number" tick={axisStyle} stroke={BORDER} allowDecimals={false} />
                                                <YAxis type="category" dataKey="yearLevel" tick={{ ...axisStyle, fontSize: isNarrow ? '0.64rem' : '0.7rem' }} stroke={BORDER} width={isNarrow ? 92 : 110} />
                                                <Tooltip content={<ChartTooltip />} cursor={{ fill: `${BORDER}55` }} />
                                                {QUALITY_SCORE_BANDS.map((band) => (
                                                    <Bar
                                                        key={band.key}
                                                        dataKey={band.key}
                                                        name={band.name}
                                                        stackId="quality-score"
                                                        fill={band.color}
                                                        radius={band.key === 'nonCompliant' ? [0, 5, 5, 0] : undefined}
                                                    />
                                                ))}
                                            </BarChart>
                                        </ResponsiveContainer>
                                        <ChartSeriesLegend series={QUALITY_SCORE_BANDS} />
                                    </div>
                                )}
                            </ChartCard>

                            <ChartCard icon={MessageSquare} title="NLP Sentiment" subtitle="Sentiment analysis of submitted letters.">
                                {lettersTotal === 0 ? (
                                    <EmptyState>No sentiment data yet.</EmptyState>
                                ) : (
                                    <ResponsiveContainer width="100%" height={chartHeight}>
                                        <BarChart data={sentimentBreakdown} margin={{ top: 16, right: 12, left: -16, bottom: 0 }}>
                                            <CartesianGrid {...gridProps} />
                                            <XAxis dataKey="label" tick={axisStyle} stroke={BORDER} />
                                            <YAxis tick={axisStyle} stroke={BORDER} allowDecimals={false} />
                                            <Tooltip content={<ChartTooltip />} cursor={{ fill: `${BORDER}55` }} />
                                            <Bar dataKey="value" name="Letters" radius={[6, 6, 0, 0]} maxBarSize={72}>
                                                {sentimentBreakdown.map((entry) => (
                                                    <Cell key={entry.label} fill={sentimentColor[entry.label]} />
                                                ))}
                                                <LabelList dataKey="value" position="top" style={{ ...axisStyle, fontWeight: 600, fill: INK }} />
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                )}
                            </ChartCard>
                        </div>

                        {/* 5. Activity trends: Duty attendance + Scholar growth */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-5">
                            <ChartCard
                                icon={CalendarDays}
                                title="Duty Attendance"
                                subtitle="Monthly attendance records by status."
                            >
                                {!hasDutyAttendanceData ? (
                                    <EmptyState>No duty attendance in the last six months.</EmptyState>
                                ) : (
                                    <>
                                        <ResponsiveContainer width="100%" height={chartHeight}>
                                            <BarChart data={dutyAttendanceByMonth} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                                                <CartesianGrid {...gridProps} vertical={false} />
                                                <XAxis dataKey="month" tick={axisStyle} stroke={BORDER} />
                                                <YAxis tick={axisStyle} stroke={BORDER} allowDecimals={false} />
                                                <Tooltip content={<ChartTooltip />} cursor={{ fill: `${BORDER}55` }} />
                                                {DUTY_ATTENDANCE_SERIES.map((series, index) => (
                                                    <Bar
                                                        key={series.key}
                                                        dataKey={series.key}
                                                        name={series.name}
                                                        stackId="duty-attendance"
                                                        fill={series.color}
                                                        radius={index === DUTY_ATTENDANCE_SERIES.length - 1 ? [5, 5, 0, 0] : undefined}
                                                        maxBarSize={40}
                                                    />
                                                ))}
                                            </BarChart>
                                        </ResponsiveContainer>
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <ChartSeriesLegend series={DUTY_ATTENDANCE_SERIES} />
                                            <p style={{ ...sans, fontSize: '0.68rem', color: MUTED }}>
                                                {makeUpAttendanceTotal} make-up attendance records included
                                            </p>
                                        </div>
                                    </>
                                )}
                            </ChartCard>

                            <ChartCard icon={BarChart3} title="Scholar Growth" subtitle="Monthly registrations of scholars.">
                                {scholarGrowth.length === 0 ? (
                                    <EmptyState>No registration dates are available yet, so growth can't be charted.</EmptyState>
                                ) : (
                                    <ResponsiveContainer width="100%" height={chartHeight}>
                                        <AreaChart data={scholarGrowth} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="growthFill" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0%" stopColor={PRIMARY} stopOpacity={0.22} />
                                                    <stop offset="100%" stopColor={PRIMARY} stopOpacity={0.02} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid {...gridProps} />
                                            <XAxis dataKey="month" tick={axisStyle} stroke={BORDER} />
                                            <YAxis tick={axisStyle} stroke={BORDER} allowDecimals={false} />
                                            <Tooltip content={<ChartTooltip />} />
                                            <Area type="monotone" dataKey="total" name="Scholars" stroke={PRIMARY} strokeWidth={2.5}
                                                fill="url(#growthFill)" dot={{ fill: PRIMARY, r: 3 }} activeDot={{ r: 5 }} />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                )}
                            </ChartCard>
                        </div>
                    </>
                )}

                {/* ── 6. Recent Users + System Activity ── */}
                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-3 sm:gap-5">
                    {/* Recent Users */}
                    <section className="min-w-0 overflow-hidden p-4 sm:p-6" style={cardStyle}>
                        <PanelHeader icon={Users} title="Recent Users" subtitle="Latest registered users in the system."
                            action={<OutlineButton onClick={() => navigate('/admin/users')}>Registry</OutlineButton>} />

                        {loading ? (
                            <div className="flex flex-col gap-3">
                                {Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-12" />)}
                            </div>
                        ) : recentUsers.length === 0 ? (
                            <p style={{ ...sans, fontSize: '0.82rem', color: MUTED, textAlign: 'center', padding: '32px 0' }}>No users yet.</p>
                        ) : (
                            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                                {recentUsers.map((user, idx) => {
                                    const badge = getRoleBadge(user.role);
                                    return (
                                        <li key={user.id} className="flex items-center gap-3 py-3"
                                            style={{ borderTop: idx === 0 ? 'none' : `1px solid ${BORDER}` }}>
                                            <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: `linear-gradient(135deg, ${PRIMARY} 0%, ${PRIMARY_DEEP} 100%)` }}>
                                                <span style={{ ...serif, color: '#fff', fontSize: '0.8rem', fontWeight: 600 }}>
                                                    {(user.full_name || '?').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                                                </span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p style={{ ...sans, fontSize: '0.84rem', fontWeight: 600, color: INK }} className="truncate">{user.full_name}</p>
                                                <p style={{ ...sans, fontSize: '0.72rem', color: MUTED }} className="truncate">{user.email}</p>
                                            </div>
                                            <span className="px-2.5 py-1 rounded-full flex-shrink-0" style={{ ...sans, fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em', ...badge }}>
                                                {user.role}
                                            </span>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </section>

                    {/* System Activity */}
                    <section className="min-w-0 overflow-hidden p-4 sm:p-6" style={cardStyle}>
                        <PanelHeader icon={Clock} title="System Activity" subtitle="Latest system events."
                            action={<OutlineButton onClick={() => navigate('/admin/security')}>Audit Log</OutlineButton>} />
                        <div>
                            {recentActivity.length === 0 ? (
                                <p style={{ ...sans, fontSize: '0.82rem', color: MUTED, textAlign: 'center', padding: '32px 0' }}>No recent activity.</p>
                            ) : recentActivity.slice(0, 5).map((item, i, visibleActivity) => (
                                <div key={item.id} className="relative pl-6" style={{ paddingBottom: i < visibleActivity.length - 1 ? 14 : 0 }}>
                                    {i < visibleActivity.length - 1 && (
                                        <span className="absolute" style={{ left: 4.5, top: 14, bottom: -2, width: 1, background: BORDER }} />
                                    )}
                                    <span className="absolute rounded-full" style={{ width: 10, height: 10, left: 0, top: 4, background: activityDotColor(item.status) }} />
                                    <p title={item.message} style={{ ...sans, fontSize: '0.78rem', fontWeight: 600, color: INK, lineHeight: 1.45, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', overflowWrap: 'anywhere' }}>{item.message}</p>
                                    <div className="flex flex-wrap items-center gap-2 mt-1">
                                        <span style={{ ...sans, fontSize: '0.68rem', color: MUTED, display: 'flex', alignItems: 'center', gap: 3 }}>
                                            <Clock size={10} /> {item.time}
                                        </span>
                                        <span className="max-w-[140px] truncate px-1.5 py-0.5 rounded-full" title={item.type} style={{ ...sans, fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase', background: `${BRONZE}14`, color: BRONZE }}>
                                            {item.type}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;