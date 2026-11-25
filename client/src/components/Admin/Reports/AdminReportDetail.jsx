import { useEffect, useState } from "react";
import { X, Image as ImageIcon, ImageOff, AlertTriangle, CheckCircle, XCircle, Sparkles, ClipboardCheck, ChevronDown } from "lucide-react";
import ScoreRing from "../../shared/ScoreRing";

// ── Design tokens — "Apple Scholar Executive" system (matches DonorReportingCenter / AdminReports) ──
const BG = "#F7F4EE";
const SURFACE = "#FFFDF9";
const BORDER = "#E5D8CA";
const PRIMARY = "#6D2140";
const PRIMARY_DEEP = "#4A1730";
const BRONZE = "#A9784E";
const INK = "#241512";
const MUTED = "#8A7A68";
const SUCCESS = "#6B8F71";
const SUCCESS_BG = "#EAF3EB";
const WARNING = "#C08A3E";
const WARNING_BG = "#FBF1DF";
const DANGER = "#A24A4A";
const DANGER_BG = "#FBEAE8";
const RADIUS = 16;

const display = { fontFamily: "'Playfair Display', Georgia, 'Times New Roman', serif" };
const body = { fontFamily: "'Inter', 'Segoe UI', sans-serif" };

const scoreColor = (score) => {
  if (score >= 80) return SUCCESS;
  if (score >= 60) return WARNING;
  return DANGER;
};

// Labels match the Compliance Reports table and summary cards.
const reportStatusBadge = (status) => ({
  approved: { bg: SUCCESS_BG, color: SUCCESS, label: "Approved", Icon: CheckCircle },
  pending: { bg: WARNING_BG, color: WARNING, label: "Pending review", Icon: AlertTriangle },
  returned: { bg: DANGER_BG, color: DANGER, label: "Returned for revision", Icon: XCircle },
  rejected: { bg: DANGER_BG, color: DANGER, label: "Rejected", Icon: XCircle },
  needs_revision: { bg: DANGER_BG, color: DANGER, label: "Needs revision", Icon: XCircle },
})[String(status || "").trim().toLowerCase().replace(/-/g, "_")];

const qualityAssessment = (status, score) => {
  const normalizedStatus = String(status || "").trim().toLowerCase().replace(/-/g, "_");
  const classification = normalizedStatus === "accepted"
    ? "accepted"
    : normalizedStatus === "medium_risk"
      ? "medium-risk"
      : normalizedStatus === "high_risk"
        ? "high-risk"
        : Number.isFinite(score)
          ? score >= 75 ? "accepted" : score >= 50 ? "medium-risk" : "high-risk"
          : null;

  return ({
    accepted: { title: "Meets quality threshold", detail: "The recorded quality score is at least 75/100." },
    "medium-risk": { title: "Needs improvement", detail: "The recorded quality score is between 50 and 74/100." },
    "high-risk": { title: "Below quality threshold", detail: "The recorded quality score is below 50/100." },
  })[classification] || { title: "Quality assessment unavailable", detail: "No saved quality score is available for this report." };
};

const InfoCard = ({ label, value, wide = false }) => (
  <div
    className={`min-w-0 ${wide ? "col-span-2 sm:col-span-1" : ""}`}
    style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "0.65rem 0.85rem" }}
  >
    <p style={{ ...body, fontSize: "0.64rem", fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3 }}>
      {label}
    </p>
    <p style={{ ...body, fontSize: "0.86rem", fontWeight: 600, color: INK, overflowWrap: "anywhere", lineHeight: 1.35 }}>{value || "—"}</p>
  </div>
);

const SectionLabel = ({ icon: Icon, children, right }) => (
  <div className="flex items-center justify-between gap-2 mb-3">
    <div className="flex items-center gap-2 min-w-0">
      {Icon && <Icon size={15} color={PRIMARY} style={{ flexShrink: 0 }} />}
      <h3 style={{ ...display, fontSize: "1rem", fontWeight: 600, color: INK }}>{children}</h3>
    </div>
    {right}
  </div>
);

