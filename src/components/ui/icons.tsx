// Inline icons (stroke-based, 24x24), so no icon package is needed.
type P = { className?: string };
const base = (className = "h-6 w-6") => ({
  className,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
});

export const MicIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <rect x="9" y="2" width="6" height="12" rx="3" />
    <path d="M5 10a7 7 0 0 0 14 0M12 17v5" />
  </svg>
);
export const MicOffIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M9 9v1a3 3 0 0 0 5.1 2.1M15 9.3V5a3 3 0 0 0-5.9-.7" />
    <path d="M5 10a7 7 0 0 0 11.4 5.4M19 10a7 7 0 0 1-.6 2.8M12 17v5M3 3l18 18" />
  </svg>
);
export const VideoIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <rect x="2" y="6" width="14" height="12" rx="2" />
    <path d="m16 10 6-3v10l-6-3" />
  </svg>
);
export const VideoOffIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M10.7 6H14a2 2 0 0 1 2 2v3.3l1 1 5-2.3v10M16 16a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2M3 3l18 18" />
  </svg>
);
export const PhoneOffIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M10.7 13.3a16 16 0 0 0 2.7 2l1.3-1.3a2 2 0 0 1 2.1-.4 12.8 12.8 0 0 0 2.8.7 2 2 0 0 1 1.7 2v3a2 2 0 0 1-2.2 2A19.8 19.8 0 0 1 2.7 4.2 2 2 0 0 1 4.7 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.6 9.9" />
    <path d="M22 2 2 22" />
  </svg>
);
export const PeopleIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-4-6" />
  </svg>
);
export const ShareIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" />
  </svg>
);
export const LinkIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" />
    <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
  </svg>
);
export const CopyIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);
export const PlusIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);
export const CloseIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);
export const ScreenShareIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <rect x="2" y="3" width="20" height="14" rx="2" />
    <path d="M8 21h8M12 17v4M9 10l3-3 3 3M12 7v6" />
  </svg>
);
export const WaveIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M2 12h2M6 8v8M10 4v16M14 7v10M18 10v4M22 12h0" />
  </svg>
);
export const ArrowOutIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M7 17 17 7M8 7h9v9" />
  </svg>
);
export const ArrowInIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M17 7 7 17M16 17H7V8" />
  </svg>
);
export const PlayIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="m7 4 13 8-13 8z" />
  </svg>
);
export const ShieldIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);
export const MoreIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <circle cx="12" cy="5" r="1" />
    <circle cx="12" cy="12" r="1" />
    <circle cx="12" cy="19" r="1" />
  </svg>
);
export const ChevronLeftIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="m15 18-6-6 6-6" />
  </svg>
);

export const ChevronDownIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="m6 9 6 6 6-6" />
  </svg>
);

export const SmileIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <circle cx="12" cy="12" r="10" />
    <path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01" />
  </svg>
);

export const ChatIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M21 12a8 8 0 0 1-11.8 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />
  </svg>
);

export const SendIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="m22 2-7 20-4-9-9-4 20-7zM22 2 11 13" />
  </svg>
);

export const ScriptIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
    <path d="M14 3v6h6M8 13h8M8 17h5" />
  </svg>
);
