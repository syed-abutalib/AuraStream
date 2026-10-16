#include "controllers/ApiController.h"
#include <sstream>

namespace aura {
drogon::HttpResponsePtr ApiController::dispatch(const drogon::HttpRequestPtr &req) {
    std::vector<std::string> parts;
    std::stringstream path(req->path());
    std::string segment;
    while (std::getline(path, segment, '/'))
        if (!segment.empty())
            parts.push_back(segment);
    auto at = [&](size_t i) { return i < parts.size() ? parts[i] : std::string(); };
    auto method = req->method();
    bool get = method == drogon::Get, post = method == drogon::Post, put = method == drogon::Put,
         del = method == drogon::Delete;
    if (!get) {
        require(req->getHeader("x-aura-request") == "1", "Missing request protection header", 403);
        auto origin = req->getHeader("origin");
        require(origin.empty() || origin == env("APP_ORIGIN", "http://localhost:5173"),
                "This origin is not permitted", 403);
    }
    if (req->getHeader("content-type").find("application/json") != std::string::npos)
        require(req->getJsonObject() && req->getJsonObject()->isObject(),
                "Request body must be a JSON object");
    auto body = req->getJsonObject() ? *req->getJsonObject() : Json(::Json::objectValue);
    auto param = [&](const char *key, const std::string &fallback = "") {
        auto val = req->getParameter(key);
        return val.empty() ? fallback : val;
    };
    int page = positiveId(param("page", "1"));
    require(page <= 100000, "Page is too large");
    int limit = positiveId(param("limit", "24"));
    require(limit <= 100, "Limit must be at most 100");
    auto ok = [&]() {
        Json j;
        j["success"] = true;
        return response(j);
    };
    if (at(1) == "health" && get)
        return response(repo_.health());
    if (at(1) == "media" && parts.size() == 3 && get)
        return media_.serve(req, at(2), false);
    if (at(1) == "auth") {
        if ((at(2) == "register" || at(2) == "login") && post) {
            auth_.limit(req->peerAddr().toIp());
            int id = at(2) == "register" ? auth_.signup(body) : auth_.login(body);
            auth_.logout(req);
            auto token = auth_.createSession(id);
            auto r = response(repo_.user(id), at(2) == "register" ? 201 : 200);
            auth_.setCookie(r, token);
            return r;
        }
        if (at(2) == "logout" && post) {
            auth_.logout(req);
            auto r = ok();
            auth_.setCookie(r, "", true);
            return r;
        }
        if (at(2) == "me" && get)
            return response(repo_.user(auth_.session(req)->userId));
    }
    auto session = auth_.session(req, false);
    int userId = session ? session->userId : 0;
    if (at(1) == "songs" && get) {
        if (parts.size() == 2)
            return response(repo_.songs(userId, param("q"), param("genre"), param("sort", "newest"),
                                        page, limit));
        if (at(2) == "algorithms")
            return response(library_.academicSearch(userId, param("q"), param("sort", "title")));
        int id = positiveId(at(2));
        if (parts.size() == 3)
            return response(repo_.song(id, userId));
        if (at(3) == "audio" || at(3) == "download") {
            if (at(3) == "download") {
                session = auth_.session(req);
                userId = session->userId;
                require(req->getHeader("sec-fetch-site") != "cross-site",
                        "Cross-site downloads are not permitted", 403);
            }
            return music_.audio(req, id, userId, at(3) == "download");
        }
    }
    if (at(1) == "playlists" && parts.size() == 3 && get)
        return response(repo_.playlist(positiveId(at(2)), userId));
    session = auth_.session(req);
    userId = session->userId;
    if (at(1) == "users" && at(2) == "me") {
        if (parts.size() == 3 && get)
            return response(repo_.user(userId));
        if (parts.size() == 3 && put) {
            auto name = field(body, "username", 100);
            require(std::regex_match(name, std::regex("[A-Za-z0-9_]{3,40}")),
                    "Username must be 3–40 letters, numbers or underscores");
            repo_.updateUser(userId, body);
            return response(repo_.user(userId));
        }
        if (at(3) == "password" && put) {
            auth_.changePassword(userId, body);
            auto r = ok();
            auth_.setCookie(r, "", true);
            return r;
        }
        if (at(3) == "avatar" && post) {
            drogon::MultiPartParser p;
            require(p.parse(req) == 0 && p.getFiles().size() == 1, "Upload one image");
            auto file = media_.save(p.getFiles()[0], false);
            try {
                repo_.avatar(userId, file);
            } catch (...) {
                media_.remove(file, false);
                throw;
            }
            return response(repo_.user(userId));
        }
    }
    if (at(1) == "favorites") {
        if (parts.size() == 2 && get)
            return response(repo_.collections(userId, "favorites", page, limit));
        if (parts.size() == 2 && post) {
            require(body["song_id"].isInt(), "song_id is required");
            repo_.favorite(userId, body["song_id"].asInt(), true);
            return ok();
        }
        if (parts.size() == 3 && del) {
            repo_.favorite(userId, positiveId(at(2)), false);
            return ok();
        }
    }
    if (at(1) == "history") {
        if (get)
            return response(repo_.collections(userId, "history", page, limit));
        if (post) {
            require(body["song_id"].isInt(), "song_id is required");
            int id = body["song_id"].asInt();
            {
                std::lock_guard<std::mutex> lock(session->mutex);
                require(session->queue.current() == id,
                        "Only the current queued song can be recorded", 409);
            }
            repo_.song(id);
            repo_.recordPlay(userId, id);
            return ok();
        }
    }
    if (at(1) == "downloads" && at(2) == "history" && get)
        return response(repo_.collections(userId, "downloads", page, limit));
    if (at(1) == "artists") {
        if (at(2) == "followed" && get)
            return response(repo_.artists(userId));
        if (at(2) == "follow" && (post || del)) {
            repo_.follow(userId, field(body, "artist_name", 150), post);
            return ok();
        }
    }
    if (at(1) == "playlists") {
        if (parts.size() == 2 && get)
            return response(repo_.playlists(userId));
        if (parts.size() == 2 && post)
            return response(repo_.playlist(playlists_.create(repo_.user(userId), body), userId),
                            201);
        int id = positiveId(at(2));
        if (parts.size() == 3 && put) {
            repo_.editPlaylist(id, userId, body);
            return response(repo_.playlist(id, userId));
        }
        if (parts.size() == 3 && del) {
            repo_.deletePlaylist(id, userId);
            return ok();
        }
        if (at(3) == "songs" && parts.size() == 4 && post) {
            require(body["song_id"].isInt(), "song_id is required");
            repo_.playlistSong(id, userId, body["song_id"].asInt(), true);
            return ok();
        }
        if (at(3) == "songs" && parts.size() == 5 && del) {
            repo_.playlistSong(id, userId, positiveId(at(4)), false);
            return ok();
        }
        if (at(3) == "reorder" && put) {
            repo_.reorder(id, userId, body["song_ids"]);
            return ok();
        }
        if (at(3) == "cover" && post) {
            repo_.playlist(id, userId, true);
            drogon::MultiPartParser p;
            require(p.parse(req) == 0 && p.getFiles().size() == 1, "Upload one cover image");
            auto file = media_.save(p.getFiles()[0], false);
            try {
                repo_.playlistCover(id, userId, file);
            } catch (...) {
                media_.remove(file, false);
                throw;
            }
            return ok();
        }
    }
    if (at(1) == "queue") {
        std::string action;
        if (parts.size() == 2 && get)
            action = "get";
        else if (parts.size() == 2 && post)
            action = "append";
        else if (parts.size() == 2 && del)
            action = "clear";
        else if (at(2) == "next" && post)
            action = "next";
        else if (at(2) == "previous" && post)
            action = "previous";
        else if (parts.size() == 3 && del)
            action = "remove";
        require(!action.empty(), "Queue action not found", 404);
        return response(
            music_.queue(session, action, body, action == "remove" ? positiveId(at(2)) : 0));
    }
    if (at(1) == "admin") {
        require(repo_.user(userId)["role"].asString() == "admin",
                "Administrator access is required", 403);
        if (at(2) == "stats" && get)
            return response(repo_.stats());
        if (at(2) == "users" && parts.size() == 3 && get)
            return response(repo_.users(param("q"), page));
        if (at(2) == "users" && parts.size() == 4 && put) {
            repo_.updateRole(userId, positiveId(at(3)), body);
            return ok();
        }
        if (at(2) == "songs") {
            if (parts.size() == 3 && get)
                return response(repo_.songs(userId, param("q"), param("genre"),
                                            param("sort", "newest"), page, limit));
            if (parts.size() == 3 && post)
                return response(repo_.song(music_.upload(req), userId), 201);
            if (parts.size() == 4 && put) {
                repo_.updateSong(positiveId(at(3)), body);
                return response(repo_.song(positiveId(at(3)), userId));
            }
            if (parts.size() == 4 && del) {
                music_.deleteSong(positiveId(at(3)));
                return ok();
            }
        }
    }
    throw ApiError(404, "API endpoint not found");
}
} // namespace aura
