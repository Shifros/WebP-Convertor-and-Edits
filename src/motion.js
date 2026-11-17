import { useCallback, useRef } from "react";
import { flushSync } from "react-dom";

export const reducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Close a <dialog> with its exit animation, then run `done`. */
export function useAnimatedClose(ref, done, duration = 200) {
  const closing = useRef(false);
  return useCallback(
    (after) => {
      if (closing.current) return;
      closing.current = true;
      const finish = () => {
        done();
        if (typeof after === "function") after();
      };
      if (reducedMotion() || !ref.current) return finish();
      ref.current.classList.add("closing");
      setTimeout(finish, duration);
    },
    [ref, done, duration],
  );
}

/** Cross-fade the whole page while a state change is applied. */
export function withViewTransition(update) {
  if (!document.startViewTransition || reducedMotion()) return update();
  document.startViewTransition(() => flushSync(update));
}

/** Style that positions a segmented control's sliding indicator. */
export const segment = (index, count) => ({
  "--i": Math.max(0, index),
  "--n": count,
});

/**
 * Close a dialog only when a click both starts and ends on its backdrop,
 * so a drag that is released outside the window never closes it.
 */
export function useBackdropClose(ref, close) {
  const startedOnBackdrop = useRef(false);
  return {
    onPointerDown: (event) => {
      startedOnBackdrop.current = event.target === ref.current;
    },
    onClick: (event) => {
      if (startedOnBackdrop.current && event.target === ref.current) close();
      startedOnBackdrop.current = false;
    },
  };
}
