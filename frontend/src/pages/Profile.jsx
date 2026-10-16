import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Camera, Heart, ListMusic, UserRound, Shield } from "lucide-react";
import { useApp } from "../contexts/AppContext";
import { useResource } from "../hooks/useResource";
import { api, mediaUrl } from "../services/api";
import {
  PageHeading,
  Field,
  Empty,
  ErrorState,
  Skeleton,
} from "../components/UI";
export default function ProfilePage() {
  const { user, setUser, notify, refresh, revision } = useApp(),
    navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const resource = useResource("/users/me", revision);
  const run = async (fn) => {
    setBusy(true);
    try {
      await fn();
      refresh();
    } catch (e) {
      notify(e.message, "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <PageHeading
        eyebrow="YOUR SPACE"
        title="A profile that’s all you."
        subtitle="The person behind the playlists."
      />
      <div className="profile-grid">
        <section className="panel profile-summary">
          <div className="profile-avatar">
            {user.profile_image ? (
              <img src={mediaUrl(user.profile_image)} alt="Your profile" />
            ) : (
              <UserRound size={52} />
            )}
            <label title="Change profile picture">
              <Camera size={17} />
              <input
                type="file"
                aria-label="Upload profile picture"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => {
                  if (!e.target.files[0]) return;
                  const form = new FormData();
                  form.append("avatar", e.target.files[0]);
                  run(async () => {
                    setUser(
                      await api("/users/me/avatar", {
                        method: "POST",
                        body: form,
                      }),
                    );
                    notify("Profile photo updated");
                  });
                }}
              />
            </label>
          </div>
          <h2>{user.name}</h2>
          <p>@{user.username}</p>
          <span className="pill">{user.account_type} account</span>
          <p className="profile-benefits">{user.benefits}</p>
          <div className="profile-counts">
            <Link to="/playlists">
              <ListMusic size={18} />
              <strong>{resource.data?.playlist_count ?? "—"}</strong>Playlists
            </Link>
            <Link to="/liked">
              <Heart size={18} />
              <strong>{resource.data?.favorite_count ?? "—"}</strong>Liked songs
            </Link>
          </div>
          {user.role === "admin" && (
            <Link to="/admin" className="text-link">
              <Shield size={16} />
              Admin dashboard
            </Link>
          )}
        </section>
        <div className="form-panels">
          <section className="panel">
            <h2>Your details</h2>
            <p className="muted">A name for your corner of the music world.</p>
            <form
              className="form-stack"
              onSubmit={(e) => {
                e.preventDefault();
                const body = Object.fromEntries(new FormData(e.currentTarget));
                run(async () => {
                  setUser(await api("/users/me", { method: "PUT", body }));
                  notify("Profile updated");
                });
              }}
            >
              <Field
                label="Display name"
                name="name"
                defaultValue={user.name}
                maxLength={100}
                required
              />
              <Field
                label="Username"
                name="username"
                defaultValue={user.username}
                pattern="[A-Za-z0-9_]{3,40}"
                required
              />
              <Field label="Email" value={user.email} disabled readOnly />
              <button className="button" disabled={busy}>
                Save changes
              </button>
            </form>
          </section>
          <section className="panel">
            <h2>Change password</h2>
            <p className="muted">
              Changing your password signs out all listening sessions.
            </p>
            <form
              className="form-stack"
              onSubmit={(e) => {
                e.preventDefault();
                const body = Object.fromEntries(new FormData(e.currentTarget));
                run(async () => {
                  await api("/users/me/password", { method: "PUT", body });
                  setUser(null);
                  notify("Password changed. Please sign in again.");
                  navigate("/login");
                });
              }}
            >
              <Field
                label="Current password"
                type="password"
                name="current_password"
                autoComplete="current-password"
                required
              />
              <Field
                label="New password"
                type="password"
                name="password"
                minLength={10}
                maxLength={128}
                autoComplete="new-password"
                required
              />
              <Field
                label="Confirm new password"
                type="password"
                name="confirm_password"
                minLength={10}
                maxLength={128}
                autoComplete="new-password"
                required
              />
              <button className="button secondary" disabled={busy}>
                Update password
              </button>
            </form>
          </section>
        </div>
      </div>
    </>
  );
}
export function ArtistsPage() {
  const { revision, refresh, notify } = useApp();
  const { data, error, loading } = useResource("/artists/followed", revision);
  return (
    <>
      <PageHeading
        eyebrow="YOUR COLLECTION"
        title="Your kind of people."
        subtitle="Keep your favorite artists close."
      />
      {loading ? (
        <Skeleton />
      ) : error ? (
        <ErrorState message={error} />
      ) : !data.length ? (
        <Empty
          title="Follow the sound you love"
          text="Open a song to follow its artist, then find them here."
        />
      ) : (
        <div className="artist-grid">
          {data.map((a) => (
            <div className="panel artist-card" key={a.id}>
              <div className="artist-avatar">{a.artist_name[0]}</div>
              <h3>{a.artist_name}</h3>
              <Link
                to={`/search?q=${encodeURIComponent(a.artist_name)}`}
                className="text-link"
              >
                Explore songs →
              </Link>
              <button
                className="button secondary"
                onClick={async () => {
                  try {
                    await api("/artists/follow", {
                      method: "DELETE",
                      body: { artist_name: a.artist_name },
                    });
                    refresh();
                  } catch (e) {
                    notify(e.message, "error");
                  }
                }}
              >
                Unfollow
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
