// Responsibility: Provide a thin wrapper for top-level side panel content.
// Owner: ui/shell

export function createPanelHost(className: string): HTMLElement {
  const host = document.createElement("aside");
  host.className = `panel-host ${className}`;
  return host;
}
