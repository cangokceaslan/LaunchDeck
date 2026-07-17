import launchIcon from '@renderer/assets/launch-icon.png';
import devIcon from '@renderer/assets/dev-icon.png';
import styles from '@components/WindowHeader/index.module.scss';

const productIcon = import.meta.env.DEV ? devIcon : launchIcon;

export const WindowHeader = (): React.JSX.Element => (
  <header className={styles.header}>
    <div
      className={styles.dragRegion}
      onDoubleClick={() => void window.desktopApi.windowToggleMaximize()}
    >
      <img alt="" aria-hidden="true" className={styles.productIcon} src={productIcon} />
      <div className={styles.productTitle}>
        <strong>LaunchDeck</strong>
        <span>Distribution operations</span>
      </div>
      <div className={styles.context}>
        <span aria-hidden="true" className={styles.statusDot} />
        Release distribution
      </div>
    </div>
    <div className={styles.windowControls}>
      <button
        aria-label="Minimize window"
        className={styles.minimizeButton}
        onClick={() => void window.desktopApi.windowMinimize()}
        title="Minimize"
        type="button"
      >
        <svg aria-hidden="true" viewBox="0 0 16 16">
          <path d="M3 8.5h10" />
        </svg>
      </button>
      <button
        aria-label="Maximize or restore window"
        className={styles.maximizeButton}
        onClick={() => void window.desktopApi.windowToggleMaximize()}
        title="Maximize or restore"
        type="button"
      >
        <svg aria-hidden="true" viewBox="0 0 16 16">
          <rect height="9" rx="1" width="9" x="3.5" y="3.5" />
        </svg>
      </button>
      <button
        aria-label="Close LaunchDeck"
        className={styles.closeButton}
        onClick={() => void window.desktopApi.windowClose()}
        title="Close"
        type="button"
      >
        <svg aria-hidden="true" viewBox="0 0 16 16">
          <path d="m4 4 8 8m0-8-8 8" />
        </svg>
      </button>
    </div>
  </header>
);
