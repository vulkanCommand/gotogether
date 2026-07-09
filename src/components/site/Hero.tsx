import screenshot1 from "@/assets/screenshots/screenshot-1.png.asset.json";
import screenshot3 from "@/assets/screenshots/screenshot-3.png.asset.json";
import PhoneFrame from "./PhoneFrame";
import AppStoreButton from "./AppStoreButton";
import PlayComingSoonBadge from "./PlayComingSoonBadge";

export default function Hero() {
  return (
    <section id="top" className="relative overflow-hidden pt-32 pb-16 md:pt-40 md:pb-24">
      <div className="aurora-blob left-[-10%] top-[10%] h-[500px] w-[500px] bg-accent/40" />
      <div className="aurora-blob right-[-15%] top-[30%] h-[600px] w-[600px] bg-violet/40" />
      <div className="aurora-blob left-[20%] bottom-[-10%] h-[400px] w-[400px] bg-accent/20" />

      <div className="relative mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-5 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:px-8">
        <div className="text-center lg:text-left animate-fade-in">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-card backdrop-blur">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
            </span>
            Now live on the iOS App Store
          </span>

          <h1 className="mt-6 text-4xl font-bold leading-[1.05] tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            Plan trips together.
            <br />
            <span className="text-gradient">Remember them forever.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-muted-foreground lg:mx-0 lg:text-lg">
            GoTogether helps friends organize trips, create plans, add people, and track shared
            expenses — all in one calm, beautiful place.
          </p>

          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
            <AppStoreButton />
            <PlayComingSoonBadge />
          </div>
        </div>

        <div className="relative flex items-center justify-center lg:justify-end">
          <div className="absolute -left-6 top-16 hidden animate-fade-in lg:block">
            <PhoneFrame
              src={screenshot3.url}
              alt="GoTogether home screen"
              loading="eager"
              className="w-[220px] rotate-[-8deg] opacity-90"
            />
          </div>
          <PhoneFrame
            src={screenshot1.url}
            alt="GoTogether onboarding screen"
            loading="eager"
            className="w-[260px] rotate-[4deg] sm:w-[300px] lg:w-[340px]"
          />
        </div>
      </div>
    </section>
  );
}
