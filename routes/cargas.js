const express = require('express');

module.exports = (db) => {
  const router = express.Router();

  // Cargar artículos en máquina
  router.post('/', (req, res) => {
    const { maquina_id, articulo_id, cantidad_cargada, usuario, observaciones } = req.body;
    
    if (!maquina_id || !articulo_id || !cantidad_cargada || cantidad_cargada <= 0) {
      return res.status(400).json({ error: 'Máquina, artículo y cantidad válida son requeridos' });
    }

    // Verificar que la máquina existe
    db.get('SELECT * FROM maquinas WHERE id = ?', [maquina_id], (err, maquina) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!maquina) return res.status(404).json({ error: 'Máquina no encontrada' });

      // Verificar que el artículo existe y tiene stock suficiente
      db.get('SELECT * FROM articulos WHERE id = ?', [articulo_id], (err, articulo) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!articulo) return res.status(404).json({ error: 'Artículo no encontrado' });
        
        if (articulo.disponibles < cantidad_cargada) {
          return res.status(400).json({ 
            error: `Stock insuficiente. Disponible: ${articulo.disponibles}, solicitado: ${cantidad_cargada}` 
          });
        }

        const now = new Date().toISOString();
        
        // Crear la carga
        db.run('INSERT INTO cargas_maquinas (maquina_id, articulo_id, cantidad_cargada, fecha_carga, usuario, observaciones) VALUES (?, ?, ?, ?, ?, ?)',
          [maquina_id, articulo_id, cantidad_cargada, now, usuario || '', observaciones || ''],
          function(err) {
            if (err) return res.status(500).json({ error: err.message });
            
            // Actualizar el stock del artículo
            const nuevosUtilizados = articulo.utilizados + cantidad_cargada;
            const nuevosDisponibles = articulo.cantidad - nuevosUtilizados;
            
            db.run('UPDATE articulos SET utilizados = ?, disponibles = ?, updated_at = ? WHERE id = ?',
              [nuevosUtilizados, nuevosDisponibles, now, articulo_id],
              function(err) {
                if (err) return res.status(500).json({ error: err.message });
                
                res.json({ 
                  id: this.lastID,
                  maquina_id,
                  articulo_id,
                  cantidad_cargada,
                  fecha_carga: now,
                  usuario: usuario || '',
                  observaciones: observaciones || '',
                  success: true 
                });
              }
            );
          }
        );
      });
    });
  });

  // Obtener cargas agrupadas por sesión (máquina + fecha + usuario)
  router.get('/agrupadas', (req, res) => {
    const { maquina_id, fecha_desde, fecha_hasta, empresa } = req.query;
    
    let sql = `
      SELECT 
        MIN(c.id) as id,
        c.maquina_id,
        c.usuario,
        c.observaciones,
        DATE(c.fecha_carga) as fecha,
        MIN(c.fecha_carga) as fecha_carga,
        m.nombre as maquina_nombre,
        m.edificio,
        m.ubicacion,
        m.empresa,
        COUNT(*) as total_productos,
        SUM(c.cantidad_cargada) as total_cantidad,
        GROUP_CONCAT(a.simbolo || ' ' || a.nombre || ' (' || c.cantidad_cargada || ')', ' + ') as productos_detalle
      FROM cargas_maquinas c
      JOIN maquinas m ON c.maquina_id = m.id
      JOIN articulos a ON c.articulo_id = a.id
      WHERE 1=1
    `;
    
    let params = [];
    
    if (maquina_id) {
      sql += ' AND c.maquina_id = ?';
      params.push(maquina_id);
    }
    
    if (empresa && (empresa === 'Telecom' || empresa === 'Pago Online')) {
      sql += ' AND m.empresa = ?';
      params.push(empresa);
    }
    
    if (fecha_desde) {
      sql += ' AND DATE(c.fecha_carga) >= DATE(?)';
      params.push(fecha_desde);
    }
    
    if (fecha_hasta) {
      sql += ' AND DATE(c.fecha_carga) <= DATE(?)';
      params.push(fecha_hasta);
    }
    
    sql += ' GROUP BY c.maquina_id, DATE(c.fecha_carga), c.usuario, c.observaciones ORDER BY MIN(c.fecha_carga) DESC';
    
    db.all(sql, params, (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    });
  });

  // Obtener detalles de una carga agrupada
  router.get('/detalles/:maquina_id/:fecha', (req, res) => {
    const { maquina_id, fecha } = req.params;
    const { usuario } = req.query;
    
    let sql = `
      SELECT 
        c.*,
        a.nombre as articulo_nombre,
        a.simbolo as articulo_simbolo
      FROM cargas_maquinas c
      JOIN articulos a ON c.articulo_id = a.id
      WHERE c.maquina_id = ? AND DATE(c.fecha_carga) = ?
    `;
    
    let params = [maquina_id, fecha];
    
    if (usuario) {
      sql += ' AND c.usuario = ?';
      params.push(usuario);
    }
    
    sql += ' ORDER BY c.fecha_carga ASC';
    
    db.all(sql, params, (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    });
  });

  // Obtener cargas con detalles (máquina y artículo) - endpoint original para compatibilidad
  router.get('/', (req, res) => {
    const { maquina_id, articulo_id, fecha_desde, fecha_hasta, empresa } = req.query;
    
    let sql = `
      SELECT 
        c.*,
        m.nombre as maquina_nombre,
        m.edificio,
        m.ubicacion,
        m.empresa,
        a.nombre as articulo_nombre,
        a.simbolo as articulo_simbolo
      FROM cargas_maquinas c
      JOIN maquinas m ON c.maquina_id = m.id
      JOIN articulos a ON c.articulo_id = a.id
      WHERE 1=1
    `;
    
    let params = [];
    
    if (maquina_id) {
      sql += ' AND c.maquina_id = ?';
      params.push(maquina_id);
    }
    
    if (articulo_id) {
      sql += ' AND c.articulo_id = ?';
      params.push(articulo_id);
    }
    
    if (empresa && (empresa === 'Telecom' || empresa === 'Pago Online')) {
      sql += ' AND m.empresa = ?';
      params.push(empresa);
    }
    
    if (fecha_desde) {
      sql += ' AND DATE(c.fecha_carga) >= DATE(?)';
      params.push(fecha_desde);
    }
    
    if (fecha_hasta) {
      sql += ' AND DATE(c.fecha_carga) <= DATE(?)';
      params.push(fecha_hasta);
    }
    
    sql += ' ORDER BY c.fecha_carga DESC';
    
    db.all(sql, params, (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    });
  });

  // Obtener resumen de cargas por máquina
  router.get('/resumen', (req, res) => {
    const { empresa } = req.query;
    
    let sql = `
      SELECT 
        m.id as maquina_id,
        m.nombre as maquina_nombre,
        m.edificio,
        m.ubicacion,
        COUNT(c.id) as total_cargas,
        SUM(c.cantidad_cargada) as total_cantidad,
        MAX(c.fecha_carga) as ultima_carga
      FROM maquinas m
      LEFT JOIN cargas_maquinas c ON m.id = c.maquina_id
      WHERE 1=1
    `;
    
    let params = [];
    
    if (empresa && (empresa === 'Telecom' || empresa === 'Pago Online')) {
      sql += ' AND m.empresa = ?';
      params.push(empresa);
    }
    
    sql += ' GROUP BY m.id ORDER BY m.edificio, m.nombre';
    
    db.all(sql, params, (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    });
  });

  // Eliminar carga (solo para correcciones)
  router.delete('/:id', (req, res) => {
    const id = req.params.id;
    
    // Obtener datos de la carga antes de eliminarla para revertir el stock
    db.get('SELECT * FROM cargas_maquinas WHERE id = ?', [id], (err, carga) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!carga) return res.status(404).json({ error: 'Carga no encontrada' });
      
      // Obtener el artículo para revertir el stock
      db.get('SELECT * FROM articulos WHERE id = ?', [carga.articulo_id], (err, articulo) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!articulo) return res.status(404).json({ error: 'Artículo no encontrado' });
        
        const now = new Date().toISOString();
        const nuevosUtilizados = Math.max(0, articulo.utilizados - carga.cantidad_cargada);
        const nuevosDisponibles = articulo.cantidad - nuevosUtilizados;
        
        // Actualizar el stock del artículo
        db.run('UPDATE articulos SET utilizados = ?, disponibles = ?, updated_at = ? WHERE id = ?',
          [nuevosUtilizados, nuevosDisponibles, now, carga.articulo_id],
          function(err) {
            if (err) return res.status(500).json({ error: err.message });
            
            // Eliminar la carga
            db.run('DELETE FROM cargas_maquinas WHERE id = ?', [id], function(err) {
              if (err) return res.status(500).json({ error: err.message });
              res.json({ success: true, mensaje: 'Carga eliminada y stock revertido' });
            });
          }
        );
      });
    });
  });

  return router;
};
