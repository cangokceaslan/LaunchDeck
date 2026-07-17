import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Form, InputGroup, Spinner } from 'react-bootstrap';
import { HookEditor } from '@components/HookEditor';
import { Select } from '@components/Inputs/Select';
import { Switch } from '@components/Inputs/Switch';
import { PathField } from '@components/PathField';
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
    requiresAndroidSigning: false,
    requiresIosSigning: true,
  },
  artifactOutputDirectoryPath: application?.artifactOutputDirectoryPath ?? null,
  distributionGroups: application?.distributionGroups ?? ['internal-testers'],
  firebaseDistribution: application?.firebaseDistribution ?? {
    isEnabled: true,
    requiresAndroidSigning: false,
    requiresIosSigning: true,
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
  const [iosSchemes, setIosSchemes] = useState<string[]>(
    application?.ios === null || application?.ios === undefined ? [] : [application.ios.scheme],
  );
  const [iosSchemeError, setIosSchemeError] = useState<string | null>(null);
  const [isLoadingIosSchemes, setIsLoadingIosSchemes] = useState(false);
  const iosSchemeRequestId = useRef(0);
  const needsAndroidSigning = form.android !== null && (
    form.googlePlay !== null ||
    (form.artifactGeneration.isEnabled && form.artifactGeneration.requiresAndroidSigning) ||
    (form.firebaseDistribution.isEnabled && form.firebaseDistribution.requiresAndroidSigning)
  );
  const isStoreDistributionEnabled = form.googlePlay !== null || form.appStoreConnect !== null;
  const needsIosSigning = form.ios !== null && (
    form.appStoreConnect !== null ||
    (form.artifactGeneration.isEnabled && form.artifactGeneration.requiresIosSigning) ||
    (form.firebaseDistribution.isEnabled && form.firebaseDistribution.requiresIosSigning)
  );

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

  const handleStoreDistributionChange = (isEnabled: boolean): void => {
    setForm((current) => ({
      ...current,
      appStoreConnect: isEnabled && current.ios !== null
        ? current.appStoreConnect ?? defaultAppStoreConnect()
        : null,
      googlePlay: isEnabled && current.android !== null
        ? current.googlePlay ?? defaultGooglePlay()
        : null,
    }));
  };

  const loadIosSchemes = async (workspaceOrProjectPath: string): Promise<void> => {
    const requestId = iosSchemeRequestId.current + 1;
    iosSchemeRequestId.current = requestId;
    setIosSchemeError(null);
    setIsLoadingIosSchemes(true);
    try {
      const result = await window.desktopApi.listIosSchemes(workspaceOrProjectPath);
      if (iosSchemeRequestId.current !== requestId) return;
      setIosSchemes(result.schemes);
      setForm((current) => {
        if (current.ios === null || current.ios.workspaceOrProjectPath !== workspaceOrProjectPath) {
          return current;
        }
        const scheme = result.schemes.includes(current.ios.scheme)
          ? current.ios.scheme
          : (result.schemes[0] ?? '');
        return { ...current, ios: { ...current.ios, scheme } };
      });
    } catch (error) {
      if (iosSchemeRequestId.current !== requestId) return;
      setIosSchemes([]);
      setIosSchemeError(normalizeErrorMessage(error));
    } finally {
      if (iosSchemeRequestId.current === requestId) setIsLoadingIosSchemes(false);
    }
  };

  useEffect(() => {
    const workspaceOrProjectPath = application?.ios?.workspaceOrProjectPath;
    if (workspaceOrProjectPath !== undefined) {
      void loadIosSchemes(workspaceOrProjectPath);
    }
    return () => {
      iosSchemeRequestId.current += 1;
    };
  }, []);

  const chooseIosWorkspaceOrProject = async (): Promise<void> => {
    const result = await window.desktopApi.chooseIosWorkspaceOrProject();
    if (result.status !== 'selected') return;
    updateIos({ scheme: '', workspaceOrProjectPath: result.path });
    await loadIosSchemes(result.path);
  };

  const handleIosEnabledChange = (isEnabled: boolean): void => {
    iosSchemeRequestId.current += 1;
    setIosSchemes([]);
    setIosSchemeError(null);
    setIsLoadingIosSchemes(false);
    setForm((current) => ({
      ...current,
      appStoreConnect: isEnabled && current.googlePlay !== null
        ? current.appStoreConnect ?? defaultAppStoreConnect()
        : isEnabled ? current.appStoreConnect : null,
      ios: isEnabled ? defaultIos() : null,
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
            </Form.Group>
            <div className={styles.outcomeGrid}>
              <Switch checked={form.artifactGeneration.isEnabled} description="Generate APK, AAB, or IPA output." label="Artifact generation" onChange={(isEnabled) => setForm((current) => ({ ...current, artifactGeneration: { ...current.artifactGeneration, isEnabled } }))} />
              <Switch checked={form.firebaseDistribution.isEnabled} description="Send builds to configured tester groups." label="Firebase App Distribution" onChange={(isEnabled) => setForm((current) => ({ ...current, firebaseDistribution: { ...current.firebaseDistribution, isEnabled } }))} />
              <Switch checked={isStoreDistributionEnabled} description="Send signed builds to Google Play or App Store Connect." label="Store Distribution" onChange={handleStoreDistributionChange} />
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <header><span>02</span><div><h2>Platforms</h2><p>Project and platform integration</p></div></header>
          <div className={styles.sectionBody}>
            <div className={styles.platformToggle}>
              <Switch
                checked={form.android !== null}
                label="Use Android"
                onChange={(isEnabled) => setForm((current) => ({
                  ...current,
                  android: isEnabled ? defaultAndroid() : null,
                  googlePlay: isEnabled && current.appStoreConnect !== null
                    ? current.googlePlay ?? defaultGooglePlay()
                    : isEnabled ? current.googlePlay : null,
                }))}
              />
              <Switch
                checked={form.ios !== null}
                disabled={!supportedPlatforms.includes('ios')}
                label="Use iOS (macOS only)"
                onChange={handleIosEnabledChange}
              />
            </div>

            {form.android !== null && (
              <div className={styles.platformPanel}>
                <h3>Android</h3>
                <PathField label="Android application directory" onBrowse={() => void choosePath(window.desktopApi.chooseAndroidProjectDirectory, (projectPath) => updateAndroid({ projectPath }))} required value={form.android.projectPath} />
                {form.firebaseDistribution.isEnabled && <PathField label="google-services.json" onBrowse={() => void choosePath(window.desktopApi.chooseGoogleServicesJson, (googleServicesJsonPath) => updateAndroid({ googleServicesJsonPath }))} required value={form.android.googleServicesJsonPath ?? ''} />}
              </div>
            )}

            {form.ios !== null && (
              <div className={styles.platformPanel}>
                <h3>iOS</h3>
                <PathField label="iOS application directory" onBrowse={() => void choosePath(window.desktopApi.chooseIosProjectDirectory, (projectPath) => updateIos({ projectPath }))} required value={form.ios.projectPath} />
                {form.firebaseDistribution.isEnabled && <PathField label="GoogleService-Info.plist" onBrowse={() => void choosePath(window.desktopApi.chooseGoogleServiceInfoPlist, (googleServiceInfoPlistPath) => updateIos({ googleServiceInfoPlistPath }))} required value={form.ios.googleServiceInfoPlistPath ?? ''} />}
                <PathField label="Xcode workspace / project" onBrowse={() => void chooseIosWorkspaceOrProject()} required value={form.ios.workspaceOrProjectPath} />
                <div className={styles.threeColumns}>
                  <Form.Group>
                    <Form.Label>Scheme</Form.Label>
                    <InputGroup>
                      <Select
                        aria-describedby="ios-scheme-feedback"
                        disabled={isLoadingIosSchemes || iosSchemes.length === 0}
                        onChange={(event) => updateIos({ scheme: event.target.value })}
                        required
                        value={form.ios.scheme}
                      >
                        {iosSchemes.length === 0 && (
                          <option value="">{isLoadingIosSchemes ? 'Loading schemes…' : 'Select a workspace or project'}</option>
                        )}
                        {iosSchemes.map((scheme) => <option key={scheme} value={scheme}>{scheme}</option>)}
                      </Select>
                      <Button
                        aria-label="Refresh Xcode scheme list"
                        disabled={isLoadingIosSchemes || form.ios.workspaceOrProjectPath === ''}
                        onClick={() => void loadIosSchemes(form.ios?.workspaceOrProjectPath ?? '')}
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
                  <Form.Group><Form.Label>Configuration</Form.Label><Form.Control onChange={(event) => updateIos({ configuration: event.target.value })} required value={form.ios.configuration} /></Form.Group>
                  <Form.Group><Form.Label>Export method</Form.Label><Select onChange={(event) => { if (isIosExportMethod(event.target.value)) updateIos({ exportMethod: event.target.value }); }} value={form.ios.exportMethod}><option value="release-testing">Release testing</option><option value="enterprise">Enterprise</option><option value="development">Development</option></Select></Form.Group>
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
              <div className={styles.platformToggle}>
                {form.android !== null && <Switch checked={form.firebaseDistribution.requiresAndroidSigning} label="Require signed Android artifacts" onChange={(requiresAndroidSigning) => setForm((current) => ({ ...current, firebaseDistribution: { ...current.firebaseDistribution, requiresAndroidSigning } }))} />}
                {form.ios !== null && <Switch checked={form.firebaseDistribution.requiresIosSigning} label="Require signed iOS artifacts" onChange={(requiresIosSigning) => setForm((current) => ({ ...current, firebaseDistribution: { ...current.firebaseDistribution, requiresIosSigning } }))} />}
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
                  <Switch checked={form.artifactGeneration.androidArtifactTypes.includes('apk')} label="Offer APK" onChange={(isEnabled) => setForm((current) => ({ ...current, artifactGeneration: { ...current.artifactGeneration, androidArtifactTypes: isEnabled ? [...new Set([...current.artifactGeneration.androidArtifactTypes, 'apk' as const])] : current.artifactGeneration.androidArtifactTypes.filter((type) => type !== 'apk') } }))} />
                  <Switch checked={form.artifactGeneration.androidArtifactTypes.includes('aab')} label="Offer AAB" onChange={(isEnabled) => setForm((current) => ({ ...current, artifactGeneration: { ...current.artifactGeneration, androidArtifactTypes: isEnabled ? [...new Set([...current.artifactGeneration.androidArtifactTypes, 'aab' as const])] : current.artifactGeneration.androidArtifactTypes.filter((type) => type !== 'aab') } }))} />
                  <Switch checked={form.artifactGeneration.requiresAndroidSigning} label="Require signing" onChange={(requiresAndroidSigning) => setForm((current) => ({ ...current, artifactGeneration: { ...current.artifactGeneration, requiresAndroidSigning } }))} />
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
                  <Form.Group><Form.Label>APK Gradle task</Form.Label><Form.Control onChange={(event) => updateAndroid({ gradleTask: event.target.value })} required value={form.android.gradleTask} /></Form.Group>
                  <Form.Group><Form.Label>APK source path</Form.Label><Form.Control onChange={(event) => updateAndroid({ artifactPath: event.target.value })} required value={form.android.artifactPath} /><Form.Text>Required. May be relative to the Android project directory.</Form.Text></Form.Group>
                </div>
                <div className={styles.twoColumns}>
                  <Form.Group><Form.Label>AAB Gradle task</Form.Label><Form.Control onChange={(event) => updateAndroid({ aabGradleTask: event.target.value })} required value={form.android.aabGradleTask} /></Form.Group>
                  <Form.Group><Form.Label>AAB source path</Form.Label><Form.Control onChange={(event) => updateAndroid({ aabArtifactPath: event.target.value })} required value={form.android.aabArtifactPath} /><Form.Text>Required. May be relative to the Android project directory.</Form.Text></Form.Group>
                </div>
              </div>
            )}

            {form.ios !== null && (
              <div className={styles.platformPanel}>
                <h3>iOS artifact</h3>
                <div className={styles.platformToggle}>
                  <Switch checked={form.artifactGeneration.isIosIpaEnabled} label="Offer IPA" onChange={(isIosIpaEnabled) => setForm((current) => ({ ...current, artifactGeneration: { ...current.artifactGeneration, isIosIpaEnabled } }))} />
                  <Switch checked={form.artifactGeneration.requiresIosSigning} label="Require signing" onChange={(requiresIosSigning) => setForm((current) => ({ ...current, artifactGeneration: { ...current.artifactGeneration, requiresIosSigning } }))} />
                </div>
                <Form.Group><Form.Label>IPA source path</Form.Label><Form.Control onChange={(event) => updateIos({ artifactPath: event.target.value })} required value={form.ios.artifactPath} /><Form.Text>Required. May be relative to the iOS project directory.</Form.Text></Form.Group>
              </div>
            )}
          </div>
        </section>
        )}

        {isStoreDistributionEnabled && (
        <section className={styles.section}>
          <header><span>05</span><div><h2>Store Distribution</h2><p>Platform-specific store delivery; signing stays separate</p></div></header>
          <div className={styles.sectionBody}>
            {form.googlePlay !== null && (
              <div className={styles.platformPanel}>
                <h3>Google Play</h3>
                <Alert variant="info">Signed builds are committed to internal testing first. Optional promotion uses a second committed Play edit.</Alert>
                <div className={styles.threeColumns}>
                  <Form.Group><Form.Label>Package name</Form.Label><Form.Control onChange={(event) => updateGooglePlay({ packageName: event.target.value })} placeholder="com.example.app" required value={form.googlePlay.packageName} /></Form.Group>
                  <Form.Group><Form.Label>Store artifact</Form.Label><Select onChange={(event) => updateGooglePlay({ artifactType: event.target.value === 'apk' ? 'apk' : 'aab' })} value={form.googlePlay.artifactType}><option value="aab">AAB (recommended)</option><option value="apk">APK</option></Select></Form.Group>
                  <Form.Group><Form.Label>Internal track ID</Form.Label><Form.Control onChange={(event) => updateGooglePlay({ initialTrack: event.target.value })} required value={form.googlePlay.initialTrack} /></Form.Group>
                </div>
                <Form.Group className={styles.compactField}><Form.Label>Release notes language</Form.Label><Form.Control onChange={(event) => updateGooglePlay({ releaseNotesLanguage: event.target.value })} placeholder="en-US" required value={form.googlePlay.releaseNotesLanguage} /><Form.Text>BCP 47 language tag used by Google Play.</Form.Text></Form.Group>
                <PathField helpText={application?.googlePlay === null || application?.googlePlay === undefined ? 'Use a dedicated service account granted access in Play Console.' : `Current: ${application.googlePlay.serviceAccountFileName}. Leave empty to keep it.`} label="Google Play Service Account JSON" onBrowse={() => void choosePath(window.desktopApi.chooseGooglePlayServiceAccount, (serviceAccountPath) => updateGooglePlay({ serviceAccountPath }))} placeholder={application?.googlePlay === null || application?.googlePlay === undefined ? 'Not selected yet' : 'The existing file will be kept'} required={application?.googlePlay === null || application?.googlePlay === undefined} value={form.googlePlay.serviceAccountPath} />
                <Switch checked={form.googlePlay.promoteAfterUpload} label="Promote after internal testing upload" onChange={(promoteAfterUpload) => updateGooglePlay({ promoteAfterUpload })} />
                {form.googlePlay.promoteAfterUpload && <div className={styles.threeColumns}>
                  <Form.Group><Form.Label>Promotion track</Form.Label><Form.Control onChange={(event) => updateGooglePlay({ promotionTrack: event.target.value })} required value={form.googlePlay.promotionTrack} /></Form.Group>
                  <Form.Group><Form.Label>Release status</Form.Label><Select onChange={(event) => updateGooglePlay({ promotionStatus: event.target.value === 'draft' ? 'draft' : event.target.value === 'inProgress' ? 'inProgress' : 'completed', rolloutFraction: event.target.value === 'inProgress' ? (form.googlePlay?.rolloutFraction ?? 0.1) : null })} value={form.googlePlay.promotionStatus}><option value="completed">Completed</option><option value="draft">Draft</option><option value="inProgress">Staged rollout</option></Select></Form.Group>
                  {form.googlePlay.promotionStatus === 'inProgress' && <Form.Group><Form.Label>Rollout fraction</Form.Label><Form.Control max="0.99" min="0.01" onChange={(event) => updateGooglePlay({ rolloutFraction: Number(event.target.value) })} required step="0.01" type="number" value={form.googlePlay.rolloutFraction ?? 0.1} /><Form.Text>0.01–0.99</Form.Text></Form.Group>}
                </div>}
              </div>
            )}
            {form.appStoreConnect !== null && (
              <div className={styles.platformPanel}>
                <h3>App Store Connect</h3>
                <Alert variant="info">Xcode uploads the signed archive to App Store Connect. The build appears in TestFlight after Apple processing; App Store review and release remain explicit App Store Connect actions.</Alert>
                <div className={styles.twoColumns}>
                  <Form.Group><Form.Label>API Key ID</Form.Label><Form.Control onChange={(event) => setForm((current) => current.appStoreConnect === null ? current : ({ ...current, appStoreConnect: { ...current.appStoreConnect, apiKeyId: event.target.value } }))} required value={form.appStoreConnect.apiKeyId} /></Form.Group>
                  <Form.Group><Form.Label>Issuer ID</Form.Label><Form.Control onChange={(event) => setForm((current) => current.appStoreConnect === null ? current : ({ ...current, appStoreConnect: { ...current.appStoreConnect, issuerId: event.target.value } }))} placeholder="UUID" required value={form.appStoreConnect.issuerId} /></Form.Group>
                </div>
                <PathField helpText={application?.appStoreConnect === null || application?.appStoreConnect === undefined ? 'The .p8 key is encrypted at rest and is used only by the main process.' : `Current: ${application.appStoreConnect.apiKeyFileName}. Leave empty to keep it.`} label="App Store Connect API key (.p8)" onBrowse={() => void choosePath(window.desktopApi.chooseAppStoreConnectApiKey, (apiKeyPath) => setForm((current) => current.appStoreConnect === null ? current : ({ ...current, appStoreConnect: { ...current.appStoreConnect, apiKeyPath } })))} placeholder={application?.appStoreConnect === null || application?.appStoreConnect === undefined ? 'Not selected yet' : 'The existing file will be kept'} required={application?.appStoreConnect === null || application?.appStoreConnect === undefined} value={form.appStoreConnect.apiKeyPath} />
              </div>
            )}
          </div>
        </section>
        )}

        {(needsAndroidSigning || needsIosSigning) && (
          <section className={styles.section}>
            <header><span>06</span><div><h2>Signing configuration</h2><p>Shown only because a selected outcome requires signed artifacts</p></div></header>
            <div className={styles.sectionBody}>
              {needsAndroidSigning && (
                <div className={styles.platformPanel}>
                  <h3>Android signing</h3>
                  <Alert variant="info">Select a binary JKS/keystore created by Android Studio or keytool. Keystore passwords are encrypted and never written to YAML, JSON, Gradle files, or renderer storage.</Alert>
                  <PathField helpText={application?.androidSigning === null || application?.androidSigning === undefined ? 'Select the upload/release keystore.' : `Current: ${application.androidSigning.keystoreFileName}. Leave empty to keep it.`} label="Keystore (.jks or .keystore)" onBrowse={() => void choosePath(window.desktopApi.chooseAndroidKeystore, (keystorePath) => setForm((current) => ({ ...current, androidSigning: { ...(current.androidSigning ?? defaultAndroidSigning()), keystorePath } })))} placeholder={application?.androidSigning === null || application?.androidSigning === undefined ? 'Not selected yet' : 'The existing keystore will be kept'} required={application?.androidSigning === null || application?.androidSigning === undefined} value={form.androidSigning?.keystorePath ?? ''} />
                  <div className={styles.threeColumns}>
                    <Form.Group><Form.Label>Key alias</Form.Label><Form.Control onChange={(event) => setForm((current) => ({ ...current, androidSigning: { ...(current.androidSigning ?? defaultAndroidSigning()), keyAlias: event.target.value } }))} required value={form.androidSigning?.keyAlias ?? ''} /></Form.Group>
                    <Form.Group><Form.Label>Keystore password</Form.Label><Form.Control autoComplete="new-password" onChange={(event) => setForm((current) => ({ ...current, androidSigning: { ...(current.androidSigning ?? defaultAndroidSigning()), storePassword: event.target.value } }))} placeholder={application?.androidSigning === null || application?.androidSigning === undefined ? '' : 'Leave empty to keep'} required={application?.androidSigning === null || application?.androidSigning === undefined} type="password" value={form.androidSigning?.storePassword ?? ''} /></Form.Group>
                    <Form.Group><Form.Label>Key password</Form.Label><Form.Control autoComplete="new-password" onChange={(event) => setForm((current) => ({ ...current, androidSigning: { ...(current.androidSigning ?? defaultAndroidSigning()), keyPassword: event.target.value } }))} placeholder={application?.androidSigning === null || application?.androidSigning === undefined ? '' : 'Leave empty to keep'} required={application?.androidSigning === null || application?.androidSigning === undefined} type="password" value={form.androidSigning?.keyPassword ?? ''} /></Form.Group>
                  </div>
                </div>
              )}
              {needsIosSigning && (
                <div className={styles.platformPanel}>
                  <h3>iOS automatic signing</h3>
                  <Switch checked={form.iosSigning.isEnabled} label="Use Xcode automatic signing" onChange={(isEnabled) => setForm((current) => ({ ...current, iosSigning: { ...current.iosSigning, isEnabled } }))} />
                  <Form.Group className={styles.compactField}><Form.Label>Apple Development Team ID</Form.Label><Form.Control onChange={(event) => setForm((current) => ({ ...current, iosSigning: { ...current.iosSigning, developmentTeamId: event.target.value } }))} required value={form.iosSigning.developmentTeamId} /><Form.Text>Xcode resolves the distribution certificate and provisioning profile for this team.</Form.Text></Form.Group>
                </div>
              )}
            </div>
          </section>
        )}

        <section className={styles.section}>
          <header><span>07</span><div><h2>Pipeline extensions</h2><p>Optional safe command steps</p></div></header>
          <div className={styles.sectionBody}>
            <Alert variant="warning">These commands run on the local machine. Use only commands and directories you trust.</Alert>
            <HookEditor hooks={form.hooks} onChange={(hooks) => setForm((current) => ({ ...current, hooks }))} supportedPlatforms={supportedPlatforms} />
          </div>
        </section>

        {errorMessage !== null && <Alert variant="danger">{errorMessage}</Alert>}
        <footer className={styles.formFooter}>
          <Button disabled={isSaving} onClick={onCancel} type="button" variant="outline-secondary">Cancel</Button>
          <Button
            disabled={
              isSaving ||
              (form.android === null && form.ios === null) ||
              (form.ios !== null && (isLoadingIosSchemes || iosSchemes.length === 0))
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
