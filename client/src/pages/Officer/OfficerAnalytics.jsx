import axios from 'axios';
import { useEffect, useMemo, useState } from 'react';
import {
  LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell
} from 'recharts';
import {
  Download, TrendingUp, Users, FileText, AlertTriangle, BarChart3,
  ShieldCheck, PieChart as PieChartIcon, SlidersHorizontal, FilterX,
} from 'lucide-react';
import { API_BASE, authHeaders } from '../../components/Officer/Reports/ReportsHelpers';
import { formatYearLevelLabel } from '../../utils/yearLevelLabels';

// ── Apple Scholar design system — same tokens as the other Officer pages ──
const PRIMARY = '#6D2140';
const GOLD = '#A9784E';
const GOLD_LIGHT = '#D4B28A';
const BG = '#F7F4EE';
const SURFACE = '#FFFDF9';
const BORDER = '#E7D8C7';
const INK = '#241512';
const MUTED = '#8A7A68';
const SUCCESS = '#3F8A55';
const WARNING = '#B8863F';
const DANGER = '#C1666B';
const RADIUS = 16;
const SHADOW = '0 12px 28px -20px rgba(36,21,18,0.22)';

const display = { fontFamily: "'Lora', Georgia, 'Times New Roman', serif" };
const sans = { fontFamily: "'Inter', 'Segoe UI', sans-serif" };
const mono = { fontFamily: "'IBM Plex Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace" };
const chartStyle = { ...sans, fontSize: '0.72rem' };
const card = { background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: RADIUS, boxShadow: SHADOW };
const tooltipStyle = { ...sans, fontSize: '0.8rem', borderRadius: 10, border: `1px solid ${BORDER}`, background: SURFACE };

const fieldLabel = { ...sans, display: 'block', fontSize: '0.7rem', fontWeight: 600, color: MUTED, marginBottom: 6 };
const fieldStyle = { ...sans, width: '100%', minWidth: 0, height: 40, padding: '0 12px', border: `1px solid ${BORDER}`, borderRadius: 10, background: SURFACE, fontSize: '0.82rem', color: INK, cursor: 'pointer', outline: 'none' };

const getCurrentMonthValue = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const getMonthRange = (month) => {
  if (!month) return {};
  const [year, monthNumber] = month.split('-').map(Number);
  const lastDay = new Date(year, monthNumber, 0).getDate();
  return {
    date_from: `${month}-01`,
    date_to: `${month}-${String(lastDay).padStart(2, '0')}`,
  };
};

// ── KPI card ──
function StatCard({ label, value, sub, color, icon: Icon }) {
  return (
    <div className="flex h-full min-w-0 flex-col items-start gap-2.5 sm:flex-row sm:gap-3.5" style={{ ...card, padding: 'clamp(12px, 3vw, 18px)' }}>
      <span className="flex flex-shrink-0 items-center justify-center" style={{ width: 44, height: 44, borderRadius: 12, background: `${color}1a`, color }}>
        <Icon size={20} strokeWidth={1.8} />
      </span>
      <div className="min-w-0">
        <p style={{ ...display, fontSize: 'clamp(1.3rem, 4vw, 1.7rem)', fontWeight: 700, color: PRIMARY, lineHeight: 1 }}>{value}</p>
        <p style={{ ...sans, fontSize: '0.78rem', fontWeight: 600, color: INK, marginTop: 6 }}>{label}</p>
        {sub && <p className="hidden sm:block" style={{ ...sans, fontSize: '0.72rem', color: MUTED, marginTop: 2, lineHeight: 1.4 }}>{sub}</p>}
      </div>
    </div>
  );
}

