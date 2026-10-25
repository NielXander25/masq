import Link from "next/link";
import { auth } from "@/auth";

export default async function Home() {
  const session = await auth();

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 px-4">
      <h1 className="text-5xl font-semibold tracking-tight">Masq</h1>
      <p className="text-lg text-neutral-400">
        Host voice and video calls under any name, with a disguised voice. Every
        guest signs in with Google, so you always know who you&apos;re talking to.
      </p>
      <div>
        <Link
          href={session?.user ? "/dashboard" : "/signin"}
          className="inline-block rounded-lg bg-white px-5 py-2.5 font-medium text-black hover:bg-neutral-200"
        >
          {session?.user ? "Go to dashboard" : "Sign in"}
        </Link>
      </div>
    </main>
  );
}
