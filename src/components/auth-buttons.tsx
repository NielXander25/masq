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
        className="rounded-full bg-white/10 px-4 py-2 text-sm font-medium ring-1 ring-white/10 hover:bg-white/15"
      >
        Sign out
      </button>
    </form>
  );
}
