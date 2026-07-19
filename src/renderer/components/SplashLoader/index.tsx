import launchIcon from '@renderer/assets/launch-icon.png';
import devIcon from '@renderer/assets/dev-icon.png';
import styles from '@components/SplashLoader/index.module.scss';

const productIcon = import.meta.env.DEV ? devIcon : launchIcon;

export const SplashLoader = (): React.JSX.Element => (
  <main aria-labelledby="splash-status" className={styles.splash}>
    <div className={styles.content} role="status">
      <img alt="" aria-hidden="true" className={styles.icon} src={productIcon} />
      <div className={styles.copy}>
        <strong>LaunchDeck</strong>
        <span id="splash-status">Preparing workspace…</span>
      </div>
      <div aria-hidden="true" className={styles.progress}>
        <span />
      </div>
    </div>
  </main>
);
