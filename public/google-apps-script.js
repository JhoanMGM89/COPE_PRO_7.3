// ============================================
// GOOGLE APPS SCRIPT - CÓDIGO PARA GOOGLE SHEETS
// BY JHOAN GORDON
// ============================================
// INSTRUCCIONES:
// 1. Abrir la hoja de cálculo: https://docs.google.com/spreadsheets/d/1hiIsu-gXkzGoyYcvRsSZmIg35Dv36YrAE6S1jDLMPlQ/edit
// 2. Verificar que existan las hojas: CREACION, AVERIA, ATP, SERVICE NOW
// 3. En cada hoja, verificar los títulos en la fila 1:
//    - CREACION: FECHA | TIPO | ID | TIPO DE FALLA | OBSERVACION | AGENTE
//    - AVERIA: AVERIA | PLATAFORMA | CATEGORIA | FORMULARIO | OBSERVACION | AGENTE
//    - ATP: FECHA | TIPO | JIRA/FO | INCIDENCIA | OT | OBSERVACION | AGENTE
//    - SERVICE NOW: FECHA | TIPO | SERVICE NOW | OBSERVACION | AGENTE
// 4. Ir a Extensiones > Apps Script
// 5. Pegar este código y guardar
// 6. Desplegar > Nueva implementación > Aplicación web
//    - Ejecutar como: YO
//    - Quién tiene acceso: CUALQUIERA
// 7. Copiar la URL del Web App desplegada
// 8. Pegar esa URL en la variable GOOGLE_SHEETS_URL de cada archivo HTML:
//    - GENERADOR_DE_PLANTILLAS.html
//    - AVERIAS.html
//    - ATP.html
//    - SERVICE_NOW.html
//    Buscar: var GOOGLE_SHEETS_URL = '';
//    Reemplazar por: var GOOGLE_SHEETS_URL = 'https://script.google.com/macros/s/TU_ID_AQUI/exec';

// ID de la hoja de cálculo específica
var SPREADSHEET_ID = '1hiIsu-gXkzGoyYcvRsSZmIg35Dv36YrAE6S1jDLMPlQ';

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var sheetName = body.sheet;
    var data = body.data;
    
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify({error: 'Hoja no encontrada: ' + sheetName}))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // Obtener los títulos de la primera fila
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    
    // Crear fila de datos en el orden de los títulos
    var row = headers.map(function(header) {
      return data[header] || '';
    });
    
    // Agregar la fila al final
    sheet.appendRow(row);
    
    return ContentService.createTextOutput(JSON.stringify({success: true}))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch(error) {
    return ContentService.createTextOutput(JSON.stringify({error: error.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput('Google Sheets API activa - REGISTRO DE PLANTILLAS')
    .setMimeType(ContentService.MimeType.TEXT);
}

// Función para crear las hojas y títulos automáticamente (ejecutar una sola vez)
function configurarHojas() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  
  var hojas = {
    'CREACION': ['FECHA', 'TIPO', 'ID', 'TIPO DE FALLA', 'OBSERVACION', 'AGENTE'],
    'AVERIA': ['AVERIA', 'PLATAFORMA', 'CATEGORIA', 'FORMULARIO', 'OBSERVACION', 'AGENTE'],
    'ATP': ['FECHA', 'TIPO', 'JIRA/FO', 'INCIDENCIA', 'OT', 'OBSERVACION', 'AGENTE'],
    'SERVICE NOW': ['FECHA', 'TIPO', 'SERVICE NOW', 'OBSERVACION', 'AGENTE']
  };
  
  for (var nombre in hojas) {
    var sheet = ss.getSheetByName(nombre);
    if (!sheet) {
      sheet = ss.insertSheet(nombre);
    }
    // Escribir títulos en fila 1
    var titulos = hojas[nombre];
    sheet.getRange(1, 1, 1, titulos.length).setValues([titulos]);
    // Formato de títulos
    sheet.getRange(1, 1, 1, titulos.length)
      .setFontWeight('bold')
      .setBackground('#4CAF50')
      .setFontColor('#FFFFFF')
      .setHorizontalAlignment('center');
    // Ajustar ancho de columnas
    for (var i = 1; i <= titulos.length; i++) {
      sheet.setColumnWidth(i, 150);
    }
    // Columna OBSERVACION más ancha
    var obsIndex = titulos.indexOf('OBSERVACION') + 1;
    if (obsIndex > 0) sheet.setColumnWidth(obsIndex, 400);
  }
  
  Logger.log('Hojas configuradas exitosamente');
}
