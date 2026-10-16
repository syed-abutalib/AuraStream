export async function api(path, options = {}) {
  const form = options.body instanceof FormData;
  let res;
  try {
    res = await fetch(`/api${path}`, {
      credentials: "same-origin",
      ...options,
      headers: {
        "X-Aura-Request": "1",
        ...(!form && options.body
          ? { "Content-Type": "application/json" }
          : {}),
        ...options.headers,
      },
      body: options.body
        ? form
          ? options.body
          : JSON.stringify(options.body)
        : undefined,
    });
  } catch {
    throw new Error(
      "Cannot reach AuraStream. Check that the C++ server is running.",
    );
  }
  let json;
  try {
    json = await res.json();
  } catch {
    throw new Error(
      "The server is unavailable. Start the C++ backend and try again.",
    );
  }
  if (!res.ok) {
    const error = new Error(
      json.error?.message || "Something went wrong. Please try again.",
    );
    error.status = res.status;
    throw error;
  }
  return json.data;
}
export const mediaUrl = (reference) =>
  reference ? `/api/media/${encodeURIComponent(reference)}` : "";
export function duration(seconds = 0) {
  const value = Number(seconds);
  const n = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}`;
}
export async function downloadSong(song) {
  const response = await fetch(`/api/songs/${song.id}/download`, {
    credentials: "same-origin",
  });
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error?.message || "Download failed");
  }
  const url = URL.createObjectURL(await response.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = `${song.artist} - ${song.title}.mp3`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
