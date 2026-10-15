/*
 * Avisos e confirmações do admin, no lugar de alert() e confirm().
 *
 * Os nativos travam a aba inteira, não seguem o visual e mostram o texto cru --
 * o "\n" que alguém escapou duas vezes aparecia literal na confirmação de
 * desligar. Aqui é um <dialog> com a janela do 98.css: o navegador já dá foco
 * preso, Esc para fechar e o fundo escurecido, sem biblioteca.
 *
 * As duas funções devolvem Promise, então a troca no código das páginas é
 * `if (!confirm(x))` -> `if (!(await confirmar(x)))`.
 *
 *   aviso(mensagem, { titulo })                          -> Promise<void>
 *   confirmar(mensagem, { titulo, ok, cancelar, perigo }) -> Promise<boolean>
 *
 * `perigo` deixa o foco inicial no Cancelar: um Enter distraído em "Desligar o
 * Pi?" não pode ser o que desliga.
 *
 * `dialogoAberto()` existe para quem atualiza a página por baixo: o confirm()
 * nativo travava a página e o polling junto; o modal não trava nada.
 */
(function () {
  function abrir({ titulo, mensagem, botoes, foco }) {
    return new Promise((resolve) => {
      const dialog = document.createElement('dialog');
      dialog.className = 'dialogo';
      dialog.innerHTML =
        '<div class="window">' +
          '<div class="title-bar">' +
            '<div class="title-bar-text"></div>' +
            '<div class="title-bar-controls"><button aria-label="Close" value="fechar"></button></div>' +
          '</div>' +
          '<div class="window-body">' +
            '<p class="dialogo-mensagem"></p>' +
            '<section class="field-row dialogo-botoes"></section>' +
          '</div>' +
        '</div>';

      // textContent, nunca innerHTML: a mensagem costuma trazer erro do
      // backend, que pode ter qualquer coisa dentro.
      dialog.querySelector('.title-bar-text').textContent = titulo;
      dialog.querySelector('.dialogo-mensagem').textContent = mensagem;

      const linha = dialog.querySelector('.dialogo-botoes');
      for (const b of botoes) {
        const el = document.createElement('button');
        el.textContent = b.texto;
        el.value = b.valor;
        linha.appendChild(el);
      }

      // Resolve na hora, no clique ou no Esc, em vez de esperar o evento
      // 'close': ele chega numa tarefa à parte que o Chrome adia em aba fora de
      // foco, e a resposta ficava parada até alguém olhar a aba. 'close' fica só
      // de reserva, para um fechamento que não passe por aqui.
      let resolvido = false;
      const fechar = (valor) => {
        if (resolvido) return;
        resolvido = true;
        if (dialog.open) dialog.close();
        dialog.remove();
        resolve(valor);
      };
      dialog.addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (b) fechar(b.value);
      });
      dialog.addEventListener('cancel', (e) => {
        e.preventDefault();
        fechar('fechar');
      });
      dialog.addEventListener('close', () => fechar('fechar'));

      document.body.appendChild(dialog);
      dialog.showModal();
      linha.querySelector(`button[value="${foco}"]`).focus();
    });
  }

  window.aviso = function aviso(mensagem, { titulo = 'Alexo' } = {}) {
    return abrir({
      titulo,
      mensagem,
      botoes: [{ texto: 'OK', valor: 'ok' }],
      foco: 'ok',
    }).then(() => undefined);
  };

  window.dialogoAberto = () => document.querySelector('dialog.dialogo[open]') !== null;

  window.confirmar = function confirmar(
    mensagem,
    { titulo = 'Confirmar', ok = 'OK', cancelar = 'Cancelar', perigo = false } = {}
  ) {
    return abrir({
      titulo,
      mensagem,
      botoes: [
        { texto: ok, valor: 'ok' },
        { texto: cancelar, valor: 'cancelar' },
      ],
      foco: perigo ? 'cancelar' : 'ok',
    }).then((valor) => valor === 'ok');
  };

  // hx-confirm usa o confirm() nativo por padrão. O htmx avisa antes com
  // 'htmx:confirm' e deixa segurar a requisição: sem pergunta não há o que
  // confirmar, então só intercepta quando o elemento tem hx-confirm.
  //
  // Título e botão vêm de data-confirmar-titulo/-ok no elemento, para o modal
  // dizer a ação ("Desligar") em vez de um "OK" genérico.
  //
  // O htmx descarta em silêncio a requisição de um elemento que saiu da
  // página. Num bloco com polling, o botão clicado pode ser trocado enquanto o
  // modal está aberto -- pausar o polling com dialogoAberto() evita as rodadas
  // novas, mas não a que já estava em voo no clique. Então, se no "sim" o
  // botão não está mais lá, o equivalente é o que tem a mesma rota: ele é
  // clicado já marcado como confirmado, e a marca faz este handler liberar a
  // requisição sem perguntar de novo.
  document.addEventListener('htmx:confirm', (e) => {
    if (!e.detail.question) return;
    e.preventDefault();
    const elt = e.detail.elt;
    if (elt.dataset.confirmado) {
      delete elt.dataset.confirmado;
      e.detail.issueRequest(true);
      return;
    }

    const d = elt.dataset;
    confirmar(e.detail.question, {
      titulo: d.confirmarTitulo || 'Confirmar',
      ok: d.confirmarOk || 'OK',
      perigo: true,
    }).then((sim) => {
      if (!sim) return;
      if (elt.isConnected) return e.detail.issueRequest(true);

      const rota = `hx-${e.detail.verb}`;
      const novo = [...document.querySelectorAll(`[${rota}]`)]
        .find((el) => el.getAttribute(rota) === e.detail.path);
      if (!novo) {
        return aviso('O estado mudou enquanto a confirmação estava aberta, e nada foi feito. ' +
          'Confira e tente de novo.', { titulo: d.confirmarTitulo || 'Confirmar' });
      }
      novo.dataset.confirmado = '1';
      novo.click();
    });
  });
})();
