const express = require('express');

module.exports = (db) => {
  const router = express.Router();

  // Obtener estadísticas generales
  router.get('/', (req, res) => {
    const { empresa = 'Telecom' } = req.query;
    
    const queries = [
      // Total vasos hoy
      `SELECT COALESCE(SUM(cantidad_vasos), 0) as total 
       FROM conteos_vasos 
       WHERE empresa = ? AND date(fecha_conteo) = date('now', 'localtime')`,
      
      // Total vasos esta semana
      `SELECT COALESCE(SUM(cantidad_vasos), 0) as total 
       FROM conteos_vasos 
       WHERE empresa = ? AND date(fecha_conteo) >= date('now', 'localtime', 'weekday 0', '-6 days')`,
      
      // Total vasos este mes
      `SELECT COALESCE(SUM(cantidad_vasos), 0) as total 
       FROM conteos_vasos 
       WHERE empresa = ? AND strftime('%Y-%m', fecha_conteo) = strftime('%Y-%m', 'now', 'localtime')`,
      
      // Máquina más usada
      `SELECT m.nombre, COALESCE(SUM(cv.cantidad_vasos), 0) as total
       FROM maquinas m
       LEFT JOIN conteos_vasos cv ON m.id = cv.maquina_id AND cv.empresa = ?
       WHERE m.empresa = ?
       GROUP BY m.id, m.nombre
       ORDER BY total DESC
       LIMIT 1`,
      
      // Promedio diario últimos 30 días
      `SELECT COALESCE(AVG(daily_total), 0) as promedio
       FROM (
         SELECT SUM(cantidad_vasos) as daily_total
         FROM conteos_vasos 
         WHERE empresa = ? AND date(fecha_conteo) >= date('now', 'localtime', '-30 days')
         GROUP BY date(fecha_conteo)
       )`,
      
      // Tendencia (comparando últimos 7 días vs 7 días anteriores)
      `SELECT 
         COALESCE(SUM(CASE WHEN date(fecha_conteo) >= date('now', 'localtime', '-6 days') 
                          THEN cantidad_vasos ELSE 0 END), 0) as ultima_semana,
         COALESCE(SUM(CASE WHEN date(fecha_conteo) >= date('now', 'localtime', '-13 days') 
                          AND date(fecha_conteo) < date('now', 'localtime', '-6 days') 
                          THEN cantidad_vasos ELSE 0 END), 0) as semana_anterior
       FROM conteos_vasos 
       WHERE empresa = ?`
    ];

    const executeQueries = async () => {
      try {
        const results = await Promise.all(queries.map((query, index) => {
          return new Promise((resolve, reject) => {
            const params = index === 3 ? [empresa, empresa] : [empresa];
            db.get(query, params, (err, row) => {
              if (err) reject(err);
              else resolve(row);
            });
          });
        }));

        const [
          vasosHoy,
          vasosSemana,
          vasosMes,
          maquinaMasUsada,
          promedioResult,
          tendenciaResult
        ] = results;

        // Determinar tendencia
        let tendencia = 'estable';
        if (tendenciaResult.ultima_semana > tendenciaResult.semana_anterior * 1.1) {
          tendencia = 'subida';
        } else if (tendenciaResult.ultima_semana < tendenciaResult.semana_anterior * 0.9) {
          tendencia = 'bajada';
        }

        const estadisticas = {
          totalVasosHoy: vasosHoy.total || 0,
          totalVasosSemana: vasosSemana.total || 0,
          totalVasosMes: vasosMes.total || 0,
          maquinaMasUsada: maquinaMasUsada?.nombre || 'Sin datos',
          promedioVasosPorDia: Math.round(promedioResult.promedio || 0),
          tendencia: tendencia,
          ultimaSemana: tendenciaResult.ultima_semana || 0,
          semanaAnterior: tendenciaResult.semana_anterior || 0
        };

        res.json(estadisticas);
      } catch (error) {
        console.error('Error al obtener estadísticas generales:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
      }
    };

    executeQueries();
  });

  // Obtener estadísticas por máquina
  router.get('/maquinas', (req, res) => {
    const { empresa = 'Telecom', desde, hasta } = req.query;
    
    let fechaCondition = '';
    const params = [empresa];
    
    if (desde) {
      fechaCondition += ' AND date(cv.fecha_conteo) >= date(?)';
      params.push(desde);
    }
    
    if (hasta) {
      fechaCondition += ' AND date(cv.fecha_conteo) <= date(?)';
      params.push(hasta);
    }
    
    const sql = `
      SELECT 
        m.id as maquina_id,
        m.nombre as maquina_nombre,
        m.edificio,
        m.ubicacion,
        COALESCE(SUM(cv.cantidad_vasos), 0) as totalVasos,
        MAX(cv.fecha_conteo) as ultimoConteo,
        CASE 
          WHEN COUNT(cv.id) > 0 THEN 
            ROUND(CAST(SUM(cv.cantidad_vasos) AS FLOAT) / 
            (CASE 
              WHEN date(MAX(cv.fecha_conteo)) = date(MIN(cv.fecha_conteo)) THEN 1
              ELSE (julianday(MAX(cv.fecha_conteo)) - julianday(MIN(cv.fecha_conteo))) * 24
            END), 1)
          ELSE 0 
        END as promedioHora
      FROM maquinas m
      LEFT JOIN conteos_vasos cv ON m.id = cv.maquina_id AND cv.empresa = ? ${fechaCondition}
      WHERE m.empresa = ?
      GROUP BY m.id, m.nombre, m.edificio, m.ubicacion
      ORDER BY totalVasos DESC
    `;
    
    // Agregar empresa al final para la condición WHERE de máquinas
    params.push(empresa);
    
    db.all(sql, params, (err, rows) => {
      if (err) {
        console.error('Error al obtener estadísticas por máquina:', err);
        return res.status(500).json({ error: 'Error interno del servidor' });
      }
      
      res.json(rows);
    });
  });

  // Obtener datos para gráficos
  router.get('/graficos', (req, res) => {
    const { empresa = 'Telecom', desde, hasta } = req.query;
    
    let params = [empresa];
    let whereClause = '';
    let joinWhereClause = '';
    
    if (desde) {
      whereClause += ' AND date(fecha_conteo) >= date(?)';
      joinWhereClause += ' AND date(cv.fecha_conteo) >= date(?)';
      params.push(desde);
    }
    
    if (hasta) {
      whereClause += ' AND date(fecha_conteo) <= date(?)';
      joinWhereClause += ' AND date(cv.fecha_conteo) <= date(?)';
      params.push(hasta);
    }
    
    const queries = {
      consumoPorDia: 'SELECT date(fecha_conteo) as fecha, SUM(cantidad_vasos) as cantidad FROM conteos_vasos WHERE empresa = ?' + whereClause + ' GROUP BY date(fecha_conteo) ORDER BY fecha DESC LIMIT 30',
      
      consumoPorMaquina: 'SELECT m.nombre as maquina_nombre, m.id as maquina_id, COALESCE(SUM(cv.cantidad_vasos), 0) as cantidad FROM maquinas m LEFT JOIN conteos_vasos cv ON m.id = cv.maquina_id AND cv.empresa = ?' + joinWhereClause + ' WHERE m.empresa = ? GROUP BY m.id, m.nombre ORDER BY cantidad DESC',
      
      tendenciaSemanal: 'SELECT strftime(\'%Y-W%W\', fecha_conteo) as fecha, SUM(cantidad_vasos) as cantidad FROM conteos_vasos WHERE empresa = ?' + whereClause + ' GROUP BY strftime(\'%Y-W%W\', fecha_conteo) ORDER BY fecha DESC LIMIT 12',
      
      comparativaMensual: 'SELECT strftime(\'%Y-%m\', fecha_conteo) as fecha, SUM(cantidad_vasos) as cantidad FROM conteos_vasos WHERE empresa = ?' + whereClause + ' GROUP BY strftime(\'%Y-%m\', fecha_conteo) ORDER BY fecha DESC LIMIT 12'
    };

    const executeGraficos = async () => {
      try {
        const results = {};
        
        for (const [key, query] of Object.entries(queries)) {
          const queryParams = key === 'consumoPorMaquina' ? [...params, empresa] : params;
          
          results[key] = await new Promise((resolve, reject) => {
            db.all(query, queryParams, (err, rows) => {
              if (err) reject(err);
              else resolve(rows || []);
            });
          });
        }

        res.json(results);
      } catch (error) {
        console.error('Error al obtener datos para gráficos:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
      }
    };

    executeGraficos();
  });

  return router;
};
