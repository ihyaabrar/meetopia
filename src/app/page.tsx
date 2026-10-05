import { redirect } from "next/navigation";
import { getSessionUser } from "@/server/auth";
import { Landing } from "./Landing";

export default async function Home() {
  if (await getSessionUser()) redirect("/app");
  return <Landing />;
}
