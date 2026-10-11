/** Ladezustand als Platzhalter-Balken (respektiert reduced motion ueber index.css). */
export function Skeleton({ className = 'h-4 w-full', label = 'Wird geladen' }: { className?: string; label?: string }) {
  return <span role="status" aria-label={label} className={`skeleton block ${className}`} />;
}

export function SkeletonRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3 p-5" role="status" aria-label="Wird geladen">
      {Array.from({ length: rows }, (_, i) => (
        <span key={i} className="skeleton block h-9 w-full" />
      ))}
    </div>
  );
}
