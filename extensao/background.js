// CopyBet - background.js (Service Worker)
// Fase 2: WebSocket com autenticacao JWT

const WS_URL = 'wss://content-inspiration-production-b4b2.up.railway.app'; // substituir no deploy

let socket = null;
let usuarioId = null;
let token = null;
let ativo = true;
let tentativas = 0;

// Recupera dados salvos ao iniciar
chrome.storage.local.get(['userId', 'token', 'ativo'], (dados) => {
  if (dados.userId && dados.token) {
    usuarioId = dados.userId;
    token = dados.token;
    ativo = dados.ativo !== false;
    conectar();
  }
});

function conectar() {
  if (socket) {
    socket.close();
    socket = null;
  }

  socket = new WebSocket(`${WS_URL}?token=${token}`);

  socket.onopen = () => {
    tentativas = 0;
    console.log('[CopyBet] Conectado ao servidor');
    socket.send(JSON.stringify({ tipo: 'identificar', userId: usuarioId }));
    chrome.storage.local.set({ status: 'conectado' });
  };

  socket.onmessage = (event) => {
    try {
      const dados = JSON.parse(event.data);
      if (dados.tipo === 'sinal' && ativo) {
        processarSinal(dados);
      }
    } catch (e) {
      console.error('[CopyBet] Mensagem invalida:', e);
    }
  };

  socket.onclose = () => {
    chrome.storage.local.set({ status: 'desconectado' });
    // Reconexao exponencial: 5s, 10s, 20s... maximo 60s
    const delay = Math.min(5000 * Math.pow(2, tentativas), 60000);
    tentativas++;
    console.log(`[CopyBet] Desconectado. Reconectando em ${delay / 1000}s...`);
    setTimeout(conectar, delay);
  };

  socket.onerror = () => {
    console.error('[CopyBet] Erro no WebSocket');
  };
}

async function processarSinal(sinal) {
  console.log('[CopyBet] Sinal recebido:', sinal);

  const casaUrls = {
    betano: 'https://www.betano.com/sport',
    bet365: 'https://www.bet365.com',
    kto: 'https://www.kto.com',
  };

  const casa = sinal.casa?.toLowerCase();
  const url = casaUrls[casa];

  if (!url) {
    console.warn('[CopyBet] Casa nao suportada:', sinal.casa);
    return;
  }

  // Salva o sinal para o content script consumir
  await chrome.storage.local.set({ sinal_pendente: sinal });
  chrome.tabs.create({ url });
}

// Mensagens do popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.tipo === 'login') {
    usuarioId = msg.userId;
    token = msg.token;
    ativo = true;
    chrome.storage.local.set({ userId: usuarioId, token, ativo: true, status: 'conectando' });
    conectar();
    sendResponse({ ok: true });
  }

  if (msg.tipo === 'logout') {
    if (socket) socket.close();
    chrome.storage.local.clear();
    sendResponse({ ok: true });
  }

  if (msg.tipo === 'toggle_ativo') {
    ativo = msg.ativo;
    chrome.storage.local.set({ ativo });
    sendResponse({ ok: true });
  }

  if (msg.tipo === 'status') {
    sendResponse({
      ativo,
      conectado: socket?.readyState === WebSocket.OPEN,
      usuarioId,
    });
  }

  return true; // necessario para sendResponse assincrono
});
