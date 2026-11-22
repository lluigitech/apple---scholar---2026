import { API_ORIGIN } from '../../utils/apiConfig.js';
import { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import {
    CalendarDays, Search, Download, ChevronDown, ChevronLeft, ChevronRight,
    CheckCircle2, XCircle, Clock,
    FileText, Inbox, MapPin, RotateCcw, SlidersHorizontal, Check,
} from 'lucide-react';
import { monthPeriodLabel, downloadReportSummaryPdf } from '../../utils/reportPdfExport';
import {
    DEFAULT_STAFF_WORK_PREFERENCES,
    readStaffWorkPreferences,
} from '../../utils/staffWorkPreferences';

const API = `${API_ORIGIN}/api`;
const authHeaders = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
});

// ── Apple Scholar design system (tokens unchanged) ──
const PRIMARY = '#6D2140';
const GOLD = '#A9784E';
const BG = '#F3EEE6';
const SURFACE = '#FFFDF9';
const BORDER = '#E7D8C7';
const INK = '#241512';
const MUTED = '#8A7A68';
const SUCCESS = '#3F8A55';
const WARNING = '#B8863F';
const DANGER = '#C1666B';

const body = { fontFamily: "'Inter', -apple-system, 'Segoe UI', sans-serif" };

const STATUS_CONFIG = {
    present: { label: 'Present', icon: CheckCircle2, color: SUCCESS },
    late:    { label: 'Late',    icon: Clock,         color: WARNING },
    absent:  { label: 'Absent',  icon: XCircle,       color: DANGER },
};

const STATUS_OPTIONS = [
    { key: 'all', label: 'All statuses', color: PRIMARY },
    ...Object.entries(STATUS_CONFIG).map(([key, cfg]) => ({ key, label: cfg.label, color: cfg.color })),
];

// Raw year-level codes → readable labels, per the required conversion table.
const YEAR_LEVEL_LABELS = {
    grade_7: 'Grade 7', grade_8: 'Grade 8', grade_9: 'Grade 9', grade_10: 'Grade 10',
    grade_11: 'Grade 11', grade_12: 'Grade 12',
    college_1: '1st Year College', college_2: '2nd Year College',
    college_3: '3rd Year College', college_4: '4th Year College', college_5: '5th Year College',
};
const formatYearLevelLabel = (value) => YEAR_LEVEL_LABELS[value] || value || 'Unassigned';

const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
};

const getGroupDutyKey = (record) => JSON.stringify([
    record.group_name || 'Unassigned',
    record.duty || 'Duty',
]);

const getGroupDutyLabel = (record) =>
    `${record.group_name || 'Unassigned'} / ${record.duty || 'Duty'}`;

const getAttendanceMethodLabel = (method) => {
    const normalizedMethod = String(method || 'manual').trim().toLowerCase();
    if (normalizedMethod === 'qr') return 'QR Code';
    if (normalizedMethod === 'manual') return 'Manual';
    return normalizedMethod ? normalizedMethod.replace(/[_-]+/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase()) : 'Manual';
};

// Date-only strings (YYYY-MM-DD) are read as LOCAL dates so they never shift a day.
const parseRecordDate = (value) => {
    if (!value) return null;
    const text = String(value).trim();
    const date = /^\d{4}-\d{2}-\d{2}$/.test(text) ? new Date(`${text}T00:00:00`) : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
};

const formatDay = (date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const formatClock = (date) => date.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
const getCurrentMonth = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};
const formatAttendanceClock = (value) => {
    const date = parseRecordDate(value);
    return date ? formatClock(date) : '—';
};

// Presentation helpers shared by the table row and the mobile card.
const getRecordDay = (record) => parseRecordDate(record.date || record.duty_date || record.marked_at);
const getTimeRange = (record) => {
    const checkedIn = record.status === 'present' || record.status === 'late';
    const inTime = checkedIn ? parseRecordDate(record.marked_at) : null;
    const outAt = parseRecordDate(record.check_out_at);
    return inTime ? `${formatClock(inTime)} - ${outAt ? formatClock(outAt) : '—'}` : '—';
};

const StatusBadge = ({ status }) => {
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.absent;
    const Icon = cfg.icon;
    return (
        <span className="status-badge" style={{ color: cfg.color, background: `${cfg.color}16` }}>
            <Icon size={12} />
            {cfg.label}
        </span>
    );
};

// One table row for a single attendance record (wide screens).
const AttendanceRow = ({ record, index }) => {
    const day = getRecordDay(record);
    return (
        <tr>
            <td className="col-num">{index}</td>
            <td>
                <div className="scholar-cell">
                    <span className="duty-avatar"><span>{getInitials(record.scholar)}</span></span>
                    <div className="min-w-0">
                        <p className="cell-title truncate" title={record.scholar || 'Unknown Scholar'}>{record.scholar || 'Unknown Scholar'}</p>
                        <p className="cell-sub truncate">{record.scholar_id || '—'}</p>
                    </div>
                </div>
            </td>
            <td className="cell-text">{formatYearLevelLabel(record.year_level)}</td>
            <td className="cell-text">
                <span className="clamp-2" title={getGroupDutyLabel(record)}>{getGroupDutyLabel(record)}</span>
            </td>
            <td className="cell-text">{getAttendanceMethodLabel(record.method)}</td>
            <td className="cell-text">
                <span className="loc-cell">
                    <MapPin size={13} style={{ color: GOLD, flexShrink: 0 }} />
                    <span className="clamp-2">{record.location || 'No location'}</span>
                </span>
            </td>
            <td className="cell-text">{day ? formatDay(day) : 'No date'}</td>
            <td className="cell-text">{getTimeRange(record)}</td>
            <td><StatusBadge status={record.status} /></td>
        </tr>
    );
};

