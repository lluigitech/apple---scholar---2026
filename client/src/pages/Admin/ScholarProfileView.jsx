import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import * as XLSX from 'xlsx';
import {
    ArrowLeft, BookOpen, ClipboardCheck, FileText,
    Clock, Shield,
    CheckCircle, XCircle, Download,
    Bell, Hash, Mail, TrendingUp,
    Activity, Calendar, ChevronDown, ChevronUp, AlertTriangle,
    MoreHorizontal,
} from 'lucide-react';
import FilePreviewModal from '../../components/Officer/ManualValidation/FilePreviewModal';
import { formatDuration, getDutyHours } from '../../utils/dutyHelpers.js';
import { fileKind } from '../../utils/submissionHelpers';
import { formatAdminDate, getAdminPageSize } from '../../utils/adminPreferences';

// ── Executive design tokens ──────────────────────────────────────
const BG           = '#F7F4EE';
const SURFACE      = '#FFFDF9';
const BORDER       = '#E7D8C7';
const PRIMARY      = '#6D2140';
const PRIMARY_DEEP = '#4A1730';
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
const numeric = { ...serif, fontVariantNumeric: 'lining-nums tabular-nums', fontFeatureSettings: '"lnum" 1, "tnum" 1' };
const selectStyle = { ...sans, color: INK, background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '0 12px', width: '100%' };
const selectClass = 'h-10 sm:h-9 text-base sm:text-[0.8rem]';

const cardStyle = { background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: RADIUS, boxShadow: SHADOW };

const RAW_API = (import.meta.env?.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
const API_BASE = RAW_API.endsWith('/api') ? RAW_API : `${RAW_API}/api`;
const ADMIN_API = `${API_BASE}/admin`;
const EXPORT_API = `${API_BASE}/export`;

const badgeMap = {
    complied: { color: SUCCESS, Icon: CheckCircle, label: 'Complied' },
    pending:  { color: WARNING, Icon: Clock,        label: 'Pending'  },
    missed:   { color: DANGER,  Icon: XCircle,      label: 'Missed'   },
    passed:   { color: SUCCESS, Icon: CheckCircle,  label: 'Passed'   },
    failed:   { color: DANGER,  Icon: XCircle,      label: 'Failed'   },
    approved: { color: SUCCESS, Icon: CheckCircle,  label: 'Approved' },
    rejected: { color: DANGER,  Icon: XCircle,      label: 'Rejected' },
    archived: { color: MUTED,  Icon: CheckCircle,  label: 'Archived' },
    present:  { color: SUCCESS, Icon: CheckCircle, label: 'Present' },
    late:     { color: WARNING, Icon: Clock,       label: 'Late' },
    absent:   { color: DANGER,  Icon: XCircle,     label: 'Absent' },
    excused:  { color: MUTED,   Icon: CheckCircle, label: 'Excused' },
};

const formatYearLevelLabel = (value) => {
    if (!value) return '—';
    const normalized = String(value).trim().toLowerCase().replace(/_/g, ' ');
    const aliasMap = {
        'grade 7': 'Grade 7', 'grade 8': 'Grade 8', 'grade 9': 'Grade 9', 'grade 10': 'Grade 10',
        'grade 11': 'Grade 11', 'grade 12': 'Grade 12',
        'college 1': '1st Year College', 'college 2': '2nd Year College', 'college 3': '3rd Year College',
        'college 4': '4th Year College', 'college 5': '5th Year College',
        '1st year college': '1st Year College', '2nd year college': '2nd Year College',
        '3rd year college': '3rd Year College', '4th year college': '4th Year College', '5th year college': '5th Year College',
    };
    return aliasMap[normalized] || value;
};

const getSubmissionMonthKey = (value) => {
    const match = String(value || '').match(/^(\d{4})-(\d{2})/);
    return match ? `${match[1]}-${match[2]}` : '';
};

const formatSubmissionMonth = (monthKey) => {
    const date = new Date(`${monthKey}-01T12:00:00`);
    return Number.isNaN(date.getTime())
        ? monthKey
        : date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
};

const matchesComplianceStatus = (status, filter) => {
    if (filter === 'all') return true;
    const normalized = String(status || 'pending').toLowerCase();
    return filter === 'approved'
        ? ['approved', 'archived'].includes(normalized)
        : normalized === filter;
};

const StatusBadge = ({ status }) => {
    const cfg = badgeMap[String(status || '').toLowerCase()] ?? badgeMap.pending;
    const { Icon, color, label } = cfg;
    return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full whitespace-nowrap"
            style={{ backgroundColor: `${color}14`, border: `1px solid ${color}35`, ...sans, fontSize: '0.75rem', fontWeight: 600, color }}>
            <Icon className="w-3 h-3" />{label}
        </span>
    );
};

// ── Surface card — the base building block of the portfolio ──────
const Panel = ({ icon: Icon, title, subtitle, action, children, padded = true }) => (
    <div className="h-full min-w-0 overflow-hidden" style={cardStyle}>
        {title && (
            <div className="flex items-center justify-between gap-3 px-5 sm:px-6 pt-5 pb-4">
                <div className="flex items-center gap-3 min-w-0">
                    {Icon && (
                        <span className="flex items-center justify-center rounded-full flex-shrink-0" style={{ width: 32, height: 32, background: `${PRIMARY}0F`, color: PRIMARY }}>
                            <Icon size={15} />
                        </span>
                    )}
                    <div className="min-w-0">
                        <h3 style={{ ...serif, fontSize: '1.02rem', fontWeight: 600, color: INK }}>{title}</h3>
                        {subtitle && <p style={{ ...sans, fontSize: '0.78rem', color: MUTED, marginTop: 2 }}>{subtitle}</p>}
                    </div>
                </div>
                {action}
            </div>
        )}
        <div className={padded ? `px-5 sm:px-6 pb-6 ${title ? '' : 'pt-6'}` : ''}>{children}</div>
    </div>
);

const EmptyNote = ({ children }) => (
    <p style={{ ...sans, fontSize: '0.78rem', color: MUTED, fontStyle: 'italic', textAlign: 'center', padding: '18px 0' }}>{children}</p>
);

const EmptyCard = ({ icon: Icon, children }) => (
    <div className="p-14 text-center" style={cardStyle}>
        <Icon size={38} className="mx-auto mb-3" style={{ color: `${BRONZE}66` }} />
        <p style={{ ...sans, fontSize: '0.85rem', fontWeight: 600, color: MUTED }}>{children}</p>
    </div>
);

const MiniLabel = ({ children }) => (
    <p style={{ ...sans, fontSize: '0.75rem', fontWeight: 600, color: MUTED }}>{children}</p>
);

const getSentimentColor = (label) => {
    if (!label) return MUTED;
    const l = label.toLowerCase();
    if (l.includes('positive')) return SUCCESS;
    if (l.includes('negative')) return DANGER;
    return WARNING;
};

const getQualityColor = (score) => {
    if (score == null || !Number.isFinite(Number(score))) return MUTED;
    return Number(score) >= 70 ? SUCCESS : Number(score) >= 50 ? WARNING : DANGER;
};

const getSubmissionTypeLabel = (submission) => {
    const type = String(submission.submission_type || '').toLowerCase();
    if (type === 'letter' || submission.letter_content) return 'Monthly Letter';
    if (type === 'report_card' || type === 'grades' || submission.report_card_path) return 'Report Card / Grades';
    if (type === 'cor' || submission.cor_path) return 'Certificate of Registration';
    if (type === 'other' || submission.media_paths) return 'Other Document';
    return 'Submission';
};

const isLetterSubmission = (submission) =>
    String(submission.submission_type || '').toLowerCase() === 'letter' || Boolean(submission.letter_content);

const submissionTypeOf = (submission) => String(submission.submission_type || '').toLowerCase();
const isGradeSubmission = (submission) =>
    Boolean(submission.report_card_path) || ['report_card', 'grades'].includes(submissionTypeOf(submission));
const isCorSubmission = (submission) =>
    Boolean(submission.cor_path) || submissionTypeOf(submission) === 'cor';
const isOtherSubmission = (submission) =>
    (Boolean(submission.media_paths) || submissionTypeOf(submission) === 'other')
    && !isGradeSubmission(submission)
    && !isCorSubmission(submission)
    && !isLetterSubmission(submission);

const matchesDocumentType = (submission, filter) => {
    if (filter === 'grades') return isGradeSubmission(submission);
    if (filter === 'cor') return isCorSubmission(submission);
    if (filter === 'letters') return isLetterSubmission(submission);
    if (filter === 'other') return isOtherSubmission(submission);
    return true;
};

const getEntryIcon = (submission) => {
    if (isLetterSubmission(submission)) return FileText;
    if (isGradeSubmission(submission)) return BookOpen;
    if (isCorSubmission(submission)) return ClipboardCheck;
    return FileText;
};

const SubjectList = ({ subjects, scale }) => {
    const pageSize = getAdminPageSize();
    const [page, setPage] = useState(1);
    const totalPages = Math.max(1, Math.ceil(subjects.length / pageSize));
    const currentPage = Math.min(page, totalPages);
    const start = (currentPage - 1) * pageSize;
    const pageSubjects = subjects.slice(start, start + pageSize);
    const pagerButtonStyle = (disabled) => ({
        ...sans, fontSize: '0.75rem', fontWeight: 600, color: PRIMARY, background: SURFACE,
        border: `1px solid ${BORDER}`, borderRadius: 8, padding: '8px 11px',
        cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1,
    });

    if (subjects.length === 0) {
        return <p style={{ ...sans, fontSize: '0.78rem', color: MUTED }}>No subjects recorded for this academic record.</p>;
    }

    return (
        <div>
            <div className="flex flex-col gap-2">
                {pageSubjects.map((subject, index) => {
                    const grade = formatGradeValue(subject.grade, scale);
                    return (
                        <div key={`${subject.subject_name}-${start + index}`} className="flex items-center justify-between gap-3 pt-2" style={{ borderTop: `1px solid ${BORDER}` }}>
                            <div className="min-w-0">
                                <p className="break-words" style={{ ...sans, fontSize: '0.82rem', fontWeight: 600, color: INK }}>{subject.subject_name}</p>
                                <p style={{ ...numeric, fontSize: '0.75rem', color: MUTED }}>{subject.units} units</p>
                            </div>
                            <span className="flex-shrink-0" style={{ ...sans, fontSize: '0.76rem', fontWeight: 700, color: grade !== '—' ? INK : MUTED }}>{grade}</span>
                        </div>
                    );
                })}
            </div>
            {totalPages > 1 && (
                <div className="flex flex-col gap-2 mt-3 pt-3 sm:flex-row sm:items-center sm:justify-between" style={{ borderTop: `1px solid ${BORDER}` }}>
                    <span style={{ ...sans, fontSize: '0.75rem', color: MUTED }}>
                        Showing {start + 1}–{Math.min(start + pageSize, subjects.length)} of {subjects.length} subjects
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                        <button type="button" onClick={() => setPage(currentPage - 1)} disabled={currentPage === 1} style={pagerButtonStyle(currentPage === 1)}>Previous</button>
                        <span aria-live="polite" style={{ ...sans, fontSize: '0.75rem', color: MUTED }}>Page {currentPage} of {totalPages}</span>
                        <button type="button" onClick={() => setPage(currentPage + 1)} disabled={currentPage === totalPages} style={pagerButtonStyle(currentPage === totalPages)}>Next</button>
                    </div>
                </div>
            )}
        </div>
    );
};

