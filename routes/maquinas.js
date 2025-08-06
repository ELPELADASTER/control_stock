const express = require('express');

module.exports = (db) => {
  const router = express.Router();

  // Crear máquina
  router.post('/', (req, res) => {
    const { nombre, edificio, ubicacion, empresa } = req.body;
    if (!nombre || !edificio) {
      return res.status(400).json({ error: 'Nombre y edificio son requeridos' });
    }
    
    const empresaFinal = empresa && (empresa === 'Telecom' || empresa === 'Pago Online') ? empresa : 'Telecom';
    const now = new Date().toISOString();
    
    db.run('INSERT INTO maquinas (nombre, edificio, ubicacion, empresa, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)', 
      [nombre, edificio, ubicacion || '', empresaFinal, now, now], 
      function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ 
          id: this.lastID, 
          nombre, 
          edificio, 
          ubicacion: ubicacion || '', 
          empresa: empresaFinal,
          estado: 'activa',
          created_at: now, 
          updated_at: now 
        });
      }
    );
  });

  // Listar máquinas (filtrar por empresa y/o edificio)
  router.get('/', (req, res) => {
    const { empresa, edificio } = req.query;
    let sql = 'SELECT * FROM maquinas WHERE 1=1';
    let params = [];
    
    if (empresa && (empresa === 'Telecom' || empresa === 'Pago Online')) {
      sql += ' AND empresa = ?';
      params.push(empresa);
    }
    
    if (edificio) {
      sql += ' AND edificio = ?';
      params.push(edificio);
    }
    
    sql += ' ORDER BY edificio, nombre';
    
    db.all(sql, params, (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    });
  });

  // Obtener edificios únicos
  router.get('/edificios', (req, res) => {
    const empresa = req.query.empresa;
    let sql = 'SELECT DISTINCT edificio FROM maquinas WHERE 1=1';
    let params = [];
    
    if (empresa && (empresa === 'Telecom' || empresa === 'Pago Online')) {
      sql += ' AND empresa = ?';
      params.push(empresa);
    }
    
    sql += ' ORDER BY edificio';
    
    db.all(sql, params, (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows.map(row => row.edificio));
    });
  });

  // Editar máquina
  router.put('/:id', (req, res) => {
    const { nombre, edificio, ubicacion, empresa, estado } = req.body;
    const id = req.params.id;
    const now = new Date().toISOString();
    
    db.get('SELECT * FROM maquinas WHERE id = ?', [id], (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row) return res.status(404).json({ error: 'Máquina no encontrada' });
      
      const empresaFinal = empresa && (empresa === 'Telecom' || empresa === 'Pago Online') ? empresa : row.empresa;
      const estadoFinal = estado || row.estado;
      
      db.run('UPDATE maquinas SET nombre = ?, edificio = ?, ubicacion = ?, empresa = ?, estado = ?, updated_at = ? WHERE id = ?',
        [
          nombre || row.nombre,
          edificio || row.edificio,
          ubicacion !== undefined ? ubicacion : row.ubicacion,
          empresaFinal,
          estadoFinal,
          now,
          id
        ],
        function(err) {
          if (err) return res.status(500).json({ error: err.message });
          res.json({ success: true });
        }
      );
    });
  });

  // Eliminar máquina
  router.delete('/:id', (req, res) => {
    const id = req.params.id;
    
    // Verificar si hay cargas asociadas
    db.get('SELECT COUNT(*) as count FROM cargas_maquinas WHERE maquina_id = ?', [id], (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      
      if (row.count > 0) {
        return res.status(400).json({ error: 'No se puede eliminar la máquina porque tiene cargas registradas' });
      }
      
      db.run('DELETE FROM maquinas WHERE id = ?', [id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
      });
    });
  });

  return router;
};
