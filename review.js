'use strict';

const plans = window.reviewPlans;
const element = id => document.getElementById(id);

function locationFor(plan, state) {
  return '?' + new URLSearchParams({plan:plan.id,state:state.id});
}

function navigationLink(label, href, current) {
  const link = document.createElement('a');
  link.href = href;
  link.textContent = label;
  if (current) link.setAttribute('aria-current','page');
  return link;
}

function render() {
  const query = new URLSearchParams(location.search);
  const plan = plans.find(item => item.id === query.get('plan')) || plans[0];
  const state = plan.states.find(item => item.id === query.get('state')) || plan.states[0];
  element('plans').replaceChildren(...plans.map(item =>
    navigationLink(item.name, locationFor(item,item.states[0]), item === plan)));
  element('states').replaceChildren(...plan.states.map(item =>
    navigationLink(item.label, locationFor(plan,item), item === state)));
  element('plan-title').textContent = plan.title;
  element('version').textContent = plan.version;
  element('summary').textContent = plan.summary;
  element('state-name').textContent = state.label;
  element('state-description').textContent = state.description;
  element('preview').src = state.image;
  element('preview').alt = plan.name + ' · ' + state.label;
  element('image-link').href = state.image;
  element('original').href = state.image;
  document.title = plan.name + ' · ' + state.label + ' · ZERO Windows 垂直标签评审';
}

render();
