// Monthly letter review queue and decision workflow.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Mail, CheckCircle2, XCircle, AlertTriangle, ChevronLeft, ChevronRight, ChevronDown,
  Download, CheckSquare, Square, Search, FileText, Eye, X, Clock3, SlidersHorizontal, FilterX,
  BarChart3, ListChecks, MessageSquare,
} from 'lucide-react';
import axios from 'axios';
import { formatYearLevelLabel } from '../../../utils/yearLevelLabels';
import { getOfficerDateRange, readOfficerWorkPreferences } from '../../../utils/officerWorkPreferences';
import { API_BASE as REPORTS_API_BASE, scoreColor } from './ReportsHelpers';
import { downloadReportSummaryPdf } from '../../../utils/reportPdfExport';

/* ───────── CONTRACT: i-match ito sa backend ─────────
 * GET  LIST_PATH?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD -> array ng rows (o { data: [...] })
 *   Mga field na binabasa (snake_case o camelCase): id, scholar_id|studentId, full_name|scholarName,
 *   year_level|year, course, school, submitted_at|submittedAt, quality_score|qualityScore,
 *   quality_status|status ('accepted'|'medium_risk'|'high_risk'), review_status|staff_action|staffAction
 *   ('pending'|'approved'|'returned'|'rejected'), staff_comment, letter_content, generated_pdf_path, content_breakdown
 *   (JSON/object: paragraph, academic, self_improvement, family, difficulty), sentiment_label, sentiment_score
 * POST ACTION_PATH(id) body: { action: 'approve' | 'return', comment }
 */
const LIST_PATH = '/officer/reports/monthly-submissions';
const ACTION_PATH = id => `/officer/reports/monthly-submissions/${encodeURIComponent(id)}/action`;
const LOG_PATH = '/export/google-sheets';

const API_BASE = REPORTS_API_BASE;
const authConfig = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

const letterFileName = letter => `Monthly_Letter_${String(letter.scholarName || 'Scholar').trim().replace(/[^\w-]+/g, '_')}_${letter.submittedRaw ? String(letter.submittedRaw).slice(0, 7) : 'report'}.pdf`;

const getLetterPdfBlob = async letter => {
  if (letter.pdfUrl) {
    const storedPath = String(letter.pdfUrl);
    const protectedFile = storedPath.startsWith('r2://') || storedPath.includes('res.cloudinary.com');
    const requestUrl = protectedFile
      ? `${API_BASE}/submission/preview?url=${encodeURIComponent(storedPath)}`
      : storedPath;
    const url = new URL(requestUrl, `${API_BASE}/`);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Unsupported letter PDF URL.');
    const apiOrigin = new URL(API_BASE).origin;
    const response = await axios.get(url.href, {
      ...(url.origin === apiOrigin ? authConfig() : {}),
      responseType: 'blob',
    });
    const blob = response.data instanceof Blob ? response.data : new Blob([response.data]);
    const contentType = blob.type.toLowerCase().split(';', 1)[0].trim();
    if (contentType && !['application/pdf', 'application/octet-stream'].includes(contentType)) {
      throw new Error('The letter file is not a PDF.');
    }
    return new Blob([blob], { type: 'application/pdf' });
  }

  if (!letter.fullText) throw new Error('Letter content is not available.');
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const margin = 56;
  doc.setFont('times', 'bold');
  doc.setFontSize(17);
  doc.setTextColor(79, 22, 32);
  doc.text('Monthly Progress Letter', margin, margin);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`${letter.scholarName} | ${letter.scholarId} | ${letter.yearLevel} | Submitted ${letter.submittedDate}`, margin, margin + 18);
  doc.setDrawColor(222, 208, 190);
  doc.line(margin, margin + 30, width - margin, margin + 30);
  doc.setFont('times', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(36, 21, 18);
  let y = margin + 58;
  for (const line of doc.splitTextToSize(letter.fullText, width - 2 * margin)) {
    if (y > height - margin) {
      doc.addPage();
      y = margin;
    }
    doc.text(line, margin, y);
    y += 18;
  }
  return doc.output('blob');
};

