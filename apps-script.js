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
// 6. Deploy → Manage deployments → Editar (lápiz) → Version: New version → Implementar
//    (mantiene la misma URL para que index.html no necesite cambios)
//
// HOJAS REQUERIDAS en el Sheet (con estos encabezados exactos en fila 1):
// - Compras:         id | fecha | dia | proveedor | producto | cantidad | precio | total
// - Ventas:          id | fecha | dia | cliente | producto | cantidad | total | tipo_cliente | status
// - Pagos:           id | fecha | dia | cliente | monto | cuenta | venta_id
// - Gastos:          id | fecha | dia | descripcion | categoria | total | cuenta
// - Clientes:        nombre | tipo | saldo
// - Productos:       nombre
// - Proveedores:     nombre
// - CategoriasGasto: nombre
// - Cuentas:         nombre
// - Mermas:          id | fecha | dia | cantidad | motivo | costo_unitario | total
// - Descuentos:      id | fecha | dia | venta_id | cliente | monto | motivo
// - Errors:          (se crea automáticamente cuando ocurre un error)
// ═══════════════════════════════════════════════

function doGet(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var action = e.parameter.action;

  try {
    // ── READ: Devuelve todos los datos y catálogos ──
    if (action === 'read') {
      var result = {
        compras: readSheet(ss, 'Compras', ['id','fecha','dia','proveedor','producto','cantidad','precio','total']),
        ventas: readSheet(ss, 'Ventas', ['id','fecha','dia','cliente','producto','cantidad','total','tipo_cliente','status']),
        pagos: readSheet(ss, 'Pagos', ['id','fecha','dia','cliente','monto','cuenta','venta_id']),
        gastos: readSheet(ss, 'Gastos', ['id','fecha','dia','descripcion','categoria','total','cuenta']),
        mermas: readSheet(ss, 'Mermas', ['id','fecha','dia','cantidad','motivo','costo_unitario','total']),
        descuentos: readSheet(ss, 'Descuentos', ['id','fecha','dia','venta_id','cliente','monto','motivo']),
        clientes: readClientes(ss),
        productos: readSimpleList(ss, 'Productos', ['Pollo']),
        proveedores: readSimpleList(ss, 'Proveedores', []),
        categoriasGasto: readSimpleList(ss, 'CategoriasGasto', []),
        cuentas: readSimpleList(ss, 'Cuentas', ['efectivo','banco','caja'])
      };
      return jsonResponse(result);
    }

    // ── LIST SHEETS: para diagnóstico (qué hojas y headers existen) ──
    if (action === 'listSheets') {
      var sheets = ss.getSheets();
      var result = {};
      sheets.forEach(function(s) {
        var name = s.getName();
        var lastCol = s.getLastColumn();
        var headers = lastCol > 0 ? s.getRange(1, 1, 1, lastCol).getValues()[0] : [];
        result[name] = {
          rows: s.getLastRow(),
          headers: headers
        };
      });
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

    // ── ADD PAGO (con venta_id opcional para abonos por ticket) ──
    if (action === 'addPago') {
      var d = JSON.parse(e.parameter.data);
      var sheet = ss.getSheetByName('Pagos');
      sheet.appendRow([d.id, d.fecha, d.dia, d.cliente, d.monto, d.cuenta, d.venta_id || '']);
      return jsonResponse({success: true});
    }

    // ── ADD GASTO (incluye nueva columna categoria) ──
    if (action === 'addGasto') {
      var d = JSON.parse(e.parameter.data);
      var sheet = ss.getSheetByName('Gastos');
      sheet.appendRow([d.id, d.fecha, d.dia, d.descripcion, d.categoria || '', d.total, d.cuenta]);
      return jsonResponse({success: true});
    }

    // ── ADD DESCUENTO (merma comercial: pollo golpeado, etc.) ──
    if (action === 'addDescuento') {
      var d = JSON.parse(e.parameter.data);
      var sheet = ss.getSheetByName('Descuentos');
      if (!sheet) {
        sheet = ss.insertSheet('Descuentos');
        sheet.appendRow(['id','fecha','dia','venta_id','cliente','monto','motivo']);
      }
      sheet.appendRow([d.id, d.fecha, d.dia, d.venta_id, d.cliente, d.monto, d.motivo || '']);
      return jsonResponse({success: true});
    }

    // ── ADD MERMA (pollos ahogados / inventario perdido) ──
    if (action === 'addMerma') {
      var d = JSON.parse(e.parameter.data);
      var sheet = ss.getSheetByName('Mermas');
      if (!sheet) {
        sheet = ss.insertSheet('Mermas');
        sheet.appendRow(['id','fecha','dia','cantidad','motivo','costo_unitario','total']);
      }
      sheet.appendRow([d.id, d.fecha, d.dia, d.cantidad, d.motivo || '', d.costo_unitario || 0, d.total || 0]);
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

    // ── CATÁLOGO: PRODUCTOS ──
    if (action === 'getProductos') {
      return jsonResponse({productos: readSimpleList(ss, 'Productos', ['Pollo'])});
    }
    if (action === 'addProducto') {
      addToCatalog(ss, 'Productos', e.parameter.nombre);
      return jsonResponse({success: true});
    }
    if (action === 'deleteProducto') {
      deleteFromCatalog(ss, 'Productos', e.parameter.nombre);
      return jsonResponse({success: true});
    }

    // ── CATÁLOGO: PROVEEDORES ──
    if (action === 'getProveedores') {
      return jsonResponse({proveedores: readSimpleList(ss, 'Proveedores', [])});
    }
    if (action === 'addProveedor') {
      addToCatalog(ss, 'Proveedores', e.parameter.nombre);
      return jsonResponse({success: true});
    }
    if (action === 'deleteProveedor') {
      deleteFromCatalog(ss, 'Proveedores', e.parameter.nombre);
      return jsonResponse({success: true});
    }

    // ── CATÁLOGO: CATEGORÍAS DE GASTO ──
    if (action === 'getCategoriasGasto') {
      return jsonResponse({categoriasGasto: readSimpleList(ss, 'CategoriasGasto', [])});
    }
    if (action === 'addCategoriaGasto') {
      addToCatalog(ss, 'CategoriasGasto', e.parameter.nombre);
      return jsonResponse({success: true});
    }
    if (action === 'deleteCategoriaGasto') {
      deleteFromCatalog(ss, 'CategoriasGasto', e.parameter.nombre);
      return jsonResponse({success: true});
    }

    // ── CATÁLOGO: CUENTAS ──
    if (action === 'getCuentas') {
      return jsonResponse({cuentas: readSimpleList(ss, 'Cuentas', ['efectivo','banco','caja'])});
    }
    if (action === 'addCuenta') {
      addToCatalog(ss, 'Cuentas', e.parameter.nombre);
      return jsonResponse({success: true});
    }
    if (action === 'deleteCuenta') {
      deleteFromCatalog(ss, 'Cuentas', e.parameter.nombre);
      return jsonResponse({success: true});
    }

    return jsonResponse({error: 'Acción no válida: ' + action});

  } catch (err) {
    logError(action, err, e.parameter.data);
    return jsonResponse({error: err.toString()});
  }
}

// ── LOG DE ERRORES ──
function logError(action, err, dataStr) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Errors');
    if (!sheet) {
      sheet = ss.insertSheet('Errors');
      sheet.appendRow(['timestamp', 'action', 'error', 'data']);
    }
    sheet.appendRow([
      new Date().toISOString(),
      action || '(sin action)',
      err && err.toString ? err.toString() : String(err),
      dataStr || ''
    ]);
  } catch (e) {
    // Si hasta loggear falla, no podemos hacer mucho
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

// Lee una hoja simple (un solo header "nombre") y devuelve array de strings.
// Si la hoja no existe o está vacía, devuelve `defaults`.
function readSimpleList(ss, sheetName, defaults) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return defaults || [];
  var data = sheet.getDataRange().getValues();
  var items = [];
  for (var i = 1; i < data.length; i++) {
    if (data[i][0]) items.push(String(data[i][0]).trim());
  }
  return items.length > 0 ? items : (defaults || []);
}

function addToCatalog(ss, sheetName, nombre) {
  if (!nombre) return;
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return;
  // No duplicar
  var data = sheet.getDataRange().getValues();
  var clean = String(nombre).trim();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim().toLowerCase() === clean.toLowerCase()) return;
  }
  sheet.appendRow([clean]);
}

function deleteFromCatalog(ss, sheetName, nombre) {
  if (!nombre) return;
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return;
  var data = sheet.getDataRange().getValues();
  for (var i = data.length - 1; i >= 1; i--) {
    if (String(data[i][0]) === String(nombre)) {
      sheet.deleteRow(i + 1);
      break;
    }
  }
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
