import {
  MarkdownMemoPage,
  defaultMemoMarkdown,
  memoStorageKey,
} from "../../components/MarkdownMemoClient";
import { getMemoState } from "../../lib/server-state";

export default async function RoadmapPage() {
  const memos = await getMemoState();

  return (
    <MarkdownMemoPage
      apiPath="/api/memos"
      ariaLabel="ロードマップ"
      defaultMarkdown={defaultMemoMarkdown}
      defaultTitle="ロードマップ"
      idPrefix="roadmap"
      initialValue={memos.length > 0 ? memos : null}
      pageTitle="Roadmap"
      storageKey={memoStorageKey}
    />
  );
}
