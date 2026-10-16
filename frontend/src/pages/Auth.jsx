import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { ArrowRight, AudioLines, Headphones } from "lucide-react";
import { useApp } from "../contexts/AppContext";
import { api } from "../services/api";
import { Brand, Field } from "../components/UI";
export default function AuthPage({ signup = false }) {
  const { user, setUser } = useApp(),
    navigate = useNavigate();
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  if (user) return <Navigate to="/" replace />;
  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    const body = Object.fromEntries(new FormData(e.currentTarget));
    try {
      setUser(
        await api(signup ? "/auth/register" : "/auth/login", {
          method: "POST",
          body,
        }),
      );
      navigate("/");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="auth-page">
      <section className="auth-art">
        <Brand />
        <div>
          <span className="eyebrow">YOUR PERSONAL SOUNDSPACE</span>
          <h1>
            Good music.
            <br />
            Better <em>moments.</em>
          </h1>
          <p>
            For the long way home.
            <br />
            For the one-more-song nights.
            <br />
            For whatever feels like you.
          </p>
          <div className="auth-record">
            <div />
            <AudioLines size={70} />
          </div>
        </div>
        <span className="auth-foot">
          <Headphones size={16} />
          Your music. Your aura.
        </span>
      </section>
      <section className="auth-form">
        <Link to="/" className="back-link">
          ← Back to the music
        </Link>
        <div className="auth-form-inner">
          <span className="eyebrow">
            {signup ? "MAKE YOURSELF AT HOME" : "WELCOME TO YOUR SOUNDSPACE"}
          </span>
          <h2>
            {signup
              ? "Find your people.\nFind your sound."
              : "Good to have you back."}
          </h2>
          <p>
            {signup
              ? "Your next favorite moment starts here."
              : "Sign in and pick up where you left off."}
          </p>
          <form className="form-stack" onSubmit={submit}>
            {signup ? (
              <>
                <Field
                  label="Full name"
                  name="name"
                  autoComplete="name"
                  maxLength={100}
                  required
                />
                <Field
                  label="Username"
                  name="username"
                  pattern="[A-Za-z0-9_]{3,40}"
                  title="3–40 letters, numbers or underscores"
                  autoComplete="username"
                  required
                />
                <Field
                  label="Email address"
                  type="email"
                  name="email"
                  autoComplete="email"
                  maxLength={150}
                  required
                />
              </>
            ) : (
              <Field
                label="Email or username"
                name="login"
                autoComplete="username"
                required
              />
            )}
            <Field
              label="Password"
              type="password"
              name="password"
              minLength={signup ? 10 : undefined}
              maxLength={128}
              autoComplete={signup ? "new-password" : "current-password"}
              required
            />
            {signup && (
              <Field
                label="Confirm password"
                type="password"
                name="confirm_password"
                minLength={10}
                maxLength={128}
                autoComplete="new-password"
                required
              />
            )}
            {signup && (
              <p className="form-hint">
                Use at least 10 characters. Make it something only you know.
              </p>
            )}
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button className="button wide" disabled={busy}>
              {busy
                ? "One moment…"
                : signup
                  ? "Create your account"
                  : "Sign in"}
              <ArrowRight size={18} />
            </button>
          </form>
          <p className="auth-switch">
            {signup ? "Already part of the mix?" : "New around here?"}{" "}
            <Link to={signup ? "/login" : "/signup"}>
              {signup ? "Sign in" : "Create an account"}
            </Link>
          </p>
        </div>
        <small className="muted">
          A space for music you have permission to share.
        </small>
      </section>
    </div>
  );
}
