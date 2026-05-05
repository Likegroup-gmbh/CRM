const DESKTOP_USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
];

const MOBILE_USER_AGENTS = [
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.230 Mobile Safari/537.36',
  'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.230 Mobile Safari/537.36'
];

const PLATFORM_SELECTORS = {
  youtube: '.short-video-container, #player-container',
  tiktok: '#video-card-normal, [data-e2e="detail-video"], [class*="DivVideoWrapper"]',
  instagram: 'article video, article img, [role="presentation"] video, main article',
  other: 'body'
};

const VIEWPORTS = {
  mobile: { width: 430, height: 932 },
  desktop: { width: 1920, height: 1080 }
};

const MAX_SCREENSHOT_HEIGHT = 645;

function getRandomUserAgent(isMobile) {
  const agents = isMobile ? MOBILE_USER_AGENTS : DESKTOP_USER_AGENTS;
  return agents[Math.floor(Math.random() * agents.length)];
}

function randomDelay(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

function detectPlatform(url) {
  if (!url) return 'other';
  const urlLower = url.toLowerCase();
  if (urlLower.includes('youtube.com') || urlLower.includes('youtu.be')) return 'youtube';
  if (urlLower.includes('tiktok.com')) return 'tiktok';
  if (urlLower.includes('instagram.com')) return 'instagram';
  return 'other';
}

function isMobilePlatform(platform) {
  return platform === 'tiktok' || platform === 'instagram';
}

module.exports = {
  DESKTOP_USER_AGENTS,
  MOBILE_USER_AGENTS,
  PLATFORM_SELECTORS,
  VIEWPORTS,
  MAX_SCREENSHOT_HEIGHT,
  getRandomUserAgent,
  randomDelay,
  detectPlatform,
  isMobilePlatform
};