// ── Chart card shell ──
function ChartCard({ icon: Icon, title, description, children, className = '' }) {
  return (
    <section className={`min-w-0 ${className}`} style={{ ...card, padding: 'clamp(14px, 3vw, 22px)' }}>
      <div className="flex items-start gap-3" style={{ marginBottom: 16 }}>
        <span className="inline-flex flex-shrink-0 items-center justify-center rounded-full" style={{ width: 34, height: 34, background: `${GOLD}18`, color: GOLD }}>
          <Icon size={16} strokeWidth={1.8} />
        </span>
        <div style={{ minWidth: 0 }}>
          <h3 style={{ ...display, fontSize: '1.05rem', fontWeight: 700, color: INK, lineHeight: 1.25 }}>{title}</h3>
          {description && <p style={{ ...sans, fontSize: '0.76rem', color: MUTED, marginTop: 2 }}>{description}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

const EmptyNote = ({ children }) => (
  <div className="flex items-center justify-center text-center" style={{ minHeight: 120, border: `1px dashed ${BORDER}`, borderRadius: 12 }}>
    <p style={{ ...sans, fontSize: '0.8rem', color: MUTED, padding: '0 12px' }}>{children}</p>
  </div>
);

const Skeleton = ({ height }) => (
  <div className="animate-pulse" style={{ ...card, height, background: '#EFE6D8' }} aria-hidden="true" />
);

const LegendRow = ({ color, name, count, pct, first }) => (
  <div className="flex items-center gap-2.5 py-2.5" style={{ borderTop: first ? 'none' : `1px solid ${BORDER}` }}>
    <span className="flex-shrink-0 rounded-full" style={{ width: 11, height: 11, background: color }} />
    <span className="flex-1" style={{ ...sans, fontSize: '0.8rem', color: INK }}>{name}</span>
    <span style={{ ...mono, fontSize: '0.74rem', color: MUTED, minWidth: 28, textAlign: 'right' }}>{count}</span>
    <span style={{ ...mono, fontSize: '0.76rem', fontWeight: 700, color, minWidth: 42, textAlign: 'right' }}>{pct}%</span>
  </div>
);

const OfficerAnalytics = () => {
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthValue);
  const [selectedYearLevel, setSelectedYearLevel] = useState('all');
  const [monthlySubs, setMonthlySubs] = useState([]);
  const [submissionRecords, setSubmissionRecords] = useState([]);
  const [complianceSummary, setComplianceSummary] = useState([]);
  const [knownLevels, setKnownLevels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const monthOptions = useMemo(() => {
    const now = new Date();
    const options = [];
    for (let offset = 0; offset < 12; offset += 1) {
      const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      options.push({
        value,
        label: date.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' }),
      });
    }
    if (selectedMonth && !options.some(option => option.value === selectedMonth)) {
      const date = new Date(`${selectedMonth}-01T12:00:00`);
      options.push({
        value: selectedMonth,
        label: date.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' }),
      });
    }
    return options;
  }, [selectedMonth]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const params = getMonthRange(selectedMonth);
        if (selectedYearLevel !== 'all') params.year_level = selectedYearLevel;
        const [summaryRes, monthlyRes, submissionRecordsRes] = await Promise.all([
          axios.get(`${API_BASE}/officer/reports/compliance-summary`, { ...authHeaders(), params }),
          axios.get(`${API_BASE}/officer/reports/monthly-submissions`, { ...authHeaders(), params }),
          axios.get(`${API_BASE}/officer/reports/submission-records`, {
            ...authHeaders(),
            params: { ...params, document_type: 'all' },
          }),
        ]);

        const summary = summaryRes.data || [];
        setComplianceSummary(summary);
        // Remember every level seen while "All" is selected, so the dropdown keeps all options
        if (selectedYearLevel === 'all') {
          setKnownLevels([...new Set(summary.map(item => item.year_level || 'Unknown').filter(Boolean))]);
        }
        setMonthlySubs(monthlyRes.data || []);
        setSubmissionRecords(Array.isArray(submissionRecordsRes.data?.records) ? submissionRecordsRes.data.records : []);
      } catch (err) {
        console.error('Error loading analytics data:', err);
        setError('Unable to load analytics data. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedMonth, selectedYearLevel]);

  const yearLevelOptions = useMemo(() => {
    const levels = new Set(knownLevels);
    if (selectedYearLevel !== 'all') levels.add(selectedYearLevel);
    return ['all', ...levels];
  }, [knownLevels, selectedYearLevel]);

  const visibleSummary = useMemo(() => (
    selectedYearLevel === 'all'
      ? complianceSummary
      : complianceSummary.filter(item => item.year_level === selectedYearLevel)
  ), [complianceSummary, selectedYearLevel]);
  const totalScholars = visibleSummary.length;
  const avgCompliance = totalScholars > 0
    ? Math.round(visibleSummary.reduce((sum, item) => sum + (item.completionRate || 0), 0) / totalScholars)
    : 0;
  const lettersReviewed = monthlySubs.filter(sub => sub.staffAction === 'approved').length;
  const atRiskScholars = visibleSummary.filter(item => item.completionRate < 50).length;

  const submissionStatusDistribution = useMemo(() => {
    const counts = { submitted: 0, pending: 0, notSubmitted: 0 };
    submissionRecords.forEach((record) => {
      const status = String(record.status || '').trim().toLowerCase().replace(/[\s_]+/g, '-');
      if (record.isMissing || status === 'not-submitted') counts.notSubmitted += 1;
      else if (status === 'pending') counts.pending += 1;
      else counts.submitted += 1;
    });
    const total = submissionRecords.length;

    return [
      { name: 'Submitted', count: counts.submitted, value: total ? Math.round((counts.submitted / total) * 100) : 0, color: SUCCESS },
      { name: 'Pending', count: counts.pending, value: total ? Math.round((counts.pending / total) * 100) : 0, color: WARNING },
      { name: 'Not Submitted', count: counts.notSubmitted, value: total ? Math.round((counts.notSubmitted / total) * 100) : 0, color: DANGER },
    ];
  }, [submissionRecords]);

  const submissionStatusTrend = useMemo(() => {
    const groups = {};
    monthlySubs.forEach((sub) => {
      const date = new Date(sub.submittedAt || sub.date);
      if (Number.isNaN(date.getTime())) return;
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!groups[key]) groups[key] = { month: key, approved: 0, pending: 0, rejected: 0 };
      const status = String(sub.review_status || 'pending').toLowerCase();
      if (status === 'approved') groups[key].approved += 1;
      else if (status === 'rejected') groups[key].rejected += 1;
      else groups[key].pending += 1;
    });

    return Object.values(groups)
      .sort((a, b) => a.month.localeCompare(b.month))
      .map((item) => ({
        ...item,
        month: new Date(`${item.month}-01T00:00:00`).toLocaleString('en-US', { month: 'short', year: '2-digit' }),
      }));
  }, [monthlySubs]);

  const yearLevelCompliance = useMemo(() => {
    const grouped = {};
    const source = selectedYearLevel === 'all'
      ? complianceSummary
      : complianceSummary.filter(item => item.year_level === selectedYearLevel);

    source.forEach((item) => {
      const level = item.year_level || 'Unknown';
      if (!grouped[level]) grouped[level] = { total: 0, sumCompliance: 0 };
      grouped[level].total += 1;
      grouped[level].sumCompliance += item.completionRate || 0;
    });

    return Object.entries(grouped).map(([level, stats]) => ({
      level,
      compliance: stats.total ? Math.round(stats.sumCompliance / stats.total) : 0,
      scholars: stats.total,
    }));
  }, [complianceSummary, selectedYearLevel]);

  const sentimentDist = useMemo(() => {
    const counts = { Positive: 0, Neutral: 0, Negative: 0 };
    monthlySubs.forEach((sub) => {
      const label = String(sub.sentimentLabel || 'Neutral').toLowerCase();
      if (label.includes('negative')) counts.Negative += 1;
      else if (label.includes('positive')) counts.Positive += 1;
      else counts.Neutral += 1;
    });
    const total = monthlySubs.length || 1;
    return [
      { name: 'Positive', value: counts.Positive, color: SUCCESS },
      { name: 'Neutral', value: counts.Neutral, color: WARNING },
      { name: 'Negative', value: counts.Negative, color: DANGER },
    ].map(item => ({ ...item, pct: Math.round((item.value / total) * 100) }));
  }, [monthlySubs]);

  const completenessData = useMemo(() => {
    const checksByLabel = new Map();

    monthlySubs.forEach((sub) => {
      (Array.isArray(sub.checklistResults) ? sub.checklistResults : []).forEach((check) => {
        if (!check?.label) return;
        const stats = checksByLabel.get(check.label) || { passed: 0, total: 0 };
        stats.total += 1;
        if (check.passed) stats.passed += 1;
        checksByLabel.set(check.label, stats);
      });
    });

    return [...checksByLabel.entries()].map(([category, stats]) => ({
      category,
      passed: stats.passed,
      total: stats.total,
      pct: stats.total ? Math.round((stats.passed / stats.total) * 100) : 0,
    }));
  }, [monthlySubs]);

  const monthlyTrend = useMemo(() => {
    const groups = {};
    monthlySubs.forEach((sub) => {
      const date = new Date(sub.submittedAt || sub.date);
      if (Number.isNaN(date.getTime())) return;
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!groups[key]) groups[key] = { month: key, submissions: 0, compliantCount: 0, sentimentPositive: 0, sentimentNeutral: 0, sentimentNegative: 0 };
      groups[key].submissions += 1;
      const qualityStatus = String(sub.status || '').toLowerCase();
      if (qualityStatus !== 'high-risk') groups[key].compliantCount += 1;
      const sentiment = String(sub.sentimentLabel || 'Neutral').toLowerCase();
      if (sentiment.includes('negative')) groups[key].sentimentNegative += 1;
      else if (sentiment.includes('positive')) groups[key].sentimentPositive += 1;
      else groups[key].sentimentNeutral += 1;
    });

    const sorted = Object.values(groups).sort((a, b) => a.month.localeCompare(b.month));
    return sorted.map((item) => {
      const date = new Date(`${item.month}-01`);
      return {
        month: date.toLocaleString('en-US', { month: 'short', year: 'numeric' }),
        submissions: item.submissions,
        compliance: item.submissions ? Math.round((item.compliantCount / item.submissions) * 100) : 0,
        sentimentPos: item.submissions ? Math.round((item.sentimentPositive / item.submissions) * 100) : 0,
        sentimentNeg: item.submissions ? Math.round((item.sentimentNegative / item.submissions) * 100) : 0,
        sentimentNeutral: item.submissions ? Math.round((item.sentimentNeutral / item.submissions) * 100) : 0,
      };
    });
  }, [monthlySubs]);

  const topIssues = useMemo(() => {
    const issueLabels = {
      'Minimum length (150+ words)': 'Below minimum length',
      'At least 1 photo': 'Missing photo',
      'All photos have descriptions': 'Missing photo descriptions',
    };
    const counts = new Map();

    monthlySubs.forEach((sub) => {
      const checks = Array.isArray(sub.checklistResults) ? sub.checklistResults : [];
      checks.forEach((check) => {
        if (check?.passed || !check?.label) return;
        const issue = issueLabels[check.label] || check.label;
        counts.set(issue, (counts.get(issue) || 0) + 1);
      });
      if (String(sub.status || '').toLowerCase() === 'high-risk') {
        counts.set('High-risk letters', (counts.get('High-risk letters') || 0) + 1);
      }
    });

    const total = monthlySubs.length;
    return [...counts.entries()]
      .filter(([, count]) => count > 0)
      .map(([issue, count]) => ({ issue, count, pct: total ? Math.round((count / total) * 100) : 0 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [monthlySubs]);

  const exportCSV = () => {
    const rows = [['Month', 'Submissions', 'Compliance%', 'Positive%', 'Negative%', 'Neutral%']];
    monthlyTrend.forEach(d => rows.push([d.month, String(d.submissions), String(d.compliance), String(d.sentimentPos), String(d.sentimentNeg), String(d.sentimentNeutral)]));
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'officer_analytics.csv'; a.click();
    URL.revokeObjectURL(url);
    axios.post(`${API_BASE}/export/google-sheets`, { log_only: true, module: 'Officer Analytics', report_resource: 'Analytics', spreadsheet_title: 'Officer Analytics Export', details: 'officer_analytics.csv' }, authHeaders()).catch(() => {});
  };

  const filtersActive = selectedMonth !== getCurrentMonthValue() || selectedYearLevel !== 'all';
  const resetFilters = () => { setSelectedMonth(getCurrentMonthValue()); setSelectedYearLevel('all'); };

  const yearChartMinWidth = Math.max(480, yearLevelCompliance.length * 72);
  const hasBody = !loading && !error;

  return (
    <div className="oa-page" style={{ background: BG, ...sans }}>
      <style>{`
        .oa-page { width: 100%; min-height: 100vh; overflow-x: hidden; box-sizing: border-box; padding: 16px 16px 48px; }
        @media (min-width: 640px) { .oa-page { padding: 24px 24px 48px; } }
        @media (min-width: 1024px) { .oa-page { padding: 32px 32px 48px; } }

        .oa-btn:focus-visible { outline: 2px solid ${GOLD}; outline-offset: 2px; }
        .oa-field:focus { border-color: ${PRIMARY} !important; box-shadow: 0 0 0 3px rgba(109,33,64,.10); }
        .oa-ghost:hover { background: ${BG}; }
        .oa-scroll::-webkit-scrollbar { height: 6px; }
        .oa-scroll::-webkit-scrollbar-thumb { background: rgba(109,33,64,.18); border-radius: 999px; }

        .oa-chart-sm { height: 220px; }
        .oa-chart-md { height: 240px; }
        .oa-chart-lg { height: 260px; }
        @media (min-width: 640px) {
          .oa-chart-sm { height: 220px; }
          .oa-chart-md { height: 260px; }
          .oa-chart-lg { height: 300px; }
        }

        @media (max-width: 639px) {
          /* 16px prevents iOS Safari from zooming in when a field is focused */
          .oa-field { font-size: 16px !important; height: 44px !important; }
          .oa-btn { min-height: 44px !important; }
        }
        @media (prefers-reduced-motion: reduce) { .oa-page * { transition: none !important; } }
      `}</style>

      <div className="flex flex-col gap-5" style={{ minWidth: 0 }}>

        {/* ── Page header — same layout as the other Officer pages ── */}
        <header
          className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"
          style={{ ...card, padding: 'clamp(14px, 3vw, 20px)' }}
        >
          <div className="min-w-0">
            <p style={{ ...sans, fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: GOLD }}>Officer Portal</p>
            <h1 style={{ ...display, fontSize: 'clamp(1.6rem, 4vw, 2rem)', fontWeight: 700, color: PRIMARY, lineHeight: 1.15, marginTop: 3 }}>Analytics</h1>
            <p style={{ ...sans, fontSize: '0.9rem', color: MUTED, marginTop: 6, lineHeight: 1.55 }}>
              Track submission trends, compliance rates, and scholar performance.
            </p>
          </div>
        </header>

        {/* ── KPI cards ── */}
        <div className="grid grid-cols-2 gap-2.5 sm:gap-4 xl:grid-cols-4">
          <StatCard label="Total Scholars" value={loading ? '—' : totalScholars}
            sub={selectedYearLevel === 'all' ? 'Across all year levels' : formatYearLevelLabel(selectedYearLevel)} color={PRIMARY} icon={Users} />
          <StatCard label="Average Compliance" value={loading ? '—' : `${avgCompliance}%`}
            sub="Overall completion rate" color={SUCCESS} icon={ShieldCheck} />
          <StatCard label="Letters Reviewed" value={loading ? '—' : lettersReviewed}
            sub="Approved by officers" color={GOLD} icon={FileText} />
          <StatCard label="At-Risk Scholars" value={loading ? '—' : atRiskScholars}
            sub="Below 50% compliance" color={DANGER} icon={AlertTriangle} />
        </div>

        {/* ── Filters ── */}
        <section aria-label="Analytics filters" style={{ ...card, padding: 'clamp(14px, 3vw, 20px)' }}>
          <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="flex items-center justify-center rounded-full" style={{ width: 30, height: 30, background: `${GOLD}18`, color: GOLD }}><SlidersHorizontal size={14} /></span>
              <h2 style={{ ...display, fontSize: '1.05rem', fontWeight: 700, color: INK }}>Filters</h2>
            </div>
            <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
              {filtersActive && (
                <button type="button" onClick={resetFilters} className="oa-btn oa-ghost inline-flex items-center gap-1.5"
                  style={{ ...sans, minHeight: 36, padding: '0 12px', borderRadius: 10, border: `1px solid ${BORDER}`, background: '#fff', color: PRIMARY, fontSize: '0.76rem', fontWeight: 700, cursor: 'pointer' }}>
                  <FilterX size={13} /> Reset
                </button>
              )}
              <button type="button" onClick={exportCSV} className="oa-btn inline-flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
                style={{ ...sans, minHeight: 36, padding: '0 14px', borderRadius: 10, border: 'none', background: PRIMARY, color: '#fff', fontSize: '0.78rem', fontWeight: 700, whiteSpace: 'nowrap', cursor: 'pointer' }}>
                <Download size={14} /> Export CSV
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="min-w-0">
              <label htmlFor="oa-month" style={fieldLabel}>Month</label>
              <select id="oa-month" className="oa-field" value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} style={fieldStyle}>
                <option value="">All periods</option>
                {monthOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
            <div className="min-w-0">
              <label htmlFor="oa-year" style={fieldLabel}>Year level</label>
              <select id="oa-year" className="oa-field" value={selectedYearLevel} onChange={(e) => setSelectedYearLevel(e.target.value)} style={fieldStyle}>
                {yearLevelOptions.map(level => (
                  <option key={level} value={level}>{level === 'all' ? 'All Year Levels' : formatYearLevelLabel(level)}</option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* ── Error ── */}
        {error && (
          <div role="alert" className="flex items-start gap-2" style={{ borderRadius: 12, borderLeft: `3px solid ${DANGER}`, background: `${DANGER}0d`, padding: '12px 16px', ...sans, fontSize: '0.82rem', fontWeight: 600, color: DANGER }}>
            <AlertTriangle size={15} className="mt-0.5 flex-shrink-0" /> {error}
          </div>
        )}

        {/* ── Loading skeletons ── */}
        {loading && (
          <>
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2"><Skeleton height={300} /><Skeleton height={300} /></div>
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3"><Skeleton height={230} /><Skeleton height={230} /><Skeleton height={230} /></div>
            <Skeleton height={300} />
          </>
        )}

        {hasBody && (
          <>
            {/* ── Row 1: trend + sentiment ── */}
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <ChartCard icon={TrendingUp} title="Monthly Submission Trends" description="Approved, pending, and rejected letters by month.">
                {submissionStatusTrend.length === 0 ? <EmptyNote>No submissions in this period.</EmptyNote> : (
                  <div className="oa-chart-md" style={{ width: '100%', minWidth: 0 }}>
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 600, height: 240 }}>
                      <LineChart data={submissionStatusTrend} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={BORDER} />
                        <XAxis dataKey="month" stroke={MUTED} style={chartStyle} />
                        <YAxis stroke={MUTED} style={chartStyle} allowDecimals={false} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Legend wrapperStyle={{ ...sans, fontSize: '0.75rem' }} />
                        <Line type="monotone" dataKey="approved" stroke={SUCCESS} strokeWidth={2} name="Approved" dot={{ r: 3 }} />
                        <Line type="monotone" dataKey="pending" stroke={WARNING} strokeWidth={2} name="Pending" dot={{ r: 3 }} />
                        <Line type="monotone" dataKey="rejected" stroke={DANGER} strokeWidth={2} name="Rejected" dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </ChartCard>

              <ChartCard icon={PieChartIcon} title="Sentiment Distribution" description="Sentiment analysis of submitted letters.">
                {monthlySubs.length === 0 ? <EmptyNote>No letters in this period.</EmptyNote> : (
                  <div className="flex flex-col items-center gap-4 sm:flex-row">
                    <div className="oa-chart-sm relative w-full sm:w-3/5" style={{ minWidth: 0 }}>
                      <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 300, height: 220 }}>
                        <PieChart>
                          <Pie data={sentimentDist} cx="50%" cy="50%" innerRadius={52} outerRadius={84} dataKey="pct" label={({ value }) => `${value}%`} labelLine={false}>
                            {sentimentDist.map((e, i) => <Cell key={i} fill={e.color} />)}
                          </Pie>
                          <Tooltip contentStyle={tooltipStyle} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                        <span style={{ ...display, fontSize: '1.4rem', fontWeight: 700, color: PRIMARY, lineHeight: 1 }}>{monthlySubs.length}</span>
                        <span style={{ ...sans, fontSize: '0.7rem', color: MUTED }}>Letters</span>
                      </div>
                    </div>
                    <div className="w-full flex-1">
                      {sentimentDist.map((item, i) => (
                        <LegendRow key={item.name} first={i === 0} color={item.color} name={item.name} count={item.value} pct={item.pct} />
                      ))}
                    </div>
                  </div>
                )}
              </ChartCard>
            </div>

            {/* ── Row 2: status distribution + completeness + issues ── */}
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3">
              <ChartCard icon={PieChartIcon} title="Submission Status" description="Share of due submissions by review status.">
                {submissionRecords.length === 0 ? <EmptyNote>No due submission records in this period.</EmptyNote> : (
                  <div className="flex flex-col items-center gap-4">
                    <div className="oa-chart-sm w-full" style={{ minWidth: 0 }}>
                      <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 300, height: 220 }}>
                        <PieChart>
                          <Pie data={submissionStatusDistribution} cx="50%" cy="50%" innerRadius={52} outerRadius={84} dataKey="value">
                            {submissionStatusDistribution.map((item) => <Cell key={item.name} fill={item.color} />)}
                          </Pie>
                          <Tooltip contentStyle={tooltipStyle} formatter={(value, name) => [`${value}%`, name]} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="w-full">
                      {submissionStatusDistribution.map((item, index) => (
                        <LegendRow key={item.name} first={index === 0} color={item.color} name={item.name} count={item.count} pct={item.value} />
                      ))}
                    </div>
                  </div>
                )}
              </ChartCard>

              <ChartCard icon={FileText} title="Letter Completeness" description="Share of letters that meet each completeness check.">
                {completenessData.length === 0 ? <EmptyNote>No checklist data in this period.</EmptyNote> : <div className="space-y-4">
                  {completenessData.map((item) => {
                    const color = item.pct >= 85 ? SUCCESS : item.pct >= 70 ? WARNING : DANGER;
                    return (
                      <div key={item.category}>
                        <div className="flex justify-between gap-3" style={{ ...sans, fontSize: '0.78rem', color: INK, marginBottom: 6 }}>
                          <span>{item.category}</span>
                          <span style={{ ...mono, fontSize: '0.72rem', fontWeight: 700, whiteSpace: 'nowrap' }}>{item.passed}/{item.total} · {item.pct}%</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: BORDER }}>
                          <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(0, Math.min(100, item.pct))}%`, backgroundColor: color }} />
                        </div>
                      </div>
                    );
                  })}
                </div>}
              </ChartCard>

              <ChartCard className="lg:col-span-2 xl:col-span-1" icon={AlertTriangle} title="Top Compliance Issues" description="Most common missing or incomplete components.">
                {topIssues.length === 0 ? <EmptyNote>No compliance issues found in this period.</EmptyNote> : <div>
                  {topIssues.map((item, i) => (
                    <div key={item.issue} className="grid grid-cols-[22px_minmax(0,1fr)_auto] items-center gap-3 py-2.5 sm:grid-cols-[22px_minmax(0,1fr)_6rem_auto]" style={{ borderTop: i > 0 ? `1px solid ${BORDER}` : 'none' }}>
                      <span className="flex flex-shrink-0 items-center justify-center rounded-full" style={{ width: 22, height: 22, background: PRIMARY, color: '#fff', ...sans, fontSize: '0.64rem', fontWeight: 800 }}>{i + 1}</span>
                      <span className="min-w-0" style={{ ...sans, fontSize: '0.82rem', color: INK, overflowWrap: 'anywhere' }}>{item.issue}</span>
                      <div className="hidden overflow-hidden rounded-full sm:block" style={{ height: 6, background: BORDER }}>
                        <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, item.pct))}%`, background: i === 0 ? PRIMARY : i < 3 ? GOLD : GOLD_LIGHT }} />
                      </div>
                      <div className="flex items-center justify-end whitespace-nowrap">
                        <span style={{ ...display, fontSize: '0.95rem', fontWeight: 700, color: PRIMARY }}>{item.count}</span>
                        <span style={{ ...mono, fontSize: '0.7rem', color: MUTED, marginLeft: 4 }}>({item.pct}%)</span>
                      </div>
                    </div>
                  ))}
                </div>}
              </ChartCard>
            </div>

            {/* ── Row 3: full-width year-level chart ── */}
            <ChartCard icon={BarChart3} title="Compliance Rate by Year Level" description="Average completion rate per year level.">
              {yearLevelCompliance.length === 0 ? <EmptyNote>No year-level data available.</EmptyNote> : (
                <div className="oa-scroll overflow-x-auto">
                  <div className="oa-chart-lg" style={{ minWidth: yearChartMinWidth }}>
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 600, height: 260 }}>
                      <AreaChart data={yearLevelCompliance} margin={{ top: 8, right: 16, left: -8, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={BORDER} />
                        <XAxis dataKey="level" stroke={MUTED} style={chartStyle} interval={0} tickMargin={6} tickFormatter={(v) => formatYearLevelLabel(v)} />
                        <YAxis domain={[0, 100]} stroke={MUTED} style={chartStyle} />
                        <Tooltip contentStyle={tooltipStyle} labelFormatter={(v) => formatYearLevelLabel(v)} />
                        <Area type="monotone" dataKey="compliance" stroke={PRIMARY} fill={`${PRIMARY}1f`} strokeWidth={2} name="Compliance %" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </ChartCard>
          </>
        )}
      </div>
    </div>
  );
};

export default OfficerAnalytics;