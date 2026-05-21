import InboxClient from "../../components/InboxClient";
import { getInboxState } from "../../lib/server-state";

export default async function InboxPage() {
  const inbox = await getInboxState();

  return <InboxClient initialValue={inbox} />;
}
