const GOOGLE_ANALYTICS_MEASUREMENT_ID = 'G-0BZETSYD98';
const GOOGLE_TAG_SCRIPT_ID = 'launchdeck-google-analytics';

type GoogleTagCommand = ['config', string] | ['js', Date];

const queueGoogleTagCommand = (...command: GoogleTagCommand): void => {
  window.dataLayer?.push(command);
};

export const initializeAnalytics = (): void => {
  if (!import.meta.env.PROD || document.getElementById(GOOGLE_TAG_SCRIPT_ID) !== null) return;

  window.dataLayer ??= [];
  queueGoogleTagCommand('js', new Date());
  queueGoogleTagCommand('config', GOOGLE_ANALYTICS_MEASUREMENT_ID);

  const googleTagScript = document.createElement('script');
  googleTagScript.async = true;
  googleTagScript.id = GOOGLE_TAG_SCRIPT_ID;
  googleTagScript.src = `https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ANALYTICS_MEASUREMENT_ID}`;
  document.head.append(googleTagScript);
};
