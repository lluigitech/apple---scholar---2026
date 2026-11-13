const configuredOrigin = import.meta.env?.VITE_API_URL?.trim();

const normalizedOrigin = (configuredOrigin || 'http://localhost:5000').replace(/\/+$/, '');

export const API_ORIGIN = normalizedOrigin.replace(/\/api$/i, '');
