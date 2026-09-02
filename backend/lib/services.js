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
    unit: 'alexo.service',
    label: 'Backend',
    description: 'Serve a API e o frontend',
    canStop: false,
  },
  'alexo-display': {
    unit: 'alexo-display.service',
    label: 'Display (kiosk)',
    description: 'O Chromium em tela cheia',
    canStop: true,
  },
  'alexo-mpv': {
    unit: 'alexo-mpv.service',
    label: 'Player (mpv)',
    description: 'Processo de áudio; parar corta a música',
    canStop: true,
  },
  'wifi-monitor': {
    unit: 'wifi-monitor.service',
    label: 'Monitor de Wi-Fi',
    description: 'Amostra SSID e sinal no journald',
    canStop: true,
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
async function statusDe(key) {
  const service = SERVICOS[key];
  try {
    const output = await systemctl([
      'show',
      service.unit,
      '-p', 'ActiveState',
      '-p', 'SubState',
      '-p', 'ActiveEnterTimestamp',
      '--value',
    ]);
    const [state, sub, since] = output.split('\n');
    return {
      key,
      label: service.label,
      description: service.description,
      canStop: service.canStop,
      state: state || 'desconhecido',
      sub: sub || '',
      // O Zero W não tem RTC e fica sem NTP quando cai da rede, então esse
      // timestamp às vezes vem de uma data absurda. Vai cru; quem exibe avisa.
      since: since || '',
    };
  } catch (err) {
    return {
      key,
      label: service.label,
      description: service.description,
      canStop: service.canStop,
      state: 'desconhecido',
      sub: '',
      since: '',
      error: err.message,
    };
  }
}

function list() {
  return Promise.all(Object.keys(SERVICOS).map(statusDe));
}

/**
 * Executa a ação. Devolve `{ imediato: false }` quando o serviço a reiniciar é
 * o próprio backend -- nesse caso quem chama precisa responder ANTES, porque o
 * systemd manda SIGTERM neste processo e a resposta HTTP nunca sairia.
 */
function prepare(key, action) {
  const service = SERVICOS[key];
  if (!service) throw new Error(`Serviço desconhecido: ${key}`);
  if (ACOES.indexOf(action) === -1) throw new Error(`Ação desconhecida: ${action}`);
  if (action === 'stop' && !service.canStop) {
    throw new Error(`${service.label} não pode ser parado pelo admin, só reiniciado`);
  }

  const selfKilling = key === 'alexo';
  const run = () => systemctl([action, service.unit]);

  return { selfKilling, run };
}

/*
 * Desligar e reiniciar a máquina.
 *
 * Existe porque a alternativa era puxar o cabo. O Pi escreve em segundo plano
 * -- journald, state.json, swap -- e cortar a energia no meio de uma escrita
 * corrompe o cartão SD. O poweroff faz sync, desmonta e só então corta.
 *
 * Assimetria que importa: `reboot` volta sozinho, `poweroff` não. O Zero W não
 * tem wake-on-LAN nem botão de liga, então depois de desligado só presencial-
 * mente. Quem chama precisa deixar isso explícito para quem clica.
 */
const SISTEMA = {
  reboot: {
    label: 'Reiniciar o Pi',
    args: ['reboot'],
    comesBack: true,
  },
  poweroff: {
    label: 'Desligar o Pi',
    args: ['poweroff'],
    comesBack: false,
  },
};

function system(action) {
  const target = SISTEMA[action];
  if (!target) throw new Error(`Ação de sistema desconhecida: ${action}`);
  // Sempre "suicida": a máquina inteira cai, então a resposta HTTP tem de sair
  // antes. Ver o comentário da rota em routes/api/system.js.
  return { label: target.label, comesBack: target.comesBack, run: () => systemctl(target.args) };
}

module.exports = { SERVICOS, ACOES, SISTEMA, list, statusDe, prepare, system };
