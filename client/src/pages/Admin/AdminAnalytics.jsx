import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area, LabelList } from "recharts";
import { Download, Users, AlertTriangle, MessageSquareText, ShieldCheck, CalendarCheck } from "lucide-react";
import { formatAdminMonth } from '../../utils/adminPreferences';
import AdminPageHeader from '../../components/Admin/AdminPageHeader';

const API_BASE = (import.meta.env?.VITE_API_URL || "http://localhost:5000").replace(/\/+$/, "");
const API = API_BASE.endsWith("/api") ? API_BASE : `${API_BASE}/api`;

// ── Executive design tokens ──────────────────────────────────────
const BG           = '#F7F4EE';
const SURFACE      = '#FFFDF9';
const BORDER       = '#E7D8C7';
const PRIMARY      = '#6D2140';
const INK          = '#241512';
const MUTED        = '#6B5D4F';
const BRONZE       = '#A9784E';
const SUCCESS      = '#6B8F71';
const WARNING      = '#C08A3E';
const DANGER       = '#A24A4A';
const RADIUS       = 16;
const SHADOW       = '0 1px 2px rgba(74, 23, 48, 0.04), 0 6px 18px rgba(74, 23, 48, 0.04)';

const serif = { fontFamily: "'Playfair Display', serif" };
const sans  = { fontFamily: "'Inter', sans-serif" };
const mono  = { fontFamily: "ui-monospace, 'SFMono-Regular', Menlo, monospace" };

const gridProps = { strokeDasharray: '3 3', stroke: BORDER, vertical: false };
const axisStyle = { fontFamily: "'Inter', sans-serif", fontSize: '0.75rem', fill: MUTED };
const tooltipStyle = { backgroundColor: SURFACE, border: `1px solid ${BORDER}`, borderRadius: '10px', fontFamily: "'Inter', sans-serif", fontSize: '0.8rem' };
const legendStyle = { fontFamily: "'Inter', sans-serif", fontSize: '0.8rem', color: MUTED };

const CHART_HEIGHT = 260;
const CHART_MARGIN = { top: 8, right: 8, left: -12, bottom: 0 };
const QUALITY_SCORE_BANDS = [
  { key: 'excellent', name: 'Excellent (90–100)', color: SUCCESS },
  { key: 'good', name: 'Good (75–89)', color: '#4B91A8' },
  { key: 'needsImprovement', name: 'Needs Improvement (50–74)', color: WARNING },
  { key: 'nonCompliant', name: 'Non-Compliant (0–49)', color: DANGER },
];
const PENDING_REVIEW_STATUSES = new Set(["pending", "under_review"]);
const COMPLETED_REVIEW_STATUSES = new Set([
  "approved",
  "returned",
  "rejected",
  "needs_revision",
  "needs-revision",
  "needs revision",
]);

const yearLevelOrder = [
  "Grade 7", "Grade 8", "Grade 9", "Grade 10", "Grade 11", "Grade 12",
  "1st Year College", "2nd Year College", "3rd Year College", "4th Year College", "5th Year College"
];

const normalizeYearLevel = (value) => {
  if (!value) return "Unknown";
  const normalized = String(value).trim().toLowerCase();
  if (["grade 7", "grade_7", "g7"].includes(normalized)) return "Grade 7";
  if (["grade 8", "grade_8", "g8"].includes(normalized)) return "Grade 8";
  if (["grade 9", "grade_9", "g9"].includes(normalized)) return "Grade 9";
  if (["grade 10", "grade_10", "g10"].includes(normalized)) return "Grade 10";
  if (["grade 11", "grade_11", "g11"].includes(normalized)) return "Grade 11";
  if (["grade 12", "grade_12", "g12"].includes(normalized)) return "Grade 12";
  if (["1st year college", "1st year", "college_1", "college 1", "1y"].includes(normalized)) return "1st Year College";
  if (["2nd year college", "2nd year", "college_2", "college 2", "2y"].includes(normalized)) return "2nd Year College";
  if (["3rd year college", "3rd year", "college_3", "college 3", "3y"].includes(normalized)) return "3rd Year College";
  if (["4th year college", "4th year", "college_4", "college 4", "4y"].includes(normalized)) return "4th Year College";
  if (["5th year college", "5th year", "college_5", "college 5", "5y"].includes(normalized)) return "5th Year College";
  return String(value).trim();
};

// Two-line tick for the scrollable Scholars per Year Level chart (full names, no abbreviation).
const LevelTick = ({ x, y, payload }) => {
  const words = String(payload?.value || "").split(" ");
  const split = words.length > 2 ? 2 : 1;
  const lines = [words.slice(0, split).join(" "), words.slice(split).join(" ")].filter(Boolean);
  return (
    <g transform={`translate(${x},${y})`}>
      {lines.map((line, i) => (
        <text key={i} x={0} y={0} dy={14 + i * 13} textAnchor="middle" style={axisStyle}>{line}</text>
      ))}
    </g>
  );
};

const LevelYTick = ({ x, y, payload }) => {
  const words = String(payload?.value || '').split(' ');
  const split = words.length > 2 ? 2 : 1;
  const lines = [words.slice(0, split).join(' '), words.slice(split).join(' ')].filter(Boolean);
  return (
    <g transform={`translate(${x},${y})`}>
      {lines.map((line, i) => (
        <text key={i} x={-6} y={0} dy={lines.length === 1 ? 4 : i === 0 ? -2 : 11} textAnchor="end" style={axisStyle}>{line}</text>
      ))}
    </g>
  );
};
const shortMonth = (value) => String(value).split(' ')[0];

const SCHOLAR_CHART_MIN_COL = 72; // px reserved per populated year level before the plot scrolls

const getSentimentBucket = (value) => {
  const label = String(value || "").trim().toLowerCase();
  if (label.includes("negative")) return "negative";
  if (label.includes("positive")) return "positive";
  if (label.includes("neutral")) return "neutral";
  return null;
};

const getAuthHeaders = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } });

const getDateOnlyUtc = (value) => {
  const datePart = String(value || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return null;
  const timestamp = Date.parse(`${datePart}T00:00:00.000Z`);
  return Number.isNaN(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== datePart ? null : timestamp;
};

const getTimestamp = (value) => {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
};

const getMonthKey = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};

const getLastSixMonthsDateRange = () => {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth() - 5, 1);
  const toDateString = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  return { date_from: toDateString(start), date_to: toDateString(today) };
};

const getAttendanceStatusBucket = (status) => {
  const normalized = String(status || "absent").toLowerCase();
  return normalized === "present" || normalized === "late" ? normalized : "absent";
};

const formatDurationHours = (hours) => {
  if (!Number.isFinite(hours) || hours < 0) return '—';
  const totalMinutes = Math.round(hours * 60);
  const days = Math.floor(totalMinutes / 1440);
  const remainingHours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const parts = [];

  if (days) parts.push(`${days} day${days === 1 ? '' : 's'}`);
  if (remainingHours) parts.push(`${remainingHours} hr${remainingHours === 1 ? '' : 's'}`);
  if (minutes || !parts.length) parts.push(`${minutes} min${minutes === 1 ? '' : 's'}`);
  return parts.join(' ');
};

const initialAnalytics = {
  yearLevelData: [],
  submissions: [],
  summary: [],
  users: [],
  archivedScholars: [],
  attendance: [],
  officerAssignments: [],
  qualityScoreByMonthLevel: [],
};

const useIsNarrow = (max = 640) => {
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.innerWidth <= max);
  useEffect(() => {
    const mediaQuery = window.matchMedia(`(max-width: ${max}px)`);
    const onChange = (event) => setNarrow(event.matches);
    mediaQuery.addEventListener('change', onChange);
    return () => mediaQuery.removeEventListener('change', onChange);
  }, [max]);
  return narrow;
};

const small = { ...sans, fontSize: '0.78rem', color: MUTED };

// ── KPI card ─────────────────────────────────────────────────────
const KpiCard = ({ icon: Icon, label, value, hint, color, onClick }) => {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      onClick={onClick}
      type={onClick ? 'button' : undefined}
      className="p-4 sm:p-5 text-left w-full min-w-0 h-full flex flex-col justify-between gap-5 transition-shadow hover:shadow-md"
      style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: RADIUS, boxShadow: SHADOW, cursor: onClick ? 'pointer' : 'default' }}
    >
      <div className="flex items-start justify-between gap-3">
        <p style={{ ...sans, fontSize: '0.85rem', fontWeight: 500, color: INK }}>{label}</p>
        <span className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: `${color}14`, color }}>
          <Icon size={16} />
        </span>
      </div>
      <div>
        <p style={{ ...serif, fontSize: 'clamp(1.7rem, 4vw, 2.2rem)', fontWeight: 600, color: INK, lineHeight: 1.05 }}>{value}</p>
        {hint && <p className="truncate" style={{ ...small, marginTop: 6 }}>{hint}</p>}
      </div>
    </Tag>
  );
};

