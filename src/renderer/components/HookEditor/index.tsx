import { Button, Form } from 'react-bootstrap';
import { PathField } from '@components/PathField';
import type { HookEditorProps } from '@components/HookEditor/index.types';
import type { PipelineHook } from '@shared/contracts/domain';
import styles from '@components/HookEditor/index.module.scss';

const createHook = (): PipelineHook => ({
  args: [],
  cwdPath: '',
  executablePath: '',
  id: crypto.randomUUID(),
  isEnabled: true,
  name: 'Yeni özel adım',
  phase: 'preBuild',
  platform: 'all',
});

const isHookPhase = (value: string): value is PipelineHook['phase'] =>
  value === 'preBuild' || value === 'postBuild' || value === 'preUpload' || value === 'postUpload';

const isHookPlatform = (value: string): value is PipelineHook['platform'] =>
  value === 'all' || value === 'android' || value === 'ios';

export const HookEditor = ({
  hooks,
  onChange,
  supportedPlatforms,
}: HookEditorProps): React.JSX.Element => {
  const updateHook = (index: number, patch: Partial<PipelineHook>): void => {
    onChange(hooks.map((hook, hookIndex) => (hookIndex === index ? { ...hook, ...patch } : hook)));
  };

  const chooseExecutable = async (index: number): Promise<void> => {
    const result = await window.desktopApi.chooseHookExecutable();
    if (result.status === 'selected') updateHook(index, { executablePath: result.path });
  };

  const chooseDirectory = async (index: number): Promise<void> => {
    const result = await window.desktopApi.chooseHookDirectory();
    if (result.status === 'selected') updateHook(index, { cwdPath: result.path });
  };

  return (
    <section className={styles.editor}>
      <header>
        <div>
          <h3>Özel pipeline adımları</h3>
          <p>Komut metni yerine çalıştırılabilir dosya ve argümanlar ayrı tutulur; shell kullanılmaz.</p>
        </div>
        <Button onClick={() => onChange([...hooks, createHook()])} size="sm" variant="outline-secondary">
          Adım ekle
        </Button>
      </header>
      {hooks.length === 0 ? (
        <div className={styles.empty}>Pre/post build veya upload komutu tanımlanmadı.</div>
      ) : (
        <div className={styles.hookList}>
          {hooks.map((hook, index) => (
            <article className={styles.hookCard} key={hook.id}>
              <div className={styles.hookHeader}>
                <Form.Check
                  checked={hook.isEnabled}
                  label="Etkin"
                  onChange={(event) => updateHook(index, { isEnabled: event.target.checked })}
                  type="switch"
                />
                <Button
                  aria-label={`${hook.name} adımını sil`}
                  onClick={() => onChange(hooks.filter(({ id }) => id !== hook.id))}
                  size="sm"
                  variant="link"
                >
                  Sil
                </Button>
              </div>
              <div className={styles.fieldGrid}>
                <Form.Group>
                  <Form.Label>Adım adı</Form.Label>
                  <Form.Control
                    onChange={(event) => updateHook(index, { name: event.target.value })}
                    value={hook.name}
                  />
                </Form.Group>
                <Form.Group>
                  <Form.Label>Faz</Form.Label>
                  <Form.Select
                    onChange={(event) => {
                      if (isHookPhase(event.target.value)) updateHook(index, { phase: event.target.value });
                    }}
                    value={hook.phase}
                  >
                    <option value="preBuild">Build öncesi</option>
                    <option value="postBuild">Build sonrası</option>
                    <option value="preUpload">Upload öncesi</option>
                    <option value="postUpload">Upload sonrası</option>
                  </Form.Select>
                </Form.Group>
                <Form.Group>
                  <Form.Label>Platform</Form.Label>
                  <Form.Select
                    onChange={(event) => {
                      if (isHookPlatform(event.target.value)) updateHook(index, { platform: event.target.value });
                    }}
                    value={hook.platform}
                  >
                    <option value="all">Tümü</option>
                    {supportedPlatforms.includes('android') && <option value="android">Android</option>}
                    {supportedPlatforms.includes('ios') && <option value="ios">iOS</option>}
                  </Form.Select>
                </Form.Group>
              </div>
              <PathField label="Çalıştırılabilir dosya" onBrowse={() => void chooseExecutable(index)} required value={hook.executablePath} />
              <PathField label="Çalışma klasörü" onBrowse={() => void chooseDirectory(index)} required value={hook.cwdPath} />
              <Form.Group>
                <Form.Label>Argümanlar</Form.Label>
                <Form.Control
                  as="textarea"
                  onChange={(event) => updateHook(index, { args: event.target.value.split('\n') })}
                  placeholder={'Her satıra bir argüman\nÖrnek: --configuration\nÖrnek: release'}
                  rows={3}
                  value={hook.args.join('\n')}
                />
                <Form.Text>Her satır tek bir argümandır; shell operatörleri yorumlanmaz.</Form.Text>
              </Form.Group>
            </article>
          ))}
        </div>
      )}
    </section>
  );
};
