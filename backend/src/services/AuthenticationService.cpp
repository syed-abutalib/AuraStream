#include "models/Models.h"
#include "services/Services.h"

namespace aura {
namespace {
void username(const Json &b) {
    auto u = field(b, "username", 100);
    require(std::regex_match(u, std::regex("[A-Za-z0-9_]{3,40}")),
            "Username must be 3–40 letters, numbers or underscores");
}
void passwordValid(const std::string &p) {
    require(p.size() >= 10 && p.size() <= 128, "Password must be 10–128 characters");
}
std::string passwordInput(const Json &body, const char *key) {
    require(body[key].isString(), std::string(key) + " is required");
    auto value = body[key].asString();
    require(!value.empty() && value.size() <= 128, "Password must be at most 128 characters");
    return value; // Never trim or case-fold a password.
}
} // namespace
std::string AuthenticationService::hashPassword(const std::string &password) {
    passwordValid(password);
    char out[crypto_pwhash_STRBYTES];
    require(crypto_pwhash_str_alg(
                out, password.data(), password.size(), crypto_pwhash_OPSLIMIT_INTERACTIVE,
                crypto_pwhash_MEMLIMIT_INTERACTIVE, crypto_pwhash_ALG_ARGON2ID13) == 0,
            "Password service is busy", 503);
    return out;
}
void AuthenticationService::limit(const std::string &ip) {
    std::lock_guard<std::mutex> lock(mutex_);
    auto now = std::chrono::steady_clock::now();
    for (auto it = attempts_.begin(); it != attempts_.end();) {
        if (now - it->second.start > std::chrono::minutes(15))
            it = attempts_.erase(it);
        else
            ++it;
    }
    auto &a = attempts_[ip];
    require(++a.count <= 30, "Too many authentication attempts. Try again in 15 minutes.", 429);
}
int AuthenticationService::signup(const Json &b) {
    field(b, "name", 100);
    username(b);
    auto email = field(b, "email", 150);
    require(std::regex_match(email, std::regex(R"([^\s@]+@[^\s@]+\.[^\s@]+)")),
            "Enter a valid email address");
    auto password = passwordInput(b, "password");
    require(password == passwordInput(b, "confirm_password"), "Passwords do not match");
    return repo_.registerUser(b, hashPassword(password));
}
int AuthenticationService::login(const Json &b) {
    auto record = repo_.credentials(field(b, "login", 150));
    auto password = passwordInput(b, "password");
    static const std::string dummy = hashPassword(randomToken());
    auto hash = record.isNull() ? dummy : record["password_hash"].asString();
    bool valid = crypto_pwhash_str_verify(hash.c_str(), password.data(), password.size()) == 0;
    require(valid && !record.isNull(), "Incorrect username/email or password", 401);
    return record["id"].asInt();
}
std::string AuthenticationService::createSession(int user) {
    std::lock_guard<std::mutex> lock(mutex_);
    auto now = std::chrono::steady_clock::now();
    for (auto it = sessions_.begin(); it != sessions_.end();) {
        if (it->second->expires < now)
            it = sessions_.erase(it);
        else
            ++it;
    }
    require(sessions_.size() < 10000, "Too many active sessions", 503);
    auto token = randomToken();
    sessions_[token] = std::make_shared<Session>(user);
    return token;
}
std::shared_ptr<Session> AuthenticationService::session(const drogon::HttpRequestPtr &req,
                                                        bool mandatory) {
    std::lock_guard<std::mutex> lock(mutex_);
    auto it = sessions_.find(req->getCookie("aura_session"));
    if (it != sessions_.end() && it->second->expires > std::chrono::steady_clock::now())
        return it->second;
    require(!mandatory, "Please sign in to continue", 401);
    return {};
}
void AuthenticationService::logout(const drogon::HttpRequestPtr &req) {
    std::lock_guard<std::mutex> lock(mutex_);
    sessions_.erase(req->getCookie("aura_session"));
}
void AuthenticationService::changePassword(int user, const Json &b) {
    auto profile = repo_.user(user);
    auto record = repo_.credentials(profile["username"].asString());
    auto old = passwordInput(b, "current_password");
    require(crypto_pwhash_str_verify(record["password_hash"].asCString(), old.data(), old.size()) ==
                0,
            "Current password is incorrect", 403);
    auto next = passwordInput(b, "password");
    require(next == passwordInput(b, "confirm_password"), "Passwords do not match");
    repo_.password(user, hashPassword(next));
    std::lock_guard<std::mutex> lock(mutex_);
    for (auto it = sessions_.begin(); it != sessions_.end();) {
        if (it->second->userId == user)
            it = sessions_.erase(it);
        else
            ++it;
    }
}
void AuthenticationService::setCookie(const drogon::HttpResponsePtr &r, const std::string &token,
                                      bool clear) {
    drogon::Cookie cookie("aura_session", token);
    cookie.setPath("/");
    cookie.setHttpOnly(true);
    cookie.setSecure(env("COOKIE_SECURE") == "true");
    cookie.setSameSite(drogon::Cookie::SameSite::kStrict);
    cookie.setMaxAge(clear ? 0 : 43200);
    r->addCookie(cookie);
}
} // namespace aura