// ── Chart card — equal height within a grid row ──────────────────
const ChartCard = ({ title, subtitle, footer, action, className = '', children }) => (
  <div className={`flex flex-col h-full min-w-0 p-4 sm:p-5 ${className}`} style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: RADIUS, boxShadow: SHADOW }}>
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 mb-4">
      <div className="min-w-0 flex-1" style={{ flexBasis: 200 }}>
        <h3 style={{ ...serif, fontSize: '1.1rem', fontWeight: 600, color: INK }}>{title}</h3>
        {subtitle && <p style={{ ...small, marginTop: 3, lineHeight: 1.5 }}>{subtitle}</p>}
      </div>
      {action}
    </div>
    <div className="flex-1 min-w-0">{children}</div>
    {footer && <p style={{ ...small, marginTop: 14, paddingTop: 12, borderTop: `1px solid ${BORDER}` }}>{footer}</p>}
  </div>
);

const FilterSelect = ({ label, children, ...props }) => (
  <select
    aria-label={label}
    {...props}
    className="h-10 sm:h-9 max-w-full rounded-lg px-3 outline-none cursor-pointer"
    style={{ ...sans, fontSize: '0.8rem', fontWeight: 500, background: SURFACE, border: `1px solid ${BORDER}`, color: INK }}
  >
    {children}
  </select>
);

const EmptyState = ({ height = CHART_HEIGHT, children }) => (
  <div className="flex items-center justify-center text-center px-4 rounded-xl" style={{ height, ...sans, fontSize: '0.85rem', color: MUTED, background: BG, border: `1px dashed ${BORDER}` }}>
    {children}
  </div>
);

const StatChip = ({ label, value, color }) => (
  <div className="rounded-xl px-3.5 py-2.5 flex-1" style={{ background: `${color}0F`, minWidth: 96 }}>
    <p style={small}>{label}</p>
    <p style={{ ...serif, fontSize: '1.3rem', fontWeight: 600, color, marginTop: 2 }}>{value}</p>
  </div>
);

const SkeletonLine = ({ width = '100%' }) => (
  <div className="animate-pulse h-3 rounded-full" style={{ width, background: '#EFE6D8' }} />
);

const Group = ({ title, subtitle, children }) => (
  <section className="flex flex-col gap-4">
    <div className="pt-2" style={{ borderTop: `1px solid ${BORDER}` }}>
      <h2 style={{ ...serif, fontSize: '1.35rem', fontWeight: 600, color: INK, marginTop: 14 }}>{title}</h2>
      {subtitle && <p style={{ ...small, fontSize: '0.85rem', marginTop: 3 }}>{subtitle}</p>}
    </div>
    {children}
  </section>
);

// ── Donut legend — dot, label, share ─────────────────────────────
const DonutLegend = ({ items }) => (
  <ul className="mt-3" style={{ borderTop: `1px solid ${BORDER}` }}>
    {items.map((it, i) => (
      <li key={it.label} className="flex items-center justify-between py-2"
        style={{ borderTop: i === 0 ? 'none' : `1px solid ${BORDER}`, ...sans, fontSize: '0.8rem' }}>
        <span className="inline-flex items-center gap-2" style={{ color: INK }}>
          <span className="rounded-full" style={{ width: 8, height: 8, background: it.color }} />{it.label}
        </span>
        <span style={{ fontWeight: 600, color: INK }}>{it.value}%</span>
      </li>
    ))}
  </ul>
);

