import { signIn, signOut } from "@/auth";
import { GoogleSubmit } from "@/components/google-submit";

export function GoogleSignInButton({ redirectTo = "/start" }: { redirectTo?: string }) {
  return (
    <form
      className="w-full"
      action={async () => {
        "use server";
        await signIn("google", { redirectTo });
      }}
    >
      <GoogleSubmit />
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
