/**
 * Ambient type declarations for the `cloudflare:workers` runtime module.
 * Resolved at runtime by the @astrojs/cloudflare adapter — these types
 * only provide editor/tsc hints.
 */

declare module 'cloudflare:workers' {
  export const env: Record<string, any>;
}
