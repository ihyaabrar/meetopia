import { redirect } from "next/navigation";
import { getSessionUser } from "@/server/auth";
import { listGroups } from "@/server/repo";
import { AppShell } from "@/components/app/AppShell";

export default async function AppPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const groups = await listGroups(user.id);
  return <AppShell initialUser={user} initialGroups={groups} />;
}
