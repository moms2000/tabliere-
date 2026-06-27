import { createContext, useContext, useState } from "react";

const TRANSLATIONS = {
  fr: {
    // Nav
    nav_restaurants: "Restaurants",
    nav_experiences: "Expériences",
    nav_pros: "Pour les pros",
    nav_login: "Connexion",
    nav_register: "+ Inscription",
    nav_profile: "Mon profil",
    nav_logout: "Déconnexion",
    // Home
    hero_title: "Réservez votre table en Côte d'Ivoire",
    hero_sub: "Abidjan · Yamoussoukro · Bouaké · et toute la Côte d'Ivoire",
    search_placeholder: "Restaurant, cuisine, quartier...",
    search_btn: "Trouver",
    // Profil tabs
    tab_profile: "Mon profil",
    tab_reservations: "Réservations",
    tab_rewards: "Rewards",
    tab_saved: "Restaurants sauvegardés",
    // Profil page
    profile_title: "Mon compte",
    profile_photo: "Photo de profil",
    profile_change_photo: "Changer la photo",
    profile_name: "Nom complet",
    profile_email: "Adresse e-mail",
    profile_phone: "WhatsApp",
    profile_save: "Enregistrer",
    profile_contact: "Contacter l'équipe TablièreCI",
    profile_contact_desc: "Une question ? Écrivez-nous sur WhatsApp ou par email.",
    // Rewards
    rewards_title: "Programme de fidélité",
    rewards_points: "Points accumulés",
    rewards_level: "Niveau",
    rewards_next: "Prochain niveau",
    // Saved
    saved_title: "Restaurants favoris",
    saved_empty: "Aucun restaurant sauvegardé",
    saved_empty_sub: "Cliquez sur ♡ sur la fiche d'un restaurant pour l'ajouter ici.",
    // Reservations
    reserv_title: "Mes réservations",
    reserv_empty: "Aucune réservation pour l'instant",
    reserv_empty_sub: "Trouvez un restaurant et réservez votre table.",
    // General
    loading: "Chargement…",
    lang_label: "Langue",
  },
  en: {
    nav_restaurants: "Restaurants",
    nav_experiences: "Experiences",
    nav_pros: "For businesses",
    nav_login: "Sign in",
    nav_register: "+ Sign up",
    nav_profile: "My profile",
    nav_logout: "Sign out",
    hero_title: "Book your table in Côte d'Ivoire",
    hero_sub: "Abidjan · Yamoussoukro · Bouaké · and all of Ivory Coast",
    search_placeholder: "Restaurant, cuisine, neighbourhood...",
    search_btn: "Find",
    tab_profile: "My profile",
    tab_reservations: "Bookings",
    tab_rewards: "Rewards",
    tab_saved: "Saved restaurants",
    profile_title: "My account",
    profile_photo: "Profile photo",
    profile_change_photo: "Change photo",
    profile_name: "Full name",
    profile_email: "Email address",
    profile_phone: "WhatsApp",
    profile_save: "Save changes",
    profile_contact: "Contact TablièreCI team",
    profile_contact_desc: "Have a question? Reach us on WhatsApp or by email.",
    rewards_title: "Loyalty programme",
    rewards_points: "Points earned",
    rewards_level: "Level",
    rewards_next: "Next level",
    saved_title: "Favourite restaurants",
    saved_empty: "No saved restaurants yet",
    saved_empty_sub: "Tap ♡ on a restaurant page to save it here.",
    reserv_title: "My bookings",
    reserv_empty: "No bookings yet",
    reserv_empty_sub: "Find a restaurant and book your table.",
    loading: "Loading…",
    lang_label: "Language",
  },
  ar: {
    nav_restaurants: "المطاعم",
    nav_experiences: "التجارب",
    nav_pros: "للمهنيين",
    nav_login: "تسجيل الدخول",
    nav_register: "+ إنشاء حساب",
    nav_profile: "ملفي الشخصي",
    nav_logout: "تسجيل الخروج",
    hero_title: "احجز طاولتك في كوت ديفوار",
    hero_sub: "أبيدجان · ياموسوكرو · بواكي · وسائر أرجاء كوت ديفوار",
    search_placeholder: "مطعم، مطبخ، حي...",
    search_btn: "بحث",
    tab_profile: "ملفي الشخصي",
    tab_reservations: "الحجوزات",
    tab_rewards: "المكافآت",
    tab_saved: "المطاعم المحفوظة",
    profile_title: "حسابي",
    profile_photo: "صورة الملف الشخصي",
    profile_change_photo: "تغيير الصورة",
    profile_name: "الاسم الكامل",
    profile_email: "البريد الإلكتروني",
    profile_phone: "واتساب",
    profile_save: "حفظ التغييرات",
    profile_contact: "التواصل مع فريق TablièreCI",
    profile_contact_desc: "هل لديك سؤال؟ راسلنا عبر واتساب أو البريد الإلكتروني.",
    rewards_title: "برنامج الولاء",
    rewards_points: "النقاط المكتسبة",
    rewards_level: "المستوى",
    rewards_next: "المستوى التالي",
    saved_title: "المطاعم المفضلة",
    saved_empty: "لا توجد مطاعم محفوظة",
    saved_empty_sub: "انقر على ♡ في صفحة أي مطعم لحفظه هنا.",
    reserv_title: "حجوزاتي",
    reserv_empty: "لا توجد حجوزات بعد",
    reserv_empty_sub: "ابحث عن مطعم واحجز طاولتك.",
    loading: "جارٍ التحميل…",
    lang_label: "اللغة",
  },
};

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem("tci_lang") || "fr");

  const t = (key) => TRANSLATIONS[lang]?.[key] ?? TRANSLATIONS.fr[key] ?? key;

  const changeLang = (l) => {
    setLang(l);
    localStorage.setItem("tci_lang", l);
    document.documentElement.dir = l === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = l;
  };

  // Apply direction on mount
  if (typeof document !== "undefined") {
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = lang;
  }

  return (
    <LanguageContext.Provider value={{ lang, t, changeLang, langs: ["fr", "en", "ar"] }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLang must be used inside <LanguageProvider>");
  return ctx;
}
