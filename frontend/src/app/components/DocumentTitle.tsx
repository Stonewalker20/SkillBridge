import { useEffect } from "react";

interface DocumentTitleProps {
  title?: string;
}

function formatDocumentTitle(title?: string) {
  const trimmedTitle = title?.trim();
  return trimmedTitle ? `${trimmedTitle} | SkillBridge` : "SkillBridge";
}

export function DocumentTitle({ title }: DocumentTitleProps) {
  useEffect(() => {
    document.title = formatDocumentTitle(title);
  }, [title]);

  return null;
}
