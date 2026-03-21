// ============================================
// GOOGLE APPS SCRIPT - CÓDIGO PARA GOOGLE SHEETS
// BY JHOAN GORDON
// ============================================
// INSTRUCCIONES:
// 1. Abrir la hoja de cálculo: https://docs.google.com/spreadsheets/d/1hiIsu-gXkzGoyYcvRsSZmIg35Dv36YrAE6S1jDLMPlQ/edit
// 2. Verificar que existan las hojas: CREACION, AVERIA, ATP, SERVICE NOW
// 3. Ir a Extensiones > Apps Script
// 4. Pegar este código y guardar
// 5. Desplegar > Nueva implementación > Aplicación web
//    - Ejecutar como: YO
//    - Quién tiene acceso: CUALQUIERA
// 6. Copiar la URL del Web App desplegada
// IMPORTANTE: Cada vez que cambies el código debes hacer un NUEVO DESPLIEGUE
// (Administrar implementaciones > Nueva versión)

var SPREADSHEET_ID = '1hiIsu-gXkzGoyYcvRsSZmIg35Dv36YrAE6S1jDLMPlQ';

function normalizarTexto(valor) {
  if (valor === null || valor === undefined) return '';
  return String(valor);
}

function parsearJSONSeguro(texto) {
  return JSON.parse(normalizarTexto(texto));
}

function obtenerPayload(e) {
  if (!e) throw new Error('Evento no recibido');

  if (e.parameter && e.parameter.payload) {
    return parsearJSONSeguro(e.parameter.payload);
  }

  if (e.postData && e.postData.contents) {
    var contenido = normalizarTexto(e.postData.contents).trim();
    if (!contenido) {
      throw new Error('El cuerpo del POST llegó vacío');
    }

    try {
      return parsearJSONSeguro(contenido);
    } catch (jsonError) {
      var matchPayload = contenido.match(/(?:^|&)payload=([^&]+)/);
      if (matchPayload && matchPayload[1]) {
        return parsearJSONSeguro(decodeURIComponent(matchPayload[1].replace(/\+/g, ' ')));
      }
      throw new Error('No fue posible interpretar el payload enviado: ' + contenido);
    }
  }

  if (e.parameter && e.parameter.sheet) {
    return {
      sheet: e.parameter.sheet,
      data: e.parameter
    };
  }

  throw new Error('No se recibió payload');
}

function registrarEnHoja(payload) {
  var sheetName = normalizarTexto(payload.sheet).trim();
  var data = payload.data || {};

  if (!sheetName) {
    throw new Error('El nombre de la pestaña es obligatorio');
  }

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    throw new Error('Pestaña no encontrada: ' + sheetName);
  }

  var lastColumn = Math.max(sheet.getLastColumn(), 1);
  var headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map(function(header) {
    return normalizarTexto(header).trim();
  });

  var row = headers.map(function(header) {
    return normalizarTexto(data[header]);
  });

  sheet.appendRow(row);

  return {
    success: true,
    spreadsheetId: SPREADSHEET_ID,
    sheet: sheetName,
    headers: headers,
    row: row
  };
}

function crearRespuestaJSON(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var payload = obtenerPayload(e);
    return crearRespuestaJSON(registrarEnHoja(payload));
  } catch (error) {
    return crearRespuestaJSON({ success: false, error: error.toString() });
  }
}

function doGet(e) {
  try {
    if (e && ((e.parameter && e.parameter.payload) || (e.parameter && e.parameter.sheet))) {
      return crearRespuestaJSON(registrarEnHoja(obtenerPayload(e)));
    }

    return crearRespuestaJSON({
      success: true,
      message: 'Google Sheets API activa',
      spreadsheetId: SPREADSHEET_ID
    });
  } catch (error) {
    return crearRespuestaJSON({ success: false, error: error.toString() });
  }
}

function configurarHojas() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  
  var hojas = {
    'CREACION': ['FECHA', 'TIPO', 'ID', 'TIPO DE FALLA', 'OBSERVACION', 'AGENTE'],
    'AVERIA': ['FECHA', 'PLATAFORMA', 'CATEGORIA', 'FORMULARIO', 'OBSERVACION', 'AGENTE'],
    'ATP': ['FECHA', 'TIPO', 'JIRA/FO', 'INCIDENCIA', 'OT', 'OBSERVACION', 'AGENTE'],
    'SERVICE NOW': ['FECHA', 'TIPO', 'SERVICE NOW', 'OBSERVACION', 'AGENTE']
  };
  
  for (var nombre in hojas) {
    var sheet = ss.getSheetByName(nombre);
    if (!sheet) {
      sheet = ss.insertSheet(nombre);
    }
    var titulos = hojas[nombre];
    sheet.getRange(1, 1, 1, titulos.length).setValues([titulos]);
    sheet.getRange(1, 1, 1, titulos.length)
      .setFontWeight('bold')
      .setBackground('#4CAF50')
      .setFontColor('#FFFFFF')
      .setHorizontalAlignment('center');
    for (var i = 1; i <= titulos.length; i++) {
      sheet.setColumnWidth(i, 150);
    }
    var obsIndex = titulos.indexOf('OBSERVACION') + 1;
    if (obsIndex > 0) sheet.setColumnWidth(obsIndex, 400);
  }
  
  Logger.log('Hojas configuradas exitosamente');
}
