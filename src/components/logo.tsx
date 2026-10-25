/** masqq mark: a white face ("nose") mask on a black circle. */
export function LogoMark({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      {/* The thin ring keeps the black circle visible on the dark app background. */}
      <circle cx="32" cy="32" r="31" fill="#000" stroke="#404040" strokeWidth="2" />
      <g fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 24.5Q32 17.5 47 24.5V36.5Q32 46.5 17 36.5Z" />
        <path d="M21 28.6Q32 24.6 43 28.6" />
        <path d="M21 33.2Q32 29.6 43 33.2" />
        <path d="M17 26C10 25 9 37 17 35.5" />
        <path d="M47 26C54 25 55 37 47 35.5" />
      </g>
    </svg>
  );
}

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-semibold tracking-tight ${className}`}>
      <LogoMark />
      <span>masqq</span>
    </span>
  );
}
