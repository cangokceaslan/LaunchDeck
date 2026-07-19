import { Form } from 'react-bootstrap';
import { Switch } from '@components/Inputs/Switch';
import type {
  AndroidReleaseVersionForm,
  IosReleaseVersionForm,
  SemanticVersionForm,
  VersionConfigurationProps,
} from '@components/VersionConfiguration/index.types';
import { isReleaseBuildNumber, isReleaseVersionName } from '@shared/validation';
import styles from '@components/VersionConfiguration/index.module.scss';

const VERSION_COMPONENTS = [
  { key: 'major', label: 'Major' },
  { key: 'minor', label: 'Minor' },
  { key: 'patch', label: 'Patch' },
] as const satisfies ReadonlyArray<{
  key: 'major' | 'minor' | 'patch';
  label: string;
}>;

const resolveCounterPreview = (counter: string, shouldIncrement: boolean): string => {
  if (!isReleaseBuildNumber(counter)) return counter;
  return String(Number(counter) + (shouldIncrement ? 1 : 0));
};

type VersionNameFieldsProps = {
  form: SemanticVersionForm;
  idPrefix: 'android' | 'ios';
  onComponentChange: (key: 'major' | 'minor' | 'patch', value: string) => void;
  onIncrementChange: (isChecked: boolean) => void;
};

const resolveVersionNamePreview = (
  form: SemanticVersionForm,
): { isValid: boolean; target: string } => {
  const base = `${form.major}.${form.minor}.${form.patch}`;
  const target = isReleaseVersionName(base)
    ? `${form.major}.${form.minor}.${Number(form.patch) + (form.incrementPatch ? 1 : 0)}`
    : base;
  return { isValid: isReleaseVersionName(target), target };
};

const VersionNameFields = ({
  form,
  idPrefix,
  onComponentChange,
  onIncrementChange,
}: VersionNameFieldsProps): React.JSX.Element => {
  const preview = resolveVersionNamePreview(form);

  return (
    <fieldset>
      <legend>Version name</legend>
      <div className={styles.semanticVersion}>
        {VERSION_COMPONENTS.map(({ key, label }) => (
          <Form.Group key={key}>
            <Form.Label>{label}</Form.Label>
            <Form.Control
              aria-invalid={!preview.isValid}
              inputMode="numeric"
              isInvalid={!preview.isValid}
              max={2_147_483_647}
              min={0}
              onChange={(event) => onComponentChange(key, event.target.value)}
              required
              step={1}
              type="number"
              value={form[key]}
            />
          </Form.Group>
        ))}
      </div>
      <Switch
        checked={form.incrementPatch}
        id={`increment-${idPrefix}-release-patch`}
        label="Increment patch automatically"
        onChange={onIncrementChange}
      />
      <output className={styles.targetValue}>Target: {preview.target}</output>
      {preview.isValid ? (
        <small>Only patch can increment automatically. Major and minor remain manual.</small>
      ) : (
        <small className={styles.invalidMessage}>Enter three valid whole numbers.</small>
      )}
    </fieldset>
  );
};