// ── Apple Scholar design tokens — same as the other Officer pages ──
const MAROON = '#6D2140', GOLD = '#A9784E', BG = '#F7F4EE', CARD = '#FFFDF9';
const RULE = '#E7D8C7', INK = '#241512', MUTED = '#8A7A68', SAGE = '#3F8A55', AMBER = '#B8863F', CLAY = '#C1666B';
const display = { fontFamily: "'Lora', Georgia, serif" };
const body = { fontFamily: "'Inter', 'Segoe UI', sans-serif" };
const mono = { fontFamily: "'IBM Plex Mono', ui-monospace, Menlo, monospace" };
const card = { background: CARD, border: `1px solid ${RULE}`, borderRadius: 16, boxShadow: '0 12px 28px -20px rgba(36,21,18,0.22)' };
const fieldLabel = { ...body, display: 'block', fontSize: '0.7rem', fontWeight: 600, color: MUTED, marginBottom: 6 };
const boxField = { height: 40, padding: '0 12px', border: `1px solid ${RULE}`, borderRadius: 10, background: CARD, ...body, fontSize: '0.82rem', color: INK, outline: 'none', minWidth: 0, width: '100%' };
const outlineBtn = { display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 38, padding: '0 14px', border: `1px solid ${RULE}`, borderRadius: 10, background: CARD, color: MAROON, whiteSpace: 'nowrap', ...body, fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' };
const filledBtn = c => ({ ...outlineBtn, justifyContent: 'center', background: c, color: '#fff', border: 'none', fontWeight: 700 });

// ── Config ──
const sentimentCfg = {
  positive: { color: SAGE, label: 'Positive' },
  neutral: { color: AMBER, label: 'Neutral' },
  negative: { color: CLAY, label: 'Negative' },
};
const qualityCfg = {
  accepted: { color: SAGE, label: 'Quality Accepted' },
  medium_risk: { color: AMBER, label: 'Quality Medium Risk' },
  high_risk: { color: CLAY, label: 'Quality High Risk' },
};
const reviewCfg = {
  pending: { color: AMBER, label: 'Pending Review' },
  approved: { color: SAGE, label: 'Approved' },
  returned: { color: CLAY, label: 'Returned' },
};
const RUBRIC = [
  { key: 'paragraph', label: 'Paragraph Structure', max: 7 },
  { key: 'academic', label: 'Academic Updates', max: 21 },
  { key: 'self_improvement', label: 'Self-Improvement', max: 14 },
  { key: 'family', label: 'Family Situation', max: 7 },
  { key: 'difficulty', label: 'Socio-Economic Difficulty', max: 21 },
];

// ── Adapter (isang lugar para sa response shape) ──
const pick = (row, ...keys) => { for (const k of keys) if (row[k] !== undefined && row[k] !== null) return row[k]; return undefined; };
const normReview = v => {
  const s = String(v || '').toLowerCase();
  if (s === 'approved') return 'approved';
  if (['returned', 'rejected', 'needs_revision', 'revision'].includes(s)) return 'returned';
  return 'pending';
};
const normQuality = v => {
  const s = String(v || '').toLowerCase().replace(/-/g, '_');
  return qualityCfg[s] ? s : null; // walang imbento
};
const formatDate = v => (v ? new Date(v).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '—');
const wordCountOf = t => String(t || '').trim().split(/\s+/).filter(Boolean).length;
const getSentiment = (label, score) => {
  const l = String(label || '').toLowerCase();
  const n = score === undefined || score === null || score === '' ? null : Number(score);
  const s100 = n === null || Number.isNaN(n) ? null : (n >= -1 && n <= 1 ? Math.round((n + 1) * 50) : Math.round(Math.max(0, Math.min(100, n))));
  const sentiment = ['positive', 'negative', 'neutral'].includes(l) ? l
    : s100 === null ? null : s100 >= 70 ? 'positive' : s100 < 40 ? 'negative' : 'neutral';
  return { sentiment, score: s100 };
};
const initialsOf = name => String(name || '?').split(/\s+/).map(n => n[0]).join('').slice(0, 2).toUpperCase();

const mapRow = row => {
  const fullText = pick(row, 'letter_content', 'letterContent') || '';
  let cb = pick(row, 'content_breakdown', 'contentBreakdown');
  try { if (typeof cb === 'string') cb = JSON.parse(cb); } catch { cb = null; }
  const v3Categories = cb?.v3?.categories && typeof cb.v3.categories === 'object'
    ? cb.v3.categories
    : null;
  const rubric = Array.isArray(cb?.criteria)
    ? cb.criteria.map(item => ({
      label: String(item.label || item.key || 'Scoring criterion'),
      max: Number(item.max) || 0,
      score: Number(item.score) || 0,
    }))
    : v3Categories
      ? Object.entries(v3Categories).map(([label, category]) => ({
        label,
        max: 15,
        score: Number(category?.score) || 0,
      }))
    : cb?.categories && typeof cb.categories === 'object'
      ? Object.entries(cb.categories).map(([label, value]) => ({ label, max: 15, score: Number(value) || 0 }))
    : cb && typeof cb === 'object'
      ? RUBRIC.map(r => ({ label: r.label, max: r.max, score: Number(cb[r.key] ?? 0) }))
      : [];
  const q = pick(row, 'quality_score', 'qualityScore');
  const score = q === undefined ? null : Number(q);
  const { sentiment, score: sScore } = getSentiment(pick(row, 'sentiment_label', 'sentimentLabel'), pick(row, 'sentiment_score', 'sentimentScore'));
  const quality = normQuality(pick(row, 'quality_status', 'qualityStatus', 'status'));
  const yl = pick(row, 'year_level', 'year');
  return {
    id: row.id, // totoong ID ng submission
    scholarId: pick(row, 'scholar_id', 'studentId', 'student_id') || '—',
    scholarName: pick(row, 'full_name', 'scholarName') || 'Unknown scholar',
    yearLevel: yl ? formatYearLevelLabel(yl) : '—',
    course: row.course || '', school: row.school || '',
    submittedRaw: pick(row, 'submitted_at', 'submittedAt'),
    submittedDate: formatDate(pick(row, 'submitted_at', 'submittedAt')),
    type: 'Monthly Progress Report',
    score, quality, sentiment, sentimentScore: sScore,
    experimentalClassification: cb?.primary_classification || cb?.experimental_classification || null,
    sentimentKeywords: Array.isArray(row.sentiment_keywords) ? row.sentiment_keywords : [],
    pdfUrl: pick(row, 'letter_pdf_url', 'letterPdfUrl', 'generated_pdf_path', 'generatedPdfPath', 'letter_file_url', 'file_url') || null,
    review: normReview(pick(row, 'review_status', 'staff_action', 'staffAction')),
    comment: pick(row, 'staff_comment', 'staffComment') || null,
    fullText, excerpt: fullText.slice(0, 240), wordCount: wordCountOf(fullText), rubric,
    bodyScore: Number(cb?.body_score ?? rubric.reduce((s, r) => s + r.score, 0)),
    scoringMethod: cb?.method === 'rule_based_v3'
      ? 'V3 rule-based'
      : cb?.method === 'rule_based'
        ? 'baseline rule-based'
        : 'rubric',
    checklist: [
      { label: 'Letter body provided', met: wordCountOf(fullText) > 0 },
      { label: 'Minimum word count (300+)', met: wordCountOf(fullText) >= 300 },
      { label: 'Quality evaluation available', met: score !== null },
    ],
    riskFlag: sentiment === 'negative' || quality === 'high_risk',
  };
};

// ── Small shared UI ──
const AlertStrip = ({ color, children, action }) => (
  <div className="flex items-center justify-between gap-3" style={{ borderRadius: 12, borderLeft: `3px solid ${color}`, background: `${color}0d`, padding: '11px 16px', ...body, fontSize: '0.8rem', fontWeight: 600, color }} role="alert">
    <span className="flex items-start gap-2"><AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 2 }} /><span>{children}</span></span>{action}
  </div>
);
const Pill = ({ color, children }) => (<span style={{ ...body, fontSize: '0.72rem', fontWeight: 600, padding: '4px 10px', borderRadius: 999, background: `${color}16`, color, whiteSpace: 'nowrap' }}>{children}</span>);
const ReviewPill = ({ review }) => {
  const cfg = reviewCfg[review] || reviewCfg.pending;
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap" style={{ ...body, fontSize: '0.7rem', fontWeight: 700, color: cfg.color, background: `${cfg.color}14`, border: `1px solid ${cfg.color}35`, borderRadius: 999, padding: '4px 10px' }}>
      <span className="rounded-full" style={{ width: 6, height: 6, background: cfg.color }} />{cfg.label}
    </span>
  );
};
const Avatar = ({ name, size = 36 }) => (
  <span className="flex flex-shrink-0 items-center justify-center rounded-full" style={{ width: size, height: size, background: `${MAROON}12`, color: MAROON, ...display, fontSize: size > 38 ? '0.9rem' : '0.74rem', fontWeight: 700 }}>
    {initialsOf(name)}
  </span>
);
const ScoreBar = ({ score, width = 64 }) => {
  if (score === null) return <span style={{ color: MUTED }}>—</span>;
  const color = scoreColor(score);
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-shrink-0 overflow-hidden rounded-full" style={{ width, background: RULE }}>
        <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, score))}%`, background: color }} />
      </div>
      <span style={{ ...mono, fontSize: '0.74rem', fontWeight: 700, color }}>{score}</span>
    </div>
  );
};
const SectionTitle = ({ icon: Icon, children }) => (
  <div className="mb-3 flex items-center gap-2.5">
    <span className="flex items-center justify-center rounded-full" style={{ width: 28, height: 28, background: `${GOLD}18`, color: GOLD }}><Icon size={13} /></span>
    <h3 style={{ ...display, fontSize: '0.98rem', fontWeight: 700, color: INK }}>{children}</h3>
  </div>
);
const MetricCard = ({ label, children }) => (
  <div style={{ background: BG, border: `1px solid ${RULE}`, borderRadius: 12, padding: '14px 16px' }}>
    <p style={{ ...body, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.05em', color: MUTED, marginBottom: 10 }}>{label}</p>{children}
  </div>
);
const SentimentGauge = ({ score, color }) => (
  <div>
    <div className="relative" style={{ height: 14, marginBottom: 2 }}>
      <div className="absolute inset-x-0 bottom-0 overflow-hidden rounded-full" style={{ height: 6, background: RULE }}>
        <div className="h-full rounded-full" style={{ width: `${score}%`, background: color }} />
      </div>
      <div className="absolute" style={{ left: `calc(${score}% - 5px)`, bottom: 4, width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: `6px solid ${color}` }} />
    </div>
    <div className="flex justify-between" style={{ ...body, fontSize: '0.62rem', color: MUTED }}><span>0</span><span>50</span><span>100</span></div>
  </div>
);

function PdfPages({ blob }) {
  const hostRef = useRef(null);
  const [state, setState] = useState('loading');

  useEffect(() => {
    let cancelled = false;
    let pdf = null;
    const renderTasks = [];

    const renderPdf = async () => {
      try {
        const pdfjs = await import('pdfjs-dist');
        const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
        pdf = await pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
        if (cancelled) {
          if (typeof pdf.destroy === 'function') await pdf.destroy();
          return;
        }
        const host = hostRef.current;
        if (!host) return;
        host.replaceChildren();

        const dpr = window.devicePixelRatio || 1;
        const width = Math.max(1, host.clientWidth - 20);
        for (let number = 1; number <= pdf.numPages; number += 1) {
          const page = await pdf.getPage(number);
          if (cancelled) return;
          const baseViewport = page.getViewport({ scale: 1 });
          const scale = Math.min(width / baseViewport.width, 1.6);
          const viewport = page.getViewport({ scale: scale * dpr });
          const canvas = document.createElement('canvas');
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          canvas.style.cssText = `width:${viewport.width / dpr}px;height:${viewport.height / dpr}px;display:block;margin:0 auto 14px;background:#fff;border:1px solid ${RULE};border-radius:4px;box-shadow:0 6px 16px -10px rgba(36,21,18,0.45)`;
          host.appendChild(canvas);
          const task = page.render({ canvasContext: canvas.getContext('2d'), viewport });
          renderTasks.push(task);
          await task.promise;
        }
        if (!cancelled) setState('ready');
      } catch (renderError) {
        if (!cancelled) {
          console.error('Could not render monthly letter PDF:', renderError);
          setState('error');
        }
      }
    };

    renderPdf();
    return () => {
      cancelled = true;
      renderTasks.forEach(task => task.cancel());
      if (typeof pdf?.destroy === 'function') void pdf.destroy();
    };
  }, [blob]);

  return (
    <div className="mlr-pdf-scroll" style={{ position: 'relative', overflowY: 'auto', background: '#EFE6D8', borderTop: `1px solid ${RULE}`, padding: 10 }}>
      <div ref={hostRef} />
      {state === 'loading' && <p style={{ ...body, fontSize: '0.8rem', color: MUTED, textAlign: 'center', padding: '24px 0' }}>Rendering letter…</p>}
      {state === 'error' && <p style={{ ...body, fontSize: '0.8rem', color: CLAY, textAlign: 'center', padding: '24px 0' }}>Could not display the PDF.</p>}
    </div>
  );
}

