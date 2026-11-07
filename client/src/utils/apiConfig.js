const configuredOrigin = import.meta.env?.VITE_API_URL?.trim();

export const API_ORIGIN = (configuredOrigin || 'http://localhost:5000').replace(/\/+$/, '');
