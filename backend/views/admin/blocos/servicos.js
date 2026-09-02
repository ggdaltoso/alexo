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
function botoes(s) {
  const rota = (acao) => `/admin/blocos/servicos/${encodeURIComponent(s.chave)}/${acao}`;
  const comum = (acao) =>
    `hx-post="${rota(acao)}" hx-target="#servicos" hx-swap="innerHTML"` +
    ` hx-disabled-elt="#servicos button"`;

  const ativo = s.estado === 'active';
  return [
    ativo ? '' : `<button ${comum('start')}>ligar</button>`,
    s.podeParar && ativo
      ? `<button ${comum('stop')} hx-confirm="Desligar ${esc(s.chave)}?">desligar</button>`
      : '',
    `<button ${comum('restart')}>reiniciar</button>`,
  ].join('');
}

module.exports = function blocoServicos(servicos) {
  return servicos.map((s) => {
    // O estado completo vai no title: o ponto sozinho não distingue "inactive"
    // de "failed", e é justamente essa diferença que interessa quando alguma
    // coisa quebrou. Escapado porque o erro vem do stderr do systemctl.
    const titulo = esc(s.estado + (s.sub ? ` (${s.sub})` : '') + (s.erro ? ` — ${s.erro}` : ''));

    return `<div class="linha">` +
      `<span class="k">` +
        `<span class="pt ${COR_DO_ESTADO[s.estado] || 'pt-meio'}" title="${titulo}"></span>` +
        `${esc(s.rotulo)}<br><small>${esc(s.descricao)}</small>` +
      `</span>` +
      `<span class="btns">${botoes(s)}</span>` +
    `</div>`;
  }).join('');
};
