import { createContext, useContext, useState, useEffect, useMemo, useCallback } from "react";

const TRANSLATIONS = {
  fr: {
    // ── Nav ─────────────────────────────────────────────────────────────────
    nav_restaurants:  "Restaurants",
    nav_experiences:  "Expériences",
    nav_how:          "Comment ça marche",
    nav_login:        "Connexion",
    nav_register:     "+ Inscription",
    nav_profile:      "Mon profil",
    nav_reservations: "Mes réservations",
    nav_logout:       "Déconnexion",

    // ── Hero ─────────────────────────────────────────────────────────────────
    hero_title:       "Réservez votre table en Côte d'Ivoire",
    hero_title_1:     "La table parfaite,",
    hero_title_2:     "à portée de main.",
    hero_live:        "tables disponibles ce soir · Abidjan",
    hero_sub:         "Les meilleures adresses de Côte d'Ivoire. Confirmation immédiate, zéro frais.",
    search_placeholder: "Restaurant, cuisine, quartier...",
    search_btn:       "Trouver",
    filter_date:      "Date",
    filter_time:      "Heure",
    filter_guests:    "Personnes",

    // ── Tabs filtre ──────────────────────────────────────────────────────────
    tab_all:          "Tous",
    tab_gastro:       "Gastronomique",
    tab_ivoirian:     "Cuisine ivoirienne",
    tab_brunch:       "Brunch",
    tab_terrace:      "Terrasse",
    tab_livemusic:    "Live musique",

    // ── Résultats ────────────────────────────────────────────────────────────
    results_label:    "Résultats — Abidjan",
    results_count_0:  "Aucun restaurant disponible",
    results_count:    "{n} restaurant{s} disponible{s}",
    sort_rating:      "Meilleure note",
    sort_reviews:     "Plus d'avis",
    sort_recent:      "Récents",
    no_resto_title:   "Aucun restaurant trouvé",
    no_resto_search:  "Essayez un autre terme de recherche",
    no_resto_empty:   "Aucun restaurant disponible pour le moment.",
    see_slots:        "Voir les créneaux →",
    new_resto:        "Nouveau",
    reviews:          "avis",

    // ── Filtres ───────────────────────────────────────────────────────────────
    filter_cuisine:   "Type de cuisine",
    filter_specs:     "Spécificités",
    cuisine_ivoirian:     "Ivoirienne",
    cuisine_french:       "Française",
    cuisine_lebanese:     "Libanaise",
    cuisine_senegalese:   "Sénégalaise",
    cuisine_international:"Internationale",
    spec_terrace:     "Terrasse",
    spec_livemusic:   "Live music",
    spec_halal:       "Halal",
    spec_privatizable:"Privatisable",
    spec_wifi:        "Wifi",

    // ── Expériences ───────────────────────────────────────────────────────────
    exp_title:        "Expériences à ne pas manquer",
    exp_jazz_name:    "Dîner live jazz",
    exp_jazz_sub:     "Vendredi & samedi soir",
    exp_brunch_name:  "Brunch du dimanche",
    exp_brunch_sub:   "Tables en bord de lagune",
    exp_event_name:   "Privatisation",
    exp_event_sub:    "Anniversaire & évènements",
    exp_feast_name:   "Menu spécial fête",
    exp_feast_sub:    "Tabaski · Noël · Nouvel An",

    // ── Comment ça marche ─────────────────────────────────────────────────────
    how_title:        "Comment ça marche",
    how_1_title:      "Choisissez votre restaurant",
    how_1_desc:       "Parcourez notre sélection de restaurants vérifiés à Abidjan et partout en Côte d'Ivoire.",
    how_2_title:      "Réservez en 30 secondes",
    how_2_desc:       "Sélectionnez votre date, l'heure et le nombre de couverts. La confirmation est immédiate.",
    how_3_title:      "Profitez de l'expérience",
    how_3_desc:       "Gagnez des points de fidélité à chaque réservation et accédez à des offres exclusives.",

    // ── Profil tabs ───────────────────────────────────────────────────────────
    tab_profile:      "Mon profil",
    tab_reservations: "Réservations",
    tab_bookings:     "Réservations",
    tab_rewards:      "Rewards",
    tab_saved:        "Favoris",

    // ── Profil page ───────────────────────────────────────────────────────────
    profile_title:         "Mon compte",
    profile_photo:         "Photo de profil",
    profile_change_photo:  "Changer la photo",
    profile_firstname:     "Prénom",
    profile_lastname:      "Nom",
    profile_name:          "Nom complet",
    profile_email:         "Adresse e-mail",
    profile_phone:         "WhatsApp",
    profile_dob:           "Date de naissance",
    profile_save:          "Enregistrer",
    profile_contact:       "Contacter l'équipe TablièreCI",
    profile_contact_desc:  "Une question ? Écrivez-nous sur WhatsApp ou par email.",

    // ── Rewards ───────────────────────────────────────────────────────────────
    rewards_title:  "Programme de fidélité",
    rewards_points: "Points accumulés",
    rewards_level:  "Niveau",
    rewards_next:   "Prochain niveau",

    // ── Saved ─────────────────────────────────────────────────────────────────
    saved_title:     "Restaurants favoris",
    saved_empty:     "Aucun restaurant sauvegardé",
    saved_empty_sub: "Cliquez sur le cœur sur la fiche d'un restaurant pour l'ajouter ici.",

    // ── Reservations ──────────────────────────────────────────────────────────
    reserv_title:     "Mes réservations",
    reserv_empty:     "Aucune réservation pour l'instant",
    reserv_empty_sub: "Trouvez un restaurant et réservez votre table.",

    // ── Inscription ───────────────────────────────────────────────────────────
    reg_title:          "Créer un compte",
    reg_subtitle:       "Vous êtes ...",
    reg_client_title:   "Je suis un client",
    reg_client_desc:    "Je veux réserver des tables dans des restaurants",
    reg_resto_title:    "Je suis restaurateur",
    reg_resto_desc:     "Je veux gérer les réservations de mon restaurant",
    reg_step2_client:   "Votre compte client",
    reg_step2_resto:    "Votre restaurant",
    reg_step_of:        "Étape 2 sur 2",
    reg_firstname:      "Prénom",
    reg_lastname:       "Nom",
    reg_email:          "Adresse e-mail",
    reg_dob:            "Date de naissance",
    reg_phone:          "Numéro WhatsApp",
    reg_country:        "Pays",
    reg_password:       "Mot de passe",
    reg_pw_placeholder: "8 caractères min., lettres + chiffres",
    reg_resto_name:     "Nom du restaurant",
    reg_terms:          "J'accepte les",
    reg_terms_link:     "Conditions Générales d'Utilisation",
    reg_terms_and:      "et la",
    reg_terms_privacy:  "Politique de confidentialité",
    reg_submit:         "Créer mon compte",
    reg_loading:        "Création en cours...",
    reg_already:        "Déjà inscrit ?",
    reg_login:          "Se connecter",
    reg_back:           "Retour",
    reg_prev:           "Étape précédente",
    reg_success_title:  "Compte créé !",
    reg_success_client: "Bienvenue sur TablièreCI. Vous pouvez maintenant réserver votre table.",
    reg_success_resto:  "Votre demande a été envoyée. Un manager vous contactera sous 24h via WhatsApp.",
    reg_success_client_btn: "Découvrir les restaurants",
    reg_success_resto_btn:  "Accéder à mon espace",

    // ── Erreurs inscription ───────────────────────────────────────────────────
    err_email_taken:    "Cet email est déjà utilisé. Connectez-vous ou utilisez un autre email.",
    err_bad_data:       "Vérifiez les informations saisies.",
    err_generic:        "Une erreur est survenue. Réessayez.",
    err_age:            "Vous devez avoir au moins 14 ans pour vous inscrire.",
    err_phone_format:   "Le format du numéro ne correspond pas à l'indicatif sélectionné.",
    err_password_weak:  "Le mot de passe doit contenir des lettres et des chiffres (8 caractères min.).",
    err_terms:          "Vous devez accepter les conditions générales pour continuer.",

    // ── Force mot de passe ───────────────────────────────────────────────────
    pw_strength_0: "",
    pw_strength_1: "Très faible",
    pw_strength_2: "Faible",
    pw_strength_3: "Moyen",
    pw_strength_4: "Fort",
    pw_strength_5: "Très fort",

    // ── Général ───────────────────────────────────────────────────────────────
    loading:    "Chargement…",
    lang_label: "Langue",
  },

  // ─────────────────────────────── ENGLISH ───────────────────────────────────
  en: {
    nav_restaurants:  "Restaurants",
    nav_experiences:  "Experiences",
    nav_how:          "How it works",
    nav_login:        "Sign in",
    nav_register:     "+ Sign up",
    nav_profile:      "My profile",
    nav_reservations: "My bookings",
    nav_logout:       "Sign out",

    hero_title:         "Book your table in Côte d'Ivoire",
    hero_title_1:       "The perfect table,",
    hero_title_2:       "right at your fingertips.",
    hero_live:          "tables available tonight · Abidjan",
    hero_sub:           "Ivory Coast's best restaurants. Instant confirmation, zero fees.",
    search_placeholder: "Restaurant, cuisine, neighbourhood...",
    filter_date:        "Date",
    filter_time:        "Time",
    filter_guests:      "Guests",
    search_btn:         "Find",

    tab_all:       "All",
    tab_gastro:    "Gastronomic",
    tab_ivoirian:  "Ivorian cuisine",
    tab_brunch:    "Brunch",
    tab_terrace:   "Terrace",
    tab_livemusic: "Live music",

    results_label:   "Results — Abidjan",
    results_count_0: "No restaurants available",
    results_count:   "{n} restaurant{s} available",
    sort_rating:     "Top rated",
    sort_reviews:    "Most reviewed",
    sort_recent:     "Newest",
    no_resto_title:  "No restaurants found",
    no_resto_search: "Try a different search term",
    no_resto_empty:  "No restaurants available at the moment.",
    see_slots:       "See availability →",
    new_resto:       "New",
    reviews:         "reviews",

    filter_cuisine:       "Cuisine type",
    filter_specs:         "Features",
    cuisine_ivoirian:     "Ivorian",
    cuisine_french:       "French",
    cuisine_lebanese:     "Lebanese",
    cuisine_senegalese:   "Senegalese",
    cuisine_international:"International",
    spec_terrace:     "Terrace",
    spec_livemusic:   "Live music",
    spec_halal:       "Halal",
    spec_privatizable:"Private hire",
    spec_wifi:        "Wifi",

    exp_title:       "Experiences not to miss",
    exp_jazz_name:   "Live jazz dinner",
    exp_jazz_sub:    "Friday & Saturday evenings",
    exp_brunch_name: "Sunday brunch",
    exp_brunch_sub:  "Tables by the lagoon",
    exp_event_name:  "Private hire",
    exp_event_sub:   "Birthdays & events",
    exp_feast_name:  "Special feast menu",
    exp_feast_sub:   "Eid · Christmas · New Year",

    how_title:   "How it works",
    how_1_title: "Choose your restaurant",
    how_1_desc:  "Browse our selection of verified restaurants in Abidjan and across Côte d'Ivoire.",
    how_2_title: "Book in 30 seconds",
    how_2_desc:  "Select your date, time, and party size. Confirmation is instant.",
    how_3_title: "Enjoy the experience",
    how_3_desc:  "Earn loyalty points with every booking and unlock exclusive offers.",

    tab_profile:  "My profile",
    tab_reservations: "Bookings",
    tab_bookings: "Bookings",
    tab_rewards:  "Rewards",
    tab_saved:    "Saved",

    profile_title:        "My account",
    profile_photo:        "Profile photo",
    profile_change_photo: "Change photo",
    profile_firstname:    "First name",
    profile_lastname:     "Last name",
    profile_name:         "Full name",
    profile_email:        "Email address",
    profile_phone:        "WhatsApp",
    profile_dob:          "Date of birth",
    profile_save:         "Save changes",
    profile_contact:      "Contact TablièreCI team",
    profile_contact_desc: "Have a question? Reach us on WhatsApp or by email.",

    rewards_title:  "Loyalty programme",
    rewards_points: "Points earned",
    rewards_level:  "Level",
    rewards_next:   "Next level",

    saved_title:     "Favourite restaurants",
    saved_empty:     "No saved restaurants yet",
    saved_empty_sub: "Tap the heart on a restaurant page to save it here.",

    reserv_title:     "My bookings",
    reserv_empty:     "No bookings yet",
    reserv_empty_sub: "Find a restaurant and book your table.",

    reg_title:          "Create an account",
    reg_subtitle:       "I am a ...",
    reg_client_title:   "I am a customer",
    reg_client_desc:    "I want to book tables at restaurants",
    reg_resto_title:    "I am a restaurant owner",
    reg_resto_desc:     "I want to manage reservations for my restaurant",
    reg_step2_client:   "Your customer account",
    reg_step2_resto:    "Your restaurant",
    reg_step_of:        "Step 2 of 2",
    reg_firstname:      "First name",
    reg_lastname:       "Last name",
    reg_email:          "Email address",
    reg_dob:            "Date of birth",
    reg_phone:          "WhatsApp number",
    reg_country:        "Country",
    reg_password:       "Password",
    reg_pw_placeholder: "8+ characters, letters & numbers",
    reg_resto_name:     "Restaurant name",
    reg_terms:          "I accept the",
    reg_terms_link:     "Terms & Conditions",
    reg_terms_and:      "and the",
    reg_terms_privacy:  "Privacy Policy",
    reg_submit:         "Create my account",
    reg_loading:        "Creating account...",
    reg_already:        "Already have an account?",
    reg_login:          "Sign in",
    reg_back:           "Back",
    reg_prev:           "Previous step",
    reg_success_title:  "Account created!",
    reg_success_client: "Welcome to TablièreCI. You can now book your table.",
    reg_success_resto:  "Your request has been sent. A manager will contact you within 24h via WhatsApp.",
    reg_success_client_btn: "Discover restaurants",
    reg_success_resto_btn:  "Go to my dashboard",

    err_email_taken:   "This email is already in use. Sign in or use a different email.",
    err_bad_data:      "Please check the information you entered.",
    err_generic:       "An error occurred. Please try again.",
    err_age:           "You must be at least 14 years old to register.",
    err_phone_format:  "The phone number format does not match the selected country code.",
    err_password_weak: "Password must contain letters and numbers (8 characters min.).",
    err_terms:         "You must accept the terms and conditions to continue.",

    pw_strength_0: "",
    pw_strength_1: "Very weak",
    pw_strength_2: "Weak",
    pw_strength_3: "Fair",
    pw_strength_4: "Strong",
    pw_strength_5: "Very strong",

    loading:    "Loading…",
    lang_label: "Language",
  },

  // ─────────────────────────────── ARABIC ────────────────────────────────────
  ar: {
    nav_restaurants:  "المطاعم",
    nav_experiences:  "التجارب",
    nav_how:          "كيف يعمل",
    nav_login:        "تسجيل الدخول",
    nav_register:     "+ إنشاء حساب",
    nav_profile:      "ملفي الشخصي",
    nav_reservations: "حجوزاتي",
    nav_logout:       "تسجيل الخروج",

    hero_title:         "احجز طاولتك في كوت ديفوار",
    hero_title_1:       "الطاولة المثالية،",
    hero_title_2:       "في متناول يدك.",
    hero_live:          "طاولة متاحة الليلة · أبيدجان",
    hero_sub:           "أفضل مطاعم كوت ديفوار. تأكيد فوري، بدون رسوم.",
    search_placeholder: "مطعم، مطبخ، حي...",
    filter_date:        "التاريخ",
    filter_time:        "الوقت",
    filter_guests:      "الأشخاص",
    search_btn:         "بحث",

    tab_all:       "الكل",
    tab_gastro:    "غاسترونومي",
    tab_ivoirian:  "المطبخ الإيفواري",
    tab_brunch:    "برانش",
    tab_terrace:   "تراس",
    tab_livemusic: "موسيقى حية",

    results_label:   "النتائج — أبيدجان",
    results_count_0: "لا توجد مطاعم متاحة",
    results_count:   "{n} مطعم متاح",
    sort_rating:     "الأعلى تقييماً",
    sort_reviews:    "الأكثر مراجعات",
    sort_recent:     "الأحدث",
    no_resto_title:  "لم يتم العثور على مطاعم",
    no_resto_search: "جرب كلمة بحث مختلفة",
    no_resto_empty:  "لا توجد مطاعم متاحة في الوقت الحالي.",
    see_slots:       "عرض المواعيد ←",
    new_resto:       "جديد",
    reviews:         "مراجعة",

    filter_cuisine:       "نوع المطبخ",
    filter_specs:         "المميزات",
    cuisine_ivoirian:     "إيفواري",
    cuisine_french:       "فرنسي",
    cuisine_lebanese:     "لبناني",
    cuisine_senegalese:   "سنغالي",
    cuisine_international:"دولي",
    spec_terrace:     "تراس",
    spec_livemusic:   "موسيقى حية",
    spec_halal:       "حلال",
    spec_privatizable:"للاستئجار الخاص",
    spec_wifi:        "واي فاي",

    exp_title:       "تجارب لا تفوتك",
    exp_jazz_name:   "عشاء جاز حي",
    exp_jazz_sub:    "مساء الجمعة والسبت",
    exp_brunch_name: "برانش الأحد",
    exp_brunch_sub:  "طاولات بجانب البحيرة",
    exp_event_name:  "حجز خاص",
    exp_event_sub:   "أعياد ميلاد وفعاليات",
    exp_feast_name:  "قائمة طعام المناسبات",
    exp_feast_sub:   "عيد الأضحى · عيد الميلاد · رأس السنة",

    how_title:   "كيف يعمل",
    how_1_title: "اختر مطعمك",
    how_1_desc:  "تصفح مجموعتنا من المطاعم الموثّقة في أبيدجان وسائر أنحاء كوت ديفوار.",
    how_2_title: "احجز خلال 30 ثانية",
    how_2_desc:  "اختر التاريخ والوقت وعدد الأشخاص. التأكيد فوري.",
    how_3_title: "استمتع بالتجربة",
    how_3_desc:  "اكسب نقاط ولاء مع كل حجز وانتفع بعروض حصرية.",

    tab_profile:  "ملفي الشخصي",
    tab_reservations: "الحجوزات",
    tab_bookings: "الحجوزات",
    tab_rewards:  "المكافآت",
    tab_saved:    "المحفوظة",

    profile_title:        "حسابي",
    profile_photo:        "صورة الملف الشخصي",
    profile_change_photo: "تغيير الصورة",
    profile_firstname:    "الاسم الأول",
    profile_lastname:     "اسم العائلة",
    profile_name:         "الاسم الكامل",
    profile_email:        "البريد الإلكتروني",
    profile_phone:        "واتساب",
    profile_dob:          "تاريخ الميلاد",
    profile_save:         "حفظ التغييرات",
    profile_contact:      "التواصل مع فريق TablièreCI",
    profile_contact_desc: "هل لديك سؤال؟ راسلنا عبر واتساب أو البريد الإلكتروني.",

    rewards_title:  "برنامج الولاء",
    rewards_points: "النقاط المكتسبة",
    rewards_level:  "المستوى",
    rewards_next:   "المستوى التالي",

    saved_title:     "المطاعم المفضلة",
    saved_empty:     "لا توجد مطاعم محفوظة",
    saved_empty_sub: "انقر على القلب في صفحة أي مطعم لحفظه هنا.",

    reserv_title:     "حجوزاتي",
    reserv_empty:     "لا توجد حجوزات بعد",
    reserv_empty_sub: "ابحث عن مطعم واحجز طاولتك.",

    reg_title:          "إنشاء حساب",
    reg_subtitle:       "أنا ...",
    reg_client_title:   "أنا زبون",
    reg_client_desc:    "أريد حجز طاولات في المطاعم",
    reg_resto_title:    "أنا صاحب مطعم",
    reg_resto_desc:     "أريد إدارة حجوزات مطعمي",
    reg_step2_client:   "حسابك كزبون",
    reg_step2_resto:    "بيانات مطعمك",
    reg_step_of:        "الخطوة 2 من 2",
    reg_firstname:      "الاسم الأول",
    reg_lastname:       "اسم العائلة",
    reg_email:          "البريد الإلكتروني",
    reg_dob:            "تاريخ الميلاد",
    reg_phone:          "رقم واتساب",
    reg_country:        "الدولة",
    reg_password:       "كلمة المرور",
    reg_pw_placeholder: "8 أحرف على الأقل، أحرف وأرقام",
    reg_resto_name:     "اسم المطعم",
    reg_terms:          "أوافق على",
    reg_terms_link:     "شروط الاستخدام",
    reg_terms_and:      "و",
    reg_terms_privacy:  "سياسة الخصوصية",
    reg_submit:         "إنشاء حسابي",
    reg_loading:        "جارٍ الإنشاء...",
    reg_already:        "لديك حساب بالفعل؟",
    reg_login:          "تسجيل الدخول",
    reg_back:           "رجوع",
    reg_prev:           "الخطوة السابقة",
    reg_success_title:  "تم إنشاء الحساب!",
    reg_success_client: "مرحباً بك في TablièreCI. يمكنك الآن حجز طاولتك.",
    reg_success_resto:  "تم إرسال طلبك. سيتواصل معك مدير خلال 24 ساعة عبر واتساب.",
    reg_success_client_btn: "اكتشف المطاعم",
    reg_success_resto_btn:  "الذهاب إلى لوحتي",

    err_email_taken:   "هذا البريد مستخدم بالفعل. سجّل دخولك أو استخدم بريداً آخر.",
    err_bad_data:      "يرجى التحقق من المعلومات المدخلة.",
    err_generic:       "حدث خطأ. يرجى المحاولة مجدداً.",
    err_age:           "يجب أن يكون عمرك 14 عاماً على الأقل للتسجيل.",
    err_phone_format:  "صيغة رقم الهاتف لا تتوافق مع الرمز الدولي المختار.",
    err_password_weak: "يجب أن تحتوي كلمة المرور على أحرف وأرقام (8 أحرف على الأقل).",
    err_terms:         "يجب أن توافق على شروط الاستخدام للمتابعة.",

    pw_strength_0: "",
    pw_strength_1: "ضعيفة جداً",
    pw_strength_2: "ضعيفة",
    pw_strength_3: "متوسطة",
    pw_strength_4: "قوية",
    pw_strength_5: "قوية جداً",

    loading:    "جارٍ التحميل…",
    lang_label: "اللغة",
  },
};

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem("tci_lang") || "fr");

  const t = useCallback(
    (key) => TRANSLATIONS[lang]?.[key] ?? TRANSLATIONS.fr[key] ?? key,
    [lang]
  );

  const changeLang = useCallback((l) => {
    setLang(l);
    localStorage.setItem("tci_lang", l);
  }, []);

  // Effet de bord DOM déplacé hors du rendu (anti-pattern) → useEffect idempotent
  useEffect(() => {
    document.documentElement.dir  = lang === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = lang;
  }, [lang]);

  const value = useMemo(
    () => ({ lang, t, changeLang, langs: ["fr", "en", "ar"] }),
    [lang, t, changeLang]
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLang must be used inside <LanguageProvider>");
  return ctx;
}
