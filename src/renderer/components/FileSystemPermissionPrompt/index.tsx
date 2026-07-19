import { Alert, Button, Modal, Spinner } from 'react-bootstrap';
import type { FileSystemPermissionPromptProps } from '@components/FileSystemPermissionPrompt/index.types';
import {
  getFileSystemPermissionPlatformLabel,
  getFileSystemPermissionTargets,
  getPrimaryFileSystemPermissionTarget,
} from '@renderer/utils/fileSystemPermissions';
import styles from '@components/FileSystemPermissionPrompt/index.module.scss';

export const FileSystemPermissionPrompt = ({
  directRequestAttempts,
  errorMessage,
  isOpen,
  isReviewing,
  onClose,
  onReview,
  platform,
  settingsTargets,
}: FileSystemPermissionPromptProps): React.JSX.Element => {
  const platformLabel = getFileSystemPermissionPlatformLabel(platform);
  const targets = getFileSystemPermissionTargets(platform);
  const primaryTarget = getPrimaryFileSystemPermissionTarget(platform);
  const shouldOpenSettings = settingsTargets.includes(primaryTarget);
  const visibleTargets = shouldOpenSettings
    ? targets
    : targets.filter((target) => target.target === primaryTarget);

  return (
    <Modal
      aria-labelledby="file-system-permission-title"
      backdrop="static"
      centered
      className={styles.modal}
      keyboard={!isReviewing}
      onHide={onClose}
      show={isOpen}
    >
      <Modal.Header>
        <div>
          <span className={styles.eyebrow}>{platformLabel} access</span>
          <Modal.Title id="file-system-permission-title">Allow file access</Modal.Title>
        </div>
      </Modal.Header>
      <Modal.Body>
        <p className={styles.intro}>
          LaunchDeck reads selected project and credential folders and writes generated artifacts.
          Request access to a folder you plan to use before starting a release.
        </p>

        {errorMessage !== null && <Alert variant="danger">{errorMessage}</Alert>}

        <div className={styles.targetList}>
          {visibleTargets.map((target) => (
            <div className={styles.target} key={target.target}>
              <span aria-hidden="true">{target.isPrimary ? '01' : '02'}</span>
              <div>
                <strong>{target.label}</strong>
                <p>{target.detail}</p>
              </div>
            </div>
          ))}
        </div>

        <p className={styles.note}>
          {shouldOpenSettings
            ? `Repeated requests did not confirm access. Open the relevant ${platformLabel} setting, then return and verify a folder again.`
            : directRequestAttempts > 0
              ? `Access was not confirmed. Request it once more; if the folder remains unavailable, LaunchDeck will open the relevant ${platformLabel} setting.`
              : `LaunchDeck first asks you to choose a folder and verifies read and write access directly.`}
        </p>
      </Modal.Body>
      <Modal.Footer>
        <Button disabled={isReviewing} onClick={onClose} variant="outline-secondary">
          Not now
        </Button>
        <Button
          disabled={isReviewing}
          onClick={() => onReview(primaryTarget)}
          variant="primary"
        >
          {isReviewing && <Spinner animation="border" className={styles.spinner} size="sm" />}
          {isReviewing
            ? shouldOpenSettings
              ? 'Opening…'
              : 'Requesting…'
            : shouldOpenSettings
              ? 'Open system settings'
              : directRequestAttempts > 0
                ? 'Request again'
                : 'Request access'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};
