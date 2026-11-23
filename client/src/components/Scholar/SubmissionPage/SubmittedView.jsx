import React, { useMemo } from 'react';
import {
    CheckCircle,
    Check,
    FileText,
    Calendar,
    User,
    Hash,
    GraduationCap,
    BookOpen,
    Building2,
    Mail,
    Eye,
    ShieldCheck,
    Bell,
    History,
    Image as ImageIcon,
    ListChecks,
    AlertCircle,
} from 'lucide-react';

// ── Design tokens — shared Apple Scholar Portal system (same as Submission.jsx) ──
const BG = '#F7F4EE';
const SURFACE = '#FFFDF9';
const BORDER = '#E7D8C7';
const PRIMARY = '#6D2140';
const PRIMARY_DEEP = '#4A1730';
const GOLD = '#B98B4E';
const SUCCESS = '#6B8F71';
const SUCCESS_DEEP = '#3F6B4A';
const DANGER = '#C1666B';
const DANGER_DEEP = '#8F3F44';
const INK = '#241512';
const MUTED = '#8A7A68';
const RADIUS = 18;

const display = { fontFamily: "'Playfair Display', Georgia, 'Times New Roman', serif" };
const sans = { fontFamily: "'Inter', 'Segoe UI', -apple-system, sans-serif" };

const STAGES = [
    { key: 'submitted', label: 'Submitted' },
    { key: 'officer', label: 'Officer Review', short: 'Review' },
    { key: 'approved', label: 'Approved' },
    { key: 'completed', label: 'Completed' },
];

const formatTimestamp = (value) => {
    if (!value) return '';
    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? ''
        : date.toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' });
};

// Standard card shell (responsive padding)
const Card = ({ children, className = '', style }) => (
    <section
        className={`min-w-0 w-full ${className}`}
        style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: RADIUS, ...style }}
    >
        {children}
    </section>
);

// Section header: icon chip + serif title (+ optional right slot)
const SectionHeader = ({ icon: Icon, title, right }) => (
    <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
            <span
                className="flex items-center justify-center flex-shrink-0"
                style={{ width: 34, height: 34, borderRadius: 10, background: `${PRIMARY}14` }}
            >
                <Icon size={16} style={{ color: PRIMARY }} strokeWidth={1.9} />
            </span>
            <h2 style={{ ...display, fontWeight: 600, color: INK, lineHeight: 1.25 }} className="text-[1.05rem] sm:text-[1.15rem]">
                {title}
            </h2>
        </div>
        {right}
    </div>
);

