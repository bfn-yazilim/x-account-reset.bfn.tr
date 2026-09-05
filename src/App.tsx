import { useState } from "react";
import { RotateCcw, Github, Sun, Moon, ArrowUpRight } from "lucide-react";
import { useAuth } from "./features/auth/useAuth";
import { Landing } from "./pages/Landing";
import { Dashboard } from "./pages/Dashboard";
export default function App() {
  const auth = useAuth();
  const [dark, setDark] = useState(
    () => matchMedia("(prefers-color-scheme: dark)").matches,
  );
  const repo =
    import.meta.env.VITE_GITHUB_URL ||
    "https://github.com/bfn-yazilim/x-account-reset.bfn.tr";
  const safeRepo = String(repo).startsWith("https://github.com/")
    ? repo
    : "https://github.com/bfn-yazilim/x-account-reset.bfn.tr";
  return (
    <div className={dark ? "app dark" : "app"}>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <header>
        <a className="brand" href="/">
          <span className="brand-icon">
            <RotateCcw size={21} />
          </span>
          X Account Reset<span className="version">v0.1.0</span>
        </a>
        <nav aria-label="Main navigation">
          <a href="#how-it-works">How it works</a>
          <a href="#privacy">Privacy</a>
          <a href={safeRepo} target="_blank" rel="noopener noreferrer">
            <Github size={16} /> GitHub <ArrowUpRight size={13} />
          </a>
          <span className="nav-divider" />
          <button
            className="icon-button"
            aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
            onClick={() => setDark(!dark)}
          >
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </nav>
      </header>
      <main id="main">
        {auth.error && (
          <div className="notice" role="alert">
            {auth.error}
          </div>
        )}
        {auth.loading ? (
          <p role="status" className="loading">
            Checking your browser session...
          </p>
        ) : auth.user ? (
          <Dashboard
            user={auth.user}
            client={auth.client}
            disconnect={auth.disconnect}
          />
        ) : (
          <Landing />
        )}
      </main>
      <footer>
        <a className="brand" href="/">
          <RotateCcw size={17} />X Account Reset
        </a>
        <span>Independent project. Not affiliated with X.</span>
        <button className="text-button" onClick={auth.disconnect}>
          Clear local data
        </button>
        <a
          href={safeRepo + "/blob/main/LICENSE"}
          target="_blank"
          rel="noopener noreferrer"
        >
          MIT license <ArrowUpRight size={12} />
        </a>
      </footer>
    </div>
  );
}
