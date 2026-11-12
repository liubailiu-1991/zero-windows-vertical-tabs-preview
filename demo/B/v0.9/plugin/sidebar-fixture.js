'use strict';
(() => {
  const windows = [{ id:1 }, { id:2 }];
  let nextId = 100;
  const tabs = [
    { id:11, windowId:1, title:'哔哩哔哩', url:'https://www.bilibili.com/', pinned:true, active:true },
    { id:12, windowId:1, title:'腾讯文档', url:'https://docs.qq.com/' },
    { id:13, windowId:1, title:'浏览器设置', url:'chrome://settings' },
    { id:14, windowId:1, title:'壁纸 - Google 搜索', url:'https://www.google.com/search?q=壁纸' },
    { id:21, windowId:2, title:'哔哩哔哩 · 窗口2', url:'https://www.bilibili.com/?source=window2', active:true },
    { id:22, windowId:2, title:'Google', url:'https://www.google.com/' }
  ];
  const groups = [
    { id:-2, windowId:1, title:'研究资料', color:'blue', collapsed:false, members:[{tabId:12}] },
    { id:-3, windowId:2, title:'产品规划', color:'green', collapsed:false, members:[{tabId:22}] }
  ];
  const nodes = [
    { id:'1', parentId:'0', title:'收藏栏' },
    { id:'2', parentId:'0', title:'其他收藏' },
    { id:'10', parentId:'1', title:'项目资料' },
    { id:'20', parentId:'1', title:'稍后阅读' },
    { id:'11', parentId:'10', title:'哔哩哔哩', url:'https://www.bilibili.com/' },
    { id:'12', parentId:'10', title:'腾讯文档资料', url:'https://docs.qq.com/?source=bookmark' },
    { id:'13', parentId:'20', title:'Google 搜索', url:'https://www.google.com/' }
  ];
  let recent = [
    { tab:{ sessionId:'bili', title:'哔哩哔哩 · 最近关闭', url:'https://www.bilibili.com/?source=restored' } },
    { window:{ sessionId:'docs', tabs:[{ title:'腾讯文档 · 已关闭窗口', url:'https://docs.qq.com/?source=restored' }] } }
  ];
  const history = [{ title:'哔哩哔哩 · 浏览记录样例', url:'https://www.bilibili.com/?source=history-sample' }];
  if (new URLSearchParams(location.search).get('data') === 'many') {
    const examples = [tabs[0], tabs[1], tabs[5]];
    for (let i = 0; i < 54; i++) {
      const sample = examples[i % examples.length];
      const title = sample.title + ' · 研究资料 ' + (i + 1) + (i % 7 === 0 ? ' — 长标题与可用宽度对照' : '');
      tabs.push({ id:++nextId, windowId:i < 42 ? 1 : 2, title, url:sample.url + '?sample=' + i, pinned:i < 12 });
      nodes.push({ id:'many-' + i, parentId:i % 2 ? '10' : '20', title, url:sample.url + '?bookmark=' + i });
      history.push({ title:title + ' · 浏览记录', url:sample.url + '?history=' + i });
    }
    recent = recent.concat(history.slice(1,20).map((entry,i) => ({tab:{...entry,sessionId:'many-' + i}})));
  }
  let activeWindow = 1;
  const tabEvents = new Set();
  const sessionEvents = new Set();
  const event = listeners => ({ addListener: listener => listeners.add(listener) });
  const changed = () => tabEvents.forEach(listener => listener());
  const sessionChanged = () => sessionEvents.forEach(listener => listener());
  const notify = tab => parent.postMessage({type:'b-active',tab:structuredClone(tab)},location.origin);
  const windowTabs = wid => tabs.filter(tab => tab.windowId === wid);
  const tabList = () => windows.flatMap(w => windowTabs(w.id).map((tab,index) => ({ ...tab,index })));
  function activate(tab) {
    for (const row of windowTabs(tab.windowId)) row.active = row === tab;
    activeWindow = tab.windowId;
    notify(tab);
  }
  function create({ windowId = activeWindow, index, url = 'chrome://newtab/', title = '新标签页', active = true }) {
    const tab = { id:++nextId, windowId, url, title, active:false, pinned:false };
    const nextTab = windowTabs(windowId)[index];
    tabs.splice(nextTab ? tabs.indexOf(nextTab) : tabs.length,0,tab);
    if (active) activate(tab);
    changed();
    return { ...tab };
  }
  function get(id) {
    const tab = tabList().find(item => item.id === id);
    if (!tab) throw new Error('找不到该标签页');
    return tab;
  }
  function update(id, properties) {
    const tab = tabs.find(t => t.id === id);
    if (!tab) throw new Error('找不到该标签页');
    Object.assign(tab,properties);
    if (properties.active) activate(tab);
    changed();
    return get(id);
  }
  function removeGroupMembers(ids) {
    for (const group of groups) group.members = group.members.filter(item => !ids.includes(item.tabId));
  }
  function closeWindowTabs(wid, ids) {
    const previous = windowTabs(wid);
    const activeIndex = previous.findIndex(t => t.active);
    for (const tab of previous.filter(t => ids.includes(t.id))) {
      tabs.splice(tabs.indexOf(tab), 1);
      recent.unshift({ tab:{ ...tab, sessionId:'closed-' + (++nextId) } });
    }
    recent = recent.slice(0,25);
    removeGroupMembers(ids);
    const remaining = windowTabs(wid);
    if (!remaining.some(t => t.active)) {
      const next = remaining[Math.min(Math.max(0,activeIndex),remaining.length - 1)];
      if (next) {
        next.active = true;
        if (wid === activeWindow) notify(next);
      } else create({ windowId:wid, active:wid === activeWindow });
    }
    changed();
    sessionChanged();
  }
  function reorderWindow(wid, ids) {
    const nextOrder = ids.map(id => tabs.find(t => t.id === id && t.windowId === wid));
    if (nextOrder.length !== windowTabs(wid).length || nextOrder.includes(undefined) || new Set(ids).size !== ids.length) return;
    let index = 0;
    tabs.forEach((tab,i) => { if (tab.windowId === wid) tabs[i] = nextOrder[index++]; });
    changed();
  }
  function groupCommand(message) {
    const { action, groupId, windowId, tabIds = [], title, color, collapsed } = message;
    let group = groups.find(item => item.id === groupId);
    if (action === 'assign') {
      if (!group) {
        group = {id:-(++nextId),windowId,title,color,collapsed:false,members:[]};
        groups.push(group);
      }
      removeGroupMembers(tabIds);
      group.members.push(...tabIds.map(tabId => ({tabId})));
      for (const id of tabIds) update(id,{pinned:false});
    } else if (group && action === 'update') {
      if (title !== undefined) group.title = title;
      if (color !== undefined) group.color = color;
      if (collapsed !== undefined) group.collapsed = collapsed;
    } else if (group && action === 'ungroup') {
      group.members = group.members.filter(item => !tabIds.includes(item.tabId));
    }
    changed();
    return {ok:true,state:{groups:structuredClone(groups)}};
  }
  function createWindow() {
    const window = {id:++nextId};
    windows.push(window);
    changed();
    return { ...window };
  }
  function restore(sessionId) {
    const index = recent.findIndex(item => (item.tab || item.window).sessionId === sessionId);
    if (index === -1) throw new Error('找不到该记录');
    const [entry] = recent.splice(index,1);
    if (entry.tab) create({ ...entry.tab, windowId:activeWindow, active:true });
    sessionChanged();
    return structuredClone(entry);
  }
  window.demoBrowser = {
    tabs: {
      create:async props => create(props),
      get:async id => get(id),
      update:async (id,props) => update(id,props),
      reload:async () => {},
      onCreated:event(tabEvents),
      onActivated:event(tabEvents)
    },
    windows: { getAll:async () => structuredClone(windows), create:async () => createWindow() },
    sessions: {getRecentlyClosed:async () => structuredClone(recent), restore:async id => restore(id), onChanged:event(sessionEvents)},
    history: {search:async () => structuredClone(history)},
    runtime: {sendMessage:async message => groupCommand(message)}
  };
  window.BDemo = {
    tabs:async () => tabList(),
    groups:() => structuredClone(groups.filter(group => group.members.length)),
    snapshot:() => ({nodes:structuredClone(nodes)}),
    closeWindowTabs,
    reorderWindow
  };
  window.addEventListener('message', event => {
    if (event.source !== parent || event.origin !== location.origin || event.data?.type !== 'b-navigate') return;
    const tab = windowTabs(activeWindow).find(row => row.active);
    const next = event.data.tab;
    if (tab && next?.url && next?.title) update(tab.id, {title:next.title,url:next.url,active:true});
  });
  notify(tabs[0]);
})();
