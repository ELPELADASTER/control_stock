const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || origin.endsWith('.vercel.app')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Asegurarse de que el directorio 'uploads' exista
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Inicializar base de datos en carpeta 'datos'
const dbPath = path.join(__dirname, 'datos', 'articulos.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) throw err;
  db.run(`CREATE TABLE IF NOT EXISTS articulos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    cantidad INTEGER NOT NULL,
    utilizados INTEGER NOT NULL DEFAULT 0,
    disponibles INTEGER NOT NULL,
    simbolo TEXT,
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT DEFAULT (datetime('now', 'localtime'))
  )`, (err) => {
    if (err) throw err;
    // Verificar si la columna 'empresa' existe, si no, agregarla
    db.get("PRAGMA table_info(articulos);", (err, row) => {
      if (err) throw err;
      db.all("PRAGMA table_info(articulos);", (err, columns) => {
        if (err) throw err;
        const hasEmpresa = columns.some(col => col.name === 'empresa');
        if (!hasEmpresa) {
          db.run("ALTER TABLE articulos ADD COLUMN empresa TEXT DEFAULT 'Telecom';", (err) => {
            if (err) throw err;
            console.log("Columna 'empresa' agregada a articulos");
          });
        }
        const hasSimbolo = columns.some(col => col.name === 'simbolo');
        if (!hasSimbolo) {
          db.run("ALTER TABLE articulos ADD COLUMN simbolo TEXT;", (err) => {
            if (err) throw err;
            console.log("Columna 'simbolo' agregada a articulos");
          });
        }
      });
    });
  });
});

// Rutas sin lógica de imágenes
const articulosRouter = require('./routes/articulos');
app.use('/api/articulos', articulosRouter(db));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor backend escuchando en http://0.0.0.0:${PORT}`);
});
