import { Button } from 'react-bootstrap';
import { StatusPill } from '@components/StatusPill';
import {
  formatDateTime,
  formatMode,
  formatOutcome,
  formatPlatform,
} from '@renderer/utils/formatting';
import {
  formatHistoryDestination,
  formatRunDuration,
  getHistoryActionLabel,
  getHistoryOutcomeTone,
} from '@renderer/utils/releaseHistory';
import { resolveFastActionVersionSummaries } from '@renderer/utils/releaseConfiguration';
import type { ReleaseHistoryDetailProps } from '@screens/ReleaseHistoryDetail/index.types';
import styles from '@screens/ReleaseHistoryDetail/index.module.scss';

const formatOperationStatus = (status: 'notRequested' | 'succeeded' | 'failed'): string => {
  if (status === 'notRequested') return 'Not requested';
  return status === 'succeeded' ? 'Succeeded' : 'Failed';
};

const formatPhase = (phase: string): string =>
  phase.replace(/([a-z])([A-Z])/gu, '$1 $2').replace(/^./u, (character) => character.toUpperCase());

export const ReleaseHistoryDetail = ({
  applicationName,
  onBack,
  onRepeat,
  run,
}: ReleaseHistoryDetailProps): React.JSX.Element => {
  const configuration = run.configuration;
  const versionSummaries = configuration === null
    ? []
    : resolveFastActionVersionSummaries(configuration);
  const actionLabel = getHistoryActionLabel(run.outcome);

  return (
    <div className={styles.page}>
      <button className={styles.backButton} onClick={onBack} type="button">
        <svg aria-hidden="true" viewBox="0 0 16 16">
          <path d="M10 3.75 5.75 8 10 12.25" />
        </svg>
        Back to {applicationName}
      </button>

      <header className={styles.pageHeader}>
        <div>
          <span className={styles.eyebrow}>Release history detail</span>
          <h1>{formatMode(run.mode)}</h1>
          <p>Completed {formatDateTime(run.finishedAt)} · {formatRunDuration(run.startedAt, run.finishedAt)}</p>
        </div>
        <Button
          disabled={configuration === null}
          onClick={() => onRepeat(run)}
          title={configuration === null ? 'This legacy run has no repeatable configuration snapshot.' : undefined}
        >
          {actionLabel} this release
        </Button>
      </header>

      <section className={styles.resultSummary} data-outcome={run.outcome}>
        <div className={styles.resultIdentity}>
          <StatusPill label={formatOutcome(run.outcome)} tone={getHistoryOutcomeTone(run.outcome)} />
          <div>
            <span>Run reference</span>
            <code>{run.id}</code>
          </div>
        </div>
        <dl>
          <div><dt>Started</dt><dd>{formatDateTime(run.startedAt)}</dd></div>
          <div><dt>Finished</dt><dd>{formatDateTime(run.finishedAt)}</dd></div>
          <div><dt>Duration</dt><dd>{formatRunDuration(run.startedAt, run.finishedAt)}</dd></div>
          <div><dt>Platforms</dt><dd>{run.platforms.map(formatPlatform).join(' + ')}</dd></div>
        </dl>
      </section>

      <section className={styles.detailSection}>
        <div className={styles.sectionHeading}>
          <span className={styles.eyebrow}>Execution result</span>
          <h2>Platform outcomes</h2>
        </div>
        <div className={styles.platformGrid}>
          {run.result.platforms.length === 0 && (
            <div className={styles.platformEmpty}>The run was cancelled before a platform started.</div>
          )}
          {run.result.platforms.map((platformResult) => (
            <article key={platformResult.platform}>
              <header>
                <span>{formatPlatform(platformResult.platform)}</span>
                {platformResult.failedPhase !== undefined && (
                  <small>Stopped during {formatPhase(platformResult.failedPhase)}</small>
                )}
              </header>
              <dl className={styles.operationList}>
                <div data-status={platformResult.buildStatus}>
                  <dt>Build</dt><dd>{formatOperationStatus(platformResult.buildStatus)}</dd>
                </div>
                <div data-status={platformResult.firebaseStatus}>
                  <dt>Firebase</dt><dd>{formatOperationStatus(platformResult.firebaseStatus)}</dd>
                </div>
                <div data-status={platformResult.storeStatus}>
                  <dt>Store</dt><dd>{formatOperationStatus(platformResult.storeStatus)}</dd>
                </div>
              </dl>
              {platformResult.artifactPath !== undefined && (
                <div className={styles.platformDetail}>
                  <span>Artifact</span><code>{platformResult.artifactPath}</code>
                </div>
              )}
              {platformResult.errorMessage !== undefined && (
                <div className={styles.errorDetail}>
                  <span>Failure detail</span><p>{platformResult.errorMessage}</p>
                </div>
              )}
            </article>
          ))}
        </div>
      </section>

      <section className={styles.detailSection}>
        <div className={styles.sectionHeading}>
          <span className={styles.eyebrow}>Immutable snapshot</span>
          <h2>Release configuration</h2>
        </div>
        {configuration === null ? (
          <div className={styles.legacyNotice}>
            This run predates configuration snapshots. Its outcome remains available, but it cannot be repeated safely.
          </div>
        ) : (
          <>
            <dl className={styles.configurationGrid}>
              <div><dt>Workflow</dt><dd>{formatMode(configuration.mode)}</dd></div>
              <div><dt>Source</dt><dd>{configuration.mode === 'uploadOnly' ? 'Existing artifact' : 'New build'}</dd></div>
              <div><dt>Destinations</dt><dd>{configuration.destinations.map(formatHistoryDestination).join(' + ')}</dd></div>
              <div><dt>Platforms</dt><dd>{configuration.platforms.map(formatPlatform).join(' + ')}</dd></div>
              <div><dt>Artifact signing</dt><dd>{configuration.artifactSigningPlatforms.length === 0 ? 'Not requested' : configuration.artifactSigningPlatforms.map(formatPlatform).join(' + ')}</dd></div>
              {configuration.androidArtifactType !== undefined && <div><dt>Android artifact</dt><dd>{configuration.androidArtifactType.toUpperCase()}</dd></div>}
              {configuration.destinations.includes('firebase') && <div><dt>Tester groups</dt><dd>{configuration.distributionGroups.join(', ') || 'None'}</dd></div>}
            </dl>

            {versionSummaries.length > 0 && (
              <div className={styles.versionGrid}>
                {versionSummaries.map((version) => (
                  <article key={version.platform}>
                    <span>{version.platform} version</span>
                    <strong>{version.versionName}</strong>
                    <small>{version.counterLabel} {version.counterValue}</small>
                  </article>
                ))}
              </div>
            )}

            <div className={styles.snapshotDetails}>
              {configuration.artifactOutputDirectoryPath !== undefined && <div><span>Output directory</span><code>{configuration.artifactOutputDirectoryPath}</code></div>}
              {configuration.androidArtifactPath !== undefined && <div><span>Android source</span><code>{configuration.androidArtifactPath}</code></div>}
              {configuration.iosArtifactPath !== undefined && <div><span>iOS source</span><code>{configuration.iosArtifactPath}</code></div>}
              <div><span>Release notes</span><p>{configuration.releaseNotes || 'No release notes were provided.'}</p></div>
            </div>
          </>
        )}
      </section>
    </div>
  );
};
