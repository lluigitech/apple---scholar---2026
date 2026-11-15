export const MIN_PASSWORD_LENGTH = 8;

export const hasRequiredPasswordSymbol = password =>
  typeof password === 'string' && /[^A-Za-z0-9\s]/.test(password);

export const getPasswordRequirementError = password => {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (!hasRequiredPasswordSymbol(password)) {
    return 'Include at least one special character, such as ! or @.';
  }
  return '';
};

export const isValidPassword = password => !getPasswordRequirementError(password);
