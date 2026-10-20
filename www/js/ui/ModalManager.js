import { h, clear } from './dom.js';
import { icon } from './Icons.js';

// Single modal layer. Buttons: [{ label, kind: 'primary'|'danger'|'ghost', onClick, closes = true }].
export class ModalManager {
  constructor(root) {
    this.root = root;
    this.current = null;
    this.layer = h('div', { class: 'modal-layer', hidden: true });
    this.layer.addEventListener('click', (e) => {
      if (e.target === this.layer && this.current?.dismissible !== false) this.close();
    });
    root.append(this.layer);
  }

  isOpen() {
    return Boolean(this.current);
  }

  open({ title, icon: iconName, body = [], buttons, dismissible = true, onUpdate, onClose }) {
    this.close();
    const footer = h('div', { class: 'modal-actions' });
    const btns = buttons ?? [{ label: 'Zamknij', kind: 'ghost' }];
    for (const b of btns) {
      const btn = h('button', { class: `btn btn-${b.kind ?? 'primary'}`, text: b.label });
      btn.addEventListener('click', () => {
        if (btn.disabled) return;
        const keepOpen = b.onClick?.() === false || b.closes === false;
        if (!keepOpen) this.close();
      });
      footer.append(btn);
    }
    const header = h('div', { class: 'modal-header' }, [
      iconName ? icon(iconName, 'icon modal-icon') : null,
      h('h2', { text: title }),
      dismissible
        ? h('button', { class: 'icon-btn', 'aria-label': 'Zamknij', onclick: () => this.close() }, [icon('close')])
        : null,
    ]);
    const dialog = h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': title }, [
      header,
      h('div', { class: 'modal-body' }, body),
      footer,
    ]);
    clear(this.layer);
    this.layer.append(dialog);
    this.layer.hidden = false;
    this.current = { dismissible, onUpdate, onClose };
    return dialog;
  }

  update() {
    this.current?.onUpdate?.();
  }

  close() {
    if (!this.current) return;
    const { onClose } = this.current;
    this.current = null;
    this.layer.hidden = true;
    clear(this.layer);
    onClose?.();
  }

  // Back button handler: closes a dismissible modal. Returns true if handled.
  back() {
    if (!this.current) return false;
    if (this.current.dismissible !== false) this.close();
    return true;
  }
}
