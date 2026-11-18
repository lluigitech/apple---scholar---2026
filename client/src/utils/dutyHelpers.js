export const formatDuration = (hours) => {
    const totalMinutes = Math.round(Number(hours) * 60);
    if (!Number.isFinite(totalMinutes) || totalMinutes < 0) return '—';
    const wholeHours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (wholeHours && minutes) return `${wholeHours}h ${minutes}m`;
    if (wholeHours) return `${wholeHours}h`;
    return `${minutes}m`;
};

const parseAttendanceTimestamp = (value) => {
    if (!value) return null;
    const text = String(value).trim();
    const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(text)
        ? text.replace(' ', 'T')
        : text;
    const timestamp = new Date(normalized).getTime();
    return Number.isFinite(timestamp) ? timestamp : null;
};

export const getDutyHours = (duty) => {
    const checkedInAt = parseAttendanceTimestamp(duty.marked_at);
    const checkedOutAt = parseAttendanceTimestamp(duty.check_out_at);
    if (checkedInAt === null || checkedOutAt === null || checkedOutAt <= checkedInAt) return 0;
    const workedMinutes = Math.round((checkedOutAt - checkedInAt) / 60000);
    const makeupBonusMinutes = Number(duty.is_makeup) === 1 ? 60 : 0;
    return (workedMinutes + makeupBonusMinutes) / 60;
};
