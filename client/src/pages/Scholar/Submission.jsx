import { API_ORIGIN } from '../../utils/apiConfig.js';
import { useState, useCallback, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  Upload, CheckCircle, XCircle, Send, Bookmark,
  ArrowLeft, Sparkles, FileText,
  User, History,
  Mail, GraduationCap, IdCard, Folder,
  CheckSquare, Square, Inbox, Search,
  ChevronUp, ChevronDown,
} from 'lucide-react';

import InfoField from '../../components/Scholar/SubmissionPage/InfoField';
import MediaUploader from '../../components/Scholar/SubmissionPage/MediaUploader';
import ConfirmModal from '../../components/Scholar/SubmissionPage/ConfirmModal';
import SubmittedView from '../../components/Scholar/SubmissionPage/SubmittedView';
import SubmissionHistory from '../../components/Scholar/SubmissionPage/SubmissionHistory';
import ScholarGrades from '../../components/Scholar/SubmissionPage/ScholarGrades';
import { CHECKLIST, LETTER_BODY_MAX, buildEval, calcInfoScore, calcMediaScore, countWords, classifyQualityScore } from '../../utils/submissionScoring';
import { uploadResumableFile } from '../../utils/resumableUpload';
import { getEducationStage, hasEducationProgram } from '../../utils/educationStage';

// ── Apple Scholar Portal design system ──
const BG = '#F7F4EE';
const SURFACE = '#FFFDF9';
const BORDER = '#E7D8C7';
const PRIMARY = '#6D2140';
const PRIMARY_DARK = '#4A1730';
const GOLD = '#B98B4E';
const SUCCESS = '#6B8F71';
const WARNING = '#B8863F';
const DANGER = '#C1666B';
const INK = '#241512';
const MUTED = '#8A7A68';
const RADIUS = 18;

const display = { fontFamily: "'Playfair Display', Georgia, serif" };
const body = { fontFamily: "'Inter', -apple-system, 'Segoe UI', sans-serif" };

const API_BASE = `${API_ORIGIN}/api/submission`;

const authHeader = () => {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
};

const wait = (milliseconds) => new Promise(resolve => setTimeout(resolve, milliseconds));

const postWithRetry = async (url, formData) => {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await axios.post(url, formData, {
        headers: { 'Content-Type': 'multipart/form-data', ...authHeader() },
        timeout: 60_000,
      });
    } catch (error) {
      lastError = error;
      const shouldRetry = !error.response || error.response.status >= 500;
      if (!shouldRetry || attempt === 2) throw error;
      await wait(1000 * (attempt + 1));
    }
  }
  throw lastError;
};

const submissionTypes = [
  { id: 'monthly-report', label: 'Monthly Letter' },
  { id: 'grades', label: 'Grades' },
  { id: 'cor', label: 'COR' },
  { id: 'other', label: 'Other Documents' },
];

const TYPE_ICONS = {
  'monthly-report': Mail,
  'grades': GraduationCap,
  'cor': IdCard,
  'other': Folder,
};

const SUBMISSION_TYPE_TO_TAB = {
  letter: 'monthly-report',
  report_card: 'other',
  cor: 'cor',
  other: 'other',
};

const HISTORY_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'approved', label: 'Approved' },
  { value: 'pending', label: 'Pending' },
  { value: 'returned', label: 'Returned' },
  { value: 'rejected', label: 'Rejected' },
];

// 16px inputs prevent iOS Safari from zooming the page on focus.
const underlineField = {
  width: '100%', padding: '10px 2px', minHeight: 44, border: 'none', borderBottom: `1.5px solid ${BORDER}`,
  background: 'none', ...body, fontSize: '1rem', color: INK, outline: 'none',
};
const fieldLabel = { ...body, fontSize: '0.72rem', color: MUTED, display: 'block', marginBottom: 6, fontWeight: 600, letterSpacing: '0.03em' };

const btnBase = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 18px', minHeight: 44, borderRadius: 12, ...body, fontSize: '0.84rem', fontWeight: 600, cursor: 'pointer' };
const outlineBtn = { ...btnBase, border: `1px solid ${BORDER}`, background: SURFACE, color: INK };
const filledBtn = { ...btnBase, border: 'none', background: `linear-gradient(135deg, ${PRIMARY} 0%, ${PRIMARY_DARK} 100%)`, color: '#fff' };

const noScrollbar = { scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' };

// A left-border alert strip, used consistently across the portal.
const AlertStrip = ({ color, children }) => (
  <div style={{ borderLeft: `3px solid ${color}`, background: `${color}0d`, borderRadius: '0 12px 12px 0', padding: '10px 14px', ...body, fontSize: '0.82rem', fontWeight: 600, lineHeight: 1.5, color, wordBreak: 'break-word' }}>
    {children}
  </div>
);

// Standard white card
const Card = ({ children, className = '', innerRef, style }) => (
  <section ref={innerRef} className={`min-w-0 p-4 sm:p-6 ${className}`} style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: RADIUS, scrollMarginTop: 12, ...style }}>
    {children}
  </section>
);

