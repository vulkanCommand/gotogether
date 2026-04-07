import { useState } from "react";
import { Plus, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const tabs = ["All", "You owe", "You are owed"];

const expenses = [
  { title: "Beach Villa (2 nights)", paidBy: "Kalyan", amount: 240, split: 6, type: "owe" },
  { title: "Dinner at Jimbaran", paidBy: "Priya", amount: 85, split: 5, type: "owe" },
  { title: "Scooter Rental", paidBy: "You", amount: 45, split: 3, type: "owed" },
  { title: "Surfboard Lessons", paidBy: "Arjun", amount: 120, split: 4, type: "owe" },
  { title: "Groceries", paidBy: "You", amount: 32, split: 6, type: "owed" },
];

const ExpensesScreen = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(0);

  const filtered = activeTab === 0 ? expenses : activeTab === 1 ? expenses.filter((e) => e.type === "owe") : expenses.filter((e) => e.type === "owed");

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="px-5 pt-14 pb-4">
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Expenses</h1>
        <p className="text-sm text-muted-foreground">Bali Beach Trip</p>
      </div>

      {/* Summary card */}
      <div className="px-5 mb-5">
        <div className="gradient-primary rounded-2xl p-5 shadow-elevated">
          <p className="text-xs text-accent-foreground/70 font-medium">Your balance</p>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-3xl font-bold text-accent-foreground tracking-tight">$42</span>
            <span className="text-sm text-accent-foreground/60">you owe</span>
          </div>
          <div className="flex gap-3 mt-4">
            <div className="flex-1 bg-accent-foreground/10 rounded-xl p-3">
              <div className="flex items-center gap-1 mb-1">
                <ArrowUpRight className="w-3.5 h-3.5 text-accent-foreground/70" />
                <span className="text-[10px] text-accent-foreground/70">You owe</span>
              </div>
              <span className="text-sm font-bold text-accent-foreground">$119</span>
            </div>
            <div className="flex-1 bg-accent-foreground/10 rounded-xl p-3">
              <div className="flex items-center gap-1 mb-1">
                <ArrowDownLeft className="w-3.5 h-3.5 text-accent-foreground/70" />
                <span className="text-[10px] text-accent-foreground/70">You are owed</span>
              </div>
              <span className="text-sm font-bold text-accent-foreground">$77</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-5 mb-4">
        <div className="flex gap-1 bg-muted rounded-xl p-1">
          {tabs.map((t, i) => (
            <button
              key={t}
              onClick={() => setActiveTab(i)}
              className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
                activeTab === i ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Expense list */}
      <div className="px-5 space-y-2">
        {filtered.map((e, i) => (
          <div key={i} className="flex items-center gap-3 p-3 bg-card rounded-xl shadow-card">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
              e.type === "owe" ? "bg-destructive/10" : "bg-success/10"
            }`}>
              {e.type === "owe" ? (
                <ArrowUpRight className="w-4 h-4 text-destructive" />
              ) : (
                <ArrowDownLeft className="w-4 h-4 text-success" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-medium text-foreground truncate">{e.title}</h3>
              <p className="text-[10px] text-muted-foreground">Paid by {e.paidBy} · Split {e.split} ways</p>
            </div>
            <span className={`text-sm font-bold ${e.type === "owe" ? "text-destructive" : "text-success"}`}>
              {e.type === "owe" ? "-" : "+"}${(e.amount / e.split).toFixed(0)}
            </span>
          </div>
        ))}
      </div>

      {/* FAB */}
      <button
        onClick={() => navigate("/add-expense")}
        className="fixed bottom-24 right-6 w-14 h-14 gradient-primary rounded-full shadow-float flex items-center justify-center active:scale-90 transition-transform z-40"
      >
        <Plus className="w-6 h-6 text-accent-foreground" />
      </button>
    </div>
  );
};

export default ExpensesScreen;
