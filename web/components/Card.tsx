import Link from "next/link";
import type { HTMLAttributes, ReactNode } from "react";

type Tone = "paper" | "ink" | "brand";

const tones: Record<Tone, string> = {
  paper: "bg-white text-ink border border-line",
  ink: "bg-ink text-paper",
  brand: "bg-brand-100 text-ink border border-brand-200",
};

type Props = HTMLAttributes<HTMLElement> & {
  tone?: Tone;
  /** Makes the whole card a link (min 44px target by padding). */
  href?: string;
  children: ReactNode;
};

export function Card({ tone = "paper", href, className = "", children, ...rest }: Props) {
  const cls = `block rounded-[1.25rem] p-4 shadow-sm ${tones[tone]} ${className}`;
  if (href) {
    return (
      <Link href={href} className={`${cls} hover:shadow-md transition-shadow`}>
        {children}
      </Link>
    );
  }
  return (
    <div className={cls} {...rest}>
      {children}
    </div>
  );
}
