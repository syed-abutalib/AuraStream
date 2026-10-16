#pragma once
#include <algorithm>
#include <cctype>
#include <memory>
#include <stdexcept>
#include <string>
#include <vector>

namespace aura {
class User {
    int id_;
    std::string name_;

  public:
    User(int id, std::string name) : id_(id), name_(std::move(name)) {}
    virtual ~User() = default;
    int id() const {
        return id_;
    }
    const std::string &name() const {
        return name_;
    }
    virtual size_t getPlaylistLimit() const = 0;
    virtual std::string getAccountBenefits() const = 0;
};
class FreeUser final : public User {
  public:
    using User::User;
    size_t getPlaylistLimit() const override {
        return 20;
    }
    std::string getAccountBenefits() const override {
        return "Full playback, permitted downloads, and up to 20 playlists.";
    }
};
class PremiumUser final : public User {
  public:
    using User::User;
    size_t getPlaylistLimit() const override {
        return 200;
    }
    std::string getAccountBenefits() const override {
        return "Full playback, permitted downloads, and up to 200 playlists. Academic account "
               "tier; no payments.";
    }
};
inline std::unique_ptr<User> makeUser(int id, const std::string &name, const std::string &tier) {
    if (tier == "premium")
        return std::make_unique<PremiumUser>(id, name);
    return std::make_unique<FreeUser>(id, name);
}
class Song {
    int id_;
    std::string title_, artist_, album_, genre_;

  public:
    Song(int id, std::string title, std::string artist, std::string album, std::string genre)
        : id_(id), title_(std::move(title)), artist_(std::move(artist)), album_(std::move(album)),
          genre_(std::move(genre)) {
        if (id <= 0 || title_.empty())
            throw std::invalid_argument("Invalid song");
    }
    int id() const {
        return id_;
    }
    const std::string &title() const {
        return title_;
    }
    const std::string &artist() const {
        return artist_;
    }
    const std::string &album() const {
        return album_;
    }
    const std::string &genre() const {
        return genre_;
    }
};
class Playlist {
    int id_, owner_;
    std::string name_;

  public:
    Playlist(int id, int owner, std::string name) : id_(id), owner_(owner), name_(std::move(name)) {
        if (name_.empty())
            throw std::invalid_argument("Playlist needs a name");
    }
    int id() const {
        return id_;
    }
    bool ownedBy(int userId) const {
        return owner_ == userId;
    }
    const std::string &name() const {
        return name_;
    }
};
inline std::string lowercase(std::string text) {
    std::transform(text.begin(), text.end(), text.begin(),
                   [](unsigned char c) { return static_cast<char>(std::tolower(c)); });
    return text;
}
class CatalogAlgorithms {
  public:
    static std::vector<Song> search(const std::vector<Song> &songs, const std::string &query) {
        std::vector<Song> found;
        auto q = lowercase(query);
        for (const auto &s : songs)
            if (lowercase(s.title() + " " + s.artist() + " " + s.album() + " " + s.genre())
                    .find(q) != std::string::npos)
                found.push_back(s);
        return found;
    }
    static void sort(std::vector<Song> &songs, const std::string &by) {
        std::stable_sort(songs.begin(), songs.end(), [&](const Song &a, const Song &b) {
            return lowercase(by == "artist"  ? a.artist()
                             : by == "album" ? a.album()
                                             : a.title()) < lowercase(by == "artist"  ? b.artist()
                                                                      : by == "album" ? b.album()
                                                                                      : b.title());
        });
    }
};
} // namespace aura
