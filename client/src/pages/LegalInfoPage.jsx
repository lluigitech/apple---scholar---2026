import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Mail } from 'lucide-react';

// Official Apple Scholar logo — also the way back to the landing page
import appleLogo from '../assets/logo/applelogo.png';

const CONTACT_EMAIL = 'applescholar.official@gmail.com';
const GMAIL_COMPOSE_URL = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(CONTACT_EMAIL)}&su=${encodeURIComponent('Apple Scholar inquiry')}`;

/* ---------- Same token system as Login / ForgotPassword ---------- */
const PRIMARY = '#6D2140';
const PRIMARY_DEEP = '#4A1730';
const ACCENT = '#B98B4E';
const ACCENT_DARK = '#8F6A35';
const CARD = '#FFFDF9';
const BORDER = '#E7D8C7';
const SAND = '#FBF1E6';
const INK = '#241512';
const INK_SOFT = '#5C4E42';

const display = { fontFamily: "'Playfair Display', Georgia, serif" };
const sans = { fontFamily: "'Inter', 'Segoe UI', sans-serif" };

const CONTENT = {
  privacy: {
    en: {
      title: 'Privacy Policy',
      intro: 'This draft explains how the Apple Scholar portal handles information used to administer the scholarship program. The Kalinga Foundation should review and approve it before treating it as the official policy.',
      sections: [
        {
          title: 'Information in the portal',
          paragraphs: ['The portal may contain account and contact details (such as name, email, phone number, address, birth date, school, and year level), scholarship submissions and uploaded files, academic and attendance records, and messages or announcements. It may also record account activity and access to protected records for system administration and auditing.'],
        },
        {
          title: 'How information is used',
          paragraphs: ['Information is used to manage scholarship accounts, receive and review requirements, coordinate program activities, track academic and compliance progress, communicate with users, and protect and administer the portal.'],
        },
        {
          title: 'Access and service providers',
          paragraphs: ['Access is intended for authorized users according to their portal roles and assigned responsibilities. The portal includes role-based access controls and sensitive-data access logging. Information and uploaded files may be processed by hosting, database, email, or file-storage providers used to operate the service.'],
        },
        {
          title: 'Storage and retention',
          paragraphs: ['Scholarship records are kept for program administration, reporting, and accountability. The portal tracks retention dates for uploaded documents; some document workflows use a retention period of up to three years. The actual retention and deletion schedule should be confirmed by the Foundation.'],
        },
        {
          title: 'Your questions or requests',
          paragraphs: ['For questions about information in the portal or to request a review or correction, contact the Apple Scholar team. Requests may need to be verified and handled in line with program and recordkeeping requirements.'],
        },
        {
          title: 'Contact',
          paragraphs: [`Email: ${CONTACT_EMAIL}`],
        },
      ],
    },
    tl: {
      title: 'Patakaran sa Privacy',
      intro: 'Ipinapaliwanag ng draft na ito kung paano ginagamit ng Apple Scholar portal ang impormasyong kailangan sa pamamahala ng scholarship program. Dapat itong suriin at aprubahan ng Kalinga Foundation bago ituring na opisyal na patakaran.',
      sections: [
        {
          title: 'Impormasyong nasa portal',
          paragraphs: ['Maaaring lamanin ng portal ang detalye ng account at contact (gaya ng pangalan, email, numero ng telepono, address, petsa ng kapanganakan, paaralan, at year level), mga ipinasa at in-upload na file, tala sa pag-aaral at attendance, at mga mensahe o anunsyo. Maaari ring magtala ng aktibidad sa account at pag-access sa protektadong tala para sa pangangasiwa at audit ng sistema.'],
        },
        {
          title: 'Paggamit ng impormasyon',
          paragraphs: ['Ginagamit ang impormasyon sa pamamahala ng scholarship accounts, pagtanggap at pagsusuri ng mga kinakailangan, pag-aayos ng mga aktibidad ng programa, pagsubaybay sa pag-aaral at compliance, pakikipag-ugnayan sa mga user, at pagpapanatili at pangangasiwa ng portal.'],
        },
        {
          title: 'Access at mga service provider',
          paragraphs: ['Nilalayon na ibigay ang access sa mga awtorisadong user ayon sa kanilang papel at responsibilidad sa portal. May role-based access controls at tala ng pag-access sa sensitibong datos ang portal. Maaaring iproseso ng mga hosting, database, email, o file-storage provider na nagpapatakbo ng serbisyo ang impormasyon at mga in-upload na file.'],
        },
        {
          title: 'Pag-iimbak at retention',
          paragraphs: ['Iniingatan ang mga tala ng iskolarship para sa pamamahala ng programa, pag-uulat, at pananagutan. Tinatala ng portal ang retention date ng mga in-upload na dokumento; may ilang workflow na gumagamit ng hanggang tatlong taong retention period. Dapat kumpirmahin ng Foundation ang aktuwal na iskedyul ng pag-iingat at pagbura ng mga tala.'],
        },
        {
          title: 'Mga tanong o kahilingan',
          paragraphs: ['Para sa mga tanong tungkol sa impormasyong nasa portal o kahilingang repasuhin o itama ito, makipag-ugnayan sa Apple Scholar team. Maaaring kailangang beripikahin ang kahilingan at isaalang-alang ang mga pangangailangan ng programa at pagtatala ng records.'],
        },
        {
          title: 'Makipag-ugnayan',
          paragraphs: [`Email: ${CONTACT_EMAIL}`],
        },
      ],
    },
  },
  terms: {
    en: {
      title: 'Terms of Use',
      intro: 'This draft sets basic expectations for using the Apple Scholar portal. The Kalinga Foundation should review and approve it before treating it as the official terms.',
      sections: [
        {
          title: 'Authorized use',
          paragraphs: ['Use the portal only with an account issued or approved for you, and only for scholarship-program activities within your assigned role. Do not access, change, or share records that you are not authorized to handle.'],
        },
        {
          title: 'Account security',
          paragraphs: ['Keep your password and sign-in details private. You are responsible for activity performed through your account. Notify the program team if you suspect that your account has been accessed by someone else.'],
        },
        {
          title: 'Accurate information and submissions',
          paragraphs: ['Provide current and accurate information and submit genuine documents and reports. Do not upload content that is unlawful, misleading, harmful, or unrelated to the scholarship program.'],
        },
        {
          title: 'Respectful and responsible conduct',
          paragraphs: ['Do not disrupt the portal, attempt to bypass access controls, or use another person’s account. Handle scholar information and documents carefully and share them only with people authorized to receive them.'],
        },
        {
          title: 'Portal availability and administration',
          paragraphs: ['The Foundation may update, maintain, or temporarily limit portal features to operate and protect the service. Portal access does not replace official scholarship guidelines or decisions communicated by the Foundation.'],
        },
        {
          title: 'Contact',
          paragraphs: [`Questions about these terms may be sent to ${CONTACT_EMAIL}.`],
        },
      ],
    },
    tl: {
      title: 'Mga Tuntunin sa Paggamit',
      intro: 'Itinatakda ng draft na ito ang mga batayang inaasahan sa paggamit ng Apple Scholar portal. Dapat itong suriin at aprubahan ng Kalinga Foundation bago ituring na opisyal na mga tuntunin.',
      sections: [
        {
          title: 'Awtorisadong paggamit',
          paragraphs: ['Gamitin lamang ang portal gamit ang account na ibinigay o inaprubahan para sa iyo, at para lamang sa mga gawain ng scholarship program na saklaw ng iyong itinalagang papel. Huwag i-access, baguhin, o ibahagi ang mga tala na wala kang pahintulot na pangasiwaan.'],
        },
        {
          title: 'Seguridad ng account',
          paragraphs: ['Panatilihing pribado ang iyong password at detalye sa pag-sign in. Ikaw ang responsable sa aktibidad na ginagawa gamit ang iyong account. Ipaalam sa team ng programa kung pinaghihinalaan mong may ibang gumamit nito.'],
        },
        {
          title: 'Tamang impormasyon at mga ipinapasa',
          paragraphs: ['Magbigay ng napapanahon at tamang impormasyon at magsumite ng tunay na dokumento at ulat. Huwag mag-upload ng nilalamang labag sa batas, mapanlinlang, mapanira, o walang kaugnayan sa scholarship program.'],
        },
        {
          title: 'Magalang at responsableng paggamit',
          paragraphs: ['Huwag gambalain ang portal, tangkaing lampasan ang access controls, o gumamit ng account ng ibang tao. Ingatan ang impormasyon at mga dokumento ng iskolar at ibahagi lamang ang mga ito sa mga awtorisadong tatanggap.'],
        },
        {
          title: 'Pagpapatakbo at availability ng portal',
          paragraphs: ['Maaaring mag-update, magpanatili, o pansamantalang maglimita ng mga feature ang Foundation upang mapatakbo at maprotektahan ang serbisyo. Hindi kapalit ng opisyal na scholarship guidelines o mga pasyang ipinapaalam ng Foundation ang paggamit ng portal.'],
        },
        {
          title: 'Makipag-ugnayan',
          paragraphs: [`Maaaring ipadala sa ${CONTACT_EMAIL} ang mga tanong tungkol sa mga tuntuning ito.`],
        },
      ],
    },
  },
};

const LegalInfoPage = () => {
  const { pathname } = useLocation();
  const pageKey = pathname === '/terms' ? 'terms' : 'privacy';
  const navigate = useNavigate();
  const [language] = useState(() => {
    try { return localStorage.getItem('landing-language') || 'en'; } catch { return 'en'; }
  });
  const isTl = language === 'tl';
  const content = CONTENT[pageKey][isTl ? 'tl' : 'en'];

  return (
    <div className="legal-root" style={{ ...sans, color: INK }}>
      <GlobalStyle />

      {/* ── Background: cream → blush → maroon blend (same as Login) ── */}
      <div className="legal-bg" aria-hidden="true">
        <svg viewBox="0 0 1440 900" preserveAspectRatio="none" className="bg-svg">
          <path d="M1440,0 C1260,90 1180,210 1210,360 C1240,520 1330,600 1440,640 Z" fill={PRIMARY_DEEP} opacity="0.35" />
        </svg>
      </div>

      <div className="legal-inner">
        <main className="legal-main">
          <article className="auth-card">
            {/* Logo — click to go back to the landing page */}
            <div className="card-logo-wrap">
              <button
                type="button"
                onClick={() => navigate('/')}
                aria-label="Back to Apple Scholar home"
                className="logo-link"
              >
                <img src={appleLogo} alt="Apple Scholar" className="logo-img" />
              </button>
            </div>

            <p className="auth-eyebrow">
              {isTl ? 'Kalinga Foundation · Draft para sa pagsusuri' : 'Kalinga Foundation · Draft for review'}
            </p>
            <h1 className="auth-title" style={display}>{content.title}</h1>

            <p className="intro-note">{content.intro}</p>

            <div className="sections">
              {content.sections.map((section) => (
                <section key={section.title} className="legal-section">
                  <h2 className="section-title">{section.title}</h2>
                  {section.paragraphs.map((paragraph) => (
                    <p key={paragraph} className="section-text">{paragraph}</p>
                  ))}
                </section>
              ))}
            </div>

            <a
              href={GMAIL_COMPOSE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="secure-note"
            >
              <span className="secure-chip">
                <Mail size={18} color={PRIMARY} strokeWidth={1.8} />
              </span>
              <span className="secure-text">
                <span className="secure-note-title">{isTl ? 'May katanungan?' : 'Have a question?'}</span>
                <span className="secure-note-meta">{CONTACT_EMAIL}</span>
              </span>
            </a>
          </article>

          <p className="year-note">Academic Year 2026–2027 · Scholarship Compliance Tracking System</p>
        </main>
      </div>
    </div>
  );
};

const GlobalStyle = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap');

    @keyframes card-slide-up {
      from { opacity: 0; transform: translateY(18px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    .legal-root {
      --logo-w: clamp(78px, 12vh, 110px);
      --pad-y: clamp(22px, 4vh, 38px);
      --pad-x: clamp(22px, 4vw, 44px);
      position: relative; width: 100%;
      min-height: 100vh; min-height: 100dvh;
      overflow-x: clip;
      background: linear-gradient(115deg, #FFFDF9 0%, #F6E9E1 30%, #B25A78 66%, #6D2140 84%, ${PRIMARY_DEEP} 100%);
      background-attachment: fixed;
    }
    .legal-bg { position: fixed; inset: 0; overflow: hidden; pointer-events: none; z-index: 0; }
    .bg-svg { position: absolute; inset: 0; width: 100%; height: 100%; }

    .legal-inner {
      position: relative; z-index: 1;
      min-height: 100vh; min-height: 100dvh;
      display: flex; flex-direction: column; align-items: center;
      padding: clamp(16px, 4vh, 40px) 16px clamp(20px, 4vh, 36px); box-sizing: border-box;
    }
    .legal-main { width: 100%; display: flex; flex-direction: column; align-items: center; }

    .auth-card {
      width: 100%; max-width: 760px; box-sizing: border-box;
      background: ${CARD}; border: 1px solid ${BORDER}; border-top: 3px solid ${ACCENT};
      border-radius: 22px; padding: var(--pad-y) var(--pad-x);
      box-shadow: 0 34px 70px -26px rgba(30,8,18,0.6);
      animation: card-slide-up 0.6s cubic-bezier(.16,1,.3,1) forwards;
    }

    .card-logo-wrap { display: flex; justify-content: center; margin-bottom: 14px; }
    .logo-link {
      background: none; border: none; padding: 0; margin: 0; cursor: pointer;
      display: block; line-height: 0; border-radius: 10px; transition: transform 0.2s ease;
    }
    .logo-link:hover { transform: translateY(-2px); }
    .logo-link:focus-visible { outline: 2px solid ${ACCENT}; outline-offset: 5px; }
    .logo-img { width: var(--logo-w); height: auto; display: block; object-fit: contain; }

    .secure-note:focus-visible {
      outline: 2px solid ${ACCENT}; outline-offset: 3px;
    }

    .auth-eyebrow {
      font-size: 11px; font-weight: 600; letter-spacing: 0.24em; text-transform: uppercase;
      color: ${ACCENT_DARK}; text-align: center; margin: 0 0 6px;
    }
    .auth-title {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: clamp(26px, 5vw, 36px); font-weight: 600; color: ${PRIMARY_DEEP};
      text-align: center; margin: 0 0 18px; line-height: 1.15;
    }

    .intro-note {
      margin: 0 0 24px; padding: 14px 18px; border-radius: 14px; background: ${SAND};
      border-left: 3px solid ${ACCENT}; font-size: 0.86rem; line-height: 1.7; color: ${INK_SOFT};
    }

    .sections { display: flex; flex-direction: column; gap: 22px; }
    .legal-section { padding-left: 16px; border-left: 1px solid ${BORDER}; }
    .section-title {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 1.12rem; font-weight: 600; color: ${PRIMARY_DEEP}; margin: 0 0 6px; line-height: 1.3;
    }
    .section-text { font-size: 0.88rem; line-height: 1.75; color: ${INK_SOFT}; margin: 0; max-width: 68ch; }

    .secure-note {
      display: flex; align-items: center; gap: 12px; text-decoration: none;
      margin-top: 28px; padding: 11px 14px; border-radius: 14px; background: ${SAND};
      transition: background 0.2s ease;
    }
    .secure-note:hover { background: #F6E7D6; }
    .secure-chip {
      width: 36px; height: 36px; border-radius: 50%; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center; background: rgba(185,139,78,0.22);
    }
    .secure-text { display: flex; flex-direction: column; min-width: 0; }
    .secure-note-title { font-size: 0.86rem; font-weight: 700; color: ${PRIMARY_DEEP}; }
    .secure-note-meta { font-size: 0.78rem; color: ${INK_SOFT}; margin-top: 2px; overflow-wrap: anywhere; }

    .year-note {
      font-size: 0.74rem; font-weight: 600; color: #FFFDF9; text-align: center;
      margin: 18px 0 0; line-height: 1.5;
    }

    @media (max-width: 639px) {
      .legal-root {
        background: linear-gradient(170deg, #FFFDF9 0%, #F6E9E1 28%, #B25A78 62%, ${PRIMARY} 85%, ${PRIMARY_DEEP} 100%);
        background-attachment: fixed;
      }
      .legal-section { padding-left: 12px; }
    }

    @media (prefers-reduced-motion: reduce) {
      .auth-card { animation: none; }
      .logo-link, .secure-note { transition: none; }
    }
  `}</style>
);

export default LegalInfoPage;