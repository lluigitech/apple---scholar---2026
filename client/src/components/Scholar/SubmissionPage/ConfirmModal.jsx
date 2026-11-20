import { CheckCircle2, XCircle, AlertCircle, Send, Loader2 } from 'lucide-react';

// ── Scholar Portal design system ──
// Same tokens as the rest of the Scholar module (dashboard, submissions,
// duty & participation, etc.) so this modal doesn't clash with the page
// that opens it.
const BG = '#F7F4EE';
const SURFACE = '#FFFDF9';
const BORDER = '#E7D8C7';
const PRIMARY = '#6D2140';
const PRIMARY_DARK = '#4A1730';
const BRONZE = '#A9784E';
const SUCCESS = '#6B8F71';
const DANGER = '#C0473F';
const INK = '#241512';
const MUTED = '#8A7A68';
const RADIUS = 18;

const display = { fontFamily: "'Playfair Display', Georgia, serif" };
const body = { fontFamily: "'Inter', -apple-system, 'Segoe UI', sans-serif" };

const outlineBtn = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px 18px', border: `1px solid ${BORDER}`, borderRadius: 12, background: SURFACE, color: INK, ...body, fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' };
const filledBtn = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px 18px', border: 'none', borderRadius: 12, background: `linear-gradient(135deg, ${PRIMARY} 0%, ${PRIMARY_DARK} 100%)`, color: '#fff', ...body, fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' };

const ConfirmModal = ({ ev, submitting, submitError, onCancel, onConfirm }) => {
    const failedItems = ev.checklist.filter(c => !c.passed);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(36,21,18,0.55)' }}>
            <div className="w-full max-w-lg overflow-hidden" style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: RADIUS, boxShadow: '0 24px 48px -20px rgba(36,21,18,0.5)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
                {/* ── 1. Premium header ── */}
                <div style={{ height: 4, background: `linear-gradient(90deg, ${PRIMARY} 0%, ${BRONZE} 100%)`, flexShrink: 0 }} />
                <div className="p-5 sm:p-6 pb-4" style={{ flexShrink: 0 }}>
                    <p style={{ ...body, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em', color: BRONZE }}>REPORT REVIEW</p>
                    <h3 style={{ ...display, fontSize: '1.3rem', fontWeight: 600, color: INK, marginTop: 4 }}>Review Before Submission</h3>
                    <p style={{ ...body, fontSize: '0.8rem', color: MUTED, marginTop: 4 }}>
                        {ev.flagged
                            ? 'This letter was flagged as invalid and cannot be submitted.'
                            : 'Check your report details before sending it to your officer for review.'}
                    </p>
                </div>

                <div className="px-5 sm:px-6 overflow-y-auto" style={{ flex: 1 }}>
                    <div style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: RADIUS, padding: '16px 18px', marginBottom: 16 }}>
                        <p style={{ ...body, fontSize: '0.82rem', fontWeight: 600, color: INK }}>
                            {ev.flagged ? 'Please revise the letter before submitting.' : 'Your officer will review the report after submission.'}
                        </p>
                    </div>

                    {ev.sentimentLabel && (
                        <div style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: RADIUS, padding: 14, marginBottom: 16 }}>
                            <p style={{ ...body, fontSize: '0.72rem', fontWeight: 700, color: PRIMARY, marginBottom: 6 }}>LETTER CLASSIFICATION</p>
                            <p style={{ ...body, fontSize: '0.76rem', color: MUTED }}>Sentiment: {ev.sentimentLabel}</p>
                        </div>
                    )}

                    {/* ── 4. Improvement checklist ── */}
                    <div style={{ background: failedItems.length ? `${DANGER}0a` : `${SUCCESS}0d`, border: `1px solid ${failedItems.length ? `${DANGER}33` : `${SUCCESS}33`}`, borderRadius: RADIUS, padding: '16px 18px', marginBottom: 16 }}>
                        {failedItems.length === 0 ? (
                            <div className="flex items-center gap-2.5">
                                <CheckCircle2 size={18} style={{ color: SUCCESS, flexShrink: 0 }} />
                                <div>
                                    <p style={{ ...body, fontSize: '0.82rem', fontWeight: 600, color: SUCCESS }}>Everything checks out</p>
                                    <p style={{ ...body, fontSize: '0.76rem', color: SUCCESS, marginTop: 2 }}>All checklist requirements are satisfied.</p>
                                </div>
                            </div>
                        ) : (
                            <>
                                <p style={{ ...body, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.05em', color: DANGER, marginBottom: 10 }}>IMPROVEMENT CHECKLIST</p>
                                <div className="space-y-2">
                                    {failedItems.map(c => (
                                        <div key={c.item.id} className="flex items-start gap-2.5">
                                            <XCircle size={15} style={{ color: DANGER, flexShrink: 0, marginTop: 1 }} />
                                            <div className="min-w-0">
                                                <p style={{ ...body, fontSize: '0.8rem', fontWeight: 600, color: INK }}>{c.item.label}</p>
                                                <p style={{ ...body, fontSize: '0.72rem', color: MUTED, marginTop: 1 }}>
                                                    {ev.flagged ? 'Address this before resubmitting.' : 'Your officer may ask you to address this.'}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>

                    {/* ── 5. Error callout ── */}
                    {submitError && (
                        <div className="mb-4 flex items-start gap-2.5" style={{ borderLeft: `3px solid ${DANGER}`, background: `${DANGER}0d`, borderRadius: '0 12px 12px 0', padding: '11px 14px' }}>
                            <AlertCircle size={16} style={{ color: DANGER, flexShrink: 0, marginTop: 1 }} />
                            <p style={{ ...body, fontSize: '0.78rem', color: DANGER }}>{submitError}</p>
                        </div>
                    )}
                </div>

                {/* ── 6. Footer actions ── */}
                <div className="p-5 sm:p-6 pt-4 flex gap-3" style={{ flexShrink: 0, borderTop: `1px solid ${BG}` }}>
                    <button onClick={onCancel} disabled={submitting} className="flex-1 transition-opacity hover:opacity-80 disabled:opacity-50" style={outlineBtn}>
                        Back &amp; Edit
                    </button>
                    {!ev.flagged && (
                        <button onClick={onConfirm} disabled={submitting} className="flex-1 transition-opacity hover:opacity-85 disabled:opacity-60"
                            style={{ ...filledBtn, cursor: submitting ? 'not-allowed' : 'pointer' }}>
                            {submitting ? <><Loader2 size={16} className="animate-spin" /> Submitting…</> : <><Send size={16} /> Submit Report</>}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ConfirmModal;