import { redirect } from "next/navigation";
import { Nav } from "@/components/Nav";
import { getSessionUser } from "@/lib/server-session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/connexion");
  return (
    <>
      <Nav userName={user.name} />
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </>
  );
}
