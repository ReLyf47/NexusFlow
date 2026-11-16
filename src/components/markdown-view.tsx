'use client';

import * as React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { linkifyWikilinks, WIKI_HREF_PREFIX } from '@/lib/markdown';

interface MarkdownViewProps {
  content: string;
  resolve: (title: string) => string | null;
  onOpenDoc: (id: string) => void;
  onCreateDoc: (title: string) => void;
  canCreate: boolean;
}

const chip =
  'inline-flex items-center gap-0.5 font-mono text-[0.85em] font-bold px-1.5 py-px mx-0.5 border-2 bg-[var(--bg-surface-elevated)] align-baseline';

// react-markdown never renders raw HTML, so user content cannot inject markup (NFR-SEC-04)
export function MarkdownView({ content, resolve, onOpenDoc, onCreateDoc, canCreate }: MarkdownViewProps) {
  const markdown = React.useMemo(() => linkifyWikilinks(content), [content]);
  if (!content.trim()) {
    return <p className="text-[var(--text-muted)] font-mono text-sm">Dokumen kosong. Klik EDIT untuk mulai menulis Markdown.</p>;
  }
  return (
    <div className="prose-nf">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href = '', children }) => {
            if (!href.startsWith(WIKI_HREF_PREFIX)) {
              return (
                <a href={href} target="_blank" rel="noopener noreferrer">
                  {children}
                </a>
              );
            }
            const title = decodeURIComponent(href.slice(WIKI_HREF_PREFIX.length));
            const id = resolve(title);
            return id ? (
              <button
                type="button"
                onClick={() => onOpenDoc(id)}
                className={`${chip} border-[var(--border-hard)] text-[var(--text-main)] shadow-[2px_2px_0px_var(--border-hard)] hover:-translate-y-px`}
              >
                <span className="text-ink-cyan">[[</span>
                {children}
                <span className="text-ink-cyan">]]</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={!canCreate}
                onClick={() => onCreateDoc(title)}
                title={canCreate ? 'Dokumen belum ada — klik untuk membuatnya' : 'Dokumen belum ada'}
                className={`${chip} border-dashed border-[var(--text-muted)] text-[var(--text-sub)] disabled:cursor-not-allowed`}
              >
                [[{children}]]<span className="text-ink-pink">+</span>
              </button>
            );
          },
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
