import { Button } from 'react-bootstrap';
import { EmptyState } from '@components/EmptyState';
import { StatusPill } from '@components/StatusPill';
import { formatDateTime, formatPlatform } from '@renderer/utils/formatting';
import type { ApplicationListProps } from '@screens/ApplicationList/index.types';
import styles from '@screens/ApplicationList/index.module.scss';

export const ApplicationList = ({
  applications,
  onAddApplication,
  onOpenApplication,
}: ApplicationListProps): React.JSX.Element => (
  <div className={styles.page}>
    <header className={styles.pageHeader}>
      <div>
        <span className={styles.eyebrow}>Release workspace</span>
        <h1>Applications</h1>
        <p>Manage configured mobile applications and their latest release status.</p>
      </div>
      <Button onClick={onAddApplication}>Add application</Button>
    </header>
    {applications.length === 0 ? (
      <EmptyState
        actionLabel="Start setup"
        description="Select the service account and mobile project files once, then reuse the configuration for future releases."
        onAction={onAddApplication}
        title="Add your first application"
      />
    ) : (
      <div className={styles.grid}>
        {applications.map((application) => (
          <button
            className={styles.applicationCard}
            key={application.id}
            onClick={() => onOpenApplication(application.id)}
            type="button"
          >
            <div className={styles.cardTop}>
              <span className={styles.initial}>{application.name.slice(0, 1).toLocaleUpperCase('en-US')}</span>
              <StatusPill label="Setup ready" tone="success" />
            </div>
            <h2>{application.name}</h2>
            <code>{application.firebaseProjectId}</code>
            <div className={styles.platforms}>
              {application.platforms.map((platform) => (
                <span key={platform}>{formatPlatform(platform)}</span>
              ))}
            </div>
            <small>Updated {formatDateTime(application.updatedAt)}</small>
          </button>
        ))}
      </div>
    )}
  </div>
);
