/**
 * Controle dos serviços systemd do Pi.
 *
 * O usuário `pi` tem `NOPASSWD: ALL`, então o backend já podia rodar qualquer
 * coisa como root -- este módulo não ganha privilégio novo, ele *expõe* o que
 * já existia. Por isso as duas travas abaixo, que são o ponto do arquivo:
 *
 *   1. A unidade nunca vem do pedido. O cliente manda uma chave, e a chave é
 *      procurada nesta tabela. Um `?unidade=ssh` (ou pior) não tem por onde
 *      chegar no systemctl.
 *   2. `execFile` com argumentos em array, nunca `exec`. Não há shell no meio,
 *      então não existe interpolação para explorar mesmo que a trava 1 caísse.
 */

const { execFile } = require('child_process');

const ACOES = ['start', 'stop', 'restart'];

/*
 * `podeParar: false` no backend é deliberado.
 *
 * Parar o alexo.service pelo admin mata o servidor que está servindo a página
 * do admin -- e aí não há mais UI para ligar de volta, só ssh. Reiniciar é
 * seguro: o systemd sobe de novo sozinho.
 */
const SERVICOS = {
  alexo: {
    unidade: 'alexo.service',
    rotulo: 'Backend',
    descricao: 'Serve a API e o frontend',
    podeParar: false,
  },
  'alexo-display': {
    unidade: 'alexo-display.service',
    rotulo: 'Display (kiosk)',
    descricao: 'O Chromium em tela cheia',
    podeParar: true,
  },
  'alexo-mpv': {
    unidade: 'alexo-mpv.service',
    rotulo: 'Player (mpv)',
    descricao: 'Processo de áudio; parar corta a música',
    podeParar: true,
  },
  'wifi-monitor': {
    unidade: 'wifi-monitor.service',
    rotulo: 'Monitor de Wi-Fi',
    descricao: 'Amostra SSID e sinal no journald',
    podeParar: true,
  },
};

function systemctl(args) {
  return new Promise((resolve, reject) => {
    execFile('sudo', ['-n', 'systemctl'].concat(args), { timeout: 15000 }, (err, stdout, stderr) => {
      // `is-active` sai com código != 0 quando o serviço está parado, o que é
      // uma resposta e não uma falha. Quem chama decide.
      if (err && !stdout) return reject(new Error((stderr || err.message).trim()));
      resolve(String(stdout).trim());
    });
  });
}

/** Estado de um serviço. Nunca lança: um serviço ilegível vira 'desconhecido'. */
async function statusDe(chave) {
  const servico = SERVICOS[chave];
  try {
    const saida = await systemctl([
      'show',
      servico.unidade,
      '-p', 'ActiveState',
      '-p', 'SubState',
      '-p', 'ActiveEnterTimestamp',
      '--value',
    ]);
    const [estado, sub, desde] = saida.split('\n');
    return {
      chave,
      rotulo: servico.rotulo,
      descricao: servico.descricao,
      podeParar: servico.podeParar,
      estado: estado || 'desconhecido',
      sub: sub || '',
      // O Zero W não tem RTC e fica sem NTP quando cai da rede, então esse
      // timestamp às vezes vem de uma data absurda. Vai cru; quem exibe avisa.
      desde: desde || '',
    };
  } catch (err) {
    return {
      chave,
      rotulo: servico.rotulo,
      descricao: servico.descricao,
      podeParar: servico.podeParar,
      estado: 'desconhecido',
      sub: '',
      desde: '',
      erro: err.message,
    };
  }
}

function listar() {
  return Promise.all(Object.keys(SERVICOS).map(statusDe));
}

/**
 * Executa a ação. Devolve `{ imediato: false }` quando o serviço a reiniciar é
 * o próprio backend -- nesse caso quem chama precisa responder ANTES, porque o
 * systemd manda SIGTERM neste processo e a resposta HTTP nunca sairia.
 */
function executar(chave, acao) {
  const servico = SERVICOS[chave];
  if (!servico) throw new Error(`Serviço desconhecido: ${chave}`);
  if (ACOES.indexOf(acao) === -1) throw new Error(`Ação desconhecida: ${acao}`);
  if (acao === 'stop' && !servico.podeParar) {
    throw new Error(`${servico.rotulo} não pode ser parado pelo admin, só reiniciado`);
  }

  const suicida = chave === 'alexo';
  const rodar = () => systemctl([acao, servico.unidade]);

  return { suicida, rodar };
}

module.exports = { SERVICOS, ACOES, listar, statusDe, executar };
