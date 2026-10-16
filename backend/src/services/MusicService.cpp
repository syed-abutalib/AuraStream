#include "models/Models.h"
#include "services/Services.h"
#include <random>

namespace aura {
int PlaylistManager::create(const Json &user, const Json &body) {
    auto model =
        makeUser(user["id"].asInt(), user["name"].asString(), user["account_type"].asString());
    return repo_.createPlaylist(model->id(), body, model->getPlaylistLimit());
}
Json LibraryManager::academicSearch(int user, const std::string &query, const std::string &sort) {
    auto source = repo_.songs(user, "", "", "newest", 1, 500)["items"];
    std::vector<Song> all;
    std::unordered_map<int, Json> byId;
    for (const auto &j : source) {
        all.emplace_back(j["id"].asInt(), j["title"].asString(), j["artist"].asString(),
                         j["album"].asString(), j["genre"].asString());
        byId.emplace(j["id"].asInt(), j);
    }
    auto found = CatalogAlgorithms::search(all, query);
    CatalogAlgorithms::sort(found, sort);
    Json result(::Json::arrayValue);
    for (const auto &s : found)
        result.append(byId.at(s.id()));
    return result;
}
Json MusicService::queue(const std::shared_ptr<Session> &session, const std::string &action,
                         const Json &b, int id) {
    std::lock_guard<std::mutex> lock(session->mutex);
    auto &q = session->queue;
    int selected = q.current();
    bool exhausted = false;
    for (const char *flag : {"replace", "shuffle", "repeat_all"})
        require(!b.isMember(flag) || b[flag].isBool(), std::string(flag) + " must be boolean");
    if (action == "append") {
        require(b["song_ids"].isArray() && b["song_ids"].size() <= 500,
                "Provide at most 500 song IDs");
        std::vector<int> ids;
        for (const auto &s : b["song_ids"]) {
            require(s.isInt() && s.asInt() > 0, "Invalid song ID");
            repo_.song(s.asInt());
            ids.push_back(s.asInt());
        }
        require((b.get("replace", false).asBool() ? 0 : q.songs().size()) + ids.size() <= 500,
                "Queue is limited to 500 songs");
        if (b.isMember("current_id")) {
            require(b["current_id"].isInt(), "Current song ID must be an integer");
            auto existing = b.get("replace", false).asBool() ? std::vector<int>{} : q.songs();
            const int requested = b["current_id"].asInt();
            require(std::find(ids.begin(), ids.end(), requested) != ids.end() ||
                        std::find(existing.begin(), existing.end(), requested) != existing.end(),
                    "Current song must be in the queue");
        }
        if (b.get("shuffle", false).asBool()) {
            std::mt19937 rng(randombytes_random());
            std::shuffle(ids.begin(), ids.end(), rng);
            // Keep the currently playing track first so all shuffled successors are reachable.
            if (b.isMember("current_id")) {
                auto current = std::find(ids.begin(), ids.end(), b["current_id"].asInt());
                if (current != ids.end())
                    std::rotate(ids.begin(), current, current + 1);
            }
        }
        if (b.get("replace", false).asBool())
            q.clear();
        q.append(ids);
        if (b.isMember("current_id")) {
            require(b["current_id"].isInt() && q.select(b["current_id"].asInt()),
                    "Current song must be in the queue");
        }
        selected = q.current();
    } else if (action == "next") {
        selected = q.next(b.get("repeat_all", false).asBool());
        exhausted = selected == 0;
    } else if (action == "previous") {
        selected = q.previous();
        if (!selected)
            selected = q.current();
    } else if (action == "remove") {
        q.remove(id);
        selected = q.current();
    } else if (action == "clear") {
        q.clear();
        selected = 0;
    }
    Json out;
    out["items"] = Json(::Json::arrayValue);
    auto ids = q.songs();
    for (int songId : ids) {
        try {
            out["items"].append(repo_.song(songId, session->userId));
        } catch (const ApiError &e) {
            if (e.status != 404)
                throw;
            q.remove(songId);
        }
    }
    out["current_id"] = q.current();
    out["selected_id"] = selected;
    out["exhausted"] = exhausted;
    return out;
}
drogon::HttpResponsePtr MusicService::audio(const drogon::HttpRequestPtr &req, int id, int user,
                                            bool download) {
    auto song = repo_.song(id, user, true);
    require(!download || song["is_downloadable"].asBool(), "This song is not available to download",
            403);
    auto r = media_.serve(req, song["audio_path"].asString(), true, download);
    if (download)
        repo_.recordDownload(user, id);
    return r;
}
int MusicService::upload(const drogon::HttpRequestPtr &req) {
    drogon::MultiPartParser parser;
    require(parser.parse(req) == 0, "Invalid multipart upload");
    auto params = parser.getParameters();
    auto get = [&](const char *key) {
        auto it = params.find(key);
        return it == params.end() ? std::string() : it->second;
    };
    Json body;
    for (auto key : {"title", "artist", "album", "genre"})
        body[key] = get(key);
    try {
        body["duration_seconds"] = std::stoi(get("duration_seconds"));
    } catch (...) {
        throw ApiError(400, "Enter the duration in seconds");
    }
    require(get("rights_confirmed") == "true",
            "Confirm that you have permission to upload this audio");
    body["is_downloadable"] = get("is_downloadable") == "true";
    auto files = parser.getFilesMap();
    require(files.count("audio") != 0, "An MP3 file is required");
    std::string audio, cover;
    try {
        audio = media_.save(files.at("audio"), true);
        if (files.count("cover"))
            cover = media_.save(files.at("cover"), false);
        return repo_.createSong(body, audio, cover);
    } catch (...) {
        media_.remove(audio, true);
        media_.remove(cover, false);
        throw;
    }
}
void MusicService::deleteSong(int id) {
    auto song = repo_.deleteSong(id);
    media_.remove(song["audio_path"].asString(), true);
    media_.remove(song["cover_image"].asString(), false);
}
} // namespace aura
