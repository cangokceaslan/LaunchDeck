import type { DoctorReport } from '@shared/contracts/doctor';

export type DoctorProps = {
  errorMessage: string | null;
  isChecking: boolean;
  onContinue: () => void;
  onRetry: () => void;
  report: DoctorReport | null;
};
