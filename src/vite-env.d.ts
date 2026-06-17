/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

// Static asset imports used by the sprite/atlas loader.
declare module '*.png' {
  const src: string;
  export default src;
}
declare module '*.json' {
  const value: unknown;
  export default value;
}
