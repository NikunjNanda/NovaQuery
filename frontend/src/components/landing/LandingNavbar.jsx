import React, { useState, useEffect } from 'react';
import { Sparkles, ArrowRight, Menu, X, ShieldCheck } from 'lucide-react';

export default function LandingNavbar({ onEnterWorkspace }) {
  const [activeSection, setActiveSection] = useState('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);

      const sections = ['overview', 'how-it-works', 'features', 'safety'];
      const scrollPosition = window.scrollY + 100;

      for (const section of sections) {
        if (section === 'overview') {
          if (window.scrollY < 300) {
            setActiveSection('overview');
            break;
          }
        } else {
          const el = document.getElementById(section);
          if (el) {
            const top = el.offsetTop;
            const height = el.offsetHeight;
            if (scrollPosition >= top && scrollPosition < top + height) {
              setActiveSection(section);
              break;
            }
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Handle escape key to close mobile menu
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen]);

  const scrollToSection = (e, sectionId) => {
    e.preventDefault();
    setMobileMenuOpen(false);

    if (sectionId === 'overview') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setActiveSection('overview');
    } else {
      const el = document.getElementById(sectionId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
        setActiveSection(sectionId);
      }
    }
  };

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-200 ${
        scrolled
          ? 'bg-[#0b0e18]/90 backdrop-blur-md border-b border-white/[0.08] shadow-[0_4px_24px_rgba(0,0,0,0.5)]'
          : 'bg-[#0b0e18]/70 backdrop-blur-sm border-b border-white/[0.04]'
      }`}
    >
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Brand Logo & Wordmark */}
        <a
          href="#overview"
          onClick={(e) => scrollToSection(e, 'overview')}
          className="flex items-center gap-2.5 group focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 rounded-lg p-1"
          aria-label="NovaQuery Home"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#1c1f2a] to-[#262a35] border border-white/10 flex items-center justify-center font-mono text-sm group-hover:border-violet-500/50 transition-all shadow-inner">
            <span className="text-[#5de6ff] text-xs font-semibold mr-0.5">&gt;</span>
            <span className="text-[#c0c1ff] font-bold">N</span>
          </div>
          <span className="font-geist text-lg font-semibold tracking-tight text-white flex items-center">
            Nova<span className="text-[#c0c1ff]">Query</span>
          </span>
        </a>

        {/* Desktop Navigation Links */}
        <nav
          className="hidden md:flex items-center gap-8"
          aria-label="Primary Navigation"
        >
          <button
            onClick={(e) => scrollToSection(e, 'overview')}
            className={`font-geist text-sm transition-colors py-1 relative ${
              activeSection === 'overview'
                ? 'text-white font-medium'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Overview
            {activeSection === 'overview' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-400 rounded-full" />
            )}
          </button>
          <button
            onClick={(e) => scrollToSection(e, 'how-it-works')}
            className={`font-geist text-sm transition-colors py-1 relative ${
              activeSection === 'how-it-works'
                ? 'text-white font-medium'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            How It Works
            {activeSection === 'how-it-works' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-400 rounded-full" />
            )}
          </button>
          <button
            onClick={(e) => scrollToSection(e, 'features')}
            className={`font-geist text-sm transition-colors py-1 relative ${
              activeSection === 'features'
                ? 'text-white font-medium'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Features
            {activeSection === 'features' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-400 rounded-full" />
            )}
          </button>
          <button
            onClick={(e) => scrollToSection(e, 'safety')}
            className={`font-geist text-sm transition-colors py-1 relative ${
              activeSection === 'safety'
                ? 'text-white font-medium'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Safety
            {activeSection === 'safety' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-400 rounded-full" />
            )}
          </button>
        </nav>

        {/* Right CTA Area */}
        <div className="flex items-center gap-3">
          {/* Subtle status chip (desktop) */}
          <div className="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-[11px] font-mono text-slate-300">
            <span className="w-1.5 h-1.5 rounded-full bg-[#5de6ff] animate-pulse" />
            <span>Read-Safe SQLite</span>
          </div>

          {/* Primary Action Button */}
          <button
            onClick={onEnterWorkspace}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-geist text-sm font-medium shadow-[0_0_20px_rgba(139,92,246,0.35)] hover:shadow-[0_0_28px_rgba(139,92,246,0.55)] active:scale-[0.98] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
          >
            <span>Enter NovaQuery</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          {/* Mobile Menu Toggle Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-white/[0.08] bg-[#0e121f] px-4 pt-3 pb-5 flex flex-col gap-3 animate-fadeIn shadow-2xl">
          <button
            onClick={(e) => scrollToSection(e, 'overview')}
            className={`text-left py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
              activeSection === 'overview'
                ? 'bg-violet-500/10 text-violet-300'
                : 'text-slate-300 hover:bg-white/[0.04]'
            }`}
          >
            Overview
          </button>
          <button
            onClick={(e) => scrollToSection(e, 'how-it-works')}
            className={`text-left py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
              activeSection === 'how-it-works'
                ? 'bg-violet-500/10 text-violet-300'
                : 'text-slate-300 hover:bg-white/[0.04]'
            }`}
          >
            How It Works
          </button>
          <button
            onClick={(e) => scrollToSection(e, 'features')}
            className={`text-left py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
              activeSection === 'features'
                ? 'bg-violet-500/10 text-violet-300'
                : 'text-slate-300 hover:bg-white/[0.04]'
            }`}
          >
            Features
          </button>
          <button
            onClick={(e) => scrollToSection(e, 'safety')}
            className={`text-left py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
              activeSection === 'safety'
                ? 'bg-violet-500/10 text-violet-300'
                : 'text-slate-300 hover:bg-white/[0.04]'
            }`}
          >
            Safety
          </button>

          <div className="pt-2 border-t border-white/[0.08]">
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                onEnterWorkspace();
              }}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-geist text-sm font-medium shadow-md shadow-violet-950 active:scale-[0.98] transition-all"
            >
              <span>Enter NovaQuery</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </header>
  );
}

