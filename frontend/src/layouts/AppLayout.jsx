import { useState } from "react";
import { NavLink, Link, Outlet, useNavigate } from "react-router-dom";
import {
  Home,
  Search,
  Library,
  Heart,
  History,
  Download,
  ListMusic,
  Plus,
  User,
  Shield,
  Menu,
  X,
  ArrowUpRight,
  LogOut,
  Headphones,
  Users,
} from "lucide-react";
import { Brand, IconButton } from "../components/UI";
import { useApp } from "../contexts/AppContext";
import MusicPlayer from "../components/MusicPlayer";
import { PlaylistModal } from "../pages/Playlists";
const navigation = [
  ["/", Home, "Home"],
  ["/search", Search, "Discover"],
  ["/library", Library, "Your library"],
];
const collection = [
  ["/liked", Heart, "Liked songs"],
  ["/history", History, "Recently played"],
  ["/downloads", Download, "Downloads"],
  ["/artists", Users, "Followed artists"],
];
export default function AppLayout() {
  const { user, playlists, logout } = useApp();
  const [open, setOpen] = useState(false),
    [create, setCreate] = useState(false),
    [search, setSearch] = useState("");
  const navigate = useNavigate();
  const nav = (links) =>
    links.map(([to, Icon, title]) => (
      <NavLink
        end={to === "/"}
        to={to}
        key={to}
        onClick={() => setOpen(false)}
        className={({ isActive }) => `nav-link ${isActive ? "selected" : ""}`}
      >
        <Icon size={19} />
        {title}
        {to === "/liked" && <span className="nav-heart-dot" />}
      </NavLink>
    ));
  return (
    <div className="app-shell">
      {open && (
        <button
          className="sidebar-shade"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
        />
      )}
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="sidebar-brand">
          <Brand />
          <IconButton
            className="mobile-only"
            icon={X}
            label="Close navigation"
            onClick={() => setOpen(false)}
          />
        </div>
        <nav>
          {nav(navigation)}
          <div className="nav-label">YOUR COLLECTION</div>
          {nav(collection)}
          <div className="nav-label playlist-label">
            <Link to="/playlists">YOUR PLAYLISTS</Link>
            <IconButton
              icon={Plus}
              label="Create playlist"
              onClick={() => (user ? setCreate(true) : navigate("/login"))}
            />
          </div>
          <div className="sidebar-playlists">
            {playlists.slice(0, 7).map((p) => (
              <NavLink
                key={p.id}
                to={`/playlists/${p.id}`}
                className="nav-link"
                onClick={() => setOpen(false)}
              >
                <ListMusic size={18} />
                <span className="ellipsis">{p.name}</span>
              </NavLink>
            ))}
            {!playlists.length && (
              <p className="sidebar-hint">
                A little you, in every playlist.
                <br />
                Make your first mix.
              </p>
            )}
            <button
              className="create-playlist"
              onClick={() => (user ? setCreate(true) : navigate("/login"))}
            >
              <Plus size={17} />
              Create playlist
            </button>
          </div>
          {user?.role === "admin" && (
            <>
              <div className="nav-label">MANAGE</div>
              {nav([["/admin", Shield, "Admin dashboard"]])}
            </>
          )}
        </nav>
        <div className="sidebar-bottom">
          <div className="listening-note">
            <Headphones size={20} />
            <div>
              Made for your moments<small>Your music. Your aura.</small>
            </div>
          </div>
          {user ? (
            <Link to="/profile" className="sidebar-profile">
              <span className="avatar">{user.name[0]}</span>
              <span>
                {user.name}
                <small>{user.account_type} account</small>
              </span>
              <ArrowUpRight size={16} />
            </Link>
          ) : (
            <Link className="button secondary wide" to="/signup">
              Join AuraStream <ArrowUpRight size={16} />
            </Link>
          )}
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <IconButton
            icon={Menu}
            label="Open navigation"
            className="mobile-only"
            onClick={() => setOpen(true)}
          />
          <form
            className="global-search"
            onSubmit={(e) => {
              e.preventDefault();
              navigate(`/search?q=${encodeURIComponent(search)}`);
            }}
          >
            <Search size={19} />
            <input
              aria-label="Search music"
              placeholder="Search songs, artists, albums…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <kbd>↵</kbd>
          </form>
          <div className="topbar-right">
            <span className="local-badge">
              <i />
              YOUR PERSONAL SOUNDSPACE
            </span>
            {user ? (
              <>
                <Link
                  to="/profile"
                  className="avatar"
                  aria-label="Open profile"
                >
                  {user.name[0]}
                </Link>
                <IconButton icon={LogOut} label="Sign out" onClick={logout} />
              </>
            ) : (
              <Link className="button small" to="/login">
                Sign in <ArrowUpRight size={16} />
              </Link>
            )}
          </div>
        </header>
        <main className="content">
          <Outlet />
        </main>
        <div className="content-footer">
          <span>AuraStream</span>
          <span>Good music. Better moments.</span>
          <span>EST. 2026</span>
        </div>
      </div>
      <MusicPlayer />
      {create && <PlaylistModal close={() => setCreate(false)} />}
    </div>
  );
}
