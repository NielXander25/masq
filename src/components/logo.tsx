/** masqq mark: a face ("nose") mask. Uses currentColor, so it works on any background. */
export function LogoMark({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <defs>
        {/* Cuts the pleats out of the mask so the background shows through. */}
        <mask id="masqq-pleats">
          <rect width="64" height="64" fill="white" />
          <g fill="none" stroke="black" strokeWidth="2" strokeLinecap="round">
            <path d="M18 27.5Q32 22 46 27.5" />
            <path d="M18 33Q32 28.5 46 33" />
            <path d="M18 38.5Q32 35 46 38.5" />
          </g>
        </mask>
      </defs>
      <g fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
        <path d="M15 24C6 22 4 41 15 41" />
        <path d="M49 24C58 22 60 41 49 41" />
      </g>
      <path fill="currentColor" mask="url(#masqq-pleats)" d="M14 23Q32 13 50 23V39Q32 53 14 39Z" />
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
