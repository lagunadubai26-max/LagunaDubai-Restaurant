async function load() {
  const settings = await DB.settings.get() || {};
  document.getElementById('enableTax').checked = settings.enableTax !== false;
  document.getElementById('taxRate').value = settings.taxRate || 14;
  document.getElementById('enableService').checked = settings.enableService !== false;
  document.getElementById('serviceTax').value = settings.serviceTax || 10;
  document.getElementById('autoPrintReceipt').checked = settings.autoPrintReceipt !== false;
  document.getElementById('autoPrintKitchen').checked = settings.autoPrintKitchen !== false;
  document.getElementById('printCopies').value = settings.printCopies || 1;
  document.getElementById('enablePrintAgent').checked = settings.enablePrintAgent !== false;
  document.getElementById('printAgentUrl').value = settings.printAgentUrl || 'http://localhost:3000';
  document.getElementById('printAgentKey').value = settings.printAgentKey || '';
  if (settings.printAgentUrl) localStorage.setItem('laguna_print_agent_url', settings.printAgentUrl);
  if (settings.printAgentKey) localStorage.setItem('laguna_print_agent_key', settings.printAgentKey);
  localStorage.setItem('laguna_print_agent_enabled', settings.enablePrintAgent !== false);
}

document.getElementById('saveSettings').onclick = async () => {
  await DB.settings.save({
    enableTax: document.getElementById('enableTax').checked,
    taxRate: Number(document.getElementById('taxRate').value),
    enableService: document.getElementById('enableService').checked,
    serviceTax: Number(document.getElementById('serviceTax').value),
    autoPrintReceipt: document.getElementById('autoPrintReceipt').checked,
    autoPrintKitchen: document.getElementById('autoPrintKitchen').checked,
    printCopies: Number(document.getElementById('printCopies').value) || 1,
    enablePrintAgent: document.getElementById('enablePrintAgent').checked,
    printAgentUrl: document.getElementById('printAgentUrl').value || 'http://localhost:3000',
    printAgentKey: document.getElementById('printAgentKey').value || ''
  });
  const agentUrl = document.getElementById('printAgentUrl').value || 'http://localhost:3000';
  localStorage.setItem('laguna_print_agent_url', agentUrl);
  const agentKey = document.getElementById('printAgentKey').value || '';
  localStorage.setItem('laguna_print_agent_key', agentKey);
  localStorage.setItem('laguna_print_agent_enabled', document.getElementById('enablePrintAgent').checked);
  alert('تم حفظ الإعدادات بنجاح');
};

load();
