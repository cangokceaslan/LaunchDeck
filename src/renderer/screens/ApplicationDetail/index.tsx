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
import { resolveFastActionVersionSummaries } from '@screens/ApplicationDetail/index.utils';
import type { DistributionDestination } from '@shared/contracts/domain';
import styles from '@screens/ApplicationDetail/index.module.scss';

const outcomeTone = (outcome: ApplicationDetailProps['history'][number]['outcome']) => {
  if (outcome === 'succeeded') return 'success' as const;
  if (outcome === 'partiallySucceeded') return 'warning' as const;
  if (outcome === 'cancelled') return 'neutral' as const;
  return 'danger' as const;
};

const formatDestination = (destination: DistributionDestination): string =>
  destination === 'artifact'
    ? 'Artifact'
    : destination === 'firebase'
      ? 'Firebase'
      : 'Store';

export const ApplicationDetail = ({
  application,
  fastActions,
  history,
  isChangingIcon,
  isHistoryLoading,
  isSetupChecking,
  isSetupReady,
  onClearHistory,
  onChangeIcon,
  onCreateFastAction,
  onDelete,
  onDeleteFastAction,
  onEdit,
  onEditFastAction,
  onRemoveIcon,
  onRepeatHistory,
  onRunFastAction,
  onShowSetup,
  onStartRelease,
  startingFastActionId,
}: ApplicationDetailProps): React.JSX.Element => {
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [fastActionToDelete, setFastActionToDelete] = useState<ApplicationDetailProps['fastActions'][number] | null>(null);

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div className={styles.titleGroup}>
          <div className={styles.logoControl}>
            <button
              aria-label={
                application.iconDataUrl === null
                  ? 'Choose application icon'
                  : 'Change application icon'
              }
              className={styles.logoButton}
              disabled={isChangingIcon}
              onClick={onChangeIcon}
              title={
                isChangingIcon
                  ? 'Updating application icon'
                  : application.iconDataUrl === null
                    ? 'Choose application icon'
                    : 'Change application icon'
              }
              type="button"
            >
              <ApplicationLogo
                className={styles.initial}
                iconDataUrl={application.iconDataUrl}
              />
            </button>
            {application.iconDataUrl !== null && (
              <button
                aria-label="Remove application icon"
                className={styles.removeLogoButton}
                disabled={isChangingIcon}
                onClick={onRemoveIcon}
                title="Remove application icon"
                type="button"
              >
                <svg aria-hidden="true" viewBox="0 0 16 16">
                  <path d="M4 4l8 8M12 4l-8 8" />
                </svg>
              </button>
            )}
          </div>
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
          <button
            aria-haspopup="dialog"
            className={`${styles.setupButton} ${
              isSetupChecking
                ? styles.setupChecking
                : isSetupReady
                  ? styles.setupReady
                  : styles.setupNeeded
            }`}
            onClick={onShowSetup}
            title="View application setup requirements"
            type="button"
          >
            <span aria-hidden="true" />
            Setup
          </button>
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
            {fastActions.map((fastAction) => {
              const versionSummaries = resolveFastActionVersionSummaries(
                fastAction.configuration,
              );
              return (
                <article key={fastAction.id}>
                  <div className={styles.fastActionSummary}>
                    <strong>{fastAction.name}</strong>
                    <small>{formatMode(fastAction.configuration.mode)} · {fastAction.configuration.platforms.map(formatPlatform).join(' + ')}</small>
                    <span>{fastAction.configuration.destinations.map((destination) => destination === 'artifact' ? 'Artifact' : destination === 'firebase' ? 'Firebase' : 'Store').join(' + ')}</span>
                    {versionSummaries.length === 0 ? (
                      <small className={styles.fastActionArtifactVersion}>
                        Uses the version embedded in the selected artifact
                      </small>
                    ) : (
                      <div aria-label="Saved target versions" className={styles.fastActionVersions}>
                        {versionSummaries.map((version) => (
                          <span key={version.platform}>
                            <b>{version.platform} target</b>
                            <code>{version.versionName}</code>
                            <small>{version.counterLabel} {version.counterValue}</small>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className={styles.fastActionButtons}>
                    <Button disabled={startingFastActionId !== null} onClick={() => onRunFastAction(fastAction)} size="sm">{startingFastActionId === fastAction.id && <Spinner animation="border" size="sm" />} {startingFastActionId === fastAction.id ? 'Preparing…' : 'Start'}</Button>
                    <Button disabled={startingFastActionId !== null} onClick={() => onEditFastAction(fastAction)} size="sm" variant="secondary">Edit</Button>
                    <Button disabled={startingFastActionId !== null} onClick={() => setFastActionToDelete(fastAction)} size="sm" variant="danger">Delete</Button>
                  </div>
                </article>
              );
            })}
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
            {history.map((run) => {
              const configuration = run.configuration;
              const versionSummaries = configuration === null
                ? []
                : resolveFastActionVersionSummaries(configuration);
              return (
                <article className={styles.historyCard} key={run.id}>
                  <div className={styles.historyHeader}>
                    <StatusPill label={formatOutcome(run.outcome)} tone={outcomeTone(run.outcome)} />
                    <div><strong>{formatMode(run.mode)}</strong><small>{run.platforms.map(formatPlatform).join(' + ')}</small></div>
                    <time>{formatDateTime(run.finishedAt)}</time>
                    <Button disabled={configuration === null} onClick={() => onRepeatHistory(run)} size="sm">
                      {run.outcome === 'failed' || run.outcome === 'partiallySucceeded'
                        ? 'Retry'
                        : 'Repeat'}
                    </Button>
                  </div>
                  {configuration === null ? (
                    <p className={styles.legacyHistoryMessage}>Full selections are unavailable for releases created before history snapshots.</p>
                  ) : (
                    <>
                      <div className={styles.historySelections}>
                        <div><span>Source</span><strong>{configuration.mode === 'uploadOnly' ? 'Existing artifact' : 'New build'}</strong></div>
                        <div><span>Destinations</span><strong>{configuration.destinations.map(formatDestination).join(' + ')}</strong></div>
                        <div><span>Platforms</span><strong>{configuration.platforms.map(formatPlatform).join(' + ')}</strong></div>
                        <div><span>Signing</span><strong>{configuration.artifactSigningPlatforms.length === 0 ? 'Not requested' : configuration.artifactSigningPlatforms.map(formatPlatform).join(' + ')}</strong></div>
                        {configuration.androidArtifactType !== undefined && <div><span>Android artifact</span><strong>{configuration.androidArtifactType.toUpperCase()}</strong></div>}
                        {configuration.destinations.includes('firebase') && <div><span>Tester groups</span><strong>{configuration.distributionGroups.join(', ')}</strong></div>}
                      </div>
                      {versionSummaries.length > 0 && (
                        <div aria-label="Release versions" className={styles.historyVersions}>
                          {versionSummaries.map((version) => (
                            <span key={version.platform}>
                              <b>{version.platform}</b>
                              <code>{version.versionName}</code>
                              <small>{version.counterLabel} {version.counterValue}</small>
                            </span>
                          ))}
                        </div>
                      )}
                      <div className={styles.historyDetails}>
                        {configuration.artifactOutputDirectoryPath !== undefined && <div><span>Output directory</span><code>{configuration.artifactOutputDirectoryPath}</code></div>}
                        {configuration.androidArtifactPath !== undefined && <div><span>Android source</span><code>{configuration.androidArtifactPath}</code></div>}
                        {configuration.iosArtifactPath !== undefined && <div><span>iOS source</span><code>{configuration.iosArtifactPath}</code></div>}
                        {configuration.releaseNotes !== '' && <div><span>Release notes</span><p>{configuration.releaseNotes}</p></div>}
                      </div>
                    </>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <footer className={styles.dangerZone}>
        <div><strong>Remove application</strong><span>The setup and release history will be deleted permanently.</span></div>
        <Button onClick={() => setIsDeleteOpen(true)} variant="danger">Delete application</Button>
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
