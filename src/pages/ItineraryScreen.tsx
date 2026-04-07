import { useState } from "react";
import { ArrowLeft, Plus, Check, MapPin, Clock, GripVertical } from "lucide-react";
import { useNavigate } from "react-router-dom";

const initialEvents = [
  { id: 1, time: "08:00", title: "Breakfast at Villa", location: "Private Villa", done: true },
  { id: 2, time: "10:00", title: "Beach Trail Hike", location: "Nusa Penida", done: true },
  { id: 3, time: "13:00", title: "Lunch at Warung", location: "Ubud Market", done: false },
  { id: 4, time: "15:30", title: "Temple Visit", location: "Tanah Lot", done: false },
  { id: 5, time: "19:00", title: "Sunset Dinner", location: "Jimbaran Bay", done: false },
];

const ItineraryScreen = () => {
  const navigate = useNavigate();
  const [events] = useState(initialEvents);
  const [showModal, setShowModal] = useState(false);

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="px-5 pt-14 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-card shadow-card flex items-center justify-center">
            <ArrowLeft className="w-4 h-4 text-foreground" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-foreground">Day 3 Itinerary</h1>
            <p className="text-xs text-muted-foreground">April 14, 2025</p>
          </div>
        </div>
        <button onClick={() => setShowModal(true)} className="w-9 h-9 rounded-full gradient-primary flex items-center justify-center shadow-sm">
          <Plus className="w-4 h-4 text-accent-foreground" />
        </button>
      </div>

      {/* Timeline */}
      <div className="px-5 mt-2">
        {events.map((ev, i) => (
          <div key={ev.id} className="flex gap-3">
            {/* Timeline line */}
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                ev.done ? "gradient-primary" : "bg-card shadow-card border border-border"
              }`}>
                {ev.done ? (
                  <Check className="w-3.5 h-3.5 text-accent-foreground" />
                ) : (
                  <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                )}
              </div>
              {i < events.length - 1 && (
                <div className={`w-0.5 flex-1 min-h-[40px] ${ev.done ? "bg-accent/30" : "bg-border"}`} />
              )}
            </div>

            {/* Card */}
            <div className={`flex-1 mb-3 p-3.5 rounded-xl transition-all ${
              ev.done ? "bg-muted/50 opacity-60" : "bg-card shadow-card"
            }`}>
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-semibold text-accent">{ev.time}</span>
                  <h3 className={`text-sm font-semibold mt-0.5 ${ev.done ? "text-muted-foreground line-through" : "text-foreground"}`}>
                    {ev.title}
                  </h3>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                    <MapPin className="w-3 h-3" /> {ev.location}
                  </p>
                </div>
                {!ev.done && <GripVertical className="w-4 h-4 text-muted-foreground/40" />}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add Event Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/30 backdrop-blur-sm" onClick={() => setShowModal(false)}>
          <div className="w-full max-w-lg bg-card rounded-t-3xl p-6 animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-1 rounded-full bg-border mx-auto mb-5" />
            <h2 className="text-lg font-bold text-foreground mb-4">Add Event</h2>
            <div className="space-y-3">
              <input placeholder="Event title" className="w-full py-3.5 px-4 rounded-xl bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/30" />
              <div className="grid grid-cols-2 gap-3">
                <input placeholder="Time" type="time" className="py-3.5 px-4 rounded-xl bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30" />
                <input placeholder="Location" className="py-3.5 px-4 rounded-xl bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/30" />
              </div>
              <textarea placeholder="Description (optional)" rows={2} className="w-full py-3.5 px-4 rounded-xl bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/30 resize-none" />
              <button
                onClick={() => setShowModal(false)}
                className="w-full py-4 rounded-2xl gradient-primary text-accent-foreground font-semibold text-sm shadow-elevated active:scale-[0.98] transition-transform"
              >
                Add Event
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ItineraryScreen;
