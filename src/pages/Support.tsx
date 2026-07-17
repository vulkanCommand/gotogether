import { Link } from "react-router-dom";
import LegalLayout from "@/components/site/LegalLayout";
import { LifeBuoy, ShieldCheck, FileText, UserX } from "lucide-react";

const SUPPORT_EMAIL = "gdkalyan2109@gmail.com";

const HELP_ITEMS = [
  "Phone number sign-in and OTP issues",
  "Creating or managing trips",
  "Adding friends to a trip",
  "Itinerary events and locations",
  "Live trip updates",
  "Shared expenses and splits",
  "Profile photo or account settings",
  "Account deletion requests",
  "Reporting bugs or app issues",
];

const LINKS = [
  { to: "/privacy", icon: ShieldCheck, title: "Privacy Policy", desc: "How we handle your data." },
  { to: "/terms", icon: FileText, title: "Terms of Service", desc: "The rules for using GoTogether." },
  { to: "/delete-account", icon: UserX, title: "Delete your account", desc: "In-app steps and email fallback." },
];

export default function Support() {
  return (
    <LegalLayout
      title="GoTogether Support"
      description="Get help with trips, friends, live updates, expenses, and your GoTogether account."
      path="/support"
    >
      <p>
        Need help with your trips, friends, live updates, expenses, or account? We're here to help.
      </p>

      <h2>Contact us</h2>
      <p>
        For app support, bug reports, account help, feedback, or feature requests, email{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. We usually respond within 24 to 48 hours.
      </p>

      <h2>We can help with</h2>
      <ul>
        {HELP_ITEMS.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>

      <h2>Account deletion</h2>
      <p>
        You can delete your GoTogether account directly inside the app from the Settings screen.
        Deleting your account removes or anonymizes your profile information according to our{" "}
        <Link to="/privacy">Privacy Policy</Link>. Some shared trip data may remain visible to other
        trip members where needed for group trip history and expense records. If you need help,
        contact <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
      </p>

      <h2>Helpful pages</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 not-prose">
        {LINKS.map(({ to, icon: Icon, title, desc }) => (
          <Link
            key={to}
            to={to}
            className="group flex items-start gap-3 rounded-2xl border border-border bg-card p-5 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-elevated"
          >
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
              <Icon className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-sm font-semibold text-foreground group-hover:text-accent">
                {title}
              </span>
              <span className="mt-1 block text-sm text-muted-foreground">{desc}</span>
            </span>
          </Link>
        ))}
        <a
          href={`mailto:${SUPPORT_EMAIL}`}
          className="group flex items-start gap-3 rounded-2xl border border-border bg-card p-5 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-elevated"
        >
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
            <LifeBuoy className="h-5 w-5" />
          </span>
          <span>
            <span className="block text-sm font-semibold text-foreground group-hover:text-accent">
              Email support
            </span>
            <span className="mt-1 block text-sm text-muted-foreground">{SUPPORT_EMAIL}</span>
          </span>
        </a>
      </div>
    </LegalLayout>
  );
}