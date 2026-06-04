# PortWatch

PortWatch is an Electron Vite + Vue + TypeScript desktop app for macOS and Windows.

The Electron app includes:

- Listening TCP port discovery on macOS and Windows
- Live and normal refresh modes
- Persistent refresh interval and monitored port range settings
- Process termination
- macOS menu bar / Windows tray icon
- Velopack update checks and install handoff

## Development

```sh
npm install
npm run dev
npm run verify:ports
npm run verify:windows-parser
npm run verify:release
```

The Electron app reads listening TCP ports through native platform commands:

- macOS: `lsof` and `ps`
- Windows: PowerShell `Get-NetTCPConnection`, `Get-CimInstance`, and `taskkill.exe`

Preferences are stored under the Electron `userData` directory as `preferences.json`. They include:

- selected refresh profile
- live and normal refresh intervals
- monitored port ranges

## Build

```sh
npm run build
```

The Codex Run action is wired to `script/run-electron.sh`, which launches the Electron Vite development app. Electron packaging uses a minimal staging directory and `npm run verify:release` asserts that legacy native project files are not included in macOS or Windows app artifacts.

## CI

`.github/workflows/electron.yml` runs the Electron verification matrix on `macos-14` and `windows-latest`:

- native port command checks
- Windows parser and `taskkill.exe` argument fixtures
- Electron Vite build
- Velopack CLI preparation
- platform-specific Electron and Velopack packaging
- platform-specific release artifact verification

## UI Components

UI primitives are installed through `shadcn-vue` into `src/renderer/src/components/ui`.

```sh
npx shadcn-vue@latest info --json
npx shadcn-vue@latest add button badge --yes --overwrite
```

## Package Electron Apps

Electron app bundles are generated from a minimal staging directory so build caches, Git metadata, screenshots, and other workspace files are not copied into the packaged app.

```sh
npm run app:mac
npm run app:win
```

If Electron downloads are slow or blocked, use a mirror:

```sh
ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ npm run app:mac
ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ npm run app:win
```

Outputs:

- macOS: `release/app/PortWatch-darwin-arm64/PortWatch.app`
- Windows: `release/app/PortWatch-win32-x64/PortWatch.exe`

## Velopack

Runtime update support is wired through the `velopack` npm package. Enable update checks by setting:

```sh
PORTWATCH_UPDATE_URL=https://your-update-feed.example.com
PORTWATCH_UPDATE_CHANNEL=stable # optional
```

Packaged apps can also read update config from:

- `portwatch-update.json` in Electron `userData`
- bundled `portwatch-update.json` in app resources

Use `Assets/portwatch-update.example.json` as the format reference. `Assets/portwatch-update.json` is ignored by Git and, when present, is copied into app resources during packaging. You can also inject it at package time:

```sh
PORTWATCH_UPDATE_URL=https://your-update-feed.example.com \
PORTWATCH_UPDATE_CHANNEL=stable \
npm run package:mac
```

Velopack release packaging requires the Velopack CLI `vpk` plus a .NET 8+ runtime. The helper script downloads the Velopack CLI NuGet package into `release/tools`:

```sh
npm run prepare:velopack
```

The packaging script resolves `vpk` in this order:

- `VPK_PATH`
- `vpk` in `PATH`
- `dnx vpk`
- local `release/tools/vpk-1.2.0/tools/net8.0/any/vpk.dll` through `DOTNET_PATH`, `DOTNET_ROOT`, Homebrew `dotnet@8`, or `release/tools/dotnet`

```sh
npm run package:mac
npm run package:win
```

On macOS, Windows Velopack releases are cross-compiled with Velopack's `[win]` directive. On non-macOS hosts, macOS releases use `[osx]`.

Outputs:

- macOS: `release/velopack/darwin-arm64/com.doit.PortWatch-osx-Setup.pkg`
- macOS portable: `release/velopack/darwin-arm64/com.doit.PortWatch-osx-Portable.zip`
- Windows: `release/velopack/win32-x64/com.doit.PortWatch-win-Setup.exe`
- Windows portable: `release/velopack/win32-x64/com.doit.PortWatch-win-Portable.zip`

If Electron downloads are slow or blocked, use:

```sh
ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ npm run package:mac
ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ npm run package:win
```

The generated release packages are currently unsigned and not notarized unless signing identities and notarization options are supplied to Velopack. See the Velopack packaging docs: https://docs.velopack.io/packaging/overview
