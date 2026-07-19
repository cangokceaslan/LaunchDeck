import type { ApplicationDetail } from '@shared/contracts/domain';
import type { DoctorReport } from '@shared/contracts/doctor';

export type WindowHeaderProps = {
  application: ApplicationDetail | null;
  doctorError: string | null;
  doctorReport: DoctorReport | null;
  isCheckingDoctor: boolean;
  onRetryDoctor: () => void;
};
