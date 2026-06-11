import { MATERIAL_OPTIONS } from '../materials.js';

function createSlot(option) {
  const slot = document.createElement('button');
  slot.type = 'button';
  slot.className = 'material-slot';
  slot.setAttribute('aria-pressed', 'false');
  slot.title = `${option.label} brush (${option.key})`;
  slot.style.setProperty('--slot-color', option.color);
  slot.style.setProperty('--slot-glow', option.glow);

  if (option.material !== undefined) {
    slot.dataset.material = String(option.material);
  }
  if (option.action) {
    slot.dataset.action = option.action;
  }

  const swatch = document.createElement('span');
  swatch.className = 'material-swatch';
  swatch.setAttribute('aria-hidden', 'true');

  const name = document.createElement('span');
  name.className = 'material-name';
  name.textContent = option.label;

  const key = document.createElement('span');
  key.className = 'material-key';
  key.textContent = option.key;

  slot.append(swatch, name, key);
  return slot;
}

function syncSelectedSlot(container, selectedMaterial) {
  for (const slot of container.querySelectorAll('.material-slot[data-material]')) {
    const isSelected = Number(slot.dataset.material) === selectedMaterial;
    slot.classList.toggle('is-selected', isSelected);
    slot.setAttribute('aria-pressed', String(isSelected));
  }
}

export function createMaterialHub({ container, emitterState }) {
  const fragment = document.createDocumentFragment();
  for (const option of MATERIAL_OPTIONS) {
    fragment.append(createSlot(option));
  }

  fragment.append(
    createSlot({
      label: 'Blast',
      key: 'Space',
      action: 'explosion',
      color: '#ff3b45',
      glow: 'rgba(255, 59, 69, 0.78)',
    }),
  );

  container.replaceChildren(fragment);

  const stopPointer = (event) => event.stopPropagation();
  const handleClick = (event) => {
    const slot = event.target.closest('.material-slot');
    if (!slot) return;

    event.preventDefault();
    event.stopPropagation();

    if (slot.dataset.action === 'explosion') {
      emitterState.addExplosion();
      return;
    }

    emitterState.setSelectedMaterial(Number(slot.dataset.material));
  };
  const unsubscribeSelection = emitterState.onSelectionChange((material) => {
    syncSelectedSlot(container, material);
  });

  container.addEventListener('pointerdown', stopPointer);
  container.addEventListener('click', handleClick);

  return {
    destroy() {
      unsubscribeSelection();
      container.removeEventListener('pointerdown', stopPointer);
      container.removeEventListener('click', handleClick);
      container.replaceChildren();
    },
  };
}