const SubmittedView = ({ info, body: letterBody, media, record, statusError, onNew, onViewHistory }) => {
    const now = useMemo(
        () => record?.submitted_at ? new Date(record.submitted_at) : new Date(),
        [record?.submitted_at]
    );
    const dateStr = now.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
    const submissionId = record?.id ? `ASP-${record.id}` : 'Pending';
    const status = String(record?.status || 'pending').trim().toLowerCase();
    const isReturned = ['returned', 'rejected', 'needs_revision', 'needs-revision'].includes(status);
    const isApproved = status === 'approved';
    const isCompleted = Boolean(record?.finalized_at);
    const currentStageIndex = isReturned ? 1 : isCompleted ? 3 : isApproved ? 2 : 1;
    const statusLabel = isReturned
        ? 'Returned for Revision'
        : isCompleted
            ? 'Completed'
            : isApproved
                ? 'Approved'
                : status === 'under_review'
                    ? 'Officer Review in Progress'
                    : 'Awaiting Officer Review';
    const headline = isReturned
        ? 'Revisions Requested'
        : isCompleted
            ? 'Monthly Report Completed'
            : isApproved
                ? 'Monthly Report Approved'
                : 'Monthly Report Received';
    const heroStart = isReturned ? DANGER : SUCCESS_DEEP;
    const heroEnd = isReturned ? DANGER_DEEP : '#2F5238';
    const heroEyebrow = isReturned ? 'ACTION REQUIRED' : isCompleted ? 'REVIEW COMPLETE' : 'SUCCESSFULLY SUBMITTED';
    const HeroIcon = isReturned ? AlertCircle : CheckCircle;
    const nextSteps = isReturned
        ? [
            { icon: Eye, text: 'Review your officer’s feedback in Submission History.' },
            { icon: History, text: 'Use “Resubmit this item” after making the requested corrections.' },
        ]
        : isCompleted
            ? [
                { icon: ShieldCheck, text: 'Your report has completed review and is finalized.' },
                { icon: History, text: 'You can find this record any time in Submission History.' },
            ]
            : isApproved
                ? [
                    { icon: ShieldCheck, text: 'Your Officer approved this report.' },
                    { icon: Bell, text: 'It is now available in Officer Reports and the Admin Overall Report.' },
                    { icon: History, text: 'You can follow the latest status in Submission History.' },
                ]
                : [
                    { icon: Eye, text: 'Your report is waiting for Officer review.' },
                    { icon: Bell, text: 'The status will update here as your report moves through review.' },
                    { icon: History, text: 'You can also follow it in Submission History.' },
                ];

    const paragraphs = letterBody.split(/\n\n+/).filter((p) => p.trim());
    const wordCount = letterBody.trim().split(/\s+/).filter(Boolean).length;

    const scholarFields = [
        { label: 'Name', value: info.name, icon: User },
        { label: 'Age', value: info.age ? `${info.age} years old` : '', icon: Hash },
        { label: 'Year Level', value: info.year, icon: GraduationCap },
        { label: info.track_strand ? 'Track / Strand' : 'Course', value: info.track_strand || info.course, icon: BookOpen },
        { label: 'School', value: info.school, icon: Building2 },
        { label: 'Date', value: info.date, icon: Calendar },
    ];

    const summaryCards = [
        { label: 'Submission Date', value: formatTimestamp(record?.submitted_at) || `${dateStr} · ${timeStr}` },
        { label: 'Semester', value: info.semester || '—' },
        { label: 'Document Type', value: 'Monthly Report' },
        { label: 'Current Status', value: statusLabel },
    ];

    return (
        <div className="w-full min-w-0 mx-auto space-y-3 sm:space-y-5" style={{ ...sans, maxWidth: 920 }}>

            {/* 1. Success hero */}
            <div
                className="flex items-center justify-between gap-4 p-5 sm:p-8"
                style={{
                    background: `linear-gradient(120deg, ${heroStart} 0%, ${heroEnd} 100%)`,
                    borderRadius: RADIUS,
                }}
            >
                <div className="min-w-0">
                    <p style={{ ...sans, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em', color: '#E3F1E6', marginBottom: 6 }}>
                        {heroEyebrow}
                    </p>
                    <h1 style={{ ...display, fontWeight: 700, color: '#fff', lineHeight: 1.2, marginBottom: 10 }} className="text-[1.35rem] sm:text-[1.7rem]">
                        {headline}
                    </h1>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                        <span style={{ ...sans, fontSize: '0.78rem', color: '#F1FAF3', fontWeight: 600 }}>Receipt {submissionId}</span>
                        <span style={{ ...sans, fontSize: '0.78rem', color: '#E3F1E6' }}>{dateStr} · {timeStr}</span>
                    </div>
                </div>
                <div
                    className="flex items-center justify-center flex-shrink-0 w-12 h-12 sm:w-[76px] sm:h-[76px]"
                    style={{ borderRadius: '50%', background: 'rgba(255,255,255,0.16)' }}
                >
                    <HeroIcon className="w-7 h-7 sm:w-10 sm:h-10" style={{ color: '#fff' }} strokeWidth={1.75} />
                </div>
            </div>

            {/* 2. Tracking progress */}
            <Card className="p-4 sm:p-6">
                <p style={{ ...sans, fontSize: '0.82rem', fontWeight: 700, color: PRIMARY, marginBottom: 16, lineHeight: 1.45 }}>
                    {statusLabel}
                    {record?.updated_at && <span style={{ color: MUTED, fontWeight: 500 }}>{` · Updated ${formatTimestamp(record.updated_at)}`}</span>}
                </p>
                <ol className="flex items-start">
                    {STAGES.map((stage, i) => {
                        const isDone = i < currentStageIndex;
                        const isCurrent = i === currentStageIndex;
                        const isActive = isDone || isCurrent;
                        const isReturnedStage = isReturned && isCurrent;
                        const stageColor = isReturnedStage ? DANGER : SUCCESS;
                        const label = isReturnedStage ? 'Returned' : stage.label;
                        return (
                            <li key={stage.key} className="flex-1 min-w-0 flex flex-col items-center" style={{ position: 'relative' }}>
                                {i < STAGES.length - 1 && (
                                    <span
                                        aria-hidden="true"
                                        style={{
                                            position: 'absolute', top: 11, left: '50%', width: '100%', height: 2,
                                            background: i < currentStageIndex ? SUCCESS : BORDER, zIndex: 0,
                                        }}
                                    />
                                )}
                                <span
                                    className="flex items-center justify-center"
                                    style={{
                                        width: 24, height: 24, borderRadius: '50%', position: 'relative', zIndex: 1,
                                        background: isActive ? stageColor : SURFACE,
                                        border: `2px solid ${isActive ? stageColor : BORDER}`,
                                        boxShadow: isCurrent ? `0 0 0 4px ${stageColor}26` : 'none',
                                    }}
                                >
                                    {isDone && <Check size={13} color="#fff" strokeWidth={3} />}
                                </span>
                                <span
                                    className="px-0.5"
                                    style={{
                                        ...sans, fontSize: '0.7rem', lineHeight: 1.3, textAlign: 'center', marginTop: 8,
                                        fontWeight: isCurrent ? 700 : 500,
                                        color: isReturnedStage ? DANGER : isActive ? INK : MUTED,
                                    }}
                                >
                                    {label}
                                </span>
                            </li>
                        );
                    })}
                </ol>
                {isReturned && record?.officer_comment && (
                    <div style={{ marginTop: 18, borderLeft: `3px solid ${DANGER}`, background: `${DANGER}0d`, borderRadius: '0 12px 12px 0', padding: '10px 14px' }}>
                        <p style={{ ...sans, fontSize: '0.68rem', fontWeight: 700, color: DANGER, marginBottom: 3, letterSpacing: '0.04em' }}>OFFICER FEEDBACK</p>
                        <p style={{ ...sans, fontSize: '0.84rem', lineHeight: 1.55, color: INK, wordBreak: 'break-word' }}>{record.officer_comment}</p>
                    </div>
                )}
                {statusError && (
                    <p role="status" style={{ ...sans, fontSize: '0.76rem', color: MUTED, marginTop: 14, lineHeight: 1.5 }}>
                        {statusError}
                    </p>
                )}
            </Card>

            {/* 3. Submission summary */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
                {summaryCards.map((item) => (
                    <div key={item.label} className="min-w-0 p-3.5 sm:p-4" style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: RADIUS }}>
                        <p style={{ ...sans, fontSize: '0.7rem', color: MUTED, marginBottom: 4 }}>{item.label}</p>
                        <p style={{ ...sans, fontSize: '0.9rem', fontWeight: 700, color: INK, lineHeight: 1.35, wordBreak: 'break-word' }}>{item.value}</p>
                    </div>
                ))}
            </div>

            {/* 4. Scholar information */}
            <Card className="p-4 sm:p-6">
                <SectionHeader icon={User} title="Scholar Information" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-4">
                    {scholarFields.map((field) => (
                        <div key={field.label} className="flex items-center gap-3 min-w-0">
                            <span
                                className="flex items-center justify-center flex-shrink-0"
                                style={{ width: 36, height: 36, borderRadius: 10, background: `${PRIMARY}0f` }}
                            >
                                <field.icon className="w-4 h-4" style={{ color: PRIMARY }} strokeWidth={1.75} />
                            </span>
                            <div className="min-w-0">
                                <p style={{ ...sans, fontSize: '0.68rem', color: MUTED }}>{field.label}</p>
                                <p style={{ ...sans, fontSize: '0.9rem', fontWeight: 600, color: INK, wordBreak: 'break-word' }}>{field.value || '—'}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </Card>

            {/* 5. Monthly letter */}
            <Card style={{ overflow: 'hidden' }}>
                <div
                    className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3.5"
                    style={{ borderBottom: `1px solid ${BORDER}`, background: BG }}
                >
                    <div className="flex items-center gap-2.5 min-w-0">
                        <Mail className="w-4 h-4 flex-shrink-0" style={{ color: PRIMARY }} strokeWidth={1.75} />
                        <h2 style={{ ...display, fontWeight: 600, color: INK }} className="text-[1.05rem] sm:text-[1.15rem]">Monthly Letter</h2>
                    </div>
                    <span style={{ ...sans, fontSize: '0.72rem', fontWeight: 600, color: MUTED, whiteSpace: 'nowrap' }}>{wordCount} words</span>
                </div>
                <div className="px-4 sm:px-10 py-6 sm:py-9 mx-auto" style={{ maxWidth: 680 }}>
                    <p style={{ ...sans, fontSize: '0.92rem', lineHeight: 1.8, color: '#3f2f28', marginBottom: 18 }}>
                        Dear Kalinga,
                    </p>
                    {paragraphs.map((para, i) => (
                        <p key={i} style={{ ...sans, fontSize: '0.92rem', lineHeight: 1.8, color: '#3f2f28', marginBottom: 16, wordBreak: 'break-word' }}>
                            {para.trim()}
                        </p>
                    ))}
                    <p style={{ ...sans, fontSize: '0.92rem', lineHeight: 1.8, color: '#3f2f28', marginTop: 24, marginBottom: 4 }}>
                        Your scholar,
                    </p>
                    <p style={{ ...display, fontSize: '1rem', fontWeight: 700, color: INK, wordBreak: 'break-word' }}>
                        {info.name}
                    </p>
                </div>
            </Card>

            {/* 6. Documentation gallery */}
            {media.length > 0 && (
                <Card className="p-4 sm:p-6">
                    <SectionHeader
                        icon={ImageIcon}
                        title="Documentation"
                        right={<span style={{ ...sans, fontSize: '0.72rem', fontWeight: 600, color: MUTED, whiteSpace: 'nowrap' }}>{media.length} photo{media.length > 1 ? 's' : ''}</span>}
                    />
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-5">
                        {media.map((item, i) => (
                            <figure key={item.id} className="min-w-0">
                                <div
                                    className="overflow-hidden"
                                    style={{ aspectRatio: '4 / 3', borderRadius: 14, border: `1px solid ${BORDER}`, background: BG }}
                                >
                                    <img
                                        src={item.previewUrl}
                                        alt={item.description || `Documentation ${i + 1}`}
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                                <figcaption className="flex items-start justify-between gap-2" style={{ marginTop: 8 }}>
                                    <span style={{ ...sans, fontSize: '0.76rem', color: '#3f2f28', lineHeight: 1.4, wordBreak: 'break-word', minWidth: 0 }}>
                                        {item.description || `Documentation ${i + 1}`}
                                    </span>
                                    <span style={{ ...sans, fontSize: '0.68rem', color: MUTED, flexShrink: 0 }}>{i + 1}/{media.length}</span>
                                </figcaption>
                            </figure>
                        ))}
                    </div>
                </Card>
            )}

            {/* 7. Next steps */}
            <Card className="p-4 sm:p-6">
                <SectionHeader icon={ListChecks} title="What happens next?" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {nextSteps.map((step, i) => (
                        <div key={i} className="flex items-start gap-3 min-w-0">
                            <span
                                className="flex items-center justify-center flex-shrink-0"
                                style={{ width: 34, height: 34, borderRadius: 10, background: `${SUCCESS}1f` }}
                            >
                                <step.icon className="w-4 h-4" style={{ color: SUCCESS_DEEP }} strokeWidth={1.75} />
                            </span>
                            <p style={{ ...sans, fontSize: '0.86rem', lineHeight: 1.55, color: '#3f2f28', paddingTop: 6 }}>
                                {step.text}
                            </p>
                        </div>
                    ))}
                </div>
            </Card>

            {/* 8. Bottom actions — stacked on phones, side by side from sm */}
            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2.5 pb-2">
                <button
                    onClick={onViewHistory}
                    className="flex items-center justify-center gap-2 w-full sm:w-auto transition-opacity hover:opacity-80"
                    style={{
                        padding: '12px 22px', minHeight: 46, borderRadius: 999,
                        ...sans, fontSize: '0.86rem', fontWeight: 600,
                        background: SURFACE, color: PRIMARY, border: `1.5px solid ${PRIMARY}66`, cursor: 'pointer',
                    }}
                >
                    <History className="w-4 h-4" /> View Submission History
                </button>
                <button
                    onClick={onNew}
                    className="flex items-center justify-center gap-2 w-full sm:w-auto transition-opacity hover:opacity-90"
                    style={{
                        padding: '12px 22px', minHeight: 46, borderRadius: 999,
                        ...sans, fontSize: '0.86rem', fontWeight: 600,
                        background: `linear-gradient(120deg, ${PRIMARY} 0%, ${PRIMARY_DEEP} 100%)`,
                        color: '#fff', border: 'none', cursor: 'pointer',
                    }}
                >
                    <FileText className="w-4 h-4" /> New Submission
                </button>
            </div>
        </div>
    );
};

export default SubmittedView;