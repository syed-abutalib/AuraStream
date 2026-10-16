# AuraStream

A complete local music streaming application built with **React, C++17, Drogon and XAMPP MariaDB**. Real MP3 playback and downloads, database-backed accounts and collections, and a custom C++ doubly linked playback queue.

## Start on this computer

The dependencies and Release executable have been built. Start **MySQL** in XAMPP, then run these commands in separate PowerShell terminals from this folder:

```powershell
.\scripts\start-backend.ps1
```

```powershell
.\scripts\start-frontend.ps1
```

Open **http://localhost:5173**. Backend health: **http://localhost:8080/api/health**. Database administration: **http://localhost/phpmyadmin** (requires Apache as well as MySQL).

If Windows blocks local scripts, invoke the individual script using `powershell -ExecutionPolicy Bypass -File .\scripts\start-backend.ps1`; this does not change the machine's execution policy. Use the same form for the other scripts.

Do not browse the project through Apache's `htdocs` URL. `.htaccess` deliberately prevents Apache from exposing the C++ source and local configuration. Vite serves the interface and proxies `/api` to Drogon. PHP implements no application APIs.

## Create the first administrator

1. Open AuraStream and register your own account with a strong password.
2. From the repository root, run:

   ```powershell
   .\scripts\start-backend.ps1 -InitAdmin YOUR_USERNAME
   ```

3. Sign out and sign back in. Open **Admin dashboard → Music catalog → Upload track**.
4. Upload a real MP3 you own or have permission to share. Add title, artist, album, genre and an optional PNG/JPEG/WebP cover. The browser reads duration automatically; verify it before saving.
5. Enable downloads only if your permission includes distributing the file.

No default passwords, permanent setup token, public admin creation endpoint or automatic promotion exists. The CLI refuses to initialize another admin after the first exists. Further role changes use the authorized admin dashboard; an admin cannot demote themselves or remove the final administrator.

## Database and settings

The original eight tables are used directly. **No migration is needed; no existing tables or records are replaced.** The application does not seed or alter the schema on startup. `database/schema.sql` is a non-destructive structure-only reference for a fresh database, not a required import into your existing database.

Copy `backend/.env.example` to the ignored `backend/.env` if settings differ. Process environment variables take precedence. Always launch from the repository root (the provided scripts do this).

| Setting | Local default |
| --- | --- |
| `DB_HOST` | `127.0.0.1` |
| `DB_PORT` | `3306` |
| `DB_NAME` | `aurastream` |
| `DB_USER` | `root` |
| `DB_PASSWORD` | empty |
| `DB_LOCAL_NO_TLS` | `true`, honored only for loopback hosts |
| `PORT` | `8080` |
| `APP_ORIGIN` | `http://localhost:5173` |
| `UPLOAD_ROOT` | `backend/uploads` relative to repository root |
| `COOKIE_SECURE` | `false` for local HTTP |

Use `localhost:5173` consistently. If you intentionally use `127.0.0.1:5173`, also set `APP_ORIGIN=http://127.0.0.1:5173` and restart the backend. Cookies belong to their host.

The current MariaDB client defaults to requiring TLS, while this XAMPP installation has no TLS listener. The backend sets the connector's compatibility environment option **inside its own process and only for a loopback database host**. Set `DB_LOCAL_NO_TLS=false` for a TLS-enabled database; remote connections do not receive this compatibility exception. See [MariaDB connector TLS documentation](https://mariadb.com/docs/connectors/mariadb-connector-c/api-functions/mysql_optionsv).

For a clean machine, create the `aurastream` database in phpMyAdmin with `utf8mb4_general_ci`, then import `database/schema.sql`. On this machine it already exists. Media stays on disk in `backend/uploads/songs` and `backend/uploads/covers`; MySQL stores generated filename references and relational records.

## Install and build on Windows 10/11

