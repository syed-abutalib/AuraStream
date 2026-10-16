#pragma once
#include "services/Services.h"
namespace aura {
class ApiController {
    Repository &repo_;
    AuthenticationService auth_;
    MediaService media_;
    LibraryManager library_;
    PlaylistManager playlists_;
    MusicService music_;

  public:
    explicit ApiController(Repository &repo)
        : repo_(repo), auth_(repo), media_(env("UPLOAD_ROOT", "backend/uploads")), library_(repo),
          playlists_(repo), music_(repo, media_) {}
    drogon::HttpResponsePtr dispatch(const drogon::HttpRequestPtr &req);
};
} // namespace aura
