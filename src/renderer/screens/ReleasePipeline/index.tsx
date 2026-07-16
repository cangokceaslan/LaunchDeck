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
  const [step, setStep] = useState<1 | 2 | 3>(1);
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
      setStep(3);
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
        {['Configure', 'Release details', 'Pipeline'].map((label, index) => (
          <li
            aria-current={step === index + 1 ? 'step' : undefined}
            className={step === index + 1 ? styles.active : step > index + 1 ? styles.complete : ''}
            key={label}
          >
            <div className={styles.stepNode}>
              <span aria-hidden="true">{step > index + 1 ? '✓' : index + 1}</span>
              <strong>{label}</strong>
            </div>
          </li>
        ))}
      </ol>

      <section className={styles.wizardCard}>
        {step === 1 && (
          <div className={styles.stepContent}>
            <header><span>Step 1</span><h2>Configure the pipeline</h2><p>Choose the operation and every platform to process in one pass.</p></header>
            <div className={styles.selectionSection}>
              <div className={styles.selectionHeading}><span>Operation</span><small>Build and upload outcomes remain independent.</small></div>
              <div className={styles.choiceGrid}>
                {modes.map((modeOption) => (
                  <button aria-pressed={mode === modeOption.value} className={mode === modeOption.value ? styles.choiceSelected : styles.choice} key={modeOption.value} onClick={() => setMode(modeOption.value)} type="button">
                    <span aria-hidden="true" className={styles.radio}>{mode === modeOption.value ? '✓' : ''}</span>
                    <strong>{modeOption.label}</strong><small>{modeOption.description}</small>
                  </button>
                ))}
              </div>
            </div>
            <div className={styles.selectionSection}>
              <div className={styles.selectionHeading}><span>Platforms</span><small>Available platforms are based on the saved application setup.</small></div>
              <div className={`${styles.choiceGrid} ${styles.platformGrid}`}>
                {availablePlatforms.map((platform) => (
                  <button aria-pressed={platforms.includes(platform)} className={platforms.includes(platform) ? styles.choiceSelected : styles.choice} key={platform} onClick={() => togglePlatform(platform)} type="button">
                    <span aria-hidden="true" className={styles.platformMark}>{platform === 'android' ? 'A' : 'i'}</span>
                    <strong>{formatPlatform(platform)}</strong><small>{platform === 'android' ? 'Gradle build and APK' : 'Xcode archive and IPA'}</small>
                  </button>
                ))}
              </div>
            </div>
            <footer><Button disabled={platforms.length === 0} onClick={() => setStep(2)}>Continue to release details</Button></footer>
          </div>
        )}

        {step === 2 && (
          <div className={styles.stepContent}>
            <header><span>Step 2</span><h2>Add release details</h2><p>These values are validated before any build or upload begins.</p></header>
            <div className={styles.selectionSummary}>
              <div><span>Operation</span><strong>{formatMode(mode)}</strong></div>
              <div><span>Platforms</span><strong>{platforms.map(formatPlatform).join(' + ')}</strong></div>
            </div>
            <div className={styles.formGrid}>
              <Form.Group><Form.Label>Release notes</Form.Label><Form.Control as="textarea" onChange={(event) => setReleaseNotes(event.target.value)} required rows={4} value={releaseNotes} /></Form.Group>
              <Form.Group><Form.Label>Tester group aliases</Form.Label><Form.Control onChange={(event) => setGroupsText(event.target.value)} required value={groupsText} /><Form.Text>Separate aliases with commas.</Form.Text></Form.Group>
              {mode === 'uploadOnly' && platforms.includes('android') && <PathField label="Android APK" onBrowse={() => void chooseArtifact('android')} required value={androidArtifactPath} />}
              {mode === 'uploadOnly' && platforms.includes('ios') && <PathField label="iOS IPA" onBrowse={() => void chooseArtifact('ios')} required value={iosArtifactPath} />}
            </div>
            {errorMessage !== null && <Alert variant="danger">{errorMessage}</Alert>}
            <footer><Button onClick={() => setStep(1)} variant="outline-secondary">Back</Button><Button disabled={isValidating || releaseNotes.trim() === '' || groupsText.trim() === ''} onClick={() => void handlePreflight()}>{isValidating && <Spinner animation="border" size="sm" />} {isValidating ? 'Validating…' : 'Review pipeline'}</Button></footer>
          </div>
        )}

        {step === 3 && (
          <div className={styles.stepContent}>
            {!isRunStarted && preflight?.isValid === false && (
              <><header><span>Step 3</span><h2>Preflight could not be completed</h2><p>Fix the blocking issues and try again.</p></header><div className={styles.issueList}>{preflight.issues.map((issue) => <Alert key={`${issue.code}-${issue.field ?? ''}`} variant="danger">{issue.message}</Alert>)}</div><footer><Button onClick={() => setStep(2)} variant="outline-secondary">Edit details</Button><Button onClick={() => void handlePreflight()}>Validate again</Button></footer></>
            )}
            {!isRunStarted && preflight?.isValid === true && (
              <><header><span>Step 3</span><h2>Ready to start</h2><p>Review the short execution summary. The plan remains valid for 10 minutes.</p></header><div className={styles.launchSummary}><div className={styles.launchPrimary}><span>Pipeline</span><strong>{formatMode(preflight.plan.mode)} · {preflight.plan.platforms.map(formatPlatform).join(' + ')}</strong><small>{preflight.plan.phaseCount} verified steps will run for {preflight.plan.distributionGroups.length} tester {preflight.plan.distributionGroups.length === 1 ? 'group' : 'groups'}.</small></div><div className={styles.planSummary}><div><span>Build target</span><strong>{preflight.plan.platforms.map(formatPlatform).join(' + ')}</strong></div><div><span>Distribution</span><strong>{preflight.plan.mode === 'buildOnly' ? 'Not requested' : `${preflight.plan.distributionGroups.length} groups`}</strong></div><div><span>Release notes</span><strong>{preflight.plan.releaseNotes.length} characters</strong></div></div></div>{preflight.warnings.map((warning) => <Alert key={warning.message} variant="warning">{warning.message}</Alert>)}{releaseRun.errorMessage !== null && <Alert variant="danger">{releaseRun.errorMessage}</Alert>}<footer><Button onClick={() => setStep(2)} variant="outline-secondary">Back</Button><Button disabled={releaseRun.status === 'starting'} onClick={() => void releaseRun.start(preflight.plan.planId)}>{releaseRun.status === 'starting' ? 'Starting…' : 'Start pipeline'}</Button></footer></>
            )}
            {isRunStarted && (
              <><PipelineProgress activePhase={releaseRun.activePhase} completedPhases={releaseRun.completedPhases} isCancelling={releaseRun.status === 'cancelling'} logs={releaseRun.logs} mode={preflight?.isValid === true ? preflight.plan.mode : mode} onCancel={() => void releaseRun.cancel()} percent={releaseRun.percent} platform={releaseRun.platform} platforms={preflight?.isValid === true ? preflight.plan.platforms : platforms} progressKind={releaseRun.progressKind} result={releaseRun.result} totalPhases={releaseRun.totalPhases} />{releaseRun.result !== null && <footer><Button onClick={onFinished}>Return to application details</Button></footer>}</>
            )}
          </div>
        )}
      </section>
    </div>
  );
};
