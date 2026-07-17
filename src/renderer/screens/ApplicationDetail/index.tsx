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
          <span className={styles.initial}>{application.name.slice(0, 1).toLocaleUpperCase('en-US')}</span>
          <div>
            <span className={styles.eyebrow}>{application.firebaseProjectId || 'Local and store release configuration'}</span>
            <h1>{application.name}</h1>
            <div className={styles.platforms}>
              {application.platforms.map((platform) => (
                <StatusPill key={platform} label={formatPlatform(platform)} tone="neutral" />
              ))}
            </div>
          </div>
        </div>
        <div className={styles.actions}>
          <Button onClick={onEdit} variant="outline-secondary">Edit setup</Button>
          <Button onClick={onStartRelease}>New release</Button>
        </div>
      </header>

      <div className={styles.summaryGrid}>
        <section className={styles.summaryCard}>
          <span>Release destinations</span>
          <strong>{[
            application.artifactGeneration.isEnabled ? 'Artifact' : null,
            application.firebaseDistribution.isEnabled ? 'Firebase' : null,
            application.googlePlay !== null || application.appStoreConnect !== null ? 'Store' : null,
          ].filter(Boolean).join(' + ')}</strong>
          <small>Only configured destinations appear in a pipeline</small>
        </section>
        <section className={styles.summaryCard}>
          <span>Signing</span>
          <strong>{application.androidSigning !== null || application.iosSigning.isEnabled ? 'Configured' : 'Not required'}</strong>
          <small>{application.androidSigning?.keystoreFileName ?? (application.iosSigning.isEnabled ? `Apple team ${application.iosSigning.developmentTeamId}` : 'No managed signing')}</small>
        </section>
        <section className={styles.summaryCard}>
          <span>Custom pipeline steps</span>
          <strong>{application.hooks.filter((hook) => hook.isEnabled).length}</strong>
          <small>Enabled commands</small>
        </section>
      </div>

      <section className={styles.configuration}>
        <div className={styles.sectionHeader}>
          <div><span className={styles.eyebrow}>Saved setup</span><h2>Platform configuration</h2></div>
        </div>
        <div className={styles.configurationGrid}>
          {application.android !== null && (
            <article>
              <h3>Android</h3>
              <dl>
                <div><dt>Project</dt><dd>{application.android.projectPath}</dd></div>
                <div><dt>Google Services</dt><dd>{application.android.googleServicesJsonPath ?? 'Not configured'}</dd></div>
                <div><dt>Default artifact</dt><dd>{application.android.defaultArtifactType.toUpperCase()}</dd></div>
                <div><dt>APK Gradle task</dt><dd>{application.android.gradleTask}</dd></div>
                <div><dt>APK source</dt><dd>{application.android.artifactPath}</dd></div>
                <div><dt>AAB Gradle task</dt><dd>{application.android.aabGradleTask}</dd></div>
                <div><dt>AAB source</dt><dd>{application.android.aabArtifactPath}</dd></div>
              </dl>
            </article>
          )}
          {application.ios !== null && (
            <article>
              <h3>iOS</h3>
              <dl>
                <div><dt>Project</dt><dd>{application.ios.projectPath}</dd></div>
                <div><dt>Workspace / Project</dt><dd>{application.ios.workspaceOrProjectPath}</dd></div>
                <div><dt>Scheme</dt><dd>{application.ios.scheme}</dd></div>
                <div><dt>Artifact</dt><dd>{application.ios.artifactPath}</dd></div>
                <div><dt>Google Services</dt><dd>{application.ios.googleServiceInfoPlistPath ?? 'Not configured'}</dd></div>
              </dl>
            </article>
          )}
          <article>
            <h3>Distribution</h3>
            <dl>
              <div><dt>Firebase</dt><dd>{application.firebaseDistribution.isEnabled ? `${application.serviceAccountFileName} · ${application.distributionGroups.join(', ')}` : 'Disabled'}</dd></div>
              <div><dt>Google Play</dt><dd>{application.googlePlay === null ? 'Disabled' : `${application.googlePlay.initialTrack} · ${application.googlePlay.artifactType.toUpperCase()}${application.googlePlay.promoteAfterUpload ? ` → ${application.googlePlay.promotionTrack}` : ''}`}</dd></div>
              <div><dt>App Store Connect</dt><dd>{application.appStoreConnect === null ? 'Disabled' : `${application.appStoreConnect.apiKeyFileName} · TestFlight upload`}</dd></div>
              <div>
                <dt>Artifact directory</dt>
                <dd>{application.artifactOutputDirectoryPath ?? 'Selected during the first local pipeline'}</dd>
              </div>
            </dl>
          </article>
        </div>
      </section>

      <section className={styles.history}>
        <div className={styles.sectionHeader}>
          <div><span className={styles.eyebrow}>Up to 10 records</span><h2>Release history</h2></div>
          {history.length > 0 && <Button onClick={onClearHistory} size="sm" variant="link">Clear history</Button>}
        </div>
        {isHistoryLoading ? (
          <div className={styles.historyEmpty}><Spinner animation="border" size="sm" /> Loading history…</div>
        ) : history.length === 0 ? (
          <div className={styles.historyEmpty}>No releases have been run for this application yet.</div>
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
        <div><strong>Remove application</strong><span>The setup and release history will be deleted permanently.</span></div>
        <Button onClick={() => setIsDeleteOpen(true)} variant="outline-danger">Delete application</Button>
      </footer>

      <Modal centered onHide={() => setIsDeleteOpen(false)} show={isDeleteOpen}>
        <Modal.Header closeButton><Modal.Title>Delete application</Modal.Title></Modal.Header>
        <Modal.Body>{application.name} and its release history will be deleted. This action cannot be undone.</Modal.Body>
        <Modal.Footer>
          <Button onClick={() => setIsDeleteOpen(false)} variant="outline-secondary">Cancel</Button>
          <Button onClick={onDelete} variant="danger">Delete permanently</Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};
