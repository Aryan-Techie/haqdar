import "./chat.css";
import type { ReactNode } from "react";

type Props = {
  from: "agent" | "user";
  children: ReactNode;
  /** Dashed, quiet style for skipped answers. */
  muted?: boolean;
  /** Makes a user bubble a 44px+ button that lets the person change the answer. */
  onEdit?: () => void;
  editLabel?: string;
  /** Highlights the bubble being edited. */
  active?: boolean;
  className?: string;
};

const pencil = (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M4 20h4L19 9l-4-4L4 16z" />
    <path d="M13.5 6.5l4 4" />
  </svg>
);

export function ChatBubble({ from, children, muted = false, onEdit, editLabel, active = false, className = "" }: Props) {
  if (from === "agent") {
    return (
      <div className={`bubble-in flex items-end gap-2 ${className}`}>
        <span aria-hidden className="mb-1 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ink text-sm font-extrabold text-brand">
          ह
        </span>
        <div className="max-w-[85%] rounded-[1.25rem] rounded-bl-md border border-line bg-white px-4 py-3 text-[1.0625rem] font-semibold leading-snug text-ink shadow-sm">
          {children}
        </div>
      </div>
    );
  }

  const look = muted
    ? "border-2 border-dashed border-ink-muted bg-transparent text-ink-muted"
    : active
      ? "border-2 border-brand bg-brand text-ink"
      : "border-2 border-ink bg-ink text-paper";
  const shape = `max-w-[85%] rounded-[1.25rem] rounded-br-md px-4 py-2.5 text-[1.0625rem] font-bold leading-snug ${look}`;

  return (
    <div className={`bubble-in flex justify-end ${className}`}>
      {onEdit ? (
        <button
          type="button"
          onClick={onEdit}
          aria-label={editLabel}
          className={`${shape} flex min-h-11 items-center gap-2 text-left transition-transform active:scale-[0.98]`}
        >
          <span>{children}</span>
          <span className="opacity-70">{pencil}</span>
        </button>
      ) : (
        <div className={shape}>{children}</div>
      )}
    </div>
  );
}
