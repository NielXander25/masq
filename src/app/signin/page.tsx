import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/auth";
import { GoogleSignInButton } from "@/components/auth-buttons";
import { LogoMark } from "@/components/logo";

const searchSchema = z.object({
  // Only allow same-site relative paths, to avoid open redirects.
  callbackUrl: z
    .string()
    .regex(/^\/(?!\/)/)
    .catch("/start")
    .default("/start"),
  error: z.string().optional().catch(undefined),
});

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { callbackUrl, error } = searchSchema.parse(await searchParams);
  const session = await auth();
  if (session?.user) redirect(session.user.banned ? "/suspended" : callbackUrl);

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-4">
      <div>
        <LogoMark className="mb-4 h-12 w-12" />
        <h1 className="text-2xl font-semibold">Sign in to masqq</h1>
        <p className="mt-1 text-sm text-neutral-400">Google sign-in only.</p>
      </div>
      {error && (
        <p className="rounded-lg border border-red-900 bg-red-950 px-3 py-2 text-sm text-red-300">
          Sign-in failed. Please try again.
        </p>
      )}
      <GoogleSignInButton redirectTo={callbackUrl} />
    </main>
  );
}
