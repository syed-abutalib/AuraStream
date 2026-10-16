#pragma once
#include <cstdlib>
#include <drogon/drogon.h>
#include <filesystem>
#include <regex>
#include <sodium.h>
#include <stdexcept>

namespace aura {
using Json = Json::Value;
struct ApiError : std::runtime_error {
    int status;
    ApiError(int code, const std::string &message) : std::runtime_error(message), status(code) {}
};
inline void require(bool ok, const std::string &message, int status = 400) {
    if (!ok)
        throw ApiError(status, message);
}
inline std::string env(const char *key, std::string fallback = "") {
    auto *value = std::getenv(key);
    return value ? value : fallback;
}
inline std::string randomToken() {
    unsigned char bytes[32];
    randombytes_buf(bytes, sizeof(bytes));
    char out[65];
    sodium_bin2hex(out, sizeof(out), bytes, sizeof(bytes));
    return out;
}
inline std::string trimmed(std::string s) {
    auto first = s.find_first_not_of(" \t\r\n");
    if (first == std::string::npos)
        return {};
    return s.substr(first, s.find_last_not_of(" \t\r\n") - first + 1);
}
inline std::string field(const Json &j, const char *key, size_t max, bool mandatory = true) {
    require(j[key].isNull() || j[key].isString(), std::string(key) + " must be text");
    auto s = trimmed(j.get(key, "").asString());
    require((!mandatory || !s.empty()) && s.size() <= max,
            std::string(key) + " is missing or too long");
    return s;
}
inline int positiveId(const std::string &s) {
    require(!s.empty() && s.size() < 11 &&
                std::all_of(s.begin(), s.end(), [](unsigned char c) { return std::isdigit(c); }),
            "Invalid ID");
    try {
        int id = std::stoi(s);
        require(id > 0, "Invalid ID");
        return id;
    } catch (const std::out_of_range &) {
        throw ApiError(400, "Invalid ID");
    }
}
inline drogon::HttpResponsePtr response(const Json &data, int code = 200) {
    Json out;
    out["data"] = data;
    auto r = drogon::HttpResponse::newHttpJsonResponse(out);
    r->setStatusCode(static_cast<drogon::HttpStatusCode>(code));
    return r;
}
inline drogon::HttpResponsePtr errorResponse(int code, const std::string &msg) {
    Json out;
    out["error"]["message"] = msg;
    auto r = drogon::HttpResponse::newHttpJsonResponse(out);
    r->setStatusCode(static_cast<drogon::HttpStatusCode>(code));
    return r;
}
} // namespace aura
