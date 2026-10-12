export type Lang = 'en' | 'hi' | 'te';

export const SUPPORTED_LANGS: Lang[] = ['en', 'hi', 'te'];
export const DEFAULT_LANG: Lang = 'en';

export const LANG_LABELS: Record<Lang, string> = {
  en: 'English',
  hi: 'हिंदी',
  te: 'తెలుగు',
};

export type TranslationKey =
  | 'discover'
  | 'search_placeholder'
  | 'nearby_stores'
  | 'trending_products'
  | 'view_all'
  | 'open_now'
  | 'closed'
  | 'follow'
  | 'following'
  | 'book_now'
  | 'add_to_cart'
  | 'login'
  | 'logout'
  | 'my_profile'
  | 'my_orders'
  | 'wishlist'
  | 'notifications'
  | 'store_not_found'
  | 'product_not_found'
  | 'no_results'
  | 'loading'
  | 'error_generic'
  | 'save'
  | 'cancel'
  | 'delete'
  | 'edit'
  | 'submit'
  | 'back'
  | 'next'
  | 'done'
  | 'share'
  | 'report';

type Translations = Record<TranslationKey, string>;

export const translations: Record<Lang, Translations> = {
  en: {
    discover:           'Discover',
    search_placeholder: 'Search stores, products…',
    nearby_stores:      'Nearby Stores',
    trending_products:  'Trending Products',
    view_all:           'View All',
    open_now:           'Open Now',
    closed:             'Closed',
    follow:             'Follow',
    following:          'Following',
    book_now:           'Book Now',
    add_to_cart:        'Add to Cart',
    login:              'Login',
    logout:             'Logout',
    my_profile:         'My Profile',
    my_orders:          'My Orders',
    wishlist:           'Wishlist',
    notifications:      'Notifications',
    store_not_found:    'Store not found',
    product_not_found:  'Product not found',
    no_results:         'No results found',
    loading:            'Loading…',
    error_generic:      'Something went wrong',
    save:               'Save',
    cancel:             'Cancel',
    delete:             'Delete',
    edit:               'Edit',
    submit:             'Submit',
    back:               'Back',
    next:               'Next',
    done:               'Done',
    share:              'Share',
    report:             'Report',
  },
  hi: {
    discover:           'खोजें',
    search_placeholder: 'दुकानें, उत्पाद खोजें…',
    nearby_stores:      'पास की दुकानें',
    trending_products:  'ट्रेंडिंग उत्पाद',
    view_all:           'सभी देखें',
    open_now:           'अभी खुली है',
    closed:             'बंद',
    follow:             'फॉलो करें',
    following:          'फॉलो कर रहे हैं',
    book_now:           'अभी बुक करें',
    add_to_cart:        'कार्ट में जोड़ें',
    login:              'लॉगिन',
    logout:             'लॉगआउट',
    my_profile:         'मेरी प्रोफ़ाइल',
    my_orders:          'मेरे ऑर्डर',
    wishlist:           'विशलिस्ट',
    notifications:      'सूचनाएं',
    store_not_found:    'दुकान नहीं मिली',
    product_not_found:  'उत्पाद नहीं मिला',
    no_results:         'कोई परिणाम नहीं मिला',
    loading:            'लोड हो रहा है…',
    error_generic:      'कुछ गलत हो गया',
    save:               'सहेजें',
    cancel:             'रद्द करें',
    delete:             'हटाएं',
    edit:               'संपादित करें',
    submit:             'जमा करें',
    back:               'वापस',
    next:               'अगला',
    done:               'हो गया',
    share:              'शेयर करें',
    report:             'रिपोर्ट करें',
  },
  te: {
    discover:           'కనుగొనండి',
    search_placeholder: 'దుకాణాలు, ఉత్పత్తులు వెతకండి…',
    nearby_stores:      'దగ్గరిలోని దుకాణాలు',
    trending_products:  'ట్రెండింగ్ ఉత్పత్తులు',
    view_all:           'అన్నీ చూడండి',
    open_now:           'ఇప్పుడు తెరిచి ఉంది',
    closed:             'మూసివేయబడింది',
    follow:             'అనుసరించండి',
    following:          'అనుసరిస్తున్నారు',
    book_now:           'ఇప్పుడు బుక్ చేయండి',
    add_to_cart:        'కార్ట్‌కు జోడించండి',
    login:              'లాగిన్',
    logout:             'లాగ్‌అవుట్',
    my_profile:         'నా ప్రొఫైల్',
    my_orders:          'నా ఆర్డర్లు',
    wishlist:           'విష్‌లిస్ట్',
    notifications:      'నోటిఫికేషన్లు',
    store_not_found:    'దుకాణం కనుగొనబడలేదు',
    product_not_found:  'ఉత్పత్తి కనుగొనబడలేదు',
    no_results:         'ఫలితాలు కనుగొనబడలేదు',
    loading:            'లోడ్ అవుతోంది…',
    error_generic:      'ఏదో తప్పు జరిగింది',
    save:               'సేవ్ చేయండి',
    cancel:             'రద్దు చేయండి',
    delete:             'తొలగించండి',
    edit:               'సవరించండి',
    submit:             'సమర్పించండి',
    back:               'వెనక్కి',
    next:               'తదుపరి',
    done:               'పూర్తయింది',
    share:              'షేర్ చేయండి',
    report:             'నివేదించండి',
  },
};
