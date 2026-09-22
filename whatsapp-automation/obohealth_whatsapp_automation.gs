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
 *
 * Booking page (book/index.html) uses the same deployment and secret. It reads
 * open slots via GET ?action=slots&date=YYYY-MM-DD and books via POST with
 * action: "book". Bookings are logged to a second tab named "Bookings" and
 * create a real event on this account's default Google Calendar (checked for
 * conflicts before booking, so slots can't double-book).
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

/** Booking confirmation templates — separate from the intro templates above. */
var BOOKING_TEMPLATES = {
  'English': { name: 'booking_held', lang: 'en' },
  'Hindi': { name: 'booking_held_hi', lang: 'hi' },
  'Marathi': { name: 'booking_held_mr', lang: 'mr' }
};

var BOOKING_SHEET_NAME = 'Bookings';
var BOOKING_COL = {
  PHONE: 1,
  NAME: 2,
  DATE: 3,
  TIME: 4,
  STATUS: 5,
  LANGUAGE: 6,
  CREATED_AT: 7
};

// Business hours for the booking page — Mon–Fri, 30-minute slots.
var BUSINESS_START_MINUTES = 10 * 60 + 30; // 10:30
var BUSINESS_END_MINUTES = 15 * 60 + 30;   // 15:30 (last slot starts 15:00)
var SLOT_LENGTH_MINUTES = 30;

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

  var result = sendTemplateMessage(normalized, template.name, template.lang, [name || 'there']);

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
 * form, and booking requests from book/index.html. Deploy this project as a
 * Web app (see setup notes at the top) to get the URL both pages post to.
 */
function doPost(e) {
  var result;
  try {
    var data = JSON.parse(e.postData.contents);
    result = data.action === 'book' ? handleBookingSubmission(data) : handleFormSubmission(data);
  } catch (err) {
    result = { success: false, error: err.message };
  }
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

/** Web app GET entry point — used by book/index.html to fetch open slots for a date. */
function doGet(e) {
  var result;
  try {
    if (e.parameter.action === 'slots' && e.parameter.date) {
      result = { success: true, slots: getAvailableSlots(e.parameter.date) };
    } else {
      result = { success: false, error: 'Unknown request' };
    }
  } catch (err) {
    result = { success: false, error: err.message };
  }
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

/** Returns available "HH:MM" slot strings for a given YYYY-MM-DD date. */
function getAvailableSlots(dateStr) {
  var date = parseDateOnly(dateStr);
  if (!date) return [];

  var day = date.getDay(); // 0 = Sunday
  if (day === 0 || day === 6) return []; // weekends closed

  var calendar = CalendarApp.getDefaultCalendar();
  var now = new Date();
  var slots = [];

  for (var minutes = BUSINESS_START_MINUTES; minutes < BUSINESS_END_MINUTES; minutes += SLOT_LENGTH_MINUTES) {
    var start = new Date(date.getTime());
    start.setHours(0, minutes, 0, 0);
    var end = new Date(start.getTime() + SLOT_LENGTH_MINUTES * 60 * 1000);

    if (start <= now) continue; // don't offer past slots, including "today, earlier today"

    var conflicts = calendar.getEvents(start, end);
    if (conflicts.length === 0) {
      slots.push(formatTime(start));
    }
  }
  return slots;
}

/** Validates a booking request, creates the Calendar event, logs it, and sends the WhatsApp confirmation. */
function handleBookingSubmission(data) {
  var props = PropertiesService.getScriptProperties();
  var expectedSecret = props.getProperty('FORM_SECRET');
  if (!expectedSecret || !data || data.secret !== expectedSecret) {
    return { success: false, error: 'Invalid request' };
  }

  var name = String(data.name || '').trim();
  var rawPhone = String(data.phone || '').trim();
  var dateStr = String(data.date || '').trim();
  var timeStr = String(data.time || '').trim();
  var languageLabel = BOOKING_TEMPLATES[data.language] ? data.language : DEFAULT_LANGUAGE;
  var normalized = normalizePhoneNumber(rawPhone);

  if (!name || !normalized || !dateStr || !/^\d{2}:\d{2}$/.test(timeStr)) {
    return { success: false, error: 'Missing or invalid booking details' };
  }

  var date = parseDateOnly(dateStr);
  if (!date) return { success: false, error: 'Invalid date' };

  var hh = Number(timeStr.substring(0, 2));
  var mm = Number(timeStr.substring(3, 5));
  var start = new Date(date.getTime());
  start.setHours(hh, mm, 0, 0);
  var end = new Date(start.getTime() + SLOT_LENGTH_MINUTES * 60 * 1000);

  if (start <= new Date()) {
    return { success: false, error: 'That slot is in the past' };
  }

  // Re-check for conflicts right before booking, in case two people picked
  // the same slot at nearly the same time.
  var calendar = CalendarApp.getDefaultCalendar();
  if (calendar.getEvents(start, end).length > 0) {
    return { success: false, error: 'That slot was just taken — please pick another' };
  }

  calendar.createEvent('OBO Health — ' + name, start, end, {
    description: 'Booked via website. Phone: ' + rawPhone
  });

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(BOOKING_SHEET_NAME);
  if (sheet) {
    var newRow = sheet.getLastRow() + 1;
    sheet.getRange(newRow, BOOKING_COL.PHONE).setValue(rawPhone);
    sheet.getRange(newRow, BOOKING_COL.NAME).setValue(name);
    sheet.getRange(newRow, BOOKING_COL.DATE).setValue(dateStr);
    sheet.getRange(newRow, BOOKING_COL.TIME).setValue(timeStr);
    sheet.getRange(newRow, BOOKING_COL.STATUS).setValue('Held');
    sheet.getRange(newRow, BOOKING_COL.LANGUAGE).setValue(languageLabel);
    sheet.getRange(newRow, BOOKING_COL.CREATED_AT).setValue(new Date());
  }

  var template = BOOKING_TEMPLATES[languageLabel];
  var result = sendTemplateMessage(normalized, template.name, template.lang, [name, formatDate(date), timeStr]);

  return { success: true, messageSent: result.success };
}

/** Parses a "YYYY-MM-DD" string as a local-timezone date at midnight, or null if invalid. */
function parseDateOnly(dateStr) {
  var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!match) return null;
  var date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return isNaN(date.getTime()) ? null : date;
}

function formatTime(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'HH:mm');
}

function formatDate(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'EEE, d MMM yyyy');
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

/**
 * Sends an approved template message via the WhatsApp Cloud API.
 * bodyParams is an ordered array of strings filling the template's {{1}}, {{2}}, ...
 */
function sendTemplateMessage(toNumber, templateName, templateLang, bodyParams) {
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
          parameters: (bodyParams || []).map(function (p) { return { type: 'text', text: p }; })
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
