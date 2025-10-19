import type { ReferenceItem } from '../lib/types';

type ReferencesListProps = {
  items: ReferenceItem[];
  isLoading: boolean;
  errorMessage: string | null;
  onRetry: () => void;
  selectedLanguage: string;
};

const getItemLabel = (item: ReferenceItem, fallbackLanguage: string) => {
  if (item.source === 'editorial') {
    return 'Official Editorial';
  }
  if (item.source === 'solutions_index') {
    const resolvedLanguage = item.language ?? fallbackLanguage;
    return `Community Solutions (Most Votes) – ${resolvedLanguage}`;
  }
  return item.title;
};

const ReferencesList = ({ items, isLoading, errorMessage, onRetry, selectedLanguage }: ReferencesListProps) => {
  if (isLoading) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex animate-pulse flex-col gap-3">
          {Array.from({ length: 3 }).map((_, idx) => (
            <div key={idx} className="h-12 rounded-xl bg-slate-200" />
          ))}
        </div>
      </section>
    );
  }

  if (errorMessage) {
    return (
      <section className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-900 shadow-sm">
        <h2 className="text-lg font-semibold">Could not load references</h2>
        <p className="mt-2 text-sm">{errorMessage}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 inline-flex items-center justify-center rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-rose-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600"
        >
          Try again
        </button>
      </section>
    );
  }

  if (!items.length) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">References</h2>
        <p className="mt-2 text-sm text-slate-500">No references available for this language yet.</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">References</h2>
      <div className="mt-4 flex gap-4 overflow-x-auto pb-2">
        {items.map((item) => (
          <article
            key={`${item.source}-${item.url}`}
            className="min-w-[240px] flex-1 rounded-xl border border-slate-200 p-4 transition hover:border-emerald-200 hover:bg-emerald-50/30"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">{getItemLabel(item, selectedLanguage)}</p>
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="mt-2 block text-sm font-medium text-slate-900 underline decoration-emerald-400 decoration-2 underline-offset-4 hover:text-emerald-700"
            >
              {item.title}
            </a>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              {item.language && <span className="rounded-full bg-slate-100 px-2 py-1 font-medium text-slate-600">{item.language}</span>}
              {typeof item.votes === 'number' && (
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 font-medium text-slate-600">
                  <span aria-hidden="true">▲</span>
                  {item.votes}
                </span>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};

export default ReferencesList;
