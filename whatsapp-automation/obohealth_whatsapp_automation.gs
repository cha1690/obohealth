/**
 * OBO Health — WhatsApp lead automation
 *
 * Expects a sheet tab named "Leads" with header row:
 * Phone Number | Name | Date Added | Source | Status | Last Attempt | Error | Language
 *
 * Language column accepts: English, Hindi, Marathi (blank defaults to English).
 * Each maps to its own approved template — see the TEMPLATES map below.
 *
 * Setup (do this once):
 * 1. Paste this whole file into Extensions > Apps Script (replace the default code).
 * 2. File > Project Settings > Script Properties, add:
 *      WHATSAPP_TOKEN    = <your permanent System User token>
 *      PHONE_NUMBER_ID   = 1323178367550453
 *      FORM_SECRET       = <a random string you make up — must match CALLBACK_FORM_SECRET in js/main.js>
 * 3. Run createOnEditTrigger() once from the editor (select it in the function
 *    dropdown, click Run). Approve the permissions prompt when Google asks
 *    ("Advanced" > "Go to project (unsafe)" is expected and safe for your own script).
 * 4. To let the website's contact form add leads automatically: Deploy > New
 *    deployment > type "Web app" > Execute as "Me" > Who has access "Anyone".
 *    Copy the resulting URL (ends in /exec) into CALLBACK_ENDPOINT in js/main.js,
 *    and copy the same FORM_SECRET value into CALLBACK_FORM_SECRET there too.
 */

var COL = {
  PHONE: 1,
  NAME: 2,
  DATE_ADDED: 3,
  SOURCE: 4,
  STATUS: 5,
  LAST_ATTEMPT: 6,
  ERROR: 7,
  LANGUAGE: 8
};

var HEADER_ROW = 1;
var SHEET_NAME = 'Leads';

/** Maps the sheet's Language column to the matching approved template. */
var TEMPLATES = {
  'English': { name: 'clinic_intro', lang: 'en' },
  'Hindi': { name: 'clinic_intro_hi', lang: 'hi' },
  'Marathi': { name: 'clinic_intro_mr', lang: 'mr' }
};
var DEFAULT_LANGUAGE = 'English';

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('WhatsApp Automation')
    .addItem('Process all pending rows', 'processAllPending')
    .addItem('Set up trigger (run once)', 'createOnEditTrigger')
    .addToUi();
}

/**
 * Installable trigger handler — fires on any edit to the sheet.
 * Wired up by createOnEditTrigger(), not by Apps Script's simple onEdit,
 * because UrlFetchApp calls need full authorization.
 */
function onEditInstalled(e) {
  if (!e || !e.range) return;
  var sheet = e.range.getSheet();
  if (sheet.getName() !== SHEET_NAME) return;

  var editedRow = e.range.getRow();
  var numRows = e.range.getNumRows();

  for (var r = editedRow; r < editedRow + numRows; r++) {
    if (r > HEADER_ROW) processRow(sheet, r);
  }
}

/** Manual fallback: processes every pending row in the sheet. */
function processAllPending() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) {
    SpreadsheetApp.getUi().alert('No sheet tab named "' + SHEET_NAME + '" found.');
    return;
  }
  var lastRow = sheet.getLastRow();
  for (var r = HEADER_ROW + 1; r <= lastRow; r++) {
    processRow(sheet, r);
    Utilities.sleep(300); // gentle pacing for bulk sends
  }
  Logger.log('Done processing rows 2 through ' + lastRow + '.');
}

/** Registers the installable onEdit trigger. Run this once manually. */
function createOnEditTrigger() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'onEditInstalled') {
      ScriptApp.deleteTrigger(t);
    }
  });
  ScriptApp.newTrigger('onEditInstalled')
    .forSpreadsheet(ss)
    .onEdit()
    .create();
  Logger.log('Trigger installed.');
}

/** Core logic for a single row: validates, sends if pending, writes back status. */
function processRow(sheet, row) {
  if (row <= HEADER_ROW) return;

  var status = sheet.getRange(row, COL.STATUS).getValue();
  if (status) return; // already Sent or Failed — never re-send automatically

  var rawPhone = sheet.getRange(row, COL.PHONE).getValue();
  if (!rawPhone) return; // nothing entered yet

  var name = sheet.getRange(row, COL.NAME).getValue() || '';
  var languageLabel = sheet.getRange(row, COL.LANGUAGE).getValue() || DEFAULT_LANGUAGE;
  var template = TEMPLATES[languageLabel] || TEMPLATES[DEFAULT_LANGUAGE];
  var normalized = normalizePhoneNumber(rawPhone);
  var now = new Date();

  if (!normalized) {
    sheet.getRange(row, COL.STATUS).setValue('Failed');
    sheet.getRange(row, COL.ERROR).setValue('Invalid phone number');
    sheet.getRange(row, COL.LAST_ATTEMPT).setValue(now);
    return;
  }

  var result = sendTemplateMessage(normalized, name, template.name, template.lang);

  sheet.getRange(row, COL.LAST_ATTEMPT).setValue(now);
  if (result.success) {
    sheet.getRange(row, COL.STATUS).setValue('Sent');
    sheet.getRange(row, COL.ERROR).setValue('');
  } else {
    sheet.getRange(row, COL.STATUS).setValue('Failed');
    sheet.getRange(row, COL.ERROR).setValue(result.error);
  }
}

