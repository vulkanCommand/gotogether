import Reveal from "./Reveal";

const STEPS = [
  { n: "01", title: "Create a trip", desc: "Set your dates, destination, and start a shared trip hub." },
  { n: "02", title: "Invite your friends", desc: "Add people manually or share a reusable invite link." },
  { n: "03", title: "Plan, split, and enjoy", desc: "Build the itinerary, track expenses, and stay in sync." },
];

export default function HowItWorks() {
  return (
    <section id="how" className="relative bg-muted/40 py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-5 lg:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">How it works</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Three simple steps.
          </h2>
          <p className="mt-4 text-muted-foreground">
            From "we should take a trip" to a plan the whole crew can follow.
          </p>
        </Reveal>

        <div className="relative mt-14 grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="pointer-events-none absolute left-0 right-0 top-8 hidden h-px bg-gradient-to-r from-transparent via-border to-transparent md:block" />
          {STEPS.map((s, i) => (
            <Reveal key={s.n} delay={i * 100}>
              <div className="relative flex h-full flex-col items-start rounded-2xl border border-border/60 bg-card p-7 shadow-card">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl gradient-primary text-lg font-bold text-accent-foreground shadow-elevated">
                  {s.n}
                </div>
                <h3 className="mt-5 text-lg font-semibold text-foreground">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
