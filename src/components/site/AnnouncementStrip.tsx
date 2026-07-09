import { Apple, Sparkles } from "lucide-react";

export default function AnnouncementStrip() {
  return (
    <div className="relative border-y border-border bg-card/50 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-center gap-3 px-5 py-4 text-sm text-muted-foreground sm:flex-row sm:gap-6 lg:px-8">
        <span className="inline-flex items-center gap-2 font-medium text-foreground">
          <Apple className="h-4 w-4" /> Now live on the iOS App Store
        </span>
        <span aria-hidden className="hidden h-4 w-px bg-border sm:block" />
        <span className="inline-flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-accent" /> Android version currently in testing
        </span>
      </div>
    </div>
  );
}
