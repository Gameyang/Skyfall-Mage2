// Responsibility: Centralize app-facing asset URLs for Vite and GitHub Pages builds.
// Owner: platform

export const assetUrls = {
  items: {
    fireStaff: new URL("../assets/items/fire_staff.webp", import.meta.url).href,
    blizzardStaff: new URL("../assets/items/blizzard_staff.webp", import.meta.url).href,
    chainLightningStaff: new URL("../assets/items/chain_lightning_staff.webp", import.meta.url).href,
    hpPotion: new URL("../assets/items/hp_potion_1.webp", import.meta.url).href,
    mpPotion: new URL("../assets/items/mp_potion_1.webp", import.meta.url).href,
    coin: new URL("../assets/items/coin.webp", import.meta.url).href,
    gem: new URL("../assets/items/gem.webp", import.meta.url).href,
    blinkstepBoots: new URL("../assets/items/blinkstep_boots.webp", import.meta.url).href,
    manaRegenCap: new URL("../assets/items/mana_regen_cap.webp", import.meta.url).href,
    manaPulseArmor: new URL("../assets/items/mana_pulse_armor.webp", import.meta.url).href,
  },
  enemies: {
    bat: new URL("../assets/enemies/bat.webp", import.meta.url).href,
  },
} as const;
