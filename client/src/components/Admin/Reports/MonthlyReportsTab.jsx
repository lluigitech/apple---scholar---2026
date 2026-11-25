import { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { Search, ChevronLeft, ChevronRight, FolderOpen, Download, FileSpreadsheet, FileText, Eye, X, Printer, ExternalLink, Archive, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { formatYearLevelLabel } from '../../../utils/yearLevelLabels';
import { downloadReportSummaryPdf, monthPeriodLabel } from '../../../utils/reportPdfExport';
import { formatAdminDate, getAdminLocale, getAdminPageSize, getAdminTimezone } from '../../../utils/adminPreferences';
import FilePreviewModal from '../../Officer/ManualValidation/FilePreviewModal';
import { fileKind } from '../../../utils/submissionHelpers';

const API_BASE = (import.meta.env?.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
const API = API_BASE.endsWith('/api') ? API_BASE : `${API_BASE}/api`;
const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  if (!token) throw new Error('Your sign-in session has expired. Please sign in again.');
  return { Authorization: `Bearer ${token}` };
};
const postWithCurrentAuth = (url, data, config = {}) => axios.post(url, data, {
  ...config,
  headers: getAuthHeaders(),
});
const saveDownload = (blob, filename) => {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
};
const safeFilenamePart = (value) => String(value || '').replace(/[^a-z0-9._-]+/gi, '_');

const ARCHIVE_BULK_PATH = '/submission/archive/bulk';

const isArchivedRow = (r) => Boolean(
  r?.archived || r?.is_archived || r?.isArchived || r?.archived_at || r?.archivedAt
  || String(r?.status || '').toLowerCase() === 'archived'
);

// ── Design tokens — "Apple Scholar Executive" system ──
const PRIMARY = '#6D2140';
const BG = '#F7F4EE';
const SURFACE = '#FFFDF9';
const BORDER = '#E5D8CA';
const INK = '#241512';
const MUTED = '#8A7A68';
const BRONZE = '#A9784E';
const DANGER = '#C0473F';
const RADIUS = 16;
const display = { fontFamily: "'Playfair Display', Georgia, 'Times New Roman', serif" };
const body = { fontFamily: "'Inter', 'Segoe UI', sans-serif" };

const surfaceCard = {
  background: SURFACE,
  border: `1px solid ${BORDER}`,
  borderRadius: RADIUS,
  boxShadow: '0 1px 2px rgba(36,21,18,0.04)',
};

// Font size comes from the .mrt-field class: 16px on phones/tablets (stops iOS zoom), compact on desktop.
const fieldStyle = {
  width: '100%', height: 44, padding: '0 14px', borderRadius: 12,
  border: `1px solid ${BORDER}`, background: '#fff', ...body, color: INK, outline: 'none',
};

const labelStyle = { ...body, fontSize: '0.72rem', fontWeight: 700, color: PRIMARY, display: 'block', marginBottom: 6 };

const STATUS = {
  accepted: { label: 'Submitted', color: '#4F7656', bg: '#EAF3EB' },
  'medium-risk': { label: 'Submitted', color: '#4F7656', bg: '#EAF3EB' },
  'high-risk': { label: 'Submitted', color: '#4F7656', bg: '#EAF3EB' },
  'not-submitted': { label: 'Not Submitted', color: '#A83A3A', bg: '#FBEAE8' },
};
const normalizeStatus = (s) => (s === 'approved' || !s ? 'accepted' : s);

// Requirement badges (muted). Falls back to Monthly Letter because the
// monthly-submissions endpoint only returns monthly letters today.
const REQUIREMENTS = {
  'Monthly Letter': { color: '#7A2B4D', bg: '#F6E6EC' },
  COR: { color: '#3E5F86', bg: '#E6EEF7' },
  Grades: { color: '#62508A', bg: '#EDE8F6' },
  'Other Document': { color: '#5E5A55', bg: '#ECEAE6' },
};
const REQUIREMENT_OPTIONS = Object.keys(REQUIREMENTS);
const requirementOf = (r) => {
  const raw = String(r.requirement || r.requirementType || r.documentType || r.document_type || r.submissionType || r.submission_type || '').toLowerCase();
  if (!raw || raw === 'letter' || raw.includes('month')) return 'Monthly Letter';
  if (raw.includes('cor') || raw.includes('registration')) return 'COR';
  if (raw.includes('grade') || raw.includes('report card')) return 'Grades';
  return 'Other Document';
};

const fmtDate = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : formatAdminDate(d, { month: 'short' });
};
const monthLabel = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : new Intl.DateTimeFormat(getAdminLocale(), { timeZone: getAdminTimezone(), month: 'long', year: 'numeric' }).format(d);
};
const periodOf = (r) => r.period || r.periodLabel || monthLabel(r.submittedAt);
const rowKey = (r, i) => r.id || r._id || `${r.scholarName}-${r.submittedAt}-${i}`;

const getDownloadErrorMessage = async (error, fallback) => {
  if (error.response?.status === 401) {
    return 'Your sign-in session has expired. Please sign in again to download these documents.';
  }
  if (error.response?.status === 403) {
    return 'You are not authorized to download these documents.';
  }

  const responseData = error.response?.data;
  if (responseData instanceof Blob) {
    try {
      const body = JSON.parse(await responseData.text());
      return body.error || body.message || fallback;
    } catch {
      return fallback;
    }
  }

  return responseData?.error || responseData?.message || fallback;
};

const pageList = (current, total) => {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set([1, total, current - 1, current, current + 1]);
  const sorted = [...pages].filter(p => p >= 1 && p <= total).sort((a, b) => a - b);
  const out = [];
  sorted.forEach((p, i) => {
    if (i && p - sorted[i - 1] > 1) out.push('gap-' + p);
    out.push(p);
  });
  return out;
};

