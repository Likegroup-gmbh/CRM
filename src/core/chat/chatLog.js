// chatLog.js
// Scroll-Helfer fuer Liky-Verlaeufe: Follow-State + Pin ans Ende.
// Der Anker (Messages unten) ist CSS (.chat-log > :first-child).
// Hier bleibt nur: bei Overflow und Autogrow unten bleiben, ohne den
// User mitzureissen, wenn er hochgescrollt hat.

export const DEFAULT_NEAR_END_PX = 80;

export function isNearEnd(el, px = DEFAULT_NEAR_END_PX) {
  if (!el) return false;
  return el.scrollHeight - el.scrollTop - el.clientHeight < px;
}

export function scrollToEnd(el) {
  if (!el) return;
  el.scrollTop = el.scrollHeight;
}

/**
 * Bindet Follow + Resize-Pin an einen Feed.
 * @returns {{ pin: Function, destroy: Function, isFollowing: Function }}
 */
export function bindChatLog(el, { threshold = DEFAULT_NEAR_END_PX } = {}) {
  if (!el) {
    return { pin() {}, destroy() {}, isFollowing: () => false };
  }

  const follow = { current: isNearEnd(el, threshold) };
  let pinning = false;

  const onScroll = () => {
    if (pinning) return;
    follow.current = isNearEnd(el, threshold);
  };
  el.addEventListener('scroll', onScroll, { passive: true });

  const pin = ({ force = false } = {}) => {
    if (!force && !follow.current) return;
    pinning = true;
    scrollToEnd(el);
    follow.current = true;
    pinning = false;
  };

  let ro = null;
  if (typeof ResizeObserver === 'function') {
    ro = new ResizeObserver(() => {
      if (follow.current) pin();
    });
    ro.observe(el);
  }

  return {
    pin,
    destroy() {
      el.removeEventListener('scroll', onScroll);
      ro?.disconnect();
    },
    isFollowing: () => follow.current
  };
}
