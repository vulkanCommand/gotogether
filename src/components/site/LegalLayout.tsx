import { useEffect, type ReactNode } from "react";
import { Link } from "react-router-dom";
import Navbar from "./Navbar";
import Footer from "./Footer";

type Props = {
  title: string;
  description: string;
  path: string;
  lastUpdated?: string;
  children: ReactNode;
};

export default function LegalLayout({ title, description, path, lastUpdated, children }: Props) {
  useEffect(() => {
    document.title = `${title} · GoTogether`;

    const setMeta = (name: string, content: string) => {
      let el = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute("name", name);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    };
    setMeta("description", description);

    let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.setAttribute("rel", "canonical");
      document.head.appendChild(canonical);
    }
    canonical.setAttribute("href", `${window.location.origin}${path}`);
  }, [title, description, path]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-28 pb-20">
        <article className="mx-auto max-w-3xl px-5 lg:px-8">
          <header className="mb-10 border-b border-border pb-8">
            <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
              {title}
            </h1>
            {lastUpdated && (
              <p className="mt-3 text-sm text-muted-foreground">Last updated: {lastUpdated}</p>
            )}
          </header>
          <div className="space-y-10 text-[15px] leading-7 text-muted-foreground [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-foreground [&_h2]:tracking-tight [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ul>li]:mt-1.5 [&_a]:text-accent [&_a]:underline-offset-4 hover:[&_a]:underline">
            {children}
          </div>
          <div className="mt-16 border-t border-border pt-8">
            <Link to="/" className="text-sm font-medium text-accent hover:underline">
              ← Back to home
            </Link>
          </div>
        </article>
      </main>
      <Footer />
    </div>
  );
}