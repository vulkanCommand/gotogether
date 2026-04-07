import { useNavigate } from "react-router-dom";
import tripHero from "@/assets/trip-hero.jpg";
import santorini from "@/assets/destination-santorini.jpg";
import alps from "@/assets/destination-alps.jpg";

const trips = [
  { title: "Bali Beach Trip", dates: "Apr 12 – 19", img: tripHero, status: "Active", members: 6 },
  { title: "Swiss Alps Hike", dates: "May 3 – 10", img: alps, status: "Planning", members: 4 },
  { title: "Santorini Summer", dates: "Aug 1 – 8", img: santorini, status: "Upcoming", members: 5 },
];

const TripsScreen = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="px-5 pt-14 pb-4">
        <h1 className="text-2xl font-bold text-foreground tracking-tight">My Trips</h1>
        <p className="text-sm text-muted-foreground mt-0.5">3 trips planned</p>
      </div>

      <div className="px-5 space-y-4">
        {trips.map((trip) => (
          <button
            key={trip.title}
            onClick={() => navigate("/trip-overview")}
            className="w-full rounded-2xl overflow-hidden bg-card shadow-card active:scale-[0.98] transition-transform text-left"
          >
            <div className="relative">
              <img src={trip.img} className="w-full h-36 object-cover" alt={trip.title} loading="lazy" width={800} height={512} />
              <div className="absolute top-3 left-3">
                <span className={`px-2.5 py-1 text-[10px] font-semibold rounded-full ${
                  trip.status === "Active" ? "bg-success text-success-foreground" : "bg-card/90 text-foreground backdrop-blur-sm"
                }`}>
                  {trip.status}
                </span>
              </div>
            </div>
            <div className="p-4">
              <h3 className="text-sm font-semibold text-foreground">{trip.title}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{trip.dates} · {trip.members} members</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default TripsScreen;
