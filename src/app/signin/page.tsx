import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/auth";
import { GoogleSignInButton } from "@/components/auth-buttons";
import { AuthScreen, BrandHero } from "@/components/brand-hero";

const searchSchema = z.object({
  // Only allow same-site relative paths, to avoid open redirects.
  callbackUrl: z
    .string()
    .regex(/^\/(?!\/)/)
    .catch("/start")
    .default("/start"),
  error: z.string().optional().catch(undefined),
});

export const metadata = { title: "Sign in" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { callbackUrl, error } = searchSchema.parse(await searchParams);
  const session = await auth();
  if (session?.user) redirect(session.user.banned ? "/suspended" : callbackUrl);

  return (
    <AuthScreen>
      <div className="flex flex-1 items-center">
        <BrandHero />
      </div>
      <div className="w-full space-y-4 text-center">
        {error && (
          <p className="rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-300">
            Sign-in didn&apos;t finish. Please try again.
          </p>
        )}
        <GoogleSignInButton redirectTo={callbackUrl} />
        <p className="px-4 text-[13px] leading-relaxed text-neutral-500">
          When you host, guests only see the name you choose. When you join a call, the host sees your Google name and
          email.
        </p>
      </div>
    </AuthScreen>
  );
}
