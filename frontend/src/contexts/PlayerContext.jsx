import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { api } from "../services/api";
import { useApp } from "./AppContext";
const Context = createContext(null);
export const usePlayer = () => useContext(Context);
export function PlayerProvider({ children }) {
  const { user, notify } = useApp();
  const audioRef = useRef(null);
  const recorded = useRef(false);
  const busy = useRef(false);
  const originalOrder = useRef([]);
  const [current, setCurrent] = useState(null),
    [queue, setQueue] = useState([]),
    [playing, setPlaying] = useState(false),
    [time, setTime] = useState(0),
    [length, setLength] = useState(0),
    [volume, setVolume] = useState(0.75),
    [muted, setMuted] = useState(false),
    [repeat, setRepeat] = useState("off"),
    [shuffle, setShuffle] = useState(false),
    [queueOpen, setQueueOpen] = useState(false),
    [expanded, setExpanded] = useState(false);
  const loadSong = useCallback(
    async (song) => {
      if (!song) return;
      const audio = audioRef.current;
      audio.pause();
      recorded.current = false;
      setTime(0);
      setLength(song.duration_seconds);
      setCurrent(song);
      audio.src = `/api/songs/${song.id}/audio`;
      audio.load();
      try {
        await audio.play();
      } catch (e) {
        if (e.name !== "AbortError")
          notify(
            e.name === "NotAllowedError"
              ? "Press play to start listening."
              : "This audio could not be played. Try another song.",
            "error",
          );
      }
    },
    [notify],
  );
  const sync = useCallback((data) => {
    setQueue(data.items);
    return data.items.find((s) => s.id === data.selected_id);
  }, []);
  const act = async (task) => {
    if (busy.current) return;
    if (!user)
      return notify("Sign in to start your listening session.", "error");
    busy.current = true;
    try {
      await task();
    } catch (e) {
      notify(e.message, "error");
    } finally {
      busy.current = false;
    }
  };
  const play = (songs, song, forceShuffle = false) =>
    act(async () => {
      const unique = [...new Map(songs.map((s) => [s.id, s])).values()];
      if (!unique.length) return;
      originalOrder.current = unique.map((s) => s.id);
      const data = await api("/queue", {
        method: "POST",
        body: {
          song_ids: originalOrder.current,
          replace: true,
          shuffle: forceShuffle || shuffle,
          ...(!forceShuffle && song ? { current_id: song.id } : {}),
        },
      });
      await loadSong(sync(data));
    });
  const toggleShuffle = () => {
    if (!queue.length) {
      setShuffle((value) => !value);
      return;
    }
    act(async () => {
      const ids = queue.map((s) => s.id);
      const ordered = [
        ...originalOrder.current.filter((id) => ids.includes(id)),
        ...ids.filter((id) => !originalOrder.current.includes(id)),
      ];
      const data = await api("/queue", {
        method: "POST",
        body: {
          song_ids: ordered,
          replace: true,
          shuffle: !shuffle,
          ...(current ? { current_id: current.id } : {}),
        },
      });
      sync(data);
      setShuffle(!shuffle);
    });
  };
  const next = () =>
    act(async () => {
      const data = await api("/queue/next", {
        method: "POST",
        body: { repeat_all: repeat === "all" },
      });
      const song = sync(data);
      if (song) await loadSong(song);
      else {
        audioRef.current.pause();
        setPlaying(false);
      }
    });
  const previous = () =>
    act(async () => {
      if (audioRef.current.currentTime > 3) {
        audioRef.current.currentTime = 0;
        return;
      }
      await loadSong(sync(await api("/queue/previous", { method: "POST" })));
    });
  const toggle = async () => {
    if (!current) return;
    if (audioRef.current.paused) {
      try {
        await audioRef.current.play();
      } catch {
        notify("Playback could not start. Please try again.", "error");
      }
    } else audioRef.current.pause();
  };
  const add = (song) =>
    act(async () => {
      sync(
        await api("/queue", { method: "POST", body: { song_ids: [song.id] } }),
      );
      notify("Added to your queue");
    });
  const remove = (song) =>
    act(async () => {
      const data = await api(`/queue/${song.id}`, { method: "DELETE" });
      sync(data);
      if (current?.id === song.id) {
        audioRef.current.pause();
        setCurrent(null);
        setTime(0);
      }
    });
  const clear = () =>
    act(async () => {
      await api("/queue", { method: "DELETE" });
      audioRef.current.pause();
      setCurrent(null);
      setQueue([]);
      setTime(0);
    });
  const seek = (value) => {
    const a = audioRef.current;
    if (Number.isFinite(a.duration)) {
      a.currentTime = Math.max(0, Math.min(value, a.duration));
      setTime(a.currentTime);
    }
  };
  useEffect(() => {
    audioRef.current.volume = volume;
    audioRef.current.muted = muted;
  }, [volume, muted]);
  useEffect(() => {
    audioRef.current.pause();
    audioRef.current.removeAttribute("src");
    audioRef.current.load();
    setCurrent(null);
    setQueue([]);
    setTime(0);
    if (user)
      api("/queue")
        .then(sync)
        .catch((e) => notify(e.message, "error"));
  }, [user?.id, sync, notify]);
  const onPlaying = () => {
    setPlaying(true);
    if (current && !recorded.current) {
      recorded.current = true;
      api("/history", { method: "POST", body: { song_id: current.id } }).catch(
        (e) => notify(e.message, "error"),
      );
    }
  };
  const onEnded = () => {
    if (repeat === "one") {
      audioRef.current.currentTime = 0;
      audioRef.current
        .play()
        .catch(() => notify("Press play to continue.", "error"));
    } else next();
  };
  return (
    <Context.Provider
      value={{
        current,
        queue,
        playing,
        time,
        length,
        volume,
        setVolume,
        muted,
        setMuted,
        repeat,
        setRepeat,
        shuffle,
        toggleShuffle,
        queueOpen,
        setQueueOpen,
        expanded,
        setExpanded,
        play,
        next,
        previous,
        toggle,
        add,
        remove,
        clear,
        seek,
      }}
    >
      {children}
      <audio
        ref={audioRef}
        preload="metadata"
        onPlaying={onPlaying}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setLength(e.currentTarget.duration)}
        onEnded={onEnded}
        onError={() => {
          if (audioRef.current.getAttribute("src")) {
            setPlaying(false);
            notify(
              "Audio unavailable or unsupported. Check the uploaded file.",
              "error",
            );
          }
        }}
      />
    </Context.Provider>
  );
}
