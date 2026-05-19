import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, checkPassword, isAdmin } from "@/lib/admin";

type PageProps = { searchParams: Promise<{ error?: string }> };

export default async function AdminLoginPage({ searchParams }: PageProps) {
  if (await isAdmin()) redirect("/admin");
  const { error } = await searchParams;

  async function login(formData: FormData) {
    "use server";
    const password = String(formData.get("password") ?? "");
    if (!checkPassword(password)) redirect("/admin/login?error=1");
    const c = await cookies();
    c.set(ADMIN_COOKIE, "1", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 8,
    });
    redirect("/admin");
  }

  return (
    <div className="max-w-md mx-auto space-y-4">
      <h1 className="text-2xl font-bold">Admin login</h1>
      <p className="text-sm text-stone-600">
        Enter the shared admin password (set in your <code>.env</code> as{" "}
        <code>ADMIN_PASSWORD</code>).
      </p>
      {error && (
        <div className="rounded border border-red-300 bg-red-50 text-red-800 px-3 py-2 text-sm">
          Wrong password.
        </div>
      )}
      <form action={login} className="space-y-3">
        <input
          type="password"
          name="password"
          required
          autoFocus
          className="w-full rounded border border-stone-300 px-3 py-2"
          placeholder="Password"
        />
        <button
          type="submit"
          className="bg-impulse-600 text-white px-4 py-2 rounded"
        >
          Sign in
        </button>
      </form>
    </div>
  );
}
