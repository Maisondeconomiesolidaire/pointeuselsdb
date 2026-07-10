/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CONVEX_URL: string;
  readonly VITE_CLERK_PUBLISHABLE_KEY: string;
  readonly VITE_MESOUTILS_URL?: string;
  readonly VITE_RECYCAPP_URL?: string;
  readonly VITE_KLYD_URL?: string;
  readonly VITE_CYCLEENBRAY_URL?: string;
  readonly VITE_BENNESPRO_URL?: string;
  readonly VITE_POINTEUSE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
