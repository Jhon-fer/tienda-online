const express = require('express');
const mysql = require('mysql2');
const path = require('path');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 🔥 SERVIR FRONTEND (ESTO ES LO IMPORTANTE)
app.use(express.static(path.join(__dirname, 'public')));

// 🔥 CONEXIÓN MYSQL
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'tienda',
  port: 3307
});

db.connect(err => {
  if (err) {
    console.log("❌ Error MySQL:", err);
    return;
  }
  console.log("✅ Conectado a MySQL (tienda)");
});

// 🔥 RUTA PRUEBA
app.get('/ping', (req, res) => {
  res.json({ ok: true });
});

app.get('/api/productos', (req, res) => {

  db.query('SELECT * FROM productos', (err, rows) => {

    if (err) {
      console.log("❌ Error productos:", err);
      return res.status(500).json({
        success: false,
        message: "Error al obtener productos"
      });
    }

    res.json(rows); // 👈 IMPORTANTE: array directo
  });

});

// 🔥 COMPRA
app.post('/api/compra', (req, res) => {

  const { carrito, total } = req.body;

  console.log("🛒 Carrito recibido:", carrito);
  console.log("💰 Total:", total);

  if (!Array.isArray(carrito) || carrito.length === 0) {
    return res.status(400).json({
      success: false,
      message: "Carrito vacío"
    });
  }

  const totalFinal = Number(total);

  if (isNaN(totalFinal) || totalFinal <= 0) {
    return res.status(400).json({
      success: false,
      message: "Total inválido"
    });
  }

  db.beginTransaction(err => {

    if (err) {
      return res.status(500).json({
        success: false,
        message: "Error transacción"
      });
    }

    db.query(
      'INSERT INTO tickets (total) VALUES (?)',
      [totalFinal],
      (err, result) => {

        if (err) {
          return db.rollback(() => {
            return res.status(500).json({
              success: false,
              message: "Error ticket"
            });
          });
        }

        const ticketId = result.insertId;

        const procesos = carrito.map(item => {

          return new Promise((resolve, reject) => {

            const cantidad = Number(item.cantidad);
            const precio = Number(item.precio);

            db.query(
              'SELECT stock FROM productos WHERE id = ?',
              [item.id],
              (err, rows) => {

                if (err) return reject(err);
                if (!rows.length) return reject("No existe producto");

                if (rows[0].stock < cantidad) {
                  return reject("Sin stock");
                }

                db.query(
                  'INSERT INTO ventas (producto, cantidad, total) VALUES (?, ?, ?)',
                  [item.nombre, cantidad, precio * cantidad],
                  (err2) => {

                    if (err2) return reject(err2);

                    db.query(
                      'UPDATE productos SET stock = stock - ? WHERE id = ?',
                      [cantidad, item.id],
                      (err3) => {

                        if (err3) return reject(err3);

                        resolve();
                      }
                    );
                  }
                );
              }
            );
          });
        });

        Promise.all(procesos)
          .then(() => {

            db.commit(err => {

              if (err) {
                return db.rollback(() => {
                  return res.status(500).json({
                    success: false,
                    message: "Error commit"
                  });
                });
              }

              res.json({
                success: true,
                message: "Compra realizada",
                ticket: ticketId,
                total: totalFinal
              });

            });

          })
          .catch(error => {

            db.rollback(() => {
              res.status(400).json({
                success: false,
                message: error.toString()
              });
            });

          });

      }
    );
  });
});

// ➕ AGREGAR STOCK
app.post('/api/productos/stock', (req, res) => {

  const { id, cantidad } = req.body;

  const suma = Number(cantidad);

  if (!id || isNaN(suma)) {
    return res.status(400).json({
      success: false,
      message: "Datos inválidos"
    });
  }

  db.query(
    'UPDATE productos SET stock = stock + ? WHERE id = ?',
    [suma, id],
    (err, result) => {

      if (err) {
        console.log("❌ Error stock:", err);
        return res.status(500).json({
          success: false,
          message: "Error al actualizar stock"
        });
      }

      res.json({
        success: true,
        message: "Stock actualizado correctamente"
      });
    }
  );
});

// 🔥 ARRANCAR SERVIDOR (ESTO TE FALTABA TAMBIÉN)
app.listen(3000, () => {
  console.log("🚀 Servidor en http://localhost:3000");
});