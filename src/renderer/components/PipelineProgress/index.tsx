import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
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

const toStageKey = (phase: string | null | undefined): string | null =>
  phase === 'preBuild' || phase === 'postBuild'
    ? 'build'
    : phase === 'preUpload' || phase === 'postUpload'
      ? 'upload'
      : phase ?? null;

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
  const isAutoScrolling = useRef(false);
  const lastScrollHeight = useRef(0);
  const logContentRef = useRef<HTMLDivElement>(null);
  const logViewerRef = useRef<HTMLDivElement>(null);
  const scrollAnimationFrame = useRef<number | null>(null);
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
  const activeStage = toStageKey(activePhase);
  const activeStageIndex = phaseSequence.findIndex(({ key }) => key === activeStage);
  const failedStage = result?.platforms.reduce<string | null>(
    (currentStage, platformResult) =>
      platformResult.failedPhase === undefined
        ? currentStage
        : toStageKey(platformResult.failedPhase),
    null,
  );
  const failedStageIndex = phaseSequence.findIndex(({ key }) => key === failedStage);
  const outcomeTone =
    result?.outcome === 'succeeded'
      ? 'success'
      : result?.outcome === 'partiallySucceeded'
        ? 'warning'
        : result?.outcome === 'cancelled'
          ? 'neutral'
          : 'danger';

  const scrollToBottom = (): void => {
    const logViewer = logViewerRef.current;
    if (logViewer === null || !shouldFollowLogs.current) return;
    if (scrollAnimationFrame.current !== null) {
      cancelAnimationFrame(scrollAnimationFrame.current);
    }
    isAutoScrolling.current = true;
    logViewer.scrollTop = logViewer.scrollHeight;
    lastScrollHeight.current = logViewer.scrollHeight;
    scrollAnimationFrame.current = requestAnimationFrame(() => {
      logViewer.scrollTop = logViewer.scrollHeight;
      lastScrollHeight.current = logViewer.scrollHeight;
      scrollAnimationFrame.current = requestAnimationFrame(() => {
        logViewer.scrollTop = logViewer.scrollHeight;
        lastScrollHeight.current = logViewer.scrollHeight;
        isAutoScrolling.current = false;
        scrollAnimationFrame.current = null;
      });
    });
  };

  useLayoutEffect(() => {
    scrollToBottom();
  }, [logs]);

  useEffect(() => {
    const logContent = logContentRef.current;
    if (logContent === null) return undefined;
    const resizeObserver = new ResizeObserver(() => scrollToBottom());
    resizeObserver.observe(logContent);
    return () => {
      resizeObserver.disconnect();
      if (scrollAnimationFrame.current !== null) {
        cancelAnimationFrame(scrollAnimationFrame.current);
      }
    };
  }, []);

  const handleLogScroll = (): void => {
    const logViewer = logViewerRef.current;
    if (logViewer === null) return;
    const hasContentGrown = logViewer.scrollHeight > lastScrollHeight.current;
    lastScrollHeight.current = logViewer.scrollHeight;
    if (isAutoScrolling.current) return;
    if (hasContentGrown && shouldFollowLogs.current) {
      scrollToBottom();
      return;
    }
    const distanceFromBottom = logViewer.scrollHeight - logViewer.scrollTop - logViewer.clientHeight;
    shouldFollowLogs.current = distanceFromBottom <= 64;
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
          <div className={styles.percentValue}>
            <span
              aria-hidden="true"
              className={
                result === null
                  ? styles.signalRunning
                  : result.outcome === 'succeeded'
                    ? styles.signalSuccess
                    : result.outcome === 'cancelled'
                      ? styles.signalCancelled
                      : styles.signalFailed
              }
            >
              {result === null ? <i /> : result.outcome === 'succeeded' ? '✓' : result.outcome === 'cancelled' ? '–' : '×'}
            </span>
            <strong>{percent}%</strong>
          </div>
          <small>
            {progressKind === 'verified'
              ? 'Verified progress'
              : progressKind === 'reported'
                ? 'Tool-reported progress'
                : 'Estimated live progress'}
          </small>
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
          const terminalStageIndex = failedStageIndex >= 0 ? failedStageIndex : activeStageIndex;
          const isSuccessfulResult = result?.outcome === 'succeeded';
          const isComplete = isSuccessfulResult || index < terminalStageIndex;
          const isActive = !isFinished && index === activeStageIndex;
          const isFailed =
            isFinished &&
            result.outcome !== 'succeeded' &&
            result.outcome !== 'cancelled' &&
            index === terminalStageIndex;
          const isCancelled =
            isFinished && result.outcome === 'cancelled' && index === terminalStageIndex;
          return (
            <div
              className={
                isComplete
                  ? styles.phaseComplete
                  : isActive
                    ? styles.phaseActive
                    : isFailed
                      ? styles.phaseFailed
                      : isCancelled
                        ? styles.phaseCancelled
                        : styles.phasePending
              }
              key={key}
            >
              <span>
                {isComplete
                  ? '✓'
                  : isActive
                    ? <i aria-hidden="true" className={styles.phaseLoader} />
                    : isFailed
                      ? '×'
                      : isCancelled
                        ? '–'
                        : index + 1}
              </span>
              <small>{label}</small>
            </div>
          );
        })}
      </div>

      <section className={styles.logSection}>
        <header><h3>Recent logs</h3><span>Up to 500 lines · sensitive values masked</span></header>
        <div className={styles.logViewer} onScroll={handleLogScroll} ref={logViewerRef} role="log">
          <div className={styles.logContent} ref={logContentRef}>
            {logs.length === 0 ? <p>Waiting for command output…</p> : logs.map((entry) => (
              <div className={styles[entry.level]} key={entry.sequence}>
                <time>{new Date(entry.timestamp).toLocaleTimeString('en-US')}</time>
                <span>{entry.platform === undefined ? 'System' : formatPlatform(entry.platform)}</span>
                <code>{entry.message}</code>
              </div>
            ))}
          </div>
        </div>
      </section>

      {!isFinished && (
        <footer><Button disabled={isCancelling} onClick={onCancel} variant="outline-danger">{isCancelling ? 'Cancelling…' : 'Cancel pipeline'}</Button></footer>
      )}
    </div>
  );
};
