#pragma once
#include "utils/Common.h"
#include <future>

namespace aura {
class Database {
    drogon::orm::DbClientPtr client_;

  public:
    explicit Database(drogon::orm::DbClientPtr client) : client_(std::move(client)) {}
    const drogon::orm::DbClientPtr &client() const {
        return client_;
    }
    template <class... Args> drogon::orm::Result query(const std::string &sql, Args &&...args) {
        return client_->execSqlSync(sql, std::forward<Args>(args)...);
    }
    template <class F> void transaction(F fn) {
        auto done = std::make_shared<std::promise<bool>>();
        auto future = done->get_future();
        auto tx = client_->newTransaction([done](bool ok) { done->set_value(ok); });
        try {
            fn(tx);
        } catch (...) {
            tx->rollback();
            throw;
        }
        tx.reset();
        require(future.get(), "Database transaction failed", 500);
    }
    static Json rows(const drogon::orm::Result &result) {
        Json out(::Json::arrayValue);
        static const std::vector<std::string> numbers = {"id",
                                                         "user_id",
                                                         "song_id",
                                                         "playlist_id",
                                                         "duration_seconds",
                                                         "position",
                                                         "play_count",
                                                         "download_count",
                                                         "song_count",
                                                         "total_duration",
                                                         "playlist_count",
                                                         "favorite_count",
                                                         "total_users",
                                                         "total_songs",
                                                         "total_playlists",
                                                         "total_plays",
                                                         "total_downloads",
                                                         "total"};
        for (const auto &row : result) {
            Json j;
            for (size_t i = 0; i < row.size(); ++i) {
                std::string name =
                    result.columnName(static_cast<drogon::orm::Result::RowSizeType>(i));
                if (row[i].isNull())
                    j[name] = Json();
                else if (name == "is_downloadable" || name == "is_public" || name == "is_favorite")
                    j[name] = row[i].as<int>() != 0;
                else if (std::find(numbers.begin(), numbers.end(), name) != numbers.end())
                    j[name] = ::Json::Int64(row[i].as<long long>());
                else
                    j[name] = row[i].as<std::string>();
            }
            out.append(j);
        }
        return out;
    }
    static Json one(const drogon::orm::Result &result) {
        require(!result.empty(), "Resource not found", 404);
        return rows(result)[0];
    }
};
class Repository {
    Database db_;

  public:
    explicit Repository(drogon::orm::DbClientPtr db) : db_(std::move(db)) {}
    Database &database() {
        return db_;
    }
    Json health();
    Json user(int id);
    Json credentials(const std::string &login);
    int registerUser(const Json &body, const std::string &hash);
    void updateUser(int id, const Json &body);
    void password(int id, const std::string &hash);
    void avatar(int id, const std::string &file);
    Json songs(int user, const std::string &q, const std::string &genre, const std::string &sort,
               int page, int limit);
    Json song(int id, int user = 0, bool internal = false);
    Json collections(int user, const std::string &type, int page, int limit);
    void favorite(int user, int song, bool add);
    void recordPlay(int user, int song);
    void recordDownload(int user, int song);
    Json artists(int user);
    void follow(int user, const std::string &artist, bool add);
    Json playlists(int user);
    Json playlist(int id, int user, bool owner = false);
    int createPlaylist(int user, const Json &body, size_t limit);
    void editPlaylist(int id, int user, const Json &body);
    void deletePlaylist(int id, int user);
    void playlistSong(int id, int user, int song, bool add);
    void reorder(int id, int user, const Json &ids);
    void playlistCover(int id, int user, const std::string &file);
    int createSong(const Json &body, const std::string &audio, const std::string &cover);
    void updateSong(int id, const Json &body);
    Json deleteSong(int id);
    Json stats();
    Json users(const std::string &q, int page);
    void updateRole(int actor, int id, const Json &body);
    void initializeAdmin(const std::string &username);
};
} // namespace aura