// Card header: icon chip + gold eyebrow + serif title (+ optional right slot)
const CardHeader = ({ icon: Icon, eyebrow, title, right }) => (
  <div className="flex items-center justify-between gap-3">
    <div className="flex items-center gap-3 min-w-0">
      {Icon && (
        <span className="flex items-center justify-center flex-shrink-0" style={{ width: 36, height: 36, borderRadius: 11, background: `${PRIMARY}14` }}>
          <Icon size={16} style={{ color: PRIMARY }} />
        </span>
      )}
      <div className="min-w-0">
        {eyebrow && <p style={{ ...body, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.06em', color: GOLD }}>{eyebrow}</p>}
        <h2 style={{ ...display, fontWeight: 600, color: INK, lineHeight: 1.25 }} className="text-[1.05rem] sm:text-[1.15rem]">{title}</h2>
      </div>
    </div>
    {right}
  </div>
);

// Compact stat card for the history tab
const ProgressCard = ({ eyebrow, title, children }) => (
  <div className="min-w-0 p-3 sm:p-4" style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: RADIUS }}>
    <p className="hidden sm:block" style={{ ...body, fontSize: '0.64rem', fontWeight: 700, letterSpacing: '0.05em', color: GOLD, marginBottom: 4 }}>{eyebrow}</p>
    <div>{children}</div>
    <p style={{ ...body, fontSize: '0.7rem', fontWeight: 600, color: MUTED, marginTop: 2, lineHeight: 1.3 }} className="sm:text-[0.8rem]">{title}</p>
  </div>
);

const MiniBar = ({ pct, color }) => (
  <div className="rounded-full overflow-hidden" style={{ height: 6, background: BORDER }}>
    <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, Math.max(0, pct))}%`, background: color }} />
  </div>
);

// Circular completion ring (scales from the compact mobile bar to the desktop panel)
const CompletionRing = ({ pct, color, size = 84, stroke = 7 }) => {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const safePct = Math.min(100, Math.max(0, Number.isFinite(pct) ? pct : 0));
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={BORDER} strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={c} strokeDashoffset={c - (safePct / 100) * c} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center" style={{ ...display, fontSize: size < 60 ? '0.72rem' : '1.15rem', fontWeight: 700, color: INK }}>
        {Math.round(safePct)}%
      </span>
    </div>
  );
};

// Live checklist rows (editor side panel + mobile drawer)
const LiveChecklist = ({ items }) => (
  <div className="space-y-2.5">
    {items.map(({ id, label, passed }) => (
      <div key={id} className="flex items-start gap-2.5">
        {passed
          ? <CheckSquare size={16} style={{ color: SUCCESS, flexShrink: 0, marginTop: 1 }} />
          : <Square size={16} style={{ color: BORDER, flexShrink: 0, marginTop: 1 }} />}
        <span style={{ ...body, fontSize: '0.82rem', color: passed ? INK : MUTED, lineHeight: 1.4 }}>{label}</span>
      </div>
    ))}
  </div>
);

// Small boxed panel with a label, used in the review sidebar
const Panel = ({ title, children }) => (
  <div className="rounded-xl p-3 sm:p-4" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
    <p style={{ ...body, fontSize: '0.68rem', fontWeight: 700, color: PRIMARY, letterSpacing: '0.05em', marginBottom: 8 }}>{title}</p>
    {children}
  </div>
);

// Workflow stepper. Compact on phones (numbered dots + short labels),
// card-style on larger screens. Steps 1–3 scroll to a section; step 4 runs the review.
const WorkflowSteps = ({ steps, onStepClick }) => (
  <nav aria-label="Submission steps" className="p-3 sm:p-4" style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: RADIUS }}>
    <ol className="flex items-start">
      {steps.map((step, i) => {
        const last = i === steps.length - 1;
        return (
          <li
            key={step.key}
            className="flex items-start"
            style={last ? { flex: '0 0 auto' } : { flex: '1 1 0%', minWidth: 0 }}
          >
            <button
              onClick={() => onStepClick(step)}
              disabled={step.disabled}
              aria-current={step.active ? 'step' : undefined}
              className="flex flex-col lg:flex-row items-center lg:gap-2.5 text-center lg:text-left flex-shrink-0"
              style={{ background: 'none', border: 'none', padding: '2px 4px', cursor: step.disabled ? 'not-allowed' : 'pointer', opacity: step.disabled ? 0.5 : 1, minWidth: 56, whiteSpace: 'nowrap' }}
            >
              <span
                className="flex items-center justify-center flex-shrink-0"
                style={{
                  width: 30, height: 30, borderRadius: '50%', ...body, fontSize: '0.78rem', fontWeight: 700,
                  background: step.completed ? SUCCESS : step.active ? PRIMARY : BG,
                  color: step.completed || step.active ? '#fff' : MUTED,
                  border: `1.5px solid ${step.completed ? SUCCESS : step.active ? PRIMARY : BORDER}`,
                  boxShadow: step.active ? `0 0 0 4px ${PRIMARY}1f` : 'none',
                }}
              >
                {step.completed ? <CheckCircle size={15} /> : i + 1}
              </span>
              <span className="mt-1.5 lg:mt-0" style={{ ...body, fontSize: '0.7rem', fontWeight: step.active ? 700 : 600, color: step.active ? PRIMARY : INK, lineHeight: 1.25 }}>
                <span className="lg:hidden">{step.short}</span>
                <span className="hidden lg:inline" style={{ fontSize: '0.82rem' }}>{step.title}</span>
              </span>
            </button>
            {!last && (
              <span className="flex-1" aria-hidden="true" style={{ height: 2, marginTop: 15, marginInline: 2, minWidth: 8, borderRadius: 2, background: step.completed ? SUCCESS : BORDER }} />
            )}
          </li>
        );
      })}
    </ol>
  </nav>
);

// Key used to cache the scholar's own info fields locally, so they don't
// have to be retyped every time (e.g. after a rejection/resubmit).
const scholarInfoStorageKey = (scholarId) => `scholar_info_cache_${scholarId}`;
const scholarDraftStorageKey = (scholarId) => `scholar_submission_draft_${scholarId}`;

const getEducationProgramValue = (info) => (
  getEducationStage(info.year) === 'senior_high' ? info.track_strand : info.course
);

const formatYearLevelLabel = (value) => {
  if (!value) return '';
  const normalized = String(value).trim().toLowerCase().replace(/_/g, ' ');
  if (!normalized) return '';

  const aliasMap = {
    'grade 7': 'Grade 7',
    'grade 8': 'Grade 8',
    'grade 9': 'Grade 9',
    'grade 10': 'Grade 10',
    'grade 11': 'Grade 11',
    'grade 12': 'Grade 12',
    'college 1': '1st Year College',
    'college 2': '2nd Year College',
    'college 3': '3rd Year College',
    'college 4': '4th Year College',
    'college 5': '5th Year College',
    '1st year college': '1st Year College',
    '2nd year college': '2nd Year College',
    '3rd year college': '3rd Year College',
    '4th year college': '4th Year College',
    '5th year college': '5th Year College',
  };

  return aliasMap[normalized] || value;
};

function Submission() {
  const [tab, setTab] = useState('submit');
  const [selectedType, setSelectedType] = useState('monthly-report');
  const [view, setView] = useState('editor');
  const [showConfirm, setShowConfirm] = useState(false);
  const [evalResult, setEvalResult] = useState(null);
  const [evaluating, setEvaluating] = useState(false);
  const userId = localStorage.getItem('id');

  const [info, setInfo] = useState({
    name: '', age: '', year: '', course: '', track_strand: '', school: '',
    date: '',
  });
  const [body_, setBody] = useState('');
  const [media, setMedia] = useState([]);

  const [docFile, setDocFile] = useState(null);
  const [docUploading, setDocUploading] = useState(false);
  const [docError, setDocError] = useState('');
  const [docSuccess, setDocSuccess] = useState('');
  const [resubmitNotice, setResubmitNotice] = useState('');
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submittedId, setSubmittedId] = useState(null);
  const [submittedRecord, setSubmittedRecord] = useState(null);
  const [submissionStatusError, setSubmissionStatusError] = useState('');
  const [taskDeadlines, setTaskDeadlines] = useState(null);
  const [taskDeadlinesLoading, setTaskDeadlinesLoading] = useState(Boolean(localStorage.getItem('scholar_id')));
  const [taskDeadlinesError, setTaskDeadlinesError] = useState('');

  // UI-only: search/status filter over the already-fetched history list.
  const [historySearch, setHistorySearch] = useState('');
  const [historyStatusFilter, setHistoryStatusFilter] = useState('all');

  // UI-only: mobile checklist drawer + drag-over highlight for the upload zone.
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [dragging, setDragging] = useState(false);

  const scholarId = localStorage.getItem('scholar_id');
  const updateInfo = (key) => (val) => setInfo(prev => ({ ...prev, [key]: val }));
  const educationStage = getEducationStage(info.year);
  const wordCount = countWords(body_);
  const hasContent = info.name.trim().length > 0 && body_.trim().length > 20;
  const selectedDeadlineType = selectedType === 'monthly-report' ? 'letter'
    : selectedType === 'cor' ? 'cor'
      : selectedType === 'other' ? 'other' : null;
  const selectedDeadline = selectedDeadlineType ? taskDeadlines?.[selectedDeadlineType] : null;
  const submissionLocked = Boolean(
    selectedDeadline?.has_submission && !selectedDeadline.can_resubmit
  );
  const deadlineBlocked = Boolean(selectedDeadlineType && (
    taskDeadlinesLoading || taskDeadlinesError || !selectedDeadline?.assigned || selectedDeadline.closed || submissionLocked
  ));
  const deadlineMessage = !selectedDeadlineType ? ''
    : taskDeadlinesError ? 'Could not verify the task deadline. Please try again later.'
      : taskDeadlinesLoading ? 'Checking the task deadline…'
        : !selectedDeadline?.assigned ? 'There is no active task assigned for this requirement.'
          : selectedDeadline.closed ? 'This task is closed. Late submissions are not accepted.'
            : submissionLocked
              ? selectedDeadline.submission_status === 'approved'
                ? 'Your submission was approved. Please wait for the next task from Admin before submitting again.'
                : 'You already submitted this task. Please wait for Officer review, or resubmit if it is returned for revision.'
              : '';
  // ---- Presentation-only refs for the workflow-step scroll targets ----
  const infoSectionRef = useRef(null);
  const letterSectionRef = useRef(null);
  const mediaSectionRef = useRef(null);
  const scrollToSection = (ref) => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  useEffect(() => {
    if (!scholarId) return;
    try {
      const draft = JSON.parse(localStorage.getItem(scholarDraftStorageKey(scholarId)) || 'null');
      if (!draft) return;
      if (draft.info) setInfo(prev => ({ ...prev, ...draft.info }));
      if (typeof draft.body === 'string') setBody(draft.body);
      if (draft.selectedType) setSelectedType(draft.selectedType);
    } catch (err) {
      console.warn('Could not restore submission draft', err);
    }
  }, [scholarId]);

  useEffect(() => {
    if (!scholarId) return;
    try {
      localStorage.setItem(scholarDraftStorageKey(scholarId), JSON.stringify({
        info: { name: info.name, age: info.age, year: info.year, course: info.course, track_strand: info.track_strand, school: info.school },
        body: body_,
        selectedType,
        savedAt: new Date().toISOString(),
      }));
    } catch (err) {
      console.warn('Could not save submission draft', err);
    }
  }, [scholarId, info.name, info.age, info.year, info.course, info.track_strand, info.school, body_, selectedType]);

  useEffect(() => {
    const applyProfileInfo = (profile) => {
      if (!profile) return;
      const nextInfo = {
        name: profile.full_name || '',
        age: profile.age || '',
        year: formatYearLevelLabel(profile.year_level),
        course: profile.course || '',
        track_strand: profile.track_strand || '',
        school: profile.school || '',
      };
      setInfo(prev => ({ ...prev, ...nextInfo }));
      if (scholarId) {
        localStorage.setItem(scholarInfoStorageKey(scholarId), JSON.stringify(nextInfo));
      }
    };

    if (!scholarId) return;

    try {
      const cached = localStorage.getItem(scholarInfoStorageKey(scholarId));
      if (cached) {
        const parsed = JSON.parse(cached);
        setInfo(prev => ({ ...prev, ...parsed }));
      }
    } catch (err) {
      console.warn('Could not load cached scholar info', err);
    }

    if (!userId) return;

    axios.get(`${API_ORIGIN}/api/scholar/profile/${userId}`, { headers: authHeader() })
      .then(({ data }) => applyProfileInfo(data))
      .catch(() => {
        // Keep cached profile if the live profile fetch fails.
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scholarId, userId]);

  // Keep the cache in sync as the scholar edits their info fields.
  useEffect(() => {
    if (!scholarId) return;
    const { name, age, year, course, track_strand, school } = info;
    if (!name && !age && !year && !course && !track_strand && !school) return;
    try {
      localStorage.setItem(scholarInfoStorageKey(scholarId), JSON.stringify({ name, age, year, course, track_strand, school }));
    } catch (err) {
      console.warn('Could not cache scholar info', err);
    }
  }, [info.name, info.age, info.year, info.course, info.track_strand, info.school, scholarId]);

  const fetchHistory = useCallback(async () => {
    if (!scholarId) return;
    try {
      setHistoryLoading(true); setHistoryError('');
      const res = await axios.get(`${API_BASE}/history/${scholarId}`, { headers: authHeader() });
      setHistory(res.data);
    } catch (err) {
      setHistoryError('Could not load your submission history. Please try again later.');
    } finally { setHistoryLoading(false); }
  }, [scholarId]);

  const fetchSubmittedStatus = useCallback(async () => {
    if (!scholarId || !submittedId) return;
    try {
      const { data } = await axios.get(`${API_BASE}/status/${submittedId}`, { headers: authHeader() });
      setSubmittedRecord(data);
      setSubmissionStatusError('');
    } catch {
      setSubmissionStatusError('Live status could not be refreshed. Showing the latest available update.');
    }
  }, [scholarId, submittedId]);

  useEffect(() => { if (tab === 'history') fetchHistory(); }, [tab, fetchHistory]);

  useEffect(() => {
    if (tab !== 'submit' || view !== 'submitted' || !submittedId) return undefined;

    const refreshIfVisible = () => {
      if (document.visibilityState === 'visible') fetchSubmittedStatus();
    };
    refreshIfVisible();
    const intervalId = window.setInterval(refreshIfVisible, 30_000);
    window.addEventListener('focus', refreshIfVisible);
    document.addEventListener('visibilitychange', refreshIfVisible);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refreshIfVisible);
      document.removeEventListener('visibilitychange', refreshIfVisible);
    };
  }, [tab, view, submittedId, fetchSubmittedStatus]);

  const refreshTaskDeadlines = useCallback(async () => {
    if (!scholarId) return null;
    setTaskDeadlinesLoading(true);
    setTaskDeadlinesError('');
    setTaskDeadlines(null);
    try {
      const { data } = await axios.get(`${API_BASE}/deadlines`, { headers: authHeader() });
      setTaskDeadlines(data);
      return data;
    } catch {
      setTaskDeadlinesError('Could not verify the task deadline. Please try again later.');
      return null;
    } finally {
      setTaskDeadlinesLoading(false);
    }
  }, [scholarId]);

  useEffect(() => {
    if (!scholarId) {
      setTaskDeadlines({});
      setTaskDeadlinesLoading(false);
      return;
    }
    refreshTaskDeadlines();
  }, [scholarId, refreshTaskDeadlines]);

  const handleEvaluate = async () => {
    setEvaluating(true);
    setChecklistOpen(false);
    try {
      const fallbackEval = buildEval(info, body_, media);
      const fallbackChecklist = CHECKLIST.map(item => ({ item, passed: item.check(info, body_, media) }));
      let evalScore = { ...fallbackEval, checklist: fallbackChecklist, source: 'rule_based' };

      try {
        const scoreResponse = await axios.post(`${API_BASE}/score`, {
          letter_content: body_,
        }, {
          headers: { 'Content-Type': 'application/json', ...authHeader() },
          timeout: 10000,
        });

        if (scoreResponse?.data?.flagged) {
          const flaggedResult = {
            ...fallbackEval,
            reportScore: 0,
            mediaScore: 0,
            infoScore: 0,
            overallScore: 0,
            source: 'flagged',
            flagged: true,
            flagReason: scoreResponse.data.flag_reason || 'This submission does not appear to be a valid letter.',
            accepted: false,
            riskColor: DANGER,
            riskLabel: 'Invalid Letter',
            checklist: fallbackChecklist,
          };
          console.warn('[letter-score-debug] frontend flagged path selected:', flaggedResult.flagReason);
          setEvalResult(flaggedResult);
          setEvaluating(false);
          setView('evaluation');
          return;
        }

        if (scoreResponse?.data?.fallback) {
          console.log('[letter-score-debug] frontend rule-based fallback path selected.');
          const fallbackBodyScore = Number(scoreResponse?.data?.body_score);
          const fallbackMediaScore = calcMediaScore(media);
          const fallbackInfoScore = calcInfoScore(info);
          const fallbackOverallScore = Number.isFinite(fallbackBodyScore)
            ? Math.min(Math.round(fallbackBodyScore) + fallbackMediaScore + fallbackInfoScore, 100)
            : fallbackEval.overallScore;
          setEvalResult({
            ...fallbackEval,
            reportScore: Number.isFinite(fallbackBodyScore) ? Math.min(Math.round(fallbackBodyScore), LETTER_BODY_MAX) : fallbackEval.reportScore,
            mediaScore: fallbackMediaScore,
            infoScore: fallbackInfoScore,
            overallScore: fallbackOverallScore,
            checklist: fallbackChecklist,
            bodyCriteria: scoreResponse?.data?.breakdown,
            categories: scoreResponse?.data?.categories || fallbackEval.categories,
            source: 'rule_based_v3',
            ...classifyQualityScore(fallbackOverallScore),
          });
          setEvaluating(false);
          setView('evaluation');
          return;
        }

        const bodyScore = Number(scoreResponse?.data?.body_score);
        if (Number.isFinite(bodyScore)) {
          const reportScore = Math.min(Math.max(Math.round(bodyScore), 0), LETTER_BODY_MAX);
          const mediaScore = calcMediaScore(media);
          const infoScore = calcInfoScore(info);
          const overallScore = Math.min(reportScore + mediaScore + infoScore, 100);
          console.log('[letter-score-debug] frontend rule-based body with TF-IDF classification path selected:', {
            apiScoreIgnoredForBodyScore: scoreResponse?.data?.score,
            bodyScoreFromBreakdown: bodyScore,
            reportScoreOutOf75: reportScore,
            overallScoreOutOf100: overallScore,
          });
          const quality = classifyQualityScore(overallScore);

          evalScore = {
            ...fallbackEval,
            reportScore,
            mediaScore,
            infoScore,
            overallScore,
            source: scoreResponse.data.source || 'rule_based_v3',
            sentimentLabel: scoreResponse.data.sentiment_label,
            categories: scoreResponse.data.categories,
            categoryScore: scoreResponse.data.category_score,
            bodyCriteria: scoreResponse.data.breakdown,
            ...quality,
            qualityLabel: quality.riskLabel,
          };
        }
      } catch (scoreErr) {
        console.warn('Model score route unavailable; using rule-based fallback.', scoreErr?.message || scoreErr);
      }

      setEvalResult(evalScore);
    } catch (err) {
      const fallbackEval = buildEval(info, body_, media);
      const fallbackChecklist = CHECKLIST.map(item => ({ item, passed: item.check(info, body_, media) }));
      setEvalResult({ ...fallbackEval, checklist: fallbackChecklist, source: 'rule_based' });
    } finally {
      setEvaluating(false);
      setView('evaluation');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleNewSubmission = () => {
    setInfo(prev => ({ ...prev, date: '' }));
    setBody(''); setMedia([]); setEvalResult(null); setView('editor'); setSubmitError(''); setResubmitNotice('');
    setSubmittedId(null); setSubmittedRecord(null); setSubmissionStatusError('');
  };

  const handleResubmit = async (item) => {
    await refreshTaskDeadlines();
    const nextType = SUBMISSION_TYPE_TO_TAB[item.submission_type] || 'monthly-report';
    setSelectedType(nextType);
    setSubmitError(''); setDocError(''); setDocSuccess(''); setDocFile(null);

    const reason = item.staff_comment?.trim();

    if (item.submission_type === 'letter') {
      setBody(item.letter_content || ''); setMedia([]); setEvalResult(null); setView('editor');
      setResubmitNotice(
        reason
          ? `Returned by your officer: "${reason}" — please fix the letter, reattach the required photos, then evaluate and resubmit.`
          : 'This was returned for correction. Please review and fix your letter, reattach the photos, then resubmit.'
      );
    } else {
      setResubmitNotice(
        reason
          ? `Returned by your officer: "${reason}" — please re-upload the corrected file below.`
          : 'This was returned for correction. Please re-upload the corrected file below.'
      );
    }
    setTab('submit'); window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleConfirmSubmit = async () => {
    if (!scholarId) { setSubmitError('No scholar account found. Please log in again.'); return; }
    setSubmitting(true); setSubmitError('');
    try {
      const latestDeadlines = await refreshTaskDeadlines();
      const letterDeadline = latestDeadlines?.letter;
      if (!latestDeadlines) {
        setSubmitError('Could not verify the task deadline. Please try again later.');
        return;
      }
      if (!letterDeadline?.assigned || letterDeadline.closed) {
        setSubmitError(!letterDeadline?.assigned
          ? 'There is no active Monthly Report task assigned.'
          : 'This task is closed. Late submissions are not accepted.');
        return;
      }
      if (letterDeadline.has_submission && !letterDeadline.can_resubmit) {
        setSubmitError(letterDeadline.submission_status === 'approved'
          ? 'Your submission was approved. Please wait for the next task from Admin before submitting again.'
          : 'You already submitted this task. Please wait for Officer review, or resubmit if it is returned for revision.');
        return;
      }
      const formData = new FormData();
      formData.append('letter_content', body_);
      formData.append('name', info.name || '');
      formData.append('age', info.age || '');
      formData.append('year', info.year || '');
      formData.append('course', educationStage === 'college' || educationStage === 'other' ? info.course || '' : '');
      formData.append('track_strand', educationStage === 'senior_high' ? info.track_strand || '' : '');
      formData.append('school', info.school || '');
      formData.append('quality_score', evalResult.overallScore);
      formData.append('quality_status', evalResult.qualityStatus);
      formData.append('service_activity', ''); formData.append('service_hours', ''); formData.append('service_date', '');
      const descriptions = media.map(m => m.description || '');
      formData.append('media_descriptions', JSON.stringify(descriptions));
      const resumableUploads = [];
      for (const item of media) {
        resumableUploads.push(await uploadResumableFile(item.file, 'media'));
      }
      formData.append('resumable_uploads', JSON.stringify(resumableUploads));
      const response = await postWithRetry(`${API_BASE}/submit`, formData);
      const id = response.data?.submissionId;
      setSubmittedId(id || null);
      setSubmittedRecord({
        id,
        submission_type: 'letter',
        status: 'pending',
        submitted_at: new Date().toISOString(),
      });
      setSubmissionStatusError(id ? '' : 'Your report was submitted, but live tracking is unavailable. Check My History for updates.');
      await refreshTaskDeadlines();
      setShowConfirm(false); setView('submitted');
    } catch (err) {
      setSubmitError(err.response?.data?.error || 'Something went wrong while submitting. Please try again.');
    } finally { setSubmitting(false); }
  };

  const handleDocUpload = async () => {
    if (!docFile || !scholarId) return;
    setDocUploading(true); setDocError(''); setDocSuccess('');
    try {
      if (selectedType === 'cor' || selectedType === 'other') {
        const latestDeadlines = await refreshTaskDeadlines();
        const requirementType = selectedType === 'cor' ? 'cor' : 'other';
        const requirementLabel = selectedType === 'cor' ? 'COR Upload' : 'Other Documents';
        const requirementDeadline = latestDeadlines?.[requirementType];
        if (!latestDeadlines) {
          setDocError('Could not verify the task deadline. Please try again later.');
          return;
        }
        if (!requirementDeadline?.assigned || requirementDeadline.closed) {
          setDocError(!requirementDeadline?.assigned
            ? `There is no active ${requirementLabel} task assigned.`
            : 'This task is closed. Late submissions are not accepted.');
          return;
        }
        if (requirementDeadline.has_submission && !requirementDeadline.can_resubmit) {
          setDocError(requirementDeadline.submission_status === 'approved'
            ? 'Your submission was approved. Please wait for the next task from Admin before submitting again.'
            : 'You already submitted this task. Please wait for Officer review, or resubmit if it is returned for revision.');
          return;
        }
      }
      const formData = new FormData();
      formData.append('letter_content', ''); formData.append('quality_score', 0); formData.append('quality_status', 'pending');
      const fieldname = selectedType === 'report-card' ? 'report_card' : selectedType === 'cor' ? 'cor' : 'media';
      const uploadId = await uploadResumableFile(docFile, fieldname);
      formData.append('resumable_uploads', JSON.stringify([uploadId]));
      if (selectedType === 'other') formData.append('media_descriptions', JSON.stringify(['Other Document']));
      await postWithRetry(`${API_BASE}/submit`, formData);
      setDocSuccess('Document submitted successfully! Forwarded to admin/office for review.');
      setDocFile(null); setResubmitNotice('');
      await refreshTaskDeadlines();
    } catch (err) {
      setDocError(err.response?.data?.error || 'Something went wrong while uploading. Please try again.');
    } finally { setDocUploading(false); }
  };

  const docTypeLabel = selectedType === 'report-card' ? 'Report Card / Grade per Semester'
    : selectedType === 'cor' ? 'Certificate of Registration (COR)' : 'Other Document';

  // ── Quick stats — derived from existing state only, no new calculations ──
  const totalSubmissions = history.length;
  const acceptedCount = history.filter((h) => String(h.status || '').toLowerCase() === 'approved').length;
  const pendingReviewCount = history.filter((h) => ['pending', 'under_review'].includes(String(h.status || '').toLowerCase())).length;
  const checklistPassedCount = CHECKLIST.filter((item) => item.check(info, body_, media)).length;
  const liveChecklist = CHECKLIST.map((item) => ({ id: item.id, label: item.label, passed: item.check(info, body_, media) }));

  // ── History filter — UI-only, over the already-fetched `history` array ──
  const filteredHistory = history.filter((item) => {
    const status = String(item.status || item.quality_status || '').toLowerCase();
    const matchesStatus = historyStatusFilter === 'all' || status === historyStatusFilter;
    if (!matchesStatus) return false;
    if (!historySearch.trim()) return true;
    const haystack = `${item.submission_type || ''} ${item.letter_content || ''} ${item.staff_comment || ''}`.toLowerCase();
    return haystack.includes(historySearch.trim().toLowerCase());
  });

  // ---- Presentation-only derived values ----
  const overallCompletionPct = CHECKLIST.length ? (checklistPassedCount / CHECKLIST.length) * 100 : 0;

  const programComplete = !hasEducationProgram(info.year) || Boolean(getEducationProgramValue(info));
  const infoComplete = Boolean(info.name && info.year && programComplete && info.school);
  const letterComplete = wordCount >= 150;
  const mediaComplete = media.length > 0;
  const automatedReviewComplete = view === 'evaluation' || view === 'submitted';

  const workflowSteps = [
    {
      key: 'info', title: 'Scholar Information', short: 'Info', completed: infoComplete,
      active: !infoComplete && view === 'editor',
      onClick: () => scrollToSection(infoSectionRef),
    },
    {
      key: 'letter', title: 'Monthly Letter', short: 'Letter', completed: letterComplete,
      active: infoComplete && !letterComplete && view === 'editor',
      onClick: () => scrollToSection(letterSectionRef),
    },
    {
      key: 'media', title: 'Documentation', short: 'Photos', completed: mediaComplete,
      active: infoComplete && letterComplete && !mediaComplete && view === 'editor',
      onClick: () => scrollToSection(mediaSectionRef),
    },
    {
      key: 'automated-review', title: 'Automated Review', short: 'Review', completed: automatedReviewComplete,
      active: view === 'evaluation',
      disabled: !hasContent || evaluating,
      onClick: () => { if (hasContent) handleEvaluate(); },
    },
  ];

  const onEditorScreen = tab === 'submit' && selectedType === 'monthly-report' && view === 'editor';
  const onReviewScreen = tab === 'submit' && selectedType === 'monthly-report' && view === 'evaluation' && Boolean(evalResult);
  const hasStickyBar = (onEditorScreen || onReviewScreen) && !showConfirm;
  const reviewColor = evalResult?.flagged ? DANGER : (evalResult?.riskColor || PRIMARY);
  const submitBlocked = deadlineBlocked || Boolean(evalResult?.flagged);

  const stickyBarStyle = {
    background: SURFACE, borderTop: `1px solid ${BORDER}`,
    boxShadow: '0 -6px 20px rgba(74,23,48,0.08)',
    paddingBottom: 'env(safe-area-inset-bottom, 0px)',
  };

  return (
    <div className="w-full max-w-full min-w-0" style={{ ...body, background: BG, minHeight: '100vh', overflowX: 'hidden' }}>
      <div
        className={`w-full max-w-full min-w-0 px-3 sm:px-6 lg:p-8 pt-3 sm:pt-6 ${hasStickyBar ? 'pb-36 lg:pb-8' : 'pb-8'}`}
      >

        {/* ── Page header ── */}
        <header className="flex items-start justify-between gap-3 flex-wrap p-4 sm:p-6 mb-3 sm:mb-5" style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: RADIUS }}>
          <div className="min-w-0">
            <p style={{ ...body, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em', color: GOLD }}>SCHOLAR PORTAL</p>
            <h1 style={{ ...display, fontWeight: 600, color: INK, marginTop: 2, lineHeight: 1.2 }} className="text-[1.4rem] sm:text-[1.7rem]">Submissions</h1>
            <p style={{ ...body, color: MUTED, marginTop: 6, maxWidth: 480, lineHeight: 1.55 }} className="text-[0.82rem] sm:text-[0.86rem]">
              Submit your monthly requirements with AI quality analysis and officer feedback.
            </p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
            <button
              onClick={() => setTab(tab === 'history' ? 'submit' : 'history')}
              aria-pressed={tab === 'history'}
              className="flex items-center justify-center gap-1.5 flex-1 sm:flex-none"
              style={{
                ...body, fontSize: '0.84rem', fontWeight: 700, borderRadius: 999, padding: '10px 20px', minHeight: 44, cursor: 'pointer',
                border: `1.5px solid ${PRIMARY}`,
                background: tab === 'history' ? PRIMARY : `${PRIMARY}12`,
                color: tab === 'history' ? '#fff' : PRIMARY,
                boxShadow: tab === 'history' ? 'none' : `0 2px 8px ${PRIMARY}22`,
              }}
            >
              <History size={16} /> {tab === 'history' ? 'Back to Submit' : 'My History'}
            </button>
          </div>
        </header>

        {tab === 'submit' && <>
          {/* ── Featured reminder ── */}
          <div
            className="relative overflow-hidden p-4 sm:p-6 mb-3 sm:mb-5"
            style={{ background: `linear-gradient(135deg, ${PRIMARY} 0%, ${PRIMARY_DARK} 100%)`, borderRadius: RADIUS }}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="min-w-0" style={{ maxWidth: 520 }}>
                <p style={{ ...body, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em', color: '#E7D8C7' }}>FEATURED REMINDER</p>
                <h3 style={{ ...display, fontWeight: 600, color: '#fff', marginTop: 4, lineHeight: 1.3 }} className="text-[1.1rem] sm:text-[1.3rem]">
                  {resubmitNotice ? 'A submission needs your attention' : 'Keep your requirements up to date'}
                </h3>
                <p style={{ ...body, fontSize: '0.82rem', color: '#F3E9DD', marginTop: 6, lineHeight: 1.6, wordBreak: 'break-word' }}>
                  {resubmitNotice || 'Submit your Monthly Letter every month, and your Grades and COR every semester.'}
                </p>
              </div>
              <button
                onClick={() => { setSelectedType('monthly-report'); setView('editor'); }}
                className="w-full sm:w-auto flex-shrink-0 transition-opacity hover:opacity-90"
                style={{ ...body, fontSize: '0.84rem', fontWeight: 600, color: PRIMARY, background: '#fff', border: 'none', borderRadius: 12, padding: '12px 22px', minHeight: 44, cursor: 'pointer' }}
              >
                Start Submission
              </button>
            </div>
          </div>

          {/* ── Compliance type selector (swipeable on phones) ── */}
          <div className="mb-3 sm:mb-5 min-w-0">
            <p style={fieldLabel}>COMPLIANCE TYPE</p>
            <div
              role="tablist"
              className="flex items-center gap-2 overflow-x-auto sm:flex-wrap -mx-3 px-3 sm:mx-0 sm:px-0 pb-1"
              style={noScrollbar}
            >
              {submissionTypes.map(type => {
                const Icon = TYPE_ICONS[type.id] || FileText;
                const active = selectedType === type.id;
                return (
                  <button
                    key={type.id}
                    role="tab"
                    aria-selected={active}
                    onClick={() => { setSelectedType(type.id); setView('editor'); setEvalResult(null); setDocFile(null); setDocError(''); setDocSuccess(''); setResubmitNotice(''); }}
                    className="flex items-center gap-2 flex-shrink-0"
                    style={{
                      padding: '10px 16px', minHeight: 44, borderRadius: 999,
                      border: `1px solid ${active ? PRIMARY : BORDER}`,
                      background: active ? PRIMARY : SURFACE,
                      color: active ? '#fff' : INK,
                      ...body, fontSize: '0.8rem', fontWeight: 600,
                      cursor: 'pointer', whiteSpace: 'nowrap',
                    }}
                  >
                    <Icon size={14} />
                    {type.label}
                  </button>
                );
              })}
            </div>
          </div>

          {deadlineMessage && selectedType !== 'grades' && (
            <div className="mb-3 sm:mb-5">
              <AlertStrip color={selectedDeadline?.closed || !selectedDeadline?.assigned ? DANGER : WARNING}>
                {deadlineMessage}
              </AlertStrip>
            </div>
          )}

          {resubmitNotice && selectedType === 'monthly-report' && view === 'editor' && (
            <div className="mb-3 sm:mb-5"><AlertStrip color={DANGER}>{resubmitNotice}</AlertStrip></div>
          )}
          {resubmitNotice && selectedType !== 'monthly-report' && (
            <div className="mb-3 sm:mb-5"><AlertStrip color={DANGER}>{resubmitNotice}</AlertStrip></div>
          )}

          {selectedType === 'monthly-report' && <>
            {view === 'editor' && (
              <>
                <div className="mb-3 sm:mb-5">
                  <WorkflowSteps steps={workflowSteps} onStepClick={(s) => !s.disabled && s.onClick()} />
                </div>

                {!scholarId && (
                  <div className="mb-3"><AlertStrip color={DANGER}>No scholar account detected. Please log out and log back in.</AlertStrip></div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-3 sm:gap-5 items-start">
                  <div className="min-w-0 space-y-3 sm:space-y-5">

                    {/* Step 1 */}
                    <Card innerRef={infoSectionRef}>
                      <CardHeader icon={User} eyebrow="STEP 1" title="Scholar Information" />
                      <p style={{ ...body, fontSize: '0.8rem', color: MUTED, marginBottom: 18, marginTop: 10, lineHeight: 1.5 }}>This will appear in the official letter header.</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 sm:gap-y-5">
                        <div className="sm:col-span-2"><InfoField label="Full Name" value={info.name} onChange={updateInfo('name')} placeholder="e.g. Juan Dela Cruz" /></div>
                        <InfoField label="Age" value={info.age} onChange={updateInfo('age')} placeholder="e.g. 20" type="number" />
                        <InfoField label="Year Level" value={info.year} onChange={updateInfo('year')} placeholder="e.g. 2nd Year" />
                        {educationStage === 'senior_high' && (
                          <InfoField label="Track / Strand" value={info.track_strand || ''} onChange={updateInfo('track_strand')} placeholder="e.g. STEM, ABM, HUMSS, GAS, or TVL" />
                        )}
                        {(educationStage === 'college' || educationStage === 'other') && (
                          <InfoField label="Course" value={info.course} onChange={updateInfo('course')} placeholder="e.g. BS Computer Science" />
                        )}
                        <InfoField label="School" value={info.school} onChange={updateInfo('school')} placeholder="e.g. University of the Philippines" />
                        <div className="sm:col-span-2">
                          <label style={fieldLabel}>DATE <span style={{ color: PRIMARY }}>*</span></label>
                          <input type="date" value={(() => { try { return new Date(info.date).toISOString().split('T')[0]; } catch { return ''; } })()}
                            onChange={e => { const d = new Date(e.target.value); updateInfo('date')(d.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })); }}
                            className="w-full outline-none transition-colors bg-transparent"
                            style={underlineField}
                            onFocus={e => (e.target.style.borderBottom = `1.5px solid ${PRIMARY}`)} onBlur={e => (e.target.style.borderBottom = `1.5px solid ${BORDER}`)} />
                        </div>
                      </div>
                    </Card>

                    {/* Step 2 */}
                    <Card innerRef={letterSectionRef}>
                      <CardHeader
                        icon={FileText} eyebrow="STEP 2" title="Monthly Letter"
                        right={<span style={{ ...body, fontSize: '0.72rem', color: wordCount >= 150 ? SUCCESS : MUTED, fontWeight: 700, flexShrink: 0, whiteSpace: 'nowrap' }}>{wordCount} / 150+</span>}
                      />
                      <div className="mt-3"><MiniBar pct={(wordCount / 150) * 100} color={wordCount >= 150 ? SUCCESS : GOLD} /></div>
                      <p style={{ ...body, fontSize: '0.8rem', color: MUTED, marginBottom: 14, marginTop: 10, lineHeight: 1.5 }}>Write your letter addressed to "Dear Kalinga," — share your activities, challenges, and plans this month.</p>
                      <div className="rounded-xl px-3 sm:px-4 py-2.5 mb-3" style={{ background: BG, border: `1px solid ${BORDER}` }}>
                        <span style={{ ...body, fontSize: '0.9rem', color: MUTED, fontStyle: 'italic' }}>Dear Kalinga,</span>
                      </div>
                      <textarea value={body_} onChange={e => setBody(e.target.value)} rows={10}
                        placeholder={`Write your monthly report here. Share what you accomplished this month, any challenges you faced, and your plans for next month.\n\nExample:\nI am writing to update you on my progress for this month...`}
                        className="w-full p-3 sm:p-4 rounded-xl border outline-none resize-y transition-all"
                        style={{ ...body, fontSize: '1rem', lineHeight: 1.7, color: INK, borderColor: BORDER, minHeight: 220, background: '#fff' }}
                        onFocus={e => (e.target.style.borderColor = PRIMARY)} onBlur={e => (e.target.style.borderColor = BORDER)} />
                      <div className="rounded-xl px-3 sm:px-4 py-2.5 mt-3" style={{ background: BG, border: `1px solid ${BORDER}` }}>
                        <p style={{ ...body, fontSize: '0.9rem', color: MUTED, fontStyle: 'italic' }}>Your scholar,</p>
                        <p style={{ ...body, fontSize: '0.9rem', fontWeight: 600, color: info.name ? INK : '#c9bfb4', marginTop: 2, wordBreak: 'break-word' }}>{info.name || 'Your Name'}</p>
                      </div>
                    </Card>

                    {/* Step 3 */}
                    <Card innerRef={mediaSectionRef}>
                      <CardHeader icon={Upload} eyebrow="STEP 3" title="Documentation" />
                      <p style={{ ...body, fontSize: '0.8rem', color: MUTED, marginTop: 10, marginBottom: 14, lineHeight: 1.5 }}>Attach photos that document your activities this month.</p>
                      <MediaUploader media={media} onChange={setMedia} />
                    </Card>
                  </div>

                  {/* Desktop: sticky live progress panel */}
                  <aside className="hidden lg:block min-w-0">
                    <div className="lg:sticky lg:top-6 p-5" style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: RADIUS }}>
                      <div className="flex items-center gap-4 mb-5">
                        <CompletionRing pct={overallCompletionPct} color={PRIMARY} />
                        <div>
                          <p style={{ ...body, fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.04em', color: GOLD }}>COMPLETION</p>
                          <p style={{ ...body, fontSize: '0.8rem', color: MUTED, marginTop: 2 }}>{checklistPassedCount} of {CHECKLIST.length} items ready</p>
                        </div>
                      </div>
                      <p style={{ ...body, fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.05em', color: PRIMARY, marginBottom: 12 }}>CHECKLIST</p>
                      <div className="mb-5"><LiveChecklist items={liveChecklist} /></div>
                      <button disabled={!hasContent || evaluating} onClick={handleEvaluate}
                        className="w-full transition-opacity disabled:opacity-40"
                        style={{ ...filledBtn, width: '100%', cursor: (hasContent && !evaluating) ? 'pointer' : 'not-allowed' }}>
                        <Sparkles size={15} />
                        {evaluating ? 'Running review…' : 'Run Automated Review'}
                      </button>
                    </div>
                  </aside>
                </div>

                {/* Mobile / tablet: sticky bottom bar with expandable checklist */}
                <div className="lg:hidden fixed left-0 right-0 bottom-0 z-30" style={stickyBarStyle}>
                  {checklistOpen && (
                    <div className="px-4 pt-4 pb-3 overflow-y-auto" style={{ maxHeight: '45vh', borderBottom: `1px solid ${BORDER}` }}>
                      <p style={{ ...body, fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.05em', color: PRIMARY, marginBottom: 10 }}>CHECKLIST</p>
                      <LiveChecklist items={liveChecklist} />
                    </div>
                  )}
                  <div className="flex items-center gap-3 px-4 py-2.5">
                    <button
                      onClick={() => setChecklistOpen(o => !o)}
                      aria-expanded={checklistOpen}
                      className="flex items-center gap-2.5 flex-1 min-w-0 text-left"
                      style={{ background: 'none', border: 'none', padding: 0, minHeight: 44, cursor: 'pointer' }}
                    >
                      <CompletionRing pct={overallCompletionPct} color={PRIMARY} size={44} stroke={5} />
                      <span className="min-w-0">
                        <span className="block" style={{ ...body, fontSize: '0.8rem', fontWeight: 700, color: INK }}>{checklistPassedCount} of {CHECKLIST.length} ready</span>
                        <span className="flex items-center gap-1" style={{ ...body, fontSize: '0.7rem', color: MUTED }}>
                          Checklist {checklistOpen ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
                        </span>
                      </span>
                    </button>
                    <button disabled={!hasContent || evaluating} onClick={handleEvaluate}
                      className="flex-shrink-0 transition-opacity disabled:opacity-40"
                      style={{ ...filledBtn, padding: '12px 16px', cursor: (hasContent && !evaluating) ? 'pointer' : 'not-allowed' }}>
                      <Sparkles size={14} />
                      {evaluating ? 'Reviewing…' : 'Run Review'}
                    </button>
                  </div>
                </div>
              </>
            )}

            {view === 'evaluation' && evalResult && (
              <div className="min-w-0">
                <button onClick={() => setView('editor')} className="flex items-center gap-1.5 mb-3 transition-opacity hover:opacity-70"
                  style={{ ...body, fontSize: '0.85rem', fontWeight: 600, color: PRIMARY, background: 'none', border: 'none', cursor: 'pointer', padding: '8px 0', minHeight: 44 }}>
                  <ArrowLeft size={15} /> Back to Editor
                </button>

                {/* Score hero */}
                <Card className="mb-3 sm:mb-5">
                  <div className="flex items-center gap-4">
                    <CompletionRing pct={evalResult.overallScore} color={reviewColor} size={76} stroke={7} />
                    <div className="min-w-0 flex-1">
                      <p style={{ ...body, fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.05em', color: GOLD }}>STEP 4 · REPORT REVIEW</p>
                      <h3 style={{ ...display, fontWeight: 600, color: INK, marginTop: 2, lineHeight: 1.25 }} className="text-[1.05rem] sm:text-[1.2rem]">Review Your Report</h3>
                      <p style={{ ...body, fontSize: '0.78rem', color: MUTED, marginTop: 3, wordBreak: 'break-word' }}>{[info.name || 'Scholar', info.date].filter(Boolean).join(' · ')}</p>
                      {(evalResult.riskLabel || evalResult.flagged) && (
                        <span className="inline-block" style={{ ...body, fontSize: '0.7rem', fontWeight: 700, color: reviewColor, background: `${reviewColor}14`, padding: '4px 12px', borderRadius: 999, marginTop: 8 }}>
                          {evalResult.flagged ? 'Invalid Letter' : evalResult.riskLabel}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Desktop actions (phones use the bottom bar) */}
                  <div className="hidden lg:flex items-center justify-end gap-2 mt-4 pt-4" style={{ borderTop: `1px solid ${BORDER}` }}>
                    <button onClick={() => setView('editor')} style={outlineBtn}><Bookmark size={14} /> Edit</button>
                    <button onClick={() => { setSubmitError(''); setShowConfirm(true); }} disabled={submitBlocked} className="disabled:opacity-50" style={{ ...filledBtn, cursor: submitBlocked ? 'not-allowed' : 'pointer' }}><Send size={14} /> Submit Report</button>
                  </div>
                </Card>

                {evalResult.flagged && (
                  <div className="mb-3 sm:mb-5">
                    <AlertStrip color={DANGER}>
                      Letter rejected for evaluation — {evalResult.flagReason}
                    </AlertStrip>
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-3 sm:gap-5 items-start">
                  {/* Letter preview — second on phones, left on desktop */}
                  <Card className="order-2 lg:order-1 overflow-y-auto lg:max-h-[640px]">
                    <div className="text-center mb-5 pb-4" style={{ borderBottom: `1px solid ${GOLD}55` }}>
                      <p style={{ ...display, fontSize: '0.95rem', fontWeight: 700, color: PRIMARY, lineHeight: 1.35 }}>Kalinga at Pag-ibig Foundation Inc.</p>
                      <p style={{ ...body, fontSize: '0.74rem', color: MUTED, marginTop: 2 }}>Apple Scholars · Rodriguez, Rizal</p>
                    </div>
                    <div className="mb-5 space-y-1">
                      {[['Name', info.name], ['Age', info.age ? `${info.age} years old` : ''], ['Year', info.year], ['Course', info.course], ['School', info.school], ['Date', info.date]].map(([l, v]) => v ? (
                        <div key={l} className="flex gap-2">
                          <span style={{ ...body, fontSize: '0.82rem', fontWeight: 700, color: '#3f2f28', minWidth: 52, flexShrink: 0 }}>{l}:</span>
                          <span style={{ ...body, fontSize: '0.82rem', color: MUTED, wordBreak: 'break-word' }}>{v}</span>
                        </div>
                      ) : null)}
                    </div>
                    <p style={{ ...body, fontSize: '0.9rem', lineHeight: 1.8, color: '#3f2f28', marginBottom: 14 }}>Dear Kalinga,</p>
                    {body_.split(/\n\n+/).filter(p => p.trim()).map((para, i) => (
                      <p key={i} style={{ ...body, fontSize: '0.9rem', lineHeight: 1.78, color: '#3f2f28', marginBottom: 12, textIndent: '1.5rem', wordBreak: 'break-word' }}>{para.trim()}</p>
                    ))}
                    <p style={{ ...body, fontSize: '0.9rem', color: '#3f2f28', marginTop: 20, marginBottom: 2 }}>Your scholar,</p>
                    <p style={{ ...body, fontSize: '0.9rem', fontWeight: 700, color: INK }}>{info.name}</p>
                    {media.length > 0 && (
                      <div className="mt-5 pt-4" style={{ borderTop: `1px solid ${BORDER}` }}>
                        <p style={{ ...body, fontSize: '0.7rem', fontWeight: 700, color: PRIMARY, marginBottom: 8, letterSpacing: '0.03em' }}>
                          DOCUMENTATION ({media.length} PHOTO{media.length > 1 ? 'S' : ''})
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {media.map((item) => (
                            <div key={item.id} className="min-w-0">
                              <div className="rounded-lg overflow-hidden" style={{ height: 84 }}>
                                <img src={item.previewUrl} alt="" className="w-full h-full object-cover" />
                              </div>
                              <p style={{ ...body, fontSize: '0.68rem', color: MUTED, marginTop: 3, textAlign: 'center', fontStyle: 'italic', wordBreak: 'break-word' }}>
                                {item.description ? `(${item.description.substring(0, 35)}${item.description.length > 35 ? '…' : ''})` : '(no description)'}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <p style={{ ...body, fontSize: '0.7rem', color: '#b9aba0', marginTop: 16 }}>Words: {wordCount} · Page 1 / Apple Scholar</p>
                  </Card>

                  {/* Review details — first on phones, right on desktop */}
                  <div className="order-1 lg:order-2 min-w-0 space-y-3">
                    {evalResult.sentimentLabel && (
                      <Panel title="LETTER CLASSIFICATION">
                        <p style={{ ...body, fontSize: '0.8rem', color: MUTED }}>Sentiment: {evalResult.sentimentLabel}</p>
                      </Panel>
                    )}

                    <Panel title="RULE-BASED SCORING">
                      <p style={{ ...body, fontSize: '0.85rem', fontWeight: 700, color: INK }}>
                        Overall: {Number.isFinite(evalResult.overallScore) ? `${evalResult.overallScore}%` : 'N/A'}
                      </p>
                      <p style={{ ...body, fontSize: '0.76rem', color: MUTED, marginTop: 3 }}>
                        Letter body: {Number.isFinite(evalResult.reportScore) ? `${evalResult.reportScore}/75` : 'N/A'}
                        {' · '}Method: {evalResult.source === 'rule_based_v3' ? 'V3 rule-based' : 'Rule-based'}
                      </p>
                      <div className="mt-2.5 space-y-1.5">
                        {[
                          ['Documentation', evalResult.mediaScore, 20],
                          ['Scholar information', evalResult.infoScore, 5],
                        ].map(([label, score, max]) => (
                          <div key={label} className="flex items-center justify-between" style={{ ...body, fontSize: '0.74rem', color: MUTED }}>
                            <span>{label}</span>
                            <span style={{ fontWeight: 700, color: INK }}>{Number.isFinite(score) ? score : 0}/{max}</span>
                          </div>
                        ))}
                      </div>
                    </Panel>

                    {evalResult.bodyCriteria?.length > 0 && (
                      <Panel title="LETTER BODY BREAKDOWN">
                        <div className="space-y-2.5">
                          {evalResult.bodyCriteria.map((criterion) => {
                            const score = Number(criterion.score || 0);
                            const max = Number(criterion.max || 15);
                            return (
                              <div key={criterion.key || criterion.label}>
                                <div className="flex items-center justify-between gap-2 mb-1" style={{ ...body, fontSize: '0.74rem', color: MUTED }}>
                                  <span className="min-w-0">{criterion.label || criterion.key}</span>
                                  <span className="flex-shrink-0" style={{ fontWeight: 700, color: INK }}>{score}/{max}</span>
                                </div>
                                <MiniBar pct={(score / max) * 100} color={PRIMARY} />
                              </div>
                            );
                          })}
                        </div>
                      </Panel>
                    )}

                    {media.length > 0 && (
                      <Panel title="DOCUMENTATION & CAPTIONS">
                        <div className="space-y-1.5">
                          {media.map((item, index) => (
                            <div key={item.id} style={{ ...body, fontSize: '0.74rem', color: MUTED, lineHeight: 1.45, wordBreak: 'break-word' }}>
                              <span style={{ fontWeight: 700, color: INK }}>Photo {index + 1}: </span>
                              {item.description?.trim() || 'No caption'}
                            </div>
                          ))}
                        </div>
                      </Panel>
                    )}

                    <Panel title="SUBMISSION CHECKLIST">
                      <div className="space-y-1.5">
                        {evalResult.checklist.map(({ item, passed }) => (
                          <div key={item.id} className="flex items-start gap-2 rounded-lg px-3 py-2"
                            style={{ background: passed ? `${SUCCESS}14` : `${DANGER}14`, border: `1px solid ${passed ? SUCCESS : DANGER}33` }}>
                            {passed ? <CheckCircle size={14} style={{ color: SUCCESS, flexShrink: 0, marginTop: 1 }} /> : <XCircle size={14} style={{ color: DANGER, flexShrink: 0, marginTop: 1 }} />}
                            <span style={{ ...body, fontSize: '0.78rem', fontWeight: 500, color: passed ? SUCCESS : DANGER, lineHeight: 1.4 }}>{item.label}</span>
                          </div>
                        ))}
                      </div>
                    </Panel>
                  </div>
                </div>

                {/* Mobile / tablet: sticky action bar */}
                {!showConfirm && (
                  <div className="lg:hidden fixed left-0 right-0 bottom-0 z-30" style={stickyBarStyle}>
                    <div className="flex items-center gap-2.5 px-4 py-2.5">
                      <button onClick={() => setView('editor')} className="flex-1" style={outlineBtn}><Bookmark size={14} /> Edit</button>
                      <button onClick={() => { setSubmitError(''); setShowConfirm(true); }} disabled={submitBlocked} className="flex-[1.6] disabled:opacity-50" style={{ ...filledBtn, cursor: submitBlocked ? 'not-allowed' : 'pointer' }}><Send size={14} /> Submit Report</button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {view === 'submitted' && (
              <SubmittedView
                info={info}
                body={body_}
                media={media}
                record={submittedRecord}
                statusError={submissionStatusError}
                onNew={handleNewSubmission}
                onViewHistory={() => {
                  setTab('history');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              />
            )}
            {showConfirm && evalResult && (
              <ConfirmModal ev={evalResult} submitting={submitting} submitError={submitError}
                onCancel={() => setShowConfirm(false)} onConfirm={handleConfirmSubmit} />
            )}
          </>}

          {selectedType === 'grades' && <ScholarGrades />}

          {selectedType !== 'monthly-report' && selectedType !== 'grades' && (
            <Card className="sm:p-7">
              <div className="max-w-2xl mx-auto">
                {docSuccess ? (
                  <div className="rounded-xl p-4 sm:p-5 flex items-start gap-3" style={{ background: `${SUCCESS}0f`, border: `1px solid ${SUCCESS}33` }}>
                    <CheckCircle size={22} style={{ color: SUCCESS, flexShrink: 0 }} />
                    <div className="min-w-0">
                      <p style={{ ...body, fontSize: '0.92rem', fontWeight: 700, color: SUCCESS, lineHeight: 1.45 }}>{docSuccess}</p>
                      <button onClick={() => setDocSuccess('')} className="mt-2 underline"
                        style={{ color: PRIMARY, ...body, fontSize: '0.82rem', background: 'none', border: 'none', cursor: 'pointer', padding: '8px 0', minHeight: 44 }}>Upload another document</button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <input id="doc-upload-input" type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" style={{ display: 'none' }} onChange={e => setDocFile(e.target.files?.[0] || null)} />
                    <label
                      htmlFor="doc-upload-input"
                      onDragOver={e => { e.preventDefault(); setDragging(true); }}
                      onDragLeave={() => setDragging(false)}
                      onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files?.[0]; if (f) setDocFile(f); }}
                      className="block rounded-2xl p-6 sm:p-12 text-center cursor-pointer"
                      style={{ border: `1.5px dashed ${dragging ? PRIMARY : `${GOLD}99`}`, background: dragging ? `${PRIMARY}0a` : BG }}
                    >
                      <Inbox size={38} style={{ margin: '0 auto 12px', color: PRIMARY }} />
                      <h3 className="mb-1.5" style={{ ...display, fontSize: '1.1rem', fontWeight: 600, color: INK, lineHeight: 1.3 }}>Upload Your {docTypeLabel}</h3>
                      <p className="mb-4" style={{ ...body, fontSize: '0.85rem', color: MUTED, wordBreak: 'break-all' }}>{docFile ? docFile.name : 'Tap to browse, or drag and drop a file here'}</p>
                      <span style={{ ...outlineBtn, display: 'inline-flex', border: `1.5px solid ${PRIMARY}`, color: PRIMARY }}>
                        {docFile ? 'Choose a different file' : 'Browse Files'}
                      </span>
                      <p className="mt-4" style={{ ...body, fontSize: '0.72rem', color: MUTED }}>Supported formats: PDF, JPG, PNG (Max 10MB)</p>
                    </label>

                    {docFile && (
                      <button onClick={handleDocUpload} disabled={docUploading || !scholarId || deadlineBlocked} className="w-full mt-4 disabled:opacity-50"
                        style={{ ...filledBtn, width: '100%', cursor: docUploading || deadlineBlocked ? 'not-allowed' : 'pointer' }}>
                        <Send size={14} />
                        {docUploading ? 'Uploading…' : `Submit ${docTypeLabel}`}
                      </button>
                    )}
                    {docError && <div className="mt-4"><AlertStrip color={DANGER}>{docError}</AlertStrip></div>}
                  </div>
                )}
              </div>
            </Card>
          )}
        </>}

        {tab === 'history' && (
          <>
            {/* Quick stats */}
            <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-3 sm:mb-5">
              <ProgressCard eyebrow="RECORDS" title="Total">
                <span style={{ ...display, fontWeight: 700, color: PRIMARY }} className="text-[1.4rem] sm:text-[1.6rem]">{totalSubmissions}</span>
              </ProgressCard>
              <ProgressCard eyebrow="STATUS" title="Accepted">
                <span style={{ ...display, fontWeight: 700, color: SUCCESS }} className="text-[1.4rem] sm:text-[1.6rem]">{acceptedCount}</span>
              </ProgressCard>
              <ProgressCard eyebrow="STATUS" title="Pending">
                <span style={{ ...display, fontWeight: 700, color: WARNING }} className="text-[1.4rem] sm:text-[1.6rem]">{pendingReviewCount}</span>
              </ProgressCard>
            </div>

            {/* Search + status chips */}
            <div className="p-3 sm:p-4 mb-3 sm:mb-5 min-w-0" style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: RADIUS }}>
              <div className="flex items-center gap-2.5 px-3 rounded-xl" style={{ background: BG, border: `1px solid ${BORDER}`, minHeight: 44 }}>
                <Search size={16} style={{ color: MUTED, flexShrink: 0 }} />
                <input
                  type="search"
                  aria-label="Search your submissions"
                  placeholder="Search your submissions"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  style={{ width: '100%', minWidth: 0, border: 'none', outline: 'none', background: 'none', ...body, fontSize: '1rem', color: INK, padding: '10px 0' }}
                />
              </div>
              <div className="flex items-center gap-2 overflow-x-auto mt-3 -mx-1 px-1" style={noScrollbar}>
                {HISTORY_FILTERS.map(f => {
                  const active = historyStatusFilter === f.value;
                  return (
                    <button
                      key={f.value}
                      onClick={() => setHistoryStatusFilter(f.value)}
                      aria-pressed={active}
                      className="flex-shrink-0"
                      style={{
                        ...body, fontSize: '0.78rem', fontWeight: 600, padding: '8px 14px', minHeight: 40, borderRadius: 999, whiteSpace: 'nowrap', cursor: 'pointer',
                        border: `1px solid ${active ? PRIMARY : BORDER}`,
                        background: active ? PRIMARY : SURFACE,
                        color: active ? '#fff' : INK,
                      }}
                    >
                      {f.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Registry */}
            <div className="min-w-0 max-w-full p-3 sm:p-5" style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: RADIUS }}>
              <SubmissionHistory history={filteredHistory} loading={historyLoading} error={historyError} onResubmit={handleResubmit} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default Submission;