import Link from "next/link";
import { auth } from "@/auth";
import { GoogleSignInButton } from "@/components/auth-buttons";
import { AuthScreen, BrandHero } from "@/components/brand-hero";
import { MicIcon, PeopleIcon, ShieldIcon } from "@/components/ui/icons";

const FEATURES = [
  {
    icon: ShieldIcon,
    tint: "bg-indigo-500",
    title: "Any name, every call",
    text: "Pick a new name for each call. Guests never see your account.",
  },
  {
    icon: MicIcon,
    tint: "bg-orange-500",
    title: "A voice that isn't yours",
    text: "Your voice is disguised on your phone before anyone hears it.",
  },
  {
    icon: PeopleIcon,
    tint: "bg-green-500",
    title: "Know who's on the line",
    text: "Every guest signs in with Google, and you let each one in.",
  },
];

export default async function Home() {
  const session = await auth();

  return (
    <AuthScreen>
      <div className="flex flex-1 flex-col items-center justify-center gap-10 py-6">
        <BrandHero />
        <ul className="w-full divide-y divide-white/5 overflow-hidden rounded-3xl bg-neutral-900/70 ring-1 ring-white/5 backdrop-blur">
          {FEATURES.map((f) => (
            <li key={f.title} className="flex items-start gap-3.5 px-4 py-3.5 text-left">
              <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] ${f.tint}`}>
                <f.icon className="h-[18px] w-[18px] text-white" />
              </span>
              <span>
                <span className="block text-[15px] font-semibold">{f.title}</span>
                <span className="block text-[13px] leading-snug text-neutral-400">{f.text}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="w-full">
        {session?.user ? (
          <Link
            href="/start"
            className="flex h-14 w-full items-center justify-center rounded-full bg-white text-[17px] font-semibold text-black shadow-[0_10px_40px_-10px_rgba(255,255,255,0.35)] transition active:scale-[0.98]"
          >
            Open masqq
          </Link>
        ) : (
          <GoogleSignInButton />
        )}
      </div>
    </AuthScreen>
  );
}
