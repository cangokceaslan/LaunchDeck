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
import {
  formatHistoryDestination,
  formatRunDuration,
  getHistoryActionLabel,
  getHistoryOutcomeTone,
} from '@renderer/utils/releaseHistory';
import { resolveFastActionVersionSummaries } from '@renderer/utils/releaseConfiguration';
import type { ApplicationDetailProps } from '@screens/ApplicationDetail/index.types';
import styles from '@screens/ApplicationDetail/index.module.scss';

export const ApplicationDetail = ({
  application,
  fastActions,
  hasMoreHistory,
  history,
  isChangingIcon,
  isHistoryLoading,
  isLoadingMoreHistory,
  isSetupChecking,
  isSetupReady,
  onClearHistory,
  onChangeIcon,
  onCreateFastAction,
  onDelete,
  onDeleteFastAction,
  onEdit,
  onEditFastAction,
  onLoadMoreHistory,
  onOpenHistory,
  onRemoveIcon,
  onRepeatHistory,
  onRunFastAction,
  onShowSetup,
  onStartRelease,
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
          <div className={styles.titleContent}>
            <span className={styles.eyebrow}>{application.firebaseProjectId || 'Local and store release configuration'}</span>
            <div className={styles.applicationHeading}>
              <h1>{application.name}</h1>
              <button
                aria-haspopup="dialog"
                className={`${styles.setupBadge} ${
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
            </div>
            <div className={styles.platforms}>
              {application.platforms.map((platform) => (
                <StatusPill key={platform} label={formatPlatform(platform)} tone="neutral" />
              ))}
            </div>
          </div>
        </div>
        <div className={styles.actions}>
          <Button className={styles.editSetupButton} onClick={onEdit} variant="outline-primary">
            Edit setup
          </Button>
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
                    <Button onClick={() => onRunFastAction(fastAction)} size="sm">Start</Button>
                    <Button onClick={() => onEditFastAction(fastAction)} size="sm" variant="secondary">Edit</Button>
                    <Button onClick={() => setFastActionToDelete(fastAction)} size="sm" variant="danger">Delete</Button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className={styles.history}>
        <div className={styles.sectionHeader}>
          <h2>Release history</h2>
          <Button onClick={onClearHistory} size="sm" variant="link">Clear history</Button>
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
                <article className={styles.historyCard} data-outcome={run.outcome} key={run.id}>
                  <button
                    aria-label={`Open details for ${formatMode(run.mode)} release from ${formatDateTime(run.finishedAt)}`}
                    className={styles.historyOpenTarget}
                    onClick={() => onOpenHistory(run)}
                    type="button"
                  />
                  <div className={styles.historyCardTop}>
                    <StatusPill
                      label={formatOutcome(run.outcome)}
                      tone={getHistoryOutcomeTone(run.outcome)}
                    />
                    <time dateTime={run.finishedAt}>{formatDateTime(run.finishedAt)}</time>
                  </div>
                  <div className={styles.historyCardTitle}>
                    <div>
                      <span>Pipeline</span>
                      <h3>{formatMode(run.mode)}</h3>
                    </div>
                    <div className={styles.historyPlatforms}>
                      {run.platforms.map((platform) => (
                        <span key={platform}>{formatPlatform(platform)}</span>
                      ))}
                    </div>
                  </div>
                  <div className={styles.historyFacts}>
                    <span>
                      {configuration === null
                        ? 'Snapshot unavailable'
                        : configuration.destinations.map(formatHistoryDestination).join(' + ')}
                    </span>
                    <span>{formatRunDuration(run.startedAt, run.finishedAt)}</span>
                    <span>
                      {versionSummaries.length === 0
                        ? 'Artifact version'
                        : versionSummaries.map((version) => `${version.platform} ${version.versionName}`).join(' · ')}
                    </span>
                  </div>
                  <div className={styles.historyActions}>
                    <Button
                      className={styles.historyActionButton}
                      onClick={() => onOpenHistory(run)}
                      size="sm"
                      variant="outline-secondary"
                    >
                      View details
                    </Button>
                    <Button
                      className={styles.historyActionButton}
                      disabled={configuration === null}
                      onClick={() => onRepeatHistory(run)}
                      size="sm"
                      title={configuration === null ? 'This legacy run has no repeatable configuration snapshot.' : undefined}
                      variant={run.outcome === 'failed' || run.outcome === 'partiallySucceeded' ? 'primary' : 'outline-secondary'}
                    >
                      {getHistoryActionLabel(run.outcome)}
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
        {hasMoreHistory && (
          <div className={styles.historyLoadMore}>
            <Button
              disabled={isLoadingMoreHistory}
              onClick={onLoadMoreHistory}
              variant="outline-secondary"
            >
              {isLoadingMoreHistory ? <><Spinner animation="border" size="sm" /> Loading older releases…</> : 'Load older releases'}
            </Button>
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
