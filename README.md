# LaunchDeck

LaunchDeck is a secure Electron desktop application for preparing signed Android and iOS release artifacts and distributing them through Firebase App Distribution, Google Play, and App Store Connect. The product language is English (US).

## Core workflow

1. At startup, Doctor reports optional distribution tools and platform capabilities. A missing Firebase CLI does not block artifact or store workflows.
2. During initial setup, the user enables artifact generation, Firebase App Distribution, and/or Store Distribution. Only the matching configuration panels open.
3. Optional commands can run before or after build and upload phases. Each command stores an executable file, an argument array, and a working directory.
4. The release wizard collects the operation mode, platforms, and manual release version values. Patch, Android version code, and iOS build number can be incremented independently.
5. The main process preflight validates tools, paths, credential access, writable project version files, artifact expectations, and platform support again.
6. Before pre-build commands run, the confirmed version permanently updates the Android module `build.gradle(.kts)` and Xcode `project.pbxproj` files.
7. Android signing uses an encrypted keystore path, alias, and encrypted passwords; Gradle and the Android Gradle Plugin sign APK and AAB artifacts during the build, matching Android Studio, then `apksigner` or `jarsigner` verifies the generated artifact.
8. iOS uses Xcode automatic signing with a configured development team, verifies the archived app with `codesign`, and can upload through an App Store Connect `.p8` API key.
9. Google Play uploads are committed to internal testing first and may be promoted through a separately configured second edit.
10. The pipeline displays phase-based progress, up to 500 redacted log lines, and per-platform outcomes.
11. SQLite stores metadata for the 10 most recent releases. A migration-installed trigger removes older records automatically.

## Platform support

| Operating system | Android | iOS |
| --- | --- | --- |
| macOS | Supported | Supported |
| Windows | Supported | Not supported |
| Linux | Supported | Not supported |

iOS selection is blocked independently by both the renderer and the main process on non-macOS systems.

## Requirements

- Node.js 22.12 or later
- Firebase CLI (`npm install -g firebase-tools`) only when Firebase App Distribution is enabled
- An executable Gradle wrapper in the Android project directory
- macOS, Xcode Command Line Tools, a valid scheme, and automatic signing for iOS
- A Firebase service account JSON when Firebase distribution is enabled
- A JDK and Android SDK build-tools when LaunchDeck-managed Android signing is enabled
- A Google Play service account granted Android Publisher access when Google Play distribution is enabled
- An App Store Connect API `.p8` key, key ID, issuer ID, and Xcode signing team when App Store distribution is enabled
- Secret Service or KWallet to encrypt the service account path on Linux

Missing optional tools do not block unrelated workflows. Missing Xcode tools do not block Android use; they mark iOS support as limited.

## Setup

```bash
npm install
npm run dev
```

The `postinstall` script rebuilds the native `better-sqlite3` module for the installed Electron version. The npm install-script allowlist is defined by package and version in `package.json`.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Opens the Electron development instance |
| `npm run typecheck` | Statically checks the main, preload, shared, and renderer TypeScript contracts |
| `npm run build` | Produces production JavaScript output |
| `npm run package` | Produces an unpacked application directory |
| `npm run dist` | Produces the platform distribution package |

Source maps are disabled in production builds. Main, preload, and renderer JavaScript chunks receive production-only obfuscation after minification. Obfuscation is not a security boundary; the actual boundaries are Electron sandboxing, context isolation, the narrow preload API, validated IPC, and main-process ownership.

## SQLite schema management

The database is created at `userData/database/launchdeck.db`. Ordered migration modules manage schema changes:

```text
src/main/database/
├── index.ts
└── migrations/
    ├── 001_initial.ts
    └── index.ts
```

Applied migrations are recorded in the `schema_migrations` table with version and timestamp information. Migrations run inside transactions. Core tables:

- `applications`: persistent application and platform configuration
- `pipeline_hooks`: custom phases with safe argument arrays
- `release_runs`: metadata for up to 10 outcomes; contains no raw logs
- `settings`: theme preference

Service account contents are never written to SQLite. Electron `safeStorage` encrypts the file path. If no secure backend is available, LaunchDeck does not fall back to plain text and setup stops.

## Security model

- The renderer has no Node.js or Electron access.
- `nodeIntegration: false`, `contextIsolation: true`, and `sandbox: true` are required.
- Preload exposes only named, typed use cases; it does not expose generic `invoke`, `send`, filesystem, or child-process APIs.
- IPC senders are verified against the main frame and expected origin or protocol. Zod validates payloads again.
- Child processes run with an executable, an argument array, and a controlled environment.
- User commands are not shell text. LaunchDeck stores an executable file, one argument per line, and a selected working directory.
- The Windows Gradle batch requirement is isolated in a `cmd.exe` adapter with allowlisted tasks and fixed flags.
- Credential paths and known secret patterns are redacted before logs reach the renderer.
- The main process owns the active release job, process handles, and cancellation control.
- Android and iOS outcomes are independent; partial success is a distinct terminal outcome.

## Pipeline progress

Progress is not estimated from elapsed time. It is the ratio between completed phases and the total verified phase count in the preflight plan. The active phase remains visible while a Gradle, Xcode, or Firebase CLI command runs. A step is marked complete only after the process succeeds and the required artifact is verified.

## Application icons

- `resources/launch-icon.png`: production and packaging icon
- `resources/dev-icon.png`: development channel icon
- `src/renderer/assets/`: renderer copies

The icons were created specifically for LaunchDeck and do not reproduce Firebase or Google brand marks.
