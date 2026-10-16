#include "controllers/ApiController.h"
#include <fstream>
#include <iostream>
#include <trantor/utils/ConcurrentTaskQueue.h>

namespace {
void loadEnvironment() {
    std::ifstream input("backend/.env");
    std::string line;
    while (std::getline(input, line)) {
        if (line.empty() || line[0] == '#')
            continue;
        auto pos = line.find('=');
        if (pos == std::string::npos)
            continue;
        auto key = aura::trimmed(line.substr(0, pos));
        auto val = aura::trimmed(line.substr(pos + 1));
        if (std::getenv(key.c_str()))
            continue;
#ifdef _WIN32
        _putenv_s(key.c_str(), val.c_str());
#else
        setenv(key.c_str(), val.c_str(), 0);
#endif
    }
}
std::string quoted(const std::string &s) {
    std::string out = "'";
    for (char c : s) {
        if (c == '\'' || c == '\\')
            out += '\\';
        out += c;
    }
    return out + "'";
}
} // namespace
int main(int argc, char **argv) {
    try {
        loadEnvironment();
        if (sodium_init() < 0)
            throw std::runtime_error("Unable to initialize password library");
        // XAMPP's loopback-only development database has no TLS listener. Never
        // relax verification automatically for a remote database host.
        auto host = aura::env("DB_HOST", "127.0.0.1");
        if ((host == "127.0.0.1" || host == "localhost" || host == "::1") &&
            aura::env("DB_LOCAL_NO_TLS", "true") == "true") {
#ifdef _WIN32
            _putenv_s("MARIADB_TLS_DISABLE_PEER_VERIFICATION", "1");
#else
            setenv("MARIADB_TLS_DISABLE_PEER_VERIFICATION", "1", 0);
#endif
        }
        auto connection = "host=" + quoted(aura::env("DB_HOST", "127.0.0.1")) +
                          "\nport=" + aura::env("DB_PORT", "3306") +
                          "\ndbname=" + quoted(aura::env("DB_NAME", "aurastream")) +
                          "\nuser=" + quoted(aura::env("DB_USER", "root")) +
                          "\npassword=" + quoted(aura::env("DB_PASSWORD")) +
                          "\nclient_encoding=utf8mb4";
        auto db = drogon::orm::DbClient::newMysqlClient(connection, 8);
        db->setTimeout(10);
        aura::Repository repository(db);
        repository.health();
        if (argc == 3 && std::string(argv[1]) == "--init-admin") {
            repository.initializeAdmin(argv[2]);
            std::cout << "First administrator initialized: " << argv[2] << std::endl;
            return 0;
        }
        aura::ApiController controller(repository);
        trantor::ConcurrentTaskQueue workers(8, "api-workers");
        drogon::app()
            .setLogLevel(trantor::Logger::kWarn)
            .setThreadNum(4)
            .setClientMaxBodySize(36 * 1024 * 1024)
            .setClientMaxMemoryBodySize(36 * 1024 * 1024)
            .addListener("127.0.0.1", static_cast<uint16_t>(std::stoi(aura::env("PORT", "8080"))));
        drogon::app().registerHandlerViaRegex(
            "/api/.*",
            [&](const drogon::HttpRequestPtr &req,
                std::function<void(const drogon::HttpResponsePtr &)> &&callback) {
                workers.runTaskInQueue([&, req, callback = std::move(callback)]() {
                    drogon::HttpResponsePtr r;
                    try {
                        r = controller.dispatch(req);
                    } catch (const aura::ApiError &e) {
                        r = aura::errorResponse(e.status, e.what());
                    } catch (const drogon::orm::DrogonDbException &e) {
                        std::string msg = e.base().what();
                        LOG_ERROR << "Database request failed: " << msg;
                        if (msg.find("Duplicate entry") != std::string::npos)
                            r = aura::errorResponse(409,
                                                    "That username, email or entry already exists");
                        else
                            r = aura::errorResponse(503, "Database request could not be completed");
                    } catch (const std::exception &e) {
                        LOG_ERROR << e.what();
                        r = aura::errorResponse(500, "The server could not complete this request");
                    }
                    r->addHeader("X-Content-Type-Options", "nosniff");
                    r->addHeader("Referrer-Policy", "same-origin");
                    if (r->getHeader("cache-control").empty())
                        r->addHeader("Cache-Control", "no-store");
                    callback(r);
                });
            },
            {drogon::Get, drogon::Post, drogon::Put, drogon::Delete});
        std::cout << "AuraStream C++ API: http://127.0.0.1:" << aura::env("PORT", "8080")
                  << " (database connected)" << std::endl;
        drogon::app().run();
    } catch (const std::exception &e) {
        std::cerr << "AuraStream startup failed: " << e.what() << std::endl;
        return 1;
    }
}
