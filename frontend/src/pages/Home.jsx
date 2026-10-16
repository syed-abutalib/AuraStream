import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  Play,
  AudioLines,
  Sparkles,
  Disc3,
  Upload,
} from "lucide-react";
import { motion } from "framer-motion";
import { useApp } from "../contexts/AppContext";
import { usePlayer } from "../contexts/PlayerContext";
import { useResource } from "../hooks/useResource";
import {
  PageHeading,
  SectionHeading,
  Empty,
  Skeleton,
  ErrorState,
  Cover,
} from "../components/UI";
import { SongGrid, SongTable } from "../components/Songs";
export default function HomePage() {
  const { user, revision, playlists } = useApp(),
    player = usePlayer();
  const popular = useResource("/songs?sort=popular&limit=6", revision),
    recent = useResource("/songs?sort=newest&limit=6", revision);
  const history = useResource(
    user ? "/history?limit=4" : "/songs?sort=newest&limit=4",
    revision,
  );
  const genres = popular.data?.genres?.slice(0, 4) || [];
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <PageHeading
        eyebrow="A LITTLE DISCOVERY. A LOT OF GOOD MUSIC."
        title={
          user
            ? `Welcome back, ${user.name.split(" ")[0]}.`
            : "Find your frequency."
        }
        subtitle="A soundtrack for every version of you."
      >
        <span className="date-chip">
          <AudioLines size={15} />
          Tune into your world
        </span>
      </PageHeading>
      <section className="hero">
        <div className="hero-copy">
          <span className="hero-tag">
            <span />
            THE AURASTREAM EXPERIENCE
          </span>
          <h2>
            Your music.
            <br />
            Your <em>aura.</em>
          </h2>
          <p>
            Get lost in a new sound. Come back to an old favorite.
            <br className="desktop-only" /> Make every moment feel a little more
            like you.
          </p>
          <div className="hero-actions">
            {popular.data?.items.length ? (
              <button
                className="button"
                onClick={() =>
                  player.play(popular.data.items, popular.data.items[0])
                }
              >
                <Play size={17} fill="currentColor" />
                Start listening
              </button>
            ) : (
              <Link className="button" to="/library">
                Explore your library
                <ArrowUpRight size={18} />
              </Link>
            )}
            <Link className="hero-link" to="/playlists">
              Make a playlist <ArrowUpRight size={16} />
            </Link>
          </div>
          <div className="hero-caption">
            <span className="tiny-wave">▂▅▇▄▂▆▃</span> LESS NOISE. MORE YOU.
          </div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="orb">
            <div className="orb-inner" />
          </div>
          <span className="art-label art-label-top">SOUND WITHOUT LIMITS</span>
          <div className="floating-note">
            <AudioLines size={22} />
            <span>
              Find your flow<small>Stay for the feeling.</small>
            </span>
          </div>
          <span className="art-label art-label-bottom">
            33⅓ RPM · IN YOUR ELEMENT
          </span>
        </div>
      </section>
      <section className="home-section">
        <SectionHeading
          title="On repeat"
          subtitle="The most played tracks in your community."
          link="/library?sort=popular"
        />
        {popular.loading ? (
          <Skeleton />
        ) : popular.error ? (
          <ErrorState message={popular.error} />
        ) : popular.data.items.length ? (
          <SongGrid songs={popular.data.items} />
        ) : (
          <Empty
            title="Great music starts with the first track"
            text={
              user?.role === "admin"
                ? "Upload a track you have permission to share and bring your library to life."
                : "Your library is ready. An administrator can upload music to get things started."
            }
            action={
              user?.role === "admin" ? (
                <Link to="/admin/songs" className="button">
                  <Upload size={17} />
                  Upload your first track
                </Link>
              ) : (
                <Link className="text-link" to={user ? "/profile" : "/signup"}>
                  {user ? "View your profile" : "Create your account"}
                  <ArrowUpRight size={16} />
                </Link>
              )
            }
          />
        )}
      </section>
      {!!genres.length && (
        <section className="home-section">
          <SectionHeading
            title="What’s your mood?"
            subtitle="Follow a feeling. Find a sound."
            link="/search"
            label="Explore genres"
          />
          <div className="genre-grid">
            {genres.map(({ genre }, i) => (
              <Link
                className={`genre-card genre-${i}`}
                to={`/search?genre=${encodeURIComponent(genre)}`}
                key={genre}
              >
                <span className="eyebrow">IN YOUR ELEMENT</span>
                <h3>{genre}</h3>
                <ArrowUpRight />
                <Disc3 className="genre-disc" />
              </Link>
            ))}
          </div>
        </section>
      )}
      <section className="home-section">
        <SectionHeading
          title="Fresh frequencies"
          subtitle="New additions, ready for a first listen."
          link="/library?sort=newest"
        />
        {recent.loading ? (
          <Skeleton />
        ) : !!recent.data?.items.length ? (
          <SongGrid songs={recent.data.items} />
        ) : (
          !recent.error && (
            <div className="quiet-banner">
              <Sparkles size={24} />
              <div>
                <h3>Something good is on its way.</h3>
                <p>Newly uploaded music will appear right here.</p>
              </div>
              <Link to="/library">
                <ArrowUpRight size={23} />
              </Link>
            </div>
          )
        )}
      </section>
      {user && !!history.data?.items.length && (
        <section className="home-section">
          <SectionHeading title="Pick up where you left off" link="/history" />
          <SongTable songs={history.data.items} />
        </section>
      )}
      {!!playlists.length && (
        <section className="home-section">
          <SectionHeading
            title="Made by you"
            subtitle="Your moments, carefully collected."
            link="/playlists"
          />
          <div className="playlist-grid">
            {playlists.slice(0, 4).map((p) => (
              <Link
                key={p.id}
                to={`/playlists/${p.id}`}
                className="playlist-card"
              >
                <Cover song={p} />
                <h3>{p.name}</h3>
                <p>
                  {p.song_count} songs · {p.is_public ? "Public" : "Just you"}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </motion.div>
  );
}
