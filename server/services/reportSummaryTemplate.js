const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const buildReportSummaryHTML = ({
  logoBase64,
  roleLabel,
  reportTitle,
  reportType,
  periodLabel,
  rows = [],
  certifiedByName,
  endorsedTo = [],
}) => {
  const safeRoleLabel = escapeHtml(roleLabel);
  const safeReportTitle = reportTitle
    ? escapeHtml(reportTitle)
    : `Summary of ${safeRoleLabel} reports`;
  const detailRows = rows.filter(row => row.scholarName);
  const isMonthlyReport = String(reportType || '').toLowerCase() === 'monthly letter';
  const isMonthlyLetterReview = String(reportType || '').toLowerCase() === 'monthly letter review';
  const isSubmissionRecords = String(reportType || '').toLowerCase() === 'submission records';
  const isTaskCompletion = String(reportType || '').toLowerCase() === 'task completion';
  const isAttendanceReport = String(reportType || '').toLowerCase() === 'attendance reports'
    || detailRows.some(row => row.attendanceStatus || row.attendanceDate || row.attendanceTime);
  const isComplianceSummary = String(reportType || '').toLowerCase() === 'compliance summary'
    || detailRows.some(row => row.riskStatus || String(row.compliance || '').toLowerCase().includes('credits'));
  const isExportReport = (
    String(reportType || '').toLowerCase() === 'export reports'
    || detailRows.some(row => row.requirement || row.deadline || row.approvedAt || row.approved_at)
  ) && !isSubmissionRecords && !isMonthlyLetterReview && !isTaskCompletion && !isAttendanceReport && !isComplianceSummary;
  const totalScholars = detailRows.length;
  const submittedScholars = detailRows.filter(row => isExportReport
    ? row.reviewStatus !== 'Not Submitted'
    : row.submitted > 0);
  const missingScholars = detailRows.filter(row => isExportReport
    ? row.reviewStatus === 'Not Submitted'
    : row.submitted === 0).map(row => row.scholarName);
  const taskTotals = detailRows.reduce((totals, row) => ({
    assigned: totals.assigned + Number(row.assigned || 0),
    completed: totals.completed + Number(row.approved || 0),
    missing: totals.missing + Number(row.missing || 0),
    pending: totals.pending + Number(row.pending || 0),
  }), { assigned: 0, completed: 0, missing: 0, pending: 0 });
  const formatDate = value => value ? new Date(value).toLocaleDateString('en-PH') : '—';
  const formatDateTime = value => value ? new Date(value).toLocaleString('en-PH') : '—';
  const formatYearLevel = value => String(value || '—').replace(/[_-]+/g, ' ').replace(/\b\w/g, character => character.toUpperCase());
  const normalizeReviewStatus = value => String(value || '').trim().toLowerCase();
  const submissionRecordPillClass = value => {
    const status = normalizeReviewStatus(value);
    return status === 'accepted' ? 'pill-good' : status === 'pending' ? 'pill-late' : 'pill-bad';
  };
  const submissionRecordAcceptedCount = isSubmissionRecords
    ? detailRows.filter(row => normalizeReviewStatus(row.reviewStatus) === 'accepted').length
    : 0;
  const submissionRecordPendingCount = isSubmissionRecords
    ? detailRows.filter(row => normalizeReviewStatus(row.reviewStatus) === 'pending').length
    : 0;
  const submissionRecordMissingCount = isSubmissionRecords
    ? detailRows.filter(row => normalizeReviewStatus(row.reviewStatus) === 'not submitted').length
    : 0;
  const submissionRecordMissingNames = isSubmissionRecords
    ? detailRows.filter(row => normalizeReviewStatus(row.reviewStatus) === 'not submitted').map(row => row.scholarName)
    : [];
  const submissionRecordRows = isSubmissionRecords ? detailRows.map(row => `
      <tr>
        <td>${escapeHtml(row.scholarName)}</td>
        <td class="nowrap">${escapeHtml(row.studentId || '—')}</td>
        <td>${escapeHtml(formatYearLevel(row.yearLevel))}</td>
        <td>${escapeHtml(row.requirement || '—')}</td>
        <td>${escapeHtml(row.period || '—')}</td>
        <td>${escapeHtml(formatDate(row.submittedAt))}</td>
        <td><span class="status-pill ${submissionRecordPillClass(row.reviewStatus)}">${escapeHtml(String(row.reviewStatus || '—').trim())}</span></td>
      </tr>`).join('') : '';
  const monthlyLetterReviewRows = isMonthlyLetterReview ? detailRows.map(row => `
      <tr>
        <td>${escapeHtml(row.scholarName)}</td>
        <td>${escapeHtml(row.studentId || '—')}</td>
        <td>${escapeHtml(formatYearLevel(row.yearLevel))}</td>
        <td>${escapeHtml(row.qualityScore ?? '—')}</td>
        <td>${escapeHtml(row.sentiment || '—')}</td>
        <td>${escapeHtml(formatDate(row.submittedAt))}</td>
      </tr>`).join('') : '';
  const attendanceRows = isAttendanceReport ? detailRows.map(row => `
      <tr>
        <td>${escapeHtml(row.scholarName || '—')}</td>
        <td class="nowrap">${escapeHtml(row.studentId || '—')}</td>
        <td>${escapeHtml(row.groupName || 'Unassigned')}</td>
        <td>${escapeHtml(row.assignedStaff || 'Unassigned')}</td>
        <td>${escapeHtml(row.duty || '—')}</td>
        <td>${escapeHtml(formatDateTime(row.attendanceTime))}</td>
        <td>${(() => {
          const status = String(row.attendanceStatus || '').toLowerCase();
          const pillClass = status === 'present' ? 'pill-good' : status === 'late' ? 'pill-late' : 'pill-bad';
          return `<span class="pill ${pillClass}">${escapeHtml(row.attendanceStatus || '—')}</span>`;
        })()}</td>
      </tr>`).join('') : '';
  const attendancePresentCount = isAttendanceReport
    ? detailRows.filter(row => String(row.attendanceStatus).toLowerCase() === 'present').length
    : 0;
  const attendanceLateCount = isAttendanceReport
    ? detailRows.filter(row => String(row.attendanceStatus).toLowerCase() === 'late').length
    : 0;
  const attendanceAbsentCount = isAttendanceReport
    ? detailRows.filter(row => String(row.attendanceStatus).toLowerCase() === 'absent').length
    : 0;
  const renderExportRows = exportRows => exportRows.map(row => `
      <tr>
        <td>${escapeHtml(row.scholarName)}</td>
        <td>${escapeHtml(row.studentId || '—')}</td>
        <td>${escapeHtml(row.requirement || '—')}</td>
        <td>${escapeHtml(formatDate(row.deadline))}</td>
        <td>${escapeHtml(formatDate(row.submittedAt))}</td>
        <td>${escapeHtml(formatDate(row.approvedAt))}</td>
        <td><span class="status-pill ${normalizeReviewStatus(row.reviewStatus) === 'pending' ? 'pill-late' : row.reviewStatus === 'Not Submitted' ? 'muted' : 'good'}">${escapeHtml(row.reviewStatus || 'Not Submitted')}</span></td>
      </tr>`).join('');
  const exportGroups = isExportReport ? (() => {
    const monthGroups = new Map();
    detailRows.forEach(row => {
      const dateValue = row.submittedAt || row.deadline;
      const date = dateValue ? new Date(dateValue) : null;
      const monthKey = date && !Number.isNaN(date.getTime())
        ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        : 'unknown';
      const monthLabel = date && !Number.isNaN(date.getTime())
        ? date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
        : 'No Date';
      const requirement = row.requirement || 'Other Documents';
      if (!monthGroups.has(monthKey)) monthGroups.set(monthKey, { monthKey, monthLabel, types: new Map() });
      const monthGroup = monthGroups.get(monthKey);
      if (!monthGroup.types.has(requirement)) monthGroup.types.set(requirement, []);
      monthGroup.types.get(requirement).push(row);
    });
    return [...monthGroups.values()]
      .sort((a, b) => b.monthKey.localeCompare(a.monthKey))
      .flatMap(monthGroup => [...monthGroup.types.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([requirement, groupedRows]) => ({
          title: `${monthGroup.monthLabel} — ${requirement}`,
          rows: groupedRows.sort((a, b) => new Date(b.submittedAt || b.deadline || 0) - new Date(a.submittedAt || a.deadline || 0)),
        })));
  })() : [];
  const exportBreakdown = isExportReport ? exportGroups.map(group => {
    const submitted = group.rows.filter(row => row.reviewStatus !== 'Not Submitted').length;
    return `<div><span class="summary-label">${escapeHtml(group.title)}</span><strong>${submitted}/${group.rows.length}</strong><span class="breakdown-detail">${submitted ? `${submitted} accepted` : 'Not Submitted'}${group.rows.length - submitted ? ` · ${group.rows.length - submitted} not submitted` : ''}</span></div>`;
  }).join('') : '';
  const complianceRows = isComplianceSummary && detailRows.length ? detailRows.map((row) => {
    const riskText = String(row.riskStatus || 'low').replace(/-/g, ' ');
    const label = riskText.charAt(0).toUpperCase() + riskText.slice(1);
    return `
      <tr>
        <td>${escapeHtml(row.scholarName)}</td>
        <td>${escapeHtml(row.studentId || '—')}</td>
        <td class="compliance">${escapeHtml(row.compliance || '0 Credits')}</td>
        <td class="${String(row.riskStatus || 'low').toLowerCase() === 'low' ? 'muted' : ''}">${escapeHtml(label)}</td>
      </tr>`;
  }).join('') : '';
  const lowRiskCount = isComplianceSummary ? detailRows.filter(row => String(row.riskStatus || 'low').toLowerCase() === 'low').length : 0;
  const highRiskCount = isComplianceSummary ? detailRows.filter(row => String(row.riskStatus || '').toLowerCase() === 'high').length : 0;
  const generatedDate = escapeHtml(new Date().toLocaleDateString('en-PH'));
  const summaryHTML = isExportReport
    ? `<section class="summary summary-breakdown">${exportGroups.map(group => {
        const submitted = group.rows.filter(row => row.reviewStatus !== 'Not Submitted').length;
        const missing = group.rows.length - submitted;
        return `<div class="summary-card" style="border-top-color:var(--bronze)">
          <span class="summary-label">${escapeHtml(group.title)}</span>
          <strong>${submitted}/${group.rows.length}</strong>
          <span class="breakdown-detail">${submitted} accepted${missing ? ` · ${missing} not submitted` : ''}</span>
        </div>`;
      }).join('') || '<div class="summary-card" style="border-top-color:var(--bronze)"><span class="summary-label">REPORT BREAKDOWN</span><strong>0</strong></div>'}</section>`
    : isComplianceSummary
      ? `<section class="summary compliance-summary">
          <div class="summary-card" style="border-top-color:var(--good)"><span class="summary-label">LOW RISK</span><strong>${lowRiskCount}</strong></div>
          <div class="summary-card" style="border-top-color:var(--maroon)"><span class="summary-label">HIGH RISK</span><strong>${highRiskCount}</strong></div>
        </section>`
      : isTaskCompletion
        ? `<section class="summary task-summary">
            <div class="summary-card" style="border-top-color:var(--bronze)"><span class="summary-label">ASSIGNED</span><strong>${taskTotals.assigned}</strong></div>
            <div class="summary-card" style="border-top-color:var(--good)"><span class="summary-label">COMPLETED</span><strong>${taskTotals.completed}</strong></div>
            <div class="summary-card" style="border-top-color:var(--maroon)"><span class="summary-label">MISSING</span><strong>${taskTotals.missing}</strong></div>
            <div class="summary-card" style="border-top-color:var(--bronze)"><span class="summary-label">PENDING</span><strong>${taskTotals.pending}</strong></div>
          </section>`
        : isAttendanceReport
          ? `<section class="summary attendance-summary">
              <div class="summary-card" style="border-top-color:var(--good)"><span class="summary-label">PRESENT</span><strong>${attendancePresentCount}</strong></div>
              <div class="summary-card" style="border-top-color:var(--bronze)"><span class="summary-label">LATE</span><strong>${attendanceLateCount}</strong></div>
              <div class="summary-card" style="border-top-color:var(--maroon)"><span class="summary-label">ABSENT</span><strong>${attendanceAbsentCount}</strong></div>
              <div class="summary-card" style="border-top-color:var(--ink-soft)"><span class="summary-label">TOTAL RECORDS</span><strong>${detailRows.length}</strong></div>
            </section>`
          : isSubmissionRecords
            ? `<section class="summary submission-records-summary">
                <div class="summary-card" style="border-top-color:var(--good)"><span class="summary-label">ACCEPTED</span><strong>${submissionRecordAcceptedCount}</strong></div>
                <div class="summary-card" style="border-top-color:var(--bronze)"><span class="summary-label">PENDING</span><strong>${submissionRecordPendingCount}</strong></div>
                <div class="summary-card" style="border-top-color:var(--maroon)"><span class="summary-label">NOT SUBMITTED</span><strong>${submissionRecordMissingCount}</strong></div>
                <div class="summary-card" style="border-top-color:var(--ink-soft)"><span class="summary-label">TOTAL RECORDS</span><strong>${detailRows.length}</strong></div>
              </section>
              ${submissionRecordMissingNames.length ? `<section class="missing-names-card"><span class="summary-label">SCHOLARS WITHOUT SUBMISSION</span><span>${escapeHtml(submissionRecordMissingNames.join(', ') || 'None')}</span></section>` : ''}`
          : detailRows.length
            ? `<section class="summary">
                <div class="summary-card" style="border-top-color:var(--good)"><span class="summary-label">SUBMITTED</span><strong>${submittedScholars.length}/${totalScholars}</strong></div>
                <div class="summary-card" style="border-top-color:var(--maroon)"><span class="summary-label">NOT SUBMITTED</span><strong>${missingScholars.length}</strong></div>
                <div class="summary-card" style="border-top-color:var(--bronze)"><span class="summary-label">TOTAL</span><strong>${detailRows.length}</strong></div>
              </section>
              ${missingScholars.length ? `<section class="missing-names-card"><span class="summary-label">SCHOLARS WITHOUT SUBMISSION</span><span>${escapeHtml(missingScholars.join(', ') || 'None')}</span></section>` : ''}`
            : '';
  const safeRows = isAttendanceReport
    ? attendanceRows
    : isMonthlyLetterReview
    ? monthlyLetterReviewRows
    : isSubmissionRecords
    ? submissionRecordRows
    : isComplianceSummary
    ? complianceRows || '<tr><td colspan="4" class="empty">No compliance data available</td></tr>'
    : isTaskCompletion ? detailRows.map(row => `
      <tr>
        <td>${escapeHtml(row.scholarName)}</td>
        <td>${escapeHtml(row.studentId || '—')}</td>
        <td>${escapeHtml(row.assigned)}</td>
        <td>${escapeHtml(row.approved)}</td>
        <td class="${row.missing ? '' : 'muted'}">${escapeHtml(row.missing)}</td>
        <td>${escapeHtml(row.pending)}</td>
      </tr>`).join('')
    : !isExportReport && detailRows.length ? detailRows.map((row) => `
      <tr>
        <td>${escapeHtml(row.scholarName)}</td>
        <td>${escapeHtml(row.studentId || '—')}</td>
        <td>${escapeHtml(Array.isArray(row.submissionTypes) && row.submissionTypes.length ? row.submissionTypes.join(', ') : '—')}</td>
        <td><span class="status-pill ${row.submitted > 0 ? 'good' : 'muted'}">${row.submitted > 0 ? 'Submitted' : 'Not Submitted'}</span></td>
        <td>${escapeHtml(row.submitted)}</td>
        ${isMonthlyReport ? `<td>${escapeHtml(row.submittedAt ? new Date(row.submittedAt).toLocaleDateString('en-PH') : '—')}</td><td>${escapeHtml(row.qualityStatus || '—')}</td>` : ''}
        <td>${escapeHtml(row.reviewStatus || (row.submitted > 0 ? 'Pending Review' : 'No Submission'))}</td>
      </tr>`).join('') : rows.map((row) => {
    const missing = Array.isArray(row.missingList) ? row.missingList : [];
    return `
      <tr>
        <td>${escapeHtml(row.batch)}</td>
        <td class="compliance">${escapeHtml(row.compliance)}</td>
        <td class="${missing.length ? '' : 'muted'}">${missing.length ? escapeHtml(missing.join(', ')) : 'None'}</td>
        </tr>`;
  }).join('');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${safeReportTitle}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,600;0,700;1,600&display=swap" rel="stylesheet">
    <style>
      @page { size: A4; margin: 0; }
      :root {
        --cream:#F7F4EE; --surface:#FFFDF9; --sand-row:#F4EBDD; --border:#E7D8C7;
        --maroon:#6D2140; --maroon-deep:#4A1730; --bronze:#A9784E;
        --ink:#241512; --ink-soft:#5C4E42; --good:#2F6B4F;
      }
      * { box-sizing: border-box; }
      html, body { margin: 0; min-height: 100%; }
      body { background: var(--cream); color: var(--ink); font-family: 'Inter', system-ui, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .top-bar { width:100%; height:14px; background: var(--maroon-deep); }
      .page { min-height: 283mm; padding: 10mm 13mm 13mm; display: flex; flex-direction: column; }
      .eyebrow { margin: 0; color: var(--maroon); font-size: 10px; font-weight: 700; letter-spacing: 2.4px; }
      .header { display:flex; justify-content:space-between; align-items:center; padding-top:10mm; }
      .header-copy { min-width:0; }
      h1 { margin: 8px 0 4px; font-family: 'Playfair Display', Georgia, serif; font-size:36px; line-height:1.1; font-weight:700; }
      .period { margin: 10px 0 0; color: var(--maroon); font-family: 'Playfair Display', Georgia, serif; font-size: 16px; font-style: italic; }
      .seal { position:relative; flex-shrink:0; width:84px; height:84px; border:2px solid var(--bronze); border-radius:50%; display:flex; align-items:center; justify-content:center; }
      .seal::before { content:''; position:absolute; inset:3px; border:1px solid var(--bronze); border-radius:50%; }
      .seal img { position:relative; width:60px; height:60px; object-fit:contain; }
      .divider { height:1px; background:var(--bronze); margin:24px 0 0; }
      .export-group { margin: 0 0 10mm; page-break-inside: avoid; }
      .export-group h2 { margin: 0 0 5mm; color: var(--maroon); font-family: 'Playfair Display', Georgia, serif; font-size: 16px; }
      table { width:100%; border-collapse:collapse; table-layout:fixed; font-size:11px; margin-top:28px; border:1px solid var(--border); }
      col.batch { width: 31%; } col.compliance { width: 25%; } col.missing { width: 44%; }
      thead { display: table-header-group; }
      tr { page-break-inside: avoid; break-inside: avoid; }
      th { background:var(--maroon-deep); padding:10px; color:#fff; font-size:9px; font-weight:700; letter-spacing:1.2px; text-align:left; }
      td { padding:12px 10px; border-bottom:1px solid var(--border); vertical-align:top; line-height:1.45; overflow-wrap:anywhere; }
      tbody tr:nth-child(odd) td { background:var(--surface); }
      tbody tr:nth-child(even) td { background:var(--sand-row); }
      td:first-child { font-weight: 700; }
      td.compliance { color: var(--maroon); font-weight: 600; }
      .nowrap { white-space: nowrap; }
      .status-pill { display:inline-block; padding:3px 10px; border-radius:99px; border:1px solid currentColor; font-size:10px; font-weight:700; white-space:nowrap; }
      .status-pill.good, .status-pill.pill-good { color:var(--good); }
      .status-pill.muted { color:var(--maroon); }
      .status-pill.pill-late { color:var(--bronze-dark, #8A5E38); }
      .status-pill.pill-bad { color:var(--maroon); }
      .submission-records-table .status-pill { padding:3px 8px; font-size:9.5px; }
      .submission-records-table td:last-child { padding-right:10px; }
      .pill { display:inline-block; padding:3px 10px; border-radius:99px; border:1px solid currentColor; font-size:10px; font-weight:700; white-space:nowrap; text-transform:capitalize; }
      .pill-good { color:var(--good); }
      .pill-late { color:var(--bronze-dark, #8A5E38); }
      .pill-bad { color:var(--maroon); }
      .empty { color:var(--ink-soft); font-style:italic; text-align:center; }
      .summary { display:flex; gap:16px; margin-top:24px; }
      .summary-card { flex:1; min-width:0; background:var(--surface); border:1px solid var(--border); border-top:3px solid var(--bronze); padding:14px 16px; }
      .attendance-summary, .submission-records-summary { gap:12px; }
      .attendance-summary .summary-card, .submission-records-summary .summary-card { flex:1 1 0; }
      .attendance-table td:last-child { padding-right:10px; }
      .compliance-summary, .task-summary, .summary-breakdown, .attendance-summary { grid-template-columns:none; }
      .breakdown-detail { display:block; color:var(--ink-soft); font-size:9px; line-height:1.4; margin-top:4px; }
      .summary-label { display:block; margin-bottom:4px; color:var(--ink-soft); font-size:9px; font-weight:700; letter-spacing:1.4px; }
      .summary strong { display:block; color:var(--ink); font-family:'Playfair Display', Georgia, serif; font-size:30px; line-height:1; font-weight:700; margin-top:4px; }
      .missing-names-card { width:100%; margin-top:16px; background:var(--surface); border:1px solid var(--border); border-top:3px solid var(--maroon); padding:14px 16px; color:var(--ink); font-size:10px; line-height:1.4; }
      .footer { display:flex; align-items:flex-end; justify-content:space-between; gap:26mm; margin-top:auto; padding-top:22mm; page-break-inside:avoid; break-inside:avoid; }
      .signature-block { width:200px; }
      .signature-label { margin-bottom:13px; color:var(--ink-soft); font-size:9px; font-weight:700; letter-spacing:1.4px; }
      .signature-line { border-bottom: 1px solid var(--ink); height: 1px; margin-bottom: 8px; }
      .signature-name { font-size: 10px; line-height: 1.35; }
      .generated-date { color:var(--ink-soft); font-size:9px; text-align:right; }
    </style>
  </head>
  <body>
    <div class="top-bar"></div>
    <main class="page">
      <header class="header">
        <div class="header-copy">
          <p class="eyebrow">APPLE SCHOLAR FOUNDATION</p>
          <h1>${safeReportTitle}</h1>
          <p class="period">${escapeHtml(periodLabel)}</p>
        </div>
        <div class="seal" aria-label="Apple Scholar seal"><img src="${escapeHtml(logoBase64)}" alt="Apple Scholar"></div>
      </header>
      <div class="divider"></div>
      ${summaryHTML}
      ${isSubmissionRecords ? `<table class="submission-records-table">
        <colgroup><col style="width:20%"><col style="width:15%"><col style="width:12%"><col style="width:14%"><col style="width:12%"><col style="width:12%"><col style="width:15%"></colgroup>
        <thead><tr><th>SCHOLAR</th><th>STUDENT ID</th><th>YEAR LEVEL</th><th>REQUIREMENT</th><th>PERIOD</th><th>SUBMITTED AT</th><th>STATUS</th></tr></thead>
        <tbody>${safeRows || '<tr><td colspan="7" class="empty">No submission records available</td></tr>'}</tbody>
      </table>` : isTaskCompletion ? `<table>
        <colgroup><col style="width:28%"><col style="width:20%"><col style="width:13%"><col style="width:13%"><col style="width:13%"><col style="width:13%"></colgroup>
        <thead><tr><th>SCHOLAR</th><th>STUDENT ID</th><th>ASSIGNED</th><th>COMPLETED</th><th>MISSING</th><th>PENDING</th></tr></thead>
        <tbody>${safeRows || '<tr><td colspan="6" class="empty">No task records available</td></tr>'}</tbody>
      </table>` : isMonthlyLetterReview ? `<table>
        <colgroup><col style="width:20%"><col style="width:17%"><col style="width:13%"><col style="width:15%"><col style="width:15%"><col style="width:20%"></colgroup>
        <thead><tr><th>SCHOLAR</th><th>STUDENT ID</th><th>YEAR LEVEL</th><th>QUALITY SCORE</th><th>SENTIMENT</th><th>SUBMITTED AT</th></tr></thead>
        <tbody>${safeRows || '<tr><td colspan="6" class="empty">No monthly letters available</td></tr>'}</tbody>
      </table>` : isAttendanceReport ? `<table class="attendance-table">
        <colgroup><col style="width:14%"><col style="width:17%"><col style="width:9%"><col style="width:13%"><col style="width:13%"><col style="width:20%"><col style="width:14%"></colgroup>
        <thead><tr><th>SCHOLAR</th><th>STUDENT ID</th><th>GROUP</th><th>ASSIGNED STAFF</th><th>DUTY</th><th>ATTENDANCE TIME</th><th>STATUS</th></tr></thead>
        <tbody>${safeRows || '<tr><td colspan="7" class="empty">No attendance records available</td></tr>'}</tbody>
      </table>` : isExportReport ? exportGroups.map(group => `
        <section class="export-group">
          <h2>${escapeHtml(group.title)}</h2>
          <table>
            <colgroup><col style="width:18%"><col style="width:14%"><col style="width:16%"><col style="width:12%"><col style="width:13%"><col style="width:13%"><col style="width:14%"></colgroup>
            <thead><tr><th>SCHOLAR</th><th>STUDENT ID</th><th>REQUIREMENT</th><th>DEADLINE</th><th>SUBMITTED AT</th><th>APPROVED AT</th><th>STATUS</th></tr></thead>
            <tbody>${renderExportRows(group.rows)}</tbody>
          </table>
        </section>`).join('') : isComplianceSummary ? `<table>
        <colgroup><col style="width:30%"><col style="width:25%"><col style="width:25%"><col style="width:20%"></colgroup>
        <thead><tr><th>SCHOLAR NAME</th><th>STUDENT ID</th><th>COMPLIANCE CREDITS</th><th>RISK STATUS</th></tr></thead>
        <tbody>${safeRows || '<tr><td colspan="4" class="empty">No compliance data available</td></tr>'}</tbody>
      </table>` : `<table>
        ${detailRows.length
          ? (isExportReport ? '<colgroup><col style="width:18%"><col style="width:14%"><col style="width:16%"><col style="width:12%"><col style="width:13%"><col style="width:13%"><col style="width:14%"></colgroup><thead><tr><th>SCHOLAR</th><th>STUDENT ID</th><th>REQUIREMENT</th><th>DEADLINE</th><th>SUBMITTED AT</th><th>APPROVED AT</th><th>STATUS</th></tr></thead>' : isMonthlyReport ? '<colgroup><col style="width:18%"><col style="width:13%"><col style="width:16%"><col style="width:10%"><col style="width:12%"><col style="width:10%"><col style="width:10%"><col style="width:11%"></colgroup><thead><tr><th>SCHOLAR</th><th>STUDENT ID</th><th>SUBMISSION TYPE</th><th>SUBMISSION STATUS</th><th>COUNT</th><th>SUBMITTED AT</th><th>QUALITY STATUS</th><th>OFFICER REVIEW</th></tr></thead>' : '<colgroup><col style="width:22%"><col style="width:14%"><col style="width:20%"><col style="width:16%"><col style="width:12%"><col style="width:16%"></colgroup><thead><tr><th>SCHOLAR</th><th>STUDENT ID</th><th>SUBMISSION TYPE</th><th>SUBMISSION STATUS</th><th>COUNT</th><th>OFFICER REVIEW</th></tr></thead>')
          : '<colgroup><col class="batch"><col class="compliance"><col class="missing"></colgroup><thead><tr><th>BATCH</th><th>COMPLIANCE</th><th>MISSING</th></tr></thead>'}
        <tbody>${safeRows || '<tr><td colspan="3" class="empty">No report rows available</td></tr>'}</tbody>
      </table>`}
      <footer class="footer">
        <section class="signature-block">
          <div class="signature-label">CERTIFIED BY</div>
          <div class="signature-line"></div>
          <div class="signature-name">${escapeHtml(certifiedByName)}</div>
        </section>
        <div class="generated-date">Generated ${generatedDate}</div>
      </footer>
    </main>
  </body>
</html>`;
};

module.exports = { buildReportSummaryHTML };