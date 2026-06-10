import { bootstrap } from "./app/bootstrap";
import "./ui/styles/base.css";
import "./ui/styles/layout.css";
import "./ui/styles/panels.css";
import "./ui/styles/controls.css";
import "./ui/styles/textures.css";
import "./ui/styles/title.css";

if (import.meta.env.DEV && window.location.pathname === "/effects") {
  void import("./tools/effects/bootstrapEffectTool").then(({ bootstrapEffectTool }) => bootstrapEffectTool());
} else {
  void bootstrap();
}
