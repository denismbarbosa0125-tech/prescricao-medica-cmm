const { app, BrowserWindow } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.setTitle('Prescrição Médica — CMM Parintins');

  // Tentar carregar index.html de vários locais
  const possiblePaths = [
    path.join(__dirname, 'src', 'index.html'),
    path.join(__dirname, 'index.html'),
    path.join(__dirname, '..', 'src', 'index.html'),
  ];

  let loaded = false;
  for (const filePath of possiblePaths) {
    try {
      mainWindow.loadFile(filePath);
      console.log('✓ Carregado:', filePath);
      loaded = true;
      break;
    } catch (e) {
      console.log('✗ Falha:', filePath);
    }
  }

  if (!loaded) {
    mainWindow.loadURL('about:blank');
    mainWindow.webContents.executeJavaScript(`
      document.body.style.fontSize = '16px';
      document.body.style.padding = '20px';
      document.body.innerHTML = '<h1>Erro ao carregar</h1><p>Não foi possível encontrar o arquivo index.html</p>';
    `);
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.maximize();
  });

  // Forçar mostrar após 2 segundos
  setTimeout(() => {
    if (!mainWindow.isDestroyed() && !mainWindow.isVisible()) {
      mainWindow.show();
      mainWindow.maximize();
    }
  }, 2000);
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
