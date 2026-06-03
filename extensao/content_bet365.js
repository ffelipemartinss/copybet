// CopyBet - Content Script Bet365
// TODO Fase 2
chrome.storage.local.get('sinal_pendente', ({ sinal_pendente }) => {
  if (!sinal_pendente) return;
  console.log('[CopyBet Bet365] Sinal recebido:', sinal_pendente);
  chrome.storage.local.remove('sinal_pendente');
});