1. Install [Visual Studio Build Tools 2022](https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022). Select **Desktop development with C++**, MSVC v143, and Windows 10/11 SDK.
2. Install [CMake](https://cmake.org/download/) 3.24 or newer and add it to PATH.
3. Install [Git for Windows](https://git-scm.com/download/win).
4. Install [Node.js](https://nodejs.org/) 22.12+ or 24 LTS with npm. Node is used for frontend tooling and tests, not the server.
5. Install/start XAMPP MySQL and verify the database connection above.
6. Open PowerShell in this repository and run:

   ```powershell
   .\scripts\setup.ps1
   ```

The script checks prerequisites, downloads vcpkg, uses the committed dependency baseline, builds Drogon with MySQL support and libsodium, compiles the API, runs C++ tests, installs locked npm packages and builds React. The initial native dependency build can take several minutes. Subsequent builds reuse cached dependencies.

Manual native commands:

```powershell
git clone https://github.com/microsoft/vcpkg.git .tools/vcpkg
git -C .tools/vcpkg checkout 0699a19d0c6386247ce50d4dedbb8217d484d536
.\.tools\vcpkg\bootstrap-vcpkg.bat -disableMetrics
cmake -S . -B build -A x64 "-DCMAKE_TOOLCHAIN_FILE=$PWD/.tools/vcpkg/scripts/buildsystems/vcpkg.cmake" "-DVCPKG_INSTALLED_DIR=$PWD/vcpkg_installed"
cmake --build build --config Release --parallel 4
.\build\backend\Release\aurastream.exe
```

The manifest resolves Drogon 1.9.13, MariaDB Connector/C 3.4.11 and libsodium 1.0.22 at the pinned baseline. Versions are reproducible through `vcpkg.json` and `frontend/package-lock.json`. DLLs are copied beside the executable by vcpkg integration. See [Drogon's installation documentation](https://github.com/drogonframework/drogon/wiki/ENG-02-Installation) and [vcpkg documentation](https://learn.microsoft.com/vcpkg/).

## Features

- Argon2id registration/login; HttpOnly, SameSite cookies; logout, expiry, password rotation, profile and avatar updates.
- Catalog searches title/artist/album/genre, genre filters, stable sorting and pagination. Catalog data always comes from C++ APIs.
- Persistent HTML5 Audio player with seek, volume, mute, next/previous, repeat, shuffle and session queue management.
- Public/private playlists with ownership checks, CRUD, cover uploads, ordering and total duration.
- Favorites, listening history, followed artists, authorized downloads and download history.
- Admin statistics, MP3 and artwork uploads, metadata edits, song deletion, user search and role/tier management.
- Responsive dark interface, accessible labels, dialog focus, keyboard focus indicators, loading/error/empty states and notifications.
- Free accounts allow 20 playlists; premium accounts allow 200. Both have full playback and permitted downloads. Tiers demonstrate C++ runtime polymorphism, with no billing system.

## Testing

```powershell
ctest --test-dir build -C Release --output-on-failure
cd frontend
npm test
npm run build
npm audit
npm run test:integration
```

Integration tests require XAMPP root access, the built executable, Google Chrome and free ports 8081/5174. They create a uniquely named `aurastream_test_<timestamp>` database, run the **real C++ server**, generate a real original MP3 test tone, exercise APIs and browser controls, save screenshots and a report under ignored `test-results/`, then remove only their own test database. They never alter `aurastream`. Temporary uploaded test files remain under `test-results/` for inspection. Set `MYSQL_BIN` if the XAMPP client is not at `C:/xampp/mysql/bin/mysql.exe`.

The original MP3 test tone contains no third-party music. The FFmpeg npm package is development-only and is not used to serve music. Tests use actual media decoding and range requests, not mocked APIs or timers. See [verification notes](docs/testing.md).

## Project map

```text
frontend/
  src/components/       Shared cards, tables, dialogs and player
  src/contexts/         Authentication, favorites, playlists and audio state
  src/hooks/            API resource loading
  src/layouts/          Sidebar, topbar and persistent layout
  src/pages/            Auth, library, playlist, profile and admin screens
  src/services/         HTTP client and download helpers
  tests/                Unit and real browser/API integration tests
backend/
  include/models/       User inheritance, Song, Playlist, C++ algorithms
  include/datastructures/ Custom doubly linked list and queue
  include/repositories/ Database and repository interfaces
  include/services/     Service interfaces and synchronized sessions
  src/controllers/      HTTP routing, input and access validation
  src/repositories/     Parameterized SQL and transactional persistence
  src/services/         Auth, media, queue and application behavior
  src/main.cpp          Environment, workers, database and server startup
  tests/                C++ data structure and model tests
  uploads/              Real audio and artwork files, ignored by Git
database/               Original schema snapshot and migration notes
scripts/                Windows setup and startup helpers
docs/                   Architecture, API, OOP, data structures and viva
```

## Practical boundaries

This is a localhost university application. Sessions, rate limits and playback queues are in memory: restarting C++ signs users out and clears their queues. Their playlists, favorites, history, downloads, profiles and songs remain in MySQL. Sessions expire after 12 hours. The queue holds at most 500 unique songs; “Play all” uses the currently loaded page, or all playlist songs up to that queue limit. The academic algorithm endpoint works on the 500 newest catalog entries; normal search uses the paginated database query.

Downloads are normal browser file downloads, not offline browser storage. Counts record authorized successful file-response preparation, not proof that the listener saved every byte. There is no subscription payment, external music provider, AI recommendation claim, email verification or password-reset email service. An empty catalog is intentional until an admin uploads licensed audio.

Do not expose the local root-with-no-password database configuration to the internet. A public deployment would need HTTPS, a least-privilege database user, durable distributed session/rate-limit storage, operational monitoring and a production reverse proxy. The checked-in configuration binds the API and Vite to loopback.

## Troubleshooting

- **Database unavailable:** start XAMPP MySQL; verify host, port and `DB_NAME`; ensure no other MySQL installation occupies 3306.
- **Login says origin is not permitted:** use `http://localhost:5173`, or match `APP_ORIGIN` to the exact frontend origin and restart C++.
- **Port already in use:** stop the earlier AuraStream server/terminal. Vite may otherwise move to 5174, which also requires updating `APP_ORIGIN`.
- **Native compile fails:** check Desktop C++ Build Tools and SDK installation. Run setup from a Developer PowerShell if CMake cannot locate MSVC.
- **DLL missing:** rebuild with the vcpkg toolchain; run the executable inside its Release directory with its adjacent DLLs, using the root-working-directory script.
- **Missing audio:** metadata and files must be backed up together. A missing file returns 404 rather than exposing another path.
- **Unsupported upload:** only MP3, PNG, JPEG and WebP are supported. Files need valid signatures; limits are 30 MB audio and 5 MB image.
- **Backend dies after configuration edits:** `.env` values are unquoted `KEY=value` lines. Do not put quotes around the password value; spaces inside values are retained after trimming outer whitespace.
- **Apache returns 403 for this folder:** intentional source protection. Use the Vite URL, not the htdocs URL.

## Academic documentation

Read [architecture](docs/architecture.md), [API reference](docs/api.md), [OOP concepts](docs/oop-concepts.md), [data structures](docs/data-structures.md), [updated project description](docs/project-description.md) and [viva preparation and demonstration](docs/viva-preparation.md).
