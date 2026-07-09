import Logo from "./Logo";

const APP_STORE_URL = "https://apps.apple.com/us/app/gotogether-trip-planner/id6767730138";

export default function Footer() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-5 py-12 sm:grid-cols-2 lg:grid-cols-3 lg:px-8">
        <div>
          <Logo />
          <p className="mt-4 max-w-xs text-sm text-muted-foreground">
            Group trip planning made simple.
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Download</p>
          <ul className="mt-4 space-y-2 text-sm">
            <li>
              <a href={APP_STORE_URL} target="_blank" rel="noopener noreferrer" className="text-foreground hover:text-accent">
                App Store
              </a>
            </li>
            <li>
              <span className="text-muted-foreground">Google Play — coming soon</span>
            </li>
          </ul>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Explore</p>
          <ul className="mt-4 space-y-2 text-sm">
            <li><a href="#features" className="text-foreground hover:text-accent">Features</a></li>
            <li><a href="#how" className="text-foreground hover:text-accent">How it works</a></li>
            <li><a href="#screenshots" className="text-foreground hover:text-accent">Screenshots</a></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border">
        <div className="mx-auto max-w-6xl px-5 py-6 text-xs text-muted-foreground lg:px-8">
          © {new Date().getFullYear()} GoTogether. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
