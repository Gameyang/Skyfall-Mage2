// Responsibility: Find the DOM root and start the app composition.
// Owner: app

import { createApp } from "./createApp";
import { t } from "../content/strings/GameStrings";

export async function bootstrap(): Promise<void> {
  const root = document.querySelector<HTMLElement>("#app");

  if (!root) {
    throw new Error("Missing #app root element.");
  }

  try {
    await createApp(root);
  } catch (error) {
    root.replaceChildren(createFatalErrorView(error));
    throw error;
  }
}

function createFatalErrorView(error: unknown): HTMLElement {
  const frame = document.createElement("main");
  frame.className = "fatal-error";

  const title = document.createElement("h1");
  title.textContent = t("app.title");

  const message = document.createElement("p");
  message.textContent = error instanceof Error ? error.message : t("app.fatalStartFailed");

  frame.append(title, message);
  return frame;
}
