const API = window.ADMIN_API;

function notify(texto) {
  const el = document.getElementById('notice');
  el.textContent = texto;
  el.classList.add('on');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('on'), 1800);
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
    if (!r.ok) throw new Error((await r.json()).error || 'Falhou');
    notify('nota salva');
  } catch (e) {
    alert('Não deu para salvar a nota: ' + e.message);
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
  if (!confirm('Remover este print? O arquivo sai do Pi.')) return;

  try {
    const r = await fetch(API + '/api/prints/' + card.dataset.id, { method: 'DELETE' });
    if (!r.ok) throw new Error((await r.json()).error || 'Falhou');
    card.remove();
    notify('print removido');
  } catch (e) {
    alert('Não deu para remover: ' + e.message);
  }
});
