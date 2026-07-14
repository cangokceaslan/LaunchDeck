import { useState } from 'react';
import { Alert, Button, Form, Spinner } from 'react-bootstrap';
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
  artifactPath: 'app/build/outputs/apk/release/app-release.apk',
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
            artifactPath: application.android.artifactPath,
            googleServicesJsonPath: application.android.googleServicesJsonPath,
            gradleTask: application.android.gradleTask,
            projectPath: application.android.projectPath,
          },
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
          <span className={styles.eyebrow}>Bir kerelik kurulum</span>
          <h1>{application === null ? 'Yeni uygulama ekle' : 'Kurulumu düzenle'}</h1>
          <p>Dosya ve klasör seçimleri doğrulandıktan sonra uygulama detayında korunur.</p>
        </div>
      </header>

      <Form onSubmit={(event) => void handleSubmit(event)}>
        <section className={styles.section}>
          <header><span>01</span><div><h2>Firebase projesi</h2><p>Kimlik ve dağıtım hedefi</p></div></header>
          <div className={styles.sectionBody}>
            <div className={styles.twoColumns}>
              <Form.Group>
                <Form.Label>Uygulama adı</Form.Label>
                <Form.Control
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Örn. ISTON Mobil"
                  required
                  value={form.name}
                />
              </Form.Group>
              <Form.Group>
                <Form.Label>Firebase Project ID</Form.Label>
                <Form.Control
                  onChange={(event) => setForm((current) => ({ ...current, firebaseProjectId: event.target.value }))}
                  placeholder="Service Account’tan otomatik çözülebilir"
                  value={form.firebaseProjectId}
                />
              </Form.Group>
            </div>
            <PathField
              helpText={application === null ? 'Yol işletim sistemi güvenli depolamasıyla şifrelenir.' : `Mevcut: ${application.serviceAccountFileName}. Değiştirmek istemiyorsanız boş bırakın.`}
              label="Firebase Service Account JSON"
              onBrowse={() => void choosePath(window.desktopApi.chooseServiceAccountFile, (selectedPath) => setForm((current) => ({ ...current, serviceAccountPath: selectedPath })))}
              required={application === null}
              value={form.serviceAccountPath}
            />
            <Form.Group>
              <Form.Label>Tester grup aliasları</Form.Label>
              <Form.Control onChange={(event) => setGroupsText(event.target.value)} required value={groupsText} />
              <Form.Text>Virgülle ayırın. Örn. internal-testers, qa-team</Form.Text>
            </Form.Group>
          </div>
        </section>

        <section className={styles.section}>
          <header><span>02</span><div><h2>Platformlar</h2><p>Build kaynağı ve artifact hedefi</p></div></header>
          <div className={styles.sectionBody}>
            <div className={styles.platformToggle}>
              <Form.Check
                checked={form.android !== null}
                label="Android kullan"
                onChange={(event) => setForm((current) => ({ ...current, android: event.target.checked ? defaultAndroid() : null }))}
                type="switch"
              />
              <Form.Check
                checked={form.ios !== null}
                disabled={!supportedPlatforms.includes('ios')}
                label="iOS kullan (yalnız macOS)"
                onChange={(event) => setForm((current) => ({ ...current, ios: event.target.checked ? defaultIos() : null }))}
                type="switch"
              />
            </div>

            {form.android !== null && (
              <div className={styles.platformPanel}>
                <h3>Android</h3>
                <PathField label="Android uygulama klasörü" onBrowse={() => void choosePath(window.desktopApi.chooseAndroidProjectDirectory, (projectPath) => updateAndroid({ projectPath }))} required value={form.android.projectPath} />
                <PathField label="google-services.json" onBrowse={() => void choosePath(window.desktopApi.chooseGoogleServicesJson, (googleServicesJsonPath) => updateAndroid({ googleServicesJsonPath }))} required value={form.android.googleServicesJsonPath} />
                <div className={styles.twoColumns}>
                  <Form.Group><Form.Label>Gradle görevi</Form.Label><Form.Control onChange={(event) => updateAndroid({ gradleTask: event.target.value })} required value={form.android.gradleTask} /></Form.Group>
                  <Form.Group><Form.Label>APK artifact yolu</Form.Label><Form.Control onChange={(event) => updateAndroid({ artifactPath: event.target.value })} required value={form.android.artifactPath} /><Form.Text>Android proje klasörüne göre relatif olabilir.</Form.Text></Form.Group>
                </div>
              </div>
            )}

            {form.ios !== null && (
              <div className={styles.platformPanel}>
                <h3>iOS</h3>
                <PathField label="iOS uygulama klasörü" onBrowse={() => void choosePath(window.desktopApi.chooseIosProjectDirectory, (projectPath) => updateIos({ projectPath }))} required value={form.ios.projectPath} />
                <PathField label="GoogleService-Info.plist" onBrowse={() => void choosePath(window.desktopApi.chooseGoogleServiceInfoPlist, (googleServiceInfoPlistPath) => updateIos({ googleServiceInfoPlistPath }))} required value={form.ios.googleServiceInfoPlistPath} />
                <PathField label="Xcode workspace / project" onBrowse={() => void choosePath(window.desktopApi.chooseIosWorkspaceOrProject, (workspaceOrProjectPath) => updateIos({ workspaceOrProjectPath }))} required value={form.ios.workspaceOrProjectPath} />
                <div className={styles.threeColumns}>
                  <Form.Group><Form.Label>Scheme</Form.Label><Form.Control onChange={(event) => updateIos({ scheme: event.target.value })} required value={form.ios.scheme} /></Form.Group>
                  <Form.Group><Form.Label>Configuration</Form.Label><Form.Control onChange={(event) => updateIos({ configuration: event.target.value })} required value={form.ios.configuration} /></Form.Group>
                  <Form.Group><Form.Label>Export metodu</Form.Label><Form.Select onChange={(event) => { if (isIosExportMethod(event.target.value)) updateIos({ exportMethod: event.target.value }); }} value={form.ios.exportMethod}><option value="release-testing">Release testing</option><option value="enterprise">Enterprise</option><option value="development">Development</option></Form.Select></Form.Group>
                </div>
                <Form.Group><Form.Label>IPA artifact yolu</Form.Label><Form.Control onChange={(event) => updateIos({ artifactPath: event.target.value })} required value={form.ios.artifactPath} /><Form.Text>iOS proje klasörüne göre relatif olabilir.</Form.Text></Form.Group>
              </div>
            )}
          </div>
        </section>

        <section className={styles.section}>
          <header><span>03</span><div><h2>Pipeline uzantıları</h2><p>İsteğe bağlı güvenli komut adımları</p></div></header>
          <div className={styles.sectionBody}>
            <Alert variant="warning">Bu adımlar yerel makinede çalışır. Yalnız güvendiğiniz çalıştırılabilir dosyaları ve klasörleri seçin.</Alert>
            <HookEditor hooks={form.hooks} onChange={(hooks) => setForm((current) => ({ ...current, hooks }))} supportedPlatforms={supportedPlatforms} />
          </div>
        </section>

        {errorMessage !== null && <Alert variant="danger">{errorMessage}</Alert>}
        <footer className={styles.formFooter}>
          <Button disabled={isSaving} onClick={onCancel} type="button" variant="outline-secondary">Vazgeç</Button>
          <Button disabled={isSaving || (form.android === null && form.ios === null)} type="submit">
            {isSaving && <Spinner animation="border" className={styles.buttonSpinner} size="sm" />}
            {application === null ? 'Kurulumu tamamla' : 'Değişiklikleri kaydet'}
          </Button>
        </footer>
      </Form>
    </div>
  );
};
