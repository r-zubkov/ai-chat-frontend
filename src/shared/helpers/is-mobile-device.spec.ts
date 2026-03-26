import { isMobileDevice } from './is-mobile-device';

type MockEnvConfig = {
  isSmallViewport: boolean;
  maxTouchPoints: number;
  userAgent: string;
};

const createMediaQueryList = (matches: boolean): MediaQueryList =>
  ({
    matches,
    media: '(max-width: 1024px)',
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }) as MediaQueryList;

describe('isMobileDevice', () => {
  const mockEnvironment = ({ isSmallViewport, maxTouchPoints, userAgent }: MockEnvConfig): void => {
    spyOnProperty(navigator, 'userAgent', 'get').and.returnValue(userAgent);
    spyOnProperty(navigator, 'maxTouchPoints', 'get').and.returnValue(maxTouchPoints);
    spyOn(window, 'matchMedia').and.returnValue(createMediaQueryList(isSmallViewport));
  };

  it('возвращает false для desktop-окружения без touch', () => {
    mockEnvironment({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      maxTouchPoints: 0,
      isSmallViewport: false,
    });

    expect(isMobileDevice()).toBeFalse();
  });

  it('возвращает true для мобильного user-agent', () => {
    mockEnvironment({
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
      maxTouchPoints: 0,
      isSmallViewport: false,
    });

    expect(isMobileDevice()).toBeTrue();
  });

  it('возвращает true для touch-устройства с маленьким viewport', () => {
    mockEnvironment({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      maxTouchPoints: 5,
      isSmallViewport: true,
    });

    expect(isMobileDevice()).toBeTrue();
  });
});
