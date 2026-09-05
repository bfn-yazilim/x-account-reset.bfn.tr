import { useRef, useState, useEffect } from "react";
import type { Category, Operation, User } from "../types";
import { XApiClient, probeBrowserAccess } from "../lib/x-api/client";
import { paginateXApi } from "../lib/x-api/pagination";
import { safeError } from "../lib/x-api/errors";
import {
  categories,
  confirmed,
  postOperation,
  selectOperations,
} from "../features/reset/selection";
import { ResetEngine, totals } from "../features/reset/engine";
export function Dashboard({
  user,
  client,
  disconnect,
}: {
  user: User;
  client: XApiClient;
  disconnect: () => void;
}) {
  const [ops, setOps] = useState<Operation[]>([]);
  const [selected, setSelected] = useState<Category[]>([]);
  const [blocked, setBlocked] = useState<Partial<Record<Category, string>>>({});
  const [scanned, setScanned] = useState(false);
  const [busy, setBusy] = useState(false);
  const [running, setRunning] = useState(false);
  const [review, setReview] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [, render] = useState(0);
  const controller = useRef<AbortController | undefined>(undefined);
  const engine = useRef<ResetEngine | undefined>(undefined);
  useEffect(
    () => () => {
      controller.current?.abort();
      engine.current?.stop();
    },
    [],
  );
  async function scan() {
    controller.current = new AbortController();
    const signal = controller.current.signal;
    setBusy(true);
    setScanned(false);
    setOps([]);
    setSelected([]);
    setReview(false);
    engine.current = undefined;
    const found: Operation[] = [];
    const disabled: Partial<Record<Category, string>> = {};
    setMessage("Scanning the history X makes available...");
    try {
      for (const group of ["posts", "likes", "following"] as const) {
        try {
          if (group === "posts") {
            for await (const page of paginateXApi(
              (t) => client.getUserPosts(t, signal),
              signal,
            )) {
              found.push(
                ...page
                  .filter((p) => p.author_id === user.id)
                  .map(postOperation),
              );
              setOps([...found]);
            }
          } else if (group === "likes") {
            for await (const page of paginateXApi(
              (t) => client.getLikedPosts(t, signal),
              signal,
            )) {
              found.push(
                ...page.map((p) => ({
                  id: "likes:" + p.id,
                  target: p.id,
                  category: "likes" as const,
                  status: "pending" as const,
                })),
              );
              setOps([...found]);
            }
          } else {
            for await (const page of paginateXApi(
              (t) => client.getFollowing(t, signal),
              signal,
            )) {
              found.push(
                ...page.map((p) => ({
                  id: "following:" + p.id,
                  target: p.id,
                  category: "following" as const,
                  status: "pending" as const,
                })),
              );
              setOps([...found]);
            }
          }
        } catch (e) {
          signal.throwIfAborted();
          for (const cat of group === "posts"
            ? (["posts", "replies", "quotes", "reposts"] as Category[])
            : [group])
            disabled[cat] = safeError(e);
        }
      }
      for (const c of categories) {
        signal.throwIfAborted();
        const first = found.find((o) => o.category === c.id);
        if (!first || disabled[c.id]) continue;
        const path =
          c.id === "likes"
            ? `/users/${user.id}/likes/${first.target}`
            : c.id === "following"
              ? `/users/${user.id}/following/${first.target}`
              : c.id === "reposts"
                ? `/users/${user.id}/retweets/${first.target}`
                : `/tweets/${first.target}`;
        if (!(await probeBrowserAccess(path, signal)))
          disabled[c.id] =
            "Direct browser access could not be verified. This operation is disabled.";
      }
      signal.throwIfAborted();
      setBlocked(disabled);
      setScanned(true);
      setMessage(
        "Scan finished. Counts are discovered items, not your complete account history. X may limit older or unavailable items.",
      );
    } catch {
      setMessage("Scan stopped. Run a complete scan before reviewing.");
    } finally {
      setBusy(false);
    }
  }
  const chosen = selectOperations(
    ops,
    selected.filter((c) => !blocked[c]),
  );
  const tasks = engine.current?.operations ?? [];
  const counts = totals(tasks);
  async function run(retry = false) {
    if (!confirmed(confirmation) || running) return;
    if (engine.current && Date.now() < engine.current.retryAt) {
      setMessage(
        "Please wait until the rate limit reset time before retrying.",
      );
      return;
    }
    const work = retry
      ? tasks.map((o): Operation =>
          o.status === "failed"
            ? { ...o, status: "pending", detail: undefined }
            : o.status === "pending"
              ? {
                  ...o,
                  status: "skipped",
                  detail:
                    "Not attempted after stop. Rescan to include this item.",
                }
              : { ...o },
        )
      : chosen.map((o) => ({ ...o }));
    if (!work.length) return;
    setRunning(true);
    setReview(false);
    setConfirmation("");
    engine.current = new ResetEngine(
      work,
      (o) => client.execute(o),
      () => render((n) => n + 1),
    );
    await engine.current.run();
    setMessage(
      engine.current.pauseReason ||
        (engine.current.operations.some((o) => o.status === "pending")
          ? "Reset stopped. Already completed changes cannot be restored."
          : "Reset finished. Review the results below."),
    );
    setRunning(false);
    setScanned(false);
  }
  function clear() {
    controller.current?.abort();
    engine.current?.stop();
    disconnect();
  }
  return (
    <section className="dashboard">
      <div className="section-top">
        <div>
          <div className="eyebrow">YOUR RESET WORKSPACE</div>
          <h1>Account cleanup</h1>
        </div>
        <button onClick={clear}>Disconnect X account</button>
      </div>
      <div className="account">
        {user.profile_image_url && (
          <img
            src={user.profile_image_url}
            alt=""
            width="44"
            height="44"
            referrerPolicy="no-referrer"
          />
        )}
        <div>
          <span className="small">Connected as</span>
          <strong>
            {user.name} <span className="muted">@{user.username}</span>
          </strong>
        </div>
        <span className="pill">Your account only</span>
      </div>
      <p>
        Scan available history, choose categories, then review before anything
        changes.
      </p>
      <button
        className="primary"
        disabled={busy || running}
        onClick={() => void scan()}
      >
        {busy ? "Scanning..." : "Scan account"}
      </button>
      {busy && (
        <button onClick={() => controller.current?.abort()}>Stop scan</button>
      )}
      <p role="status">{message}</p>
      <div className="selection-grid">
        {categories.map((c) => (
          <label
            className={"selection " + (blocked[c.id] ? "unavailable" : "")}
            key={c.id}
          >
            <input
              type="checkbox"
              disabled={!scanned || running || !!blocked[c.id]}
              checked={selected.includes(c.id)}
              onChange={(e) => {
                setReview(false);
                setConfirmation("");
                setSelected(
                  e.target.checked
                    ? [...selected, c.id]
                    : selected.filter((id) => id !== c.id),
                );
              }}
            />
            <div>
              <h3>{c.name}</h3>
              <p>{c.description}</p>
              <small>{blocked[c.id] || "Discovered during scanning"}</small>
            </div>
            <strong>
              {busy || scanned
                ? ops.filter((o) => o.category === c.id).length.toLocaleString()
                : " - "}
            </strong>
          </label>
        ))}
      </div>
      <p className="small">
        Following cleanup affects only accounts you follow. Your followers are
        not removed. A zero following count cannot be guaranteed when X limits
        discovery.
      </p>
      {scanned && !running && (
        <button
          className="primary"
          disabled={!chosen.length}
          onClick={() => {
            setReview(true);
            setConfirmation("");
          }}
        >
          Review {chosen.length.toLocaleString()} operations
        </button>
      )}
      {review && (
        <section className="review" aria-label="Review reset">
          <h2>Review your reset</h2>
          {categories
            .filter((c) => chosen.some((o) => o.category === c.id))
            .map((c) => (
              <p key={c.id}>
                {c.verb}{" "}
                <strong>
                  {chosen
                    .filter((o) => o.category === c.id)
                    .length.toLocaleString()}
                </strong>{" "}
                {c.name.toLowerCase()}
              </p>
            ))}
          <p>
            <strong>This action cannot be undone.</strong> Deleted posts cannot
            be restored by X Account Reset.
          </p>
          <label>
            Type RESET to confirm
            <input
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <button
            className="danger"
            disabled={!confirmed(confirmation)}
            onClick={() => void run()}
          >
            Permanently reset selected items
          </button>
          <button onClick={() => setReview(false)}>Go back</button>
        </section>
      )}
      {engine.current && (
        <section className="results">
          <h2>
            {running
              ? "Reset in progress"
              : counts.completed === counts.total
                ? "Reset finished"
                : "Reset stopped"}
          </h2>
          <progress max={counts.total || 1} value={counts.completed} />
          <p>
            {counts.completed} / {counts.total} completed - {counts.successful}{" "}
            successful - {counts.failed} failed - {counts.skipped} skipped
          </p>
          {running ? (
            <>
              <button className="danger" onClick={() => engine.current?.stop()}>
                Stop reset
              </button>
              <p>
                Stops new requests. Requests already sent may complete. Stopping
                does not restore deleted content.
              </p>
            </>
          ) : (
            <>
              {categories.map((c) => {
                const n = tasks.filter(
                  (o) => o.category === c.id && o.status === "success",
                ).length;
                return n ? (
                  <p key={c.id}>
                    {n} {c.name.toLowerCase()} processed successfully
                  </p>
                ) : null;
              })}
              <details>
                <summary>View operation details</summary>
                <ul className="details">
                  {tasks.map((o) => (
                    <li key={o.id}>
                      {o.category} - {o.target} - {o.status}
                      {o.detail && "  -  " + o.detail}
                    </li>
                  ))}
                </ul>
              </details>
              {counts.failed > 0 && (
                <div className="review">
                  <p>
                    Retry only {counts.failed} failed operations. A request with
                    a lost response may already have completed on X.
                  </p>
                  <label>
                    Type RESET to retry
                    <input
                      value={confirmation}
                      onChange={(e) => setConfirmation(e.target.value)}
                    />
                  </label>
                  <button
                    className="danger"
                    disabled={!confirmed(confirmation)}
                    onClick={() => void run(true)}
                  >
                    Retry failed operations only
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      )}
    </section>
  );
}
