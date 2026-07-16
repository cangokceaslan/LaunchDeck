import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Form, InputGroup, Spinner } from 'react-bootstrap';
import { HookEditor } from '@components/HookEditor';
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
            googleServicesJsonPath: application.android.googleServicesJsonPath,
            gradleTask: application.android.gradleTask,
            projectPath: application.android.projectPath,
          },
  artifactOutputDirectoryPath: application?.artifactOutputDirectoryPath ?? null,
  distributionGroups: application?.distributionGroups ?? ['internal-testers'],
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
            googleServiceInfoPlistPath: application.ios.googleServiceInfoPlistPath,
            projectPath: application.ios.projectPath,
            scheme: application.ios.scheme,
            workspaceOrProjectPath: application.ios.workspaceOrProjectPath,
          },
  name: application?.name ?? '',
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
    setForm((current) => ({ ...current, ios: isEnabled ? defaultIos() : null }));
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
          <header><span>01</span><div><h2>Firebase project</h2><p>Identity and distribution target</p></div></header>
          <div className={styles.sectionBody}>
            <div className={styles.twoColumns}>
              <Form.Group>
                <Form.Label>Application name</Form.Label>
                <Form.Control
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="e.g. Mobile App"
                  required
                  value={form.name}
                />
              </Form.Group>
              <Form.Group>
                <Form.Label>Firebase Project ID</Form.Label>
                <Form.Control
                  onChange={(event) => setForm((current) => ({ ...current, firebaseProjectId: event.target.value }))}
                  placeholder="Can be detected from the service account"
                  value={form.firebaseProjectId}
                />
              </Form.Group>
            </div>
            <PathField
              helpText={application === null ? 'The path is encrypted using secure operating system storage.' : `Current: ${application.serviceAccountFileName}. Leave this empty to keep the existing file.`}
              label="Firebase Service Account JSON"
              onBrowse={() => void choosePath(window.desktopApi.chooseServiceAccountFile, (selectedPath) => setForm((current) => ({ ...current, serviceAccountPath: selectedPath })))}
              placeholder={application === null ? 'Not selected yet' : 'The existing file will be kept'}
              required={application === null}
              value={form.serviceAccountPath}
            />
            <Form.Group>
              <Form.Label>Tester group aliases</Form.Label>
              <Form.Control onChange={(event) => setGroupsText(event.target.value)} required value={groupsText} />
              <Form.Text>Separate aliases with commas, e.g. internal-testers, qa-team.</Form.Text>
            </Form.Group>
          </div>
        </section>

        <section className={styles.section}>
          <header><span>02</span><div><h2>Platforms</h2><p>Project and platform integration</p></div></header>
          <div className={styles.sectionBody}>
            <div className={styles.platformToggle}>
              <Form.Check
                checked={form.android !== null}
                label="Use Android"
                onChange={(event) => setForm((current) => ({ ...current, android: event.target.checked ? defaultAndroid() : null }))}
                type="switch"
              />
              <Form.Check
                checked={form.ios !== null}
                disabled={!supportedPlatforms.includes('ios')}
                label="Use iOS (macOS only)"
                onChange={(event) => handleIosEnabledChange(event.target.checked)}
                type="switch"
              />
            </div>

            {form.android !== null && (
              <div className={styles.platformPanel}>
                <h3>Android</h3>
                <PathField label="Android application directory" onBrowse={() => void choosePath(window.desktopApi.chooseAndroidProjectDirectory, (projectPath) => updateAndroid({ projectPath }))} required value={form.android.projectPath} />
                <PathField label="google-services.json" onBrowse={() => void choosePath(window.desktopApi.chooseGoogleServicesJson, (googleServicesJsonPath) => updateAndroid({ googleServicesJsonPath }))} required value={form.android.googleServicesJsonPath} />
              </div>
            )}

            {form.ios !== null && (
              <div className={styles.platformPanel}>
                <h3>iOS</h3>
                <PathField label="iOS application directory" onBrowse={() => void choosePath(window.desktopApi.chooseIosProjectDirectory, (projectPath) => updateIos({ projectPath }))} required value={form.ios.projectPath} />
                <PathField label="GoogleService-Info.plist" onBrowse={() => void choosePath(window.desktopApi.chooseGoogleServiceInfoPlist, (googleServiceInfoPlistPath) => updateIos({ googleServiceInfoPlistPath }))} required value={form.ios.googleServiceInfoPlistPath} />
                <PathField label="Xcode workspace / project" onBrowse={() => void chooseIosWorkspaceOrProject()} required value={form.ios.workspaceOrProjectPath} />
                <div className={styles.threeColumns}>
                  <Form.Group>
                    <Form.Label>Scheme</Form.Label>
                    <InputGroup>
                      <Form.Select
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
                      </Form.Select>
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
                  <Form.Group><Form.Label>Export method</Form.Label><Form.Select onChange={(event) => { if (isIosExportMethod(event.target.value)) updateIos({ exportMethod: event.target.value }); }} value={form.ios.exportMethod}><option value="release-testing">Release testing</option><option value="enterprise">Enterprise</option><option value="development">Development</option></Form.Select></Form.Group>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className={styles.section}>
          <header><span>03</span><div><h2>Build artifacts</h2><p>Generated file sources, independent of Firebase distribution</p></div></header>
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
                <Form.Group className={styles.compactField}>
                  <Form.Label>Default Android artifact</Form.Label>
                  <Form.Select onChange={(event) => updateAndroid({ defaultArtifactType: event.target.value === 'aab' ? 'aab' : 'apk' })} value={form.android.defaultArtifactType}>
                    <option value="apk">APK</option>
                    <option value="aab">AAB</option>
                  </Form.Select>
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
                <Form.Group><Form.Label>IPA source path</Form.Label><Form.Control onChange={(event) => updateIos({ artifactPath: event.target.value })} required value={form.ios.artifactPath} /><Form.Text>Required. May be relative to the iOS project directory.</Form.Text></Form.Group>
              </div>
            )}
          </div>
        </section>

        <section className={styles.section}>
          <header><span>04</span><div><h2>Pipeline extensions</h2><p>Optional safe command steps</p></div></header>
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
