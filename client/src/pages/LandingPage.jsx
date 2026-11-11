import { useNavigate } from 'react-router-dom';
import { useState, useEffect, Fragment } from 'react';
import TAGALOG_COPY from '../locales/landingTagalog';
import {
  Globe,
  ArrowRight,
  BookOpen,
  Users,
  BarChart2,
  ShieldCheck,
  Menu,
  X,
  UserCog,
  ClipboardCheck,
  Headset,
  GraduationCap,
  Clock,
  Activity,
  Upload,
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
const BRONZE = '#B98B4E';
const BRONZE_DARK = '#8F6A35';
const BRONZE_LIGHT = '#DDBA86';
const PILL = '#FAEEE3';
const PILL_ICON = '#EFD9C9';
const INK = '#241512';
const INK_SOFT = '#5C4E42';
const MUTED = '#6B5B4D';

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
  {
    Icon: Users,
    title: 'Role-Based Portal Access',
    desc: 'The platform is built for four user roles: Administrator, Officer, Staff, and Scholar, each with specific permissions.',
  },
];

const stats = [
  { Icon: Users, value: '4', label: 'Portal Roles' },
  { Icon: Clock, value: '24/7', label: 'Monitoring' },
  { Icon: Activity, value: 'Real-Time', label: 'Updates' },
  { Icon: ShieldCheck, value: 'Secure', label: 'Audit Trail' },
];

