import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost";

const base =
  "inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-full px-5 py-2.5 text-base font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50";

const variants: Record<Variant, string> = {
  primary: "bg-brand text-ink hover:bg-brand-400 active:bg-brand-600",
  secondary: "border-2 border-ink bg-paper text-ink hover:bg-paper-deep",
  ghost: "text-ink hover:bg-paper-deep",
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  /** Renders a link styled as a button. */
  href?: string;
  children: ReactNode;
};

export function Button({ variant = "primary", href, className = "", children, ...rest }: Props) {
  const cls = `${base} ${variants[variant]} ${className}`;
  if (href) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" className={cls} {...rest}>
      {children}
    </button>
  );
}
