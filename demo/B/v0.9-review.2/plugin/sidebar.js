'use strict';
const send = (type, data = {}) => parent.postMessage({ type, ...data }, location.origin);
const one = selector => document.querySelector(selector);
const all = selector => [...document.querySelectorAll(selector)];
const navigation = all('[data-navigation]');
const search = one('#search');
let selectedWindow = 1;
let moduleName = 'current';
let panel = 'expanded';
let layout = 'vertical';
let frame;
let noticeTimer;

const glyphs = {
  current: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 9h18"/>',
  sites: '<path d="M4 4h6v6H4zm10 0h6v6h-6zM4 14h6v6H4zm10 0h6v6h-6z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v6l3 2"/>',
  deduplicate: '<path d="M5 16H3V3h13v2M7 7h14v14H7zM11 14h6m-3-3v6"/>',
  more: '<path stroke-width="3" d="M12 5h.01M12 12h.01M12 19h.01"/>',
  pin: '<path d="m8 3 8 0-1 7 4 4v2H5v-2l4-4zm4 13v5"/>',
  edit: '<path d="m4 20 1-5L16 4l4 4-11 11zm10-14 4 4"/>',
  settings: '<path d="m9 3 6 0 1 3 3 1 2 4-2 4-3 1-1 4H9l-1-4-3-1-2-4 2-4 3-1z"/><circle cx="12" cy="11" r="3"/>',
  chevron: '<path d="m9 6 6 6-6 6"/>',
  expand: '<path d="m7 9 5-5 5 5m-10 6 5 5 5-5"/>',
  sort: '<path d="M6 4v15m-3-3 3 3 3-3m3-11h8m-8 5h6m-6 5h4"/>',
  split: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 12h18"/>',
  restore: '<path d="M4 12a8 8 0 1 1 3 6m-3-12v6h6m2-5v5l3 2"/>',
  globe: '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>',
  folder: '<path d="M3 6h7l2 2h9v11H3z"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  panel: '<path d="M4 6h16M4 12h10M4 18h16M20 9l-3 3 3 3"/>'
};
function glyph(name) {
  return (!glyphs[name] && window.ZERO_NATIVE_ICONS[name]) || '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.6" aria-hidden="true">' + glyphs[name] + '</svg>';
}
const moduleIcons = { current:'current', sites:'sites', bookmarks:'star', recent:'clock', search:'search' };
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
const aMenu = () => window.BWindowA;
const openedSections = new Map();
let bookmarkSort = 'original';
let flatBookmarks = false;
let bookmarkPane = false;
let shortcutVisibility = true;
const shortcutEntries = new Map([
  ['bili',{ id:11, title:'哔哩哔哩',url:'https://www.bilibili.com/' }],
  ['docs',{ id:12, title:'腾讯文档',url:'https://docs.qq.com/' }]
]);
const item = (tag, klass, label) => {
  const node = document.createElement(tag);
  if (klass) node.className = klass;
  if (label !== undefined) node.textContent = label;
  return node;
};
function iconButton(name, label, onClick, extraClass='') {
  const button = item('button','icon-button '+extraClass);
  button.type = 'button';
  button.innerHTML = glyph(name);
  button.ariaLabel = button.title = label;
  button.onclick = onClick;
  return button;
}
function fileIcon(entry) {
  if (entry.windowPreview) { const icon=item('span','entry-icon');icon.innerHTML=glyph('globe');return icon; }
  const icon = document.createElement('img');
  icon.src = '../client/assets/' + (entry.url ? iconFile(entry.url) : 'zero-outline.png');
  icon.alt = '';
  return icon;
}
function bindMenu(target, callback) {
  target.addEventListener('contextmenu', e => { e.preventDefault(); callback(); });
  target.addEventListener('keydown', e => {
    if (e.key !== 'ContextMenu' && !(e.key === 'F10' && e.shiftKey)) return;
    e.preventDefault();
    e.stopPropagation();
    callback();
  });
}
function rowControl(title, glyphName, action, klass) {
  return iconButton(glyphName,title,action,klass);
}
function result(entry, action, config={}) {
  const row = item('div','result-shell');
  const button = item('button','result-row');
  const title = item('span','result-title',entry.title);
  title.title = entry.title;
  button.append(fileIcon(entry), title);
  button.onclick = action;
  if (config.active) button.setAttribute('aria-current','page');
  row.append(button);
  if (config.tab) {
    if (moduleName === 'sites') button.dataset.tabId = entry.id;
    else button.dataset.searchRow = 'tab:'+entry.id;
    button.addEventListener('pointerenter', () => aMenu().hoverExternalTab(entry.id, button));
    row.addEventListener('pointerleave', () => aMenu().hideExternalHover());
  }
  if (config.menu || config.tab) {
    const actions = item('span','sp-row-actions');
    const menu = () => {
      if (config.tab) aMenu().openExternalTab(entry.id, button, more, () => tabModuleCommands(entry));
      else aMenu().openModuleMenu(more, config.menu(), 'row', button);
    };
    if (config.tab) actions.append(rowControl('关闭：'+entry.title,'close',()=>BDemo.closeWindowTabs(entry.windowId,[entry.id]),'row-close'));
    for (const command of config.quick || []) actions.append(rowControl(...command));
    const more = rowControl('更多：'+entry.title,'more',menu,'row-more');
    more.setAttribute('aria-haspopup','menu');
    actions.append(more);
    row.append(actions);
    bindMenu(row,menu);
    actions.addEventListener('pointerenter', () => aMenu().hideExternalHover());
  }
  return row;
}
function renderShortcuts() {
  const area = one('#shortcuts');
  area.hidden = !shortcutVisibility;
  area.replaceChildren(...[...shortcutEntries.values()].map(entry => {
    const button = item('button');
    button.ariaLabel = button.title = entry.title;
    if (entry.id) button.dataset.shortcut = entry.id;
    button.append(fileIcon(entry));
    button.onclick = async () => {
      const tab = (await BDemo.tabs()).find(t => t.id === entry.id || t.url === entry.url);
      if (tab) await activate(tab);
      else await add(entry.url,entry.title);
    };
    return button;
  }));
}
function tabModuleCommands(entry) {
  const commands = [];
  if (/^https?:/.test(entry.url)) {
    commands.push([isShortcut(entry)?'从侧栏移除':'添加到侧栏', () => toggleShortcut(entry)]);
    if (moduleName === 'search') commands.push(['收藏链接', () => saveBookmark(entry)]);
  }
  if (moduleName === 'search') commands.push(['复制链接', () => copy(entry.url)]);
  return commands;
}
function isShortcut(entry) { return [...shortcutEntries.values()].some(x=>x.url === entry.url); }
function toggleShortcut(entry) {
  const key = [...shortcutEntries].find(([,x]) => x.url === entry.url)?.[0];
  if (key !== undefined) shortcutEntries.delete(key);
  else shortcutEntries.set(entry.url,entry);
  renderShortcuts();
  queue();
  announce(key === undefined ? '已添加到侧栏' : '已从侧栏移除');
}
async function copy(url) {
  try { await navigator.clipboard.writeText(url); announce('已复制链接'); }
  catch { announce('当前预览无法写入剪贴板'); }
}
function saveBookmark(entry) {
  BDemo.saveBookmark(entry);
  queue();
  announce('已收藏链接');
}
function editBookmark(entry) {
  const dialog=one('#edit-bookmark');
  const form=dialog.querySelector('form');
  const title=form.elements.title;
  const url=form.elements.url;
  title.value=entry.title;
  url.value=entry.url;
  form.onsubmit=e=>{
    if (e.submitter.value === 'cancel') return;
    e.preventDefault();
    try {
      const parsed=new URL(url.value);
      if (!['https:','http:'].includes(parsed.protocol)) throw new Error();
    } catch { url.setCustomValidity('请输入 http 或 https 网址');url.reportValidity();return; }
    BDemo.updateBookmark(entry.id,{title:title.value.trim() || entry.title,url:url.value});
    dialog.close();queue();
  };
  url.setCustomValidity('');
  url.oninput=()=>url.setCustomValidity('');
  dialog.showModal();
}
function tabRow(tab) {
  return result(tab, () => activate(tab), {tab:true, active:tab.active && tab.windowId === selectedWindow});
}
function bookmarkRow(entry) {
  const visit=()=>add(entry.url,entry.title);
  const pin=()=>toggleShortcut(entry);
  const edit=()=>editBookmark(entry);
  const pinned=isShortcut(entry);
  return result(entry,visit,{
    quick:[[(pinned?'取消固定':'固定到侧栏')+'：'+entry.title,'pin',pin,'row-optional'],['编辑：'+entry.title,'edit',edit,'row-optional']],
    menu:()=>[['打开书签',visit],[pinned?'取消固定':'固定到侧栏',pin],['编辑书签',edit],['复制链接',()=>copy(entry.url)],null,['删除书签',()=>{BDemo.deleteBookmark(entry.id);queue();announce('已删除样例书签');}]]
  });
}
function historyRow(entry) {
  const visit=()=>add(entry.url,entry.title);
  return result(entry,visit,{menu:()=>[['打开链接',visit],['复制链接',()=>copy(entry.url)],['收藏链接',()=>saveBookmark(entry)]]});
}
async function restoreSession(session) {
  const entry=session.tab || session.window;
  const restored=await demoBrowser.sessions.restore(entry.sessionId);
  if (restored.window) {
    const window=await demoBrowser.windows.create();
    selectedWindow=window.id;
    for (const tab of restored.window.tabs) await add(tab.url,tab.title,window.id);
  }
  queue();
  announce(session.tab?'已恢复标签页':'已恢复窗口');
}
function recentRow(session) {
  const restore=()=>restoreSession(session);
  return result(session.tab || {title:'窗口 · '+session.window.tabs.length+' 个标签',windowPreview:true},restore,{menu:()=>[['恢复',restore],...(session.tab?[['复制链接',()=>copy(session.tab.url)]]:[])]});
}
function section(title, count, content, {id=title, favicon, folder=false, menu, guides=true, defaultOpen=true}={}) {
  const key = moduleName+':'+id;
  const container = item('details',guides?'tree-section':'tree-section no-guides');
  const header = item('summary','tree-heading');
  const chevron = item('span','tree-chevron');
  chevron.innerHTML = glyph('chevron');
  header.append(chevron);
  if (favicon) header.append(fileIcon(favicon));
  if (folder) {
    const icon = item('span','tree-folder');
    icon.innerHTML = glyph('folder');
    header.append(icon);
  }
  header.append(item('span','result-title',title),item('small','tree-count',count));
  if (menu) {
    const open = () => aMenu().openModuleMenu(more,menu(container),'row',header);
    const more = rowControl('更多：'+title,'more',e=>{e.preventDefault();e.stopPropagation();open();},'row-more');
    more.setAttribute('aria-haspopup','menu');
    header.append(more);
    bindMenu(header,open);
  }
  const children = item('div','tree-children');
  children.append(...content);
  container.open = openedSections.get(key) ?? defaultOpen;
  container.ontoggle = () => {if (container.isConnected) openedSections.set(key,container.open);};
  container.append(header,children);
  return container;
}
function expandSections(name, open) {
  const nodes=all('[data-view="'+name+'"] details');
  for (const node of nodes) node.open=open;
  updateExpandTool(name);
}
function updateExpandTool(name) {
  const button=one('[data-view="'+name+'"] [data-expand-all]');
  if (!button) return;
  const opened=all('[data-view="'+name+'"] details[open]').length>0;
  const label=opened?'收起全部'+(name==='bookmarks'?'文件夹':'列表'):'展开全部'+(name==='bookmarks'?'文件夹':'列表');
  button.ariaLabel=button.title=label;
  button.dataset.open=String(opened);
}
function buildTools(name) {
  const view=one('[data-view="'+name+'"]');
  view.querySelector('.heading-icon').innerHTML=glyph(moduleIcons[name]);
  const area=view.querySelector('.heading-tools');
  const expand=iconButton('expand','收起全部列表',()=>expandSections(name,expand.dataset.open!=='true'));
  expand.dataset.expandAll='';
  const more=iconButton('more','更多',()=>aMenu().openModuleMenu(more,menu(),'header'));
  more.setAttribute('aria-haspopup','menu');
  const sorting = [['原始顺序',()=>{bookmarkSort='original';queue();}],['按名称排序',()=>{bookmarkSort='title';queue();}]];
  const menu=()=>name==='bookmarks' ? [
    [flatBookmarks?'按文件夹查看':'查看全部书签',()=>{flatBookmarks=!flatBookmarks;queue();}],
    [expand.title,()=>expand.click()],
    [bookmarkPane?'合并显示':'分区显示',()=>{bookmarkPane=!bookmarkPane;queue();}],
    null,...sorting
  ] : [[expand.title,()=>expand.click()]];
  if (name==='bookmarks') {
    expand.classList.add('wide-tool');
    const category=iconButton('sites','切换全部书签与文件夹',()=>{flatBookmarks=!flatBookmarks;queue();},'wide-tool');
    const arrangement=iconButton('split','切换书签分区显示',()=>{bookmarkPane=!bookmarkPane;queue();},'wide-tool');
    const sort=iconButton('sort','排序',()=>aMenu().openModuleMenu(sort,sorting,'header'));
    area.append(category,expand,arrangement,sort,more);
  } else if (name==='recent') {
    const restore=iconButton('restore','恢复最近关闭的标签页',async()=>{
      const [session]=await demoBrowser.sessions.getRecentlyClosed();
      if(session) await restoreSession(session);
    });
    restore.dataset.restoreLast='';
    area.append(expand,restore,more);
  } else area.append(expand,more);
}
for (const name of ['sites','bookmarks','recent']) buildTools(name);
one('#search-icon').innerHTML=glyph('search');
const settings=one('#rail-settings');
settings.innerHTML=glyph('settings');
settings.onclick=()=>aMenu().openModuleMenu(settings,[
  [shortcutVisibility?'隐藏快捷站点':'显示快捷站点',()=>{shortcutVisibility=!shortcutVisibility;renderShortcuts();}],
  [layout==='vertical'?'切换为横向标签':'切换为垂直标签',()=>send(layout==='vertical'?'b-horizontal':'b-vertical')]
],'footer');
renderShortcuts();
function makeBookmarkTree(nodes) {
  const lists=new Map();
  for (const node of nodes) {
    if (!lists.has(node.parentId)) lists.set(node.parentId,[]);
    lists.get(node.parentId).push(node);
  }
  const children = id => {
    const entries=lists.get(id) || [];
    return bookmarkSort==='title'?[...entries].sort((a,b)=>a.title.localeCompare(b.title,'zh-CN')):entries;
  };
  const links = id => children(id).flatMap(n=>n.url?[n]:links(n.id));
  const tree = id => children(id).map(n=>n.url?bookmarkRow(n):section(n.title,links(n.id).length,tree(n.id),{
    id:n.id,folder:true,defaultOpen:links(n.id).length>0,
    menu:()=>[['打开全部书签',links(n.id).length?async()=>{for(const entry of links(n.id))await add(entry.url,entry.title);}:null]]
  }));
  const flat=()=>section('全部书签',links('0').length,links('0').map(bookmarkRow),{id:'all',guides:false});
  if (flatBookmarks) return [flat()];
  return bookmarkPane?[...tree('0'),item('hr','results-separator'),flat()]:tree('0');
}
function dayName(offset) {

  const day=new Date();
  day.setDate(day.getDate()-offset);
  return (offset===0?'今天 · ':offset===1?'昨天 · ':'') + new Intl.DateTimeFormat('zh-CN',{year:'numeric',month:'long',day:'numeric',weekday:'long'}).format(day);
}
let renderRevision=0;
async function renderModule(tabs) {
  const revision=++renderRevision;
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
    const sections=[...domains].sort(([a],[b])=>a==='其他页面'?1:b==='其他页面'?-1:a.localeCompare(b));
    const label=(text,count)=>{
      const box=item('div','module-label');
      box.append(item('span','',text),item('small','tree-count',count));
      return box;
    };
    output.replaceChildren(
      ...(pinned.length ? [label('已固定',pinned.length),...pinned.map(tabRow),item('hr','results-separator')] : []),
      label('未固定',normal.length),
      ...sections.map(([key,rows])=>section(key,rows.length,rows.map(tabRow),{
        favicon:key==='其他页面'?null:rows[0],
        defaultOpen:tabs.length<20,
        menu:details=>[[details.open?'收起此站点':'展开此站点',()=>{details.open=!details.open;}]]
      }))
    );
  } else if (name === 'bookmarks') {
    output.replaceChildren(...makeBookmarkTree(nodes));
  } else if (name === 'recent') {
    const sessions = await demoBrowser.sessions.getRecentlyClosed();
    if (revision !== renderRevision) return;
    const days = Map.groupBy(sessions, session=>session.day||0);
    output.replaceChildren(...[...days].sort(([a],[b])=>a-b).map(([day,entries])=>section(dayName(day),entries.length,entries.map(recentRow),{id:'day-'+day})));
    if (!sessions.length) output.textContent = '暂无最近关闭的标签页';
    else output.append(item('p','results-note','最多显示 25 条最近关闭的会话。'));
    one('[data-restore-last]').disabled=!sessions.length;
  } else {
    const term = search.value.trim().toLocaleLowerCase();
    const match = item => (item.title + ' ' + item.url).toLocaleLowerCase().includes(term);
    const results = term ? tabs.filter(match) : tabs.slice(0,6);
    const bookmarks = term ? nodes.filter(n => n.url && match(n)) : [];
    const [history,sessions]=term ? await Promise.all([demoBrowser.history.search({text:term,startTime:0,maxResults:25}),demoBrowser.sessions.getRecentlyClosed()]) : [[],[]];
    if (revision !== renderRevision || term !== search.value.trim().toLocaleLowerCase()) return;
    const closed=sessions.filter(s=>s.tab?match(s.tab):s.window.tabs.some(match));
    const matches=history.filter(match).slice(0,25);
    output.replaceChildren();
    if (results.length) output.append(section(term ? '打开的标签页' : '推荐标签页', results.length, results.map(tabRow),{guides:false}));
    if (closed.length) output.append(section('最近关闭的标签页',closed.length,closed.map(recentRow),{guides:false}));
    if (bookmarks.length) output.append(section('收藏', bookmarks.length, bookmarks.map(bookmarkRow),{guides:false}));
    if (matches.length) output.append(section('历史', matches.length, matches.map(historyRow),{guides:false}));
    if (!output.childElementCount) output.textContent = '找不到任何结果';
  }
  output.ontoggle=e=>{if(e.target.matches('details'))updateExpandTool(name);};
  updateExpandTool(name);
}
function showModule(next, focusSearch = false) {
  if (next !== moduleName) aMenu().closeModuleMenu();
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
  const rows = (await BDemo.tabs()).filter(t => t.windowId === selectedWindow && /^https?:/.test(t.url));
  const keep = new Set();
  const duplicates = [];
  for (const tab of rows.sort((a,b) => Number(b.active || b.pinned) - Number(a.active || a.pinned))) {
    if (keep.has(tab.url) && !tab.pinned) duplicates.push(tab.id);
    else keep.add(tab.url);
  }
  if (!duplicates.length) { announce('当前窗口没有重复标签页');return; }
  const dialog=one('#deduplicate-confirm');
  const form=dialog.querySelector('form');
  const wid=selectedWindow;
  const list=dialog.querySelector('ul');
  list.replaceChildren(...rows.filter(t=>duplicates.includes(t.id)).map(t=>item('li','',t.title)));
  form.onsubmit=async e=>{
    if(e.submitter.value==='cancel') return;
    e.preventDefault();
    dialog.close();
    await BDemo.closeWindowTabs(wid,duplicates);
    queue();
    announce('已清理 ' + duplicates.length + ' 个重复标签页');
  };
  dialog.showModal();
}

for (const button of navigation) {
  const name = button.dataset.navigation;
  button.onclick = () => { showModule(name, true); send('b-hover', {navigation:name}); };
  button.onpointerenter = () => send('b-hover', {navigation:name});
}
search.oninput = queue;
one('#rail-new').onclick = () => { showModule('current'); return add(); };
one('#b-panel-toggle').onclick = () => send('b-toggle-panel');
one('#deduplicate').onclick = deduplicate;
const windowMore=one('#window-more');
windowMore.onclick=()=>aMenu().openModuleMenu(windowMore,[
  ['新建窗口',async()=>{
    selectedWindow=(await demoBrowser.windows.create()).id;
    await add();
  }],
  ['清理重复标签页',deduplicate]
],'header');
document.addEventListener('pointerdown', event => {
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
  if (event.key === 'Escape' && !event.target.closest('dialog')) send('b-escape');
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
