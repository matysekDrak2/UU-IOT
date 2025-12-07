import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./assets/i18n/en.json";
import cs from "./assets/i18n/cs.json";

i18n
    .use(initReactI18next)
    .init({
        resources: {
            en: { translation: en },
            cs: { translation: cs },
        },
        lng: "en",
        fallbackLng: "en",
        interpolation: {
            escapeValue: false,
        },
    });

export default i18n;
