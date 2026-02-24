# INERTIA Release Workflow (Beginner Guide)

This is the exact process to follow every time you ship updates.

---

## 0) What each repo/folder is for

- `hotel-manager` (this project): app source code, build scripts, Tauri app.
- `inertia-pos-releases` (GitHub): release files users download/update from.
- `inertia-keygen` (private local folder): your license key generator tool. Keep private.

---

## 1) One-time setup (already done once)

1. Generate updater signing key (already done):
   - Private key: `C:\Users\DELL\.tauri\inertia.key`
   - Public key is already added in `src-tauri/tauri.conf.json`

2. Confirm updater endpoint works:
   - `https://github.com/Haiderali27-hub/inertia-pos-releases/releases/latest/download/latest.json`

3. Keep release repo public (or updater cannot fetch assets without auth).

---

## 2) Versioning rules (important)

Use Semantic Versioning:

- **Patch** (`1.0.0` → `1.0.1`): bug fixes only.
- **Minor** (`1.0.0` → `1.1.0`): new features, still same major.
- **Major** (`1.x` → `2.0.0`): breaking changes and paid upgrade cycle.

License policy in your app:
- Same major version: existing paid key keeps working.
- New major version: customers need new major key.

---

## 3) Daily dev workflow (bug fix or feature)

1. Make code changes in `hotel-manager`.
2. Run app locally and test your change.
3. If bug fix: pick next patch version.
4. If new feature: pick next minor version.
5. Build signed release.
6. Upload release assets.
7. Verify updater works from previous installed version.

---

## 4) Build a signed release (exact commands)

Open PowerShell in `C:\Users\DELL\Desktop\hotel-manager`.

### A) Set signing env vars

```powershell
$env:TAURI_SIGNING_PRIVATE_KEY = "C:\Users\DELL\.tauri\inertia.key"
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = "haider1234"
```

### B) Run build script

For bug-fix release:

```powershell
.\scripts\build-release.ps1 -Version "1.0.1" -Notes "Bug fixes and improvements"
```

For feature release:

```powershell
.\scripts\build-release.ps1 -Version "1.1.0" -Notes "Added new feature X"
```

### C) Expected output files

After success, you will have:

- Installer: `src-tauri\target\release\bundle\nsis\INERTIA_<version>_x64-setup.exe`
- Updater package: `src-tauri\target\release\bundle\nsis\INERTIA_<version>_x64-setup.nsis.zip`
- Manifest: `scripts\latest.json`

---

## 5) Publish release on GitHub (exact process)

1. Open:
   - `https://github.com/Haiderali27-hub/inertia-pos-releases/releases/new`

2. Fill release form:
   - Tag: `v<version>` (example: `v1.0.1`)
   - Title: `Release v<version>`
   - **Do not** mark as pre-release (unless intentionally testing)

3. Upload 3 assets:
   - `INERTIA_<version>_x64-setup.exe`
   - `INERTIA_<version>_x64-setup.nsis.zip`
   - `latest.json`

4. Publish release.

5. Verify latest manifest URL downloads:
   - `https://github.com/Haiderali27-hub/inertia-pos-releases/releases/latest/download/latest.json`

---

## 6) Verify auto-update (end-to-end)

1. Install older app version (example `1.0.0`).
2. Publish newer version (example `1.0.1`) using steps above.
3. Open installed older app.
4. App should detect update and prompt/install.
5. Confirm app now runs on new version.

---

## 7) License key workflow (when customer pays)

Use private folder `C:\Users\DELL\Desktop\inertia-keygen`.

### Generate key for customer

```powershell
cd C:\Users\DELL\Desktop\inertia-keygen
node generate-key.cjs "Customer Business Name" 1
```

- Send generated key to customer.
- Key issue gets logged in `sales-log.json`.

### Validate any key

```powershell
node generate-key.cjs --validate "INERTIA-V1-..."
```

### For major upgrade keys (example V2)

```powershell
node generate-key.cjs "Customer Business Name" 2
```

---

## 8) Major upgrade workflow (when you release v2)

1. In code, set app major to 2 (`license.rs` major constant).
2. Build and publish `2.0.0` like normal.
3. Existing V1 customers will be asked for upgraded license.
4. After payment, generate V2 keys from keygen folder and send them.

---

## 9) Trial banner behavior (normal)

- New install without license key: trial banner appears.
- After trial expires: paywall appears.
- Enter valid key: app unlocks.

This means your licensing system is working as designed.

---

## 10) Common errors and quick fixes

### Error: `Invalid target_commitish parameter`
- Cause: release repo had no first commit.
- Fix: create `README.md` once in release repo.

### Error: latest URL gives `Not Found`
- Cause: latest release marked as pre-release.
- Fix: edit release and uncheck pre-release.

### Error: signature file missing
- Cause: signing env vars not set correctly or updater artifacts disabled.
- Fix: use path in env var and keep `createUpdaterArtifacts` enabled.

### Error: key path not found
- Correct path is:
  - `C:\Users\DELL\.tauri\inertia.key`
  - (not `C:\Users\DELL.tauri\...`)

---

## 11) Release checklist (copy each time)

- [ ] Code tested locally
- [ ] Version decided (`patch` or `minor`)
- [ ] Signed build completed
- [ ] `.exe`, `.nsis.zip`, `latest.json` generated
- [ ] GitHub release created (`vX.Y.Z`)
- [ ] Assets uploaded (all 3)
- [ ] Manifest URL downloads successfully
- [ ] Old install confirms auto-update

---

## 12) Security rules (do not skip)

- Never share or upload `C:\Users\DELL\.tauri\inertia.key`
- Keep `inertia-keygen` private
- Do not commit secrets to GitHub
- Keep release repo for build artifacts only
