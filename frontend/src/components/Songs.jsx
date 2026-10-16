import {
  Heart,
  Play,
  Plus,
  Download,
  ListPlus,
  ArrowUp,
  ArrowDown,
  Trash2,
  Clock3,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../contexts/AppContext";
import { usePlayer } from "../contexts/PlayerContext";
import { Cover, IconButton, Modal, Empty } from "./UI";
import { api, duration } from "../services/api";
export function AddToPlaylist({ song, close }) {
  const { playlists, notify, refresh } = useApp();
  const add = async (id) => {
    try {
      await api(`/playlists/${id}/songs`, {
        method: "POST",
        body: { song_id: song.id },
      });
      notify("Added to playlist");
      refresh();
      close();
    } catch (e) {
      notify(e.message, "error");
    }
  };
  return (
    <Modal title="Add to playlist" onClose={close}>
      <p className="muted">
        {song.title} · {song.artist}
      </p>
      <div className="playlist-picker">
        {playlists.map((p) => (
          <button key={p.id} onClick={() => add(p.id)}>
            <Cover song={p} />
            <span>
              {p.name}
              <small>{p.song_count} songs</small>
            </span>
            <Plus size={18} />
          </button>
        ))}
      </div>
      {!playlists.length && (
        <Empty
          title="Make room for your favorites"
          text="Create a playlist from your library first."
          action={
            <Link className="button" to="/playlists" onClick={close}>
              Go to playlists
            </Link>
          }
        />
      )}
    </Modal>
  );
}
export function SongCard({ song, songs }) {
  const player = usePlayer(),
    { likes, toggleLike } = useApp();
  return (
    <article className="song-card">
      <div className="card-art">
        <Link to={`/songs/${song.id}`} aria-label={`View ${song.title}`}>
          <Cover song={song} />
        </Link>
        <button
          className="card-play"
          aria-label={`Play ${song.title}`}
          onClick={() => player.play(songs, song)}
        >
          <Play size={22} fill="currentColor" />
        </button>
        <span className="card-genre">{song.genre || "Music"}</span>
      </div>
      <div className="card-copy">
        <div>
          <Link to={`/songs/${song.id}`} className="song-title">
            {song.title}
          </Link>
          <Link
            to={`/search?q=${encodeURIComponent(song.artist)}`}
            className="artist"
          >
            {song.artist}
          </Link>
        </div>
        <IconButton
          icon={Heart}
          label={likes.has(song.id) ? "Unlike song" : "Like song"}
          active={likes.has(song.id)}
          onClick={() => toggleLike(song)}
        />
      </div>
      <small className="card-meta">
        {song.album || "Single"} <span>{duration(song.duration_seconds)}</span>
      </small>
    </article>
  );
}
export function SongGrid({ songs }) {
  return (
    <div className="song-grid">
      {songs.map((song) => (
        <SongCard key={song.id} song={song} songs={songs} />
      ))}
    </div>
  );
}
export function SongTable({ songs, onRemove, onMove, eventDates = false }) {
  const { likes, toggleLike, download } = useApp();
  const player = usePlayer();
  const [adding, setAdding] = useState(null);
  return (
    <>
      <div className="song-table">
        <div className="song-table-head">
          <span>#</span>
          <span>Track</span>
          <span className="album-col">Album</span>
          <span className="date-col">{eventDates ? "Date" : "Genre"}</span>
          <span>
            <Clock3 size={15} />
          </span>
          <span />
        </div>
        {songs.map((s, i) => (
          <div
            className={`song-row ${player.current?.id === s.id ? "is-current" : ""}`}
            key={s.event_id || s.id}
          >
            <button
              className="row-number"
              aria-label={`Play ${s.title}`}
              onClick={() => player.play(songs, s)}
            >
              {player.current?.id === s.id && player.playing ? (
                <span className="equalizer">▥</span>
              ) : (
                <>
                  <span>{i + 1}</span>
                  <Play size={15} />
                </>
              )}
            </button>
            <div className="track-cell">
              <Cover song={s} />
              <div>
                <Link to={`/songs/${s.id}`} className="song-title">
                  {s.title}
                </Link>
                <Link
                  className="artist"
                  to={`/search?q=${encodeURIComponent(s.artist)}`}
                >
                  {s.artist}
                </Link>
              </div>
            </div>
            <span className="album-col ellipsis">{s.album || "Single"}</span>
            <span className="date-col">
              {eventDates ? s.event_at : s.genre}
            </span>
            <span className="time-col">{duration(s.duration_seconds)}</span>
            <div className="row-actions">
              <IconButton
                icon={Heart}
                label={likes.has(s.id) ? "Unlike song" : "Like song"}
                active={likes.has(s.id)}
                onClick={() => toggleLike(s)}
              />
              <IconButton
                icon={Plus}
                label="Add to playlist"
                onClick={() => setAdding(s)}
              />
              <IconButton
                icon={ListPlus}
                label="Add to queue"
                onClick={() => player.add(s)}
              />
              <IconButton
                icon={Download}
                label={
                  s.is_downloadable ? "Download song" : "Download not permitted"
                }
                disabled={!s.is_downloadable}
                onClick={() => download(s)}
              />
              {onMove && (
                <>
                  <IconButton
                    icon={ArrowUp}
                    label="Move song up"
                    disabled={i === 0}
                    onClick={() => onMove(i, -1)}
                  />
                  <IconButton
                    icon={ArrowDown}
                    label="Move song down"
                    disabled={i === songs.length - 1}
                    onClick={() => onMove(i, 1)}
                  />
                </>
              )}
              {onRemove && (
                <IconButton
                  icon={Trash2}
                  label="Remove from playlist"
                  onClick={() => onRemove(s)}
                />
              )}
            </div>
          </div>
        ))}
      </div>
      {adding && <AddToPlaylist song={adding} close={() => setAdding(null)} />}
    </>
  );
}
