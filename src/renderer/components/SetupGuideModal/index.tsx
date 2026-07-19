import { Alert, Button, Modal, Spinner } from 'react-bootstrap';
import { StatusPill } from '@components/StatusPill';
import type { SetupGuideModalProps } from '@components/SetupGuideModal/index.types';
import {
  isGeneralSetupReady,
  resolveGeneralSetupChecks,
  resolveSetupWorkflows,
} from '@components/SetupGuideModal/index.utils';
import type { StatusPillProps } from '@components/StatusPill/index.types';
import type { DoctorCheck } from '@shared/contracts/doctor';
import {
  getFileSystemPermissionPlatformLabel,
  getFileSystemPermissionTargets,
} from '@renderer/utils/fileSystemPermissions';
import styles from '@components/SetupGuideModal/index.module.scss';

const CHECK_TONES: Record<DoctorCheck['status'], StatusPillProps['tone']> = {
  checking: 'running',
  failed: 'danger',
  passed: 'success',
  warning: 'warning',
};

const CHECK_LABELS: Record<DoctorCheck['status'], string> = {
  checking: 'Checking',
  failed: 'Missing',
  passed: 'Ready',
  warning: 'Attention',
};

export const SetupGuideModal = ({
  application,
  errorMessage,
  fileSystemPermissionError,
  fileSystemPermissionState,
  isChecking,
  isOpen,
  onClose,
  onReviewFileSystemPermissions,
  onRetry,
  report,
  reviewingFileSystemPermissionTarget,
}: SetupGuideModalProps): React.JSX.Element => {
  const workflows = resolveSetupWorkflows(report, application);
  const readyWorkflowCount = workflows.filter((workflow) => workflow.isReady).length;
  const isGeneralSetup = application === null;
  const generalChecks = resolveGeneralSetupChecks(report);
  const isPermissionStateLoading = fileSystemPermissionState === null;
  const hasSupportedPermissionSettings =
    fileSystemPermissionState !== null &&
    fileSystemPermissionState.platform !== 'unsupported';
  const needsPermissionConfirmation =
    hasSupportedPermissionSettings && !fileSystemPermissionState.hasConfirmedAccess;
  const isReadyToWork = readyWorkflowCount > 0 && !needsPermissionConfirmation;
  const isGeneralReady = isGeneralSetupReady(report, fileSystemPermissionState);
  const generalRequiredCount =
    generalChecks.length + (hasSupportedPermissionSettings ? 1 : 0);
  const generalReadyCount =
    generalChecks.filter((check) => check.status === 'passed').length +
    (hasSupportedPermissionSettings && fileSystemPermissionState.hasConfirmedAccess ? 1 : 0);
  const permissionTargets =
    fileSystemPermissionState === null
      ? []
      : getFileSystemPermissionTargets(fileSystemPermissionState.platform);
  const permissionPlatformLabel =
    fileSystemPermissionState !== null &&
    fileSystemPermissionState.platform !== 'unsupported'
      ? getFileSystemPermissionPlatformLabel(fileSystemPermissionState.platform)
      : null;

  return (
    <Modal
      aria-labelledby="setup-guide-title"
      centered
      className={styles.modal}
      onHide={onClose}
      scrollable
      show={isOpen}
      size="lg"
    >
      <Modal.Header closeButton>
        <div className={styles.modalHeading}>
          <span className={styles.eyebrow}>
            {isGeneralSetup ? 'Environment requirements' : 'Release requirements'}
          </span>
          <Modal.Title id="setup-guide-title">
            {isGeneralSetup ? 'General Setup' : 'Setup guide'}
          </Modal.Title>
          <p>
            {isGeneralSetup
              ? 'Check system-wide access and tools before configuring an application.'
              : 'You only need one ready path. Complete the requirements for the work you plan to do.'}
          </p>
        </div>
      </Modal.Header>
      <Modal.Body>
        <div className={styles.summary}>
          <div>
            <strong>{isGeneralSetup ? 'LaunchDeck environment' : application.name}</strong>
            <span>
              {isChecking || isPermissionStateLoading
                ? 'Checking installed tools…'
                : isGeneralSetup
                  ? `${generalReadyCount} of ${generalRequiredCount} system requirements ready`
                  : `${readyWorkflowCount} of ${workflows.length} release paths ready`}
            </span>
          </div>
          {(isChecking || isPermissionStateLoading) && (
            <Spinner animation="border" role="status" size="sm" />
          )}
          {!isChecking &&
            !isPermissionStateLoading &&
            (isGeneralSetup ? isGeneralReady : isReadyToWork) && (
              <StatusPill
                label={isGeneralSetup ? 'General setup ready' : 'Ready to work'}
                tone="success"
              />
            )}
          {!isChecking &&
            !isPermissionStateLoading &&
            !(isGeneralSetup ? isGeneralReady : isReadyToWork) && (
              <StatusPill label="Setup needed" tone="warning" />
            )}
        </div>

        {errorMessage !== null && <Alert variant="danger">{errorMessage}</Alert>}
        {fileSystemPermissionError !== null && (
          <Alert variant="danger">{fileSystemPermissionError}</Alert>
        )}

        {isGeneralSetup && generalChecks.length > 0 && (
          <section className={styles.generalSection}>
            <header>
              <div>
                <span className={styles.sectionEyebrow}>Environment check</span>
                <h2>Required tools</h2>
                <p>System-wide tools available to LaunchDeck.</p>
              </div>
            </header>
            <div className={styles.generalChecks}>
              {generalChecks.map((check) => (
                <div className={styles.generalCheck} key={check.code}>
                  <div>
                    <strong>{check.label}</strong>
                    {check.version !== undefined && <span>{check.version}</span>}
                    <p>{check.detail}</p>
                  </div>
                  <StatusPill label={CHECK_LABELS[check.status]} tone={CHECK_TONES[check.status]} />
                </div>
              ))}
            </div>
          </section>
        )}

        {hasSupportedPermissionSettings && permissionPlatformLabel !== null && (
          <section className={styles.permissionSection}>
            <header>
              <div>
                <span className={styles.sectionEyebrow}>
                  {isGeneralSetup ? 'Configuration' : 'System access'}
                </span>
                <h2>File system permissions</h2>
                <p>
                  Request access for project folders, credentials, and generated artifacts.
                </p>
              </div>
              <StatusPill
                label={
                  fileSystemPermissionState.hasConfirmedAccess
                    ? 'Access confirmed'
                    : 'Access needed'
                }
                tone={fileSystemPermissionState.hasConfirmedAccess ? 'success' : 'warning'}
              />
            </header>
            <div className={styles.permissionTargets}>
              {permissionTargets.map((target) => {
                const shouldOpenSettings = fileSystemPermissionState.settingsTargets.includes(
                  target.target,
                );
                return (
                  <div className={styles.permissionTarget} key={target.target}>
                    <div>
                      <strong>{target.label}</strong>
                      <span>{shouldOpenSettings ? 'Settings fallback' : 'Direct request'}</span>
                      <p>{target.detail}</p>
                    </div>
                    <Button
                      disabled={reviewingFileSystemPermissionTarget !== null}
                      onClick={() => onReviewFileSystemPermissions(target.target)}
                      size="sm"
                      variant="outline-secondary"
                    >
                      {reviewingFileSystemPermissionTarget === target.target
                        ? shouldOpenSettings
                          ? 'Opening…'
                          : 'Requesting…'
                        : shouldOpenSettings
                          ? 'Open settings'
                          : 'Request access'}
                    </Button>
                  </div>
                );
              })}
            </div>
            <p className={styles.permissionNote}>
              LaunchDeck first uses a native folder request. If access is not confirmed, repeating
              the action opens the relevant {permissionPlatformLabel} setting. Access is marked
              ready only after a selected folder can be read and written.
            </p>
          </section>
        )}

        {!isGeneralSetup && (
          <div className={styles.workflowList}>
            {workflows.map((workflow, index) => (
              <article className={styles.workflow} key={workflow.id}>
                <header>
                  <span className={styles.stepNumber}>
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <div>
                    <h2>{workflow.title}</h2>
                    <p>{workflow.description}</p>
                  </div>
                  <StatusPill
                    label={workflow.isReady ? 'Ready' : 'Missing setup'}
                    tone={workflow.isReady ? 'success' : 'warning'}
                  />
                </header>
                {workflow.isReady ? (
                  <div className={styles.readyMessage}>
                    <span aria-hidden="true">✓</span>
                    <div>
                      <strong>No additional setup required</strong>
                      <p>{workflow.readyDetail}</p>
                    </div>
                  </div>
                ) : (
                  <div className={styles.requirements}>
                    <span className={styles.requirementsLabel}>Missing requirements</span>
                    <ul>
                      {workflow.missingRequirements.map((requirement) => (
                        <li key={`${requirement.label}-${requirement.detail}`}>
                          <span aria-hidden="true">!</span>
                          <div>
                            <strong>{requirement.label}</strong>
                            <p>{requirement.detail}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </Modal.Body>
      <Modal.Footer>
        <span>Checks are guidance; each release still runs an authoritative preflight.</span>
        <Button disabled={isChecking} onClick={onRetry} variant="outline-secondary">
          {isChecking ? 'Checking…' : 'Check again'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};
