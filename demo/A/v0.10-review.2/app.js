(()=>{'use strict';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const svg=(body,view='0 0 24 24')=>`<svg viewBox="${view}" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
const extra={collapse:svg('<path d="M4 6h16M4 12h10M4 18h16M20 9l-3 3 3 3"/>'),expand:svg('<path d="M4 6h16M10 12h10M4 18h16M4 9l3 3-3 3"/>'),chevron:svg('<path d="m6 9 6 6 6-6"/>'),mic:svg('<rect x="9" y="3" width="6" height="12" rx="3"/><path d="M6 10v2a6 6 0 0 0 12 0v-2M12 18v4m-3 0h6"/>'),lens:svg('<path d="M8 4H5a2 2 0 0 0-2 2v3m13-5h3a2 2 0 0 1 2 2v3M3 15v3a2 2 0 0 0 2 2h3m8 0h3a2 2 0 0 0 2-2v-3"/><circle cx="12" cy="12" r="4"/>'),devices:svg('<path d="M4 15V5h14v4M2 18h10m3-7h6v10h-6z"/>'),book:svg('<rect x="5" y="3" width="14" height="18" rx="1"/><path d="M8 7h8M8 11h8M8 15h8"/>')};
const icon=n=>window.GROUP_ICONS?.[n]||window.CHROME_ICONS[n]||extra[n]||extra.book;
function favicon(t){
 const base=t.type==='about'?'<img src="assets/favicon-settings.svg" alt="">':t.icon==='chrome'?window.ZERO_NATIVE_ICONS.zero:t.icon==='google'?'<img src="assets/google-mark-reference.png" alt="">':(()=>{const marks={blue:['研','#225aad'],cloud:['云','#03788c'],dark:['录','#566272'],ai:['AI','#245dc0'],chat:['AI','#54647a'],green:['导','#27824a'],red:['助','#b83c58']},[text,color]=marks[t.icon]||['文','#5b6573'];return `<span class="sample-mark" data-demo-icon="true" style="background:${color}">${text}</span>`})();
 return `<span class="favicon">${base}${t.unread?'<span class="unread"></span>':''}</span>`;
}
const seed=[['t1','新标签页','zero://newtab','chrome','new'],['t2','资料研究 — 浏览器设计','research.example.test','blue','doc'],['t3','更新日志 | 示例工具','updates.example.test','dark','doc'],['t4','资料导航 · 示例页面','links.example.test','green','doc'],['t5','设置 - 关于 ZERO','zero://settings/help','chat','about'],['t6','AI问答 · 示例页面','ai.example.test','chat','doc'],['t7','新标签页','zero://newtab','chrome','new'],['t8','广告拦截 — 使用说明','help.example.test','red','doc'],['g1t','新标签页','zero://newtab','chrome','new','g1'],['g2t','新标签页','zero://newtab','chrome','new','g2']];
const state={tabs:seed.map(([id,title,domain,icon,type,group])=>({id,title,domain,icon,type,group,pinned:false,muted:false,unread:id==='t6'})),groups:[{id:'g1',name:'ce',color:'#5f6368',collapsed:false},{id:'g2',name:'33',color:'#da3025',collapsed:false}],active:'t1',selected:new Set(['t1']),closed:[],collapsed:false,peek:false,horizontal:false,width:240,next:20,query:'',recentExpanded:true,popup:null,drag:null};
for(let i=0;i<3;i++)state.tabs.unshift({id:'p'+i,title:['常用资料','工作台','云盘'][i],domain:['docs.example.test','work.example.test','drive.example.test'][i],icon:['green','ai','cloud'][i],type:'doc',pinned:true});
state.closed=[{id:'c1',title:'上次查看的项目文档',domain:'archive.example.test',icon:'blue',type:'doc',pinned:false,group:null}];
const scenario=new URLSearchParams(location.search).get('scene')||'default';let assistantOpen=scenario==='assistant',addressOpen=false;const zero=window.ZERO_HELPERS;
if(['web','assistant','address-web','manager','manager-two'].includes(scenario)){state.active='t2';state.selected=new Set(['t2']);}if(scenario==='about'){state.active='t5';state.selected=new Set(['t5']);}

if(scenario==='manager-two'){state.tabs=state.tabs.filter(t=>['t2','t5'].includes(t.id));state.groups=[];}
if(scenario==='list')state.tabs=state.tabs.filter(t=>!t.pinned);
if(['pins','wide','overflow'].includes(scenario))for(let i=3;i<(scenario==='wide'?21:19);i++)state.tabs.unshift({id:'p'+i,title:'固定资料 '+(i+1),domain:'pin'+i+'.example.test',icon:['green','blue','cloud','chat','google','dark'][i%6],type:'doc',pinned:true});
if(['many','wide','overflow'].includes(scenario))for(let i=0;i<(scenario==='wide'?2:42);i++)state.tabs.splice(state.tabs.length-2,0,{id:'many'+i,title:'资料 '+(i+1)+' — 较长网页标题与内容预览',domain:'item'+i+'.example.test',icon:['green','google','cloud','blue'][i%4],type:'doc'});
if(scenario==='collapsed'||scenario==='peek')state.collapsed=true;
if(scenario==='peek')state.peek=true;
let manager=null;
let hoverTimer,peekTimer,leaveTimer,toastTimer,dragTarget=null,contextFocusId=null,submenuAnchor=null,popupAnchor=null,tipTimer,tipTarget=null;
state.preferredWidth=scenario==='wide'?400:240;state.savedGroups=[];state.groupFooterShown=0;
function groupName(g){return g.name||'未命名分组';}
let overflowFrame;function updateTitleOverflow(){cancelAnimationFrame(overflowFrame);overflowFrame=requestAnimationFrame(()=>{$$('.tab-label').forEach(e=>e.classList.toggle('overflows',e.scrollWidth>e.clientWidth+1))});}
const titleObserver=new ResizeObserver(updateTitleOverflow);
const controlTip=document.createElement('div');controlTip.id='control-tooltip';controlTip.role='tooltip';controlTip.hidden=true;document.body.append(controlTip);
const windowMenu=document.createElement('div');windowMenu.id='window-system-menu';windowMenu.hidden=true;windowMenu.role='menu';windowMenu.setAttribute('aria-label','窗口系统菜单');document.body.append(windowMenu);$('#topbar').tabIndex=-1;
function normalizeTabs(){
 const groupIds=new Set(state.groups.map(g=>g.id));for(const t of state.tabs){if(t.pinned||!groupIds.has(t.group))t.group=null;}
 const pins=state.tabs.filter(t=>t.pinned),rest=state.tabs.filter(t=>!t.pinned),seen=new Set(),ordered=[];
 for(const t of rest){if(!t.group)ordered.push(t);else if(!seen.has(t.group)){seen.add(t.group);ordered.push(...rest.filter(x=>x.group===t.group));}}
 state.tabs=[...pins,...ordered];state.groups=state.groups.filter(g=>state.tabs.some(t=>t.group===g.id));
 state.selected=new Set([...state.selected].filter(id=>state.tabs.some(t=>t.id===id)));if(!state.selected.size&&state.tabs.some(t=>t.id===state.active))state.selected.add(state.active);
}
function visibleTabs(){return state.tabs.filter(t=>state.horizontal||!t.group||!state.groups.find(g=>g.id===t.group)?.collapsed);}
function moveTabsToGroup(ids,groupId){
 const chosen=state.tabs.filter(t=>ids.includes(t.id));if(!chosen.length)return;
 const first=state.tabs.indexOf(chosen[0]);const oldGroups=new Set(chosen.map(t=>t.group).filter(Boolean));
 const lastOldGroup=Math.max(-1,...state.tabs.map((t,i)=>oldGroups.has(t.group)?i:-1));const nextOld=state.tabs.slice(lastOldGroup+1).find(t=>!ids.includes(t.id));
 state.tabs=state.tabs.filter(t=>!ids.includes(t.id));let insert;
 if(groupId){const last=Math.max(-1,...state.tabs.map((t,i)=>t.group===groupId?i:-1));insert=last>=0?last+1:Math.min(first,state.tabs.length);}
 else insert=nextOld?state.tabs.indexOf(nextOld):state.tabs.length;
 chosen.forEach(t=>{t.group=groupId;t.pinned=false;});state.tabs.splice(insert,0,...chosen);normalizeTabs();
}
function setPinned(ids,pinned){const chosen=state.tabs.filter(t=>ids.includes(t.id));state.tabs=state.tabs.filter(t=>!ids.includes(t.id));chosen.forEach(t=>{t.pinned=pinned;t.group=null});const count=state.tabs.filter(t=>t.pinned).length;state.tabs.splice(count,0,...chosen);normalizeTabs();}
function snapshot(t){return {title:t.title,domain:t.domain,icon:t.icon,type:t.type,query:t.query||''};}
function ensureHistory(t){if(!t.navHistory){t.navHistory=[snapshot(t)];t.navIndex=0;}return t;}
function navigateTab(patch){const t=ensureHistory(activeTab());Object.assign(t,patch);t.navHistory=t.navHistory.slice(0,t.navIndex+1);t.navHistory.push(snapshot(t));t.navIndex=t.navHistory.length-1;t.webDraft=t.query||'壁纸';hideAddress();render();}
function travelPage(step){const t=ensureHistory(activeTab()),i=t.navIndex+step;if(i<0||i>=t.navHistory.length)return;t.navIndex=i;Object.assign(t,t.navHistory[i]);t.webDraft=t.query||'壁纸';clearPopups();render();}
function cloneTab(t,id=t.id){return {...t,id,navHistory:t.navHistory?.map(x=>({...x}))};}
function sidebarLimits(){const available=innerWidth-(assistantOpen?375:0)-1;const minContent=Math.min(600,Math.max(0,available-240));return {min:126,max:Math.max(126,Math.min(400,available-minContent))};}
function hideControlTip(){clearTimeout(tipTimer);controlTip.hidden=true;tipTarget=null;}
function showControlTip(button,delay=550){if(tipTarget===button&&!controlTip.hidden)return;hideControlTip();tipTarget=button;tipTimer=setTimeout(()=>{if(!button.isConnected||state.popup||addressOpen)return;const text=button.getAttribute('aria-label')?.replace(/（未模拟）|（未登录）/g,'');if(!text)return;controlTip.textContent=text;controlTip.setAttribute('aria-label',text);controlTip.hidden=false;const r=button.getBoundingClientRect();positionBox(controlTip,r.left,r.bottom+6+controlTip.offsetHeight>innerHeight-8?r.top-controlTip.offsetHeight-6:r.bottom+6);},delay);}
function focusTab(id=state.active){$(`.tab[data-id="${id}"]`)?.focus({preventScroll:true});}
function dismissPopups(){const was=state.popup,anchor=popupAnchor,id=contextFocusId;const address=addressOpen;clearPopups();if(address)$('#location-edit').focus();else if(was==='context')focusTab(id);else if(was==='manager')$('#search-button').focus();else if(was==='search')$('#search-button').focus();else if(was==='groups')$('#groups-button').focus();else if(was==='window-menu')$('#topbar').focus();else if(was==='edit-group'||was==='confirm-group'){const head=$(`[data-group="${anchor}"]`);if(head){head.focus({preventScroll:true});if(state.collapsed){state.peek=true;setLayout()}}else focusTab();}}
function menuKeys(e,host){const items=[...host.querySelectorAll('button:not(:disabled)')],i=items.indexOf(document.activeElement);if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();e.stopPropagation();const n=e.key==='Home'?0:e.key==='End'?items.length-1:(i+(e.key==='ArrowDown'?1:-1)+items.length)%items.length;items[n]?.focus();}else if(e.key==='ArrowRight'&&document.activeElement===submenuAnchor){e.preventDefault();e.stopPropagation();submenuAnchor.click();$('#submenu button')?.focus();}else if((e.key==='ArrowLeft'||e.key==='Escape')&&host.id==='submenu'){e.preventDefault();e.stopPropagation();host.hidden=true;submenuAnchor?.focus();}else if(e.key==='Escape'){e.preventDefault();e.stopPropagation();dismissPopups();}}
$('#context-menu').addEventListener('keydown',e=>menuKeys(e,$('#context-menu')));$('#submenu').addEventListener('keydown',e=>menuKeys(e,$('#submenu')));
document.addEventListener('pointerover',e=>{const b=e.target.closest('.side-head button,.top-tools button,.window-controls button,.navigation button,#new-tab');if(b&&b!==tipTarget)showControlTip(b)});
document.addEventListener('pointerout',e=>{if(tipTarget&&!tipTarget.contains(e.relatedTarget))hideControlTip()});document.addEventListener('pointerdown',hideControlTip);
document.addEventListener('focusin',e=>{if(e.target.matches('.side-head button,.top-tools button,.window-controls button,.navigation button,#new-tab'))showControlTip(e.target,0)});document.addEventListener('focusout',hideControlTip);

function toast(text){$('#toast').textContent=text;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').hidden=true,2800);}
function hideHover(){clearTimeout(hoverTimer);hoverTimer=null;$('#hovercard').hidden=true;}
function positionBox(box,x,y){box.style.left=Math.min(Math.max(x,8),Math.max(8,innerWidth-box.offsetWidth-8))+'px';box.style.top=Math.min(Math.max(y,8),Math.max(8,innerHeight-box.offsetHeight-8))+'px';}
function clearPopups(){manager?.close(false);$$('.group-header.menu-open').forEach(e=>e.classList.remove('menu-open'));hideControlTip();hideAddress();state.popup=null;$('#popover').hidden=true;$('#popover').className='';$('#popover').removeAttribute('aria-label');$('#popover').removeAttribute('role');$('#context-menu').hidden=true;$('#submenu').hidden=true;windowMenu.hidden=true;$$('.context-target').forEach(e=>e.classList.remove('context-target'));$$('.combo-button.open').forEach(e=>e.classList.remove('open'));hideHover();}
let sideLayoutFrame,pendingScrollRestore=null;
function updateScrollEdges(e){const up=e.scrollTop>1,down=e.scrollHeight-e.clientHeight-e.scrollTop>1;e.dataset.scrollUp=String(up);e.dataset.scrollDown=String(down);}
function scheduleSideLayout(){cancelAnimationFrame(sideLayoutFrame);sideLayoutFrame=requestAnimationFrame(syncSideRegions)}
function syncSideRegions(){if(state.horizontal)return;const area=$('#tab-area'),dock=$('#pin-dock'),pins=$('#pins'),ps=$('#pins-scroll'),normal=$('#side-scroll'),list=$('#list'),footer=$('#new-tab-dock');const hasPins=!!pins.children.length;dock.hidden=!hasPins;const c=getComputedStyle(dock),gap=hasPins?['paddingTop','paddingBottom','marginTop','marginBottom','borderTopWidth','borderBottomWidth'].reduce((n,k)=>n+(parseFloat(c[k])||0),0):0;const available=Math.max(0,area.clientHeight-footer.offsetHeight-gap),normalPref=list.getBoundingClientRect().height,pinPref=pins.scrollHeight,minPin=Math.min(pinPref,state.collapsed?50:32),pinTarget=hasPins?Math.min(Math.max(minPin,Math.min(pinPref,Math.max(available-normalPref,available/2))),Math.max(0,available-Math.min(normalPref,30))):0;
 if(Math.abs(ps.clientHeight-pinTarget)>.1)ps.style.height=pinTarget+'px';const normalTarget=Math.max(0,Math.min(normalPref,available-pinTarget));if(Math.abs(normal.clientHeight-normalTarget)>.1)normal.style.height=normalTarget+'px';if(pendingScrollRestore){normal.scrollTop=pendingScrollRestore.normal;ps.scrollTop=pendingScrollRestore.pinned;pendingScrollRestore=null;}updateScrollEdges(normal);updateScrollEdges(ps);}
function setLayout(){titleObserver.disconnect();$$('.tab-label').forEach(e=>titleObserver.observe(e));const limits=sidebarLimits();state.width=Math.max(limits.min,Math.min(limits.max,state.preferredWidth));const b=$('#browser');b.classList.toggle('collapsed',state.collapsed);b.classList.toggle('peek',state.peek&&state.collapsed);b.classList.toggle('horizontal',state.horizontal);b.style.setProperty('--sidebar-width',state.width+'px');$('#horizontal-tabs').hidden=!state.horizontal;$('#collapse').innerHTML=icon(state.collapsed?'expand':'collapse');$('#collapse').ariaLabel=state.collapsed?'展开侧栏':'收起侧栏';$('#resize-handle').setAttribute('aria-valuenow',state.width);$('#resize-handle').setAttribute('aria-valuemax',limits.max);const p=state.tabs.filter(t=>t.pinned).length;const cols=Math.max(1,Math.min(p,Math.floor((state.width-24+4)/36)));$('#pins').style.setProperty('--pin-cols',cols);updateTitleOverflow();scheduleSideLayout();}
function createTab(t){const row=document.createElement('div');row.className='tab'+(t.pinned?' pinned':'')+(state.active===t.id?' active':'')+(state.selected.has(t.id)&&state.selected.size>1?' selected':'');row.dataset.id=t.id;row.role='tab';row.tabIndex=state.active===t.id?0:-1;row.setAttribute('aria-selected',String(state.active===t.id));row.setAttribute('aria-label',t.title+(t.muted?'，已静音':''));row.draggable=true;row.innerHTML=favicon(t)+`<span class="tab-label">${escape(t.title)}</span>${t.muted?'<span class="muted-marker" aria-label="已静音">'+icon('mute')+'</span>':''}<button class="close-tab" aria-label="关闭 ${escape(t.title)}">${icon('close')}</button>`;
 row.addEventListener('click',e=>{if(e.ctrlKey||e.metaKey){if(state.selected.has(t.id)){if(state.selected.size>1)state.selected.delete(t.id)}else state.selected.add(t.id);renderTabs();}else if(e.shiftKey){const list=visibleTabs(),a=list.findIndex(x=>x.id===state.active),b=list.indexOf(t);state.selected=new Set(list.slice(Math.min(a,b),Math.max(a,b)+1).map(x=>x.id));renderTabs();}else activate(t.id);});
 row.querySelector('.close-tab').addEventListener('mouseenter',()=>{hideHover();hideControlTip()});
 row.querySelector('.close-tab').addEventListener('click',e=>{e.stopPropagation();closeTabs([t.id]);});
 row.addEventListener('contextmenu',e=>{e.preventDefault();showContext(t,e.clientX,e.clientY);});
 row.addEventListener('mouseenter',()=>scheduleHover(t,row));row.addEventListener('mousemove',e=>{if(e.target.closest('.close-tab'))hideHover();else if($('#hovercard').hidden&&!hoverTimer)scheduleHover(t,row)});row.addEventListener('mouseleave',hideHover);
 row.addEventListener('keydown',e=>{if(e.target!==row)return;if(e.key==='Enter'||e.key===' '){e.preventDefault();activate(t.id)}else if(e.key==='Delete'){e.preventDefault();closeTabs([t.id])}else if(['ArrowDown','ArrowUp','ArrowRight','ArrowLeft'].includes(e.key)){e.preventDefault();const tabs=$$('.tab').filter(el=>el.offsetParent!==null),i=tabs.indexOf(row),next=tabs[(i+(e.key==='ArrowDown'||e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length];next?.focus();}else if(e.key==='ContextMenu'||e.key==='F10'&&e.shiftKey){e.preventDefault();const r=row.getBoundingClientRect();showContext(t,r.right,r.top);}});
 row.addEventListener('dragstart',e=>{hideHover();clearPopups();state.drag=t.id;e.dataTransfer.setData('text/plain',t.id);e.dataTransfer.effectAllowed='move';row.classList.add('dragging');});
 row.addEventListener('dragover',e=>{const from=state.tabs.find(x=>x.id===state.drag);if(from&&from.id!==t.id&&!!from.pinned===!!t.pinned&&from.group===t.group){e.preventDefault();$$('.drop-before').forEach(x=>x.classList.remove('drop-before'));row.classList.add('drop-before');dragTarget=t.id;e.dataTransfer.dropEffect='move';}});
 row.addEventListener('drop',e=>{e.preventDefault();if(dragTarget===t.id){const from=state.tabs.find(x=>x.id===state.drag);state.tabs=state.tabs.filter(x=>x.id!==from.id);state.tabs.splice(state.tabs.indexOf(t),0,from);state.drag=null;dragTarget=null;renderTabs();}});row.addEventListener('dragend',()=>{state.drag=null;dragTarget=null;$$('.dragging,.drop-before').forEach(e=>e.classList.remove('dragging','drop-before'));});return row;
}
function renderTabs(){
 normalizeTabs();hideHover();const scroll=$('#side-scroll').scrollTop,pinScroll=$('#pins-scroll').scrollTop;$('#pins').replaceChildren();$('#list').replaceChildren();$('#horizontal-list').replaceChildren();setLayout();
 if(state.horizontal){state.tabs.forEach(t=>$('#horizontal-list').append(createTab(t)));return;}
 state.tabs.filter(t=>t.pinned).forEach(t=>$('#pins').append(createTab(t)));const seen=new Set();
 for(const t of state.tabs.filter(t=>!t.pinned)){
  if(!t.group){$('#list').append(createTab(t));continue;}if(seen.has(t.group))continue;seen.add(t.group);const g=state.groups.find(g=>g.id===t.group);
  const section=document.createElement('div');section.className='group'+(g.collapsed?' folded':'');section.style.setProperty('--group-color',g.color);section.innerHTML=`<div class="group-header"><button class="group-head" data-group="${g.id}" aria-label="${g.collapsed?'展开':'折叠'}分组 ${escape(groupName(g))}" aria-expanded="${!g.collapsed}"><span class="group-name">${escape(g.name)}</span>${extra.chevron.replace('<svg','<svg class="chevron"')}</button><button class="group-more" data-group-more="${g.id}" aria-label="更多：${escape(groupName(g))}" aria-haspopup="dialog">${icon('more')}</button></div><div class="group-body"></div>`;
  const head=section.querySelector('.group-head'),more=section.querySelector('.group-more');head.onclick=()=>{g.collapsed=!g.collapsed;renderTabs();$(`[data-group="${g.id}"]`)?.focus({preventScroll:true})};head.oncontextmenu=e=>{e.preventDefault();showGroupEditor(g,more)};more.onclick=()=>showGroupEditor(g,more);more.oncontextmenu=e=>{e.preventDefault();showGroupEditor(g,more)};
  head.onmouseenter=()=>scheduleGroupHover(g,head);head.onmouseleave=e=>{if(!e.relatedTarget?.closest?.('#hovercard')){clearTimeout(hoverTimer);hoverTimer=setTimeout(hideHover,160)}};more.onmouseenter=hideHover;
  head.onkeydown=e=>{if(e.key==='ContextMenu'||(e.shiftKey&&e.key==='F10')){e.preventDefault();showGroupEditor(g,more)}};
  state.tabs.filter(x=>x.group===g.id).forEach(x=>section.querySelector('.group-body').append(createTab(x)));$('#list').append(section);
 }pendingScrollRestore={normal:scroll,pinned:pinScroll};syncSideRegions();
}
function activeTab(){return state.tabs.find(t=>t.id===state.active)||state.tabs[0];}
function renderPage(){setLayout();const t=ensureHistory(activeTab());for(const type of ['new','doc','about'])$(type==='new'?'#newtab':type==='doc'?'#webpage':'#about').hidden=t.type!==type;$('#bookmarks').hidden=t.type!=='new';$('#assistant').hidden=!assistantOpen;$('.ai-entry').setAttribute('aria-expanded',String(assistantOpen));$('.ai-entry').setAttribute('aria-controls','assistant');$('#context-title').textContent=t.title;$('.page-context .google-g').innerHTML=favicon(t);
$('#current-location .location-favicon').innerHTML=t.type==='about'?zero.img('favicon-settings.svg'):t.type==='new'?window.ZERO_NATIVE_ICONS.zero:favicon(t);$('#current-location .location-mode').innerHTML=t.type==='new'?zero.img('google-mark-reference.png'):zero.svg('sliders');$('#current-location .location-title').textContent=t.title;$('#current-location .location-address').textContent=t.type==='new'?'AI搜索或输入网址':t.domain.replace(/^https?:\/\//,'');$('#current-location').dataset.kind=t.type;$('#location-copy').hidden=t.type!=='doc';$('#location-star').hidden=t.type!=='doc';
$('.top-tools [aria-label="阅读模式（未模拟）"]').hidden=t.type==='new';$('.top-tools .blue').hidden=t.type==='new';$('.navigation [data-action="back"]').disabled=t.navIndex===0;$('.navigation [data-action="forward"]').disabled=t.navIndex===t.navHistory.length-1;$('#web-form input').value=t.webDraft??t.query??'壁纸';$('#newtab-form input').value=t.newtabDraft||'';document.body.dataset.scene=assistantOpen?'assistant':t.type;}
function showSampleSearch(q){navigateTab({type:'doc',title:q+' - 示例搜索',domain:'https://example.test/search?q='+encodeURIComponent(q),icon:'google',query:q});$('#webpage').scrollTop=0;toast('已更新本地样例，未访问网络');}
function hideAddress(){
 addressOpen = false;
 $('#address-editor').hidden = true;
 document.body.classList.remove('address-open');
 $('#location-edit').setAttribute('aria-expanded', 'false');
}
function positionAddressEditor(){
 if (!addressOpen) return;
 const rect = $('#current-location').getBoundingClientRect();
 const editor = $('#address-editor');
 if (state.horizontal) {
  const tab = $('#horizontal-list .tab.active');
  editor.style.width = Math.min(536, innerWidth - 16) + 'px';
  positionBox(editor, tab ? tab.getBoundingClientRect().left : 8, 3);
  editor.style.top = '3px';
  return;
 }
 editor.style.left = rect.left + 'px';
 editor.style.top = rect.top + 'px';
 editor.style.width = rect.width + 'px';
}
function openAddress(){
 clearPopups();
 state.peek = false;
 setLayout();
 addressOpen = true;
 const editor = $('#address-editor');
 const input = editor.querySelector('input');
 const tab = activeTab();
 editor.querySelector('.google-g').innerHTML = $('#current-location .location-mode').innerHTML;
 input.value = tab.type === 'new' ? '' : tab.domain;
 editor.hidden = false;
 document.body.classList.add('address-open');
 $('#location-edit').setAttribute('aria-expanded', 'true');
 positionAddressEditor();
 input.focus();
 input.select();
}
const addressAnchorObserver = new ResizeObserver(positionAddressEditor);
addressAnchorObserver.observe($('#current-location'));
$('#location-edit').setAttribute('aria-controls', 'address-editor');
$('#location-edit').setAttribute('aria-expanded', 'false');

function render(){renderTabs();renderPage();}
function activate(id,record=true){const t=state.tabs.find(t=>t.id===id);if(!t)return;const restoreFocus=!!document.activeElement.closest('.tab');state.active=id;state.selected=new Set([id]);if(t.group){const g=state.groups.find(g=>g.id===t.group);if(g)g.collapsed=false;}t.unread=false;clearPopups();render();requestAnimationFrame(()=>{const el=$(`.tab[data-id="${id}"]`);el?.scrollIntoView({block:'nearest',inline:'nearest'});if(restoreFocus)el?.focus({preventScroll:true})});}
function newTab(after){const t={id:'n'+state.next++,title:'新标签页',domain:'zero://newtab',icon:'chrome',type:'new',pinned:false,group:after&&!after.pinned?after.group:null};if(after){state.tabs.splice(state.tabs.indexOf(after)+1,0,t)}else state.tabs.push(t);activate(t.id);}
function closeTabs(ids){const toClose=new Set(ids),before=state.tabs.findIndex(t=>t.id===state.active);state.closed=[...state.tabs.filter(t=>toClose.has(t.id)).map(t=>({...cloneTab(t),pinned:false,group:null})).reverse(),...state.closed].slice(0,50);state.tabs=state.tabs.filter(t=>!toClose.has(t.id));state.groups=state.groups.filter(g=>state.tabs.some(t=>t.group===g.id));if(!state.tabs.length){clearPopups();newTab();return;}if(!state.tabs.some(t=>t.id===state.active))state.active=state.tabs[Math.min(before,state.tabs.length-1)].id;state.selected=new Set([state.active]);clearPopups();render();}
function scheduleHover(t,row){hideHover();if(state.popup||state.drag||addressOpen)return;hoverTimer=setTimeout(()=>{hoverTimer=null;if(!document.contains(row)||!row.matches(':hover')||row.querySelector('.close-tab')?.matches(':hover')||state.popup||addressOpen)return;const r=row.getBoundingClientRect();const preview=t.id!==state.active;$('#hovercard').innerHTML=`<div class="hover-title">${escape(t.title)}</div><div class="hover-domain">${escape(t.domain)}</div>${preview?`<div class="preview"><img src="assets/preview-${t.type==='new'?'newtab':t.type==='about'?'settings':'web'}.png" alt="本地样例页面缩略图"></div>`:''}`;$('#hovercard').hidden=false;const sr=$('#sidebar').getBoundingClientRect();positionBox($('#hovercard'),state.horizontal||t.pinned?r.left:Math.max(r.right,sr.right)-10,state.horizontal||t.pinned?r.bottom:r.top);},500);}
function anchorPopup(button){const r=button.getBoundingClientRect();$('#popover').style.setProperty('--search-top',r.bottom+'px');$('#popover').hidden=false;positionBox($('#popover'),r.left,r.bottom);}
function showSearch(event){manager.toggle(event?.currentTarget||managerTrigger());}
function openSearch(query = '', scrollTop = 0){
 const box = $('#popover');
 state.popup = 'search';
 state.query = query;
 box.className = 'tab-search-popup';
 box.role = 'dialog';
 box.setAttribute('aria-label', '标签页搜索');
 $('#search-button').classList.add('open');
 box.innerHTML = `<div class="search-head">${icon('search')}<input aria-label="搜索标签页" placeholder="搜索标签页" autocomplete="off"><kbd>Ctrl+Shift+A</kbd></div><div class="search-results"></div>`;
 const input = box.querySelector('input');
 input.value = query;
 input.oninput = () => {
  state.query = input.value;
  renderSearchResults();
 };
 renderSearchResults(scrollTop);
 input.focus({preventScroll:true});
}
function renderSearchResults(scrollTop = 0){
 const q = state.query.trim();
 const query = q.toLocaleLowerCase();
 const match = tab => (tab.title + ' ' + tab.domain).toLocaleLowerCase().includes(query);
 const opened = state.tabs.filter(match);
 const closed = state.closed.filter(match);
 const host = $('#popover .search-results');
 const pattern = q ? new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi') : null;
 const highlight = value => pattern ? value.split(pattern).map((part, index) =>
  index % 2 ? '<mark>' + escape(part) + '</mark>' : escape(part)
 ).join('') : escape(value);

 $('#popover .search-head').classList.toggle('has-query', state.query.length > 0);
 host.replaceChildren();

 function heading(text, collapsible = false){
  const element = document.createElement(collapsible ? 'button' : 'div');
  element.className = 'result-heading';
  element.textContent = text;
  if (collapsible) {
   element.insertAdjacentHTML('beforeend', extra.chevron);
   element.setAttribute('aria-expanded', state.recentExpanded);
   element.onclick = () => {
    state.recentExpanded = !state.recentExpanded;
    renderSearchResults(host.scrollTop);
    host.querySelector('button.result-heading')?.focus({preventScroll:true});
   };
  }
  host.append(element);
 }

 function row(tab, isClosed){
  const element = document.createElement('div');
  element.className = 'search-result';
  element.dataset.id = tab.id;
  element.dataset.closed = String(isClosed);
  const action = isClosed ? '恢复' : '切换到';
  const time = isClosed ? '刚刚关闭' : '2 分钟前';
  element.innerHTML = `
   <button class="result-open" aria-label="${action} ${escape(tab.title)}">
    <span class="result-icon">${favicon(tab)}</span>
    <span class="result-text">
     <span>${highlight(tab.title)}</span>
     <small><span>${highlight(tab.domain)}</span><span class="result-age">· ${time}</span></small>
    </span>
   </button>
   ${isClosed ? '' : `<button class="result-close" aria-label="关闭 ${escape(tab.title)}">${icon('close')}</button>`}
  `;
  element.querySelector('.result-open').onclick = () => {
   if (isClosed) {
    state.closed = state.closed.filter(item => item.id !== tab.id);
    if (!state.tabs.some(item => item.id === tab.id)) state.tabs.push({...tab});
   }
   activate(tab.id);
   focusTab(tab.id);
  };
  if (!isClosed) {
   element.querySelector('.result-close').onclick = () => {
    const value = state.query;
    const offset = host.scrollTop;
    closeTabs([tab.id]);
    openSearch(value, offset);
   };
  }
  host.append(element);
 }

 if (opened.length) {
  heading('打开的标签页');
  opened.forEach(tab => row(tab, false));
 }
 if (closed.length) {
  heading('最近关闭的标签页', true);
  if (state.recentExpanded) closed.forEach(tab => row(tab, true));
 }
 if (!opened.length && !closed.length) host.innerHTML = '<div class="no-results">找不到任何结果</div>';

 const first = host.querySelector('.search-result');
 host.classList.toggle('has-rows', Boolean(first));
 if (query) first?.classList.add('first-match');
 anchorPopup($('#search-button'));
 host.scrollTop = scrollTop;
}
$('#popover').addEventListener('keydown',e=>{if(state.popup!=='search'||!['ArrowDown','ArrowUp','Enter'].includes(e.key))return;const rows=[...$('#popover').querySelectorAll('.result-open')],input=$('#popover input'),i=rows.indexOf(document.activeElement);if(document.activeElement===input){if(!rows.length)return;e.preventDefault();if(e.key==='Enter')rows[0].click();else rows[e.key==='ArrowUp'?rows.length-1:0].focus();}else if(i>=0&&e.key!=='Enter'){e.preventDefault();const n=i+(e.key==='ArrowDown'?1:-1);if(n<0||n>=rows.length)input.focus();else rows[n].focus();}});
function scheduleGroupHover(g,head){hideHover();if(state.popup||state.drag||addressOpen)return;hoverTimer=setTimeout(()=>{hoverTimer=null;if(!head.isConnected||!head.matches(':hover')||state.popup)return;const tabs=state.tabs.filter(t=>t.group===g.id),card=$('#hovercard');card.innerHTML=`<div class="group-preview"><div>${escape(groupName(g))}（${tabs.length} 个标签页）</div><ul>${tabs.map(t=>`<li><span>${escape(t.title)}</span></li>`).join('')}</ul></div>`;card.hidden=false;const r=head.getBoundingClientRect();positionBox(card,$('#sidebar').getBoundingClientRect().right-12,r.top);},500)}
$('#hovercard').onmouseenter=()=>{clearTimeout(leaveTimer);clearTimeout(hoverTimer)};$('#hovercard').onmouseleave=()=>{hideHover();schedulePeekClose()};
function showGroups(){const was=state.popup==='groups';clearPopups();if(was)return;state.popup='groups';$('#groups-button').classList.add('open');$('#popover').innerHTML='<div class="group-picker"><h3>标签页分组</h3><div id="group-options"></div><p>本地样例；关闭的分组在本次演示内保留，刷新重置。</p></div>';for(const g of state.groups){const b=document.createElement('button');b.className='group-option';b.innerHTML=`<span class="dot" style="background:${g.color}"></span><span>${escape(groupName(g))}</span><small>${state.tabs.filter(t=>t.group===g.id).length} 个标签页</small>`;b.onclick=()=>{clearPopups();g.collapsed=false;renderTabs();$(`[data-group="${g.id}"]`)?.scrollIntoView({block:'nearest'})};$('#group-options').append(b)}for(const saved of state.savedGroups){const b=document.createElement('button');b.className='group-option';b.setAttribute('aria-label','重新打开分组 '+groupName(saved.group));b.innerHTML=`<span class="dot" style="background:${saved.group.color}"></span><span>${escape(groupName(saved.group))}</span><small>已关闭 · ${saved.tabs.length} 个标签页</small>`;b.onclick=()=>{state.savedGroups=state.savedGroups.filter(x=>x!==saved);state.groups.push({...saved.group,collapsed:false});const ids=new Set(saved.tabs.map(t=>t.id));state.tabs=state.tabs.filter(t=>!ids.has(t.id));state.closed=state.closed.filter(t=>!ids.has(t.id));state.tabs.splice(Math.min(saved.index,state.tabs.length),0,...saved.tabs.map(t=>cloneTab(t)));activate(saved.tabs[0].id)};$('#group-options').append(b)}anchorPopup($('#groups-button'));}
const groupColors=[['灰色','#5f6368'],['蓝色','#1a73e8'],['红色','#da3025'],['黄色','#f9ab00'],['绿色','#188038'],['粉色','#d01884'],['紫色','#a142f4'],['青色','#00838f'],['橙色','#fa903e']];
function syncGroupVisual(g){const head=$(`[data-group="${g.id}"]`);if(!head)return;head.querySelector('.group-name').textContent=g.name;head.setAttribute('aria-label',(g.collapsed?'展开':'折叠')+'分组 '+groupName(g));head.closest('.group').style.setProperty('--group-color',g.color);const more=$(`[data-group-more="${g.id}"]`);more?.setAttribute('aria-label','更多：'+groupName(g))}
function closeGroup(g){const tabs=state.tabs.filter(t=>t.group===g.id);if(!tabs.length)return;state.savedGroups=state.savedGroups.filter(x=>x.group.id!==g.id);state.savedGroups.push({group:{...g},tabs:tabs.map(t=>cloneTab(t)),index:state.tabs.indexOf(tabs[0])});closeTabs(tabs.map(t=>t.id));focusTab();}
function groupConfirm(g,action){clearPopups();state.popup='confirm-group';popupAnchor=g.id;const name=groupName(g),del=action==='delete',box=$('#popover');box.className='group-confirm';box.role='alertdialog';box.setAttribute('aria-label',del?'删除标签页组':'取消分组');box.innerHTML=`<h3>${del?'删除标签页组':'取消分组'}“${escape(name)}”？</h3><p>${del?'将关闭此组的样例标签，并移除本次演示中的分组记录。':'标签页保持打开，移除分组。'}</p><div><button data-confirm="cancel">取消</button><button data-confirm="yes">${del?'删除':'取消分组'}</button></div>`;box.hidden=false;positionBox(box,Math.max(8,(innerWidth-320)/2),Math.max(8,(innerHeight-box.offsetHeight)/2));box.querySelector('[data-confirm="cancel"]').onclick=()=>{clearPopups();$(`[data-group="${g.id}"]`)?.focus({preventScroll:true})};box.querySelector('[data-confirm="yes"]').onclick=()=>{clearPopups();state.savedGroups=state.savedGroups.filter(x=>x.group.id!==g.id);if(del)closeTabs(state.tabs.filter(t=>t.group===g.id).map(t=>t.id));else{state.tabs.forEach(t=>{if(t.group===g.id)t.group=null});state.groups=state.groups.filter(x=>x.id!==g.id);renderTabs()}focusTab()};box.querySelector('[data-confirm="cancel"]').focus();}
function showGroupEditor(g,anchor){clearPopups();if(state.collapsed&&!state.peek){$('#browser').classList.add('opening-group-menu');state.peek=true;setLayout();void $('#sidebar').offsetWidth;requestAnimationFrame(()=>$('#browser').classList.remove('opening-group-menu'))}state.popup='edit-group';popupAnchor=g.id;const more=$(`[data-group-more="${g.id}"]`)||anchor,box=$('#popover');more?.closest('.group-header')?.classList.add('menu-open');box.className='group-menu';box.role='dialog';box.setAttribute('aria-label','编辑标签页组 '+groupName(g));const footer=state.groupFooterShown++<5&&!new URLSearchParams(location.search).has('nofooter');
box.innerHTML=`<form class="chrome-group-editor"><div class="group-controls"><input aria-label="分组名称" placeholder="为此分组命名" maxlength="80" value="${escape(g.name)}"><div class="color-options" role="group" aria-label="分组颜色">${groupColors.map(([name,c])=>`<button type="button" class="color-choice" style="--choice-color:${c}" data-color="${c}" aria-label="${name}" aria-pressed="${c===g.color}"></button>`).join('')}</div></div><div class="group-menu-separator" role="separator"></div><div class="group-actions"><button type="button" aria-label="在组内添加新标签页" data-group-action="new">${icon('group-add')}<span>在组内添加新标签页</span><kbd>Alt+Shift+C</kbd></button><button type="button" aria-label="将分组移至新窗口" data-group-action="move">${icon('group-move')}<span>将分组移至新窗口</span></button><button type="button" aria-label="关闭标签页组" data-group-action="close">${icon('group-close')}<span>关闭标签页组</span><kbd>Alt+Shift+W</kbd></button></div><div class="group-menu-separator" role="separator"></div><div class="group-actions"><button type="button" aria-label="取消分组" data-group-action="ungroup">${icon('group-ungroup')}<span>取消分组</span></button><button type="button" aria-label="删除标签页组" data-group-action="delete">${icon('group-delete')}<span>删除标签页组</span></button></div>${footer?'<div class="group-save-info">您的标签页分组现在会自动保存。<a href="#" class="group-learn-more">详细了解标签页</a></div>':''}</form>`;
box.hidden=false;const r=more.getBoundingClientRect();positionBox(box,r.left-4,r.bottom+3);box.querySelector('input').oninput=e=>{g.name=e.target.value;syncGroupVisual(g)};box.querySelector('form').onsubmit=e=>{e.preventDefault();dismissPopups()};box.querySelectorAll('[data-color]').forEach(b=>b.onclick=()=>{g.color=b.dataset.color;box.querySelectorAll('[data-color]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));syncGroupVisual(g)});box.querySelectorAll('[data-group-action]').forEach(b=>b.onclick=()=>{const action=b.dataset.groupAction;if(action==='new'){const last=state.tabs.filter(t=>t.group===g.id).at(-1);g.collapsed=false;newTab(last)}else if(action==='close')closeGroup(g);else if(action==='move'){clearPopups();toast('移至新窗口：Windows 原生标签归属本轮未模拟，当前组保持不变');focusTab()}else groupConfirm(g,action)});box.querySelector('.group-learn-more')?.addEventListener('click',e=>{e.preventDefault();toast('本地演示只在本次页面内保留分组；没有账号同步，刷新重置')});box.querySelector('input').focus({preventScroll:true});}
$('#popover').addEventListener('keydown',e=>{if(state.popup==='edit-group'){const colors=[...$('#popover').querySelectorAll('.color-choice')],i=colors.indexOf(document.activeElement),actions=[...$('#popover').querySelectorAll('[data-group-action]')],a=actions.indexOf(document.activeElement);if(i>=0&&['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();const b=colors[(i+(e.key==='ArrowRight'?1:-1)+colors.length)%colors.length];b.focus();b.click()}else if(['ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();actions[(a+(e.key==='ArrowDown'?1:-1)+actions.length)%actions.length]?.focus()}}if(['edit-group','confirm-group'].includes(state.popup)&&e.key==='Tab'){const items=[...$('#popover').querySelectorAll('input,button:not(:disabled),a[href]')],i=items.indexOf(document.activeElement);if(e.shiftKey&&i===0){e.preventDefault();items.at(-1).focus()}else if(!e.shiftKey&&i===items.length-1){e.preventDefault();items[0].focus()}}});
function showContext(t,x,y){clearPopups();contextFocusId=t.id;if(!state.selected.has(t.id))state.selected=new Set([t.id]);renderTabs();const ids=[...state.selected],multi=ids.length>1;state.popup='context';$(`.tab[data-id="${t.id}"]`)?.classList.add('context-target');const allPinned=ids.every(id=>state.tabs.find(t=>t.id===id)?.pinned),allMuted=ids.every(id=>state.tabs.find(t=>t.id===id)?.muted);const menu=$('#context-menu');menu.dataset.multi=String(multi);menu.replaceChildren();
 const sep=()=>{const el=document.createElement('div');el.className='menu-separator';el.role='separator';menu.append(el)};
 const item=(label,action,key='',ic='',disabled=false)=>{const b=document.createElement('button');b.className='menu-item';b.role='menuitem';b.setAttribute('aria-label',label);b.disabled=disabled;b.innerHTML=(ic?`<span class="menu-icon">${icon(ic)}</span>`:'')+`<span>${label}</span>`+(key?`<span class="shortcut-key">${key}</span>`:'');b.onclick=()=>{if(action)action();};menu.append(b);return b};
 const done=fn=>()=>{clearPopups();fn();focusTab();};
 item('在下方新增标签页',done(()=>newTab(t)));
 item(multi?'在拆分视图中显示标签页':'使用当前标签页创建新的拆分视图',()=>toast('拆分视图：本轮未模拟'),'','split',multi);
 const groupBtn=item(state.groups.length?'向群组中添加标签页':'添加到新标签页组',()=>showGroupSubmenu(groupBtn,ids));submenuAnchor=groupBtn;groupBtn.setAttribute('aria-haspopup','menu');groupBtn.innerHTML+='<span class="arrow">›</span>';groupBtn.onmouseenter=()=>showGroupSubmenu(groupBtn,ids);
 item('将标签页移至新窗口',()=>toast('跨窗口标签归属：需 Windows 客户端验证，本轮未模拟'));sep();
 item('重新加载',done(()=>toast('已模拟重新加载所选 '+ids.length+' 个标签页')),'Ctrl+R');
 item('复制',done(()=>{const originals=state.tabs.filter(t=>ids.includes(t.id));let last;for(const original of originals){const copy={...cloneTab(original,'n'+state.next++),pinned:false,unread:false};state.tabs.splice(state.tabs.indexOf(original)+1,0,copy);last=copy;}normalizeTabs();activate(last.id)}));
 item(allPinned?'取消固定':'固定',done(()=>{setPinned(ids,!allPinned);renderTabs()}));
 item(allMuted?(multi?'取消这些网站静音':'取消这个网站静音'):(multi?'将这些网站静音':'将这个网站静音'),done(()=>{const domains=new Set(state.tabs.filter(t=>ids.includes(t.id)).map(t=>t.domain));state.tabs.forEach(t=>{if(domains.has(t.domain))t.muted=!allMuted});renderTabs()}));sep();
 item('添加到阅读清单',()=>toast('阅读清单：本轮未模拟'),'','book');item('发送到您的设备',()=>toast('设备发送与账号连接：本轮未模拟'),'','devices').innerHTML+='<span class="arrow">›</span>';sep();
 item(state.horizontal?'垂直显示标签页':'水平显示标签页',done(()=>{state.horizontal=!state.horizontal;state.peek=false;renderTabs()}));sep();
 item('关闭',done(()=>closeTabs(ids)),'Ctrl+W');item('关闭其他标签页',done(()=>closeTabs(state.tabs.filter(t=>!ids.includes(t.id)&&!t.pinned).map(t=>t.id))));const cutoff=Math.max(...ids.map(id=>state.tabs.findIndex(t=>t.id===id)));item('关闭下方标签页',done(()=>closeTabs(state.tabs.slice(cutoff+1).filter(t=>!t.pinned).map(t=>t.id))));menu.hidden=false;positionBox(menu,x,y);menu.querySelector('button:not(:disabled)')?.focus({preventScroll:true});
}
function showGroupSubmenu(button,ids){const sub=$('#submenu');sub.replaceChildren();function add(label,fn,color){const b=document.createElement('button');b.className='menu-item subitem';b.role='menuitem';b.innerHTML=(color?`<span class="dot" style="background:${color}"></span>`:'')+escape(label);b.onclick=()=>{clearPopups();fn();if(state.popup!=='edit-group')renderTabs();if(state.popup!=='edit-group')focusTab(ids[0])};sub.append(b)}
 add('新建群组',()=>{const g={id:'g'+state.next++,name:'新建分组',color:'#1a73e8',collapsed:false};state.groups.push(g);moveTabsToGroup(ids,g.id);renderTabs();showGroupEditor(g,$(`[data-group="${g.id}"]`))});for(const g of state.groups)add(g.name,()=>{moveTabsToGroup(ids,g.id);g.collapsed=false;},g.color);if(ids.some(id=>state.tabs.find(t=>t.id===id)?.group))add('从群组中移除',()=>moveTabsToGroup(ids,null));sub.hidden=false;const r=button.getBoundingClientRect();positionBox(sub,r.right-2,r.top);if(parseFloat(sub.style.left)<r.right-10)sub.style.left=Math.max(8,r.left-sub.offsetWidth+2)+'px';}

// Window switching below is isolated in this HTML sample; no native windows or personal data.
let currentWindowId='window-1',nextWindow=3;
const demoWindows=new Map();
function rememberWindow(){demoWindows.set(currentWindowId,{id:currentWindowId,number:Number(currentWindowId.split('-')[1]),tabs:state.tabs,groups:state.groups,active:state.active,savedGroups:state.savedGroups});}
rememberWindow();
if(scenario!=='manager-two')demoWindows.set('window-2',{id:'window-2',number:2,tabs:[{id:'w2a',title:'参考资料 — 示例窗口',domain:'reference.example.test',icon:'blue',type:'doc',pinned:false},{id:'w2b',title:'项目说明 — 示例窗口',domain:'notes.example.test',icon:'green',type:'doc',pinned:false}],groups:[],active:'w2a',savedGroups:[]});
function chooseWindow(id){rememberWindow();const w=demoWindows.get(id);if(!w)return;currentWindowId=id;state.tabs=w.tabs;state.groups=w.groups;state.active=w.active;state.savedGroups=w.savedGroups;state.selected=new Set([state.active]);activate(state.active);toast('已切换到示例窗口 '+w.number);}
function managerTrigger(){return state.horizontal?$('#horizontal-manager'):$('#search-button');}
const horizontalManager=document.createElement('button');horizontalManager.id='horizontal-manager';horizontalManager.className='icon-button';horizontalManager.setAttribute('aria-label','标签管理');horizontalManager.innerHTML='<img src="assets/manager.svg" alt="" width="16" height="16">';$('#horizontal-tabs').append(horizontalManager);horizontalManager.onclick=showSearch;
manager=window.createZeroTabManager({
 tabs:()=>state.tabs,active:()=>state.active,favicon,
 trigger:managerTrigger,beforeOpen:clearPopups,didOpen:()=>{state.popup='manager'},didClose:()=>{if(state.popup==='manager')state.popup=null},
 activate,closeTab:id=>closeTabs([id]),newTab:()=>newTab(),
 windows:()=>{rememberWindow();return [...demoWindows.values()].map(w=>({id:w.id,number:w.number,current:w.id===currentWindowId,count:w.tabs.length,tab:w.tabs.find(t=>t.id===w.active)||w.tabs[0]}))},
 selectWindow:chooseWindow,
 newWindow:()=>{rememberWindow();const number=nextWindow++,id='window-'+number;demoWindows.set(id,{id,number,tabs:[{id:'window-new-'+number,title:'新标签页',domain:'zero://newtab',icon:'chrome',type:'new',pinned:false}],groups:[],active:'window-new-'+number,savedGroups:[]});chooseWindow(id);}
});

$('#groups-button').innerHTML=icon('groups')+'<span class="tool-label">标签页分组</span>';$('#search-button').innerHTML='<img src="assets/manager.svg" alt="" width="16" height="16"><span class="tool-label">标签管理</span>';$('#search-button').setAttribute('aria-label','标签管理');$('#new-tab').innerHTML=icon('plus');$('#horizontal-new').innerHTML=icon('plus');$('#return-vertical').innerHTML=icon('expand');
$('#collapse').onclick=()=>{clearPopups();clearTimeout(peekTimer);clearTimeout(leaveTimer);state.collapsed=!state.collapsed;state.peek=false;setLayout()};$('#return-vertical').onclick=()=>{state.horizontal=false;state.collapsed=false;state.peek=false;renderTabs()};$('#new-tab').onclick=()=>newTab();$('#horizontal-new').onclick=()=>newTab();$('#search-button').onclick=showSearch;$('#groups-button').onclick=showGroups;
function schedulePeekClose(){clearTimeout(leaveTimer);leaveTimer=setTimeout(()=>{const over=$('#sidebar').matches(':hover')||(!$('#hovercard').hidden&&$('#hovercard').matches(':hover'));if(!state.popup&&!over&&state.collapsed){state.peek=false;hideHover();setLayout()}},170)}
$('#sidebar').onmouseenter=()=>{clearTimeout(leaveTimer);if(state.collapsed&&!state.peek&&!addressOpen){peekTimer=setTimeout(()=>{if(state.collapsed&&!state.drag&&!addressOpen){state.peek=true;hideHover();setLayout()}},350)}};
$('#sidebar').onmouseleave=()=>{clearTimeout(peekTimer);schedulePeekClose()};
$('#side-scroll').onscroll=()=>{updateScrollEdges($('#side-scroll'));hideHover();if(state.popup==='edit-group'){const anchor=$(`[data-group-more="${popupAnchor}"]`),head=$(`[data-group="${popupAnchor}"]`),host=$('#side-scroll').getBoundingClientRect();if(!anchor||!head){clearPopups();return;}const h=head.getBoundingClientRect();if(h.bottom<=host.top||h.top>=host.bottom){clearPopups();return;}const r=anchor.getBoundingClientRect();positionBox($('#popover'),r.left-4,r.bottom+3)}else if(state.popup)clearPopups()};
$('#pins-scroll').onscroll=()=>{updateScrollEdges($('#pins-scroll'));hideHover();if(state.popup)clearPopups()};
$('#location-edit').onclick=openAddress;$('#location-copy').onclick=()=>toast('演示地址：'+activeTab().domain+'（未写入系统剪贴板）');$('#location-star').onclick=()=>toast('收藏：本轮未模拟');
$('#address-editor form').onsubmit=e=>{e.preventDefault();const value=$('#address-editor input').value.trim();if(!value)return;let patch;
 if(value==='zero://newtab')patch={type:'new',title:'新标签页',domain:value,icon:'chrome',query:''};else if(value==='zero://settings/help')patch={type:'about',title:'设置 - 关于 ZERO',domain:value,icon:'chat',query:''};else{
 if(/^[a-z][a-z0-9+.-]*:/i.test(value)&&!/^https?:\/\//i.test(value)){toast('演示仅接受网页地址或搜索词，输入已保留');return;}let url;try{url=new URL(/^https?:\/\//i.test(value)?value:/^[\w.-]+\.[a-z]{2,}/i.test(value)?'https://'+value:'https://example.test/search?q='+encodeURIComponent(value));}catch{toast('请检查地址，输入已保留');return;}
 patch={type:'doc',domain:url.href,title:url.hostname+' - 示例网页',icon:'google',query:''};}navigateTab(patch);toast('已更新本地样例，未请求网络');};
$('#web-form input').addEventListener('input',e=>activeTab().webDraft=e.target.value);$('#newtab-form input').addEventListener('input',e=>activeTab().newtabDraft=e.target.value);

document.addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(!b)return;const a=b.dataset.action;if(a==='assistant'||a==='close-assistant'){clearPopups();assistantOpen=a==='assistant'?!assistantOpen:false;renderPage();}else if(a==='dismiss-default')$('.default-browser').hidden=true;else if(a==='clear-query'){$('#web-form input').value='';activeTab().webDraft='';$('#web-form input').focus();}else if(a==='sample-page')showSampleSearch('示例网页');else if(a==='refresh'){$('#webpage').scrollTop=0;toast('已恢复本地页面顶部，未请求网络');}else if(a==='back'||a==='forward'){travelPage(a==='back'?-1:1);}else toast('该业务或系统操作本轮未模拟');});
for(const id of ['newtab-form','web-form'])$('#'+id).onsubmit=e=>{e.preventDefault();showSampleSearch($('#'+id+' input').value.trim()||'示例搜索')};
const windowDefs=[['restore','还原(R)','','caption-restore'],['move','移动(M)','','',true],['size','大小(S)','','',true],['minimize','最小化(N)','','caption-minimize'],['maximize','最大化(X)','','caption-maximize',true],null,['new','打开新的标签页(T)','Ctrl+T'],['reopen','重新打开关闭的标签页(E)','Ctrl+E'],['bookmark','为所有标签页添加书签...','Ctrl+Shift+D'],['name','为窗口命名(W)...',''],null,['task','任务管理器(T)',''],null,['close','关闭(C)','Alt+F4','caption-close']];
for(const def of windowDefs){if(!def){const sep=document.createElement('div');sep.className='system-separator';sep.role='separator';windowMenu.append(sep);continue;}const[action,label,key,glyph,disabled]=def,b=document.createElement('button');b.type='button';b.role='menuitem';b.className='system-menu-item'+(action==='restore'?' default-command':'');b.dataset.windowCommand=action;b.disabled=!!disabled;b.setAttribute('aria-label',label);b.innerHTML=`<span class="system-leading">${glyph?zero.svg(glyph):''}</span><span class="system-label">${label.replace(/\(([A-Z])\)/g,'(<u>$1</u>)')}</span><span class="system-key">${key}</span>`;b.onclick=()=>{clearPopups();if(action==='new')newTab();else toast('该窗口命令仅展示外观，未操作系统或真实浏览数据');$('#topbar').focus()};windowMenu.append(b);}
windowMenu.addEventListener('keydown',e=>menuKeys(e,windowMenu));
$('#topbar').addEventListener('contextmenu',e=>{if(e.target.closest('.tab,button,input,#current-location'))return;e.preventDefault();clearPopups();state.popup='window-menu';windowMenu.hidden=false;positionBox(windowMenu,e.clientX,e.clientY);windowMenu.querySelector('button:not(:disabled)').focus()});
document.addEventListener('pointerdown',e=>{if(!e.target.closest('#manager-overlay,#popover,#context-menu,#submenu,#window-system-menu,#search-button,#groups-button,.group-header,#hovercard,#address-editor,#current-location')){clearPopups();if(state.collapsed&&!$('#sidebar').contains(e.target)){state.peek=false;setLayout()}}});
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='l'){e.preventDefault();openAddress();return;}if(e.key==='Escape'){dismissPopups();state.peek=state.collapsed&&$('#sidebar').contains(document.activeElement);setLayout()}if(e.altKey&&e.shiftKey&&['c','w'].includes(e.key.toLowerCase())){const g=state.groups.find(x=>x.id===(state.popup==='edit-group'?popupAnchor:activeTab().group));if(g){e.preventDefault();if(e.key.toLowerCase()==='c')newTab(state.tabs.filter(t=>t.group===g.id).at(-1));else closeGroup(g)}return;}if((e.ctrlKey||e.metaKey)&&e.shiftKey&&e.key.toLowerCase()==='a'){e.preventDefault();showSearch()}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='t'){e.preventDefault();newTab()}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='w'){e.preventDefault();closeTabs([...state.selected])}});
$('#resize-handle').onpointerdown=e=>{if(state.collapsed)return;e.preventDefault();clearPopups();const start=e.clientX,width=state.width,handle=e.currentTarget;handle.setPointerCapture(e.pointerId);$('#browser').classList.add('resizing');let finished=false;
 const move=ev=>{const limits=sidebarLimits();state.preferredWidth=Math.max(limits.min,Math.min(limits.max,width+ev.clientX-start));setLayout()};
 const finish=()=>{if(finished)return;finished=true;for(const [type,fn]of [['pointermove',move],['pointerup',finish],['pointercancel',finish],['lostpointercapture',finish]])handle.removeEventListener(type,fn);$('#browser').classList.remove('resizing')};
 handle.addEventListener('pointermove',move);for(const type of ['pointerup','pointercancel','lostpointercapture'])handle.addEventListener(type,finish);
};
$('#resize-handle').onkeydown=e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();const l=sidebarLimits();state.preferredWidth=Math.max(l.min,Math.min(l.max,state.width+(e.key==='ArrowRight'?10:-10)));setLayout()}};

function syncNewtabDensity(){const page=$('#newtab');if(page.hidden)return;const compact=page.clientWidth<=1300;page.dataset.density=compact?'compact':'normal';const names=['bili','douyin','weibo','redbook','docs','mail'];$$('.shortcuts img').forEach((img,i)=>{const src='assets/shortcut-'+(compact?'compact-':'')+names[i]+'.png';if(img.getAttribute('src')!==src)img.src=src;});}
new ResizeObserver(syncNewtabDensity).observe($('#newtab'));
const sideRegionObserver=new ResizeObserver(scheduleSideLayout);for(const e of [$('#tab-area'),$('#pins'),$('#list')])sideRegionObserver.observe(e);
window.addEventListener('resize',()=>{if(manager.isOpen()){state.peek=false;setLayout();return;}if(addressOpen){state.peek=false;setLayout();positionAddressEditor()}else{clearPopups();state.peek=false;setLayout()}});render();if(['address-new','address-web'].includes(scenario))openAddress();if(['search','manager','manager-two'].includes(scenario))showSearch();if(scenario==='group-menu')showGroupEditor(state.groups[0],$('[data-group-more="g1"]'));
})();
