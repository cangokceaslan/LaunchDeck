import { useLayoutEffect, useRef } from 'react';
import { Button, ProgressBar } from 'react-bootstrap';
import { StatusPill } from '@components/StatusPill';
import { formatOutcome, formatPlatform } from '@renderer/utils/formatting';
import type { PipelineProgressProps } from '@components/PipelineProgress/index.types';
import styles from '@components/PipelineProgress/index.module.scss';

const phaseLabels: Record<string, string> = {
  build: 'Build',
  postBuild: 'After build',
  postUpload: 'After upload',
  preBuild: 'Before build',
  preUpload: 'Before upload',
  upload: 'Firebase upload',
  validating: 'Validation',
  verifying: 'Artifact verification',
};

export const PipelineProgress = ({
  activePhase,
  completedPhases,
  isCancelling,
  logs,
  onCancel,
  percent,
  platform,
  result,
  totalPhases,
}: PipelineProgressProps): React.JSX.Element => {
  const logViewerRef = useRef<HTMLDivElement>(null);
  const shouldFollowLogs = useRef(true);
  const isFinished = result !== null;
  const outcomeTone =
    result?.outcome === 'succeeded'
      ? 'success'
      : result?.outcome === 'partiallySucceeded'
        ? 'warning'
        : result?.outcome === 'cancelled'
          ? 'neutral'
          : 'danger';

  useLayoutEffect(() => {
    const logViewer = logViewerRef.current;
    if (logViewer !== null && shouldFollowLogs.current) {
      logViewer.scrollTop = logViewer.scrollHeight;
    }
  }, [logs]);

  const handleLogScroll = (): void => {
    const logViewer = logViewerRef.current;
    if (logViewer === null) return;
    const distanceFromBottom = logViewer.scrollHeight - logViewer.scrollTop - logViewer.clientHeight;
    shouldFollowLogs.current = distanceFromBottom <= 24;
  };

  return (
    <div className={styles.progressPanel} aria-live="polite">
      <div className={styles.progressHeader}>
        <div>
          <span className={styles.eyebrow}>{isFinished ? 'Pipeline completed' : 'Pipeline running'}</span>
          <h2>
            {isFinished
              ? result.platforms.map(({ platform: resultPlatform }) => formatPlatform(resultPlatform)).join(' + ')
              : `${platform === null ? '' : `${formatPlatform(platform)} · `}${activePhase === null ? 'Starting' : phaseLabels[activePhase]}`}
          </h2>
        </div>
        {result === null ? (
          <StatusPill label={isCancelling ? 'Cancelling' : 'Running'} tone={isCancelling ? 'warning' : 'running'} />
        ) : (
          <StatusPill label={formatOutcome(result.outcome)} tone={outcomeTone} />
        )}
      </div>

      <div className={styles.progressSummary}>
        <ProgressBar aria-label="Pipeline progress" now={percent} />
        <div><strong>{percent}%</strong><span>{completedPhases} / {totalPhases} verified steps</span></div>
      </div>

      <div className={styles.phaseTrack}>
        {['Before build', 'Build', 'Artifact', 'Before upload', 'Upload', 'Completed'].map((label, index) => (
          <div className={index <= Math.floor(percent / 20) ? styles.phaseComplete : styles.phasePending} key={label}>
            <span>{index + 1}</span><small>{label}</small>
          </div>
        ))}
      </div>

      <section className={styles.logSection}>
        <header><h3>Recent logs</h3><span>Up to 500 lines · sensitive values masked</span></header>
        <div className={styles.logViewer} onScroll={handleLogScroll} ref={logViewerRef} role="log">
          {logs.length === 0 ? <p>Waiting for command output…</p> : logs.map((entry) => (
            <div className={styles[entry.level]} key={entry.sequence}>
              <time>{new Date(entry.timestamp).toLocaleTimeString('en-US')}</time>
              <span>{entry.platform === undefined ? 'System' : formatPlatform(entry.platform)}</span>
              <code>{entry.message}</code>
            </div>
          ))}
        </div>
      </section>

      {!isFinished && (
        <footer><Button disabled={isCancelling} onClick={onCancel} variant="outline-danger">{isCancelling ? 'Cancelling…' : 'Cancel pipeline'}</Button></footer>
      )}
    </div>
  );
};
