'use strict';
const send = (type, data = {}) => parent.postMessage({ type, ...data }, location.origin);
const one = selector => document.querySelector(selector);
const all = selector => [...document.querySelectorAll(selector)];
const navigation = all('[data-navigation]');
const search = one('#search');
const windowMenu = one('#window-menu');
let selectedWindow = 1;
let moduleName = 'current';
let panel = 'expanded';
let layout = 'vertical';
let frame;
let noticeTimer;

const glyphs = {
  current: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 9h18"/>',
  sites: '<path d="M4 4h6v6H4zm10 0h6v6h-6zM4 14h6v6H4zm10 0h6v6h-6z"/>',
  recent: '<circle cx="12" cy="12" r="9"/><path d="M12 7v6l3 2"/>',
  deduplicate: '<path d="M5 16H3V3h13v2M7 7h14v14H7zM11 14h6m-3-3v6"/>',
  more: '<path stroke-width="3" d="M12 5h.01M12 12h.01M12 19h.01"/>',
  panel: '<path d="M4 6h16M4 12h10M4 18h16M20 9l-3 3 3 3"/>'
};
function glyph(name) {
  return window.ZERO_NATIVE_ICONS[name] || '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.6" aria-hidden="true">' + glyphs[name] + '</svg>';
}
const moduleIcons = { current:'current', sites:'sites', bookmarks:'star', recent:'recent', search:'search' };
for (const button of navigation) button.innerHTML = glyph(moduleIcons[button.dataset.navigation]);
one('#rail-new').innerHTML = glyph('plus');
one('#deduplicate').innerHTML = glyph('deduplicate');
one('#window-more').innerHTML = glyph('more');
one('#b-panel-toggle').innerHTML = glyph('panel');

