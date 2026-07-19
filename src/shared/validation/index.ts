import { z } from 'zod';

const nonEmptyPathSchema = z.string().trim().min(1).max(4096);
const identifierSchema = z.string().trim().min(1).max(256);
const gradleTaskSchema = z.string().trim().min(1).max(160).regex(/^[:A-Za-z0-9_-]+$/u);
const optionalPathSchema = z.string().trim().max(4096);
const applicationIconDataUrlSchema = z
  .string()
  .max(600_000)
  .regex(/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/u)
  .nullable();
const packageNameSchema = z
  .string()
  .trim()
  .min(3)
  .max(255)
  .regex(/^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)+$/u);
const bundleIdentifierSchema = z
  .string()
  .trim()
  .max(255)
  .refine(
    (bundleIdentifier) =>
      bundleIdentifier === '' || /^[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/u.test(bundleIdentifier),
    { message: 'The iOS bundle identifier is invalid.' },
  );
const playTrackSchema = z.string().trim().min(1).max(80).regex(/^[A-Za-z0-9._:-]+$/u);
const languageTagSchema = z.string().trim().min(2).max(35).regex(/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/u);
const MAX_BUILD_NUMBER = 2_147_483_647;

export const isReleaseVersionName = (versionName: string): boolean =>
  /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/u.test(versionName) &&
  versionName.split('.').every((component) => Number(component) <= MAX_BUILD_NUMBER);

export const isReleaseBuildNumber = (buildNumber: string): boolean =>
  /^[1-9]\d*$/u.test(buildNumber) && Number(buildNumber) <= MAX_BUILD_NUMBER;

const versionNameSchema = z.string().trim().refine(isReleaseVersionName, {
  message: 'Version must contain three numeric components, such as 1.0.0.',
});

const androidReleaseVersionInputSchema = z
  .object({
    incrementPatch: z.boolean(),
    incrementVersionCode: z.boolean(),
    versionCode: z.number().int().positive().max(MAX_BUILD_NUMBER),
    versionName: versionNameSchema,
  })
  .superRefine((version, context) => {
    const patch = Number(version.versionName.split('.')[2]);
    if (version.incrementPatch && patch >= MAX_BUILD_NUMBER) {
      context.addIssue({
        code: 'custom',
        message: 'The patch version cannot be incremented any further.',
        path: ['versionName'],
      });
    }
    if (version.incrementVersionCode && version.versionCode >= MAX_BUILD_NUMBER) {
      context.addIssue({
        code: 'custom',
        message: 'The Android version code cannot be incremented any further.',
        path: ['versionCode'],
      });
    }
  });

const iosReleaseVersionInputSchema = z
  .object({
    buildNumber: z.number().int().positive().max(MAX_BUILD_NUMBER),
    incrementBuildNumber: z.boolean(),
    incrementPatch: z.boolean(),
    versionName: versionNameSchema,
  })
  .superRefine((version, context) => {
    const patch = Number(version.versionName.split('.')[2]);
    if (version.incrementPatch && patch >= MAX_BUILD_NUMBER) {
      context.addIssue({
        code: 'custom',
        message: 'The patch version cannot be incremented any further.',
        path: ['versionName'],
      });
    }
    if (version.incrementBuildNumber && version.buildNumber >= MAX_BUILD_NUMBER) {
      context.addIssue({
        code: 'custom',
        message: 'The iOS build number cannot be incremented any further.',
        path: ['buildNumber'],
      });
    }
  });

const releaseVersionInputSchema = z.object({
  android: androidReleaseVersionInputSchema.optional(),
  ios: iosReleaseVersionInputSchema.optional(),
});

export const androidConfigurationSchema = z.object({
  aabArtifactPath: nonEmptyPathSchema.default('app/build/outputs/bundle/release/app-release.aab'),
  aabGradleTask: gradleTaskSchema.default(':app:bundleRelease'),
  artifactPath: nonEmptyPathSchema,
  defaultArtifactType: z.enum(['apk', 'aab']).default('apk'),
  firebaseAppId: identifierSchema.nullable(),
  googleServicesJsonPath: nonEmptyPathSchema.nullable(),
  gradleTask: gradleTaskSchema,
  projectPath: nonEmptyPathSchema,
});

export const androidProjectMetadataRequestSchema = z.object({
  googleServicesJsonPath: optionalPathSchema.nullable(),
  gradleTask: gradleTaskSchema,
  projectPath: nonEmptyPathSchema,
});

export const iosConfigurationSchema = z.object({
  artifactPath: nonEmptyPathSchema,
  bundleIdentifier: bundleIdentifierSchema.default(''),
  configuration: z.string().trim().min(1).max(120),
  exportMethod: z.enum(['release-testing', 'enterprise', 'development']),
  firebaseAppId: identifierSchema.nullable(),
  googleServiceInfoPlistPath: nonEmptyPathSchema.nullable(),
  projectPath: nonEmptyPathSchema,
  scheme: z.string().trim().min(1).max(160),
  workspaceOrProjectPath: nonEmptyPathSchema,
});

export const iosProjectMetadataRequestSchema = z.object({
  configuration: z.string().trim().min(1).max(120),
  scheme: z.string().trim().min(1).max(160),
  workspaceOrProjectPath: nonEmptyPathSchema,
});

export const artifactGenerationConfigurationSchema = z.object({
  androidArtifactTypes: z.array(z.enum(['apk', 'aab'])).max(2),
  isEnabled: z.boolean(),
  isIosIpaEnabled: z.boolean(),
  requiresAndroidSigning: z.boolean(),
  requiresIosSigning: z.boolean(),
});

export const firebaseDistributionConfigurationSchema = z.object({
  isEnabled: z.boolean(),
  requiresAndroidSigning: z.boolean(),
  requiresIosSigning: z.boolean(),
});

export const androidSigningSetupConfigurationSchema = z.object({
  keyAlias: z.string().trim().min(1).max(256),
  keyPassword: z.string().min(1).max(4096),
  keystorePath: nonEmptyPathSchema,
  storePassword: z.string().min(1).max(4096),
});

const retainedAndroidSigningSetupConfigurationSchema = z.object({
  keyAlias: z.string().trim().min(1).max(256),
  keyPassword: z.string().max(4096),
  keystorePath: optionalPathSchema,
  storePassword: z.string().max(4096),
});

export const androidSigningConfigurationSchema = z.object({
  isConfigured: z.boolean(),
  keyAlias: z.string().trim().min(1).max(256),
  keystoreFileName: z.string().trim().min(1).max(512),
});

export const iosSigningConfigurationSchema = z.object({
  developmentTeamId: z
    .string()
    .trim()
    .max(64)
    .regex(/^[A-Z0-9]*$/u, 'Apple Development Team ID must contain only uppercase letters and numbers.'),
  isEnabled: z.boolean(),
});

const googlePlayBaseSchema = z
  .object({
    artifactType: z.enum(['apk', 'aab']),
    initialTrack: playTrackSchema,
    packageName: packageNameSchema,
    promoteAfterUpload: z.boolean(),
    promotionStatus: z.enum(['draft', 'completed', 'inProgress']),
    promotionTrack: playTrackSchema,
    releaseNotesLanguage: languageTagSchema,
    rolloutFraction: z.number().positive().lt(1).nullable(),
  })
  .superRefine((configuration, context) => {
    if (configuration.promotionStatus === 'inProgress' && configuration.rolloutFraction === null) {
      context.addIssue({
        code: 'custom',
        message: 'A rollout fraction is required for an in-progress Google Play promotion.',
        path: ['rolloutFraction'],
      });
    }
    if (configuration.promotionStatus !== 'inProgress' && configuration.rolloutFraction !== null) {
      context.addIssue({
        code: 'custom',
        message: 'A rollout fraction can be used only with an in-progress promotion.',
        path: ['rolloutFraction'],
      });
    }
  });

export const googlePlaySetupConfigurationSchema = googlePlayBaseSchema.and(
  z.object({ serviceAccountPath: nonEmptyPathSchema }),
);

const retainedGooglePlaySetupConfigurationSchema = googlePlayBaseSchema.and(
  z.object({ serviceAccountPath: optionalPathSchema }),
);

export const googlePlayConfigurationSchema = googlePlayBaseSchema.and(
  z.object({
    hasServiceAccount: z.boolean(),
    serviceAccountFileName: z.string().trim().min(1).max(512),
  }),
);

const appStoreConnectBaseSchema = z.object({
  apiKeyId: z.string().trim().min(1).max(128).regex(/^[A-Z0-9]+$/u),
  issuerId: z.string().uuid(),
});

export const appStoreConnectSetupConfigurationSchema = appStoreConnectBaseSchema.extend({
  apiKeyPath: nonEmptyPathSchema,
});

const retainedAppStoreConnectSetupConfigurationSchema = appStoreConnectBaseSchema.extend({
  apiKeyPath: optionalPathSchema,
});

export const appStoreConnectConfigurationSchema = appStoreConnectBaseSchema.extend({
  apiKeyFileName: z.string().trim().min(1).max(512),
  hasApiKey: z.boolean(),
});

export const applicationReleaseConfigurationSchema = z.object({
  androidSigning: androidSigningConfigurationSchema.nullable(),
  appStoreConnect: appStoreConnectConfigurationSchema.nullable(),
  artifactGeneration: artifactGenerationConfigurationSchema,
  firebaseDistribution: firebaseDistributionConfigurationSchema,
  googlePlay: googlePlayConfigurationSchema.nullable(),
  iosSigning: iosSigningConfigurationSchema,
  shouldNotifyWhenFinished: z.boolean().default(false),
});

export const pipelineHookSchema = z.object({
  command: z.string().trim().min(1).max(8192),
  cwdPath: nonEmptyPathSchema,
  id: z.string().uuid(),
  isEnabled: z.boolean(),
  name: z.string().trim().min(1).max(80),
  phase: z.enum(['preBuild', 'postBuild', 'preUpload', 'postUpload']),
  platform: z.enum(['android', 'ios', 'all']),
});

export const createApplicationRequestSchema = z
  .object({
    android: androidConfigurationSchema.omit({ firebaseAppId: true }).nullable(),
    androidSigning: androidSigningSetupConfigurationSchema.nullable(),
    appStoreConnect: appStoreConnectSetupConfigurationSchema.nullable(),
    artifactGeneration: artifactGenerationConfigurationSchema,
    artifactOutputDirectoryPath: nonEmptyPathSchema.nullable(),
    distributionGroups: z.array(identifierSchema).max(50),
    firebaseDistribution: firebaseDistributionConfigurationSchema,
    firebaseProjectId: z.string().trim().max(256),
    googlePlay: googlePlaySetupConfigurationSchema.nullable(),
    hooks: z.array(pipelineHookSchema).max(24),
    iconDataUrl: applicationIconDataUrlSchema,
    ios: iosConfigurationSchema.omit({ firebaseAppId: true }).nullable(),
    iosSigning: iosSigningConfigurationSchema,
    name: z.string().trim().min(2).max(80),
    serviceAccountPath: optionalPathSchema,
    shouldNotifyWhenFinished: z.boolean(),
  })
  .superRefine((request, context) => {
    if (request.android === null && request.ios === null) {
      context.addIssue({ code: 'custom', message: 'At least one platform must be configured.' });
    }
    if (
      request.artifactGeneration.isEnabled &&
      request.android !== null &&
      request.artifactGeneration.androidArtifactTypes.length === 0
    ) {
      context.addIssue({ code: 'custom', message: 'Select at least one Android artifact type.', path: ['artifactGeneration', 'androidArtifactTypes'] });
    }
    const hasStoreDistribution = request.googlePlay !== null || request.appStoreConnect !== null;
    if (!request.artifactGeneration.isEnabled && !request.firebaseDistribution.isEnabled && !hasStoreDistribution) {
      context.addIssue({
        code: 'custom',
        message: 'Enable artifact generation, Firebase App Distribution, or Store Distribution.',
      });
    }
    if (request.firebaseDistribution.isEnabled) {
      if (request.serviceAccountPath === '') {
        context.addIssue({ code: 'custom', message: 'A Firebase service account is required.', path: ['serviceAccountPath'] });
      }
      if (request.distributionGroups.length === 0) {
        context.addIssue({ code: 'custom', message: 'At least one Firebase tester group is required.', path: ['distributionGroups'] });
      }
      if (request.android !== null && request.android.googleServicesJsonPath === null) {
        context.addIssue({ code: 'custom', message: 'google-services.json is required for Firebase Android distribution.', path: ['android', 'googleServicesJsonPath'] });
      }
      if (request.ios !== null && request.ios.googleServiceInfoPlistPath === null) {
        context.addIssue({ code: 'custom', message: 'GoogleService-Info.plist is required for Firebase iOS distribution.', path: ['ios', 'googleServiceInfoPlistPath'] });
      }
    }
    const needsAndroidSigning =
      request.android !== null &&
      (request.googlePlay !== null ||
        (request.artifactGeneration.isEnabled && request.artifactGeneration.requiresAndroidSigning) ||
        (request.firebaseDistribution.isEnabled && request.firebaseDistribution.requiresAndroidSigning));
    if (needsAndroidSigning && request.androidSigning === null) {
      context.addIssue({ code: 'custom', message: 'Android signing is required by the selected distribution configuration.', path: ['androidSigning'] });
    }
    const needsIosSigning =
      request.ios !== null &&
      (request.appStoreConnect !== null ||
        (request.artifactGeneration.isEnabled && request.artifactGeneration.requiresIosSigning) ||
        (request.firebaseDistribution.isEnabled && request.firebaseDistribution.requiresIosSigning));
    if (needsIosSigning && !request.iosSigning.isEnabled) {
      context.addIssue({ code: 'custom', message: 'Automatic iOS signing is required for IPA distribution.', path: ['iosSigning'] });
    }
    if (request.googlePlay !== null && request.android === null) {
      context.addIssue({ code: 'custom', message: 'Google Play distribution requires Android configuration.', path: ['googlePlay'] });
    }
    if (request.appStoreConnect !== null && request.ios === null) {
      context.addIssue({ code: 'custom', message: 'App Store Connect distribution requires iOS configuration.', path: ['appStoreConnect'] });
    }
  });

export const updateApplicationRequestSchema = z
  .object({
    android: createApplicationRequestSchema.shape.android,
    androidSigning: retainedAndroidSigningSetupConfigurationSchema.nullable(),
    appStoreConnect: retainedAppStoreConnectSetupConfigurationSchema.nullable(),
    artifactGeneration: createApplicationRequestSchema.shape.artifactGeneration,
    artifactOutputDirectoryPath: createApplicationRequestSchema.shape.artifactOutputDirectoryPath,
    distributionGroups: createApplicationRequestSchema.shape.distributionGroups,
    firebaseDistribution: createApplicationRequestSchema.shape.firebaseDistribution,
    firebaseProjectId: createApplicationRequestSchema.shape.firebaseProjectId,
    googlePlay: retainedGooglePlaySetupConfigurationSchema.nullable(),
    hooks: createApplicationRequestSchema.shape.hooks,
    iconDataUrl: createApplicationRequestSchema.shape.iconDataUrl,
    id: z.string().uuid(),
    ios: createApplicationRequestSchema.shape.ios,
    iosSigning: createApplicationRequestSchema.shape.iosSigning,
    name: createApplicationRequestSchema.shape.name,
    serviceAccountPath: nonEmptyPathSchema.nullable(),
    shouldNotifyWhenFinished: createApplicationRequestSchema.shape.shouldNotifyWhenFinished,
  })
  .superRefine((request, context) => {
    if (request.android === null && request.ios === null) {
      context.addIssue({ code: 'custom', message: 'At least one platform must be configured.' });
    }
    const hasStoreDistribution = request.googlePlay !== null || request.appStoreConnect !== null;
    if (!request.artifactGeneration.isEnabled && !request.firebaseDistribution.isEnabled && !hasStoreDistribution) {
      context.addIssue({ code: 'custom', message: 'Enable artifact generation, Firebase App Distribution, or Store Distribution.' });
    }
    if (request.firebaseDistribution.isEnabled) {
      if (request.distributionGroups.length === 0) {
        context.addIssue({ code: 'custom', message: 'At least one Firebase tester group is required.', path: ['distributionGroups'] });
      }
      if (request.android !== null && request.android.googleServicesJsonPath === null) {
        context.addIssue({ code: 'custom', message: 'google-services.json is required for Firebase Android distribution.', path: ['android', 'googleServicesJsonPath'] });
      }
      if (request.ios !== null && request.ios.googleServiceInfoPlistPath === null) {
        context.addIssue({ code: 'custom', message: 'GoogleService-Info.plist is required for Firebase iOS distribution.', path: ['ios', 'googleServiceInfoPlistPath'] });
      }
    }
    const needsAndroidSigning = request.android !== null && (
      request.googlePlay !== null ||
      (request.artifactGeneration.isEnabled && request.artifactGeneration.requiresAndroidSigning) ||
      (request.firebaseDistribution.isEnabled && request.firebaseDistribution.requiresAndroidSigning)
    );
    if (needsAndroidSigning && request.androidSigning === null) {
      context.addIssue({ code: 'custom', message: 'Android signing is required by the selected distribution configuration.', path: ['androidSigning'] });
    }
    const needsIosSigning = request.ios !== null && (
      request.appStoreConnect !== null ||
      (request.artifactGeneration.isEnabled && request.artifactGeneration.requiresIosSigning) ||
      (request.firebaseDistribution.isEnabled && request.firebaseDistribution.requiresIosSigning)
    );
    if (needsIosSigning && !request.iosSigning.isEnabled) {
      context.addIssue({ code: 'custom', message: 'Automatic iOS signing is required for IPA distribution.', path: ['iosSigning'] });
    }
    if (request.googlePlay !== null && request.android === null) {
      context.addIssue({ code: 'custom', message: 'Google Play distribution requires Android configuration.', path: ['googlePlay'] });
    }
    if (request.appStoreConnect !== null && request.ios === null) {
      context.addIssue({ code: 'custom', message: 'App Store Connect distribution requires iOS configuration.', path: ['appStoreConnect'] });
    }
    if (request.artifactGeneration.isEnabled && request.android !== null && request.artifactGeneration.androidArtifactTypes.length === 0) {
      context.addIssue({ code: 'custom', message: 'Select at least one Android artifact type.', path: ['artifactGeneration', 'androidArtifactTypes'] });
    }
  });

const releaseConfigurationSchema = z.object({
  androidArtifactPath: nonEmptyPathSchema.optional(),
  androidArtifactType: z.enum(['apk', 'aab']).optional(),
  artifactOutputDirectoryPath: nonEmptyPathSchema.optional(),
  artifactSigningPlatforms: z.array(z.enum(['android', 'ios'])).max(2).default([]),
  distributionGroups: z.array(identifierSchema).max(50),
  destinations: z.array(z.enum(['artifact', 'firebase', 'store'])).min(1).max(3),
  iosArtifactPath: nonEmptyPathSchema.optional(),
  mode: z.enum(['buildOnly', 'uploadOnly', 'buildAndUpload']),
  platforms: z.array(z.enum(['android', 'ios'])).min(1).max(2),
  releaseNotes: z.string().trim().max(5000),
  version: releaseVersionInputSchema.optional(),
});

type ReleaseConfigurationInput = z.infer<typeof releaseConfigurationSchema>;

const validateReleaseConfiguration = (
  request: ReleaseConfigurationInput,
  context: z.RefinementCtx,
): void => {
    const includesBuild = request.mode === 'buildOnly' || request.mode === 'buildAndUpload';
    if (new Set(request.platforms).size !== request.platforms.length) {
      context.addIssue({
        code: 'custom',
        message: 'The same platform cannot be selected more than once.',
        path: ['platforms'],
      });
    }
    if (new Set(request.destinations).size !== request.destinations.length) {
      context.addIssue({
        code: 'custom',
        message: 'The same destination cannot be selected more than once.',
        path: ['destinations'],
      });
    }
    if (new Set(request.artifactSigningPlatforms).size !== request.artifactSigningPlatforms.length) {
      context.addIssue({
        code: 'custom',
        message: 'The same artifact signing platform cannot be selected more than once.',
        path: ['artifactSigningPlatforms'],
      });
    }
    if (
      request.artifactSigningPlatforms.some(
        (signingPlatform) => !request.platforms.includes(signingPlatform),
      )
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Artifact signing can be enabled only for a selected platform.',
        path: ['artifactSigningPlatforms'],
      });
    }
    if (
      request.artifactSigningPlatforms.length > 0 &&
      (!includesBuild || !request.destinations.includes('artifact'))
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Artifact signing can be selected only when generating a local artifact.',
        path: ['artifactSigningPlatforms'],
      });
    }
    if (includesBuild && request.version === undefined) {
      context.addIssue({
        code: 'custom',
        message: 'Version configuration is required when building a new artifact.',
        path: ['version'],
      });
    }
    if (!includesBuild && request.version !== undefined) {
      context.addIssue({
        code: 'custom',
        message: 'Version configuration can be changed only when building a new artifact.',
        path: ['version'],
      });
    }
    if (
      includesBuild &&
      request.platforms.includes('android') &&
      request.version?.android === undefined
    ) {
      context.addIssue({
        code: 'custom',
        message: 'An Android version code is required for an Android build.',
        path: ['version', 'android'],
      });
    }
    if (
      includesBuild &&
      request.platforms.includes('ios') &&
      request.version?.ios === undefined
    ) {
      context.addIssue({
        code: 'custom',
        message: 'An iOS build number is required for an iOS build.',
        path: ['version', 'ios'],
      });
    }
    if (
      includesBuild &&
      !request.platforms.includes('android') &&
      request.version?.android !== undefined
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Android version configuration requires Android to be selected.',
        path: ['version', 'android'],
      });
    }
    if (
      includesBuild &&
      !request.platforms.includes('ios') &&
      request.version?.ios !== undefined
    ) {
      context.addIssue({
        code: 'custom',
        message: 'iOS version configuration requires iOS to be selected.',
        path: ['version', 'ios'],
      });
    }
    if (request.destinations.includes('firebase')) {
      if (request.distributionGroups.length === 0) {
        context.addIssue({
          code: 'custom',
          message: 'At least one tester group is required for Firebase distribution.',
          path: ['distributionGroups'],
        });
      }
      if (request.releaseNotes === '') {
        context.addIssue({
          code: 'custom',
          message: 'Release notes are required for Firebase distribution.',
          path: ['releaseNotes'],
        });
      }
    }
    if (request.destinations.includes('store') && request.releaseNotes === '') {
      context.addIssue({
        code: 'custom',
        message: 'Release notes are required for store distribution.',
        path: ['releaseNotes'],
      });
    }
    if (request.destinations.includes('artifact') && request.artifactOutputDirectoryPath === undefined) {
      context.addIssue({
        code: 'custom',
        message: 'An artifact output directory is required for a local build.',
        path: ['artifactOutputDirectoryPath'],
      });
    }
    if (request.mode === 'uploadOnly' && request.destinations.includes('artifact')) {
      context.addIssue({
        code: 'custom',
        message: 'Existing artifacts are already local and cannot use the artifact generation destination.',
        path: ['destinations'],
      });
    }
    if (
      request.mode === 'buildOnly' &&
      request.destinations.some((destination) => destination !== 'artifact')
    ) {
      context.addIssue({
        code: 'custom',
        message: 'A build-only pipeline can use only the local artifact destination.',
        path: ['destinations'],
      });
    }
    if (
      request.mode === 'buildAndUpload' &&
      request.destinations.every((destination) => destination === 'artifact')
    ) {
      context.addIssue({
        code: 'custom',
        message: 'A build-and-upload pipeline requires an upload destination.',
        path: ['destinations'],
      });
    }
  };

