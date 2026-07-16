import type {
  AndroidConfiguration,
  ApplicationDetail,
  IosConfiguration,
} from '@shared/contracts/domain';

export type StoredApplication = ApplicationDetail & {
  serviceAccountPath: string;
};

export type PersistApplicationInput = {
  android: AndroidConfiguration | null;
  artifactOutputDirectoryPath: string | null;
  distributionGroups: string[];
  firebaseProjectId: string;
  hooks: ApplicationDetail['hooks'];
  ios: IosConfiguration | null;
  name: string;
  serviceAccountFileName: string;
  serviceAccountPath: string;
};
