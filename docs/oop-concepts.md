# C++ object-oriented programming report

The OOP design is executable application code. The React interface is a client; it does not substitute for the C++ academic implementations.

## Encapsulation

`backend/include/models/Models.h` defines `Song`, `User` and `Playlist`. Their IDs and descriptive values are private, exposed with const getters rather than public mutable fields. `Song` rejects invalid IDs or an empty title at construction. `Playlist` requires a name and exposes `ownedBy(userId)` instead of unrestricted owner mutation.

`DoublyLinkedList` hides its nested `Node` type and node ownership. Services can add/remove/select songs without changing pointers directly. `Repository` hides the connection behind `Database`, and `MediaService` owns the approved upload root rather than accepting arbitrary filesystem paths from controllers.

## Inheritance

`FreeUser` and `PremiumUser` derive from abstract `User`. `User` provides shared identity/name access, while the derived types implement account-specific behavior. Free users can create twenty playlists, premium users two hundred. Both tiers receive full playback and permission-aware downloads. There is no payment system or artificial duplicate playback implementation.

## Runtime polymorphism

`User::getPlaylistLimit()` and `User::getAccountBenefits()` are pure virtual. The derived methods use `override`. `makeUser()` returns `std::unique_ptr<User>` based on the database account type. In `PlaylistManager::create()` (`backend/src/services/MusicService.cpp`), a call through the base pointer selects the derived implementation at runtime. That result is used by the repository's transactional playlist-limit check, so changing the tier changes observable API behavior.

`Repository::user()` uses the same virtual benefits method to return the account's explanation and limit to the profile page. Unit tests instantiate both types through base pointers and verify their limits.

## Abstraction

- `AuthenticationService` exposes signup, login, session and password-change operations while hiding hashing, tokens, expiry and session storage.
- `LibraryManager` exposes the demonstrable C++ search/sort operation while hiding catalog retrieval and model construction.
- `PlaylistManager` hides tier selection and limit policy from the HTTP controller.
- `MusicService` exposes queue, audio, upload and deletion operations while coordinating repositories, files and data structures.
- `MediaService` hides file validation, storage, path safety and range response construction.
- `Repository` supplies domain-specific persistence methods; `Database` hides transaction completion and result-to-JSON conversion.

The HTTP controller contains routing and access checks, not SQL statements. This keeps persistence reusable and avoids implementing the application as one giant `main()` function.

## Other C++ concepts demonstrated

| Concept | Actual use |
| --- | --- |
| Classes and objects | Repository, controller and services are constructed at startup; user/song/playlist models represent records |
| Constructors | Establish domain identity, validate model invariants and prepare media directories |
| Destructors | Virtual base `User` destructor; iterative linked-list destructor releases all nodes |
| Access modifiers | Private model fields, private nodes and private service infrastructure |
| Virtual functions | Account limit/benefit selection via a base pointer |
| Composition | `MusicService` coordinates references to repository/media; `PlaybackQueue` contains list/stack/FIFO |
| References | Services receive existing repositories by reference; const references avoid unnecessary copying |
| Const correctness | Accessors, traversal, path resolution and file response operations preserve object state where appropriate |
| Smart pointers | `unique_ptr` owns each list node; `shared_ptr<Session>` safely keeps an authenticated session alive during a request |
| RAII | `lock_guard`, file streams, unique pointers, database transactions and task queue lifetime release resources automatically |
| Deleted copy operations | A linked list cannot accidentally duplicate owning node pointers |
| Exceptions | `ApiError` conveys application failures; SQL/media exceptions are converted to controlled HTTP errors |
| Templates | `Database::query` forwards parameter types; the transaction wrapper accepts a callable |
| Lambdas | Endpoint worker jobs, transactional operations and sorting comparators |

Inheritance models a genuine “is a” relationship: a premium user is a user. Composition models “has a”: a playback queue has a linked list and navigation history. The code avoids inheriting controllers from repositories or exposing database rows as unrestricted domain state.
