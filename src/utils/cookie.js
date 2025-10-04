const isBrowser = () => typeof document !== 'undefined';

const escapeRegex = (value) => value.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');

export const getCookie = (name) => {
  if (!isBrowser() || !name) return '';
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${escapeRegex(name)}=([^;]*)`)
  );
  return match ? decodeURIComponent(match[1]) : '';
};

export const setCookie = (name, value, days = 365) => {
  if (!isBrowser() || !name) return;
  const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString();
  const encodedValue = encodeURIComponent(value ?? '');
  document.cookie = `${name}=${encodedValue}; expires=${expires}; path=/; SameSite=Lax`;
};

export const deleteCookie = (name) => {
  if (!isBrowser() || !name) return;
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`;
};
