/**
 * The séance flame — a small inline SVG that replaces the mock's single 🕯
 * emoji (SPEC §6, DESIGN-NOTES §9). It keeps the gentle `drift` bob and honors
 * reduced-motion via the `motion-reduce:animate-none` variant.
 */
import { cn } from "./util/cn";

export function Flame({
  className,
  drift = false,
  size = 16,
}: {
  className?: string;
  drift?: boolean;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size * 1.4}
      viewBox="0 0 16 22"
      fill="none"
      aria-hidden="true"
      className={cn(drift && "animate-drift motion-reduce:animate-none", className)}
    >
      {/* Outer flame — gold accent. */}
      <path
        d="M8 1C8 1 3.2 5.4 3.2 11.2 3.2 15 5.4 18 8 18 10.6 18 12.8 15 12.8 11.2 12.8 8.4 11 6.6 10.2 4.6 9.6 6.4 8.4 7.4 7.6 7.2 7 7 8 3.4 8 1Z"
        fill="var(--color-sc-accent)"
        opacity="0.9"
      />
      {/* Inner core — brighter, smaller. */}
      <path
        d="M8 8.5C8 8.5 5.8 10.6 5.8 13.4 5.8 15.3 6.8 16.6 8 16.6 9.2 16.6 10.2 15.3 10.2 13.4 10.2 11.8 9.2 11 8.8 10 8.4 10.8 7.9 11 7.6 10.9 7.4 10.2 8 9.4 8 8.5Z"
        fill="var(--color-sc-accent-hi)"
      />
    </svg>
  );
}
