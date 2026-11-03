import React from 'react';
import LandingNavbar from './LandingNavbar';
import HeroSection from './HeroSection';
import HowItWorksSection from './HowItWorksSection';
import FeaturesSection from './FeaturesSection';
import ExampleQuestionsSection from './ExampleQuestionsSection';
import SafetySection from './SafetySection';
import FinalCtaSection from './FinalCtaSection';
import LandingFooter from './LandingFooter';

export default function LandingPage({ onEnterWorkspace, onSelectQuestion }) {
  return (
    <div className="min-h-screen bg-[#070a14] text-slate-100 flex flex-col font-geist selection:bg-violet-500/30 selection:text-violet-200 overflow-x-hidden">
      {/* Sticky Top Navbar */}
      <LandingNavbar onEnterWorkspace={onEnterWorkspace} />

      {/* Main Page Landmark */}
      <main className="flex-1 w-full pt-16 flex flex-col">
        {/* 1. Hero Section with Product Preview */}
        <HeroSection onEnterWorkspace={onEnterWorkspace} />

        {/* 2. How It Works (4-step Pipeline) */}
        <HowItWorksSection />

        {/* 3. Features Section (Bento Grid) */}
        <FeaturesSection />

        {/* 4. Example Questions (Interactive Pre-fills) */}
        <ExampleQuestionsSection onSelectQuestion={onSelectQuestion} />

        {/* 5. Safety Architecture (SQLGlot AST Guardrails) */}
        <SafetySection />

        {/* 6. Final Call To Action */}
        <FinalCtaSection onEnterWorkspace={onEnterWorkspace} />
      </main>

      {/* Accessible Footer */}
      <LandingFooter />
    </div>
  );
}

