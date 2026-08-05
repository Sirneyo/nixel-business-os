import { ArrowRight, Blocks, Check, CheckCircle2, Copy, Eye, EyeOff, KeyRound } from "lucide-react";
import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";

import { completeOnboarding, fetchHealth, register } from "../api/client";
import { ErrorNote } from "../components/ui";

type Scene = "welcome" | "account" | "recovery" | "name" | "industry" | "offer" | "disclaimer" | "building" | "done";

const CONFETTI_COLORS = ["#22c55e", "#4ade80", "#8b5cf6", "#f59e0b", "#0ea5e9", "#f472b6"];

export default function Onboarding({ needsAccount, onDone }: { needsAccount: boolean; onDone: () => void }) {
  const [scene, setScene] = useState<Scene>("welcome");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [disclaimer, setDisclaimer] = useState("");

  const [account, setAccount] = useState({ email: "", password: "", confirm: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [recoveryKey, setRecoveryKey] = useState("");
  const [keySaved, setKeySaved] = useState(false);
  const [copied, setCopied] = useState(false);

  const [form, setForm] = useState({ business_name: "", industry: "", primary_offer: "" });

  useEffect(() => {
    fetchHealth().then((h) => setDisclaimer(h.disclaimer)).catch(() => undefined);
  }, []);

  function go(next: Scene) {
    setError(null);
    setScene(next);
  }

  // ── Scene handlers ─────────────────────────────────────────────────────

  async function submitAccount(event: FormEvent) {
    event.preventDefault();
    if (account.password !== account.confirm) {
      setError("The two passwords don't match.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await register(account.email.trim(), account.password);
      setRecoveryKey(result.recovery_key);
      go("recovery");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the account");
    } finally {
      setBusy(false);
    }
  }

  const strength = useMemo(() => passwordStrength(account.password), [account.password]);
  const accountValid = account.email.includes("@") && account.password.length >= 8 && account.confirm.length >= 8;

  async function copyKey() {
    try {
      await navigator.clipboard.writeText(recoveryKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable (http) — user can select the text manually.
    }
  }

  const firstName = form.business_name.trim().split(/\s+/)[0] || "there";

  return (
    <div className="relative flex min-h-full items-center justify-center overflow-hidden bg-ink-50 p-4 sm:p-6">
      <Aurora />

      <div className="relative z-10 w-full max-w-2xl">
        {scene === "welcome" && (
          <SceneShell key="welcome">
            <div className="flex flex-col items-center text-center">
              <div className="pop-in mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-brand-600 text-white shadow-pop">
                <Blocks size={38} strokeWidth={2.2} />
              </div>
              <h1 className="font-display text-4xl font-extrabold tracking-tight text-ink-900 sm:text-5xl">
                Welcome to <span className="text-brand-600">Nixel</span>
              </h1>
              <p className="mt-4 max-w-md text-base leading-relaxed text-ink-500 sm:text-lg">
                Leads found, researched, contacted and closed — one system, working for your business.
              </p>
              <p className="mt-1 text-sm font-medium text-ink-400">Let's build your workspace. It takes under a minute.</p>
              <BigButton className="mt-8" onClick={() => go(needsAccount ? "account" : "name")}>
                Begin <ArrowRight size={18} />
              </BigButton>
            </div>
          </SceneShell>
        )}

        {scene === "account" && (
          <SceneShell key="account">
            <form onSubmit={submitAccount}>
              <SceneTitle
                kicker="Step 1 — your account"
                title="First, let's secure your workspace"
                subtitle="Your password is securely scrambled and stored only on your own installation — never sent to Nixel."
              />
              <ErrorNote message={error} />
              <div className="space-y-4">
                <BigField label="Email">
                  <BigInput
                    type="email"
                    autoComplete="email"
                    value={account.email}
                    onChange={(v) => setAccount((a) => ({ ...a, email: v }))}
                    placeholder="you@yourbusiness.com"
                    autoFocus
                  />
                </BigField>
                <BigField label="Password">
                  <div className="relative">
                    <BigInput
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      value={account.password}
                      onChange={(v) => setAccount((a) => ({ ...a, password: v }))}
                      placeholder="At least 8 characters"
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-ink-400 hover:text-ink-600"
                      onClick={() => setShowPassword((s) => !s)}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {account.password && (
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex h-1.5 flex-1 gap-1">
                        {[0, 1, 2].map((i) => (
                          <div
                            key={i}
                            className={`flex-1 rounded-full transition-colors duration-300 ${
                              strength.score > i ? strength.barClass : "bg-ink-200"
                            }`}
                          />
                        ))}
                      </div>
                      <span className={`text-xs font-semibold ${strength.textClass}`}>{strength.label}</span>
                    </div>
                  )}
                </BigField>
                <BigField label="Confirm password">
                  <BigInput
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={account.confirm}
                    onChange={(v) => setAccount((a) => ({ ...a, confirm: v }))}
                    placeholder="Same again"
                  />
                </BigField>
              </div>
              <SceneNav>
                <GhostButton onClick={() => go("welcome")}>Back</GhostButton>
                <BigButton type="submit" disabled={!accountValid} loading={busy}>
                  Create account <ArrowRight size={18} />
                </BigButton>
              </SceneNav>
            </form>
          </SceneShell>
        )}

        {scene === "recovery" && (
          <SceneShell key="recovery">
            <SceneTitle
              kicker="Step 2 — keep this safe"
              title="Your recovery key"
              subtitle="If you ever forget your password, this key is the only way back into your workspace. Save it somewhere safe — a password manager, or written down."
            />
            <div className="pop-in flex flex-col items-center rounded-2xl border-2 border-dashed border-brand-300 bg-brand-50/70 px-6 py-8">
              <KeyRound size={22} className="mb-3 text-brand-600" />
              <p className="select-all break-all text-center font-mono text-xl font-bold tracking-wider text-ink-900 sm:text-2xl">
                {recoveryKey}
              </p>
              <button
                type="button"
                onClick={copyKey}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-white px-3.5 py-2 text-sm font-semibold text-brand-700 shadow-card transition-colors hover:bg-brand-100"
              >
                {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? "Copied!" : "Copy key"}
              </button>
            </div>
            <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-ink-200 bg-white px-4 py-3.5 text-sm font-medium text-ink-700 transition-colors hover:border-brand-300">
              <input
                type="checkbox"
                checked={keySaved}
                onChange={(e) => setKeySaved(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-brand-600"
              />
              I've saved my recovery key somewhere safe. I understand it won't be shown again.
            </label>
            <SceneNav>
              <span />
              <BigButton disabled={!keySaved} onClick={() => go("name")}>
                Continue <ArrowRight size={18} />
              </BigButton>
            </SceneNav>
          </SceneShell>
        )}

        {scene === "name" && (
          <QuestionScene
            key="name"
            kicker="Your business"
            title="What's your business called?"
            value={form.business_name}
            onChange={(v) => setForm((f) => ({ ...f, business_name: v }))}
            placeholder="e.g. Atlas Consulting"
            valid={form.business_name.trim().length > 1}
            onBack={needsAccount ? undefined : () => go("welcome")}
            onNext={() => go("industry")}
            error={error}
          />
        )}

        {scene === "industry" && (
          <QuestionScene
            key="industry"
            kicker={`Nice to meet you, ${firstName} 👋`}
            title={`What does ${form.business_name.trim() || "your business"} do?`}
            subtitle="Your industry in a few words — this tunes your lead searches and emails."
            value={form.industry}
            onChange={(v) => setForm((f) => ({ ...f, industry: v }))}
            placeholder="e.g. Marketing, Recruitment, Landscaping"
            valid={form.industry.trim().length > 0}
            onBack={() => go("name")}
            onNext={() => go("offer")}
            error={error}
          />
        )}

        {scene === "offer" && (
          <QuestionScene
            key="offer"
            kicker="Almost there"
            title="What's your main offer?"
            subtitle="Optional — used as {{primary_offer}} in your emails. You can skip this and set it later."
            value={form.primary_offer}
            onChange={(v) => setForm((f) => ({ ...f, primary_offer: v }))}
            placeholder="e.g. done-for-you social media management"
            valid
            skippable
            onBack={() => go("industry")}
            onNext={() => go("disclaimer")}
            error={error}
          />
        )}

        {scene === "disclaimer" && (
          <SceneShell key="disclaimer">
            <SceneTitle kicker="One thing before we start" title="The honest bit" subtitle="Please read this once — it matters when you start working with real customer data." />
            <ErrorNote message={error} />
            {disclaimer && (
              <div className="max-h-52 overflow-y-auto rounded-xl border border-warn-500/30 bg-warn-50 p-4 text-xs leading-relaxed text-warn-700">
                {disclaimer}
              </div>
            )}
            <SceneNav>
              <GhostButton onClick={() => go("offer")}>Back</GhostButton>
              <BigButton onClick={() => go("building")}>
                I understand — build my workspace <ArrowRight size={18} />
              </BigButton>
            </SceneNav>
          </SceneShell>
        )}

        {(scene === "building" || scene === "done") && (
          <BuildingScene
            businessName={form.business_name.trim()}
            industry={form.industry.trim()}
            done={scene === "done"}
            onBuilt={async () => {
              try {
                await completeOnboarding(form);
                setScene("done");
                setTimeout(onDone, 2600);
              } catch (err) {
                setError(err instanceof Error ? err.message : "Something went wrong");
                setScene("disclaimer");
              }
            }}
          />
        )}
      </div>
    </div>
  );
}

// ── Building finale ──────────────────────────────────────────────────────────

function BuildingScene({
  businessName,
  industry,
  done,
  onBuilt,
}: {
  businessName: string;
  industry: string;
  done: boolean;
  onBuilt: () => void;
}) {
  const steps = useMemo(
    () => [
      "Securing your account",
      "Building your dashboard",
      `Calibrating the Lead Engine for ${industry || "your market"}`,
      "Wiring your outreach tools",
      "Polishing your pipeline",
    ],
    [industry],
  );
  const [completed, setCompleted] = useState(0);
  const firedRef = useRef(false);

  useEffect(() => {
    const timers = steps.map((_, i) =>
      setTimeout(() => setCompleted(i + 1), 700 * (i + 1)),
    );
    return () => timers.forEach(clearTimeout);
  }, [steps]);

  useEffect(() => {
    if (completed === steps.length && !firedRef.current) {
      firedRef.current = true;
      // Small beat after the last tick before the reveal.
      setTimeout(onBuilt, 500);
    }
  }, [completed, steps.length, onBuilt]);

  if (done) {
    return (
      <SceneShell key="done">
        <Confetti />
        <div className="flex flex-col items-center py-10 text-center">
          <div className="pop-in mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-brand-600 text-white shadow-pop">
            <CheckCircle2 size={40} strokeWidth={2.2} />
          </div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">
            Welcome, <span className="text-brand-600">{businessName || "friend"}</span>
          </h1>
          <p className="mt-3 text-base text-ink-500">Your workspace is ready. Taking you in…</p>
        </div>
      </SceneShell>
    );
  }

  return (
    <SceneShell key="building">
      <div className="py-6">
        <div className="mb-8 text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-brand-600">Hold tight</p>
          <h2 className="mt-1 font-display text-2xl font-extrabold tracking-tight text-ink-900 sm:text-3xl">
            Building {businessName ? `${businessName}'s` : "your"} workspace
          </h2>
        </div>
        <div className="mx-auto max-w-md space-y-3">
          {steps.map((label, i) => {
            const state = i < completed ? "done" : i === completed ? "active" : "todo";
            if (state === "todo") return <div key={label} className="h-9" />;
            return (
              <div key={label} className="build-step-in flex items-center gap-3">
                {state === "done" ? (
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white">
                    <Check size={13} strokeWidth={3} />
                  </span>
                ) : (
                  <span className="h-6 w-6 shrink-0 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
                )}
                <span className={`text-sm font-medium ${state === "done" ? "text-ink-500" : "text-ink-800"}`}>{label}…</span>
              </div>
            );
          })}
        </div>
        <div className="mx-auto mt-8 h-1.5 max-w-md overflow-hidden rounded-full bg-ink-100">
          <div
            className="h-full rounded-full bg-brand-500 transition-all duration-700 ease-out"
            style={{ width: `${(completed / steps.length) * 100}%` }}
          />
        </div>
      </div>
    </SceneShell>
  );
}

function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 48 }, (_, i) => ({
        left: `${Math.random() * 100}%`,
        background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        animationDelay: `${Math.random() * 0.7}s`,
        animationDuration: `${2 + Math.random() * 1.4}s`,
      })),
    [],
  );
  return (
    <div className="pointer-events-none fixed inset-0 z-20 overflow-hidden">
      {pieces.map((style, i) => (
        <span key={i} className="confetti-piece" style={style} />
      ))}
    </div>
  );
}

// ── Question scene (one big question per screen) ─────────────────────────────

function QuestionScene({
  kicker,
  title,
  subtitle,
  value,
  onChange,
  placeholder,
  valid,
  skippable = false,
  onBack,
  onNext,
  error,
}: {
  kicker: string;
  title: string;
  subtitle?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  valid: boolean;
  skippable?: boolean;
  onBack?: () => void;
  onNext: () => void;
  error: string | null;
}) {
  return (
    <SceneShell>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) onNext();
        }}
      >
        <SceneTitle kicker={kicker} title={title} subtitle={subtitle} />
        <ErrorNote message={error} />
        <BigInput value={value} onChange={onChange} placeholder={placeholder} autoFocus className="text-lg sm:text-xl" />
        <p className="mt-2 text-right text-xs font-medium text-ink-400">
          press <kbd className="rounded border border-ink-200 bg-ink-50 px-1.5 py-0.5 font-sans">Enter ↵</kbd>
        </p>
        <SceneNav>
          {onBack ? <GhostButton onClick={onBack}>Back</GhostButton> : <span />}
          <BigButton type="submit" disabled={!valid}>
            {skippable && !value.trim() ? "Skip for now" : "Continue"} <ArrowRight size={18} />
          </BigButton>
        </SceneNav>
      </form>
    </SceneShell>
  );
}

