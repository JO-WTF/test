export function applyI18n(rootEl, i18n) {
  const root = rootEl || document;
  const q = (sel) => Array.from(root.querySelectorAll(sel));
  const readVars = (el) => {
    try {
      const raw = el.getAttribute('data-i18n-vars');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  q('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    const vars = readVars(el);
    el.textContent = i18n.t(key, vars);
  });

  q('[data-i18n-html]').forEach((el) => {
    const key = el.getAttribute('data-i18n-html');
    const vars = readVars(el);
    el.innerHTML = i18n.t(key, vars);
  });

  q('[data-i18n-title]').forEach((el) => {
    const key = el.getAttribute('data-i18n-title');
    const vars = readVars(el);
    el.title = i18n.t(key, vars);
  });

  q('[data-i18n-placeholder]').forEach((el) => {
    const key = el.getAttribute('data-i18n-placeholder');
    const vars = readVars(el);
    el.placeholder = i18n.t(key, vars);
  });

  q('[data-i18n-aria-label]').forEach((el) => {
    const key = el.getAttribute('data-i18n-aria-label');
    const vars = readVars(el);
    el.setAttribute('aria-label', i18n.t(key, vars));
  });
}
