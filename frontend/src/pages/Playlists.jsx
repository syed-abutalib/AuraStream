import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Plus,
  Play,
  Shuffle,
  Pencil,
  Trash2,
  Lock,
  Globe,
  ImagePlus,
} from "lucide-react";
import { useApp } from "../contexts/AppContext";
import { usePlayer } from "../contexts/PlayerContext";
import { useResource } from "../hooks/useResource";
import { api } from "../services/api";
import {
  Cover,
  PageHeading,
  Modal,
  Field,
  Empty,
  ErrorState,
  Skeleton,
} from "../components/UI";
import { SongTable } from "../components/Songs";
export function PlaylistModal({ close, playlist }) {
  const { notify, refresh } = useApp(),
    navigate = useNavigate();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const submit = async (e) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      const result = await api(
        playlist ? `/playlists/${playlist.id}` : "/playlists",
        {
          method: playlist ? "PUT" : "POST",
          body: {
            name: form.get("name"),
            description: form.get("description"),
            is_public: form.get("public") === "on",
          },
        },
      );
      notify(playlist ? "Playlist updated" : "Your new playlist is ready");
      refresh();
      close();
      navigate(`/playlists/${result.id}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      title={playlist ? "Make it your own" : "A new mix. A new mood."}
      onClose={close}
    >
      <form onSubmit={submit} className="form-stack">
        <Field
          label="Playlist name"
          name="name"
          placeholder="Late night thoughts"
          maxLength={150}
          defaultValue={playlist?.name}
          required
          autoFocus
        />
        <Field label="Description">
          <textarea
            name="description"
            placeholder="What’s the feeling?"
            maxLength={5000}
            defaultValue={playlist?.description}
          />
        </Field>
        <label className="checkbox">
          <input
            type="checkbox"
            name="public"
            defaultChecked={playlist?.is_public}
          />
          Make this playlist public
        </label>
        <p className="form-hint">
          Public playlists can be viewed by anyone with the link. Private
          playlists are only visible to you.
        </p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="button" disabled={busy}>
          {busy ? "Saving…" : playlist ? "Save changes" : "Create playlist"}
        </button>
      </form>
    </Modal>
  );
}
export function PlaylistsPage() {
  const { playlists } = useApp();
  const [create, setCreate] = useState(false);
  return (
    <>
      <PageHeading
        eyebrow="CURATED BY YOU"
        title="A little you. In every mix."
        subtitle="Collect the tracks that belong together."
      >
        <button className="button" onClick={() => setCreate(true)}>
          <Plus size={18} />
          Create playlist
        </button>
      </PageHeading>
      {playlists.length ? (
        <div className="playlist-grid">
          {playlists.map((p) => (
            <Link
              to={`/playlists/${p.id}`}
              key={p.id}
              className="playlist-card"
            >
              <Cover song={p} />
              <h3>{p.name}</h3>
              <p>
                {p.song_count} songs · {Math.round(p.total_duration / 60)} min ·{" "}
                {p.is_public ? "Public" : "Private"}
              </p>
            </Link>
          ))}
        </div>
      ) : (
        <Empty
          title="Every great mix starts somewhere"
          text="Give your favorites a place to belong."
          action={
            <button className="button" onClick={() => setCreate(true)}>
              <Plus size={17} />
              Create your first playlist
            </button>
          }
        />
      )}{" "}
      {create && <PlaylistModal close={() => setCreate(false)} />}
    </>
  );
}
export function PlaylistDetail() {
  const { id } = useParams(),
    { user, revision, refresh, notify } = useApp(),
    player = usePlayer(),
    navigate = useNavigate();
  const { data, loading, error } = useResource(`/playlists/${id}`, revision);
  const [edit, setEdit] = useState(false),
    [confirm, setConfirm] = useState(false);
  const run = async (fn) => {
    try {
      await fn();
      refresh();
    } catch (e) {
      notify(e.message, "error");
    }
  };
  if (loading) return <Skeleton />;
  if (error) return <ErrorState message={error} />;
  const owner = user?.id === data.user_id;
  const move = (index, offset) => {
    const ids = data.songs.map((s) => s.id);
    [ids[index], ids[index + offset]] = [ids[index + offset], ids[index]];
    run(() =>
      api(`/playlists/${id}/reorder`, {
        method: "PUT",
        body: { song_ids: ids },
      }),
    );
  };
  return (
    <>
      <div className="detail-hero">
        <div className="detail-art">
          <Cover song={data} />
          {owner && (
            <label className="cover-upload">
              <ImagePlus size={17} />
              Change cover
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => {
                  if (!e.target.files[0]) return;
                  const form = new FormData();
                  form.append("cover", e.target.files[0]);
                  run(() =>
                    api(`/playlists/${id}/cover`, {
                      method: "POST",
                      body: form,
                    }),
                  );
                }}
              />
            </label>
          )}
        </div>
        <div>
          <span className="eyebrow">
            {data.is_public ? <Globe size={13} /> : <Lock size={13} />}{" "}
            {data.is_public ? "PUBLIC PLAYLIST" : "YOUR PRIVATE MIX"}
          </span>
          <h1>{data.name}</h1>
          <p>{data.description || "A collection worth coming back to."}</p>
          <span className="detail-meta">
            {data.song_count} songs · {Math.round(data.total_duration / 60)}{" "}
            minutes
          </span>
        </div>
      </div>
      <div className="detail-actions">
        <button
          className="button"
          disabled={!data.songs.length}
          onClick={() => player.play(data.songs, data.songs[0])}
        >
          <Play size={18} fill="currentColor" />
          Play playlist
        </button>
        <button
          className="button secondary"
          disabled={!data.songs.length}
          onClick={() => player.play(data.songs, null, true)}
        >
          <Shuffle size={17} />
          Shuffle
        </button>
        {owner && (
          <>
            <button className="button ghost" onClick={() => setEdit(true)}>
              <Pencil size={16} />
              Edit
            </button>
            <button
              className="button ghost danger"
              onClick={() => setConfirm(true)}
            >
              <Trash2 size={16} />
              Delete
            </button>
          </>
        )}
      </div>
      {data.songs.length ? (
        <SongTable
          songs={data.songs}
          onMove={owner ? move : undefined}
          onRemove={
            owner
              ? (song) =>
                  run(() =>
                    api(`/playlists/${id}/songs/${song.id}`, {
                      method: "DELETE",
                    }),
                  )
              : undefined
          }
        />
      ) : (
        <Empty
          title="Set the mood"
          text="Use the plus button on any song to add it to this playlist."
          action={
            <Link className="button secondary" to="/library">
              Explore the library
            </Link>
          }
        />
      )}{" "}
      {edit && <PlaylistModal playlist={data} close={() => setEdit(false)} />}{" "}
      {confirm && (
        <Modal title="Delete this playlist?" onClose={() => setConfirm(false)}>
          <p>
            The playlist “{data.name}” will be removed. Its songs will remain in
            the music library.
          </p>
          <div className="dialog-actions">
            <button
              className="button secondary"
              onClick={() => setConfirm(false)}
            >
              Keep playlist
            </button>
            <button
              className="button danger-solid"
              onClick={() =>
                run(async () => {
                  await api(`/playlists/${id}`, { method: "DELETE" });
                  navigate("/playlists");
                })
              }
            >
              Delete playlist
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
