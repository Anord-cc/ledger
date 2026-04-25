import { useState } from "react";
import { Link } from "react-router-dom";
import type { AiCitation } from "@ledger/shared";
import { api } from "../lib/api";
import { EmptyState } from "./EmptyState";
import { PageHeader } from "./PageHeader";

export function AskAiPage() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<{ answer: string; citations: AiCitation[]; disabled?: boolean } | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!question.trim()) return;

    setLoading(true);
    try {
      const response = await api.post<{ answer: string; citations: AiCitation[]; disabled?: boolean }>("/api/ai/answers", {
        question
      });
      setAnswer(response);
    } catch (error) {
      setAnswer({
        answer: error instanceof Error ? error.message : "Could not answer this question.",
        citations: []
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="stack-page">
      <PageHeader
        eyebrow="Ask AI"
        title="Ask Ledger"
        description="Ledger answers using only pages you are allowed to access, and every answer includes citations back to source documents."
      />

      <section className="panel">
        <form className="stack" onSubmit={submit}>
          <label className="field">
            Question
            <textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Ask a product, process, or onboarding question"
            />
          </label>
          <div className="panel__footer">
            <button type="submit" disabled={loading || !question.trim()}>
              {loading ? "Answering..." : "Ask AI"}
            </button>
            <p className="muted">If no permitted content is relevant, Ledger will say so instead of guessing.</p>
          </div>
        </form>
      </section>

      {answer ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <p className="eyebrow">Answer</p>
              <h3>Response</h3>
            </div>
          </div>
          {answer.disabled ? (
            <EmptyState
              title="AI provider is not configured"
              description="An admin can enable AI in Admin > AI Settings. Until then, Ask AI is intentionally unavailable."
              action={<Link to="/admin/ai" className="button-secondary">Open AI Settings</Link>}
            />
          ) : (
            <>
              <p>{answer.answer}</p>
              <div className="citation-list">
                {answer.citations.length === 0 ? (
                  <p className="muted">No citations were returned for this answer.</p>
                ) : (
                  answer.citations.map((citation) => (
                    <Link key={citation.slug} to={`/page/${citation.slug}`} className="citation-chip">
                      {citation.title}
                    </Link>
                  ))
                )}
              </div>
            </>
          )}
        </section>
      ) : null}
    </div>
  );
}