const MetaCell = ({ label, children }) => (
    <div className="meta-cell">
        <span className="meta-label">{label}</span>
        <span className="meta-value">{children}</span>
    </div>
);

// One card per record (tablet and phone).
const AttendanceCard = ({ record, index }) => {
    const day = getRecordDay(record);
    return (
        <article className="rec-card">
            <div className="rec-card-top">
                <span className="duty-avatar"><span>{getInitials(record.scholar)}</span></span>
                <div className="min-w-0 flex-1">
                    <p className="cell-title truncate">{record.scholar || 'Unknown Scholar'}</p>
                    <p className="cell-sub truncate">{record.scholar_id || '—'} · #{index}</p>
                </div>
                <StatusBadge status={record.status} />
            </div>
            <p className="rec-duty">{getGroupDutyLabel(record)}</p>
            <div className="rec-meta">
                <MetaCell label="Date">{day ? formatDay(day) : 'No date'}</MetaCell>
                <MetaCell label="Time in - out">{getTimeRange(record)}</MetaCell>
                <MetaCell label="Year level">{formatYearLevelLabel(record.year_level)}</MetaCell>
                <MetaCell label="Method">{getAttendanceMethodLabel(record.method)}</MetaCell>
            </div>
            <p className="rec-loc"><MapPin size={13} style={{ color: GOLD, flexShrink: 0 }} /> {record.location || 'No location'}</p>
        </article>
    );
};

