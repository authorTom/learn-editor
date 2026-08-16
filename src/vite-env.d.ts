/// <reference types="vite/client" />

declare module '*?raw' {
  const content: string
  export default content
}

/** Baked in by Vite from package.json — see `define` in vite.config.ts. */
declare const __APP_VERSION__: string
