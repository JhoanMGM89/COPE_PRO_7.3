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
    
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var row = headers.map(function(header) {
      return data[header] || '';
    });
    
    sheet.appendRow(row);
    
    return ContentService.createTextOutput(JSON.stringify({success: true, sheet: sheetName}))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch(error) {
    return ContentService.createTextOutput(JSON.stringify({error: error.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  if (e && e.parameter && e.parameter.payload) {
    try {
      var body = JSON.parse(decodeURIComponent(e.parameter.payload));
      var sheetName = body.sheet;
      var data = body.data;
      
      var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
      var sheet = ss.getSheetByName(sheetName);
      
      if (!sheet) {
        return ContentService.createTextOutput(JSON.stringify({error: 'Hoja no encontrada'}))
          .setMimeType(ContentService.MimeType.JSON);
      }
      
      var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      var row = headers.map(function(header) { return data[header] || ''; });
      sheet.appendRow(row);
      
      return ContentService.createTextOutput(JSON.stringify({success: true}))
        .setMimeType(ContentService.MimeType.JSON);
    } catch(err) {
      return ContentService.createTextOutput(JSON.stringify({error: err.toString()}))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }
  return ContentService.createTextOutput('Google Sheets API activa')
    .setMimeType(ContentService.MimeType.TEXT);
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
