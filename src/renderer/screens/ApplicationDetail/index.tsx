import { useState } from 'react';
import { Button, Modal, Spinner } from 'react-bootstrap';
import { ApplicationLogo } from '@components/ApplicationLogo';
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
  fastActions,
  history,
  isChangingIcon,
  isHistoryLoading,
  onClearHistory,
  onChangeIcon,
  onCreateFastAction,
  onDelete,
  onDeleteFastAction,
  onEdit,
  onEditFastAction,
  onRunFastAction,
  onStartRelease,
  startingFastActionId,
}: ApplicationDetailProps): React.JSX.Element => {
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [fastActionToDelete, setFastActionToDelete] = useState<ApplicationDetailProps['fastActions'][number] | null>(null);

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div className={styles.titleGroup}>
          <button
            aria-label="Change application icon"
            className={styles.logoButton}
            disabled={isChangingIcon}
            onClick={onChangeIcon}
            title={isChangingIcon ? 'Loading application icon' : 'Choose application icon'}
            type="button"
          >
            <ApplicationLogo
              className={styles.initial}
              iconDataUrl={application.iconDataUrl}
              name={application.name}
            />
          </button>
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
          <strong>{[
            application.android !== null && application.androidSigning !== null
              ? 'Android keystore'
              : null,
            application.ios !== null && application.iosSigning.isEnabled
              ? 'Xcode signing'
              : null,
          ].filter(Boolean).join(' + ') || 'Not configured'}</strong>
          <div className={styles.signingDetails}>
            {application.android !== null && (
              <small><b>Android</b><span>{application.androidSigning === null ? 'Not configured' : `Keystore · ${application.androidSigning.keystoreFileName}`}</span></small>
            )}
            {application.ios !== null && (
              <small><b>iOS</b><span>{application.iosSigning.isEnabled && application.iosSigning.developmentTeamId !== '' ? `Xcode automatic · Team ${application.iosSigning.developmentTeamId}` : 'Not configured'}</span></small>
            )}
          </div>
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

      <section className={styles.fastActions}>
        <div className={styles.sectionHeader}>
          <div><span className={styles.eyebrow}>Saved release pipelines</span><h2>Fast actions</h2></div>
          <Button onClick={onCreateFastAction} size="sm">New fast action</Button>
        </div>
        {fastActions.length === 0 ? (
          <div className={styles.fastActionsEmpty}>No fast actions yet. Save a reusable pipeline for one-click preflight and confirmation.</div>
        ) : (
          <div className={styles.fastActionList}>
            {fastActions.map((fastAction) => (
              <article key={fastAction.id}>
                <div className={styles.fastActionSummary}>
                  <strong>{fastAction.name}</strong>
                  <small>{formatMode(fastAction.configuration.mode)} · {fastAction.configuration.platforms.map(formatPlatform).join(' + ')}</small>
                  <span>{fastAction.configuration.destinations.map((destination) => destination === 'artifact' ? 'Artifact' : destination === 'firebase' ? 'Firebase' : 'Store').join(' + ')}</span>
                </div>
                <div className={styles.fastActionButtons}>
                  <Button disabled={startingFastActionId !== null} onClick={() => onRunFastAction(fastAction)} size="sm">{startingFastActionId === fastAction.id && <Spinner animation="border" size="sm" />} {startingFastActionId === fastAction.id ? 'Preparing…' : 'Start'}</Button>
                  <Button disabled={startingFastActionId !== null} onClick={() => onEditFastAction(fastAction)} size="sm" variant="outline-secondary">Edit</Button>
                  <Button disabled={startingFastActionId !== null} onClick={() => setFastActionToDelete(fastAction)} size="sm" variant="outline-danger">Delete</Button>
                </div>
              </article>
            ))}
          </div>
        )}
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

      <Modal centered onHide={() => setFastActionToDelete(null)} show={fastActionToDelete !== null}>
        <Modal.Header closeButton><Modal.Title>Delete fast action</Modal.Title></Modal.Header>
        <Modal.Body>{fastActionToDelete?.name} will be deleted. Existing release history is not affected.</Modal.Body>
        <Modal.Footer>
          <Button onClick={() => setFastActionToDelete(null)} variant="outline-secondary">Cancel</Button>
          <Button onClick={() => { if (fastActionToDelete !== null) onDeleteFastAction(fastActionToDelete.id); setFastActionToDelete(null); }} variant="danger">Delete fast action</Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};
