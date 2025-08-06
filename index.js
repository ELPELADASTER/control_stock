const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors({
  origin: (origin, callback) => {
    // Permitir localhost para desarrollo, dominios de Vercel para frontend y Railway para backend
    if (!origin || 
        origin.endsWith('.vercel.app') || 
        origin.endsWith('.railway.app') ||
        origin.startsWith('http://localhost:') || 
        origin.startsWith('https://localhost:')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Asegurarse de que el directorio 'uploads' exista
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Asegurar que el directorio 'datos' exista para la base de datos
const datosDir = path.join(__dirname, 'datos');
if (!fs.existsSync(datosDir)) {
  fs.mkdirSync(datosDir, { recursive: true });
}

// Inicializar base de datos en carpeta 'datos'
const dbPath = path.join(__dirname, 'datos', 'articulos.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error al conectar con la base de datos:', err.message);
    throw err;
  }
  console.log('Conectado a la base de datos SQLite');
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
    
    // Crear tabla de máquinas
    db.run(`CREATE TABLE IF NOT EXISTS maquinas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      edificio TEXT NOT NULL,
      ubicacion TEXT,
      empresa TEXT DEFAULT 'Telecom',
      estado TEXT DEFAULT 'activa',
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    )`, (err) => {
      if (err) throw err;
      console.log("Tabla 'maquinas' creada o ya existe");
    });
    
    // Crear tabla de cargas de máquinas
    db.run(`CREATE TABLE IF NOT EXISTS cargas_maquinas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      maquina_id INTEGER NOT NULL,
      articulo_id INTEGER NOT NULL,
      cantidad_cargada INTEGER NOT NULL,
      fecha_carga TEXT DEFAULT (datetime('now', 'localtime')),
      usuario TEXT,
      observaciones TEXT,
      FOREIGN KEY (maquina_id) REFERENCES maquinas(id),
      FOREIGN KEY (articulo_id) REFERENCES articulos(id)
    )`, (err) => {
      if (err) throw err;
      console.log("Tabla 'cargas_maquinas' creada o ya existe");
    });
    
    // Verificar columnas existentes en articulos
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

// Rutas para máquinas
const maquinasRouter = require('./routes/maquinas');
app.use('/api/maquinas', maquinasRouter(db));

// Rutas para cargas de máquinas
const cargasRouter = require('./routes/cargas');
app.use('/api/cargas', cargasRouter(db));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor backend escuchando en http://0.0.0.0:${PORT}`);
});
