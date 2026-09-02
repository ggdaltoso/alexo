/**
 * A lista de serviços do índice do admin.
 *
 * É um fragmento, não uma página: volta sem <html> em volta para o htmx trocar
 * dentro do #servicos. O bloco se repinta sozinho a cada 2s e depois de cada
 * ação, e as duas coisas passam por aqui -- é a mesma marcação nos dois casos,
 * que é justamente o que não acontecia quando o cliente montava esse HTML por
 * conta própria.
 */
const esc = require('../esc');

// Estado do systemd -> cor do ponto. O que não estiver aqui (activating,
// deactivating, desconhecido) cai no amarelo: é transitório ou ilegível,
// e nos dois casos "nem verde nem vermelho" é a leitura honesta.
const COR_DO_ESTADO = { active: 'pt-ok', failed: 'pt-erro', inactive: 'pt-off' };

/** Botões de um serviço. O alvo é sempre o bloco inteiro: uma ação muda a linha
 *  que foi clicada e pode mudar as outras junto (reiniciar o backend derruba
 *  tudo por um instante). */
function buttons(s) {
  const route = (action) => `/admin/partials/services/${encodeURIComponent(s.key)}/${action}`;
  const common = (action) =>
    `hx-post="${route(action)}" hx-target="#servicos" hx-swap="innerHTML"` +
    ` hx-disabled-elt="#servicos button"`;

  const active = s.state === 'active';
  return [
    active ? '' : `<button ${common('start')}>ligar</button>`,
    s.canStop && active
      ? `<button ${common('stop')} hx-confirm="Desligar ${esc(s.key)}?">desligar</button>`
      : '',
    `<button ${common('restart')}>reiniciar</button>`,
  ].join('');
}

module.exports = function servicesBlock(services) {
  return services.map((s) => {
    // O estado completo vai no title: o ponto sozinho não distingue "inactive"
    // de "failed", e é justamente essa diferença que interessa quando alguma
    // coisa quebrou. Escapado porque o erro vem do stderr do systemctl.
    const title = esc(s.state + (s.sub ? ` (${s.sub})` : '') + (s.error ? ` — ${s.error}` : ''));

    return `<div class="linha">` +
      `<span class="k">` +
        `<span class="pt ${COR_DO_ESTADO[s.state] || 'pt-meio'}" title="${title}"></span>` +
        `${esc(s.label)}<br><small>${esc(s.description)}</small>` +
      `</span>` +
      `<span class="btns">${buttons(s)}</span>` +
    `</div>`;
  }).join('');
};
