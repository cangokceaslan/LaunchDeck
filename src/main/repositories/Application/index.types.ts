import type {
  AndroidConfiguration,
  AndroidSigningSetupConfiguration,
  AppStoreConnectSetupConfiguration,
  ApplicationDetail,
  ArtifactGenerationConfiguration,
  FirebaseDistributionConfiguration,
  GooglePlaySetupConfiguration,
  IosConfiguration,
  IosSigningConfiguration,
} from '@shared/contracts/domain';

export type StoredApplication = Omit<
  ApplicationDetail,
  'androidSigning' | 'appStoreConnect' | 'googlePlay'
> & {
  androidSigning: AndroidSigningSetupConfiguration | null;
  appStoreConnect: AppStoreConnectSetupConfiguration | null;
  googlePlay: GooglePlaySetupConfiguration | null;
  serviceAccountPath: string | null;
};

export type PersistApplicationInput = {
  android: AndroidConfiguration | null;
  androidSigning: AndroidSigningSetupConfiguration | null;
  appStoreConnect: AppStoreConnectSetupConfiguration | null;
  artifactGeneration: ArtifactGenerationConfiguration;
  artifactOutputDirectoryPath: string | null;
  distributionGroups: string[];
  firebaseDistribution: FirebaseDistributionConfiguration;
  firebaseProjectId: string;
  googlePlay: GooglePlaySetupConfiguration | null;
  hooks: ApplicationDetail['hooks'];
  ios: IosConfiguration | null;
  iosSigning: IosSigningConfiguration;
  name: string;
  serviceAccountFileName: string;
  serviceAccountPath: string | null;
  shouldNotifyWhenFinished: boolean;
};
