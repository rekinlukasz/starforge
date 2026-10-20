// Tiny DOM helpers. Text is always set via textContent (never innerHTML),
// so game data cannot inject markup.

export function h(tag, props = {}, children = []) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') el.className = value;
    else if (key === 'text') el.textContent = value;
    else if (key === 'dataset') Object.assign(el.dataset, value);
    else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2), value);
    else el.setAttribute(key, value === true ? '' : value);
  }
  for (const child of [].concat(children)) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return el;
}

// Updates text only when it changed, avoiding needless layout work.
export function setText(el, text) {
  const t = String(text);
  if (el.textContent !== t) el.textContent = t;
}

export function setClass(el, className, on) {
  if (el.classList.contains(className) !== on) el.classList.toggle(className, on);
}

export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}
