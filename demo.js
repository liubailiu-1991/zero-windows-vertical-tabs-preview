'use strict';
const query = new URLSearchParams(location.search);
const plan = query.get('plan') === 'b' ? 'b' : 'a';
if (query.has('state')) {
  location.replace('screenshots.html' + location.search);
} else {
  const frame = document.getElementById('demo');
  const full = document.getElementById('full');
  document.getElementById(plan).setAttribute('aria-current', 'page');
  document.getElementById('screenshots').href = 'screenshots.html?plan=' + plan;
  if (plan === 'b') {
    full.href = 'demo/B/v0.9-review.2/' + (query.get('data') === 'many' ? '?data=many' : '');
    frame.src = full.href;
  } else {
    const options = document.getElementById('shortcut-mode');
    const buttons = options.querySelectorAll('button');
    let mode = query.get('shortcuts') === 'icons' ? 'icons' : 'labels';
    const sendMode = () => frame.contentWindow.postMessage(
      {type:'zero:quick-tools-mode', mode}, location.origin
    );
    function updateControls() {
      full.href = 'demo/A/v0.14-review.3/?shortcuts=' + mode;
      for (const button of buttons) {
        button.setAttribute('aria-pressed', String(button.dataset.shortcuts === mode));
      }
    }
    for (const button of buttons) {
      button.addEventListener('click', () => {
        mode = button.dataset.shortcuts;
        query.set('shortcuts', mode);
        history.replaceState(null, '', '?' + query);
        updateControls();
        sendMode();
      });
    }
    updateControls();
    options.hidden = false;
    frame.addEventListener('load', sendMode);
    frame.src = full.href;
  }
}
