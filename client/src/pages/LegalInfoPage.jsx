import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Globe } from 'lucide-react';

const CONTACT_EMAIL = 'applescholar.official@gmail.com';

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
  const { pathname } = window.location;
  const pageKey = pathname === '/terms' ? 'terms' : 'privacy';
  const navigate = useNavigate();
  const [language, setLanguage] = useState(() => localStorage.getItem('landing-language') || 'en');
  const content = CONTENT[pageKey][language === 'tl' ? 'tl' : 'en'];

  const changeLanguage = (event) => {
    const nextLanguage = event.target.value;
    setLanguage(nextLanguage);
    localStorage.setItem('landing-language', nextLanguage);
  };

  return (
    <main className="min-h-screen px-4 py-8 sm:px-6 lg:py-12" style={{ background: '#F7F4EE', color: '#241512', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <article className="mx-auto max-w-3xl rounded-3xl border p-6 shadow-sm sm:p-10" style={{ background: '#FFFDF9', borderColor: '#E7D8C7' }}>
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <button type="button" onClick={() => navigate('/')} className="inline-flex items-center gap-2 text-sm font-semibold hover:underline" style={{ color: '#6D2140' }}>
            <ArrowLeft size={16} /> {language === 'tl' ? 'Bumalik sa tahanan' : 'Back to home'}
          </button>
          <label className="inline-flex items-center gap-2 text-sm" style={{ color: '#5C4E42' }}>
            <Globe size={15} />
            <select value={language} onChange={changeLanguage} aria-label="Language / Wika" className="rounded-lg border bg-transparent px-2 py-1.5" style={{ borderColor: '#E7D8C7' }}>
              <option value="en">English</option>
              <option value="tl">Tagalog</option>
            </select>
          </label>
        </div>

        <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em]" style={{ color: '#8A5E38' }}>
          {language === 'tl' ? 'Apple Scholar Program · Draft para sa pagsusuri' : 'Apple Scholar Program · Draft for review'}
        </p>
        <h1 className="mb-4 text-3xl font-bold sm:text-4xl" style={{ color: '#4A1730', fontFamily: "'Playfair Display', Georgia, serif" }}>{content.title}</h1>
        <p className="mb-8 text-sm leading-7" style={{ color: '#5C4E42' }}>{content.intro}</p>

        <div className="space-y-7">
          {content.sections.map((section) => (
            <section key={section.title}>
              <h2 className="mb-2 text-lg font-bold" style={{ color: '#4A1730' }}>{section.title}</h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph} className="text-sm leading-7" style={{ color: '#5C4E42' }}>{paragraph}</p>
              ))}
            </section>
          ))}
        </div>
      </article>
    </main>
  );
};

export default LegalInfoPage;
