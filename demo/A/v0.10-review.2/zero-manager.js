/* ZERO tab manager layout adapted from the fixed tag_view source; local samples only. */
window.createZeroTabManager = function(adapter) {
 'use strict';
 const overlay=document.createElement('div');overlay.id='manager-overlay';overlay.hidden=true;
 const dialog=document.createElement('section');dialog.id='zero-tab-manager';dialog.role='dialog';dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-label','ZERO 标签管理');
 const closeIcon=window.ZERO_NATIVE_ICONS.close,plusIcon=window.ZERO_NATIVE_ICONS.plus,searchIcon=window.ZERO_NATIVE_ICONS['search-tab'];
 dialog.innerHTML='<header class="manager-head"><div class="manager-head-left"><div class="manager-brand"><img src="assets/app-logo.png" alt=""><span>ZERO</span></div><div class="manager-query-wrap"><span class="manager-search-icon">'+searchIcon+'</span><input aria-label="搜索标签页" placeholder="搜索标签页" autocomplete="off" spellcheck="false"><button class="manager-query-clear" aria-label="清空搜索" hidden>'+closeIcon+'</button></div></div><div class="manager-head-right"><span id="manager-count" aria-live="polite"></span><button class="manager-new" aria-label="新建标签">'+plusIcon+'<span>新建标签</span></button><button class="manager-close" aria-label="关闭标签管理">'+closeIcon+'</button></div></header><div class="manager-body"><div class="manager-grid"></div><div class="manager-empty" hidden><p></p><span>请尝试其他关键词，或创建新标签页</span></div></div><footer class="manager-footer"><div class="manager-windows" aria-label="样例窗口列表"></div></footer>';
 overlay.append(dialog);document.body.append(overlay);
 const input=dialog.querySelector('input'),grid=dialog.querySelector('.manager-grid'),body=dialog.querySelector('.manager-body'),empty=dialog.querySelector('.manager-empty'),clear=dialog.querySelector('.manager-query-clear');
 let opened=false,trigger=null;
 const triggers=()=>[...document.querySelectorAll('#search-button,#horizontal-manager')];
 const preview=t=>'assets/'+(t.type==='new'?'preview-newtab.png':t.type==='about'?'preview-settings.png':'preview-web.png');
 function close(restoreFocus=true){
  if(!opened)return;opened=false;overlay.hidden=true;document.querySelector('#browser').inert=false;
  triggers().forEach(b=>{b.classList.remove('open');b.setAttribute('aria-expanded','false')});adapter.didClose();
  if(restoreFocus)trigger?.focus({preventScroll:true});
 }
 function render(){
  const query=input.value.trim().toLocaleLowerCase(),tabs=adapter.tabs().filter(t=>!query||t.title.toLocaleLowerCase().includes(query)||t.domain.toLocaleLowerCase().includes(query));
  document.querySelector('#manager-count').textContent=tabs.length+'个标签';clear.hidden=!input.value;
  grid.replaceChildren();empty.hidden=tabs.length>0;empty.querySelector('p').textContent=query?'未找到相关的标签':'暂无标签页';
  for(const t of tabs){
   const card=document.createElement('article');card.className='manager-tab'+(t.id===adapter.active()?' active':'');card.dataset.id=t.id;
   const choose=document.createElement('button');choose.className='manager-tab-open';choose.setAttribute('aria-label','切换到 '+t.title);
   const head=document.createElement('span');head.className='manager-card-head';const mark=document.createElement('span');mark.innerHTML=adapter.favicon(t);const title=document.createElement('span');title.className='manager-card-title';title.textContent=t.title;title.title=t.title;head.append(mark,title);
   const image=document.createElement('img');image.className='manager-preview';image.src=preview(t);image.alt='';choose.append(head,image);choose.onclick=()=>{close(false);adapter.activate(t.id)};
   const remove=document.createElement('button');remove.className='manager-tab-close';remove.setAttribute('aria-label','关闭标签 '+t.title);remove.innerHTML=closeIcon;
   remove.onclick=()=>{const query=input.value,scroll=body.scrollTop;adapter.closeTab(t.id);open({query,scroll,focusInput:false});const next=grid.querySelector('.manager-tab-close');(next||input).focus({preventScroll:true})};
   card.append(choose,remove);grid.append(card);
  }
  const windows=dialog.querySelector('.manager-windows');windows.replaceChildren();
  for(const w of adapter.windows()){
   const button=document.createElement('button');button.className='manager-window';button.setAttribute('aria-label','切换到示例窗口 '+w.number);button.setAttribute('aria-pressed',String(w.current));
   const frame=document.createElement('span');frame.className='manager-window-frame';const title=document.createElement('span');title.className='manager-window-title';title.textContent=w.tab.title;title.title=w.tab.title;const image=document.createElement('img');image.src=preview(w.tab);image.alt='';frame.append(title,image);
   const count=document.createElement('span');count.className='manager-window-count';count.textContent=w.count+'个标签页';button.append(frame,count);button.onclick=()=>{close(false);adapter.selectWindow(w.id)};windows.append(button);
  }
  const create=document.createElement('button');create.className='manager-window-new';create.setAttribute('aria-label','新建窗口');create.innerHTML='<span>新建窗口</span>'+plusIcon;create.onclick=()=>{close(false);adapter.newWindow()};windows.append(create);
 }
 function open(options={}){
  const previous=trigger;adapter.beforeOpen();trigger=options.trigger||previous||adapter.trigger();
  opened=true;overlay.hidden=false;input.value=options.query||'';adapter.didOpen();
  triggers().forEach(b=>{b.classList.add('open');b.setAttribute('aria-expanded','true');b.setAttribute('aria-controls','zero-tab-manager');b.setAttribute('aria-haspopup','dialog')});
  document.querySelector('#browser').inert=true;render();body.scrollTop=options.scroll||0;
  if(options.focusInput!==false)input.focus({preventScroll:true});
 }
 input.oninput=()=>{render();body.scrollTop=0};clear.onclick=()=>{input.value='';render();input.focus()};
 input.onkeydown=e=>{if(e.key==='Enter'&&!e.isComposing){e.preventDefault();grid.querySelector('.manager-tab-open')?.click()}};
 dialog.querySelector('.manager-close').onclick=()=>close();dialog.querySelector('.manager-new').onclick=()=>{close(false);adapter.newTab()};
 overlay.addEventListener('pointerdown',e=>{e.stopPropagation();if(e.target===overlay)close()});
 overlay.addEventListener('keydown',e=>{
  if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();return}
  if(e.key==='Tab'){
   const focusable=[...dialog.querySelectorAll('button,input')].filter(el=>!el.hidden&&el.offsetParent!==null&&!el.disabled),first=focusable[0],last=focusable.at(-1);
   if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
  }
 });
 return {open,close,isOpen:()=>opened,toggle(trigger){if(opened)close();else open({trigger})}};
};
