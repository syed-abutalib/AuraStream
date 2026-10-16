import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Volume2,
  VolumeX,
  ListMusic,
  Heart,
  Download,
  ChevronDown,
  Maximize2,
  X,
  Music2,
} from "lucide-react";
import { usePlayer } from "../contexts/PlayerContext";
import { useApp } from "../contexts/AppContext";
import { Cover, IconButton } from "./UI";
import { duration } from "../services/api";
export default function MusicPlayer() {
  const p = usePlayer(),
    { likes, toggleLike, download } = useApp();
  return (
    <>
      <footer
        className={`music-player ${p.expanded ? "expanded" : ""}`}
        aria-label="Music player"
      >
        {p.expanded && (
          <div className="expanded-heading">
            <span className="eyebrow">NOW PLAYING</span>
            <IconButton
              icon={ChevronDown}
              label="Collapse player"
              onClick={() => p.setExpanded(false)}
            />
          </div>
        )}
        <div className="now-playing">
          <Cover song={p.current} />
          <div>
            <span className="song-title">
              {p.current?.title || "Find your next favorite"}
            </span>
            <span className="artist">
              {p.current?.artist || "Your soundtrack starts here"}
            </span>
          </div>
          {p.current && (
            <IconButton
              icon={Heart}
              label="Like current song"
              active={likes.has(p.current.id)}
              onClick={() => toggleLike(p.current)}
            />
          )}
        </div>
        <div className="player-center">
          <div className="player-controls">
            <IconButton
              icon={Shuffle}
              label="Shuffle"
              active={p.shuffle}
              onClick={p.toggleShuffle}
            />
            <IconButton
              icon={SkipBack}
              label="Previous song"
              disabled={!p.current}
              onClick={p.previous}
            />
            <IconButton
              icon={p.playing ? Pause : Play}
              label={p.playing ? "Pause" : "Play"}
              className="main-play"
              disabled={!p.current}
              onClick={p.toggle}
            />
            <IconButton
              icon={SkipForward}
              label="Next song"
              disabled={!p.current}
              onClick={p.next}
            />
            <IconButton
              icon={p.repeat === "one" ? Repeat1 : Repeat}
              label={`Repeat: ${p.repeat}`}
              active={p.repeat !== "off"}
              onClick={() =>
                p.setRepeat(
                  p.repeat === "off"
                    ? "all"
                    : p.repeat === "all"
                      ? "one"
                      : "off",
                )
              }
            />
          </div>
          <div className="seek-control">
            <span>{duration(p.time)}</span>
            <input
              type="range"
              aria-label="Playback position"
              min="0"
              max={Number.isFinite(p.length) ? p.length || 1 : 1}
              step="0.1"
              value={p.time}
              disabled={!p.current}
              onChange={(e) => p.seek(Number(e.target.value))}
              style={{
                "--progress": `${p.length ? (p.time / p.length) * 100 : 0}%`,
              }}
            />
            <span>{duration(p.length)}</span>
          </div>
        </div>
        <div className="player-extras">
          <IconButton
            icon={Download}
            label="Download current song"
            disabled={!p.current?.is_downloadable}
            onClick={() => download(p.current)}
          />
          <IconButton
            icon={ListMusic}
            label="Open queue"
            active={p.queueOpen}
            onClick={() => p.setQueueOpen(!p.queueOpen)}
          />
          <div className="volume">
            <IconButton
              icon={p.muted || !p.volume ? VolumeX : Volume2}
              label={p.muted ? "Unmute" : "Mute"}
              onClick={() => p.setMuted(!p.muted)}
            />
            <input
              aria-label="Volume"
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={p.muted ? 0 : p.volume}
              onChange={(e) => {
                p.setVolume(Number(e.target.value));
                p.setMuted(false);
              }}
            />
          </div>
          <IconButton
            icon={Maximize2}
            label="Expand player"
            onClick={() => p.setExpanded(true)}
          />
        </div>
        <button
          className="mobile-expand"
          aria-label="Expand player"
          onClick={() => p.setExpanded(true)}
        />
      </footer>
      {p.queueOpen && (
        <aside className="queue-panel" aria-label="Playback queue">
          <div className="section-heading">
            <h2>
              Your queue <small>{p.queue.length}</small>
            </h2>
            <IconButton
              icon={X}
              label="Close queue"
              onClick={() => p.setQueueOpen(false)}
            />
          </div>
          <p className="muted">The soundtrack to your next moment.</p>
          {!p.queue.length && (
            <div className="queue-empty">
              <Music2 />
              <p>Add a song to get things going.</p>
            </div>
          )}
          {p.queue.map((s) => (
            <div
              className={`queue-song ${p.current?.id === s.id ? "active" : ""}`}
              key={s.id}
            >
              <button onClick={() => p.play(p.queue, s)}>
                <Cover song={s} />
                <span>
                  {s.title}
                  <small>{s.artist}</small>
                </span>
              </button>
              <IconButton
                icon={X}
                label={`Remove ${s.title} from queue`}
                onClick={() => p.remove(s)}
              />
            </div>
          ))}
          {!!p.queue.length && (
            <button className="button secondary" onClick={p.clear}>
              Clear queue
            </button>
          )}
          <div className="queue-note">
            Your queue belongs to this listening session.
          </div>
        </aside>
      )}
    </>
  );
}
