import AppStoreButton from "./AppStoreButton";
import PlayComingSoonBadge from "./PlayComingSoonBadge";
import Reveal from "./Reveal";

export default function DownloadCTA() {
  return (
    <section id="download" className="relative px-5 py-20 md:py-28 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl gradient-hero px-6 py-14 text-center shadow-float sm:px-12 sm:py-20">
            <div className="aurora-blob left-[-10%] top-[-20%] h-[400px] w-[400px] bg-white/20" />
            <div className="aurora-blob right-[-10%] bottom-[-20%] h-[400px] w-[400px] bg-white/10" />
            <div className="relative">
              <h2 className="mx-auto max-w-2xl text-3xl font-bold tracking-tight text-primary-foreground sm:text-4xl lg:text-5xl">
                Ready to plan your next trip together?
              </h2>
              <p className="mx-auto mt-4 max-w-lg text-primary-foreground/70">
                Download GoTogether on iOS and bring the whole crew into one place.
              </p>
              <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <AppStoreButton variant="light" />
                <PlayComingSoonBadge className="border-white/20 bg-white/10 backdrop-blur" />
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
