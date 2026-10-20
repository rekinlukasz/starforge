import { h, setClass } from './dom.js';
import { icon } from './Icons.js';

// Bottom tab bar. Only implemented screens are registered; each tab appears
// once its system is unlocked (isVisible), so no tab ever leads to a dead view.
export class Navigation {
  constructor({ onChange, onMenu }) {
    this.onChange = onChange;
    this.tabs = new Map();
    this.history = [];
    this.current = null;
    this.el = h('nav', { class: 'bottom-nav', 'aria-label': 'Nawigacja główna' });
    this.menuBadge = h('span', { class: 'nav-badge', hidden: true });
    this.menuButton = h('button', { class: 'nav-tab', 'aria-label': 'Więcej', onclick: () => onMenu() }, [icon('menu'), h('span', { text: 'Więcej' }), this.menuBadge]);
    this.visibility = new Map();
    this.el.addEventListener('click', (e) => {
      const tab = e.target.closest('[data-tab]');
      if (tab) this.go(tab.dataset.tab);
    });
  }

  register(screen, iconName, isVisible = () => true) {
    const btn = h('button', { class: 'nav-tab', dataset: { tab: screen.id }, 'aria-label': screen.title }, [icon(iconName), h('span', { text: screen.title })]);
    this.tabs.set(screen.id, btn);
    this.visibility.set(screen.id, isVisible);
    this.el.append(btn);
    this.el.append(this.menuButton); // keep "more" last
  }

  go(id, { remember = true } = {}) {
    if (!this.tabs.has(id) || id === this.current) return;
    if (remember && this.current) this.history.push(this.current);
    if (this.history.length > 20) this.history.shift();
    this.current = id;
    for (const [tid, btn] of this.tabs) {
      setClass(btn, 'active', tid === id);
      btn.setAttribute('aria-current', tid === id ? 'page' : 'false');
    }
    this.onChange(id);
  }

  update(badgeCount = 0) {
    for (const [id, btn] of this.tabs) {
      const visible = this.visibility.get(id)();
      if (btn.hidden === visible) btn.hidden = !visible;
    }
    this.menuBadge.hidden = badgeCount <= 0;
    if (badgeCount > 0) this.menuBadge.textContent = String(badgeCount);
  }

  // Back button: previous tab. Returns false at the root (caller may exit).
  back() {
    const prev = this.history.pop();
    if (!prev) return false;
    this.go(prev, { remember: false });
    return true;
  }
}
