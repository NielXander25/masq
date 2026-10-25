/** Masq mark: a masquerade mask. Uses currentColor. */
export function LogoMark({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden fill="currentColor">
      <path
        fillRule="evenodd"
        d="M3 16.5C10 15.2 17 15 22.5 16.8C27 18.2 30 20.8 32 23.2C34 20.8 37 18.2 41.5 16.8C47 15 54 15.2 61 16.5C60.6 31 53 45 42.5 45C36.5 45 33.8 41.5 32 38.5C30.2 41.5 27.5 45 21.5 45C11 45 3.4 31 3 16.5ZM11 26C14.6 22.6 23.8 23.6 27.2 29C23.6 33.4 14.2 32.2 11 26ZM36.8 29C40.2 23.6 49.4 22.6 53 26C49.8 32.2 40.4 33.4 36.8 29Z"
      />
    </svg>
  );
}

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-semibold tracking-tight ${className}`}>
      <LogoMark />
      <span>Masq</span>
    </span>
  );
}
