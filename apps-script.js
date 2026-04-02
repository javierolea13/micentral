// ═══════════════════════════════════════════════
// Apps Script completo para "Mi Central"
// ═══════════════════════════════════════════════
//
// INSTRUCCIONES:
// 1. Abre tu Google Sheet "La central"
// 2. Ve a Extensiones → Apps Script
// 3. Borra todo el código que tengas ahí
// 4. Pega este código completo
// 5. Guarda (Ctrl+S)
// 6. Deploy → Manage deployments → Editar → Version: New version → Guardar
//    (O si prefieres: Deploy → New deployment → Web app → Anyone → Deploy)
// 7. Si creas un nuevo deployment, actualiza la URL en tu index.html
//
// HOJAS REQUERIDAS en el Sheet (con estos encabezados exactos en fila 1):
// - Compras:  id | fecha | dia | proveedor | producto | cantidad | precio | total
// - Ventas:   id | fecha | dia | cliente | producto | cantidad | total | tipo_cliente | status
// - Pagos:    id | fecha | dia | cliente | monto | cuenta
// - Gastos:   id | fecha | dia | descripcion | total | cuenta
// - Clientes: nombre | tipo | saldo
// - Productos: nombre
// ═══════════════════════════════════════════════

function doGet(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var action = e.parameter.action;

  try {
    // ── READ: Devuelve todos los datos ──
    if (action === 'read') {
      var result = {
        compras: readSheet(ss, 'Compras', ['id','fecha','dia','proveedor','producto','cantidad','precio','total']),
        ventas: readSheet(ss, 'Ventas', ['id','fecha','dia','cliente','producto','cantidad','total','tipo_cliente','status']),
        pagos: readSheet(ss, 'Pagos', ['id','fecha','dia','cliente','monto','cuenta']),
        gastos: readSheet(ss, 'Gastos', ['id','fecha','dia','descripcion','total','cuenta']),
        clientes: readClientes(ss),
        productos: readProductos(ss)
      };
      return jsonResponse(result);
    }

    // ── ADD COMPRA ──
    if (action === 'addCompra') {
      var d = JSON.parse(e.parameter.data);
      var sheet = ss.getSheetByName('Compras');
      sheet.appendRow([d.id, d.fecha, d.dia, d.proveedor, d.producto, d.cantidad, d.precio, d.total]);
      return jsonResponse({success: true});
    }

    // ── ADD VENTA ──
    if (action === 'addVenta') {
      var d = JSON.parse(e.parameter.data);
      var sheet = ss.getSheetByName('Ventas');
      sheet.appendRow([d.id, d.fecha, d.dia, d.cliente, d.producto, d.cantidad, d.total, d.tipo_cliente, d.status]);
      return jsonResponse({success: true});
    }

    // ── ADD PAGO ──
    if (action === 'addPago') {
      var d = JSON.parse(e.parameter.data);
      var sheet = ss.getSheetByName('Pagos');
      sheet.appendRow([d.id, d.fecha, d.dia, d.cliente, d.monto, d.cuenta]);
      return jsonResponse({success: true});
    }

    // ── ADD GASTO ──
    if (action === 'addGasto') {
      var d = JSON.parse(e.parameter.data);
      var sheet = ss.getSheetByName('Gastos');
      sheet.appendRow([d.id, d.fecha, d.dia, d.descripcion, d.total, d.cuenta]);
      return jsonResponse({success: true});
    }

    // ── UPDATE CLIENTE ──
    if (action === 'updateCliente') {
      var d = JSON.parse(e.parameter.data);
      var sheet = ss.getSheetByName('Clientes');
      var data = sheet.getDataRange().getValues();
      var found = false;
      for (var i = 1; i < data.length; i++) {
        if (data[i][0] === d.nombre) {
          sheet.getRange(i + 1, 2).setValue(d.tipo);
          sheet.getRange(i + 1, 3).setValue(d.saldo);
          found = true;
          break;
        }
      }
      if (!found) {
        sheet.appendRow([d.nombre, d.tipo, d.saldo]);
      }
      return jsonResponse({success: true});
    }

    // ── DELETE ROW ──
    if (action === 'deleteRow') {
      var sheetName = e.parameter.sheet;
      var id = e.parameter.id;
      var sheet = ss.getSheetByName(sheetName);
      if (sheet) {
        var data = sheet.getDataRange().getValues();
        for (var i = data.length - 1; i >= 1; i--) {
          if (String(data[i][0]) === String(id)) {
            sheet.deleteRow(i + 1);
            break;
          }
        }
      }
      return jsonResponse({success: true});
    }

    // ── EDIT ROW ──
    if (action === 'editRow') {
      var sheetName = e.parameter.sheet;
      var d = JSON.parse(e.parameter.data);
      var sheet = ss.getSheetByName(sheetName);
      if (sheet) {
        var data = sheet.getDataRange().getValues();
        var headers = data[0];
        for (var i = 1; i < data.length; i++) {
          if (String(data[i][0]) === String(d.id)) {
            for (var j = 0; j < headers.length; j++) {
              var key = headers[j];
              if (d.hasOwnProperty(key)) {
                sheet.getRange(i + 1, j + 1).setValue(d[key]);
              }
            }
            break;
          }
        }
      }
      return jsonResponse({success: true});
    }

    // ── GET PRODUCTOS ──
    if (action === 'getProductos') {
      return jsonResponse({productos: readProductos(ss)});
    }

    // ── ADD PRODUCTO ──
    if (action === 'addProducto') {
      var nombre = e.parameter.nombre;
      var sheet = ss.getSheetByName('Productos');
      if (sheet) {
        sheet.appendRow([nombre]);
      }
      return jsonResponse({success: true});
    }

    // ── DELETE PRODUCTO ──
    if (action === 'deleteProducto') {
      var nombre = e.parameter.nombre;
      var sheet = ss.getSheetByName('Productos');
      if (sheet) {
        var data = sheet.getDataRange().getValues();
        for (var i = data.length - 1; i >= 1; i--) {
          if (data[i][0] === nombre) {
            sheet.deleteRow(i + 1);
            break;
          }
        }
      }
      return jsonResponse({success: true});
    }

    return jsonResponse({error: 'Acción no válida: ' + action});

  } catch (err) {
    return jsonResponse({error: err.toString()});
  }
}

// ── FUNCIONES AUXILIARES ──

function readSheet(ss, sheetName, headers) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  var result = [];
  for (var i = 1; i < data.length; i++) {
    var row = {};
    for (var j = 0; j < headers.length; j++) {
      row[headers[j]] = data[i][j] !== undefined ? data[i][j] : '';
    }
    result.push(row);
  }
  return result;
}

function readClientes(ss) {
  var sheet = ss.getSheetByName('Clientes');
  if (!sheet) return {};
  var data = sheet.getDataRange().getValues();
  var clientes = {};
  for (var i = 1; i < data.length; i++) {
    if (data[i][0]) {
      clientes[data[i][0]] = {
        tipo: data[i][1] || 'clienta',
        saldo: Number(data[i][2]) || 0
      };
    }
  }
  return clientes;
}

function readProductos(ss) {
  var sheet = ss.getSheetByName('Productos');
  if (!sheet) return ['Pollo'];
  var data = sheet.getDataRange().getValues();
  var productos = [];
  for (var i = 1; i < data.length; i++) {
    if (data[i][0]) productos.push(data[i][0]);
  }
  return productos.length > 0 ? productos : ['Pollo'];
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
