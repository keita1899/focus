import { MarkdownMemoPage } from "../roadmap/page";

const storageKey = "inbox-markdown-v1";
const defaultMarkdown = `# Inbox

- 
`;

export default function InboxPage() {
  return (
    <MarkdownMemoPage
      apiPath="/api/inbox"
      ariaLabel="Inbox"
      defaultMarkdown={defaultMarkdown}
      defaultTitle="Inbox"
      idPrefix="inbox"
      pageTitle="Inbox"
      storageKey={storageKey}
    />
  );
}
