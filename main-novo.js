const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

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

function findIndexHtml() {
  const paths = [
    path.join(__dirname, 'src', 'index.html'),
    path.join(__dirname, '..', 'src', 'index.html'),
    path.join(__dirname, '..', '..', 'src', 'index.html'),
    path.join(__dirname, 'index.html'),
    path.join(__dirname, '..', 'index.html'),
  ];

  for (const p of paths) {
    console.log('Procurando:', p);
    if (fs.existsSync(p)) {
      console.log('✓ Encontrado:', p);
      return p;
    }
  }

  console.error('❌ index.html não encontrado em nenhum local');
  return path.join(__dirname, 'src', 'index.html');
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    show: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.setTitle('Prescrição Médica — CMM Parintins');

  const htmlPath = findIndexHtml();
  const fileUrl = 'file://' + htmlPath.replace(/\\/g, '/');

  console.log('Carregando:', fileUrl);
  mainWindow.loadURL(fileUrl);

  // Forçar mostrar após carregar
  mainWindow.webContents.on('dom-ready', () => {
    console.log('DOM pronto');
    mainWindow.show();
    mainWindow.maximize();
  });

  mainWindow.on('ready-to-show', () => {
    console.log('Ready to show');
    mainWindow.show();
    mainWindow.maximize();
  });

  // Timeout de segurança
  setTimeout(() => {
    if (!mainWindow.isDestroyed() && !mainWindow.isVisible()) {
      console.log('Forçando visibilidade...');
      mainWindow.show();
      mainWindow.maximize();
    }
  }, 3000);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('ready', () => {
  console.log('App ready');
  loadData();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handlers (copiado do main.js original)
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

ipcMain.handle('prescricoes:salvar', (_, d) => {
  const id = db.prescricoes.length > 0 ? Math.max(...db.prescricoes.map(p => p.id || 0)) + 1 : 1;
  db.prescricoes.push({ ...d, id, criado_em: new Date().toISOString() });
  saveData();
  return { ok: true };
});

ipcMain.handle('prescricoes:carregar', (_, paciente_id) => {
  const rx = db.prescricoes.filter(p => p.paciente_id === paciente_id);
  return rx.length > 0 ? rx[rx.length - 1] : null;
});

ipcMain.handle('prescricoes:historico', (_, paciente_id) => {
  return db.prescricoes.filter(p => p.paciente_id === paciente_id);
});

ipcMain.handle('alta:salvar', (_, d) => {
  const id = db.altas.length > 0 ? Math.max(...db.altas.map(p => p.id || 0)) + 1 : 1;
  db.altas.push({ ...d, id, criado_em: new Date().toISOString() });
  saveData();
  return { ok: true };
});

ipcMain.handle('imprimir:pdf', (_, html, nome) => {
  return mainWindow.webContents.printToPDF({}).then(data => {
    const filePath = path.join(USER_DATA, nome || 'prescricao.pdf');
    fs.writeFileSync(filePath, data);
    return { salvo: true, caminho: filePath };
  });
});

ipcMain.handle('db:backup', (_, d) => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
  const backupPath = path.join(USER_DATA, `backup-${timestamp}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(db, null, 2));
  return { salvo: true, caminho: backupPath };
});

ipcMain.handle('word:importar', async () => {
  const { dialog } = require('electron');
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'Word Documents', extensions: ['docx'] }]
  });

  if (result.canceled) return { cancelado: true };

  try {
    const mammoth = require('mammoth');
    const data = await mammoth.extractRawText({ path: result.filePaths[0] });
    return { cancelado: false, texto: data.value };
  } catch (err) {
    return { erro: true, mensagem: err.message };
  }
});

ipcMain.handle('word:exportar', async (_, dados) => {
  const { dialog } = require('electron');
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: `Prescricao_${dados.nome || 'paciente'}.docx`,
    filters: [{ name: 'Word Documents', extensions: ['docx'] }]
  });

  if (result.canceled) return { cancelado: true };

  try {
    const { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun } = require('docx');
    const conteudo = `
PRESCRIÇÃO MÉDICA

Paciente: ${dados.nome}
Leito: ${dados.leito}
Idade: ${dados.idade}

Diagnóstico: ${dados.cid}
Médico: ${dados.medico}
Data: ${dados.data}

EVOLUÇÃO:
${dados.evolucao}

PRESCRIÇÃO:
${dados.itens.join('\n')}
`;

    const doc = new Document({
      sections: [{
        children: [
          new Paragraph({ text: 'PRESCRIÇÃO MÉDICA', bold: true, size: 32 }),
          new Paragraph(``),
          new Paragraph({ text: `Paciente: ${dados.nome}` }),
          new Paragraph({ text: `Leito: ${dados.leito}` }),
          new Paragraph({ text: `Idade: ${dados.idade}` }),
          new Paragraph({ text: `Diagnóstico: ${dados.cid}` }),
          new Paragraph({ text: `Médico: ${dados.medico}` }),
          new Paragraph(``),
          new Paragraph({ text: 'EVOLUÇÃO:', bold: true }),
          new Paragraph(dados.evolucao),
          new Paragraph(``),
          new Paragraph({ text: 'PRESCRIÇÃO:', bold: true }),
          ...dados.itens.map(item => new Paragraph(item))
        ]
      }]
    });

    const bytes = await Packer.toBuffer(doc);
    fs.writeFileSync(result.filePath, bytes);
    return { cancelado: false, ok: true };
  } catch (err) {
    return { erro: true, mensagem: err.message };
  }
});
