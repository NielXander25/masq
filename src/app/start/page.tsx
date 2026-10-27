import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { MODE_COOKIE } from "@/lib/mode";
import { requireUser } from "@/lib/session";

// Landing route after sign-in: admins go back to the mode they last used.
export default async function StartPage() {
  const user = await requireUser("/start");
  const mode = (await cookies()).get(MODE_COOKIE)?.value;
  redirect(user.role === "ADMIN" && mode === "admin" ? "/admin" : "/dashboard");
}
