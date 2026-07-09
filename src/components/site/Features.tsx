import { Users, UserPlus, ListChecks, Wallet, Camera, Compass } from "lucide-react";
import Reveal from "./Reveal";

const FEATURES = [
  { icon: Users, title: "Plan trips with friends", desc: "One shared trip hub for dates, destination, and the crew." },
  { icon: UserPlus, title: "Add people to your trip", desc: "Invite friends manually or with a reusable invite link." },
  { icon: ListChecks, title: "Organize plans in one place", desc: "Day-by-day itineraries, stops, notes, and locations." },
  { icon: Wallet, title: "Track shared expenses", desc: "Split costs, see who paid, and settle balances with clarity." },
  { icon: Camera, title: "Keep memories together", desc: "Wrap up each journey with photos and a clean summary." },
  { icon: Compass, title: "Group travel, coordinated", desc: "Live crew status and next stop, so everyone stays aligned." },
];

export default function Features() {
  return (
    <section id="features" className="relative py-20 md:py-28 cv-auto">
      <div className="mx-auto max-w-6xl px-5 lg:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Features</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Everything a group trip needs, nothing it doesn't.
          </h2>
          <p className="mt-4 text-muted-foreground">
            Built for the real shape of group travel from the first idea to the final memory.
          </p>
        </Reveal>

        <div className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={i * 60}>
              <div className="group h-full rounded-2xl border border-border/60 bg-card p-6 shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-elevated">
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl gradient-primary shadow-card transition-transform group-hover:scale-105">
                  <f.icon className="h-5 w-5 text-accent-foreground" strokeWidth={2} />
                </div>
                <h3 className="mt-5 text-base font-semibold text-foreground">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
