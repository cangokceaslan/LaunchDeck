import { z } from 'zod';

const nonEmptyPathSchema = z.string().trim().min(1).max(4096);
const identifierSchema = z.string().trim().min(1).max(256);
const gradleTaskSchema = z.string().trim().min(1).max(160).regex(/^[:A-Za-z0-9_-]+$/u);

export const androidConfigurationSchema = z.object({
  aabArtifactPath: nonEmptyPathSchema.default('app/build/outputs/bundle/release/app-release.aab'),
  aabGradleTask: gradleTaskSchema.default(':app:bundleRelease'),
  artifactPath: nonEmptyPathSchema,
  defaultArtifactType: z.enum(['apk', 'aab']).default('apk'),
  firebaseAppId: identifierSchema,
  googleServicesJsonPath: nonEmptyPathSchema,
  gradleTask: gradleTaskSchema,
  projectPath: nonEmptyPathSchema,
});

export const iosConfigurationSchema = z.object({
  artifactPath: nonEmptyPathSchema,
  configuration: z.string().trim().min(1).max(120),
  exportMethod: z.enum(['release-testing', 'enterprise', 'development']),
  firebaseAppId: identifierSchema,
  googleServiceInfoPlistPath: nonEmptyPathSchema,
  projectPath: nonEmptyPathSchema,
  scheme: z.string().trim().min(1).max(160),
  workspaceOrProjectPath: nonEmptyPathSchema,
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
    artifactOutputDirectoryPath: nonEmptyPathSchema.nullable(),
    distributionGroups: z.array(identifierSchema).min(1).max(50),
    firebaseProjectId: z.string().trim().max(256),
    hooks: z.array(pipelineHookSchema).max(24),
    ios: iosConfigurationSchema.omit({ firebaseAppId: true }).nullable(),
    name: z.string().trim().min(2).max(80),
    serviceAccountPath: nonEmptyPathSchema,
  })
  .refine((request) => request.android !== null || request.ios !== null, {
    message: 'At least one platform must be configured.',
  });

export const updateApplicationRequestSchema = z
  .object({
    android: createApplicationRequestSchema.shape.android,
    artifactOutputDirectoryPath: createApplicationRequestSchema.shape.artifactOutputDirectoryPath,
    distributionGroups: createApplicationRequestSchema.shape.distributionGroups,
    firebaseProjectId: createApplicationRequestSchema.shape.firebaseProjectId,
    hooks: createApplicationRequestSchema.shape.hooks,
    id: z.string().uuid(),
    ios: createApplicationRequestSchema.shape.ios,
    name: createApplicationRequestSchema.shape.name,
    serviceAccountPath: nonEmptyPathSchema.nullable(),
  })
  .refine((request) => request.android !== null || request.ios !== null, {
    message: 'At least one platform must be configured.',
  });

export const preflightReleaseRequestSchema = z
  .object({
    androidArtifactPath: nonEmptyPathSchema.optional(),
    androidArtifactType: z.enum(['apk', 'aab']).optional(),
    applicationId: z.string().uuid(),
    artifactOutputDirectoryPath: nonEmptyPathSchema.optional(),
    distributionGroups: z.array(identifierSchema).max(50),
    iosArtifactPath: nonEmptyPathSchema.optional(),
    mode: z.enum(['buildOnly', 'uploadOnly', 'buildAndUpload']),
    platforms: z.array(z.enum(['android', 'ios'])).min(1).max(2),
    releaseNotes: z.string().trim().max(5000),
  })
  .superRefine((request, context) => {
    if (request.mode !== 'buildOnly') {
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
    if (request.mode === 'buildOnly' && request.artifactOutputDirectoryPath === undefined) {
      context.addIssue({
        code: 'custom',
        message: 'An artifact output directory is required for a local build.',
        path: ['artifactOutputDirectoryPath'],
      });
    }
  });

export const updateArtifactOutputDirectoryRequestSchema = z.object({
  applicationId: z.string().uuid(),
  directoryPath: nonEmptyPathSchema,
});

export const applicationIdSchema = z.string().uuid();
export const iosSchemeListRequestSchema = nonEmptyPathSchema;
export const planIdSchema = z.string().uuid();
export const themePreferenceSchema = z.enum(['light', 'dark', 'system']);