export const VersionConfiguration = ({
  form,
  onChange,
  platforms,
}: VersionConfigurationProps): React.JSX.Element => {
  const updateAndroid = <Key extends keyof AndroidReleaseVersionForm,>(
    key: Key,
    value: AndroidReleaseVersionForm[Key],
  ): void => onChange({ ...form, android: { ...form.android, [key]: value } });
  const updateIos = <Key extends keyof IosReleaseVersionForm,>(
    key: Key,
    value: IosReleaseVersionForm[Key],
  ): void => onChange({ ...form, ios: { ...form.ios, [key]: value } });
  const androidVersionName = resolveVersionNamePreview(form.android);
  const iosVersionName = resolveVersionNamePreview(form.ios);
  const targetAndroidVersionCode = resolveCounterPreview(
    form.android.versionCode,
    form.android.incrementVersionCode,
  );
  const targetIosBuildNumber = resolveCounterPreview(
    form.ios.buildNumber,
    form.ios.incrementBuildNumber,
  );
  const isAndroidVersionCodeValid = isReleaseBuildNumber(targetAndroidVersionCode);
  const isIosBuildNumberValid = isReleaseBuildNumber(targetIosBuildNumber);

  return (
    <section aria-labelledby="release-version-heading" className={styles.versionCard}>
      <header>
        <div>
          <h3 id="release-version-heading">Platform versions</h3>
          <p>Each selected platform keeps an independent version and build counter.</p>
        </div>
      </header>

      <div className={styles.platformVersions}>
        {platforms.includes('android') && (
          <article className={styles.platformVersion}>
            <header>
              <div>
                <span>Android</span>
                <h4>Android version</h4>
              </div>
              <code>{androidVersionName.target}</code>
            </header>
            <div className={styles.versionFields}>
              <VersionNameFields
                form={form.android}
                idPrefix="android"
                onComponentChange={(key, value) => updateAndroid(key, value)}
                onIncrementChange={(isChecked) => updateAndroid('incrementPatch', isChecked)}
              />
              <fieldset>
                <legend>Version code</legend>
                <Form.Group>
                  <Form.Label>Current value</Form.Label>
                  <Form.Control
                    aria-invalid={!isAndroidVersionCodeValid}
                    inputMode="numeric"
                    isInvalid={!isAndroidVersionCodeValid}
                    max={2_147_483_647}
                    min={1}
                    onChange={(event) => updateAndroid('versionCode', event.target.value)}
                    required
                    step={1}
                    type="number"
                    value={form.android.versionCode}
                  />
                </Form.Group>
                <Switch
                  checked={form.android.incrementVersionCode}
                  id="increment-android-version-code"
                  label="Increment version code automatically"
                  onChange={(isChecked) => updateAndroid('incrementVersionCode', isChecked)}
                />
                <output className={styles.targetValue}>Target: {targetAndroidVersionCode}</output>
                {isAndroidVersionCodeValid ? (
                  <small>Updates the literal versionCode in the Android module build file.</small>
                ) : (
                  <small className={styles.invalidMessage}>
                    Enter a whole number greater than zero.
                  </small>
                )}
              </fieldset>
            </div>
          </article>
        )}

        {platforms.includes('ios') && (
          <article className={styles.platformVersion}>
            <header>
              <div>
                <span>iOS</span>
                <h4>iOS version</h4>
              </div>
              <code>{iosVersionName.target}</code>
            </header>
            <div className={styles.versionFields}>
              <VersionNameFields
                form={form.ios}
                idPrefix="ios"
                onComponentChange={(key, value) => updateIos(key, value)}
                onIncrementChange={(isChecked) => updateIos('incrementPatch', isChecked)}
              />
              <fieldset>
                <legend>Build number</legend>
                <Form.Group>
                  <Form.Label>Current value</Form.Label>
                  <Form.Control
                    aria-invalid={!isIosBuildNumberValid}
                    inputMode="numeric"
                    isInvalid={!isIosBuildNumberValid}
                    max={2_147_483_647}
                    min={1}
                    onChange={(event) => updateIos('buildNumber', event.target.value)}
                    required
                    step={1}
                    type="number"
                    value={form.ios.buildNumber}
                  />
                </Form.Group>
                <Switch
                  checked={form.ios.incrementBuildNumber}
                  id="increment-ios-build-number"
                  label="Increment build number automatically"
                  onChange={(isChecked) => updateIos('incrementBuildNumber', isChecked)}
                />
                <output className={styles.targetValue}>Target: {targetIosBuildNumber}</output>
                {isIosBuildNumberValid ? (
                  <small>Updates MARKETING_VERSION and CURRENT_PROJECT_VERSION in Xcode.</small>
                ) : (
                  <small className={styles.invalidMessage}>
                    Enter a whole number greater than zero.
                  </small>
                )}
              </fieldset>
            </div>
          </article>
        )}
      </div>
    </section>
  );
};
