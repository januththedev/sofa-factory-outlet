import { isbot } from 'isbot';

// A small, dependency-free classifier. `ua-parser-js` v2 is AGPL, so we only
// recognise the handful of families the shop actually sees. Anything unknown
// is labelled "Other"/"desktop" rather than guessed at.
//
// The raw user agent is never stored: only these derived labels are.

export type DeviceType = 'mobile' | 'tablet' | 'desktop';
export type BrowserName = 'Chrome' | 'Safari' | 'Firefox' | 'Edge' | 'Opera' | 'Samsung Internet' | 'Other';
export type OperatingSystem = 'iOS' | 'Android' | 'Windows' | 'macOS' | 'Linux' | 'ChromeOS' | 'Other';

export type UserAgentInfo = {
  device: DeviceType;
  browser: BrowserName;
  os: OperatingSystem;
  bot: boolean;
};

const BROWSER_RULES: ReadonlyArray<readonly [RegExp, BrowserName]> = [
  // Edge and Opera both carry "Chrome/" in their user agents, so they come first.
  [/Edg(?:e|A|iOS)?\//, 'Edge'],
  [/OPR\/|Opera Mini|Opera Mobi|Opera\//, 'Opera'],
  [/SamsungBrowser\//, 'Samsung Internet'],
  [/FxiOS\/|Firefox\//, 'Firefox'],
  [/CriOS\/|Chrome\//, 'Chrome'],
  [/Safari\//, 'Safari'],
];

const OS_RULES: ReadonlyArray<readonly [RegExp, OperatingSystem]> = [
  [/iPhone|iPad|iPod/, 'iOS'],
  [/Android/, 'Android'],
  [/Windows Phone|Windows NT|Windows/, 'Windows'],
  [/CrOS/, 'ChromeOS'],
  [/Mac OS X|Macintosh/, 'macOS'],
  [/Linux|X11/, 'Linux'],
];

const MOBILE = /Mobi|iPhone|iPod|Android.*Mobile|Windows Phone|BlackBerry|Opera Mini|IEMobile/;
const TABLET = /iPad|Tablet|PlayBook|Silk|Android(?!.*Mobile)/;

/** True when `isbot` recognises the string as a crawler, monitor or link preview. */
export function isBotUserAgent(userAgent?: string | null): boolean {
  const value = userAgent?.trim();
  return value ? isbot(value) : false;
}

/** Device, browser and OS from a user-agent header. Never throws. */
export function classifyUserAgent(userAgent?: string | null): UserAgentInfo {
  const value = (userAgent ?? '').trim();
  const bot = isBotUserAgent(value);

  let browser: BrowserName = 'Other';
  for (const [pattern, name] of BROWSER_RULES) {
    if (pattern.test(value)) {
      browser = name;
      break;
    }
  }

  let os: OperatingSystem = 'Other';
  for (const [pattern, name] of OS_RULES) {
    if (pattern.test(value)) {
      os = name;
      break;
    }
  }

  // Tablets first: an iPad user agent also contains "Mobile/".
  const device: DeviceType = TABLET.test(value) ? 'tablet' : MOBILE.test(value) ? 'mobile' : 'desktop';

  return { device, browser, os, bot };
}
