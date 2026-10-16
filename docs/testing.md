# Verification report

Verified on **9 October 2026** in the supplied Windows/XAMPP environment.

## Build and test results

| Check | Result |
| --- | --- |
| MSVC 2022 C++17 Release build | Passed with Drogon/MySQL and libsodium linked |
| CTest native queue/model suite | Passed: 1 executable containing all structure/algorithm/model checks |
| Frontend production build | Passed with Vite 7.3.7 |
| Vitest | Passed: 2 tests covering player time boundaries and media URL construction |
| Frontend formatting check (`npm run lint`) | Passed; this command checks Prettier formatting, not a semantic ESLint analysis |
| npm dependency audit | 0 reported vulnerabilities at verification time |
| C++/MariaDB/API/browser integration suite | **63 checks passed** |
| Browser uncaught application errors | 0 during the tested journeys |
| Mobile width | No horizontal overflow at 390 × 844 |
| Desktop/mobile visual inspection | Home, expanded player and admin dashboard screenshots reviewed |
| Normal API health | Connected to the original XAMPP `aurastream` database |
| Apache source protection | Project `.env.example` request returned 403 |
| Original database preservation | Original eight-table schema retained; original users/songs remain empty |

The integration suite uses a uniquely named, isolated MySQL schema and a separate C++ process on 8081. Its Vite test instance runs on 5174. The test creates and removes only its own schema; the normal `aurastream` database is not used for test writes. Test files/logs/screenshots and the machine-readable report are stored under ignored `test-results/`.

## What the 63 checks cover

- C++ executable and a live XAMPP database connection.
- Protected routes; invalid signup; duplicate identities; non-admin denial; actual Argon2id hashes; secure first-admin initialization; self-demotion safeguards.
- Real MP3 upload; profile-image persistence and serving; rejection of non-audio and active image content.
- SQL search/sort and pagination; the operational C++ algorithm endpoint.
- Exact byte-range and suffix responses; invalid ranges; missing songs/files; database path traversal rejection.
- C++ next/previous navigation, exhaustion, isolated queues and rejected queue mutations preserving prior state.
- Playback history deduplication; persistent/idempotent favorites; playlist CRUD, ordering, privacy and public viewing; canonical artist follows.
- Authorized MP3 attachments, denied download permission, and transactional history/counter updates.
- Mutation header/origin checks; persisted profile edits; logout/login; password-change revocation; tier polymorphism; authentication rate limiting.
- Actual Chrome login, MP3 decoding, play/pause, seeking, volume, route-persistent audio, queue next, shuffle and repeat-all.
- Browser playlist creation, mobile navigation, expanded player, like/unlike synchronization and browser MP3 download.
- Admin browser statistics, multipart upload, metadata edit, confirmed deletion and account-tier update.

The native test additionally clears a 100,000-node list iteratively and checks removal of current/head/final nodes, stack entries pointing to removed songs, FIFO deduplication, list boundaries, search/sort and FreeUser/PremiumUser behavior. Release tests use explicit failures rather than disabled assertions.

## How to repeat

From the root, run `ctest --test-dir build -C Release --output-on-failure`. In `frontend`, run `npm test`, `npm run lint`, `npm run build`, `npm audit`, and `npm run test:integration`.

Integration prerequisites: XAMPP MySQL accepting the supplied development root settings, Chrome, built C++ executable with its copied DLLs, npm dependencies, and free test ports. The script creates a twelve-second original sine-tone MP3 with its development-only FFmpeg utility. No remote audio asset, mock server, fake playback timer, or production seed account is involved.

## Scope and remaining manual checks

These results establish the tested local journeys, not production load certification or a formal penetration test. No ASan/Valgrind run, cross-browser matrix, large-library load benchmark, physical touch-device test or long-running session-expiry test was performed. Image validation checks supported signatures and limits; it is not antivirus scanning or a full media re-encoding pipeline.

Before a classroom presentation, upload your own permitted music and cover art, verify sound through the intended speaker/headphones, and confirm the browser's chosen download location. Free/premium accounts differ only in playlist limits. Server restart signs users out and clears in-memory queues while retaining database content and files.
