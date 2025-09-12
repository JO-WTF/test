// i18n/dom.js — 把翻译应用到页面（data-i18n 属性）
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.I18NDOM = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  /**
   * 规则：
   *  - data-i18n="key"                -> element.textContent
   *  - data-i18n-html="key"           -> element.innerHTML
   *  - data-i18n-title="key"          -> element.title
   *  - data-i18n-placeholder="key"    -> element.placeholder
   *  - data-i18n-aria-label="key"     -> element.setAttribute('aria-label', ...)
   *
   * 支持插值：data-i18n-vars='{"name":"DU"}'  -> {name} 替换
   */
  function apply(rootEl, i18n) {
    const root = rootEl || document;

    const q = (sel) => Array.from(root.querySelectorAll(sel));
    const readVars = (el) => {
      try {
        const raw = el.getAttribute("data-i18n-vars");
        return raw ? JSON.parse(raw) : null;
      } catch { return null; }
    };

    q("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      const vars = readVars(el);
      el.textContent = i18n.t(key, vars);
    });

    q("[data-i18n-html]").forEach((el) => {
      const key = el.getAttribute("data-i18n-html");
      const vars = readVars(el);
      el.innerHTML = i18n.t(key, vars);
    });

    q("[data-i18n-title]").forEach((el) => {
      const key = el.getAttribute("data-i18n-title");
      const vars = readVars(el);
      el.title = i18n.t(key, vars);
    });

    q("[data-i18n-placeholder]").forEach((el) => {
      const key = el.getAttribute("data-i18n-placeholder");
      const vars = readVars(el);
      el.placeholder = i18n.t(key, vars);
    });

    q("[data-i18n-aria-label]").forEach((el) => {
      const key = el.getAttribute("data-i18n-aria-label");
      const vars = readVars(el);
      el.setAttribute("aria-label", i18n.t(key, vars));
    });
  }

  return { apply };
});
