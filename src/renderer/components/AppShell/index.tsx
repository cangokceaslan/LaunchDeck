import { ApplicationLogo } from '@components/ApplicationLogo';
import { useInfiniteScroll } from '@hooks/useInfiniteScroll';
import type { AppShellProps } from '@components/AppShell/index.types';
import styles from '@components/AppShell/index.module.scss';

export const AppShell = ({
  applications,
  children,
  hasMoreApplications,
  isLoadingMoreApplications,
  onAddApplication,
  onLoadMoreApplications,
  onOpenApplication,
  onOpenHome,
  selectedApplicationId,
}: AppShellProps): React.JSX.Element => {
  const loadMoreRef = useInfiniteScroll({
    hasMore: hasMoreApplications,
    isLoading: isLoadingMoreApplications,
    onLoadMore: onLoadMoreApplications,
  });

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <nav aria-label="Applications" className={styles.navigation}>
          <div className={styles.navigationHeader}>
            <button className={styles.applicationsButton} onClick={onOpenHome} type="button">
              <span aria-hidden="true" className={styles.applicationsIcon}>
                <svg viewBox="0 0 16 16">
                  <rect height="4" rx="1" width="4" x="2" y="2" />
                  <rect height="4" rx="1" width="4" x="10" y="2" />
                  <rect height="4" rx="1" width="4" x="2" y="10" />
                  <rect height="4" rx="1" width="4" x="10" y="10" />
                </svg>
              </span>
              <span>Applications</span>
            </button>
            <span aria-label={`${applications.length}${hasMoreApplications ? ' or more' : ''} applications`} className={styles.applicationCount}>
              {applications.length}{hasMoreApplications ? '+' : ''}
            </span>
          </div>
          {applications.length === 0 ? (
            <p className={styles.sidebarEmpty}>No applications added yet.</p>
          ) : (
            applications.map((application) => (
              <button
                aria-current={application.id === selectedApplicationId ? 'page' : undefined}
                className={
                  application.id === selectedApplicationId
                    ? `${styles.appLink} ${styles.appLinkActive}`
                    : styles.appLink
                }
                key={application.id}
                onClick={() => onOpenApplication(application.id)}
                type="button"
              >
                <ApplicationLogo
                  className={styles.appInitial}
                  iconDataUrl={application.iconDataUrl}
                />
                <span className={styles.appCopy}>
                  <strong>{application.name}</strong>
                  <small>{application.platforms.map((platform) => (platform === 'ios' ? 'iOS' : 'Android')).join(' + ')}</small>
                </span>
              </button>
            ))
          )}
          {applications.length > 0 && (
            <div
              aria-hidden={!isLoadingMoreApplications}
              className={styles.loadMoreSentinel}
              ref={loadMoreRef}
              role={isLoadingMoreApplications ? 'status' : undefined}
            >
              {isLoadingMoreApplications ? 'Loading more…' : ''}
            </div>
          )}
        </nav>
        <div className={styles.sidebarFooter}>
          <button className={styles.addButton} onClick={onAddApplication} type="button">
            <span aria-hidden="true" className={styles.addIcon}>
              <svg viewBox="0 0 20 20">
                <rect height="13" rx="3.25" width="13" x="2.5" y="4.5" />
                <path d="M6.25 8.25h3.5M6.25 11.75h2" />
                <circle cx="14.25" cy="5.75" r="3.25" />
                <path d="M14.25 4.25v3M12.75 5.75h3" />
              </svg>
            </span>
            <span className={styles.addCopy}>
              <strong>Add application</strong>
              <small>Configure a release target</small>
            </span>
            <span aria-hidden="true" className={styles.addArrow}>
              <svg viewBox="0 0 16 16">
                <path d="m6 3.75 4.25 4.25L6 12.25" />
              </svg>
            </span>
          </button>
        </div>
      </aside>
      <main className={styles.content}>{children}</main>
    </div>
  );
};
