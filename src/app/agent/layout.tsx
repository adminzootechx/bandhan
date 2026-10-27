import React from "react";

// The agent area keeps the light palette whatever theme the public site is
// set to; globals.css skips the dark theme while this marker is on the page.
export default function AgentThemeLockLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-theme-lock className="contents">
      {children}
    </div>
  );
}
