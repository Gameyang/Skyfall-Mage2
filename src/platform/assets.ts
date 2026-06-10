// Responsibility: Centralize app-facing asset URLs for Vite and GitHub Pages builds.
// Owner: platform

export const defaultPlayerSkinId = "skin_화염마법사";

const skinUrlModules = import.meta.glob<string>("../assets/skins/*.webp", {
  eager: true,
  import: "default",
  query: "?url&no-inline",
});

export const skinAssetUrls = Object.fromEntries(
  Object.entries(skinUrlModules).map(([path, url]) => [path.match(/\/([^/]+)\.webp$/)?.[1] ?? path, url]),
) as Readonly<Record<string, string>>;

export function resolveSkinUrl(skinId: string): string {
  return skinAssetUrls[skinId] ?? skinAssetUrls[defaultPlayerSkinId] ?? "";
}

export const assetUrls = {
  title: {
    logo: new URL("../assets/title/skyfall-mage2-title.webp", import.meta.url).href,
  },
  ui: {
    panelFrame: new URL("../assets/ui/ui-panel-frame.png", import.meta.url).href,
    buttonFrame: new URL("../assets/ui/ui-button-frame.png", import.meta.url).href,
    slotFrame: new URL("../assets/ui/ui-slot-frame.png", import.meta.url).href,
  },
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
    miniTracking: new URL("../assets/enemies/mini-tracking.webp", import.meta.url).href,
    miniTeleport: new URL("../assets/enemies/mini-teleport.webp", import.meta.url).href,
    miniSplit: new URL("../assets/enemies/mini-split.webp", import.meta.url).href,
    trackingBoss: new URL("../assets/enemies/tracking-boss.webp", import.meta.url).href,
    teleportBoss: new URL("../assets/enemies/teleport-boss.webp", import.meta.url).href,
    splitBoss: new URL("../assets/enemies/split-boss.webp", import.meta.url).href,
    batAnimationSheet: new URL("../assets/enemies/bat-animation-sheet.webp", import.meta.url).href,
    miniTrackingAnimationSheet: new URL("../assets/enemies/mini-tracking-animation-sheet.webp", import.meta.url).href,
    miniTeleportAnimationSheet: new URL("../assets/enemies/mini-teleport-animation-sheet.webp", import.meta.url).href,
    miniSplitAnimationSheet: new URL("../assets/enemies/mini-split-animation-sheet.webp", import.meta.url).href,
    trackingBossAnimationSheet: new URL("../assets/enemies/tracking-boss-animation-sheet.webp", import.meta.url).href,
    teleportBossAnimationSheet: new URL("../assets/enemies/teleport-boss-animation-sheet.webp", import.meta.url).href,
    splitBossAnimationSheet: new URL("../assets/enemies/split-boss-animation-sheet.webp", import.meta.url).href,
  },
  projectiles: {
    meteorRock: new URL("../assets/projectiles/meteor-rock.webp", import.meta.url).href,
  },
  effects: {
    firestaffProjectile: new URL("../assets/effects/firestaff-projectile-round-v2-sheet.png", import.meta.url).href,
    firestaffImpact: new URL("../assets/effects/firestaff-impact-burst-v1-sheet.png", import.meta.url).href,
    firestaffBurn: new URL("../assets/effects/firestaff-burn-small-v2-sheet.png", import.meta.url).href,
    waterEntrySurface: new URL("../assets/effects/water-entry-surface-sheet.webp", import.meta.url).href,
    waterEntryUnderwater: new URL("../assets/effects/water-entry-underwater-sheet.webp", import.meta.url).href,
    waterUnderwaterLoop: new URL("../assets/effects/water-underwater-loop-sheet.webp", import.meta.url).href,
  },
} as const;

export function getPreloadAssetUrls(): readonly string[] {
  return [
    assetUrls.title.logo,
    ...Object.values(assetUrls.ui),
    ...Object.values(assetUrls.items),
    ...Object.values(assetUrls.enemies),
    ...Object.values(assetUrls.projectiles),
    ...Object.values(assetUrls.effects),
    ...Object.values(skinAssetUrls),
  ];
}
