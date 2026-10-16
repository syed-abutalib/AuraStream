import { BrowserRouter, Routes, Route, Navigate, Link } from "react-router-dom";
import { AppProvider, useApp } from "./contexts/AppContext";
import { PlayerProvider } from "./contexts/PlayerContext";
import AppLayout from "./layouts/AppLayout";
import Home from "./pages/Home";
import Auth from "./pages/Auth";
import Library from "./pages/Library";
import { PlaylistsPage, PlaylistDetail } from "./pages/Playlists";
import Profile, { ArtistsPage } from "./pages/Profile";
import SongDetail from "./pages/SongDetail";
import { AdminDashboard, AdminSongs, AdminUsers } from "./pages/Admin";
import { Empty, Skeleton } from "./components/UI";
function Protected({ children, admin = false }) {
  const { user, authLoading } = useApp();
  if (authLoading) return <Skeleton />;
  if (!user) return <Navigate to="/login" replace />;
  if (admin && user.role !== "admin")
    return (
      <Empty
        title="This space is for administrators"
        text="Head back to your library to keep listening."
        action={
          <Link to="/" className="button">
            Go home
          </Link>
        }
      />
    );
  return children;
}
export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <PlayerProvider>
          <Routes>
            <Route path="login" element={<Auth />} />
            <Route path="signup" element={<Auth signup />} />
            <Route element={<AppLayout />}>
              <Route index element={<Home />} />
              <Route path="search" element={<Library mode="search" />} />
              <Route path="library" element={<Library />} />
              <Route path="songs/:id" element={<SongDetail />} />
              {[
                ["liked", "liked"],
                ["history", "history"],
                ["downloads", "downloads"],
              ].map(([path, mode]) => (
                <Route
                  key={path}
                  path={path}
                  element={
                    <Protected>
                      <Library mode={mode} />
                    </Protected>
                  }
                />
              ))}
              <Route
                path="playlists"
                element={
                  <Protected>
                    <PlaylistsPage />
                  </Protected>
                }
              />
              <Route path="playlists/:id" element={<PlaylistDetail />} />
              <Route
                path="artists"
                element={
                  <Protected>
                    <ArtistsPage />
                  </Protected>
                }
              />
              <Route
                path="profile"
                element={
                  <Protected>
                    <Profile />
                  </Protected>
                }
              />
              <Route
                path="admin"
                element={
                  <Protected admin>
                    <AdminDashboard />
                  </Protected>
                }
              />
              <Route
                path="admin/songs"
                element={
                  <Protected admin>
                    <AdminSongs />
                  </Protected>
                }
              />
              <Route
                path="admin/users"
                element={
                  <Protected admin>
                    <AdminUsers />
                  </Protected>
                }
              />
              <Route
                path="*"
                element={
                  <Empty
                    title="This track seems to be missing."
                    text="The page you’re looking for isn’t here."
                    action={
                      <Link to="/" className="button">
                        Back to home
                      </Link>
                    }
                  />
                }
              />
            </Route>
          </Routes>
        </PlayerProvider>
      </AppProvider>
    </BrowserRouter>
  );
}
