import React from 'react';

interface SkeletonBlockProps {
  className?: string;
}

const SkeletonBlock: React.FC<SkeletonBlockProps> = ({ className }) => (
  <div
    className={['animate-pulse bg-surface-container-high rounded-lg', className]
      .filter(Boolean)
      .join(' ')}
  />
);

const LoadingSkeleton: React.FC = () => (
  <div
    className="flex h-screen w-screen bg-background"
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
        </div>
      </div>

      <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
        <div className="w-full max-w-none px-3 sm:px-4 md:px-6 py-4 sm:py-6 space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <SkeletonBlock key={`card-${index}`} className="h-24" />
            ))}
          </div>

          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <SkeletonBlock key={`row-${index}`} className="h-10 w-full" />
            ))}
          </div>
        </div>
      </main>
    </div>

    <span className="sr-only">Caricamento dei contenuti</span>
  </div>
);

export default LoadingSkeleton;