const GOOGLE_ANALYTICS_MEASUREMENT_ID = 'G-0BZETSYD98';
const GOOGLE_TAG_SCRIPT_ID = 'launchdeck-google-analytics';
const DESKTOP_PAGE_LOCATION = 'https://app.launchdeck.local/';

type GoogleTagConfig = {
  allow_ad_personalization_signals: false;
  allow_google_signals: false;
  page_location: string;
  page_title: string;
};

type GoogleTagCommand = ['config', string, GoogleTagConfig] | ['js', Date];

const queueGoogleTagCommand = (...command: GoogleTagCommand): void => {
  window.dataLayer?.push(command);
};

export const initializeAnalytics = (): void => {
  if (!import.meta.env.PROD || document.getElementById(GOOGLE_TAG_SCRIPT_ID) !== null) return;

  window.dataLayer ??= [];
  queueGoogleTagCommand('js', new Date());
  queueGoogleTagCommand('config', GOOGLE_ANALYTICS_MEASUREMENT_ID, {
    allow_ad_personalization_signals: false,
    allow_google_signals: false,
    page_location: DESKTOP_PAGE_LOCATION,
    page_title: document.title,
  });

  const googleTagScript = document.createElement('script');
  googleTagScript.async = true;
  googleTagScript.id = GOOGLE_TAG_SCRIPT_ID;
  googleTagScript.src = `https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ANALYTICS_MEASUREMENT_ID}`;
  document.head.append(googleTagScript);
};
