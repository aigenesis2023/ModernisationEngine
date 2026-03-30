/**
 * Render context for SSR — module-level singleton.
 *
 * Since we call renderToString() per-component (not as a single tree),
 * Preact's createContext/useContext won't propagate across calls.
 * Instead we use a module-level variable set before the render pass.
 * This is safe because SSR is single-threaded and synchronous.
 */
import type { RenderContext } from './types.js';

let _ctx: RenderContext = {
  AR: {},
  isDark: true,
  embedImage: (p: string) => p,
};

/** Set the render context before a render pass */
export function setRenderContext(ctx: RenderContext): void {
  _ctx = ctx;
}

/** Get the current render context (called by components) */
export function useRender(): RenderContext {
  return _ctx;
}
