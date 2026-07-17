import type {
  AndroidProjectMetadataRequest,
  AndroidProjectMetadataResult,
} from '@shared/contracts/domain';

export type UseAndroidProjectConfigurationResult = {
  error: string | null;
  isLoading: boolean;
  reset: () => void;
  resolveProjectMetadata: (
    request: AndroidProjectMetadataRequest,
  ) => Promise<AndroidProjectMetadataResult | null>;
};
