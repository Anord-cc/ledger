export function MarkdownComposerHint() {
  return (
    <section className="markdown-helper" aria-label="Markdown supported">
      <div className="markdown-helper__header">
        <p className="eyebrow">Composer</p>
        <h4>Markdown supported</h4>
      </div>
      <div className="markdown-helper__body">
        <code># Heading</code>
        <code>- Bullet list</code>
        <code>```code```</code>
        <code>&gt; Quote</code>
        <code>[Link](https://example.com)</code>
      </div>
      <p className="markdown-helper__note">Paste Markdown and Ledger will format it automatically.</p>
    </section>
  );
}
