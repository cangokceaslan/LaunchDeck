import { useState } from 'react';
import { Alert, Button, Form, Spinner } from 'react-bootstrap';
import { PathField } from '@components/PathField';
import { PipelineProgress } from '@components/PipelineProgress';
import { VersionConfiguration } from '@components/VersionConfiguration';
import type { ReleaseVersionForm } from '@components/VersionConfiguration/index.types';
import { useReleaseRun } from '@hooks/useReleaseRun';
import { formatMode, formatPlatform, normalizeErrorMessage } from '@renderer/utils/formatting';
import type {
  AndroidArtifactType,
  DistributionDestination,
  ReleaseMode,
  ReleasePlatform,
} from '@shared/contracts/domain';
import type { PreflightResult, ResolvedReleasePlan } from '@shared/contracts/release';
import type { ReleasePipelineProps } from '@screens/ReleasePipeline/index.types';
import {
  formatResolvedVersion,
  resolveReleaseVersionInput,
} from '@screens/ReleasePipeline/index.utils';
import styles from '@screens/ReleasePipeline/index.module.scss';

type ArtifactSource = 'build' | 'existing';

const resolveMode = (source: ArtifactSource, destinations: DistributionDestination[]): ReleaseMode =>
  source === 'existing'
    ? 'uploadOnly'
    : destinations.some((destination) => destination !== 'artifact')
      ? 'buildAndUpload'
      : 'buildOnly';

const formatArtifactSummary = (plan: ResolvedReleasePlan): string =>
  plan.platforms
    .map((platform) =>
      platform === 'android' ? (plan.androidArtifactType ?? 'apk').toUpperCase() : 'IPA',
    )
    .join(' + ');

