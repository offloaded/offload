"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function AuthPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
      router.push("/chat");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center px-4 overflow-x-hidden">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-xl font-bold text-[var(--color-text)] tracking-tight mb-1">
            Offload
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)]">
            {isSignUp ? "Create your account" : "Sign in to your account"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="text-sm text-[var(--color-red)] bg-[var(--color-red-soft)] px-3 py-2 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-[var(--color-text-secondary)] mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text)] bg-[var(--color-surface)] outline-none focus:border-[var(--color-accent)]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--color-text-secondary)] mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-3.5 py-2.5 border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text)] bg-[var(--color-surface)] outline-none focus:border-[var(--color-accent)]"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-5 bg-[var(--color-accent)] text-white border-none rounded-lg text-sm font-semibold cursor-pointer disabled:opacity-50"
          >
            {loading
              ? "..."
              : isSignUp
                ? "Create Account"
                : "Sign In"}
          </button>
        </form>

        <p className="text-center text-sm text-[var(--color-text-secondary)] mt-6">
          {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
          <button
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError("");
            }}
            className="text-[var(--color-accent)] font-semibold bg-transparent border-none cursor-pointer text-sm"
          >
            {isSignUp ? "Sign in" : "Sign up"}
          </button>
        </p>
      </div>
    </div>
  );
}
