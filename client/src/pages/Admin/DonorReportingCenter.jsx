import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  Users, Download, X, HeartHandshake, FileText,
  Search, ChevronLeft, ChevronRight, AlertTriangle,
} from 'lucide-react';
import { formatAdminMonth, getAdminPageSize } from '../../utils/adminPreferences';
import AdminPageHeader from '../../components/Admin/AdminPageHeader';

/**
 * DEPENDENCIES — install if not already present:
 *   npm install lucide-react
 *
 * FONTS — add to index.html <head>:
 *   <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
 */

const API_BASE = (import.meta.env?.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
const API = API_BASE.endsWith('/api') ? API_BASE : `${API_BASE}/api`;
const authHeaders = () => ({
  headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
});

// ---------------------------------------------------------------------------
// Design tokens
// ---------------------------------------------------------------------------
const BG = '#F7F4EE';
const SURFACE = '#FFFDF9';
const BORDER = '#E7D8C7';
const PRIMARY = '#6D2140';
const PRIMARY_DEEP = '#4A1730';
const INK = '#241512';
const MUTED = '#8A7A68';
const BRONZE = '#A9784E';
const SUCCESS = '#6B8F71';
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

const YEAR_LEVEL_ORDER = [
  'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12',
  '1st Year College', '2nd Year College', '3rd Year College', '4th Year College', '5th Year College',
];

const DOCUMENT_TASK_LABELS = {
  'Monthly Report': 'Monthly Letter',
  'COR Upload': 'COR',
  'Report Card': 'Grades',
  'Other Documents': 'Other Document',
};
const DOCUMENT_TASK_ORDER = ['Monthly Report', 'COR Upload', 'Report Card', 'Other Documents'];
const SCHOLAR_REPORT_DOCUMENT_CATEGORIES = ['Monthly Letter', 'Grades', 'COR', 'Other Documents'];

const formatYearLevel = (value) => {
  if (!value) return '—';
  const normalized = String(value).trim().toLowerCase().replace(/_/g, ' ');
  const aliasMap = {
    'grade 7': 'Grade 7',
    'grade 8': 'Grade 8',
    'grade 9': 'Grade 9',
    'grade 10': 'Grade 10',
    'grade 11': 'Grade 11',
    'grade 12': 'Grade 12',
    '1st year college': '1st Year College',
    '2nd year college': '2nd Year College',
    '3rd year college': '3rd Year College',
    '4th year college': '4th Year College',
    '5th year college': '5th Year College',
  };
  return aliasMap[normalized] || value;
};

const buildScholarSubmissionFilename = ({ month, yearLevel, complianceType, scholarName, filePath, contentType }) => {
  const [year, monthNumber] = String(month || '').split('-').map(Number);
  const monthName = year && monthNumber
    ? new Intl.DateTimeFormat('en-US', { month: 'long' }).format(new Date(year, monthNumber - 1, 1))
    : 'Month';
  const nameParts = String(scholarName || 'Scholar').trim().split(/\s+/).filter(Boolean);
  const commaNameParts = String(scholarName || '').split(',');
  const surnameFirstName = scholarName?.includes(',')
    ? `${commaNameParts[0]} ${commaNameParts.slice(1).join(' ')}`
    : nameParts.length > 1
      ? `${nameParts[nameParts.length - 1]} ${nameParts.slice(0, -1).join(' ')}`
      : nameParts[0] || 'Scholar';
  const safePart = (value) => String(value || '')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
  const sourceExtension = String(filePath || '').split(/[?#]/)[0].match(/\.([a-z0-9]{1,8})$/i)?.[1];
  const mimeType = String(contentType || '').split(';')[0].toLowerCase();
  const mimeExtensions = {
    'application/pdf': 'pdf',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/bmp': 'bmp',
  };
  const extension = (sourceExtension || mimeExtensions[mimeType] || 'file').toLowerCase();
  const parts = [
    monthName,
    formatYearLevel(yearLevel || 'Unspecified Level').replace(/[_-]+/g, ' '),
    complianceType || 'Document',
    surnameFirstName,
  ].map(safePart);
  return `${parts.join('_')}.${extension}`;
};

const getInitials = (name) => {
  if (!name) return '?';
  const parts = String(name).trim().split(/\s+/);
  const first = parts[0]?.[0] || '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
};

const formatMonthLabel = (value) => {
  if (!value) return '—';
  const [year, monthNum] = String(value).split('-');
  const date = new Date(Number(year), Number(monthNum) - 1, 1);
  if (Number.isNaN(date.getTime())) return value;
  return formatAdminMonth(date);
};

const formatReportDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString();
};

const formatReportTime = (value) => value ? String(value).slice(0, 5) : '';

const pageNumbers = (current, total) => {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set([1, total, current - 1, current, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push('…');
    out.push(p);
  });
  return out;
};

// ---------------------------------------------------------------------------
// Donor report data (per scholar)
// ---------------------------------------------------------------------------

const fetchScholarReport = async (row, month) => {
  const scholarId = row.scholar_id || row.scholar;
  try {
    const res = await axios.get(`${API}/export/donor-report/${scholarId}`, {
      ...authHeaders(),
      params: { month },
    });
    const data = res.data || {};
    return {
      documents: Array.isArray(data.documents) ? data.documents : [],
      grades: Array.isArray(data.grades) ? data.grades : [],
      duty_attendance: Array.isArray(data.duty_attendance) ? data.duty_attendance : [],
    };
  } catch (err) {
    return {
      documents: [],
      grades: [],
      duty_attendance: [],
      loadError: err.response?.data?.message || err.response?.data?.error || "Could not load the scholar's submitted documents and attendance.",
    };
  }
};

// ---------------------------------------------------------------------------
// Presentational pieces
// ---------------------------------------------------------------------------

const IconBadge = ({ icon: Icon, color = PRIMARY, size = 40 }) => (
  <div
    style={{
      width: size, height: size, borderRadius: 12, background: `${color}14`,
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}
  >
    <Icon size={size * 0.46} color={color} strokeWidth={2} />
  </div>
);

const KPICard = ({ icon, label, value, note, accent }) => (
  <div style={{ ...surfaceCard, padding: '1rem 1.15rem', display: 'flex', gap: 14, alignItems: 'flex-start', minWidth: 0 }}>
    <IconBadge icon={icon} color={accent} />
    <div style={{ minWidth: 0 }}>
      <div style={{ ...body, fontSize: '0.74rem', fontWeight: 600, color: PRIMARY }}>{label}</div>
      <div style={{ ...display, fontSize: '1.7rem', color: value === '—' ? MUTED : INK, lineHeight: 1.15, marginTop: 2 }}>{value}</div>
      <div style={{ ...body, fontSize: '0.72rem', color: MUTED, marginTop: 3 }}>{note}</div>
    </div>
  </div>
);

const Panel = ({ icon, title, subtitle, className, children }) => (
  <section style={{ ...surfaceCard, padding: '1.1rem 1.2rem', minWidth: 0 }} className={className}>
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 14 }}>
      <IconBadge icon={icon} size={36} />
      <div style={{ minWidth: 0 }}>
        <h3 style={{ ...display, fontSize: '1.02rem', color: INK, lineHeight: 1.25 }}>{title}</h3>
        <p style={{ ...body, fontSize: '0.74rem', color: MUTED, marginTop: 2 }}>{subtitle}</p>
      </div>
    </div>
    {children}
  </section>
);

const NoData = ({ text = 'No data available' }) => (
  <div style={{ ...body, fontSize: '0.82rem', color: MUTED, textAlign: 'center', padding: '1.6rem 0' }}>{text}</div>
);

const DocumentTaskList = ({ items, onView }) => (
  items.length ? (
    <div
      role="list"
      aria-label="Document tasks by year level"
      style={{ display: 'grid', gap: 9, ...(onView && items.length > 4 ? { maxHeight: 360, overflowY: 'auto', paddingRight: 4 } : {}) }}
    >
      {items.map((item) => (
        <div key={item.key} role="listitem" className="flex items-center justify-between gap-3" style={{ border: `1px solid ${BORDER}`, borderRadius: 12, background: '#fff', padding: '10px 12px' }}>
          <div style={{ minWidth: 0 }}>
            <strong style={{ ...body, display: 'block', fontSize: '0.76rem', color: INK }}>{item.label}</strong>
            <div className="flex flex-wrap gap-x-3 gap-y-1" style={{ marginTop: 3 }}>
              <span style={{ ...body, fontSize: '0.67rem', color: MUTED, whiteSpace: 'nowrap' }}>
                Overall: <strong style={{ color: INK }}>{item.overallProgress.percent}%</strong> ({item.overallProgress.submitted}/{item.overallProgress.eligible} eligible scholars)
              </span>
              {item.documentProgress.map((progress) => (
                <span key={progress.type} style={{ ...body, fontSize: '0.67rem', color: MUTED, whiteSpace: 'nowrap' }}>
                  {progress.label}: <strong style={{ color: INK }}>{progress.percent}%</strong> ({progress.submitted}/{progress.eligible} eligible scholars)
                </span>
              ))}
            </div>
          </div>
          {onView && (
            <button
              type="button"
              onClick={() => onView(item.key)}
              aria-label={`View ${item.label} scholars and document status`}
              aria-haspopup="dialog"
              style={{ ...body, fontSize: '0.72rem', fontWeight: 600, color: PRIMARY, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '6px 12px', background: '#fff', cursor: 'pointer' }}
            >
              View
            </button>
          )}
        </div>
      ))}
    </div>
  ) : <NoData text="No document task assigned for this period." />
);

const DocumentTaskModal = ({ task, month, onClose }) => (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4 sm:p-8"
    style={{ background: 'rgba(36,21,18,0.5)' }}
    onClick={onClose}
  >
    <section
      role="dialog"
      aria-modal="true"
      aria-labelledby="document-task-title"
      onClick={(event) => event.stopPropagation()}
      style={{ ...surfaceCard, maxWidth: 820, width: '100%', maxHeight: '90vh', overflow: 'hidden' }}
    >
      <header className="flex items-start justify-between gap-4" style={{ padding: '1.2rem 1.4rem', borderBottom: `1px solid ${BORDER}`, background: BG }}>
        <div>
          <h2 id="document-task-title" style={{ ...display, fontSize: '1.3rem', color: INK }}>{task.label}</h2>
          <p style={{ ...body, fontSize: '0.76rem', color: MUTED, marginTop: 3 }}>
            Document submissions · {formatMonthLabel(month)}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close document task details"
          style={{ ...body, color: MUTED, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '7px', background: '#fff', cursor: 'pointer' }}
        >
          <X size={15} />
        </button>
      </header>
      <div style={{ padding: '1rem 1.2rem', overflow: 'auto', maxHeight: 'calc(90vh - 84px)' }}>
        <div style={{ overflowX: 'auto', border: `1px solid ${BORDER}`, borderRadius: 10 }}>
          <table style={{ width: '100%', minWidth: 760, borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: BG }}>
                {['Scholar', 'Year Level', ...DOCUMENT_TASK_ORDER.map((type) => DOCUMENT_TASK_LABELS[type])].map((heading) => (
                  <th key={heading} style={{ ...body, fontSize: '0.68rem', color: MUTED, padding: '10px 12px', whiteSpace: 'nowrap' }}>{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {task.scholars.map((scholar) => {
                return (
                  <tr key={scholar.scholar_id} style={{ borderTop: `1px solid ${BORDER}` }}>
                    <td style={{ ...body, fontSize: '0.74rem', color: INK, padding: '10px 12px' }}>
                      {scholar.scholar}<span style={{ color: MUTED }}> · {scholar.scholar_id}</span>
                    </td>
                    <td style={{ ...body, fontSize: '0.72rem', color: MUTED, padding: '10px 12px', whiteSpace: 'nowrap' }}>
                      {formatYearLevel(scholar.year_level)}
                    </td>
                    {DOCUMENT_TASK_ORDER.map((type) => {
                      const progress = scholar.document_progress[type];
                      const status = !progress?.total
                        ? { label: 'No task', color: MUTED, background: '#F0ECE6' }
                        : progress.submitted === progress.total
                          ? { label: 'Submitted', color: '#236B3B', background: '#E8F4EA' }
                          : progress.submitted === 0
                            ? { label: 'Not submitted', color: '#9A5B00', background: '#FFF3D6' }
                            : { label: `${progress.submitted}/${progress.total} submitted`, color: '#9A5B00', background: '#FFF3D6' };
                      return (
                        <td key={type} style={{ padding: '10px 12px' }}>
                          <span
                            title={progress?.task_titles?.join(', ') || 'No task assigned'}
                            style={{ ...body, fontSize: '0.66rem', color: status.color, background: status.background, borderRadius: 999, padding: '4px 9px', whiteSpace: 'nowrap' }}
                          >
                            {status.label}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  </div>
);

const DUTY_STATUS_STYLES = {
  present: { label: 'Present', color: '#236B3B', background: '#E8F4EA' },
  late: { label: 'Late', color: '#9A5B00', background: '#FFF3D6' },
  absent: { label: 'Absent', color: '#A12A2A', background: '#FCE8E6' },
  excused: { label: 'Excused', color: '#625A50', background: '#F0ECE6' },
};

const dutyStatusKey = (status) => {
  const normalized = String(status || '').trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(DUTY_STATUS_STYLES, normalized) ? normalized : null;
};

const DutyGroupProgressList = ({ items, onView }) => (
  items.length ? (
    <div
      role="list"
      aria-label="Duty groups"
      style={{ display: 'grid', gap: 9, ...(onView && items.length > 4 ? { maxHeight: 360, overflowY: 'auto', paddingRight: 4 } : {}) }}
    >
      {items.map((item) => (
        <div key={item.group_id} role="listitem" className="flex items-center justify-between gap-3" style={{ border: `1px solid ${BORDER}`, borderRadius: 12, background: '#fff', padding: '11px 13px' }}>
          <strong style={{ ...body, fontSize: '0.8rem', color: INK }}>{item.group_name}</strong>
          {onView && (
            <button
              type="button"
              onClick={() => onView(item.group_id)}
              aria-label={`View ${item.group_name} scholars and attendance`}
              aria-haspopup="dialog"
              style={{ ...body, fontSize: '0.72rem', fontWeight: 600, color: PRIMARY, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '6px 12px', background: '#fff', cursor: 'pointer' }}
            >
              View
            </button>
          )}
        </div>
      ))}
    </div>
  ) : <NoData text="No group duties scheduled for this month." />
);

const DutyGroupModal = ({ group, month, onClose }) => (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4 sm:p-8"
    style={{ background: 'rgba(36,21,18,0.5)' }}
    onClick={onClose}
  >
    <section
      role="dialog"
      aria-modal="true"
      aria-labelledby="duty-group-title"
      onClick={(event) => event.stopPropagation()}
      style={{ ...surfaceCard, maxWidth: 820, width: '100%', maxHeight: '90vh', overflow: 'hidden' }}
    >
      <header className="flex items-start justify-between gap-4" style={{ padding: '1.2rem 1.4rem', borderBottom: `1px solid ${BORDER}`, background: BG }}>
        <div>
          <h2 id="duty-group-title" style={{ ...display, fontSize: '1.3rem', color: INK }}>{group.group_name}</h2>
          <p style={{ ...body, fontSize: '0.76rem', color: MUTED, marginTop: 3 }}>
            Attendance summary for {formatMonthLabel(month)}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close group attendance"
          style={{ ...body, color: MUTED, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '7px', background: '#fff', cursor: 'pointer' }}
        >
          <X size={15} />
        </button>
      </header>
      <div style={{ padding: '1rem 1.2rem', overflow: 'auto', maxHeight: 'calc(90vh - 84px)' }}>
        <div style={{ overflowX: 'auto', border: `1px solid ${BORDER}`, borderRadius: 10 }}>
          <table style={{ width: '100%', minWidth: 620, borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: BG }}>
                {['Scholar', 'Year Level', 'Present', 'Late', 'Absent', 'Excused'].map((heading) => (
                  <th key={heading} style={{ ...body, fontSize: '0.68rem', color: MUTED, padding: '10px 12px', whiteSpace: 'nowrap' }}>{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {group.scholars.map((scholar) => (
                <tr key={scholar.scholar_id} style={{ borderTop: `1px solid ${BORDER}` }}>
                  <td style={{ ...body, fontSize: '0.74rem', color: INK, padding: '10px 12px' }}>
                    {scholar.scholar}<span style={{ color: MUTED }}> · {scholar.scholar_id}</span>
                  </td>
                  <td style={{ ...body, fontSize: '0.72rem', color: MUTED, padding: '10px 12px', whiteSpace: 'nowrap' }}>
                    {formatYearLevel(scholar.year_level)}
                  </td>
                  {Object.keys(DUTY_STATUS_STYLES).map((status) => (
                    <td key={status} style={{ ...body, fontSize: '0.74rem', color: DUTY_STATUS_STYLES[status].color, padding: '10px 12px', textAlign: 'center' }}>
                      {scholar.status_counts[status]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ ...body, fontSize: '0.69rem', color: MUTED, marginTop: 9 }}>
          Counts are recorded attendance for this group’s duties during the selected month.
        </p>
      </div>
    </section>
  </div>
);

const Skeleton = ({ w = '100%', h = 14, r = 8, style }) => (
  <div style={{ width: w, height: h, borderRadius: r, background: '#EFE3D4', ...style }} />
);

const PageSkeleton = () => (
  <div aria-busy="true" aria-label="Loading donor reporting data">
    <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div><Skeleton w={110} h={10} /><Skeleton w={300} h={28} style={{ marginTop: 10 }} /><Skeleton w={380} h={12} style={{ marginTop: 10 }} /></div>
      <Skeleton w={420} h={44} r={12} />
    </div>
    <div style={{ ...surfaceCard, padding: '1.1rem 1.3rem', marginBottom: 16 }}><Skeleton w={180} h={16} /><Skeleton w="70%" h={12} style={{ marginTop: 10 }} /></div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 mb-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} style={{ ...surfaceCard, padding: '1rem 1.15rem', display: 'flex', gap: 14 }}>
          <Skeleton w={40} h={40} r={12} /><div style={{ flex: 1 }}><Skeleton w="60%" h={10} /><Skeleton w="35%" h={24} style={{ marginTop: 8 }} /></div>
        </div>
      ))}
    </div>
    <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3 mb-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} style={{ ...surfaceCard, padding: '1.1rem 1.2rem', height: 220 }}><Skeleton w={160} h={14} /><Skeleton h={130} r={12} style={{ marginTop: 18, background: '#F2E9DC' }} /></div>
      ))}
    </div>
    <div style={{ ...surfaceCard, padding: '1.1rem 1.2rem' }}>
      <Skeleton w={180} h={16} />
      {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} h={30} style={{ marginTop: 12 }} />)}
    </div>
  </div>
);

const EmptyState = ({ title, text }) => (
  <div style={{ ...surfaceCard, padding: '2.8rem 1.5rem', textAlign: 'center' }}>
    <div style={{ width: 52, height: 52, borderRadius: '50%', background: `${PRIMARY}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
      <HeartHandshake size={24} color={PRIMARY} strokeWidth={1.8} />
    </div>
    <h3 style={{ ...display, fontSize: '1.15rem', color: INK }}>{title}</h3>
    <p style={{ ...body, fontSize: '0.86rem', color: MUTED, marginTop: 6 }}>{text}</p>
  </div>
);

// ---------------------------------------------------------------------------
// Donor Report Modal (per scholar)
// ---------------------------------------------------------------------------

const DonorReportModal = ({ row, month, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState({
    documents: [], grades: [], duty_attendance: [],
  });
  const [fileError, setFileError] = useState('');
  const [filePreview, setFilePreview] = useState(null);
  const [letterPreview, setLetterPreview] = useState(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchScholarReport(row, month).then((data) => {
      if (active) {
        setReport(data);
        setLoading(false);
      }
    });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row, month]);

  const openReportFile = async (filePath, label, complianceType) => {
    setFileError('');
    setFilePreview({ label, loading: true });
    try {
      const response = await axios.get(`${API}/submission/preview`, {
        ...authHeaders(),
        params: { url: filePath },
        responseType: 'blob',
      });
      const objectUrl = URL.createObjectURL(response.data);
      const contentType = response.headers['content-type'] || '';
      const extension = String(filePath).split(/[?#]/)[0].split('.').pop().toLowerCase();
      const type = contentType.includes('pdf') || extension === 'pdf'
        ? 'pdf'
        : contentType.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(extension)
          ? 'image'
          : 'other';
      const downloadName = buildScholarSubmissionFilename({
        month,
        yearLevel: row.year_level,
        complianceType,
        scholarName: row.scholar,
        filePath,
        contentType,
      });
      setFilePreview({ label, url: objectUrl, type, downloadName });
    } catch (err) {
      setFilePreview(null);
      setFileError(err.response?.data?.error || 'Unable to open this submitted document.');
    }
  };

  useEffect(() => {
    const objectUrl = filePreview?.url;
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [filePreview?.url]);

  const documentsByCategory = SCHOLAR_REPORT_DOCUMENT_CATEGORIES.reduce((groups, category) => {
    groups[category] = (report.documents || []).filter((document) => document.category === category);
    return groups;
  }, {});
  const gradePeriods = Object.values((report.grades || []).reduce((periods, grade) => {
    const key = `${grade.semester || ''}|${grade.academic_year || ''}`;
    if (!periods[key]) {
      periods[key] = {
        semester: grade.semester,
        academic_year: grade.academic_year,
        subjects: [],
        proofFiles: [],
      };
    }
    periods[key].subjects.push(grade);
    if (grade.proof_path && !periods[key].proofFiles.some((file) => file.path === grade.proof_path)) {
      periods[key].proofFiles.push({ label: `${grade.semester} ${grade.academic_year} grade proof`, path: grade.proof_path });
    }
    return periods;
  }, {})).map((period) => {
    const totalUnits = period.subjects.reduce((sum, grade) => sum + (Number(grade.units) > 0 ? Number(grade.units) : 0), 0);
    const weightedGrade = period.subjects.reduce((sum, grade) => (
      Number(grade.units) > 0 ? sum + Number(grade.units) * Number(grade.grade || 0) : sum
    ), 0);
    return {
      ...period,
      gwa: totalUnits > 0 ? weightedGrade / totalUnits : null,
    };
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4"
      style={{ background: 'rgba(36,21,18,0.5)' }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ ...surfaceCard, maxWidth: 920, width: '100%', maxHeight: 'calc(100vh - 32px)', margin: 'auto', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
      >
        <div
          className="flex items-start justify-between gap-4"
          style={{ padding: '1rem 1.4rem', borderBottom: `1px solid ${BORDER}`, background: BG, flexShrink: 0 }}
        >
          <div>
            <p style={{ ...body, color: BRONZE, fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Donor Impact Report
            </p>
            <h2 style={{ ...display, fontSize: '1.55rem', marginTop: 4, color: INK }}>{row.scholar || 'Scholar'}</h2>
            <p style={{ ...body, color: MUTED, fontSize: '0.85rem', marginTop: 2 }}>
              {formatYearLevel(row.year_level)} · Reporting month {formatMonthLabel(month)}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              aria-label="Close report"
              style={{
                ...body, fontSize: '0.8rem', color: MUTED, border: `1px solid ${BORDER}`,
                borderRadius: 10, padding: '9px 10px', background: '#fff', cursor: 'pointer',
                display: 'flex', alignItems: 'center',
              }}
            >
              <X size={14} />
            </button>
          </div>
        </div>

        <div style={{ padding: '1.1rem 1.4rem', overflowY: 'auto' }}>
          {loading ? (
            <div style={{ ...body, color: MUTED, textAlign: 'center', padding: '2rem 0' }}>Building report…</div>
          ) : (
            <>
              {report.loadError && (
                <p role="alert" style={{ ...body, color: DANGER, background: '#FFF4F2', border: '1px solid #E8C7C1', borderRadius: 10, padding: '0.8rem 1rem', marginBottom: 16 }}>
                  {report.loadError}
                </p>
              )}
              {fileError && (
                <p role="alert" style={{ ...body, color: DANGER, background: '#FFF4F2', border: '1px solid #E8C7C1', borderRadius: 10, padding: '0.8rem 1rem', marginBottom: 16 }}>
                  {fileError}
                </p>
              )}
              <div className="mb-7">
                <h3 style={{ ...display, fontSize: '1.1rem', marginBottom: 10, color: INK }}>Submitted Documents</h3>
                {report.loadError ? (
                  <p style={{ ...body, fontSize: '0.85rem', color: MUTED }}>Document records could not be loaded.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {SCHOLAR_REPORT_DOCUMENT_CATEGORIES.map((category) => {
                      const items = documentsByCategory[category];
                      return (
                        <section key={category} style={{ border: `1px solid ${BORDER}`, borderRadius: 12, padding: '0.75rem 0.85rem', background: '#fff' }}>
                          <h4 style={{ ...body, fontSize: '0.84rem', fontWeight: 700, color: INK }}>{category}</h4>

                          {category === 'Grades' && gradePeriods.length > 0 && (
                            <div className="space-y-2 mt-2">
                              {gradePeriods.map((period) => (
                                <div key={`${period.semester}-${period.academic_year}`} style={{ background: BG, borderRadius: 9, padding: '0.65rem' }}>
                                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                                    <div>
                                      <p style={{ ...body, color: INK, fontSize: '0.75rem', fontWeight: 600 }}>{period.semester} Semester · AY {period.academic_year}</p>
                                      <p style={{ ...body, color: PRIMARY, fontSize: '0.72rem', fontWeight: 700, marginTop: 2 }}>
                                        GWA (submitted): {period.gwa === null ? '—' : period.gwa.toFixed(2)}
                                      </p>
                                    </div>
                                    {period.proofFiles.map((file) => (
                                      <button
                                        key={file.path}
                                        type="button"
                                        aria-label={`View ${file.label}`}
                                        onClick={() => openReportFile(file.path, file.label, 'Grades')}
                                        style={{ ...body, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '5px 8px', color: PRIMARY, background: '#fff', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 600 }}
                                      >
                                        <span className="inline-flex items-center gap-1"><FileText size={12} /> View</span>
                                      </button>
                                    ))}
                                  </div>
                                  <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', minWidth: 350, borderCollapse: 'collapse' }}>
                                      <thead>
                                        <tr style={{ textAlign: 'left' }}>
                                          {['Subject', 'Units', 'Grade'].map((heading) => (
                                            <th key={heading} style={{ ...body, color: MUTED, fontSize: '0.62rem', textTransform: 'uppercase', padding: '5px 6px' }}>{heading}</th>
                                          ))}
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {period.subjects.map((grade) => (
                                          <tr key={grade.id} style={{ borderTop: `1px solid ${BORDER}` }}>
                                            <td style={{ ...body, color: INK, fontSize: '0.72rem', padding: '5px 6px' }}>{grade.subject_name}</td>
                                            <td style={{ ...body, color: INK, fontSize: '0.71rem', padding: '5px 6px' }}>{grade.units ?? '—'}</td>
                                            <td style={{ ...body, color: INK, fontSize: '0.71rem', padding: '5px 6px' }}>{grade.grade ?? '—'}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {items.length > 0 ? (
                            <div className="space-y-2 mt-2">
                              {items.map((item) => (
                                <div key={item.id} className="flex items-center justify-between gap-2" style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 7 }}>
                                  <div>
                                    <p style={{ ...body, color: INK, fontSize: '0.73rem', fontWeight: 600 }}>{category}</p>
                                    <p style={{ ...body, color: MUTED, fontSize: '0.66rem', marginTop: 2 }}>
                                      Submitted {formatReportDate(item.submitted_at)} · {String(item.status || 'pending').replace(/_/g, ' ')}
                                    </p>
                                  </div>
                                  <div className="flex flex-wrap gap-1.5">
                                    {item.files.map((file) => (
                                      <button
                                        key={file.path}
                                        type="button"
                                        aria-label={`View ${file.label}`}
                                        onClick={() => openReportFile(file.path, file.label, category)}
                                        style={{ ...body, border: `1px solid ${BORDER}`, borderRadius: 7, padding: '5px 8px', color: PRIMARY, background: BG, cursor: 'pointer', fontSize: '0.68rem', fontWeight: 600, flexShrink: 0 }}
                                      >
                                        <span className="inline-flex items-center gap-1"><FileText size={12} /> View</span>
                                      </button>
                                    ))}
                                    {!item.files.length && item.content && (
                                      <button
                                        type="button"
                                        onClick={() => setLetterPreview({ title: item.title || category, content: item.content })}
                                        style={{ ...body, border: `1px solid ${BORDER}`, borderRadius: 7, padding: '5px 8px', color: PRIMARY, background: BG, cursor: 'pointer', fontSize: '0.68rem', fontWeight: 600, flexShrink: 0 }}
                                      >
                                        <span className="inline-flex items-center gap-1"><FileText size={12} /> View</span>
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : category !== 'Grades' || gradePeriods.length === 0 ? (
                            <p style={{ ...body, color: MUTED, fontSize: '0.7rem', marginTop: 5 }}>Not submitted this month.</p>
                          ) : null}
                        </section>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="mb-7">
                <h3 style={{ ...display, fontSize: '1.1rem', marginBottom: 10, color: INK }}>Duty Attendance</h3>
                {report.loadError ? (
                  <p style={{ ...body, fontSize: '0.85rem', color: MUTED }}>Duty attendance could not be loaded.</p>
                ) : report.duty_attendance.length ? (
                  <div className="space-y-2">
                    {report.duty_attendance.map((attendance) => {
                      const status = String(attendance.status || 'not_marked').toLowerCase();
                      const statusStyle = status === 'present'
                        ? { color: '#28633B', borderColor: '#B8D7BE', background: '#EEF7F0' }
                        : status === 'absent'
                          ? { color: '#9B3535', borderColor: '#E8C1BE', background: '#FFF1EF' }
                          : status === 'late'
                            ? { color: '#8B5C10', borderColor: '#E9D5A9', background: '#FFF8E8' }
                            : { color: MUTED, borderColor: BORDER, background: BG };
                      const time = [attendance.time_start && formatReportTime(attendance.time_start), attendance.time_end && formatReportTime(attendance.time_end)]
                        .filter(Boolean)
                        .join(' – ');
                      const details = [
                        formatReportDate(attendance.duty_date),
                        time,
                        attendance.group_name,
                        attendance.location,
                        attendance.is_makeup ? 'Make-up duty' : null,
                      ].filter(Boolean).join(' · ');
                      return (
                        <div key={`${attendance.duty_id}-${attendance.marked_at}`} className="flex flex-wrap items-center justify-between gap-3" style={{ border: `1px solid ${BORDER}`, borderRadius: 10, padding: '0.7rem 0.85rem', background: '#fff' }}>
                          <div>
                            <p style={{ ...body, color: INK, fontSize: '0.78rem', fontWeight: 600 }}>{attendance.duty_title}</p>
                            <p style={{ ...body, color: MUTED, fontSize: '0.68rem', marginTop: 3 }}>{details}</p>
                          </div>
                          <span style={{ ...body, fontSize: '0.68rem', fontWeight: 700, textTransform: 'capitalize', border: `1px solid ${statusStyle.borderColor}`, borderRadius: 20, padding: '4px 9px', ...statusStyle }}>
                            {status === 'not_marked' ? 'Not marked yet' : status.replace(/_/g, ' ')}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p style={{ ...body, fontSize: '0.78rem', color: MUTED, border: `1px dashed ${BORDER}`, borderRadius: 10, padding: '0.75rem 0.85rem' }}>
                    No duty is scheduled for this scholar&apos;s group this month.
                  </p>
                )}
              </div>

              <div style={{ marginTop: '1.6rem', paddingTop: '1.2rem', borderTop: `1px solid ${BORDER}`, textAlign: 'center' }}>
                <div style={{ ...display, fontSize: '1rem', color: PRIMARY_DEEP }}>Apple Scholar Foundation</div>
                <div style={{ ...body, fontSize: '0.72rem', color: MUTED, letterSpacing: '0.04em', marginTop: 2 }}>Official Donor Progress Report</div>
              </div>
            </>
          )}
        </div>
      </div>
      {filePreview && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-6"
          style={{ background: 'rgba(24,16,19,0.78)' }}
          onClick={(event) => {
            event.stopPropagation();
            setFilePreview(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={filePreview.label || 'Document preview'}
            onClick={(event) => event.stopPropagation()}
            style={{ ...surfaceCard, width: '100%', maxWidth: 1050, height: 'min(88vh, 900px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
          >
            <div className="flex items-center justify-between gap-3" style={{ padding: '0.8rem 1rem', borderBottom: `1px solid ${BORDER}`, background: BG, flexShrink: 0 }}>
              <div>
                <p style={{ ...body, color: BRONZE, fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' }}>Document Preview</p>
                <h3 style={{ ...body, color: INK, fontSize: '0.86rem', fontWeight: 700, marginTop: 2 }}>{filePreview.label}</h3>
              </div>
              <div className="flex items-center gap-2">
                {!filePreview.loading && filePreview.url && (
                  <a
                    href={filePreview.url}
                    download={filePreview.downloadName}
                    style={{ ...body, display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.75rem', fontWeight: 600, color: PRIMARY, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '7px 10px', background: '#fff', textDecoration: 'none' }}
                  >
                    <Download size={14} /> Download
                  </a>
                )}
                <button
                  type="button"
                  aria-label="Close document preview"
                  onClick={() => setFilePreview(null)}
                  style={{ ...body, color: MUTED, border: `1px solid ${BORDER}`, borderRadius: 8, padding: 7, background: '#fff', cursor: 'pointer' }}
                >
                  <X size={15} />
                </button>
              </div>
            </div>
            <div className="flex-1 min-h-0 flex items-center justify-center" style={{ background: '#241F20', padding: 12 }}>
              {filePreview.loading ? (
                <p style={{ ...body, color: '#fff', fontSize: '0.85rem' }}>Loading document…</p>
              ) : filePreview.type === 'pdf' ? (
                <iframe title={filePreview.label} src={filePreview.url} style={{ width: '100%', height: '100%', border: 0, borderRadius: 6, background: '#fff' }} />
              ) : filePreview.type === 'image' ? (
                <img src={filePreview.url} alt={filePreview.label} style={{ display: 'block', maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
              ) : (
                <div style={{ ...body, color: '#fff', textAlign: 'center', fontSize: '0.84rem' }}>
                  <p>This file type cannot be previewed here.</p>
                  <p style={{ marginTop: 8 }}>Use Download above to save the file.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {letterPreview && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          style={{ background: 'rgba(36,21,18,0.65)' }}
          onClick={(event) => {
            event.stopPropagation();
            setLetterPreview(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={letterPreview.title}
            onClick={(event) => event.stopPropagation()}
            style={{ ...surfaceCard, width: '100%', maxWidth: 680, maxHeight: '85vh', overflow: 'auto', padding: '1.2rem' }}
          >
            <div className="flex items-start justify-between gap-3 mb-4">
              <h3 style={{ ...display, fontSize: '1.15rem', color: INK }}>{letterPreview.title}</h3>
              <button
                type="button"
                aria-label="Close document preview"
                onClick={() => setLetterPreview(null)}
                style={{ ...body, color: MUTED, border: `1px solid ${BORDER}`, borderRadius: 8, padding: 6, background: '#fff', cursor: 'pointer' }}
              >
                <X size={15} />
              </button>
            </div>
            <pre style={{ ...body, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', color: INK, fontSize: '0.86rem', lineHeight: 1.7, margin: 0 }}>
              {letterPreview.content}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Monthly Donor Summary Report — print-friendly (A4 portrait) executive summary
// for every scholar in the selected month. Uses only data already fetched.
// ---------------------------------------------------------------------------

const REPORT_PAGE = {
  width: '100%',
  maxWidth: 794,
  margin: '0 auto',
  background: '#fff',
  padding: '28px 32px',
};

const MonthlyReportModal = ({
  month,
  totals,
  overallTaskCompletion,
  documentTaskLevelData,
  dutyGroupProgress,
  onClose,
}) => {
  const monthLabel = formatMonthLabel(month);
  const documentCategoryTotals = new Map();
  documentTaskLevelData.forEach((level) => {
    level.documentProgress.forEach((progress) => {
      const current = documentCategoryTotals.get(progress.type) || { submitted: 0, eligible: 0 };
      current.submitted += progress.submitted;
      current.eligible += progress.eligible;
      documentCategoryTotals.set(progress.type, current);
    });
  });
  const documentSummary = DOCUMENT_TASK_ORDER
    .map((type) => {
      const progress = documentCategoryTotals.get(type);
      if (!progress?.eligible) return null;
      const percent = Math.round((progress.submitted / progress.eligible) * 100);
      return `${DOCUMENT_TASK_LABELS[type]} ${progress.submitted}/${progress.eligible} (${percent}%)`;
    })
    .filter(Boolean)
    .join('; ');
  const completionSummary = overallTaskCompletion.eligible
    ? `${overallTaskCompletion.submitted} of ${overallTaskCompletion.eligible} eligible scholars (${overallTaskCompletion.percent}%) completed all assigned documents.`
    : 'No document tasks were assigned for this month.';
  const dutyGroupSummaries = dutyGroupProgress.map((group) => ({
    ...group,
    attendanceCounts: Object.keys(DUTY_STATUS_STYLES).reduce((counts, status) => {
      counts[status] = group.scholars.reduce(
        (sum, scholar) => sum + (Number(scholar.status_counts[status]) || 0),
        0
      );
      return counts;
    }, {}),
  }));
  const attendanceTotals = Object.keys(DUTY_STATUS_STYLES).reduce((counts, status) => {
    counts[status] = dutyGroupSummaries.reduce((sum, group) => sum + group.attendanceCounts[status], 0);
    return counts;
  }, {});
  const dutySummary = dutyGroupSummaries.length
    ? `Duty attendance was recorded across ${dutyGroupSummaries.length} group${dutyGroupSummaries.length === 1 ? '' : 's'}: ${Object.entries(DUTY_STATUS_STYLES)
      .map(([status, style]) => `${attendanceTotals[status]} ${style.label.toLowerCase()}`)
      .join(', ')}.`
    : 'No group duties were scheduled.';
  const categorySummary = documentSummary
    ? `By document category: ${documentSummary}.`
    : '';
  const narrative = `During ${monthLabel}, ${totals.totalScholars} active scholars were included in the report. ${completionSummary} ${categorySummary} ${dutySummary} We appreciate your support for Apple Scholar scholars' education and community service.`;

  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportError, setExportError] = useState('');
  const handleExportPdf = async () => {
    setExportingPdf(true);
    setExportError('');
    try {
      const { jsPDF } = await import('jspdf');
      const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 44;
      const contentWidth = pageWidth - margin * 2;
      let y = margin;

      const ensureSpace = (height) => {
        if (y + height > pageHeight - margin) {
          pdf.addPage();
          y = margin;
        }
      };
      const addParagraph = (text, { size = 9, lineHeight = 13, color = [36, 21, 18], font = 'helvetica', style = 'normal', after = 6 } = {}) => {
        pdf.setFont(font, style);
        pdf.setFontSize(size);
        pdf.setTextColor(...color);
        const lines = pdf.splitTextToSize(String(text || ''), contentWidth);
        lines.forEach((line) => {
          ensureSpace(lineHeight);
          pdf.text(line, margin, y);
          y += lineHeight;
        });
        y += after;
      };
      const addSectionTitle = (title) => {
        ensureSpace(24);
        pdf.setFont('times', 'bold');
        pdf.setFontSize(13);
        pdf.setTextColor(36, 21, 18);
        pdf.text(title, margin, y);
        y += 20;
      };

      pdf.setFillColor(109, 33, 64);
      pdf.roundedRect(margin, y, contentWidth, 82, 10, 10, 'F');
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9);
      pdf.setTextColor(231, 216, 199);
      pdf.text('APPLE SCHOLAR FOUNDATION', margin + 18, y + 22);
      pdf.setFont('times', 'bold');
      pdf.setFontSize(20);
      pdf.setTextColor(255, 255, 255);
      pdf.text('Monthly Donor Summary Report', margin + 18, y + 48);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.setTextColor(243, 233, 221);
      pdf.text(monthLabel, margin + 18, y + 67);
      y += 101;

      addParagraph('Prepared for Donor Partners', { size: 9, color: [138, 122, 104], after: 12 });

      const cardGap = 12;
      const cardWidth = (contentWidth - cardGap) / 2;
      const cardHeight = 70;
      kpis.forEach((kpi, index) => {
        const x = margin + index * (cardWidth + cardGap);
        pdf.setDrawColor(231, 216, 199);
        pdf.setFillColor(255, 255, 255);
        pdf.roundedRect(x, y, cardWidth, cardHeight, 8, 8, 'FD');
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8);
        pdf.setTextColor(138, 122, 104);
        pdf.text(kpi.label.toUpperCase(), x + 12, y + 17);
        pdf.setFont('times', 'bold');
        pdf.setFontSize(20);
        pdf.setTextColor(index === 0 ? 109 : 63, index === 0 ? 33 : 138, index === 0 ? 64 : 85);
        pdf.text(String(kpi.value), x + 12, y + 42);
        if (kpi.note) {
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(7);
          pdf.setTextColor(138, 122, 104);
          pdf.text(pdf.splitTextToSize(kpi.note, cardWidth - 24)[0] || '', x + 12, y + 57);
        }
      });
      y += cardHeight + 22;

      addSectionTitle('Donor Summary');
      addParagraph(narrative, { size: 9, lineHeight: 14 });

      addSectionTitle('Impact Overview');
      addParagraph(`Monthly document task completion and duty group attendance for ${monthLabel}.`, {
        size: 9,
        color: [138, 122, 104],
        after: 14,
      });

      addSectionTitle('Document Task Status by Year Level');
      if (documentTaskLevelData.length) {
        documentTaskLevelData.forEach((level) => {
          ensureSpace(34);
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(9);
          pdf.setTextColor(36, 21, 18);
          pdf.text(level.label, margin, y);
          y += 14;
          addParagraph(
            `Overall: ${level.overallProgress.percent}% (${level.overallProgress.submitted}/${level.overallProgress.eligible} eligible scholars)`,
            { size: 8, lineHeight: 11, color: [91, 77, 65], after: 2 }
          );
          level.documentProgress.forEach((progress) => {
            addParagraph(
              `${progress.label}: ${progress.percent}% (${progress.submitted}/${progress.eligible} eligible scholars)`,
              { size: 8, lineHeight: 11, color: [91, 77, 65], after: 2 }
            );
          });
          y += 6;
        });
      } else {
        addParagraph('No document task assigned for this period.', { size: 9, color: [138, 122, 104] });
      }

      addSectionTitle('Duty Groups');
      if (dutyGroupSummaries.length) {
        dutyGroupSummaries.forEach((group) => {
          ensureSpace(30);
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(9);
          pdf.setTextColor(36, 21, 18);
          pdf.text(String(group.group_name || 'Unnamed group'), margin, y);
          y += 14;
          const attendanceSummary = Object.entries(DUTY_STATUS_STYLES)
            .map(([status, style]) => `${style.label} ${group.attendanceCounts[status]}`)
            .join(' | ');
          addParagraph(`${group.scholars.length} scholars - ${attendanceSummary}`, {
            size: 8,
            lineHeight: 11,
            color: [91, 77, 65],
            after: 7,
          });
        });
      } else {
        addParagraph('No group duties scheduled for this month.', { size: 9, color: [138, 122, 104] });
      }

      const pageCount = pdf.getNumberOfPages();
      for (let page = 1; page <= pageCount; page += 1) {
        pdf.setPage(page);
        pdf.setDrawColor(231, 216, 199);
        pdf.line(margin, pageHeight - 30, pageWidth - margin, pageHeight - 30);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8);
        pdf.setTextColor(138, 122, 104);
        pdf.text(`Apple Scholar Foundation | ${monthLabel}`, margin, pageHeight - 16);
        pdf.text(`Page ${page} of ${pageCount}`, pageWidth - margin, pageHeight - 16, { align: 'right' });
      }

      const safeMonth = String(month || 'report').replace(/[^0-9-]/g, '');
      pdf.save(`monthly-donor-summary-${safeMonth}.pdf`);
    } catch (error) {
      console.error('Failed to export monthly donor report:', error);
      setExportError('Unable to download the PDF. Please try again.');
    } finally {
      setExportingPdf(false);
    }
  };

  const kpis = [
    { label: 'Active Scholars', value: totals.totalScholars, accent: PRIMARY },
    {
      label: 'Overall Task Completion',
      value: overallTaskCompletion.percent === null ? '—' : `${overallTaskCompletion.percent}%`,
      note: overallTaskCompletion.eligible
        ? `${overallTaskCompletion.submitted}/${overallTaskCompletion.eligible} eligible scholars completed all assigned documents.`
        : 'No document tasks assigned this month.',
      accent: SUCCESS,
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-8"
      style={{ background: 'rgba(36,21,18,0.55)' }}
      onClick={onClose}
    >
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 16mm; }
          body * { visibility: hidden; }
          #monthly-report-printable, #monthly-report-printable * { visibility: visible; }
          #monthly-report-printable { position: absolute; left: 0; top: 0; width: 100%; max-height: none !important; overflow: visible !important; }
          .monthly-report-page { page-break-after: always; }
          .monthly-report-page:last-child { page-break-after: auto; }
        }
      `}</style>

      <div onClick={(e) => e.stopPropagation()} style={{ ...surfaceCard, maxWidth: 840, width: '100%', margin: 'auto', overflow: 'hidden' }}>
        <div
          className="flex items-start justify-between gap-4 print:hidden"
          style={{ padding: '1.4rem 1.7rem', borderBottom: `1px solid ${BORDER}`, background: BG }}
        >
          <div>
            <p style={{ ...body, color: BRONZE, fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Monthly Donor Summary Report
            </p>
            <h2 style={{ ...display, fontSize: '1.4rem', marginTop: 4, color: INK }}>{monthLabel}</h2>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleExportPdf}
              disabled={exportingPdf}
              style={{
                ...body, fontSize: '0.8rem', fontWeight: 600, color: '#fff',
                border: 'none', borderRadius: 10, padding: '9px 16px', background: PRIMARY,
                display: 'flex', alignItems: 'center', gap: 6, cursor: exportingPdf ? 'wait' : 'pointer',
                opacity: exportingPdf ? 0.7 : 1,
              }}
            >
              <Download size={14} /> {exportingPdf ? 'Preparing PDF…' : 'Export PDF'}
            </button>
            <button
              onClick={onClose}
              aria-label="Close report"
              style={{
                ...body, fontSize: '0.8rem', color: MUTED, border: `1px solid ${BORDER}`,
                borderRadius: 10, padding: '9px 10px', background: '#fff', cursor: 'pointer',
                display: 'flex', alignItems: 'center',
              }}
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {exportError && (
          <p role="alert" style={{ ...body, padding: '10px 24px', color: DANGER, fontSize: '0.8rem' }}>
            {exportError}
          </p>
        )}

        <div id="monthly-report-printable" style={{ background: '#EFE7DA', padding: '20px 0', maxHeight: '78vh', overflowY: 'auto' }}>
          {/* Page 1 — Executive cover */}
          <div className="monthly-report-page" style={{ ...REPORT_PAGE, marginBottom: 20 }}>
            <div style={{ background: PRIMARY, borderRadius: 14, padding: '22px 26px', color: '#fff' }}>
              <p style={{ ...body, fontSize: '0.72rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#E7D8C7' }}>Apple Scholar Foundation</p>
              <h1 style={{ ...display, fontSize: '1.8rem', marginTop: 10, lineHeight: 1.15 }}>Monthly Donor Summary Report</h1>
              <p style={{ ...body, fontSize: '0.85rem', marginTop: 10, color: '#F3E9DD' }}>{monthLabel}</p>
            </div>

            <p style={{ ...body, fontSize: '0.8rem', color: MUTED, marginTop: 18 }}>Prepared for Donor Partners</p>

            <div className="grid grid-cols-2 gap-3" style={{ marginTop: 16 }}>
              {kpis.map((kpi) => (
                <div key={kpi.label} style={{ border: `1px solid ${BORDER}`, borderRadius: 12, padding: '14px 16px' }}>
                  <div style={{ ...body, fontSize: '0.65rem', color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{kpi.label}</div>
                  <div style={{ ...display, fontSize: '1.7rem', marginTop: 6, color: kpi.value === '—' ? MUTED : kpi.accent }}>{kpi.value}</div>
                  {kpi.note && <p style={{ ...body, fontSize: '0.68rem', color: MUTED, marginTop: 4 }}>{kpi.note}</p>}
                </div>
              ))}
            </div>

            <section style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '14px 16px', marginTop: 20 }}>
              <h2 style={{ ...display, fontSize: '1.05rem', color: INK, marginBottom: 6 }}>Donor Summary</h2>
              <p style={{ ...body, fontSize: '0.84rem', color: INK, lineHeight: 1.7 }}>{narrative}</p>
            </section>
          </div>

          {/* Page 2 — Donor reporting overview */}
          <div className="monthly-report-page" style={{ ...REPORT_PAGE, marginBottom: 20 }}>
            <h2 style={{ ...display, fontSize: '1.3rem', color: INK, marginBottom: 4 }}>Impact Overview</h2>
            <p style={{ ...body, fontSize: '0.8rem', color: MUTED, marginBottom: 16 }}>
              Monthly document task completion and duty group attendance for {monthLabel}.
            </p>

            <div className="grid grid-cols-1 gap-4">
              <div>
                <h3 style={{ ...body, fontSize: '0.78rem', fontWeight: 700, color: INK, marginBottom: 10 }}>Document Task Status by Year Level</h3>
                <DocumentTaskList items={documentTaskLevelData} />
              </div>
              <div>
                <h3 style={{ ...body, fontSize: '0.78rem', fontWeight: 700, color: INK, marginBottom: 10 }}>Duty Groups</h3>
                {dutyGroupSummaries.length ? (
                  <div role="list" aria-label="Duty groups and attendance" style={{ display: 'grid', gap: 9 }}>
                    {dutyGroupSummaries.map((group) => (
                      <div key={group.group_id} role="listitem" style={{ border: `1px solid ${BORDER}`, borderRadius: 12, background: '#fff', padding: '10px 12px' }}>
                        <strong style={{ ...body, display: 'block', fontSize: '0.76rem', color: INK }}>{group.group_name}</strong>
                        <p style={{ ...body, fontSize: '0.68rem', color: MUTED, marginTop: 4 }}>
                          {group.scholars.length} scholars · {Object.entries(DUTY_STATUS_STYLES)
                            .map(([status, style]) => `${style.label} ${group.attendanceCounts[status]}`)
                            .join(' · ')}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : <NoData text="No group duties scheduled for this month." />}
              </div>
            </div>

            <div style={{ marginTop: '2rem', paddingTop: '1.2rem', borderTop: `1px solid ${BORDER}`, textAlign: 'center' }}>
              <div style={{ ...display, fontSize: '1rem', color: PRIMARY_DEEP }}>Apple Scholar Foundation</div>
              <div style={{ ...body, fontSize: '0.72rem', color: MUTED, letterSpacing: '0.04em', marginTop: 2 }}>Official Monthly Donor Summary Report</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

const DonorReportingCenter = () => {
  const pageSize = getAdminPageSize();
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [yearLevel, setYearLevel] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reportRow, setReportRow] = useState(null);
  const [selectedDutyGroupId, setSelectedDutyGroupId] = useState(null);
  const [selectedDocumentTaskKey, setSelectedDocumentTaskKey] = useState(null);
  const [showMonthlyReport, setShowMonthlyReport] = useState(false);
  const [scholarSearch, setScholarSearch] = useState('');
  const [scholarGradeFilter, setScholarGradeFilter] = useState('');
  const [scholarPage, setScholarPage] = useState(1);

  const fetchDonorOverview = async () => {
    try {
      setLoading(true);
      setError('');
      const params = { type: 'donor', month };
      if (yearLevel) params.year_level = yearLevel;
      const res = await axios.get(`${API}/export/preview`, { ...authHeaders(), params });
      setRows(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (err) {
      setRows([]);
      setError(err.response?.data?.message || 'Unable to load donor overview.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDonorOverview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, yearLevel]);

  useEffect(() => {
    setSelectedDutyGroupId(null);
    setSelectedDocumentTaskKey(null);
  }, [month, yearLevel]);

  useEffect(() => { setScholarPage(1); }, [scholarSearch, scholarGradeFilter, rows]);

  const filteredScholarRows = useMemo(() => {
    const query = scholarSearch.trim().toLowerCase();
    return rows.filter((row) => {
      if (query && !(row.scholar || '').toLowerCase().includes(query)) return false;
      if (scholarGradeFilter && formatYearLevel(row.year_level) !== scholarGradeFilter) return false;
      return true;
    });
  }, [rows, scholarSearch, scholarGradeFilter]);

  const scholarPageCount = Math.max(1, Math.ceil(filteredScholarRows.length / pageSize));
  const pageStart = (scholarPage - 1) * pageSize;
  const paginatedScholarRows = useMemo(
    () => filteredScholarRows.slice(pageStart, pageStart + pageSize),
    [filteredScholarRows, pageStart, pageSize]
  );

  const totals = { totalScholars: rows.length };
  const overallTaskCompletion = useMemo(() => {
    const eligibleScholars = rows.filter((row) => row.submission_task_progress?.length > 0);
    const submittedScholars = eligibleScholars.filter((row) => (
      row.submission_task_progress.every((task) => task.submitted)
    )).length;
    return {
      eligible: eligibleScholars.length,
      submitted: submittedScholars,
      percent: eligibleScholars.length
        ? Math.round((submittedScholars / eligibleScholars.length) * 100)
        : null,
    };
  }, [rows]);

  const documentTaskLevelData = useMemo(() => {
    const groups = new Map();
    rows.forEach((row) => {
      const level = row.year_level ? formatYearLevel(row.year_level) : 'Unspecified';
      const key = level;
      const group = groups.get(key) || {
        key: level,
        level,
        taskTypes: new Set(),
        scholars: new Map(),
      };
      const scholarId = String(row.scholar_id);
      const scholar = group.scholars.get(scholarId) || {
        scholar_id: row.scholar_id,
        scholar: row.scholar,
        year_level: row.year_level,
        document_progress: {},
      };
      (row.submission_task_progress || []).forEach((task) => {
        group.taskTypes.add(task.task_type);
        const progress = scholar.document_progress[task.task_type] || {
          submitted: 0,
          total: 0,
          task_titles: [],
        };
        progress.total += 1;
        if (task.submitted) progress.submitted += 1;
        if (task.task_title && !progress.task_titles.includes(task.task_title)) {
          progress.task_titles.push(task.task_title);
        }
        scholar.document_progress[task.task_type] = progress;
      });
      group.scholars.set(scholarId, scholar);
      groups.set(key, group);
    });
    return [...groups.values()]
      .filter((group) => group.taskTypes.size > 0)
      .sort((a, b) => YEAR_LEVEL_ORDER.indexOf(b.level) - YEAR_LEVEL_ORDER.indexOf(a.level))
      .map((group) => ({
        key: group.key,
        level: group.level,
        label: group.level,
        overallProgress: (() => {
          const eligibleScholars = [...group.scholars.values()].filter(
            (scholar) => Object.keys(scholar.document_progress).length > 0
          );
          const submitted = eligibleScholars.filter((scholar) => (
            Object.values(scholar.document_progress).every((progress) => progress.submitted === progress.total)
          )).length;
          return {
            eligible: eligibleScholars.length,
            submitted,
            percent: eligibleScholars.length ? Math.round((submitted / eligibleScholars.length) * 100) : 0,
          };
        })(),
        documentProgress: DOCUMENT_TASK_ORDER
          .filter((type) => group.taskTypes.has(type))
          .map((type) => {
            const eligibleScholars = [...group.scholars.values()].filter(
              (scholar) => scholar.document_progress[type]?.total > 0
            );
            const submitted = eligibleScholars.filter((scholar) => (
              scholar.document_progress[type].submitted === scholar.document_progress[type].total
            )).length;
            return {
              type,
              label: DOCUMENT_TASK_LABELS[type],
              eligible: eligibleScholars.length,
              submitted,
              percent: eligibleScholars.length ? Math.round((submitted / eligibleScholars.length) * 100) : 0,
            };
          }),
        scholars: [...group.scholars.values()].sort((a, b) => (
          String(a.scholar).localeCompare(String(b.scholar), undefined, { sensitivity: 'base' })
        )),
      }));
  }, [rows]);
  const dutyGroupProgress = useMemo(() => {
    const groups = new Map();
    rows.forEach((row) => {
      (row.duty_group_attendance || []).forEach((attendance) => {
        const key = String(attendance.group_id);
        const group = groups.get(key) || {
          group_id: attendance.group_id,
          group_name: attendance.group_name,
          scholars: new Map(),
        };
        const scholarId = String(attendance.scholar_id);
        const scholar = group.scholars.get(scholarId) || {
          scholar_id: attendance.scholar_id,
          scholar: attendance.scholar,
          year_level: attendance.year_level,
          status_counts: Object.keys(DUTY_STATUS_STYLES).reduce((counts, status) => {
            counts[status] = 0;
            return counts;
          }, {}),
        };
        const status = dutyStatusKey(attendance.attendance_status);
        if (status) scholar.status_counts[status] += 1;
        group.scholars.set(scholarId, scholar);
        groups.set(key, group);
      });
    });
    return [...groups.values()]
      .map((group) => ({
        group_id: group.group_id,
        group_name: group.group_name,
        scholars: [...group.scholars.values()].sort((a, b) => (
          String(a.scholar).localeCompare(String(b.scholar), undefined, { sensitivity: 'base' })
        )),
      }))
      .sort((a, b) => String(a.group_name).localeCompare(String(b.group_name), undefined, { numeric: true, sensitivity: 'base' }));
  }, [rows]);
  const selectedDutyGroup = dutyGroupProgress.find(
    (group) => String(group.group_id) === String(selectedDutyGroupId)
  );
  const selectedDocumentTask = documentTaskLevelData.find((task) => task.key === selectedDocumentTaskKey);
  const initialLoading = loading && rows.length === 0;
  const hasRows = rows.length > 0;
  const fieldStyle = { ...body, width: '100%', borderRadius: 12, padding: '9px 12px', border: `1px solid ${BORDER}`, background: '#fff', color: INK, fontSize: '0.85rem' };
  const thStyle = { ...body, textAlign: 'left', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.04em', color: PRIMARY_DEEP, padding: '10px 12px', whiteSpace: 'nowrap', background: '#F6EFE4' };
  const tdStyle = { ...body, fontSize: '0.82rem', color: INK, padding: '10px 12px', whiteSpace: 'nowrap' };

  return (
    <div className="min-h-screen w-full" style={{ background: BG, color: INK }}>
      <style>{`
        .dr-row:hover { background: #FBF7EE; }
        .dr-field:focus { outline: none; border-color: ${PRIMARY} !important; box-shadow: 0 0 0 3px rgba(109,33,64,0.1); }
      `}</style>
      <div className="w-full px-4 sm:px-6 lg:px-8" style={{ overflowX: 'hidden' }}>
        {initialLoading ? (
          <PageSkeleton />
        ) : (
          <>
            <AdminPageHeader
              title="Donor Reporting Center"
              description="Monthly scholarship impact, scholar progress, and donor-ready reports."
              className="mb-5"
              actions={
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end w-full lg:w-auto">
                <label className="flex-1 sm:w-44">
                  <span style={{ ...body, fontSize: '0.72rem', color: MUTED, display: 'block', marginBottom: 5 }}>Month</span>
                  <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="dr-field" style={fieldStyle} />
                </label>
                <label className="flex-1 sm:w-48">
                  <span style={{ ...body, fontSize: '0.72rem', color: MUTED, display: 'block', marginBottom: 5 }}>Year level</span>
                  <select value={yearLevel} onChange={(e) => setYearLevel(e.target.value)} className="dr-field" style={fieldStyle}>
                    <option value="">All levels</option>
                    {YEAR_LEVEL_ORDER.map((lvl) => <option key={lvl} value={lvl}>{lvl}</option>)}
                  </select>
                </label>
              </div>
              }
            />

            {error && (
              <div role="alert" style={{ ...surfaceCard, padding: '0.8rem 1.1rem', marginBottom: 16, borderColor: '#E8C5C1', background: '#FBEAE8', display: 'flex', alignItems: 'center', gap: 10 }}>
                <AlertTriangle size={16} color={DANGER} style={{ flexShrink: 0 }} />
                <span style={{ ...body, color: DANGER, fontWeight: 600, fontSize: '0.84rem' }}>{error}</span>
              </div>
            )}

            {/* Monthly Donor Summary */}
            <section
              style={{
                ...surfaceCard, background: 'rgba(109,33,64,0.05)', borderColor: 'rgba(109,33,64,0.18)',
                padding: '1.1rem 1.3rem', marginBottom: 16,
              }}
              className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
            >
              <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', minWidth: 0 }}>
                <IconBadge icon={FileText} />
                <div style={{ minWidth: 0 }}>
                  <div className="flex items-baseline gap-3 flex-wrap">
                    <h2 style={{ ...display, fontSize: '1.1rem', color: INK }}>Monthly Donor Summary</h2>
                    <span style={{ ...body, fontSize: '0.78rem', color: PRIMARY, fontWeight: 600 }}>{formatMonthLabel(month)}</span>
                  </div>
                  <p style={{ ...body, fontSize: '0.8rem', color: MUTED, marginTop: 3, maxWidth: 620, lineHeight: 1.55 }}>
                    Generate a donor-ready report with the same document task progress and duty group attendance shown below.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowMonthlyReport(true)}
                disabled={!hasRows}
                style={{
                  ...body, fontSize: '0.82rem', fontWeight: 600, color: '#fff', background: PRIMARY, border: 'none',
                  borderRadius: 12, padding: '10px 18px', whiteSpace: 'nowrap', minHeight: 40,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  cursor: hasRows ? 'pointer' : 'not-allowed', opacity: hasRows ? 1 : 0.55,
                }}
              >
                <FileText size={15} /> Generate Monthly Report
              </button>
            </section>

            {/* KPI cards */}
            <div className="grid gap-3 sm:grid-cols-2 mb-5">
              <KPICard
                icon={Users} label="Active Scholars" accent={PRIMARY}
                value={hasRows ? totals.totalScholars : '—'}
                note={hasRows ? 'Current active scholar roster.' : 'No active scholars found.'}
              />
              <KPICard
                icon={FileText} label="Overall Task Completion" accent={SUCCESS}
                value={overallTaskCompletion.percent === null ? '—' : `${overallTaskCompletion.percent}%`}
                note={overallTaskCompletion.eligible
                  ? `${overallTaskCompletion.submitted}/${overallTaskCompletion.eligible} eligible scholars completed all assigned documents.`
                  : 'No document tasks assigned this month.'}
              />
            </div>

            {/* Impact Overview */}
            <p style={{ ...body, fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', color: MUTED, textTransform: 'uppercase', margin: '4px 2px 10px' }}>
              Impact Overview
            </p>
            <div className="grid gap-4 lg:grid-cols-2 mb-6">
              <Panel icon={FileText} title="Document Task Status by Year Level" subtitle="Monthly Letter, COR, Grades, and Other Document submissions; percentages use eligible scholars.">
                {documentTaskLevelData.length ? (
                  <DocumentTaskList items={documentTaskLevelData} onView={setSelectedDocumentTaskKey} />
                ) : <NoData text={`No document task assigned for ${formatMonthLabel(month)}.`} />}
              </Panel>

              <Panel icon={HeartHandshake} title="Duty Groups" subtitle={`Groups assigned to duties in ${formatMonthLabel(month)}.`}>
                <DutyGroupProgressList items={dutyGroupProgress} onView={setSelectedDutyGroupId} />
              </Panel>
            </div>

            {/* Scholar Impact */}
            <section style={{ ...surfaceCard, padding: '1.1rem 1.2rem' }}>
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between" style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', minWidth: 0 }}>
                  <IconBadge icon={FileText} />
                  <div style={{ minWidth: 0 }}>
                    <h2 style={{ ...display, fontSize: '1.2rem', color: INK }}>Scholar Impact</h2>
                    <p style={{ ...body, fontSize: '0.78rem', color: MUTED, marginTop: 2 }}>Detailed progress, reports, and participation of each scholar.</p>
                  </div>
                </div>
                {hasRows && (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                      <Search size={15} color={MUTED} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                      <input
                        type="text"
                        value={scholarSearch}
                        onChange={(e) => setScholarSearch(e.target.value)}
                        placeholder="Search scholar…"
                        aria-label="Search scholar"
                        className="dr-field"
                        style={{ ...fieldStyle, paddingLeft: 34 }}
                      />
                    </div>
                    <select
                      value={scholarGradeFilter}
                      onChange={(e) => setScholarGradeFilter(e.target.value)}
                      aria-label="Filter by grade"
                      className="dr-field"
                      style={{ ...fieldStyle, width: 'auto', minWidth: 170, cursor: 'pointer' }}
                    >
                      <option value="">Filter by grade</option>
                      {YEAR_LEVEL_ORDER.map((level) => <option key={level} value={level}>{level}</option>)}
                    </select>
                  </div>
                )}
              </div>

              {!hasRows ? (
                <EmptyState title="No scholars found" text="No scholar data is available for the selected reporting period." />
              ) : filteredScholarRows.length === 0 ? (
                <EmptyState title="No scholars match your search or grade filter." text="Try adjusting your search or filters." />
              ) : (
                <>
                  <div style={{ overflowX: 'auto', border: `1px solid ${BORDER}`, borderRadius: 12 }}>
                    <table style={{ width: '100%', minWidth: 720, borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          {['#', 'Scholar', 'Student ID', 'Year Level', 'Actions'].map((h) => (
                            <th key={h} scope="col" style={thStyle}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedScholarRows.map((row, i) => {
                          return (
                            <tr key={row.scholar_id || row.scholar} className="dr-row" style={{ borderTop: `1px solid ${BORDER}` }}>
                              <td style={{ ...tdStyle, color: MUTED }}>{pageStart + i + 1}</td>
                              <td style={{ ...tdStyle, fontWeight: 600 }}>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                                  <span style={{ width: 28, height: 28, borderRadius: '50%', background: PRIMARY, color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.68rem', ...display }}>
                                    {getInitials(row.scholar)}
                                  </span>
                                  {row.scholar || '—'}
                                </span>
                              </td>
                              <td style={{ ...tdStyle, color: MUTED }}>{row.scholar_id || '—'}</td>
                              <td style={tdStyle}>{formatYearLevel(row.year_level)}</td>
                              <td style={tdStyle}>
                                <button
                                  type="button"
                                  onClick={() => setReportRow(row)}
                                  style={{
                                    ...body, fontSize: '0.76rem', fontWeight: 600, color: PRIMARY, background: '#fff',
                                    border: `1px solid ${BORDER}`, borderRadius: 9, padding: '6px 11px', cursor: 'pointer',
                                    display: 'inline-flex', alignItems: 'center', gap: 6,
                                  }}
                                >
                                  <FileText size={13} /> View Report
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" style={{ marginTop: 14 }}>
                    <span style={{ ...body, fontSize: '0.8rem', color: MUTED }}>
                      Showing {pageStart + 1}–{Math.min(pageStart + pageSize, filteredScholarRows.length)} of {filteredScholarRows.length} scholar{filteredScholarRows.length === 1 ? '' : 's'}
                    </span>
                    {scholarPageCount > 1 && (
                      <nav aria-label="Scholar pages" className="flex items-center gap-1.5 flex-wrap">
                        <button
                          type="button"
                          onClick={() => setScholarPage((p) => Math.max(1, p - 1))}
                          disabled={scholarPage === 1}
                          style={{ ...body, fontSize: '0.78rem', fontWeight: 600, color: scholarPage === 1 ? MUTED : PRIMARY, border: `1px solid ${BORDER}`, borderRadius: 9, padding: '6px 11px', background: '#fff', cursor: scholarPage === 1 ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                        >
                          <ChevronLeft size={14} /> Previous
                        </button>
                        {pageNumbers(scholarPage, scholarPageCount).map((p, i) => (
                          p === '…' ? (
                            <span key={`gap-${i}`} style={{ ...body, color: MUTED, padding: '0 4px' }}>…</span>
                          ) : (
                            <button
                              key={p}
                              type="button"
                              onClick={() => setScholarPage(p)}
                              aria-current={p === scholarPage ? 'page' : undefined}
                              style={{
                                ...body, fontSize: '0.78rem', fontWeight: 700, minWidth: 32, padding: '6px 8px', borderRadius: 9, cursor: 'pointer',
                                border: `1px solid ${p === scholarPage ? PRIMARY : BORDER}`,
                                background: p === scholarPage ? PRIMARY : '#fff', color: p === scholarPage ? '#fff' : INK,
                              }}
                            >
                              {p}
                            </button>
                          )
                        ))}
                        <button
                          type="button"
                          onClick={() => setScholarPage((p) => Math.min(scholarPageCount, p + 1))}
                          disabled={scholarPage === scholarPageCount}
                          style={{ ...body, fontSize: '0.78rem', fontWeight: 600, color: scholarPage === scholarPageCount ? MUTED : PRIMARY, border: `1px solid ${BORDER}`, borderRadius: 9, padding: '6px 11px', background: '#fff', cursor: scholarPage === scholarPageCount ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                        >
                          Next <ChevronRight size={14} />
                        </button>
                      </nav>
                    )}
                  </div>
                </>
              )}
            </section>
          </>
        )}
      </div>

      {reportRow && <DonorReportModal row={reportRow} month={month} onClose={() => setReportRow(null)} />}

      {selectedDutyGroup && (
        <DutyGroupModal
          group={selectedDutyGroup}
          month={month}
          onClose={() => setSelectedDutyGroupId(null)}
        />
      )}

      {selectedDocumentTask && (
        <DocumentTaskModal
          task={selectedDocumentTask}
          month={month}
          onClose={() => setSelectedDocumentTaskKey(null)}
        />
      )}

      {showMonthlyReport && (
        <MonthlyReportModal
          month={month}
          totals={totals}
          overallTaskCompletion={overallTaskCompletion}
          documentTaskLevelData={documentTaskLevelData}
          dutyGroupProgress={dutyGroupProgress}
          onClose={() => setShowMonthlyReport(false)}
        />
      )}
    </div>
  );
};

export default DonorReportingCenter;