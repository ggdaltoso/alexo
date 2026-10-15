const API = window.ADMIN_API;

// Recado curto na barra de status, que some sozinho.
function notify(texto) {
  const el = document.getElementById('notice');
  el.textContent = texto;
  clearTimeout(el._t);
  el._t = setTimeout(() => (el.textContent = ''), 3000);
}

// Motivo do backend quando ele manda um; sem isso, o status HTTP.
async function motivo(r) {
  const body = await r.json().catch(() => ({}));
  return body.error || 'erro ' + r.status;
}

/*
 * A nota salva ao sair do campo, e não a cada tecla: são escritas no cartão
 * SD, e uma por caractere digitado é justamente o que este projeto evita em
 * todo lugar. Enter também salva, para quem não quer clicar fora.
 */
document.addEventListener('change', async (ev) => {
  const field = ev.target.closest('.note-input');
  if (!field) return;

  const id = field.closest('.card').dataset.id;
  try {
    const r = await fetch(API + '/api/prints/' + id, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: field.value }),
    });
    if (!r.ok) throw new Error(await motivo(r));
    notify('Nota salva.');
  } catch (e) {
    aviso('Não deu para salvar a nota: ' + e.message, { titulo: 'Prints' });
  }
});

document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Enter' && ev.target.closest('.note-input')) ev.target.blur();
});

document.addEventListener('click', async (ev) => {
  const bt = ev.target.closest('.del');
  if (!bt) return;

  const card = bt.closest('.card');
  // Apagar um print não tem desfazer e o arquivo sai do cartão junto.
  const sim = await confirmar('Remover este print?\n\nO arquivo é apagado do Pi.',
    { titulo: 'Remover print', ok: 'Remover', perigo: true });
  if (!sim) return;

  try {
    const r = await fetch(API + '/api/prints/' + card.dataset.id, { method: 'DELETE' });
    if (!r.ok) throw new Error(await motivo(r));
    // Recarrega em vez de só tirar o cartão: o mês pode ficar vazio e os totais
    // da barra de status mudam, e o servidor já sabe recalcular os dois.
    card.remove();
    notify('Print removido.');
    setTimeout(() => location.reload(), 1200);
  } catch (e) {
    aviso('Não deu para remover o print: ' + e.message, { titulo: 'Prints' });
  }
});
