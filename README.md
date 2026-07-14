# LaunchDeck

LaunchDeck, Android ve iOS release artifact’larını hazırlamak ve Firebase App Distribution’a göndermek için geliştirilmiş güvenli bir Electron masaüstü uygulamasıdır. Ürün dili Türkçedir.

## Temel akış

1. Uygulama açılışında Doctor, sistem Firebase CLI kurulumunu doğrular.
2. İlk kurulumda Service Account JSON, mobil proje klasörleri ve Google Services dosyaları seçilir.
3. İsteğe bağlı build/upload öncesi veya sonrası komutlar; çalıştırılabilir dosya, argüman dizisi ve çalışma klasörü olarak eklenir.
4. Release sihirbazında işlem modu ve platform seçilir.
5. Main process preflight ile araçları, yolları, credential erişimini, artifact beklentilerini ve platform desteğini tekrar doğrular.
6. Pipeline faz-temelli yüzde, son 500 maskeli log satırı ve platform sonuçlarıyla izlenir.
7. Son 10 release metadata kaydı SQLite’ta tutulur; daha eski kayıtlar migration ile kurulan trigger tarafından otomatik silinir.

## Platform desteği

| İşletim sistemi | Android | iOS |
| --- | --- | --- |
| macOS | Desteklenir | Desteklenir |
| Windows | Desteklenir | Desteklenmez |
| Linux | Desteklenir | Desteklenmez |

iOS seçimi macOS dışındaki sistemlerde renderer ve main process tarafından ayrı ayrı engellenir.

## Gereksinimler

- Node.js 22.12 veya üzeri
- Firebase CLI (`npm install -g firebase-tools`)
- Android için proje klasöründe çalıştırılabilir Gradle wrapper
- iOS için macOS, Xcode Command Line Tools, geçerli scheme ve otomatik signing yapılandırması
- Firebase App Distribution erişimi olan Service Account JSON
- Linux’ta Service Account yolunu şifrelemek için Secret Service veya KWallet

Doctor, Firebase CLI eksikken ana uygulama alanına geçişe izin vermez. Xcode eksikliği Android kullanımını engellemez, iOS’u sınırlı olarak işaretler.

## Kurulum

```bash
npm install
npm run dev
```

`postinstall`, `better-sqlite3` native modülünü kullanılan Electron sürümüyle yeniden bağlar. npm install-script allowlist’i paket ve sürüm bazında `package.json` içinde tanımlıdır.

## Komutlar

| Komut | Amaç |
| --- | --- |
| `npm run dev` | Electron geliştirme instance’ını açar |
| `npm run typecheck` | Main, preload, shared ve renderer TypeScript sözleşmelerini statik kontrol eder |
| `npm run build` | Üretim JavaScript çıktılarını üretir |
| `npm run package` | Paketlenmemiş uygulama klasörü üretir |
| `npm run dist` | Platform dağıtım paketini üretir |

Üretim build’lerinde source map kapalıdır. Main, preload ve renderer JavaScript chunk’ları minification sonrasında production-only obfuscation işleminden geçer. Obfuscation bir güvenlik sınırı değildir; gerçek sınırlar Electron sandbox, context isolation, dar preload API’si, doğrulanan IPC ve main-process sahipliğidir.

## SQLite schema yönetimi

Veritabanı Electron `userData/database/launchdeck.db` altında oluşturulur. Schema değişiklikleri sıralı migration modülleriyle yönetilir:

```text
src/main/database/
├── index.ts
└── migrations/
    ├── 001_initial.ts
    └── index.ts
```

Uygulanan migration’lar `schema_migrations` tablosunda sürüm ve zaman bilgisiyle kayıtlıdır. Migration’lar transaction içinde çalışır. Temel tablolar:

- `applications`: kalıcı uygulama ve platform yapılandırması
- `pipeline_hooks`: güvenli argüman dizili özel fazlar
- `release_runs`: en fazla 10 metadata sonucu; raw log içermez
- `settings`: tema tercihi

Service Account içeriği hiçbir zaman SQLite’a yazılmaz. Dosya yolu Electron `safeStorage` ile şifrelenir; güvenli backend yoksa düz metin fallback yapılmaz ve kurulum durdurulur.

## Güvenlik modeli

- Renderer’da Node.js veya Electron erişimi yoktur.
- `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true` zorunludur.
- Preload yalnız isimlendirilmiş ve typed kullanım senaryolarını açar; generic `invoke`, `send`, filesystem veya child-process API’si açmaz.
- IPC gönderen ana frame ve beklenen origin/protokol üzerinden doğrulanır; payload’lar Zod ile yeniden kontrol edilir.
- Child process çağrıları executable + argüman dizisiyle ve kontrollü environment ile çalışır.
- Kullanıcı komutları shell metni değildir. Çalıştırılabilir dosya, her satırı ayrı argüman ve seçilmiş çalışma klasörü saklanır.
- Windows Gradle batch zorunluluğu izole `cmd.exe` adaptöründe allowlist task ve sabit flag’lerle ele alınır.
- Credential yolu ve bilinen secret desenleri loglar renderer’a geçmeden maskelenir.
- Aktif release işi, process handle ve iptal denetimi main process’e aittir.
- Android ve iOS sonuçları bağımsızdır; kısmi başarı ayrı bir terminal sonuçtur.

## Pipeline ilerlemesi

Yüzde geçen süreden tahmin edilmez. Preflight planındaki toplam doğrulanmış faz sayısı ile tamamlanan faz sayısının oranıdır. Bir Gradle, Xcode veya Firebase CLI komutu çalışırken aktif faz gösterilir; yalnız süreç başarılı çıktıktan ve gerekli artifact doğrulandıktan sonra adım tamamlanmış sayılır.

## Uygulama ikonları

- `resources/launch-icon.png`: üretim ve paketleme ikonu
- `resources/dev-icon.png`: geliştirme kanalı ikonu
- `src/renderer/assets/`: renderer kopyaları

İkonlar LaunchDeck için özgün üretilmiştir; Firebase veya Google marka işaretlerini kopyalamaz.
