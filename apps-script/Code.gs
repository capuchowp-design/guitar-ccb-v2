/** Google Apps Script — validação de códigos Pro de uso único por aparelho.
 * Planilha: aba Codigos, colunas A=codigo, B=usado, C=deviceId, D=data.
 */
const SHEET_ID = 'COLE_AQUI_O_ID_DA_PLANILHA';
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || '{}');
    const code = String(body.code || '').trim();
    const deviceId = String(body.deviceId || '').trim();
    if (!code || !deviceId) return out({ok:false,message:'Código e aparelho são obrigatórios.'});
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName('Codigos');
    if (!sheet) return out({ok:false,message:'Aba Codigos não encontrada.'});
    const rows = sheet.getDataRange().getValues();
    for (let i=1;i<rows.length;i++) {
      if (String(rows[i][0]).trim() === code) {
        if (rows[i][1] === true || rows[i][1] === 'SIM') {
          if (String(rows[i][2]) === deviceId) return out({ok:true,message:'Já ativado neste aparelho.'});
          return out({ok:false,message:'Código já utilizado.'});
        }
        sheet.getRange(i+1,2,1,3).setValues([['SIM',deviceId,new Date()]]);
        return out({ok:true});
      }
    }
    return out({ok:false,message:'Código inválido.'});
  } catch(err) { return out({ok:false,message:String(err)}); }
}
function out(data) { return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON); }
