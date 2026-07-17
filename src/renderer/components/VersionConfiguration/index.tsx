import { Form } from 'react-bootstrap';
import { Switch } from '@components/Inputs/Switch';
import type {
  ReleaseVersionForm,
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

export const VersionConfiguration = ({
  form,
  onChange,
  platforms,
}: VersionConfigurationProps): React.JSX.Element => {
  const update = <Key extends keyof ReleaseVersionForm,>(
    key: Key,
    value: ReleaseVersionForm[Key],
  ): void => onChange({ ...form, [key]: value });
  const baseVersionName = `${form.major}.${form.minor}.${form.patch}`;
  const targetVersionName = isReleaseVersionName(baseVersionName)
    ? `${form.major}.${form.minor}.${Number(form.patch) + (form.incrementPatch ? 1 : 0)}`
    : baseVersionName;
  const isVersionNameValid = isReleaseVersionName(targetVersionName);
  const targetAndroidVersionCode = resolveCounterPreview(
    form.androidVersionCode,
    form.incrementAndroidVersionCode,
  );
  const targetIosBuildNumber = resolveCounterPreview(
    form.iosBuildNumber,
    form.incrementIosBuildNumber,
  );
  const isAndroidVersionCodeValid = isReleaseBuildNumber(targetAndroidVersionCode);
  const isIosBuildNumberValid = isReleaseBuildNumber(targetIosBuildNumber);

  return (
    <section aria-labelledby="release-version-heading" className={styles.versionCard}>
      <header>
        <div>
          <h3 id="release-version-heading">Release version</h3>
          <p>These values are written to the selected projects before pre-build commands run.</p>
        </div>
        <code>
          {baseVersionName}
          {form.incrementPatch && isVersionNameValid ? ` → ${targetVersionName}` : ''}
        </code>
      </header>

      <div className={styles.versionFields}>
        <fieldset>
          <legend>Version name</legend>
          <div className={styles.semanticVersion}>
            {VERSION_COMPONENTS.map(({ key, label }) => (
              <Form.Group key={key}>
                <Form.Label>{label}</Form.Label>
                <Form.Control
                  aria-invalid={!isVersionNameValid}
                  inputMode="numeric"
                  isInvalid={!isVersionNameValid}
                  max={2_147_483_647}
                  min={0}
                  onChange={(event) => update(key, event.target.value)}
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
            id="increment-release-patch"
            label="Increment patch automatically"
            onChange={(isChecked) => update('incrementPatch', isChecked)}
          />
          <output className={styles.targetValue}>Target: {targetVersionName}</output>
          {isVersionNameValid
            ? <small>Only patch can increment automatically. Major and minor remain manual.</small>
            : <small className={styles.invalidMessage}>Enter three valid whole numbers.</small>}
        </fieldset>

        {platforms.includes('android') && (
          <fieldset>
            <legend>Android</legend>
            <Form.Group>
              <Form.Label>Version code</Form.Label>
              <Form.Control
                aria-invalid={!isAndroidVersionCodeValid}
                inputMode="numeric"
                isInvalid={!isAndroidVersionCodeValid}
                max={2_147_483_647}
                min={1}
                onChange={(event) => update('androidVersionCode', event.target.value)}
                required
                step={1}
                type="number"
                value={form.androidVersionCode}
              />
            </Form.Group>
            <Switch
              checked={form.incrementAndroidVersionCode}
              id="increment-android-version-code"
              label="Increment version code automatically"
              onChange={(isChecked) => update('incrementAndroidVersionCode', isChecked)}
            />
            <output className={styles.targetValue}>Target: {targetAndroidVersionCode}</output>
            {isAndroidVersionCodeValid
              ? <small>Updates the literal versionCode in the Android module build file.</small>
              : <small className={styles.invalidMessage}>Enter a whole number greater than zero.</small>}
          </fieldset>
        )}

        {platforms.includes('ios') && (
          <fieldset>
            <legend>iOS</legend>
            <Form.Group>
              <Form.Label>Build number</Form.Label>
              <Form.Control
                aria-invalid={!isIosBuildNumberValid}
                inputMode="numeric"
                isInvalid={!isIosBuildNumberValid}
                max={2_147_483_647}
                min={1}
                onChange={(event) => update('iosBuildNumber', event.target.value)}
                required
                step={1}
                type="number"
                value={form.iosBuildNumber}
              />
            </Form.Group>
            <Switch
              checked={form.incrementIosBuildNumber}
              id="increment-ios-build-number"
              label="Increment build number automatically"
              onChange={(isChecked) => update('incrementIosBuildNumber', isChecked)}
            />
            <output className={styles.targetValue}>Target: {targetIosBuildNumber}</output>
            {isIosBuildNumberValid
              ? <small>Updates MARKETING_VERSION and CURRENT_PROJECT_VERSION in Xcode.</small>
              : <small className={styles.invalidMessage}>Enter a whole number greater than zero.</small>}
          </fieldset>
        )}
      </div>
    </section>
  );
};
