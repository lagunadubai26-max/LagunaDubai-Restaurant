window.PRINTER = (function() {
  var printers = [];
  var wsProxy = null;
  var nextId = 1;

  function escposText(text) {
    var encoder = new TextEncoder();
    return encoder.encode(text + '\n');
  }

  function escposCmd() {
    var bytes = Array.prototype.slice.call(arguments);
    return new Uint8Array(bytes);
  }

  function escposInit() {
    return concatenate([escposCmd(0x1B, 0x40), escposCmd(0x1B, 0x61, 0x01)]);
  }

  function escposBold(on) {
    return escposCmd(0x1B, 0x45, on ? 1 : 0);
  }

  function escposCut() {
    return escposCmd(0x1D, 0x56, 0x00);
  }

  function escposOpenDrawer() {
    return escposCmd(0x1B, 0x70, 0x00, 0x19, 0xFA);
  }

  function concatenate(arrays) {
    var totalLen = 0;
    arrays.forEach(function(a) { totalLen += a.length; });
    var result = new Uint8Array(totalLen);
    var offset = 0;
    arrays.forEach(function(a) { result.set(a, offset); offset += a.length; });
    return result;
  }

  async function buildReceiptData(inv) {
    try {
      var tpl = await TEMPLATE.getEscposTemplate('cashier');
      return TEMPLATE.renderEscpos(inv, tpl, 'cashier');
    } catch (e) {}
    return TEMPLATE.renderEscpos(inv, null, 'cashier');
  }

  async function buildKitchenOrderData(inv) {
    try {
      var tpl = await TEMPLATE.getEscposTemplate('kitchen');
      return TEMPLATE.renderEscpos(inv, tpl, 'kitchen');
    } catch (e) {}
    return TEMPLATE.renderEscpos(inv, null, 'kitchen');
  }

  function connectUSB() {
    return {
      type: 'usb',
      device: null,
      endpoint: null,
      async connect() {
        var filters = [
          { vendorId: 0x04b8 }, { vendorId: 0x04b9 }, { vendorId: 0x0416 },
          { vendorId: 0x067b }, { vendorId: 0x0fe6 }, { vendorId: 0x0525 },
          { vendorId: 0x1fc9 }, { vendorId: 0x0456 }, { vendorId: 0x1504 },
          { vendorId: 0x0dd4 }, { vendorId: 0x0483 },
        ];
        var dev = await navigator.usb.requestDevice({ filters });
        this.device = dev;
        await dev.open();
        if (dev.configuration === null) await dev.selectConfiguration(1);
        await dev.claimInterface(0);
        var iface = dev.configuration.interfaces[0];
        for (var ep of iface.alternate.endpoints) {
          if (ep.direction === 'out') { this.endpoint = ep.endpointNumber; break; }
        }
        if (!this.endpoint) throw new Error('لم يتم العثور على منفذ USB للطباعة');
      },
      async disconnect() {
        if (this.device) { try { await this.device.close(); } catch (e) {} }
      },
      async send(data) {
        if (!this.device || !this.endpoint) throw new Error('الطابعة غير متصلة');
        await this.device.transferOut(this.endpoint, data);
      }
    };
  }

  function connectWiFi(host, port) {
    return {
      type: 'wifi',
      host: host, port: port,
      ws: null,
      async connect() {
        var proxyUrl = localStorage.getItem('laguna_printer_proxy') || 'ws://localhost:9090';
        var self = this;
        this.ws = new WebSocket(proxyUrl);
        await new Promise(function(resolve, reject) {
          self.ws.onopen = function() {
            self.ws.send(JSON.stringify({ action: 'connect', host: self.host, port: self.port }));
            resolve();
          };
          self.ws.onerror = function() { reject(new Error('فشل الاتصال بالوكيل')); };
          self.ws.onclose = function() { if (self.ws) self.ws = null; };
          setTimeout(function() { reject(new Error('انتهت مهلة الاتصال')); }, 5000);
        });
      },
      async disconnect() {
        if (this.ws) { try { this.ws.close(); } catch (e) {} this.ws = null; }
      },
      async send(data) {
        if (!this.ws) throw new Error('الطابعة غير متصلة');
        this.ws.send(data);
      }
    };
  }

  function connectBluetooth() {
    return {
      type: 'bluetooth',
      device: null,
      service: null,
      char: null,
      async connect() {
        var dev = await navigator.bluetooth.requestDevice({
          filters: [{ services: [0x1812] }],
          optionalServices: ['00001812-0000-1000-8000-00805f9b34fb', '000018f0-0000-1000-8000-00805f9b34fb']
        });
        this.device = dev;
        var server = await dev.gatt.connect();
        var svc;
        try { svc = await server.getPrimaryService(0x1812); }
        catch (e) { svc = await server.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb'); }
        this.service = svc;
        var chars = await svc.getCharacteristics();
        for (var c of chars) {
          if (c.properties.write || c.properties.writeWithoutResponse) {
            this.char = c;
            break;
          }
        }
        if (!this.char) throw new Error('لم يتم العثور على خاصية الكتابة');
      },
      async disconnect() {
        if (this.device) { try { this.device.gatt.disconnect(); } catch (e) {} }
      },
      async send(data) {
        if (!this.char) throw new Error('الطابعة غير متصلة');
        await this.char.writeValue(data);
      }
    };
  }

  async function addPrinter(type, config) {
    if (!config) config = {};
    var driver;
    if (type === 'usb') driver = connectUSB();
    else if (type === 'wifi') {
      if (!config.host) throw new Error('يرجى إدخال عنوان IP الطابعة');
      driver = connectWiFi(config.host, config.port || 9100);
    } else if (type === 'bluetooth') driver = connectBluetooth();
    else throw new Error('نوع طابعة غير معروف: ' + type);

    await driver.connect();
    var printer = {
      id: 'prn_' + (nextId++),
      name: config.name || (type === 'usb' ? 'USB' : type === 'wifi' ? 'WiFi' : 'Bluetooth'),
      type: type,
      driver: driver,
      connected: true,
      active: true,
      forKitchen: config.forKitchen || false
    };
    printers.push(printer);
    savePrinters();
    return printer;
  }

  async function removePrinter(id) {
    var idx = printers.findIndex(function(p) { return p.id === id; });
    if (idx === -1) return;
    var p = printers[idx];
    try { await p.driver.disconnect(); } catch (e) {}
    printers.splice(idx, 1);
    savePrinters();
  }

  async function disconnectAll() {
    for (var p of printers) {
      try { await p.driver.disconnect(); } catch (e) {}
      p.connected = false;
    }
    printers = [];
    savePrinters();
  }

  function getPrinters() { return printers; }
  function isConnected() { return printers.some(function(p) { return p.connected; }); }

  function getReceiptPrinters() { return printers.filter(function(p) { return p.active && !p.forKitchen; }); }
  function getKitchenPrinters() { return printers.filter(function(p) { return p.active && p.forKitchen; }); }

  function savePrinters() {
    var data = printers.map(function(p) {
      return {
        id: p.id, name: p.name, type: p.type, forKitchen: p.forKitchen, active: true,
        host: p.driver.host, port: p.driver.port
      };
    });
    localStorage.setItem('laguna_printers', JSON.stringify(data));
  }

  async function restorePrinters() {
    var raw = localStorage.getItem('laguna_printers');
    var data;
    if (raw) { try { data = JSON.parse(raw); } catch (e) { data = []; } } else { data = []; }
    for (var cfg of data) {
      try {
        if (cfg.type === 'usb') continue;
        await addPrinter(cfg.type, { name: cfg.name, host: cfg.host, port: cfg.port, forKitchen: cfg.forKitchen });
      } catch (e) {}
    }
    try {
      if (!navigator.usb) return;
      if (localStorage.getItem('laguna_print_agent_enabled') === 'true') return;
      var devices = await navigator.usb.getDevices();
      for (var dev of devices) {
        var already = printers.some(function(p) { return p.driver.device === dev; });
        if (already) continue;
        await dev.open();
        if (dev.configuration === null) await dev.selectConfiguration(1);
        await dev.claimInterface(0);
        var iface = dev.configuration.interfaces[0];
        var ep = null;
        for (var e of iface.alternate.endpoints) {
          if (e.direction === 'out') { ep = e.endpointNumber; break; }
        }
        if (!ep) continue;
        var driver = { type: 'usb', device: dev, endpoint: ep, connected: true };
        driver.connect = async function() {};
        driver.disconnect = async function() { try { await dev.close(); } catch (ex) {} };
        driver.send = async function(data) { await dev.transferOut(ep, data); };
        var p = { id: 'prn_usb_' + (nextId++), name: 'XP-80', type: 'usb', driver: driver, connected: true, active: true, forKitchen: false };
        printers.push(p);
      }
    } catch (e) {}
  }

  async function printTo(printerId, data) {
    var p = printers.find(function(x) { return x.id === printerId; });
    if (!p) throw new Error('الطابعة غير موجودة');
    if (!p.connected) throw new Error('الطابعة غير متصلة');
    await p.driver.send(data);
  }

  // Returns { ok: true } or { ok: false, errors: [...] }
  async function printReceipt(inv, printerId) {
    var data = await buildReceiptData(inv);
    if (printerId) {
      try {
        await printTo(printerId, data);
        return { ok: true };
      } catch (e) {
        console.warn('[printer] ' + printerId + ': ' + e.message);
        return { ok: false, errors: [e.message] };
      }
    }
    var targets = getReceiptPrinters();
    if (targets.length === 0) return { ok: false, errors: ['لا توجد طابعات فو始终 متصلة'] };
    var errors = [];
    var ok = false;
    for (var p of targets) {
      try {
        await p.driver.send(data);
        ok = true;
      } catch (e) {
        console.warn('[printer] ' + p.name + ': ' + e.message);
        errors.push(p.name + ': ' + e.message);
      }
    }
    return { ok: ok, errors: errors.length > 0 ? errors : undefined };
  }

  async function printKitchenOrder(inv, printerId) {
    var data = await buildKitchenOrderData(inv);
    if (printerId) {
      await printTo(printerId, data);
    } else {
      for (var p of getKitchenPrinters()) {
        try { await p.driver.send(data); } catch (e) { console.warn('[printer] ' + p.name + ': ' + e.message); }
      }
    }
  }

  async function openDrawer(printerId) {
    var data = escposOpenDrawer();
    if (printerId) {
      await printTo(printerId, data);
    } else {
      for (var p of printers) {
        if (p.connected) { try { await p.driver.send(data); } catch (e) {} }
      }
    }
  }

  async function printViaAgent(invoice, type, opts) {
    var url = localStorage.getItem('laguna_print_agent_url');
    if (!url) return { ok: false, skipped: true };
    try {
      var headers = { 'Content-Type': 'application/json' };
      var apiKey = localStorage.getItem('laguna_print_agent_key');
      if (apiKey) headers['X-API-Key'] = apiKey;
      var payload = {};
      for (var k in invoice) payload[k] = invoice[k];
      if (type) payload.type = type;
      if (opts) { for (var ok in opts) payload[ok] = opts[ok]; }
      var resp = await fetch(url.replace(/\/+$/, '') + '/print-invoice', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(payload)
      });
      return await resp.json();
    } catch (err) {
      console.warn('[print-agent] لا يمكن الوصول:', err.message);
      return { ok: false, error: err.message };
    }
  }

  return {
    addPrinter: addPrinter,
    removePrinter: removePrinter,
    disconnectAll: disconnectAll,
    getPrinters: getPrinters,
    isConnected: isConnected,
    getReceiptPrinters: getReceiptPrinters,
    getKitchenPrinters: getKitchenPrinters,
    restorePrinters: restorePrinters,
    printTo: printTo,
    printReceipt: printReceipt,
    printKitchenOrder: printKitchenOrder,
    openDrawer: openDrawer,
    printViaAgent: printViaAgent,
    escposInit: escposInit,
    escposBold: escposBold,
    escposText: escposText,
    escposCut: escposCut,
    buildReceiptData: buildReceiptData,
    buildKitchenOrderData: buildKitchenOrderData
  };
})();
