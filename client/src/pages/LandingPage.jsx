import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import TAGALOG_COPY from '../locales/landingTagalog';
import {
  Globe,
  ArrowRight,
  BookOpen,
  BarChart2,
  ShieldCheck,
  Menu,
  X,
  UserCog,
  ClipboardCheck,
  Headset,
  GraduationCap,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';

// ─── OFFICIAL LOGO ─────────────────────────────────────────────────────────
import appleLogo from '../assets/logo/applelogo.png';

// ─── PHOTO IMPORTS (src/assets/landing/) ───────────────────────────────────
import heroPhoto from '../assets/landing/papaya-academy-building-1.jpg';
import aboutFrontPhoto from '../assets/landing/scholars-group-indoor-1.jpg';
import aboutBackPhoto from '../assets/landing/papaya-academy-building-2.jpg';
import galleryPhoto from '../assets/landing/scholars-group-indoor-2.jpg';

import communityCleanup from '../assets/landing/community-cleanup-activity.jpg';
import communityGarden from '../assets/landing/community-garden-project.jpg';
import scholarGathering from '../assets/landing/scholar-community-gathering.jpg';
import scholarService from '../assets/landing/scholar-community-service.jpg';
import scholarLaptops from '../assets/landing/scholar-laptop-distribution.jpg';
import scholarVolunteer from '../assets/landing/scholar-volunteer-activity.jpg';

// ─── Token system — same as the Login / Access Portal page ─────────────────
const MAROON = '#6D2140';
const MAROON_DEEP = '#4A1730';
const CREAM = '#F7F4EE';
const SURFACE = '#FFFDF9';
const BORDER = '#E7D8C7';
const BRONZE = '#A9784E';
const BRONZE_DARK = '#8A5E38'; // darker bronze so small text stays readable on cream
const BRONZE_LIGHT = '#DDBA86';
const PILL = '#F4E9DC';
const SAND = '#F1E8DA';
const PILL_ICON = '#EFD9C9';
const INK = '#241512';
const INK_SOFT = '#5C4E42';
const MUTED = '#8A7A68';

const WRAP = 'w-full px-4 sm:px-6 lg:px-12';

// ─── Content ───────────────────────────────────────────────────────────────
const features = [
  {
    Icon: ShieldCheck,
    title: 'Compliance & Submission Management',
    desc: 'Scholars submit requirements and documents while administrators and officers track status, deadlines, and follow-ups.',
  },
  {
    Icon: BookOpen,
    title: 'Letter & Report Review',
    desc: 'The system supports review of scholar letters, monthly reports, and related correspondence with structured evaluation tools.',
  },
  {
    Icon: BarChart2,
    title: 'Attendance & Duty Monitoring',
    desc: 'Staff and officers can record attendance, manage duty logs, and monitor scholar participation through the portal.',
  },
];

const workflowSteps = [
  {
    title: 'Submit requirements',
    desc: 'Scholars upload their compliance files, reports, and updates through a simple and guided process.',
  },
  {
    title: 'Review and validate',
    desc: 'Officers and staff verify submissions, assign follow-ups, and keep records accurate and timely.',
  },
  {
    title: 'Track progress',
    desc: 'Administrators monitor overall performance, deadlines, and report status from one centralized dashboard.',
  },
];

const roles = [
  { role: 'Administrator', Icon: UserCog, desc: 'Manages users, compliance requirements, deadlines, reports, and overall system oversight.' },
  { role: 'Officer', Icon: ClipboardCheck, desc: 'Reviews scholar submissions, validates compliance records, and monitors progress closely.' },
  { role: 'Staff', Icon: Headset, desc: 'Handles attendance, duty logs, announcements, and support tasks for scholars.' },
  { role: 'Scholar', Icon: GraduationCap, desc: 'Uploads requirements, tracks personal status, views announcements, and accesses duty-related information.' },
];

const extraPhotos = [
  { key: 'cleanup', src: communityCleanup, title: 'Community Clean-up', alt: 'Scholars taking part in a community clean-up activity' },
  { key: 'garden', src: communityGarden, title: 'Community Garden', alt: 'Scholars working on a community garden project' },
  { key: 'gathering', src: scholarGathering, title: 'Community Gathering', alt: 'Scholars and families at a community gathering' },
  { key: 'service', src: scholarService, title: 'Community Service', alt: 'Scholars doing community service' },
  { key: 'laptops', src: scholarLaptops, title: 'Laptop Distribution', alt: 'Laptop distribution to Apple Scholars' },
  { key: 'volunteer', src: scholarVolunteer, title: 'Volunteer Activity', alt: 'Scholars volunteering together' },
];
const SLIDE_COUNT = extraPhotos.length - 1; // the volunteer photo lives in the hero

const NAV_LINKS = ['Home', 'About', 'Workflow', 'Features', 'Scholars'];

const CONTACT_EMAIL = 'applescholar.official@gmail.com';
const FOOTER_LINKS = [
  { label: 'Privacy Policy', to: '/privacy' },
  { label: 'Terms of Use', to: '/terms' },
  { label: 'Contact Us', subject: 'Apple Scholar inquiry' },
];
const getGmailComposeUrl = subject => (
  `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(CONTACT_EMAIL)}&su=${encodeURIComponent(subject)}`
);

// ─── Small helpers ─────────────────────────────────────────────────────────
const PhotoFill = ({ src, failed, onFail, alt = '', position = 'center', fallback }) =>
  failed ? (
    <div className="absolute inset-0" style={{ background: fallback }} role="img" aria-label={alt} />
  ) : (
    <img
      src={src}
      alt={alt}
      onError={onFail}
      className="absolute inset-0 w-full h-full object-cover"
      style={{ objectPosition: position }}
    />
  );

const Eyebrow = ({ children, light = false, className = 'mb-3' }) => (
  <p
    className={`text-[11px] font-semibold uppercase tracking-[0.24em] ${className}`}
    style={{ color: light ? BRONZE_LIGHT : BRONZE_DARK }}
  >
    {children}
  </p>
);

const LandingPage = () => {
  const navigate = useNavigate();
  const [language, setLanguage] = useState(() => localStorage.getItem('landing-language') || 'en');
  const isTagalog = language === 'tl';
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeNav, setActiveNav] = useState('Home');
  const [slide, setSlide] = useState(0);
  const [failedExtra, setFailedExtra] = useState({});
  const failExtra = key => setFailedExtra(f => ({ ...f, [key]: true }));

  const [heroPhotoFailed, setHeroPhotoFailed] = useState(false);
  const [aboutFrontPhotoFailed, setAboutFrontPhotoFailed] = useState(false);
  const [aboutBackPhotoFailed, setAboutBackPhotoFailed] = useState(false);
  const [galleryPhotoFailed, setGalleryPhotoFailed] = useState(false);

  const fallbackGradient = `linear-gradient(160deg, ${MAROON} 0%, ${MAROON_DEEP} 80%)`;

  const localizedFeatures = isTagalog
    ? features.map((item, index) => ({ ...item, title: TAGALOG_COPY.featureTitles[index], desc: TAGALOG_COPY.featureDescriptions[index] }))
    : features;
  const localizedWorkflowSteps = isTagalog
    ? workflowSteps.map((item, index) => ({ ...item, title: TAGALOG_COPY.workflowTitles[index], desc: TAGALOG_COPY.workflowDescriptions[index] }))
    : workflowSteps;
  const localizedRoles = isTagalog
    ? roles.map((item, index) => ({ ...item, role: TAGALOG_COPY.roleLabels[index], desc: TAGALOG_COPY.roleDescriptions[index] }))
    : roles;

  const changeLanguage = event => {
    const nextLanguage = event.target.value;
    setLanguage(nextLanguage);
    localStorage.setItem('landing-language', nextLanguage);
  };

  const heroSub = isTagalog ? 'Proyekto ng Kalinga · Kinikilala ng DepEd' : 'A Kalinga Project · DepEd Recognized';

  const slides = extraPhotos
    .map((p, idx) => ({
      key: p.key,
      src: p.src, failed: !!failedExtra[p.key], onFail: () => failExtra(p.key), alt: p.alt, position: 'center 40%',
      title: isTagalog ? TAGALOG_COPY.photoCaptions[idx] : p.title,
      sub: isTagalog ? 'Programa ng Apple Scholar · Rodriguez, Rizal' : 'Apple Scholar Program · Rodriguez, Rizal',
    }))
    .filter(sl => sl.key !== 'volunteer');

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const reduce = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return undefined;
    const interval = setInterval(() => setSlide(s => (s + 1) % SLIDE_COUNT), 6000);
    return () => clearInterval(interval);
  }, []);

  const handleNavClick = link => {
    setMobileMenuOpen(false);
    if (typeof link === 'string') setActiveNav(link);
  };
  const goSlide = i => setSlide((i + slides.length) % slides.length);

  const cardShadow = '0 14px 34px -20px rgba(74,23,48,0.30)';
  const cardBase = {
    background: SURFACE,
    border: `1px solid ${BORDER}`,
    boxShadow: cardShadow,
  };

  const navLabel = link => (isTagalog ? TAGALOG_COPY.nav[NAV_LINKS.indexOf(link)] : link);

  return (
    <div
      className="min-h-screen font-body"
      style={{ background: CREAM, color: INK, overflowX: 'clip' }}
    >
      {/* ── GLOBAL STYLE ─────────────────────────────────────────────────────── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;0,800;1,400;1,600&family=Inter:wght@300;400;500;600;700&display=swap');

        .font-display { font-family: 'Playfair Display', Georgia, serif; }
        .font-body    { font-family: 'Inter', system-ui, sans-serif; }

        html { scroll-behavior: smooth; }

        @keyframes slide-up {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes menu-drop {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .anim-slide-up  { animation: slide-up 0.7s cubic-bezier(.16,1,.3,1) forwards; }
        .anim-fade-in   { animation: fade-in 1s ease forwards; }
        .anim-menu-drop { animation: menu-drop 0.25s ease forwards; }
        .delay-100 { animation-delay: 0.1s; opacity: 0; }
        .delay-200 { animation-delay: 0.2s; opacity: 0; }
        .delay-300 { animation-delay: 0.3s; opacity: 0; }
        .delay-400 { animation-delay: 0.4s; opacity: 0; }

        /* Hero backdrop: calm cream that settles into the off-white of the cards */
        .hero-bg { background: linear-gradient(180deg, ${CREAM} 0%, ${CREAM} 55%, ${SAND} 100%); }

        .hero-h1 { font-size: clamp(2.5rem, 9vw, 4.25rem); }

        .nav-link { position: relative; transition: color 0.25s; }
        .nav-link::after {
          content: ''; position: absolute; bottom: -7px; left: 0; right: 0;
          height: 2px; border-radius: 2px; background: ${MAROON};
          transform: scaleX(0); transition: transform 0.25s;
        }
        .nav-link:hover { color: ${MAROON}; }
        .nav-link:hover::after { transform: scaleX(1); background: ${BRONZE}; }
        .nav-link[aria-current='true'] { color: ${MAROON}; font-weight: 600; }
        .nav-link[aria-current='true']::after { transform: scaleX(1); background: ${MAROON}; }

        .lift { transition: transform 0.3s ease; }
        .lift:hover { transform: translateY(-3px); }
        .zoom img { transition: transform 0.8s cubic-bezier(.16,1,.3,1); }
        .zoom:hover img { transform: scale(1.04); }
        .slide-layer { transition: opacity 0.7s ease; }

        .btn-maroon {
          background: ${MAROON};
          color: #fff; box-shadow: 0 10px 22px -14px rgba(109,33,64,0.55);
          transition: transform 0.25s, box-shadow 0.25s, background 0.25s;
        }
        .btn-maroon:hover { transform: translateY(-1px); background: ${MAROON_DEEP}; }
        .btn-outline-maroon { border: 1.5px solid ${MAROON}; color: ${MAROON}; background: ${SURFACE}; transition: background 0.25s, color 0.25s; }
        .btn-outline-maroon:hover { background: ${MAROON}; color: #fff; }

        .arrow-btn { border: 1.5px solid ${BRONZE}; color: ${MAROON}; background: ${SURFACE}; transition: background 0.25s, color 0.25s; }
        .arrow-btn:hover { background: ${MAROON}; color: #fff; border-color: ${MAROON}; }

        a:focus-visible, button:focus-visible, select:focus-visible { outline: 2px solid ${BRONZE}; outline-offset: 3px; }

        @media (prefers-reduced-motion: reduce) {
          html { scroll-behavior: auto; }
          .anim-slide-up, .anim-fade-in, .anim-menu-drop { animation: none !important; opacity: 1 !important; transform: none !important; }
          .lift, .zoom img, .btn-maroon, .nav-link::after, .slide-layer { transition: none !important; }
        }
      `}</style>

      {/* ── NAVBAR ───────────────────────────────────────────────────────────── */}
      <nav
        className="sticky top-0 z-50 font-body"
        style={{
          background: scrolled ? 'rgba(247,244,238,0.95)' : CREAM,
          backdropFilter: scrolled ? 'blur(10px)' : 'none',
          WebkitBackdropFilter: scrolled ? 'blur(10px)' : 'none',
          borderBottom: `1px solid ${BORDER}`,
          transition: 'background 0.3s ease',
        }}
      >
        <div className={`${WRAP} h-[72px] sm:h-[84px] flex lg:grid lg:grid-cols-[1fr_auto_1fr] items-center justify-between gap-4`}>
          <a href="#home" onClick={() => handleNavClick('Home')} className="flex-shrink-0 justify-self-start" aria-label="Apple Scholar — home">
            <img src={appleLogo} alt="Apple Scholar" className="h-12 sm:h-14 w-auto" style={{ objectFit: 'contain' }} />
          </a>

          <div className="hidden lg:flex items-center gap-10 text-sm font-medium" style={{ color: INK_SOFT }}>
            {NAV_LINKS.map(link => (
              <a
                key={link}
                href={`#${link.toLowerCase()}`}
                onClick={() => handleNavClick(link)}
                aria-current={activeNav === link ? 'true' : undefined}
                className="nav-link"
              >
                {navLabel(link)}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-3 justify-self-end">
            <button
              onClick={() => navigate('/login')}
              className="btn-maroon hidden lg:inline-flex items-center justify-center text-sm font-semibold px-7 h-11 rounded-xl"
            >
              {isTagalog ? TAGALOG_COPY.portalLogin : 'Portal Login'}
            </button>

            <button
              onClick={() => setMobileMenuOpen(o => !o)}
              className="lg:hidden w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: SURFACE, border: `1px solid ${BORDER}`, color: MAROON }}
              aria-label={isTagalog ? TAGALOG_COPY.menuToggle : 'Toggle menu'}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div
            className="lg:hidden anim-menu-drop px-4 sm:px-6 pt-1 pb-5 flex flex-col"
            style={{ background: CREAM, borderTop: `1px solid ${BORDER}` }}
          >
            {NAV_LINKS.map(link => (
              <a
                key={link}
                href={`#${link.toLowerCase()}`}
                onClick={() => handleNavClick(link)}
                className="text-base font-medium py-3"
                style={{ color: activeNav === link ? MAROON : INK, borderBottom: `1px solid ${BORDER}` }}
              >
                {navLabel(link)}
              </a>
            ))}
            <button
              onClick={() => navigate('/login')}
              className="btn-maroon text-sm font-semibold px-6 h-12 rounded-xl flex items-center justify-center mt-5"
            >
              {isTagalog ? TAGALOG_COPY.portalLogin : 'Portal Login'}
            </button>
          </div>
        )}
      </nav>

      {/* ── HERO — centered headline, wide photo card ────────────────────────── */}
      <section id="home" className="relative scroll-mt-24 overflow-hidden">
        <div className="hero-bg absolute inset-0" aria-hidden="true" />

        <div className={`${WRAP} relative z-10 pt-14 sm:pt-[72px] pb-24 sm:pb-28 text-center`}>
          <p className="anim-slide-up delay-100 text-[11px] font-semibold uppercase mb-3" style={{ color: BRONZE_DARK, letterSpacing: '0.24em' }}>
            Kalinga Foundation · Apple Scholar Program
          </p>

          <h1 className="anim-slide-up delay-200 hero-h1 font-display font-bold leading-[1.05] mb-3" style={{ color: MAROON_DEEP }}>
            <span className="block">{isTagalog ? TAGALOG_COPY.heroTitle[0] : 'Support every'}</span>
            <span className="block">{isTagalog ? TAGALOG_COPY.heroTitle[1] : 'scholar journey.'}</span>
          </h1>

          <p className="anim-slide-up delay-200 font-display italic text-xl sm:text-2xl mb-4" style={{ color: MAROON }}>
            {isTagalog ? TAGALOG_COPY.heroSubtitle : 'From submission to success.'}
          </p>

          <p className="anim-slide-up delay-300 max-w-[640px] mx-auto text-[15px] sm:text-base leading-[1.6] mb-7" style={{ color: INK_SOFT }}>
            {isTagalog ? TAGALOG_COPY.heroDescription : 'A centralized portal for tracking compliance, reviewing correspondence, and monitoring academic progress across administrators, officers, staff, and scholars in the Apple Scholar Program.'}
          </p>

          <div className="anim-slide-up delay-400 flex flex-wrap gap-3 justify-center">
            <a href="#workflow" onClick={() => handleNavClick('Workflow')} className="btn-maroon w-full sm:w-auto justify-center h-12 px-7 rounded-xl text-sm font-semibold inline-flex items-center gap-2">
              {isTagalog ? 'Paano ito gumagana' : 'How It Works'} <ArrowRight size={15} />
            </a>
            <a href="#about" onClick={() => handleNavClick('About')} className="btn-outline-maroon w-full sm:w-auto justify-center h-12 px-7 rounded-xl text-sm font-semibold inline-flex items-center">
              {isTagalog ? TAGALOG_COPY.learnMore : 'Learn More'}
            </a>
          </div>

          {/* Three-photo strip — middle one is taller */}
          <div className="anim-fade-in delay-300 mt-12 sm:mt-14 relative">
            <div className="grid grid-cols-[1fr_1.35fr_1fr] gap-3 sm:gap-5 items-end text-left">
              <div className="zoom relative overflow-hidden rounded-[18px] sm:rounded-[24px] h-[130px] sm:h-[250px] lg:h-[290px]" style={{ background: MAROON_DEEP, border: `1px solid ${BORDER}`, boxShadow: cardShadow }}>
                <PhotoFill
                  src={galleryPhoto}
                  failed={galleryPhotoFailed}
                  onFail={() => setGalleryPhotoFailed(true)}
                  alt="Apple Scholar students at Papaya Academy"
                  position="center 40%"
                  fallback={fallbackGradient}
                />
                <div className="absolute inset-x-0 bottom-0 h-1/2 pointer-events-none" style={{ background: 'linear-gradient(to top, rgba(36,21,18,0.7), transparent)' }} />
                <p className="absolute bottom-2.5 left-3 right-3 font-display font-semibold text-[13px] sm:text-base text-white leading-tight">{isTagalog ? 'Mga Iskolar' : 'Our Scholars'}</p>
              </div>

              <div className="zoom relative overflow-hidden rounded-[18px] sm:rounded-[24px] h-[170px] sm:h-[340px] lg:h-[390px]" style={{ background: MAROON_DEEP, border: `1px solid ${BORDER}`, boxShadow: '0 30px 60px -32px rgba(74,23,48,0.45)' }}>
                <PhotoFill
                  src={heroPhoto}
                  failed={heroPhotoFailed}
                  onFail={() => setHeroPhotoFailed(true)}
                  alt="Apple Scholar students gathered in front of Papaya Academy"
                  position="center 82%"
                  fallback={fallbackGradient}
                />
                <div className="absolute inset-x-0 bottom-0 h-1/2 pointer-events-none" style={{ background: 'linear-gradient(to top, rgba(36,21,18,0.75), transparent)' }} />
                <div className="absolute bottom-3 sm:bottom-4 left-3 sm:left-5 right-3 sm:right-5">
                  <p className="font-display font-semibold text-sm sm:text-lg text-white leading-tight">Papaya Academy</p>
                  <p className="text-[11px] sm:text-[12px] text-white/90">Rodriguez, Rizal</p>
                </div>
              </div>

              <div className="zoom relative overflow-hidden rounded-[18px] sm:rounded-[24px] h-[130px] sm:h-[250px] lg:h-[290px]" style={{ background: MAROON_DEEP, border: `1px solid ${BORDER}`, boxShadow: cardShadow }}>
                <PhotoFill
                  src={scholarVolunteer}
                  failed={!!failedExtra.volunteer}
                  onFail={() => failExtra('volunteer')}
                  alt="Scholars volunteering together"
                  position="center 40%"
                  fallback={fallbackGradient}
                />
                <div className="absolute inset-x-0 bottom-0 h-1/2 pointer-events-none" style={{ background: 'linear-gradient(to top, rgba(36,21,18,0.7), transparent)' }} />
                <p className="absolute bottom-2.5 left-3 right-3 font-display font-semibold text-[13px] sm:text-base text-white leading-tight">{isTagalog ? TAGALOG_COPY.photoCaptions[5] : 'Volunteer Activity'}</p>
              </div>
            </div>

            {/* trust pill overlapping the strip */}
            <span
              className="absolute left-1/2 -translate-x-1/2 -bottom-5 inline-flex items-center gap-2 h-10 px-5 rounded-full text-[12.5px] font-semibold whitespace-nowrap"
              style={{ background: PILL, color: MAROON_DEEP, border: `1px solid ${BORDER}`, boxShadow: '0 12px 24px -14px rgba(74,23,48,0.5)' }}
            >
              <GraduationCap size={15} color={MAROON} /> {heroSub}
            </span>
          </div>
        </div>

      </section>

      {/* ── ABOUT ────────────────────────────────────────────────────────────── */}
      <section id="about" className={`${WRAP} scroll-mt-24 pt-20 lg:pt-24 grid lg:grid-cols-[1.1fr_1fr] gap-10 lg:gap-16 items-center`}>
        <div>
          <Eyebrow>{isTagalog ? TAGALOG_COPY.aboutEyebrow : 'About Apple Scholar'}</Eyebrow>
          <h2 className="font-display font-bold text-[2rem] sm:text-[2.5rem] leading-[1.1] mb-4" style={{ color: MAROON_DEEP }}>
            {isTagalog ? TAGALOG_COPY.aboutTitle : 'Education for those who need it most.'}
          </h2>
          <div className="space-y-3 text-[15px] leading-[1.7]" style={{ color: INK_SOFT }}>
            <p>{isTagalog ? TAGALOG_COPY.aboutParagraphs[0] : <>
              The <strong className="font-semibold" style={{ color: INK }}>Kalinga Foundation</strong> is devoted to children in extreme poverty
              living in Rodriguez and nearby communities in Rizal, Philippines.
              Kalinga offers them tools with which they can build a better future for themselves.
            </>}</p>
            <p>{isTagalog ? TAGALOG_COPY.aboutParagraphs[1] : <>
              The <strong className="font-semibold" style={{ color: INK }}>Apple Scholar Program</strong> is the foundation's scholarship arm —
              providing financial support, mentoring, and academic guidance to disadvantaged
              youth, from high school through college and beyond.
            </>}</p>
            <p>{isTagalog ? TAGALOG_COPY.aboutParagraphs[2] : <>
              This platform — the <strong className="font-semibold" style={{ color: INK }}>Scholarship Compliance Tracking System</strong> —
              was built to digitize and streamline the program's operations: monitoring compliance,
              evaluating correspondence, and generating analytics to support every scholar's journey.
            </>}</p>
          </div>
        </div>

        <div className="relative grid grid-cols-2 gap-4">
          <div className="zoom relative overflow-hidden rounded-[22px] h-[220px] sm:h-[300px]" style={{ background: MAROON_DEEP, boxShadow: cardShadow }}>
            <PhotoFill
              src={aboutFrontPhoto}
              failed={aboutFrontPhotoFailed}
              onFail={() => setAboutFrontPhotoFailed(true)}
              alt="Apple Scholar students and staff seated together indoors"
              position="center 40%"
              fallback={fallbackGradient}
            />
          </div>
          <div className="zoom relative overflow-hidden rounded-[22px] h-[220px] sm:h-[300px] mt-8 sm:mt-10" style={{ background: MAROON_DEEP, boxShadow: cardShadow }}>
            <PhotoFill
              src={aboutBackPhoto}
              failed={aboutBackPhotoFailed}
              onFail={() => setAboutBackPhotoFailed(true)}
              alt="Scholars waving in front of the Papaya Academy building"
              position="center 30%"
              fallback={fallbackGradient}
            />
          </div>
        </div>
      </section>

      {/* ── PORTAL ROLES ─────────────────────────────────────────────────────── */}
      <section id="roles" className="scroll-mt-24 mt-20 lg:mt-24 py-16 lg:py-20" style={{ background: SAND }}>
        <div className={`${WRAP} text-center`}>
        <h2 className="sr-only">{isTagalog ? TAGALOG_COPY.roleAccessibleHeading : 'Built for Every Member of the Scholarship Community'}</h2>
        <Eyebrow>{isTagalog ? TAGALOG_COPY.portalRoles : 'Portal Roles'}</Eyebrow>
        <p className="font-display font-bold text-[1.75rem] sm:text-4xl leading-tight mb-8" style={{ color: MAROON_DEEP }} aria-hidden="true">
          {isTagalog ? TAGALOG_COPY.roleAccessibleHeading : 'Built for every member of the community'}
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 text-left">
          {localizedRoles.map(r => (
            <div key={r.role} className="lift rounded-[22px] p-7" style={cardBase}>
              <span className="w-[52px] h-[52px] rounded-2xl flex items-center justify-center mb-4" style={{ background: PILL_ICON, color: MAROON }}>
                <r.Icon size={22} />
              </span>
              <h3 className="font-display font-bold text-xl mb-2" style={{ color: MAROON_DEEP }}>{r.role}</h3>
              <p className="text-sm leading-[1.6]" style={{ color: INK_SOFT }}>{r.desc}</p>
            </div>
          ))}
        </div>
        </div>
      </section>

      {/* ── WORKFLOW ─────────────────────────────────────────────────────────── */}
      <section id="workflow" className={`${WRAP} scroll-mt-24 pt-20 lg:pt-24 text-center`}>
        <Eyebrow>{isTagalog ? 'Paano ito gumagana' : 'How It Works'}</Eyebrow>
        <h2 className="font-display font-bold text-[1.75rem] sm:text-4xl leading-tight mb-9" style={{ color: MAROON_DEEP }}>
          {isTagalog ? TAGALOG_COPY.detailHeadings[1] : 'A simple and organized process'}
        </h2>
        {/* One wide card, three columns */}
        <div className="grid md:grid-cols-3 rounded-[22px] overflow-hidden text-left" style={cardBase}>
          {localizedWorkflowSteps.map((step, idx) => (
            <div
              key={step.title}
              className={`p-7 sm:p-9 ${idx > 0 ? 'border-t md:border-t-0 md:border-l' : ''}`}
              style={{ borderColor: BORDER }}
            >
              <span className="font-display font-bold text-[2.75rem] leading-none" style={{ color: BRONZE }}>0{idx + 1}</span>
              <h3 className="font-display font-bold text-xl mt-5 mb-2" style={{ color: MAROON_DEEP }}>{step.title}</h3>
              <p className="text-sm leading-[1.65]" style={{ color: INK_SOFT }}>{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURES ─────────────────────────────────────────────────────────── */}
      <section id="features" className={`${WRAP} scroll-mt-24 pt-20 lg:pt-24`}>
        {/* Bento grid: heading tile + three feature tiles */}
        <div className="grid lg:grid-cols-[1.1fr_1fr] gap-4 lg:gap-5">
          <div className="lg:row-span-2 rounded-[26px] p-8 sm:p-10 flex flex-col justify-between gap-10" style={{ background: MAROON_DEEP, color: CREAM }}>
            <div>
              <Eyebrow light>{isTagalog ? 'Mga Tampok' : 'Key Features'}</Eyebrow>
              <h2 className="font-display font-bold text-[1.9rem] sm:text-[2.4rem] leading-[1.12] text-white">
                {isTagalog ? TAGALOG_COPY.detailHeadings[0] : 'A complete scholarship management portal'}
              </h2>
            </div>
            <p className="text-sm sm:text-[15px] leading-relaxed max-w-[420px]" style={{ color: '#EAD9C2' }}>
              {isTagalog ? 'Mga madaling gamiting tool para sa pagsunod, komunikasyon, pagsubaybay, at iba pa.' : 'Streamlined tools for compliance, communication, monitoring, and more.'}
            </p>
          </div>

          {localizedFeatures.slice(0, 1).map(f => (
            <div key={f.title} className="lift rounded-[22px] p-7" style={cardBase}>
              <span className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4" style={{ background: PILL_ICON, color: MAROON }}>
                <f.Icon size={22} />
              </span>
              <h3 className="font-display font-bold text-xl leading-snug mb-2" style={{ color: MAROON_DEEP }}>{f.title}</h3>
              <p className="text-sm leading-[1.65]" style={{ color: INK_SOFT }}>{f.desc}</p>
            </div>
          ))}

          <div className="grid sm:grid-cols-2 gap-4 lg:gap-5">
            {localizedFeatures.slice(1).map(f => (
              <div key={f.title} className="lift rounded-[22px] p-7" style={cardBase}>
                <span className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4" style={{ background: PILL_ICON, color: MAROON }}>
                  <f.Icon size={22} />
                </span>
                <h3 className="font-display font-bold text-xl leading-snug mb-2" style={{ color: MAROON_DEEP }}>{f.title}</h3>
                <p className="text-sm leading-[1.65]" style={{ color: INK_SOFT }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SCHOLARS — featured photo with thumbnail picker ─────────────────── */}
      <section id="scholars" className="scroll-mt-24 mt-20 lg:mt-24 py-16 lg:py-20" style={{ background: SAND }}>
        <div className={WRAP}>
        {/* Heading on the left, controls on the right */}
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div>
            <Eyebrow>{isTagalog ? 'Ang Aming Komunidad' : 'Our Community'}</Eyebrow>
            <h2 className="font-display font-bold text-[1.75rem] sm:text-4xl leading-tight" style={{ color: MAROON_DEEP }}>
              {isTagalog ? TAGALOG_COPY.detailHeadings[2] : 'The scholars behind every record'}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-display text-lg tabular-nums mr-1" style={{ color: MAROON_DEEP }} aria-live="polite">
              {String(slide + 1).padStart(2, '0')}<span style={{ color: MUTED }}> / {String(slides.length).padStart(2, '0')}</span>
            </span>
            <button
              onClick={() => goSlide(slide - 1)}
              aria-label={isTagalog ? TAGALOG_COPY.previousPhoto : 'Previous photo'}
              className="arrow-btn w-11 h-11 rounded-xl flex items-center justify-center"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={() => goSlide(slide + 1)}
              aria-label={isTagalog ? TAGALOG_COPY.nextPhoto : 'Next photo'}
              className="arrow-btn w-11 h-11 rounded-xl flex items-center justify-center"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        {/* Featured photo + clickable thumbnails */}
        <div className="flex flex-col gap-3 sm:gap-4">
          <div className="zoom relative overflow-hidden rounded-[26px] h-[240px] sm:h-[380px] lg:h-[480px]" style={{ border: `1px solid ${BORDER}`, background: MAROON_DEEP, boxShadow: cardShadow }}>
            {slides.map((sl, i) => (
              <div key={i} className="slide-layer absolute inset-0" style={{ opacity: slide === i ? 1 : 0 }} aria-hidden={slide === i ? undefined : 'true'}>
                <PhotoFill src={sl.src} failed={sl.failed} onFail={sl.onFail} alt={sl.alt} position={sl.position} fallback={fallbackGradient} />
              </div>
            ))}
            <div className="absolute inset-x-0 bottom-0 h-1/2 pointer-events-none" style={{ background: 'linear-gradient(to top, rgba(36,21,18,0.78), transparent)' }} />
            <div className="absolute bottom-5 left-6 right-6">
              <p className="font-display font-semibold text-xl text-white leading-tight">{slides[slide].title}</p>
              <p className="text-[12.5px] text-white/90">{slides[slide].sub}</p>
            </div>
          </div>

          <div className="grid grid-cols-5 gap-3 sm:gap-4" role="tablist" aria-label={isTagalog ? TAGALOG_COPY.featuredPhotos : 'Featured photos'}>
            {slides.map((sl, i) => (
              <button
                key={i}
                onClick={() => goSlide(i)}
                role="tab"
                aria-selected={slide === i}
                aria-label={`${isTagalog ? TAGALOG_COPY.showPhoto : 'Show photo'} ${i + 1}`}
                className="relative overflow-hidden rounded-2xl h-[56px] sm:h-[84px] lg:h-[104px]"
                style={{
                  background: MAROON_DEEP,
                  outline: slide === i ? `3px solid ${MAROON}` : '3px solid transparent',
                  outlineOffset: 2,
                  opacity: slide === i ? 1 : 0.7,
                  transition: 'opacity 0.3s ease, outline-color 0.3s ease',
                }}
              >
                <PhotoFill src={sl.src} failed={sl.failed} onFail={sl.onFail} alt="" position={sl.position} fallback={fallbackGradient} />
              </button>
            ))}
          </div>
        </div>
        </div>
      </section>

      {/* ── FOOTER — one clean row ───────────────────────────────────────────── */}
      <footer style={{ background: MAROON_DEEP, color: 'rgba(247,244,238,0.88)' }}>
        <div className={`${WRAP} py-7 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5`}>
          <div className="flex items-center gap-4">
            <div className="rounded-xl px-2.5 py-1.5 flex-shrink-0" style={{ background: SURFACE }}>
              <img src={appleLogo} alt="Apple Scholar" className="h-9 w-auto" style={{ objectFit: 'contain' }} />
            </div>
            <p className="text-[12.5px] leading-relaxed">
              {isTagalog ? '© 2026 Kalinga Foundation. Nakalaan ang lahat ng karapatan.' : '© 2026 Kalinga Foundation. All rights reserved.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-3 text-[13px]">
            <nav aria-label={isTagalog ? 'Mga legal na link' : 'Legal'} className="flex flex-wrap items-center gap-x-5 gap-y-2">
              {FOOTER_LINKS.map((l, k) => (
                <a
                  key={l.to || l.label}
                  href={l.to || getGmailComposeUrl(l.subject)}
                  onClick={l.to ? e => { e.preventDefault(); navigate(l.to); window.scrollTo(0, 0); } : undefined}
                  target={l.to ? undefined : '_blank'}
                  rel={l.to ? undefined : 'noopener noreferrer'}
                  className="hover:underline"
                >
                  {isTagalog ? TAGALOG_COPY.legalLinks[k] : l.label}
                </a>
              ))}
            </nav>

            {/* The select fills the whole box, so clicking anywhere (including the arrow) opens it */}
            <div className="relative inline-flex items-center">
              <Globe size={14} aria-hidden="true" className="absolute left-3.5 pointer-events-none" style={{ color: CREAM }} />
              <select
                value={language}
                onChange={changeLanguage}
                aria-label="Language / Wika"
                className="appearance-none h-10 rounded-xl pl-10 pr-10 text-[13px] cursor-pointer outline-none"
                style={{ background: 'transparent', color: CREAM, border: '1px solid rgba(247,244,238,0.35)' }}
              >
                <option value="en" style={{ background: MAROON_DEEP, color: CREAM }}>English</option>
                <option value="tl" style={{ background: MAROON_DEEP, color: CREAM }}>Tagalog</option>
              </select>
              <ChevronDown size={14} aria-hidden="true" className="absolute right-3.5 pointer-events-none" style={{ color: CREAM }} />
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;