import { LogoMark } from "@/components/logo";


/** Centered app-icon style logo, name and tagline used on the sign-in screens. */
export function BrandHero() {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="relative">
        <div className="absolute inset-0 -z-10 scale-150 rounded-full bg-white/10 blur-3xl" aria-hidden />
        <div className="rounded-[28px] bg-gradient-to-b from-neutral-800 to-neutral-950 p-3 shadow-2xl ring-1 ring-white/10">
          <LogoMark className="h-20 w-20" />
        </div>
      </div>
      <h1 className="mt-6 text-[34px] font-bold leading-tight tracking-tight">masqq</h1>
      <p className="mt-2 text-[17px] leading-snug text-neutral-400">
        Hosting calls anonymously,
        <br />
        now made easy.
      </p>
    </div>
  );
}

/** Full-height, centered, safe-area aware screen with a soft top glow. */
export function AuthScreen({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative isolate mx-auto flex min-h-dvh w-full max-w-md flex-col items-center px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))]">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 -z-20 h-[60vh] bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.08),transparent_65%)]"
        aria-hidden
      />
      {children}
    </main>
  );
}