// ── Review modal (bottom sheet on phones, centered card on larger screens) ──
function ReviewModal({ letter, onClose, onDecide, initialMode = null }) {
  const [comment, setComment] = useState(letter.comment || '');
  const [mode, setMode] = useState(initialMode);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfErr, setPdfErr] = useState('');
  const [pdfBlob, setPdfBlob] = useState(null);
  const [showPdf, setShowPdf] = useState(false);
  const sc = letter.sentiment ? sentimentCfg[letter.sentiment] : null;
  const qColor = letter.score === null ? MUTED : scoreColor(letter.score);
  const reasonMissing = mode === 'return' && !comment.trim();
  const canDecide = letter.review === 'pending';

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape' && !submitting) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, submitting]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, []);

  const togglePdf = async () => {
    if (pdfBusy) return;
    if (showPdf) { setShowPdf(false); return; }
    if (pdfBlob) { setShowPdf(true); return; }
    setPdfBusy(true);
    setPdfErr('');
    try {
      const blob = await getLetterPdfBlob(letter);
      setPdfBlob(blob);
      setShowPdf(true);
    } catch (pdfError) {
      console.error('Could not prepare monthly letter PDF:', pdfError);
      setPdfErr('Could not load the letter PDF. Please try again.');
    } finally {
      setPdfBusy(false);
    }
  };

  const submit = async () => {
    if (!mode || reasonMissing || submitting) return;
    setSubmitting(true); setErr('');
    try { await onDecide(letter.id, mode, comment.trim()); onClose(); }
    catch (e) { setErr(e.response?.data?.error || e.response?.data?.message || 'Could not save the review decision.'); setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" style={{ background: 'rgba(36,21,18,0.55)' }} onClick={() => !submitting && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby="mlr-title" onClick={e => e.stopPropagation()} className="mlr-modal flex w-full flex-col"
        style={{ background: CARD, border: `1px solid ${RULE}`, boxShadow: '0 28px 60px -24px rgba(36,21,18,0.5)', overflow: 'hidden' }}>

        {/* Header */}
        <div className="flex flex-shrink-0 items-start justify-between gap-3" style={{ padding: '16px 18px', borderBottom: `1px solid ${RULE}` }}>
          <div className="flex min-w-0 items-center gap-3">
            <Avatar name={letter.scholarName} size={44} />
            <div className="min-w-0">
              <p style={{ ...body, fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.1em', color: GOLD }}>SUBMISSION DETAILS</p>
              <h2 id="mlr-title" style={{ ...display, fontSize: '1.2rem', fontWeight: 700, color: MAROON, lineHeight: 1.2, overflowWrap: 'anywhere' }}>{letter.scholarName}</h2>
              <p style={{ ...mono, fontSize: '0.68rem', color: MUTED, marginTop: 2, overflowWrap: 'anywhere' }}>{letter.scholarId} · {letter.yearLevel} · Submitted {letter.submittedDate}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <ReviewPill review={letter.review} />
                {letter.riskFlag && <Pill color={CLAY}>Risk Flag</Pill>}
              </div>
            </div>
          </div>
          <button onClick={onClose} disabled={submitting} aria-label="Close review" className="mlr-btn flex-shrink-0" style={{ ...outlineBtn, padding: 0, width: 40, height: 40, justifyContent: 'center' }}><X size={16} /></button>
        </div>

        {/* Body */}
        <div className="space-y-6 overflow-y-auto p-4 sm:p-6" style={{ flex: 1 }}>
          {letter.comment && (letter.review !== 'pending' || !mode) && (
            <AlertStrip color={AMBER}>Previous officer feedback: {letter.comment}</AlertStrip>
          )}

          <section>
            <SectionTitle icon={FileText}>Letter</SectionTitle>
            {letter.fullText || letter.pdfUrl ? (
              <div style={{ border: `1px solid ${RULE}`, borderRadius: 12, background: BG, overflow: 'hidden' }}>
                <div className="flex flex-wrap items-center gap-4" style={{ padding: '14px 16px' }}>
                  <span className="flex h-12 w-10 flex-shrink-0 flex-col items-center justify-center rounded-md" style={{ background: CARD, border: `1px solid ${RULE}`, color: CLAY }}>
                    <FileText size={18} />
                    <span style={{ ...mono, fontSize: '0.5rem', fontWeight: 700, marginTop: 2 }}>PDF</span>
                  </span>
                  <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                    <p style={{ ...body, fontSize: '0.84rem', fontWeight: 600, color: INK, overflowWrap: 'anywhere' }}>{letterFileName(letter)}</p>
                    <p style={{ ...body, fontSize: '0.72rem', color: MUTED, marginTop: 2 }}>{letter.wordCount} words · Monthly Progress Report</p>
                  </div>
                  <button onClick={togglePdf} disabled={pdfBusy} className="mlr-btn w-full sm:w-auto"
                    style={{ ...(showPdf ? outlineBtn : filledBtn(MAROON)), justifyContent: 'center', minHeight: 44, opacity: pdfBusy ? 0.6 : 1 }}>
                    {showPdf ? <X size={14} /> : <Eye size={14} />}
                    {pdfBusy ? 'Loading…' : showPdf ? 'Close Letter' : 'Open Letter'}
                  </button>
                </div>
                {showPdf && pdfBlob && <PdfPages blob={pdfBlob} />}
              </div>
            ) : <p style={{ ...body, fontSize: '0.84rem', color: MUTED }}>Letter content is not available.</p>}
            {pdfErr && <div className="mt-3"><AlertStrip color={CLAY}>{pdfErr}</AlertStrip></div>}
          </section>

          <section>
            <SectionTitle icon={BarChart3}>Report evaluation</SectionTitle>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                ['Quality Score', letter.score === null ? '—' : `${letter.score}%`, letter.rubric.length ? `${letter.bodyScore} / 70 ${letter.scoringMethod} points` : 'No rubric data', qColor],
                ['Sentiment', sc ? sc.label : '—', sc && letter.sentimentScore !== null ? `${letter.sentimentScore} / 100` : 'No sentiment data', sc?.color || MUTED],
                ['Word Count', letter.wordCount, 'words', INK],
              ].map(([label, value, sub, color], index) => (
                <div key={label} className={index === 2 ? 'col-span-2 sm:col-span-1' : ''} style={{ background: BG, border: `1px solid ${RULE}`, borderRadius: 12, padding: '12px 14px' }}>
                  <p style={{ ...body, fontSize: '0.64rem', fontWeight: 700, letterSpacing: '0.06em', color: MUTED, textTransform: 'uppercase' }}>{label}</p>
                  <p style={{ ...display, fontSize: '1.45rem', fontWeight: 700, color, lineHeight: 1.2, marginTop: 4 }}>{value}</p>
                  <p style={{ ...body, fontSize: '0.7rem', color: MUTED, marginTop: 2 }}>{sub}</p>
                </div>
              ))}
            </div>

            {sc && letter.sentimentScore !== null && (
              <div className="mt-3" style={{ border: `1px solid ${RULE}`, borderRadius: 12, padding: '12px 16px' }}>
                <SentimentGauge score={letter.sentimentScore} color={sc.color} />
                <p style={{ ...body, fontSize: '0.76rem', color: MUTED, marginTop: 8 }}>Overall: <strong style={{ color: sc.color }}>{sc.label}</strong></p>
              </div>
            )}

            {letter.experimentalClassification && (
              <div className="mt-3" style={{ border: `1px solid ${RULE}`, borderRadius: 12, background: `${AMBER}0a`, padding: '12px 16px' }}>
                <p style={{ ...body, fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.06em', color: CLAY }}>TF-IDF + LOGISTIC REGRESSION · PRIMARY CLASSIFICATION</p>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <p style={{ ...body, fontSize: '0.78rem', color: INK }}>
                    Sentiment: <strong>{letter.experimentalClassification.sentiment.label}</strong>
                    <span style={{ color: MUTED }}> ({letter.experimentalClassification.sentiment.confidence_percent}% confidence)</span>
                  </p>
                  <p style={{ ...body, fontSize: '0.78rem', color: INK }}>
                    Academic tone: <strong>{letter.experimentalClassification.academic_tone.label}</strong>
                    <span style={{ color: MUTED }}> ({letter.experimentalClassification.academic_tone.confidence_percent}% confidence)</span>
                  </p>
                </div>
                <p style={{ ...body, fontSize: '0.7rem', color: MUTED, marginTop: 6 }}>
                  Trained on synthetic examples; not human-validated. This advisory does not determine the score or trigger follow-up.
                </p>
              </div>
            )}
          </section>

          <section>
            <SectionTitle icon={ListChecks}>Score breakdown</SectionTitle>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <MetricCard label={letter.scoringMethod === 'rule-based' ? 'RULE-BASED SCORE BREAKDOWN' : 'RUBRIC BREAKDOWN'}>
                {letter.rubric.length ? <div className="space-y-3">
                  {letter.rubric.map(item => {
                    const percentage = item.max ? Math.min(100, (item.score / item.max) * 100) : 0;
                    const color = percentage >= 80 ? SAGE : percentage >= 50 ? AMBER : CLAY;
                    return <div key={item.label}>
                      <div className="flex items-center justify-between gap-3" style={{ marginBottom: 4 }}>
                        <span style={{ ...body, fontSize: '0.76rem', color: '#3f2f28' }}>{item.label}</span>
                        <span style={{ ...mono, fontSize: '0.72rem', fontWeight: 700, color: INK }}>{item.score}/{item.max}</span>
                      </div>
                      <div style={{ height: 5, borderRadius: 999, background: RULE, overflow: 'hidden' }}>
                        <div style={{ width: `${percentage}%`, height: '100%', background: color }} />
                      </div>
                    </div>;
                  })}
                </div> : <p style={{ ...body, fontSize: '0.8rem', color: MUTED }}>No rubric data.</p>}
              </MetricCard>
              <div className="space-y-3">
                <MetricCard label="COMPLETENESS">
                  <div className="space-y-2">
                    {letter.checklist.map(item => (
                      <div key={item.label} className="flex items-center gap-2">
                        {item.met ? <CheckSquare size={13} style={{ color: SAGE, flexShrink: 0 }} /> : <Square size={13} style={{ color: CLAY, flexShrink: 0 }} />}
                        <span style={{ ...body, fontSize: '0.78rem', color: item.met ? '#3f2f28' : CLAY }}>{item.label}</span>
                      </div>))}
                  </div>
                </MetricCard>
                {letter.sentimentKeywords.length > 0 && (
                  <MetricCard label="KEYWORDS">
                    <div className="flex flex-wrap gap-1.5">
                      {letter.sentimentKeywords.map((keyword, index) => {
                        const word = typeof keyword === 'string' ? keyword : keyword.word;
                        const type = typeof keyword === 'string' ? '' : keyword.type;
                        const color = type === 'positive' ? SAGE : type === 'negative' ? CLAY : MUTED;
                        return <span key={index} style={{ ...body, fontSize: '0.7rem', fontWeight: 600, padding: '3px 10px', borderRadius: 999, background: `${color}14`, color }}>{word}</span>;
                      })}
                    </div>
                  </MetricCard>)}
              </div>
            </div>
          </section>
        </div>

        {/* Decision footer */}
        {canDecide && (
          <div className="flex-shrink-0" style={{ borderTop: `1px solid ${RULE}`, padding: '12px 16px', paddingBottom: 'max(12px, env(safe-area-inset-bottom))', background: CARD }}>
            {!mode ? (
              <div className="grid gap-3 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
                <p className="flex items-center gap-2" style={{ ...body, fontSize: '0.74rem', fontWeight: 700, letterSpacing: '0.06em', color: INK }}><MessageSquare size={14} style={{ color: GOLD }} /> OFFICER DECISION</p>
                <div className="grid grid-cols-1 gap-2 min-[400px]:grid-cols-2 sm:flex sm:flex-wrap">
                  <button onClick={() => setMode('return')} style={{ ...filledBtn(CLAY), minHeight: 44 }}><XCircle size={14} /> Return for Revision</button>
                  <button onClick={() => setMode('approve')} style={{ ...filledBtn(SAGE), minHeight: 44 }}><CheckCircle2 size={14} /> Approve</button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <label htmlFor="mlr-comment" style={{ ...body, fontSize: '0.78rem', fontWeight: 600, color: mode === 'approve' ? SAGE : CLAY }}>
                  {mode === 'approve' ? 'Approval note (optional)' : 'Reason for returning (required)'}
                </label>
                <textarea id="mlr-comment" value={comment} onChange={event => setComment(event.target.value)} rows={3} autoFocus className="mlr-field w-full resize-none outline-none"
                  placeholder={mode === 'approve' ? 'Optional approval note...' : 'Explain what needs to be revised...'}
                  style={{ ...body, fontSize: '0.88rem', padding: '12px 14px', borderRadius: 12, border: `1px solid ${reasonMissing ? `${CLAY}88` : RULE}`, background: BG, color: INK }} />
                {reasonMissing && <p style={{ ...body, fontSize: '0.74rem', color: CLAY }}>A reason is required before returning this letter.</p>}
                {err && <AlertStrip color={CLAY}>{err}</AlertStrip>}
                <div className="grid grid-cols-1 gap-2 min-[400px]:grid-cols-2 sm:flex sm:flex-wrap sm:justify-end">
                  <button onClick={() => { setMode(null); setErr(''); }} disabled={submitting} className="mlr-btn" style={{ ...outlineBtn, justifyContent: 'center', minHeight: 44 }}>Cancel</button>
                  <button onClick={submit} disabled={reasonMissing || submitting} style={{ ...filledBtn(mode === 'approve' ? SAGE : CLAY), minHeight: 44, opacity: reasonMissing || submitting ? 0.5 : 1, cursor: reasonMissing || submitting ? 'not-allowed' : 'pointer' }}>
                    {submitting ? 'Saving…' : `Confirm ${mode === 'approve' ? 'Approval' : 'Return'}`}
                  </button>
                </div>
              </div>)}
          </div>)}
      </div>
    </div>
  );
}

// ── CSV helpers ──
const csvCell = v => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

const DEFAULT_FILTERS = { search: '', yearLevel: 'all', sentiment: 'all', status: 'all' };
const DEFAULT_PERIOD = '6m';

// Defined outside the page component so it is not remounted on every render.
const Select = ({ id, label, value, onChange, options, disabled = false }) => (
  <div className="min-w-0">
    <label htmlFor={id} style={fieldLabel}>{label}</label>
    <select id={id} className="mlr-field" value={value} onChange={e => onChange(e.target.value)} disabled={disabled}
      style={{ ...boxField, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.7 : 1 }}>
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  </div>
);

const KpiCard = ({ icon: Icon, label, value, note, color }) => (
  <div className="flex min-w-0 flex-col items-start gap-2.5 sm:flex-row sm:gap-3.5" style={{ ...card, padding: 'clamp(12px, 3vw, 18px)' }}>
    <span className="flex shrink-0 items-center justify-center" style={{ width: 42, height: 42, borderRadius: 12, background: `${color}1a`, color }}>
      <Icon size={19} />
    </span>
    <div className="min-w-0">
      <p style={{ ...display, color: MAROON, fontSize: 'clamp(1.3rem, 4vw, 1.7rem)', fontWeight: 700, lineHeight: 1 }}>{value}</p>
      <p style={{ ...body, color: INK, fontSize: '0.78rem', fontWeight: 600, marginTop: 6 }}>{label}</p>
      <p className="hidden sm:block" style={{ ...body, color: MUTED, fontSize: '0.72rem', marginTop: 2, lineHeight: 1.4 }}>{note}</p>
    </div>
  </div>
);

// ── Main ──
export default function MonthlyLetterReview({ assignedYearLevels = [], assignedYearLevelsLoading = false }) {
  const [workPreferences] = useState(readOfficerWorkPreferences);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState(DEFAULT_PERIOD);
  const [month, setMonth] = useState('');
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const pageSize = workPreferences.pageSize;
  const [selectedId, setSelectedId] = useState(null);
  const [selectedAction, setSelectedAction] = useState(null);
  const reqId = useRef(0);

  const load = useCallback(async () => {
    const id = ++reqId.current;
    setLoading(true); setError('');
    try {
      const dateRange = month ? { month } : getOfficerDateRange(period);
      const res = await axios.get(`${API_BASE}${LIST_PATH}`, { ...authConfig(), params: dateRange });
      if (id !== reqId.current) return; // stale response
      const list = Array.isArray(res.data) ? res.data : res.data?.data || res.data?.submissions || [];
      setRows(list.map(mapRow));
    } catch (e) {
      if (id === reqId.current) setError(e.response?.data?.error || 'Could not load monthly letter submissions.');
    } finally { if (id === reqId.current) setLoading(false); }
  }, [month, period]);

  useEffect(() => { load(); }, [load]);

  const setFilter = (key, value) => { setFilters(f => ({ ...f, [key]: value })); setPage(1); };
  const yearLevelOptions = useMemo(() => {
    const src = assignedYearLevels.map(formatYearLevelLabel);
    return [...new Set(src)].sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }));
  }, [assignedYearLevels]);

  const filtered = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    return rows.filter(r =>
      (!q || r.scholarName.toLowerCase().includes(q) || String(r.scholarId).toLowerCase().includes(q)) &&
      (filters.yearLevel === 'all' || r.yearLevel === filters.yearLevel) &&
      (filters.sentiment === 'all' || r.sentiment === filters.sentiment) &&
      (filters.status === 'all' || r.review === filters.status));
  }, [rows, filters]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);

  const pendingCount = rows.filter(r => r.review === 'pending').length;
  const approvedCount = rows.filter(r => r.review === 'approved').length;
  const riskCount = rows.filter(r => r.riskFlag).length;
  const selected = rows.find(r => r.id === selectedId) || null;

  const filtersActive = month !== '' || period !== DEFAULT_PERIOD || filters.search !== '' || filters.yearLevel !== 'all' || filters.sentiment !== 'all' || filters.status !== 'all';
  const resetFilters = () => { setFilters(DEFAULT_FILTERS); setPeriod(DEFAULT_PERIOD); setMonth(''); setPage(1); };

  // Isang decision workflow; ang modal ang nagpapakita ng error kapag nag-throw.
  const handleDecide = async (id, action, comment) => {
    await axios.post(`${API_BASE}${ACTION_PATH(id)}`, { action, comment: comment || null }, authConfig());
    setRows(list => list.map(r => r.id === id
      ? { ...r, review: action === 'approve' ? 'approved' : 'returned', comment: comment || null } : r));
    load(); // i-sync sa server (counts, filters, pagination)
  };

  const openReview = (id, action = null) => { setSelectedId(id); setSelectedAction(action); };

  const exportCSV = () => {
    const header = ['Scholar ID', 'Scholar Name', 'Submission Type', 'Submission Date', 'Completeness/Quality Score', 'Sentiment', 'Sentiment Score'];
    const data = filtered.map(r => [r.scholarId, r.scholarName, r.type, r.submittedDate,
      r.score === null ? '' : `${r.score}%`, r.sentiment || '', r.sentimentScore === null ? '' : `${r.sentimentScore}/100`]);
    const csv = [header, ...data].map(row => row.map(csvCell).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a'); a.href = url; a.download = 'monthly_letter_review.csv'; a.click(); URL.revokeObjectURL(url);
    axios.post(`${API_BASE}${LOG_PATH}`, { log_only: true, module: 'Monthly Letter Review', report_resource: 'Monthly Letter Review Export', spreadsheet_title: 'Monthly Letter Review Export', details: 'monthly_letter_review.csv' }, authConfig()).catch(() => {}); // best-effort
  };

  const exportPDF = async () => {
    setGeneratingPdf(true);
    setError('');
    try {
      await downloadReportSummaryPdf({
        role: 'officer',
        reportTitle: 'Monthly Letter Review',
        reportType: 'Monthly Letter Review',
        periodLabel: { '1m': 'Last month', '3m': 'Last 3 months', '6m': 'Last 6 months' }[period],
        rows: filtered.map(row => ({
          scholarName: row.scholarName,
          studentId: row.scholarId,
          yearLevel: row.yearLevel,
          qualityScore: row.score,
          sentiment: row.sentiment,
          submittedAt: row.submittedRaw,
        })),
      });
    } catch (exportError) {
      console.error('Could not export monthly letter review PDF:', exportError);
      setError(exportError.response?.data?.message || 'Unable to export the monthly letter PDF. Please try again.');
    } finally {
      setGeneratingPdf(false);
    }
  };

  const exportDisabled = generatingPdf || filtered.length === 0;
  const thStyle = { ...body, fontSize: '0.72rem', fontWeight: 700, color: MUTED, textAlign: 'left', padding: workPreferences.density === 'compact' ? '8px 12px' : '12px 14px', background: BG, borderBottom: `1px solid ${RULE}`, whiteSpace: 'nowrap' };
  const tdStyle = { padding: workPreferences.density === 'compact' ? '8px 12px' : '12px 14px', verticalAlign: 'middle' };

  return (
    <div className="flex flex-col gap-5" style={{ minWidth: 0, ...body }}>
      <style>{`
        .mlr-btn:hover:not(:disabled){background:${BG}}
        .mlr-btn:focus-visible{outline:2px solid ${GOLD};outline-offset:2px}
        .mlr-field:focus{border-color:${MAROON}!important;box-shadow:0 0 0 3px rgba(109,33,64,.10)}
        .mlr-row{transition:background-color 150ms ease;cursor:pointer}
        .mlr-row:hover{background:#FBF7EE}
        .mlr-menu-item:hover:not(:disabled){background:${BG}}
        .mlr-scroll::-webkit-scrollbar{height:6px}
        .mlr-scroll::-webkit-scrollbar-thumb{background:rgba(109,33,64,.18);border-radius:999px}
        .mlr-modal{max-width:880px;max-height:90vh;max-height:90dvh;border-radius:16px}
        .mlr-pdf-scroll{max-height:520px}
        @media(max-width:639px){
          .mlr-modal{max-height:94vh;max-height:94dvh;border-radius:18px 18px 0 0}
          .mlr-pdf-scroll{max-height:62vh;max-height:62dvh}
          /* 16px prevents iOS Safari from zooming in when a field is focused */
          .mlr-field{font-size:16px!important}
        }
        @media (prefers-reduced-motion: reduce){ .mlr-row{transition:none} }
      `}</style>

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-4 xl:grid-cols-4">
        <KpiCard icon={Mail} label="Total Letters" value={loading ? '—' : rows.length} note="Submitted in the selected period" color={MAROON} />
        <KpiCard icon={Clock3} label="Pending Review" value={loading ? '—' : pendingCount} note="Waiting for an officer decision" color={AMBER} />
        <KpiCard icon={CheckCircle2} label="Approved" value={loading ? '—' : approvedCount} note="Accepted by an officer" color={SAGE} />
        <KpiCard icon={AlertTriangle} label="Risk Flagged" value={loading ? '—' : riskCount} note="Negative sentiment or high-risk quality" color={CLAY} />
      </div>

      {/* ── Filters ── */}
      <section aria-label="Letter filters" style={{ ...card, padding: 'clamp(14px, 3vw, 20px)' }}>
        <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex items-center justify-center rounded-full" style={{ width: 30, height: 30, background: `${GOLD}18`, color: GOLD }}><SlidersHorizontal size={14} /></span>
            <h2 style={{ ...display, fontSize: '1.05rem', fontWeight: 700, color: INK }}>Filters</h2>
          </div>

          <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
            {filtersActive && (
              <button type="button" onClick={resetFilters} className="mlr-btn" style={{ ...outlineBtn, minHeight: 36, padding: '0 12px', fontSize: '0.76rem', fontWeight: 700 }}>
                <FilterX size={13} /> Reset
              </button>
            )}
            <div style={{ position: 'relative' }}>
              <button type="button" onClick={() => setExportOpen(v => !v)} aria-haspopup="menu" aria-expanded={exportOpen}
                className="mlr-btn transition-opacity hover:opacity-90"
                style={{ ...filledBtn(MAROON), minHeight: 36, padding: '0 14px', cursor: generatingPdf ? 'wait' : 'pointer' }}>
                <Download size={14} /> {generatingPdf ? 'Generating PDF…' : 'Export'} <ChevronDown size={13} />
              </button>
              {exportOpen && (
                <>
                  <div onClick={() => setExportOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 30 }} />
                  <div role="menu" style={{ ...card, position: 'absolute', right: 0, top: 'calc(100% + 6px)', minWidth: 180, zIndex: 31, boxShadow: '0 16px 32px -18px rgba(36,21,18,0.3)', padding: 6 }}>
                    <button type="button" role="menuitem" disabled={exportDisabled} className="mlr-menu-item"
                      onClick={() => { setExportOpen(false); exportPDF(); }}
                      style={{ ...body, width: '100%', textAlign: 'left', border: 'none', background: 'transparent', padding: '10px', borderRadius: 8, color: INK, fontSize: '0.82rem', cursor: exportDisabled ? 'not-allowed' : 'pointer', opacity: exportDisabled ? 0.55 : 1 }}>
                      <span className="inline-flex items-center gap-2"><FileText size={14} /> Download PDF</span>
                    </button>
                    <button type="button" role="menuitem" disabled={filtered.length === 0} className="mlr-menu-item"
                      onClick={() => { setExportOpen(false); exportCSV(); }}
                      style={{ ...body, width: '100%', textAlign: 'left', border: 'none', background: 'transparent', padding: '10px', borderRadius: 8, color: INK, fontSize: '0.82rem', cursor: filtered.length === 0 ? 'not-allowed' : 'pointer', opacity: filtered.length === 0 ? 0.55 : 1 }}>
                      <span className="inline-flex items-center gap-2"><Download size={14} /> Download CSV</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <div className="min-w-0 sm:col-span-2 lg:col-span-3 xl:col-span-5">
            <label htmlFor="mlr-search" style={fieldLabel}>Search scholar</label>
            <div className="relative">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: '#B8A999' }} />
              <input id="mlr-search" className="mlr-field" value={filters.search} onChange={e => setFilter('search', e.target.value)} placeholder="Scholar name or ID…"
                style={{ ...boxField, paddingLeft: 34 }} />
            </div>
          </div>

          <Select id="mlr-period" label="Reporting period" value={period} onChange={v => { setPeriod(v); setPage(1); }}
            options={[['1m', 'Last month'], ['3m', 'Last 3 months'], ['6m', 'Last 6 months']]} />

          <div className="min-w-0">
            <label htmlFor="mlr-month" style={fieldLabel}>Month</label>
            <div className="flex items-center gap-2">
              <input id="mlr-month" className="mlr-field" type="month" value={month} onChange={e => { setMonth(e.target.value); setPage(1); }} style={{ ...boxField, flex: 1, cursor: 'pointer' }} />
              {month && (
                <button type="button" onClick={() => { setMonth(''); setPage(1); }}
                  style={{ ...body, border: 'none', background: 'none', color: MAROON, fontSize: '0.76rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', minHeight: 40 }}>Clear</button>
              )}
            </div>
          </div>

          <Select id="mlr-year" label="Year level" value={filters.yearLevel} onChange={v => setFilter('yearLevel', v)}
            disabled={assignedYearLevelsLoading || yearLevelOptions.length === 0}
            options={[['all', assignedYearLevelsLoading ? 'Loading assigned year levels...' : yearLevelOptions.length ? 'All Assigned Year Levels' : 'No Assigned Year Levels'], ...yearLevelOptions.map(y => [y, y])]} />

          <Select id="mlr-status" label="Review status" value={filters.status} onChange={v => setFilter('status', v)}
            options={[['all', 'All Statuses'], ['pending', 'Pending Review'], ['approved', 'Approved'], ['returned', 'Returned']]} />

          <Select id="mlr-sent" label="Sentiment" value={filters.sentiment} onChange={v => setFilter('sentiment', v)}
            options={[['all', 'All Sentiments'], ['positive', 'Positive'], ['neutral', 'Neutral'], ['negative', 'Negative']]} />
        </div>
      </section>

      {error && <AlertStrip color={CLAY} action={<button onClick={load} style={{ ...body, fontSize: '0.74rem', fontWeight: 700, color: CLAY, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', minHeight: 32 }}>Retry</button>}>{error}</AlertStrip>}

      {/* ── Letter queue ── */}
      <section style={{ ...card, overflow: 'hidden', minWidth: 0 }}>
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-5" style={{ borderBottom: `1px solid ${RULE}` }}>
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex flex-shrink-0 items-center justify-center rounded-full" style={{ width: 30, height: 30, background: `${MAROON}10`, color: MAROON }}><Mail size={14} /></span>
            <div className="min-w-0">
              <h2 style={{ ...display, fontSize: '1.1rem', fontWeight: 700, color: INK, lineHeight: 1.2 }}>Monthly Letter Review</h2>
              <p style={{ fontSize: '0.76rem', color: MUTED, marginTop: 2 }}>
                Review monthly letters from your assigned scholars.
                {!loading && !error && pendingCount > 0 && <span style={{ color: AMBER, fontWeight: 600 }}> {pendingCount} awaiting review.</span>}
              </p>
            </div>
          </div>
          {!loading && (
            <span style={{ ...mono, fontSize: '0.7rem', fontWeight: 700, color: MAROON, background: `${MAROON}10`, borderRadius: 999, padding: '3px 10px' }}>
              {filtered.length} {filtered.length === 1 ? 'letter' : 'letters'}{month ? ' · selected month' : ''}
            </span>
          )}
        </div>

        {!loading && filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-14 text-center">
            <span className="mb-3 flex items-center justify-center rounded-full" style={{ width: 48, height: 48, background: `${GOLD}16`, color: GOLD }}><FileText size={21} /></span>
            <p style={{ ...display, fontSize: '1.05rem', fontWeight: 700, color: INK }}>{filtersActive ? 'No matching letters' : 'No letters found'}</p>
            <p style={{ fontSize: '0.8rem', color: MUTED, marginTop: 4 }}>{filtersActive ? 'Try adjusting your search or filters.' : 'No monthly letters were submitted in this period.'}</p>
            {filtersActive && <button type="button" onClick={resetFilters} className="mlr-btn mt-4" style={outlineBtn}><FilterX size={13} /> Reset filters</button>}
          </div>
        ) : (
          <>
            {/* Desktop: table */}
            <div className="mlr-scroll hidden overflow-x-auto xl:block">
              <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Scholar', 'Scholar ID', 'Quality score', 'Sentiment', 'Submitted', 'Status', 'Actions'].map(label => (
                      <th key={label} scope="col" style={label === 'Actions' ? { ...thStyle, textAlign: 'right' } : thStyle}>{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? Array.from({ length: 5 }).map((_, r) => (
                    <tr key={r} style={{ borderTop: `1px solid ${RULE}` }}>
                      {Array.from({ length: 7 }).map((__, c) => <td key={c} style={tdStyle}><div className="h-2.5 w-4/5 animate-pulse rounded-full" style={{ background: '#EFE6D8' }} /></td>)}
                    </tr>
                  )) : paged.map(r => {
                    const sc = r.sentiment ? sentimentCfg[r.sentiment] : null;
                    return (
                      <tr key={r.id} className="mlr-row" onClick={() => openReview(r.id)} style={{ borderTop: `1px solid ${RULE}` }}>
                        <td style={tdStyle}>
                          <div className="flex items-center gap-3">
                            <Avatar name={r.scholarName} />
                            <div style={{ minWidth: 0 }}>
                              <p style={{ fontSize: '0.84rem', fontWeight: 600, color: INK }}>
                                {r.scholarName}
                                {r.riskFlag && <span title="Risk flag" style={{ marginLeft: 6, color: CLAY }}><AlertTriangle size={11} style={{ display: 'inline' }} /></span>}
                              </p>
                              <p style={{ fontSize: '0.72rem', color: MUTED }}>{r.yearLevel}</p>
                            </div>
                          </div>
                        </td>
                        <td style={{ ...tdStyle, ...mono, fontSize: '0.74rem', color: '#6b6058', whiteSpace: 'nowrap' }}>{r.scholarId}</td>
                        <td style={tdStyle}><ScoreBar score={r.score} /></td>
                        <td style={tdStyle}>{sc ? <Pill color={sc.color}>{sc.label}</Pill> : <span style={{ color: MUTED }}>—</span>}</td>
                        <td style={{ ...tdStyle, fontSize: '0.78rem', color: '#7a6a62', whiteSpace: 'nowrap' }}>{r.submittedDate}</td>
                        <td style={tdStyle}><ReviewPill review={r.review} /></td>
                        <td style={tdStyle} onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            {r.review === 'pending' && (
                              <>
                                <button type="button" onClick={() => openReview(r.id, 'approve')} aria-label={`Approve letter from ${r.scholarName}`} title="Approve"
                                  style={{ ...filledBtn(SAGE), minHeight: 32, width: 34, padding: 0 }}><CheckCircle2 size={14} /></button>
                                <button type="button" onClick={() => openReview(r.id, 'return')} aria-label={`Return letter from ${r.scholarName}`} title="Return for revision"
                                  style={{ ...filledBtn(CLAY), minHeight: 32, width: 34, padding: 0 }}><XCircle size={14} /></button>
                              </>
                            )}
                            <button type="button" className="mlr-btn" onClick={() => openReview(r.id)} aria-label={`View letter from ${r.scholarName}`}
                              style={{ ...outlineBtn, minHeight: 32, padding: '0 12px', fontSize: '0.74rem', border: `1px solid ${MAROON}` }}>
                              <Eye size={13} /> {r.review === 'pending' ? 'Review' : 'View'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Phone + tablet: one card per letter */}
            <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 sm:p-4 xl:hidden">
              {loading ? Array.from({ length: 3 }).map((_, index) => (
                <div key={index} style={{ border: `1px solid ${RULE}`, borderRadius: 12, padding: 16, background: '#fff' }}>
                  <div className="h-3 w-1/2 animate-pulse rounded-full" style={{ background: '#EFE6D8' }} />
                  <div className="mt-3 h-2.5 w-3/4 animate-pulse rounded-full" style={{ background: '#EFE6D8' }} />
                  <div className="mt-3 h-2.5 w-2/3 animate-pulse rounded-full" style={{ background: '#EFE6D8' }} />
                </div>
              )) : paged.map(row => {
                const sentiment = row.sentiment ? sentimentCfg[row.sentiment] : null;
                return (
                  <article key={row.id} className="flex min-w-0 flex-col" style={{ border: `1px solid ${RULE}`, borderRadius: 12, padding: 14, background: '#fff' }}>
                    <div className="flex items-start gap-3">
                      <Avatar name={row.scholarName} size={40} />
                      <div className="min-w-0 flex-1">
                        <p style={{ fontSize: '0.88rem', fontWeight: 700, color: INK, overflowWrap: 'anywhere' }}>
                          {row.scholarName}
                          {row.riskFlag && <span title="Risk flag" style={{ marginLeft: 6, color: CLAY }}><AlertTriangle size={12} style={{ display: 'inline' }} /></span>}
                        </p>
                        <p style={{ ...mono, fontSize: '0.7rem', color: MUTED, overflowWrap: 'anywhere' }}>{row.scholarId} · {row.yearLevel}</p>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <ReviewPill review={row.review} />
                      {sentiment && <Pill color={sentiment.color}>{sentiment.label}</Pill>}
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3" style={{ paddingTop: 12, borderTop: `1px solid ${RULE}` }}>
                      {row.score === null
                        ? <span style={{ fontSize: '0.74rem', color: MUTED }}>No quality score</span>
                        : <div><p style={{ fontSize: '0.66rem', color: MUTED, marginBottom: 4 }}>Quality score</p><ScoreBar score={row.score} width={90} /></div>}
                      <div className="text-right">
                        <p style={{ fontSize: '0.66rem', color: MUTED, marginBottom: 4 }}>Submitted</p>
                        <p style={{ fontSize: '0.76rem', fontWeight: 600, color: INK, whiteSpace: 'nowrap' }}>{row.submittedDate}</p>
                      </div>
                    </div>

                    <div className="mt-auto grid grid-cols-2 gap-2 pt-3">
                      {row.review === 'pending' && (
                        <>
                          <button type="button" onClick={() => openReview(row.id, 'approve')} aria-label={`Approve letter from ${row.scholarName}`} style={{ ...filledBtn(SAGE), minHeight: 44 }}>
                            <CheckCircle2 size={14} /> Approve
                          </button>
                          <button type="button" onClick={() => openReview(row.id, 'return')} aria-label={`Return letter from ${row.scholarName}`} style={{ ...filledBtn(CLAY), minHeight: 44 }}>
                            <XCircle size={14} /> Return
                          </button>
                        </>
                      )}
                      <button type="button" className="mlr-btn" onClick={() => openReview(row.id)} aria-label={`View letter from ${row.scholarName}`}
                        style={{ ...outlineBtn, justifyContent: 'center', minHeight: 44, border: `1px solid ${MAROON}`, gridColumn: '1 / -1' }}>
                        <Eye size={14} /> {row.review === 'pending' ? 'Review letter' : 'View letter'}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}

        {!loading && filtered.length > 0 && (
          <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5" style={{ borderTop: `1px solid ${RULE}` }}>
            <p style={{ fontSize: '0.76rem', color: MUTED }}>Showing {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, filtered.length)} of {filtered.length} letters</p>
            <div className="flex items-center justify-between gap-2 sm:justify-end">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage <= 1} aria-label="Previous page" className="mlr-btn"
                style={{ ...outlineBtn, height: 40, width: 44, padding: 0, justifyContent: 'center', opacity: safePage <= 1 ? 0.45 : 1 }}><ChevronLeft size={16} /></button>
              <span style={{ fontSize: '0.76rem', fontWeight: 600, color: MAROON, background: `${MAROON}12`, borderRadius: 8, padding: '7px 12px', minWidth: 88, textAlign: 'center' }}>Page {safePage} of {pageCount}</span>
              <button onClick={() => setPage(p => Math.min(pageCount, p + 1))} disabled={safePage >= pageCount} aria-label="Next page" className="mlr-btn"
                style={{ ...outlineBtn, height: 40, width: 44, padding: 0, justifyContent: 'center', opacity: safePage >= pageCount ? 0.45 : 1 }}><ChevronRight size={16} /></button>
            </div>
          </div>
        )}
      </section>

      {selected && <ReviewModal
        key={`${selected.id}-${selectedAction || 'view'}`}
        letter={selected}
        initialMode={selectedAction}
        onClose={() => { setSelectedId(null); setSelectedAction(null); }}
        onDecide={handleDecide}
      />}
    </div>
  );
}