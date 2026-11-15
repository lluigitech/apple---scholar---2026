const MIN_PASSWORD_LENGTH = 8;
const SPECIAL_CHARACTER_PATTERN = /[^A-Za-z0-9\s]/;
const PASSWORD_REQUIREMENTS_ERROR = 'Password must be at least 8 characters and include at least one special character, such as ! or @.';

const hasRequiredPasswordSymbol = (password) =>
    typeof password === 'string' && SPECIAL_CHARACTER_PATTERN.test(password);

const isValidPassword = (password) =>
    typeof password === 'string'
    && password.length >= MIN_PASSWORD_LENGTH
    && hasRequiredPasswordSymbol(password);

module.exports = {
    MIN_PASSWORD_LENGTH,
    PASSWORD_REQUIREMENTS_ERROR,
    hasRequiredPasswordSymbol,
    isValidPassword,
};
