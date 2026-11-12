/* B v0.8: mount A's window region, and route operations to the existing B fixture. */
(() => {
'use strict';
const assetBase=new URL('window-a/assets/',location.href).href;
const send=data=>parent.postMessage(data,location.origin);
const makeShadow=(doc,name,html,css)=>{
 const host=doc.createElement(name), root=host.attachShadow({mode:'open'});
 const link=doc.createElement('link');link.rel='stylesheet';link.href=new URL('window-a/reference.css',location.href).href;
 const style=doc.createElement('style');style.textContent=css;
 root.append(link,style);const tpl=doc.createElement('template');tpl.innerHTML=html;root.append(tpl.content);
 return {host,root,ready:new Promise((resolve,reject)=>{link.onload=resolve;link.onerror=reject})};
};
const list=makeShadow(document,'zero-window-tabs','<div id="browser" class="browser"><div id="sidebar">'+WINDOW_A_MARKUP+'</div><div id="horizontal-list" hidden></div></div>',
 ':host{position:absolute;inset:0;display:block}#browser{height:100%;overflow:visible}#browser,#sidebar,#pin-dock,#new-tab-dock{background:var(--sp-bg,#cfe2ff)}#sidebar{width:100%}:host([dark]) #sidebar .tab{color:#e8eaed}:host([dark]) #sidebar .tab:is(.active,.selected,.context-target,:hover){color:#202124}:host([dark]) #sidebar .tab:not(:is(.active,.selected,.context-target,:hover)) img[src$="favicon-settings.svg"]{filter:invert(1)}');
const portal=makeShadow(parent.document,'zero-window-popups','<div id="hovercard" hidden></div><div id="popover" hidden></div><div id="context-menu" role="menu" hidden></div><div id="submenu" role="menu" hidden></div><div id="toast" role="status" hidden></div><div id="control-tooltip" role="tooltip" hidden></div>',
 ':host{position:absolute;inset:0;z-index:32;pointer-events:none}#popover,#context-menu,#submenu{pointer-events:auto}');
parent.document.body.append(portal.host);
const $=s=>list.root.querySelector(s)||portal.root.querySelector(s);
const $$=s=>[...list.root.querySelectorAll(s),...portal.root.querySelectorAll(s)];
const focused=()=>portal.root.activeElement||list.root.activeElement||document.activeElement;
const frameRect=()=>window.frameElement.getBoundingClientRect();
const rect=e=>{const r=e.getBoundingClientRect();if(e.ownerDocument!==document)return r;const f=frameRect();return new DOMRect(f.x+r.x,f.y+r.y,r.width,r.height)};
const state={tabs:[],groups:[],active:null,selected:new Set(),popup:null,drag:null,horizontal:false,collapsed:false,groupFooterShown:0};
let hoverTimer,toastTimer,tipTimer,leaveTimer,sideLayoutFrame,pendingScrollRestore,dragTarget,contextFocusId,submenuAnchor,popupAnchor,addressOpen=false;
let foreign=null, foreignRequest=0;
let view=null,last='',panel={layout:'vertical',panel:'expanded',manager:false},queue=Promise.resolve(),scheduled=false,pulling=0,ready=false;
function favicon(t){
 const src=t.icon==='bili'?'favicon-bili-reference.png':t.icon==='docs'?'site-docs.png':'';
 const img=t.type==='about'?assetBase+'favicon-settings.svg':t.icon==='google'?assetBase+'google-mark-reference.png':src?new URL('../client/assets/'+src,location.href).href:'';
 return '<span class="favicon">'+(img?'<img src="'+img+'" alt="">':window.ZERO_NATIVE_ICONS.zero)+'</span>';
}
function setLayout(){
 titleObserver.disconnect();for(const el of $$('.tab-label'))titleObserver.observe(el);
 const p=state.tabs.filter(t=>t.pinned).length;
 $('#pins').style.setProperty('--pin-cols',Math.max(1,Math.min(p,Math.floor(($('#sidebar').clientWidth-24+4)/36))));
 updateTitleOverflow();scheduleSideLayout();
}
function foreignRow(target=foreign){
 return target?.scope.isConnected && !target.scope.hidden ? target.scope.querySelector(target.selector) : null;
}
function focusTab(id=state.active){
 const target=foreign?foreignRow():$(`.tab[data-id="${id}"]`);
 target?.focus({preventScroll:true});
}
function hideControlTip(){clearTimeout(tipTimer);$('#control-tooltip').hidden=true}
function setPopup(value){if(state.popup===value)return;state.popup=value;window.BWindowPopupBusy=!!value;document.dispatchEvent(new Event('b-window-layer'))}
function clearPopups(){
 const had=!!state.popup;setPopup(null);hideControlTip();hideHover();
 for(const id of ['popover','context-menu','submenu'])$('#'+id).hidden=true;
 $('#popover').className='';$('#popover').removeAttribute('role');$('#popover').removeAttribute('aria-label');
 for(const x of $$('.context-target,.menu-open'))x.classList.remove('context-target','menu-open');
 foreignRow()?.classList.remove('context-target');
 if(had)schedule();
}
let externalMenuAnchor;
function dismissPopups(){const group=popupAnchor,was=state.popup;clearPopups();if(was==='external-menu')externalMenuAnchor?.focus({preventScroll:true});else if(was==='context')focusTab(contextFocusId);else if((was==='edit-group'||was==='confirm-group')&&foreign)focusTab();else if(was==='edit-group'||was==='confirm-group')($(`[data-group="${group}"]`)||$(`.tab[data-id="${state.active}"]`))?.focus({preventScroll:true});}
function toast(text){const t=$('#toast');t.textContent=text;t.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{t.hidden=true},2800)}
function visibleTabs(){return state.tabs.filter(t=>!t.group||!state.groups.find(g=>g.id===t.group)?.collapsed)}
const colors={grey:'#5f6368',blue:'#1a73e8',red:'#da3025',yellow:'#f9ab00',green:'#188038',pink:'#d01884',purple:'#a142f4',cyan:'#00838f',orange:'#fa903e'};
const colorKey=h=>Object.keys(colors).find(k=>colors[k]===h)||'grey';
function tabType(t){if(/^chrome:\/\/newtab/.test(t.url))return ['new','chrome','zero://newtab'];if(/^chrome:\/\/settings/.test(t.url))return ['about','chrome','zero://settings'];let h='';try{h=new URL(t.url).hostname}catch{}return ['doc',h.includes('bilibili.com')?'bili':h==='docs.qq.com'?'docs':h.includes('google.com')?'google':'chrome',h||t.url]}
function hasWindowSurface(){return panel.layout==='vertical'?panel.panel!=='compact':panel.manager;}
function schedule(){if(!scheduled){scheduled=true;requestAnimationFrame(()=>{scheduled=false;sync().catch(err=>console.error('窗口样例同步失败',err))})}}
function windowData(id,tabs){
 const rows=tabs.filter(t=>t.windowId===id).sort((a,b)=>a.index-b.index);
 const groups=BDemo.groups().filter(g=>g.windowId===id&&g.members.some(m=>rows.some(t=>t.id===m.tabId)));
 return {rows,groups};
}
function applyWindowData({rows,groups}){
 const active=rows.find(t=>t.active)?.id??rows[0]?.id;
 if(state.active!==active||!state.selected.size)state.selected=new Set(active==null?[]:[active]);
 state.active=active;
 state.tabs=rows.map(t=>{
  const [type,icon,domain]=tabType(t);
  return {...t,type,icon,domain,group:groups.find(g=>g.members.some(m=>m.tabId===t.id))?.id??null};
 });
 state.groups=groups.map(g=>({id:g.id,name:g.title,color:colors[g.color]||colors.grey,collapsed:!!g.collapsed}));
}
async function sync(force=false){
 const request=++pulling, slot=document.querySelector('[data-view=current] [data-current-view=windows]'), button=document.querySelector('[data-view=current] [data-action=select-window][aria-current=page]');
 if(!slot||!slot.offsetWidth||!button||document.querySelector('[data-navigation=current]')?.getAttribute('aria-current')!=='page'||!hasWindowSurface()){
  if(list.host.isConnected){clearPopups();list.host.remove();last=''}
  if(foreign&&(!hasWindowSurface()||!foreignRow())&&state.popup)clearPopups();
  return;
 }
 const id=Number(button.dataset.id), tabs=await BDemo.tabs();
 if(request!==pulling||!slot.isConnected)return schedule();
 if(foreign||view!==id){clearPopups();foreign=null;view=id;last='';state.selected=new Set();$('#side-scroll').scrollTop=0;$('#pins-scroll').scrollTop=0;}
 if(list.host.parentNode!==slot)slot.append(list.host);
 list.host.toggleAttribute('dark',document.documentElement.dataset.theme==='dark');
 if(!ready||(state.popup&&!force))return;
 const data=windowData(id,tabs),key=JSON.stringify([id,data]);
 if(key===last&&!force)return;
 last=key;const focusId=list.root.activeElement?.closest('.tab')?.dataset.id;
 applyWindowData(data);
 renderTabs();if(focusId!=null)focusTab(focusId);
}
async function openExternalTab(id,row,anchor,commands){
 const request=++foreignRequest;
 const scope=row.closest('.sp-view');
 const selector=row.dataset.tabId?`[data-current-view="sites"] [data-tab-id="${id}"]`:`[data-search-row="tab:${id}"]`;
 const tabs=await BDemo.tabs();
 if(request!==foreignRequest||!row.isConnected||scope.hidden||!hasWindowSurface())return;
 const tab=tabs.find(t=>t.id===id);
 if(!tab)return;
 clearPopups();
 if(list.host.isConnected){list.host.remove();last='';}
 foreign={scope,selector};
 view=tab.windowId;
 applyWindowData(windowData(view,tabs));
 state.selected=new Set([id]);
 const bounds=rect(anchor);
 showContext(state.tabs.find(t=>t.id===id),bounds.right-8,bounds.top+8,commands(tab));
 row.classList.add('context-target');
}
function openModuleMenu(anchor, items, align='row', returnFocus=anchor){
 clearPopups(); foreign=null; externalMenuAnchor=returnFocus;
 const menu=$('#context-menu'); menu.replaceChildren(); delete menu.dataset.multi;
 for(const entry of items){
  if(!entry){const line=document.createElement('div');line.className='menu-separator';line.role='separator';menu.append(line);continue}
  const [label,action]=entry, button=document.createElement('button');
  button.className='menu-item subitem';button.role='menuitem';button.textContent=label;button.disabled=!action;
  button.onclick=()=>{dismissPopups();action()};
  menu.append(button);
 }
 setPopup('external-menu');menu.hidden=false;
 const b=rect(anchor);
 positionBox(menu,align==='row'?b.right-8:align==='footer'?b.left:Math.max(b.left-menu.offsetWidth+b.width,8),align==='footer'?b.top-menu.offsetHeight-4:align==='row'?b.top+8:b.bottom+4);
 menu.querySelector('button:not(:disabled)')?.focus({preventScroll:true});
}
async function hoverExternalTab(id,row){
 const tab=(await BDemo.tabs()).find(t=>t.id===id);
 if(!tab||!row.isConnected||!row.matches(':hover'))return;
 const [type,icon,domain]=tabType(tab);
 scheduleHover({...tab,type,icon,domain},row,{active:tab.active&&tab.windowId===(window.BLastWindow||1)});
}
function mutate(fn,after){
 const wid=view, target=foreign;
 const run=async()=>{
  try{
   await fn(wid);
   if(target&&foreign===target&&foreignRow(target)){
    applyWindowData(windowData(wid,await BDemo.tabs()));
    after?.();
   }else if(!target){
    await sync(true);
    if(view===wid&&!foreign)after?.();
   }
  }catch(err){console.error(err);toast('固定样例中未完成此操作');schedule()}
 };
 queue=queue.then(run,run);return queue;
}
function groupCommand(action,id,windowId,extra={}){
 return demoBrowser.runtime.sendMessage({type:'host.sidebarGroups',action,groupId:id,windowId,...extra}).then(r=>{if(!r?.ok)throw Error(r?.error?.message||action);return r});
}
function groupWrite(g,props){
 const wid=view,run=()=>groupCommand('update',g.id,wid,props).catch(()=>toast('未能更新样例分组'));
 queue=queue.then(run,run);
}
function activate(id){
 const t=state.tabs.find(x=>x.id===id);if(!t)return;clearPopups();state.selected=new Set([id]);
 const had=!!list.root.activeElement?.closest('.tab');
 mutate(async wid=>{const g=state.groups.find(x=>x.id===t.group);if(g?.collapsed)await groupCommand('update',g.id,wid,{collapsed:false});await demoBrowser.tabs.update(id,{active:true})},()=>{const e=$(`.tab[data-id="${id}"]`);e?.scrollIntoView({block:'nearest',inline:'nearest'});if(had)focusTab(id)});
}
function newTab(after){
 clearPopups();
 mutate(async wid=>{const t=await demoBrowser.tabs.create({windowId:wid,index:after?after.index+1:undefined,active:true});if(after?.group&&!after.pinned){await groupCommand('assign',after.group,wid,{tabIds:[t.id]});await groupCommand('update',after.group,wid,{collapsed:false})}},()=>{const r=$(`.tab[data-id="${state.active}"]`);r?.scrollIntoView({block:'nearest'});focusTab()});
}
function closeTabs(ids){clearPopups();mutate(wid=>BDemo.closeWindowTabs(wid,ids),()=>focusTab())}
function closeGroup(g){closeTabs(state.tabs.filter(t=>t.group===g.id).map(t=>t.id))}
function reorder(from,to){
 const ids=state.tabs.map(t=>t.id).filter(id=>id!==from);ids.splice(ids.indexOf(to),0,from);
 mutate(wid=>BDemo.reorderWindow(wid,ids));
}
function setPinned(ids,pinned){
 const chosen=state.tabs.filter(t=>ids.includes(t.id));const remaining=state.tabs.filter(t=>!ids.includes(t.id));remaining.splice(remaining.filter(t=>t.pinned).length,0,...chosen);
 mutate(async wid=>{for(const g of state.groups){const inGroup=chosen.filter(t=>t.group===g.id).map(t=>t.id);if(inGroup.length)await groupCommand('ungroup',g.id,wid,{tabIds:inGroup})}for(const id of ids)await demoBrowser.tabs.update(id,{pinned});await BDemo.reorderWindow(wid,remaining.map(t=>t.id))});
}
function duplicate(ids){
 const original=state.tabs.filter(t=>ids.includes(t.id));
 mutate(async wid=>{for(const t of original){const raw=await demoBrowser.tabs.get(t.id);const copy=await demoBrowser.tabs.create({windowId:wid,index:raw.index+1,url:raw.url,active:false});await demoBrowser.tabs.update(copy.id,{title:raw.title,muted:!!raw.muted});if(t.group)await groupCommand('assign',t.group,wid,{tabIds:[copy.id]});if(t===original.at(-1))await demoBrowser.tabs.update(copy.id,{active:true});}},()=>focusTab());
}
function reload(ids){mutate(async()=>{for(const id of ids)await demoBrowser.tabs.reload(id);toast('已模拟重新加载所选 '+ids.length+' 个标签页')})}
function muteSites(ids,muted){
 const domains=new Set(state.tabs.filter(t=>ids.includes(t.id)).map(t=>t.domain));const targets=state.tabs.filter(t=>domains.has(t.domain)).map(t=>t.id);
 mutate(async()=>{for(const id of targets)await demoBrowser.tabs.update(id,{muted})});
}
function moveTabsToGroup(ids,target,create=false){
 let created=null;
 mutate(async wid=>{
  if(!create&&target==null){for(const g of BDemo.groups().filter(g=>g.windowId===wid)){const selected=g.members.filter(m=>ids.includes(m.tabId)).map(m=>m.tabId);if(selected.length)await groupCommand('ungroup',g.id,wid,{tabIds:selected})}return;}
  const r=await groupCommand('assign',target,wid,{tabIds:ids,title:'新建分组',color:'blue'});
  created=create?r.state.groups.find(g=>g.windowId===wid&&g.members.some(m=>ids.includes(m.tabId)))?.id:target;
  if(created!=null)await groupCommand('update',created,wid,{collapsed:false});
 },()=>{if(create){const g=state.groups.find(x=>x.id===created);if(g)showGroupEditor(g,foreignRow()||$(`[data-group="${g.id}"]`))}else focusTab(ids[0])});
}
/* A v0.10 app.js: extracted sidebar and popup functions. Host adapter points: scoped DOM, viewport, and B sample actions. See source-receipt.json. */
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const svg=(body,view='0 0 24 24')=>`<svg viewBox="${view}" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
const extra={collapse:svg('<path d="M4 6h16M4 12h10M4 18h16M20 9l-3 3 3 3"/>'),expand:svg('<path d="M4 6h16M10 12h10M4 18h16M4 9l3 3-3 3"/>'),chevron:svg('<path d="m6 9 6 6 6-6"/>'),mic:svg('<rect x="9" y="3" width="6" height="12" rx="3"/><path d="M6 10v2a6 6 0 0 0 12 0v-2M12 18v4m-3 0h6"/>'),lens:svg('<path d="M8 4H5a2 2 0 0 0-2 2v3m13-5h3a2 2 0 0 1 2 2v3M3 15v3a2 2 0 0 0 2 2h3m8 0h3a2 2 0 0 0 2-2v-3"/><circle cx="12" cy="12" r="4"/>'),devices:svg('<path d="M4 15V5h14v4M2 18h10m3-7h6v10h-6z"/>'),book:svg('<rect x="5" y="3" width="14" height="18" rx="1"/><path d="M8 7h8M8 11h8M8 15h8"/>')};
const icon=n=>window.GROUP_ICONS?.[n]||window.CHROME_ICONS[n]||extra[n]||extra.book;

function groupName(g){return g.name||'未命名分组';}
let overflowFrame;function updateTitleOverflow(){cancelAnimationFrame(overflowFrame);overflowFrame=requestAnimationFrame(()=>{$$('.tab-label').forEach(e=>e.classList.toggle('overflows',e.scrollWidth>e.clientWidth+1))});}
const titleObserver=new ResizeObserver(updateTitleOverflow);

function normalizeTabs(){
 const groupIds=new Set(state.groups.map(g=>g.id));for(const t of state.tabs){if(t.pinned||!groupIds.has(t.group))t.group=null;}
 const pins=state.tabs.filter(t=>t.pinned),rest=state.tabs.filter(t=>!t.pinned),seen=new Set(),ordered=[];
 for(const t of rest){if(!t.group)ordered.push(t);else if(!seen.has(t.group)){seen.add(t.group);ordered.push(...rest.filter(x=>x.group===t.group));}}
 state.tabs=[...pins,...ordered];state.groups=state.groups.filter(g=>state.tabs.some(t=>t.group===g.id));
 state.selected=new Set([...state.selected].filter(id=>state.tabs.some(t=>t.id===id)));if(!state.selected.size&&state.tabs.some(t=>t.id===state.active))state.selected.add(state.active);
}
function visibleTabs(){return state.tabs.filter(t=>state.horizontal||!t.group||!state.groups.find(g=>g.id===t.group)?.collapsed);}

function menuKeys(e,host){const items=[...host.querySelectorAll('button:not(:disabled)')],i=items.indexOf(focused());if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();e.stopPropagation();const n=e.key==='Home'?0:e.key==='End'?items.length-1:(i+(e.key==='ArrowDown'?1:-1)+items.length)%items.length;items[n]?.focus();}else if(e.key==='ArrowRight'&&focused()===submenuAnchor){e.preventDefault();e.stopPropagation();submenuAnchor.click();$('#submenu button')?.focus();}else if((e.key==='ArrowLeft'||e.key==='Escape')&&host.id==='submenu'){e.preventDefault();e.stopPropagation();host.hidden=true;submenuAnchor?.focus();}else if(e.key==='Escape'){e.preventDefault();e.stopPropagation();dismissPopups();}}
$('#context-menu').addEventListener('keydown',e=>menuKeys(e,$('#context-menu')));$('#submenu').addEventListener('keydown',e=>menuKeys(e,$('#submenu')));

function hideHover(){clearTimeout(hoverTimer);hoverTimer=null;$('#hovercard').hidden=true;}
function positionBox(box,x,y){box.style.left=Math.min(Math.max(x,8),Math.max(8,parent.innerWidth-box.offsetWidth-8))+'px';box.style.top=Math.min(Math.max(y,8),Math.max(8,parent.innerHeight-box.offsetHeight-8))+'px';}

function updateScrollEdges(e){const up=e.scrollTop>1,down=e.scrollHeight-e.clientHeight-e.scrollTop>1;e.dataset.scrollUp=String(up);e.dataset.scrollDown=String(down);}
function scheduleSideLayout(){cancelAnimationFrame(sideLayoutFrame);sideLayoutFrame=requestAnimationFrame(syncSideRegions)}
function syncSideRegions(){if(state.horizontal)return;const area=$('#tab-area'),dock=$('#pin-dock'),pins=$('#pins'),ps=$('#pins-scroll'),normal=$('#side-scroll'),list=$('#list'),footer=$('#new-tab-dock');const hasPins=!!pins.children.length;dock.hidden=!hasPins;const c=getComputedStyle(dock),gap=hasPins?['paddingTop','paddingBottom','marginTop','marginBottom','borderTopWidth','borderBottomWidth'].reduce((n,k)=>n+(parseFloat(c[k])||0),0):0;const available=Math.max(0,area.clientHeight-footer.offsetHeight-gap),normalPref=list.getBoundingClientRect().height,pinPref=pins.scrollHeight,minPin=Math.min(pinPref,state.collapsed?50:32),pinTarget=hasPins?Math.min(Math.max(minPin,Math.min(pinPref,Math.max(available-normalPref,available/2))),Math.max(0,available-Math.min(normalPref,30))):0;
 if(Math.abs(ps.clientHeight-pinTarget)>.1)ps.style.height=pinTarget+'px';const normalTarget=Math.max(0,Math.min(normalPref,available-pinTarget));if(Math.abs(normal.clientHeight-normalTarget)>.1)normal.style.height=normalTarget+'px';if(pendingScrollRestore){normal.scrollTop=pendingScrollRestore.normal;ps.scrollTop=pendingScrollRestore.pinned;pendingScrollRestore=null;}updateScrollEdges(normal);updateScrollEdges(ps);}

function createTab(t){const row=document.createElement('div');row.className='tab'+(t.pinned?' pinned':'')+(state.active===t.id?' active':'')+(state.selected.has(t.id)&&state.selected.size>1?' selected':'');row.dataset.id=t.id;row.role='tab';row.tabIndex=state.active===t.id?0:-1;row.setAttribute('aria-selected',String(state.active===t.id));row.setAttribute('aria-label',t.title+(t.muted?'，已静音':''));row.draggable=true;row.innerHTML=favicon(t)+`<span class="tab-label">${escape(t.title)}</span>${t.muted?'<span class="muted-marker" aria-label="已静音">'+icon('mute')+'</span>':''}<button class="close-tab" aria-label="关闭 ${escape(t.title)}">${icon('close')}</button>`;
 row.addEventListener('click',e=>{if(e.ctrlKey||e.metaKey){if(state.selected.has(t.id)){if(state.selected.size>1)state.selected.delete(t.id)}else state.selected.add(t.id);renderTabs();}else if(e.shiftKey){const list=visibleTabs(),a=list.findIndex(x=>x.id===state.active),b=list.indexOf(t);state.selected=new Set(list.slice(Math.min(a,b),Math.max(a,b)+1).map(x=>x.id));renderTabs();}else activate(t.id);});
 row.querySelector('.close-tab').addEventListener('mouseenter',()=>{hideHover();hideControlTip()});
 row.querySelector('.close-tab').addEventListener('click',e=>{e.stopPropagation();closeTabs([t.id]);});
 row.addEventListener('contextmenu',e=>{e.preventDefault();showContext(t,e.clientX+frameRect().left,e.clientY+frameRect().top);});
 row.addEventListener('mouseenter',()=>scheduleHover(t,row));row.addEventListener('mousemove',e=>{if(e.target.closest('.close-tab'))hideHover();else if($('#hovercard').hidden&&!hoverTimer)scheduleHover(t,row)});row.addEventListener('mouseleave',hideHover);
 row.addEventListener('keydown',e=>{if(e.target!==row)return;if(e.key==='Enter'||e.key===' '){e.preventDefault();activate(t.id)}else if(e.key==='Delete'){e.preventDefault();closeTabs([t.id])}else if(['ArrowDown','ArrowUp','ArrowRight','ArrowLeft'].includes(e.key)){e.preventDefault();const tabs=$$('.tab').filter(el=>el.offsetParent!==null),i=tabs.indexOf(row),next=tabs[(i+(e.key==='ArrowDown'||e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length];next?.focus();}else if(e.key==='ContextMenu'||e.key==='F10'&&e.shiftKey){e.preventDefault();const r=rect(row);showContext(t,r.right,r.top);}});
 row.addEventListener('dragstart',e=>{hideHover();clearPopups();state.drag=t.id;e.dataTransfer.setData('text/plain',t.id);e.dataTransfer.effectAllowed='move';row.classList.add('dragging');});
 row.addEventListener('dragover',e=>{const from=state.tabs.find(x=>x.id===state.drag);if(from&&from.id!==t.id&&!!from.pinned===!!t.pinned&&from.group===t.group){e.preventDefault();$$('.drop-before').forEach(x=>x.classList.remove('drop-before'));row.classList.add('drop-before');dragTarget=t.id;e.dataTransfer.dropEffect='move';}});
 row.addEventListener('drop',e=>{e.preventDefault();if(dragTarget===t.id){const from=state.drag;state.drag=null;dragTarget=null;reorder(from,t.id);}});row.addEventListener('dragend',()=>{state.drag=null;dragTarget=null;$$('.dragging,.drop-before').forEach(e=>e.classList.remove('dragging','drop-before'));});return row;
}
function renderTabs(){
 normalizeTabs();hideHover();const scroll=$('#side-scroll').scrollTop,pinScroll=$('#pins-scroll').scrollTop;$('#pins').replaceChildren();$('#list').replaceChildren();$('#horizontal-list').replaceChildren();setLayout();
 if(state.horizontal){state.tabs.forEach(t=>$('#horizontal-list').append(createTab(t)));return;}
 state.tabs.filter(t=>t.pinned).forEach(t=>$('#pins').append(createTab(t)));const seen=new Set();
 for(const t of state.tabs.filter(t=>!t.pinned)){
  if(!t.group){$('#list').append(createTab(t));continue;}if(seen.has(t.group))continue;seen.add(t.group);const g=state.groups.find(g=>g.id===t.group);
  const section=document.createElement('div');section.className='group'+(g.collapsed?' folded':'');section.style.setProperty('--group-color',g.color);section.innerHTML=`<div class="group-header"><button class="group-head" data-group="${g.id}" aria-label="${g.collapsed?'展开':'折叠'}分组 ${escape(groupName(g))}" aria-expanded="${!g.collapsed}"><span class="group-name">${escape(g.name)}</span>${extra.chevron.replace('<svg','<svg class="chevron"')}</button><button class="group-more" data-group-more="${g.id}" aria-label="更多：${escape(groupName(g))}" aria-haspopup="dialog">${icon('more')}</button></div><div class="group-body"></div>`;
  const head=section.querySelector('.group-head'),more=section.querySelector('.group-more');head.onclick=()=>{g.collapsed=!g.collapsed;groupWrite(g,{collapsed:g.collapsed});renderTabs();$(`[data-group="${g.id}"]`)?.focus({preventScroll:true})};head.oncontextmenu=e=>{e.preventDefault();showGroupEditor(g,more)};more.onclick=()=>showGroupEditor(g,more);more.oncontextmenu=e=>{e.preventDefault();showGroupEditor(g,more)};
  head.onmouseenter=()=>scheduleGroupHover(g,head);head.onmouseleave=e=>{if(!e.relatedTarget?.closest?.('#hovercard')){clearTimeout(hoverTimer);hoverTimer=setTimeout(hideHover,160)}};more.onmouseenter=hideHover;
  head.onkeydown=e=>{if(e.key==='ContextMenu'||(e.shiftKey&&e.key==='F10')){e.preventDefault();showGroupEditor(g,more)}};
  state.tabs.filter(x=>x.group===g.id).forEach(x=>section.querySelector('.group-body').append(createTab(x)));$('#list').append(section);
 }pendingScrollRestore={normal:scroll,pinned:pinScroll};syncSideRegions();
}

function scheduleHover(t,row,external){hideHover();if(state.popup||state.drag||addressOpen)return;hoverTimer=setTimeout(()=>{hoverTimer=null;if(!row.isConnected||!row.matches(':hover')||row.querySelector('.close-tab,.sp-row-actions:hover')?.matches(':hover')||state.popup||addressOpen)return;const r=rect(row);const preview=external?!external.active:t.id!==state.active;$('#hovercard').innerHTML=`<div class="hover-title">${escape(t.title)}</div><div class="hover-domain">${escape(t.domain)}</div>${preview?`<div class="preview"><img src="${assetBase}preview-${t.type==='new'?'newtab':t.type==='about'?'settings':'web'}.png" alt="本地样例页面缩略图"></div>`:''}`;$('#hovercard').hidden=false;const sr=external?frameRect():rect($('#sidebar'));positionBox($('#hovercard'),!external&&(state.horizontal||t.pinned)?r.left:Math.max(r.right,sr.right)-10,!external&&(state.horizontal||t.pinned)?r.bottom:r.top);},500);}

function scheduleGroupHover(g,head){hideHover();if(state.popup||state.drag||addressOpen)return;hoverTimer=setTimeout(()=>{hoverTimer=null;if(!head.isConnected||!head.matches(':hover')||state.popup)return;const tabs=state.tabs.filter(t=>t.group===g.id),card=$('#hovercard');card.innerHTML=`<div class="group-preview"><div>${escape(groupName(g))}（${tabs.length} 个标签页）</div><ul>${tabs.map(t=>`<li><span>${escape(t.title)}</span></li>`).join('')}</ul></div>`;card.hidden=false;const r=rect(head);positionBox(card,rect($('#sidebar')).right-12,r.top);},500)}

const groupColors=[['灰色','#5f6368'],['蓝色','#1a73e8'],['红色','#da3025'],['黄色','#f9ab00'],['绿色','#188038'],['粉色','#d01884'],['紫色','#a142f4'],['青色','#00838f'],['橙色','#fa903e']];
function syncGroupVisual(g){const head=$(`[data-group="${g.id}"]`);if(!head)return;head.querySelector('.group-name').textContent=g.name;head.setAttribute('aria-label',(g.collapsed?'展开':'折叠')+'分组 '+groupName(g));head.closest('.group').style.setProperty('--group-color',g.color);const more=$(`[data-group-more="${g.id}"]`);more?.setAttribute('aria-label','更多：'+groupName(g))}

function groupConfirm(g,action){clearPopups();setPopup('confirm-group');popupAnchor=g.id;const name=groupName(g),del=action==='delete',box=$('#popover');box.className='group-confirm';box.role='alertdialog';box.setAttribute('aria-label',del?'删除标签页组':'取消分组');box.innerHTML=`<h3>${del?'删除标签页组':'取消分组'}“${escape(name)}”？</h3><p>${del?'将关闭此组的样例标签，并移除本次演示中的分组记录。':'标签页保持打开，移除分组。'}</p><div><button data-confirm="cancel">取消</button><button data-confirm="yes">${del?'删除':'取消分组'}</button></div>`;box.hidden=false;positionBox(box,Math.max(8,(parent.innerWidth-320)/2),Math.max(8,(parent.innerHeight-box.offsetHeight)/2));box.querySelector('[data-confirm="cancel"]').onclick=()=>{clearPopups();$(`[data-group="${g.id}"]`)?.focus({preventScroll:true})};box.querySelector('[data-confirm="yes"]').onclick=()=>{clearPopups();if(del)closeTabs(state.tabs.filter(t=>t.group===g.id).map(t=>t.id));else moveTabsToGroup(state.tabs.filter(t=>t.group===g.id).map(t=>t.id),null)};box.querySelector('[data-confirm="cancel"]').focus();}
function showGroupEditor(g,anchor){clearPopups();if(state.collapsed&&!state.peek){setLayout()}setPopup('edit-group');popupAnchor=g.id;const more=(foreign?foreignRow():$(`[data-group-more="${g.id}"]`))||anchor,box=$('#popover');more?.closest('.group-header')?.classList.add('menu-open');box.className='group-menu';box.role='dialog';box.setAttribute('aria-label','编辑标签页组 '+groupName(g));const footer=state.groupFooterShown++<5&&!new URLSearchParams(location.search).has('nofooter');
box.innerHTML=`<form class="chrome-group-editor"><div class="group-controls"><input aria-label="分组名称" placeholder="为此分组命名" maxlength="80" value="${escape(g.name)}"><div class="color-options" role="group" aria-label="分组颜色">${groupColors.map(([name,c])=>`<button type="button" class="color-choice" style="--choice-color:${c}" data-color="${c}" aria-label="${name}" aria-pressed="${c===g.color}"></button>`).join('')}</div></div><div class="group-menu-separator" role="separator"></div><div class="group-actions"><button type="button" aria-label="在组内添加新标签页" data-group-action="new">${icon('group-add')}<span>在组内添加新标签页</span><kbd>Alt+Shift+C</kbd></button><button type="button" aria-label="将分组移至新窗口" data-group-action="move">${icon('group-move')}<span>将分组移至新窗口</span></button><button type="button" aria-label="关闭标签页组" data-group-action="close">${icon('group-close')}<span>关闭标签页组</span><kbd>Alt+Shift+W</kbd></button></div><div class="group-menu-separator" role="separator"></div><div class="group-actions"><button type="button" aria-label="取消分组" data-group-action="ungroup">${icon('group-ungroup')}<span>取消分组</span></button><button type="button" aria-label="删除标签页组" data-group-action="delete">${icon('group-delete')}<span>删除标签页组</span></button></div>${footer?'<div class="group-save-info">您的标签页分组现在会自动保存。<a href="#" class="group-learn-more">详细了解标签页</a></div>':''}</form>`;
box.hidden=false;const r=more?rect(more):frameRect();positionBox(box,r.left-4,r.bottom+3);box.querySelector('input').oninput=e=>{g.name=e.target.value;syncGroupVisual(g);groupWrite(g,{title:g.name})};box.querySelector('form').onsubmit=e=>{e.preventDefault();dismissPopups()};box.querySelectorAll('[data-color]').forEach(b=>b.onclick=()=>{g.color=b.dataset.color;groupWrite(g,{color:colorKey(g.color)});box.querySelectorAll('[data-color]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));syncGroupVisual(g)});box.querySelectorAll('[data-group-action]').forEach(b=>b.onclick=()=>{const action=b.dataset.groupAction;if(action==='new'){const last=state.tabs.filter(t=>t.group===g.id).at(-1);newTab(last)}else if(action==='close')closeGroup(g);else if(action==='move'){clearPopups();toast('移至新窗口：Windows 原生标签归属本轮未模拟，当前组保持不变');focusTab()}else groupConfirm(g,action)});box.querySelector('.group-learn-more')?.addEventListener('click',e=>{e.preventDefault();toast('本地演示只在本次页面内保留分组；没有账号同步，刷新重置')});box.querySelector('input').focus({preventScroll:true});}
$('#popover').addEventListener('keydown',e=>{if(state.popup==='edit-group'){const colors=[...$('#popover').querySelectorAll('.color-choice')],i=colors.indexOf(focused()),actions=[...$('#popover').querySelectorAll('[data-group-action]')],a=actions.indexOf(focused());if(i>=0&&['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();const b=colors[(i+(e.key==='ArrowRight'?1:-1)+colors.length)%colors.length];b.focus();b.click()}else if(['ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();actions[(a+(e.key==='ArrowDown'?1:-1)+actions.length)%actions.length]?.focus()}}if(['edit-group','confirm-group'].includes(state.popup)&&e.key==='Tab'){const items=[...$('#popover').querySelectorAll('input,button:not(:disabled),a[href]')],i=items.indexOf(focused());if(e.shiftKey&&i===0){e.preventDefault();items.at(-1).focus()}else if(!e.shiftKey&&i===items.length-1){e.preventDefault();items[0].focus()}}});
function showContext(t,x,y,commands=[]){clearPopups();contextFocusId=t.id;if(!state.selected.has(t.id))state.selected=new Set([t.id]);if(!foreign)renderTabs();const ids=[...state.selected],multi=ids.length>1;setPopup('context');$(`.tab[data-id="${t.id}"]`)?.classList.add('context-target');const allPinned=ids.every(id=>state.tabs.find(t=>t.id===id)?.pinned),allMuted=ids.every(id=>state.tabs.find(t=>t.id===id)?.muted);const menu=$('#context-menu');menu.dataset.multi=String(multi);menu.replaceChildren();
 const sep=()=>{const el=document.createElement('div');el.className='menu-separator';el.role='separator';menu.append(el)};
 const item=(label,action,key='',ic='',disabled=false)=>{const b=document.createElement('button');b.className='menu-item';b.role='menuitem';b.setAttribute('aria-label',label);b.disabled=disabled;b.innerHTML=(ic?`<span class="menu-icon">${icon(ic)}</span>`:'')+`<span>${label}</span>`+(key?`<span class="shortcut-key">${key}</span>`:'');b.onclick=()=>{if(action)action();};menu.append(b);return b};
 const done=fn=>()=>{clearPopups();fn();focusTab();};
 item('在下方新增标签页',done(()=>newTab(t)));
 item(multi?'在拆分视图中显示标签页':'使用当前标签页创建新的拆分视图',()=>toast('拆分视图：本轮未模拟'),'','split',multi);
 const groupBtn=item(state.groups.length?'向群组中添加标签页':'添加到新标签页组',()=>showGroupSubmenu(groupBtn,ids));submenuAnchor=groupBtn;groupBtn.setAttribute('aria-haspopup','menu');groupBtn.innerHTML+='<span class="arrow">›</span>';groupBtn.onmouseenter=()=>showGroupSubmenu(groupBtn,ids);
 item('将标签页移至新窗口',()=>toast('跨窗口标签归属：需 Windows 客户端验证，本轮未模拟'));sep();
 item('重新加载',done(()=>reload(ids)),'Ctrl+R');
 item('复制',done(()=>duplicate(ids)));
 item(allPinned?'取消固定':'固定',done(()=>{setPinned(ids,!allPinned);if(!foreign)renderTabs()}));
 item(allMuted?(multi?'取消这些网站静音':'取消这个网站静音'):(multi?'将这些网站静音':'将这个网站静音'),done(()=>{muteSites(ids,!allMuted)}));sep();
 item('添加到阅读清单',()=>toast('阅读清单：本轮未模拟'),'','book');item('发送到您的设备',()=>toast('设备发送与账号连接：本轮未模拟'),'','devices').innerHTML+='<span class="arrow">›</span>';sep();
 if(commands.length){for(const [label,action] of commands)item(label,()=>{clearPopups();focusTab();action()}).dataset.moduleCommand='';sep();}
 item(state.horizontal?'垂直显示标签页':'水平显示标签页',done(()=>{send({type:'b-horizontal'})}));sep();
 item('关闭',done(()=>closeTabs(ids)),'Ctrl+W');item('关闭其他标签页',done(()=>closeTabs(state.tabs.filter(t=>!ids.includes(t.id)&&!t.pinned).map(t=>t.id))));const cutoff=Math.max(...ids.map(id=>state.tabs.findIndex(t=>t.id===id)));item('关闭下方标签页',done(()=>closeTabs(state.tabs.slice(cutoff+1).filter(t=>!t.pinned).map(t=>t.id))));menu.hidden=false;positionBox(menu,x,y);menu.querySelector('button:not(:disabled)')?.focus({preventScroll:true});
}
function showGroupSubmenu(button,ids){const sub=$('#submenu');sub.replaceChildren();function add(label,fn,color){const b=document.createElement('button');b.className='menu-item subitem';b.role='menuitem';b.innerHTML=(color?`<span class="dot" style="background:${color}"></span>`:'')+escape(label);b.onclick=()=>{clearPopups();fn();};sub.append(b)}
 add('新建群组',()=>{moveTabsToGroup(ids,null,true)});for(const g of state.groups)add(g.name,()=>moveTabsToGroup(ids,g.id),g.color);if(ids.some(id=>state.tabs.find(t=>t.id===id)?.group))add('从群组中移除',()=>moveTabsToGroup(ids,null));sub.hidden=false;const r=button.getBoundingClientRect();positionBox(sub,r.right-2,r.top);if(parseFloat(sub.style.left)<r.right-10)sub.style.left=Math.max(8,r.left-sub.offsetWidth+2)+'px';}

$('#new-tab').innerHTML=icon('plus');$('#new-tab').onclick=()=>newTab();
for(const e of [$('#side-scroll'),$('#pins-scroll')])e.addEventListener('scroll',()=>{updateScrollEdges(e);hideHover()},{passive:true});
$('#hovercard').onmouseenter=()=>{clearTimeout(hoverTimer);send({type:'b-hover'})};$('#hovercard').onmouseleave=()=>{hideHover();send({type:'b-leave'})};
function showTip(delay){
 hideControlTip();tipTimer=setTimeout(()=>{if(state.popup||!list.host.isConnected)return;const b=$('#new-tab'),r=rect(b),t=$('#control-tooltip');t.textContent=b.ariaLabel;t.hidden=false;positionBox(t,r.left,r.bottom+6+t.offsetHeight>parent.innerHeight-8?r.top-t.offsetHeight-6:r.bottom+6)},delay);
}
$('#new-tab').onmouseenter=()=>showTip(550);$('#new-tab').onmouseleave=hideControlTip;
$('#new-tab').onfocus=()=>showTip(0);$('#new-tab').onblur=hideControlTip;
const outside=e=>{if(!e.composedPath().some(n=>n===portal.host||n?.matches?.('.group-header'))){clearPopups()}};
document.addEventListener('pointerdown',outside,true);parent.document.addEventListener('pointerdown',outside,true);
function shortcuts(e){
 if(!list.host.isConnected&&!state.popup)return;
 const input=e.composedPath().some(n=>n?.matches?.('input,textarea,[contenteditable=true]'));
 if(e.key==='Escape'&&state.popup){e.preventDefault();e.stopImmediatePropagation();dismissPopups();return}
 if(input||!list.host.isConnected)return;
 if(e.altKey&&e.shiftKey&&['c','w'].includes(e.key.toLowerCase())){const g=state.groups.find(x=>x.id===(state.popup==='edit-group'?popupAnchor:state.tabs.find(t=>t.id===state.active)?.group));if(g){e.preventDefault();e.stopImmediatePropagation();if(e.key.toLowerCase()==='c')newTab(state.tabs.filter(t=>t.group===g.id).at(-1));else closeGroup(g)}}
 if((e.ctrlKey||e.metaKey)&&['t','w'].includes(e.key.toLowerCase())&&!e.shiftKey){e.preventDefault();e.stopImmediatePropagation();if(e.key.toLowerCase()==='t')newTab();else closeTabs([...state.selected]);}
}
document.addEventListener('keydown',shortcuts,true);
portal.root.addEventListener('keydown',e=>{if(e.key==='Escape'&&e.target.closest('#submenu,#context-menu')&&state.popup!=='external-menu')return;shortcuts(e)});
parent.addEventListener('message',e=>{if(e.origin!==location.origin||!e.data)return;
 if(e.source===parent&&e.data.type==='b-panel-state'){panel=e.data;schedule();}
 if(e.source===parent.document.querySelector('#client-frame')?.contentWindow&&e.data.type==='b-outside')clearPopups();
});
new MutationObserver(m=>{if(m.some(x=>!x.target.closest?.('zero-window-tabs')))schedule()}).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['aria-current','data-current-view','data-theme']});
new ResizeObserver(()=>{if(list.host.isConnected)setLayout()}).observe(list.host);
window.addEventListener('resize',()=>{clearPopups();schedule()});
window.BWindowA={
 ready:Promise.all([list.ready,portal.ready]).then(async()=>{ready=true;await sync()}),
 render:schedule,
 openExternalTab,
 openModuleMenu,
 closeModuleMenu:()=>{if(state.popup==='external-menu')dismissPopups()},
 hoverExternalTab,
 hideExternalHover:hideHover,
 scene:async name=>{await sync();if(name==='menu'){const row=$('.tab[data-id="12"]'),r=rect(row);showContext(state.tabs.find(t=>t.id===12),r.right-8,r.top+10)}if(name==='group'){const g=state.groups.find(g=>g.id===-2);showGroupEditor(g,$('[data-group-more="-2"]'))}}
};
})();
