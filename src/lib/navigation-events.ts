const listeners = new Set<() => void>();
let installed = false;

// This module-level mutable Set is safe in a Worker because nothing mutates it during render; it stays empty server-side.
function notify() {
  queueMicrotask(() => {
    for (const listener of [...listeners]) listener();
  });
}

export function subscribe(listener: () => void) {
  if (typeof window === "undefined") return () => {};

  if (!installed) {
    installed = true;
    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;
    window.history.pushState = function (...args) {
      originalPushState.apply(this, args);
      notify();
    };
    window.history.replaceState = function (...args) {
      originalReplaceState.apply(this, args);
      notify();
    };
    window.addEventListener("popstate", notify);
  }

  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
