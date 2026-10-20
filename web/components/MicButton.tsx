import "./chat.css";
type Props = {
  listening: boolean;
  onClick: () => void;
  label: string;
  stopLabel: string;
  disabled?: boolean;
  className?: string;
};

export function MicButton({ listening, onClick, label, stopLabel, disabled, className = "" }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={listening}
      aria-label={listening ? stopLabel : label}
      className={`relative grid h-14 w-14 shrink-0 place-items-center rounded-full border-2 border-ink text-ink transition-colors disabled:opacity-50 ${
        listening ? "bg-ink text-brand" : "bg-brand hover:bg-brand-400 active:bg-brand-600"
      } ${className}`}
    >
      {listening ? <span aria-hidden className="mic-ring absolute inset-0 rounded-full border-2 border-brand" /> : null}
      {listening ? (
        <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden>
          <rect x="6" y="6" width="12" height="12" rx="2.5" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <rect x="9" y="3" width="6" height="12" rx="3" />
          <path d="M5 11a7 7 0 0014 0M12 18v3" />
        </svg>
      )}
    </button>
  );
}
