import { useState } from "react";
import { api } from "../lib/api";

export function FeedbackForm({ pageId, revisionId }: { pageId: string; revisionId: string }) {
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<null | string>(null);

  async function submit(helpful: boolean) {
    try {
      await api.post("/api/feedback", {
        pageId,
        revisionId,
        helpful,
        comment: message || undefined
      });
      setStatus("Thanks for the feedback.");
      setMessage("");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not save feedback.");
    }
  }

  return (
    <section className="card">
      <h3>Was this page helpful?</h3>
      <textarea
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        placeholder="Optional comment"
      />
      <div className="row">
        <button onClick={() => submit(true)}>Helpful</button>
        <button className="button-secondary" onClick={() => submit(false)}>
          Not helpful
        </button>
      </div>
      {status ? <p className="muted">{status}</p> : null}
    </section>
  );
}

