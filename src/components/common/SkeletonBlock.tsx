interface SkeletonBlockProps {
  className?: string;
}

export function SkeletonBlock({ className = "h-24" }: SkeletonBlockProps) {
  return <div className={`animate-pulse rounded-2xl bg-slate-200/70 ${className}`} />;
}