export default function AdminReportDetail({ report, onClose }) {
  const [showChecks, setShowChecks] = useState(false); // phones only; always visible on lg+

  const systemBadge = reportStatusBadge(report.status);
  const SystemIcon = systemBadge?.Icon || CheckCircle;
  const checklist = Array.isArray(report.checklistResults) ? report.checklistResults : [];
  const passedCount = checklist.filter((c) => c.passed).length;
  const parsedQuality = Number(report.qualityScore);
  const hasQualityScore = report.qualityScore !== null
    && report.qualityScore !== undefined
    && report.qualityScore !== ""
    && Number.isFinite(parsedQuality);
  const quality = hasQualityScore ? Math.min(Math.max(parsedQuality, 0), 100) : 0;
  const assessment = qualityAssessment(report.qualityStatus, hasQualityScore ? quality : null);
  const scholarIdValue = report.scholarId || report.studentId || report.scholar_id;

  // Close on Escape and lock background scroll while the dialog is open.
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  const metaParts = [
    report.scholarName,
    scholarIdValue ? `ID ${scholarIdValue}` : null,
    report.submittedAt ? `Submitted ${report.submittedAt}` : null,
  ].filter(Boolean);

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch sm:items-center justify-center sm:p-4 lg:p-6"
      style={{ background: "rgba(36,21,18,0.55)" }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-detail-title"
        className="w-full flex flex-col h-full sm:h-auto sm:max-h-[92vh] sm:rounded-[18px]"
        style={{
          maxWidth: 1240,
          background: SURFACE,
          boxShadow: "0 24px 60px -20px rgba(36,21,18,0.35)",
          overflow: "hidden",
        }}
      >
        {/* ── Header ── */}
        <header
          className="flex-shrink-0 px-4 py-3.5 sm:px-7 sm:py-5"
          style={{ borderBottom: `1px solid ${BORDER}`, background: BG, paddingTop: "max(0.875rem, env(safe-area-inset-top))" }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p style={{ ...body, color: BRONZE, fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                Admin Report Review
              </p>
              <h1 id="report-detail-title" style={{ ...display, color: INK, marginTop: 2, lineHeight: 1.2, fontWeight: 600 }} className="text-[1.25rem] sm:text-[1.55rem]">
                Monthly Scholar Report
              </h1>
              <p style={{ ...body, fontSize: "0.8rem", color: MUTED, marginTop: 4, lineHeight: 1.45, overflowWrap: "anywhere" }}>
                {metaParts.join(" · ")}
              </p>
            </div>
            <div className="flex items-center gap-2.5 flex-shrink-0">
              {systemBadge && (
                <div
                  className="hidden sm:flex items-center gap-1.5"
                  style={{ background: systemBadge.bg, borderRadius: 999, padding: "6px 14px" }}
                >
                  <SystemIcon size={14} color={systemBadge.color} />
                  <span style={{ ...body, fontSize: "0.76rem", fontWeight: 700, color: systemBadge.color }}>
                    {systemBadge.label}
                  </span>
                </div>
              )}
              <button
                onClick={onClose}
                aria-label="Close"
                className="flex items-center justify-center flex-shrink-0"
                style={{
                  width: 40, height: 40, borderRadius: "50%", border: `1px solid ${BORDER}`, background: "#fff",
                  color: MUTED, cursor: "pointer",
                }}
              >
                <X size={17} />
              </button>
            </div>
          </div>
          {systemBadge && (
            <div
              className="sm:hidden inline-flex items-center gap-1.5 mt-3"
              style={{ background: systemBadge.bg, borderRadius: 999, padding: "6px 12px" }}
            >
              <SystemIcon size={13} color={systemBadge.color} />
              <span style={{ ...body, fontSize: "0.74rem", fontWeight: 700, color: systemBadge.color }}>{systemBadge.label}</span>
            </div>
          )}
        </header>

        {/* ── Body: single scroll on phones, two independent columns on lg+ ── */}
        <div className="flex-1 min-h-0 overflow-y-auto lg:overflow-hidden flex flex-col lg:flex-row">

          {/* AI evaluation — first on phones, right on desktop */}
          <aside
            className="order-1 lg:order-2 w-full lg:w-[340px] xl:w-[380px] flex-shrink-0 lg:overflow-y-auto p-4 sm:p-6"
            style={{ background: BG, borderBottom: `1px solid ${BORDER}` }}
          >
            {/* Score + assessment */}
            <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 16, padding: "1rem" }}>
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0" style={{ position: "relative", width: 88, height: 88 }}>
                  <ScoreRing score={quality} size={88} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span style={{ ...display, fontSize: "1.4rem", fontWeight: 700, color: INK }}>{hasQualityScore ? quality : "—"}</span>
                  </div>
                </div>
                <div className="min-w-0">
                  <p style={{ ...body, fontSize: "0.64rem", fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Submission Quality Score
                  </p>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <Sparkles size={14} color={BRONZE} style={{ flexShrink: 0 }} />
                    <p style={{ ...display, fontSize: "0.98rem", fontWeight: 600, color: INK, lineHeight: 1.25 }}>{assessment.title}</p>
                  </div>
                </div>
              </div>
              <div style={{ width: "100%", height: 6, background: BG, border: `1px solid ${BORDER}`, borderRadius: 99, overflow: "hidden", marginTop: 14 }}>
                <div style={{ height: "100%", width: `${quality}%`, background: scoreColor(quality), borderRadius: 99 }} />
              </div>
              <p style={{ ...body, fontSize: "0.76rem", color: MUTED, lineHeight: 1.5, marginTop: 10 }}>{assessment.detail}</p>
            </div>

            {/* Only the overall score is persisted; do not imply unsupported component scores. */}
            <p style={{ ...body, fontSize: "0.72rem", color: MUTED, lineHeight: 1.5, margin: "12px 2px 16px" }}>
              {hasQualityScore
                ? "This is the saved overall score. A validated component breakdown is unavailable."
                : "No overall score was saved for this report."}
            </p>

            {/* Checklist validation */}
            <button
              type="button"
              onClick={() => setShowChecks((v) => !v)}
              aria-expanded={showChecks}
              className="w-full flex items-center justify-between gap-2 lg:cursor-default"
              style={{ background: "none", border: "none", padding: 0, textAlign: "left", cursor: "pointer", minHeight: 36 }}
            >
              <span className="flex items-center gap-2 min-w-0">
                <ClipboardCheck size={15} color={PRIMARY} style={{ flexShrink: 0 }} />
                <span style={{ ...body, fontSize: "0.8rem", fontWeight: 700, color: INK }}>Submission Validation</span>
              </span>
              <span className="flex items-center gap-2 flex-shrink-0">
                <span style={{ ...body, fontSize: "0.7rem", fontWeight: 700, color: passedCount === checklist.length && checklist.length > 0 ? SUCCESS : MUTED, background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 999, padding: "3px 10px" }}>
                  {passedCount}/{checklist.length} passed
                </span>
                <ChevronDown
                  size={16}
                  color={MUTED}
                  className="lg:hidden"
                  style={{ transform: showChecks ? "rotate(180deg)" : "none", transition: "transform 150ms" }}
                />
              </span>
            </button>
            <div className={`${showChecks ? "flex" : "hidden"} lg:flex flex-col gap-1.5 mt-3`}>
              {checklist.length === 0 && (
                <p style={{ ...body, fontSize: "0.76rem", color: MUTED }}>No validation checks were recorded.</p>
              )}
              {checklist.map((c, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2"
                  style={{ borderRadius: 10, padding: "8px 10px", background: c.passed ? SUCCESS_BG : DANGER_BG }}
                >
                  {c.passed ? (
                    <CheckCircle size={14} style={{ marginTop: 1, flexShrink: 0 }} color={SUCCESS} />
                  ) : (
                    <XCircle size={14} style={{ marginTop: 1, flexShrink: 0 }} color={DANGER} />
                  )}
                  <span style={{ ...body, fontSize: "0.76rem", color: c.passed ? SUCCESS : DANGER, lineHeight: 1.4 }}>
                    {c.label}
                  </span>
                </div>
              ))}
            </div>
          </aside>

          {/* Report document — second on phones, left on desktop */}
          <main
            className="order-2 lg:order-1 flex-1 min-w-0 lg:overflow-y-auto"
            style={{ borderRight: `1px solid ${BORDER}` }}
          >
            <div className="px-4 pt-5 pb-6 sm:px-8 sm:pt-7 lg:px-9">
              {/* Scholar information cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3 mb-6 sm:mb-8">
                <InfoCard label="Name" value={report.scholarName} wide />
                <InfoCard label="Age" value={report.age ? `${report.age} years old` : null} />
                <InfoCard label="Year" value={report.year} />
                <InfoCard label="Course" value={report.course} />
                <InfoCard label="School" value={report.school} />
                <InfoCard label="Report Date" value={report.date} />
              </div>

              {/* Report body — reading document */}
              <article
                className="px-4 py-6 sm:px-8 sm:py-8"
                style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: RADIUS }}
              >
                <p
                  className="text-center pb-4 mb-5"
                  style={{ ...body, fontSize: "0.68rem", fontWeight: 700, color: BRONZE, textTransform: "uppercase", letterSpacing: "0.06em", lineHeight: 1.6, borderBottom: `1px solid ${BRONZE}44` }}
                >
                  Kalinga at Pag-ibig Foundation Inc.
                  <br />
                  Apple Scholars · Rodriguez, Rizal
                </p>

                <p style={{ ...body, fontSize: "0.95rem", lineHeight: 1.85, color: INK, marginBottom: 14 }}>
                  Dear Kalinga,
                </p>
                {(report.body || "")
                  .split(/\n\n+/)
                  .filter((p) => p.trim())
                  .map((para, i) => (
                    <p key={i} style={{ ...body, fontSize: "0.95rem", lineHeight: 1.85, color: INK, marginBottom: 14, textIndent: "1.75rem", overflowWrap: "anywhere" }}>
                      {para.trim()}
                    </p>
                  ))}
                <p style={{ ...body, fontSize: "0.95rem", color: INK, marginTop: 22, marginBottom: 3 }}>
                  Your scholar,
                </p>
                <p style={{ ...display, fontSize: "1.05rem", fontWeight: 700, color: PRIMARY_DEEP, overflowWrap: "anywhere" }}>
                  {report.scholarName}
                </p>
              </article>

              {/* Documentation photos */}
              <section className="mt-7 sm:mt-8">
                <SectionLabel
                  icon={ImageIcon}
                  right={report.photos?.length > 0 && (
                    <span style={{ ...body, fontSize: "0.72rem", fontWeight: 600, color: MUTED }}>
                      {report.photos.length} photo{report.photos.length > 1 ? "s" : ""}
                    </span>
                  )}
                >
                  Documentation
                </SectionLabel>

                {report.photos?.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                    {report.photos.map((photo, i) => (
                      <figure key={i} className="min-w-0" style={{ margin: 0 }}>
                        <a
                          href={photo.url}
                          target="_blank"
                          rel="noreferrer"
                          className="block overflow-hidden"
                          style={{ borderRadius: 12, border: `1px solid ${BORDER}`, aspectRatio: "4 / 3", background: BG }}
                        >
                          <img
                            src={photo.url}
                            alt={photo.description || `Documentation photo ${i + 1}`}
                            loading="lazy"
                            className="w-full h-full object-cover block"
                            style={{ transition: "transform 0.25s ease" }}
                            onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.05)"; }}
                            onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
                          />
                        </a>
                        <figcaption style={{ ...body, fontSize: "0.74rem", color: MUTED, marginTop: 6, fontStyle: "italic", textAlign: "center", lineHeight: 1.4, overflowWrap: "anywhere" }}>
                          {photo.description || "No description"}
                        </figcaption>
                      </figure>
                    ))}
                  </div>
                ) : (
                  <div
                    className="flex flex-col items-center text-center"
                    style={{ background: BG, border: `1px dashed ${BORDER}`, borderRadius: RADIUS, padding: "2rem 1rem" }}
                  >
                    <div
                      style={{
                        width: 44, height: 44, borderRadius: "50%", background: `${PRIMARY}12`,
                        display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10, color: PRIMARY,
                      }}
                    >
                      <ImageOff size={20} />
                    </div>
                    <p style={{ ...body, fontSize: "0.84rem", color: MUTED }}>No documentation photos attached.</p>
                  </div>
                )}
              </section>

              <div className="flex justify-between gap-3 mt-7 pt-4" style={{ borderTop: `1px solid ${BORDER}` }}>
                <span style={{ ...body, fontSize: "0.7rem", color: MUTED }}>Apple Scholar Foundation</span>
                <span style={{ ...body, fontSize: "0.7rem", color: MUTED }}>{report.date}</span>
              </div>
            </div>
          </main>
        </div>

        {/* ── Footer ── */}
        <footer
          className="flex-shrink-0 flex items-center justify-between gap-3 px-4 py-3 sm:px-7 sm:py-4"
          style={{ borderTop: `1px solid ${BORDER}`, background: SURFACE, paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        >
          <span className="hidden sm:inline" style={{ ...body, fontSize: "0.76rem", color: MUTED }}>Report generated by Apple Scholar</span>
          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              onClick={onClose}
              className="flex-1 sm:flex-none"
              style={{
                ...body, fontSize: "0.84rem", fontWeight: 600, color: PRIMARY,
                border: `1px solid ${PRIMARY}55`, borderRadius: 10, padding: "11px 20px", minHeight: 44,
                background: "#fff", cursor: "pointer",
              }}
            >
              Close
            </button>
            <button
              disabled
              title="Coming soon"
              className="flex-1 sm:flex-none"
              style={{
                ...body, fontSize: "0.84rem", fontWeight: 600, color: "#fff",
                border: "none", borderRadius: 10, padding: "11px 20px", minHeight: 44,
                background: PRIMARY, opacity: 0.45, cursor: "not-allowed",
              }}
            >
              Review
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}