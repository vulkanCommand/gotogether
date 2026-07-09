import icon from "@/assets/gotogether-icon.png.asset.json";

export default function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <a href="#top" className="flex items-center gap-2.5 outline-none">
      <img
        src={icon.url}
        alt="GoTogether"
        width={36}
        height={36}
        className="h-9 w-9 rounded-lg shadow-card ring-1 ring-border/60"
      />
      {!compact && (
        <span className="text-base font-semibold tracking-tight text-foreground">GoTogether</span>
      )}
    </a>
  );
}
