import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import {
  Users,
  Music2,
  ListMusic,
  Play,
  Download,
  Upload,
  Pencil,
  Trash2,
  ArrowUpRight,
  Search,
} from "lucide-react";
import { useApp } from "../contexts/AppContext";
import { useResource } from "../hooks/useResource";
import { api, duration } from "../services/api";
import {
  PageHeading,
  SectionHeading,
  Cover,
  Empty,
  Skeleton,
  ErrorState,
  Field,
  Modal,
  IconButton,
  Pagination,
} from "../components/UI";
export function AdminTabs() {
  return (
    <nav className="tabs">
      <NavLink end to="/admin">
        Overview
      </NavLink>
      <NavLink to="/admin/songs">Music catalog</NavLink>
      <NavLink to="/admin/users">Community</NavLink>
    </nav>
  );
}
export function AdminDashboard() {
  const { revision } = useApp();
  const { data, loading, error } = useResource("/admin/stats", revision);
  return (
    <>
      <PageHeading
        eyebrow="BEHIND THE MUSIC"
        title="Your soundspace, at a glance."
        subtitle="A little oversight. A better listening experience."
      >
        <Link className="button" to="/admin/songs">
          <Upload size={18} />
          Upload music
        </Link>
      </PageHeading>
      <AdminTabs />
      {loading ? (
        <Skeleton />
      ) : error ? (
        <ErrorState message={error} />
      ) : (
        <>
          <div className="stats-grid">
            {[
              ["total_users", "Listeners", Users],
              ["total_songs", "Tracks", Music2],
              ["total_playlists", "Playlists", ListMusic],
              ["total_plays", "Total plays", Play],
              ["total_downloads", "Downloads", Download],
            ].map(([key, label, Icon]) => (
              <div className="stat-card" key={key}>
                <Icon size={21} />
                <span>{label}</span>
                <strong>{data[key].toLocaleString()}</strong>
                <small>All time</small>
              </div>
            ))}
          </div>
          <div className="admin-overview-grid">
            {[
              ["Recently added", data.recent],
              ["Most played", data.popular],
            ].map(([title, songs]) => (
              <section className="panel" key={title}>
                <SectionHeading title={title} />
                {songs.length ? (
                  songs.map((s) => (
                    <Link
                      className="admin-mini-song"
                      to={`/songs/${s.id}`}
                      key={s.id}
                    >
                      <Cover song={s} />
                      <span>
                        {s.title}
                        <small>{s.artist}</small>
                      </span>
                      <span className="muted">{s.play_count} plays</span>
                    </Link>
                  ))
                ) : (
                  <Empty
                    title="Ready for the first track"
                    text="Upload legal audio to get the music flowing."
                  />
                )}
              </section>
            ))}
          </div>
          <section className="quiet-banner">
            <Music2 />
            <div>
              <h3>Share music responsibly.</h3>
              <p>
                Upload original, public-domain, or properly licensed music.
                Enable downloads only when your permission includes
                distribution.
              </p>
            </div>
          </section>
        </>
      )}
    </>
  );
}
function SongEditor({ song, close }) {
  const { notify, refresh } = useApp();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [seconds, setSeconds] = useState(song?.duration_seconds || "");
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(e.currentTarget);
    try {
      if (song)
        await api(`/admin/songs/${song.id}`, {
          method: "PUT",
          body: {
            title: form.get("title"),
            artist: form.get("artist"),
            album: form.get("album"),
            genre: form.get("genre"),
            duration_seconds: Number(form.get("duration_seconds")),
            is_downloadable: form.get("downloadable") === "on",
          },
        });
      else {
        form.set("is_downloadable", String(form.get("downloadable") === "on"));
        form.set("rights_confirmed", String(form.get("rights") === "on"));
        if (!form.get("cover").size) form.delete("cover");
        await api("/admin/songs", { method: "POST", body: form });
      }
      notify(song ? "Track updated" : "Your track is in the library");
      refresh();
      close();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const inspect = (file) => {
    if (!file) return;
    const url = URL.createObjectURL(file),
      audio = new Audio(url);
    audio.onloadedmetadata = () => {
      if (Number.isFinite(audio.duration))
        setSeconds(Math.ceil(audio.duration));
      URL.revokeObjectURL(url);
    };
    audio.onerror = () => URL.revokeObjectURL(url);
  };
  return (
    <Modal
      title={song ? "Edit this track" : "Bring a new sound to AuraStream"}
      onClose={close}
    >
      <form onSubmit={submit} className="form-stack">
        {!song && (
          <>
            <Field
              label="MP3 audio · up to 30 MB"
              type="file"
              name="audio"
              accept="audio/mpeg,.mp3"
              onChange={(e) => inspect(e.target.files[0])}
              required
            />
            <Field
              label="Cover artwork · PNG, JPG or WebP · up to 5 MB"
              type="file"
              name="cover"
              accept="image/png,image/jpeg,image/webp"
            />
          </>
        )}
        <div className="form-two">
          <Field
            label="Track title"
            name="title"
            defaultValue={song?.title}
            maxLength={200}
            required
          />
          <Field
            label="Artist"
            name="artist"
            defaultValue={song?.artist}
            maxLength={150}
            required
          />
        </div>
        <div className="form-two">
          <Field
            label="Album"
            name="album"
            defaultValue={song?.album}
            maxLength={150}
          />
          <Field
            label="Genre"
            name="genre"
            defaultValue={song?.genre}
            maxLength={100}
          />
        </div>
        <Field
          label="Duration in seconds"
          name="duration_seconds"
          type="number"
          min="1"
          max="86400"
          value={seconds}
          onChange={(e) => setSeconds(e.target.value)}
          required
        />
        <label className="checkbox">
          <input
            type="checkbox"
            name="downloadable"
            defaultChecked={song?.is_downloadable}
          />
          Allow listeners to download this MP3
        </label>
        {!song && (
          <label className="checkbox">
            <input type="checkbox" name="rights" required />I have permission to
            upload this recording and distribute it if downloads are enabled.
          </label>
        )}
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <button className="button" disabled={busy}>
          <Upload size={17} />
          {busy ? "Saving your track…" : song ? "Save changes" : "Upload track"}
        </button>
      </form>
    </Modal>
  );
}
export function AdminSongs() {
  const { revision, refresh, notify } = useApp();
  const [q, setQ] = useState(""),
    [page, setPage] = useState(1),
    [editor, setEditor] = useState(null),
    [deleting, setDeleting] = useState(null);
  const { data, loading, error } = useResource(
    `/admin/songs?q=${encodeURIComponent(q)}&page=${page}&limit=20`,
    revision,
  );
  return (
    <>
      <PageHeading
        eyebrow="BEHIND THE MUSIC"
        title="A library worth listening to."
        subtitle="Add, edit, and take care of your music catalog."
      >
        <button className="button" onClick={() => setEditor({})}>
          <Upload size={17} />
          Upload track
        </button>
      </PageHeading>
      <AdminTabs />
      <div className="search-input admin-search">
        <Search size={18} />
        <input
          aria-label="Search catalog"
          placeholder="Find a track or artist…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
      </div>
      {loading ? (
        <Skeleton />
      ) : error ? (
        <ErrorState message={error} />
      ) : !data.items.length ? (
        <Empty
          title="Make some room for music"
          text="Upload your first MP3 and give it a cover, a title, and a home."
          action={
            <button className="button" onClick={() => setEditor({})}>
              Upload track
            </button>
          }
        />
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Track</th>
                <th>Album / Genre</th>
                <th>Duration</th>
                <th>Plays</th>
                <th>Downloads</th>
                <th>Manage</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((s) => (
                <tr key={s.id}>
                  <td>
                    <div className="track-cell">
                      <Cover song={s} />
                      <span>
                        {s.title}
                        <small>{s.artist}</small>
                      </span>
                    </div>
                  </td>
                  <td>
                    {s.album || "Single"}
                    <small>{s.genre}</small>
                  </td>
                  <td>{duration(s.duration_seconds)}</td>
                  <td>{s.play_count}</td>
                  <td>
                    <span
                      className={`status-pill ${s.is_downloadable ? "enabled" : ""}`}
                    >
                      {s.is_downloadable ? "Allowed" : "Disabled"}
                    </span>
                  </td>
                  <td>
                    <IconButton
                      icon={Pencil}
                      label={`Edit ${s.title}`}
                      onClick={() => setEditor(s)}
                    />
                    <IconButton
                      icon={Trash2}
                      label={`Delete ${s.title}`}
                      onClick={() => setDeleting(s)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination data={data} page={page} setPage={setPage} />
      {editor && (
        <SongEditor
          song={editor.id ? editor : null}
          close={() => setEditor(null)}
        />
      )}{" "}
      {deleting && (
        <Modal title="Remove this track?" onClose={() => setDeleting(null)}>
          <p>
            “{deleting.title}” will be removed from the library, playlists,
            favorites, and history. Its uploaded audio and cover will be
            deleted.
          </p>
          <div className="dialog-actions">
            <button
              className="button secondary"
              onClick={() => setDeleting(null)}
            >
              Keep track
            </button>
            <button
              className="button danger-solid"
              onClick={async () => {
                try {
                  await api(`/admin/songs/${deleting.id}`, {
                    method: "DELETE",
                  });
                  setDeleting(null);
                  refresh();
                  notify("Track deleted");
                } catch (e) {
                  notify(e.message, "error");
                }
              }}
            >
              Delete track
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
export function AdminUsers() {
  const { revision, refresh, notify, user } = useApp();
  const [q, setQ] = useState(""),
    [page, setPage] = useState(1),
    [editing, setEditing] = useState(null);
  const { data, loading, error } = useResource(
    `/admin/users?q=${encodeURIComponent(q)}&page=${page}`,
    revision,
  );
  return (
    <>
      <PageHeading
        eyebrow="BEHIND THE MUSIC"
        title="The people in your soundspace."
        subtitle="Manage community access and academic account tiers."
      />
      <AdminTabs />
      <div className="search-input admin-search">
        <Search size={18} />
        <input
          aria-label="Search users"
          placeholder="Search name, username, email…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
      </div>
      {loading ? (
        <Skeleton />
      ) : error ? (
        <ErrorState message={error} />
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Listener</th>
                <th>Email</th>
                <th>Role</th>
                <th>Account</th>
                <th>Joined</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.items.map((u) => (
                <tr key={u.id}>
                  <td>
                    {u.name}
                    <small>@{u.username}</small>
                  </td>
                  <td>{u.email}</td>
                  <td>
                    <span className="status-pill enabled">{u.role}</span>
                  </td>
                  <td>{u.account_type}</td>
                  <td>{u.created_at.slice(0, 10)}</td>
                  <td>
                    <IconButton
                      icon={Pencil}
                      label={`Edit ${u.username}`}
                      onClick={() => setEditing(u)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination data={data} page={page} setPage={setPage} />
      {editing && (
        <Modal
          title={`Manage ${editing.name}`}
          onClose={() => setEditing(null)}
        >
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              const body = Object.fromEntries(new FormData(e.currentTarget));
              try {
                await api(`/admin/users/${editing.id}`, {
                  method: "PUT",
                  body,
                });
                setEditing(null);
                refresh();
                notify("Account updated");
              } catch (e) {
                notify(e.message, "error");
              }
            }}
          >
            <Field label="Role">
              <select name="role" defaultValue={editing.role}>
                <option value="user" disabled={editing.id === user.id}>
                  User
                </option>
                <option value="admin">Admin</option>
              </select>
            </Field>
            <Field label="Account tier">
              <select name="account_type" defaultValue={editing.account_type}>
                <option value="free">Free · 20 playlists</option>
                <option value="premium">Premium · 200 playlists</option>
              </select>
            </Field>
            <p className="form-hint">
              Account tiers demonstrate C++ inheritance. No billing is involved.
              You cannot remove your own admin access.
            </p>
            <button className="button">Save account</button>
          </form>
        </Modal>
      )}
    </>
  );
}