/**
 * Web app entry point — receives leads from the website's "Request a callback"
 * form. Deploy this project as a Web app (see setup notes at the top) to get
 * the URL that js/main.js posts to.
 */
function doPost(e) {
  var result;
  try {
    var data = JSON.parse(e.postData.contents);
    result = handleFormSubmission(data);
  } catch (err) {
    result = { success: false, error: err.message };
  }
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

/** Validates and appends a website-submitted lead, then sends immediately. */
function handleFormSubmission(data) {
  var props = PropertiesService.getScriptProperties();
  var expectedSecret = props.getProperty('FORM_SECRET');
  if (!expectedSecret || !data || data.secret !== expectedSecret) {
    return { success: false, error: 'Invalid request' };
  }

  var name = String(data.name || '').trim();
  var rawPhone = String(data.phone || '').trim();
  var languageLabel = TEMPLATES[data.language] ? data.language : DEFAULT_LANGUAGE;
  var normalized = normalizePhoneNumber(rawPhone);

  if (!name || !normalized) {
    return { success: false, error: 'Missing or invalid name/phone' };
  }

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) {
    return { success: false, error: 'Sheet "' + SHEET_NAME + '" not found' };
  }

  // Skip if this number is already in the sheet, so a repeat form submission
  // (e.g. a double click) doesn't create a duplicate row or re-send.
  var lastRow = sheet.getLastRow();
  if (lastRow > HEADER_ROW) {
    var existingPhones = sheet.getRange(HEADER_ROW + 1, COL.PHONE, lastRow - HEADER_ROW).getValues();
    for (var i = 0; i < existingPhones.length; i++) {
      if (normalizePhoneNumber(existingPhones[i][0]) === normalized) {
        return { success: true, note: 'Already in sheet' };
      }
    }
  }

  var newRow = lastRow + 1;
  sheet.getRange(newRow, COL.PHONE).setValue(rawPhone);
  sheet.getRange(newRow, COL.NAME).setValue(name);
  sheet.getRange(newRow, COL.DATE_ADDED).setValue(new Date());
  sheet.getRange(newRow, COL.SOURCE).setValue('Website contact form');
  sheet.getRange(newRow, COL.LANGUAGE).setValue(languageLabel);

  processRow(sheet, newRow);

  return { success: true };
}

/** Normalizes an Indian mobile number to the digits-only format the API expects (e.g. 919220660898). */
function normalizePhoneNumber(raw) {
  var digits = String(raw).replace(/\D/g, '');

  if (digits.length === 10) {
    digits = '91' + digits;
  } else if (digits.length === 11 && digits.charAt(0) === '0') {
    digits = '91' + digits.substring(1);
  } else if (digits.length === 13 && digits.substring(0, 3) === '091') {
    digits = digits.substring(1);
  }

  if (digits.length !== 12 || digits.substring(0, 2) !== '91') {
    return null;
  }
  return digits;
}

/** Sends the approved template message (by name + language) via the WhatsApp Cloud API. */
function sendTemplateMessage(toNumber, name, templateName, templateLang) {
  var props = PropertiesService.getScriptProperties();
  var token = props.getProperty('WHATSAPP_TOKEN');
  var phoneNumberId = props.getProperty('PHONE_NUMBER_ID');

  if (!token || !phoneNumberId) {
    return { success: false, error: 'Missing WHATSAPP_TOKEN or PHONE_NUMBER_ID in Script Properties' };
  }

  var url = 'https://graph.facebook.com/v21.0/' + phoneNumberId + '/messages';
  var payload = {
    messaging_product: 'whatsapp',
    to: toNumber,
    type: 'template',
    template: {
      name: templateName,
      language: { code: templateLang },
      components: [
        {
          type: 'body',
          parameters: [{ type: 'text', text: name || 'there' }]
        }
      ]
    }
  };

  var options = {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  var response = UrlFetchApp.fetch(url, options);
  var code = response.getResponseCode();
  var body = JSON.parse(response.getContentText());

  if (code === 200 && body.messages) {
    return { success: true };
  }
  return { success: false, error: body.error ? body.error.message : ('HTTP ' + code) };
}
