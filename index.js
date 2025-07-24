const express = require('express');
const cors = require('cors');
const multer = require('multer');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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
    imagen TEXT,
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
      });
    });
  });
});

// Configuración de Multer para imágenes (guardar en 'uploads/' relativo a backend)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, 'uploads'));
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// Rutas
const articulosRouter = require('./routes/articulos');
app.use('/api/articulos', articulosRouter(db, upload));

app.listen(PORT, () => {
  console.log(`Servidor backend escuchando en http://localhost:${PORT}`);
});
