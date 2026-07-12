// Onda 1.F — Topbar (breadcrumb + título + ações)
// Implementação portada de mazyui-ui.js:1029-1033.
//
// actionsHTML aceita HTML cru (já é string produzida pela própria UI —
// sem entrada de usuário); uso de innerHTML é intencional e seguro
// nesse contexto, conforme o original.

export function setTopbar(crumb, title, actionsHTML = '') {
  const crumbEl   = document.getElementById('crumb');
  const titleEl   = document.getElementById('page-title');
  const actionsEl = document.getElementById('topbar-actions');

  if (crumbEl)   crumbEl.textContent   = crumb   || '';
  if (titleEl)   titleEl.textContent   = title   || '';
  if (actionsEl) actionsEl.innerHTML   = actionsHTML || '';  // HTML cru permitido (produzido pela UI)
}
