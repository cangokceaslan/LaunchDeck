import { useState } from 'react';
import { Alert, Button, Form, InputGroup, Spinner } from 'react-bootstrap';
import { HookEditor } from '@components/HookEditor';
import { Select } from '@components/Inputs/Select';
import { Switch } from '@components/Inputs/Switch';
import { PathField } from '@components/PathField';
import { useAndroidProjectConfiguration } from '@hooks/useAndroidProjectConfiguration';
import { useIosProjectConfiguration } from '@hooks/useIosProjectConfiguration';
import { normalizeErrorMessage } from '@renderer/utils/formatting';
import type {
  AndroidSetupConfiguration,
  ApplicationDetail,
  CreateApplicationRequest,
  IosSetupConfiguration,
  UpdateApplicationRequest,
} from '@shared/contracts/domain';
import type { ApplicationSetupProps } from '@screens/ApplicationSetup/index.types';
import styles from '@screens/ApplicationSetup/index.module.scss';

const defaultAndroid = (): AndroidSetupConfiguration => ({
  aabArtifactPath: 'app/build/outputs/bundle/release/app-release.aab',
  aabGradleTask: ':app:bundleRelease',
  artifactPath: 'app/build/outputs/apk/release/app-release.apk',
  defaultArtifactType: 'apk',
  googleServicesJsonPath: '',
  gradleTask: ':app:assembleRelease',
  projectPath: '',
});

const defaultIos = (): IosSetupConfiguration => ({
  artifactPath: 'release/application.ipa',
  bundleIdentifier: '',
  configuration: 'Release',
  exportMethod: 'release-testing',
  googleServiceInfoPlistPath: '',
  projectPath: '',
  scheme: '',
  workspaceOrProjectPath: '',
});

const defaultAndroidSigning = (): NonNullable<CreateApplicationRequest['androidSigning']> => ({
  keyAlias: '',
  keyPassword: '',
  keystorePath: '',
  storePassword: '',
});

const defaultGooglePlay = (): NonNullable<CreateApplicationRequest['googlePlay']> => ({
  artifactType: 'aab',
  initialTrack: 'internal',
  packageName: '',
  promoteAfterUpload: false,
  promotionStatus: 'completed',
  promotionTrack: 'production',
  releaseNotesLanguage: 'en-US',
  rolloutFraction: null,
  serviceAccountPath: '',
});

const defaultAppStoreConnect = (): NonNullable<CreateApplicationRequest['appStoreConnect']> => ({
  apiKeyId: '',
  apiKeyPath: '',
  issuerId: '',
});

const isIosExportMethod = (
  value: string,
): value is IosSetupConfiguration['exportMethod'] =>
  value === 'release-testing' || value === 'enterprise' || value === 'development';

const createInitialForm = (application: ApplicationDetail | null): CreateApplicationRequest => ({
  android:
    application?.android === undefined
      ? defaultAndroid()
      : application.android === null
        ? null
        : {
            aabArtifactPath: application.android.aabArtifactPath,
            aabGradleTask: application.android.aabGradleTask,
            artifactPath: application.android.artifactPath,
            defaultArtifactType: application.android.defaultArtifactType,
            googleServicesJsonPath: application.android.googleServicesJsonPath ?? '',
            gradleTask: application.android.gradleTask,
            projectPath: application.android.projectPath,
          },
  androidSigning: application?.androidSigning === null || application?.androidSigning === undefined
    ? null
    : { keyAlias: application.androidSigning.keyAlias, keyPassword: '', keystorePath: '', storePassword: '' },
  appStoreConnect: application?.appStoreConnect === null || application?.appStoreConnect === undefined
    ? null
    : {
        apiKeyId: application.appStoreConnect.apiKeyId,
        apiKeyPath: '',
        issuerId: application.appStoreConnect.issuerId,
      },
  artifactGeneration: application?.artifactGeneration ?? {
    androidArtifactTypes: ['apk', 'aab'],
    isEnabled: true,
    isIosIpaEnabled: true,
    requiresAndroidSigning: true,
    requiresIosSigning: false,
  },
  artifactOutputDirectoryPath: application?.artifactOutputDirectoryPath ?? null,
  distributionGroups: application?.distributionGroups ?? ['internal-testers'],
  firebaseDistribution: application?.firebaseDistribution ?? {
    isEnabled: true,
    requiresAndroidSigning: true,
    requiresIosSigning: false,
  },
  firebaseProjectId: application?.firebaseProjectId ?? '',
  hooks: application?.hooks ?? [],
  ios:
    application?.ios === undefined
      ? null
      : application.ios === null
        ? null
        : {
            artifactPath: application.ios.artifactPath,
            bundleIdentifier: application.ios.bundleIdentifier,
            configuration: application.ios.configuration,
            exportMethod: application.ios.exportMethod,
            googleServiceInfoPlistPath: application.ios.googleServiceInfoPlistPath ?? '',
            projectPath: application.ios.projectPath,
            scheme: application.ios.scheme,
            workspaceOrProjectPath: application.ios.workspaceOrProjectPath,
          },
  name: application?.name ?? '',
  googlePlay: application?.googlePlay === null || application?.googlePlay === undefined
    ? null
    : {
        artifactType: application.googlePlay.artifactType,
        initialTrack: application.googlePlay.initialTrack,
        packageName: application.googlePlay.packageName,
        promoteAfterUpload: application.googlePlay.promoteAfterUpload,
        promotionStatus: application.googlePlay.promotionStatus,
        promotionTrack: application.googlePlay.promotionTrack,
        releaseNotesLanguage: application.googlePlay.releaseNotesLanguage,
        rolloutFraction: application.googlePlay.rolloutFraction,
        serviceAccountPath: '',
      },
  iosSigning: application?.iosSigning ?? { developmentTeamId: '', isEnabled: true },
  serviceAccountPath: '',
  shouldNotifyWhenFinished: application?.shouldNotifyWhenFinished ?? false,
});

