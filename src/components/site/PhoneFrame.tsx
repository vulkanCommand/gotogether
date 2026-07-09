import { cn } from "@/lib/utils";

type Props = {
  src: string;
  alt: string;
  className?: string;
  loading?: "eager" | "lazy";
};

export default function PhoneFrame({ src, alt, className, loading = "lazy" }: Props) {
  return (
    <div className={cn("relative mx-auto", className)}>
      <div className="relative rounded-[2.5rem] bg-foreground p-2 shadow-float ring-1 ring-foreground/10">
        <div className="relative overflow-hidden rounded-[2rem] bg-background">
          <img
            src={src}
            alt={alt}
            loading={loading}
            className="block h-auto w-full select-none"
            draggable={false}
          />
        </div>
        <div className="pointer-events-none absolute left-1/2 top-2 h-6 w-24 -translate-x-1/2 rounded-b-2xl bg-foreground" />
      </div>
    </div>
  );
}
