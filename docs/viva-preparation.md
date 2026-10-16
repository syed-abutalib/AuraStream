# Viva preparation and class demonstration

## Questions and short answers

1. **What is AuraStream?** A local music streaming application with a React interface, a real C++ server and a MySQL/MariaDB database.
2. **Why use C++?** The project demonstrates object-oriented design, resource ownership and data structures in a working backend.
3. **What does React do?** It displays pages, sends requests and controls the browser's real audio element.
4. **What does Drogon do?** It accepts HTTP requests, routes them to C++ code, provides JSON/file responses and connects to MariaDB.
5. **Where is encapsulation?** Song/User/Playlist fields and linked-list pointers are private; callers use controlled public methods.
6. **Where is inheritance?** FreeUser and PremiumUser derive from User and share its identity behavior.
7. **Where is polymorphism?** PlaylistManager calls `getPlaylistLimit()` through a User pointer; the derived account type supplies twenty or two hundred.
8. **Where is abstraction?** Services and repositories expose operations without making controllers manage SQL, password internals or file paths.
9. **What is a pure virtual method?** A method declared with `= 0` that derived concrete classes must implement. It makes User abstract.
10. **Why a virtual destructor?** Deleting a derived user through a base pointer must invoke the appropriate derived destructor.
11. **What is a constructor?** A function used when an object is created; here it establishes identity and validates required values.
12. **What is RAII?** Resources belong to objects and are released when those objects leave scope, including locks, file streams and smart pointers.
13. **Why unique_ptr for queue nodes?** Each next node has one clear owner and is automatically released without manual delete or double-free.
14. **Why is prev a raw pointer?** It observes the previous node but does not own it, avoiding a cyclic ownership chain.
15. **What is a doubly linked list?** A chain where every node can locate both the next and the previous node.
16. **How fast is Next?** Moving the current pointer to its next node is O(1).
17. **How fast is removing a song?** Finding its ID costs O(n); reconnecting the neighboring pointers costs O(1).
18. **What happens at the last song?** Next returns an exhausted response unless repeat-all wraps to the first node.
19. **Why clear the list iteratively?** Recursively destroying a long unique_ptr chain could exhaust the call stack; the loop releases one node at a time.
20. **Where is a stack used?** Successful next navigation pushes the old ID; Previous pops the most recently visited ID.
21. **Where is a queue used?** New requested song IDs enter a FIFO and are drained into the linked list in arrival order.
22. **Why use a vector?** It stores song/search collections contiguously and supports efficient iteration and constant-time indexing.
23. **Which searching algorithm is implemented?** A case-insensitive linear substring search over bounded catalog fields.
24. **Which sorting algorithm interface is used?** `std::stable_sort`, with O(n log n) comparisons and stable ordering for equal keys.
25. **Why also use SQL search?** The normal browser catalog should use database filtering and pagination instead of loading every record into C++.
26. **What is an SQL injection?** Input being interpreted as SQL syntax. Parameter binding keeps user values separate from the SQL structure.
27. **What is a primary key?** A unique identifier for a row, such as a song's integer ID.
28. **What is a foreign key?** A database rule linking a row to an existing parent, such as a playlist membership's song ID.
29. **Why transactions?** Related changes either commit together or roll back; download history and download count must stay consistent.
30. **Why not store MP3 blobs in MySQL?** The database is used for relational metadata; files on disk are easier to stream and seek for this project.
31. **What replaced the proposal's CSV files?** The existing eight-table XAMPP MariaDB database. Only media remains in the filesystem.
32. **How are passwords protected?** Libsodium hashes them with salted Argon2id. Login verifies hashes rather than decrypting passwords.
33. **How do sessions work?** A random token in an HttpOnly cookie identifies server-owned identity and an expiring listening session.
34. **Can a user make themselves admin in React?** No. Backend endpoints read their real database role; registration ignores client role values.
35. **How does admin setup avoid a default password?** Register a chosen account, then locally run the one-time initialization CLI for that username.
36. **How does playback work?** HTML5 Audio requests actual MP3 bytes from the C++ audio route; browser decoding produces sound.
37. **What is an HTTP Range request?** A request for a byte interval, enabling seeking without downloading the whole MP3 again.
38. **Why does audio survive navigation?** Its provider and audio element stay mounted above the changing React route content.
39. **What counts as a play?** The first real browser `playing` event for a track selection; same-user/same-song events within thirty seconds are deduplicated.
40. **Are downloads offline playback inside AuraStream?** No. They are browser file downloads, recorded as authorized requests in MySQL.
41. **How are private playlists protected?** The service compares the owner to the authenticated session; public visibility only permits reading.
42. **Why lock a session queue?** Concurrent requests must not modify linked-list pointers at the same time.
43. **What persists after a restart?** All database records and uploaded files; in-memory queues and sessions do not.
44. **How is path traversal blocked?** Media references must be filenames; canonical paths must stay within the correct upload directory.
45. **Are recommendations AI-generated?** No. Most-played and recently-added sections use explicit database ordering; genres come from real tracks.
46. **What was tested?** Native structures/models, real C++/MariaDB APIs, MP3 byte ranges, permission rules and browser playback/navigation.
47. **What is the difference between composition and inheritance here?** A premium user is a user; a playback queue has a linked list, stack and FIFO.
48. **What would change for internet deployment?** Add HTTPS, restricted database credentials, shared durable sessions/rate limits, monitoring and a production reverse proxy.

## Seven-minute demonstration

Before class, start XAMPP MySQL and both application servers. Prepare two legal MP3s and cover images. Register and initialize your admin account using the README. Keep a second regular-user account ready; never show real passwords or private database records on a projector.

| Time | Demonstration |
| --- | --- |
| 0:00–0:45 | Open the responsive home page. Explain React → Drogon C++ → XAMPP MariaDB. Show the health endpoint. |
| 0:45–1:30 | Sign in as admin. Upload a legal MP3 and cover, confirm metadata and permitted download setting. Show real dashboard counts. |
| 1:30–2:30 | Sign in as a regular listener. Search a title/artist, open the track and play. Pause/resume, change volume and seek. Navigate to another page while it continues. |
| 2:30–3:30 | Create a playlist; add two tracks with the plus control; reorder them with arrows. Play the playlist and use Next/Previous. Toggle shuffle/repeat and inspect the queue. |
| 3:30–4:15 | Like a track, follow its artist and view the saved collection/history. Refresh to show MySQL persistence. |
| 4:15–5:00 | Download a permitted track and show download history. Show the disabled control on a non-downloadable track. Explain the local browser file-save behavior. |
| 5:00–6:15 | Open Models.h and PlaylistManager::create. Trace the virtual playlist limit. Open PlaybackQueue.h and trace node ownership, FIFO insertion and stack-based previous navigation. |
| 6:15–7:00 | Show passing native/integration checks. Explain parameterized SQL, ownership checks and safe file paths. Close with what survives server restart and how the revised database design replaces CSV persistence. |

If audio output is unavailable in the classroom, the real player's time/seek behavior and Network panel still demonstrate an actual MP3 response. Do not substitute a fake progress timer or claim silent playback is audible.