function announce(message) {
  const notice = one('#notice');
  notice.textContent = message;
  notice.hidden = false;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => { notice.hidden = true; }, 2200);
}
function domain(url) {
  try { return new URL(url).hostname; } catch { return ''; }
}
function iconFile(url) {
  const host = domain(url);
  if (host.endsWith('bilibili.com')) return 'favicon-bili-reference.png';
  if (host === 'docs.qq.com') return 'site-docs.png';
  if (host.endsWith('google.com')) return 'google-mark-reference.png';
  return url?.includes('settings') ? 'favicon-settings.svg' : 'zero-outline.png';
}
function result(item, action, active = false) {
  const button = document.createElement('button');
  button.className = 'result-row';
  const icon = document.createElement('img');
  icon.src = '../client/assets/' + iconFile(item.url);
  icon.alt = '';
  const title = document.createElement('span');
  title.textContent = item.title;
  button.append(icon, title);
  if (active) button.setAttribute('aria-current','page');
  button.onclick = action;
  return button;
}
function section(title, count, content) {
  const container = document.createElement('details');
  const header = document.createElement('summary');
  header.textContent = title;
  if (typeof count === 'number') {
    const number = document.createElement('small');
    number.textContent = count;
    header.append(number);
  }
  container.open = true;
  const children = document.createElement('div');
  children.append(...content);
  container.append(header, children);
  return container;
}
const add = async (url, title, wid = selectedWindow) => {
  await demoBrowser.tabs.create({ windowId:wid, url, title, active:true });
  queue();
};
async function activate(tab) {
  selectedWindow = tab.windowId;
  const group = BDemo.groups().find(g => g.collapsed && g.members.some(t => t.tabId === tab.id));
  if (group) await demoBrowser.runtime.sendMessage({ type:'host.sidebarGroups', action:'update', groupId:group.id, windowId:tab.windowId, collapsed:false });
  await demoBrowser.tabs.update(tab.id, {active:true});
  queue();
}
async function selectWindow(wid, tabs) {
  selectedWindow = wid;
  const active = tabs.find(t => t.windowId === wid && t.active) || tabs.find(t => t.windowId === wid);
  if (active) await activate(active);
  else await add(undefined, undefined, wid);
}
function renderWindows(windows, tabs) {
  const bar = one('#windows');
  const key = JSON.stringify([selectedWindow, windows.map(w => w.id)]);
  if (bar.dataset.key === key) return;
  bar.dataset.key = key;
  bar.replaceChildren(...windows.map((window, index) => {
    const button = document.createElement('button');
    button.textContent = '窗' + (index + 1);
    button.dataset.action = 'select-window';
    button.dataset.id = window.id;
    if (window.id === selectedWindow) button.setAttribute('aria-current','page');
    button.onclick = () => selectWindow(window.id, tabs);
    return button;
  }));
}
function tabRow(tab) {
  return result(tab, () => activate(tab), tab.active && tab.windowId === selectedWindow);
}
function bookmarkRow(item) {
  return result(item, () => add(item.url, item.title));
}
async function renderModule(tabs) {
  if (moduleName === 'current') return;
  const name = moduleName;
  const output = one('[data-view="' + name + '"] .results');
  const nodes = BDemo.snapshot().nodes;
  if (name === 'sites') {
    const pinned = tabs.filter(t => t.pinned);
    const normal = tabs.filter(t => !t.pinned);
    const domains = new Map();
    for (const tab of normal) {
      const key = /^https?:/.test(tab.url) ? domain(tab.url) : '其他页面';
      if (!domains.has(key)) domains.set(key, []);
      domains.get(key).push(tab);
    }
    output.replaceChildren(
      ...(pinned.length ? [section('已固定', pinned.length, pinned.map(tabRow))] : []),
      section('未固定', normal.length, [...domains].map(([key, rows]) => section(key, rows.length, rows.map(tabRow))))
    );
  } else if (name === 'bookmarks') {
    const tree = parentId => nodes.filter(n => n.parentId === parentId).map(n => {
      if (n.url) return bookmarkRow(n);
      const children = tree(n.id);
      return section(n.title, children.length, children);
    });
    output.replaceChildren(...tree('0'));
  } else if (name === 'recent') {
    const sessions = await demoBrowser.sessions.getRecentlyClosed();
    if (moduleName !== name) return;
    output.replaceChildren(...sessions.map(item => {
      const entry = item.tab || item.window;
      return result(item.tab || { title:'窗口 · ' + entry.tabs.length + ' 个标签' }, async () => {
        const restored = await demoBrowser.sessions.restore(entry.sessionId);
        if (restored.window) {
          const window = await demoBrowser.windows.create();
          selectedWindow = window.id;
          for (const tab of restored.window.tabs) await add(tab.url, tab.title, window.id);
        }
        queue();
        announce(item.tab ? '已恢复标签页' : '已恢复窗口');
      });
    }));
    if (!sessions.length) output.textContent = '暂无最近关闭的标签页';
  } else {
    const term = search.value.trim().toLocaleLowerCase();
    const match = item => (item.title + ' ' + item.url).toLocaleLowerCase().includes(term);
    const results = term ? tabs.filter(match) : tabs.slice(0,6);
    const bookmarks = term ? nodes.filter(n => n.url && match(n)) : [];
    const history = term ? (await demoBrowser.history.search({text:term,startTime:0,maxResults:25})).filter(match) : [];
    if (moduleName !== name || term !== search.value.trim().toLocaleLowerCase()) return;
    output.replaceChildren();
    if (results.length) output.append(section(term ? '打开的标签页' : '推荐标签页', results.length, results.map(tabRow)));
    if (bookmarks.length) output.append(section('书签', bookmarks.length, bookmarks.map(bookmarkRow)));
    if (history.length) output.append(section('历史', history.length, history.map(bookmarkRow)));
    if (!output.childElementCount) output.textContent = '找不到任何结果';
  }
}
function showModule(next, focusSearch = false) {
  moduleName = next;
  for (const button of navigation) {
    if (button.dataset.navigation === next) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  }
  for (const view of all('[data-view]')) view.hidden = view.dataset.view !== next;
  if (focusSearch && next === 'search') search.focus();
  queue();
}
let snapshotKey = '';
async function render() {
  const windows = (await demoBrowser.windows.getAll()).filter(w => !w.incognito);
  const tabs = await BDemo.tabs();
  renderWindows(windows, tabs);
  const snapshot = {windowId:selectedWindow, tabs, groups:BDemo.groups()};
  const key = JSON.stringify(snapshot);
  if (key !== snapshotKey) {
    snapshotKey = key;
    send('b-snapshot', snapshot);
  }
  window.BWindowA.render();
  await renderModule(tabs);
}
function queue() {
  if (frame) return;
  frame = requestAnimationFrame(() => { frame = 0; render().catch(console.error); });
}
async function deduplicate() {
  windowMenu.hidden = true;
  const rows = (await BDemo.tabs()).filter(t => t.windowId === selectedWindow && /^https?:/.test(t.url));
  const keep = new Set();
  const duplicates = [];
  for (const tab of rows.sort((a,b) => Number(b.active || b.pinned) - Number(a.active || a.pinned))) {
    if (keep.has(tab.url) && !tab.pinned) duplicates.push(tab.id);
    else keep.add(tab.url);
  }
  if (duplicates.length) await BDemo.closeWindowTabs(selectedWindow,duplicates);
  queue();
  announce(duplicates.length ? '已清理 ' + duplicates.length + ' 个重复标签页' : '当前窗口没有重复标签页');
}

