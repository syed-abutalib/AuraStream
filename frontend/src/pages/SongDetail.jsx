import { useParams, Link } from "react-router-dom";
import { Play, Heart, Download, UserPlus, ListPlus } from "lucide-react";
import { useApp } from "../contexts/AppContext";
import { usePlayer } from "../contexts/PlayerContext";
import { useResource } from "../hooks/useResource";
import { api, duration } from "../services/api";
import { Cover, Skeleton, ErrorState } from "../components/UI";
export default function SongDetail() {
  const { id } = useParams(),
    { revision, likes, toggleLike, download, notify, user, refresh } = useApp(),
    p = usePlayer();
  const { data: s, loading, error } = useResource(`/songs/${id}`, revision);
  const followed = useResource(
    user ? "/artists/followed" : "/songs?limit=1",
    revision,
  );
  if (loading) return <Skeleton />;
  if (error) return <ErrorState message={error} />;
  const isFollowing =
    Array.isArray(followed.data) &&
    followed.data.some(
      (a) => a.artist_name.toLowerCase() === s.artist.toLowerCase(),
    );
  return (
    <>
      <div className="detail-hero">
        <Cover song={s} />
        <div>
          <span className="eyebrow">{s.genre || "TRACK"}</span>
          <h1>{s.title}</h1>
          <Link
            to={`/search?q=${encodeURIComponent(s.artist)}`}
            className="detail-artist"
          >
            {s.artist}
          </Link>
          <p>
            {s.album || "Single"} · {duration(s.duration_seconds)} ·{" "}
            {s.play_count} plays
          </p>
        </div>
      </div>
      <div className="detail-actions">
        <button className="button" onClick={() => p.play([s], s)}>
          <Play fill="currentColor" size={18} />
          Play track
        </button>
        <button
          className={`button secondary ${likes.has(s.id) ? "active" : ""}`}
          onClick={() => toggleLike(s)}
        >
          <Heart size={17} />
          {likes.has(s.id) ? "Liked" : "Like song"}
        </button>
        <button className="button secondary" onClick={() => p.add(s)}>
          <ListPlus size={18} />
          Add to queue
        </button>
        <button
          className="button secondary"
          disabled={!s.is_downloadable}
          onClick={() => download(s)}
        >
          <Download size={17} />
          {s.is_downloadable ? "Download MP3" : "Download unavailable"}
        </button>
      </div>
      <section className="panel artist-about">
        <div className="artist-avatar">{s.artist[0]}</div>
        <div>
          <span className="eyebrow">THE ARTIST</span>
          <h2>{s.artist}</h2>
          <p className="muted">More of the sound you love.</p>
        </div>
        <button
          className="button secondary"
          onClick={async () => {
            try {
              await api("/artists/follow", {
                method: isFollowing ? "DELETE" : "POST",
                body: { artist_name: s.artist },
              });
              notify(
                isFollowing ? "Artist unfollowed" : "Now following this artist",
              );
              refresh();
            } catch (e) {
              notify(e.message, "error");
            }
          }}
        >
          <UserPlus size={17} />
          {isFollowing ? "Unfollow artist" : "Follow artist"}
        </button>
      </section>
    </>
  );
}
