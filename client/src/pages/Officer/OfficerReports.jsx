import { useState, useEffect } from "react";
import axios from "axios";
import { BarChart3, FileText, AlertTriangle } from "lucide-react";
import { API_BASE, authHeaders } from "../../components/Officer/Reports/ReportsHelpers";
import MonthlyReportsTab from "../../components/Officer/Reports/MonthlyReportsTab";
import SubmissionRecordsTab from "../../components/Officer/Reports/SubmissionRecordsTab";

// ── Apple Scholar design system — same tokens as the other Officer pages ──
const PRIMARY = '#6D2140';
const GOLD = '#A9784E';
const BG = '#F7F4EE';
const SURFACE = '#FFFDF9';
const BORDER = '#E7D8C7';
const INK = '#241512';
const MUTED = '#8A7A68';
const DANGER = '#A24A4A';
const RADIUS = 16;
const SHADOW = '0 12px 28px -20px rgba(36,21,18,0.22)';

const display = { fontFamily: "'Lora', Georgia, 'Times New Roman', serif" };
const body = { fontFamily: "'Inter', 'Segoe UI', sans-serif" };

const card = { background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: RADIUS, boxShadow: SHADOW };

const tabItems = [
  { key: "compliance", label: "Compliance Reports", sub: "All requirements and document submissions", Icon: FileText },
  { key: "monthly-reports", label: "Monthly Letter Review", sub: "Review monthly letter submissions", Icon: BarChart3 },
];

export default function OfficerReports() {
  const [activeTab, setActiveTab] = useState("compliance");
  const [assignedYearLevels, setAssignedYearLevels] = useState([]);
  const [assignedYearLevelsLoading, setAssignedYearLevelsLoading] = useState(true);
  const [assignedYearLevelsError, setAssignedYearLevelsError] = useState("");

  useEffect(() => {
    let active = true;
    const loadAssignedYearLevels = async () => {
      setAssignedYearLevelsLoading(true);
      setAssignedYearLevelsError("");
      try {
        const response = await axios.get(`${API_BASE}/officer/assigned-year-levels`, authHeaders());
        if (!Array.isArray(response.data) || response.data.some(level => typeof level !== "string")) {
          throw new Error("The assigned year levels response is invalid.");
        }
        if (active) setAssignedYearLevels([...new Set(response.data)]);
      } catch (error) {
        if (!active) return;
        console.error("Could not load officer assigned year levels:", error);
        setAssignedYearLevels([]);
        setAssignedYearLevelsError(error.response?.data?.error || "Could not load your assigned year levels. Please refresh and try again.");
      } finally {
        if (active) setAssignedYearLevelsLoading(false);
      }
    };
    loadAssignedYearLevels();
    return () => { active = false; };
  }, []);

  // Arrow keys move between tabs (standard tablist behaviour)
  const handleTabKeyDown = (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const index = tabItems.findIndex(t => t.key === activeTab);
    const next = (index + (e.key === 'ArrowRight' ? 1 : -1) + tabItems.length) % tabItems.length;
    setActiveTab(tabItems[next].key);
    document.getElementById(`or-tab-${tabItems[next].key}`)?.focus();
  };

  const yearLevelsPending = assignedYearLevelsLoading || Boolean(assignedYearLevelsError);

  return (
    <div className="or-page" style={{ ...body, background: BG }}>
      <style>{`
        .or-page { width: 100%; min-height: 100vh; overflow-x: hidden; box-sizing: border-box; padding: 16px 16px 48px; }
        @media (min-width: 640px) { .or-page { padding: 24px 24px 48px; } }
        @media (min-width: 1024px) { .or-page { padding: 32px 32px 48px; } }

        .or-tab { transition: background-color 150ms ease, color 150ms ease; }
        .or-tab:hover:not([aria-selected="true"]) { background: ${BG}; }
        .or-tab:focus-visible { outline: 2px solid ${GOLD}; outline-offset: 2px; }

        @media (prefers-reduced-motion: reduce) {
          .or-page * { transition: none !important; }
        }
      `}</style>

      <div className="flex flex-col gap-5">

        {/* ── Page header — same layout as Announcements, Dashboard, Manual Validation and Task Assignment ── */}
        <header
          className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"
          style={{ ...card, padding: 'clamp(14px, 3vw, 20px)' }}
        >
          <div className="min-w-0">
            <p style={{ ...body, fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: GOLD }}>
              Officer Portal
            </p>
            <h1 style={{ ...display, fontSize: 'clamp(1.6rem, 4vw, 2rem)', fontWeight: 700, color: PRIMARY, lineHeight: 1.15, marginTop: 3 }}>
              Reports &amp; Analytics
            </h1>
            <p style={{ ...body, fontSize: '0.9rem', color: MUTED, marginTop: 6, lineHeight: 1.55 }}>
              View submission summaries and generate reports for your assigned scholars.
            </p>
          </div>
        </header>

        {/* ── Section switcher: one segmented card instead of two big tiles ── */}
        <nav aria-label="Report sections">
          <div
            role="tablist"
            aria-label="Report sections"
            onKeyDown={handleTabKeyDown}
            className="grid grid-cols-1 gap-1.5 md:grid-cols-2"
            style={{ ...card, padding: 6 }}
          >
            {tabItems.map(({ key, label, sub, Icon }) => {
              const isActive = activeTab === key;
              return (
                <button
                  key={key}
                  id={`or-tab-${key}`}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={`or-panel-${key}`}
                  tabIndex={isActive ? 0 : -1}
                  onClick={() => setActiveTab(key)}
                  className="or-tab flex min-w-0 items-center gap-3.5 text-left"
                  style={{
                    padding: '12px 14px',
                    borderRadius: 12,
                    border: 'none',
                    background: isActive ? PRIMARY : 'transparent',
                    cursor: 'pointer',
                  }}
                >
                  <span
                    className="flex flex-shrink-0 items-center justify-center rounded-full"
                    style={{ width: 38, height: 38, background: isActive ? 'rgba(255,255,255,0.16)' : `${PRIMARY}0F`, color: isActive ? '#fff' : PRIMARY }}
                  >
                    <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block" style={{ ...display, fontSize: '0.98rem', fontWeight: 700, color: isActive ? '#fff' : INK }}>{label}</span>
                    <span className="mt-0.5 block" style={{ ...body, fontSize: '0.74rem', color: isActive ? '#EBD9E0' : MUTED }}>{sub}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </nav>

        {/* ── Content ── */}
        <div style={{ minWidth: 0 }}>
          {assignedYearLevelsError && (
            <div
              role="alert"
              className="mb-4 flex items-start gap-2.5"
              style={{ borderRadius: 12, padding: '12px 14px', border: `1px solid ${DANGER}35`, background: `${DANGER}0d`, color: DANGER, ...body, fontSize: '0.82rem', fontWeight: 600 }}
            >
              <AlertTriangle size={15} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
              <span>{assignedYearLevelsError}</span>
            </div>
          )}

          {activeTab === "compliance" && (
            <div role="tabpanel" id="or-panel-compliance" aria-labelledby="or-tab-compliance">
              <SubmissionRecordsTab assignedYearLevels={assignedYearLevels} assignedYearLevelsLoading={yearLevelsPending} />
            </div>
          )}

          {activeTab === "monthly-reports" && (
            <div role="tabpanel" id="or-panel-monthly-reports" aria-labelledby="or-tab-monthly-reports">
              <MonthlyReportsTab assignedYearLevels={assignedYearLevels} assignedYearLevelsLoading={yearLevelsPending} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}