// ── Shared shell + controls ──────────────────────────────────────────────────

function Aurora() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <div className="aurora-blob aurora-1 bg-brand-300" style={{ width: "45vw", height: "45vw", top: "-12%", left: "-8%" }} />
      <div className="aurora-blob aurora-2 bg-accent-100" style={{ width: "40vw", height: "40vw", bottom: "-15%", right: "-10%" }} />
      <div className="aurora-blob aurora-3 bg-brand-100" style={{ width: "35vw", height: "35vw", top: "30%", right: "20%" }} />
    </div>
  );
}

function SceneShell({ children }: { children: ReactNode }) {
  return (
    <div className="scene-enter rounded-3xl border border-white/60 bg-white/80 p-6 shadow-pop backdrop-blur-xl sm:p-10">
      {children}
    </div>
  );
}

function SceneTitle({ kicker, title, subtitle }: { kicker: string; title: string; subtitle?: string }) {
  return (
    <div className="mb-6">
      <p className="text-xs font-bold uppercase tracking-widest text-brand-600">{kicker}</p>
      <h2 className="mt-1.5 font-display text-2xl font-extrabold tracking-tight text-ink-900 sm:text-3xl">{title}</h2>
      {subtitle && <p className="mt-2 max-w-lg text-sm leading-relaxed text-ink-500">{subtitle}</p>}
    </div>
  );
}

