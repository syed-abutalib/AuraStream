import { cloneElement, useEffect, useId, useRef } from "react";
import { Disc3, X, Music2, ArrowRight, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { mediaUrl } from "../services/api";
export function Cover({ song, className = "", children }) {
  const src = mediaUrl(song?.cover_image || song?.profile_image);
  return (
    <div className={`cover art-${(song?.id || 0) % 6} ${className}`}>
      {src ? (
        <img
          src={src}
          alt={`${song?.title || song?.name || "Music"} cover`}
          loading="lazy"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      ) : (
        <Disc3 aria-hidden="true" />
      )}
      {children}
    </div>
  );
}
export function Brand() {
  return (
    <Link to="/" className="brand">
      <span className="brand-mark">
        <i />
        <i />
        <i />
        <i />
        <i />
      </span>
      AuraStream<span className="brand-dot">®</span>
    </Link>
  );
}
export function IconButton({
  icon: Icon,
  label,
  active,
  className = "",
  ...props
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`icon-button ${active ? "active" : ""} ${className}`}
      {...props}
    >
      <Icon size={19} />
    </button>
  );
}
export function Empty({
  title = "Your next favorite is waiting",
  text = "The library is ready for music. An administrator can add the first tracks.",
  action,
  icon: Icon = Music2,
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Icon size={30} />
      </div>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}
export function ErrorState({ message }) {
  return (
    <div className="error-state" role="alert">
      <RefreshCw size={22} />
      <div>
        <h3>Couldn’t load this just yet</h3>
        <p>{message}</p>
      </div>
      <button className="button secondary" onClick={() => location.reload()}>
        Try again
      </button>
    </div>
  );
}
export function Skeleton({ count = 6 }) {
  return (
    <div className="song-grid" aria-label="Loading music" aria-busy="true">
      {Array.from({ length: count }, (_, i) => (
        <div className="skeleton" key={i}>
          <div />
          <span />
          <span />
        </div>
      ))}
    </div>
  );
}
export function SectionHeading({
  title,
  subtitle,
  link,
  label = "View all",
  children,
}) {
  return (
    <div className="section-heading">
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {children}
      {link && (
        <Link className="text-link" to={link}>
          {label}
          <ArrowRight size={15} />
        </Link>
      )}
    </div>
  );
}
export function PageHeading({ eyebrow, title, subtitle, children }) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}
export function Modal({ title, children, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const old = document.activeElement;
    const dialog = ref.current;
    dialog.showModal();
    return () => {
      dialog.close();
      old?.focus();
    };
  }, []);
  return (
    <dialog
      className="modal"
      ref={ref}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-heading">
        <h2>{title}</h2>
        <IconButton icon={X} label="Close dialog" onClick={onClose} />
      </div>
      {children}
    </dialog>
  );
}
export function Pagination({ data, page, setPage }) {
  if (!data || data.total <= data.limit) return null;
  return (
    <div className="pagination">
      <button
        className="button secondary"
        disabled={page <= 1}
        onClick={() => setPage(page - 1)}
      >
        Previous
      </button>
      <span>
        Page {page} of {Math.ceil(data.total / data.limit)}
      </span>
      <button
        className="button secondary"
        disabled={page * data.limit >= data.total}
        onClick={() => setPage(page + 1)}
      >
        Next
      </button>
    </div>
  );
}
export function Field({ label, children, ...props }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children ? cloneElement(children, { id }) : <input id={id} {...props} />}
    </div>
  );
}
