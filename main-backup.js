const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs   = require('fs');

const USER_DATA = app.getPath('userData');
const DATA_FILE = path.join(USER_DATA, 'dados.json');

let db = { pacientes: [], prescricoes: [], altas: [] };

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = fs.readFileSync(DATA_FILE, 'utf-8');
      db = JSON.parse(data);
    }
  } catch (e) {
    console.error('Erro ao carregar dados:', e);
    db = { pacientes: [], prescricoes: [], altas: [] };
  }
}

function saveData() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch (e) {
    console.error('Erro ao salvar dados:', e);
  }
}

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280, height: 860,
    minWidth: 900, minHeight: 600,
    title: 'Prescrição Médica — CMM Parintins',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    show: false
  });
  const indexPath = path.join(__dirname, 'src', 'index.html');
  console.log('Carregando HTML de:', indexPath);
  mainWindow.loadFile(indexPath).catch(err => {
    console.error('Erro ao carregar HTML:', err);
    mainWindow.loadFile(path.join(__dirname, '..', 'index.html'));
  });
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.show();
    mainWindow.maximize();
  });
  setTimeout(() => {
    if (!mainWindow.isVisible()) {
      console.log('Forçando visibilidade...');
      mainWindow.show();
      mainWindow.maximize();
    }
  }, 2000);
  if (process.argv.includes('--dev')) mainWindow.webContents.openDevTools();
}

// IPC: Pacientes
ipcMain.handle('pacientes:listar', () => {
  return db.pacientes.filter(p => p.ativo !== false).map(p => {
    const prescricoes = db.prescricoes.filter(px => px.paciente_id === p.id);
    return {
      ...p,
      total_prescricoes: prescricoes.length,
      ultima_prescricao: prescricoes.length > 0 ? prescricoes[prescricoes.length - 1].data_rx : null
    };
  }).sort((a, b) => (a.leito || '').localeCompare(b.leito || ''));
});

ipcMain.handle('pacientes:buscar', (_, termo) => {
  const like = termo.toLowerCase();
  return db.pacientes.filter(p => p.ativo !== false).filter(p =>
    (p.nome || '').toLowerCase().includes(like) ||
    (p.leito || '').toLowerCase().includes(like) ||
    (p.registro || '').toLowerCase().includes(like) ||
    (p.cid || '').toLowerCase().includes(like)
  ).sort((a, b) => (a.leito || '').localeCompare(b.leito || ''));
});

ipcMain.handle('pacientes:salvar', (_, d) => {
  if (d.id) {
    const idx = db.pacientes.findIndex(p => p.id === d.id);
    if (idx >= 0) {
      db.pacientes[idx] = { ...db.pacientes[idx], ...d, atualizado: new Date().toISOString() };
    }
    saveData();
    return { id: d.id, acao: 'atualizado' };
  }
  const id = db.pacientes.length > 0 ? Math.max(...db.pacientes.map(p => p.id || 0)) + 1 : 1;
  db.pacientes.push({
    ...d,
    id,
    criado_em: new Date().toISOString(),
    atualizado: new Date().toISOString(),
    ativo: 1
  });
  saveData();
  return { id, acao: 'criado' };
});

ipcMain.handle('pacientes:excluir', (_, id) => {
  const idx = db.pacientes.findIndex(p => p.id === id);
  if (idx >= 0) {
    db.pacientes[idx].ativo = 0;
    saveData();
  }
  return { ok: true };
});

// IPC: Prescrições
ipcMain.handle('prescricoes:salvar', (_, d) => {
  const existe = db.prescricoes.find(px => px.paciente_id === d.paciente_id && px.data_rx === d.data_rx);
  if (existe) {
    Object.assign(existe, d);
    saveData();
    return { id: existe.id, acao: 'atualizado' };
  }
  const id = db.prescricoes.length > 0 ? Math.max(...db.prescricoes.map(p => p.id || 0)) + 1 : 1;
  db.prescricoes.push({
    ...d,
    id,
    criado_em: new Date().toISOString()
  });
  saveData();
  return { id, acao: 'criado' };
});

ipcMain.handle('prescricoes:carregar', (_, paciente_id, data_rx) => {
  if (data_rx) {
    return db.prescricoes.find(px => px.paciente_id === paciente_id && px.data_rx === data_rx) || null;
  }
  const prescricoes = db.prescricoes.filter(px => px.paciente_id === paciente_id);
  return prescricoes.length > 0 ? prescricoes[prescricoes.length - 1] : null;
});

ipcMain.handle('prescricoes:historico', (_, paciente_id) =>
  db.prescricoes.filter(px => px.paciente_id === paciente_id)
    .map(px => ({ id: px.id, data_rx: px.data_rx, criado_em: px.criado_em }))
    .sort((a, b) => (b.data_rx || '').localeCompare(a.data_rx || ''))
);

// IPC: Alta
ipcMain.handle('alta:salvar', (_, d) => {
  const id = db.altas.length > 0 ? Math.max(...db.altas.map(a => a.id || 0)) + 1 : 1;
  db.altas.push({
    ...d,
    id,
    criado_em: new Date().toISOString()
  });
  saveData();
  return { id };
});