const StatusBadge = ({ status }) => {
  const s = STATUS[normalizeStatus(status)] || STATUS.accepted;
  return (
    <span style={{ ...body, fontSize: '0.74rem', fontWeight: 600, color: s.color, background: s.bg, borderRadius: 8, padding: '4px 10px', whiteSpace: 'nowrap' }}>
      {s.label}
    </span>
  );
};

const RequirementBadge = ({ type }) => {
  const c = REQUIREMENTS[type] || REQUIREMENTS['Other Document'];
  return (
    <span style={{ ...body, fontSize: '0.74rem', fontWeight: 600, color: c.color, background: c.bg, borderRadius: 8, padding: '4px 10px', whiteSpace: 'nowrap' }}>
      {type}
    </span>
  );
};

const Skeleton = () => (
  <div style={{ ...surfaceCard, padding: '1.4rem' }}>
    <div style={{ height: 14, width: 200, borderRadius: 8, background: '#EFE3D4', marginBottom: 18 }} />
    {Array.from({ length: 6 }).map((_, i) => (
      <div key={i} style={{ height: 38, borderRadius: 10, background: '#F2E9DC', marginBottom: 10 }} />
    ))}
  </div>
);

// ── PDF letter viewer — branded frame around the browser's PDF renderer ──
const PdfLetterModal = ({ preview, onClose }) => {
  const iframeRef = useRef(null);
  const [fit, setFit] = useState('page'); // 'page' = whole letter visible, 'width' = fill the width and scroll
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
  );

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const onChange = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Lock page scroll while the viewer is open.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, []);

  const fileName = `monthly-letter-${String(preview.title || 'scholar').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`;

  const handlePrint = () => {
    try {
      iframeRef.current?.contentWindow?.focus();
      iframeRef.current?.contentWindow?.print();
    } catch {
      window.open(preview.url, '_blank', 'noopener,noreferrer');
    }
  };

  const headerBtn = {
    ...body, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, height: 40, padding: '0 14px',
    borderRadius: 10, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', textDecoration: 'none',
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-stretch justify-center sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`PDF letter for ${preview.title}`}
      onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}
      style={{ background: 'rgba(36,21,18,0.6)' }}
    >
      <div
        className="flex w-full max-w-[1100px] flex-col overflow-hidden h-dvh sm:h-[min(92vh,960px)] sm:rounded-2xl"
        style={{ background: SURFACE, border: `1px solid ${BORDER}`, boxShadow: '0 24px 60px -20px rgba(36,21,18,0.4)' }}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4" style={{ background: BG, borderBottom: `1px solid ${BORDER}`, paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
          <div className="flex min-w-0 items-center gap-3">
            <span
              className="hidden sm:flex shrink-0 items-center justify-center"
              style={{ width: 40, height: 40, borderRadius: '50%', background: `${PRIMARY}14`, color: PRIMARY }}
            >
              <FileText size={18} />
            </span>
            <div className="min-w-0">
              <p style={{ ...body, color: BRONZE, fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Monthly Letter PDF
              </p>
              <h2 className="truncate" style={{ ...display, color: INK, fontSize: '1.2rem', fontWeight: 600, marginTop: 2 }}>{preview.title}</h2>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {!isMobile && (
              <button
                type="button"
                onClick={() => setFit(f => (f === 'page' ? 'width' : 'page'))}
                title={fit === 'page' ? 'Zoom to fill the width' : 'Show the whole page'}
                style={{ ...headerBtn, border: `1px solid ${BORDER}`, background: '#fff', color: PRIMARY }}
              >
                {fit === 'page' ? 'Fit width' : 'Fit page'}
              </button>
            )}
            {!isMobile && (
              <button type="button" onClick={handlePrint} style={{ ...headerBtn, border: `1px solid ${BORDER}`, background: '#fff', color: PRIMARY }}>
                <Printer size={15} /> Print
              </button>
            )}
            <a href={preview.url} download={fileName} style={{ ...headerBtn, border: `1px solid ${PRIMARY}`, background: PRIMARY, color: '#fff' }}>
              <Download size={15} /> <span className="hidden sm:inline">Download</span><span className="sm:hidden">Save</span>
            </a>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close PDF preview"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
              style={{ background: '#fff', color: MUTED, border: `1px solid ${BORDER}`, cursor: 'pointer' }}
            >
              <X size={17} />
            </button>
          </div>
        </div>

        {/* Body */}
        {isMobile ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 overflow-y-auto px-6 py-10 text-center" style={{ background: BG }}>
            <span style={{ width: 64, height: 64, borderRadius: '50%', background: `${PRIMARY}12`, color: PRIMARY, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileText size={28} />
            </span>
            <div>
              <h3 style={{ ...display, color: INK, fontSize: '1.15rem' }}>{preview.title}</h3>
              <p style={{ ...body, color: MUTED, fontSize: '0.84rem', marginTop: 6, maxWidth: 280 }}>
                PDF previews are not supported inside this view on phones. Open the letter in a new tab or save it to your device.
              </p>
            </div>
            <div className="flex w-full max-w-xs flex-col gap-2.5">
              <a href={preview.url} target="_blank" rel="noopener noreferrer" style={{ ...headerBtn, height: 46, border: `1px solid ${PRIMARY}`, background: PRIMARY, color: '#fff' }}>
                <ExternalLink size={15} /> Open PDF letter
              </a>
              <a href={preview.url} download={fileName} style={{ ...headerBtn, height: 46, border: `1px solid ${PRIMARY}`, background: '#fff', color: PRIMARY }}>
                <Download size={15} /> Save to device
              </a>
            </div>
          </div>
        ) : (
          <div className="min-h-0 flex-1 p-2 sm:p-3" style={{ background: BG }}>
            <iframe
              key={fit}
              ref={iframeRef}
              src={`${preview.url}#toolbar=0&navpanes=0&view=${fit === 'page' ? 'Fit' : 'FitH'}`}
              title={`Monthly letter PDF for ${preview.title}`}
              className="h-full w-full"
              style={{ border: `1px solid ${BORDER}`, borderRadius: 12, background: '#fff' }}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default function MonthlyReportsTab({
  filteredReports = [],
  loading,
  error,
  statusFilter,
  setStatusFilter,
  month,
  yearLevel,
  onRefresh,
  onSelectReport,
}) {
  const pageSize = getAdminPageSize();
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [docType, setDocType] = useState('all');
  const [selected, setSelected] = useState(() => new Set());
  const [generatingPdfId, setGeneratingPdfId] = useState(null);
  const [reportPdfLoading, setReportPdfLoading] = useState(false);
  const [bulkPdfLoading, setBulkPdfLoading] = useState(false);
  const [bulkDocxLoading, setBulkDocxLoading] = useState(false);
  const [pdfError, setPdfError] = useState('');
  const [pdfPreview, setPdfPreview] = useState(null);
  const [documentPreview, setDocumentPreview] = useState(null);

  // Archive (bulk) state
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [archiveError, setArchiveError] = useState('');
  const [archiveMessage, setArchiveMessage] = useState('');

  // Local search layered on the parent's filtered list (scholar name, ID, or assigned officer).
  // Archived rows are kept out of this active list (they live in Archive Management).
  const searchedReports = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const sorted = [...filteredReports]
      .filter(r => !isArchivedRow(r))
      .filter(r => docType === 'all' || requirementOf(r) === docType)
      .sort((a, b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0));
    if (!term) return sorted;
    return sorted.filter((r) => {
      const officer = r.assignedOfficer || r.assignedOfficerNames?.join(', ') || r.assigned_officer || '';
      const id = r.studentId || r.scholar_id || '';
      return [r.scholarName, id, officer].some(v => String(v || '').toLowerCase().includes(term));
    });
  }, [filteredReports, searchTerm, docType]);

  useEffect(() => { setPage(1); setSelected(new Set()); }, [searchTerm, month, yearLevel, statusFilter, docType, filteredReports.length]);

  const totalPages = Math.max(1, Math.ceil(searchedReports.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const pageRows = searchedReports.slice(start, start + pageSize);

  useEffect(() => {
    if (!pdfPreview) return undefined;
    const handleKeyDown = event => {
      if (event.key === 'Escape') setPdfPreview(null);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      URL.revokeObjectURL(pdfPreview.url);
    };
  }, [pdfPreview]);

  // Escape closes the archive confirmation (not while a request is running).
  useEffect(() => {
    if (!archiveOpen) return undefined;
    const handleKeyDown = event => {
      if (event.key === 'Escape' && !archiving) { setArchiveOpen(false); setArchiveError(''); }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [archiveOpen, archiving]);

  const hasActiveFilters = Boolean(searchTerm || yearLevel || statusFilter !== 'all' || docType !== 'all' || month !== new Date().toISOString().slice(0, 7));

  if (error) {
    return (
      <div className="text-center" style={{ ...surfaceCard, padding: '3rem 1.5rem' }}>
        <p style={{ ...body, fontSize: '0.9rem', color: DANGER, marginBottom: 16 }}>{error}</p>
        <button
          onClick={onRefresh}
          style={{ padding: '12px 24px', minHeight: 44, borderRadius: 10, background: PRIMARY, color: '#fff', ...body, fontWeight: 700, fontSize: '0.85rem', border: 'none', cursor: 'pointer' }}
        >
          Retry
        </button>
      </div>
    );
  }

  const pageKeys = pageRows.map((r, i) => !r.isMissing && rowKey(r, start + i)).filter(Boolean);
  const allOnPage = pageKeys.length > 0 && pageKeys.every(k => selected.has(k));
  const toggleAll = () => {
    const next = new Set(selected);
    pageKeys.forEach(k => (allOnPage ? next.delete(k) : next.add(k)));
    setSelected(next);
  };
  const toggleOne = (k) => {
    const next = new Set(selected);
    if (next.has(k)) next.delete(k); else next.add(k);
    setSelected(next);
  };

  // Letters to include in the bulk PDF download: the selected rows if any, otherwise everything in the current filter.
  const letterTargets = (selected.size
    ? searchedReports.filter((r, i) => selected.has(rowKey(r, i)))
    : searchedReports
  ).filter(r => !r.isMissing && requirementOf(r) === 'Monthly Letter');

  // Submission IDs of the selected rows (reuses the existing `selected` Set), de-duplicated.
  const selectedIds = [...new Set(
    searchedReports
      .filter((r, i) => selected.has(rowKey(r, i)))
      .map(r => r.id || r._id)
      .filter(Boolean)
  )];

  const focus = (e) => { e.target.style.borderColor = PRIMARY; };
  const blur = (e) => { e.target.style.borderColor = BORDER; };

  const openArchiveModal = () => {
    if (!selectedIds.length) return;
    setArchiveError('');
    setArchiveMessage('');
    setArchiveOpen(true);
  };
  const closeArchiveModal = () => {
    if (archiving) return;
    setArchiveOpen(false);
    setArchiveError('');
  };

  // ONE request for all selected submission IDs.
  const handleArchiveSelected = async () => {
    if (archiving || !selectedIds.length) return; // blocks double submission
    setArchiving(true);
    setArchiveError('');
    try {
      const { data } = await axios.post(
        `${API}${ARCHIVE_BULK_PATH}`,
        { submissionIds: selectedIds },
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } },
      );
      const archived = Number.isFinite(data?.archivedCount) ? data.archivedCount : selectedIds.length;
      const plural = (n) => `${n} submission record${n === 1 ? '' : 's'}`;
      setArchiveMessage(
        archived < selectedIds.length
          ? `${plural(archived)} archived. ${selectedIds.length - archived} were skipped (already archived or not found).`
          : `${plural(archived)} archived successfully.`
      );
      setArchiveOpen(false);
      setSelected(new Set());
      onRefresh && onRefresh(); // filters live in state above, so they are kept
    } catch (archiveFailure) {
      console.error('Could not archive submission records:', archiveFailure);
      // Keep modal open, selection and filters intact; do not pretend it worked.
      setArchiveError(
        archiveFailure.response?.data?.error
        || archiveFailure.response?.data?.message
        || 'Unable to archive the selected records. Nothing was changed.'
      );
    } finally {
      setArchiving(false);
    }
  };

  const handleViewLetterPdf = async (report) => {
    const submissionId = report.id || report._id;
    if (!submissionId) return;

    const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` };
    setGeneratingPdfId(submissionId);
    setPdfError('');
    try {
      const { data } = await axios.get(`${API}/submission/generate-pdf/${submissionId}?regenerate=1`, { headers });
      if (!data?.path) throw new Error('The PDF file path was not returned.');

      const pdfResponse = await axios.get(`${API}/submission/preview?url=${encodeURIComponent(data.path)}`, {
        headers,
        responseType: 'blob',
      });
      const objectUrl = URL.createObjectURL(new Blob([pdfResponse.data], { type: 'application/pdf' }));
      setPdfPreview({ url: objectUrl, title: report.scholarName || 'Scholar' });
    } catch (previewError) {
      console.error('Could not open monthly letter PDF:', previewError);
      setPdfError(previewError.response?.data?.error || previewError.message || 'Unable to generate or view the PDF letter.');
    } finally {
      setGeneratingPdfId(null);
    }
  };
  const handleViewDocument = (report, media, index) => {
    const path = media?.url || media?.path;
    if (!path) return;

    const label = `${requirementOf(report)}${(report.photos || []).length > 1 ? ` (${index + 1})` : ''} · ${report.scholarName || 'Scholar'}`;
    setDocumentPreview({
      url: `${API}/submission/preview?url=${encodeURIComponent(path)}`,
      kind: fileKind(path),
      label,
    });
  };
  const handleDownloadAllLetterPdfs = async () => {
    const targets = letterTargets
      .map(report => ({ report, id: report.id || report._id }))
      .filter(item => item.id);
    if (!targets.length) return;

    setBulkPdfLoading(true);
    setPdfError('');
    try {
      if (targets.length > 1) {
        const response = await postWithCurrentAuth(`${API}/submission/letters/bulk-pdf`, {
          submissionIds: targets.map(({ id }) => id),
        }, { responseType: 'blob' });
        saveDownload(new Blob([response.data], { type: 'application/zip' }), `monthly-letters-pdf-${new Date().toISOString().slice(0, 10)}.zip`);
      } else {
        for (const { report, id } of targets) {
          const response = await postWithCurrentAuth(`${API}/submission/letters/pdf`, { submissionId: id }, {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
            responseType: 'blob',
          });
          const objectUrl = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
          const link = document.createElement('a');
          const safeName = String(report.scholarName || `Scholar-${id}`).replace(/[^a-z0-9._-]+/gi, '_');
          link.href = objectUrl;
          link.download = `${safeName}_${safeFilenamePart(periodOf(report))}_Monthly_Letter_${id}.pdf`;
          document.body.appendChild(link);
          link.click();
          link.remove();
          window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
        }
      }
    } catch (downloadError) {
      console.error('Could not download monthly letter PDF documents:', downloadError);
      setPdfError(await getDownloadErrorMessage(downloadError, 'Unable to download the PDF letters. Please try again.'));
    } finally {
      setBulkPdfLoading(false);
    }
  };

  const handleDownloadAllLetterDocxs = async () => {
    const targets = letterTargets
      .map(report => ({ report, id: report.id || report._id }))
      .filter(item => item.id);
    if (!targets.length) return;

    setBulkDocxLoading(true);
    setPdfError('');
    try {
      if (targets.length > 1) {
        const response = await postWithCurrentAuth(`${API}/submission/letters/bulk-docx`, {
          submissionIds: targets.map(({ id }) => id),
        }, { responseType: 'blob' });
        saveDownload(
          new Blob([response.data], { type: 'application/zip' }),
          `monthly-letters-docx-${new Date().toISOString().slice(0, 10)}.zip`
        );
      } else {
        const [{ report, id }] = targets;
        const response = await postWithCurrentAuth(`${API}/submission/letters/docx`, { submissionId: id }, {
          responseType: 'blob',
        });
        const safeName = safeFilenamePart(report.scholarName || `Scholar-${id}`);
        const period = safeFilenamePart(periodOf(report));
        saveDownload(
          new Blob([response.data], {
            type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          }),
          `${safeName}_${period}_Monthly_Letter_${id}.docx`
        );
      }
    } catch (downloadError) {
      console.error('Could not download monthly letter DOCX documents:', downloadError);
      setPdfError(await getDownloadErrorMessage(downloadError, 'Unable to download the Word letters. Please try again.'));
    } finally {
      setBulkDocxLoading(false);
    }
  };

  const handleExportCsv = () => {
    setPdfError('');
    const rows = [
      ['Scholar Name', 'Student ID', 'Year Level', 'Requirement', 'Period', 'Submitted Date', 'Status'],
      ...searchedReports.map(report => [
        report.scholarName || 'Unknown Scholar',
        report.studentId || report.scholar_id || '',
        formatYearLevelLabel(report.year || report.yearLevel || report.year_level || ''),
        requirementOf(report),
        periodOf(report),
        fmtDate(report.submittedAt),
        (STATUS[normalizeStatus(report.status)] || STATUS.accepted).label,
      ]),
    ];
    const csv = `\uFEFF${rows.map(row => row.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n')}`;
    const objectUrl = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = `compliance-reports-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  };

  const handleExportPdf = async () => {
    if (reportPdfLoading || searchedReports.length === 0) return;
    setPdfError('');
    setReportPdfLoading(true);
    try {
      await downloadReportSummaryPdf({
        role: 'admin',
        reportTitle: 'Compliance Reports',
        reportType: 'Export Reports',
        periodLabel: month ? monthPeriodLabel(month) : 'All Periods',
        rows: searchedReports.map(report => ({
          scholarName: report.scholarName || 'Unknown Scholar',
          studentId: report.studentId || report.scholar_id || '',
          requirement: requirementOf(report),
          submittedAt: report.submittedAt || '',
          reviewStatus: (STATUS[normalizeStatus(report.status)] || STATUS.accepted).label,
        })),
      });
    } catch (exportError) {
      console.error('Could not export compliance reports PDF:', exportError);
      setPdfError(exportError.response?.data?.message || 'Unable to export the PDF report.');
    } finally {
      setReportPdfLoading(false);
    }
  };

  const th = { ...body, fontSize: '0.74rem', fontWeight: 700, color: INK, textAlign: 'left', padding: '12px 14px', whiteSpace: 'nowrap', borderBottom: `1px solid ${BORDER}`, background: BG };
  const td = { ...body, fontSize: '0.82rem', color: INK, padding: '12px 14px', whiteSpace: 'nowrap', borderBottom: `1px solid ${BORDER}66` };
  const actionBtn = { ...body, fontSize: '0.76rem', fontWeight: 600, padding: '5px 12px', borderRadius: 8, cursor: 'pointer', border: `1px solid ${PRIMARY}`, background: '#fff', color: PRIMARY };
  const touchBtn = { ...actionBtn, fontSize: '0.8rem', padding: '8px 14px', minHeight: 40, borderRadius: 10 };
  const archiveDisabled = selectedIds.length === 0 || archiving;

  const toolbarBtn = (disabled) => ({
    minHeight: 44, padding: '0 16px', borderRadius: 10, border: `1px solid ${PRIMARY}`,
    ...body, fontSize: '0.8rem', fontWeight: 700, whiteSpace: 'nowrap',
    cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
  });

  // Row actions — shared by the desktop table and the phone cards.
  const renderRowActions = (r, touch = false) => {
    const btn = touch ? touchBtn : actionBtn;
    const isLetter = requirementOf(r) === 'Monthly Letter';
    const submissionId = r.id || r._id;
    const opening = generatingPdfId === submissionId;
    const files = r.photos || [];

    if (r.isMissing) return <span style={{ ...body, fontSize: '0.74rem', color: MUTED }}>—</span>;
    if (isLetter) {
      return (
        <>
          <button type="button" onClick={() => onSelectReport && onSelectReport(r)} style={btn}>
            View
          </button>
          <button
            type="button"
            onClick={() => handleViewLetterPdf(r)}
            disabled={!submissionId || opening}
            aria-label={`View PDF letter for ${r.scholarName || 'scholar'}`}
            title="View PDF letter"
            className="flex items-center justify-center gap-1.5"
            style={{
              ...btn, padding: touch ? '8px 14px' : 0, width: touch ? 'auto' : 32, height: touch ? 'auto' : 28,
              border: `1px solid ${BORDER}`,
              cursor: !submissionId || opening ? 'wait' : 'pointer', opacity: opening ? 0.6 : 1,
            }}
          >
            {opening ? <span style={{ fontSize: '0.7rem' }}>…</span> : <FileText size={14} />}
            {touch && <span>{opening ? 'Opening…' : 'PDF'}</span>}
          </button>
        </>
      );
    }
    if (files.length > 0) {
      return files.map((media, mediaIndex) => (
        <button
          key={`${media.url || media.path}-${mediaIndex}`}
          type="button"
          onClick={() => handleViewDocument(r, media, mediaIndex)}
          aria-label={`View ${requirementOf(r)} document${files.length > 1 ? ` ${mediaIndex + 1}` : ''} for ${r.scholarName || 'scholar'}`}
          style={btn}
        >
          <span className="inline-flex items-center gap-1.5">
            <Eye size={13} /> View{files.length > 1 ? ` ${mediaIndex + 1}` : ''}
          </span>
        </button>
      ));
    }
    return <span style={{ ...body, fontSize: '0.74rem', color: MUTED }}>No file attached</span>;
  };

  return (
    <div className="flex flex-col gap-3 sm:gap-5 min-w-0">
      <style>{`
        .mrt-field { font-size: 1rem; }
        @media (min-width: 1024px) { .mrt-field { font-size: 0.85rem; } }
      `}</style>

      {/* ── Filter bar (filters apply live) ── */}
      <div
        className="grid gap-3 p-3.5 sm:p-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_auto] items-end min-w-0"
        style={{ ...surfaceCard }}
      >
        <div className="min-w-0 sm:col-span-2 lg:col-span-1">
          <label style={labelStyle}>Search Scholar</label>
          <div style={{ position: 'relative' }}>
            <Search size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: MUTED }} />
            <input
              type="search"
              className="mrt-field"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search scholar name or ID..."
              style={{ ...fieldStyle, paddingLeft: 38 }}
              onFocus={focus}
              onBlur={blur}
            />
          </div>
        </div>

        <div className="min-w-0">
          <label style={labelStyle}>Document Type</label>
          <select className="mrt-field" value={docType} onChange={e => setDocType(e.target.value)} style={{ ...fieldStyle, cursor: 'pointer' }} onFocus={focus} onBlur={blur}>
            <option value="all">All Requirements</option>
            {REQUIREMENT_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>

        <div className="min-w-0">
          <label style={labelStyle}>Status</label>
          <select className="mrt-field" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ ...fieldStyle, cursor: 'pointer' }} onFocus={focus} onBlur={blur}>
            <option value="all">All Statuses</option>
            <option value="submitted">Submitted</option>
            <option value="not-submitted">Not Submitted</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:col-span-2 lg:col-span-1">
          <button
            type="button"
            onClick={handleExportPdf}
            disabled={reportPdfLoading || searchedReports.length === 0}
            className="flex items-center justify-center gap-2"
            style={{
              height: 44, padding: '0 16px', borderRadius: 12, border: 'none',
              background: PRIMARY, color: '#fff',
              ...body, fontSize: '0.82rem', fontWeight: 700, cursor: reportPdfLoading || searchedReports.length === 0 ? 'not-allowed' : 'pointer',
              opacity: reportPdfLoading || searchedReports.length === 0 ? 0.6 : 1, whiteSpace: 'nowrap',
            }}
          >
            <FileText size={15} /> {reportPdfLoading ? 'Generating…' : 'Export PDF'}
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={searchedReports.length === 0}
            className="flex items-center justify-center gap-2"
            style={{ height: 44, padding: '0 16px', borderRadius: 12, border: `1px solid ${PRIMARY}`, background: '#fff', color: PRIMARY, ...body, fontSize: '0.82rem', fontWeight: 700, cursor: searchedReports.length === 0 ? 'not-allowed' : 'pointer', opacity: searchedReports.length === 0 ? 0.6 : 1, whiteSpace: 'nowrap' }}
          >
            <FileSpreadsheet size={15} /> Export CSV
          </button>
        </div>
      </div>

      {/* ── Submission Records ── */}
      {loading ? (
        <Skeleton />
      ) : (
        <section aria-labelledby="scholar-submissions-title" className="min-w-0 p-3.5 sm:p-5" style={{ ...surfaceCard }}>
          <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-3" style={{ marginBottom: 14 }}>
            <div className="min-w-0">
              <h2 id="scholar-submissions-title" style={{ ...display, fontWeight: 600, color: INK, lineHeight: 1.25 }} className="text-[1.1rem] sm:text-[1.25rem]">Submission Records</h2>
              <p style={{ ...body, fontSize: '0.8rem', color: MUTED, marginTop: 2, lineHeight: 1.5 }}>
                {statusFilter === 'not-submitted'
                  ? 'Scholars without a submission for the selected period.'
                  : statusFilter === 'all' && month
                    ? 'Submitted records and scholars without a submission for the selected month.'
                    : 'List of scholars and their submitted requirements.'}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 xl:flex xl:flex-wrap xl:justify-end gap-2">
              <button
                type="button"
                onClick={openArchiveModal}
                disabled={archiveDisabled}
                className="flex items-center justify-center gap-2"
                style={{
                  ...toolbarBtn(archiveDisabled),
                  background: archiveDisabled ? '#fff' : PRIMARY, color: archiveDisabled ? PRIMARY : '#fff',
                }}
              >
                <Archive size={14} />
                {selectedIds.length > 0 ? `Archive Selected (${selectedIds.length})` : 'Archive Selected'}
              </button>

              <button
                type="button"
                onClick={handleDownloadAllLetterPdfs}
                disabled={bulkPdfLoading || letterTargets.length === 0}
                className="flex items-center justify-center gap-2"
                style={{ ...toolbarBtn(bulkPdfLoading || letterTargets.length === 0), background: '#fff', color: PRIMARY }}
              >
                <Download size={14} />
                {bulkPdfLoading ? 'Preparing PDFs…' : `PDF letters (${letterTargets.length})`}
              </button>
              <button
                type="button"
                onClick={handleDownloadAllLetterDocxs}
                disabled={bulkDocxLoading || letterTargets.length === 0}
                className="flex items-center justify-center gap-2"
                style={{ ...toolbarBtn(bulkDocxLoading || letterTargets.length === 0), background: '#fff', color: PRIMARY }}
              >
                <Download size={14} />
                {bulkDocxLoading ? 'Preparing DOCX…' : `DOCS letters (${letterTargets.length})`}
              </button>
            </div>
          </div>

          {archiveMessage && (
            <div role="status" className="flex items-center gap-2.5" style={{ background: '#EAF3EB', border: '1px solid #CFE3D2', borderRadius: 12, padding: '10px 14px', marginBottom: 12 }}>
              <CheckCircle2 size={16} style={{ color: '#4F7656', flexShrink: 0 }} />
              <span style={{ ...body, fontSize: '0.82rem', color: '#4F7656', flex: 1, lineHeight: 1.45 }}>{archiveMessage}</span>
              <button type="button" onClick={() => setArchiveMessage('')} aria-label="Dismiss message" style={{ background: 'transparent', border: 'none', color: '#4F7656', cursor: 'pointer', padding: 6 }}>
                <X size={15} />
              </button>
            </div>
          )}
          {bulkPdfLoading && <p style={{ ...body, color: MUTED, fontSize: '0.8rem', marginBottom: 12 }}>Preparing PDF letters. This may take a moment…</p>}
          {bulkDocxLoading && <p style={{ ...body, color: MUTED, fontSize: '0.8rem', marginBottom: 12 }}>Preparing editable DOCX letters. This may take a moment…</p>}
          {pdfError && <p role="alert" style={{ ...body, color: DANGER, fontSize: '0.8rem', marginBottom: 12, lineHeight: 1.5 }}>{pdfError}</p>}

          {selected.size > 0 && (
            <div className="flex items-center justify-between gap-3" style={{ background: `${PRIMARY}0a`, border: `1px solid ${PRIMARY}33`, borderRadius: 12, padding: '8px 14px', marginBottom: 12 }}>
              <span style={{ ...body, fontSize: '0.8rem', fontWeight: 600, color: PRIMARY }}>{selected.size} selected</span>
              <button type="button" onClick={() => setSelected(new Set())} style={{ ...body, fontSize: '0.78rem', fontWeight: 600, color: PRIMARY, background: 'none', border: 'none', textDecoration: 'underline', cursor: 'pointer', padding: '6px 0' }}>
                Clear selection
              </button>
            </div>
          )}

          {searchedReports.length === 0 ? (
            <div className="text-center" style={{ padding: '3rem 1rem', border: `1px dashed ${BORDER}`, borderRadius: 14 }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: `${BRONZE}14`, color: BRONZE, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                <FolderOpen size={24} />
              </div>
              <h3 style={{ ...display, fontSize: '1.1rem', color: INK }}>No records found</h3>
              <p style={{ ...body, fontSize: '0.84rem', color: MUTED, marginTop: 4 }}>
                {hasActiveFilters ? 'Try changing or resetting the filters.' : 'Submissions appear here after scholars send their documents.'}
              </p>
            </div>
          ) : (
            <>
              {/* Phones & tablets: card list */}
              <div className="lg:hidden">
                <label className="flex items-center gap-2.5 mb-2.5 px-1" style={{ ...body, fontSize: '0.8rem', fontWeight: 600, color: INK, minHeight: 36, cursor: pageKeys.length ? 'pointer' : 'default' }}>
                  <input type="checkbox" aria-label="Select all on this page" checked={allOnPage} onChange={toggleAll} disabled={pageKeys.length === 0} style={{ accentColor: PRIMARY, width: 18, height: 18 }} />
                  Select all on this page
                </label>
                <ul className="flex flex-col gap-2.5" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {pageRows.map((r, i) => {
                    const key = rowKey(r, start + i);
                    const yl = r.year || r.yearLevel || r.year_level;
                    return (
                      <li
                        key={key}
                        className="p-3.5"
                        style={{
                          background: selected.has(key) ? `${PRIMARY}08` : '#fff',
                          border: `1px solid ${selected.has(key) ? `${PRIMARY}55` : BORDER}`,
                          borderRadius: 14,
                        }}
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            aria-label={`Select ${r.scholarName || 'row'}`}
                            checked={selected.has(key)}
                            onChange={() => toggleOne(key)}
                            disabled={r.isMissing}
                            style={{ accentColor: PRIMARY, width: 18, height: 18, marginTop: 2, flexShrink: 0 }}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <p style={{ ...body, fontSize: '0.9rem', fontWeight: 700, color: INK, lineHeight: 1.3, overflowWrap: 'anywhere' }}>{r.scholarName || 'Unknown Scholar'}</p>
                              <StatusBadge status={r.status} />
                            </div>
                            <p style={{ ...body, fontSize: '0.76rem', color: MUTED, marginTop: 3, overflowWrap: 'anywhere' }}>
                              {[r.studentId || r.scholar_id, yl ? formatYearLevelLabel(yl) : null].filter(Boolean).join(' · ') || '—'}
                            </p>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-2.5">
                              {!r.isMissing && <RequirementBadge type={requirementOf(r)} />}
                              <span style={{ ...body, fontSize: '0.76rem', color: MUTED }}>{periodOf(r)}</span>
                              <span style={{ ...body, fontSize: '0.76rem', color: MUTED }}>Submitted {fmtDate(r.submittedAt)}</span>
                            </div>
                          </div>
                        </div>
                        {!r.isMissing && (
                          <div className="flex flex-wrap items-center gap-2 mt-3 pt-3" style={{ borderTop: `1px solid ${BORDER}88` }}>
                            {renderRowActions(r, true)}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>

              {/* Desktop: table */}
              <div className="hidden lg:block" style={{ overflowX: 'auto', border: `1px solid ${BORDER}`, borderRadius: 14 }}>
                <table style={{ width: '100%', minWidth: 960, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ ...th, width: 40 }}>
                        <input type="checkbox" aria-label="Select all on this page" checked={allOnPage} onChange={toggleAll} disabled={pageKeys.length === 0} style={{ accentColor: PRIMARY }} />
                      </th>
                      {['#', 'Scholar Name', 'Student ID', 'Year Level', 'Requirement', 'Period', 'Submitted Date', 'Status', 'Action'].map(h => (
                        <th key={h} style={th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((r, i) => {
                      const key = rowKey(r, start + i);
                      const yl = r.year || r.yearLevel || r.year_level;
                      return (
                        <tr key={key} style={{ background: selected.has(key) ? `${PRIMARY}08` : 'transparent' }}>
                          <td style={td}>
                            <input type="checkbox" aria-label={`Select ${r.scholarName || 'row'}`} checked={selected.has(key)} onChange={() => toggleOne(key)} disabled={r.isMissing} style={{ accentColor: PRIMARY }} />
                          </td>
                          <td style={{ ...td, color: MUTED }}>{start + i + 1}</td>
                          <td style={{ ...td, fontWeight: 600 }}>{r.scholarName || 'Unknown Scholar'}</td>
                          <td style={td}>{r.studentId || r.scholar_id || '—'}</td>
                          <td style={td}>{yl ? formatYearLevelLabel(yl) : '—'}</td>
                          <td style={td}>{r.isMissing ? '—' : <RequirementBadge type={requirementOf(r)} />}</td>
                          <td style={td}>{periodOf(r)}</td>
                          <td style={td}>{fmtDate(r.submittedAt)}</td>
                          <td style={td}><StatusBadge status={r.status} /></td>
                          <td style={td}>
                            <div className="flex items-center gap-1.5">
                              {renderRowActions(r)}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* ── Pagination ── */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3" style={{ padding: '14px 4px 4px' }}>
                <span style={{ ...body, fontSize: '0.8rem', color: MUTED, lineHeight: 1.5 }}>
                  Showing {start + 1}–{Math.min(start + pageSize, searchedReports.length)} of {searchedReports.length} submission{searchedReports.length === 1 ? '' : 's'}{selected.size > 0 ? ` · ${selected.size} selected` : ''}
                </span>
                <nav className="flex items-center justify-between sm:justify-end gap-1.5" aria-label="Pagination">
                  <button
                    type="button" aria-label="Previous page" disabled={currentPage === 1}
                    onClick={() => setPage(currentPage - 1)}
                    style={{ width: 40, height: 40, borderRadius: 10, border: `1px solid ${BORDER}`, background: '#fff', color: INK, opacity: currentPage === 1 ? 0.4 : 1, cursor: currentPage === 1 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <ChevronLeft size={16} />
                  </button>

                  {/* Phones: compact "Page x of y" */}
                  <span className="sm:hidden" style={{ ...body, fontSize: '0.82rem', fontWeight: 600, color: INK }}>
                    Page {currentPage} of {totalPages}
                  </span>

                  {/* Larger screens: numbered pages */}
                  <div className="hidden sm:flex items-center gap-1.5">
                    {pageList(currentPage, totalPages).map(p => (
                      typeof p === 'string' ? (
                        <span key={p} style={{ ...body, color: MUTED, padding: '0 4px' }}>…</span>
                      ) : (
                        <button
                          key={p} type="button" onClick={() => setPage(p)} aria-current={p === currentPage ? 'page' : undefined}
                          style={{
                            minWidth: 36, height: 36, borderRadius: 10, ...body, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                            border: `1px solid ${p === currentPage ? PRIMARY : 'transparent'}`,
                            background: p === currentPage ? PRIMARY : 'transparent', color: p === currentPage ? '#fff' : INK,
                          }}
                        >
                          {p}
                        </button>
                      )
                    ))}
                  </div>

                  <button
                    type="button" aria-label="Next page" disabled={currentPage === totalPages}
                    onClick={() => setPage(currentPage + 1)}
                    style={{ width: 40, height: 40, borderRadius: 10, border: `1px solid ${BORDER}`, background: '#fff', color: INK, opacity: currentPage === totalPages ? 0.4 : 1, cursor: currentPage === totalPages ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <ChevronRight size={16} />
                  </button>
                </nav>
              </div>
            </>
          )}
        </section>
      )}

      {pdfPreview && <PdfLetterModal preview={pdfPreview} onClose={() => setPdfPreview(null)} />}
      {documentPreview && (
        <FilePreviewModal
          preview={documentPreview}
          onClose={() => setDocumentPreview(null)}
        />
      )}

      {/* ── Archive confirmation ── */}
      {archiveOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4"
          style={{ background: 'rgba(36,21,18,0.55)' }}
          onMouseDown={event => { if (event.target === event.currentTarget) closeArchiveModal(); }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="archive-modal-title"
            className="w-full rounded-t-[20px] sm:rounded-[16px]"
            style={{ background: SURFACE, border: `1px solid ${BORDER}`, maxWidth: 460, boxShadow: '0 24px 60px -20px rgba(36,21,18,0.4)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
          >
            <div className="px-5 sm:px-6" style={{ paddingTop: 22, paddingBottom: 8 }}>
              <div className="flex items-start gap-3">
                <span className="flex items-center justify-center flex-shrink-0" style={{ width: 40, height: 40, borderRadius: '50%', background: `${PRIMARY}12`, color: PRIMARY }}>
                  <Archive size={18} />
                </span>
                <h2 id="archive-modal-title" style={{ ...display, fontSize: '1.2rem', fontWeight: 600, color: INK, lineHeight: 1.3, paddingTop: 6 }}>Archive Submission Records?</h2>
              </div>
              <p style={{ ...body, fontSize: '0.86rem', lineHeight: 1.6, color: MUTED, marginTop: 12 }}>
                You are about to archive {selectedIds.length} submission record{selectedIds.length === 1 ? '' : 's'}.
              </p>
              <p style={{ ...body, fontSize: '0.86rem', lineHeight: 1.6, color: MUTED, marginTop: 6 }}>
                The records and uploaded files will be preserved for historical reference.
              </p>
              {archiveError && (
                <div role="alert" className="flex items-start gap-2" style={{ background: '#FBEAE8', border: '1px solid #F0CFCB', borderRadius: 10, padding: '10px 12px', marginTop: 14 }}>
                  <AlertTriangle size={15} style={{ color: DANGER, marginTop: 1, flexShrink: 0 }} />
                  <span style={{ ...body, fontSize: '0.8rem', color: DANGER, lineHeight: 1.45 }}>{archiveError}</span>
                </div>
              )}
            </div>
            <div className="flex gap-2 px-5 sm:px-6 sm:justify-end" style={{ paddingTop: 16, paddingBottom: 22 }}>
              <button
                type="button"
                onClick={closeArchiveModal}
                disabled={archiving}
                className="flex-1 sm:flex-none"
                style={{ ...body, minHeight: 44, padding: '0 18px', borderRadius: 10, border: `1px solid ${BORDER}`, background: '#fff', color: INK, fontSize: '0.84rem', fontWeight: 600, cursor: archiving ? 'default' : 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleArchiveSelected}
                disabled={archiving}
                className="flex-[1.6] sm:flex-none"
                style={{ ...body, minHeight: 44, padding: '0 18px', borderRadius: 10, border: `1px solid ${PRIMARY}`, background: PRIMARY, color: '#fff', fontSize: '0.84rem', fontWeight: 700, cursor: archiving ? 'wait' : 'pointer', opacity: archiving ? 0.7 : 1 }}
              >
                {archiving ? 'Archiving…' : `Archive ${selectedIds.length} Record${selectedIds.length === 1 ? '' : 's'}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}