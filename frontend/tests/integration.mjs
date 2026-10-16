// End-to-end tests run the actual C++ server against an isolated MariaDB schema.
// Node is a test runner / frontend tool only; no Node business API exists.
import { spawn, execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const output = path.join(root, "test-results");
mkdirSync(output, { recursive: true });
const runId = Date.now().toString();
const dbName = `aurastream_test_${runId}`;
const mysql = process.env.MYSQL_BIN || "C:/xampp/mysql/bin/mysql.exe";
const sql = (statement) =>
  execFileSync(
    mysql,
    [
      "--host=127.0.0.1",
      "--user=root",
      "--batch",
      "--skip-column-names",
      "--execute",
      statement,
    ],
    { encoding: "utf8", windowsHide: true },
  );
const env = {
  ...process.env,
  DB_NAME: dbName,
  PORT: "8081",
  APP_ORIGIN: "http://localhost:5174",
  UPLOAD_ROOT: path.join(output, `uploads-${runId}`),
};
const executable = path.join(root, "build/backend/Release/aurastream.exe");
let backend, vite, browser;
const logs = [];
const checks = [];
let dbCreated = false;
const check = (condition, message) => {
  assert(condition, message);
  checks.push(message);
  console.log(`PASS ${message}`);
};
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const waitUrl = async (url) => {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {}
    await pause(200);
  }
  throw Error(`Server did not start: ${url}\n${logs.join("")}`);
};
class Client {
  cookie = "";
  async request(route, method = "GET", body, expected = 200, extra = {}) {
    const form = body instanceof FormData;
    const res = await fetch(`http://127.0.0.1:8081/api${route}`, {
      method,
      headers: {
        "X-Aura-Request": "1",
        Cookie: this.cookie,
        ...(body && !form ? { "Content-Type": "application/json" } : {}),
        ...extra,
      },
      body: body ? (form ? body : JSON.stringify(body)) : undefined,
    });
    const cookie = res.headers.get("set-cookie");
    if (cookie) this.cookie = cookie.split(";")[0];
    const text = await res.text();
    assert.equal(res.status, expected, `${method} ${route}: ${text}`);
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return text;
    }
    return expected < 400 ? data.data : data;
  }
}
try {
  check(existsSync(executable), "compiled C++ executable exists");
  sql(
    `CREATE DATABASE ${dbName} CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci`,
  );
  dbCreated = true;
  execFileSync(mysql, ["--host=127.0.0.1", "--user=root", dbName], {
    input: readFileSync(path.join(root, "database/schema.sql")),
    windowsHide: true,
  });
  backend = spawn(executable, [], { cwd: root, env, windowsHide: true });
  backend.stdout.on("data", (d) => logs.push(d.toString()));
  backend.stderr.on("data", (d) => logs.push(d.toString()));
  await waitUrl("http://127.0.0.1:8081/api/health");
  check(true, "Drogon connects to XAMPP MariaDB");
  const admin = new Client(),
    user = new Client(),
    stranger = new Client(),
    guest = new Client();
  const password = `Aura-${runId}-strong`;
  const register = (name) => ({
    name,
    username: name,
    email: `${name}@example.test`,
    password,
    confirm_password: password,
  });
  await guest.request("/auth/me", "GET", undefined, 401);
  await guest.request("/admin/stats", "GET", undefined, 401);
  check(true, "unauthenticated private routes are protected");
  await guest.request(
    "/auth/register",
    "POST",
    { ...register("bad"), password: "short", confirm_password: "short" },
    400,
  );
  check(true, "registration rejects short passwords");
  const a = await admin.request(
    "/auth/register",
    "POST",
    register("qa_admin"),
    201,
  );
  const u = await user.request(
    "/auth/register",
    "POST",
    register("qa_listener"),
    201,
  );
  await stranger.request("/auth/register", "POST", register("qa_other"), 201);
  await guest.request("/auth/register", "POST", register("qa_listener"), 409);
  check(true, "duplicate usernames and emails rejected");
  await user.request("/admin/stats", "GET", undefined, 403);
  check(true, "regular users cannot access admin APIs");
  const stored = sql(
    `SELECT password_hash FROM ${dbName}.users WHERE id=${u.id}`,
  ).trim();
  check(
    stored.startsWith("$argon2id$") && !stored.includes(password),
    "password stored as Argon2id hash",
  );
  execFileSync(executable, ["--init-admin", "qa_admin"], {
    cwd: root,
    env,
    windowsHide: true,
  });
  await admin.request("/admin/stats");
  check(true, "first-admin CLI promotes only the selected registered user");
  await admin.request(
    `/admin/users/${a.id}`,
    "PUT",
    { role: "user", account_type: "free" },
    409,
  );
  check(true, "self-demotion cannot remove admin access");
  const tone = path.join(output, "original-test-tone.mp3");
  const ffmpeg = path.join(
    root,
    "frontend/node_modules/@ffmpeg-installer/win32-x64/ffmpeg.exe",
  );
  execFileSync(
    ffmpeg,
    [
      "-y",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=440:duration=12",
      "-af",
      "volume=0.1",
      "-codec:a",
      "libmp3lame",
      "-b:a",
      "128k",
      tone,
    ],
    { windowsHide: true, stdio: "ignore" },
  );
  const upload = async (title, downloadable = true) => {
    const form = new FormData();
    for (const [key, value] of Object.entries({
      title,
      artist: "AuraStream Test Studio",
      album: "Original Test Tones",
      genre: "Ambient",
      duration_seconds: "12",
      is_downloadable: String(downloadable),
      rights_confirmed: "true",
    }))
      form.set(key, value);
    form.set(
      "audio",
      new Blob([readFileSync(tone)], { type: "audio/mpeg" }),
      "tone.mp3",
    );
    return admin.request("/admin/songs", "POST", form, 201);
  };
  const s1 = await upload("Amber Frequency"),
    s2 = await upload("Blue Hour", false);
  check(true, "admin uploads real encoded MP3 files and metadata");
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aYvUAAAAASUVORK5CYII=",
    "base64",
  );
  const avatar = new FormData();
  avatar.set("avatar", new Blob([png], { type: "image/png" }), "avatar.png");
  const profileWithImage = await user.request(
    "/users/me/avatar",
    "POST",
    avatar,
  );
  check(
    Boolean(profileWithImage.profile_image),
    "validated profile image is stored and linked to user",
  );
  const servedImage = await fetch(
    `http://127.0.0.1:8081/api/media/${profileWithImage.profile_image}`,
  );
  check(
    servedImage.status === 200 &&
      servedImage.headers.get("content-type").includes("image/png"),
    "uploaded image is served with its raster content type",
  );
  const badImage = new FormData();
  badImage.set(
    "avatar",
    new Blob(['<svg onload="alert(1)"></svg>']),
    "image.png",
  );
  await user.request("/users/me/avatar", "POST", badImage, 415);
  check(true, "active content disguised as an image is rejected");
  const invalid = new FormData();
  for (const [key, value] of Object.entries({
    title: "Invalid",
    artist: "Test",
    duration_seconds: "12",
    rights_confirmed: "true",
  }))
    invalid.set(key, value);
  invalid.set("audio", new Blob(["not audio"]), "bad.mp3");
  await admin.request("/admin/songs", "POST", invalid, 415);
  check(true, "disguised non-audio uploads rejected by file contents");
  const library = await user.request("/songs?q=Amber&sort=title");
  check(
    library.items.length === 1 && library.items[0].id === s1.id,
    "database search and sort return expected track",
  );
  const cppSearch = await user.request("/songs/algorithms?q=blue&sort=title");
  check(
    cppSearch.length === 1 && cppSearch[0].id === s2.id,
    "C++ vector searching and sorting endpoint is active",
  );
  const range = await fetch(`http://127.0.0.1:8081/api/songs/${s1.id}/audio`, {
    headers: { Range: "bytes=10-109" },
  });
  check(
    range.status === 206 &&
      (await range.arrayBuffer()).byteLength === 100 &&
      range.headers.get("content-range").startsWith("bytes 10-109/"),
    "HTTP byte ranges support actual seeking",
  );
  const suffix = await fetch(`http://127.0.0.1:8081/api/songs/${s1.id}/audio`, {
    headers: { Range: "bytes=-50" },
  });
  check(
    suffix.status === 206 && (await suffix.arrayBuffer()).byteLength === 50,
    "suffix ranges supported",
  );
  await user.request(`/songs/${s1.id}/audio`, "GET", undefined, 416, {
    Range: "bytes=999999999-",
  });
  await user.request("/songs/999999/audio", "GET", undefined, 404);
  check(true, "invalid ranges and missing songs handled");
  let queue = await user.request("/queue", "POST", {
    song_ids: [s1.id, s2.id],
    replace: true,
  });
  check(queue.current_id === s1.id, "C++ queue accepts ordered songs");
  check(
    (await user.request("/queue/next", "POST", {})).selected_id === s2.id,
    "C++ linked-list next works",
  );
  check(
    (await user.request("/queue/next", "POST", {})).exhausted,
    "queue exhaustion is explicit",
  );
  check(
    (await user.request("/queue/previous", "POST", {})).selected_id === s1.id,
    "stack-based previous works",
  );
  check(
    (await stranger.request("/queue")).items.length === 0,
    "session queues are isolated",
  );
  await user.request("/history", "POST", { song_id: s1.id });
  await user.request("/history", "POST", { song_id: s1.id });
  check(
    (await user.request("/history")).total === 1,
    "history throttles duplicate playback events",
  );
  await user.request("/favorites", "POST", { song_id: s1.id });
  await user.request("/favorites", "POST", { song_id: s1.id });
  check(
    (await user.request("/favorites")).total === 1,
    "favorites are persistent and idempotent",
  );
  const p = await user.request(
    "/playlists",
    "POST",
    {
      name: "Night Drive",
      description: "Integration playlist",
      is_public: false,
    },
    201,
  );
  await user.request(`/playlists/${p.id}/songs`, "POST", { song_id: s1.id });
  await user.request(`/playlists/${p.id}/songs`, "POST", { song_id: s2.id });
  await user.request(`/playlists/${p.id}/reorder`, "PUT", {
    song_ids: [s2.id, s1.id],
  });
  check(
    (await user.request(`/playlists/${p.id}`)).songs[0].id === s2.id,
    "playlist create, add and transactional reorder work",
  );
  await stranger.request(`/playlists/${p.id}`, "GET", undefined, 404);
  await stranger.request(
    `/playlists/${p.id}`,
    "PUT",
    { name: "hijack", is_public: true },
    404,
  );
  await user.request(
    `/playlists/${p.id}/reorder`,
    "PUT",
    { song_ids: [s1.id, s1.id] },
    400,
  );
  check(true, "playlist privacy, ownership and reorder integrity enforced");
  await user.request(`/playlists/${p.id}`, "PUT", {
    name: "Night Drive",
    description: "Public mix",
    is_public: true,
  });
  check(
    (await guest.request(`/playlists/${p.id}`)).is_public,
    "public playlists are shareable",
  );
  await user.request("/artists/follow", "POST", {
    artist_name: "aurastream test studio",
  });
  check(
    (await user.request("/artists/followed"))[0].artist_name ===
      "AuraStream Test Studio",
    "artist names use canonical database spelling",
  );
  await user.request(`/songs/${s2.id}/download`, "GET", undefined, 403);
  const dl = await fetch(`http://127.0.0.1:8081/api/songs/${s1.id}/download`, {
    headers: { Cookie: user.cookie },
  });
  check(
    dl.status === 200 &&
      dl.headers.get("content-disposition").includes("attachment") &&
      (await dl.arrayBuffer()).byteLength > 1000,
    "authorized MP3 download delivers a real file",
  );
  check(
    (await user.request("/downloads/history")).total === 1 &&
      (await user.request(`/songs/${s1.id}`)).download_count === 1,
    "download record and counter commit together",
  );
  const unsafe = await fetch("http://127.0.0.1:8081/api/favorites", {
    method: "POST",
    headers: { Cookie: user.cookie, "Content-Type": "application/json" },
    body: JSON.stringify({ song_id: s2.id }),
  });
  check(unsafe.status === 403, "mutating API requires CSRF request header");
  await user.request("/favorites", "POST", { song_id: s2.id }, 403, {
    Origin: "https://attacker.invalid",
  });
  check(true, "cross-origin mutations rejected");
  await user.request("/users/me", "PUT", {
    name: "Test Listener",
    username: "qa_listener",
  });
  check(
    (await user.request("/auth/me")).name === "Test Listener",
    "profile edits are persisted",
  );
  await user.request("/auth/logout", "POST", {});
  await user.request("/auth/me", "GET", undefined, 401);
  await user.request(
    "/auth/login",
    "POST",
    { login: "qa_listener", password: "wrong password" },
    401,
  );
  await user.request("/auth/login", "POST", { login: "qa_listener", password });
  check(
    (await user.request("/favorites")).total === 1,
    "logout invalidates cookie and login restores database favorites",
  );
  vite = spawn(
    process.execPath,
    [
      "node_modules/vite/bin/vite.js",
      "--host",
      "127.0.0.1",
      "--port",
      "5174",
      "--strictPort",
    ],
    {
      cwd: path.join(root, "frontend"),
      env: { ...process.env, API_PROXY: "http://127.0.0.1:8081" },
      windowsHide: true,
    },
  );
  vite.stdout.on("data", (d) => logs.push(d.toString()));
  vite.stderr.on("data", (d) => logs.push(d.toString()));
  await waitUrl("http://localhost:5174");
  browser = await chromium.launch({ headless: true, channel: "chrome" });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://localhost:5174/login");
  await page.getByLabel("Email or username").fill("qa_listener");
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("http://localhost:5174/");
  await page.getByRole("heading", { name: "Welcome back, Test." }).waitFor();
  await page.locator(".song-card").first().waitFor();
  await page.screenshot({
    path: path.join(output, "desktop-home.png"),
    fullPage: true,
  });
  check(true, "browser login and personalized home work");
  await page.locator(".song-card").first().waitFor();
  await page.goto("http://localhost:5174/library?sort=title");
  await page
    .getByRole("button", { name: "Play Amber Frequency", exact: true })
    .click();
  await page.waitForFunction(() => {
    const a = document.querySelector("audio");
    return a && !a.paused && a.currentTime > 0.25;
  });
  check(true, "browser decodes and plays real MP3 audio");
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  check(
    await page.locator("audio").evaluate((a) => a.paused),
    "pause control affects HTML5 Audio",
  );
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await page.getByLabel("Playback position").fill("5");
  await page.waitForFunction(
    () => document.querySelector("audio").currentTime >= 5,
  );
  check(true, "player seek reaches requested audio position");
  await page.getByLabel("Volume", { exact: true }).fill("0.3");
  check(
    await page
      .locator("audio")
      .evaluate((a) => Math.abs(a.volume - 0.3) < 0.01),
    "volume control updates actual audio",
  );
  const beforeNavigation = await page
    .locator("audio")
    .evaluate((a) => a.currentTime);
  await page
    .getByRole("link", { name: "Liked songs", exact: true })
    .first()
    .click();
  check(
    (await page.locator("audio").evaluate((a) => a.currentTime)) >=
      beforeNavigation,
    "playback survives React route navigation",
  );
  await page.getByRole("button", { name: "Next song", exact: true }).click();
  await page
    .locator(".now-playing .song-title")
    .filter({ hasText: "Blue Hour" })
    .waitFor();
  check(true, "browser next control uses C++ queue");
  await page.getByRole("button", { name: "Shuffle", exact: true }).click();
  await page.waitForFunction(() =>
    document
      .querySelector('button[aria-label="Shuffle"]')
      .classList.contains("active"),
  );
  const shuffled = await page.evaluate(
    async () => (await (await fetch("/api/queue")).json()).data,
  );
  check(
    shuffled.items[0].id === s2.id && shuffled.current_id === s2.id,
    "shuffle updates the C++ queue without replacing current audio",
  );
  await page.getByRole("button", { name: "Shuffle", exact: true }).click();
  await page.getByRole("button", { name: "Repeat: off", exact: true }).click();
  await page.getByRole("button", { name: "Next song", exact: true }).click();
  await page
    .locator(".now-playing .song-title")
    .filter({ hasText: "Amber Frequency" })
    .waitFor();
  check(true, "repeat-all wraps the browser playback queue");
  await page.getByRole("button", { name: "Open queue", exact: true }).click();
  await page.getByRole("complementary", { name: "Playback queue" }).waitFor();
  await page.getByRole("button", { name: "Close queue" }).click();
  await page
    .getByRole("button", { name: "Create playlist", exact: true })
    .first()
    .click();
  await page.getByLabel("Playlist name", { exact: true }).fill("Browser mix");
  await page
    .getByLabel("Description", { exact: true })
    .fill("Made through React");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Create playlist", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Browser mix", exact: true })
    .waitFor();
  check(true, "browser playlist creation is persisted through C++");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://localhost:5174/");
  await page.getByRole("heading", { name: "Welcome back, Test." }).waitFor();
  await page.locator(".song-card").first().waitFor();
  await page.waitForFunction(() => !document.querySelector(".skeleton"));
  await page.screenshot({
    path: path.join(output, "mobile-home.png"),
    fullPage: true,
  });
  check(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "mobile home has no horizontal overflow",
  );
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("link", { name: "Your library", exact: true }).click();
  await page.waitForURL("http://localhost:5174/library");
  await page
    .getByRole("heading", { name: "Your library", exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "Play Amber Frequency", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Expand player", exact: true })
    .last()
    .click();
  await page.locator(".music-player.expanded").waitFor();
  await page.screenshot({ path: path.join(output, "mobile-player.png") });
  await page.getByRole("button", { name: "Collapse player" }).click();
  check(true, "mobile navigation and expanded player work");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`http://localhost:5174/songs/${s1.id}`);
  await page.getByRole("button", { name: "Liked", exact: true }).click();
  await page.getByRole("button", { name: "Like song", exact: true }).waitFor();
  await page.getByRole("button", { name: "Like song", exact: true }).click();
  await page.getByRole("button", { name: "Liked", exact: true }).waitFor();
  check(true, "browser like and unlike controls stay synchronized");
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download MP3", exact: true }).click();
  const savedDownload = await downloadEvent;
  check(
    savedDownload.suggestedFilename().endsWith(".mp3"),
    "browser download button produces an MP3 file download",
  );
  const adminPage = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  adminPage.on("pageerror", (e) => errors.push(e.message));
  await adminPage.goto("http://localhost:5174/login");
  await adminPage.getByLabel("Email or username").fill("qa_admin");
  await adminPage.getByLabel("Password", { exact: true }).fill(password);
  await adminPage.getByRole("button", { name: "Sign in", exact: true }).click();
  await adminPage.waitForURL("http://localhost:5174/");
  await adminPage.goto("http://localhost:5174/admin");
  await adminPage.locator(".stat-card").first().waitFor();
  await adminPage.screenshot({
    path: path.join(output, "admin-dashboard.png"),
    fullPage: true,
  });
  check(
    (await adminPage.locator(".stat-card").count()) === 5,
    "admin dashboard renders real aggregate statistics",
  );
  await adminPage
    .getByRole("link", { name: "Music catalog", exact: true })
    .click();
  await adminPage
    .getByRole("button", { name: "Upload track", exact: true })
    .first()
    .click();
  await adminPage.getByLabel("MP3 audio · up to 30 MB").setInputFiles(tone);
  await adminPage
    .getByLabel("Track title", { exact: true })
    .fill("UI Upload Verification");
  await adminPage
    .getByLabel("Artist", { exact: true })
    .fill("AuraStream Test Studio");
  await adminPage.getByLabel("Album", { exact: true }).fill("UI test");
  await adminPage.getByLabel("Genre", { exact: true }).fill("Ambient");
  await adminPage.getByLabel("Duration in seconds").fill("12");
  await adminPage
    .getByLabel(
      "I have permission to upload this recording and distribute it if downloads are enabled.",
    )
    .check();
  await adminPage
    .getByRole("dialog")
    .getByRole("button", { name: "Upload track", exact: true })
    .click();
  await adminPage
    .getByRole("button", { name: "Edit UI Upload Verification", exact: true })
    .waitFor();
  check(true, "admin upload form sends real multipart media through React");
  await adminPage
    .getByRole("button", { name: "Edit UI Upload Verification", exact: true })
    .click();
  await adminPage
    .getByLabel("Track title", { exact: true })
    .fill("UI Revised Verification");
  await adminPage
    .getByRole("button", { name: "Save changes", exact: true })
    .click();
  await adminPage
    .getByRole("button", {
      name: "Delete UI Revised Verification",
      exact: true,
    })
    .click();
  await adminPage
    .getByRole("button", { name: "Delete track", exact: true })
    .click();
  await adminPage
    .getByRole("button", {
      name: "Delete UI Revised Verification",
      exact: true,
    })
    .waitFor({ state: "detached" });
  check(true, "admin metadata editing and confirmed deletion work in browser");
  await adminPage.getByRole("link", { name: "Community", exact: true }).click();
  await adminPage.getByLabel("Search users").fill("qa_listener");
  await adminPage
    .getByRole("button", { name: "Edit qa_listener", exact: true })
    .click();
  await adminPage
    .getByLabel("Account tier", { exact: true })
    .selectOption("premium");
  await adminPage
    .getByRole("button", { name: "Save account", exact: true })
    .click();
  await adminPage.getByRole("dialog").waitFor({ state: "detached" });
  check(
    (await user.request("/auth/me")).playlist_limit === 200,
    "admin user-management UI updates the account tier",
  );
  await adminPage.close();
  check(
    errors.length === 0,
    `browser has no uncaught React errors (${errors.join("; ")})`,
  );
  await user.request(`/favorites/${s1.id}`, "DELETE");
  await user.request("/artists/follow", "DELETE", {
    artist_name: "AuraStream Test Studio",
  });
  await user.request(`/playlists/${p.id}/songs/${s1.id}`, "DELETE");
  await user.request(`/playlists/${p.id}`, "DELETE");
  check(true, "unlike, unfollow, playlist removal and deletion work");
  await user.request("/users/me/password", "PUT", {
    current_password: password,
    password: `${password}-new`,
    confirm_password: `${password}-new`,
  });
  await user.request("/auth/me", "GET", undefined, 401);
  check(true, "password change invalidates active sessions");
  await admin.request(`/admin/songs/${s1.id}`, "DELETE");
  await admin.request(`/songs/${s1.id}`, "GET", undefined, 404);
  check(true, "admin deletion and foreign-key cleanup work");
  const missing = await upload("Missing file fixture");
  sql(
    `UPDATE ${dbName}.songs SET audio_path='not-present.mp3' WHERE id=${missing.id}`,
  );
  await admin.request(`/songs/${missing.id}/audio`, "GET", undefined, 404);
  await admin.request(`/songs/${missing.id}/download`, "GET", undefined, 404);
  sql(
    `UPDATE ${dbName}.songs SET audio_path='../private.mp3' WHERE id=${missing.id}`,
  );
  await admin.request(`/songs/${missing.id}/audio`, "GET", undefined, 400);
  check(true, "missing stored media and database path traversal are rejected");
  const beforeInvalid = await admin.request("/songs?sort=title&limit=1&page=2");
  check(
    beforeInvalid.items.length === 1 && beforeInvalid.total === 2,
    "catalog pagination returns the requested page",
  );
  await admin.request("/queue", "POST", { song_ids: [s2.id], replace: true });
  await admin.request(
    "/queue",
    "POST",
    { song_ids: [missing.id], replace: true, current_id: 999999 },
    400,
  );
  check(
    (await admin.request("/queue")).current_id === s2.id,
    "invalid queue updates do not mutate existing state",
  );
  await admin.request(`/admin/users/${u.id}`, "PUT", {
    role: "user",
    account_type: "premium",
  });
  await user.request("/auth/login", "POST", {
    login: "qa_listener",
    password: `${password}-new`,
  });
  check(
    (await user.request("/users/me")).playlist_limit === 200,
    "admin tier change uses PremiumUser runtime behavior",
  );
  let limited = false;
  for (let attempt = 0; attempt < 35; attempt++) {
    const r = await fetch("http://127.0.0.1:8081/api/auth/login", {
      method: "POST",
      headers: { "X-Aura-Request": "1", "Content-Type": "application/json" },
      body: JSON.stringify({ login: "absent", password: "wrong-password" }),
    });
    if (r.status === 429) {
      limited = true;
      break;
    }
  }
  check(limited, "authentication requests are rate limited");
  console.log(`\n${checks.length} integration checks passed.`);
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  if (vite) vite.kill();
  if (backend) backend.kill();
  await pause(300);
  writeFileSync(path.join(output, "integration-server.log"), logs.join(""));
  writeFileSync(
    path.join(output, "integration-report.json"),
    JSON.stringify(
      { passed: checks.length, success: !process.exitCode, checks },
      null,
      2,
    ),
  );
  // This unique schema was created by this invocation; aurastream is never modified.
  if (dbCreated && /^aurastream_test_\d+$/.test(dbName))
    sql(`DROP DATABASE ${dbName}`);
}