for (const button of navigation) {
  const name = button.dataset.navigation;
  button.onclick = () => { showModule(name, true); send('b-hover', {navigation:name}); };
  button.onpointerenter = () => send('b-hover', {navigation:name});
}
for (const button of all('[data-shortcut]')) button.onclick = async () => {
  const id = Number(button.dataset.shortcut);
  const tab = (await BDemo.tabs()).find(t => t.id === id);
  if (tab) await activate(tab);
  else await add(id === 11 ? 'https://www.bilibili.com/' : 'https://docs.qq.com/',button.title);
};
search.oninput = queue;
one('#rail-new').onclick = () => { showModule('current'); return add(); };
one('#b-panel-toggle').onclick = () => send('b-toggle-panel');
one('#deduplicate').onclick = deduplicate;
one('#menu-deduplicate').onclick = deduplicate;
one('#new-window').onclick = async () => {
  windowMenu.hidden = true;
  selectedWindow = (await demoBrowser.windows.create()).id;
  await add();
};
one('#window-more').onclick = () => { windowMenu.hidden = !windowMenu.hidden; };
document.addEventListener('pointerdown', event => {
  if (!event.target.closest('#window-menu,#window-more')) windowMenu.hidden = true;
  send('b-outside');
}, true);
document.addEventListener('contextmenu', event => {
  if (event.defaultPrevented || event.target.closest('zero-window-tabs,input')) return;
  event.preventDefault();
  send('b-context', { x:event.clientX, y:event.clientY });
});
document.addEventListener('pointerleave', () => send('b-leave'));
document.addEventListener('b-window-layer', () => send('b-busy',{busy:!!window.BWindowPopupBusy}));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    if (!windowMenu.hidden) windowMenu.hidden = true;
    else send('b-escape');
  }
  if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'a') {
    event.preventDefault();
    showModule('search', true);
  }
});
window.addEventListener('message', async event => {
  if (event.source !== parent || event.origin !== location.origin) return;
  const data = event.data;
  if (data.type === 'b-panel-state') {
    panel = data.panel;
    layout = data.layout;
    document.body.dataset.layout = layout;
    const label = layout === 'horizontal' ? '关闭标签管理' : panel === 'expanded' ? '收起侧栏' : '固定展开侧栏';
    const button = one('#b-panel-toggle');
    button.ariaLabel = label;
    button.title = label;
  }
  if (data.type === 'b-select-module' && moduleName !== data.navigation) showModule(data.navigation);
  if (data.type === 'b-command') {
    const tabs = await BDemo.tabs();
    const tab = tabs.find(t => t.id === data.id);
    if (data.action === 'activate' && tab) await activate(tab);
    if (data.action === 'close' && tab) await BDemo.closeWindowTabs(tab.windowId, [tab.id]);
    if (data.action === 'new') await add();
    queue();
  }
});
for (const [owner, name] of [[demoBrowser.tabs,'onCreated'],[demoBrowser.tabs,'onActivated'],[demoBrowser.sessions,'onChanged']]) owner[name]?.addListener(queue);
queue();
