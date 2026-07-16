import { useState } from 'react';
import { Alert, Button, Form, Spinner } from 'react-bootstrap';
import { PathField } from '@components/PathField';
import { PipelineProgress } from '@components/PipelineProgress';
import { useReleaseRun } from '@hooks/useReleaseRun';
import { formatMode, formatPlatform, normalizeErrorMessage } from '@renderer/utils/formatting';
import type { ReleaseMode, ReleasePlatform } from '@shared/contracts/domain';
import type { PreflightResult } from '@shared/contracts/release';
import type { ReleasePipelineProps } from '@screens/ReleasePipeline/index.types';
import styles from '@screens/ReleasePipeline/index.module.scss';

const modes: Array<{ description: string; label: string; value: ReleaseMode }> = [
  { description: 'Build an artifact from source without uploading it to Firebase.', label: 'Build only', value: 'buildOnly' },
  { description: 'Upload an existing APK or IPA artifact to Firebase.', label: 'Upload only', value: 'uploadOnly' },
  { description: 'Build, verify, and upload the artifact to Firebase.', label: 'Build + upload', value: 'buildAndUpload' },
];

export const ReleasePipeline = ({
  application,
  onClose,
  onFinished,
  supportedPlatforms,
}: ReleasePipelineProps): React.JSX.Element => {
  const availablePlatforms = application.platforms.filter((platform) => supportedPlatforms.includes(platform));
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [mode, setMode] = useState<ReleaseMode>('buildAndUpload');
  const [platforms, setPlatforms] = useState<ReleasePlatform[]>(availablePlatforms);
  const [releaseNotes, setReleaseNotes] = useState(`${application.name} new test release`);
  const [groupsText, setGroupsText] = useState(application.distributionGroups.join(', '));
  const [androidArtifactPath, setAndroidArtifactPath] = useState(application.android?.artifactPath ?? '');
  const [iosArtifactPath, setIosArtifactPath] = useState(application.ios?.artifactPath ?? '');
  const [preflight, setPreflight] = useState<PreflightResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const releaseRun = useReleaseRun();

  const togglePlatform = (platform: ReleasePlatform): void => {
    setPlatforms((current) =>
      current.includes(platform)
        ? current.filter((selectedPlatform) => selectedPlatform !== platform)
        : [...current, platform],
    );
  };

  const chooseArtifact = async (platform: ReleasePlatform): Promise<void> => {
    const result =
      platform === 'android'
        ? await window.desktopApi.chooseAndroidArtifact()
        : await window.desktopApi.chooseIosArtifact();
    if (result.status === 'selected') {
      if (platform === 'android') setAndroidArtifactPath(result.path);
      else setIosArtifactPath(result.path);
    }
  };

  const handlePreflight = async (): Promise<void> => {
    setErrorMessage(null);
    setIsValidating(true);
    try {
      const result = await window.desktopApi.preflightRelease({
        androidArtifactPath: mode === 'uploadOnly' && platforms.includes('android') ? androidArtifactPath : undefined,
        applicationId: application.id,
        distributionGroups: groupsText.split(',').map((group) => group.trim()).filter(Boolean),
        iosArtifactPath: mode === 'uploadOnly' && platforms.includes('ios') ? iosArtifactPath : undefined,
        mode,
        platforms,
        releaseNotes,
      });
      setPreflight(result);
      setStep(4);
    } catch (error) {
      setErrorMessage(normalizeErrorMessage(error));
    } finally {
      setIsValidating(false);
    }
  };

  const isRunStarted = releaseRun.status !== 'idle' && releaseRun.status !== 'failedToStart';

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div><span className={styles.eyebrow}>{application.name}</span><h1>New release pipeline</h1></div>
        <Button disabled={releaseRun.status === 'running' || releaseRun.status === 'cancelling'} onClick={onClose} variant="outline-secondary">Close</Button>
      </header>

      <ol aria-label="Release steps" className={styles.stepper}>
        {['Operation', 'Platform', 'Release details', 'Pipeline'].map((label, index) => (
          <li
            aria-current={step === index + 1 ? 'step' : undefined}
            className={step === index + 1 ? styles.active : step > index + 1 ? styles.complete : ''}
            key={label}
          >
            <span>{index + 1}</span><strong>{label}</strong>
          </li>
        ))}
      </ol>

      <section className={styles.wizardCard}>
        {step === 1 && (
          <div className={styles.stepContent}>
            <header><span>Step 1</span><h2>What would you like to do?</h2><p>Build and upload outcomes are tracked separately.</p></header>
            <div className={styles.choiceGrid}>
              {modes.map((modeOption) => (
                <button aria-pressed={mode === modeOption.value} className={mode === modeOption.value ? styles.choiceSelected : styles.choice} key={modeOption.value} onClick={() => setMode(modeOption.value)} type="button">
                  <span aria-hidden="true" className={styles.radio}>{mode === modeOption.value ? '●' : '○'}</span>
                  <strong>{modeOption.label}</strong><small>{modeOption.description}</small>
                </button>
              ))}
            </div>
            <footer><Button onClick={() => setStep(2)}>Continue to platform</Button></footer>
          </div>
        )}

        {step === 2 && (
          <div className={styles.stepContent}>
            <header><span>Step 2</span><h2>Select platforms</h2><p>iOS is available on macOS only.</p></header>
            <div className={styles.choiceGrid}>
              {availablePlatforms.map((platform) => (
                <button aria-pressed={platforms.includes(platform)} className={platforms.includes(platform) ? styles.choiceSelected : styles.choice} key={platform} onClick={() => togglePlatform(platform)} type="button">
                  <span aria-hidden="true" className={styles.platformMark}>{platform === 'android' ? 'A' : 'i'}</span>
                  <strong>{formatPlatform(platform)}</strong><small>{platform === 'android' ? 'Gradle + APK' : 'Xcode + IPA'}</small>
                </button>
              ))}
            </div>
            <footer><Button onClick={() => setStep(1)} variant="outline-secondary">Back</Button><Button disabled={platforms.length === 0} onClick={() => setStep(3)}>Continue to release details</Button></footer>
          </div>
        )}

        {step === 3 && (
          <div className={styles.stepContent}>
            <header><span>Step 3</span><h2>Review release details</h2><p>Confirm the configuration before preflight begins.</p></header>
            <div className={styles.formGrid}>
              <Form.Group><Form.Label>Release notes</Form.Label><Form.Control as="textarea" onChange={(event) => setReleaseNotes(event.target.value)} required rows={4} value={releaseNotes} /></Form.Group>
              <Form.Group><Form.Label>Tester group aliases</Form.Label><Form.Control onChange={(event) => setGroupsText(event.target.value)} required value={groupsText} /><Form.Text>Separate aliases with commas.</Form.Text></Form.Group>
              {mode === 'uploadOnly' && platforms.includes('android') && <PathField label="Android APK" onBrowse={() => void chooseArtifact('android')} required value={androidArtifactPath} />}
              {mode === 'uploadOnly' && platforms.includes('ios') && <PathField label="iOS IPA" onBrowse={() => void chooseArtifact('ios')} required value={iosArtifactPath} />}
            </div>
            {errorMessage !== null && <Alert variant="danger">{errorMessage}</Alert>}
            <footer><Button onClick={() => setStep(2)} variant="outline-secondary">Back</Button><Button disabled={isValidating || releaseNotes.trim() === '' || groupsText.trim() === ''} onClick={() => void handlePreflight()}>{isValidating && <Spinner animation="border" size="sm" />} {isValidating ? 'Validating…' : 'Run preflight'}</Button></footer>
          </div>
        )}

        {step === 4 && (
          <div className={styles.stepContent}>
            {!isRunStarted && preflight?.isValid === false && (
              <><header><span>Step 4</span><h2>Preflight could not be completed</h2><p>Fix the blocking issues and try again.</p></header><div className={styles.issueList}>{preflight.issues.map((issue) => <Alert key={`${issue.code}-${issue.field ?? ''}`} variant="danger">{issue.message}</Alert>)}</div><footer><Button onClick={() => setStep(3)} variant="outline-secondary">Edit details</Button><Button onClick={() => void handlePreflight()}>Validate again</Button></footer></>
            )}
            {!isRunStarted && preflight?.isValid === true && (
              <><header><span>Step 4</span><h2>Pipeline ready to run</h2><p>The plan remains valid for 10 minutes and is validated again at startup.</p></header><div className={styles.planSummary}><div><span>Operation</span><strong>{formatMode(preflight.plan.mode)}</strong></div><div><span>Platform</span><strong>{preflight.plan.platforms.map(formatPlatform).join(' + ')}</strong></div><div><span>Steps</span><strong>{preflight.plan.phaseCount}</strong></div><div><span>Groups</span><strong>{preflight.plan.distributionGroups.length}</strong></div></div>{preflight.warnings.map((warning) => <Alert key={warning.message} variant="warning">{warning.message}</Alert>)}{releaseRun.errorMessage !== null && <Alert variant="danger">{releaseRun.errorMessage}</Alert>}<footer><Button onClick={() => setStep(3)} variant="outline-secondary">Back</Button><Button disabled={releaseRun.status === 'starting'} onClick={() => void releaseRun.start(preflight.plan.planId)}>{releaseRun.status === 'starting' ? 'Starting…' : 'Start pipeline'}</Button></footer></>
            )}
            {isRunStarted && (
              <><PipelineProgress activePhase={releaseRun.activePhase} completedPhases={releaseRun.completedPhases} isCancelling={releaseRun.status === 'cancelling'} logs={releaseRun.logs} onCancel={() => void releaseRun.cancel()} percent={releaseRun.percent} platform={releaseRun.platform} result={releaseRun.result} totalPhases={releaseRun.totalPhases} />{releaseRun.result !== null && <footer><Button onClick={onFinished}>Return to application details</Button></footer>}</>
            )}
          </div>
        )}
      </section>
    </div>
  );
};
