import { onBeforeUnmount, onMounted } from 'vue';

const THEME_CLASSES = ['scan-theme', 'admin-theme', 'dashboard-theme'];

export function useBodyTheme(theme) {
  onMounted(() => {
    const body = document.body;
    THEME_CLASSES.forEach((cls) => {
      if (cls !== theme) {
        body.classList.remove(cls);
      }
    });
    if (theme) {
      body.classList.add(theme);
    }
  });

  onBeforeUnmount(() => {
    if (theme) {
      document.body.classList.remove(theme);
    }
  });
}