// IPC: Impressão/PDF
ipcMain.handle('imprimir:pdf', async (_, htmlContent, nomeArquivo) => {
  const { filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Salvar PDF',
    defaultPath: path.join(app.getPath('documents'), nomeArquivo || 'prescricao.pdf'),
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  });
  if (!filePath) return { cancelado: true };
  const printWin = new BrowserWindow({
    show: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  });
  await printWin.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(htmlContent));
  const pdfBuffer = await printWin.webContents.printToPDF({
    landscape: true, pageSize: 'A4', printBackground: true,
    margins: { top: 0.3, bottom: 0.3, left: 0.4, right: 0.4 }
  });
  printWin.close();
  fs.writeFileSync(filePath, pdfBuffer);
  shell.openPath(filePath);
  return { salvo: true, caminho: filePath };
});

ipcMain.handle('imprimir:pagina', async (_, htmlContent) => {
  const printWin = new BrowserWindow({
    show: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  });
  await printWin.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(htmlContent));
  return new Promise(resolve => {
    printWin.webContents.print({ silent: false, printBackground: true }, (success, reason) => {
      printWin.close();
      resolve({ success, reason });
    });
  });
});

// IPC: Backup
ipcMain.handle('db:backup', async () => {
  const { filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Salvar backup',
    defaultPath: path.join(app.getPath('documents'),
      'backup_prescricao_' + new Date().toISOString().slice(0,10) + '.json'),
    filters: [{ name: 'Arquivo JSON', extensions: ['json'] }]
  });
  if (!filePath) return { cancelado: true };
  fs.copyFileSync(DATA_FILE, filePath);
  return { salvo: true, caminho: filePath };
});

ipcMain.handle('app:info', () => ({
  versao: app.getVersion(), userData: USER_DATA, dbPath: DATA_FILE
}));

// IPC: Importar Word
ipcMain.handle('word:importar', async () => {
  const { filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Importar prescrição de Word',
    filters: [{ name: 'Documentos Word', extensions: ['docx'] }],
    properties: ['openFile']
  });
  if (!filePaths || filePaths.length === 0) return { cancelado: true };

  const mammoth = require('mammoth');
  try {
    const result = await mammoth.extractRawText({ path: filePaths[0] });
    const texto = result.value;
    return { sucesso: true, texto, caminho: filePaths[0] };
  } catch (e) {
    return { erro: true, mensagem: e.message };
  }
});

// IPC: Exportar Word
ipcMain.handle('word:exportar', async (_, dadosPrescrição) => {
  const { filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Salvar prescrição como Word',
    defaultPath: path.join(app.getPath('documents'),
      'prescricao_' + (dadosPrescrição.nome || 'paciente').replace(/\s+/g, '_') + '.docx'),
    filters: [{ name: 'Documento Word', extensions: ['docx'] }]
  });

  if (!filePath) return { cancelado: true };

  try {
    const { Document, Packer, Paragraph, Table, TableCell, TableRow, BorderStyle, WidthType, TextRun } = require('docx');

    // Montar conteúdo da prescrição
    const paragrafos = [];

    // Cabeçalho
    paragrafos.push(new Paragraph({
      text: 'HOSPITAL REGIONAL DR. JOFRE DE MATOS COHEN',
      bold: true,
      alignment: 'center',
      size: 24
    }));
    paragrafos.push(new Paragraph({
      text: 'PRESCRIÇÃO MÉDICA',
      bold: true,
      alignment: 'center',
      size: 20,
      spacing: { after: 200 }
    }));

    // Dados do paciente
    paragrafos.push(new Paragraph({
      text: `PACIENTE: ${dadosPrescrição.nome || '___'}`,
      bold: true,
      spacing: { after: 100 }
    }));
    paragrafos.push(new Paragraph({
      text: `Leito: ${dadosPrescrição.leito || '___'} | Idade: ${dadosPrescrição.idade || '___'} | Data: ${dadosPrescrição.data || '___'}`,
      spacing: { after: 100 }
    }));
    paragrafos.push(new Paragraph({
      text: `Diagnóstico: ${dadosPrescrição.cid || '___'}`,
      spacing: { after: 200 }
    }));

    // Evolução
    if (dadosPrescrição.evolucao) {
      paragrafos.push(new Paragraph({
        text: 'EVOLUÇÃO MÉDICA:',
        bold: true,
        spacing: { after: 100 }
      }));
      paragrafos.push(new Paragraph({
        text: dadosPrescrição.evolucao,
        spacing: { after: 200 }
      }));
    }

    // Prescrição
    paragrafos.push(new Paragraph({
      text: 'PRESCRIÇÃO:',
      bold: true,
      spacing: { after: 100 }
    }));

    if (dadosPrescrição.itens && dadosPrescrição.itens.length > 0) {
      dadosPrescrição.itens.forEach((item, i) => {
        paragrafos.push(new Paragraph({
          text: `${i + 1}. ${item}`,
          spacing: { after: 50 }
        }));
      });
    } else {
      paragrafos.push(new Paragraph({
        text: '[Nenhum item prescrito]',
        spacing: { after: 200 }
      }));
    }

    // Assinatura
    paragrafos.push(new Paragraph({
      text: '',
      spacing: { after: 400 }
    }));
    paragrafos.push(new Paragraph({
      text: `Médico: ${dadosPrescrição.medico || '_____________________'}`,
      spacing: { after: 100 }
    }));
    paragrafos.push(new Paragraph({
      text: `CRM: ${dadosPrescrição.crm || '___________'}`
    }));

    const doc = new Document({
      sections: [{
        children: paragrafos
      }]
    });

    const buffer = await Packer.toBuffer(doc);
    fs.writeFileSync(filePath, buffer);

    return { sucesso: true, caminho: filePath };
  } catch (e) {
    return { erro: true, mensagem: e.message };
  }
});

// Ciclo de vida
app.whenReady().then(() => {
  loadData();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length===0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
