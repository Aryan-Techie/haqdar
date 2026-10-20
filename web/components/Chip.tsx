import type { ButtonHTMLAttributes, ReactNode } from "react";

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> & {
  /** When set the chip is an interactive toggle button with a 44px target; otherwise a static label. */
  onClick?: () => void;
  selected?: boolean;
  children: ReactNode;
};

const look = "rounded-full border-2 px-4 text-base font-semibold";

export function Chip({ onClick, selected = false, className = "", children, ...rest }: Props) {
  if (!onClick) {
    return (
      <span className={`inline-flex items-center rounded-full border border-line bg-paper-deep px-3 py-1 text-sm font-semibold text-ink ${className}`}>
        {children}
      </span>
    );
  }
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`inline-flex min-h-11 min-w-11 items-center justify-center transition-colors ${look} ${
        selected ? "border-ink bg-ink text-paper" : "border-line bg-white text-ink hover:border-ink"
      } ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
