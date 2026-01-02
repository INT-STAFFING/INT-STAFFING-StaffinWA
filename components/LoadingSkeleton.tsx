import React from 'react';

interface SkeletonBlockProps {
  className?: string;
}

const SkeletonBlock: React.FC<SkeletonBlockProps> = ({ className }) => {
  return (
    <div
      className={['animate-pulse bg-surface-container-high rounded-lg', className]
        .filter(Boolean)
        .join(' ')}
    />
  );
};

const LoadingSkeleton: React.FC = () => (
  <div
    className="flex h-screen w-screen bg-background text-on-surface"
    role="status"
    aria-live="polite"
    aria-label="Caricamento in corso"
  >
    <div className="hidden md:block w-64 border-r border-outline-variant bg-surface" />
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="bg-surface border-b border-outline-variant">
        <div className="p-4 h-20 flex items-center gap-4">
          <SkeletonBlock className="h-10 w-10 rounded-full" />
          <div className="space-y-2 w-full">
            <SkeletonBlock className="h-4 w-1/4" />
            <SkeletonBlock className="h-4 w-1/5" />
          </div>
          <SkeletonBlock className="hidden md:block h-10 w-32 rounded-full" />
        </div>
      </div>

      <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
        <div className="w-full max-w-none px-3 sm:px-4 md:px-6 py-4 sm:py-6 space-y-6">
          <section className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <SkeletonBlock className="h-9 w-44" />
              <SkeletonBlock className="h-9 w-28" />
              <SkeletonBlock className="h-9 w-24" />
              <div className="flex-1 min-w-[200px] max-w-md">
                <SkeletonBlock className="h-10 w-full" />
              </div>
              <SkeletonBlock className="h-10 w-24" />
              <SkeletonBlock className="h-10 w-24" />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <SkeletonBlock key={`chip-${index}`} className="h-7 w-28 rounded-full" />
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-outline-variant bg-surface p-4 shadow-sm">
            <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
              <div className="space-y-2 w-1/2 min-w-[200px]">
                <SkeletonBlock className="h-4 w-1/3" />
                <SkeletonBlock className="h-6 w-2/3" />
              </div>
              <div className="flex items-center gap-2">
                <SkeletonBlock className="h-10 w-24" />
                <SkeletonBlock className="h-10 w-32" />
              </div>
            </div>

            <div className="overflow-hidden rounded-lg border border-outline-variant">
              <div className="grid grid-cols-6 bg-surface-container-high px-4 py-3 gap-3">
                <SkeletonBlock className="h-4 w-20" />
                <SkeletonBlock className="h-4 w-28" />
                <SkeletonBlock className="h-4 w-24" />
                <SkeletonBlock className="h-4 w-28" />
                <SkeletonBlock className="h-4 w-16" />
                <SkeletonBlock className="h-4 w-12" />
              </div>
              <div className="divide-y divide-outline-variant/80 bg-surface">
                {Array.from({ length: 7 }).map((_, rowIndex) => (
                  <div
                    key={`row-${rowIndex}`}
                    className="grid grid-cols-6 items-center px-4 py-3 gap-3"
                  >
                    <SkeletonBlock className="h-4 w-16" />
                    <SkeletonBlock className="h-4 w-24" />
                    <SkeletonBlock className="h-4 w-28" />
                    <SkeletonBlock className="h-4 w-20" />
                    <SkeletonBlock className="h-4 w-12" />
                    <div className="flex items-center justify-end gap-2">
                      <SkeletonBlock className="h-8 w-8 rounded-full" />
                      <SkeletonBlock className="h-8 w-8 rounded-full" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between pt-4">
              <div className="flex items-center gap-2">
                <SkeletonBlock className="h-4 w-24" />
                <SkeletonBlock className="h-4 w-12" />
              </div>
              <div className="flex items-center gap-2">
                {Array.from({ length: 5 }).map((_, index) => (
                  <SkeletonBlock key={`page-${index}`} className="h-9 w-9 rounded-full" />
                ))}
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>

    <span className="sr-only">Caricamento dei contenuti</span>
  </div>
);

export default LoadingSkeleton;
