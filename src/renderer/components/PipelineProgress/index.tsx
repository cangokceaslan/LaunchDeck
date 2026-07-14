import { Button, ProgressBar } from 'react-bootstrap';
import { StatusPill } from '@components/StatusPill';
import { formatOutcome, formatPlatform } from '@renderer/utils/formatting';
import type { PipelineProgressProps } from '@components/PipelineProgress/index.types';
import styles from '@components/PipelineProgress/index.module.scss';

const phaseLabels: Record<string, string> = {
  build: 'Build',
  postBuild: 'Build sonrası',
  postUpload: 'Upload sonrası',
  preBuild: 'Build öncesi',
  preUpload: 'Upload öncesi',
  upload: 'Firebase upload',
  validating: 'Doğrulama',
  verifying: 'Artifact doğrulama',
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
  const isFinished = result !== null;
  const outcomeTone =
    result?.outcome === 'succeeded'
      ? 'success'
      : result?.outcome === 'partiallySucceeded'
        ? 'warning'
        : result?.outcome === 'cancelled'
          ? 'neutral'
          : 'danger';

  return (
    <div className={styles.progressPanel} aria-live="polite">
      <div className={styles.progressHeader}>
        <div>
          <span className={styles.eyebrow}>{isFinished ? 'Pipeline tamamlandı' : 'Pipeline çalışıyor'}</span>
          <h2>
            {isFinished
              ? result.platforms.map(({ platform: resultPlatform }) => formatPlatform(resultPlatform)).join(' + ')
              : `${platform === null ? '' : `${formatPlatform(platform)} · `}${activePhase === null ? 'Başlatılıyor' : phaseLabels[activePhase]}`}
          </h2>
        </div>
        {result === null ? (
          <StatusPill label={isCancelling ? 'İptal ediliyor' : 'Çalışıyor'} tone={isCancelling ? 'warning' : 'running'} />
        ) : (
          <StatusPill label={formatOutcome(result.outcome)} tone={outcomeTone} />
        )}
      </div>

      <div className={styles.progressSummary}>
        <ProgressBar aria-label="Pipeline ilerlemesi" now={percent} />
        <div><strong>%{percent}</strong><span>{completedPhases} / {totalPhases} doğrulanmış adım</span></div>
      </div>

      <div className={styles.phaseTrack}>
        {['Build öncesi', 'Build', 'Artifact', 'Upload öncesi', 'Upload', 'Tamamlandı'].map((label, index) => (
          <div className={index <= Math.floor(percent / 20) ? styles.phaseComplete : styles.phasePending} key={label}>
            <span>{index + 1}</span><small>{label}</small>
          </div>
        ))}
      </div>

      <section className={styles.logSection}>
        <header><h3>Son loglar</h3><span>En fazla 500 satır · hassas değerler maskeli</span></header>
        <div className={styles.logViewer} role="log">
          {logs.length === 0 ? <p>Komut çıktısı bekleniyor…</p> : logs.map((entry) => (
            <div className={styles[entry.level]} key={entry.sequence}>
              <time>{new Date(entry.timestamp).toLocaleTimeString('tr-TR')}</time>
              <span>{entry.platform === undefined ? 'Sistem' : formatPlatform(entry.platform)}</span>
              <code>{entry.message}</code>
            </div>
          ))}
        </div>
      </section>

      {!isFinished && (
        <footer><Button disabled={isCancelling} onClick={onCancel} variant="outline-danger">{isCancelling ? 'İptal ediliyor…' : 'Pipeline’ı iptal et'}</Button></footer>
      )}
    </div>
  );
};
