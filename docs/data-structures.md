# C++ data structures and algorithms

## Custom doubly linked list

Source: `backend/include/datastructures/PlaybackQueue.h`, used by `MusicService::queue()` in `backend/src/services/MusicService.cpp`.

Each node stores an integer song ID, a raw non-owning previous pointer and a `unique_ptr` owning the next node. The head owns the chain. Tail/current pointers are non-owning observers. This creates a single ownership direction with no reference-count cycle. Copies are disabled.

`add()` appends at the tail. `remove()` reconnects neighbors and updates the head/tail/current pointers; removing the current track selects its successor if present, otherwise its predecessor. `next()`/`previous()` return zero at a boundary and leave the current node in place. `select()` scans for an ID. `clear()` moves the owning next pointer out of each node in a loop, preventing recursive destruction of a long chain.

| Operation | Time | Extra memory |
| --- | --- | --- |
| Append | O(1) | O(1) per node |
| Current / next / previous | O(1) | O(1) |
| Select by ID | O(n) | O(1) |
| Remove by ID | O(n) search, O(1) relink | O(1) |
| Traverse to vector | O(n) | O(n) |
| Clear/destruct | O(n) | O(1) iterative working storage |

## FIFO queue

`PlaybackQueue::append()` enqueues validated, previously absent song IDs into `std::queue<int> incoming_`. It then drains them in arrival order into the list. This is the real bulk enqueue path behind `POST /api/queue`, not an unused demonstration. The FIFO has O(1) push/front/pop. Duplicate checking currently scans a vector, so appending m items to n queued songs costs O(m(n+m)); the session is intentionally bounded to five hundred songs.

## Stack

`std::stack<int> backHistory_` records the previous current ID when Next succeeds. Previous pops the most recent navigation ID and selects it in the linked list. IDs removed since navigation are skipped. With no usable history, the operation falls back to the list's previous pointer.

Stack push/pop/top are O(1). Selecting a popped ID is O(n), and skipping h removed history items is O(hn) in the worst case. The list's direct previous operation remains O(1). Replacing or clearing a queue clears the stack.

## Vector

`std::vector<int>` holds queue traversal and API song-ID batches. `std::vector<Song>` holds catalog candidates and filtered search results in `LibraryManager`. Playlist data is read as ordered database rows and exposed as a song collection; vectors are used for queueing the playlist. Contiguous vector storage provides O(1) indexing, amortized O(1) append, and efficient iteration.

## Search and sort

`CatalogAlgorithms` in `backend/include/models/Models.h` provides case-insensitive linear substring search across title/artist/album/genre and `std::stable_sort` by title, artist or album. Search is O(n × text processing cost), simplified to O(n) when fields are bounded. Stable sort performs O(n log n) comparisons and commonly O(n) auxiliary storage. ASCII case folding is appropriate for the demonstrator; the database's utf8mb4 collation handles normal catalog searches more broadly.

`GET /api/songs/algorithms?q=ambient&sort=title` calls this code on the newest five hundred songs. It exists as an operational academic endpoint. The standard `/api/songs` endpoint performs parameterized SQL search, a whitelisted ORDER BY and LIMIT/OFFSET pagination, avoiding loading the entire catalog into C++ for ordinary browsing. SQL ID/foreign-key lookups benefit from the existing indexes; leading-wildcard LIKE may scan the catalog and is appropriate for this local university dataset.

C++ `std::shuffle` randomizes the requested IDs for a listening queue. Repeat-all reselects the first node after reaching the end. Queue exhaustion is a response flag, not an exception or a fabricated song.

## Synchronization and persistence

`Session` owns a `PlaybackQueue` and mutex. `MusicService` locks this mutex for each queue operation. No global music queue exists. In-flight requests retain shared ownership of their session. The authentication session map has a separate mutex.

Sessions and queues are intentionally ephemeral. Database playlists and playlist positions remain persistent. Refreshing or restarting does not replace MySQL with localStorage: the browser refetches authoritative records. A process restart removes queue/session state but not the eight-table database contents.

## Verification

`backend/tests/queue_tests.cpp` covers empty queues, missing removal, insertion, current selection, first/last boundaries, deletion of head/current/final nodes, traversal, a 100,000-node iterative clear, unique FIFO order, stack navigation, removed history IDs, repeat-all, exhaustion, search/sort and runtime user polymorphism. It uses explicit checks rather than `assert`, so Release builds do not compile the checks away. Browser/API tests additionally navigate the actual session queue during MP3 playback.