const StaffAttendanceReports = () => {
    const navigate = useNavigate();
    const [workPreferenceState] = useState(() => {
        try {
            return { preferences: readStaffWorkPreferences(), error: '' };
        } catch (error) {
            console.error('Failed to read Staff work preferences:', error);
            return {
                preferences: { ...DEFAULT_STAFF_WORK_PREFERENCES },
                error: 'Saved report preferences could not be loaded from this browser. The report is using its default view.',
            };
        }
    });
    const workPreferences = workPreferenceState.preferences;
    const [records, setRecords]       = useState([]);
    const [duties, setDuties]         = useState([]);
    const [loading, setLoading]       = useState(true);
    const [search, setSearch]         = useState('');
    const [groupDutyFilter, setGroupDutyFilter] = useState('');
    const [methodFilter, setMethodFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState(workPreferences.attendanceStatus);
    const [monthFilter, setMonthFilter] = useState(getCurrentMonth);
    const [pdfLoading, setPdfLoading] = useState(false);
    const [page, setPage]             = useState(1);
    const [pageSize]                  = useState(workPreferences.pageSize);
    const [filtersOpen, setFiltersOpen] = useState(false); // presentation-only (phones)
    const [statusOpen, setStatusOpen] = useState(false);   // presentation-only (status dropdown)

    useEffect(() => {
        if (!localStorage.getItem('token')) {
            navigate('/login', { replace: true });
            return;
        }
        fetchAll();
    }, [navigate]);

    // Presentation-only: return to page 1 whenever any filter changes.
    useEffect(() => {
        setPage(1);
    }, [search, groupDutyFilter, methodFilter, statusFilter, monthFilter]);

    const fetchAll = async () => {
        setLoading(true);
        try {
            const [attendRes, dutiesRes] = await Promise.allSettled([
                axios.get(`${API}/staff/reports/duty-attendance`, authHeaders()),
                axios.get(`${API}/duties`, authHeaders()),
            ]);
            if (attendRes.status === 'fulfilled') {
                setRecords(attendRes.value.data.map(record => ({
                    ...record,
                    status: record.status === 'excused' ? 'absent' : record.status,
                })));
            }
            if (dutiesRes.status === 'fulfilled') setDuties(dutiesRes.value.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    // All filters are applied locally to the full attendance dataset.
    const resetFilters = () => {
        setSearch('');
        setGroupDutyFilter('');
        setMethodFilter('');
        setStatusFilter(workPreferences.attendanceStatus);
        setMonthFilter(getCurrentMonth());
    };

    // ── Client-side filters ──────────────────────────────────
    // `baseFiltered` ignores the status filter so the status chips can show their own counts.
    const baseFiltered = records.filter(r => {
        const matchSearch = !search ||
            r.scholar?.toLowerCase().includes(search.toLowerCase()) ||
            r.scholar_id?.toLowerCase().includes(search.toLowerCase());
        const matchGroupDuty = !groupDutyFilter || getGroupDutyKey(r) === groupDutyFilter;
        const matchMethod = !methodFilter || getAttendanceMethodLabel(r.method) === methodFilter;
        const recordMonth = String(r.date || r.marked_at || r.duty_date || '').slice(0, 7);
        const matchMonth = !monthFilter || recordMonth === monthFilter;
        return matchSearch && matchGroupDuty && matchMethod && matchMonth;
    });
    const filtered = baseFiltered.filter(r => statusFilter === 'all' || !statusFilter || r.status === statusFilter);

    // ── Stats ────────────────────────────────────────────────
    const stats = {
        total:   filtered.length,
        present: filtered.filter(r => r.status === 'present').length,
        late:    filtered.filter(r => r.status === 'late').length,
        absent:  filtered.filter(r => r.status === 'absent').length,
    };

    const rate = stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0;


    // ── Export to CSV (opens in Excel) ───────────────────────
    const exportCSV = () => {
        const headers = ['Scholar', 'Scholar ID', 'Year Level', 'Group / Duties', 'Check-in Method', 'Date', 'Time In - Out', 'Location', 'Status'];
        const rows = filtered.map(r => [
            r.scholar, r.scholar_id, r.year_level, getGroupDutyLabel(r), getAttendanceMethodLabel(r.method),
            r.date ? new Date(r.date).toLocaleDateString('en-PH') : '',
            (r.status === 'present' || r.status === 'late') && r.marked_at
                ? `${formatAttendanceClock(r.marked_at)} - ${r.check_out_at ? formatAttendanceClock(r.check_out_at) : '—'}`
                : '',
            r.location || '',
            r.status,
        ]);
        const csv = [headers, ...rows].map(row => row.map(v => `"${v ?? ''}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `attendance_report_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        // best-effort server log
        axios.post(`${API}/export/google-sheets`, { log_only: true, module: 'Attendance Report', report_resource: 'Staff Attendance', spreadsheet_title: `Attendance_Report_${new Date().toISOString().slice(0,10)}`, details: `attendance_report_${new Date().toISOString().split('T')[0]}.csv` }, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }).catch(() => {});
    };

    const exportPDF = async () => {
        setPdfLoading(true);
        try {
            const rows = filtered.map(record => ({
                scholarName: record.scholar || 'Unknown Scholar',
                studentId: record.scholar_id || '—',
                groupName: record.group_name || 'Unassigned',
                assignedStaff: record.assigned_staff || 'Unassigned',
                duty: record.duty || '—',
                attendanceDate: record.date || record.duty_date || '',
                attendanceTime: record.marked_at || record.date || record.duty_date || '',
                attendanceStatus: record.status || 'absent',
            }));
            await downloadReportSummaryPdf({
                role: 'staff',
                reportTitle: 'Attendance Reports',
                reportType: 'Attendance Reports',
                periodLabel: monthPeriodLabel(monthFilter),
                rows,
            });
        } catch (err) {
            console.error(err);
            alert(err.response?.data?.message || 'Failed to generate the PDF report.');
        } finally {
            setPdfLoading(false);
        }
    };

    const uniqueGroupDuties = [...new Map(records.map(record => [
        getGroupDutyKey(record),
        { key: getGroupDutyKey(record), label: getGroupDutyLabel(record) },
    ])).values()].sort((a, b) => a.label.localeCompare(b.label));
    const uniqueMethods = [...new Set(records.map(record => getAttendanceMethodLabel(record.method)))]
        .sort((a, b) => a.localeCompare(b));

    // ── Presentation-only: pagination over the full `filtered` array ──
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    const safePage   = Math.min(page, totalPages);
    const startIdx   = (safePage - 1) * pageSize;
    const pageRecords = filtered.slice(startIdx, startIdx + pageSize);
    const rangeStart = filtered.length === 0 ? 0 : startIdx + 1;
    const rangeEnd   = Math.min(startIdx + pageSize, filtered.length);

    const pageNumbers = (() => {
        const windowSize = 5;
        let start = Math.max(1, safePage - Math.floor(windowSize / 2));
        let end = Math.min(totalPages, start + windowSize - 1);
        start = Math.max(1, end - windowSize + 1);
        return Array.from({ length: end - start + 1 }, (_, i) => start + i);
    })();

    const sharePct = (n) => (stats.total > 0 ? Math.round((n / stats.total) * 1000) / 10 : 0);
    const kpis = [
        { key: 'total',   label: 'Total records', value: stats.total,   sub: 'Across all filtered data', icon: FileText,     color: PRIMARY, progress: undefined },
        { key: 'present', label: 'Present',       value: stats.present, sub: `${sharePct(stats.present)}% of total`, icon: CheckCircle2, color: SUCCESS, progress: sharePct(stats.present) },
        { key: 'late',    label: 'Late',          value: stats.late,    sub: `${sharePct(stats.late)}% of total`,    icon: Clock,        color: WARNING, progress: sharePct(stats.late) },
        { key: 'absent',  label: 'Absent',        value: stats.absent,  sub: `${sharePct(stats.absent)}% of total`,  icon: XCircle,      color: DANGER,  progress: sharePct(stats.absent) },
    ];

    const activeStatus = statusFilter || 'all';
    const activeOption = STATUS_OPTIONS.find(o => o.key === activeStatus) || STATUS_OPTIONS[0];
    const statusIsCustom = activeStatus !== (workPreferences.attendanceStatus || 'all');

    const advancedFilterCount = [groupDutyFilter, methodFilter, statusIsCustom, monthFilter !== getCurrentMonth() ? monthFilter : ''].filter(Boolean).length;
    const filtersActive = Boolean(search) || advancedFilterCount > 0;

    return (
        <div className="reports-hub" style={{ background: BG, ...body }}>
            <div className="hub-inner">

                {/* ── Standard Staff header ── */}
                <div className="hub-header hub-header-single">
                    <div className="hub-card hub-title-card staff-page-header-card">
                        <div className="hub-title-text">
                            <span className="staff-page-eyebrow">STAFF PORTAL</span>
                            <h1 className="staff-page-title">Attendance Reports</h1>
                            <p className="staff-page-description">Monitor scholar attendance and export institutional records.</p>
                        </div>
                    </div>
                </div>

                {workPreferenceState.error && (
                    <div role="alert" className="notice-error">{workPreferenceState.error}</div>
                )}

                {/* ── KPI cards ── */}
                <div className="kpi-grid">
                    {kpis.map(({ key, label, value, sub, icon: Icon, color, progress }) => (
                        <div key={key} className="hub-card kpi-card">
                            <div className="kpi-row">
                                <span className="kpi-icon" style={{ background: `${color}16`, color }}>
                                    <Icon size={20} />
                                </span>
                                <div className="min-w-0">
                                    <span className="kpi-value">{loading ? '—' : value}</span>
                                    <span className="kpi-label">{label}</span>
                                </div>
                            </div>
                            {progress !== undefined && (
                                <div className="kpi-bar" style={{ background: `${color}1f` }}>
                                    <span style={{ width: `${loading ? 0 : progress}%`, background: color }} />
                                </div>
                            )}
                            <span className="kpi-sub" style={progress !== undefined ? { color } : undefined}>{loading ? 'Loading…' : sub}</span>
                        </div>
                    ))}
                </div>

                {/* ── Filters: one row on desktop, search + collapsible filters on phones ── */}
                <div className="hub-card filter-card">
                    <div className="filter-top">
                        <div className="field field-search">
                            <label htmlFor="att-search" className="field-label">Search scholar</label>
                            <div className="input-wrap">
                                <Search size={14} className="lead-icon" />
                                <input id="att-search" type="text" placeholder="Search scholar name or ID…" value={search} onChange={e => setSearch(e.target.value)} />
                            </div>
                        </div>
                        <button type="button" className="btn-outline filter-toggle" onClick={() => setFiltersOpen(v => !v)} aria-expanded={filtersOpen} aria-controls="att-filter-grid">
                            <SlidersHorizontal size={14} /> Filters
                            {advancedFilterCount > 0 && <span className="filter-count">{advancedFilterCount}</span>}
                        </button>
                    </div>

                    <div id="att-filter-grid" className={`filter-grid${filtersOpen ? ' open' : ''}`}>
                        <div className="field">
                            <label htmlFor="att-month" className="field-label">Month</label>
                            <div className="input-wrap">
                                <CalendarDays size={14} className="lead-icon" />
                                <input id="att-month" type="month" value={monthFilter} onChange={e => setMonthFilter(e.target.value)} />
                            </div>
                        </div>
                        <div className="field">
                            <label htmlFor="att-group-duty" className="field-label">Group / duties</label>
                            <div className="input-wrap">
                                <select id="att-group-duty" value={groupDutyFilter} onChange={e => setGroupDutyFilter(e.target.value)}>
                                    <option value="">All groups / duties</option>
                                    {uniqueGroupDuties.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}
                                </select>
                                <ChevronDown size={14} className="select-chevron" />
                            </div>
                        </div>
                        <div className="field">
                            <label htmlFor="att-method" className="field-label">Check-in method</label>
                            <div className="input-wrap">
                                <select id="att-method" value={methodFilter} onChange={e => setMethodFilter(e.target.value)}>
                                    <option value="">All methods</option>
                                    {uniqueMethods.map(method => <option key={method} value={method}>{method}</option>)}
                                </select>
                                <ChevronDown size={14} className="select-chevron" />
                            </div>
                        </div>
                        <div className="field">
                            <span className="field-label" id="att-status-label">Status</span>
                            <div className="status-select">
                                <button
                                    type="button"
                                    id="att-status"
                                    className="input-wrap status-trigger"
                                    aria-haspopup="listbox"
                                    aria-expanded={statusOpen}
                                    aria-labelledby="att-status-label att-status"
                                    onClick={() => setStatusOpen(v => !v)}
                                    onKeyDown={e => { if (e.key === 'Escape') setStatusOpen(false); }}
                                >
                                    <span className="status-dot" style={{ background: activeOption.color }} />
                                    <span className="status-trigger-label">{activeOption.label}</span>
                                    <ChevronDown size={14} className="select-chevron" style={{ transform: statusOpen ? 'rotate(180deg)' : 'none' }} />
                                </button>
                                {statusOpen && (
                                    <>
                                        <div className="status-menu" role="listbox" aria-label="Status">
                                            {STATUS_OPTIONS.map(o => {
                                                const active = o.key === activeStatus;
                                                return (
                                                    <button
                                                        key={o.key}
                                                        type="button"
                                                        role="option"
                                                        aria-selected={active}
                                                        className={`status-option${active ? ' is-active' : ''}`}
                                                        onClick={() => { setStatusFilter(o.key); setStatusOpen(false); }}
                                                    >
                                                        <span className="status-dot" style={{ background: o.color }} />
                                                        <span className="status-option-label">{o.label}</span>
                                                        {active && <Check size={14} style={{ color: PRIMARY, flexShrink: 0 }} />}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        <div className="status-backdrop" onClick={() => setStatusOpen(false)} />
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {filtersActive && (
                        <button type="button" onClick={resetFilters} className="reset-btn">
                            <RotateCcw size={13} /> Reset filters
                        </button>
                    )}
                </div>

                {/* ── Attendance records ── */}
                <section className="hub-card records-card">
                    <div className="records-head">
                        <div className="min-w-0">
                            <h2>Attendance records</h2>
                            <p>Records matching the selected filters.{!loading && stats.total > 0 && <> {rate}% present.</>}</p>
                        </div>
                        <div className="export-toolbar" role="group" aria-label="Export actions">
                            <button type="button" onClick={exportCSV} className="btn-outline">
                                <Download size={14} /> Export CSV
                            </button>
                            <button type="button" onClick={exportPDF} disabled={pdfLoading} className="btn-filled">
                                <FileText size={14} /> {pdfLoading ? 'Generating…' : 'Export PDF'}
                            </button>
                        </div>
                    </div>


                    {loading ? (
                        <div className="skeleton-list">
                            {Array(5).fill(0).map((_, i) => <div key={i} className="animate-pulse skeleton-bar" />)}
                        </div>
                    ) : pageRecords.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-icon"><Inbox size={22} style={{ color: GOLD }} /></div>
                            <p className="empty-title">No attendance records</p>
                            <p className="empty-text">Adjust or reset the filters to see more records.</p>
                            <button type="button" onClick={resetFilters} className="btn-outline" style={{ marginTop: 14 }}>
                                <RotateCcw size={13} /> Reset filters
                            </button>
                        </div>
                    ) : (
                        <>
                            {/* Wide screens: table */}
                            <div className="table-shell rec-table">
                                <div className="table-scroll">
                                    <table className={`att-table${workPreferences.density === 'compact' ? ' att-table-compact' : ''}`}>
                                        <thead>
                                            <tr>
                                                <th className="col-num">#</th>
                                                <th>Scholar</th>
                                                <th>Year level</th>
                                                <th>Group / duties</th>
                                                <th>Check-in method</th>
                                                <th>Location</th>
                                                <th>Date</th>
                                                <th>Time in - out</th>
                                                <th>Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {pageRecords.map((record, i) => (
                                                <AttendanceRow
                                                    key={record.id ?? `${record.scholar_id || 'x'}-${record.duty || 'd'}-${startIdx + i}`}
                                                    record={record}
                                                    index={startIdx + i + 1}
                                                />
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Tablet and phone: cards */}
                            <div className="rec-cards">
                                {pageRecords.map((record, i) => (
                                    <AttendanceCard
                                        key={record.id ?? `c-${record.scholar_id || 'x'}-${record.duty || 'd'}-${startIdx + i}`}
                                        record={record}
                                        index={startIdx + i + 1}
                                    />
                                ))}
                            </div>
                        </>
                    )}

                    <div className="pager">
                        <div className="pager-left">
                            <span className="pager-info">
                                Showing {rangeStart}–{rangeEnd} of {filtered.length} record{filtered.length === 1 ? '' : 's'}
                            </span>
                        </div>
                        <nav className="pager-controls" aria-label="Pagination">
                            <button type="button" className="page-btn" onClick={() => setPage(Math.max(1, safePage - 1))} disabled={safePage <= 1} aria-label="Previous page">
                                <ChevronLeft size={15} />
                            </button>
                            {pageNumbers.map(n => (
                                <button
                                    key={n}
                                    type="button"
                                    className={`page-btn page-num${n === safePage ? ' page-btn-active' : ''}`}
                                    onClick={() => setPage(n)}
                                    aria-current={n === safePage ? 'page' : undefined}
                                >
                                    {n}
                                </button>
                            ))}
                            <span className="page-of">Page {safePage} of {totalPages}</span>
                            <button type="button" className="page-btn" onClick={() => setPage(Math.min(totalPages, safePage + 1))} disabled={safePage >= totalPages} aria-label="Next page">
                                <ChevronRight size={15} />
                            </button>
                        </nav>
                    </div>
                </section>

            </div>

            <GlobalStyle />
        </div>
    );
};

const GlobalStyle = () => (
    <style>{`
        .reports-hub { min-height: 100vh; overflow-x: hidden; }
        .reports-hub *, .reports-hub *::before, .reports-hub *::after { box-sizing: border-box; }
        .hub-inner { padding: 16px 12px 48px; width: 100%; }
        @media (min-width: 640px) { .hub-inner { padding: 24px 24px 48px; } }
        @media (min-width: 1024px) { .hub-inner { padding: 32px 32px 48px; } }

        .reports-hub button:focus-visible, .reports-hub input:focus-visible, .reports-hub select:focus-visible { outline: 2px solid ${GOLD}; outline-offset: 2px; }

        .hub-card {
            background: ${SURFACE};
            border: 1px solid ${BORDER};
            border-radius: 16px;
            box-shadow: 0 12px 28px -20px rgba(36,21,18,0.22);
        }

        /* ── Header (unchanged structure) ── */
        .hub-header { display: grid; grid-template-columns: minmax(0, 1fr); gap: 14px; margin-bottom: 16px; }
        .hub-title-card { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: clamp(14px, 3vw, 20px) clamp(16px, 3vw, 24px); }
        .hub-title-text { min-width: 0; }
        .hub-title-text p { margin: 4px 0 0; }
        /* Zero-specificity fallback; the shared staff-page-* styles win whenever they are loaded. */
        :where(.staff-page-eyebrow) { font-family: 'Inter', 'Segoe UI', sans-serif; font-size: 0.7rem; font-weight: 700; letter-spacing: 0.1em; color: ${GOLD}; }
        :where(.staff-page-title) { font-family: 'Lora', Georgia, 'Times New Roman', serif; font-size: clamp(1.6rem, 4vw, 2rem); font-weight: 700; color: ${PRIMARY}; line-height: 1.15; margin-top: 3px; }
        :where(.staff-page-description) { font-family: 'Inter', 'Segoe UI', sans-serif; font-size: 0.9rem; color: ${MUTED}; margin-top: 6px; line-height: 1.55; }

        .notice-error { margin-bottom: 14px; padding: 10px 14px; color: #8E2631; background: #FBEAEA; border-left: 3px solid ${DANGER}; border-radius: 10px; font-size: 0.82rem; font-weight: 600; }

        /* ── Buttons ── */
        .btn-outline, .btn-filled {
            display: inline-flex; align-items: center; justify-content: center; gap: 8px;
            height: 40px; padding: 0 16px; border-radius: 10px;
            font-family: 'Inter', sans-serif; font-size: 0.8rem; font-weight: 700; cursor: pointer; white-space: nowrap;
            transition: background-color 150ms ease, opacity 150ms ease;
        }
        .btn-outline { background: #fff; border: 1px solid ${BORDER}; color: ${PRIMARY}; flex-shrink: 0; }
        .btn-outline:hover:not(:disabled) { background: ${BG}; }
        .btn-filled { border: 1px solid ${PRIMARY}; color: #fff; background: ${PRIMARY}; }
        .btn-filled:hover:not(:disabled) { opacity: 0.9; }
        .btn-outline:disabled, .btn-filled:disabled { opacity: 0.6; cursor: default; }

        /* ── KPI ── */
        .kpi-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-bottom: 16px; }
        @media (min-width: 640px) { .kpi-grid { gap: 16px; } }
        @media (min-width: 1024px) { .kpi-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
        .kpi-card { display: flex; flex-direction: column; padding: clamp(14px, 3vw, 18px); min-width: 0; }
        .kpi-row { display: flex; align-items: center; gap: 12px; }
        .kpi-icon { width: 44px; height: 44px; border-radius: 12px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
        .kpi-value { display: block; font-family: 'Lora', Georgia, serif; font-size: clamp(1.35rem, 4vw, 1.7rem); line-height: 1; font-weight: 700; color: ${PRIMARY}; }
        .kpi-label { display: block; font-size: 0.78rem; color: ${MUTED}; margin-top: 5px; }
        .kpi-bar { height: 5px; border-radius: 3px; overflow: hidden; margin-top: 12px; }
        .kpi-bar span { display: block; height: 100%; border-radius: 3px; transition: width 0.5s ease; }
        .kpi-sub { display: block; font-size: 0.7rem; font-weight: 600; color: ${MUTED}; margin-top: 12px; }
        .kpi-bar + .kpi-sub { margin-top: 5px; }

        /* ── Filters ── */
        .filter-card { padding: clamp(12px, 2.5vw, 18px); margin-bottom: 16px; }
        .filter-top { display: flex; align-items: flex-end; gap: 10px; }
        .filter-top .field-search { flex: 1; }
        .filter-toggle { position: relative; }
        .filter-count { min-width: 18px; height: 18px; padding: 0 5px; border-radius: 999px; background: ${PRIMARY}; color: #fff; font-size: 0.66rem; display: inline-flex; align-items: center; justify-content: center; }
        .filter-grid { display: none; grid-template-columns: minmax(0, 1fr); gap: 12px; margin-top: 12px; }
        .filter-grid.open { display: grid; }
        .field { min-width: 0; }
        .field-label { display: block; font-size: 0.74rem; font-weight: 600; color: ${INK}; margin-bottom: 6px; }
        .input-wrap {
            position: relative; display: flex; align-items: center; gap: 8px;
            height: 42px; padding: 0 12px; background: #fff; border: 1px solid ${BORDER}; border-radius: 10px;
        }
        .input-wrap:focus-within { border-color: ${GOLD}; }
        .lead-icon { color: ${MUTED}; flex-shrink: 0; }
        .input-wrap input, .input-wrap select {
            flex: 1; min-width: 0; width: 100%; height: 100%;
            border: none; outline: none; background: none; appearance: none; -webkit-appearance: none;
            font-family: 'Inter', sans-serif; font-size: 0.84rem; color: ${INK};
        }
        .input-wrap select { cursor: pointer; padding-right: 20px; text-overflow: ellipsis; }
        .select-chevron { position: absolute; right: 12px; color: ${MUTED}; pointer-events: none; }
        /* Status dropdown */
        .status-select { position: relative; }
        .status-trigger { width: 100%; cursor: pointer; text-align: left; font-family: 'Inter', sans-serif; font-size: 0.84rem; color: ${INK}; }
        .status-trigger:hover { background: #FCFAF5; }
        .status-trigger-label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding-right: 18px; }
        .status-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .status-menu {
            position: absolute; z-index: 50; top: calc(100% + 6px); left: 0; right: 0; min-width: 180px;
            padding: 4px; background: ${SURFACE}; border: 1px solid ${BORDER}; border-radius: 12px;
            box-shadow: 0 16px 32px -18px rgba(36,21,18,0.3);
        }
        .status-backdrop { position: fixed; inset: 0; z-index: 40; }
        .status-option {
            width: 100%; display: flex; align-items: center; gap: 10px; padding: 10px 12px; border: none; border-radius: 8px;
            background: none; text-align: left; cursor: pointer;
            font-family: 'Inter', sans-serif; font-size: 0.84rem; color: ${INK};
        }
        .status-option:hover { background: ${BG}; }
        .status-option.is-active { background: ${PRIMARY}0D; font-weight: 700; color: ${PRIMARY}; }
        .status-option-label { flex: 1; }
        .reset-btn {
            display: inline-flex; align-items: center; gap: 6px; margin-top: 12px; padding: 6px 12px;
            border: none; background: ${PRIMARY}0D; color: ${PRIMARY}; border-radius: 999px;
            font-family: 'Inter', sans-serif; font-size: 0.74rem; font-weight: 700; cursor: pointer;
        }
        .reset-btn:hover { background: ${PRIMARY}1A; }

        @media (min-width: 768px) {
            .filter-card { display: block; }
            .filter-toggle { display: none; }
            .filter-top { display: contents; }
            .filter-card { display: grid; grid-template-columns: minmax(220px, 1.5fr) repeat(4, minmax(0, 1fr)); gap: 12px; align-items: end; }
            .filter-grid, .filter-grid.open { display: contents; }
            .reset-btn { grid-column: 1 / -1; justify-self: start; margin-top: 0; }
        }

        /* ── Records ── */
        .records-card { padding: clamp(14px, 3vw, 22px); margin-bottom: 16px; }
        .records-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; flex-wrap: wrap; margin-bottom: 14px; }
        .records-head h2 { font-family: 'Lora', Georgia, serif; font-size: 1.2rem; font-weight: 600; color: ${INK}; margin: 0; }
        .records-head p { font-size: 0.8rem; color: ${MUTED}; margin: 3px 0 0; }
        .export-toolbar { display: flex; gap: 10px; flex-wrap: wrap; }


        .table-shell { border: 1px solid ${BORDER}; border-radius: 14px; overflow: hidden; background: #fff; }
        .table-scroll { overflow-x: auto; }
        .att-table { width: 100%; min-width: 1150px; border-collapse: collapse; table-layout: fixed; }
        .att-table thead th {
            background: #FCFAF5; color: ${MUTED}; font-size: 0.74rem; font-weight: 600; text-align: left;
            padding: 13px 14px; border-bottom: 1px solid ${BORDER}; white-space: nowrap;
        }
        .att-table tbody td { padding: 12px 14px; border-bottom: 1px solid ${BORDER}; vertical-align: middle; }
        .att-table-compact thead th { padding-top: 8px; padding-bottom: 8px; }
        .att-table-compact tbody td { padding-top: 6px; padding-bottom: 6px; }
        .att-table-compact .duty-avatar { width: 28px; height: 28px; }
        .att-table tbody tr:last-child td { border-bottom: none; }
        .att-table tbody tr:hover { background: #FCFAF5; }
        .att-table th:nth-child(1), .att-table td:nth-child(1) { width: 52px; }
        .att-table th:nth-child(2) { width: 210px; }
        .att-table th:nth-child(3) { width: 130px; }
        .att-table th:nth-child(4) { width: 180px; }
        .att-table th:nth-child(5) { width: 130px; }
        .att-table th:nth-child(6) { width: 140px; }
        .att-table th:nth-child(7) { width: 120px; }
        .att-table th:nth-child(8) { width: 150px; }
        .att-table th:nth-child(9) { width: 110px; }
        .col-num { color: ${MUTED}; font-size: 0.8rem; }
        .scholar-cell { display: flex; align-items: center; gap: 10px; min-width: 0; }
        .duty-avatar {
            width: 36px; height: 36px; border-radius: 50%; flex-shrink: 0;
            background: ${PRIMARY}12; border: 1px solid ${PRIMARY}26; display: flex; align-items: center; justify-content: center;
        }
        .duty-avatar span { color: ${PRIMARY}; font-size: 0.68rem; font-weight: 700; }
        .cell-title { font-size: 0.84rem; font-weight: 600; color: ${INK}; margin: 0; }
        .cell-sub { font-family: 'IBM Plex Mono', ui-monospace, monospace; font-size: 0.68rem; color: ${MUTED}; margin: 2px 0 0; }
        .cell-text { font-size: 0.82rem; color: ${INK}; }
        .clamp-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; word-break: break-word; }
        .loc-cell { display: flex; align-items: center; gap: 6px; min-width: 0; }
        .status-badge {
            display: inline-flex; align-items: center; gap: 5px; flex-shrink: 0;
            font-size: 0.72rem; font-weight: 700; border-radius: 999px; padding: 4px 11px;
        }

        /* Table on wide screens, cards below */
        .rec-cards { display: grid; grid-template-columns: minmax(0, 1fr); gap: 10px; }
        @media (min-width: 700px) { .rec-cards { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        .rec-table { display: none; }
        @media (min-width: 1180px) {
            .rec-table { display: block; }
            .rec-cards { display: none; }
        }
        .rec-card { background: #fff; border: 1px solid ${BORDER}; border-radius: 14px; padding: 14px; min-width: 0; }
        .rec-card-top { display: flex; align-items: center; gap: 10px; }
        .rec-duty { margin: 12px 0 0; padding-top: 12px; border-top: 1px solid ${BORDER}; font-size: 0.82rem; font-weight: 600; color: ${INK}; word-break: break-word; }
        .rec-meta { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 12px; margin-top: 10px; }
        .meta-cell { min-width: 0; }
        .meta-label { display: block; font-size: 0.66rem; font-weight: 600; color: ${MUTED}; }
        .meta-value { display: block; font-size: 0.78rem; color: ${INK}; margin-top: 2px; word-break: break-word; }
        .rec-loc { display: flex; align-items: center; gap: 6px; margin: 10px 0 0; font-size: 0.76rem; color: ${MUTED}; }

        /* ── Loading / empty ── */
        .skeleton-list { display: grid; gap: 8px; }
        .skeleton-bar { height: 64px; background: ${BORDER}66; border-radius: 12px; }
        .empty-state { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 44px 20px; border: 1.5px dashed ${BORDER}; border-radius: 14px; background: #fff; }
        .empty-icon { width: 52px; height: 52px; border-radius: 16px; background: ${GOLD}18; display: flex; align-items: center; justify-content: center; margin-bottom: 14px; }
        .empty-title { font-family: 'Lora', Georgia, serif; font-size: 1.05rem; font-weight: 700; color: ${INK}; margin: 0; }
        .empty-text { font-size: 0.8rem; color: ${MUTED}; margin: 4px 0 0; }

        /* ── Pagination ── */
        .pager { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-top: 16px; }
        .pager-left { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
        .pager-info { font-size: 0.78rem; color: ${MUTED}; }
        .pager-controls { display: flex; align-items: center; gap: 6px; }
        .page-btn {
            min-width: 34px; height: 34px; padding: 0 8px; border-radius: 10px;
            background: #fff; border: 1px solid ${BORDER}; color: ${INK};
            font-family: 'Inter', sans-serif; font-size: 0.8rem; font-weight: 600; cursor: pointer;
            display: inline-flex; align-items: center; justify-content: center;
        }
        .page-btn:hover:not(:disabled) { background: ${BG}; }
        .page-btn:disabled { opacity: 0.45; cursor: default; }
        .page-btn-active, .page-btn-active:hover:not(:disabled) { background: ${PRIMARY}; border-color: ${PRIMARY}; color: #fff; }
        .page-of { display: none; font-size: 0.76rem; color: ${MUTED}; padding: 0 6px; white-space: nowrap; }


        /* ── Phones ── */
        @media (max-width: 639px) {
            .hub-title-card { flex-wrap: wrap; }
            .export-toolbar { width: 100%; }
            .export-toolbar .btn-outline, .export-toolbar .btn-filled { flex: 1 1 0; }
            .pager { flex-direction: column; align-items: stretch; }
            .pager-left { justify-content: space-between; }
            .pager-controls { justify-content: space-between; }
            .page-num:not(.page-btn-active) { display: none; }
            .page-of { display: inline; }
        }
        @media (prefers-reduced-motion: reduce) {
            .reports-hub * { transition: none !important; animation-duration: 0.01ms !important; }
        }
    `}</style>
);

export default StaffAttendanceReports;