'use strict';
const query = new URLSearchParams(location.search);
const plan = query.get('plan') === 'b' ? 'b' : 'a';
if (query.has('state')) {
  location.replace('screenshots.html' + location.search);
} else {
  const path = plan === 'b' ? 'demo/B/v0.9-review.2/' : 'demo/A/v0.10-review.2/';
  const search = plan === 'b' && query.get('data') === 'many' ? '?data=many' : '';
  document.getElementById(plan).setAttribute('aria-current', 'page');
  document.getElementById('full').href = path + search;
  document.getElementById('demo').src = path + search;
  document.getElementById('screenshots').href = 'screenshots.html?plan=' + plan;
}
