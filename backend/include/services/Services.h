#pragma once
#include "datastructures/PlaybackQueue.h"
#include "repositories/Database.h"
#include <chrono>
#include <mutex>
#include <unordered_map>

namespace aura {
struct Session {
    int userId;
    std::chrono::steady_clock::time_point expires;
    std::mutex mutex;
    PlaybackQueue queue;
    explicit Session(int id)
        : userId(id), expires(std::chrono::steady_clock::now() + std::chrono::hours(12)) {}
};
class AuthenticationService {
    Repository &repo_;
    std::mutex mutex_;
    std::unordered_map<std::string, std::shared_ptr<Session>> sessions_;
    struct Attempts {
        int count = 0;
        std::chrono::steady_clock::time_point start = std::chrono::steady_clock::now();
    };
    std::unordered_map<std::string, Attempts> attempts_;

  public:
    explicit AuthenticationService(Repository &repo) : repo_(repo) {}
    static std::string hashPassword(const std::string &password);
    void limit(const std::string &ip);
    int signup(const Json &body);
    int login(const Json &body);
    std::string createSession(int user);
    std::shared_ptr<Session> session(const drogon::HttpRequestPtr &req, bool mandatory = true);
    void logout(const drogon::HttpRequestPtr &req);
    void changePassword(int user, const Json &body);
    static void setCookie(const drogon::HttpResponsePtr &response, const std::string &token,
                          bool clear = false);
};
class MediaService {
    std::filesystem::path root_;

  public:
    explicit MediaService(std::filesystem::path root);
    std::string save(const drogon::HttpFile &file, bool audio);
    std::filesystem::path path(const std::string &reference, bool audio) const;
    void remove(const std::string &reference, bool audio) const;
    drogon::HttpResponsePtr serve(const drogon::HttpRequestPtr &req, const std::string &reference,
                                  bool audio, bool attachment = false) const;
};
class LibraryManager {
    Repository &repo_;

  public:
    explicit LibraryManager(Repository &repo) : repo_(repo) {}
    Json academicSearch(int user, const std::string &query, const std::string &sort);
};
class PlaylistManager {
    Repository &repo_;

  public:
    explicit PlaylistManager(Repository &repo) : repo_(repo) {}
    int create(const Json &user, const Json &body);
};
class MusicService {
    Repository &repo_;
    MediaService &media_;

  public:
    MusicService(Repository &repo, MediaService &media) : repo_(repo), media_(media) {}
    Json queue(const std::shared_ptr<Session> &session, const std::string &action, const Json &body,
               int song = 0);
    drogon::HttpResponsePtr audio(const drogon::HttpRequestPtr &req, int id, int user,
                                  bool download);
    int upload(const drogon::HttpRequestPtr &req);
    void deleteSong(int id);
};
} // namespace aura
