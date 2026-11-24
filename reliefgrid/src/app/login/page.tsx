"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const isDevelopment = process.env.NODE_ENV === "development";

export default function LoginPage() {
  const [email, setEmail] = useState(isDevelopment ? "admin@reliefgrid.org" : "");
  const [password, setPassword] = useState(isDevelopment ? "ReliefGrid@2026" : "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (result?.error) {
        setError(result.error || "Invalid email or password");
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    } catch (err: any) {
      setError(err?.message || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  const handleAutoLogin = async () => {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/autologin", { method: "POST" });
      if (!res.ok) {
        setError("Auto login failed");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Auto login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-sm border border-slate-200 p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-slate-900">ReliefGrid</h1>
          <p className="text-sm text-slate-500">Disaster Response & Resource Coordination</p>
        </div>

        {error && (
          <div className="mb-6 p-3 rounded bg-red-50 text-red-700 text-sm border border-red-100">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-rose-500 focus:border-transparent outline-none"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
            <input
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-rose-500 focus:border-transparent outline-none"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              required
            />
          </div>
          <button
            disabled={loading}
            className="w-full px-4 py-2.5 bg-rose-600 text-white font-semibold rounded-md hover:bg-rose-700 disabled:opacity-60 transition-colors"
          >
            Sign In
          </button>
        </form>

        {isDevelopment && (
          <button
            onClick={handleAutoLogin}
            disabled={loading}
            className="w-full px-4 py-2.5 bg-slate-100 text-slate-700 font-semibold rounded-md border border-slate-200 hover:bg-slate-200 disabled:opacity-60 transition-colors mt-3"
          >
            Auto Login as Demo Admin
          </button>
        )}

        {isDevelopment && (
          <p className="mt-8 text-center text-sm text-slate-600">
            Demo credentials:{" "}
            <span className="font-mono text-xs text-slate-500">admin@reliefgrid.org</span> /{" "}
            <span className="font-mono text-xs text-slate-500">ReliefGrid@2026</span>
          </p>
        )}
        <p className="text-center text-sm text-slate-600">
          New to ReliefGrid?{" "}
          <Link href="/register" className="text-rose-600 font-medium hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
