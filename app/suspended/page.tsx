export default function SuspendedPage() {
  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "var(--color-bg)",
      padding: 20,
    }}>
      <div style={{ textAlign: "center", maxWidth: 400 }}>
        <h1 style={{
          fontSize: 20,
          fontWeight: 700,
          color: "var(--color-text)",
          marginBottom: 12,
        }}>
          Account Suspended
        </h1>
        <p style={{
          fontSize: 15,
          color: "var(--color-text-secondary)",
          lineHeight: 1.6,
          marginBottom: 24,
        }}>
          Your account has been suspended. If you believe this is an error, please contact support.
        </p>
        <a
          href="mailto:hello@offloaded.life"
          style={{
            fontSize: 14,
            color: "var(--color-accent)",
            textDecoration: "none",
          }}
        >
          Contact support
        </a>
      </div>
    </div>
  );
}
