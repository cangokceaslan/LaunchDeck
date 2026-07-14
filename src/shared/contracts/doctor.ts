export type DoctorCheckCode = 'firebaseCli' | 'xcode' | 'platform';

export type DoctorCheck = {
  code: DoctorCheckCode;
  detail: string;
  isBlocking: boolean;
  label: string;
  status: 'checking' | 'passed' | 'warning' | 'failed';
  version?: string;
};

export type DoctorReport = {
  checks: DoctorCheck[];
  isReady: boolean;
  os: 'darwin' | 'linux' | 'win32';
  supportedPlatforms: Array<'android' | 'ios'>;
};
