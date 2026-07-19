import type { ApplicationDetail } from '@shared/contracts/domain';
import type { DoctorReport } from '@shared/contracts/doctor';

export type SetupWorkflowId = 'artifact' | 'firebase' | 'store';

export type SetupRequirement = {
  detail: string;
  label: string;
};

export type SetupWorkflowSummary = {
  description: string;
  id: SetupWorkflowId;
  isReady: boolean;
  missingRequirements: SetupRequirement[];
  readyDetail: string;
  title: string;
};

export type SetupGuideModalProps = {
  application: ApplicationDetail | null;
  errorMessage: string | null;
  isChecking: boolean;
  isOpen: boolean;
  onClose: () => void;
  onRetry: () => void;
  report: DoctorReport | null;
};
