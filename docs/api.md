# REST API reference

Base URL: `http://localhost:8080/api`. React calls relative `/api` URLs through Vite. JSON success: `{"data": ...}`. JSON error: `{"error":{"message":"..."}}`. MP3 and image routes return binary responses. Statuses include 200, 201, 400 (invalid input), 401 (login required), 403 (denied), 404, 409 (duplicate/limit), 413, 415, 416, 429 and 503.

Send `X-Aura-Request: 1` on POST, PUT and DELETE. For JSON bodies use `Content-Type: application/json`. Browser mutation origins must match `APP_ORIGIN`. There are no bearer tokens in JavaScript; authentication uses the HttpOnly `aura_session` cookie. “User” means any authenticated account, “admin” means the current database role is admin.

## Authentication and profiles

| Method and path | Access | Body / result |
| --- | --- | --- |
| `GET /health` | Public | Actual database health, backend identity |
| `POST /auth/register` | Public, rate-limited | `name`, `username`, `email`, `password`, `confirm_password`; 201 and session cookie |
| `POST /auth/login` | Public, rate-limited | `login` (username/email), `password`; profile and new session |
| `POST /auth/logout` | Public | Deletes current session and clears cookie |
| `GET /auth/me` | User | Current profile, counts, tier limit and benefits |
| `GET /users/me` | User | Same profile representation |
| `PUT /users/me` | User | `name`, `username` |
| `PUT /users/me/password` | User | `current_password`, `password`, `confirm_password`; revokes all sessions |
| `POST /users/me/avatar` | User | Multipart with one raster image file |

Username: 3–40 ASCII letters/digits/underscores. Password: 10–128 characters. Email and username uniqueness is enforced in the database. Browser roles, account types and IDs in registration are ignored; all ordinary registrations become free regular users.

## Catalog and media

| Method and path | Access | Behavior |
| --- | --- | --- |
| `GET /songs` | Public | Paginated catalog |
| `GET /songs/:id` | Public | One song; never exposes its audio filesystem path |
| `GET /songs/:id/audio` | Public | Real MP3; single HTTP byte ranges supported |
| `GET /songs/:id/download` | User | Permission-aware MP3 attachment; records authorized request |
| `GET /media/:filename` | Public | Safe raster artwork/profile file from covers directory |
| `GET /songs/algorithms` | Public | Academic C++ linear search and stable sort over newest 500 songs |

Catalog query parameters: `q`, `genre`, `sort=title|artist|album|newest|popular`, `page` (one-based), `limit` (1–100; default 24). Search matches title/artist/album/genre. `%`, `_` and the SQL escape character in input are treated literally. Invalid sort strings are rejected; SQL ordering is selected from a fixed whitelist.

Paginated result: `{items: Song[], total, page, limit, genres?: [{genre}]}`. Song fields include `id`, `title`, `artist`, `album`, `genre`, `duration_seconds`, `cover_image`, `is_downloadable`, `play_count`, `download_count`, `uploaded_at`, `is_favorite`.

Range examples: `Range: bytes=0-1023`, `Range: bytes=1024-`, `Range: bytes=-512`. Valid partial content returns 206 and an exact `Content-Range`; malformed, multi-part or unsatisfiable ranges return 416. Missing files return 404. Attachment names use generated filenames; the React download helper names the saved Blob with artist/title.

## Playlists

| Method and path | Access | Body / behavior |
| --- | --- | --- |
| `GET /playlists` | User | Own playlists, song counts and total duration |
| `POST /playlists` | User | `name`, `description`, `is_public`; 201 |
| `GET /playlists/:id` | Owner, or public | Metadata plus ordered `songs` |
| `PUT /playlists/:id` | Owner | `name`, `description`, `is_public` |
| `DELETE /playlists/:id` | Owner | Delete playlist and membership rows, not catalog songs |
| `POST /playlists/:id/songs` | Owner | `song_id`; duplicate additions are idempotent |
| `DELETE /playlists/:id/songs/:songId` | Owner | Remove membership |
| `PUT /playlists/:id/reorder` | Owner | `song_ids`: exact permutation of current membership |
| `POST /playlists/:id/cover` | Owner | Multipart with one raster image |

Creation uses the caller's polymorphic account limit (20/200). Visibility defaults must be supplied explicitly in the JSON body. Private playlists are returned as 404 to other users so their existence is not disclosed.

## Favorites, listening, artists and downloads

| Method and path | Access | Body / behavior |
| --- | --- | --- |
| `GET /favorites` | User | Paginated favorites, newest first |
| `POST /favorites` | User | `song_id` |
| `DELETE /favorites/:songId` | User | Idempotent unlike |
| `GET /history` | User | Paginated listening events, newest first |
| `POST /history` | User | `song_id`, must be the current queued track |
| `GET /downloads/history` | User | Paginated download events |
| `GET /artists/followed` | User | Followed artist names |
| `POST /artists/follow` | User | `artist_name`; resolves canonical spelling from songs |
| `DELETE /artists/follow` | User | `artist_name` |

Collection song records add `event_id` and `event_at`. History is sent on the first actual HTML audio `playing` event per selection; the server suppresses user/song repeats inside thirty seconds. It is not inserted on each progress update. The server cannot independently prove a browser actually produced audible sound.

## Playback queue

| Method and path | Body / behavior |
| --- | --- |
| `GET /queue` | Current session queue |
| `POST /queue` | `song_ids`, optional `replace`, `shuffle`, `current_id` |
| `DELETE /queue/:songId` | Remove matching song |
| `POST /queue/next` | Optional `repeat_all` boolean |
| `POST /queue/previous` | Pop navigation history or move through previous pointer |
| `DELETE /queue` | Clear linked list, stack and FIFO |

Every queue route requires a user. Result: `{items: Song[], current_id, selected_id, exhausted}`. Zero is the no-song sentinel. At the end of a non-repeating queue, `selected_id=0` and `exhausted=true`; the last current node remains available. Queues contain at most five hundred unique songs and are scoped to a server session. Replace clears navigation history. Shuffle reorders IDs in C++, retaining an explicitly selected current song at the front.

Example:

```json
{"song_ids":[12,7,19],"replace":true,"current_id":12,"shuffle":false}
```

## Administration

| Method and path | Body / behavior |
| --- | --- |
| `GET /admin/stats` | SQL aggregates: users/songs/playlists/plays/downloads; recent/popular songs |
| `GET /admin/users` | `q`, `page`; thirty users per page |
| `PUT /admin/users/:id` | `role=user|admin`, `account_type=free|premium` |
| `GET /admin/songs` | Catalog query parameters |
| `POST /admin/songs` | Multipart MP3 upload and metadata; 201 |
| `PUT /admin/songs/:id` | JSON title/artist/album/genre/duration/download permission |
| `DELETE /admin/songs/:id` | Cascade related database rows and clean up uploaded files |

All require admin authorization. Upload form fields: `audio` (MP3, required), `cover` (PNG/JPG/WebP, optional), `title`, `artist`, `album`, `genre`, `duration_seconds` (1–86400), `is_downloadable` (`true`/`false`), `rights_confirmed` (must be `true`). Song edits use a JSON boolean for `is_downloadable`. Limits: 30 MB audio, 5 MB artwork, 36 MB combined request.

The account-management transaction protects the final admin; self-demotion is also blocked. First-admin setup is a local CLI operation described in the README, not an HTTP route.
