"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error("[AppError]", error);
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
        color: "var(--color-text, #1a1a1a)",
        background: "var(--color-bg, #fafafa)",
      }}
    >
      <div style={{ maxWidth: 420, textAlign: "center" }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>
          Something went wrong
        </h1>
        <p
          style={{
            fontSize: 14,
            color: "var(--color-text-tertiary, #666)",
            marginBottom: 24,
            lineHeight: 1.5,
          }}
        >
          An unexpected error occurred. Your data is safe.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          <button
            onClick={reset}
            style={{
              padding: "10px 24px",
              fontSize: 14,
              fontWeight: 500,
              color: "#fff",
              background: "var(--color-accent, #2C5FF6)",
              border: "none",
              borderRadius: 10,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
          <button
            onClick={() => router.push("/chat")}
            style={{
              padding: "10px 24px",
              fontSize: 14,
              fontWeight: 500,
              color: "var(--color-text-secondary, #555)",
              background: "transparent",
              border: "1px solid var(--color-border, #ddd)",
              borderRadius: 10,
              cursor: "pointer",
            }}
          >
            Go to chat
          </button>
        </div>
      </div>
    </div>
  );
}
