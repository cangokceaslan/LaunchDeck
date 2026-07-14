import { useState } from 'react';
import { Button, Modal, Spinner } from 'react-bootstrap';
import { StatusPill } from '@components/StatusPill';
import {
  formatDateTime,
  formatMode,
  formatOutcome,
  formatPlatform,
} from '@renderer/utils/formatting';
import type { ApplicationDetailProps } from '@screens/ApplicationDetail/index.types';
import styles from '@screens/ApplicationDetail/index.module.scss';

const outcomeTone = (outcome: ApplicationDetailProps['history'][number]['outcome']) => {
  if (outcome === 'succeeded') return 'success' as const;
  if (outcome === 'partiallySucceeded') return 'warning' as const;
  if (outcome === 'cancelled') return 'neutral' as const;
  return 'danger' as const;
};

export const ApplicationDetail = ({
  application,
  history,
  isHistoryLoading,
  onClearHistory,
  onDelete,
  onEdit,
  onStartRelease,
}: ApplicationDetailProps): React.JSX.Element => {
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div className={styles.titleGroup}>
          <span className={styles.initial}>{application.name.slice(0, 1).toLocaleUpperCase('tr')}</span>
          <div>
            <span className={styles.eyebrow}>{application.firebaseProjectId}</span>
            <h1>{application.name}</h1>
            <div className={styles.platforms}>
              {application.platforms.map((platform) => (
                <StatusPill key={platform} label={formatPlatform(platform)} tone="neutral" />
              ))}
            </div>
          </div>
        </div>
        <div className={styles.actions}>
          <Button onClick={onEdit} variant="outline-secondary">Kurulumu düzenle</Button>
          <Button onClick={onStartRelease}>Yeni release</Button>
        </div>
      </header>

      <div className={styles.summaryGrid}>
        <section className={styles.summaryCard}>
          <span>Service Account</span>
          <strong>{application.serviceAccountFileName}</strong>
          <small>Güvenli depolamada şifreli yol</small>
        </section>
        <section className={styles.summaryCard}>
          <span>Tester grupları</span>
          <strong>{application.distributionGroups.length}</strong>
          <small>{application.distributionGroups.join(', ')}</small>
        </section>
        <section className={styles.summaryCard}>
          <span>Özel pipeline adımı</span>
          <strong>{application.hooks.filter((hook) => hook.isEnabled).length}</strong>
          <small>Etkin komut</small>
        </section>
      </div>

      <section className={styles.configuration}>
        <div className={styles.sectionHeader}>
          <div><span className={styles.eyebrow}>Kalıcı kurulum</span><h2>Platform yapılandırması</h2></div>
        </div>
        <div className={styles.configurationGrid}>
          {application.android !== null && (
            <article>
              <h3>Android</h3>
              <dl>
                <div><dt>Proje</dt><dd>{application.android.projectPath}</dd></div>
                <div><dt>Google Services</dt><dd>{application.android.googleServicesJsonPath}</dd></div>
                <div><dt>Gradle görevi</dt><dd>{application.android.gradleTask}</dd></div>
                <div><dt>Artifact</dt><dd>{application.android.artifactPath}</dd></div>
              </dl>
            </article>
          )}
          {application.ios !== null && (
            <article>
              <h3>iOS</h3>
              <dl>
                <div><dt>Proje</dt><dd>{application.ios.projectPath}</dd></div>
                <div><dt>Workspace / Project</dt><dd>{application.ios.workspaceOrProjectPath}</dd></div>
                <div><dt>Scheme</dt><dd>{application.ios.scheme}</dd></div>
                <div><dt>Artifact</dt><dd>{application.ios.artifactPath}</dd></div>
              </dl>
            </article>
          )}
        </div>
      </section>

      <section className={styles.history}>
        <div className={styles.sectionHeader}>
          <div><span className={styles.eyebrow}>En fazla 10 kayıt</span><h2>Release geçmişi</h2></div>
          {history.length > 0 && <Button onClick={onClearHistory} size="sm" variant="link">Geçmişi temizle</Button>}
        </div>
        {isHistoryLoading ? (
          <div className={styles.historyEmpty}><Spinner animation="border" size="sm" /> Geçmiş yükleniyor…</div>
        ) : history.length === 0 ? (
          <div className={styles.historyEmpty}>Bu uygulama için henüz release çalıştırılmadı.</div>
        ) : (
          <div className={styles.historyList}>
            {history.map((run) => (
              <article key={run.id}>
                <StatusPill label={formatOutcome(run.outcome)} tone={outcomeTone(run.outcome)} />
                <div><strong>{formatMode(run.mode)}</strong><small>{run.platforms.map(formatPlatform).join(' + ')}</small></div>
                <time>{formatDateTime(run.finishedAt)}</time>
              </article>
            ))}
          </div>
        )}
      </section>

      <footer className={styles.dangerZone}>
        <div><strong>Uygulamayı kaldır</strong><span>Kurulum ve release geçmişi kalıcı olarak silinir.</span></div>
        <Button onClick={() => setIsDeleteOpen(true)} variant="outline-danger">Uygulamayı sil</Button>
      </footer>

      <Modal centered onHide={() => setIsDeleteOpen(false)} show={isDeleteOpen}>
        <Modal.Header closeButton><Modal.Title>Uygulamayı sil</Modal.Title></Modal.Header>
        <Modal.Body>{application.name} ve ilişkili release geçmişi silinecek. Bu işlem geri alınamaz.</Modal.Body>
        <Modal.Footer>
          <Button onClick={() => setIsDeleteOpen(false)} variant="outline-secondary">Vazgeç</Button>
          <Button onClick={onDelete} variant="danger">Kalıcı olarak sil</Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};
