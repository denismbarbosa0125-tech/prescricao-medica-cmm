const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  pacientes: {
    listar:  ()      => ipcRenderer.invoke('pacientes:listar'),
    buscar:  (termo) => ipcRenderer.invoke('pacientes:buscar', termo),
    salvar:  (dados) => ipcRenderer.invoke('pacientes:salvar', dados),
    excluir: (id)    => ipcRenderer.invoke('pacientes:excluir', id),
  },
  prescricoes: {
    salvar:    (dados)         => ipcRenderer.invoke('prescricoes:salvar', dados),
    carregar:  (pacId, dataRx) => ipcRenderer.invoke('prescricoes:carregar', pacId, dataRx),
    historico: (pacId)         => ipcRenderer.invoke('prescricoes:historico', pacId),
  },
  alta: {
    salvar: (dados) => ipcRenderer.invoke('alta:salvar', dados),
  },
  imprimir: {
    pdf:    (html, nome) => ipcRenderer.invoke('imprimir:pdf', html, nome),
    pagina: (html)       => ipcRenderer.invoke('imprimir:pagina', html),
  },
  db:  { backup: () => ipcRenderer.invoke('db:backup') },
  word: {
    importar: () => ipcRenderer.invoke('word:importar'),
    exportar: (dados) => ipcRenderer.invoke('word:exportar', dados)
  },
  app: { info:   () => ipcRenderer.invoke('app:info')  },
});
