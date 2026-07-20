import { ApplicationLogo } from '@components/ApplicationLogo';
import { EmptyState } from '@components/EmptyState';
import { StatusPill } from '@components/StatusPill';
import { useInfiniteScroll } from '@hooks/useInfiniteScroll';
import { formatDateTime, formatPlatform } from '@renderer/utils/formatting';
import type { ApplicationListProps } from '@screens/ApplicationList/index.types';
import styles from '@screens/ApplicationList/index.module.scss';

export const ApplicationList = ({
  applications,
  hasMoreApplications,
  isLoadingMoreApplications,
  onAddApplication,
  onLoadMoreApplications,
  onOpenApplication,
}: ApplicationListProps): React.JSX.Element => {
  const loadMoreRef = useInfiniteScroll({
    hasMore: hasMoreApplications,
    isLoading: isLoadingMoreApplications,
    onLoadMore: onLoadMoreApplications,
  });

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <span className={styles.eyebrow}>Release workspace</span>
          <h1>Applications</h1>
          <p>Manage configured mobile applications and their latest release status.</p>
        </div>
        <button
          className={styles.addApplicationButton}
          onClick={onAddApplication}
          type="button"
        >
          <span aria-hidden="true" className={styles.addApplicationIcon}>
            <svg viewBox="0 0 20 20">
              <path d="M10 4.25v11.5M4.25 10h11.5" />
            </svg>
          </span>
          <span className={styles.addApplicationCopy}>
            <strong>Add application</strong>
            <small>Create a release target</small>
          </span>
          <span aria-hidden="true" className={styles.addApplicationArrow}>
            <svg viewBox="0 0 16 16">
              <path d="m6 3.75 4.25 4.25L6 12.25" />
            </svg>
          </span>
        </button>
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
                <ApplicationLogo
                  className={styles.initial}
                  iconDataUrl={application.iconDataUrl}
                />
                <StatusPill label="Setup ready" tone="success" />
              </div>
              <h2>{application.name}</h2>
              <code>{application.firebaseProjectId}</code>
              <div className={styles.platforms}>
                {application.platforms.map((platform) => (
                  <span key={platform}>{formatPlatform(platform)}</span>
                ))}
              </div>
              <small>Last activity {formatDateTime(application.lastActivityAt)}</small>
            </button>
          ))}
        </div>
      )}
      {applications.length > 0 && (
        <div
          aria-hidden={!isLoadingMoreApplications}
          className={styles.loadMoreSentinel}
          ref={loadMoreRef}
          role={isLoadingMoreApplications ? 'status' : undefined}
        >
          {isLoadingMoreApplications ? 'Loading more applications…' : ''}
        </div>
      )}
    </div>
  );
};
