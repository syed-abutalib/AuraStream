import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { api, downloadSong } from "../services/api";
const Context = createContext(null);
export const useApp = () => useContext(Context);
export function AppProvider({ children }) {
  const [user, setUser] = useState(null),
    [authLoading, setAuthLoading] = useState(true);
  const [likes, setLikes] = useState(new Set()),
    [playlists, setPlaylists] = useState([]),
    [revision, setRevision] = useState(0),
    [toasts, setToasts] = useState([]);
  const notify = useCallback((message, type = "success") => {
    const id = crypto.randomUUID();
    setToasts((t) => [...t.slice(-3), { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);
  const refresh = useCallback(() => setRevision((v) => v + 1), []);
  useEffect(() => {
    api("/auth/me")
      .then(setUser)
      .catch((e) => {
        if (e.status !== 401) notify(e.message, "error");
      })
      .finally(() => setAuthLoading(false));
  }, [notify]);
  useEffect(() => {
    if (!user) {
      setLikes(new Set());
      setPlaylists([]);
      return;
    }
    let valid = true;
    (async () => {
      try {
        const ids = new Set();
        let page = 1,
          count = 0,
          batch;
        do {
          batch = await api(`/favorites?limit=100&page=${page++}`);
          batch.items.forEach((s) => ids.add(s.id));
          count += batch.items.length;
        } while (count < batch.total && batch.items.length);
        const lists = await api("/playlists");
        if (valid) {
          setLikes(ids);
          setPlaylists(lists);
        }
      } catch (e) {
        if (valid) notify(e.message, "error");
      }
    })();
    return () => {
      valid = false;
    };
  }, [user?.id, revision, notify]);
  const toggleLike = async (song) => {
    if (!user) return notify("Sign in to save your favorite songs.", "error");
    const liked = likes.has(song.id);
    try {
      await api(liked ? `/favorites/${song.id}` : "/favorites", {
        method: liked ? "DELETE" : "POST",
        ...(!liked && { body: { song_id: song.id } }),
      });
      setLikes((previous) => {
        const next = new Set(previous);
        liked ? next.delete(song.id) : next.add(song.id);
        return next;
      });
      refresh();
    } catch (e) {
      notify(e.message, "error");
    }
  };
  const download = async (song) => {
    if (!user) return notify("Sign in to download music.", "error");
    try {
      await downloadSong(song);
      notify("Download ready. Your browser will save the MP3.");
      refresh();
    } catch (e) {
      notify(e.message, "error");
    }
  };
  const logout = async () => {
    try {
      await api("/auth/logout", { method: "POST" });
      setUser(null);
      notify("You have signed out.");
    } catch (e) {
      notify(e.message, "error");
    }
  };
  return (
    <Context.Provider
      value={{
        user,
        setUser,
        authLoading,
        likes,
        toggleLike,
        playlists,
        refresh,
        revision,
        notify,
        download,
        logout,
      }}
    >
      {children}
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}`}>
            {t.message}
          </div>
        ))}
      </div>
    </Context.Provider>
  );
}
