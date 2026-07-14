import { Alert, Button, Spinner } from 'react-bootstrap';
import launchIcon from '@renderer/assets/launch-icon.png';
import devIcon from '@renderer/assets/dev-icon.png';
import { StatusPill } from '@components/StatusPill';
import type { DoctorProps } from '@screens/Doctor/index.types';
import styles from '@screens/Doctor/index.module.scss';

const toneForStatus = (status: 'checking' | 'passed' | 'warning' | 'failed') => {
  if (status === 'passed') return 'success' as const;
  if (status === 'warning') return 'warning' as const;
  if (status === 'failed') return 'danger' as const;
  return 'running' as const;
};

const labelForStatus = (status: 'checking' | 'passed' | 'warning' | 'failed'): string => {
  if (status === 'passed') return 'Hazır';
  if (status === 'warning') return 'Sınırlı';
  if (status === 'failed') return 'Eksik';
  return 'Kontrol ediliyor';
};

export const Doctor = ({
  errorMessage,
  isChecking,
  onContinue,
  onRetry,
  report,
}: DoctorProps): React.JSX.Element => (
  <main className={styles.page}>
    <section className={styles.card} aria-busy={isChecking}>
      <header className={styles.header}>
        <img alt="" aria-hidden="true" src={import.meta.env.DEV ? devIcon : launchIcon} />
        <div>
          <span className={styles.eyebrow}>LaunchDeck Doctor</span>
          <h1>Release ortamını doğruluyoruz</h1>
          <p>Uygulamaya geçmeden önce gerekli araçları ve platform yeteneklerini kontrol ediyoruz.</p>
        </div>
      </header>

      {isChecking && report === null ? (
        <div className={styles.loading}>
          <Spinner animation="border" role="status" size="sm" />
          <span>Firebase CLI ve sistem araçları denetleniyor…</span>
        </div>
      ) : (
        <div className={styles.checks}>
          {report?.checks.map((check) => (
            <article className={styles.check} key={check.code}>
              <div>
                <h2>{check.label}</h2>
                <p>{check.detail}</p>
                {check.version !== undefined && <code>v{check.version}</code>}
              </div>
              <StatusPill label={labelForStatus(check.status)} tone={toneForStatus(check.status)} />
            </article>
          ))}
        </div>
      )}

      {errorMessage !== null && <Alert variant="danger">{errorMessage}</Alert>}
      {report !== null && !report.isReady && (
        <Alert variant="warning">
          Firebase CLI kurulmadan release alanına geçilemez. Kurulumu tamamladıktan sonra yeniden denetleyin.
        </Alert>
      )}
      <footer className={styles.footer}>
        <Button disabled={isChecking} onClick={onRetry} variant="outline-secondary">
          Yeniden denetle
        </Button>
        <Button disabled={isChecking || report?.isReady !== true} onClick={onContinue}>
          LaunchDeck’e geç
        </Button>
      </footer>
    </section>
  </main>
);