export const ReleasePipeline = ({
  application,
  onApplicationUpdated,
  onClose,
  onFinished,
  supportedPlatforms,
}: ReleasePipelineProps): React.JSX.Element => {
  const availablePlatforms = application.platforms.filter((platform) => supportedPlatforms.includes(platform));
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [source, setSource] = useState<ArtifactSource>('build');
  const availableDestinations: DistributionDestination[] = [
    ...(application.artifactGeneration.isEnabled ? ['artifact' as const] : []),
    ...(application.firebaseDistribution.isEnabled ? ['firebase' as const] : []),
    ...(application.googlePlay !== null || application.appStoreConnect !== null ? ['store' as const] : []),
  ];
  const [destinations, setDestinations] = useState<DistributionDestination[]>(
    availableDestinations.includes('firebase') ? ['firebase'] : availableDestinations.slice(0, 1),
  );
  const [platforms, setPlatforms] = useState<ReleasePlatform[]>(availablePlatforms);
  const [androidArtifactType, setAndroidArtifactType] = useState<AndroidArtifactType>(
    application.android?.defaultArtifactType ?? 'apk',
  );
  const [releaseNotes, setReleaseNotes] = useState(`${application.name} new test release`);
  const [groupsText, setGroupsText] = useState(application.distributionGroups.join(', '));
  const [androidArtifactPath, setAndroidArtifactPath] = useState('');
  const [iosArtifactPath, setIosArtifactPath] = useState('');
  const [artifactOutputDirectoryPath, setArtifactOutputDirectoryPath] = useState(
    application.artifactOutputDirectoryPath ?? '',
  );
  const [versionForm, setVersionForm] = useState<ReleaseVersionForm>({
    androidVersionCode: '1',
    incrementAndroidVersionCode: false,
    incrementIosBuildNumber: false,
    incrementPatch: false,
    iosBuildNumber: '1',
    major: '1',
    minor: '0',
    patch: '0',
  });
  const [preflight, setPreflight] = useState<PreflightResult | null>(null);
  const [isSavingOutputDirectory, setIsSavingOutputDirectory] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const releaseRun = useReleaseRun();
  const mode = resolveMode(source, destinations);
  const isFirebaseTarget = destinations.includes('firebase');
  const isArtifactTarget = destinations.includes('artifact');
  const availableAndroidArtifactTypes: AndroidArtifactType[] = destinations.includes('store') && application.googlePlay !== null
    ? [application.googlePlay.artifactType]
    : isArtifactTarget
      ? application.artifactGeneration.androidArtifactTypes
      : ['apk', 'aab'];
  const canUseStore = platforms.every((platform) =>
    platform === 'android' ? application.googlePlay !== null : application.appStoreConnect !== null,
  ) && !(source === 'existing' && platforms.includes('ios'));
  const releaseVersion = source === 'build'
    ? resolveReleaseVersionInput(versionForm, platforms)
    : undefined;

  const togglePlatform = (platform: ReleasePlatform): void => {
    const nextPlatforms = platforms.includes(platform)
      ? platforms.filter((selectedPlatform) => selectedPlatform !== platform)
      : [...platforms, platform];
    setPlatforms(nextPlatforms);
    const canKeepStore = nextPlatforms.every((selectedPlatform) =>
      selectedPlatform === 'android' ? application.googlePlay !== null : application.appStoreConnect !== null,
    ) && !(source === 'existing' && nextPlatforms.includes('ios'));
    if (!canKeepStore) {
      setDestinations((currentDestinations) => currentDestinations.filter((destination) => destination !== 'store'));
    }
  };

  const handleSourceChange = (nextSource: ArtifactSource): void => {
    setSource(nextSource);
    if (nextSource === 'existing') {
      setDestinations((current) => current.filter((destination) =>
        destination !== 'artifact' && !(destination === 'store' && platforms.includes('ios')),
      ));
    }
  };

  const toggleDestination = (destination: DistributionDestination): void => {
    if (destination === 'store' && !destinations.includes('store') && application.googlePlay !== null) {
      setAndroidArtifactType(application.googlePlay.artifactType);
    }
    setDestinations((current) =>
      current.includes(destination)
        ? current.filter((selectedDestination) => selectedDestination !== destination)
        : [...current, destination],
    );
  };

  const handleVersionChange = (nextVersionForm: ReleaseVersionForm): void => {
    setVersionForm(nextVersionForm);
    setErrorMessage(null);
    setPreflight(null);
  };

  const chooseArtifact = async (platform: ReleasePlatform): Promise<void> => {
    const result =
      platform === 'android'
        ? await window.desktopApi.chooseAndroidArtifact()
        : await window.desktopApi.chooseIosArtifact();
    if (result.status !== 'selected') return;
    if (platform === 'android') {
      setAndroidArtifactPath(result.path);
      setAndroidArtifactType(result.path.toLowerCase().endsWith('.aab') ? 'aab' : 'apk');
    } else {
      setIosArtifactPath(result.path);
    }
  };

  const chooseOutputDirectory = async (): Promise<void> => {
    const result = await window.desktopApi.chooseArtifactOutputDirectory();
    if (result.status !== 'selected') return;
    setErrorMessage(null);
    setIsSavingOutputDirectory(true);
    try {
      const updatedApplication = await window.desktopApi.updateArtifactOutputDirectory({
        applicationId: application.id,
        directoryPath: result.path,
      });
      setArtifactOutputDirectoryPath(updatedApplication.artifactOutputDirectoryPath ?? result.path);
      onApplicationUpdated(updatedApplication);
    } catch (error) {
      setErrorMessage(normalizeErrorMessage(error));
    } finally {
      setIsSavingOutputDirectory(false);
    }
  };

  const handlePreflight = async (): Promise<void> => {
    setErrorMessage(null);
    if (source === 'build' && releaseVersion === null) {
      setErrorMessage('Enter valid release version values before validation.');
      return;
    }
    setIsValidating(true);
    try {
      const result = await window.desktopApi.preflightRelease({
        androidArtifactPath: mode === 'uploadOnly' && platforms.includes('android') ? androidArtifactPath : undefined,
        androidArtifactType: platforms.includes('android') ? androidArtifactType : undefined,
        applicationId: application.id,
        artifactOutputDirectoryPath: isArtifactTarget ? artifactOutputDirectoryPath : undefined,
        distributionGroups: isFirebaseTarget
          ? groupsText.split(',').map((group) => group.trim()).filter(Boolean)
          : [],
        destinations,
        iosArtifactPath: mode === 'uploadOnly' && platforms.includes('ios') ? iosArtifactPath : undefined,
        mode,
        platforms,
        releaseNotes: destinations.some((destination) => destination !== 'artifact') ? releaseNotes : '',
        version: releaseVersion ?? undefined,
      });
      if (
        result.isValid === false &&
        result.issues.some((issue) => issue.code === 'outputDirectoryUnavailable')
      ) {
        setArtifactOutputDirectoryPath('');
        setErrorMessage(
          result.issues.find((issue) => issue.code === 'outputDirectoryUnavailable')?.message ??
            'Select an available artifact output directory.',
        );
        return;
      }
      setPreflight(result);
      setStep(3);
    } catch (error) {
      setErrorMessage(normalizeErrorMessage(error));
    } finally {
      setIsValidating(false);
    }
  };

  const isRunStarted = releaseRun.status !== 'idle' && releaseRun.status !== 'failedToStart';
  const isExistingArtifactMissing =
    source === 'existing' &&
    ((platforms.includes('android') && androidArtifactPath.trim() === '') ||
      (platforms.includes('ios') && iosArtifactPath.trim() === ''));
  const isDetailsIncomplete =
    isValidating ||
    isSavingOutputDirectory ||
    isExistingArtifactMissing ||
    (source === 'build' && releaseVersion === null) ||
    (isFirebaseTarget && (releaseNotes.trim() === '' || groupsText.trim() === '')) ||
    (destinations.length === 0) ||
    (isArtifactTarget && artifactOutputDirectoryPath.trim() === '') ||
    (destinations.includes('store') && releaseNotes.trim() === '');

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div><span className={styles.eyebrow}>{application.name}</span><h1>New release pipeline</h1></div>
        <Button disabled={releaseRun.status === 'running' || releaseRun.status === 'cancelling'} onClick={onClose} variant="outline-secondary">Close</Button>
      </header>

      <ol aria-label="Release steps" className={styles.stepper}>
        {['Configure', 'Release details', 'Pipeline'].map((label, index) => (
          <li aria-current={step === index + 1 ? 'step' : undefined} className={step === index + 1 ? styles.active : step > index + 1 ? styles.complete : ''} key={label}>
            <div className={styles.stepNode}><span aria-hidden="true">{step > index + 1 ? '✓' : index + 1}</span><strong>{label}</strong></div>
          </li>
        ))}
      </ol>

      <section className={styles.wizardCard}>
        {step === 1 && (
          <div className={styles.stepContent}>
            <header><span>Step 1</span><h2>Configure the pipeline</h2><p>Choose where the artifact comes from and what happens after validation.</p></header>
            <div className={styles.selectionSection}>
              <div className={styles.selectionHeading}><span>Artifact source</span><small>Build a new release or distribute an existing artifact.</small></div>
              <div className={`${styles.choiceGrid} ${styles.twoChoiceGrid}`}>
                <button aria-pressed={source === 'build'} className={source === 'build' ? styles.choiceSelected : styles.choice} onClick={() => handleSourceChange('build')} type="button"><span aria-hidden="true" className={styles.radio}>{source === 'build' ? '✓' : ''}</span><strong>Build new artifact</strong><small>Run the configured Gradle or Xcode build.</small></button>
                <button aria-pressed={source === 'existing'} className={source === 'existing' ? styles.choiceSelected : styles.choice} onClick={() => handleSourceChange('existing')} type="button"><span aria-hidden="true" className={styles.radio}>{source === 'existing' ? '✓' : ''}</span><strong>Use existing artifact</strong><small>Select an APK, AAB, or IPA and distribute it.</small></button>
              </div>
            </div>
            <div className={styles.selectionSection}>
              <div className={styles.selectionHeading}><span>Destinations</span><small>Select one or more configured outcomes.</small></div>
              <div className={styles.choiceGrid}>
                {availableDestinations.includes('firebase') && <button aria-pressed={destinations.includes('firebase')} className={destinations.includes('firebase') ? styles.choiceSelected : styles.choice} onClick={() => toggleDestination('firebase')} type="button"><span aria-hidden="true" className={styles.radio}>{destinations.includes('firebase') ? '✓' : ''}</span><strong>Firebase App Distribution</strong><small>Upload the verified artifact to configured tester groups.</small></button>}
                {availableDestinations.includes('artifact') && <button aria-pressed={destinations.includes('artifact')} className={destinations.includes('artifact') ? styles.choiceSelected : styles.choice} disabled={source === 'existing'} onClick={() => toggleDestination('artifact')} type="button"><span aria-hidden="true" className={styles.radio}>{destinations.includes('artifact') ? '✓' : ''}</span><strong>Generate artifact</strong><small>Save APK, AAB, or IPA to the configured local folder.</small></button>}
                {availableDestinations.includes('store') && <button aria-pressed={destinations.includes('store')} className={destinations.includes('store') ? styles.choiceSelected : styles.choice} disabled={!canUseStore} onClick={() => toggleDestination('store')} type="button"><span aria-hidden="true" className={styles.radio}>{destinations.includes('store') ? '✓' : ''}</span><strong>Store Distribution</strong><small>{source === 'existing' && platforms.includes('ios') ? 'App Store upload requires a new verified Xcode archive.' : 'Send signed builds to Google Play or App Store Connect.'}</small></button>}
              </div>
            </div>
            <div className={styles.selectionSection}>
              <div className={styles.selectionHeading}><span>Platforms</span><small>Available platforms are based on the saved application setup.</small></div>
              <div className={`${styles.choiceGrid} ${styles.platformGrid}`}>
                {availablePlatforms.map((platform) => (
                  <button aria-pressed={platforms.includes(platform)} className={platforms.includes(platform) ? styles.choiceSelected : styles.choice} key={platform} onClick={() => togglePlatform(platform)} type="button"><span aria-hidden="true" className={styles.platformMark}>{platform === 'android' ? 'A' : 'i'}</span><strong>{formatPlatform(platform)}</strong><small>{platform === 'android' ? 'Gradle build · APK or AAB' : 'Xcode archive · IPA'}</small></button>
                ))}
              </div>
            </div>
            {source === 'build' && platforms.includes('android') && (
              <div className={styles.selectionSection}>
                <div className={styles.selectionHeading}><span>Android artifact</span><small>This choice applies only to the current pipeline.</small></div>
                <div className={`${styles.choiceGrid} ${styles.twoChoiceGrid} ${styles.compactChoices}`}>
                  {availableAndroidArtifactTypes.map((artifactType) => (
                    <button aria-pressed={androidArtifactType === artifactType} className={androidArtifactType === artifactType ? styles.choiceSelected : styles.choice} key={artifactType} onClick={() => setAndroidArtifactType(artifactType)} type="button"><span aria-hidden="true" className={styles.radio}>{androidArtifactType === artifactType ? '✓' : ''}</span><strong>{artifactType.toUpperCase()}</strong><small>{artifactType === 'apk' ? 'Installable Android package' : 'Android App Bundle'}</small></button>
                  ))}
                </div>
              </div>
            )}
            <footer><Button disabled={platforms.length === 0 || destinations.length === 0} onClick={() => setStep(2)}>Continue to release details</Button></footer>
          </div>
        )}

        {step === 2 && (
          <div className={styles.stepContent}>
            <header><span>Step 2</span><h2>{destinations.some((destination) => destination !== 'artifact') ? 'Add release details' : 'Choose the local output'}</h2><p>These values are validated before any build or upload begins.</p></header>
            <div className={`${styles.selectionSummary} ${styles.detailSummary}`}>
              <div><span>Source</span><strong>{source === 'build' ? 'New build' : 'Existing artifact'}</strong></div>
              <div><span>Destinations</span><strong>{destinations.map((destination) => destination === 'artifact' ? 'Artifact' : destination === 'firebase' ? 'Firebase' : 'Store').join(' + ')}</strong></div>
              <div><span>Platforms</span><strong>{platforms.map(formatPlatform).join(' + ')}</strong></div>
            </div>
            <div className={styles.formGrid}>
              {source === 'build' && (
                <VersionConfiguration
                  form={versionForm}
                  onChange={handleVersionChange}
                  platforms={platforms}
                />
              )}
              {destinations.some((destination) => destination !== 'artifact') && <Form.Group><Form.Label>Release notes</Form.Label><Form.Control as="textarea" onChange={(event) => setReleaseNotes(event.target.value)} required rows={4} value={releaseNotes} /></Form.Group>}
              {isFirebaseTarget && <Form.Group><Form.Label>Tester group aliases</Form.Label><Form.Control onChange={(event) => setGroupsText(event.target.value)} required value={groupsText} /><Form.Text>Separate aliases with commas.</Form.Text></Form.Group>}
              {source === 'existing' && platforms.includes('android') && <PathField label="Android APK or AAB" onBrowse={() => void chooseArtifact('android')} required value={androidArtifactPath} />}
              {source === 'existing' && platforms.includes('ios') && <PathField label="iOS IPA" onBrowse={() => void chooseArtifact('ios')} required value={iosArtifactPath} />}
              {isArtifactTarget && <PathField buttonLabel={isSavingOutputDirectory ? 'Saving…' : artifactOutputDirectoryPath === '' ? 'Select' : 'Change'} disabled={isSavingOutputDirectory} helpText="The selected folder is saved to this application configuration automatically." label="Artifact output directory" onBrowse={() => void chooseOutputDirectory()} required value={artifactOutputDirectoryPath} />}
            </div>
            {errorMessage !== null && <Alert variant="danger">{errorMessage}</Alert>}
            <footer><Button onClick={() => setStep(1)} variant="outline-secondary">Back</Button><Button disabled={isDetailsIncomplete} onClick={() => void handlePreflight()}>{isValidating && <Spinner animation="border" size="sm" />} {isValidating ? 'Validating…' : 'Review pipeline'}</Button></footer>
          </div>
        )}

        {step === 3 && (
          <div className={styles.stepContent}>
            {!isRunStarted && preflight?.isValid === false && <><header><span>Step 3</span><h2>Preflight could not be completed</h2><p>Fix the blocking issues and try again.</p></header><div className={styles.issueList}>{preflight.issues.map((issue) => <Alert key={`${issue.code}-${issue.field ?? ''}`} variant="danger">{issue.message}</Alert>)}</div><footer><Button onClick={() => setStep(2)} variant="outline-secondary">Edit details</Button><Button onClick={() => void handlePreflight()}>Validate again</Button></footer></>}
            {!isRunStarted && preflight?.isValid === true && <><header><span>Step 3</span><h2>Ready to start</h2><p>Review the execution summary. The plan remains valid for 10 minutes.</p></header><div className={styles.launchSummary}><div className={styles.launchPrimary}><span>{preflight.plan.mode === 'buildOnly' ? 'Local artifact' : 'Firebase distribution'}</span><strong>{formatArtifactSummary(preflight.plan)} · {preflight.plan.platforms.map(formatPlatform).join(' + ')}</strong><small>{preflight.plan.version === undefined ? '' : `${formatResolvedVersion(preflight.plan.version)} · `}{preflight.plan.phaseCount} verified steps will run.</small></div><div className={styles.planSummary}><div><span>Operation</span><strong>{formatMode(preflight.plan.mode)}</strong></div><div><span>Destination</span><strong>{preflight.plan.mode === 'buildOnly' ? 'Local folder' : 'Firebase App Distribution'}</strong></div><div><span>{preflight.plan.mode === 'buildOnly' ? 'Output' : 'Tester groups'}</span><strong>{preflight.plan.mode === 'buildOnly' ? preflight.plan.artifactOutputDirectoryPath : `${preflight.plan.distributionGroups.length} groups`}</strong></div></div></div>{preflight.warnings.map((warning) => <Alert key={warning.message} variant="warning">{warning.message}</Alert>)}{releaseRun.errorMessage !== null && <Alert variant="danger">{releaseRun.errorMessage}</Alert>}<footer><Button onClick={() => setStep(2)} variant="outline-secondary">Back</Button><Button disabled={releaseRun.status === 'starting'} onClick={() => void releaseRun.start(preflight.plan.planId)}>{releaseRun.status === 'starting' ? 'Starting…' : 'Start pipeline'}</Button></footer></>}
            {isRunStarted && <><PipelineProgress activePhase={releaseRun.activePhase} completedPhases={releaseRun.completedPhases} isCancelling={releaseRun.status === 'cancelling'} logs={releaseRun.logs} mode={preflight?.isValid === true ? preflight.plan.mode : mode} onCancel={() => void releaseRun.cancel()} percent={releaseRun.percent} platform={releaseRun.platform} platforms={preflight?.isValid === true ? preflight.plan.platforms : platforms} progressKind={releaseRun.progressKind} result={releaseRun.result} totalPhases={releaseRun.totalPhases} />{releaseRun.result !== null && <footer><Button onClick={onFinished}>Return to application details</Button></footer>}</>}
          </div>
        )}
      </section>
    </div>
  );
};
