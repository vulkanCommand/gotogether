import screenshot3 from "@/assets/screenshots/screenshot-3.png.asset.json";
import screenshot2 from "@/assets/screenshots/screenshot-2.png.asset.json";
import screenshot4 from "@/assets/screenshots/screenshot-4.png.asset.json";
import screenshot5 from "@/assets/screenshots/screenshot-5.png.asset.json";
import screenshot6 from "@/assets/screenshots/screenshot-6.png.asset.json";
import screenshot7 from "@/assets/screenshots/screenshot-7.png.asset.json";
import PhoneFrame from "./PhoneFrame";
import Reveal from "./Reveal";

const SHOTS = [
  { src: screenshot3.url, label: "Home", desc: "Trip, expenses, and updates at a glance." },
  { src: screenshot2.url, label: "Trips", desc: "Current, upcoming, and completed journeys." },
  { src: screenshot4.url, label: "Trip Overview", desc: "Dates, destination, crew, and progress." },
  { src: screenshot5.url, label: "Itinerary", desc: "Day-by-day plans and stops." },
  { src: screenshot6.url, label: "Live", desc: "See where the crew is, in real time." },
  { src: screenshot7.url, label: "Expenses", desc: "Split shared costs with confidence." },
];

export default function Screenshots() {
  return (
    <section id="screenshots" className="relative overflow-hidden py-20 md:py-28 cv-auto">
      <div className="mx-auto max-w-6xl px-5 lg:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Inside the app</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Beautifully simple. Genuinely useful.
          </h2>
          <p className="mt-4 text-muted-foreground">
            A quick look at the surfaces you and your crew will actually use.
          </p>
        </Reveal>

        <div className="mt-16 grid grid-cols-1 gap-x-8 gap-y-16 sm:grid-cols-2 lg:grid-cols-3">
          {SHOTS.map((s, i) => (
            <Reveal key={s.label} delay={i * 60} className="flex flex-col items-center">
              <PhoneFrame src={s.src} alt={`GoTogether ${s.label} screen`} className="w-[220px]" />
              <p className="mt-6 text-sm font-semibold text-foreground">{s.label}</p>
              <p className="mt-1 text-center text-xs text-muted-foreground">{s.desc}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
