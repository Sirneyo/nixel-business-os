import { Blocks, Check, Copy, KeyRound, LogIn } from "lucide-react";
import { FormEvent, useState } from "react";

import { login, recoverAccount } from "../api/client";
import { Button, ErrorNote, FormField, Input } from "../components/ui";
import { NIXEL_CONTACT_URL } from "../lib/brand";

type Mode = "password" | "recovery" | "recovered";

export default function Login({ onLogin }: { onLogin: () => void }) {
  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [recoveryKey, setRecoveryKey] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newKey, setNewKey] = useState("");
  const [keySaved, setKeySaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submitPassword(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email.trim(), password);
      onLogin();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
      setBusy(false);
    }
  }

  async function submitRecovery(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await recoverAccount(email.trim(), recoveryKey.trim(), newPassword);
      setNewKey(result.recovery_key);
      setMode("recovered");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Recovery failed");
    } finally {
      setBusy(false);
    }
  }

  async function copyKey() {
    try {
      await navigator.clipboard.writeText(newKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable — the key is selectable.
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-gradient-to-br from-ink-50 via-white to-brand-50 p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-pop">
            <Blocks size={26} />
          </div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink-900">
            {mode === "password" ? "Welcome back" : mode === "recovery" ? "Account recovery" : "You're back in"}
          </h1>
          <p className="mt-1 text-sm font-medium text-ink-500">
            {mode === "password"
              ? "Sign in to your workspace"
              : mode === "recovery"
                ? "Use the recovery key you saved at signup"
                : "Save your new recovery key before continuing"}
          </p>
        </div>

        {mode === "password" && (
          <>
            <form onSubmit={submitPassword} className="animate-fade-up rounded-2xl border border-ink-200/70 bg-white p-7 shadow-pop">
              <ErrorNote message={error} />
              <div className="space-y-4">
                <FormField label="Email">
                  <Input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@yourbusiness.com" autoFocus required />
                </FormField>
                <FormField label="Password">
                  <Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
                </FormField>
                <Button type="submit" loading={busy} className="w-full justify-center">
                  <LogIn size={15} /> Sign in
                </Button>
              </div>
            </form>
            <p className="mt-6 text-center text-xs leading-relaxed text-ink-400">
              Forgot your password?{" "}
              <button
                type="button"
                className="font-semibold text-brand-600 hover:underline"
                onClick={() => {
                  setError(null);
                  setMode("recovery");
                }}
              >
                Use your recovery key
              </button>
            </p>
          </>
        )}

        {mode === "recovery" && (
          <>
            <form onSubmit={submitRecovery} className="animate-fade-up rounded-2xl border border-ink-200/70 bg-white p-7 shadow-pop">
              <ErrorNote message={error} />
              <div className="space-y-4">
                <FormField label="Email">
                  <Input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@yourbusiness.com" autoFocus required />
                </FormField>
                <FormField label="Recovery key" hint="The NIXL-… key you saved when you created the account.">
                  <Input value={recoveryKey} onChange={(e) => setRecoveryKey(e.target.value)} placeholder="NIXL-XXXX-XXXX-XXXX" required className="font-mono" />
                </FormField>
                <FormField label="New password" hint="At least 8 characters.">
                  <Input type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" required />
                </FormField>
                <Button type="submit" loading={busy} disabled={newPassword.length < 8} className="w-full justify-center">
                  <KeyRound size={15} /> Reset password &amp; sign in
                </Button>
              </div>
            </form>
            <p className="mt-6 text-center text-xs leading-relaxed text-ink-400">
              <button
                type="button"
                className="font-semibold text-brand-600 hover:underline"
                onClick={() => {
                  setError(null);
                  setMode("password");
                }}
              >
                ← Back to sign in
              </button>
              <br />
              Lost the recovery key too? Whoever manages your installation can reset it from the server —{" "}
              <a className="font-semibold text-brand-600 hover:underline" href={NIXEL_CONTACT_URL} target="_blank" rel="noreferrer">
                contact Nixel support
              </a>{" "}
              for the steps.
            </p>
          </>
        )}

        {mode === "recovered" && (
          <div className="animate-fade-up rounded-2xl border border-ink-200/70 bg-white p-7 shadow-pop">
            <p className="mb-4 text-sm leading-relaxed text-ink-600">
              Your password has been reset. Here's your <strong>new</strong> recovery key — the old one no longer works.
            </p>
            <div className="flex flex-col items-center rounded-xl border-2 border-dashed border-brand-300 bg-brand-50/70 px-4 py-6">
              <p className="select-all break-all text-center font-mono text-lg font-bold tracking-wider text-ink-900">{newKey}</p>
              <button
                type="button"
                onClick={copyKey}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-brand-700 shadow-card hover:bg-brand-100"
              >
                {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copied!" : "Copy key"}
              </button>
            </div>
            <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-ink-200 bg-white px-4 py-3 text-sm font-medium text-ink-700">
              <input type="checkbox" checked={keySaved} onChange={(e) => setKeySaved(e.target.checked)} className="mt-0.5 h-4 w-4 accent-brand-600" />
              I've saved my new recovery key somewhere safe.
            </label>
            <Button className="mt-4 w-full justify-center" disabled={!keySaved} onClick={onLogin}>
              Continue to my workspace
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