const workflowSteps = [
  {
    Icon: Upload,
    title: 'Submit requirements',
    desc: 'Scholars upload their compliance files, reports, and updates through a simple and guided process.',
  },
  {
    Icon: ClipboardCheck,
    title: 'Review and validate',
    desc: 'Officers and staff verify submissions, assign follow-ups, and keep records accurate and timely.',
  },
  {
    Icon: BarChart2,
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
const SLIDE_COUNT = 4 + extraPhotos.length;

const NAV_LINKS = ['Home', 'About', 'Workflow', 'Features', 'Scholars'];

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

  const slides = [
    { src: aboutFrontPhoto, failed: aboutFrontPhotoFailed, onFail: () => setAboutFrontPhotoFailed(true), alt: 'Apple Scholar students and staff seated together indoors', position: 'center 40%', title: 'Papaya Academy', sub: heroSub },
    { src: galleryPhoto, failed: galleryPhotoFailed, onFail: () => setGalleryPhotoFailed(true), alt: 'Apple Scholar students at Papaya Academy', position: 'center 40%', title: 'Papaya Academy', sub: heroSub },
    { src: aboutBackPhoto, failed: aboutBackPhotoFailed, onFail: () => setAboutBackPhotoFailed(true), alt: 'Scholars waving in front of the Papaya Academy building', position: 'center 30%', title: 'Papaya Academy', sub: heroSub },
    { src: heroPhoto, failed: heroPhotoFailed, onFail: () => setHeroPhotoFailed(true), alt: 'Apple Scholar students gathered in front of Papaya Academy', position: 'center 75%', title: 'Papaya Academy', sub: heroSub },
    ...extraPhotos.map((p, idx) => ({
      src: p.src, failed: !!failedExtra[p.key], onFail: () => failExtra(p.key), alt: p.alt, position: 'center 40%',
      title: isTagalog ? TAGALOG_COPY.photoCaptions[idx] : p.title,
      sub: isTagalog ? 'Programa ng Apple Scholar · Payatas' : 'Apple Scholar Program · Payatas',
    })),
  ];

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

  const cardShadow = '0 26px 50px -28px rgba(74,23,48,0.45)';
  const cardBase = {
    background: SURFACE,
    border: `1px solid ${BORDER}`,
    boxShadow: `inset 0 3px 0 ${BRONZE}, ${cardShadow}`,
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

        /* Hero backdrop: cream → blush → rose → maroon (same blend as Login) */
        .hero-bg { background: linear-gradient(180deg, #FFFCF7 0%, #F6E9E1 42%, #D9A6B5 80%, #9A4064 100%); }

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
          background: linear-gradient(90deg, ${MAROON} 0%, ${MAROON_DEEP} 100%);
          color: #fff; box-shadow: 0 12px 24px -14px rgba(109,33,64,0.6);
          transition: transform 0.25s, box-shadow 0.25s, filter 0.25s;
        }
        .btn-maroon:hover { transform: translateY(-2px); filter: brightness(1.12); }
        .btn-outline-maroon { border: 1.5px solid ${MAROON}; color: ${MAROON}; background: ${SURFACE}; transition: background 0.25s, color 0.25s; }
        .btn-outline-maroon:hover { background: ${MAROON}; color: #fff; }

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
          background: scrolled ? 'rgba(255,252,247,0.93)' : '#FFFCF7',
          backdropFilter: scrolled ? 'blur(10px)' : 'none',
          WebkitBackdropFilter: scrolled ? 'blur(10px)' : 'none',
          borderBottom: `1px solid ${BORDER}`,
          boxShadow: scrolled ? '0 8px 24px rgba(74,23,48,0.08)' : 'none',
          transition: 'box-shadow 0.3s ease, background 0.3s ease',
        }}
      >
        <div className={`${WRAP} h-[76px] flex lg:grid lg:grid-cols-[1fr_auto_1fr] items-center justify-between gap-4`}>
          <a href="#home" onClick={() => handleNavClick('Home')} className="flex-shrink-0 justify-self-start" aria-label="Apple Scholar — home">
            <img src={appleLogo} alt="Apple Scholar" className="h-10 sm:h-11 w-auto" style={{ objectFit: 'contain' }} />
          </a>

          <div className="hidden lg:flex items-center gap-9 text-sm font-medium" style={{ color: INK_SOFT }}>
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
              className="btn-maroon hidden sm:flex items-center gap-2 text-sm font-semibold px-6 h-12 rounded-xl"
            >
              <span>{isTagalog ? TAGALOG_COPY.portalLogin : 'Portal Login'}</span>
              <ArrowRight size={15} />
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
            style={{ background: '#FFFCF7', borderTop: `1px solid ${BORDER}` }}
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
              className="btn-maroon sm:hidden text-sm font-semibold px-6 h-12 rounded-xl flex items-center justify-center gap-2 mt-5"
            >
              <span>{isTagalog ? TAGALOG_COPY.portalLogin : 'Portal Login'}</span>
              <ArrowRight size={15} />
            </button>
          </div>
        )}
      </nav>

      {/* ── HERO — centered headline, wide photo card ────────────────────────── */}
      <section id="home" className="relative scroll-mt-20 overflow-hidden">
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
            <button onClick={() => navigate('/login')} className="btn-maroon h-12 px-7 rounded-xl text-sm font-semibold inline-flex items-center gap-2">
              {isTagalog ? TAGALOG_COPY.portalLogin : 'Portal Login'} <ArrowRight size={15} />
            </button>
            <a href="#about" onClick={() => handleNavClick('About')} className="btn-outline-maroon h-12 px-7 rounded-xl text-sm font-semibold inline-flex items-center">
              {isTagalog ? TAGALOG_COPY.learnMore : 'Learn More'}
            </a>
          </div>

          {/* Wide photo card */}
          <div className="anim-fade-in delay-300 mt-12 sm:mt-14">
            <div
              className="rounded-[30px] p-2.5"
              style={{ background: SURFACE, boxShadow: `inset 0 3px 0 ${BRONZE}, 0 40px 70px -30px rgba(36,10,22,0.65)` }}
            >
              <div className="zoom relative rounded-[22px] overflow-hidden h-[230px] sm:h-[340px] lg:h-[400px]" style={{ background: MAROON_DEEP }}>
                <PhotoFill
                  src={heroPhoto}
                  failed={heroPhotoFailed}
                  onFail={() => setHeroPhotoFailed(true)}
                  alt="Apple Scholar students gathered in front of Papaya Academy"
                  position="center 82%"
                  fallback={fallbackGradient}
                />
                <div className="absolute inset-x-0 bottom-0 h-1/2 pointer-events-none" style={{ background: 'linear-gradient(to top, rgba(36,21,18,0.75), transparent)' }} />
                <div className="absolute bottom-4 left-5 right-5 text-left">
                  <p className="font-display font-semibold text-lg text-white leading-tight">Papaya Academy</p>
                  <p className="text-[12px] text-white/90">{heroSub} · Payatas, Manila</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* bottom waves */}
        <svg className="absolute left-0 bottom-0 w-full h-12 sm:h-[60px] pointer-events-none" viewBox="0 0 1440 60" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0,30 C260,0 520,56 800,30 C1080,6 1300,48 1440,20 L1440,60 L0,60 Z" fill={MAROON} />
          <path d="M0,42 C260,16 520,60 800,42 C1080,22 1300,56 1440,34 L1440,60 L0,60 Z" fill={CREAM} />
          <path d="M0,37 C260,11 520,55 800,37 C1080,17 1300,51 1440,29" fill="none" stroke={BRONZE} strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
        </svg>
      </section>

      {/* ── STATS STRIP ──────────────────────────────────────────────────────── */}
      <div className={`${WRAP} relative z-20 -mt-8 sm:-mt-10`}>
        <div className="grid grid-cols-2 lg:grid-cols-4 rounded-[22px] overflow-hidden" style={cardBase}>
          {stats.map((s, i) => (
            <div
              key={i}
              className={`flex items-center gap-3 px-5 py-4 sm:px-7 sm:py-5 ${['', 'border-l', 'border-t lg:border-t-0 lg:border-l', 'border-l border-t lg:border-t-0'][i]}`}
              style={{ borderColor: BORDER }}
            >
              <span className="hidden sm:flex w-11 h-11 rounded-full items-center justify-center flex-shrink-0" style={{ background: PILL_ICON, color: MAROON }}>
                <s.Icon size={18} />
              </span>
              <div className="min-w-0">
                <p className="font-display font-bold text-xl lg:text-[1.75rem] leading-tight truncate" style={{ color: MAROON_DEEP }}>{isTagalog ? TAGALOG_COPY.statsValues[i] : s.value}</p>
                <p className="text-xs lg:text-[13px]" style={{ color: MUTED }}>{isTagalog ? TAGALOG_COPY.stats[i] : s.label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

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
              living in and around the Payatas rubbish dump in Manila, Philippines.
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
          <a href="#features" onClick={() => handleNavClick('Features')} className="btn-outline-maroon mt-6 h-12 px-7 rounded-xl text-sm font-semibold inline-flex items-center gap-2">
            {isTagalog ? TAGALOG_COPY.learnMore : 'Learn More'} <ArrowRight size={14} />
          </a>
        </div>

        <div className="grid grid-cols-2 gap-4">
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
      <section id="roles" className={`${WRAP} scroll-mt-24 pt-20 lg:pt-24 text-center`}>
        <h2 className="sr-only">{isTagalog ? TAGALOG_COPY.roleAccessibleHeading : 'Built for Every Member of the Scholarship Community'}</h2>
        <Eyebrow>{isTagalog ? TAGALOG_COPY.portalRoles : 'Portal Roles'}</Eyebrow>
        <p className="font-display font-bold text-[1.75rem] sm:text-4xl leading-tight mb-8" style={{ color: MAROON_DEEP }} aria-hidden="true">
          {isTagalog ? TAGALOG_COPY.roleAccessibleHeading : 'Built for every member of the community'}
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 text-left">
          {localizedRoles.map(r => (
            <div key={r.role} className="lift rounded-[22px] p-7" style={cardBase}>
              <span className="w-[52px] h-[52px] rounded-full flex items-center justify-center mb-4" style={{ background: PILL_ICON, color: MAROON }}>
                <r.Icon size={22} />
              </span>
              <h3 className="font-display font-bold text-xl mb-2" style={{ color: MAROON_DEEP }}>{r.role}</h3>
              <p className="text-sm leading-[1.6]" style={{ color: INK_SOFT }}>{r.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── WORKFLOW ─────────────────────────────────────────────────────────── */}
      <section id="workflow" className={`${WRAP} scroll-mt-24 pt-20 lg:pt-24 text-center`}>
        <Eyebrow>{isTagalog ? 'Paano ito gumagana' : 'How It Works'}</Eyebrow>
        <h2 className="font-display font-bold text-[1.75rem] sm:text-4xl leading-tight mb-9" style={{ color: MAROON_DEEP }}>
          {isTagalog ? TAGALOG_COPY.detailHeadings[1] : 'A simple and organized process'}
        </h2>
        <div className="relative">
          <div className="hidden lg:block absolute left-[16%] right-[16%] top-[26px] h-[2px]" style={{ background: BRONZE, opacity: 0.7 }} aria-hidden="true" />
          <div className="relative grid md:grid-cols-3 gap-5 text-left">
            {localizedWorkflowSteps.map((step, index) => (
              <div key={step.title} className="rounded-[22px] p-7" style={cardBase}>
                <div className="flex items-center justify-between mb-4">
                  <span className="w-[52px] h-[52px] rounded-full flex items-center justify-center" style={{ background: MAROON, color: BRONZE_LIGHT }}>
                    <step.Icon size={22} />
                  </span>
                  <span className="font-display font-bold text-4xl leading-none" style={{ color: `${BRONZE}99` }}>0{index + 1}</span>
                </div>
                <h3 className="font-display font-bold text-xl mb-2" style={{ color: MAROON_DEEP }}>{step.title}</h3>
                <p className="text-sm leading-[1.6]" style={{ color: INK_SOFT }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ─────────────────────────────────────────────────────────── */}
      <section id="features" className={`${WRAP} scroll-mt-24 pt-20 lg:pt-24 grid lg:grid-cols-[420px_1fr] gap-6 lg:gap-14 items-start`}>
        <div className="rounded-[26px] p-8 sm:p-9" style={{ background: `linear-gradient(160deg, ${MAROON}, ${MAROON_DEEP})`, color: CREAM }}>
          <Eyebrow light>{isTagalog ? 'Mga Tampok' : 'Key Features'}</Eyebrow>
          <h2 className="font-display font-bold text-[1.7rem] sm:text-[2.1rem] leading-[1.15] mb-4 text-white">
            {isTagalog ? TAGALOG_COPY.detailHeadings[0] : 'A complete scholarship management portal'}
          </h2>
          <p className="text-sm leading-relaxed mb-6" style={{ color: '#EAD9C2' }}>
            {isTagalog ? 'Mga madaling gamiting tool para sa pagsunod, komunikasyon, pagsubaybay, at iba pa.' : 'Streamlined tools for compliance, communication, monitoring, and more.'}
          </p>
          <button onClick={() => navigate('/login')} className="h-12 px-7 rounded-xl text-sm font-semibold inline-flex items-center gap-2" style={{ background: SURFACE, color: MAROON_DEEP }}>
            {isTagalog ? TAGALOG_COPY.portalLogin : 'Portal Login'} <ArrowRight size={15} />
          </button>
        </div>

        <div className="grid sm:grid-cols-2 gap-5">
          {localizedFeatures.map(f => (
            <div key={f.title} className="lift rounded-[22px] p-7" style={cardBase}>
              <span className="w-11 h-11 rounded-2xl flex items-center justify-center mb-4" style={{ background: PILL_ICON, color: MAROON }}>
                <f.Icon size={20} />
              </span>
              <h3 className="font-display font-bold text-xl leading-snug mb-2" style={{ color: MAROON_DEEP }}>{f.title}</h3>
              <p className="text-sm leading-[1.6]" style={{ color: INK_SOFT }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── SCHOLARS — mosaic gallery with the photo carousel ────────────────── */}
      <section id="scholars" className={`${WRAP} scroll-mt-24 pt-20 lg:pt-24`}>
        <div className="text-center mb-8">
          <Eyebrow>{isTagalog ? 'Ang Aming Komunidad' : 'Our Community'}</Eyebrow>
          <h2 className="font-display font-bold text-[1.75rem] sm:text-4xl leading-tight" style={{ color: MAROON_DEEP }}>
            {isTagalog ? TAGALOG_COPY.detailHeadings[2] : 'The scholars behind every record'}
          </h2>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Carousel tile */}
          <div className="col-span-2 lg:row-span-2 flex flex-col">
            <div className="zoom relative overflow-hidden rounded-[22px] min-h-[260px] lg:min-h-[416px] flex-1" style={{ border: `1px solid ${BORDER}`, background: MAROON_DEEP, boxShadow: cardShadow }}>
              {slides.map((s, i) => (
                <div key={i} className="slide-layer absolute inset-0" style={{ opacity: slide === i ? 1 : 0 }} aria-hidden={slide === i ? undefined : 'true'}>
                  <PhotoFill src={s.src} failed={s.failed} onFail={s.onFail} alt={s.alt} position={s.position} fallback={fallbackGradient} />
                </div>
              ))}
              <div className="absolute inset-x-0 bottom-0 h-1/2 pointer-events-none" style={{ background: 'linear-gradient(to top, rgba(36,21,18,0.78), transparent)' }} />
              <button
                onClick={() => goSlide(slide - 1)}
                aria-label={isTagalog ? TAGALOG_COPY.previousPhoto : 'Previous photo'}
                className="absolute left-3 bottom-4 w-10 h-10 rounded-xl flex items-center justify-center text-white"
                style={{ border: '1px solid rgba(255,255,255,0.55)', background: 'rgba(36,21,18,0.35)' }}
              >
                <ChevronLeft size={18} />
              </button>
              <button
                onClick={() => goSlide(slide + 1)}
                aria-label={isTagalog ? TAGALOG_COPY.nextPhoto : 'Next photo'}
                className="absolute right-3 bottom-4 w-10 h-10 rounded-xl flex items-center justify-center text-white"
                style={{ border: '1px solid rgba(255,255,255,0.55)', background: 'rgba(36,21,18,0.35)' }}
              >
                <ChevronRight size={18} />
              </button>
              <div className="absolute bottom-4 left-16 right-16">
                <p className="font-display font-semibold text-lg text-white leading-tight">{slides[slide].title}</p>
                <p className="text-[12px] text-white/90">{slides[slide].sub}</p>
              </div>
            </div>
            <div className="flex items-center justify-center gap-2 pt-3" role="tablist" aria-label={isTagalog ? TAGALOG_COPY.featuredPhotos : 'Featured photos'}>
              {slides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => goSlide(i)}
                  aria-label={`${isTagalog ? TAGALOG_COPY.showPhoto : 'Show photo'} ${i + 1}`}
                  aria-selected={slide === i}
                  role="tab"
                  className="rounded-full"
                  style={{ width: 8, height: 8, background: slide === i ? MAROON : '#E3D3C0', transition: 'background 0.3s ease' }}
                />
              ))}
            </div>
          </div>

          {/* Four community tiles */}
          {extraPhotos.slice(1, 5).map((p, idx) => (
            <div key={p.key} className="zoom lift relative overflow-hidden rounded-[22px] h-[170px] lg:h-auto lg:min-h-[200px]" style={{ border: `1px solid ${BORDER}`, background: MAROON_DEEP }}>
              <PhotoFill src={p.src} failed={!!failedExtra[p.key]} onFail={() => failExtra(p.key)} alt={p.alt} position="center 40%" fallback={fallbackGradient} />
              <div className="absolute inset-x-0 bottom-0 h-3/5 pointer-events-none" style={{ background: 'linear-gradient(to top, rgba(36,21,18,0.8), transparent)' }} />
              <p className="absolute bottom-3 left-4 right-4 font-display font-semibold text-sm text-white leading-tight">{isTagalog ? TAGALOG_COPY.photoCaptions[idx + 1] : p.title}</p>
            </div>
          ))}
        </div>

        <p className="font-display italic text-center text-lg sm:text-xl mt-8 max-w-[640px] mx-auto leading-snug" style={{ color: INK }}>
          “Behind every data point is a real student working toward a better future from Payatas, Manila.”
        </p>
      </section>

      {/* ── JOIN THE MISSION BAND ────────────────────────────────────────────── */}
      <section className="mt-20 lg:mt-24 px-4 sm:px-6 lg:px-[120px] py-16 text-center" style={{ background: `linear-gradient(115deg, ${MAROON}, ${MAROON_DEEP})` }}>
        <h2 className="font-display font-bold text-[1.9rem] sm:text-[2.4rem] text-white mb-3">{isTagalog ? TAGALOG_COPY.joinMission : 'Join the mission.'}</h2>
        <p className="text-base mb-7" style={{ color: '#EAD9C2' }}>{isTagalog ? TAGALOG_COPY.joinMissionDescription : 'Help a scholar achieve their dream.'}</p>
        <button onClick={() => navigate('/login')} className="h-12 px-8 rounded-xl text-sm font-semibold inline-flex items-center gap-2" style={{ background: BRONZE, color: INK }}>
          {isTagalog ? TAGALOG_COPY.portalLogin : 'Portal Login'} <ArrowRight size={15} />
        </button>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────────────── */}
      <footer style={{ background: MAROON_DEEP }}>
        <div
          className={`${WRAP} py-8 flex flex-col lg:flex-row lg:justify-between items-start lg:items-center gap-6`}
          style={{ color: 'rgba(247,244,238,0.88)' }}
        >
          <div className="flex items-center gap-4">
            <div className="rounded-xl px-2.5 py-1.5 flex-shrink-0" style={{ background: SURFACE }}>
              <img src={appleLogo} alt="Apple Scholar" className="h-9 w-auto" style={{ objectFit: 'contain' }} />
            </div>
            <div className="text-[12.5px] leading-relaxed">
              <p>{isTagalog ? '© 2026 Kalinga Foundation. Nakalaan ang lahat ng karapatan.' : '© 2026 Kalinga Foundation. All rights reserved.'}</p>
              <p>Apple Scholar Program · {isTagalog ? TAGALOG_COPY.footerDescription : 'Scholarship Compliance Tracking System'} · 2026</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center lg:justify-end gap-x-4 gap-y-3 text-[13px]">
            <div className="flex items-center gap-3">
              {(isTagalog ? TAGALOG_COPY.legalLinks : ['Privacy Policy', 'Terms of Use', 'Contact Us']).map((t, i) => (
                <Fragment key={t}>
                  {i > 0 && <span aria-hidden="true" style={{ opacity: 0.4 }}>|</span>}
                  <a href="#" onClick={e => e.preventDefault()} className="hover:underline">{t}</a>
                </Fragment>
              ))}
            </div>
            <label
              className="flex items-center gap-2 rounded-xl px-3.5 h-10 text-[13px]"
              style={{ border: '1px solid rgba(247,244,238,0.35)', color: CREAM }}
            >
              <Globe size={14} />
              <span className="sr-only">Language / Wika</span>
              <select
                value={language}
                onChange={changeLanguage}
                aria-label="Language / Wika"
                className="bg-transparent text-inherit outline-none cursor-pointer"
                style={{ color: CREAM, colorScheme: 'dark' }}
              >
                <option value="en">English</option>
                <option value="tl">Tagalog</option>
              </select>
              <ChevronDown size={14} aria-hidden="true" />
            </label>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;