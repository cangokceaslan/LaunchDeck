import { useState } from 'react';
import { Alert, Button, Form, Spinner } from 'react-bootstrap';
import { PathField } from '@components/PathField';
import { PipelineProgress } from '@components/PipelineProgress';
import { useReleaseRun } from '@hooks/useReleaseRun';
import { formatMode, formatPlatform, normalizeErrorMessage } from '@renderer/utils/formatting';
import type { ReleaseMode, ReleasePlatform } from '@shared/contracts/domain';
import type { PreflightResult } from '@shared/contracts/release';
import type { ReleasePipelineProps } from '@screens/ReleasePipeline/index.types';
import styles from '@screens/ReleasePipeline/index.module.scss';

const modes: Array<{ description: string; label: string; value: ReleaseMode }> = [
  { description: 'Kaynak koddan artifact üret; Firebase’e gönderme.', label: 'Build', value: 'buildOnly' },
  { description: 'Var olan APK / IPA artifact’ını Firebase’e gönder.', label: 'Sadece upload', value: 'uploadOnly' },
  { description: 'Artifact üret, doğrula ve Firebase’e gönder.', label: 'Build + upload', value: 'buildAndUpload' },
];

export const ReleasePipeline = ({
  application,
  onClose,
  onFinished,
  supportedPlatforms,
}: ReleasePipelineProps): React.JSX.Element => {
  const availablePlatforms = application.platforms.filter((platform) => supportedPlatforms.includes(platform));
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [mode, setMode] = useState<ReleaseMode>('buildAndUpload');
  const [platforms, setPlatforms] = useState<ReleasePlatform[]>(availablePlatforms);
  const [releaseNotes, setReleaseNotes] = useState(`${application.name} yeni test sürümü`);
  const [groupsText, setGroupsText] = useState(application.distributionGroups.join(', '));
  const [androidArtifactPath, setAndroidArtifactPath] = useState(application.android?.artifactPath ?? '');
  const [iosArtifactPath, setIosArtifactPath] = useState(application.ios?.artifactPath ?? '');
  const [preflight, setPreflight] = useState<PreflightResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const releaseRun = useReleaseRun();

  const togglePlatform = (platform: ReleasePlatform): void => {
    setPlatforms((current) =>
      current.includes(platform)
        ? current.filter((selectedPlatform) => selectedPlatform !== platform)
        : [...current, platform],
    );
  };

  const chooseArtifact = async (platform: ReleasePlatform): Promise<void> => {
    const result =
      platform === 'android'
        ? await window.desktopApi.chooseAndroidArtifact()
        : await window.desktopApi.chooseIosArtifact();
    if (result.status === 'selected') {
      if (platform === 'android') setAndroidArtifactPath(result.path);
      else setIosArtifactPath(result.path);
    }
  };

  const handlePreflight = async (): Promise<void> => {
    setErrorMessage(null);
    setIsValidating(true);
    try {
      const result = await window.desktopApi.preflightRelease({
        androidArtifactPath: mode === 'uploadOnly' && platforms.includes('android') ? androidArtifactPath : undefined,
        applicationId: application.id,
        distributionGroups: groupsText.split(',').map((group) => group.trim()).filter(Boolean),
        iosArtifactPath: mode === 'uploadOnly' && platforms.includes('ios') ? iosArtifactPath : undefined,
        mode,
        platforms,
        releaseNotes,
      });
      setPreflight(result);
      setStep(4);
    } catch (error) {
      setErrorMessage(normalizeErrorMessage(error));
    } finally {
      setIsValidating(false);
    }
  };

  const isRunStarted = releaseRun.status !== 'idle' && releaseRun.status !== 'failedToStart';

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div><span className={styles.eyebrow}>{application.name}</span><h1>Yeni release pipeline</h1></div>
        <Button disabled={releaseRun.status === 'running' || releaseRun.status === 'cancelling'} onClick={onClose} variant="outline-secondary">Kapat</Button>
      </header>

      <ol className={styles.stepper}>
        {['İşlem', 'Platform', 'Release bilgisi', 'Pipeline'].map((label, index) => (
          <li className={step === index + 1 ? styles.active : step > index + 1 ? styles.complete : ''} key={label}>
            <span>{index + 1}</span><strong>{label}</strong>
          </li>
        ))}
      </ol>

      <section className={styles.wizardCard}>
        {step === 1 && (
          <div className={styles.stepContent}>
            <header><span>Adım 1</span><h2>Ne yapmak istiyorsunuz?</h2><p>Build ve upload sonuçları ayrı ayrı takip edilir.</p></header>
            <div className={styles.choiceGrid}>
              {modes.map((modeOption) => (
                <button className={mode === modeOption.value ? styles.choiceSelected : styles.choice} key={modeOption.value} onClick={() => setMode(modeOption.value)} type="button">
                  <span aria-hidden="true" className={styles.radio}>{mode === modeOption.value ? '●' : '○'}</span>
                  <strong>{modeOption.label}</strong><small>{modeOption.description}</small>
                </button>
              ))}
            </div>
            <footer><Button onClick={() => setStep(2)}>Platform seçimine geç</Button></footer>
          </div>
        )}

        {step === 2 && (
          <div className={styles.stepContent}>
            <header><span>Adım 2</span><h2>Platformu seçin</h2><p>Windows ve Linux üzerinde iOS seçimi sunulmaz.</p></header>
            <div className={styles.choiceGrid}>
              {availablePlatforms.map((platform) => (
                <button className={platforms.includes(platform) ? styles.choiceSelected : styles.choice} key={platform} onClick={() => togglePlatform(platform)} type="button">
                  <span aria-hidden="true" className={styles.platformMark}>{platform === 'android' ? 'A' : 'i'}</span>
                  <strong>{formatPlatform(platform)}</strong><small>{platform === 'android' ? 'Gradle + APK' : 'Xcode + IPA'}</small>
                </button>
              ))}
            </div>
            <footer><Button onClick={() => setStep(1)} variant="outline-secondary">Geri</Button><Button disabled={platforms.length === 0} onClick={() => setStep(3)}>Release bilgisine geç</Button></footer>
          </div>
        )}

        {step === 3 && (
          <div className={styles.stepContent}>
            <header><span>Adım 3</span><h2>Release bilgisini doğrulayın</h2><p>Preflight başlamadan yapılandırma son kez hazırlanır.</p></header>
            <div className={styles.formGrid}>
              <Form.Group><Form.Label>Release notu</Form.Label><Form.Control as="textarea" onChange={(event) => setReleaseNotes(event.target.value)} required rows={4} value={releaseNotes} /></Form.Group>
              <Form.Group><Form.Label>Tester grup aliasları</Form.Label><Form.Control onChange={(event) => setGroupsText(event.target.value)} required value={groupsText} /><Form.Text>Virgülle ayırın.</Form.Text></Form.Group>
              {mode === 'uploadOnly' && platforms.includes('android') && <PathField label="Android APK" onBrowse={() => void chooseArtifact('android')} required value={androidArtifactPath} />}
              {mode === 'uploadOnly' && platforms.includes('ios') && <PathField label="iOS IPA" onBrowse={() => void chooseArtifact('ios')} required value={iosArtifactPath} />}
            </div>
            {errorMessage !== null && <Alert variant="danger">{errorMessage}</Alert>}
            <footer><Button onClick={() => setStep(2)} variant="outline-secondary">Geri</Button><Button disabled={isValidating || releaseNotes.trim() === '' || groupsText.trim() === ''} onClick={() => void handlePreflight()}>{isValidating && <Spinner animation="border" size="sm" />} {isValidating ? 'Doğrulanıyor…' : 'Preflight çalıştır'}</Button></footer>
          </div>
        )}

        {step === 4 && (
          <div className={styles.stepContent}>
            {!isRunStarted && preflight?.isValid === false && (
              <><header><span>Adım 4</span><h2>Preflight tamamlanamadı</h2><p>Engelleyici sorunları düzeltip yeniden deneyin.</p></header><div className={styles.issueList}>{preflight.issues.map((issue) => <Alert key={`${issue.code}-${issue.field ?? ''}`} variant="danger">{issue.message}</Alert>)}</div><footer><Button onClick={() => setStep(3)} variant="outline-secondary">Bilgileri düzenle</Button><Button onClick={() => void handlePreflight()}>Yeniden doğrula</Button></footer></>
            )}
            {!isRunStarted && preflight?.isValid === true && (
              <><header><span>Adım 4</span><h2>Pipeline çalışmaya hazır</h2><p>Plan 10 dakika boyunca geçerli ve başlangıçta yeniden doğrulanır.</p></header><div className={styles.planSummary}><div><span>İşlem</span><strong>{formatMode(preflight.plan.mode)}</strong></div><div><span>Platform</span><strong>{preflight.plan.platforms.map(formatPlatform).join(' + ')}</strong></div><div><span>Adım</span><strong>{preflight.plan.phaseCount}</strong></div><div><span>Gruplar</span><strong>{preflight.plan.distributionGroups.length}</strong></div></div>{preflight.warnings.map((warning) => <Alert key={warning.message} variant="warning">{warning.message}</Alert>)}{releaseRun.errorMessage !== null && <Alert variant="danger">{releaseRun.errorMessage}</Alert>}<footer><Button onClick={() => setStep(3)} variant="outline-secondary">Geri</Button><Button disabled={releaseRun.status === 'starting'} onClick={() => void releaseRun.start(preflight.plan.planId)}>{releaseRun.status === 'starting' ? 'Başlatılıyor…' : 'Pipeline’ı başlat'}</Button></footer></>
            )}
            {isRunStarted && (
              <><PipelineProgress activePhase={releaseRun.activePhase} completedPhases={releaseRun.completedPhases} isCancelling={releaseRun.status === 'cancelling'} logs={releaseRun.logs} onCancel={() => void releaseRun.cancel()} percent={releaseRun.percent} platform={releaseRun.platform} result={releaseRun.result} totalPhases={releaseRun.totalPhases} />{releaseRun.result !== null && <footer><Button onClick={onFinished}>Uygulama detayına dön</Button></footer>}</>
            )}
          </div>
        )}
      </section>
    </div>
  );
};
