import { Button, Dropdown } from 'react-bootstrap';
import launchIcon from '@renderer/assets/launch-icon.png';
import devIcon from '@renderer/assets/dev-icon.png';
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
  onAddApplication,
  onOpenApplication,
  onOpenHome,
  onThemeChange,
  selectedApplicationId,
  theme,
}: AppShellProps): React.JSX.Element => (
  <div className={styles.shell}>
    <aside className={styles.sidebar}>
      <button className={styles.brand} onClick={onOpenHome} type="button">
        <img alt="" aria-hidden="true" src={import.meta.env.DEV ? devIcon : launchIcon} />
        <span>
          <strong>LaunchDeck</strong>
          <small>{import.meta.env.DEV ? 'Development' : 'Release center'}</small>
        </span>
      </button>
      <nav aria-label="Applications" className={styles.navigation}>
        <div className={styles.navigationHeader}>
          <span>Applications</span>
          <button aria-label="Add application" onClick={onAddApplication} type="button">+</button>
        </div>
        {applications.length === 0 ? (
          <p className={styles.sidebarEmpty}>No applications added yet.</p>
        ) : (
          applications.map((application) => (
            <button
              className={
                application.id === selectedApplicationId
                  ? `${styles.appLink} ${styles.appLinkActive}`
                  : styles.appLink
              }
              key={application.id}
              onClick={() => onOpenApplication(application.id)}
              type="button"
            >
              <span className={styles.appInitial}>{application.name.slice(0, 1).toLocaleUpperCase('en-US')}</span>
              <span>
                <strong>{application.name}</strong>
                <small>{application.platforms.map((platform) => (platform === 'ios' ? 'iOS' : 'Android')).join(' + ')}</small>
              </span>
            </button>
          ))
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