const AcademicDetails = ({ semester, onPreview }) => (
    <div className="px-4 pb-4 pt-3" style={{ borderTop: `1px solid ${BORDER}`, background: BG }}>
        <p className="mb-3" style={{ ...sans, fontSize: '0.75rem', color: MUTED }}>
            {semester.grade_scale === 'college' ? 'College grading scale' : 'K–12 grading scale'} · {semester.total_units ?? 0} total units
        </p>
        <SubjectList subjects={semester.subjects || []} scale={semester.grade_scale} />
        {semester.proof_path && (
            <button type="button"
                onClick={() => onPreview({
                    url: `${API_BASE}/submission/preview?url=${encodeURIComponent(semester.proof_path)}`,
                    kind: fileKind(semester.proof_path),
                    label: `Grade Proof - ${semester.semester} AY ${semester.academic_year}`,
                })}
                className="mt-3 rounded-full transition-opacity hover:opacity-75"
                style={{ ...sans, fontSize: '0.7rem', fontWeight: 700, color: PRIMARY, background: 'transparent', border: `1px solid ${PRIMARY}40`, padding: '7px 13px', cursor: 'pointer' }}>
                View submitted grade {fileKind(semester.proof_path) === 'image' ? 'photo' : 'proof'}
            </button>
        )}
    </div>
);

const isPassingGrade = (grade, scale) =>
    scale === 'college' ? Number(grade) <= 3.00 : Number(grade) >= 75;

const formatGradeValue = (value, scale) => {
    if (value == null || !Number.isFinite(Number(value))) return '—';
    const grade = Number(value);
    return scale === 'college' || !Number.isInteger(grade) ? grade.toFixed(2) : String(grade);
};

const getGradeAverageLabel = (semester) => semester.grade_scale === 'college' ? 'GWA' : 'Average Grade';

const formatAdminTime = (value) => {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? null
        : date.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
};

