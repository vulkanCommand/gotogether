import { useState } from "react";
import { ArrowLeft, Check, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import santorini from "@/assets/destination-santorini.jpg";
import bali from "@/assets/destination-bali.jpg";
import alps from "@/assets/destination-alps.jpg";

const steps = ["Dates", "Destination", "Trip Lead"];

const destinations = [
  { name: "Santorini, Greece", img: santorini, votes: 4 },
  { name: "Bali, Indonesia", img: bali, votes: 3 },
  { name: "Swiss Alps", img: alps, votes: 2 },
];

const members = [
  { id: 1, name: "Kalyan", avatar: "https://i.pravatar.cc/80?img=1" },
  { id: 2, name: "Priya", avatar: "https://i.pravatar.cc/80?img=5" },
  { id: 3, name: "Arjun", avatar: "https://i.pravatar.cc/80?img=6" },
  { id: 4, name: "Sarah", avatar: "https://i.pravatar.cc/80?img=7" },
];

const TripCreateScreen = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [selectedDates, setSelectedDates] = useState<number[]>([]);
  const [votedDest, setVotedDest] = useState<number | null>(null);
  const [votedLead, setVotedLead] = useState<number | null>(null);

  const days = Array.from({ length: 30 }, (_, i) => i + 1);
  const today = new Date();

  const toggleDate = (d: number) =>
    setSelectedDates((p) => (p.includes(d) ? p.filter((x) => x !== d) : [...p, d]));

  const nextStep = () => {
    if (step < 2) setStep(step + 1);
    else navigate("/trip-overview");
  };

  return (
    <div className="min-h-screen bg-background pb-32">
      {/* Header */}
      <div className="px-5 pt-14 pb-4 flex items-center gap-3">
        <button onClick={() => (step > 0 ? setStep(step - 1) : navigate(-1))} className="w-9 h-9 rounded-full bg-card shadow-card flex items-center justify-center">
          <ArrowLeft className="w-4 h-4 text-foreground" />
        </button>
        <h1 className="text-lg font-bold text-foreground">Create Trip</h1>
      </div>

      {/* Stepper */}
      <div className="px-5 mb-6">
        <div className="flex items-center gap-2">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className={`flex items-center gap-2 ${i <= step ? "text-accent" : "text-muted-foreground"}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  i < step ? "gradient-primary text-accent-foreground" : i === step ? "bg-accent/15 text-accent border-2 border-accent" : "bg-muted text-muted-foreground"
                }`}>
                  {i < step ? <Check className="w-3.5 h-3.5" /> : i + 1}
                </div>
                <span className="text-xs font-medium hidden sm:block">{s}</span>
              </div>
              {i < steps.length - 1 && (
                <div className={`flex-1 h-0.5 rounded-full ${i < step ? "bg-accent" : "bg-border"}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <div className="px-5 animate-fade-in" key={step}>
        {step === 0 && (
          <div>
            <h2 className="text-base font-semibold text-foreground mb-1">Select your available dates</h2>
            <p className="text-xs text-muted-foreground mb-4">April {today.getFullYear()}</p>

            <div className="grid grid-cols-7 gap-1 mb-4">
              {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                <div key={i} className="text-center text-[10px] font-semibold text-muted-foreground py-1">{d}</div>
              ))}
              {/* Offset for April starting day */}
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={`empty-${i}`} />
              ))}
              {days.map((d) => {
                const isSelected = selectedDates.includes(d);
                return (
                  <button
                    key={d}
                    onClick={() => toggleDate(d)}
                    className={`aspect-square rounded-lg flex items-center justify-center text-xs font-medium transition-all ${
                      isSelected
                        ? "gradient-primary text-accent-foreground shadow-sm"
                        : "text-foreground hover:bg-muted"
                    }`}
                  >
                    {d}
                  </button>
                );
              })}
            </div>

            {selectedDates.length > 2 && (
              <div className="bg-accent/10 border border-accent/20 rounded-xl p-3 animate-scale-in">
                <p className="text-xs font-semibold text-accent">Best match: Apr {Math.min(...selectedDates)} – {Math.max(...selectedDates)}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">4 of 6 members available</p>
              </div>
            )}
          </div>
        )}

        {step === 1 && (
          <div>
            <h2 className="text-base font-semibold text-foreground mb-4">Vote for a destination</h2>
            <div className="space-y-3">
              {destinations.map((dest, i) => {
                const isVoted = votedDest === i;
                return (
                  <button
                    key={i}
                    onClick={() => setVotedDest(i)}
                    className={`w-full rounded-2xl overflow-hidden shadow-card transition-all active:scale-[0.98] ${
                      isVoted ? "ring-2 ring-accent ring-offset-2" : ""
                    }`}
                  >
                    <div className="relative">
                      <img src={dest.img} className="w-full h-32 object-cover" alt={dest.name} loading="lazy" width={640} height={512} />
                      <div className="absolute inset-0 bg-gradient-to-t from-foreground/60 to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-4 flex items-end justify-between">
                        <div>
                          <h3 className="text-sm font-bold text-card">{dest.name}</h3>
                          <p className="text-[10px] text-card/70">{dest.votes + (isVoted ? 1 : 0)} votes</p>
                        </div>
                        {isVoted && (
                          <div className="w-7 h-7 rounded-full gradient-primary flex items-center justify-center animate-scale-in">
                            <Check className="w-4 h-4 text-accent-foreground" />
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 className="text-base font-semibold text-foreground mb-4">Vote for Trip Lead</h2>
            <div className="grid grid-cols-2 gap-3">
              {members.map((m) => {
                const isVoted = votedLead === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => setVotedLead(m.id)}
                    className={`flex flex-col items-center gap-3 p-5 rounded-2xl bg-card shadow-card transition-all active:scale-[0.97] ${
                      isVoted ? "ring-2 ring-accent shadow-elevated" : ""
                    }`}
                  >
                    <div className="relative">
                      <img src={m.avatar} className="w-16 h-16 rounded-full" alt={m.name} width={80} height={80} />
                      {isVoted && (
                        <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full gradient-primary flex items-center justify-center shadow-sm animate-scale-in">
                          <Check className="w-3.5 h-3.5 text-accent-foreground" />
                        </div>
                      )}
                    </div>
                    <span className="text-sm font-medium text-foreground">{m.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* CTA */}
      <div className="fixed bottom-24 left-0 right-0 px-5 max-w-lg mx-auto">
        <button
          onClick={nextStep}
          className="w-full py-4 rounded-2xl gradient-primary text-accent-foreground font-semibold text-sm shadow-float active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
        >
          {step < 2 ? "Continue" : "Create Trip"}
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default TripCreateScreen;
