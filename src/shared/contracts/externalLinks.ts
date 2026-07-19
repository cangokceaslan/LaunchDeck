export const APPROVED_EXTERNAL_HOSTS = [
  'adoptium.net',
  'appstoreconnect.apple.com',
  'classic.yarnpkg.com',
  'cloud.google.com',
  'console.cloud.google.com',
  'console.firebase.google.com',
  'developer.android.com',
  'developer.apple.com',
  'developers.google.com',
  'firebase.google.com',
  'github.com',
  'nodejs.org',
  'play.google.com',
  'support.apple.com',
  'support.google.com',
  'www.oracle.com',
] as const;

const approvedExternalHosts = new Set<string>(APPROVED_EXTERNAL_HOSTS);

export const isApprovedExternalUrl = (targetUrl: string): boolean => {
  try {
    const parsedUrl = new URL(targetUrl);
    return parsedUrl.protocol === 'https:' && approvedExternalHosts.has(parsedUrl.hostname);
  } catch {
    return false;
  }
};
