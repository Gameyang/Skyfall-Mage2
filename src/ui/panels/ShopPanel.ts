// Responsibility: Render starter shop offers and emit purchase commands.
// Owner: ui/panels

import type { GameCommand } from "../../core/state/Command";
import { bindPressAction } from "../components/PressAction";
import type { ShopViewModel } from "../viewModels/createShopViewModel";

type CommandSink = (command: GameCommand) => void;

export class ShopPanel {
  readonly element: HTMLElement;
  private lastSignature = "";

  constructor(private readonly sink: CommandSink) {
    this.element = document.createElement("section");
    this.element.className = "shop-panel";
  }

  update(viewModel: ShopViewModel): void {
    const signature = createShopSignature(viewModel);

    if (signature === this.lastSignature) {
      return;
    }

    this.lastSignature = signature;
    this.render(viewModel);
  }

  private render(viewModel: ShopViewModel): void {
    const reroll = document.createElement("button");
    reroll.type = "button";
    reroll.className = "shop-offer";
    reroll.disabled = viewModel.rerollDisabled;
    bindPressAction(reroll, () => this.sink({ type: "RerollShopOffers" }));

    const rerollLabel = document.createElement("span");
    rerollLabel.textContent = "Reroll";
    const rerollPrice = document.createElement("strong");
    rerollPrice.textContent = String(viewModel.rerollCost);
    reroll.append(rerollLabel, rerollPrice);

    this.element.replaceChildren(
      reroll,
      ...viewModel.offers.map((offer) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "shop-offer";
        button.disabled = offer.disabled;
        bindPressAction(button, () => this.sink({ type: "BuyShopItem", offerId: offer.id }));

        const label = document.createElement("span");
        label.textContent = `${offer.label} x${offer.remainingStock}`;
        const price = document.createElement("strong");
        price.textContent = String(offer.price);
        button.append(label, price);
        return button;
      }),
    );
  }
}

function createShopSignature(viewModel: ShopViewModel): string {
  return [
    viewModel.rerollCost,
    viewModel.rerollDisabled,
    ...viewModel.offers.map((offer) =>
      `${offer.id}:${offer.label}:${offer.price}:${offer.remainingStock}:${offer.disabled}`,
    ),
  ].join("|");
}
