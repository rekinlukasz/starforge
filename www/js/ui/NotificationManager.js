import { h } from './dom.js';

const MAX_TOASTS = 3;
const TOAST_MS = 3200;

export class NotificationManager {
  constructor(root) {
    this.el = h('div', { class: 'toasts', 'aria-live': 'polite' });
    root.append(this.el);
  }

  show(text, kind = 'info') {
    const toast = h('div', { class: `toast toast-${kind}`, text });
    this.el.append(toast);
    while (this.el.children.length > MAX_TOASTS) this.el.firstChild.remove();
    setTimeout(() => {
      toast.classList.add('leaving');
      setTimeout(() => toast.remove(), 300);
    }, TOAST_MS);
  }
}