export const fastActionConfigurationSchema = releaseConfigurationSchema.superRefine(
  validateReleaseConfiguration,
);

export const createFastActionRequestSchema = z.object({
  applicationId: z.string().uuid(),
  configuration: fastActionConfigurationSchema,
  name: z.string().trim().min(2).max(80),
});

export const updateFastActionRequestSchema = createFastActionRequestSchema.extend({
  id: z.string().uuid(),
});

export const deleteFastActionRequestSchema = z.object({
  applicationId: z.string().uuid(),
  id: z.string().uuid(),
});

export const preflightReleaseRequestSchema = releaseConfigurationSchema
  .extend({ applicationId: z.string().uuid() })
  .superRefine(validateReleaseConfiguration);

export const updateArtifactOutputDirectoryRequestSchema = z.object({
  applicationId: z.string().uuid(),
  directoryPath: nonEmptyPathSchema,
});

export const updateApplicationIconRequestSchema = z.object({
  applicationId: z.string().uuid(),
  iconDataUrl: applicationIconDataUrlSchema,
});

export const applicationIdSchema = z.string().uuid();
export const fileSystemPermissionTargetSchema = z.enum([
  'controlledFolders',
  'fileSystem',
  'filesAndFolders',
  'fullDiskAccess',
]);
export const applicationListRequestSchema = z.object({
  cursor: z.object({
    id: z.string().uuid(),
    lastActivityAt: z.iso.datetime(),
  }).optional(),
  pageSize: z.number().int().min(1).max(50),
});
export const iosSchemeListRequestSchema = nonEmptyPathSchema;
export const iosProjectDiscoveryRequestSchema = nonEmptyPathSchema;
export const planIdSchema = z.string().uuid();
export const themePreferenceSchema = z.enum(['light', 'dark', 'system']);
