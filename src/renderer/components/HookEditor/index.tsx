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
  name: 'New custom step',
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
          <h3>Custom pipeline steps</h3>
          <p>The executable and arguments are stored separately, and no shell is used.</p>
        </div>
        <Button onClick={() => onChange([...hooks, createHook()])} size="sm" variant="outline-secondary">
          Add step
        </Button>
      </header>
      {hooks.length === 0 ? (
        <div className={styles.empty}>No pre/post build or upload commands have been configured.</div>
      ) : (
        <div className={styles.hookList}>
          {hooks.map((hook, index) => (
            <article className={styles.hookCard} key={hook.id}>
              <div className={styles.hookHeader}>
                <Form.Check
                  checked={hook.isEnabled}
                  label="Enabled"
                  onChange={(event) => updateHook(index, { isEnabled: event.target.checked })}
                  type="switch"
                />
                <Button
                  aria-label={`Delete ${hook.name}`}
                  onClick={() => onChange(hooks.filter(({ id }) => id !== hook.id))}
                  size="sm"
                  variant="link"
                >
                  Delete
                </Button>
              </div>
              <div className={styles.fieldGrid}>
                <Form.Group>
                  <Form.Label>Step name</Form.Label>
                  <Form.Control
                    onChange={(event) => updateHook(index, { name: event.target.value })}
                    value={hook.name}
                  />
                </Form.Group>
                <Form.Group>
                  <Form.Label>Phase</Form.Label>
                  <Form.Select
                    onChange={(event) => {
                      if (isHookPhase(event.target.value)) updateHook(index, { phase: event.target.value });
                    }}
                    value={hook.phase}
                  >
                    <option value="preBuild">Before build</option>
                    <option value="postBuild">After build</option>
                    <option value="preUpload">Before upload</option>
                    <option value="postUpload">After upload</option>
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
                    <option value="all">All</option>
                    {supportedPlatforms.includes('android') && <option value="android">Android</option>}
                    {supportedPlatforms.includes('ios') && <option value="ios">iOS</option>}
                  </Form.Select>
                </Form.Group>
              </div>
              <PathField
                buttonLabel="Select file"
                helpText="Select a binary or executable script. Symbolic links are resolved safely to their real target."
                label="Executable file"
                onBrowse={() => void chooseExecutable(index)}
                required
                value={hook.executablePath}
              />
              <PathField label="Working directory" onBrowse={() => void chooseDirectory(index)} required value={hook.cwdPath} />
              <Form.Group>
                <Form.Label>Arguments</Form.Label>
                <Form.Control
                  as="textarea"
                  onChange={(event) => updateHook(index, { args: event.target.value.split('\n') })}
                  placeholder={'One argument per line\ne.g. --configuration\ne.g. release'}
                  rows={3}
                  value={hook.args.join('\n')}
                />
                <Form.Text>Each line is one argument. Shell operators are not interpreted.</Form.Text>
              </Form.Group>
            </article>
          ))}
        </div>
      )}
    </section>
  );
};
