#include "models/Models.h"
#include "services/Services.h"
#include <fstream>

namespace aura {
MediaService::MediaService(std::filesystem::path root)
    : root_(std::filesystem::absolute(std::move(root))) {
    std::filesystem::create_directories(root_ / "songs");
    std::filesystem::create_directories(root_ / "covers");
    root_ = std::filesystem::canonical(root_);
}
std::filesystem::path MediaService::path(const std::string &reference, bool audio) const {
    require(!reference.empty(), "Media is missing", 404);
    auto name = std::filesystem::path(reference);
    require(name == name.filename() && reference.find('\\') == std::string::npos &&
                reference.find('/') == std::string::npos &&
                reference.find(':') == std::string::npos,
            "Invalid media reference", 400);
    auto folder = root_ / (audio ? "songs" : "covers");
    auto resolved = std::filesystem::weakly_canonical(folder / name);
    require(resolved.parent_path() == folder, "Invalid media path", 403);
    require(std::filesystem::is_regular_file(resolved), "Media file was not found", 404);
    return resolved;
}
std::string MediaService::save(const drogon::HttpFile &file, bool audio) {
    auto bytes = file.fileContent();
    auto ext = lowercase(std::filesystem::path(file.getFileName()).extension().string());
    require(!bytes.empty() && bytes.size() <= (audio ? 30u * 1024 * 1024 : 5u * 1024 * 1024),
            audio ? "MP3 must be at most 30 MB" : "Image must be at most 5 MB", 413);
    auto u = [&](size_t i) { return static_cast<unsigned char>(bytes[i]); };
    bool valid = false;
    if (audio) {
        require(ext == ".mp3", "Only MP3 audio is accepted", 415);
        size_t start = 0;
        if (bytes.size() >= 10 && bytes.substr(0, 3) == "ID3") {
            require((u(6) | u(7) | u(8) | u(9)) < 128, "Invalid MP3 ID3 tag", 415);
            start = 10 + (u(6) << 21) + (u(7) << 14) + (u(8) << 7) + u(9);
        }
        // Require a valid MPEG Layer III frame header after any ID3 metadata.
        for (size_t i = start; i + 4 < bytes.size() && i < start + 4096; ++i)
            if (u(i) == 255 && (u(i + 1) & 0xe0) == 0xe0 && ((u(i + 1) >> 3) & 3) != 1 &&
                ((u(i + 1) >> 1) & 3) == 1 && ((u(i + 2) >> 4) & 15) > 0 &&
                ((u(i + 2) >> 4) & 15) < 15 && ((u(i + 2) >> 2) & 3) != 3) {
                valid = true;
                break;
            }
    } else {
        valid = (ext == ".png" && bytes.size() > 24 &&
                 bytes.substr(0, 8) == std::string_view("\x89PNG\r\n\x1a\n", 8)) ||
                ((ext == ".jpg" || ext == ".jpeg") && bytes.size() > 4 && u(0) == 255 &&
                 u(1) == 216 && u(2) == 255) ||
                (ext == ".webp" && bytes.size() > 16 && bytes.substr(0, 4) == "RIFF" &&
                 bytes.substr(8, 4) == "WEBP");
    }
    require(valid, "File contents do not match a supported media format", 415);
    auto filename = randomToken() + ext;
    auto target = root_ / (audio ? "songs" : "covers") / filename;
    std::ofstream out(target, std::ios::binary);
    out.write(bytes.data(), static_cast<std::streamsize>(bytes.size()));
    require(out.good(), "Unable to store media", 500);
    return filename;
}
void MediaService::remove(const std::string &reference, bool audio) const {
    if (reference.empty())
        return;
    try {
        std::filesystem::remove(path(reference, audio));
    } catch (const std::exception &e) {
        LOG_WARN << "Media cleanup: " << e.what();
    }
}
drogon::HttpResponsePtr MediaService::serve(const drogon::HttpRequestPtr &req,
                                            const std::string &reference, bool audio,
                                            bool attachment) const {
    auto p = path(reference, audio);
    auto length = std::filesystem::file_size(p);
    require(length > 0, "Media file is empty", 404);
    auto range = req->getHeader("range");
    auto name = attachment ? "AuraStream-" + reference : "";
    std::string type = audio                      ? "audio/mpeg"
                       : p.extension() == ".png"  ? "image/png"
                       : p.extension() == ".webp" ? "image/webp"
                                                  : "image/jpeg";
    drogon::HttpResponsePtr r;
    if (!range.empty() && !attachment) {
        std::smatch match;
        size_t begin = 0, end = length - 1;
        bool valid = std::regex_match(range, match, std::regex("bytes=([0-9]*)-([0-9]*)"));
        if (valid) {
            try {
                if (match[1].str().empty()) {
                    auto suffix = std::stoull(match[2]);
                    valid = suffix > 0;
                    begin = suffix >= length ? 0 : length - suffix;
                } else {
                    begin = std::stoull(match[1]);
                    if (!match[2].str().empty())
                        end = std::min<unsigned long long>(std::stoull(match[2]), length - 1);
                }
                valid = valid && begin < length && begin <= end;
            } catch (...) {
                valid = false;
            }
        }
        if (!valid) {
            r = errorResponse(416, "Requested audio range is unavailable");
            r->addHeader("Content-Range", "bytes */" + std::to_string(length));
            return r;
        }
        r = drogon::HttpResponse::newFileResponse(p.string(), begin, end - begin + 1, true, "",
                                                  drogon::CT_CUSTOM, type);
        r->setStatusCode(drogon::k206PartialContent);
    } else
        r = drogon::HttpResponse::newFileResponse(p.string(), name, drogon::CT_CUSTOM, type);
    r->addHeader("Accept-Ranges", "bytes");
    r->addHeader("Cache-Control", audio ? "private, no-store" : "public, max-age=86400");
    return r;
}
} // namespace aura
