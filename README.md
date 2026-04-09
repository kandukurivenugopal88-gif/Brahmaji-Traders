# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Google AdSense Setup

This project includes a reusable AdSense component and placements in:

- Home page banner section
- Products page sidebar (customer view)

Add these variables in your `.env` file:

```env
VITE_ADSENSE_CLIENT_ID=ca-pub-xxxxxxxxxxxxxxxx
VITE_ADSENSE_HOME_SLOT=1234567890
VITE_ADSENSE_PRODUCTS_SLOT=0987654321
```

Notes:

- Replace values with your real AdSense publisher ID and ad slot IDs.
- Ads render only when both client ID and slot ID are available.
- Restart the dev server after editing `.env`.
