const API = window.ADMIN_API;

function avisar(texto) {
  const el = document.getElementById('aviso');
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
  const campo = ev.target.closest('.nota-in');
  if (!campo) return;

  const id = campo.closest('.card').dataset.id;
  try {
    const r = await fetch(API + '/api/prints/' + id, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nota: campo.value }),
    });
    if (!r.ok) throw new Error((await r.json()).error || 'Falhou');
    avisar('nota salva');
  } catch (e) {
    alert('Não deu para salvar a nota: ' + e.message);
  }
});

document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Enter' && ev.target.closest('.nota-in')) ev.target.blur();
});

document.addEventListener('click', async (ev) => {
  const bt = ev.target.closest('.del');
  if (!bt) return;

  const cartao = bt.closest('.card');
  // Apagar um print não tem desfazer e o arquivo sai do cartão junto.
  if (!confirm('Remover este print? O arquivo sai do Pi.')) return;

  try {
    const r = await fetch(API + '/api/prints/' + cartao.dataset.id, { method: 'DELETE' });
    if (!r.ok) throw new Error((await r.json()).error || 'Falhou');
    cartao.remove();
    avisar('print removido');
  } catch (e) {
    alert('Não deu para remover: ' + e.message);
  }
});
