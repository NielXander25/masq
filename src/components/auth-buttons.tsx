import { signIn, signOut } from "@/auth";

export function GoogleSignInButton({ redirectTo = "/dashboard" }: { redirectTo?: string }) {
  return (
    <form
      action={async () => {
        "use server";
        await signIn("google", { redirectTo });
      }}
    >
      <button
        type="submit"
        className="w-full rounded-lg bg-white px-4 py-2.5 font-medium text-black transition hover:bg-neutral-200"
      >
        Continue with Google
      </button>
    </form>
  );
}

export function SignOutButton() {
  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/" });
      }}
    >
      <button
        type="submit"
        className="rounded-lg border border-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-800"
      >
        Sign out
      </button>
    </form>
  );
}