const AdminAnalytics = () => {
  const navigate = useNavigate();
  const isNarrow = useIsNarrow();
  const levelAxisWidth = isNarrow ? 72 : 118;
  const levelYTick = isNarrow ? <LevelYTick /> : axisStyle;
  const monthTickFormatter = isNarrow ? shortMonth : undefined;
  const [selectedYearLevel, setSelectedYearLevel] = useState("all");
  const [selectedAttendanceGroup, setSelectedAttendanceGroup] = useState("all");
  const [selectedScoringMonth, setSelectedScoringMonth] = useState("");
  const [selectedSentimentMonth, setSelectedSentimentMonth] = useState("");
  const [analytics, setAnalytics] = useState(initialAnalytics);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [aiRecommendation, setAiRecommendation] = useState(null);
  const [aiRecommendationError, setAiRecommendationError] = useState(null);
  const [aiRecommendationRequest, setAiRecommendationRequest] = useState(null);
  const [narrativeRetry, setNarrativeRetry] = useState(0);
  const [narrativeCache, setNarrativeCache] = useState(() => new Map());
  const narrativeRequestId = useRef(0);
  const currentMonthKey = getMonthKey(new Date()) || "";

  const fetchAnalytics = useCallback(async () => {
    try {
      const [summaryRes, submissionsRes, usersRes, archiveRes, officerAssignmentsRes, dashboardSummaryRes, attendanceRes] = await Promise.all([
        axios.get(`${API}/admin/reports/compliance-summary`, getAuthHeaders()),
        axios.get(`${API}/submission/all`, getAuthHeaders()),
        axios.get(`${API}/admin/users`, getAuthHeaders()),
        axios.get(`${API}/admin/archive/scholars`, getAuthHeaders()),
        axios.get(`${API}/admin/officer-assignments`, getAuthHeaders()),
        axios.get(`${API}/admin/dashboard-summary`, getAuthHeaders()),
        axios.get(`${API}/staff/reports/duty-attendance`, {
          ...getAuthHeaders(),
          params: getLastSixMonthsDateRange(),
        }),
      ]);

      const requireRows = (response, resource) => {
        if (!Array.isArray(response?.data)) {
          throw new Error(`Unexpected response while loading ${resource}.`);
        }
        return response.data;
      };
      const summary = requireRows(summaryRes, 'scholar compliance');
      const submissions = requireRows(submissionsRes, 'submissions');
      const users = requireRows(usersRes, 'users');
      const archivedScholars = requireRows(archiveRes, 'archived scholars');
      const officerAssignments = requireRows(officerAssignmentsRes, 'officer assignments');
      const attendanceRows = requireRows(attendanceRes, 'duty attendance');
      const qualityScoreByMonthLevel = dashboardSummaryRes?.data?.submissions?.qualityScoreByMonthLevel;
      if (!Array.isArray(qualityScoreByMonthLevel)) {
        throw new Error("The dashboard API did not return monthly scoring data.");
      }

      const yearCounts = new Map();
      summary.forEach((item) => {
        const level = normalizeYearLevel(item.year_level || "Unknown");
        yearCounts.set(level, (yearCounts.get(level) || 0) + 1);
      });
      const yearLevelData = [...yearCounts.entries()]
        .map(([level, total]) => ({ level, total }))
        .sort((a, b) => {
          const aIndex = yearLevelOrder.indexOf(a.level);
          const bIndex = yearLevelOrder.indexOf(b.level);
          return (aIndex < 0 ? yearLevelOrder.length : aIndex)
            - (bIndex < 0 ? yearLevelOrder.length : bIndex)
            || a.level.localeCompare(b.level, undefined, { numeric: true });
        });

      const attendanceByYearMonth = new Map();
      attendanceRows.forEach((record) => {
        const month = getMonthKey(record.date || record.duty_date || record.marked_at);
        if (!month) return;
        const yearLevel = normalizeYearLevel(record.year_level || "Unknown");
        const groupName = String(record.group_name || "Unassigned").trim() || "Unassigned";
        const key = JSON.stringify([yearLevel, groupName, month]);
        const counts = attendanceByYearMonth.get(key) || {
          yearLevel,
          groupName,
          month,
          present: 0,
          late: 0,
          absent: 0,
        };
        counts[getAttendanceStatusBucket(record.status)] += 1;
        attendanceByYearMonth.set(key, counts);
      });

      setAnalytics({
        yearLevelData,
        submissions,
        summary,
        users,
        archivedScholars,
        attendance: [...attendanceByYearMonth.values()],
        officerAssignments,
        qualityScoreByMonthLevel,
      });
      const scoringMonths = [...new Set(qualityScoreByMonthLevel.map((item) => item.month))].sort().reverse();
      setSelectedScoringMonth((current) => scoringMonths.includes(current) ? current : scoringMonths[0] || "");
    } catch (err) {
      console.error("Error loading analytics", err);
      setError(err.response?.data?.message || err.response?.data?.error || err.message || "Unable to load analytics data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // The fetch updates state after its requests settle.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAnalytics();
  }, [fetchAnalytics]);

  const filteredSummary = useMemo(() => {
    if (selectedYearLevel === "all") return analytics.summary;
    return analytics.summary.filter((item) => normalizeYearLevel(item.year_level || "Unknown") === selectedYearLevel);
  }, [analytics.summary, selectedYearLevel]);

  const filteredData = useMemo(() => {
    if (selectedYearLevel === "all") return analytics.yearLevelData;
    return analytics.yearLevelData.filter((item) => item.level === selectedYearLevel);
  }, [analytics.yearLevelData, selectedYearLevel]);

  // ── Year-level filter for submissions (sentiment, rejected, pending letters) ──
  const scholarLevelById = useMemo(() => {
    const map = new Map();
    analytics.users.forEach((user) => {
      if (user?.role === "scholar" && user?.scholar_id) map.set(user.scholar_id, normalizeYearLevel(user.year_level));
    });
    return map;
  }, [analytics.users]);

  const filteredSubmissions = useMemo(() => {
    if (selectedYearLevel === "all") return analytics.submissions;
    return analytics.submissions.filter((sub) =>
      normalizeYearLevel(scholarLevelById.get(sub.scholar_id) || sub.year_level || "Unknown") === selectedYearLevel);
  }, [analytics.submissions, scholarLevelById, selectedYearLevel]);

  const filteredSentimentSubmissions = useMemo(() => filteredSubmissions.filter((sub) => (
    String(sub.submission_type || "").toLowerCase() === "letter"
    && getSentimentBucket(sub.sentiment_label) !== null
  )), [filteredSubmissions]);

  // Sentiment: last 6 months with data, as % share per month (follows the year-level filter)
  const sentimentTrend = useMemo(() => {
    const byMonth = {};
    filteredSentimentSubmissions.forEach((sub) => {
      const key = getMonthKey(sub.submitted_at || sub.created_at || sub.date);
      if (!key) return;
      if (!byMonth[key]) byMonth[key] = { month: key, positive: 0, neutral: 0, negative: 0 };
      byMonth[key][getSentimentBucket(sub.sentiment_label)] += 1;
    });
    return Object.values(byMonth)
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-6)
      .map((item) => {
        const [year, month] = item.month.split("-");
        const total = item.positive + item.neutral + item.negative;
        return {
          monthKey: item.month,
          month: formatAdminMonth(new Date(`${year}-${month}-01`), { month: 'short' }),
          positive: Math.round((item.positive / total) * 100),
          neutral: Math.round((item.neutral / total) * 100),
          negative: Math.round((item.negative / total) * 100),
          positiveCount: item.positive,
          neutralCount: item.neutral,
          negativeCount: item.negative,
        };
      });
  }, [filteredSentimentSubmissions]);

  const activeSentimentMonth = sentimentTrend.some((item) => item.monthKey === selectedSentimentMonth)
    ? selectedSentimentMonth
    : sentimentTrend[sentimentTrend.length - 1]?.monthKey || "";
  const sentimentByYearLevel = useMemo(() => {
    const buckets = {};
    filteredSentimentSubmissions.forEach((sub) => {
      const monthKey = getMonthKey(sub.submitted_at || sub.created_at || sub.date);
      if (!monthKey || monthKey !== activeSentimentMonth) return;
      const level = normalizeYearLevel(scholarLevelById.get(sub.scholar_id) || sub.year_level || "Unknown");
      if (!buckets[level]) buckets[level] = { level, positive: 0, neutral: 0, negative: 0, total: 0 };
      buckets[level][getSentimentBucket(sub.sentiment_label)] += 1;
      buckets[level].total += 1;
    });
    return Object.values(buckets)
      .sort((a, b) => {
        const aIndex = yearLevelOrder.indexOf(a.level);
        const bIndex = yearLevelOrder.indexOf(b.level);
        return (aIndex < 0 ? yearLevelOrder.length : aIndex)
          - (bIndex < 0 ? yearLevelOrder.length : bIndex)
          || a.level.localeCompare(b.level, undefined, { numeric: true });
      })
      .map((item) => ({
        level: item.level,
        positive: item.total ? Math.round((item.positive / item.total) * 100) : 0,
        neutral: item.total ? Math.round((item.neutral / item.total) * 100) : 0,
        negative: item.total ? Math.round((item.negative / item.total) * 100) : 0,
      }));
  }, [activeSentimentMonth, filteredSentimentSubmissions, scholarLevelById]);

  const pendingLetterReviews = useMemo(() => (
    filteredSubmissions.filter((sub) =>
      String(sub.submission_type || '').toLowerCase() === 'letter'
      && String(sub.status || '').toLowerCase() === 'pending'
      && !sub.archived_at && !sub.archive_at).length
  ), [filteredSubmissions]);

  // Only year levels that actually have scholars, in canonical order (unknown labels last).
  const scholarsPerLevelData = useMemo(() => {
    const rank = (level) => {
      const i = yearLevelOrder.indexOf(level);
      return i === -1 ? yearLevelOrder.length : i;
    };
    return filteredData
      .filter((item) => Number(item.total) > 0)
      .slice()
      .sort((a, b) => rank(a.level) - rank(b.level));
  }, [filteredData]);

  const scholarGrowth = useMemo(() => {
    const registrationsByMonth = new Map();
    const now = new Date();
    analytics.users.forEach((user) => {
      if (user.role !== "scholar") return;
      if (selectedYearLevel !== "all" && normalizeYearLevel(user.year_level || "Unknown") !== selectedYearLevel) return;
      const createdAt = new Date(user.created_at);
      if (Number.isNaN(createdAt.getTime())) return;
      const key = `${createdAt.getFullYear()}-${String(createdAt.getMonth() + 1).padStart(2, "0")}`;
      registrationsByMonth.set(key, (registrationsByMonth.get(key) || 0) + 1);
    });

    return Array.from({ length: 6 }, (_, index) => {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
      const key = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, "0")}`;
      return {
        month: formatAdminMonth(monthDate, { month: "short" }),
        monthKey: key,
        total: registrationsByMonth.get(key) || 0,
      };
    });
  }, [analytics.users, selectedYearLevel]);

  const submissionOutcomeTrend = useMemo(() => {
    const outcomesByMonth = new Map();
    const now = new Date();
    analytics.submissions.forEach((submission) => {
      const status = String(submission.status || "").trim().toLowerCase();
      const outcome = ["approved", "archived"].includes(status)
        ? "accepted"
        : status === "rejected" ? "rejected" : null;
      if (!outcome) return;

      const level = normalizeYearLevel(
        scholarLevelById.get(submission.scholar_id) || submission.year_level || "Unknown"
      );
      if (selectedYearLevel !== "all" && level !== selectedYearLevel) return;

      const monthKey = getMonthKey(
        submission.reviewed_at || submission.approved_at || submission.returned_at
      );
      if (!monthKey) return;
      const counts = outcomesByMonth.get(monthKey) || { accepted: 0, rejected: 0 };
      counts[outcome] += 1;
      outcomesByMonth.set(monthKey, counts);
    });

    return Array.from({ length: 6 }, (_, index) => {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
      const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, "0")}`;
      const counts = outcomesByMonth.get(monthKey) || { accepted: 0, rejected: 0 };
      return {
        month: formatAdminMonth(monthDate, { month: "short", year: "numeric" }),
        monthKey,
        accepted: counts.accepted,
        rejected: counts.rejected,
      };
    });
  }, [analytics.submissions, scholarLevelById, selectedYearLevel]);

  const yearLevelAttendanceAnalytics = useMemo(() => (
    selectedYearLevel === "all"
      ? analytics.attendance
      : analytics.attendance.filter((item) => item.yearLevel === selectedYearLevel)
  ), [analytics.attendance, selectedYearLevel]);
  const attendanceGroupOptions = useMemo(() => (
    [...new Set(yearLevelAttendanceAnalytics.map((item) => item.groupName))]
      .sort((left, right) => left.localeCompare(right))
  ), [yearLevelAttendanceAnalytics]);
  const activeAttendanceGroup = attendanceGroupOptions.includes(selectedAttendanceGroup)
    ? selectedAttendanceGroup
    : "all";
  const filteredAttendanceAnalytics = useMemo(() => (
    activeAttendanceGroup === "all"
      ? yearLevelAttendanceAnalytics
      : yearLevelAttendanceAnalytics.filter((item) => item.groupName === activeAttendanceGroup)
  ), [activeAttendanceGroup, yearLevelAttendanceAnalytics]);
  const attendanceTrend = useMemo(() => {
    const countsByMonth = new Map();
    filteredAttendanceAnalytics.forEach((item) => {
      const counts = countsByMonth.get(item.month) || { present: 0, late: 0, absent: 0 };
      counts.present += item.present;
      counts.late += item.late;
      counts.absent += item.absent;
      countsByMonth.set(item.month, counts);
    });

    const today = new Date();
    return Array.from({ length: 6 }, (_, index) => {
      const monthDate = new Date(today.getFullYear(), today.getMonth() - (5 - index), 1);
      const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, "0")}`;
      const counts = countsByMonth.get(monthKey) || { present: 0, late: 0, absent: 0 };
      return {
        monthKey,
        month: formatAdminMonth(monthDate, { month: "short", year: "numeric" }),
        ...counts,
        total: counts.present + counts.late + counts.absent,
      };
    });
  }, [filteredAttendanceAnalytics]);
  const attendanceTotals = attendanceTrend.reduce((totals, item) => ({
    present: totals.present + item.present,
    late: totals.late + item.late,
    absent: totals.absent + item.absent,
    total: totals.total + item.total,
  }), { present: 0, late: 0, absent: 0, total: 0 });
  const attendanceByGroup = useMemo(() => {
    const groups = new Map();
    filteredAttendanceAnalytics
      .filter((item) => item.month === currentMonthKey)
      .forEach((item) => {
        const counts = groups.get(item.groupName) || { groupName: item.groupName, present: 0, late: 0, absent: 0 };
        counts.present += item.present;
        counts.late += item.late;
        counts.absent += item.absent;
        groups.set(item.groupName, counts);
      });
    return [...groups.values()]
      .map((group) => ({ ...group, total: group.present + group.late + group.absent }))
      .sort((left, right) => left.groupName.localeCompare(right.groupName));
  }, [currentMonthKey, filteredAttendanceAnalytics]);
  const attendanceRate = attendanceTotals.total
    ? `${Math.round(((attendanceTotals.present + attendanceTotals.late) / attendanceTotals.total) * 100)}%`
    : "—";

  const scoringMonths = useMemo(() => (
    [...new Set(analytics.qualityScoreByMonthLevel.map((item) => item.month))].sort().reverse()
  ), [analytics.qualityScoreByMonthLevel]);
  const activeScoringMonth = scoringMonths.includes(selectedScoringMonth) ? selectedScoringMonth : scoringMonths[0] || "";
  const monthlyScoreByLevel = useMemo(() => {
    const groups = new Map();
    analytics.qualityScoreByMonthLevel
      .filter((item) => item.month === activeScoringMonth)
      .forEach((item) => {
        const level = normalizeYearLevel(item.yearLevel || "Unspecified");
        if (selectedYearLevel !== "all" && level !== selectedYearLevel) return;
        const current = groups.get(level) || {
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
        groups.set(level, current);
      });
    return [...groups.values()]
      .map(({ totalScore, ...item }) => ({
        ...item,
        average: item.scoredRecords ? Math.round(totalScore / item.scoredRecords) : 0,
      }))
      .sort((left, right) => left.yearLevel.localeCompare(right.yearLevel, undefined, { numeric: true }));
  }, [activeScoringMonth, analytics.qualityScoreByMonthLevel, selectedYearLevel]);
  const selectedMonthScoredTotal = monthlyScoreByLevel.reduce((sum, item) => sum + item.scoredRecords, 0);
  const selectedMonthAverageScore = selectedMonthScoredTotal
    ? Math.round(monthlyScoreByLevel.reduce((sum, item) => sum + item.average * item.scoredRecords, 0) / selectedMonthScoredTotal)
    : 0;

  const selectedSummaryTotals = useMemo(() => {
    const total = filteredSummary.length;
    const completionRates = filteredSummary
      .map((item) => item.completionRate == null || item.completionRate === '' ? NaN : Number(item.completionRate))
      .filter(Number.isFinite);
    const avg = completionRates.length
      ? Math.round(completionRates.reduce((sum, rate) => sum + rate, 0) / completionRates.length)
      : null;
    return { total, avg };
  }, [filteredSummary]);

  const yearLevelOptions = useMemo(() => [
    { value: "all", label: "All Year Levels" },
    ...analytics.yearLevelData.map((item) => ({ value: item.level, label: item.level }))
  ], [analytics.yearLevelData]);

  const archiveRetention = useMemo(() => {
    const today = getDateOnlyUtc(new Date().toISOString());
    const archivedScholars = selectedYearLevel === "all"
      ? analytics.archivedScholars
      : analytics.archivedScholars.filter((scholar) =>
        normalizeYearLevel(scholar.year_level || "Unknown") === selectedYearLevel);
    const scholars = archivedScholars.map((scholar) => {
      const expiration = getDateOnlyUtc(scholar.retention_until);
      if (expiration === null || today === null) return { ...scholar, daysRemaining: null };
      return { ...scholar, daysRemaining: Math.ceil((expiration - today) / 86400000) };
    });
    const datedScholars = scholars.filter((scholar) => scholar.daysRemaining !== null);
    return {
      total: scholars.length,
      upcomingCount: datedScholars.filter((scholar) => scholar.daysRemaining >= 0).length,
      expired: datedScholars.filter((scholar) => scholar.daysRemaining < 0).length,
      upcoming: datedScholars
        .filter((scholar) => scholar.daysRemaining >= 0)
        .sort((a, b) => a.daysRemaining - b.daysRemaining)
        .slice(0, 5),
    };
  }, [analytics.archivedScholars, selectedYearLevel]);

  const officerWorkload = useMemo(() => {
    const activeScholars = analytics.users.filter(
      (user) => user.role === "scholar"
        && String(user.status || "active").toLowerCase() === "active"
        && (selectedYearLevel === "all"
          || normalizeYearLevel(user.year_level || "Unknown") === selectedYearLevel)
    );
    const activeScholarIds = new Set(activeScholars.map((scholar) => scholar.scholar_id));
    const scholarLevelByActiveId = new Map(
      activeScholars.map((scholar) => [scholar.scholar_id, normalizeYearLevel(scholar.year_level || "Unknown")])
    );
    const scholarsByLevel = {};
    activeScholars.forEach((scholar) => {
      const level = scholarLevelByActiveId.get(scholar.scholar_id);
      scholarsByLevel[level] = [...(scholarsByLevel[level] || []), scholar.scholar_id];
    });

    const pendingByLevel = {};
    const reviewDurationsByLevel = {};
    analytics.submissions.forEach((submission) => {
      if (String(submission.submission_type || "").trim().toLowerCase() !== "letter"
        || !activeScholarIds.has(submission.scholar_id)) return;
      if (submission.archived_at || submission.archive_at) return;
      const level = scholarLevelByActiveId.get(submission.scholar_id);
      const status = String(submission.status || "pending").trim().toLowerCase();
      if (PENDING_REVIEW_STATUSES.has(status)) {
        pendingByLevel[level] = (pendingByLevel[level] || 0) + 1;
      }

      const submittedAt = getTimestamp(submission.submitted_at);
      const reviewedAt = getTimestamp(submission.reviewed_at || submission.approved_at || submission.returned_at);
      if (COMPLETED_REVIEW_STATUSES.has(status)
        && submittedAt !== null
        && reviewedAt !== null
        && reviewedAt >= submittedAt) {
        reviewDurationsByLevel[level] = [...(reviewDurationsByLevel[level] || []), (reviewedAt - submittedAt) / 3600000];
      }
    });

    return analytics.officerAssignments
      .filter((officer) => String(officer.status || "active").toLowerCase() === "active")
      .map((officer) => {
        const assignedLevels = [...new Set(
          (Array.isArray(officer.assigned_year_levels) ? officer.assigned_year_levels : [])
            .map(normalizeYearLevel)
        )];
        const levels = selectedYearLevel === "all"
          ? assignedLevels
          : assignedLevels.filter((level) => level === selectedYearLevel);
        if (!levels.length) return null;
        const assignedScholarIds = new Set();
        let pendingReviews = 0;
        const reviewDurations = [];
        levels.forEach((level) => {
          const normalizedLevel = normalizeYearLevel(level);
          (scholarsByLevel[normalizedLevel] || []).forEach((scholarId) => assignedScholarIds.add(scholarId));
          pendingReviews += pendingByLevel[normalizedLevel] || 0;
          reviewDurations.push(...(reviewDurationsByLevel[normalizedLevel] || []));
        });
        const averageReviewHours = reviewDurations.length
          ? reviewDurations.reduce((sum, hours) => sum + hours, 0) / reviewDurations.length
          : null;
        return {
          id: officer.id,
          name: officer.full_name || "Unnamed officer",
          levels,
          activeScholars: assignedScholarIds.size,
          pendingReviews,
          averageReviewHours,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.pendingReviews - a.pendingReviews || b.activeScholars - a.activeScholars || a.name.localeCompare(b.name));
  }, [analytics.officerAssignments, analytics.submissions, analytics.users, selectedYearLevel]);

  const sentimentSummary = useMemo(() => {
    const selectedMonth = sentimentTrend.find((item) => item.monthKey === activeSentimentMonth);
    if (!selectedMonth) return { positive: 0, neutral: 0, negative: 0, total: 0 };
    const total = selectedMonth.positiveCount + selectedMonth.neutralCount + selectedMonth.negativeCount;
    return {
      positive: selectedMonth.positive,
      neutral: selectedMonth.neutral,
      negative: selectedMonth.negative,
      total,
    };
  }, [activeSentimentMonth, sentimentTrend]);

  const currentMonthScoring = useMemo(() => {
    const rows = analytics.qualityScoreByMonthLevel.filter((item) => (
      item.month === currentMonthKey
      && (selectedYearLevel === "all" || normalizeYearLevel(item.yearLevel || "Unspecified") === selectedYearLevel)
    ));
    return rows.reduce((totals, item) => {
      const scoredRecords = Number(item.scoredRecords) || 0;
      totals.scoredRecords += scoredRecords;
      totals.totalScore += (Number(item.average) || 0) * scoredRecords;
      QUALITY_SCORE_BANDS.forEach(({ key }) => { totals.bands[key] += Number(item[key]) || 0; });
      return totals;
    }, {
      scoredRecords: 0,
      totalScore: 0,
      bands: { excellent: 0, good: 0, needsImprovement: 0, nonCompliant: 0 },
    });
  }, [analytics.qualityScoreByMonthLevel, currentMonthKey, selectedYearLevel]);

  const overallAnalyticsSummary = useMemo(() => {
    const currentSentiment = sentimentTrend.find((item) => item.monthKey === currentMonthKey);
    const sentimentCounts = {
      positive: currentSentiment?.positiveCount || 0,
      neutral: currentSentiment?.neutralCount || 0,
      negative: currentSentiment?.negativeCount || 0,
    };
    const currentOutcome = submissionOutcomeTrend.find((item) => item.monthKey === currentMonthKey);
    const currentAttendance = attendanceTrend.find((item) => item.monthKey === currentMonthKey);
    const currentGrowth = scholarGrowth.find((item) => item.monthKey === currentMonthKey);
    const activeScholars = analytics.users.filter((user) => (
      user.role === "scholar"
      && String(user.status || "active").toLowerCase() === "active"
      && (selectedYearLevel === "all"
        || normalizeYearLevel(user.year_level || "Unknown") === selectedYearLevel)
    )).length;
    const levelTotals = new Map();
    scholarsPerLevelData.forEach((item) => {
      const yearLevel = yearLevelOrder.includes(item.level) ? item.level : "Unknown";
      levelTotals.set(yearLevel, (levelTotals.get(yearLevel) || 0) + item.total);
    });

    return {
      month: currentMonthKey,
      overview: {
        totalScholars: selectedSummaryTotals.total,
        averageCompliance: selectedSummaryTotals.avg,
        activeScholars,
        pendingLetterReviews,
      },
      yearLevelDistribution: [...levelTotals.entries()].map(([yearLevel, scholars]) => ({ yearLevel, scholars })),
      scholarGrowth: [{ month: currentMonthKey, registrations: currentGrowth?.total || 0 }],
      sentiment: {
        analyzedSubmissions: sentimentCounts.positive + sentimentCounts.neutral + sentimentCounts.negative,
        ...sentimentCounts,
        monthly: [{ month: currentMonthKey, ...sentimentCounts }],
      },
      submissionOutcomes: {
        accepted: currentOutcome?.accepted || 0,
        rejected: currentOutcome?.rejected || 0,
      },
      attendance: {
        records: currentAttendance?.total || 0,
        present: currentAttendance?.present || 0,
        late: currentAttendance?.late || 0,
        absent: currentAttendance?.absent || 0,
        attendanceRate: currentAttendance?.total
          ? Math.round(((currentAttendance.present + currentAttendance.late) / currentAttendance.total) * 100)
          : null,
        monthly: [{
          month: currentMonthKey,
          present: currentAttendance?.present || 0,
          late: currentAttendance?.late || 0,
          absent: currentAttendance?.absent || 0,
        }],
        groups: attendanceByGroup.map(({ present, late, absent, total }) => ({
          records: total,
          present,
          late,
          absent,
          attendanceRate: total ? Math.round(((present + late) / total) * 100) : null,
        })),
      },
      scoring: {
        month: currentMonthKey,
        scoredRecords: currentMonthScoring.scoredRecords,
        average: currentMonthScoring.scoredRecords
          ? Math.round(currentMonthScoring.totalScore / currentMonthScoring.scoredRecords)
          : null,
        bands: currentMonthScoring.bands,
      },
      archiveRetention: {
        total: archiveRetention.total,
        upcoming: archiveRetention.upcomingCount,
        expired: archiveRetention.expired,
      },
      operations: {
        activeOfficers: officerWorkload.length,
      },
    };
  }, [
    analytics.users,
    archiveRetention,
    attendanceByGroup,
    attendanceTrend,
    currentMonthKey,
    currentMonthScoring,
    officerWorkload,
    pendingLetterReviews,
    scholarGrowth,
    scholarsPerLevelData,
    selectedSummaryTotals,
    selectedYearLevel,
    sentimentTrend,
    submissionOutcomeTrend,
  ]);
  const hasAnalyticsData = overallAnalyticsSummary.overview.totalScholars > 0
    || overallAnalyticsSummary.sentiment.analyzedSubmissions > 0
    || overallAnalyticsSummary.submissionOutcomes.accepted > 0
    || overallAnalyticsSummary.submissionOutcomes.rejected > 0
    || overallAnalyticsSummary.attendance.records > 0
    || overallAnalyticsSummary.scoring.scoredRecords > 0
    || overallAnalyticsSummary.archiveRetention.total > 0
    || overallAnalyticsSummary.operations.activeOfficers > 0;
  const recommendationRequestKey = JSON.stringify({
    yearLevel: yearLevelOrder.includes(selectedYearLevel) || selectedYearLevel === "all"
      ? selectedYearLevel
      : "Unknown",
    analyticsSummary: overallAnalyticsSummary,
  });
  const cachedRecommendationText = narrativeCache.get(recommendationRequestKey);
  const currentAiRecommendation = aiRecommendation?.key === recommendationRequestKey
    ? aiRecommendation
    : cachedRecommendationText
      ? { key: recommendationRequestKey, text: cachedRecommendationText }
      : null;
  const aiRecommendationLoading = aiRecommendationRequest?.key === recommendationRequestKey
    && aiRecommendationRequest.status === "loading";

  useEffect(() => {
    if (!hasAnalyticsData || cachedRecommendationText) return undefined;

    const requestId = ++narrativeRequestId.current;
    const timer = window.setTimeout(async () => {
      setAiRecommendationRequest({ key: recommendationRequestKey, status: "loading" });
      setAiRecommendationError(null);
      try {
        const response = await axios.post(
          `${API}/admin/analytics/executive-recommendations`,
          JSON.parse(recommendationRequestKey),
          getAuthHeaders()
        );
        const recommendation = response?.data?.recommendation;
        if (typeof recommendation !== "string" || !recommendation.trim()) {
          throw new Error("Groq returned an empty analytics narrative.");
        }
        if (narrativeRequestId.current !== requestId) return;

        const narrative = recommendation.trim();
        setNarrativeCache((currentCache) => {
          const nextCache = new Map(currentCache);
          nextCache.set(recommendationRequestKey, narrative);
          if (nextCache.size > 16) nextCache.delete(nextCache.keys().next().value);
          return nextCache;
        });
        setAiRecommendation({ key: recommendationRequestKey, text: narrative });
        setAiRecommendationRequest({ key: recommendationRequestKey, status: "success" });
      } catch (requestError) {
        if (narrativeRequestId.current !== requestId) return;
        setAiRecommendationError({
          key: recommendationRequestKey,
          message: requestError.response?.data?.error || requestError.message || "Unable to generate the analytics narrative.",
        });
        setAiRecommendationRequest({ key: recommendationRequestKey, status: "error" });
      }
    }, 600);

    return () => {
      window.clearTimeout(timer);
      if (narrativeRequestId.current === requestId) narrativeRequestId.current += 1;
    };
  }, [
    hasAnalyticsData,
    cachedRecommendationText,
    narrativeRetry,
    recommendationRequestKey,
  ]);

  // Rule-based alerts remain separate from the AI-generated analytics narrative.
  const earlyWarnings = useMemo(() => {
    const warnings = [];
    const negative = filteredSentimentSubmissions.filter(item => getSentimentBucket(item.sentiment_label) === 'negative').length;
    const rejected = filteredSubmissions.filter(item => String(item.status || '').toLowerCase() === 'rejected').length;
    if (negative) warnings.push({ type: 'negative-sentiment', count: negative, label: 'Review Negative Correspondence', detail: `${negative} submission${negative === 1 ? '' : 's'} with negative sentiment.`, action: 'View', path: '/admin/reports' });
    if (rejected) warnings.push({ type: 'rejected-submission', count: rejected, label: 'Resolve Rejected Submissions', detail: `${rejected} submission${rejected === 1 ? '' : 's'} require scholar revision.`, action: 'View', path: '/admin/reports' });
    return warnings.length ? warnings : [{ label: 'No Rule-Based Alerts Detected', detail: 'No negative-sentiment or rejected-submission alerts for this selection.', action: 'View', path: '/admin/reports' }];
  }, [filteredSentimentSubmissions, filteredSubmissions]);

  const exportCsv = () => {
    const rows = [["Month", "Positive%", "Neutral%", "Negative%"]];
    sentimentTrend.forEach((d) => rows.push([d.month, String(d.positive), String(d.neutral), String(d.negative)]));
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "analytics_export.csv";
    a.click();
    URL.revokeObjectURL(url);

    axios.post(`${API}/export/google-sheets`, { log_only: true, module: 'Analytics', report_resource: 'Admin Analytics', spreadsheet_title: 'Admin Analytics Export', details: 'analytics_export.csv' }, getAuthHeaders())
      .catch((err) => console.error('Analytics export audit log failed:', err));
  };

  // ── Loading skeleton — mirrors the final layout ──
  if (loading) {
    const block = { background: '#EFE6D8', borderRadius: RADIUS };
    return (
      <div className="min-h-screen overflow-x-hidden" style={{ background: BG, ...sans }}>
        <div className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 flex flex-col gap-6">
          <div>
            <div className="animate-pulse h-8 w-72 max-w-full rounded-lg mb-3" style={{ background: `${PRIMARY}14` }} />
            <SkeletonLine width="360px" />
          </div>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
            {[0, 1, 2, 3].map((i) => <div key={i} className="animate-pulse h-32" style={block} />)}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="animate-pulse h-56 lg:col-span-2" style={block} />
            <div className="animate-pulse h-56" style={block} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {[0, 1].map((i) => <div key={i} className="animate-pulse h-80" style={block} />)}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen overflow-x-hidden" style={{ background: BG, ...sans }}>
        <div className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 flex flex-col gap-6">
          <AdminPageHeader
            title="Analytics Dashboard"
            description="Overview of scholar records, submissions, compliance, and performance."
          />
          <div role="alert" className="rounded-xl px-4 py-4" style={{ background: `${DANGER}0D`, border: `1px solid ${DANGER}45` }}>
            <p style={{ ...sans, fontSize: '0.86rem', color: DANGER }}>{error}</p>
            <button type="button" onClick={() => { setError(""); setLoading(true); fetchAnalytics(); }} className="mt-3 rounded-full"
              style={{ ...sans, fontSize: '0.76rem', fontWeight: 700, color: '#fff', background: PRIMARY, border: 'none', padding: '8px 14px', cursor: 'pointer' }}>
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-x-hidden" style={{ background: BG, ...sans }}>
      <div className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 pb-12 flex flex-col gap-8">

        <AdminPageHeader
          title="Analytics Dashboard"
          description="Overview of scholar records, submissions, compliance, and performance."
          actions={
            <div className="flex flex-wrap items-center gap-2.5">
              <FilterSelect label="Filter by year level" value={selectedYearLevel} onChange={(e) => setSelectedYearLevel(e.target.value)}>
                {yearLevelOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </FilterSelect>
              <button onClick={exportCsv} className="h-10 sm:h-9 inline-flex items-center gap-2 rounded-lg px-4 transition-opacity hover:opacity-90"
                style={{ ...sans, fontSize: '0.8rem', fontWeight: 600, background: PRIMARY, color: '#fff', border: 'none', cursor: 'pointer' }}>
                <Download size={14} /> Export CSV
              </button>
            </div>
          }
        />

        {/* ── Filter note — shown only while a year level is selected ── */}
        {selectedYearLevel !== "all" && (
          <div className="-mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl px-4 py-2.5" style={{ background: `${PRIMARY}08`, border: `1px solid ${BORDER}` }}>
            <p style={{ ...sans, fontSize: '0.85rem', color: INK }}>
              Showing <strong>{selectedYearLevel}</strong> across all analytics.
            </p>
            <button type="button" onClick={() => setSelectedYearLevel("all")} className="hover:underline"
              style={{ ...sans, fontSize: '0.8rem', fontWeight: 700, color: PRIMARY, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0' }}>
              Clear filter
            </button>
          </div>
        )}

        {/* ── Overview ── */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
          <KpiCard icon={Users} label="Total scholars" value={selectedSummaryTotals.total} hint={selectedYearLevel === "all" ? "All year levels" : selectedYearLevel} color={PRIMARY} />
          <KpiCard icon={ShieldCheck} label="Average compliance" value={selectedSummaryTotals.avg === null ? '—' : `${selectedSummaryTotals.avg}%`} hint="Across scholars with a rate" color={SUCCESS} />
          <KpiCard icon={MessageSquareText} label="Letters analyzed" value={filteredSentimentSubmissions.length} hint="Open reports" color={BRONZE} onClick={() => navigate('/admin/reports')} />
          <KpiCard icon={CalendarCheck} label="Attendance rate" value={attendanceRate} hint="Last 6 months, open reports" color={SUCCESS} onClick={() => navigate('/admin/reports')} />
        </div>

        {/* ── Monthly summary and alerts ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch">
          <ChartCard
            className="lg:col-span-2"
            title="Monthly summary"
            subtitle="Plain-language summary of this month for the selected year level."
            footer={!hasAnalyticsData ? null : aiRecommendationLoading ? 'Preparing summary…' : 'Summary is up to date and refreshes when you change the filter.'}
          >
            {!hasAnalyticsData ? (
              <EmptyState height={140}>No analytics data available for this selection.</EmptyState>
            ) : aiRecommendationError?.key === recommendationRequestKey ? (
              <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3" style={{ ...sans, fontSize: '0.85rem', color: DANGER, background: `${DANGER}0C`, border: `1px solid ${DANGER}33` }}>
                <span>{aiRecommendationError.message} Rule-based alerts are still shown.</span>
                <button type="button" onClick={() => setNarrativeRetry((value) => value + 1)} className="rounded-full"
                  style={{ ...sans, fontSize: '0.78rem', fontWeight: 700, color: '#fff', background: DANGER, border: 'none', padding: '7px 14px', cursor: 'pointer' }}>
                  Retry
                </button>
              </div>
            ) : currentAiRecommendation ? (
              <p className="pl-4" style={{ ...sans, fontSize: '0.95rem', lineHeight: 1.75, color: INK, maxWidth: '72ch', borderLeft: `3px solid ${BRONZE}` }}>
                {currentAiRecommendation.text}
              </p>
            ) : (
              <div className="flex flex-col gap-3 pl-4" style={{ borderLeft: `3px solid ${BORDER}` }} aria-busy="true">
                <SkeletonLine /><SkeletonLine width="92%" /><SkeletonLine width="78%" />
              </div>
            )}
          </ChartCard>

          <ChartCard title="Needs attention" subtitle="Alerts for this selection.">
            <ul className="divide-y divide-[#E7D8C7]">
              {earlyWarnings.map((warning) => (
                <li key={warning.label} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                  <span className="flex items-center justify-center rounded-full flex-shrink-0" style={{ width: 34, height: 34, background: `${WARNING}1A`, color: WARNING }}>
                    <AlertTriangle size={15} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p style={{ ...sans, fontSize: '0.9rem', fontWeight: 600, color: INK }}>{warning.label}</p>
                    <p style={{ ...small, marginTop: 2, lineHeight: 1.5 }}>{warning.detail}</p>
                    <button type="button" onClick={() => navigate(warning.path)} className="hover:underline"
                      style={{ ...sans, fontSize: '0.8rem', fontWeight: 700, color: PRIMARY, background: 'none', border: 'none', padding: '10px 0 2px', cursor: 'pointer' }}>
                      {warning.action}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </ChartCard>
        </div>

        <Group title="Scholars" subtitle="Who is in the program and how it is growing.">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
          <div className="min-w-0">
            <ChartCard title="Scholars per Year Level" subtitle="Total scholars in each batch with records.">
              {scholarsPerLevelData.length === 0 ? (
                <div className="flex items-center justify-center text-center" style={{ height: CHART_HEIGHT, ...sans, fontSize: '0.8rem', color: MUTED }}>
                  No scholar records for this selection yet.
                </div>
              ) : (
                <div className="overflow-x-auto" style={{ margin: '0 -4px', padding: '0 4px' }}>
                  <div style={{ width: '100%', minWidth: scholarsPerLevelData.length * SCHOLAR_CHART_MIN_COL }}>
                    <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
                      <BarChart data={scholarsPerLevelData} margin={{ ...CHART_MARGIN, top: 20 }}>
                        <CartesianGrid {...gridProps} />
                        <XAxis dataKey="level" tick={<LevelTick />} stroke={BORDER} interval={0} height={44} />
                        <YAxis tick={axisStyle} stroke={BORDER} allowDecimals={false} />
                        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: `${PRIMARY}0A` }} />
                        <Bar dataKey="total" fill={PRIMARY} name="Scholars" radius={[4, 4, 0, 0]} maxBarSize={44}>
                          <LabelList dataKey="total" position="top" style={{ ...axisStyle, fontWeight: 600, fill: INK }} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </ChartCard>
          </div>

          <div className="min-w-0">
            <ChartCard
              title="Scholar Growth"
              subtitle={`Monthly scholar registrations over the last six months${selectedYearLevel === "all" ? "." : ` for ${selectedYearLevel}.`}`}
            >
              <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
                <AreaChart data={scholarGrowth} margin={CHART_MARGIN}>
                  <defs>
                    <linearGradient id="analyticsGrowthFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={PRIMARY} stopOpacity={0.22} />
                      <stop offset="100%" stopColor={PRIMARY} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="month" tick={axisStyle} stroke={BORDER} />
                  <YAxis tick={axisStyle} stroke={BORDER} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Area type="monotone" dataKey="total" name="Registrations" stroke={PRIMARY} strokeWidth={2.5}
                    fill="url(#analyticsGrowthFill)" dot={{ fill: PRIMARY, r: 3 }} activeDot={{ r: 5 }} />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        </div>
        </Group>

        <Group title="Submissions and scoring" subtitle="Letter quality and review outcomes.">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch">
            <ChartCard
              className="lg:col-span-2"
              title="Scoring Status"
              subtitle={selectedMonthScoredTotal ? `${selectedMonthScoredTotal} scored submissions, average ${selectedMonthAverageScore}%.` : 'Monthly letter score bands by year level.'}
              action={scoringMonths.length > 0 && (
                <FilterSelect label="Filter scoring by month" value={activeScoringMonth} onChange={(event) => setSelectedScoringMonth(event.target.value)}>
                  {scoringMonths.map((month) => (
                    <option key={month} value={month}>{formatAdminMonth(new Date(`${month}-01T12:00:00`), { month: 'short', year: 'numeric' })}</option>
                  ))}
                </FilterSelect>
              )}
            >
              {!analytics.qualityScoreByMonthLevel.length ? (
                <EmptyState>Scoring data is unavailable. Ensure the backend is updated, then reload.</EmptyState>
              ) : monthlyScoreByLevel.length === 0 ? (
                <EmptyState>No scored submissions for this month and year level.</EmptyState>
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(240, monthlyScoreByLevel.length * 56 + (isNarrow ? 90 : 40))}>
                  <BarChart data={monthlyScoreByLevel} layout="vertical" margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid {...gridProps} horizontal={false} />
                    <XAxis type="number" tick={axisStyle} stroke={BORDER} allowDecimals={false} />
                    <YAxis type="category" dataKey="yearLevel" tick={levelYTick} stroke={BORDER} width={levelAxisWidth} />
                    <Tooltip contentStyle={tooltipStyle} cursor={{ fill: `${PRIMARY}0A` }} />
                    <Legend wrapperStyle={legendStyle} />
                    {QUALITY_SCORE_BANDS.map((band) => (
                      <Bar key={band.key} dataKey={band.key} name={band.name} stackId="quality-score" fill={band.color} radius={band.key === 'nonCompliant' ? [0, 5, 5, 0] : undefined} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            <ChartCard title="Accepted and rejected" subtitle={`Review outcomes per month for ${selectedYearLevel === "all" ? "all year levels" : selectedYearLevel}.`}>
              {submissionOutcomeTrend.some((item) => item.accepted || item.rejected) ? (
                <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
                  <BarChart data={submissionOutcomeTrend} margin={CHART_MARGIN}>
                    <CartesianGrid {...gridProps} />
                    <XAxis dataKey="month" tick={axisStyle} stroke={BORDER} tickFormatter={monthTickFormatter} />
                    <YAxis tick={axisStyle} stroke={BORDER} allowDecimals={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={legendStyle} />
                    <Bar dataKey="accepted" fill={SUCCESS} name="Accepted" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="rejected" fill={DANGER} name="Rejected" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState>No reviewed submissions in the last six months.</EmptyState>
              )}
            </ChartCard>
          </div>
        </Group>

        <Group title="Duty attendance" subtitle="Present and late both count as attended.">
        <ChartCard
          title="Attendance trend"
          subtitle={`Last six months${selectedYearLevel === "all" ? "" : `, ${selectedYearLevel}`}${activeAttendanceGroup === "all" ? "." : `, ${activeAttendanceGroup}.`}`}
          action={
            <FilterSelect label="Filter duty attendance by group" value={activeAttendanceGroup} onChange={(e) => setSelectedAttendanceGroup(e.target.value)}>
              <option value="all">All groups</option>
              {attendanceGroupOptions.map((groupName) => <option key={groupName} value={groupName}>{groupName}</option>)}
            </FilterSelect>
          }
        >
          {attendanceTotals.total > 0 ? (
            <>
              <div className="flex flex-wrap gap-3 mb-5">
                <StatChip label="Present" value={attendanceTotals.present} color={SUCCESS} />
                <StatChip label="Late" value={attendanceTotals.late} color={WARNING} />
                <StatChip label="Absent" value={attendanceTotals.absent} color={DANGER} />
                <StatChip label="Attendance rate" value={attendanceRate} color={PRIMARY} />
              </div>
              <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
                <BarChart data={attendanceTrend} margin={CHART_MARGIN}>
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="month" tick={axisStyle} stroke={BORDER} tickFormatter={monthTickFormatter} />
                  <YAxis tick={axisStyle} stroke={BORDER} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: `${PRIMARY}0A` }} />
                  <Legend wrapperStyle={legendStyle} />
                  <Bar dataKey="present" fill={SUCCESS} name="Present" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="late" fill={WARNING} name="Late" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="absent" fill={DANGER} name="Absent" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </>
          ) : (
            <EmptyState>No duty attendance records in the last six months.</EmptyState>
          )}
        </ChartCard>
        </Group>

        <Group title="Correspondence sentiment" subtitle="Sentiment of analyzed scholar letters.">
          <ChartCard
            title="Sentiment overview"
            subtitle={activeSentimentMonth ? `Share for ${formatAdminMonth(new Date(`${activeSentimentMonth}-01T12:00:00`), { month: 'long', year: 'numeric' })}. The trend shows the last 6 months.` : 'Monthly sentiment share for analyzed letters.'}
            action={sentimentTrend.length > 0 && (
              <FilterSelect label="Filter sentiment by month" value={activeSentimentMonth} onChange={(event) => setSelectedSentimentMonth(event.target.value)}>
                {sentimentTrend.slice().reverse().map(({ monthKey }) => (
                  <option key={monthKey} value={monthKey}>{formatAdminMonth(new Date(`${monthKey}-01T12:00:00`), { month: 'short', year: 'numeric' })}</option>
                ))}
              </FilterSelect>
            )}
          >
            {sentimentTrend.length === 0 ? (
              <EmptyState>No analyzed letter sentiment data is available yet.</EmptyState>
            ) : (
              <div className="flex flex-col gap-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-6">
                  <div className="min-w-0 lg:col-span-2">
                    <h4 style={{ ...serif, fontSize: '1rem', fontWeight: 600, color: INK, marginBottom: 10 }}>Trend</h4>
                    <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
                      <AreaChart data={sentimentTrend} margin={CHART_MARGIN}>
                        <CartesianGrid {...gridProps} />
                        <XAxis dataKey="month" tick={axisStyle} stroke={BORDER} />
                        <YAxis tick={axisStyle} stroke={BORDER} tickFormatter={(value) => `${value}%`} />
                        <Tooltip contentStyle={tooltipStyle} formatter={(value, name) => [`${value}%`, name]} />
                        <Legend wrapperStyle={legendStyle} />
                        <Area type="monotone" dataKey="positive" stackId="1" stroke={SUCCESS} fill={`${SUCCESS}33`} name="Positive" />
                        <Area type="monotone" dataKey="neutral" stackId="1" stroke={WARNING} fill={`${WARNING}33`} name="Neutral" />
                        <Area type="monotone" dataKey="negative" stackId="1" stroke={DANGER} fill={`${DANGER}33`} name="Negative" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="min-w-0 pt-6 border-t lg:pt-0 lg:pl-6 lg:border-t-0 lg:border-l" style={{ borderColor: BORDER }}>
                    <h4 style={{ ...serif, fontSize: '1rem', fontWeight: 600, color: INK, marginBottom: 6 }}>Selected month</h4>
                    {sentimentSummary.total ? (
                      <>
                        <ResponsiveContainer width="100%" height={170}>
                          <PieChart>
                            <Pie
                              data={[
                                { name: 'Positive', value: sentimentSummary.positive },
                                { name: 'Neutral', value: sentimentSummary.neutral },
                                { name: 'Negative', value: sentimentSummary.negative },
                              ]}
                              cx="50%" cy="50%" labelLine={false} innerRadius={48} outerRadius={76} paddingAngle={2} stroke={SURFACE} dataKey="value" nameKey="name"
                            >
                              {[SUCCESS, WARNING, DANGER].map((color, index) => <Cell key={index} fill={color} />)}
                            </Pie>
                            <Tooltip contentStyle={tooltipStyle} formatter={(value, name) => [`${value}%`, name]} />
                          </PieChart>
                        </ResponsiveContainer>
                        <DonutLegend items={[
                          { label: 'Positive', value: sentimentSummary.positive, color: SUCCESS },
                          { label: 'Neutral', value: sentimentSummary.neutral, color: WARNING },
                          { label: 'Negative', value: sentimentSummary.negative, color: DANGER },
                        ]} />
                      </>
                    ) : (
                      <EmptyState height={200}>No letters analyzed this month.</EmptyState>
                    )}
                  </div>
                </div>

                <div className="pt-6" style={{ borderTop: `1px solid ${BORDER}` }}>
                  <h4 style={{ ...serif, fontSize: '1rem', fontWeight: 600, color: INK, marginBottom: 10 }}>By year level</h4>
                  {sentimentByYearLevel.length ? (
                    <ResponsiveContainer width="100%" height={Math.max(CHART_HEIGHT, sentimentByYearLevel.length * 56 + (isNarrow ? 50 : 0))}>
                      <BarChart data={sentimentByYearLevel} layout="vertical" margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                        <CartesianGrid {...gridProps} horizontal={false} />
                        <XAxis type="number" domain={[0, 100]} tick={axisStyle} stroke={BORDER} allowDecimals={false} tickFormatter={(value) => `${value}%`} />
                        <YAxis type="category" dataKey="level" tick={levelYTick} stroke={BORDER} width={levelAxisWidth} />
                        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: `${PRIMARY}0A` }} formatter={(value, name) => [`${value}%`, name]} />
                        <Legend wrapperStyle={legendStyle} />
                        <Bar dataKey="positive" fill={SUCCESS} name="Positive" radius={[0, 4, 4, 0]} />
                        <Bar dataKey="neutral" fill={WARNING} name="Neutral" radius={[0, 4, 4, 0]} />
                        <Bar dataKey="negative" fill={DANGER} name="Negative" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyState height={160}>No letters analyzed for this month and year level.</EmptyState>
                  )}
                </div>
              </div>
            )}
          </ChartCard>
        </Group>

        <Group title="Operations" subtitle="Retention reminders and officer review workload.">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-stretch">
            <ChartCard
              title="Archive retention watch"
              subtitle="Archived scholars approaching or past their retention dates."
              footer="Retention dates are a review reminder. This panel does not delete records."
              action={
                <button type="button" onClick={() => navigate('/admin/archive')} className="h-10 sm:h-9 rounded-lg px-3.5 transition-opacity hover:opacity-80"
                  style={{ ...sans, fontSize: '0.8rem', fontWeight: 600, color: PRIMARY, background: `${PRIMARY}0F`, border: 'none', cursor: 'pointer' }}>
                  Open archive
                </button>
              }
            >
              <div className="flex flex-wrap gap-3">
                <StatChip label="Archived" value={archiveRetention.total} color={PRIMARY} />
                <StatChip label="Upcoming" value={archiveRetention.upcomingCount} color={WARNING} />
                <StatChip label="Past retention" value={archiveRetention.expired} color={DANGER} />
              </div>
              <h4 style={{ ...serif, fontSize: '1rem', fontWeight: 600, color: INK, margin: '20px 0 4px' }}>Next to review</h4>
              {archiveRetention.upcoming.length ? archiveRetention.upcoming.map((scholar) => (
                <div key={scholar.id} className="flex items-center justify-between gap-3 py-3" style={{ borderTop: `1px solid ${BORDER}` }}>
                  <div className="min-w-0">
                    <p className="truncate" style={{ ...sans, fontSize: '0.88rem', fontWeight: 600, color: INK }}>{scholar.full_name}</p>
                    <p style={small}>{normalizeYearLevel(scholar.year_level || '—')}</p>
                  </div>
                  <span className="flex-shrink-0 rounded-full px-3 py-1" style={{ ...sans, fontSize: '0.75rem', fontWeight: 700, color: WARNING, background: `${WARNING}14` }}>
                    {scholar.daysRemaining === 0 ? 'Today' : `In ${scholar.daysRemaining}d`}
                  </span>
                </div>
              )) : (
                <p className="py-5 text-center" style={{ ...small, fontSize: '0.85rem', borderTop: `1px solid ${BORDER}` }}>No upcoming retention dates.</p>
              )}
            </ChartCard>

            <ChartCard
              title="Officer workload"
              subtitle="Active scholars and letter reviews per officer."
              footer="Average review time is the time from submission to review for completed letters. Overlapping assignments can count one letter for several officers."
              action={
                <button type="button" onClick={() => navigate('/admin/team-assignments')} className="h-10 sm:h-9 rounded-lg px-3.5 transition-opacity hover:opacity-80"
                  style={{ ...sans, fontSize: '0.8rem', fontWeight: 600, color: PRIMARY, background: `${PRIMARY}0F`, border: 'none', cursor: 'pointer' }}>
                  Manage assignments
                </button>
              }
            >
              {officerWorkload.length ? (
                <div className="overflow-auto max-h-[400px]">
                  <div style={{ minWidth: 520 }}>
                    <div className="grid grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))] gap-3 pb-2 sticky top-0" style={{ ...sans, fontSize: '0.75rem', fontWeight: 600, color: MUTED, borderBottom: `1px solid ${BORDER}`, background: SURFACE }}>
                      <span>Officer</span>
                      <span className="text-center">Active scholars</span>
                      <span className="text-center">Pending letters</span>
                      <span className="text-center">Avg review time</span>
                    </div>
                    {officerWorkload.map((officer) => (
                      <div key={officer.id} className="grid grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))] items-center gap-3 py-3" style={{ borderBottom: `1px solid ${BORDER}` }}>
                        <div className="min-w-0">
                          <p className="truncate" style={{ ...sans, fontSize: '0.88rem', fontWeight: 600, color: INK }}>{officer.name}</p>
                          <p className="truncate" style={small}>{officer.levels.length ? officer.levels.map(normalizeYearLevel).join(', ') : 'No year levels assigned'}</p>
                        </div>
                        <span className="text-center" style={{ ...mono, fontSize: '0.85rem', color: INK }}>{officer.activeScholars}</span>
                        <span className="text-center" style={{ ...mono, fontSize: '0.85rem', fontWeight: 700, color: officer.pendingReviews ? WARNING : MUTED }}>{officer.pendingReviews}</span>
                        <span className="text-center" style={{ ...mono, fontSize: '0.8rem', color: INK }}>{formatDurationHours(officer.averageReviewHours)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <EmptyState height={160}>
                  {selectedYearLevel === "all" ? "No active officer assignments are available." : `No active officers are assigned to ${selectedYearLevel}.`}
                </EmptyState>
              )}
            </ChartCard>
          </div>
        </Group>

      </div>
    </div>
  );
};

export default AdminAnalytics;