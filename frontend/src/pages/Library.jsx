import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, LayoutGrid, List, Play } from "lucide-react";
import { useResource } from "../hooks/useResource";
import { useApp } from "../contexts/AppContext";
import { usePlayer } from "../contexts/PlayerContext";
import {
  PageHeading,
  Empty,
  ErrorState,
  Skeleton,
  IconButton,
  Pagination,
} from "../components/UI";
import { SongGrid, SongTable } from "../components/Songs";
export default function LibraryPage({ mode = "library" }) {
  const [params, setParams] = useSearchParams();
  const [page, setPage] = useState(1),
    [grid, setGrid] = useState(mode !== "history" && mode !== "downloads");
  const { revision } = useApp(),
    player = usePlayer();
  const q = params.get("q") || "",
    genre = params.get("genre") || "",
    sort = params.get("sort") || "newest";
  const collection = ["liked", "history", "downloads"].includes(mode);
  const endpoint =
    mode === "liked"
      ? "/favorites"
      : mode === "history"
        ? "/history"
        : mode === "downloads"
          ? "/downloads/history"
          : "/songs";
  const { data, loading, error } = useResource(
    `${endpoint}?q=${encodeURIComponent(q)}&genre=${encodeURIComponent(genre)}&sort=${sort}&page=${page}&limit=24`,
    revision,
  );
  useEffect(() => setPage(1), [q, genre, sort, mode]);
  const titles = {
    library: ["Your library", "Every track. Every feeling. All in one place."],
    search: [
      "Discover your next obsession.",
      "A world of sound, one search away.",
    ],
    liked: ["Liked songs", "The ones that just get you."],
    history: ["Recently played", "Take another turn through your soundtrack."],
    downloads: [
      "Your downloads",
      "Music saved through your browser. Download again whenever permitted.",
    ],
  };
  const update = (key, value) =>
    setParams((previous) => {
      const p = new URLSearchParams(previous);
      value ? p.set(key, value) : p.delete(key);
      return p;
    });
  return (
    <>
      <PageHeading
        eyebrow={collection ? "YOUR COLLECTION" : "EXPLORE AURASTREAM"}
        title={titles[mode][0]}
        subtitle={titles[mode][1]}
      >
        {!!data?.items.length && (
          <button
            className="button"
            onClick={() => player.play(data.items, data.items[0])}
          >
            <Play size={17} fill="currentColor" />
            Play all
          </button>
        )}
      </PageHeading>
      <div className="library-toolbar">
        {!collection && (
          <>
            <div className="search-input">
              <Search size={18} />
              <input
                aria-label="Search the library"
                placeholder="Songs, artists, albums, genres…"
                value={q}
                onChange={(e) => update("q", e.target.value)}
              />
            </div>
            <select
              aria-label="Filter by genre"
              value={genre}
              onChange={(e) => update("genre", e.target.value)}
            >
              <option value="">All genres</option>
              {data?.genres.map((g) => (
                <option key={g.genre}>{g.genre}</option>
              ))}
            </select>
            <select
              aria-label="Sort songs"
              value={sort}
              onChange={(e) => update("sort", e.target.value)}
            >
              <option value="newest">Recently added</option>
              <option value="popular">Most played</option>
              <option value="title">Title A–Z</option>
              <option value="artist">Artist A–Z</option>
              <option value="album">Album A–Z</option>
            </select>
          </>
        )}
        <div className="view-toggle">
          <IconButton
            icon={LayoutGrid}
            label="Grid view"
            active={grid}
            onClick={() => setGrid(true)}
          />
          <IconButton
            icon={List}
            label="List view"
            active={!grid}
            onClick={() => setGrid(false)}
          />
        </div>
      </div>
      {data && (
        <p className="results-count">
          {data.total} {data.total === 1 ? "track" : "tracks"}
          {q ? ` matching “${q}”` : ""}
        </p>
      )}
      {loading ? (
        <Skeleton />
      ) : error ? (
        <ErrorState message={error} />
      ) : !data.items.length ? (
        <Empty
          title={
            q
              ? "No tracks on this frequency"
              : mode === "liked"
                ? "A home for your favorites"
                : mode === "history"
                  ? "Your listening story starts here"
                  : mode === "downloads"
                    ? "Nothing downloaded yet"
                    : "A little quiet, for now"
          }
          text={
            q
              ? "Try another title, artist, album or genre."
              : mode === "liked"
                ? "Tap the heart on a song to keep it close."
                : mode === "history"
                  ? "Play a song and it will appear here."
                  : mode === "downloads"
                    ? "Use a song’s download button to save a permitted MP3."
                    : "Songs uploaded by your administrator will appear here."
          }
        />
      ) : grid ? (
        <SongGrid songs={data.items} />
      ) : (
        <SongTable songs={data.items} eventDates={collection} />
      )}
      <Pagination data={data} page={page} setPage={setPage} />
    </>
  );
}
