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
        <span className={styles.eyebrow}>Release çalışma alanı</span>
        <h1>Uygulamalar</h1>
        <p>Kurulumu tamamlanmış mobil uygulamaları ve son release durumlarını yönetin.</p>
      </div>
      <Button onClick={onAddApplication}>Yeni uygulama ekle</Button>
    </header>
    {applications.length === 0 ? (
      <EmptyState
        actionLabel="Kuruluma başla"
        description="Service Account ve mobil proje dosyalarını bir kez seçin; sonraki release’lerde yapılandırmayı tekrar girmeyin."
        onAction={onAddApplication}
        title="İlk uygulamanızı ekleyin"
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
              <span className={styles.initial}>{application.name.slice(0, 1).toLocaleUpperCase('tr')}</span>
              <StatusPill label="Kurulum hazır" tone="success" />
            </div>
            <h2>{application.name}</h2>
            <code>{application.firebaseProjectId}</code>
            <div className={styles.platforms}>
              {application.platforms.map((platform) => (
                <span key={platform}>{formatPlatform(platform)}</span>
              ))}
            </div>
            <small>Son güncelleme {formatDateTime(application.updatedAt)}</small>
          </button>
        ))}
      </div>
    )}
  </div>
);
