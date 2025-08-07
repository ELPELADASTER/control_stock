const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'datos', 'articulos.db');
const db = new sqlite3.Database(dbPath);

// Verificar estructura de la tabla
db.all("PRAGMA table_info(conteos_vasos)", (err, rows) => {
  if (err) {
    console.error('Error:', err);
  } else {
    console.log('Estructura de la tabla conteos_vasos:');
    if (rows.length === 0) {
      console.log('⚠️  La tabla conteos_vasos no existe o está vacía');
    } else {
      console.table(rows);
    }
  }
  
  // Verificar todas las tablas
  db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
    if (err) {
      console.error('Error al listar tablas:', err);
    } else {
      console.log('\n📋 Tablas existentes:');
      tables.forEach(table => console.log(`- ${table.name}`));
    }
    
    // Cerrar conexión
    db.close();
  });
});