// ── Page header: breadcrumb, title, and actions (responsive) ──────
const PortfolioHeader = ({ onBack, onExport, onExportPdf, onRemind, reminding }) => {
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef(null);

    useEffect(() => {
        if (!menuOpen) return undefined;
        const onDown = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
        const onKey = (e) => { if (e.key === 'Escape') setMenuOpen(false); };
        document.addEventListener('mousedown', onDown);
        document.addEventListener('touchstart', onDown);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onDown);
            document.removeEventListener('touchstart', onDown);
            document.removeEventListener('keydown', onKey);
        };
    }, [menuOpen]);

    const run = (fn) => () => { setMenuOpen(false); fn(); };

    const base = { ...sans, fontSize: '0.78rem', fontWeight: 600, height: 40, borderRadius: 999, whiteSpace: 'nowrap' };
    const primaryBtn = {
        ...base, color: '#fff', background: PRIMARY, border: `1px solid ${PRIMARY}`,
        cursor: reminding ? 'default' : 'pointer', opacity: reminding ? 0.6 : 1,
    };
    const secondaryBtn = { ...base, color: PRIMARY, background: SURFACE, border: `1px solid ${BORDER}`, cursor: 'pointer' };
    const menuItem = {
        ...sans, fontSize: '0.84rem', fontWeight: 600, color: INK, background: 'none', border: 'none',
        width: '100%', textAlign: 'left', padding: '12px 16px', cursor: 'pointer',
    };

    return (
        <header className="flex flex-col gap-3 min-w-0">
            <nav aria-label="Breadcrumb" className="hidden sm:block">
                <ol className="flex flex-wrap items-center gap-3" style={{ ...sans, fontSize: '0.8rem', color: MUTED }}>
                    <li>Admin Portal</li>
                    <li aria-hidden="true">/</li>
                    <li>
                        <button type="button" onClick={onBack} className="hover:underline"
                            style={{ ...sans, fontSize: '0.8rem', color: MUTED, background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
                            User Management
                        </button>
                    </li>
                    <li aria-hidden="true">/</li>
                    <li aria-current="page" style={{ color: PRIMARY, fontWeight: 600 }}>Scholar Portfolio</li>
                </ol>
            </nav>
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 lg:gap-8">
                <div className="min-w-0 flex-1">
                    <h1 style={{ ...serif, fontSize: 'clamp(1.5rem, 4.5vw, 1.9rem)', fontWeight: 600, color: INK, lineHeight: 1.15 }}>
                        Scholar Portfolio
                    </h1>
                    <p style={{ ...sans, fontSize: '0.84rem', color: MUTED, marginTop: 6, lineHeight: 1.55, maxWidth: 560 }}>
                        Academic, compliance, attendance, submission, and risk records for this scholar.
                    </p>
                </div>

                <div ref={menuRef} className="sm:hidden relative flex items-center gap-2.5">
                    <button type="button" onClick={onRemind} disabled={reminding}
                        className="flex-1 flex items-center justify-center gap-2 px-5 transition-opacity hover:opacity-90"
                        style={primaryBtn}>
                        <Bell size={14} className="flex-shrink-0" /> {reminding ? 'Sending…' : 'Send Reminder'}
                    </button>
                    <button type="button" aria-label="More actions" aria-haspopup="menu" aria-expanded={menuOpen}
                        onClick={() => setMenuOpen(o => !o)}
                        className="flex items-center justify-center flex-shrink-0 transition-colors hover:bg-[rgba(109,33,64,0.08)]"
                        style={{ ...secondaryBtn, width: 40, padding: 0 }}>
                        <MoreHorizontal size={18} />
                    </button>

                    {menuOpen && (
                        <div role="menu" className="absolute right-0 top-full mt-2 z-20 w-60 overflow-hidden" style={cardStyle}>
                            <button type="button" role="menuitem" onClick={run(onBack)}
                                className="flex items-center gap-2.5 transition-colors hover:bg-[rgba(109,33,64,0.06)]" style={menuItem}>
                                Back to User Management
                            </button>
                            <div style={{ height: 1, background: BORDER }} />
                            <button type="button" role="menuitem" onClick={run(onExport)}
                                className="flex items-center gap-2.5 transition-colors hover:bg-[rgba(109,33,64,0.06)]" style={menuItem}>
                                <Download size={15} style={{ color: PRIMARY }} /> Export Excel
                            </button>
                            <button type="button" role="menuitem" onClick={run(onExportPdf)}
                                className="flex items-center gap-2.5 transition-colors hover:bg-[rgba(109,33,64,0.06)]" style={menuItem}>
                                <FileText size={15} style={{ color: PRIMARY }} /> Export PDF
                            </button>
                        </div>
                    )}
                </div>

                <div className="hidden sm:grid sm:grid-cols-3 lg:flex gap-2.5 lg:flex-shrink-0">
                    <button type="button" onClick={onExport}
                        className="flex items-center justify-center gap-2 px-4 min-w-0 transition-colors hover:bg-[rgba(109,33,64,0.08)]"
                        style={secondaryBtn}>
                        <Download size={14} className="flex-shrink-0" /> Export Excel
                    </button>
                    <button type="button" onClick={onExportPdf}
                        className="flex items-center justify-center gap-2 px-4 min-w-0 transition-colors hover:bg-[rgba(109,33,64,0.08)]"
                        style={secondaryBtn}>
                        <FileText size={14} className="flex-shrink-0" /> Export PDF
                    </button>
                    <button type="button" onClick={onRemind} disabled={reminding}
                        className="flex items-center justify-center gap-2 px-5 transition-opacity hover:opacity-90"
                        style={primaryBtn}>
                        <Bell size={14} className="flex-shrink-0" /> {reminding ? 'Sending…' : 'Send Reminder'}
                    </button>
                </div>
            </div>
        </header>
    );
};

// ─── Main ──────────────────────────────────────────────────────
const ScholarProfileView = () => {
    const { id } = useParams();
    const navigate = useNavigate();

    const [activeTab, setActiveTab]         = useState('overview');
    const [profile, setProfile]             = useState(null);
    const [submissions, setSubmissions]     = useState([]);
    const [attendance, setAttendance]       = useState([]);
    const [grades, setGrades]               = useState([]);
    const [compliance, setCompliance]       = useState(null);
    const [loading, setLoading]             = useState(true);
    const [expandedSem, setExpandedSem]     = useState(null);
    const [expandedComplianceEntry, setExpandedComplianceEntry] = useState(null);
    const [filePreview, setFilePreview] = useState(null);
    const [complianceTypeFilter, setComplianceTypeFilter] = useState('all');
    const [complianceStatusFilter, setComplianceStatusFilter] = useState('all');
    const [selectedLetterMonth, setSelectedLetterMonth] = useState('all');
    const [letterPdfLoadingId, setLetterPdfLoadingId] = useState(null);
    const [letterPdfError, setLetterPdfError] = useState('');
    const [reminding, setReminding] = useState(false);
    const [flaggedRecord, setFlaggedRecord] = useState(null);
    const [profileError, setProfileError]   = useState('');
    const [failedSections, setFailedSections] = useState([]);

    const fetchAll = async () => {
        setProfile(null); setSubmissions([]); setAttendance([]);
        setGrades([]); setCompliance(null);
        setExpandedComplianceEntry(null);
        setComplianceTypeFilter('all'); setComplianceStatusFilter('all');
        setSelectedLetterMonth('all'); setFilePreview(null); setLetterPdfError('');
        setProfileError(''); setFailedSections([]);
        setLoading(true); setActiveTab('overview');
        try {
            const [pR, sR, aR, gR, cR] = await Promise.allSettled([
                axios.get(`${ADMIN_API}/scholars/${id}/profile`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }),
                axios.get(`${ADMIN_API}/scholars/${id}/submissions`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }),
                axios.get(`${ADMIN_API}/scholars/${id}/attendance`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }),
                axios.get(`${ADMIN_API}/scholars/${id}/grades`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }),
                axios.get(`${ADMIN_API}/scholars/${id}/compliance-summary`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }),
            ]);
            if (pR.status === 'fulfilled') setProfile(pR.value.data);
            if (sR.status === 'fulfilled') setSubmissions(sR.value.data);
            if (aR.status === 'fulfilled') setAttendance(aR.value.data);
            if (gR.status === 'fulfilled') setGrades(gR.value.data);
            if (cR.status === 'fulfilled') setCompliance(cR.value.data);

            // Surface failures (display only; requests are unchanged)
            if (pR.status === 'rejected') {
                setProfileError(pR.reason?.response?.data?.error || pR.reason?.message || 'The profile request failed.');
            }
            setFailedSections([
                sR.status === 'rejected' && 'Submissions',
                aR.status === 'rejected' && 'Attendance',
                gR.status === 'rejected' && 'Grades',
                cR.status === 'rejected' && 'Compliance summary',
            ].filter(Boolean));

            if (pR.status === 'fulfilled') {
                const token = localStorage.getItem('token');
                const flaggedResponse = await axios.get(`${API_BASE}/flagged/scholars`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const scholarId = pR.value.data.scholar_id;
                setFlaggedRecord((flaggedResponse.data || []).find(item => item.scholar_id === scholarId) || null);
            }
        } catch (e) {
            console.error(e);
            setFailedSections(prev => (prev.includes('Flagged risk record') ? prev : [...prev, 'Flagged risk record']));
        }
        finally { setLoading(false); }
    };

    useEffect(() => {
        // Refresh the selected scholar's profile whenever the route changes.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        fetchAll();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    useEffect(() => {
        if (!profile) return undefined;

        let stopped = false;
        let refreshing = false;
        const refreshSubmissionMetrics = async () => {
            if (refreshing || document.visibilityState === 'hidden') return;
            refreshing = true;
            const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` };
            const [submissionsResult, gradesResult] = await Promise.allSettled([
                axios.get(`${ADMIN_API}/scholars/${id}/submissions`, { headers }),
                axios.get(`${ADMIN_API}/scholars/${id}/grades`, { headers }),
            ]);
            refreshing = false;
            if (stopped) return;

            if (submissionsResult.status === 'fulfilled') {
                setSubmissions(submissionsResult.value.data);
                setFailedSections(prev => prev.filter(section => section !== 'Submissions'));
            } else {
                console.error('Unable to refresh scholar submissions:', submissionsResult.reason);
                setFailedSections(prev => prev.includes('Submissions') ? prev : [...prev, 'Submissions']);
            }

            if (gradesResult.status === 'fulfilled') {
                setGrades(gradesResult.value.data);
                setFailedSections(prev => prev.filter(section => section !== 'Grades'));
            } else {
                console.error('Unable to refresh scholar grades:', gradesResult.reason);
                setFailedSections(prev => prev.includes('Grades') ? prev : [...prev, 'Grades']);
            }
        };
        const refreshInterval = window.setInterval(refreshSubmissionMetrics, 30_000);
        document.addEventListener('visibilitychange', refreshSubmissionMetrics);
        window.addEventListener('focus', refreshSubmissionMetrics);

        return () => {
            stopped = true;
            window.clearInterval(refreshInterval);
            document.removeEventListener('visibilitychange', refreshSubmissionMetrics);
            window.removeEventListener('focus', refreshSubmissionMetrics);
        };
    }, [id, profile]);

    const handleExportExcel = () => {
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{
            'Scholar ID': profile?.scholar_id, 'Full Name': profile?.full_name,
            'Email': profile?.email, 'Year Level': formatYearLevelLabel(profile?.year_level), 'Status': profile?.status,
        }]), 'Profile');
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
            grades.flatMap(sem => (sem.subjects || []).map(s => ({
                Semester: sem.semester, 'Acad Year': sem.academic_year,
                Subject: s.subject_name, Units: s.units, Grade: s.grade, 'Grade Scale': sem.grade_scale,
                'Average Grade': sem.gwa,
                'Review Status': sem.verification_status, 'Academic Outcome': sem.academic_outcome,
            })))
        ), 'Grades');
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
            submissions.map(s => ({
                Date: formatAdminDate(s.submitted_at),
                Type: getSubmissionTypeLabel(s),
                'Letter Quality Score': isLetterSubmission(s) ? s.quality_score : '',
                Sentiment: isLetterSubmission(s) ? s.sentiment_label : '',
                Status: s.status,
                'Staff Comment': s.staff_comment || '',
                'Service Activity': s.service_activity || '',
                'Service Hours': s.service_hours ?? '',
                Attachments: [
                    s.report_card_path && 'Report Card / Grades',
                    s.cor_path && 'Certificate of Registration',
                    s.media_paths && 'Other Document',
                ].filter(Boolean).join(', '),
            }))
        ), 'Submissions');
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
            attendance.map(record => ({
                'Duty Date': formatAdminDate(record.duty_date),
                Duty: record.title,
                Location: record.location || '',
                Status: record.status,
                Method: record.method || '',
                'Recorded At': record.marked_at || '',
                'Checked Out At': record.check_out_at || '',
                'Makeup Duty': Number(record.is_makeup) === 1 ? 'Yes' : 'No',
                'Verified Duty Hours': getDutyHours(record),
            }))
        ), 'Attendance');
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{
            'Overall Compliance': complianceRate ?? '',
            'Risk Level': risk.level,
            'Risk Score': riskScore ?? '',
            'Attendance Rate': attRate ?? '',
            'Present Duties': attSummary.present ?? 0,
            'Late Duties': attSummary.late ?? 0,
            'Absent Duties': attSummary.absent ?? 0,
            'Excused Duties': attSummary.excused ?? 0,
            'Compliance Service Hours': totalService,
            'Approved Submissions': approvedSubs,
            'Total Submissions': totalSubs,
            'Approved Semesters': passedSems,
            'Total Semesters': totalSems,
        }]), 'Compliance');
        XLSX.writeFile(wb, `${profile?.scholar_id}_profile.xlsx`);
        axios.post(`${EXPORT_API}/google-sheets`, { log_only: true, module: 'Scholar Profile', report_resource: 'Scholar Profile Export', spreadsheet_title: 'Scholar Profile Export', details: `${profile?.scholar_id}_profile.xlsx` }, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }).catch(() => {});
    };

    const handleRemind = async () => {
        setReminding(true);
        try {
            const token = localStorage.getItem('token');
            const response = await axios.post(`${API_BASE}/flagged/scholars/${profile.scholar_id}/remind`, {}, {
                headers: { Authorization: `Bearer ${token}` },
            });
            alert(response.data.message || 'Reminder sent successfully.');
        } catch (error) {
            alert(error.response?.data?.error || 'Unable to send reminder.');
        } finally {
            setReminding(false);
        }
    };

    const handleViewLetterPdf = async (submission) => {
        if (!submission.id) {
            setLetterPdfError('This monthly letter has no submission ID, so its PDF cannot be opened.');
            return;
        }

        setLetterPdfLoadingId(submission.id);
        setLetterPdfError('');
        try {
            const token = localStorage.getItem('token');
            const { data } = await axios.get(`${API_BASE}/submission/generate-pdf/${submission.id}?regenerate=1`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!data?.path) throw new Error('The PDF file path was not returned.');
            setFilePreview({
                url: `${API_BASE}/submission/preview?url=${encodeURIComponent(data.path)}`,
                kind: 'pdf',
                label: `Monthly Letter · ${formatAdminDate(submission.submitted_at)}`,
            });
        } catch (error) {
            console.error('Unable to open monthly letter PDF:', error);
            setLetterPdfError(error.response?.data?.error || error.message || 'Unable to open the monthly letter PDF.');
        } finally {
            setLetterPdfLoadingId(null);
        }
    };

    // Safe views of the compliance payload (empty objects when missing)
    const attSummary = compliance?.attendance || {};
    const svcSummary = compliance?.community_service || {};
    const svcItems   = svcSummary.items || [];
    const monthlyLetters = submissions.filter(submission => {
        const type = String(submission.submission_type || '').toLowerCase();
        return (type === 'letter' || !type)
            && String(submission.letter_content || '').trim().length > 0;
    });
    const availableLetterMonths = Array.from(new Set(
        monthlyLetters.map(letter => getSubmissionMonthKey(letter.submitted_at)).filter(Boolean),
    )).sort((a, b) => b.localeCompare(a));
    const findSemesterFor = (submission) => (
        isGradeSubmission(submission)
            ? grades.find(semester => semester.proof_path && semester.proof_path === submission.report_card_path) || null
            : null
    );
    const matchedSemesters = new Set(submissions.map(findSemesterFor).filter(Boolean));
    const complianceEntries = [
        ...submissions
            .filter(submission => matchesDocumentType(submission, complianceTypeFilter))
            .filter(submission => !isLetterSubmission(submission)
                || selectedLetterMonth === 'all'
                || getSubmissionMonthKey(submission.submitted_at) === selectedLetterMonth)
            .map(submission => {
                const semester = findSemesterFor(submission);
                return {
                    key: `sub-${submission.id}`,
                    kind: 'submission',
                    date: submission.submitted_at,
                    status: semester?.verification_status || submission.status,
                    submission,
                    semester,
                };
            })
            .filter(entry => matchesComplianceStatus(entry.status, complianceStatusFilter)),
        ...((complianceTypeFilter === 'all' || complianceTypeFilter === 'grades')
            ? grades
                .filter(semester => !matchedSemesters.has(semester)
                    && matchesComplianceStatus(semester.verification_status, complianceStatusFilter))
                .map((semester, index) => ({
                    key: `sem-${index}`,
                    kind: 'academic',
                    date: semester.submitted_at || semester.verified_at || semester.created_at || null,
                    status: semester.verification_status || 'pending',
                    semester,
                }))
            : []),
    ].sort((a, b) => {
        const aTime = a.date ? new Date(a.date).getTime() : NaN;
        const bTime = b.date ? new Date(b.date).getTime() : NaN;
        if (Number.isNaN(aTime) && Number.isNaN(bTime)) return 0;
        if (Number.isNaN(aTime)) return 1;
        if (Number.isNaN(bTime)) return -1;
        return bTime - aTime;
    });
    const entryCounts = complianceEntries.reduce((counts, entry) => {
        const status = String(entry.status || 'pending').toLowerCase();
        if (['approved', 'archived'].includes(status)) counts.approved += 1;
        else if (status === 'rejected') counts.rejected += 1;
        else counts.pending += 1;
        return counts;
    }, { approved: 0, pending: 0, rejected: 0 });
    const filtersActive = complianceTypeFilter !== 'all'
        || complianceStatusFilter !== 'all'
        || selectedLetterMonth !== 'all';
    const letterSubmissions = submissions.filter(isLetterSubmission);
    const latestLetterSubmission = letterSubmissions.reduce((latest, submission) => {
        if (!latest) return submission;
        const submissionTime = submission.submitted_at ? new Date(submission.submitted_at).getTime() : NaN;
        const latestTime = latest.submitted_at ? new Date(latest.submitted_at).getTime() : NaN;
        return Number.isFinite(submissionTime) && (!Number.isFinite(latestTime) || submissionTime > latestTime)
            ? submission
            : latest;
    }, null);
    const monthlyLetterScore = latestLetterSubmission?.quality_score == null
        || !Number.isFinite(Number(latestLetterSubmission.quality_score))
        ? null
        : Number(latestLetterSubmission.quality_score);

    const totalService    = compliance?.community_service?.total_hours || 0;
    const attRate         = compliance?.attendance?.rate ?? null;
    const passedSems      = compliance?.academic?.passed_sems || 0;
    const totalSems       = compliance?.academic?.total_sems || 0;
    const approvedSubs    = compliance?.report_submissions?.approved || 0;
    const totalSubs       = compliance?.report_submissions?.total || 0;

    const rawComplianceRate = flaggedRecord?.overall_compliance ?? compliance?.overall_compliance;
    const complianceRate = rawComplianceRate == null ? null : Number(rawComplianceRate);
    const riskLevel = String(flaggedRecord?.risk_level || compliance?.risk_level || '').toLowerCase();
    const riskScore = flaggedRecord?.risk_score ?? compliance?.risk_score ?? null;
    const risk = {
        level: riskLevel === 'high' ? 'High Risk'
            : riskLevel === 'medium' ? 'Medium Risk'
                : riskLevel === 'low' ? 'Low Risk' : 'Unavailable',
        color: riskLevel === 'high' ? DANGER
            : riskLevel === 'medium' ? WARNING
                : riskLevel === 'low' ? SUCCESS : MUTED,
    };
    const liveFlags = flaggedRecord?.flags || [];
    const riskDeductions = flaggedRecord?.deductions
        ?? compliance?.compliance_points?.deductions
        ?? {};
    const riskBonuses = flaggedRecord?.bonuses
        ?? compliance?.compliance_points?.bonuses
        ?? {};
    const riskDeductionRows = [
        {
            label: 'Overdue required tasks',
            detail: `${riskDeductions.missedSubmission?.penalizedTasks || 0} penalized of ${riskDeductions.missedSubmission?.overdueTasks || 0} overdue`,
            points: riskDeductions.missedSubmission?.points,
        },
        {
            label: 'Late duty attendance',
            detail: `${riskDeductions.lateDuty?.lateCount || 0} instances`,
            points: riskDeductions.lateDuty?.points,
        },
        {
            label: 'Absent duty attendance',
            detail: `${riskDeductions.absentDuty?.absentCount || 0} instances`,
            points: riskDeductions.absentDuty?.points,
        },
        {
            label: 'Late submission gap',
            detail: riskDeductions.lateSubmission?.daysSinceSubmission == null
                ? 'No submission history'
                : `${riskDeductions.lateSubmission.daysSinceSubmission} days since last submission`,
            points: riskDeductions.lateSubmission?.points,
        },
        {
            label: 'Low submission quality',
            detail: riskDeductions.qualityDrop?.avgQuality == null
                ? 'No quality score'
                : `Average quality ${riskDeductions.qualityDrop.avgQuality}%`,
            points: riskDeductions.qualityDrop?.points,
        },
    ].filter(item => Number(item.points) > 0);
    const recoveryRows = [
        { label: 'Good maintenance recovery', points: riskDeductions.goodMaintenanceBonus?.points },
        { label: 'Early submission recovery', points: riskBonuses.earlySubmission },
        { label: 'Consecutive submission recovery', points: riskBonuses.consecutiveEarly },
        { label: 'Perfect attendance recovery', points: riskBonuses.perfectAttendance },
    ].filter(item => Number(item.points) > 0);
    const negativeSentimentMonthCount = flaggedRecord?.negative_sentiment_month_count == null
        ? null
        : Number(flaggedRecord.negative_sentiment_month_count);
    const negativeSentimentConsecutiveMonths = flaggedRecord?.negative_sentiment_consecutive_months == null
        ? null
        : Number(flaggedRecord.negative_sentiment_consecutive_months);
    const negativeSentimentSpreadMonthThreshold = Number(flaggedRecord?.negative_sentiment_spread_month_threshold) || 5;
    const negativeSentimentConsecutiveMonthThreshold = Number(flaggedRecord?.negative_sentiment_consecutive_month_threshold) || 3;
    const hasNegativeSentimentFlag = liveFlags.some(flag => String(flag.type || '').toLowerCase() === 'negative sentiment');

    const handleExportPdf = async () => {
        try {
            const { jsPDF } = await import('jspdf');
            const doc = new jsPDF({ unit: 'pt', format: 'a4' });
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();
            const margin = 48;
            const contentWidth = pageWidth - margin * 2;
            let y = margin;

            const ensureSpace = (height = 16) => {
                if (y + height > pageHeight - margin) {
                    doc.addPage();
                    y = margin;
                }
            };
            const addText = (value, { font = 'helvetica', style = 'normal', size = 9, color = [36, 21, 18], indent = 0 } = {}) => {
                doc.setFont(font, style);
                doc.setFontSize(size);
                doc.setTextColor(...color);
                const lines = doc.splitTextToSize(String(value ?? '—'), contentWidth - indent);
                for (const line of lines) {
                    ensureSpace(size + 6);
                    doc.text(line, margin + indent, y);
                    y += size + 6;
                }
            };
            const addSection = (title) => {
                ensureSpace(38);
                y += 10;
                doc.setFont('times', 'bold');
                doc.setFontSize(13);
                doc.setTextColor(109, 33, 64);
                doc.text(title, margin, y);
                y += 8;
                doc.setDrawColor(231, 216, 199);
                doc.line(margin, y, pageWidth - margin, y);
                y += 16;
            };
            const displayValue = (value) => value === undefined || value === null || value === '' ? '—' : String(value);

            doc.setFont('times', 'bold');
            doc.setFontSize(20);
            doc.setTextColor(109, 33, 64);
            doc.text('Scholar Portfolio', margin, y);
            y += 20;
            addText(`Generated ${formatAdminDate(new Date())}`, { size: 8, color: [138, 122, 104] });

            addSection('Scholar Information');
            [
                ['Name', profile.full_name],
                ['Scholar ID', profile.scholar_id],
                ['Email', profile.email],
                ['Year Level', formatYearLevelLabel(profile.year_level)],
                ['Status', profile.status],
                ['Scholarship', profile.scholarship_status],
            ].forEach(([label, value]) => addText(`${label}: ${displayValue(value)}`));

            addSection('Portfolio Summary');
            [
                ['Overall Compliance', complianceRate === null ? '—' : `${complianceRate} points`],
                ['Attendance Rate', attRate === null ? '—' : `${attRate}%`],
                ['Service Hours Reported', `${totalService} hours`],
                ['Latest Monthly Letter Score', monthlyLetterScore === null ? '—' : `${monthlyLetterScore}%`],
                ['Latest Grade Average', grades[0]?.gwa == null ? '—' : grades[0].gwa],
                ['Risk Level', risk.level],
                ['Risk Score', riskScore == null ? '—' : `${riskScore} points`],
            ].forEach(([label, value]) => addText(`${label}: ${displayValue(value)}`));

            addSection('Academic Records');
            if (grades.length === 0) addText('No academic records.');
            grades.forEach((semester) => {
                addText(`${semester.semester || 'Semester'} AY ${displayValue(semester.academic_year)} | Average: ${displayValue(semester.gwa)} (${displayValue(semester.grade_scale)}) | Review: ${displayValue(semester.verification_status)} | Outcome: ${displayValue(semester.academic_outcome)}`, { style: 'bold' });
                (semester.subjects || []).forEach((subject) => {
                    addText(`${displayValue(subject.subject_name)} | Units: ${displayValue(subject.units)} | Grade: ${displayValue(subject.grade)} (${displayValue(semester.grade_scale)})`, { size: 8, indent: 12 });
                });
            });

            addSection('Submission History');
            if (submissions.length === 0) addText('No submissions recorded.');
            submissions.forEach((submission) => {
                const isLetter = isLetterSubmission(submission);
                const details = [
                    formatAdminDate(submission.submitted_at),
                    getSubmissionTypeLabel(submission),
                    `Status: ${displayValue(submission.status)}`,
                    ...(isLetter && submission.quality_score != null ? [`Letter quality: ${displayValue(submission.quality_score)}%`] : []),
                    ...(isLetter ? [`Sentiment: ${displayValue(submission.sentiment_label)}`] : []),
                ];
                addText(details.join(' | '), { style: 'bold' });
                if (submission.staff_comment) addText(`Staff Comment: ${submission.staff_comment}`, { size: 8, indent: 12 });
                if (submission.service_hours != null) addText(`Service Hours: ${submission.service_hours}`, { size: 8, indent: 12 });
            });

            addSection('Attendance Records');
            if (attendance.length === 0) addText('No attendance records.');
            attendance.forEach((record) => {
                const details = [
                    record.title,
                    record.location,
                    `Status: ${displayValue(record.status)}`,
                    `Method: ${displayValue(record.method)}`,
                    `Recorded: ${displayValue(formatAdminTime(record.marked_at))}`,
                    `Check-out: ${displayValue(formatAdminTime(record.check_out_at))}`,
                    `Verified duty hours: ${formatDuration(getDutyHours(record))}`,
                    Number(record.is_makeup) === 1 ? 'Makeup duty' : null,
                ].filter(Boolean).join(' | ');
                addText(`${formatAdminDate(record.duty_date)} | ${details}`, { size: 8 });
            });

            addSection('Compliance Details');
            [
                ['Submissions Approved', `${approvedSubs} of ${totalSubs}`],
                ['Attendance', `${attSummary.present || 0} present, ${attSummary.late || 0} late, ${attSummary.absent || 0} absent, ${attSummary.excused || 0} excused out of ${attSummary.total || 0} duties`],
                ['Service Hours Reported', `${totalService} hours`],
                ['Academic Semesters Passed', `${passedSems} of ${totalSems}`],
            ].forEach(([label, value]) => addText(`${label}: ${value}`));
            svcItems.forEach((item) => addText(`Service Activity: ${displayValue(item.name)} — ${displayValue(item.hours)} hours`, { size: 8, indent: 12 }));
            if (liveFlags.length > 0) {
                addSection('Active Risk Flags');
                liveFlags.forEach((flag) => addText(`${displayValue(flag.type)}: ${displayValue(flag.description)}`));
            }

            const safeScholarId = String(profile.scholar_id || id || 'scholar').replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
            const filename = `${safeScholarId}_profile.pdf`;
            doc.save(filename);
            axios.post(`${EXPORT_API}/google-sheets`, {
                log_only: true,
                module: 'Scholar Profile',
                report_resource: 'Scholar Profile Export',
                spreadsheet_title: 'Scholar Profile Export',
                details: filename,
            }, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
                .catch((error) => console.error('Unable to log scholar profile PDF export:', error));
        } catch (error) {
            console.error('Failed to export scholar profile PDF:', error);
            alert('Unable to export the scholar profile PDF. Please try again.');
        }
    };

    const tabs = [
        { id: 'overview',       label: 'Overview',         icon: <Activity size={14} />            },
        { id: 'compliance',     label: 'Compliance',       icon: <ClipboardCheck size={14} />       },
        { id: 'attendance',     label: 'Attendance',       icon: <Calendar size={14} />             },
        { id: 'risk',           label: 'Risk',             icon: <Shield size={14} />               },
    ];

    // ── Loading skeleton ──
    if (loading) {
        const block = { background: '#EFE6D8', borderRadius: RADIUS };
        return (
            <div className="min-h-screen overflow-x-hidden" style={{ background: BG, ...sans }}>
                <div className="px-5 sm:px-8 pt-8 pb-8 flex flex-col gap-5">
                    <div>
                        <div className="animate-pulse h-3 w-28 rounded-full mb-3" style={{ background: `${BRONZE}30` }} />
                        <div className="animate-pulse h-8 w-64 max-w-full rounded-lg" style={{ background: `${PRIMARY}14` }} />
                    </div>
                    <div className="animate-pulse h-44" style={block} />
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {[0, 1, 2, 3].map(i => <div key={i} className="animate-pulse h-28" style={block} />)}
                    </div>
                    <div className="animate-pulse h-11 w-full max-w-xl rounded-full" style={{ background: '#EFE6D8' }} />
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                        <div className="animate-pulse h-64" style={block} />
                        <div className="animate-pulse h-64" style={block} />
                    </div>
                </div>
            </div>
        );
    }

    // ── Profile could not be loaded ──
    if (!profile) {
        return (
            <div className="min-h-screen flex items-center justify-center px-5" style={{ background: BG, ...sans }}>
                <div className="w-full max-w-md text-center p-8" style={cardStyle}>
                    <span className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: `${DANGER}14`, color: DANGER }}>
                        <AlertTriangle size={20} />
                    </span>
                    <h1 style={{ ...serif, fontSize: '1.3rem', fontWeight: 600, color: INK }}>
                        {profileError ? 'Unable to load this profile' : 'Scholar not found'}
                    </h1>
                    <p className="break-words" style={{ ...sans, fontSize: '0.84rem', color: MUTED, marginTop: 8, lineHeight: 1.6 }}>
                        {profileError
                            ? `${profileError} Please try again or return to User Management.`
                            : 'This scholar record is not available. Return to User Management and select another scholar.'}
                    </p>
                    <div className="flex flex-wrap justify-center gap-2.5 mt-6">
                        <button onClick={() => navigate('/admin/users')}
                            className="flex items-center gap-2 rounded-full transition-opacity hover:opacity-90"
                            style={{ ...sans, fontSize: '0.78rem', fontWeight: 700, color: '#fff', background: PRIMARY, border: 'none', padding: '10px 18px', cursor: 'pointer' }}>
                            <ArrowLeft size={14} /> Back to User Management
                        </button>
                        {profileError && (
                            <button onClick={fetchAll}
                                className="rounded-full transition-opacity hover:opacity-75"
                                style={{ ...sans, fontSize: '0.78rem', fontWeight: 600, color: PRIMARY, background: 'transparent', border: `1px solid ${PRIMARY}`, padding: '10px 18px', cursor: 'pointer' }}>
                                Try again
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    const statusColor = profile.status === 'active' ? SUCCESS : profile.status === 'flagged' ? DANGER : MUTED;

    return (
        <div className="min-h-screen overflow-x-hidden" style={{ background: BG, ...sans }}>
            <div className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-5 pb-14 flex flex-col gap-6">

                {/* ── Page header ── */}
                <PortfolioHeader
                    onBack={() => navigate('/admin/users')}
                    onExport={handleExportExcel}
                    onExportPdf={handleExportPdf}
                    onRemind={handleRemind}
                    reminding={reminding}
                />

                {/* ── Partial-load warning ── */}
                {failedSections.length > 0 && (
                    <div role="alert" className="flex items-start gap-3 rounded-xl px-4 py-3" style={{ background: `${WARNING}14`, border: `1px solid ${WARNING}45` }}>
                        <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" style={{ color: WARNING }} />
                        <p style={{ ...sans, fontSize: '0.8rem', color: '#8a6423', lineHeight: 1.5 }}>
                            Some records could not be loaded: {failedSections.join(', ')}. The related sections may be incomplete.
                            <button onClick={fetchAll} style={{ ...sans, fontSize: '0.8rem', fontWeight: 700, color: PRIMARY, background: 'none', border: 'none', cursor: 'pointer', marginLeft: 8, padding: 0 }}>Reload</button>
                        </p>
                    </div>
                )}

                {/* ── Scholar identity and key stats ── */}
                <section className="overflow-hidden" style={cardStyle}>
                    <div className="p-5 sm:p-7 flex items-start gap-4 sm:gap-5">
                        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center flex-shrink-0"
                            style={{ background: `linear-gradient(135deg, ${PRIMARY} 0%, ${PRIMARY_DEEP} 100%)` }}>
                            <span style={{ ...serif, color: '#fff', fontSize: '1.5rem', fontWeight: 600 }}>
                                {profile.full_name?.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                            </span>
                        </div>
                        <div className="min-w-0 flex-1">
                            <h2 className="break-words" style={{ ...serif, fontSize: 'clamp(1.3rem, 4vw, 1.6rem)', fontWeight: 600, color: INK, lineHeight: 1.2 }}>{profile.full_name}</h2>
                            <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-2.5">
                                {[[Hash, profile.scholar_id || '—'], [Mail, profile.email], [BookOpen, formatYearLevelLabel(profile.year_level)]].map(([Icon, value], index) => (
                                    <span key={index} className="flex items-center gap-1.5 min-w-0" style={{ ...sans, fontSize: '0.85rem', color: MUTED }}>
                                        <Icon size={14} className="flex-shrink-0" style={{ color: BRONZE }} />
                                        <span className="break-all">{value}</span>
                                    </span>
                                ))}
                            </div>
                            <div className="flex flex-wrap gap-2 mt-3.5">
                                {[
                                    [(profile.status || 'unknown').replace(/^./, c => c.toUpperCase()), statusColor],
                                    [profile.scholarship_status || 'Scholarship status not set', BRONZE],
                                    [risk.level, risk.color],
                                ].map(([text, color]) => (
                                    <span key={text} className="px-3 py-1 rounded-full" style={{ ...sans, fontSize: '0.75rem', fontWeight: 600, background: `${color}14`, color, border: `1px solid ${color}35` }}>{text}</span>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-px" style={{ background: BORDER, borderTop: `1px solid ${BORDER}` }}>
                        {[
                            { label: 'Compliance points', value: complianceRate === null ? '—' : Math.round(complianceRate), hint: 'Overall standing' },
                            { label: 'Attendance rate', value: attRate === null ? '—' : `${attRate}%`, hint: `${(attSummary.present || 0) + (attSummary.late || 0)} of ${attSummary.total || 0} duties` },
                            { label: 'Monthly letter score', value: monthlyLetterScore === null ? '—' : `${monthlyLetterScore}%`, hint: 'Latest letter' },
                            { label: grades[0] ? getGradeAverageLabel(grades[0]) : 'Average grade', value: grades[0]?.gwa == null ? '—' : Number(grades[0].gwa).toFixed(2), hint: grades[0] ? `${grades[0].semester} AY ${grades[0].academic_year}` : 'No grades yet' },
                        ].map((stat) => (
                            <div key={stat.label} className="p-4 sm:p-5 min-w-0" style={{ background: SURFACE }}>
                                <p className="truncate" style={{ ...sans, fontSize: '0.82rem', fontWeight: 500, color: MUTED }}>{stat.label}</p>
                                <p style={{ ...numeric, fontSize: 'clamp(1.5rem, 3.5vw, 2rem)', fontWeight: 600, color: INK, lineHeight: 1.1, marginTop: 8 }}>{stat.value}</p>
                                <p className="truncate" style={{ ...sans, fontSize: '0.78rem', color: MUTED, marginTop: 4 }}>{stat.hint}</p>
                            </div>
                        ))}
                    </div>
                </section>

                <div role="tablist" aria-label="Scholar portfolio sections" className="flex" style={{ borderBottom: `1px solid ${BORDER}` }}>
                    {tabs.map((tab) => {
                        const activeState = activeTab === tab.id;
                        return (
                            <button key={tab.id} role="tab" aria-selected={activeState} onClick={() => setActiveTab(tab.id)}
                                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-1.5 sm:px-5"
                                style={{ ...sans, height: 46, fontSize: '0.9rem', fontWeight: activeState ? 700 : 500, color: activeState ? PRIMARY : MUTED, background: 'none', border: 'none', borderBottom: `3px solid ${activeState ? PRIMARY : 'transparent'}`, marginBottom: -1, cursor: 'pointer', transition: 'color .15s, border-color .15s' }}>
                                <span className="hidden sm:inline-flex">{tab.icon}</span>{tab.label}
                            </button>
                        );
                    })}
                </div>

                {/* ── OVERVIEW ── */}
                {activeTab === 'overview' && (
                    <div className="flex flex-col gap-5">
                        <Panel icon={AlertTriangle} title="Risk summary" subtitle="Active flags, point deductions, and recovery.">
                            {liveFlags.length === 0 && riskDeductionRows.length === 0 && recoveryRows.length === 0 ? (
                                <EmptyNote>No active risk flags or point deductions.</EmptyNote>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    {[
                                        { title: 'Active flags', empty: 'No active risk flags.', rows: liveFlags.map((flag, index) => ({ key: `${flag.type}-${index}`, label: flag.type || 'Risk flag', detail: flag.description })) },
                                        { title: 'Deductions', empty: 'No point deductions.', rows: riskDeductionRows.map(row => ({ key: row.label, label: row.label, detail: row.detail, points: `−${Math.round(Number(row.points))} pts`, color: DANGER })) },
                                        { title: 'Recovery', empty: 'No recovery points.', rows: recoveryRows.map(row => ({ key: row.label, label: row.label, points: `+${Math.round(Number(row.points))} pts`, color: SUCCESS })) },
                                    ].map((column) => (
                                        <section key={column.title} className="min-w-0">
                                            <h4 style={{ ...serif, fontSize: '0.95rem', fontWeight: 600, color: INK, marginBottom: 8 }}>{column.title}</h4>
                                            {column.rows.length === 0 ? <p style={{ ...sans, fontSize: '0.82rem', color: MUTED }}>{column.empty}</p> : (
                                                <ul className="flex flex-col gap-2">
                                                    {column.rows.map((row) => (
                                                        <li key={row.key} className="flex items-start justify-between gap-3 rounded-lg px-3 py-2.5" style={{ background: BG }}>
                                                            <div className="min-w-0">
                                                                <p style={{ ...sans, fontSize: '0.84rem', fontWeight: 600, color: INK }}>{row.label}</p>
                                                                {row.detail && <p style={{ ...sans, fontSize: '0.78rem', color: MUTED, marginTop: 2 }}>{row.detail}</p>}
                                                            </div>
                                                            {row.points && <span className="flex-shrink-0 rounded-full px-2 py-0.5" style={{ ...sans, fontSize: '0.75rem', fontWeight: 700, color: row.color, background: `${row.color}12` }}>{row.points}</span>}
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                        </section>
                                    ))}
                                </div>
                            )}
                        </Panel>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
                            <Panel icon={BookOpen} title="Grades" subtitle="Most recent semesters.">
                                {grades.length === 0 ? <EmptyNote>No grades recorded yet.</EmptyNote> : grades.slice(0, 4).map((semester, index, list) => (
                                    <div key={index} className="py-3" style={{ borderBottom: index < list.length - 1 ? `1px solid ${BORDER}` : 'none' }}>
                                        <div className="flex items-baseline justify-between gap-3">
                                            <p style={{ ...sans, fontSize: '0.9rem', fontWeight: 600, color: INK }}>{semester.semester} AY {semester.academic_year}</p>
                                            <span style={{ ...numeric, fontSize: '1.1rem', fontWeight: 600, color: PRIMARY }}>{semester.gwa == null ? 'TBA' : Number(semester.gwa).toFixed(2)}</span>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2 mt-1.5">
                                            <span style={{ ...sans, fontSize: '0.78rem', color: MUTED }}>{semester.total_units} units</span>
                                            <StatusBadge status={semester.verification_status || 'pending'} />
                                            {semester.academic_outcome && <StatusBadge status={semester.academic_outcome} />}
                                        </div>
                                    </div>
                                ))}
                            </Panel>

                            <Panel icon={FileText} title="Recent submissions" subtitle="Latest scholar uploads.">
                                {submissions.length === 0 ? <EmptyNote>No submissions yet.</EmptyNote> : submissions.slice(0, 5).map((submission, index, list) => (
                                    <div key={submission.id} className="relative pl-5 pb-5 last:pb-0" style={{ borderLeft: index < list.length - 1 ? `1px solid ${BORDER}` : '1px solid transparent' }}>
                                        <span className="absolute rounded-full" style={{ width: 8, height: 8, left: -4.5, top: 6, background: isLetterSubmission(submission) ? getSentimentColor(submission.sentiment_label) : BORDER }} />
                                        <p style={{ ...sans, fontSize: '0.78rem', color: MUTED }}>{formatAdminDate(submission.submitted_at)}</p>
                                        <p style={{ ...sans, fontSize: '0.9rem', fontWeight: 600, color: INK, marginTop: 2 }}>{getSubmissionTypeLabel(submission)}</p>
                                        <div className="flex flex-wrap items-center gap-2 mt-1.5">
                                            {isLetterSubmission(submission) && submission.quality_score != null && (
                                                <span className="px-2 py-0.5 rounded-full" style={{ ...numeric, fontSize: '0.75rem', fontWeight: 600, background: `${getQualityColor(submission.quality_score)}14`, color: getQualityColor(submission.quality_score) }}>Letter quality {submission.quality_score}%</span>
                                            )}
                                            <StatusBadge status={submission.status} />
                                        </div>
                                    </div>
                                ))}
                            </Panel>
                        </div>

                        <Panel icon={Calendar} title="Duty attendance" subtitle="Totals and the three latest duties.">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                                {[
                                    ['Present', attSummary.present, SUCCESS],
                                    ['Late', attSummary.late, WARNING],
                                    ['Absent', attSummary.absent, DANGER],
                                    ['Excused', attSummary.excused, MUTED],
                                ].map(([label, count, color]) => (
                                    <div key={label} className="rounded-xl px-3.5 py-3" style={{ background: `${color}0F` }}>
                                        <p style={{ ...sans, fontSize: '0.78rem', color: MUTED }}>{label}</p>
                                        <p style={{ ...numeric, fontSize: '1.4rem', fontWeight: 600, color, marginTop: 2 }}>{count || 0}</p>
                                    </div>
                                ))}
                            </div>
                            {attendance.length === 0 ? <EmptyNote>No duty attendance records.</EmptyNote> : attendance.slice(0, 3).map((record, index, list) => (
                                <div key={record.id || `${record.duty_date}-${index}`} className="flex items-center justify-between gap-3 py-3" style={{ borderTop: `1px solid ${BORDER}`, borderBottom: index === list.length - 1 ? `1px solid ${BORDER}` : 'none' }}>
                                    <div className="min-w-0">
                                        <p className="truncate" style={{ ...sans, fontSize: '0.88rem', fontWeight: 600, color: INK }}>{record.title || 'Duty'}</p>
                                        <p style={{ ...sans, fontSize: '0.78rem', color: MUTED, marginTop: 2 }}>{formatAdminDate(record.duty_date)}{record.location ? ` · ${record.location}` : ''}</p>
                                    </div>
                                    <StatusBadge status={String(record.status || 'unknown').toLowerCase()} />
                                </div>
                            ))}
                        </Panel>
                    </div>
                )}

                {/* ── ACADEMIC TAB ── */}
                {activeTab === 'academic' && (
                    <div className="flex flex-col gap-4">
                        {grades.length === 0 ? (
                            <EmptyCard icon={BookOpen}>No grades recorded yet.</EmptyCard>
                        ) : grades.map((sem, si) => {
                            const key    = `${sem.semester}|${sem.academic_year}`;
                            const isOpen = expandedSem === key;
                            const subjects = sem.subjects || [];
                            return (
                                <div key={si} className="overflow-hidden" style={cardStyle}>
                                    <button onClick={() => setExpandedSem(isOpen ? null : key)}
                                        aria-expanded={isOpen}
                                        className="w-full flex items-center justify-between gap-4 px-5 sm:px-6 py-4 transition-colors text-left"
                                        style={{ background: isOpen ? BG : SURFACE, border: 'none', cursor: 'pointer' }}>
                                        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 min-w-0">
                                            <div>
                                                <p style={{ ...serif, fontSize: '0.98rem', fontWeight: 600, color: INK }}>{sem.semester} AY {sem.academic_year}</p>
                                                <p style={{ ...numeric, fontSize: '0.78rem', color: MUTED, marginTop: 2 }}>{sem.total_units} total units</p>
                                            </div>
                                            <div className="flex items-center gap-2.5">
                                                <span style={{ ...numeric, fontSize: '1.15rem', fontWeight: 600, color: PRIMARY }}>{sem.gwa == null ? 'TBA' : Number(sem.gwa).toFixed(2)}</span>
                                                <span style={{ ...sans, fontSize: '0.75rem', color: MUTED }}>{getGradeAverageLabel(sem)}</span>
                                                <StatusBadge status={sem.verification_status || 'pending'} />
                                                {sem.academic_outcome && <StatusBadge status={sem.academic_outcome} />}
                                            </div>
                                        </div>
                                        {isOpen ? <ChevronUp size={16} className="flex-shrink-0" style={{ color: BRONZE }} /> : <ChevronDown size={16} className="flex-shrink-0" style={{ color: BRONZE }} />}
                                    </button>
                                    {isOpen && (
                                        <div style={{ borderTop: `1px solid ${BORDER}` }}>
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-left" style={{ minWidth: 520 }}>
                                                    <thead>
                                                        <tr style={{ borderBottom: `1px solid ${BORDER}`, background: BG }}>
                                                            {['Subject', 'Units', 'Grade', 'Outcome'].map((h) => (
                                                                <th key={h} className="px-5 sm:px-6 py-3"
                                                                    style={{ ...sans, fontSize: '0.78rem', fontWeight: 600, color: MUTED }}>{h}</th>
                                                            ))}
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {subjects.map((subj, ji) => {
                                                            const grade = Number(subj.grade);
                                                            const gradeApproved = sem.verification_status === 'approved' && Number.isFinite(grade);
                                                            const passing = gradeApproved && isPassingGrade(grade, sem.grade_scale);
                                                            return (
                                                                <tr key={ji} style={{ borderBottom: ji < subjects.length - 1 ? `1px solid ${BORDER}` : 'none' }}>
                                                                    <td className="px-5 sm:px-6 py-3" style={{ ...sans, fontSize: '0.82rem', fontWeight: 500, color: INK }}>{subj.subject_name}</td>
                                                                    <td className="px-5 sm:px-6 py-3" style={{ ...numeric, fontSize: '0.8rem', color: MUTED }}>{subj.units}</td>
                                                                    <td className="px-5 sm:px-6 py-3">
                                                                        <span className="px-2.5 py-0.5 rounded-full" style={{
                                                                            ...numeric, fontSize: '0.8rem', fontWeight: 700,
                                                                            color: gradeApproved ? (passing ? SUCCESS : DANGER) : MUTED,
                                                                            background: `${gradeApproved ? (passing ? SUCCESS : DANGER) : MUTED}14`,
                                                                        }}>{Number.isFinite(grade) ? grade.toFixed(2) : '—'}</span>
                                                                    </td>
                                                                    <td className="px-5 sm:px-6 py-3">
                                                                        <StatusBadge status={gradeApproved ? (passing ? 'passed' : 'failed') : sem.verification_status || 'pending'} />
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                            {sem.proof_path && (
                                                <div className="px-5 sm:px-6 py-4" style={{ borderTop: `1px solid ${BORDER}` }}>
                                                    <button type="button" onClick={() => setFilePreview({ url: `${API_BASE}/submission/preview?url=${encodeURIComponent(sem.proof_path)}`, kind: fileKind(sem.proof_path), label: `Grade Proof - ${sem.semester} AY ${sem.academic_year}` })}
                                                        className="rounded-full transition-opacity hover:opacity-75"
                                                        style={{ ...sans, fontSize: '0.78rem', fontWeight: 700, color: PRIMARY, background: 'transparent', border: `1px solid ${PRIMARY}40`, padding: '8px 16px', cursor: 'pointer' }}>
                                                        View submitted grade proof
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* ── COMPLIANCE TAB ── */}
                {activeTab === 'compliance' && (
                    <Panel icon={ClipboardCheck} title="Compliance" subtitle="Everything this scholar submitted, newest first." padded={false}>
                        <div className="flex flex-col gap-4 px-5 sm:px-6 pb-6">
                            <div className={`grid grid-cols-1 gap-3 ${(complianceTypeFilter === 'all' || complianceTypeFilter === 'letters') ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
                                <label className="flex flex-col gap-1.5 min-w-0">
                                    <span style={{ ...sans, fontSize: '0.78rem', fontWeight: 600, color: MUTED }}>Document type</span>
                                    <select value={complianceTypeFilter}
                                        onChange={event => { setComplianceTypeFilter(event.target.value); setLetterPdfError(''); }}
                                        className={selectClass}
                                        style={selectStyle}>
                                        <option value="all">All compliance</option>
                                        <option value="grades">Grades / Report Card</option>
                                        <option value="cor">Certificate of Registration (COR)</option>
                                        <option value="letters">Monthly Letters</option>
                                        <option value="other">Other Documents</option>
                                    </select>
                                </label>
                                <label className="flex flex-col gap-1.5 min-w-0">
                                    <span style={{ ...sans, fontSize: '0.78rem', fontWeight: 600, color: MUTED }}>Status</span>
                                    <select value={complianceStatusFilter}
                                        onChange={event => setComplianceStatusFilter(event.target.value)}
                                        className={selectClass}
                                        style={selectStyle}>
                                        <option value="all">All statuses</option>
                                        <option value="approved">Approved</option>
                                        <option value="pending">Pending</option>
                                        <option value="rejected">Rejected</option>
                                    </select>
                                </label>
                                {(complianceTypeFilter === 'all' || complianceTypeFilter === 'letters') && (
                                    <label className="flex flex-col gap-1.5 min-w-0">
                                        <span style={{ ...sans, fontSize: '0.78rem', fontWeight: 600, color: MUTED }}>Letter month</span>
                                        <select value={selectedLetterMonth}
                                            onChange={event => { setSelectedLetterMonth(event.target.value); setLetterPdfError(''); }}
                                            className={selectClass}
                                            style={selectStyle}>
                                            <option value="all">All months</option>
                                            {availableLetterMonths.map(month => (
                                                <option key={month} value={month}>{formatSubmissionMonth(month)}</option>
                                            ))}
                                        </select>
                                    </label>
                                )}
                            </div>

                            <div className="flex flex-wrap items-center gap-2" style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 16 }}>
                                <span className="rounded-full px-2.5 py-1" style={{ ...sans, fontSize: '0.75rem', fontWeight: 700, background: `${MUTED}14`, color: MUTED }}>
                                    {complianceEntries.length} {complianceEntries.length === 1 ? 'item' : 'items'}
                                </span>
                                <span className="rounded-full px-2.5 py-1" style={{ ...sans, fontSize: '0.75rem', fontWeight: 700, background: `${SUCCESS}14`, color: SUCCESS }}>{entryCounts.approved} approved</span>
                                <span className="rounded-full px-2.5 py-1" style={{ ...sans, fontSize: '0.75rem', fontWeight: 700, background: `${WARNING}14`, color: WARNING }}>{entryCounts.pending} pending</span>
                                <span className="rounded-full px-2.5 py-1" style={{ ...sans, fontSize: '0.75rem', fontWeight: 700, background: `${DANGER}14`, color: DANGER }}>{entryCounts.rejected} rejected</span>
                                {filtersActive && (
                                    <button type="button"
                                        onClick={() => {
                                            setComplianceTypeFilter('all');
                                            setComplianceStatusFilter('all');
                                            setSelectedLetterMonth('all');
                                            setLetterPdfError('');
                                        }}
                                        className="w-full text-left hover:underline sm:ml-auto sm:w-auto"
                                        style={{ ...sans, fontSize: '0.78rem', fontWeight: 700, color: PRIMARY, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                                        Clear filters
                                    </button>
                                )}
                            </div>

                            {letterPdfError && (
                                <div role="alert" className="rounded-xl px-4 py-3" style={{ background: `${DANGER}12`, border: `1px solid ${DANGER}35`, color: DANGER, ...sans, fontSize: '0.8rem' }}>
                                    {letterPdfError}
                                </div>
                            )}

                            {complianceEntries.length === 0 ? (
                                <EmptyNote>
                                    {submissions.length === 0 && grades.length === 0
                                        ? 'No submissions recorded yet.'
                                        : 'No submissions match these filters.'}
                                </EmptyNote>
                            ) : (
                                <div className="flex flex-col gap-2.5">
                                    {complianceEntries.map(entry => {
                                        const isSubmission = entry.kind === 'submission';
                                        const submission = entry.submission;
                                        const semester = entry.semester;
                                        const Icon = isSubmission ? getEntryIcon(submission) : BookOpen;
                                        const title = isSubmission
                                            ? getSubmissionTypeLabel(submission)
                                            : `${semester.semester} AY ${semester.academic_year}`;
                                        const letter = isSubmission && isLetterSubmission(submission);
                                        const isOpen = expandedComplianceEntry === entry.key;

                                        return (
                                            <div key={entry.key} className="rounded-xl overflow-hidden" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
                                                <div className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
                                                    <div className="flex items-center gap-3 min-w-0 sm:flex-1">
                                                        <span className="flex items-center justify-center rounded-full flex-shrink-0" style={{ width: 34, height: 34, background: `${PRIMARY}0F`, color: PRIMARY }}>
                                                            <Icon size={15} />
                                                        </span>
                                                        <div className="min-w-0">
                                                            <p className="break-words" style={{ ...sans, fontSize: '0.84rem', fontWeight: 600, color: INK }}>{title}</p>
                                                            <p style={{ ...sans, fontSize: '0.78rem', color: MUTED, marginTop: 2 }}>
                                                                {entry.date ? formatAdminDate(entry.date) : 'No date recorded'}
                                                                {!isSubmission && ' · Academic record'}
                                                                {letter && submission.quality_score != null && (
                                                                    <span style={{ ...numeric, fontWeight: 700, color: getQualityColor(submission.quality_score) }}> · Letter score {submission.quality_score}%</span>
                                                                )}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    <div className="flex w-full flex-wrap items-center justify-start gap-2 sm:w-auto sm:justify-end">
                                                        {semester && (
                                                            <span style={{ ...numeric, fontSize: '0.98rem', fontWeight: 600, color: PRIMARY }}>
                                                                {formatGradeValue(semester.gwa, semester.grade_scale)}
                                                                <span style={{ ...sans, fontSize: '0.75rem', fontWeight: 400, color: MUTED }}> {getGradeAverageLabel(semester)}</span>
                                                            </span>
                                                        )}
                                                        <StatusBadge status={entry.status || 'pending'} />
                                                        {letter && (
                                                            <button type="button" onClick={() => handleViewLetterPdf(submission)}
                                                                disabled={letterPdfLoadingId !== null}
                                                                className="inline-flex items-center justify-center gap-2 transition-opacity hover:opacity-85"
                                                                style={{ ...sans, fontSize: '0.78rem', fontWeight: 700, color: '#fff', background: PRIMARY, border: `1px solid ${PRIMARY}`, borderRadius: 999, padding: '8px 14px', cursor: letterPdfLoadingId !== null ? 'wait' : 'pointer', opacity: letterPdfLoadingId !== null && String(letterPdfLoadingId) !== String(submission.id) ? 0.6 : 1 }}
                                                                aria-label={`View PDF for letter submitted ${formatAdminDate(submission.submitted_at)}`}>
                                                                <FileText size={14} />
                                                                {String(letterPdfLoadingId) === String(submission.id) ? 'Preparing PDF…' : 'View PDF'}
                                                            </button>
                                                        )}
                                                        {semester && (
                                                            <button type="button" aria-expanded={isOpen}
                                                                aria-label={isOpen ? 'Hide subjects' : 'Show subjects'}
                                                                onClick={() => setExpandedComplianceEntry(isOpen ? null : entry.key)}
                                                                className="flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-[rgba(109,33,64,0.08)] sm:h-8 sm:w-8"
                                                                style={{ background: 'transparent', border: `1px solid ${BORDER}`, color: BRONZE, cursor: 'pointer' }}>
                                                                {isOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                                                            </button>
                                                        )}
                                                        {isSubmission && isGradeSubmission(submission) && !semester && submission.report_card_path && (
                                                            <button type="button"
                                                                onClick={() => setFilePreview({
                                                                    url: `${API_BASE}/submission/preview?url=${encodeURIComponent(submission.report_card_path)}`,
                                                                    kind: fileKind(submission.report_card_path),
                                                                    label: `Grade Proof - ${formatAdminDate(submission.submitted_at)}`,
                                                                })}
                                                                className="max-w-full rounded-full text-center transition-opacity hover:opacity-75"
                                                                style={{ ...sans, fontSize: '0.7rem', fontWeight: 700, color: PRIMARY, background: 'transparent', border: `1px solid ${PRIMARY}40`, padding: '7px 13px', cursor: 'pointer' }}>
                                                                View submitted grade proof
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>

                                                {semester && isOpen && <AcademicDetails semester={semester} onPreview={setFilePreview} />}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </Panel>
                )}

                {/* ── SUBMISSIONS TAB ── */}
                {activeTab === 'submissions' && (
                    <div className="flex flex-col gap-4">
                        {submissions.length === 0
                            ? <EmptyCard icon={FileText}>No submissions recorded yet.</EmptyCard>
                            : submissions.map((sub) => {
                                const isLetter = isLetterSubmission(sub);
                                const attachmentItems = [
                                    ['Report Card / Grades', sub.report_card_path],
                                    ['Certificate of Registration', sub.cor_path],
                                    ['Other Document', sub.media_paths],
                                ].filter(([, path]) => Boolean(path));
                                return (
                                    <div key={sub.id} className="p-5 sm:p-6 min-w-0" style={cardStyle}>
                                        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                                            <div>
                                                <p style={{ ...serif, fontSize: '0.98rem', fontWeight: 600, color: INK }}>
                                                    {getSubmissionTypeLabel(sub)}
                                                </p>
                                                <p style={{ ...sans, fontSize: '0.78rem', color: MUTED, marginTop: 2 }}>
                                                    Submitted {formatAdminDate(sub.submitted_at)}
                                                </p>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {isLetter && sub.quality_score != null && (
                                                    <span className="px-2.5 py-1 rounded-full" style={{ ...numeric, fontSize: '0.75rem', fontWeight: 700, background: `${getSentimentColor(sub.sentiment_label)}14`, color: getSentimentColor(sub.sentiment_label) }}>
                                                        Letter Quality {sub.quality_score}%
                                                    </span>
                                                )}
                                                <StatusBadge status={sub.status} />
                                            </div>
                                        </div>
                                        {attachmentItems.length > 0 && (
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                                            {attachmentItems.map(([label]) => (
                                                <div key={label} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl min-w-0"
                                                    style={{ background: `${SUCCESS}0C`, border: `1px solid ${SUCCESS}30` }}>
                                                    <CheckCircle size={14} className="flex-shrink-0" style={{ color: SUCCESS }} />
                                                    <div className="min-w-0">
                                                        <p style={{ ...sans, fontSize: '0.75rem', fontWeight: 600, color: MUTED }}>{label}</p>
                                                        <p className="break-words" style={{ ...sans, fontSize: '0.76rem', fontWeight: 600, color: SUCCESS }}>Submitted</p>
                                                    </div>
                                                </div>
                                            ))}
                                            </div>
                                        )}
                                        {sub.service_activity && (
                                            <p className="mt-3" style={{ ...sans, fontSize: '0.78rem', color: MUTED }}>
                                                Service activity: {sub.service_activity}{sub.service_hours ? ` (${sub.service_hours} hrs)` : ''}
                                            </p>
                                        )}
                                        {sub.staff_comment && (
                                            <div className="mt-4 pt-4" style={{ borderTop: `1px solid ${BORDER}` }}>
                                                <MiniLabel>Staff feedback</MiniLabel>
                                                <p className="break-words" style={{ ...sans, fontSize: '0.82rem', color: INK, lineHeight: 1.55, marginTop: 4 }}>{sub.staff_comment}</p>
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        }
                    </div>
                )}

                {/* ── ATTENDANCE TAB ── */}
                {activeTab === 'attendance' && (
                    <Panel icon={Calendar} title="Attendance history" subtitle="Check-in/out records and verified duty hours. Incomplete makeup shifts are excluded from compliance rates." padded={false} action={
                        <div className="hidden sm:flex flex-wrap justify-end gap-2">
                            {[
                                ['Present', attSummary.present || 0, SUCCESS],
                                ['Late', attSummary.late || 0, WARNING],
                                ['Absent', attSummary.absent || 0, DANGER],
                                ['Excused', attSummary.excused || 0, MUTED],
                            ].map(([label, count, color]) => (
                                <span key={label} className="px-2.5 py-1 rounded-full" style={{ ...numeric, fontSize: '0.75rem', fontWeight: 700, background: `${color}14`, color }}>{count} {label}</span>
                            ))}
                        </div>
                    }>
                        {attendance.length === 0
                            ? <div className="px-6 pb-6"><EmptyNote>No attendance records yet.</EmptyNote></div>
                            : (
                                <div className="border-t" style={{ borderColor: BORDER }}>
                                    <div className="hidden xl:grid gap-4 px-6 py-3 xl:grid-cols-[100px_minmax(150px,1.3fr)_minmax(100px,0.8fr)_minmax(110px,0.9fr)_65px_minmax(130px,1.1fr)_90px]" style={{ background: BG, borderBottom: `1px solid ${BORDER}` }}>
                                        {['Duty date', 'Duty', 'Group', 'Marked by', 'Method', 'Recorded times', 'Status'].map(label => (
                                            <span key={label} style={{ ...sans, fontSize: '0.78rem', fontWeight: 600, color: MUTED }}>{label}</span>
                                        ))}
                                    </div>
                                    {attendance.map((att, i) => {
                                        const status = String(att.status || 'unknown').toLowerCase();
                                        const markedAt = formatAdminTime(att.marked_at);
                                        const checkedOutAt = formatAdminTime(att.check_out_at);
                                        const dutyHours = getDutyHours(att);
                                        const earnedHoursLabel = dutyHours > 0 ? `${formatDuration(dutyHours)} earned` : 'No verified hours';
                                        const markedBy = att.marked_by_name || (String(att.method || '').toLowerCase() === 'system' ? 'System' : 'Not recorded');
                                        return (
                                            <div key={att.id || `${att.duty_date}-${i}`} className="px-4 py-4 sm:px-6" style={{ borderBottom: i < attendance.length - 1 ? `1px solid ${BORDER}` : 'none' }}>
                                                <article className="xl:hidden rounded-xl p-4" style={{ background: BG, border: `1px solid ${BORDER}` }}>
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="min-w-0">
                                                            <p style={{ ...sans, fontSize: '0.78rem', fontWeight: 600, color: MUTED }}>{formatAdminDate(att.duty_date)}</p>
                                                            <h4 className="break-words mt-1" style={{ ...serif, fontSize: '1rem', fontWeight: 600, color: INK }}>{att.title || 'Duty'}</h4>
                                                            {att.location && <p className="mt-1 break-words" style={{ ...sans, fontSize: '0.8rem', color: MUTED }}>{att.location}</p>}
                                                        </div>
                                                        <StatusBadge status={status} />
                                                    </div>
                                                    <dl className="grid grid-cols-2 gap-x-4 gap-y-3 mt-4">
                                                        {[
                                                            ['Group', att.group_name || 'Unassigned'],
                                                            ['Marked by', markedBy],
                                                            ['Method', att.method || '—'],
                                                            ['Marked by role', att.marked_by_role ? `${String(att.marked_by_role).charAt(0).toUpperCase()}${String(att.marked_by_role).slice(1)}` : '—'],
                                                            ['Check-in / out', `${markedAt || '—'} / ${checkedOutAt || '—'}`],
                                                            ['Verified hours', `${dutyHours > 0 ? formatDuration(dutyHours) : 'None'}${Number(att.is_makeup) === 1 ? ' · Makeup' : ''}`],
                                                        ].map(([label, value]) => (
                                                            <div key={label} className="min-w-0">
                                                                <dt style={{ ...sans, fontSize: '0.75rem', fontWeight: 600, color: MUTED }}>{label}</dt>
                                                                <dd className="break-words mt-0.5" style={{ ...sans, fontSize: '0.84rem', color: INK }}>{value}</dd>
                                                            </div>
                                                        ))}
                                                    </dl>
                                                </article>
                                                <div className="hidden xl:grid gap-4 items-center xl:grid-cols-[100px_minmax(150px,1.3fr)_minmax(100px,0.8fr)_minmax(110px,0.9fr)_65px_minmax(130px,1.1fr)_90px]">
                                                    <p style={{ ...sans, fontSize: '0.8rem', color: MUTED }}>{formatAdminDate(att.duty_date)}</p>
                                                    <p className="break-words" style={{ ...sans, fontSize: '0.86rem', fontWeight: 600, color: INK }}>{att.title || 'Duty'}{att.location ? ` · ${att.location}` : ''}</p>
                                                    <p className="break-words" style={{ ...sans, fontSize: '0.8rem', color: INK }}>{att.group_name || 'Unassigned'}</p>
                                                    <div className="min-w-0">
                                                        <p className="break-words" style={{ ...sans, fontSize: '0.8rem', color: INK }}>{markedBy}</p>
                                                        {att.marked_by_role && <p className="mt-0.5" style={{ ...sans, fontSize: '0.75rem', color: MUTED }}>{String(att.marked_by_role).charAt(0).toUpperCase() + String(att.marked_by_role).slice(1)}</p>}
                                                    </div>
                                                    <p className="break-words" style={{ ...sans, fontSize: '0.8rem', color: MUTED }}>{att.method || '—'}</p>
                                                    <p className="break-words" style={{ ...sans, fontSize: '0.8rem', color: MUTED }}>
                                                        {markedAt || '—'} / {checkedOutAt || '—'} · {earnedHoursLabel}{Number(att.is_makeup) === 1 ? ' · Makeup' : ''}
                                                    </p>
                                                    <StatusBadge status={status} />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )
                        }
                    </Panel>
                )}

                {/* RISK TAB */}
                {activeTab === 'risk' && (
                    <div className="flex flex-col gap-5">
                        <div className="p-6 sm:p-7" style={cardStyle}>
                            <MiniLabel>Compliance points</MiniLabel>
                            <p style={{ ...numeric, fontSize: '1.7rem', fontWeight: 600, color: INK, marginTop: 2 }}>
                                {complianceRate == null ? '\u2014' : `${Math.round(complianceRate)} pts`}
                            </p>
                        </div>

                        <Panel icon={TrendingUp} title="Risk Deductions" subtitle="Compliance-point deductions from recorded issues.">
                            {riskDeductionRows.length === 0
                                ? <EmptyNote>No compliance point deductions recorded.</EmptyNote>
                                : <div className="flex flex-col gap-3">
                                    {riskDeductionRows.map(row => (
                                        <div key={row.label} className="flex items-center justify-between gap-3 rounded-xl p-3" style={{ background: BG, border: `1px solid ${BORDER}` }}>
                                            <div>
                                                <p style={{ ...sans, fontSize: '0.76rem', fontWeight: 600, color: INK }}>{row.label}</p>
                                                <p style={{ ...sans, fontSize: '0.78rem', color: MUTED, marginTop: 2 }}>{row.detail}</p>
                                            </div>
                                            <span className="flex-shrink-0 rounded-full px-2.5 py-1" style={{ ...numeric, fontSize: '0.75rem', fontWeight: 700, color: DANGER, background: `${DANGER}12` }}>
                                                −{Math.round(Number(row.points))} pts
                                            </span>
                                        </div>
                                    ))}
                                </div>}
                        </Panel>

                        <Panel icon={Shield} title="Negative Sentiment Review" subtitle="A separate review flag; negative sentiment does not deduct compliance points.">
                            {negativeSentimentMonthCount == null || negativeSentimentConsecutiveMonths == null
                                ? <EmptyNote>Sentiment review data is unavailable for this scholar.</EmptyNote>
                                : <div className="flex flex-col gap-3">
                                    <div className="flex items-center justify-between gap-3 rounded-xl p-3" style={{ background: BG, border: `1px solid ${BORDER}` }}>
                                        <div>
                                            <p style={{ ...sans, fontSize: '0.76rem', fontWeight: 600, color: INK }}>Negative months this account year</p>
                                            <p style={{ ...sans, fontSize: '0.78rem', color: MUTED, marginTop: 2 }}>Distinct months with at least one negative letter</p>
                                        </div>
                                        <span style={{ ...numeric, fontSize: '0.78rem', fontWeight: 700, color: DANGER }}>
                                            {negativeSentimentMonthCount}/{negativeSentimentSpreadMonthThreshold}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between gap-3 rounded-xl p-3" style={{ background: BG, border: `1px solid ${BORDER}` }}>
                                        <div>
                                            <p style={{ ...sans, fontSize: '0.76rem', fontWeight: 600, color: INK }}>Consecutive negative months</p>
                                            <p style={{ ...sans, fontSize: '0.78rem', color: MUTED, marginTop: 2 }}>Longest consecutive monthly run this account year</p>
                                        </div>
                                        <span style={{ ...numeric, fontSize: '0.78rem', fontWeight: 700, color: DANGER }}>
                                            {negativeSentimentConsecutiveMonths}/{negativeSentimentConsecutiveMonthThreshold}
                                        </span>
                                    </div>
                                    <p style={{ ...sans, fontSize: '0.78rem', fontWeight: 600, color: hasNegativeSentimentFlag ? DANGER : SUCCESS }}>
                                        {hasNegativeSentimentFlag ? 'Negative sentiment review flag active' : 'No negative sentiment review flag'}
                                    </p>
                                </div>}
                        </Panel>
                    </div>
                )}

                {filePreview && (
                    <FilePreviewModal
                        preview={filePreview}
                        onClose={() => setFilePreview(null)}
                    />
                )}
            </div>
        </div>
    );
};

export default ScholarProfileView;