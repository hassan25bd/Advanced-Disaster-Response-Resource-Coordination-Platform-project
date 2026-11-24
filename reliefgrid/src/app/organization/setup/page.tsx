"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

export default function OrganizationSetupPage() {
  const { data: session, update } = useSession();
  const [form, setForm] = useState({
    name: "",
    registrationNo: "",
    type: "Relief Organization",
    contactEmail: "",
    address: "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      const response = await fetch("/api/organizations/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          contactEmail: form.contactEmail || session?.user?.email || "",
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error || "Unable to set up organization");
        return;
      }
      await update();
      router.replace("/dashboard");
    } catch {
      setError("Unable to set up organization. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Set up your organization</h1>
        <p className="mt-1 text-sm text-slate-600">
          Add your organization details to access its resources, teams, requests, and allocations.
        </p>
      </div>

      {error && <p role="alert" className="rounded border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}

      <form onSubmit={submit} className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
        <Field label="Organization name" required value={form.name} onChange={(name) => setForm({ ...form, name })} />
        <Field label="Registration number" required value={form.registrationNo} onChange={(registrationNo) => setForm({ ...form, registrationNo })} />
        <Field label="Organization type" value={form.type} onChange={(type) => setForm({ ...form, type })} />
        <Field label="Contact email" type="email" value={form.contactEmail || session?.user?.email || ""} onChange={(contactEmail) => setForm({ ...form, contactEmail })} />
        <label className="block text-sm font-medium text-slate-700">
          Address
          <textarea
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-normal"
            rows={3}
            value={form.address}
            onChange={(event) => setForm({ ...form, address: event.target.value })}
          />
        </label>
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-rose-600 px-4 py-2.5 font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save organization"}
        </button>
      </form>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      <input
        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-normal"
        type={type}
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
