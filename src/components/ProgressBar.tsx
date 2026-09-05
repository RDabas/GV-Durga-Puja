export function ProgressBar({ percent }: { percent: number }) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div className="mt-2.5 h-2 rounded-full bg-ground-alt overflow-hidden">
      <div
        className="h-full rounded-full bg-gradient-to-r from-brand to-gold"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