function SceneNav({ children }: { children: ReactNode }) {
  return <div className="mt-8 flex items-center justify-between gap-3">{children}</div>;
}

function BigField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-ink-700">{label}</span>
      {children}
    </label>
  );
}

function BigInput({
  value,
  onChange,
  className = "",
  ...props
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  type?: string;
  placeholder?: string;
  autoFocus?: boolean;
  autoComplete?: string;
}) {
  return (
    <input
      {...props}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full rounded-xl border border-ink-200 bg-white px-4 py-3.5 text-base text-ink-900 shadow-card outline-none transition-all placeholder:text-ink-300 focus:border-brand-400 focus:ring-4 focus:ring-brand-500/15 ${className}`}
    />
  );
}

function BigButton({
  children,
  className = "",
  loading = false,
  disabled,
  ...props
}: {
  children: ReactNode;
  className?: string;
  loading?: boolean;
  disabled?: boolean;
  type?: "button" | "submit";
  onClick?: () => void;
}) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-6 py-3 text-base font-bold text-white shadow-pop transition-all hover:bg-brand-700 hover:shadow-lg active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
    >
      {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
      {children}
    </button>
  );
}

function GhostButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl px-4 py-3 text-sm font-semibold text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-800"
    >
      {children}
    </button>
  );
}

// ── Password strength ────────────────────────────────────────────────────────

function passwordStrength(password: string): { score: number; label: string; barClass: string; textClass: string } {
  if (!password) return { score: 0, label: "", barClass: "", textClass: "" };
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12 && /[a-z]/.test(password) && /[A-Z0-9]/.test(password)) score++;
  if (password.length >= 14 && /[^a-zA-Z0-9]/.test(password)) score++;
  if (score <= 1) return { score: Math.max(score, 1), label: password.length < 8 ? "Too short" : "Okay", barClass: "bg-warn-500", textClass: "text-warn-600" };
  if (score === 2) return { score, label: "Good", barClass: "bg-brand-500", textClass: "text-brand-600" };
  return { score, label: "Strong", barClass: "bg-brand-600", textClass: "text-brand-700" };
}
