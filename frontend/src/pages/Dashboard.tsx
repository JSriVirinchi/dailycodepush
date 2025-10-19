import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Header from '../components/Header';
import Footer from '../components/Footer';
import StatusBar from '../components/StatusBar';
import PotdCard from '../components/PotdCard';
import LanguagePicker from '../components/LanguagePicker';
import ReferencesList from '../components/ReferencesList';
import SolutionViewer from '../components/SolutionViewer';
import LeetCodeSessionConnector from '../components/LeetCodeSessionConnector';
import { getPOTD, getReferences, API_BASE_URL, ApiError } from '../lib/api';
import type { POTD, ReferencesResponse } from '../lib/types';

const getErrorMessage = (error: unknown) => {
  if (!error) {
    return null;
  }
  if (error instanceof ApiError) {
    return `${error.message}. Status: ${error.status}`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Unexpected error.';
};

const Dashboard = () => {
  const [language, setLanguage] = useState('python');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const potdQuery = useQuery<POTD>({
    queryKey: ['potd'],
    queryFn: getPOTD
  });

  const potd: POTD | null = potdQuery.data ?? null;

  const referencesQuery = useQuery<ReferencesResponse>({
    queryKey: ['refs', potd?.slug, language],
    queryFn: () => getReferences(potd!.slug, language),
    enabled: Boolean(potd?.slug),
    staleTime: 60_000,
    placeholderData: (previousData) => previousData ?? undefined
  });

  const references = referencesQuery.data?.items ?? [];
  const communitySolution = referencesQuery.data?.community_solution ?? null;
  const isReferencesLoading = useMemo(
    () => referencesQuery.isLoading || (referencesQuery.isFetching && !referencesQuery.data),
    [referencesQuery.isLoading, referencesQuery.isFetching, referencesQuery.data]
  );

  const referencesErrorMessage = getErrorMessage(referencesQuery.error);
  const potdErrorMessage = getErrorMessage(potdQuery.error);
  const isRefreshing = potdQuery.isFetching || referencesQuery.isFetching;

  useEffect(() => {
    if (potdQuery.data || referencesQuery.data) {
      setLastUpdated(new Date());
    }
  }, [potdQuery.data, referencesQuery.data]);

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <Header />
      <StatusBar apiBase={API_BASE_URL} lastUpdated={lastUpdated} isRefreshing={isRefreshing} />
      <main className="flex-1">
        <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
          <PotdCard
            potd={potd}
            isLoading={potdQuery.isLoading}
            errorMessage={potdErrorMessage}
            onRetry={() => potdQuery.refetch()}
            onOpenLink={() => {
              if (potd?.link) {
                window.open(potd.link, '_blank', 'noreferrer');
              }
            }}
          />
          <LanguagePicker value={language} onChange={setLanguage} />
          <LeetCodeSessionConnector />
          <SolutionViewer
            solution={communitySolution}
            isLoading={isReferencesLoading}
            errorMessage={referencesErrorMessage}
            onRetry={() => referencesQuery.refetch()}
            selectedLanguage={language}
            questionSlug={referencesQuery.data?.slug ?? potd?.slug ?? null}
          />
          <ReferencesList
            items={references}
            isLoading={isReferencesLoading}
            errorMessage={referencesErrorMessage}
            onRetry={() => referencesQuery.refetch()}
            selectedLanguage={language}
          />
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Dashboard;