export const ApplicationSetup = ({
  application,
  onCancel,
  onSaved,
  supportedPlatforms,
}: ApplicationSetupProps): React.JSX.Element => {
  const [form, setForm] = useState<CreateApplicationRequest>(() => createInitialForm(application));
  const [groupsText, setGroupsText] = useState(form.distributionGroups.join(', '));
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const {
    error: androidProjectMetadataError,
    isLoading: isLoadingAndroidProjectMetadata,
    reset: resetAndroidProjectMetadata,
    resolveProjectMetadata: resolveAndroidProjectMetadata,
  } = useAndroidProjectConfiguration();
  const {
    developmentTeamError: iosDevelopmentTeamError,
    isLoadingDevelopmentTeam: isLoadingIosDevelopmentTeam,
    isLoadingSchemes: isLoadingIosSchemes,
    loadSchemes,
    reset: resetIosProjectConfiguration,
    resetDevelopmentTeam: resetIosDevelopmentTeam,
    resolveProjectMetadata,
    schemeError: iosSchemeError,
    schemes: iosSchemes,
  } = useIosProjectConfiguration();
  const needsAndroidSigning = form.android !== null && (
    form.googlePlay !== null ||
    (form.artifactGeneration.isEnabled && (
      form.artifactGeneration.requiresAndroidSigning ||
      form.artifactGeneration.androidArtifactTypes.includes('aab')
    )) ||
    (form.firebaseDistribution.isEnabled && form.firebaseDistribution.requiresAndroidSigning)
  );
  const needsIosSigning = form.ios !== null && (
    form.appStoreConnect !== null ||
    (form.artifactGeneration.isEnabled && form.artifactGeneration.requiresIosSigning) ||
    (form.firebaseDistribution.isEnabled && form.firebaseDistribution.requiresIosSigning)
  );
  const availableIosSchemes = iosSchemes.length > 0
    ? iosSchemes
    : form.ios?.scheme === undefined || form.ios.scheme === ''
      ? []
      : [form.ios.scheme];

  const choosePath = async (
    picker: () => Promise<{ status: 'cancelled' } | { path: string; status: 'selected' }>,
    applyPath: (selectedPath: string) => void,
  ): Promise<void> => {
    const result = await picker();
    if (result.status === 'selected') applyPath(result.path);
  };

  const updateAndroid = (patch: Partial<AndroidSetupConfiguration>): void => {
    setForm((current) => ({
      ...current,
      android: { ...(current.android ?? defaultAndroid()), ...patch },
    }));
  };

  const updateIos = (patch: Partial<IosSetupConfiguration>): void => {
    setForm((current) => ({ ...current, ios: { ...(current.ios ?? defaultIos()), ...patch } }));
  };

  const updateGooglePlay = (
    patch: Partial<NonNullable<CreateApplicationRequest['googlePlay']>>,
  ): void => {
    setForm((current) => ({
      ...current,
      googlePlay: { ...(current.googlePlay ?? defaultGooglePlay()), ...patch },
    }));
  };

  const loadAndroidProjectMetadata = async (
    projectPath: string,
    googleServicesJsonPath: string | null,
    gradleTask: string,
  ): Promise<void> => {
    const metadata = await resolveAndroidProjectMetadata({
      googleServicesJsonPath,
      gradleTask,
      projectPath,
    });
    if (metadata === null) return;
    setForm((current) => {
      if (
        current.android === null ||
        current.android.projectPath !== projectPath ||
        current.android.gradleTask !== gradleTask ||
        (current.android.googleServicesJsonPath ?? '') !== (googleServicesJsonPath ?? '')
      ) {
        return current;
      }
      return {
        ...current,
        android: {
          ...current.android,
          googleServicesJsonPath:
            current.firebaseDistribution.isEnabled && metadata.googleServicesJsonPath !== null
              ? metadata.googleServicesJsonPath
              : current.android.googleServicesJsonPath,
        },
        googlePlay:
          current.googlePlay === null || metadata.packageName === null
            ? current.googlePlay
            : { ...current.googlePlay, packageName: metadata.packageName },
        firebaseProjectId:
          current.firebaseDistribution.isEnabled && metadata.firebaseProjectId !== null
            ? metadata.firebaseProjectId
            : current.firebaseProjectId,
      };
    });
  };

  const chooseAndroidProject = async (): Promise<void> => {
    const result = await window.desktopApi.chooseAndroidProjectDirectory();
    if (result.status !== 'selected') return;
    const currentAndroid = form.android ?? defaultAndroid();
    setForm((current) => ({
      ...current,
      android: {
        ...(current.android ?? defaultAndroid()),
        googleServicesJsonPath: current.firebaseDistribution.isEnabled ? '' : null,
        projectPath: result.path,
      },
      googlePlay: current.googlePlay === null
        ? null
        : { ...current.googlePlay, packageName: '' },
    }));
    await loadAndroidProjectMetadata(result.path, null, currentAndroid.gradleTask);
  };

  const chooseGoogleServicesJson = async (): Promise<void> => {
    const result = await window.desktopApi.chooseGoogleServicesJson();
    if (result.status !== 'selected' || form.android === null) return;
    const { gradleTask, projectPath } = form.android;
    setForm((current) => ({
      ...current,
      android: current.android === null
        ? null
        : { ...current.android, googleServicesJsonPath: result.path },
      googlePlay: current.googlePlay === null
        ? null
        : { ...current.googlePlay, packageName: '' },
    }));
    if (projectPath !== '') {
      await loadAndroidProjectMetadata(projectPath, result.path, gradleTask);
    }
  };

  const handleGooglePlayEnabledChange = (isEnabled: boolean): void => {
    setForm((current) => ({
      ...current,
      googlePlay: isEnabled && current.android !== null
        ? current.googlePlay ?? defaultGooglePlay()
        : null,
    }));
    if (isEnabled && form.android !== null && form.android.projectPath !== '') {
      void loadAndroidProjectMetadata(
        form.android.projectPath,
        form.android.googleServicesJsonPath,
        form.android.gradleTask,
      );
    }
  };

  const handleAppStoreConnectEnabledChange = (isEnabled: boolean): void => {
    setForm((current) => ({
      ...current,
      appStoreConnect: isEnabled && current.ios !== null
        ? current.appStoreConnect ?? defaultAppStoreConnect()
        : null,
    }));
  };

  const handleFirebaseEnabledChange = (isEnabled: boolean): void => {
    setForm((current) => ({
      ...current,
      firebaseDistribution: { ...current.firebaseDistribution, isEnabled },
    }));
    if (!isEnabled) return;
    const androidConfiguration = form.android;
    if (androidConfiguration !== null && androidConfiguration.projectPath !== '') {
      void loadAndroidProjectMetadata(
        androidConfiguration.projectPath,
        androidConfiguration.googleServicesJsonPath,
        androidConfiguration.gradleTask,
      );
    }
    const iosConfiguration = form.ios;
    if (
      iosConfiguration !== null &&
      iosConfiguration.projectPath !== '' &&
      (iosConfiguration.googleServiceInfoPlistPath ?? '') === ''
    ) {
      void window.desktopApi
        .discoverIosProjectConfiguration(iosConfiguration.projectPath)
        .then((discovery) => {
          if (discovery.googleServiceInfoPlistPath === null) return;
          setForm((current) => current.ios === null ||
            current.ios.projectPath !== iosConfiguration.projectPath
            ? current
            : {
                ...current,
                ios: {
                  ...current.ios,
                  googleServiceInfoPlistPath: discovery.googleServiceInfoPlistPath,
                },
                firebaseProjectId:
                  discovery.firebaseProjectId ?? current.firebaseProjectId,
              });
        })
        .catch((error: unknown) => setErrorMessage(normalizeErrorMessage(error)));
    }
  };

  const chooseAppStoreConnectApiKey = async (): Promise<void> => {
    const result = await window.desktopApi.chooseAppStoreConnectApiKey();
    if (result.status !== 'selected') return;
    const detectedApiKeyId = /^AuthKey_([A-Z0-9]+)\.p8$/u.exec(result.fileName)?.[1];
    setForm((current) => current.appStoreConnect === null
      ? current
      : {
          ...current,
          appStoreConnect: {
            ...current.appStoreConnect,
            apiKeyId: detectedApiKeyId ?? current.appStoreConnect.apiKeyId,
            apiKeyPath: result.path,
          },
        });
  };

  const loadIosDevelopmentTeam = async (
    workspaceOrProjectPath: string,
    scheme: string,
    configuration: string,
  ): Promise<void> => {
    const projectMetadata = await resolveProjectMetadata({
      configuration,
      scheme,
      workspaceOrProjectPath,
    });
    if (projectMetadata === null) return;
    setForm((current) => {
      if (
        current.ios === null ||
        current.ios.workspaceOrProjectPath !== workspaceOrProjectPath ||
        current.ios.scheme !== scheme ||
        current.ios.configuration !== configuration
      ) {
        return current;
      }
      return {
        ...current,
        ios: { ...current.ios, bundleIdentifier: projectMetadata.bundleIdentifier },
        iosSigning: {
          ...current.iosSigning,
          developmentTeamId: projectMetadata.developmentTeamId,
        },
      };
    });
  };

  const loadIosSchemes = async (
    workspaceOrProjectPath: string,
    preferredScheme: string,
    configuration: string,
  ): Promise<void> => {
    const schemes = await loadSchemes(workspaceOrProjectPath);
    if (schemes === null) return;
    const scheme = schemes.includes(preferredScheme) ? preferredScheme : (schemes[0] ?? '');
    setForm((current) => {
      if (current.ios === null || current.ios.workspaceOrProjectPath !== workspaceOrProjectPath) {
        return current;
      }
      return {
        ...current,
        ios: {
          ...current.ios,
          bundleIdentifier: current.ios.scheme === scheme
            ? current.ios.bundleIdentifier
            : '',
          scheme,
        },
        iosSigning: current.ios.scheme === scheme
          ? current.iosSigning
          : { ...current.iosSigning, developmentTeamId: '' },
      };
    });
    if (scheme !== '') {
      void loadIosDevelopmentTeam(workspaceOrProjectPath, scheme, configuration);
    }
  };

  const chooseIosWorkspaceOrProject = async (): Promise<void> => {
    const result = await window.desktopApi.chooseIosWorkspaceOrProject();
    if (result.status !== 'selected') return;
    const configuration = form.ios?.configuration ?? defaultIos().configuration;
    setForm((current) => ({
      ...current,
      ios: {
        ...(current.ios ?? defaultIos()),
        bundleIdentifier: '',
        scheme: '',
        workspaceOrProjectPath: result.path,
      },
      iosSigning: { ...current.iosSigning, developmentTeamId: '' },
    }));
    await loadIosSchemes(result.path, '', configuration);
  };

  const chooseIosProject = async (): Promise<void> => {
    const result = await window.desktopApi.chooseIosProjectDirectory();
    if (result.status !== 'selected') return;
    resetIosProjectConfiguration();
    const configuration = form.ios?.configuration ?? defaultIos().configuration;
    setForm((current) => ({
      ...current,
      ios: {
        ...(current.ios ?? defaultIos()),
        bundleIdentifier: '',
        googleServiceInfoPlistPath: current.firebaseDistribution.isEnabled ? '' : null,
        projectPath: result.path,
        scheme: '',
        workspaceOrProjectPath: '',
      },
      iosSigning: { ...current.iosSigning, developmentTeamId: '' },
    }));
    try {
      const discovery = await window.desktopApi.discoverIosProjectConfiguration(result.path);
      setForm((current) => current.ios === null || current.ios.projectPath !== result.path
        ? current
        : {
            ...current,
            ios: {
              ...current.ios,
              googleServiceInfoPlistPath:
                current.firebaseDistribution.isEnabled &&
                discovery.googleServiceInfoPlistPath !== null
                  ? discovery.googleServiceInfoPlistPath
                  : current.ios.googleServiceInfoPlistPath,
              workspaceOrProjectPath:
                discovery.workspaceOrProjectPath ?? current.ios.workspaceOrProjectPath,
            },
            firebaseProjectId:
              current.firebaseDistribution.isEnabled && discovery.firebaseProjectId !== null
                ? discovery.firebaseProjectId
                : current.firebaseProjectId,
          });
      if (discovery.workspaceOrProjectPath !== null) {
        await loadIosSchemes(discovery.workspaceOrProjectPath, '', configuration);
      }
    } catch (error) {
      setErrorMessage(normalizeErrorMessage(error));
    }
  };

  const handleIosSchemeChange = (scheme: string): void => {
    const iosConfiguration = form.ios;
    if (iosConfiguration === null) return;
    setForm((current) => ({
      ...current,
      ios: current.ios === null ? null : { ...current.ios, bundleIdentifier: '', scheme },
      iosSigning: { ...current.iosSigning, developmentTeamId: '' },
    }));
    if (scheme !== '') {
      void loadIosDevelopmentTeam(
        iosConfiguration.workspaceOrProjectPath,
        scheme,
        iosConfiguration.configuration,
      );
    }
  };

  const handleIosConfigurationChange = (configuration: string): void => {
    resetIosDevelopmentTeam();
    setForm((current) => ({
      ...current,
      ios: current.ios === null
        ? null
        : { ...current.ios, bundleIdentifier: '', configuration },
      iosSigning: { ...current.iosSigning, developmentTeamId: '' },
    }));
  };

  const handleIosEnabledChange = (isEnabled: boolean): void => {
    resetIosProjectConfiguration();
    setForm((current) => ({
      ...current,
      appStoreConnect: isEnabled ? current.appStoreConnect : null,
      ios: isEnabled ? defaultIos() : null,
      iosSigning: { ...current.iosSigning, developmentTeamId: '' },
    }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setErrorMessage(null);
    setIsSaving(true);
    const normalizedGroups = groupsText
      .split(',')
      .map((group) => group.trim())
      .filter(Boolean);
    try {
      const savedApplication =
        application === null
          ? await window.desktopApi.createApplication({ ...form, distributionGroups: normalizedGroups })
          : await window.desktopApi.updateApplication({
              ...form,
              distributionGroups: normalizedGroups,
              id: application.id,
              serviceAccountPath: form.serviceAccountPath || null,
            } satisfies UpdateApplicationRequest);
      onSaved(savedApplication);
    } catch (error) {
      setErrorMessage(normalizeErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <span className={styles.eyebrow}>{application === null ? 'Initial setup' : application.name}</span>
          <h1>{application === null ? 'Add application' : 'Edit setup'}</h1>
          <p>
            {application === null
              ? 'Connect the project resources once, then reuse the saved configuration for future releases.'
              : 'Review the current configuration. Only the fields you change will be updated.'}
          </p>
        </div>
      </header>

      <Form onSubmit={(event) => void handleSubmit(event)}>
        <section className={styles.section}>
          <header><span>01</span><div><h2>Application and destinations</h2><p>Enable only the release outcomes this project uses</p></div></header>
          <div className={styles.sectionBody}>
            <Form.Group className={styles.applicationNameField}>
                <Form.Label>Application name</Form.Label>
                <Form.Control
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="e.g. Mobile App"
                  required
                  value={form.name}
                />
                <Form.Text>Used to identify this saved configuration and its release history.</Form.Text>
            </Form.Group>
            <div className={styles.outcomeGrid}>
              <Switch checked={form.artifactGeneration.isEnabled} description="Generate APK, AAB, or IPA output." label="Artifact generation" onChange={(isEnabled) => setForm((current) => ({ ...current, artifactGeneration: { ...current.artifactGeneration, isEnabled } }))} />
              <Switch checked={form.firebaseDistribution.isEnabled} description="Send builds to configured tester groups." label="Firebase App Distribution" onChange={handleFirebaseEnabledChange} />
              <Switch checked={form.googlePlay !== null} description="Upload Android releases and manage Play tracks." disabled={form.android === null} label="Google Play" onChange={handleGooglePlayEnabledChange} />
              <Switch checked={form.appStoreConnect !== null} description="Upload signed iOS archives for TestFlight processing." disabled={form.ios === null} label="App Store Connect" onChange={handleAppStoreConnectEnabledChange} />
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <header><span>02</span><div><h2>Platforms</h2><p>Project and platform integration</p></div></header>
          <div className={styles.sectionBody}>
            <div className={styles.platformToggle}>
              <Switch
                checked={form.android !== null}
                description="Enables Gradle builds plus Android artifact and distribution settings."
                label="Use Android"
                onChange={(isEnabled) => setForm((current) => ({
                  ...current,
                  android: isEnabled ? defaultAndroid() : null,
                  googlePlay: isEnabled ? current.googlePlay : null,
                }))}
              />
              <Switch
                checked={form.ios !== null}
                description="Enables Xcode archive, IPA, and iOS distribution settings."
                disabled={!supportedPlatforms.includes('ios')}
                label="Use iOS (macOS only)"
                onChange={handleIosEnabledChange}
              />
            </div>

            {form.android !== null && (
              <div className={styles.platformPanel}>
                <h3>Android</h3>
                <PathField helpText="Select the Android project root that contains the Gradle wrapper and application module." label="Android application directory" onBrowse={() => void chooseAndroidProject()} required value={form.android.projectPath} />
              </div>
            )}

            {form.ios !== null && (
              <div className={styles.platformPanel}>
                <h3>iOS</h3>
                <PathField helpText="Select the repository directory used as the working directory for Xcode commands. Workspace/project, Firebase plist, schemes, Bundle ID, and Team ID are discovered after this directory changes." label="iOS application directory" onBrowse={() => void chooseIosProject()} required value={form.ios.projectPath} />
                <PathField helpText="Select the .xcworkspace when CocoaPods or workspace dependencies are used; otherwise select the .xcodeproj." label="Xcode workspace / project" onBrowse={() => void chooseIosWorkspaceOrProject()} required value={form.ios.workspaceOrProjectPath} />
                <div className={styles.threeColumns}>
                  <Form.Group>
                    <Form.Label>Scheme</Form.Label>
                    <InputGroup className={styles.schemeInputGroup}>
                      <Select
                        aria-describedby="ios-scheme-feedback"
                        disabled={isLoadingIosSchemes || availableIosSchemes.length === 0}
                        onChange={(event) => handleIosSchemeChange(event.target.value)}
                        required
                        value={form.ios.scheme}
                      >
                        {availableIosSchemes.length === 0 && (
                          <option value="">{isLoadingIosSchemes ? 'Loading schemes…' : 'Select a workspace or project'}</option>
                        )}
                        {availableIosSchemes.map((scheme) => <option key={scheme} value={scheme}>{scheme}</option>)}
                      </Select>
                      <Button
                        aria-label="Refresh Xcode scheme list"
                        disabled={isLoadingIosSchemes || form.ios.workspaceOrProjectPath === ''}
                        onClick={() => {
                          const iosConfiguration = form.ios;
                          if (iosConfiguration !== null) {
                            void loadIosSchemes(
                              iosConfiguration.workspaceOrProjectPath,
                              iosConfiguration.scheme,
                              iosConfiguration.configuration,
                            );
                          }
                        }}
                        type="button"
                        variant="outline-secondary"
                      >
                        {isLoadingIosSchemes ? <Spinner animation="border" size="sm" /> : 'Refresh'}
                      </Button>
                    </InputGroup>
                    <Form.Text className={iosSchemeError === null ? undefined : styles.fieldError} id="ios-scheme-feedback">
                      {iosSchemeError ?? 'Schemes are loaded automatically from the selected Xcode project.'}
                    </Form.Text>
                  </Form.Group>
                  <Form.Group><Form.Label>Configuration</Form.Label><Form.Control onBlur={(event) => { const iosConfiguration = form.ios; if (iosConfiguration !== null && event.currentTarget.value !== '') void loadIosDevelopmentTeam(iosConfiguration.workspaceOrProjectPath, iosConfiguration.scheme, event.currentTarget.value); }} onChange={(event) => handleIosConfigurationChange(event.target.value)} required value={form.ios.configuration} /><Form.Text>The Xcode build configuration used for archive and export, usually Release.</Form.Text></Form.Group>
                  <Form.Group><Form.Label>Export method</Form.Label><Select onChange={(event) => { if (isIosExportMethod(event.target.value)) updateIos({ exportMethod: event.target.value }); }} value={form.ios.exportMethod}><option value="release-testing">Release testing</option><option value="enterprise">Enterprise</option><option value="development">Development</option></Select><Form.Text>Controls the provisioning profile and distribution type used for the IPA export.</Form.Text></Form.Group>
                </div>
              </div>
            )}
          </div>
        </section>

        {form.firebaseDistribution.isEnabled && (
          <section className={styles.section}>
            <header><span>03</span><div><h2>Firebase App Distribution</h2><p>Firebase credentials and tester groups</p></div></header>
            <div className={styles.sectionBody}>
              <div className={styles.twoColumns}>
                <Form.Group>
                  <Form.Label>Firebase Project ID</Form.Label>
                  <Form.Control onChange={(event) => setForm((current) => ({ ...current, firebaseProjectId: event.target.value }))} placeholder="Can be detected from the service account" value={form.firebaseProjectId} />
                  <Form.Text>Must match the selected service account and both platform configuration files.</Form.Text>
                </Form.Group>
                <Form.Group>
                  <Form.Label>Tester group aliases</Form.Label>
                  <Form.Control onChange={(event) => setGroupsText(event.target.value)} required value={groupsText} />
                  <Form.Text>Separate aliases with commas.</Form.Text>
                </Form.Group>
              </div>
              <PathField
                helpText={application === null ? 'The path is encrypted using secure operating system storage.' : `Current: ${application.serviceAccountFileName || 'not configured'}. Leave empty to keep it.`}
                label="Firebase Service Account JSON"
                onBrowse={() => void choosePath(window.desktopApi.chooseServiceAccountFile, (selectedPath) => setForm((current) => ({ ...current, serviceAccountPath: selectedPath })))}
                placeholder={application === null ? 'Not selected yet' : 'The existing file will be kept'}
                required={application === null || !application.hasServiceAccount}
                value={form.serviceAccountPath}
              />
              <div className={styles.firebasePlatformGrid}>
                {form.android !== null && (
                  <article className={styles.firebasePlatformPanel}>
                    <header>
                      <h3>Android</h3>
                      <p>Firebase Android application identity and artifact policy</p>
                    </header>
                    <PathField
                      helpText="Select the Firebase Android configuration file for this exact application. Its App ID and project metadata are validated before distribution."
                      label="google-services.json"
                      onBrowse={() => void chooseGoogleServicesJson()}
                      required
                      value={form.android.googleServicesJsonPath ?? ''}
                    />
                    <Switch
                      checked={form.firebaseDistribution.requiresAndroidSigning}
                      description="Reject an unsigned or invalid APK/AAB before it is uploaded to Firebase tester groups."
                      label="Require signed Android artifacts"
                      onChange={(requiresAndroidSigning) => setForm((current) => ({ ...current, firebaseDistribution: { ...current.firebaseDistribution, requiresAndroidSigning } }))}
                    />
                  </article>
                )}
                {form.ios !== null && (
                  <article className={styles.firebasePlatformPanel}>
                    <header>
                      <h3>iOS</h3>
                      <p>Firebase iOS application identity and artifact policy</p>
                    </header>
                    <PathField
                      helpText="Select the Firebase iOS configuration file for this exact application. Its App ID and project metadata are validated before distribution."
                      label="GoogleService-Info.plist"
                      onBrowse={() => void choosePath(window.desktopApi.chooseGoogleServiceInfoPlist, (googleServiceInfoPlistPath) => updateIos({ googleServiceInfoPlistPath }))}
                      required
                      value={form.ios.googleServiceInfoPlistPath ?? ''}
                    />
                    <Switch
                      checked={form.firebaseDistribution.requiresIosSigning}
                      description="Reject an unsigned or invalid IPA before it is uploaded to Firebase tester groups."
                      label="Require signed iOS artifacts"
                      onChange={(requiresIosSigning) => setForm((current) => ({ ...current, firebaseDistribution: { ...current.firebaseDistribution, requiresIosSigning } }))}
                    />
                  </article>
                )}
              </div>
            </div>
          </section>
        )}

        {form.artifactGeneration.isEnabled && (
        <section className={styles.section}>
          <header><span>04</span><div><h2>Build artifacts</h2><p>APK, AAB, and IPA output configuration</p></div></header>
          <div className={styles.sectionBody}>
            <PathField
              helpText="Optional default used when a pipeline saves generated artifacts locally."
              label="Local artifact output directory"
              onBrowse={() => void choosePath(window.desktopApi.chooseArtifactOutputDirectory, (artifactOutputDirectoryPath) => setForm((current) => ({ ...current, artifactOutputDirectoryPath })))}
              onChange={(artifactOutputDirectoryPath) => setForm((current) => ({ ...current, artifactOutputDirectoryPath: artifactOutputDirectoryPath.trim() === '' ? null : artifactOutputDirectoryPath }))}
              value={form.artifactOutputDirectoryPath ?? ''}
            />

            {form.android !== null && (
              <div className={styles.platformPanel}>
                <h3>Android artifacts</h3>
                <div className={styles.platformToggle}>
                  <Switch checked={form.artifactGeneration.androidArtifactTypes.includes('apk')} description="Makes an installable APK available in new local artifact pipelines." label="Offer APK" onChange={(isEnabled) => setForm((current) => ({ ...current, artifactGeneration: { ...current.artifactGeneration, androidArtifactTypes: isEnabled ? [...new Set([...current.artifactGeneration.androidArtifactTypes, 'apk' as const])] : current.artifactGeneration.androidArtifactTypes.filter((type) => type !== 'apk') } }))} />
                  <Switch checked={form.artifactGeneration.androidArtifactTypes.includes('aab')} description="Makes an Android App Bundle available for local or store-oriented pipelines." label="Offer AAB" onChange={(isEnabled) => setForm((current) => ({ ...current, artifactGeneration: { ...current.artifactGeneration, androidArtifactTypes: isEnabled ? [...new Set([...current.artifactGeneration.androidArtifactTypes, 'aab' as const])] : current.artifactGeneration.androidArtifactTypes.filter((type) => type !== 'aab') } }))} />
                  <Switch checked={form.artifactGeneration.requiresAndroidSigning} description="Locks signing on for every local Android artifact pipeline." label="Always sign generated Android artifacts" onChange={(requiresAndroidSigning) => setForm((current) => ({ ...current, artifactGeneration: { ...current.artifactGeneration, requiresAndroidSigning } }))} />
                </div>
                <Form.Group className={styles.compactField}>
                  <Form.Label>Default Android artifact</Form.Label>
                  <Select onChange={(event) => updateAndroid({ defaultArtifactType: event.target.value === 'aab' ? 'aab' : 'apk' })} value={form.android.defaultArtifactType}>
                    <option value="apk">APK</option>
                    <option value="aab">AAB</option>
                  </Select>
                  <Form.Text>The artifact type can be changed for each pipeline run.</Form.Text>
                </Form.Group>
                <div className={styles.twoColumns}>
                  <Form.Group><Form.Label>APK Gradle task</Form.Label><Form.Control onBlur={() => { const androidConfiguration = form.android; if (androidConfiguration !== null && form.googlePlay !== null && androidConfiguration.projectPath !== '') void loadAndroidProjectMetadata(androidConfiguration.projectPath, androidConfiguration.googleServicesJsonPath, androidConfiguration.gradleTask); }} onChange={(event) => { resetAndroidProjectMetadata(); updateAndroid({ gradleTask: event.target.value }); }} required value={form.android.gradleTask} /><Form.Text>Exact Gradle task invoked to build the APK, including its module prefix.</Form.Text></Form.Group>
                  <Form.Group><Form.Label>APK source path</Form.Label><Form.Control onChange={(event) => updateAndroid({ artifactPath: event.target.value })} required value={form.android.artifactPath} /><Form.Text>Expected APK produced by that task. May be relative to the Android project directory.</Form.Text></Form.Group>
                </div>
                <div className={styles.twoColumns}>
                  <Form.Group><Form.Label>AAB Gradle task</Form.Label><Form.Control onChange={(event) => updateAndroid({ aabGradleTask: event.target.value })} required value={form.android.aabGradleTask} /><Form.Text>Exact Gradle task invoked to build the AAB, including its module prefix.</Form.Text></Form.Group>
                  <Form.Group><Form.Label>AAB source path</Form.Label><Form.Control onChange={(event) => updateAndroid({ aabArtifactPath: event.target.value })} required value={form.android.aabArtifactPath} /><Form.Text>Expected AAB produced by that task. May be relative to the Android project directory.</Form.Text></Form.Group>
                </div>
              </div>
            )}

            {form.ios !== null && (
              <div className={styles.platformPanel}>
                <h3>iOS artifact</h3>
                <div className={styles.platformToggle}>
                  <Switch checked={form.artifactGeneration.isIosIpaEnabled} description="Makes an exported IPA available in new local artifact pipelines." label="Offer IPA" onChange={(isIosIpaEnabled) => setForm((current) => ({ ...current, artifactGeneration: { ...current.artifactGeneration, isIosIpaEnabled } }))} />
                  <Switch checked={form.artifactGeneration.requiresIosSigning} description="Locks signing on for every local IPA pipeline." label="Always sign generated IPA artifacts" onChange={(requiresIosSigning) => setForm((current) => ({ ...current, artifactGeneration: { ...current.artifactGeneration, requiresIosSigning } }))} />
                </div>
                <Form.Group><Form.Label>IPA source path</Form.Label><Form.Control onChange={(event) => updateIos({ artifactPath: event.target.value })} required value={form.ios.artifactPath} /><Form.Text>Final IPA destination after Xcode archive export. May be relative to the iOS project directory.</Form.Text></Form.Group>
              </div>
            )}
          </div>
        </section>
        )}

        {form.googlePlay !== null && (
        <section className={styles.section}>
          <header><span>05</span><div><h2>Google Play configuration</h2><p>Android store delivery and track management</p></div></header>
          <div className={styles.sectionBody}>
            <Alert variant="info">Signed builds are committed to internal testing first. Optional promotion uses a second committed Play edit.</Alert>
            <div className={styles.threeColumns}>
              <Form.Group>
                <Form.Label>Package name</Form.Label>
                <InputGroup>
                  <Form.Control
                    aria-busy={isLoadingAndroidProjectMetadata}
                    aria-describedby="android-package-name-feedback"
                    onChange={(event) => {
                      resetAndroidProjectMetadata();
                      updateGooglePlay({ packageName: event.target.value });
                    }}
                    placeholder="com.example.app"
                    required
                    value={form.googlePlay.packageName}
                  />
                  <Button
                    aria-label="Refresh Android package name"
                    disabled={
                      isLoadingAndroidProjectMetadata ||
                      form.android === null ||
                      form.android.projectPath === ''
                    }
                    onClick={() => {
                      const androidConfiguration = form.android;
                      if (androidConfiguration !== null) {
                        void loadAndroidProjectMetadata(
                          androidConfiguration.projectPath,
                          androidConfiguration.googleServicesJsonPath,
                          androidConfiguration.gradleTask,
                        );
                      }
                    }}
                    type="button"
                    variant="outline-secondary"
                  >
                    {isLoadingAndroidProjectMetadata ? <Spinner animation="border" size="sm" /> : 'Refresh'}
                  </Button>
                </InputGroup>
                <Form.Text
                  className={androidProjectMetadataError === null ? undefined : styles.fieldError}
                  id="android-package-name-feedback"
                >
                  {androidProjectMetadataError ?? 'Detected from google-services.json or a literal Gradle applicationId when available. You can enter it manually.'}
                </Form.Text>
              </Form.Group>
              <Form.Group><Form.Label>Default store artifact</Form.Label><Select onChange={(event) => updateGooglePlay({ artifactType: event.target.value === 'apk' ? 'apk' : 'aab' })} value={form.googlePlay.artifactType}><option value="aab">AAB (recommended)</option><option value="apk">APK</option></Select><Form.Text>Initial Android format for Store pipelines. Each pipeline can still choose APK or AAB.</Form.Text></Form.Group>
              <Form.Group><Form.Label>Internal track ID</Form.Label><Form.Control onChange={(event) => updateGooglePlay({ initialTrack: event.target.value })} required value={form.googlePlay.initialTrack} /><Form.Text>Google Play track that receives the first committed release, usually internal.</Form.Text></Form.Group>
            </div>
            <Form.Group className={styles.compactField}><Form.Label>Release notes language</Form.Label><Form.Control onChange={(event) => updateGooglePlay({ releaseNotesLanguage: event.target.value })} placeholder="en-US" required value={form.googlePlay.releaseNotesLanguage} /><Form.Text>BCP 47 language tag used by Google Play.</Form.Text></Form.Group>
            <PathField helpText={application?.googlePlay === null || application?.googlePlay === undefined ? 'Use a dedicated service account granted access in Play Console.' : `Current: ${application.googlePlay.serviceAccountFileName}. Leave empty to keep it.`} label="Google Play Service Account JSON" onBrowse={() => void choosePath(window.desktopApi.chooseGooglePlayServiceAccount, (serviceAccountPath) => updateGooglePlay({ serviceAccountPath }))} placeholder={application?.googlePlay === null || application?.googlePlay === undefined ? 'Not selected yet' : 'The existing file will be kept'} required={application?.googlePlay === null || application?.googlePlay === undefined} value={form.googlePlay.serviceAccountPath} />
            <Switch checked={form.googlePlay.promoteAfterUpload} description="Creates a second Play edit to move the uploaded release from the internal track." label="Promote after internal testing upload" onChange={(promoteAfterUpload) => updateGooglePlay({ promoteAfterUpload })} />
            {form.googlePlay.promoteAfterUpload && <div className={styles.threeColumns}>
              <Form.Group><Form.Label>Promotion track</Form.Label><Form.Control onChange={(event) => updateGooglePlay({ promotionTrack: event.target.value })} required value={form.googlePlay.promotionTrack} /><Form.Text>Destination track ID, such as production, beta, or a custom track.</Form.Text></Form.Group>
              <Form.Group><Form.Label>Release status</Form.Label><Select onChange={(event) => updateGooglePlay({ promotionStatus: event.target.value === 'draft' ? 'draft' : event.target.value === 'inProgress' ? 'inProgress' : 'completed', rolloutFraction: event.target.value === 'inProgress' ? (form.googlePlay?.rolloutFraction ?? 0.1) : null })} value={form.googlePlay.promotionStatus}><option value="completed">Completed</option><option value="draft">Draft</option><option value="inProgress">Staged rollout</option></Select><Form.Text>Controls whether promotion is final, a draft, or a staged rollout.</Form.Text></Form.Group>
              {form.googlePlay.promotionStatus === 'inProgress' && <Form.Group><Form.Label>Rollout fraction</Form.Label><Form.Control max="0.99" min="0.01" onChange={(event) => updateGooglePlay({ rolloutFraction: Number(event.target.value) })} required step="0.01" type="number" value={form.googlePlay.rolloutFraction ?? 0.1} /><Form.Text>Audience share from 0.01 to 0.99; for example, 0.10 releases to 10%.</Form.Text></Form.Group>}
            </div>}
          </div>
        </section>
        )}

        {form.appStoreConnect !== null && (
          <section className={styles.section}>
            <header><span>06</span><div><h2>App Store Connect configuration</h2><p>iOS archive upload and API authentication</p></div></header>
            <div className={styles.sectionBody}>
              <Alert variant="info">Xcode uploads the signed archive to App Store Connect. The build appears in TestFlight after Apple processing; App Store review and release remain explicit App Store Connect actions.</Alert>
              <div className={styles.threeColumns}>
                <Form.Group>
                  <Form.Label>Bundle ID</Form.Label>
                  <Form.Control
                    aria-busy={isLoadingIosDevelopmentTeam}
                    onChange={(event) => {
                      resetIosDevelopmentTeam();
                      updateIos({ bundleIdentifier: event.target.value });
                    }}
                    placeholder={isLoadingIosDevelopmentTeam ? 'Reading from Xcode project…' : 'Enter or detect the Bundle ID'}
                    value={form.ios?.bundleIdentifier ?? ''}
                  />
                  <Form.Text>Enter the Bundle ID manually or use Refresh in the iOS signing section.</Form.Text>
                </Form.Group>
                <Form.Group><Form.Label>API Key ID</Form.Label><Form.Control onChange={(event) => setForm((current) => current.appStoreConnect === null ? current : ({ ...current, appStoreConnect: { ...current.appStoreConnect, apiKeyId: event.target.value } }))} required value={form.appStoreConnect.apiKeyId} /><Form.Text>Key identifier shown in App Store Connect; it can also be read from AuthKey_KEYID.p8.</Form.Text></Form.Group>
                <Form.Group><Form.Label>Issuer ID</Form.Label><Form.Control onChange={(event) => setForm((current) => current.appStoreConnect === null ? current : ({ ...current, appStoreConnect: { ...current.appStoreConnect, issuerId: event.target.value } }))} placeholder="UUID" required value={form.appStoreConnect.issuerId} /><Form.Text>Issuer UUID from App Store Connect Users and Access integration settings.</Form.Text></Form.Group>
              </div>
              <PathField helpText={application?.appStoreConnect === null || application?.appStoreConnect === undefined ? 'The .p8 key is encrypted at rest. A standard AuthKey_KEYID.p8 filename also fills the Key ID.' : `Current: ${application.appStoreConnect.apiKeyFileName}. Leave empty to keep it.`} label="App Store Connect API key (.p8)" onBrowse={() => void chooseAppStoreConnectApiKey()} placeholder={application?.appStoreConnect === null || application?.appStoreConnect === undefined ? 'Not selected yet' : 'The existing file will be kept'} required={application?.appStoreConnect === null || application?.appStoreConnect === undefined} value={form.appStoreConnect.apiKeyPath} />
            </div>
          </section>
        )}

        {needsAndroidSigning && (
          <section className={styles.section}>
            <header><span>07A</span><div><h2>Android signing configuration</h2><p>Keystore credentials for signed APK and AAB artifacts</p></div></header>
            <div className={styles.sectionBody}>
              <div className={styles.signingPanel}>
                <Alert variant="info">Select a binary JKS/keystore created by Android Studio or keytool. Keystore passwords are encrypted and never written to YAML, JSON, Gradle files, or renderer storage.</Alert>
                <PathField helpText={application?.androidSigning === null || application?.androidSigning === undefined ? 'Select the upload/release keystore.' : `Current: ${application.androidSigning.keystoreFileName}. Leave empty to keep it.`} label="Keystore (.jks or .keystore)" onBrowse={() => void choosePath(window.desktopApi.chooseAndroidKeystore, (keystorePath) => setForm((current) => ({ ...current, androidSigning: { ...(current.androidSigning ?? defaultAndroidSigning()), keystorePath } })))} placeholder={application?.androidSigning === null || application?.androidSigning === undefined ? 'Not selected yet' : 'The existing keystore will be kept'} required={application?.androidSigning === null || application?.androidSigning === undefined} value={form.androidSigning?.keystorePath ?? ''} />
                <div className={styles.threeColumns}>
                  <Form.Group><Form.Label>Key alias</Form.Label><Form.Control onChange={(event) => setForm((current) => ({ ...current, androidSigning: { ...(current.androidSigning ?? defaultAndroidSigning()), keyAlias: event.target.value } }))} required value={form.androidSigning?.keyAlias ?? ''} /><Form.Text>Alias of the upload or release key stored inside the selected keystore.</Form.Text></Form.Group>
                  <Form.Group><Form.Label>Keystore password</Form.Label><Form.Control autoComplete="new-password" onChange={(event) => setForm((current) => ({ ...current, androidSigning: { ...(current.androidSigning ?? defaultAndroidSigning()), storePassword: event.target.value } }))} placeholder={application?.androidSigning === null || application?.androidSigning === undefined ? '' : 'Leave empty to keep'} required={application?.androidSigning === null || application?.androidSigning === undefined} type="password" value={form.androidSigning?.storePassword ?? ''} /><Form.Text>Unlocks the keystore. On edit, leave empty to retain the encrypted value.</Form.Text></Form.Group>
                  <Form.Group><Form.Label>Key password</Form.Label><Form.Control autoComplete="new-password" onChange={(event) => setForm((current) => ({ ...current, androidSigning: { ...(current.androidSigning ?? defaultAndroidSigning()), keyPassword: event.target.value } }))} placeholder={application?.androidSigning === null || application?.androidSigning === undefined ? '' : 'Leave empty to keep'} required={application?.androidSigning === null || application?.androidSigning === undefined} type="password" value={form.androidSigning?.keyPassword ?? ''} /><Form.Text>Unlocks the selected alias. On edit, leave empty to retain the encrypted value.</Form.Text></Form.Group>
                </div>
              </div>
            </div>
          </section>
        )}

        {needsIosSigning && (
          <section className={styles.section}>
            <header><span>07B</span><div><h2>iOS signing configuration</h2><p>Xcode automatic signing for IPA and App Store archives</p></div></header>
            <div className={styles.sectionBody}>
              <div className={styles.signingPanel}>
                <Switch checked={form.iosSigning.isEnabled} description="Passes the saved Team ID to Xcode and allows provisioning profile updates during archive." label="Use Xcode automatic signing" onChange={(isEnabled) => setForm((current) => ({ ...current, iosSigning: { ...current.iosSigning, isEnabled } }))} />
                <Form.Group className={styles.compactField}>
                  <Form.Label>Apple Development Team ID</Form.Label>
                  <InputGroup>
                    <Form.Control
                      aria-busy={isLoadingIosDevelopmentTeam}
                      aria-describedby="ios-development-team-feedback"
                      maxLength={64}
                      onChange={(event) => {
                        resetIosDevelopmentTeam();
                        setForm((current) => ({
                          ...current,
                          iosSigning: {
                            ...current.iosSigning,
                            developmentTeamId: event.target.value.toUpperCase(),
                          },
                        }));
                      }}
                      pattern="[A-Z0-9]{1,64}"
                      placeholder={isLoadingIosDevelopmentTeam ? 'Reading from Xcode project…' : 'Enter or detect the Team ID'}
                      value={form.iosSigning.developmentTeamId}
                    />
                    <Button
                      aria-label="Refresh Apple Development Team ID"
                      disabled={
                        isLoadingIosDevelopmentTeam ||
                        form.ios === null ||
                        form.ios.workspaceOrProjectPath === '' ||
                        form.ios.scheme === '' ||
                        form.ios.configuration === ''
                      }
                      onClick={() => {
                        const iosConfiguration = form.ios;
                        if (iosConfiguration !== null) {
                          void loadIosDevelopmentTeam(
                            iosConfiguration.workspaceOrProjectPath,
                            iosConfiguration.scheme,
                            iosConfiguration.configuration,
                          );
                        }
                      }}
                      type="button"
                      variant="outline-secondary"
                    >
                      {isLoadingIosDevelopmentTeam ? <Spinner animation="border" size="sm" /> : 'Refresh'}
                    </Button>
                  </InputGroup>
                  <Form.Text
                    className={iosDevelopmentTeamError === null ? undefined : styles.fieldError}
                    id="ios-development-team-feedback"
                  >
                    {iosDevelopmentTeamError === null
                      ? form.iosSigning.developmentTeamId === ''
                        ? 'Enter the Team ID manually or detect it from the selected Xcode project.'
                        : 'You can edit the Team ID or refresh it from the selected Xcode project.'
                      : `${iosDevelopmentTeamError} You can enter the Team ID manually.`}
                  </Form.Text>
                </Form.Group>
              </div>
            </div>
          </section>
        )}

        <section className={styles.section}>
          <header><span>08</span><div><h2>Pipeline extensions</h2><p>Optional safe command steps</p></div></header>
          <div className={styles.sectionBody}>
            <Alert variant="warning">These commands run on the local machine. Use only commands and directories you trust.</Alert>
            <HookEditor hooks={form.hooks} onChange={(hooks) => setForm((current) => ({ ...current, hooks }))} supportedPlatforms={supportedPlatforms} />
          </div>
        </section>

        <section className={styles.section}>
          <header><span>09</span><div><h2>Completion notifications</h2><p>Native desktop feedback after release work finishes</p></div></header>
          <div className={styles.sectionBody}>
            <Switch
              checked={form.shouldNotifyWhenFinished}
              description="Send a native desktop notification when a release pipeline succeeds, partially succeeds, fails, or is cancelled. Notification text contains no credentials or file paths."
              label="Notify me when release pipelines finish"
              onChange={(shouldNotifyWhenFinished) => setForm((current) => ({
                ...current,
                shouldNotifyWhenFinished,
              }))}
            />
          </div>
        </section>

        {errorMessage !== null && <Alert variant="danger">{errorMessage}</Alert>}
        <footer className={styles.formFooter}>
          <Button disabled={isSaving} onClick={onCancel} type="button" variant="outline-secondary">Cancel</Button>
          <Button
            disabled={
              isSaving ||
              isLoadingAndroidProjectMetadata ||
              (form.android === null && form.ios === null) ||
              (form.ios !== null && (isLoadingIosSchemes || availableIosSchemes.length === 0))
            }
            type="submit"
          >
            {isSaving && <Spinner animation="border" className={styles.buttonSpinner} size="sm" />}
            {application === null ? 'Complete setup' : 'Save changes'}
          </Button>
        </footer>
      </Form>
    </div>
  );
};
