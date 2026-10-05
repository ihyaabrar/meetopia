import { getSessionUser } from "@/server/auth";
import { checkInvite } from "@/server/repo";
import { InviteView } from "./InviteView";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [user, check] = await Promise.all([getSessionUser(), checkInvite(token)]);
  return (
    <InviteView
      token={token}
      loggedIn={!!user}
      groupName={check.ok ? check.groupName : null}
      reason={check.ok ? null : check.reason}
    />
  );
}
