export const getEducationStage = (value) => {
    const level = String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
    if (/^grade_(7|8|9|10)$/.test(level)) return 'junior_high';
    if (/^grade_(11|12)$/.test(level)) return 'senior_high';
    if (/^college_[1-5]$/.test(level) || /^[1-5](st|nd|rd|th)_year_college$/.test(level)) return 'college';
    return 'other';
};

export const hasEducationProgram = (value) => getEducationStage(value) !== 'junior_high';
