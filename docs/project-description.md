# AuraStream project description

AuraStream is an OOP-based music management and streaming system for the university project proposed by Abdul Salam (083), Abdul Hadi (061) and Muhammad Affan (069), Department of Computer Science. It applies encapsulation, inheritance, polymorphism, abstraction and C++ data structures to a working React music application.

The implementation updates the proposal's original persistence plan. **Users, music metadata, playlists, favorites, playback history, download records and followed artists are stored in XAMPP MySQL/MariaDB, replacing the proposed TXT/CSV files.** Audio and artwork remain files on disk. C++ file handling is still used for safe media storage and delivery, while relational integrity is enforced by the existing database keys.

The frontend uses React, Vite, Tailwind CSS, React Router, Lucide icons, Framer Motion and the browser's HTML5 Audio API. The actual server is C++17 with Drogon and parameterized MySQL queries. CMake and vcpkg provide the Windows build. No Node, PHP, Python or cloud database backend replaces C++.

Listeners can register, sign in, browse/search music, play real MP3s, maintain a queue, create and order playlists, mark favorites, follow artists, view listening/download history and update their profile. Authorized administrators upload media, edit the catalog, review aggregate statistics and manage roles/account tiers. Secure first-admin initialization occurs locally without a hardcoded password.

The C++ queue uses a custom doubly linked list for navigation, a stack for back history and a FIFO for ordered insertion. Vectors hold song collections; a working academic endpoint exposes linear search and stable sorting. FreeUser and PremiumUser inherit from User and provide different playlist limits through virtual methods used by real playlist creation.

The project is intended for a local classroom demonstration with legally permitted audio. It includes implementation reports, tests and a demonstration guide. It does not claim music licensing, a commercial subscription system, AI recommendations or browser offline playback.
