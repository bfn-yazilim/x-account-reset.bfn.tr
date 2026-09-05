import {
  ArrowRight,
  FileText,
  MessageSquare,
  Quote,
  Repeat2,
  Heart,
  Users,
  ShieldCheck,
  Check,
  LockKeyhole,
  RotateCcw,
  Code2,
  Database,
  KeyRound,
} from "lucide-react";
import { useState } from "react";
import { connect } from "../lib/oauth/pkce";
import { probeBrowserAccess } from "../lib/x-api/client";
import { categories } from "../features/reset/selection";
export function Landing() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function start() {
    setBusy(true);
    setError("");
    try {
      if (!import.meta.env.VITE_X_CLIENT_ID)
        throw new Error(
          "Connection is not configured yet. The site owner must set VITE_X_CLIENT_ID and rebuild.",
        );
      if (!(await probeBrowserAccess()))
        throw new Error(
          "X did not confirm direct browser access. Account connection is disabled because CORS or network restrictions prevent a verified connection. This app never uses a proxy.",
        );
      await connect();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to connect.");
      setBusy(false);
    }
  }
  return (
    <>
      <section className="hero">
        <div className="eyebrow">
          <span className="dot" /> YOUR ACCOUNT. YOUR NEXT CHAPTER.
        </div>
        <h1>
          A fresh start.
          <br />
          <span>Still your account.</span>
        </h1>
        <p className="hero-copy">
          Leave the old posts behind, not your identity.
          <br />
          Clean up your X account directly from your browser,
          <br className="desktop" /> with your privacy intact and you in
          control.
        </p>
        <button
          className="primary connect"
          onClick={() => void start()}
          disabled={busy}
        >
          {busy ? "Checking browser access..." : "Connect X Account"}
          <ArrowRight size={18} />
        </button>
        <p className="small secure">
          <LockKeyhole size={13} /> Secure OAuth connection. No password needed.
        </p>
        {error && (
          <div className="notice" role="alert">
            {error}
          </div>
        )}
        <div className="hero-tags">
          <span>
            <Check size={14} />
            100% browser-based
          </span>
          <span>
            <Check size={14} />
            Open source
          </span>
          <span>
            <Check size={14} />
            Your choice, every step
          </span>
        </div>
      </section>
      <section className="cleanup-preview" aria-labelledby="cleanup-title">
        <div className="section-top">
          <div>
            <div className="eyebrow">LESS HISTORY. MORE POSSIBILITY.</div>
            <h2 id="cleanup-title">Decide what stays. Reset the rest.</h2>
            <p>Six ways to clean up. You choose exactly what to remove.</p>
          </div>
          <span className="pill">
            <RotateCcw size={14} /> Keep your account
          </span>
        </div>
        <div className="category-grid">
          {categories.map((c, i) => (
            <article className="category-card" key={c.id}>
              <span className="category-symbol">
                {
                  [
                    <FileText key="p" size={22} />,
                    <MessageSquare key="r" size={22} />,
                    <Quote key="q" size={22} />,
                    <Repeat2 key="rt" size={22} />,
                    <Heart key="l" size={22} />,
                    <Users key="f" size={22} />,
                  ][i]
                }
              </span>
              <h3>{c.name}</h3>
              <p>{c.description}</p>
            </article>
          ))}
        </div>
        <div className="preview-note">
          <ShieldCheck size={16} /> Nothing changes until you review and
          confirm.
        </div>
      </section>
      <section className="privacy" id="privacy">
        <div className="privacy-heading">
          <div className="icon-tile">
            <ShieldCheck size={25} />
          </div>
          <h2>
            Privacy isn't a setting.
            <br />
            It's how this is built.
          </h2>
          <p>
            Your X credentials never touch our servers - <br />
            because there is no application backend.
          </p>
          <a
            href="https://docs.x.com/fundamentals/authentication/oauth-2-0/authorization-code"
            target="_blank"
            rel="noopener noreferrer"
          >
            How the connection works <ArrowRight size={14} />
          </a>
        </div>
        <div className="privacy-grid">
          {[
            [
              Database,
              "No backend. No database.",
              "Your data travels directly between your browser and X.",
            ],
            [
              KeyRound,
              "No passwords. No secrets.",
              "Connect with official OAuth and a public Client ID.",
            ],
            [
              LockKeyhole,
              "Your browser, your session.",
              "Tokens stay in this tab's session storage. Clear them anytime.",
            ],
            [
              Code2,
              "Open source. Open to scrutiny.",
              "Inspect the code and see exactly how your account is handled.",
            ],
          ].map(([Icon, title, copy]) => {
            const I = Icon as typeof Database;
            return (
              <div key={String(title)}>
                <I size={20} />
                <h3>{String(title)}</h3>
                <p>{String(copy)}</p>
              </div>
            );
          })}
        </div>
      </section>
      <section className="how" id="how-it-works">
        <h2>A deliberate reset, in three steps.</h2>
        <div className="steps">
          {[
            ["01", "Connect securely", "Authorize your own account through X."],
            [
              "02",
              "Choose and review",
              "Scan available history and review your selection.",
            ],
            [
              "03",
              "Confirm your reset",
              "Type RESET to start. Follow progress or stop anytime.",
            ],
          ].map(([n, title, copy]) => (
            <article key={n}>
              <span>{n}</span>
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </section>
      <div className="footnote">
        <ShieldCheck size={18} />
        <p>
          <strong>A fresh start deserves a careful decision.</strong> Deleted
          posts cannot be restored by X Account Reset. X API access, history
          limits, and browser compatibility may restrict available operations.
        </p>
      </div>
    </>
  );
}
