import { Button, Dropdown } from 'react-bootstrap';
import { ApplicationLogo } from '@components/ApplicationLogo';
import { useInfiniteScroll } from '@hooks/useInfiniteScroll';
import type { AppShellProps } from '@components/AppShell/index.types';
import styles from '@components/AppShell/index.module.scss';

const themeLabels = {
  dark: 'Dark',
  light: 'Light',
  system: 'System',
} as const;

export const AppShell = ({
  applications,
  children,
  hasMoreApplications,
  isLoadingMoreApplications,
  onAddApplication,
  onLoadMoreApplications,
  onOpenApplication,
  onOpenHome,
  onThemeChange,
  selectedApplicationId,
  theme,
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
              Applications
            </button>
            <button aria-label="Add application" onClick={onAddApplication} type="button">+</button>
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
                  name={application.name}
                />
                <span>
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
          <Dropdown drop="up">
            <Dropdown.Toggle className={styles.themeButton} variant="link">
              Theme · {themeLabels[theme]}
            </Dropdown.Toggle>
            <Dropdown.Menu>
              <Dropdown.Item onClick={() => onThemeChange('system')}>System</Dropdown.Item>
              <Dropdown.Item onClick={() => onThemeChange('light')}>Light</Dropdown.Item>
              <Dropdown.Item onClick={() => onThemeChange('dark')}>Dark</Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown>
          <Button className={styles.addButton} onClick={onAddApplication} size="sm" variant="outline-light">
            Add application
          </Button>
        </div>
      </aside>
      <main className={styles.content}>{children}</main>
    </div>
  );
};
