import type { POTD } from '../lib/types';

type PotdCardProps = {
  potd: POTD | null;
  isLoading: boolean;
  errorMessage: string | null;
  onRetry: () => void;
  onOpenLink: () => void;
};

const difficultyStyles: Record<POTD['difficulty'], string> = {
  Easy: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
  Medium: 'bg-amber-100 text-amber-800 ring-amber-200',
  Hard: 'bg-rose-100 text-rose-800 ring-rose-200'
};

const PotdCard = ({ potd, isLoading, errorMessage, onRetry, onOpenLink }: PotdCardProps) => {
  if (isLoading) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex animate-pulse flex-col gap-4">
          <div className="h-4 w-24 rounded-full bg-slate-200" />
          <div className="h-6 w-3/4 rounded-full bg-slate-200" />
          <div className="h-4 w-1/3 rounded-full bg-slate-200" />
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 4 }).map((_, idx) => (
              <span key={idx} className="h-6 w-16 rounded-full bg-slate-200" />
            ))}
          </div>
          <div className="h-10 w-40 rounded-xl bg-slate-200" />
        </div>
      </section>
    );
  }

  if (errorMessage) {
    return (
      <section className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-900 shadow-sm">
        <h2 className="text-lg font-semibold">We hit a snag</h2>
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

  if (!potd) {
    return null;
  }

  const difficultyBadge = difficultyStyles[potd.difficulty];

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <header className="flex flex-col gap-3">
        <div className="inline-flex items-center gap-2 text-xs text-slate-500">
          <span className="font-semibold uppercase tracking-wide text-slate-400">POTD</span>
          <time dateTime={potd.date}>{new Date(potd.date).toLocaleDateString()}</time>
        </div>
        <h2 className="text-2xl font-semibold text-slate-900">{potd.title}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${difficultyBadge}`}>
            {potd.difficulty}
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
            #{potd.frontendId}
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
            AC Rate: {Math.round(potd.acRate)}%
          </span>
        </div>
      </header>
      <ul className="flex flex-wrap gap-2">
        {potd.tags.map((tag) => (
          <li key={tag.slug}>
            <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
              {tag.name}
            </span>
          </li>
        ))}
      </ul>
      <div>
        <button
          type="button"
          onClick={onOpenLink}
          className="inline-flex w-full items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-emerald-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 sm:w-auto"
        >
          Open on LeetCode
        </button>
      </div>
    </section>
  );
};

export default PotdCard;
