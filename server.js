const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

const PORT = process.env.PORT || 3000;
const DATA_DIR = './data';

// Criar pasta de dados se não existir
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR);
}

const DATA_FILE = path.join(DATA_DIR, 'dados.json');

// Carregar dados
let db = { pacientes: [], prescricoes: [], altas: [] };

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      db = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    }
  } catch (e) {
    console.error('Erro ao carregar:', e);
    db = { pacientes: [], prescricoes: [], altas: [] };
  }
}

function saveData() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch (e) {
    console.error('Erro ao salvar:', e);
  }
}

loadData();

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.static('src'));

// Servir index-web.html na raiz
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'src', 'index-web.html'));
});

// APIs
app.get('/api/pacientes', (req, res) => {
  const lista = db.pacientes.filter(p => p.ativo !== false).map(p => {
    const prescricoes = db.prescricoes.filter(px => px.paciente_id === p.id);
    return {
      ...p,
      total_prescricoes: prescricoes.length,
      ultima_prescricao: prescricoes.length > 0 ? prescricoes[prescricoes.length - 1].data_rx : null
    };
  }).sort((a, b) => (a.leito || '').localeCompare(b.leito || ''));
  res.json(lista);
});

app.get('/api/pacientes/buscar/:termo', (req, res) => {
  const like = req.params.termo.toLowerCase();
  const resultado = db.pacientes.filter(p => p.ativo !== false).filter(p =>
    (p.nome || '').toLowerCase().includes(like) ||
    (p.leito || '').toLowerCase().includes(like) ||
    (p.registro || '').toLowerCase().includes(like) ||
    (p.cid || '').toLowerCase().includes(like)
  ).sort((a, b) => (a.leito || '').localeCompare(b.leito || ''));
  res.json(resultado);
});

app.post('/api/pacientes', (req, res) => {
  const d = req.body;
  if (d.id) {
    const idx = db.pacientes.findIndex(p => p.id === d.id);
    if (idx >= 0) {
      db.pacientes[idx] = { ...db.pacientes[idx], ...d, atualizado: new Date().toISOString() };
    }
    saveData();
    return res.json({ id: d.id, acao: 'atualizado' });
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
  res.json({ id, acao: 'criado' });
});

app.delete('/api/pacientes/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const idx = db.pacientes.findIndex(p => p.id === id);
  if (idx >= 0) {
    db.pacientes[idx].ativo = 0;
    saveData();
  }
  res.json({ ok: true });
});

app.get('/api/prescricoes/:paciente_id', (req, res) => {
  const id = parseInt(req.params.paciente_id);
  const rx = db.prescricoes.filter(p => p.paciente_id === id);
  res.json(rx.length > 0 ? rx[rx.length - 1] : null);
});

app.post('/api/prescricoes', (req, res) => {
  const d = req.body;
  const id = db.prescricoes.length > 0 ? Math.max(...db.prescricoes.map(p => p.id || 0)) + 1 : 1;
  db.prescricoes.push({ ...d, id, criado_em: new Date().toISOString() });
  saveData();
  res.json({ ok: true });
});

app.get('/medicamentos.json', (req, res) => {
  try {
    const data = fs.readFileSync('./medicamentos.json', 'utf-8');
    res.json(JSON.parse(data));
  } catch (e) {
    res.json({ medicamentos: [] });
  }
});

// Servir index-web.html para qualquer rota não encontrada
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'src', 'index-web.html'));
});

app.listen(PORT, () => {
  console.log(`✓ Servidor rodando em: http://localhost:${PORT}`);
  console.log(`✓ Abra em seu navegador: http://localhost:${PORT}`);
});
