import { useNavigate } from "react-router-dom";
import onboardingImg from "@/assets/onboarding-illustration.png";

const OnboardingScreen = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-between gradient-primary relative overflow-hidden">
      {/* Decorative circles */}
      <div className="absolute top-[-120px] right-[-80px] w-[300px] h-[300px] rounded-full bg-violet/20 blur-3xl" />
      <div className="absolute bottom-[-100px] left-[-60px] w-[250px] h-[250px] rounded-full bg-accent/20 blur-3xl" />

      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center z-10">
        <img
          src={onboardingImg}
          alt="Friends traveling together"
          className="w-64 h-auto mb-10 animate-fade-in"
          width={800}
          height={600}
        />
        <h1 className="text-4xl font-bold text-primary-foreground leading-tight tracking-tight mb-4">
          Plan trips together.
          <br />
          <span className="opacity-80">Without the chaos.</span>
        </h1>
        <p className="text-primary-foreground/60 text-base max-w-xs">
          Coordinate dates, vote on destinations, and stay in sync — all in one place.
        </p>
      </div>

      <div className="w-full px-8 pb-12 z-10">
        <button
          onClick={() => navigate("/login")}
          className="w-full py-4 rounded-2xl bg-card text-foreground font-semibold text-lg shadow-float active:scale-[0.98] transition-transform duration-150"
        >
          Get Started
        </button>
      </div>
    </div>
  );
};

export default OnboardingScreen;
