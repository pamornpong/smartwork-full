/* ------------------------------------------------------
   SMARTWORK – Google Apps Script (Final)
   Host: pamornpong.sakda@gmail.com
--------------------------------------------------------- */

// ★★ ผูกกับ Google Drive / Sheet ของพี่ ★★
const ROOT_FOLDER_ID = "1jiQYfji-VlLhLmyEsk1MN0K7dTlW19cQ";
const IMAGES_FOLDER_ID = "1hZv_-rMStHjNOYgD1fxa7KqGa6E6ZKqE";
const THUMBS_FOLDER_ID = "1hL70G39OksyVu42aSkjA0hbY-7yeGIA3"; // ยังไม่ได้ใช้ แต่เผื่อเวอร์ชันต่อไป
const SPREADSHEET_ID = "1q51m8sRIGUTh_tFmLUgLMPDQf9YXFUwIJMF6VV5VEJM";
const SHEET_NAME = "portfolio_data";

/**
 * Web App Entry – GET
 * 1) ไม่ใส่พารามิเตอร์ → ส่ง JSON ข้อมูลผลงานทั้งหมด (index.html ใช้)
 * 2) ?mode=image&id=FILE_ID → ส่งรูปจาก Drive โดยตรง (Image Proxy)
 */
function doGet(e) {
  const params = e.parameter || {};

  if (params.mode === "image" && params.id) {
    try {
      const file = DriveApp.getFileById(params.id);
      const blob = file.getBlob();
      return ContentService.createBinaryOutput()
        .setContent(blob.getBytes())
        .setMimeType(blob.getContentType());
    } catch (err) {
      return ContentService.createTextOutput("Not Found").setMimeType(
        ContentService.MimeType.TEXT
      );
    }
  }

  // ---- ส่ง JSON ข้อมูล ----
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    return ContentService.createTextOutput(
      JSON.stringify({ error: "Sheet not found: " + SHEET_NAME })
    ).setMimeType(ContentService.MimeType.JSON);
  }

  const values = sheet.getDataRange().getValues();
  const data = [];

  // URL ของ Web App (ใช้สร้างลิงก์รูป proxy)
  const baseUrl = ScriptApp.getService().getUrl();

  for (let i = 1; i < values.length; i++) {
    const r = values[i];
    let picIds = [];
    try {
      picIds = r[8] ? JSON.parse(r[8]) : [];
    } catch (err) {
      picIds = [];
    }

    const picUrls = picIds.map(function (id) {
      return baseUrl + "?mode=image&id=" + encodeURIComponent(id);
    });

    data.push({
      name: r[0] || "",
      pos: r[1] || "",
      unit: r[2] || "",
      workDate: r[3] || "",
      title: r[4] || "",
      detail: r[5] || "",
      indicator: r[6] || "",
      url: r[7] || "",
      pics: picUrls,
      timestamp: r[9] || "",
      district: r[10] || "",
    });
  }

  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(
    ContentService.MimeType.JSON
  );
}

/**
 * Web App Entry – POST
 * รับข้อมูลจาก form.html → บันทึกลง Sheet + Upload รูปขึ้น Drive
 * รูปจะเก็บเฉพาะ fileId แล้วใช้ Proxy เสิร์ฟรูปภายหลัง
 */
function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) throw new Error("Sheet not found: " + SHEET_NAME);

    const imgFolder = DriveApp.getFolderById(IMAGES_FOLDER_ID);

    const name = payload.name || "";
    const pos = payload.pos || "";
    const unit = payload.unit || "";
    const district = payload.district || "";
    const workDate = payload.workDate || "";
    const title = payload.title || "";
    const detail = payload.detail || "";
    const indicator = payload.indicator || "";
    const url = payload.url || "";
    const picsBase64 = payload.pics || [];

    const savedIds = [];

    picsBase64.forEach(function (b64, index) {
      if (!b64) return;
      const base64String = b64.split(",")[1]; // ตัด prefix data:image/jpeg;base64,
      const bytes = Utilities.base64Decode(base64String);
      const contentType = "image/jpeg";

      const safeTitle = (title || "work")
        .substring(0, 40)
        .replace(/[\\/:*?"<>|]/g, "_");

      const fileName =
        (workDate || "nodate") + "_" + safeTitle + "_" + (index + 1) + ".jpg";
      const file = imgFolder.createFile(bytes, fileName, contentType);
      savedIds.push(file.getId());
    });

    const timestamp = Utilities.formatDate(
      new Date(),
      "Asia/Bangkok",
      "yyyy-MM-dd HH:mm:ss"
    );

    sheet.appendRow([
      name,
      pos,
      unit,
      workDate,
      title,
      detail,
      indicator,
      url,
      JSON.stringify(savedIds),
      timestamp,
      district,
    ]);

    // คืนค่ากลับไป เผื่อฝั่ง form ต้องใช้
    return ContentService.createTextOutput(
      JSON.stringify({ status: "OK", pics: savedIds })
    ).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(
      JSON.stringify({ status: "ERROR", message: err.message })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}
