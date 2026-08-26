# Desktop release process

SooKool Agent Helper publishes stable desktop updates through GitHub Releases. The installed
application checks the public release feed, downloads a newer signed build in the background,
and installs it only after the user chooses **Restart and Install**.

## One-time repository setup

Configure these GitHub Actions secrets before creating a release tag:

- `MAC_CSC_LINK` and `MAC_CSC_KEY_PASSWORD`: Developer ID Application certificate.
- `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, and `APPLE_TEAM_ID`: Apple notarization account.
- `WIN_CSC_LINK` and `WIN_CSC_KEY_PASSWORD`: Windows Authenticode certificate.

The public GitHub update feed does not require a token on user devices. `GITHUB_TOKEN` is used
only inside the release workflow to upload verified artifacts.

## Publish a stable version

1. Update `package.json` and `package-lock.json` to the intended semantic version.
2. Run `npm run typecheck`, `npm test`, and `npm run build`.
3. Merge the release commit, then create and push an exactly matching tag such as `v0.0.2`.
4. Wait for the **Release desktop app** workflow to finish.
5. Confirm the GitHub Release contains signed macOS x64/arm64 DMG and ZIP files, the signed
   Windows x64 NSIS installer, blockmaps, `latest-mac.yml`, and `latest.yml`.
6. Upgrade one previously installed macOS build and one Windows build before announcing the
   release broadly.

Never replace artifacts on an existing release or reuse a version tag. Withdraw a bad release
and publish a higher fix-forward version instead of attempting a downgrade.

The first release containing the updater is the bootstrap release: versions installed before it
cannot discover updates automatically and must be upgraded once through the normal installer.
