// Authentication utility functions
export const getAuthToken = () => {
  return localStorage.getItem('token');
};

export const getUserData = () => {
  const userData = localStorage.getItem('user') || localStorage.getItem('userData');
  if (!userData) return null;

  try {
    return JSON.parse(userData);
  } catch (error) {
    console.error('Failed to parse stored user data:', error);
    return null;
  }
};

export const setAuthData = (token, user) => {
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
  localStorage.removeItem('userData');
  
  // Trigger custom event to notify components of auth change
  window.dispatchEvent(new Event('authChange'));
};

export const clearAuthData = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  localStorage.removeItem('userData');
  
  // Trigger custom event to notify components of auth change
  window.dispatchEvent(new Event('authChange'));
};

export const isAuthenticated = () => {
  const token = getAuthToken();
  return token !== null;
};

// Get currency locale mapping
const getCurrencyLocale = (currency) => {
  const localeMap = {
    'USD': 'en-US',
    'EUR': 'de-DE',
    'GBP': 'en-GB',
    'JPY': 'ja-JP',
    'CNY': 'zh-CN',
    'INR': 'en-IN',
    'CAD': 'en-CA',
    'AUD': 'en-AU',
    'CHF': 'de-CH',
    'MXN': 'es-MX',
    'BRL': 'pt-BR',
    'ZAR': 'en-ZA',
    'SGD': 'en-SG',
    'HKD': 'zh-HK',
    'KRW': 'ko-KR',
    'SEK': 'sv-SE',
    'NOK': 'nb-NO',
    'DKK': 'da-DK',
    'PLN': 'pl-PL',
    'THB': 'th-TH',
    'MYR': 'ms-MY',
    'IDR': 'id-ID',
    'PHP': 'en-PH',
    'TRY': 'tr-TR',
    'RUB': 'ru-RU',
    'AED': 'ar-AE',
    'SAR': 'ar-SA',
    'EGP': 'ar-EG',
    'NGN': 'en-NG',
    'KES': 'en-KE',
    'LKR': 'en-LK'
  };
  return localeMap[currency] || 'en-US';
};

// Format currency with user's preference
export const formatCurrency = (amount, currencyCode = null) => {
  // Get user's currency preference
  const user = getUserData();
  const currency = currencyCode || user?.currency || 'USD';
  const locale = getCurrencyLocale(currency);
  
  // Special handling for Sri Lankan Rupee to show "Rs" instead of "LKR"
  if (currency === 'LKR') {
    const formatted = new Intl.NumberFormat(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
    return `Rs ${formatted}`;
  }
  
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: currency === 'JPY' || currency === 'KRW' ? 0 : 2,
    maximumFractionDigits: currency === 'JPY' || currency === 'KRW' ? 0 : 2,
  }).format(amount);
};

// Validate email format
export const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Validate password strength
export const validatePassword = (password) => {
  return password.length >= 6;
};
