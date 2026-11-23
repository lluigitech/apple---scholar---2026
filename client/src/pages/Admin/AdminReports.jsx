import { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import MonthlyReportsTab from '../../components/Admin/Reports/MonthlyReportsTab';
import AttendanceReportsTab from '../../components/Admin/Reports/AttendanceReportsTab';
import AdminReportDetail from '../../components/Admin/Reports/AdminReportDetail';
import { formatYearLevelLabel } from '../../utils/yearLevelLabels';
import { formatAdminDateTime, formatAdminMonth } from '../../utils/adminPreferences';
import { monthPeriodLabel, downloadReportSummaryPdf } from '../../utils/reportPdfExport';
import AdminPageHeader from '../../components/Admin/AdminPageHeader';

// ── Design tokens — "Apple Scholar Executive" system ──
const BG = '#F7F4EE';
const SURFACE = '#FFFDF9';
const BORDER = '#E5D8CA';
const PRIMARY = '#6D2140';
const INK = '#241512';
const MUTED = '#8A7A68';
const SUCCESS = '#6B8F71';
const WARNING = '#C08A3E';
const DANGER = '#A24A4A';
const RADIUS = 16;

const display = { fontFamily: "'Playfair Display', Georgia, 'Times New Roman', serif" };
const body = { fontFamily: "'Inter', 'Segoe UI', sans-serif" };

const surfaceCard = {
  background: SURFACE,
  border: `1px solid ${BORDER}`,
  borderRadius: RADIUS,
  boxShadow: '0 1px 2px rgba(36,21,18,0.04)',
};

const normalizeReportStatus = (status) => status === 'approved' ? 'accepted' : status;

// eslint-disable-next-line no-unused-vars
const dateFieldStyle = {
  ...body,
  fontSize: '0.88rem',
  color: INK,
  background: BG,
  border: `1px solid ${BORDER}`,
  borderRadius: 10,
  outline: 'none',
  padding: '10px 12px',
  width: '100%',
};

const API_BASE = (import.meta.env?.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
const API = API_BASE.endsWith('/api') ? API_BASE : `${API_BASE}/api`;
const authHeaders = () => ({
  headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
});

const downloadCSV = (filename, rows) => {
  const csv = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

// ── Icons (inline, stroke-based) ──
const svgBase = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', viewBox: '0 0 24 24' };
const Icon = {
  Users: (p) => (
    <svg width="18" height="18" {...svgBase} {...p}>
      <circle cx="9" cy="8" r="3.2" /><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" />
      <path d="M16.5 4.3c1.6.4 2.8 1.9 2.8 3.6 0 1.7-1.2 3.2-2.8 3.6M21.5 20c0-3-2-5.3-4.8-5.9" />
    </svg>
  ),
  Check: (p) => (<svg width="18" height="18" {...svgBase} {...p}><circle cx="12" cy="12" r="9" /><path d="M8 12.5l3 3 5-6" /></svg>),
  Clock: (p) => (<svg width="18" height="18" {...svgBase} {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>),
  Alert: (p) => (<svg width="18" height="18" {...svgBase} {...p}><path d="M12 3l10 18H2L12 3z" /><path d="M12 10v5M12 18h.01" /></svg>),
  Chevron: (p) => (<svg width="16" height="16" {...svgBase} strokeWidth="2" {...p}><path d="M9 5l7 7-7 7" /></svg>),
  FileText: (p) => (
    <svg width="18" height="18" {...svgBase} {...p}>
      <path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8l-5-5z" /><path d="M14 3v5h5M9 13h6M9 17h6M9 9h2" />
    </svg>
  ),
  Crest: (p) => (
    <svg width="34" height="34" viewBox="0 0 34 34" fill="none" {...p}>
      <path d="M17 2l12 5v9c0 8-6 13.5-12 16-6-2.5-12-8-12-16V7l12-5z" stroke="currentColor" strokeWidth="1.4" />
      <path d="M17 9l3.5 7H13.5L17 9z" fill="currentColor" opacity="0.85" />
    </svg>
  ),
};

const tabItems = [
  { key: 'monthly-reports', label: 'Compliance Reports', sub: 'All requirements and document submissions', icon: Icon.FileText },
  { key: 'attendance', label: 'Attendance Reports', sub: 'Attendance and participation records', icon: Icon.Users },
];

// ---------------------------------------------------------------------------
// Presentational pieces (UI-only — no data logic lives here)
// ---------------------------------------------------------------------------

const YEAR_LEVEL_OPTIONS = ['1st Year College', '2nd Year College', '3rd Year College', '4th Year College'];

const numeric = { ...display, fontVariantNumeric: 'lining-nums tabular-nums', fontFeatureSettings: '"lnum" 1, "tnum" 1' };

const controlStyle = {
  ...body, padding: '0 12px', fontWeight: 500,
  background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 10,
  color: INK, outline: 'none', cursor: 'pointer', maxWidth: '100%', minWidth: 0,
};
const controlClass = 'h-10 sm:h-9 flex-1 sm:flex-none sm:min-w-[150px] text-base sm:text-[0.8rem]';

const KpiStrip = ({ children }) => (
  <div
    className="grid grid-cols-2 xl:grid-cols-4 gap-px overflow-hidden"
    style={{ background: BORDER, border: `1px solid ${BORDER}`, borderRadius: RADIUS, boxShadow: surfaceCard.boxShadow }}
  >
    {children}
  </div>
);

const KpiCell = ({ icon: IconEl, label, value, helper, accent }) => (
  <div className="min-w-0 p-4 sm:p-5" style={{ background: SURFACE }}>
    <div className="flex items-center gap-2" style={{ ...body, fontSize: '0.84rem', fontWeight: 500, color: MUTED }}>
      <IconEl width={16} height={16} style={{ color: accent, flexShrink: 0 }} />
      <span className="truncate">{label}</span>
    </div>
    <div style={{ ...numeric, fontSize: 'clamp(1.8rem, 3vw, 2.3rem)', fontWeight: 600, color: INK, lineHeight: 1.1, marginTop: 10 }}>
      {value}
    </div>
    {helper && (
      <div className="flex items-start gap-1.5" style={{ ...body, fontSize: '0.8rem', lineHeight: 1.35, color: MUTED, marginTop: 6 }}>
        {helper.dot && <span className="flex-shrink-0 rounded-full" style={{ width: 7, height: 7, background: accent, marginTop: 5 }} />}
        <span className="min-w-0 break-words">{helper.text}</span>
      </div>
    )}
  </div>
);

const KpiSkeleton = () => (
  <KpiStrip>
    {[0, 1, 2, 3].map((i) => (
      <div key={i} className="p-4 sm:p-5" style={{ background: SURFACE }}>
        <div className="animate-pulse" style={{ height: 11, width: 96, borderRadius: 8, background: '#EFE3D4' }} />
        <div className="animate-pulse" style={{ height: 30, width: 64, borderRadius: 8, background: '#EFE3D4', marginTop: 14 }} />
        <div className="animate-pulse" style={{ height: 10, width: 120, borderRadius: 8, background: '#EFE3D4', marginTop: 12 }} />
      </div>
    ))}
  </KpiStrip>
);

const ModuleTabs = ({ activeTab, onSelect }) => (
  <div role="tablist" aria-label="Report type" className="flex w-full sm:w-auto">
    {tabItems.map((tab) => {
      const active = tab.key === activeTab;
      const TabIcon = tab.icon;
      return (
        <button
          key={tab.key}
          type="button"
          role="tab"
          aria-selected={active}
          title={tab.sub}
          onClick={() => onSelect(tab.key)}
          className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 whitespace-nowrap px-3 sm:px-4"
          style={{
            ...body, height: 46, fontSize: '0.92rem', fontWeight: active ? 700 : 500,
            color: active ? PRIMARY : MUTED, background: 'none', border: 'none', cursor: 'pointer',
            borderBottom: `3px solid ${active ? PRIMARY : 'transparent'}`, marginBottom: -1,
            transition: 'color 0.15s ease, border-color 0.15s ease',
          }}
        >
          <TabIcon width={17} height={17} />
          <span className="sm:hidden">{tab.label.replace(' Reports', '')}</span>
          <span className="hidden sm:inline">{tab.label}</span>
        </button>
      );
    })}
  </div>
);

export default function AdminReports() {
  const [activeTab, setActiveTab] = useState('monthly-reports');

  const [complianceRows, setComplianceRows] = useState([]);
  const [complianceLoading, setComplianceLoading] = useState(false);
  const [complianceError, setComplianceError] = useState('');
  const [complianceFetched, setComplianceFetched] = useState(false);

  const [statusFilter, setStatusFilter] = useState('all');
  const [reports, setReports] = useState([]);
  const [archivedSubmissions, setArchivedSubmissions] = useState([]);
  const [monthlyLoading, setMonthlyLoading] = useState(false);
  const [monthlyError, setMonthlyError] = useState('');
  const [selectedReport, setSelectedReport] = useState(null);
  const [monthlyFilterMonth, setMonthlyFilterMonth] = useState(new Date().toISOString().slice(0, 7));
  const [monthlyFilterYearLevel, setMonthlyFilterYearLevel] = useState('');
  const monthlyPeriodOptions = useMemo(() => {
    const options = [];
    const now = new Date();
    for (let offset = 0; offset < 12; offset += 1) {
      const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      options.push({ value, label: formatAdminMonth(date) });
    }
    if (monthlyFilterMonth && !options.some(option => option.value === monthlyFilterMonth)) {
      options.push({
        value: monthlyFilterMonth,
        label: formatAdminMonth(new Date(`${monthlyFilterMonth}-01T00:00:00`)),
      });
    }
    return options;
  }, [monthlyFilterMonth]);

  const [attendanceData, setAttendanceData] = useState([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceError, setAttendanceError] = useState('');
  const [attendanceFetched, setAttendanceFetched] = useState(false);
  const [attendanceYearLevel, setAttendanceYearLevel] = useState('all');
  const [attendanceFilters, setAttendanceFilters] = useState({
    month: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
    status: 'all',
  });
  const attendanceHasYearLevel = useMemo(
    () => attendanceData.some(record => record.year_level || record.yearLevel || record.year),
    [attendanceData]
  );

  const fetchCompliance = async () => {
    setComplianceLoading(true);
    setComplianceError('');
    try {
      const res = await axios.get(`${API}/admin/reports/compliance-summary`, authHeaders());
      setComplianceRows(res.data || []);
      setComplianceFetched(true);
    } catch (err) {
      console.error(err);
      setComplianceError(
        err.response?.status === 404
          ? 'Missing backend route: /admin/reports/compliance-summary'
          : 'Failed to load compliance summary. Check your connection or login session.'
      );
    } finally {
      setComplianceLoading(false);
    }
  };

  const fetchMonthlyReports = useCallback(async () => {
    setMonthlyLoading(true);
    setMonthlyError('');
    try {
      const params = {};
      if (monthlyFilterMonth) params.month = monthlyFilterMonth;
      if (monthlyFilterYearLevel) params.year_level = monthlyFilterYearLevel;
      params.include_archived_status = '1';

      const res = await axios.get(`${API}/admin/reports/monthly-submissions`, {
        ...authHeaders(),
        params,
      });
      if (!Array.isArray(res.data?.submissions) || !Array.isArray(res.data?.archivedSubmissions)) {
        throw new Error('Monthly submission response did not include submission records and archived status.');
      }
      setReports(res.data.submissions);
      setArchivedSubmissions(res.data.archivedSubmissions);
    } catch (err) {
      console.error(err);
      setMonthlyError(
        err.response?.status === 404
          ? 'Missing backend route: /admin/reports/monthly-submissions'
          : 'Failed to load compliance reports. Check your connection or login session.'
      );
    } finally {
      setMonthlyLoading(false);
    }
  }, [monthlyFilterMonth, monthlyFilterYearLevel]);

  const fetchAttendanceReports = async () => {
    setAttendanceLoading(true);
    setAttendanceError('');
    try {
      const params = {};
      if (attendanceFilters.month) params.month = attendanceFilters.month;
      if (attendanceFilters.status !== 'all') params.status = attendanceFilters.status;

      const res = await axios.get(`${API}/staff/reports/duty-attendance`, {
        ...authHeaders(),
        params,
      });
      setAttendanceData(res.data || []);
      setAttendanceFetched(true);
    } catch (err) {
      console.error(err);
      setAttendanceError(
        err.response?.status === 404
          ? 'Missing backend route: /staff/reports/duty-attendance'
          : 'Failed to load attendance records. Check your connection or login session.'
      );
    } finally {
      setAttendanceLoading(false);
    }
  };

  const exportAttendanceCSV = (data) => {
    const rows = [['Scholar', 'Scholar ID', 'Group', 'Assigned Staff', 'Duty', 'Date', 'Location', 'Status', 'Method', 'Marked At']];
    data.forEach(a =>
      rows.push([
        a.scholar || '—',
        a.scholar_id || '—',
        a.group_name || 'Unassigned',
        a.assigned_staff || 'Unassigned',
        a.duty || '—',
        a.date || a.marked_at?.split('T')[0] || '—',
        a.location || '—',
        a.status || '—',
        a.method || '—',
        a.marked_at ? formatAdminDateTime(a.marked_at) : '—',
      ])
    );
    downloadCSV(`duty_attendance_${new Date().toISOString().slice(0, 10)}.csv`, rows);

    axios.post(
      `${API}/export`,
      {
        log_only: true,
        module: 'Attendance Report',
        report_resource: 'Staff Attendance',
        spreadsheet_title: 'Staff Attendance Export',
        details: `Exported ${data.length} attendance records`,
      },
      authHeaders()
    ).catch(err => console.warn('Audit log failed:', err));
  };

  const exportAdminPdf = async (displayedRows) => {
    try {
      const rows = (displayedRows || attendanceData).map(row => ({
        scholarName: row.scholar,
        studentId: row.scholar_id,
        groupName: row.group_name,
        assignedStaff: row.assigned_staff,
        duty: row.duty,
        attendanceDate: row.date || row.duty_date,
        attendanceTime: row.marked_at,
        attendanceStatus: row.status,
      }));
      await downloadReportSummaryPdf({
        role: 'admin',
        reportTitle: 'Attendance Reports',
        reportType: 'Attendance Reports',
        periodLabel: monthPeriodLabel(attendanceFilters.month),
        rows,
      });
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Failed to generate the PDF report.');
    }
  };

  useEffect(() => {
    if (activeTab === 'monthly-reports' && !complianceFetched) fetchCompliance();
  }, [activeTab, complianceFetched]);

  useEffect(() => {
    if (activeTab === 'monthly-reports') fetchMonthlyReports();
  }, [activeTab, fetchMonthlyReports]);

  useEffect(() => {
    if (activeTab === 'attendance' && !attendanceFetched) fetchAttendanceReports();
  }, [activeTab, attendanceFetched]);

  useEffect(() => {
    const applyRefreshedReports = (event) => {
      const refreshed = event.detail || {};
      if (Array.isArray(refreshed.compliance)) {
        setComplianceRows(refreshed.compliance);
        setComplianceFetched(true);
        setComplianceError('');
      }
      if (Array.isArray(refreshed.submissions)) {
        fetchMonthlyReports();
      }
    };
    window.addEventListener('admin-refresh-reports', applyRefreshedReports);
    return () => window.removeEventListener('admin-refresh-reports', applyRefreshedReports);
  }, [fetchMonthlyReports]);

  const filteredMonthly = useMemo(() => {
    if (statusFilter === 'submitted') return reports;
    const reportsForStatus = statusFilter === 'not-submitted' ? [] : reports;
    if (!complianceFetched || !monthlyFilterMonth || monthlyLoading || monthlyError) return reportsForStatus;

    const hasYearLevel = complianceRows.some(row => row.year || row.yearLevel || row.year_level);
    const registry = monthlyFilterYearLevel
      ? hasYearLevel
        ? complianceRows.filter(
          row => formatYearLevelLabel(row.year || row.yearLevel || row.year_level) === formatYearLevelLabel(monthlyFilterYearLevel)
        )
        : []
      : complianceRows;
    const submittedIdentifiers = new Set(
      [...reports, ...archivedSubmissions].flatMap(report => [
        report.userId,
        report.user_id,
        report.scholar_id,
        report.studentId,
        report.student_id,
        report.scholarName,
      ]).map(value => String(value || '').trim().toLowerCase()).filter(Boolean)
    );

    const notSubmitted = registry
      .filter(scholar => {
        const identifiers = [
          scholar.id,
          scholar.userId,
          scholar.user_id,
          scholar.studentId,
          scholar.scholar_id,
          scholar.name,
          scholar.scholarName,
          scholar.full_name,
        ].map(value => String(value || '').trim().toLowerCase()).filter(Boolean);
        return !identifiers.some(identifier => submittedIdentifiers.has(identifier));
      })
      .map((scholar, index) => ({
        id: `not-submitted-${scholar.id || scholar.studentId || index}`,
        userId: scholar.id,
        scholar_id: scholar.studentId || scholar.scholar_id,
        scholarName: scholar.name || scholar.scholarName || scholar.full_name || 'Unknown Scholar',
        studentId: scholar.studentId || scholar.scholar_id,
        year: scholar.year || scholar.yearLevel || scholar.year_level,
        periodLabel: monthPeriodLabel(monthlyFilterMonth),
        status: 'not-submitted',
        isMissing: true,
      }));
    return statusFilter === 'not-submitted' ? notSubmitted : [...reports, ...notSubmitted];
  }, [statusFilter, reports, archivedSubmissions, complianceRows, complianceFetched, monthlyFilterMonth, monthlyFilterYearLevel, monthlyLoading, monthlyError]);

  const monthlyCounts = useMemo(() => {
    const counts = { all: reports.length, accepted: 0, 'medium-risk': 0, 'high-risk': 0 };
    reports.forEach(report => {
      const status = normalizeReportStatus(report.status);
      if (status && counts[status] !== undefined) counts[status] += 1;
    });
    return counts;
  }, [reports]);

  // ---- Presentation-only derived values ----

  const anyLoading = complianceLoading || monthlyLoading || attendanceLoading;
  const pct = (n, total) => (total > 0 ? `${Math.round((n / total) * 100)}% of total` : '0% of total');

  const kpis = useMemo(() => {
    if (activeTab === 'monthly-reports') {
      const total = reports.length;

      // Include archived records when determining historical submission status.
      const submittedKeys = new Set(
        [...reports, ...archivedSubmissions]
          .map(r => r.userId || r.user_id || r.scholar_id || r.studentId || r.scholarName)
          .filter(Boolean)
      );

      // Registry = every scholar from the compliance summary, narrowed by year level when the rows carry one.
      let registry = complianceRows;
      let registryKnown = complianceFetched;
      if (monthlyFilterYearLevel) {
        const hasYear = complianceRows.some(row => row.year || row.yearLevel || row.year_level);
        if (hasYear) {
          registry = complianceRows.filter(
            row => formatYearLevelLabel(row.year || row.yearLevel || row.year_level) === formatYearLevelLabel(monthlyFilterYearLevel)
          );
        } else {
          registryKnown = false;
        }
      }

      // Submission metrics only make sense for one specific month.
      const canCompute = registryKnown && Boolean(monthlyFilterMonth);
      const notSubmitted = canCompute ? Math.max(0, registry.length - submittedKeys.size) : null;
      const rate = canCompute && registry.length > 0
        ? Math.min(100, Math.round((submittedKeys.size / registry.length) * 100))
        : null;
      const hint = !monthlyFilterMonth ? 'Select a month' : 'Loading scholar list…';

      return [
        { key: 'total', icon: Icon.FileText, label: 'Total Submissions', value: total, helper: { text: 'Across all requirements' }, accent: PRIMARY },
        { key: 'submitted', icon: Icon.Check, label: 'Submitted', value: canCompute ? submittedKeys.size : '—', helper: { text: canCompute ? 'Scholars with submissions' : hint, dot: canCompute }, accent: SUCCESS },
        {
          key: 'not-submitted', icon: Icon.Alert, label: 'Not Submitted',
          value: notSubmitted ?? '—',
          helper: { text: canCompute ? 'Scholars with no submission' : hint, dot: canCompute },
          accent: DANGER,
        },
        {
          key: 'rate', icon: Icon.Users, label: 'Submission Rate',
          value: rate === null ? '—' : `${rate}%`,
          helper: { text: canCompute ? `${submittedKeys.size} of ${registry.length} scholars` : hint },
          accent: WARNING,
        },
      ];
    }

    const attendanceCounts = attendanceData.reduce((counts, record) => {
      const rawStatus = record.status || 'absent';
      const status = rawStatus === 'excused' ? 'absent' : rawStatus;
      counts[status] = (counts[status] || 0) + 1;
      return counts;
    }, { present: 0, late: 0, absent: 0 });
    const total = attendanceData.length;
    return [
      { key: 'records', icon: Icon.Users, label: 'Attendance Records', value: total, helper: { text: 'For selected month' }, accent: PRIMARY },
      { key: 'present', icon: Icon.Check, label: 'Present', value: attendanceCounts.present, helper: { text: pct(attendanceCounts.present, total), dot: true }, accent: SUCCESS },
      { key: 'late', icon: Icon.Clock, label: 'Late', value: attendanceCounts.late, helper: { text: pct(attendanceCounts.late, total), dot: true }, accent: WARNING },
      { key: 'absent', icon: Icon.Alert, label: 'Absent', value: attendanceCounts.absent, helper: { text: pct(attendanceCounts.absent, total), dot: true }, accent: DANGER },
    ];
  }, [activeTab, reports, archivedSubmissions, monthlyCounts, complianceRows, complianceFetched, monthlyFilterMonth, monthlyFilterYearLevel, attendanceData]);

  return (
    <div className="min-h-screen w-full" style={{ background: BG, color: INK }}>
      <div className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 pb-10 flex flex-col gap-5">
        <AdminPageHeader
          title="Reports"
          description="Review scholar compliance submissions, compliance status, and attendance records in one place."
          className="mb-1"
        />

        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2" style={{ borderBottom: `1px solid ${BORDER}` }}>
          <ModuleTabs activeTab={activeTab} onSelect={setActiveTab} />
          <div className="flex items-center gap-2 pb-2 w-full sm:w-auto">
            {activeTab === 'monthly-reports' ? (
              <>
                <select value={monthlyFilterMonth} onChange={(e) => setMonthlyFilterMonth(e.target.value)} aria-label="Filter by month or period" className={controlClass} style={controlStyle}>
                  <option value="">All periods</option>
                  {monthlyPeriodOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
                <select value={monthlyFilterYearLevel} onChange={(e) => setMonthlyFilterYearLevel(e.target.value)} aria-label="Filter by year level" className={controlClass} style={controlStyle}>
                  <option value="">All year levels</option>
                  {YEAR_LEVEL_OPTIONS.map((level) => <option key={level} value={level}>{level}</option>)}
                </select>
              </>
            ) : (
              <>
                <input type="month" value={attendanceFilters.month} onChange={(e) => setAttendanceFilters((previous) => ({ ...previous, month: e.target.value }))} aria-label="Filter attendance by month" className={controlClass} style={controlStyle} />
                <select
                  value={attendanceYearLevel}
                  onChange={(e) => setAttendanceYearLevel(e.target.value)}
                  aria-label="Filter attendance by year level"
                  disabled={!attendanceHasYearLevel}
                  title={attendanceHasYearLevel ? undefined : 'Year level is not included in the attendance data'}
                  className={controlClass}
                  style={{ ...controlStyle, cursor: attendanceHasYearLevel ? 'pointer' : 'not-allowed', opacity: attendanceHasYearLevel ? 1 : 0.55 }}
                >
                  <option value="all">All year levels</option>
                  {YEAR_LEVEL_OPTIONS.map((level) => <option key={level} value={level}>{level}</option>)}
                </select>
              </>
            )}
          </div>
        </div>

        {activeTab === 'monthly-reports' && complianceError && (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3" style={{ ...body, padding: '12px 14px', border: `1px solid ${DANGER}55`, borderRadius: 12, background: `${DANGER}0D`, color: DANGER, fontSize: '0.85rem' }}>
            <span>{complianceError}</span>
            <button type="button" onClick={fetchCompliance} style={{ ...body, padding: '7px 14px', border: `1px solid ${DANGER}`, borderRadius: 8, background: '#fff', color: DANGER, fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}>
              Retry
            </button>
          </div>
        )}

        {anyLoading && reports.length === 0 && attendanceData.length === 0 && complianceRows.length === 0 ? (
          <KpiSkeleton />
        ) : (
          <KpiStrip>
            {kpis.map((kpi) => (
              <KpiCell key={kpi.key} icon={kpi.icon} label={kpi.label} value={kpi.value} helper={kpi.helper} accent={kpi.accent} />
            ))}
          </KpiStrip>
        )}

        <div className="max-w-full overflow-x-auto">
          {activeTab === 'monthly-reports' && (
            <MonthlyReportsTab
              filteredReports={filteredMonthly}
              loading={monthlyLoading}
              error={monthlyError}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              month={monthlyFilterMonth}
              yearLevel={monthlyFilterYearLevel}
              onRefresh={fetchMonthlyReports}
              onSelectReport={setSelectedReport}
            />
          )}
          {activeTab === 'attendance' && (
            <AttendanceReportsTab
              data={attendanceData}
              loading={attendanceLoading}
              error={attendanceError}
              filters={attendanceFilters}
              yearLevel={attendanceYearLevel}
              setYearLevel={setAttendanceYearLevel}
              onFetch={fetchAttendanceReports}
              onExport={exportAttendanceCSV}
              onExportPdf={exportAdminPdf}
            />
          )}
        </div>

        <p className="text-center" style={{ ...body, fontSize: '0.78rem', color: MUTED, paddingTop: 8 }}>
          Apple Scholar Foundation. Empowering scholars. Building futures.
        </p>
      </div>

      {selectedReport && <AdminReportDetail report={selectedReport} onClose={() => setSelectedReport(null)} />}
    </div>
  );
}