"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[GlobalError]", error);
  }, [error]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        padding: "2rem",
        fontFamily: "system-ui, -apple-system, sans-serif",
        color: "#1a1a1a",
        background: "#fafafa",
      }}
    >
      <div
        style={{
          maxWidth: 420,
          textAlign: "center",
        }}
      >
        <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>
          Something went wrong
        </h1>
        <p style={{ fontSize: 14, color: "#666", marginBottom: 24, lineHeight: 1.5 }}>
          An unexpected error occurred. Your data is safe — try refreshing the page.
        </p>
        <button
          onClick={reset}
          style={{
            padding: "10px 24px",
            fontSize: 14,
            fontWeight: 500,
            color: "#fff",
            background: "#2C5FF6",
            border: "none",
            borderRadius: 10,
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </div>
    </div>
  );
}
