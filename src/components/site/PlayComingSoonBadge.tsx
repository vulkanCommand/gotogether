import { cn } from "@/lib/utils";

export default function PlayComingSoonBadge({ className }: { className?: string }) {
  return (
    <div
      aria-disabled="true"
      className={cn(
        "inline-flex cursor-not-allowed items-center gap-3 rounded-xl border border-border bg-card/60 px-5 py-3 text-left opacity-80",
        className,
      )}
    >
      <svg viewBox="0 0 24 24" className="h-6 w-6 text-muted-foreground" fill="currentColor" aria-hidden>
        <path d="M3.6 2.3c-.4.3-.6.8-.6 1.4v16.6c0 .6.2 1.1.6 1.4l9.7-9.7L3.6 2.3zm11 8.4L5.2 1.6c.2 0 .5.1.7.2L16.6 8l-2 2.7zm3.6 2L20.9 14c.8.5.8 1.6 0 2.1l-2.7 1.5-3-3 3-2.9zm-3.6 2L5.9 22.4c-.2.1-.5.2-.7.2l9.4-9.1 2 2.2z"/>
      </svg>
      <span className="flex flex-col leading-tight">
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Google Play</span>
        <span className="text-sm font-semibold text-foreground">Coming soon</span>
      </span>
    </div>
  );
}
