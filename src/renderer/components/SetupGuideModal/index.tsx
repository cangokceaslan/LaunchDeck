import { Alert, Button, Modal, Spinner } from 'react-bootstrap';
import { StatusPill } from '@components/StatusPill';
import type { SetupGuideModalProps } from '@components/SetupGuideModal/index.types';
import { resolveSetupWorkflows } from '@components/SetupGuideModal/index.utils';
import styles from '@components/SetupGuideModal/index.module.scss';

export const SetupGuideModal = ({
  application,
  errorMessage,
  isChecking,
  isOpen,
  onClose,
  onRetry,
  report,
}: SetupGuideModalProps): React.JSX.Element => {
  const workflows = resolveSetupWorkflows(report, application);
  const readyWorkflowCount = workflows.filter((workflow) => workflow.isReady).length;

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
          <span className={styles.eyebrow}>Release requirements</span>
          <Modal.Title id="setup-guide-title">Setup guide</Modal.Title>
          <p>
            You only need one ready path. Complete the requirements for the work you plan to do.
          </p>
        </div>
      </Modal.Header>
      <Modal.Body>
        <div className={styles.summary}>
          <div>
            <strong>
              {application === null ? 'No application selected' : application.name}
            </strong>
            <span>
              {isChecking
                ? 'Checking installed tools…'
                : `${readyWorkflowCount} of ${workflows.length} release paths ready`}
            </span>
          </div>
          {isChecking && <Spinner animation="border" role="status" size="sm" />}
          {!isChecking && readyWorkflowCount > 0 && (
            <StatusPill label="Ready to work" tone="success" />
          )}
          {!isChecking && readyWorkflowCount === 0 && (
            <StatusPill label="Setup needed" tone="warning" />
          )}
        </div>

        {errorMessage !== null && <Alert variant="danger">{errorMessage}</Alert>}

        <div className={styles.workflowList}>
          {workflows.map((workflow, index) => (
            <article className={styles.workflow} key={workflow.id}>
              <header>
                <span className={styles.stepNumber}>{String(index + 1).padStart(2, '0')}</span>
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
