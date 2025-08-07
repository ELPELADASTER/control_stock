const express = require('express');

module.exports = (db) => {
  const router = express.Router();

  // Crear nuevo conteo de vasos
  router.post('/', (req, res) => {
    const { maquina_id, cantidad_vasos, observaciones, empresa } = req.body;

    if (!maquina_id || !cantidad_vasos) {
      return res.status(400).json({ 
        error: 'maquina_id y cantidad_vasos son requeridos' 
      });
    }

    if (cantidad_vasos <= 0) {
      return res.status(400).json({ 
        error: 'La cantidad de vasos debe ser mayor a 0' 
      });
    }

    const sql = `
      INSERT INTO conteos_vasos (maquina_id, cantidad_vasos, observaciones, empresa)
      VALUES (?, ?, ?, ?)
    `;
    
    db.run(sql, [maquina_id, cantidad_vasos, observaciones || null, empresa || 'Telecom'], function(err) {
      if (err) {
        console.error('Error al crear conteo:', err);
        return res.status(500).json({ error: 'Error interno del servidor' });
      }
      
      res.status(201).json({
        id: this.lastID,
        maquina_id,
        cantidad_vasos,
        observaciones,
        empresa,
        mensaje: 'Conteo creado exitosamente'
      });
    });
  });

  // Obtener últimos conteos
  router.get('/ultimos', (req, res) => {
    const { empresa = 'Telecom', limit = 10 } = req.query;
    
    const sql = `
      SELECT 
        cv.id,
        cv.maquina_id,
        cv.cantidad_vasos,
        cv.fecha_conteo,
        cv.observaciones,
        cv.empresa,
        m.nombre as maquina_nombre,
        m.edificio,
        m.ubicacion
      FROM conteos_vasos cv
      INNER JOIN maquinas m ON cv.maquina_id = m.id
      WHERE cv.empresa = ?
      ORDER BY cv.fecha_conteo DESC
      LIMIT ?
    `;
    
    db.all(sql, [empresa, parseInt(limit)], (err, rows) => {
      if (err) {
        console.error('Error al obtener conteos:', err);
        return res.status(500).json({ error: 'Error interno del servidor' });
      }
      
      res.json(rows);
    });
  });

  // Obtener conteos por máquina
  router.get('/por-maquina/:maquina_id', (req, res) => {
    const { maquina_id } = req.params;
    const { fecha_desde, fecha_hasta, empresa = 'Telecom' } = req.query;
    
    let sql = `
      SELECT 
        cv.id,
        cv.cantidad_vasos,
        cv.fecha_conteo,
        cv.observaciones,
        m.nombre as maquina_nombre,
        m.edificio,
        m.ubicacion
      FROM conteos_vasos cv
      INNER JOIN maquinas m ON cv.maquina_id = m.id
      WHERE cv.maquina_id = ? AND cv.empresa = ?
    `;
    
    const params = [maquina_id, empresa];
    
    if (fecha_desde) {
      sql += ' AND date(cv.fecha_conteo) >= date(?)';
      params.push(fecha_desde);
    }
    
    if (fecha_hasta) {
      sql += ' AND date(cv.fecha_conteo) <= date(?)';
      params.push(fecha_hasta);
    }
    
    sql += ' ORDER BY cv.fecha_conteo DESC';
    
    db.all(sql, params, (err, rows) => {
      if (err) {
        console.error('Error al obtener conteos por máquina:', err);
        return res.status(500).json({ error: 'Error interno del servidor' });
      }
      
      res.json(rows);
    });
  });

  // Editar conteo existente
  router.put('/:id', (req, res) => {
    const { id } = req.params;
    const { cantidad_vasos, observaciones } = req.body;

    if (!cantidad_vasos) {
      return res.status(400).json({ 
        error: 'cantidad_vasos es requerido' 
      });
    }

    if (cantidad_vasos <= 0) {
      return res.status(400).json({ 
        error: 'La cantidad de vasos debe ser mayor a 0' 
      });
    }

    const sql = `
      UPDATE conteos_vasos 
      SET cantidad_vasos = ?, observaciones = ?
      WHERE id = ?
    `;
    
    db.run(sql, [cantidad_vasos, observaciones || null, id], function(err) {
      if (err) {
        console.error('Error al actualizar conteo:', err);
        return res.status(500).json({ error: 'Error interno del servidor' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Conteo no encontrado' });
      }
      
      res.json({
        id: parseInt(id),
        cantidad_vasos,
        observaciones,
        mensaje: 'Conteo actualizado exitosamente'
      });
    });
  });

  // Eliminar conteo
  router.delete('/:id', (req, res) => {
    const { id } = req.params;
    
    const sql = 'DELETE FROM conteos_vasos WHERE id = ?';
    
    db.run(sql, [id], function(err) {
      if (err) {
        console.error('Error al eliminar conteo:', err);
        return res.status(500).json({ error: 'Error interno del servidor' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Conteo no encontrado' });
      }
      
      res.json({ mensaje: 'Conteo eliminado exitosamente' });
    });
  });

  return router;
};
