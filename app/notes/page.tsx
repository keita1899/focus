import NotesClient from "../../components/notes/NotesClient";
import { getNotesState } from "../../lib/server-state";

export default async function NotesPage() {
  const notes = await getNotesState();

  return <NotesClient initialValue={notes} />;
}
