const express = require('express');
module.exports = (db) => {
  const router = express.Router();

  // Crear artículo
  router.post('/', (req, res) => {
    const { nombre, cantidad, empresa, simbolo } = req.body;
    if (!nombre || cantidad === undefined || cantidad === null || cantidad === '' || isNaN(Number(cantidad)) || Number(cantidad) <= 0) {
      return res.status(400).json({ error: 'Nombre y cantidad (mayor a 0) son requeridos y cantidad debe ser un número válido.' });
    }
    const cantidadNum = Number(cantidad);
    const utilizados = 0;
    const disponibles = cantidadNum;
    const now = new Date().toISOString();
    const empresaFinal = empresa && (empresa === 'Telecom' || empresa === 'Pago Online') ? empresa : 'Telecom';
    const simboloFinal = simbolo || '📦';
    db.run('INSERT INTO articulos (nombre, cantidad, utilizados, disponibles, simbolo, created_at, updated_at, empresa) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [nombre, cantidadNum, utilizados, disponibles, simboloFinal, now, now, empresaFinal], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, nombre, cantidad: cantidadNum, utilizados, disponibles, simbolo: simboloFinal, created_at: now, updated_at: now, empresa: empresaFinal });
    });
  });

  // Listar artículos (filtrar por empresa si se pasa como query param)
  router.get('/', (req, res) => {
    const empresa = req.query.empresa;
    let sql = 'SELECT * FROM articulos';
    let params = [];
    if (empresa && (empresa === 'Telecom' || empresa === 'Pago Online')) {
      sql += ' WHERE empresa = ?';
      params.push(empresa);
    }
    db.all(sql, params, (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      // Devolver los artículos con símbolo
      const normalizados = rows.map(row => ({
        ...row,
        simbolo: row.simbolo || '📦'
      }));
      res.json(normalizados);
    });
  });

  // Actualizar cantidad utilizada
  router.post('/:id/utilizar', (req, res) => {
    const { cantidadUtilizada } = req.body;
    const id = req.params.id;
    if (!cantidadUtilizada || cantidadUtilizada <= 0) {
      return res.status(400).json({ error: 'Cantidad utilizada inválida' });
    }
    db.get('SELECT cantidad, utilizados FROM articulos WHERE id = ?', [id], (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row) return res.status(404).json({ error: 'Artículo no encontrado' });
      if (row.cantidad < cantidadUtilizada) {
        return res.status(400).json({ error: 'No hay suficiente cantidad disponible' });
      }
      const now = new Date().toISOString();
      const nuevaCantidad = row.cantidad - cantidadUtilizada;
      const nuevosUtilizados = row.utilizados + cantidadUtilizada;
      const nuevosDisponibles = nuevaCantidad;
      db.run('UPDATE articulos SET cantidad = ?, utilizados = ?, disponibles = ?, updated_at = ? WHERE id = ?', [nuevaCantidad, nuevosUtilizados, nuevosDisponibles, now, id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
      });
    });
  });

  // Editar artículo
  router.put('/:id', (req, res) => {
    const { nombre, cantidad, utilizados, empresa, simbolo } = req.body;
    const id = req.params.id;
    const now = new Date().toISOString();
    db.get('SELECT * FROM articulos WHERE id = ?', [id], (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row) return res.status(404).json({ error: 'Artículo no encontrado' });
      const newSimbolo = simbolo || row.simbolo || '📦';
      const nuevaCantidad = cantidad !== undefined ? Number(cantidad) : row.cantidad;
      const nuevosUtilizados = utilizados !== undefined ? Number(utilizados) : row.utilizados;
      const nuevosDisponibles = nuevaCantidad - nuevosUtilizados;
      const empresaFinal = empresa && (empresa === 'Telecom' || empresa === 'Pago Online') ? empresa : row.empresa || 'Telecom';
      db.run('UPDATE articulos SET nombre = ?, cantidad = ?, utilizados = ?, disponibles = ?, simbolo = ?, updated_at = ?, empresa = ? WHERE id = ?', [
        nombre || row.nombre,
        nuevaCantidad,
        nuevosUtilizados,
        nuevosDisponibles,
        newSimbolo,
        now,
        empresaFinal,
        id
      ], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
      });
    });
  });

  // Eliminar artículo
  router.delete('/:id', (req, res) => {
    const id = req.params.id;
    db.run('DELETE FROM articulos WHERE id = ?', [id], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    });
  });

  return router;
};
