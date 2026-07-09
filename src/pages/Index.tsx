import Navbar from "@/components/site/Navbar";
import Hero from "@/components/site/Hero";
import AnnouncementStrip from "@/components/site/AnnouncementStrip";
import Features from "@/components/site/Features";
import HowItWorks from "@/components/site/HowItWorks";
import Screenshots from "@/components/site/Screenshots";
import MemoriesSection from "@/components/site/MemoriesSection";
import DownloadCTA from "@/components/site/DownloadCTA";
import Footer from "@/components/site/Footer";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <Hero />
        <AnnouncementStrip />
        <Features />
        <HowItWorks />
        <Screenshots />
        <MemoriesSection />
        <DownloadCTA />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
