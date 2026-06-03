const API_URL = 'https://content-inspiration-production-b4b2.up.railway.app'; // substituir no deploy

const telaLogin = document.getElementById('tela-login');
const telaDashboard = document.getElementById('tela-dashboard');
const erroLogin = document.getElementById('erro-login');
const dot = document.getElementById('dot');
const statusTexto = document.getElementById('status-texto');
const infoTexto = document.getElementById('info-texto');
const btnToggle = document.getElementById('btn-toggle');
const btnLogout = document.getElementById('btn-logout');

let ativoAtual = true;

// Verifica se ja esta logado
chrome.storage.local.get(['token', 'userId'], ({ token, userId }) => {
  if (token && userId) {
    mostrarDashboard();
  } else {
    mostrarLogin();
  }
});

// Login
document.getElementById('btn-login').addEventListener('click', async () => {
  const email = document.getElementById('input-email').value.trim();
  const senha = document.getElementById('input-senha').value;
  erroLogin.textContent = '';

  if (!email || !senha) {
    erroLogin.textContent = 'Preencha e-mail e senha.';
    return;
  }

  try {
    const resp = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, senha }),
    });
    const dados = await resp.json();

    if (!resp.ok) {
      erroLogin.textContent = dados.erro || 'Erro ao fazer login.';
      return;
    }

    chrome.runtime.sendMessage({
      tipo: 'login',
      userId: dados.usuario.id,
      token: dados.token,
    });

    mostrarDashboard();
  } catch {
    erroLogin.textContent = 'Nao foi possivel conectar ao servidor.';
  }
});

// Logout
btnLogout.addEventListener('click', () => {
  chrome.runtime.sendMessage({ tipo: 'logout' }, () => {
    mostrarLogin();
  });
});

// Toggle ativo/pausado
btnToggle.addEventListener('click', () => {
  const novoEstado = !ativoAtual;
  chrome.runtime.sendMessage({ tipo: 'toggle_ativo', ativo: novoEstado }, () => {
    ativoAtual = novoEstado;
    atualizarUI(novoEstado, true);
  });
});

function mostrarLogin() {
  telaLogin.style.display = 'block';
  telaDashboard.style.display = 'none';
}

function mostrarDashboard() {
  telaLogin.style.display = 'none';
  telaDashboard.style.display = 'block';

  chrome.runtime.sendMessage({ tipo: 'status' }, (resp) => {
    if (!resp) return;
    ativoAtual = resp.ativo;
    atualizarUI(resp.ativo, resp.conectado);
  });
}

function atualizarUI(ativo, conectado) {
  if (!conectado) {
    dot.className = 'dot vermelho';
    statusTexto.textContent = 'Desconectado';
    infoTexto.textContent = 'Sem conexao com o servidor.';
  } else if (ativo) {
    dot.className = 'dot verde';
    statusTexto.textContent = 'Ativo';
    infoTexto.textContent = 'Apostas serao replicadas automaticamente.';
  } else {
    dot.className = 'dot amarelo';
    statusTexto.textContent = 'Pausado';
    infoTexto.textContent = 'Apostas nao serao replicadas.';
  }

  btnToggle.textContent = ativo ? 'Pausar' : 'Ativar';
  btnToggle.className = `btn-toggle ${ativo ? 'btn-pausar' : 'btn-ativar'}`;
}
