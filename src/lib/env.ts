/**
 * Utility to detect the current execution environment.
 */

// Tauri adds this to the window object
declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

/**
 * Returns true if running within a Tauri container (Desktop or Mobile).
 */
export const isTauri = (): boolean => {
  return typeof window !== 'undefined' && !!window.__TAURI_INTERNALS__;
};

/**
 * Returns true if running in a standard web browser environment.
 */
export const isWeb = (): boolean => {
  return !isTauri();
};

/**
 * Returns true if running in dummy mode (simulated backend).
 */
export const isDummyMode = (): boolean => {
  return import.meta.env.PUBLIC_YT_DUMMY_MODE === 'true';
};

/**
 * Simple helper to log current platform to console
 */
export const logPlatform = () => {
  if (typeof window === 'undefined') {
    console.log('Environment: Node.js / SSR');
    return;
  }
  
  if (isTauri()) {
    console.log(`Environment: Tauri (Native) [Dummy: ${isDummyMode()}]`);
  } else {
    console.log(`Environment: Browser (Web) [Dummy: ${isDummyMode()}]`);
  }
};
