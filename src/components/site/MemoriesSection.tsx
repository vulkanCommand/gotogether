import screenshot10 from "@/assets/screenshots/screenshot-10.png.asset.json";
import PhoneFrame from "./PhoneFrame";
import Reveal from "./Reveal";

export default function MemoriesSection() {
  return (
    <section className="relative overflow-hidden py-20 md:py-28">
      <div className="absolute inset-0 gradient-warm" aria-hidden />
      <div className="aurora-blob left-[-10%] top-[10%] h-[420px] w-[420px] bg-violet/30" />
      <div className="aurora-blob right-[-10%] bottom-[-10%] h-[420px] w-[420px] bg-accent/25" />

      <div className="relative mx-auto grid max-w-6xl grid-cols-1 items-center gap-14 px-5 lg:grid-cols-2 lg:px-8">
        <Reveal>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Made for memories</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Not just planning.
            <br />
            <span className="text-gradient">A better whole trip.</span>
          </h2>
          <p className="mt-5 max-w-lg text-base leading-relaxed text-muted-foreground">
            GoTogether keeps every part of the journey organized, so the experience feels easier
            before you leave, calmer while you're together, and warmer to look back on.
          </p>

          <ul className="mt-8 space-y-3 text-sm text-foreground">
            {[
              "Before align on dates, destination, and who's in.",
              "During one shared itinerary, live crew status, split costs.",
              "After a clean summary and shared memories to keep.",
            ].map((item) => (
              <li key={item} className="flex items-start gap-3">
                <span className="mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full gradient-primary" />
                <span className="leading-relaxed">{item}</span>
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal delay={120} className="flex justify-center lg:justify-end">
          <PhoneFrame
            src={screenshot10.url}
            alt="GoTogether trip completion screen"
            className="w-[280px] rotate-[3deg] sm:w-[320px]"
          />
        </Reveal>
      </div>
    </section>
  );
}
