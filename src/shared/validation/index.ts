import { z } from 'zod';

const nonEmptyPathSchema = z.string().trim().min(1).max(4096);
const identifierSchema = z.string().trim().min(1).max(256);

export const androidConfigurationSchema = z.object({
  artifactPath: nonEmptyPathSchema,
  firebaseAppId: identifierSchema,
  googleServicesJsonPath: nonEmptyPathSchema,
  gradleTask: z.string().trim().min(1).max(160).regex(/^[:A-Za-z0-9_-]+$/u),
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
  args: z.array(z.string().max(4096)).max(64),
  cwdPath: nonEmptyPathSchema,
  executablePath: nonEmptyPathSchema,
  id: z.string().uuid(),
  isEnabled: z.boolean(),
  name: z.string().trim().min(1).max(80),
  phase: z.enum(['preBuild', 'postBuild', 'preUpload', 'postUpload']),
  platform: z.enum(['android', 'ios', 'all']),
});

export const createApplicationRequestSchema = z
  .object({
    android: androidConfigurationSchema.omit({ firebaseAppId: true }).nullable(),
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

export const preflightReleaseRequestSchema = z.object({
  androidArtifactPath: nonEmptyPathSchema.optional(),
  applicationId: z.string().uuid(),
  distributionGroups: z.array(identifierSchema).min(1).max(50),
  iosArtifactPath: nonEmptyPathSchema.optional(),
  mode: z.enum(['buildOnly', 'uploadOnly', 'buildAndUpload']),
  platforms: z.array(z.enum(['android', 'ios'])).min(1).max(2),
  releaseNotes: z.string().trim().min(1).max(5000),
});

export const applicationIdSchema = z.string().uuid();
export const planIdSchema = z.string().uuid();
export const themePreferenceSchema = z.enum(['light', 'dark', 'system']);
