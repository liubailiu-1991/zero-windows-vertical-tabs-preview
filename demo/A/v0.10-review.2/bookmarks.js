(() => {
 'use strict';
 const bar = document.querySelector('#bookmarks');
 const items = document.createElement('div');
 items.id = 'bookmark-items';
 function bookmark(name, file, kind) {
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.action = 'unavailable';
  button.dataset.bookmarkKind = kind;
  button.title = name + '（示例，书签操作未模拟）';
  const icon = document.createElement('img');
  icon.src = 'assets/' + file;
  icon.alt = '';
  const label = document.createElement('span');
  label.textContent = name;
  button.append(icon, label);
  return button;
 }
 for (const name of ['设置','项目资料','设计参考','阅读清单','图标资源','灵感记录','常用工具','资料归档','示例目录']) {
  items.append(bookmark(name, name === '设置' ? 'favicon-settings.svg' : 'bookmark-folder.svg', name === '设置' ? 'page' : 'folder'));
 }
 const overflow = document.createElement('button');
 overflow.id = 'bookmark-overflow';
 overflow.type = 'button';
 overflow.dataset.action = 'unavailable';
 overflow.setAttribute('aria-label', '更多书签（未模拟）');
 overflow.title = '更多书签（未模拟）';
 const arrow = document.createElement('img');
 arrow.src = 'assets/bookmark-overflow.svg';
 arrow.alt = '';
 overflow.append(arrow);
 const divider = document.createElement('span');
 divider.className = 'bookmark-divider';
 divider.setAttribute('aria-hidden', 'true');
 const other = bookmark('其他书签', 'bookmark-folder.svg', 'folder');
 other.id = 'other-bookmarks';
 bar.replaceChildren(items, overflow, divider, other);
 const buttons = [...items.children];
 function fit() {
  if (!bar.clientWidth) return;
  buttons.forEach(button => button.hidden = false);
  overflow.hidden = true;
  const widths = buttons.map(button => button.getBoundingClientRect().width);
  const total = widths.reduce((sum, width) => sum + width, 0) + (buttons.length - 1) * 4;
  if (total <= items.clientWidth) return;
  overflow.hidden = false;
  const available = items.clientWidth;
  let used = 0, exceeded = false;
  buttons.forEach((button, i) => {
   const next = widths[i] + (i ? 4 : 0);
   exceeded = exceeded || used + next > available;
   button.hidden = exceeded;
   if (!exceeded) used += next;
  });
 }
 new ResizeObserver(fit).observe(bar);
 document.fonts.ready.then(fit);
 fit();
})();
