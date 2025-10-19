type StatusBarProps = {
  apiBase: string;
  lastUpdated: Date | null;
  isRefreshing: boolean;
};

const StatusBar = ({ apiBase, lastUpdated, isRefreshing }: StatusBarProps) => (
  <section className="bg-slate-900 text-slate-100">
    <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-2 text-xs sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <p className="font-medium">
        API: <span className="font-normal text-slate-300">{apiBase}</span>
      </p>
      <p className="flex items-center gap-2" aria-live="polite">
        {isRefreshing ? (
          <span className="inline-flex items-center gap-2 text-amber-300">
            <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-amber-300" aria-hidden="true" />
            Refreshing…
          </span>
        ) : (
          <>
            Last updated:{' '}
            <span className="text-slate-300">
              {lastUpdated ? lastUpdated.toLocaleString() : 'Waiting for data'}
            </span>
          </>
        )}
      </p>
    </div>
  </section>
);

export default StatusBar;
