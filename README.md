# XPlane Motion Controller — PowerShell overlay patch

This ZIP is an incremental patch for upstream commit
`9a4cb20ebcbec133d56ced5fe3c3f96b3e1be0f1`.

Unlike the previous Python-applied ZIP, it is installed with the earlier
**Expand-Archive + robocopy** PowerShell workflow. The included PowerShell
preparation step builds the updated existing files into the temporary
`payload` directory; this is necessary because the old ZIP only contained
new files and text replacement operations rather than modified files.

In PowerShell, after saving the ZIP to Downloads:

```powershell
cd 'E:\Personal_Project\xplane-motion-controller'
$zip = Join-Path $HOME 'Downloads\XPlane-Maturity-Overlay-Patch.zip'
$temp = Join-Path $env:TEMP ('xplane-maturity-' + [guid]::NewGuid().ToString('N'))
Expand-Archive -LiteralPath $zip -DestinationPath $temp
& (Join-Path $temp 'prepare-overlay.ps1') -Repository (Get-Location).Path -Overlay (Join-Path $temp 'payload')
if ($LASTEXITCODE -and $LASTEXITCODE -ge 8) { throw 'Preparation failed.' }
robocopy (Join-Path $temp 'payload') (Get-Location).Path /E /R:1 /W:1
if ($LASTEXITCODE -ge 8) { throw 'Patch copy failed.' }
git status -sb
git diff --check
```

Note: the preparation step fails closed if HEAD is different or tracked files
have local changes. It writes only to the temporary overlay. If preparation
fails, **do not run `robocopy`**. PowerShell exceptions stop execution when
run in separate steps or with `$ErrorActionPreference = 'Stop'`.

Run build and tests before committing:

```powershell
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
cmake -S native/xplane-plugin -B native/xplane-plugin/build -DBUILD_TESTING=ON
cmake --build native/xplane-plugin/build --config Release
ctest --test-dir native/xplane-plugin/build -C Release --output-on-failure
```

This patch does not contain `.git`, `.env`, certificates, or any full existing
repository snapshot. It never uses `/MIR`, history rewrite, or deletes any
existing file. It is not a simulator-tested certification of 100/100 maturity.
