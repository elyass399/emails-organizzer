import Particles from "@tsparticles/vue3";
import { loadFull } from "tsparticles"; // Carica il pacchetto completo di particelle

export default defineNuxtPlugin(async (nuxtApp) => {
    // Registra il componente Vue
    nuxtApp.vueApp.use(Particles, {
        init: async (engine) => {
            // Inizializza il motore tsparticles con il pacchetto completo
            await loadFull(engine);
        },
    });
});