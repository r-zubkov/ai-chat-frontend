const MOBILE_DEVICE_USER_AGENT = /Android|iPhone|iPad|iPod/i;
const MOBILE_MAX_VIEWPORT_WIDTH = '1024px';

export const isMobileDevice = (): boolean => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }

  const hasTouch = navigator.maxTouchPoints > 0;
  const isSmallViewport = window.matchMedia(`(max-width: ${MOBILE_MAX_VIEWPORT_WIDTH})`).matches;
  const isMobileUserAgent = MOBILE_DEVICE_USER_AGENT.test(navigator.userAgent);

  return isMobileUserAgent || (hasTouch && isSmallViewport);
};
