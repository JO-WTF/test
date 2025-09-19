# Jakarta SCM Frontend

This project is a Vue 3 single-page application powered by Vite. It provides three main views:

- **Scanner** – barcode scanning and DU status update workflow (default route `/`).
- **Admin** – DU submission management tools with filtering, editing, and exporting (`/admin`).
- **Dashboard** – delivery statistics dashboard with sorting, CSV export, and responsive cards (`/dashboard`).

## Development

```bash
npm install
npm run dev
```

The dev server is available at http://localhost:5173 by default.

## Build

```bash
npm run build
```

The production bundle is emitted to `dist/`.

Environment-specific API endpoints can be injected by overriding `window.APP_CONFIG.API_BASE` (for example, via `dist/config.js`).
