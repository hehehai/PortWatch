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
pnpm install
pnpm run dev
pnpm run lint
pnpm run fmt:check
pnpm run verify:ports
pnpm run verify:windows-parser
pnpm run verify:release
```

Use these while developing:

```sh
pnpm run lint
pnpm run lint:fix
pnpm run fmt
pnpm run fmt:check
```

The Electron app reads listening TCP ports through native platform commands:

- macOS: `lsof` and `ps`
- Windows: PowerShell `Get-NetTCPConnection`, `Get-CimInstance`, and `taskkill.exe`

Preferences are stored through `electron-store` under the Electron `userData` directory as `preferences.json`. They include:

- selected refresh profile
- selected list item
- live and normal refresh intervals
- monitored port ranges

## Build

```sh
pnpm run build
```

The Codex Run action is wired to `script/run-electron.sh`, which launches the Electron Vite development app. Electron packaging uses a minimal staging directory and `pnpm run verify:release` asserts that legacy native project files are not included in macOS or Windows app artifacts.

## CI

`.github/workflows/electron.yml` runs the Electron verification matrix on `macos-14` and `windows-latest`:

- `oxlint`
- `oxfmt --check`
- native port command checks
- Windows parser and `taskkill.exe` argument fixtures
- Electron Vite build
- Velopack CLI preparation
- platform-specific Electron and Velopack packaging
- platform-specific release artifact verification

`.github/workflows/release.yml` is the production release pipeline. When you push a tag like `v0.1.0`, it:

- verifies the Git tag matches `package.json.version`
- builds macOS arm64 and Windows x64 release bundles
- signs the macOS app and installer, notarizes the macOS installer, and signs the Windows installer
- publishes Velopack assets to the GitHub Release for that tag
- writes the release URL, update feed URL, and uploaded asset list to the GitHub Actions job summary

## UI Components

UI primitives are installed through `shadcn-vue` into `src/renderer/src/components/ui`.

```sh
npx shadcn-vue@latest info --json
npx shadcn-vue@latest add button badge --yes --overwrite
```

## Package Electron Apps

Electron app bundles are generated from a minimal staging directory so build caches, Git metadata, screenshots, and other workspace files are not copied into the packaged app.

```sh
pnpm run app:mac
pnpm run app:win
```

If Electron downloads are slow or blocked, use a mirror:

```sh
ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ pnpm run app:mac
ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ pnpm run app:win
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

Packaged builds perform a silent startup check and, when a newer release is found, download it and stage it for apply-on-exit through Velopack.

Packaged apps can also read update config from:

- `portwatch-update.json` in Electron `userData`
- bundled `portwatch-update.json` in app resources

Use `Assets/portwatch-update.example.json` as the format reference. `Assets/portwatch-update.json` is ignored by Git and, when present, is copied into app resources during packaging. You can also inject it at package time:

```sh
PORTWATCH_UPDATE_URL=https://your-update-feed.example.com \
PORTWATCH_UPDATE_CHANNEL=stable \
pnpm run package:mac
```

The release workflow bakes in this GitHub-hosted update feed automatically:

```text
https://github.com/<owner>/<repo>/releases/latest/download
```

That means shipped apps fetch `RELEASES`, `releases.win.json`, `releases.osx.json`, installers, and `.nupkg` files directly from the latest GitHub Release.

Velopack release packaging requires the Velopack CLI `vpk` plus a .NET 8+ runtime. The helper script downloads the Velopack CLI NuGet package into `release/tools`:

```sh
pnpm run prepare:velopack
```

The packaging script resolves `vpk` in this order:

- `VPK_PATH`
- `vpk` in `PATH`
- `dnx vpk`
- local `release/tools/vpk-1.2.0/tools/net8.0/any/vpk.dll` through `DOTNET_PATH`, `DOTNET_ROOT`, Homebrew `dotnet@8`, or `release/tools/dotnet`

```sh
pnpm run package:mac
pnpm run package:win
```

On macOS, Windows Velopack releases are cross-compiled with Velopack's `[win]` directive. On non-macOS hosts, macOS releases use `[osx]`.

Outputs:

- macOS: `release/velopack/darwin-arm64/com.doit.PortWatch-osx-Setup.pkg`
- macOS portable: `release/velopack/darwin-arm64/com.doit.PortWatch-osx-Portable.zip`
- Windows: `release/velopack/win32-x64/com.doit.PortWatch-win-Setup.exe`
- Windows portable: `release/velopack/win32-x64/com.doit.PortWatch-win-Portable.zip`

If Electron downloads are slow or blocked, use:

```sh
ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ pnpm run package:mac
ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ pnpm run package:win
```

## Release

Production releases are tag-driven:

```sh
git tag v0.1.0
git push origin v0.1.0
```

The tag must match `package.json.version`, or `.github/workflows/release.yml` fails early.

Release assets are uploaded into the GitHub Release for that tag, and the GitHub Actions summary includes:

- the GitHub Release URL
- the baked-in update feed URL
- the final uploaded asset list

## GitHub Secrets

Configure these repository secrets before pushing a release tag.

Required for macOS signing and notarization:

- `MACOS_CERTIFICATE_P12_BASE64`: Developer ID Application certificate exported as `.p12`, then base64 encoded
- `MACOS_CERTIFICATE_PASSWORD`: password for the `.p12`
- `MACOS_KEYCHAIN_PASSWORD`: temporary keychain password used in GitHub Actions
- `MACOS_SIGN_IDENTITY`: usually `Developer ID Application: ...`
- `MACOS_INSTALLER_IDENTITY`: usually `Developer ID Installer: ...`
- `MACOS_NOTARY_API_KEY_P8_BASE64`: App Store Connect notarization API key `.p8`, base64 encoded
- `MACOS_NOTARY_API_KEY_ID`: App Store Connect key ID
- `MACOS_NOTARY_API_ISSUER`: App Store Connect issuer UUID

Required for Windows signing:

- `WINDOWS_CERTIFICATE_PFX_BASE64`: code signing certificate exported as `.pfx`, then base64 encoded
- `WINDOWS_CERTIFICATE_PASSWORD`: password for the `.pfx`

Optional GitHub repository variables:

- `WINDOWS_TIMESTAMP_SERVER`: defaults to `http://timestamp.digicert.com`
- `WINDOWS_SIGN_DESCRIPTION`: defaults to `PortWatch`
- `WINDOWS_SIGN_WEBSITE`: optional product URL embedded in the signature

Useful local environment variables for manual packaging:

- `PORTWATCH_UPDATE_URL`
- `PORTWATCH_UPDATE_CHANNEL`
- `PORTWATCH_CHANNEL`
- `PORTWATCH_APPLE_SIGN_IDENTITY`
- `PORTWATCH_APPLE_INSTALLER_IDENTITY`
- `PORTWATCH_APPLE_KEYCHAIN`
- `PORTWATCH_APPLE_NOTARY_API_KEY_PATH`
- `PORTWATCH_APPLE_NOTARY_API_KEY_ID`
- `PORTWATCH_APPLE_NOTARY_API_ISSUER`
- `WINDOWS_CERTIFICATE_FILE`
- `WINDOWS_CERTIFICATE_PASSWORD`
