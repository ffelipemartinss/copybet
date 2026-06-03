// CopyBet - Content Script Betano
// Executa a aposta automaticamente quando recebe um sinal

const API_URL = 'https://content-inspiration-production-b4b2.up.railway.app'; // substituir no deploy

chrome.storage.local.get(['sinal_pendente', 'token'], ({ sinal_pendente, token }) => {
  if (!sinal_pendente || !token) return;

  console.log('[CopyBet Betano] Executando sinal:', sinal_pendente);
  executarAposta(sinal_pendente, token);
});

async function executarAposta(sinal, token) {
  const { sinal_id, execucao_id, evento, mercado, odd, valor_apostado } = sinal;

  // Informa o servidor que a execucao comecou
  await reportarStatus(execucao_id, 'EXECUTANDO', token);

  try {
    // Aguarda a pagina carregar completamente
    await aguardar(2000);

    // 1. Procura o evento na pagina por texto
    const linkEvento = encontrarElementoPorTexto('a', evento);
    if (!linkEvento) throw new Error(`Evento nao encontrado na pagina: "${evento}"`);

    linkEvento.click();
    await aguardar(2000);

    // 2. Procura o mercado/odd pelo texto do mercado e valor da odd
    const oddFormatada = odd.toFixed(2);
    const botaoOdd = encontrarBotaoOdd(mercado, oddFormatada);
    if (!botaoOdd) throw new Error(`Odd nao encontrada: mercado "${mercado}", odd ${oddFormatada}`);

    botaoOdd.click();
    await aguardar(1000);

    // 3. Preenche o valor no campo de aposta
    const campoValor = document.querySelector(
      'input[data-qa="betslip-stake-input"], input[placeholder*="Valor"], input[class*="stake"]'
    );
    if (!campoValor) throw new Error('Campo de valor nao encontrado');

    campoValor.focus();
    campoValor.value = '';
    // Dispara eventos para o React/Angular da Betano reconhecer a mudanca
    campoValor.dispatchEvent(new Event('input', { bubbles: true }));
    campoValor.value = valor_apostado.toFixed(2);
    campoValor.dispatchEvent(new Event('input', { bubbles: true }));
    campoValor.dispatchEvent(new Event('change', { bubbles: true }));
    await aguardar(500);

    // 4. Clica em confirmar aposta
    const btnConfirmar = document.querySelector(
      'button[data-qa="betslip-place-bet"], button[class*="place-bet"], button[class*="confirm"]'
    );
    if (!btnConfirmar) throw new Error('Botao de confirmar nao encontrado');

    btnConfirmar.click();
    await aguardar(1500);

    // 5. Verifica se apareceu mensagem de sucesso
    const sucesso = document.querySelector('[data-qa="betslip-success"], [class*="bet-success"]');
    if (!sucesso) throw new Error('Confirmacao de aposta nao detectada');

    console.log('[CopyBet Betano] Aposta realizada com sucesso!');
    await reportarStatus(execucao_id, 'SUCESSO', token);
  } catch (err) {
    console.error('[CopyBet Betano] Falha:', err.message);
    await reportarStatus(execucao_id, 'FALHA', token, err.message);
  } finally {
    chrome.storage.local.remove('sinal_pendente');
  }
}

// Reporta status da execucao ao backend
async function reportarStatus(execucaoId, status, token, erro_msg = null) {
  try {
    await fetch(`${API_URL}/api/sinais/${execucaoId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status, erro_msg }),
    });
  } catch (err) {
    console.error('[CopyBet] Falha ao reportar status:', err);
  }
}

// Encontra elemento pelo texto parcial
function encontrarElementoPorTexto(seletor, texto) {
  const elementos = document.querySelectorAll(seletor);
  const textoLower = texto.toLowerCase();
  for (const el of elementos) {
    if (el.textContent.toLowerCase().includes(textoLower)) return el;
  }
  return null;
}

// Encontra botao de odd pelo mercado e valor
function encontrarBotaoOdd(mercado, oddStr) {
  // Tenta encontrar pelo atributo data-odd ou pelo texto
  const botoes = document.querySelectorAll(
    'button[data-qa*="odd"], button[class*="odd"], .selections__item button, [class*="market"] button'
  );
  for (const btn of botoes) {
    if (btn.textContent.trim() === oddStr) {
      const containerMercado = btn.closest('[class*="market"], [data-qa*="market"]');
      if (!containerMercado) return btn; // retorna se nao tiver container
      if (containerMercado.textContent.toLowerCase().includes(mercado.toLowerCase())) return btn;
    }
  }
  return null;
}

function aguardar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
