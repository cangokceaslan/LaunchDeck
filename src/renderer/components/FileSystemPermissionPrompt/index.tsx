import { Alert, Button, Modal, Spinner } from 'react-bootstrap';
import type { FileSystemPermissionPromptProps } from '@components/FileSystemPermissionPrompt/index.types';
import {
  getFileSystemPermissionPlatformLabel,
  getFileSystemPermissionTargets,
  getPrimaryFileSystemPermissionTarget,
} from '@renderer/utils/fileSystemPermissions';
import styles from '@components/FileSystemPermissionPrompt/index.module.scss';

export const FileSystemPermissionPrompt = ({
  errorMessage,
  isOpen,
  isReviewing,
  onClose,
  onReview,
  platform,
}: FileSystemPermissionPromptProps): React.JSX.Element => {
  const platformLabel = getFileSystemPermissionPlatformLabel(platform);
  const targets = getFileSystemPermissionTargets(platform);
  const primaryTarget = getPrimaryFileSystemPermissionTarget(platform);

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
          <Modal.Title id="file-system-permission-title">Review file access</Modal.Title>
        </div>
      </Modal.Header>
      <Modal.Body>
        <p className={styles.intro}>
          LaunchDeck reads selected project and credential folders and writes generated artifacts.
          {` ${platformLabel}`} may restrict these locations, so review the relevant system setting
          before starting a release.
        </p>

        {errorMessage !== null && <Alert variant="danger">{errorMessage}</Alert>}

        <div className={styles.targetList}>
          {targets.map((target) => (
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
          LaunchDeck cannot read these operating-system switches directly. Opening the settings
          page records that you reviewed them; {platformLabel} remains authoritative.
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
          {isReviewing ? 'Opening…' : 'Open system settings'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};
