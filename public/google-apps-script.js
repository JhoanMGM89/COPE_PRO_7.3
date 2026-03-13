// ============================================
// GOOGLE APPS SCRIPT - CÓDIGO PARA GOOGLE SHEETS
// ============================================
// INSTRUCCIONES:
// 1. Crear una hoja de cálculo en Google Sheets
// 2. Crear 4 hojas con los nombres: CREACION, AVERIA, ATP, SERVICE NOW
// 3. En cada hoja, agregar los títulos en la fila 1:
//    - CREACION: FECHA | TIPO | ID | TIPO DE FALLA | OBSERVACION | AGENTE
//    - AVERIA: AVERIA | PLATAFORMA | CATEGORIA | FORMULARIO | OBSERVACION | AGENTE
//    - ATP: FECHA | TIPO | JIRA/FO | INCIDENCIA | OT | OBSERVACION | AGENTE
//    - SERVICE NOW: FECHA | TIPO | SERVICE NOW | OBSERVACION | AGENTE
// 4. Ir a Extensiones > Apps Script
// 5. Pegar este código y guardar
// 6. Desplegar > Nueva implementación > Aplicación web
//    - Ejecutar como: YO
//    - Quién tiene acceso: CUALQUIERA
// 7. Copiar la URL del Web App y pegarla en la configuración de Google Sheets
//    en la pantalla de bienvenida del generador.

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var sheetName = body.sheet;
    var data = body.data;
    
    var ss = SpreadsheetApp.getActiveSpreadsheet();
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
  return ContentService.createTextOutput('Google Sheets API activa')
    .setMimeType(ContentService.MimeType.TEXT);
}
