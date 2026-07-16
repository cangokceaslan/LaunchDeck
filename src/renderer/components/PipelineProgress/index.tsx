import { useLayoutEffect, useMemo, useRef } from 'react';
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
  mode,
  onCancel,
  percent,
  platform,
  platforms,
  progressKind,
  result,
  totalPhases,
}: PipelineProgressProps): React.JSX.Element => {
  const logViewerRef = useRef<HTMLDivElement>(null);
  const shouldFollowLogs = useRef(true);
  const isFinished = result !== null;
  const phaseSequence = useMemo(
    () => [
      ...(mode === 'buildOnly' || mode === 'buildAndUpload'
        ? [{ key: 'build', label: 'Build' }]
        : []),
      { key: 'verifying', label: 'Verify artifact' },
      ...(mode === 'uploadOnly' || mode === 'buildAndUpload'
        ? [{ key: 'upload', label: 'Distribute' }]
        : []),
    ],
    [mode],
  );
  const activeStage =
    activePhase === 'preBuild' || activePhase === 'postBuild'
      ? 'build'
      : activePhase === 'preUpload' || activePhase === 'postUpload'
        ? 'upload'
        : activePhase;
  const activeStageIndex = phaseSequence.findIndex(({ key }) => key === activeStage);
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
      const animationFrame = requestAnimationFrame(() => {
        logViewer.scrollTop = logViewer.scrollHeight;
      });
      return () => cancelAnimationFrame(animationFrame);
    }
    return undefined;
  }, [logs]);

  const handleLogScroll = (): void => {
    const logViewer = logViewerRef.current;
    if (logViewer === null) return;
    const distanceFromBottom = logViewer.scrollHeight - logViewer.scrollTop - logViewer.clientHeight;
    shouldFollowLogs.current = distanceFromBottom <= 48;
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

      <div className={styles.progressOverview}>
        <div className={styles.percentBlock}>
          <strong>{percent}%</strong>
          <span>
            {progressKind === 'verified'
              ? 'Verified progress'
              : progressKind === 'reported'
                ? 'Tool-reported progress'
                : 'Estimated live progress'}
          </span>
        </div>
        <div className={styles.progressSummary}>
          <ProgressBar aria-label="Pipeline progress" now={percent} />
          <div>
            <span>{completedPhases} of {totalPhases} steps verified</span>
            <span>{platforms.map(formatPlatform).join(' + ')}</span>
          </div>
        </div>
      </div>

      <div className={styles.phaseTrack}>
        {phaseSequence.map(({ key, label }, index) => {
          const isComplete = isFinished || (activeStageIndex >= 0 && index < activeStageIndex);
          const isActive = !isFinished && index === activeStageIndex;
          return (
            <div
              className={isComplete ? styles.phaseComplete : isActive ? styles.phaseActive : styles.phasePending}
              key={key}
            >
              <span>{isComplete ? '✓' : index + 1}</span>
              <small>{label}</small>
            </div>
          );
        })}
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
