#include "models/Models.h"
#include "repositories/Database.h"
#include <set>

namespace aura {
namespace {
const std::string publicSong =
    "s.id,s.title,s.artist,s.album,s.genre,s.duration_seconds,s.cover_image,s.is_downloadable,s."
    "play_count,s.download_count,s.uploaded_at";
const std::string userFields = "id,name,username,email,profile_image,role,account_type,created_at";
std::string like(const std::string &text) {
    std::string out = "%";
    for (char c : text) {
        if (c == '%' || c == '_' || c == '=')
            out += '=';
        out += c;
    }
    return out + "%";
}
Json pageResult(const drogon::orm::Result &rows, long long count, int page, int limit) {
    Json out;
    out["items"] = Database::rows(rows);
    out["total"] = ::Json::Int64(count);
    out["page"] = page;
    out["limit"] = limit;
    return out;
}
void songFields(const Json &b) {
    field(b, "title", 200);
    field(b, "artist", 150);
    field(b, "album", 150, false);
    field(b, "genre", 100, false);
    require(b["duration_seconds"].isInt() && b["duration_seconds"].asInt() > 0 &&
                b["duration_seconds"].asInt() <= 86400,
            "Duration must be 1–86400 seconds");
    require(b["is_downloadable"].isBool(), "Download permission is required");
}
void playlistFields(const Json &b) {
    field(b, "name", 150);
    field(b, "description", 5000, false);
    require(b["is_public"].isBool(), "Playlist visibility is required");
}
} // namespace
Json Repository::health() {
    db_.query("SELECT 1");
    Json j;
    j["status"] = "ok";
    j["database"] = "connected";
    j["backend"] = "C++ / Drogon";
    return j;
}
Json Repository::user(int id) {
    auto j = Database::one(db_.query(
        "SELECT " + userFields +
            ",(SELECT COUNT(*) FROM playlists WHERE user_id=users.id) playlist_count,(SELECT "
            "COUNT(*) FROM favorites WHERE user_id=users.id) favorite_count FROM users WHERE id=?",
        id));
    auto model = makeUser(id, j["name"].asString(), j["account_type"].asString());
    j["playlist_limit"] = static_cast<int>(model->getPlaylistLimit());
    j["benefits"] = model->getAccountBenefits();
    return j;
}
Json Repository::credentials(const std::string &login) {
    auto rows = db_.query("SELECT id,password_hash FROM users WHERE username=? OR email=? LIMIT 1",
                          login, login);
    return rows.empty() ? Json() : Database::one(rows);
}
int Repository::registerUser(const Json &b, const std::string &hash) {
    auto r = db_.query("INSERT INTO users(name,username,email,password_hash,role,account_type) "
                       "VALUES(?,?,?,?,'user','free')",
                       field(b, "name", 100), field(b, "username", 100),
                       lowercase(field(b, "email", 150)), hash);
    return static_cast<int>(r.insertId());
}
void Repository::updateUser(int id, const Json &b) {
    db_.query("UPDATE users SET name=?,username=? WHERE id=?", field(b, "name", 100),
              field(b, "username", 100), id);
}
void Repository::password(int id, const std::string &hash) {
    db_.query("UPDATE users SET password_hash=? WHERE id=?", hash, id);
}
void Repository::avatar(int id, const std::string &file) {
    db_.query("UPDATE users SET profile_image=? WHERE id=?", file, id);
}
Json Repository::song(int id, int userId, bool internal) {
    return Database::one(db_.query("SELECT " + publicSong + (internal ? ",s.audio_path" : "") +
                                       ",EXISTS(SELECT 1 FROM favorites f WHERE f.song_id=s.id AND "
                                       "f.user_id=?) is_favorite FROM songs s WHERE s.id=?",
                                   userId, id));
}
Json Repository::songs(int userId, const std::string &q, const std::string &genre,
                       const std::string &sort, int page, int limit) {
    const std::map<std::string, std::string> ordering = {{"title", "s.title ASC"},
                                                         {"artist", "s.artist ASC"},
                                                         {"album", "s.album ASC"},
                                                         {"newest", "s.uploaded_at DESC"},
                                                         {"popular", "s.play_count DESC"}};
    auto it = ordering.find(sort);
    require(it != ordering.end(), "Invalid sort option");
    auto pattern = like(q);
    std::string where =
        " WHERE (s.title LIKE ? ESCAPE '=' OR s.artist LIKE ? ESCAPE '=' OR s.album LIKE ? ESCAPE "
        "'=' OR s.genre LIKE ? ESCAPE '=') AND (?='' OR s.genre=?)";
    auto count = db_.query("SELECT COUNT(*) total FROM songs s" + where, pattern, pattern, pattern,
                           pattern, genre, genre)[0]["total"]
                     .as<long long>();
    auto rows = db_.query("SELECT " + publicSong +
                              ",EXISTS(SELECT 1 FROM favorites f WHERE f.song_id=s.id AND "
                              "f.user_id=?) is_favorite FROM songs s" +
                              where + " ORDER BY " + it->second + ",s.id DESC LIMIT ? OFFSET ?",
                          userId, pattern, pattern, pattern, pattern, genre, genre, limit,
                          (page - 1) * limit);
    auto out = pageResult(rows, count, page, limit);
    out["genres"] = Database::rows(db_.query(
        "SELECT DISTINCT genre FROM songs WHERE genre IS NOT NULL AND genre<>'' ORDER BY genre"));
    return out;
}
Json Repository::collections(int userId, const std::string &type, int page, int limit) {
    std::string table = type == "favorites" ? "favorites"
                        : type == "history" ? "playback_history"
                                            : "downloads";
    std::string date = type == "favorites" ? "created_at"
                       : type == "history" ? "played_at"
                                           : "downloaded_at";
    auto rows =
        db_.query("SELECT " + publicSong + ",r.id event_id,r." + date +
                      " event_at,EXISTS(SELECT 1 FROM favorites f WHERE f.song_id=s.id AND "
                      "f.user_id=?) is_favorite FROM " +
                      table + " r JOIN songs s ON s.id=r.song_id WHERE r.user_id=? ORDER BY r." +
                      date + " DESC,r.id DESC LIMIT ? OFFSET ?",
                  userId, userId, limit, (page - 1) * limit);
    auto count =
        db_.query("SELECT COUNT(*) total FROM " + table + " WHERE user_id=?", userId)[0]["total"]
            .as<long long>();
    return pageResult(rows, count, page, limit);
}
void Repository::favorite(int userId, int id, bool add) {
    song(id);
    if (add)
        db_.query("INSERT INTO favorites(user_id,song_id) VALUES(?,?) ON DUPLICATE KEY UPDATE "
                  "song_id=VALUES(song_id)",
                  userId, id);
    else
        db_.query("DELETE FROM favorites WHERE user_id=? AND song_id=?", userId, id);
}
void Repository::recordPlay(int userId, int id) {
    db_.transaction([&](const auto &tx) {
        tx->execSqlSync("SELECT id FROM users WHERE id=? FOR UPDATE", userId);
        tx->execSqlSync("SELECT id FROM songs WHERE id=? FOR UPDATE", id);
        auto recent =
            tx->execSqlSync("SELECT id FROM playback_history WHERE user_id=? AND song_id=? AND "
                            "played_at>DATE_SUB(NOW(), INTERVAL 30 SECOND) LIMIT 1",
                            userId, id);
        if (recent.empty()) {
            tx->execSqlSync("INSERT INTO playback_history(user_id,song_id) VALUES(?,?)", userId,
                            id);
            tx->execSqlSync("UPDATE songs SET play_count=COALESCE(play_count,0)+1 WHERE id=?", id);
        }
    });
}
void Repository::recordDownload(int userId, int id) {
    db_.transaction([&](const auto &tx) {
        auto s = tx->execSqlSync("SELECT is_downloadable FROM songs WHERE id=? FOR UPDATE", id);
        require(!s.empty(), "Song not found", 404);
        require(s[0]["is_downloadable"].template as<int>() == 1,
                "Downloads are not permitted for this song", 403);
        tx->execSqlSync("INSERT INTO downloads(user_id,song_id) VALUES(?,?)", userId, id);
        tx->execSqlSync("UPDATE songs SET download_count=COALESCE(download_count,0)+1 WHERE id=?",
                        id);
    });
}
Json Repository::artists(int userId) {
    return Database::rows(db_.query("SELECT id,artist_name,followed_at FROM followed_artists WHERE "
                                    "user_id=? ORDER BY artist_name",
                                    userId));
}
void Repository::follow(int userId, const std::string &artist, bool add) {
    auto r = db_.query("SELECT artist FROM songs WHERE artist=? ORDER BY id LIMIT 1", artist);
    require(!r.empty() || !add, "Artist not found", 404);
    auto canonical = r.empty() ? artist : r[0]["artist"].as<std::string>();
    if (add)
        db_.query("INSERT INTO followed_artists(user_id,artist_name) VALUES(?,?) ON DUPLICATE KEY "
                  "UPDATE artist_name=VALUES(artist_name)",
                  userId, canonical);
    else
        db_.query("DELETE FROM followed_artists WHERE user_id=? AND artist_name=?", userId,
                  canonical);
}
Json Repository::playlists(int userId) {
    return Database::rows(
        db_.query("SELECT p.*,(SELECT COUNT(*) FROM playlist_songs ps WHERE ps.playlist_id=p.id) "
                  "song_count,(SELECT COALESCE(SUM(s.duration_seconds),0) FROM playlist_songs ps "
                  "JOIN songs s ON s.id=ps.song_id WHERE ps.playlist_id=p.id) total_duration FROM "
                  "playlists p WHERE p.user_id=? ORDER BY p.created_at DESC,p.id DESC",
                  userId));
}
Json Repository::playlist(int id, int userId, bool owner) {
    auto p = Database::one(db_.query("SELECT * FROM playlists WHERE id=?", id));
    Playlist model(id, p["user_id"].asInt(), p["name"].asString());
    require(model.ownedBy(userId) || (!owner && p["is_public"].asBool()), "Playlist not found",
            404);
    p["songs"] = Database::rows(
        db_.query("SELECT " + publicSong +
                      ",ps.position,EXISTS(SELECT 1 FROM favorites f WHERE f.song_id=s.id AND "
                      "f.user_id=?) is_favorite FROM playlist_songs ps JOIN songs s ON "
                      "s.id=ps.song_id WHERE ps.playlist_id=? ORDER BY ps.position,ps.id",
                  userId, id));
    int duration = 0;
    for (const auto &s : p["songs"])
        duration += s["duration_seconds"].asInt();
    p["total_duration"] = duration;
    p["song_count"] = p["songs"].size();
    return p;
}
int Repository::createPlaylist(int userId, const Json &b, size_t limit) {
    playlistFields(b);
    int id = 0;
    db_.transaction([&](const auto &tx) {
        tx->execSqlSync("SELECT id FROM users WHERE id=? FOR UPDATE", userId);
        auto n = tx->execSqlSync("SELECT COUNT(*) total FROM playlists WHERE user_id=?",
                                 userId)[0]["total"]
                     .template as<size_t>();
        require(n < limit, "Your account playlist limit has been reached", 409);
        id = static_cast<int>(
            tx->execSqlSync(
                  "INSERT INTO playlists(user_id,name,description,is_public) VALUES(?,?,?,?)",
                  userId, field(b, "name", 150), field(b, "description", 5000, false),
                  b["is_public"].asBool())
                .insertId());
    });
    return id;
}
void Repository::editPlaylist(int id, int userId, const Json &b) {
    playlist(id, userId, true);
    playlistFields(b);
    db_.query("UPDATE playlists SET name=?,description=?,is_public=? WHERE id=? AND user_id=?",
              field(b, "name", 150), field(b, "description", 5000, false), b["is_public"].asBool(),
              id, userId);
}
void Repository::deletePlaylist(int id, int userId) {
    playlist(id, userId, true);
    db_.query("DELETE FROM playlists WHERE id=? AND user_id=?", id, userId);
}
void Repository::playlistCover(int id, int userId, const std::string &file) {
    playlist(id, userId, true);
    db_.query("UPDATE playlists SET cover_image=? WHERE id=? AND user_id=?", file, id, userId);
}
void Repository::playlistSong(int id, int userId, int songId, bool add) {
    playlist(id, userId, true);
    song(songId);
    db_.transaction([&](const auto &tx) {
        auto p = tx->execSqlSync("SELECT id FROM playlists WHERE id=? AND user_id=? FOR UPDATE", id,
                                 userId);
        require(!p.empty(), "Playlist not found", 404);
        if (add) {
            auto n = tx->execSqlSync("SELECT COALESCE(MAX(position),-1)+1 position FROM "
                                     "playlist_songs WHERE playlist_id=?",
                                     id)[0]["position"]
                         .template as<int>();
            require(n < 10000, "Playlist is full", 409);
            tx->execSqlSync("INSERT INTO playlist_songs(playlist_id,song_id,position) "
                            "VALUES(?,?,?) ON DUPLICATE KEY UPDATE song_id=VALUES(song_id)",
                            id, songId, n);
        } else
            tx->execSqlSync("DELETE FROM playlist_songs WHERE playlist_id=? AND song_id=?", id,
                            songId);
    });
}
void Repository::reorder(int id, int userId, const Json &ids) {
    require(ids.isArray() && ids.size() <= 10000, "song_ids must be an array");
    db_.transaction([&](const auto &tx) {
        auto p = tx->execSqlSync("SELECT id FROM playlists WHERE id=? AND user_id=? FOR UPDATE", id,
                                 userId);
        require(!p.empty(), "Playlist not found", 404);
        auto rows = tx->execSqlSync("SELECT song_id FROM playlist_songs WHERE playlist_id=?", id);
        std::set<int> expected, actual;
        for (auto r : rows)
            expected.insert(r["song_id"].template as<int>());
        for (auto v : ids) {
            require(v.isInt() && v.asInt() > 0, "Invalid song ID");
            actual.insert(v.asInt());
        }
        require(actual == expected && actual.size() == ids.size(),
                "Provide each playlist song exactly once");
        int pos = 0;
        for (auto v : ids)
            tx->execSqlSync(
                "UPDATE playlist_songs SET position=? WHERE playlist_id=? AND song_id=?", pos++, id,
                v.asInt());
    });
}
int Repository::createSong(const Json &b, const std::string &audio, const std::string &cover) {
    songFields(b);
    return static_cast<int>(db_.query("INSERT INTO "
                                      "songs(title,artist,album,genre,duration_seconds,audio_path,"
                                      "cover_image,is_downloadable) VALUES(?,?,?,?,?,?,?,?)",
                                      field(b, "title", 200), field(b, "artist", 150),
                                      field(b, "album", 150, false), field(b, "genre", 100, false),
                                      b["duration_seconds"].asInt(), audio, cover,
                                      b["is_downloadable"].asBool())
                                .insertId());
}
void Repository::updateSong(int id, const Json &b) {
    song(id);
    songFields(b);
    db_.query("UPDATE songs SET "
              "title=?,artist=?,album=?,genre=?,duration_seconds=?,is_downloadable=? WHERE id=?",
              field(b, "title", 200), field(b, "artist", 150), field(b, "album", 150, false),
              field(b, "genre", 100, false), b["duration_seconds"].asInt(),
              b["is_downloadable"].asBool(), id);
}
Json Repository::deleteSong(int id) {
    auto s = song(id, 0, true);
    db_.query("DELETE FROM songs WHERE id=?", id);
    return s;
}
Json Repository::stats() {
    auto j = Database::one(
        db_.query("SELECT (SELECT COUNT(*) FROM users) total_users,(SELECT COUNT(*) FROM songs) "
                  "total_songs,(SELECT COUNT(*) FROM playlists) total_playlists,(SELECT "
                  "COALESCE(SUM(play_count),0) FROM songs) total_plays,(SELECT "
                  "COALESCE(SUM(download_count),0) FROM songs) total_downloads"));
    j["recent"] = songs(0, "", "", "newest", 1, 5)["items"];
    j["popular"] = songs(0, "", "", "popular", 1, 5)["items"];
    return j;
}
Json Repository::users(const std::string &q, int page) {
    auto p = like(q);
    auto rows = db_.query("SELECT " + userFields +
                              " FROM users WHERE name LIKE ? ESCAPE '=' OR username LIKE ? ESCAPE "
                              "'=' OR email LIKE ? ESCAPE '=' ORDER BY id DESC LIMIT 30 OFFSET ?",
                          p, p, p, (page - 1) * 30);
    auto n = db_.query("SELECT COUNT(*) total FROM users WHERE name LIKE ? ESCAPE '=' OR username "
                       "LIKE ? ESCAPE '=' OR email LIKE ? ESCAPE '='",
                       p, p, p)[0]["total"]
                 .as<long long>();
    return pageResult(rows, n, page, 30);
}
void Repository::updateRole(int actor, int id, const Json &b) {
    auto role = field(b, "role", 20);
    auto tier = field(b, "account_type", 20);
    require(role == "admin" || role == "user", "Invalid role");
    require(tier == "free" || tier == "premium", "Invalid account type");
    require(actor != id || role == "admin", "You cannot remove your own admin access", 409);
    db_.transaction([&](const auto &tx) {
        auto admins =
            tx->execSqlSync("SELECT id FROM users WHERE role='admin' ORDER BY id FOR UPDATE");
        auto target = tx->execSqlSync("SELECT role FROM users WHERE id=? FOR UPDATE", id);
        require(!target.empty(), "User not found", 404);
        require(!(target[0]["role"].template as<std::string>() == "admin" && role == "user" &&
                  admins.size() <= 1),
                "The last admin must be retained", 409);
        tx->execSqlSync("UPDATE users SET role=?,account_type=? WHERE id=?", role, tier, id);
    });
}
void Repository::initializeAdmin(const std::string &username) {
    db_.transaction([this, username](const std::shared_ptr<drogon::orm::Transaction> &tx) {
        auto all = tx->execSqlSync("SELECT id,username,role FROM users ORDER BY id FOR UPDATE");
        int id = 0;
        for (auto row : all) {
            require(row["role"].template as<std::string>() != "admin",
                    "An admin already exists; use the admin dashboard", 409);
            if (row["username"].template as<std::string>() == username)
                id = row["id"].template as<int>();
        }
        require(id > 0, "Register this username in AuraStream first", 404);
        tx->execSqlSync("UPDATE users SET role='admin' WHERE id=?", id);
    });
}
} // namespace aura
