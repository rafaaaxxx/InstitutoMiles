const CONFIG = {
  SPREADSHEET_ID: '1MSYMUrKm-Z9jnmCrXd8zwpJrlzmA_2bpE8NZAMAXwH0',
  WEB_APP_URL: 'https://script.google.com/macros/s/AKfycbyfPc6rxXnnf5RaofztEh9P03wmhRkC9D4Lzf0yNUrm--64uRzA9uMUMoHakhGY9Yto/exec',
  TOKEN_TTL_MINUTES: 60,
  PLAYER_MODE: 'youtube',
  WATCH_PERCENT_REQUIRED: 0.95,
  LOGO_URL: 'https://drive.google.com/thumbnail?id=1PnPcVnYXnhetQ6-ax8iIBBxK8aK7L_ZQ&sz=w900',
  ORGANIZATION_NAME: 'Instituto MILES',
  PRIVACY_CONTACT_EMAIL: 'privacidade@exemplo.com',
  CERTIFICATE_TEMPLATE_DOC_ID: '1BtHsvxpLrOC-Si2REoftyldV_Gb1s90Ys8XFdWYIqeg',
  CERTIFICATE_OUTPUT_FOLDER_ID: '1KtzhYP7pGJ3XqHfnt5Je_CptDHTnG-dk',
  CERTIFICATE_REQUIRED_LESSONS: 3,
  SHARE_CERTIFICATE_WITH_LINK: true,
  LESSONS: [
    {
      id: 'aula-1',
      title: 'Aula 1 - Introdução',
      description: 'Assista a aula introdutória do Miles Membership',
      youtubeVideoId: 'r48W0BJHYpg',
      durationLabel: '13:33',
      watchSecondsBeforeQr: 813
    },
    {
      id: 'aula-2',
      title: 'Aula 2 - Conhecimento',
      description: 'Descubra as competências do empreendedor',
      youtubeVideoId: 'gCvXH4J7dOw',
      durationLabel: '07:05',
      watchSecondsBeforeQr: 425
    },
    {
      id: 'aula-3',
      title: 'Aula 3 - Inovação',
      description: 'Descubra mais sobre o significado de inovação',
      youtubeVideoId: 'f4nH93q8zV4',
      durationLabel: '14:28',
      watchSecondsBeforeQr: 868
    },
    {
      id: 'aula-4',
      title: 'Aula 4 - Tomada de decisão',
      description: 'Em nossa última aula, entenda a importância da tomada de decisão.',
      youtubeVideoId: 'ZCYpyVTg7HM',
      durationLabel: '10:48',
      watchSecondsBeforeQr: 648
    }
  ]
};

const LESSONS_BY_ID = CONFIG.LESSONS.reduce(function(index, lesson) {
  index[lesson.id] = lesson;
  return index;
}, {});

const SHEETS = {
  ATTENDANCE: 'Presen\u00e7as',
  TOKENS: 'Tokens',
  CERTIFICATES: 'Certificados'
};

const HEADERS = {
  ATTENDANCE: [
    'data_hora',
    'aula_id',
    'aula_titulo',
    'cpf',
    'nome_completo',
    'email',
    'lgpd_aceite',
    'token',
    'user_agent'
  ],
  TOKENS: [
    'token',
    'aula_id',
    'aula_titulo',
    'criado_em',
    'expira_em',
    'usado',
    'usado_em'
  ],
  CERTIFICATES: [
    'data_hora',
    'cpf',
    'nome_completo',
    'aulas_concluidas',
    'documento_url',
    'pdf_url'
  ]
};

function doGet(e) {
  const action = e && e.parameter ? String(e.parameter.action || '') : '';
  if (action) {
    return handleApiGet_(e);
  }

  const token = e && e.parameter ? String(e.parameter.token || '') : '';
  if (token) {
    setupSpreadsheet();
    return renderHtml_('Register', {
      appTitle: 'Registro de presen\u00e7a',
      token: token,
      organizationName: CONFIG.ORGANIZATION_NAME,
      privacyContactEmail: CONFIG.PRIVACY_CONTACT_EMAIL,
      logoUrl: CONFIG.LOGO_URL,
      initialValidation: getTokenStatus_(token)
    });
  }

  return ContentService
    .createTextOutput(JSON.stringify({
      ok: true,
      message: 'Backend do Instituto MILES ativo.'
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

function handleApiGet_(e) {
  const action = normalizeActionName_(e.parameter.action);

  try {
    if (action === 'createAttendanceToken') {
      return makeApiResponse_(e, createAttendanceToken(e.parameter.lessonId));
    }

    if (action === 'createCertificate') {
      return makeApiResponse_(e, createCertificate({
        cpf: e.parameter.cpf
      }));
    }

    if (action === 'getCertificateProgress') {
      return makeApiResponse_(e, getCertificateProgress({
        cpf: e.parameter.cpf
      }));
    }

    if (action === 'getPublicConfig') {
      return makeApiResponse_(e, {
        ok: true,
        lessons: getPublicLessons_(),
        tokenTtlMinutes: CONFIG.TOKEN_TTL_MINUTES,
        organizationName: CONFIG.ORGANIZATION_NAME,
        logoUrl: CONFIG.LOGO_URL,
        certificateRequiredLessons: CONFIG.CERTIFICATE_REQUIRED_LESSONS
      });
    }

    throw new Error('A\u00e7\u00e3o n\u00e3o encontrada: ' + action + '.');
  } catch (error) {
    return makeApiResponse_(e, {
      ok: false,
      message: error.message || 'N\u00e3o foi poss\u00edvel concluir a solicita\u00e7\u00e3o.'
    });
  }
}

function normalizeActionName_(action) {
  const normalizedAction = String(action || '').trim();
  const aliases = {
    progress: 'getCertificateProgress',
    getProgress: 'getCertificateProgress',
    certificateProgress: 'getCertificateProgress',
    getCertificadoProgresso: 'getCertificateProgress',
    emitirCertificado: 'createCertificate',
    certificado: 'createCertificate',
    aulas: 'getPublicConfig',
    config: 'getPublicConfig'
  };

  return aliases[normalizedAction] || normalizedAction;
}

function makeApiResponse_(e, payload) {
  const callback = sanitizeCallback_(e && e.parameter ? e.parameter.callback : '');
  const body = JSON.stringify(payload);

  if (callback) {
    return ContentService
      .createTextOutput(callback + '(' + body + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return ContentService
    .createTextOutput(body)
    .setMimeType(ContentService.MimeType.JSON);
}

function sanitizeCallback_(callback) {
  callback = String(callback || '').trim();
  if (/^[A-Za-z_$][0-9A-Za-z_$]*(\.[A-Za-z_$][0-9A-Za-z_$]*)*$/.test(callback)) {
    return callback;
  }

  return '';
}

function setupSpreadsheet() {
  const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const attendanceSheet = ensureSheet_(spreadsheet, SHEETS.ATTENDANCE, HEADERS.ATTENDANCE);
  ensureSheet_(spreadsheet, SHEETS.TOKENS, HEADERS.TOKENS);
  const certificatesSheet = ensureSheet_(spreadsheet, SHEETS.CERTIFICATES, HEADERS.CERTIFICATES);

  formatTextColumns_(attendanceSheet, [4]);
  formatTextColumns_(certificatesSheet, [2]);
  repairCpfTextColumn_(attendanceSheet, 4);
  repairCpfTextColumn_(certificatesSheet, 2);
}

function createAttendanceToken(lessonId) {
  setupSpreadsheet();

  const lesson = getLessonById_(lessonId);
  if (!lesson) {
    throw new Error('Aula n\u00e3o encontrada.');
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + CONFIG.TOKEN_TTL_MINUTES * 60 * 1000);
  const token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');

  const sheet = getSheet_(SHEETS.TOKENS);
  sheet.appendRow([
    token,
    lesson.id,
    lesson.title,
    now,
    expiresAt,
    false,
    ''
  ]);

  const webAppUrl = getWebAppUrl_();
  if (!webAppUrl) {
    throw new Error('Publique o projeto como App da Web antes de gerar QR codes.');
  }

  const registrationUrl = webAppUrl + '?token=' + encodeURIComponent(token);
  return {
    ok: true,
    lessonId: lesson.id,
    lessonTitle: lesson.title,
    token: token,
    expiresAt: expiresAt.toISOString(),
    registrationUrl: registrationUrl,
    qrImageUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=12&data=' + encodeURIComponent(registrationUrl)
  };
}

function submitAttendance(payload) {
  setupSpreadsheet();

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const token = String(payload.token || '').trim();
    const cpf = normalizeSubmittedCpf_(payload.cpf);
    const fullName = normalizeText_(payload.fullName || '');
    const email = normalizeEmail_(payload.email || '');
    const lgpdAccepted = payload.lgpdAccepted === true || payload.lgpdAccepted === 'true';
    const userAgent = String(payload.userAgent || '').slice(0, 500);

    if (!token) {
      throw new Error('Token ausente.');
    }
    if (!isValidCpf_(cpf)) {
    throw new Error('CPF inv\u00e1lido.');
    }
    if (fullName.length < 5 || fullName.indexOf(' ') === -1) {
      throw new Error('Informe o nome completo.');
    }
    if (!isValidEmail_(email)) {
      throw new Error('Email inv\u00e1lido.');
    }
    if (!lgpdAccepted) {
      throw new Error('\u00c9 necess\u00e1rio confirmar ci\u00eancia sobre o tratamento dos dados pessoais.');
    }

    const tokenRecord = getTokenRecord_(token);
    if (!tokenRecord) {
      throw new Error('QR code inv\u00e1lido.');
    }
    if (String(tokenRecord.usado).toLowerCase() === 'true') {
      throw new Error('Este QR code j\u00e1 foi utilizado.');
    }

    const now = new Date();
    if (now.getTime() > new Date(tokenRecord.expira_em).getTime()) {
      throw new Error('Este QR code expirou.');
    }

    if (attendanceExists_(cpf, tokenRecord.aula_id)) {
      throw new Error('Este CPF j\u00e1 registrou presen\u00e7a nesta aula.');
    }

    const attendanceSheet = getSheet_(SHEETS.ATTENDANCE);
    appendRowWithTextColumns_(attendanceSheet, [
      now,
      tokenRecord.aula_id,
      tokenRecord.aula_titulo,
      cpf,
      fullName,
      email,
      true,
      token,
      userAgent
    ], [4]);

    const tokenSheet = getSheet_(SHEETS.TOKENS);
    tokenSheet.getRange(tokenRecord.row, 6).setValue(true);
    tokenSheet.getRange(tokenRecord.row, 7).setValue(now);

    return {
      ok: true,
      message: 'Presen\u00e7a registrada com sucesso.',
      lessonTitle: tokenRecord.aula_titulo
    };
  } finally {
    lock.releaseLock();
  }
}

function createCertificate(payload) {
  setupSpreadsheet();

  const cpf = normalizeSubmittedCpf_(payload && payload.cpf);
  if (!isValidCpf_(cpf)) {
    throw new Error('CPF inv\u00e1lido.');
  }

  if (!CONFIG.CERTIFICATE_TEMPLATE_DOC_ID || CONFIG.CERTIFICATE_TEMPLATE_DOC_ID.indexOf('COLE_AQUI') === 0) {
    throw new Error('Configure o ID do modelo do certificado em CERTIFICATE_TEMPLATE_DOC_ID.');
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const existingCertificate = getExistingCertificate_(cpf);
    if (existingCertificate) {
      return {
        ok: true,
        alreadyIssued: true,
        name: existingCertificate.name,
        cpf: formatCpf_(cpf),
        completedLessons: existingCertificate.completedLessons,
        requiredLessons: CONFIG.CERTIFICATE_REQUIRED_LESSONS,
        documentUrl: existingCertificate.documentUrl,
        pdfUrl: existingCertificate.pdfUrl,
        message: 'Certificado j\u00e1 emitido para este CPF.'
      };
    }

    const attendanceSummary = getAttendanceSummaryByCpf_(cpf);
    if (attendanceSummary.completedLessons < CONFIG.CERTIFICATE_REQUIRED_LESSONS) {
      return {
        ok: false,
        reason: 'INSUFFICIENT_ATTENDANCE',
        name: attendanceSummary.name,
        cpf: formatCpf_(cpf),
        completedLessons: attendanceSummary.completedLessons,
        requiredLessons: CONFIG.CERTIFICATE_REQUIRED_LESSONS,
        message: 'Este CPF possui presen\u00e7a em ' + attendanceSummary.completedLessons + ' de ' + CONFIG.CERTIFICATE_REQUIRED_LESSONS + ' aulas necess\u00e1rias para emitir o certificado.'
      };
    }

    const certificateName = sanitizeFileName_('Certificado - ' + attendanceSummary.name + ' - ' + formatCpf_(cpf));
    const certificateFile = copyCertificateTemplate_(certificateName);
    const document = DocumentApp.openById(certificateFile.getId());
    const body = document.getBody();
    const issueDate = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy');

    body.replaceText('\\{\\{NOME\\}\\}', attendanceSummary.name);
    body.replaceText('\\{\\{CPF\\}\\}', formatCpf_(cpf));
    body.replaceText('\\{\\{DATA\\}\\}', issueDate);
    body.replaceText('\\{\\{AULAS_CONCLUIDAS\\}\\}', String(attendanceSummary.completedLessons));
    document.saveAndClose();

    const pdfFile = createCertificatePdf_(certificateFile, certificateName);

    if (CONFIG.SHARE_CERTIFICATE_WITH_LINK) {
      certificateFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      pdfFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    }

    const documentUrl = certificateFile.getUrl();
    const pdfUrl = pdfFile.getUrl();
    appendRowWithTextColumns_(getSheet_(SHEETS.CERTIFICATES), [
      new Date(),
      cpf,
      attendanceSummary.name,
      attendanceSummary.completedLessons,
      documentUrl,
      pdfUrl
    ], [2]);

    return {
      ok: true,
      alreadyIssued: false,
      name: attendanceSummary.name,
      cpf: formatCpf_(cpf),
      completedLessons: attendanceSummary.completedLessons,
      requiredLessons: CONFIG.CERTIFICATE_REQUIRED_LESSONS,
      documentUrl: documentUrl,
      pdfUrl: pdfUrl,
      message: 'Certificado em PDF emitido com sucesso.'
    };
  } finally {
    lock.releaseLock();
  }
}

function getCertificateProgress(payload) {
  setupSpreadsheet();

  const cpf = normalizeSubmittedCpf_(payload && payload.cpf);
  if (!isValidCpf_(cpf)) {
    throw new Error('CPF inv\u00e1lido.');
  }

  const existingCertificate = getExistingCertificate_(cpf);
  if (existingCertificate) {
    return {
      ok: true,
      alreadyIssued: true,
      name: existingCertificate.name,
      cpf: formatCpf_(cpf),
      completedLessons: Number(existingCertificate.completedLessons || 0),
      requiredLessons: CONFIG.CERTIFICATE_REQUIRED_LESSONS,
      documentUrl: existingCertificate.documentUrl,
      pdfUrl: existingCertificate.pdfUrl,
      message: 'Certificado j\u00e1 emitido para este CPF.'
    };
  }

  const attendanceSummary = getAttendanceSummaryByCpf_(cpf);
  return {
    ok: attendanceSummary.completedLessons >= CONFIG.CERTIFICATE_REQUIRED_LESSONS,
    reason: attendanceSummary.completedLessons >= CONFIG.CERTIFICATE_REQUIRED_LESSONS ? 'READY' : 'INSUFFICIENT_ATTENDANCE',
    name: attendanceSummary.name,
    cpf: formatCpf_(cpf),
    completedLessons: Number(attendanceSummary.completedLessons || 0),
    requiredLessons: CONFIG.CERTIFICATE_REQUIRED_LESSONS,
    message: 'Este CPF possui presen\u00e7a em ' + Number(attendanceSummary.completedLessons || 0) + ' de ' + CONFIG.CERTIFICATE_REQUIRED_LESSONS + ' aulas necess\u00e1rias para emitir o certificado.'
  };
}

function getPublicLessons_() {
  return CONFIG.LESSONS.map(function(lesson) {
    return {
      id: lesson.id,
      title: lesson.title,
      description: lesson.description,
      durationLabel: lesson.durationLabel,
      playerMode: CONFIG.PLAYER_MODE,
      watchPercentRequired: Number(CONFIG.WATCH_PERCENT_REQUIRED || 0.95),
      youtubeVideoId: lesson.youtubeVideoId,
      watchSecondsBeforeQr: Number(lesson.watchSecondsBeforeQr || 60),
      videoUrl: buildDriveVideoUrl_(lesson.driveFileId),
      previewUrl: buildDrivePreviewUrl_(lesson.driveFileId)
    };
  });
}

function getAttendanceSummaryByCpf_(cpf) {
  const sheet = getSheet_(SHEETS.ATTENDANCE);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return {
      name: '',
      completedLessons: 0
    };
  }

  const rows = sheet.getRange(2, 1, lastRow - 1, HEADERS.ATTENDANCE.length).getValues();
  const studentRows = rows
    .map(function(row) {
      return {
        date: row[0],
        lessonId: String(row[1] || ''),
        lessonTitle: String(row[2] || ''),
        cpf: normalizeStoredCpf_(row[3]),
        name: normalizeText_(row[4] || ''),
        email: normalizeEmail_(row[5] || '')
      };
    })
    .filter(function(row) {
      return row.cpf === cpf;
    });

  if (!studentRows.length) {
    return {
      name: '',
      completedLessons: 0
    };
  }

  const completedLessonIds = {};
  studentRows.forEach(function(row) {
    completedLessonIds[row.lessonId] = true;
  });

  const firstLessonRow = studentRows.find(function(row) {
    return row.lessonId === 'aula-1';
  });
  const fallbackRow = studentRows.sort(function(a, b) {
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  })[0];

  return {
    name: normalizeText_((firstLessonRow || fallbackRow).name),
    completedLessons: Object.keys(completedLessonIds).length
  };
}

function getExistingCertificate_(cpf) {
  const sheet = getSheet_(SHEETS.CERTIFICATES);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return null;
  }

  const rows = sheet.getRange(2, 1, lastRow - 1, HEADERS.CERTIFICATES.length).getValues();
  for (let i = 0; i < rows.length; i++) {
    if (normalizeStoredCpf_(rows[i][1]) === cpf && (rows[i][4] || rows[i][5])) {
      return {
        name: normalizeText_(rows[i][2]),
        completedLessons: Number(rows[i][3] || 0),
        documentUrl: String(rows[i][4] || ''),
        pdfUrl: String(rows[i][5] || rows[i][4] || '')
      };
    }
  }

  return null;
}

function copyCertificateTemplate_(certificateName) {
  const templateFile = DriveApp.getFileById(CONFIG.CERTIFICATE_TEMPLATE_DOC_ID);
  const folderId = String(CONFIG.CERTIFICATE_OUTPUT_FOLDER_ID || '').trim();
  if (folderId) {
    return templateFile.makeCopy(certificateName, DriveApp.getFolderById(folderId));
  }

  return templateFile.makeCopy(certificateName);
}

function createCertificatePdf_(certificateFile, certificateName) {
  const pdfBlob = certificateFile
    .getAs(MimeType.PDF)
    .setName(certificateName + '.pdf');
  const folderId = String(CONFIG.CERTIFICATE_OUTPUT_FOLDER_ID || '').trim();
  if (folderId) {
    return DriveApp.getFolderById(folderId).createFile(pdfBlob);
  }

  return DriveApp.createFile(pdfBlob);
}

function getLessonById_(lessonId) {
  return LESSONS_BY_ID[String(lessonId || '')] || null;
}

function buildDriveVideoUrl_(fileId) {
  return 'https://drive.google.com/uc?export=download&id=' + encodeURIComponent(fileId);
}

function buildDrivePreviewUrl_(fileId) {
  return 'https://drive.google.com/file/d/' + encodeURIComponent(fileId) + '/preview';
}

function getWebAppUrl_() {
  const configuredUrl = String(CONFIG.WEB_APP_URL || '').trim();
  if (configuredUrl) {
    return configuredUrl.replace(/\?.*$/, '');
  }

  return ScriptApp.getService().getUrl();
}

function getTokenStatus_(token) {
  const record = getTokenRecord_(token);
  if (!record) {
    return {
      ok: false,
      message: 'QR code inv\u00e1lido.'
    };
  }

  if (String(record.usado).toLowerCase() === 'true') {
    return {
      ok: false,
      message: 'Este QR code j\u00e1 foi utilizado.'
    };
  }

  if (new Date().getTime() > new Date(record.expira_em).getTime()) {
    return {
      ok: false,
      message: 'Este QR code expirou.'
    };
  }

  return {
    ok: true,
    lessonId: record.aula_id,
    lessonTitle: record.aula_titulo,
    expiresAt: new Date(record.expira_em).toISOString()
  };
}

function getTokenRecord_(token) {
  const sheet = getSheet_(SHEETS.TOKENS);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) {
    return null;
  }

  for (let rowIndex = 1; rowIndex < values.length; rowIndex++) {
    if (String(values[rowIndex][0]) === token) {
      return {
        row: rowIndex + 1,
        token: values[rowIndex][0],
        aula_id: values[rowIndex][1],
        aula_titulo: values[rowIndex][2],
        criado_em: values[rowIndex][3],
        expira_em: values[rowIndex][4],
        usado: values[rowIndex][5],
        usado_em: values[rowIndex][6]
      };
    }
  }

  return null;
}

function attendanceExists_(cpf, lessonId) {
  const sheet = getSheet_(SHEETS.ATTENDANCE);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return false;
  }

  const rows = sheet.getRange(2, 1, lastRow - 1, HEADERS.ATTENDANCE.length).getValues();
  return rows.some(function(row) {
    return String(row[1]) === String(lessonId) && normalizeStoredCpf_(row[3]) === cpf;
  });
}

function normalizeCpf_(cpf) {
  return String(cpf || '').replace(/\D/g, '');
}

function normalizeSubmittedCpf_(cpf) {
  if (typeof cpf === 'number') {
    throw new Error('CPF recebido como número. Envie o CPF como texto para preservar zeros à esquerda.');
  }

  const digits = normalizeCpf_(cpf);
  if (digits.length !== 11) {
    throw new Error('CPF deve conter 11 dígitos.');
  }

  return digits;
}

function normalizeStoredCpf_(cpf) {
  const digits = normalizeCpf_(cpf);
  if (digits.length > 0 && digits.length < 11) {
    return digits.padStart(11, '0');
  }

  return digits;
}

function formatCpf_(cpf) {
  cpf = normalizeCpf_(cpf);
  if (cpf.length !== 11) {
    return cpf;
  }

  return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

function sanitizeFileName_(value) {
  return normalizeText_(value).replace(/[\\/:*?"<>|#%{}~&]/g, '-');
}

function normalizeText_(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeEmail_(email) {
  return String(email || '').trim().toLowerCase();
}

function isValidEmail_(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidCpf_(cpf) {
  cpf = normalizeCpf_(cpf);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) {
    return false;
  }

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += Number(cpf.charAt(i)) * (10 - i);
  }
  let firstDigit = 11 - (sum % 11);
  if (firstDigit >= 10) {
    firstDigit = 0;
  }
  if (firstDigit !== Number(cpf.charAt(9))) {
    return false;
  }

  sum = 0;
  for (let j = 0; j < 10; j++) {
    sum += Number(cpf.charAt(j)) * (11 - j);
  }
  let secondDigit = 11 - (sum % 11);
  if (secondDigit >= 10) {
    secondDigit = 0;
  }

  return secondDigit === Number(cpf.charAt(10));
}

function ensureSheet_(spreadsheet, sheetName, headers) {
  let sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet && sheetName === 'Presen\u00e7as') {
    const legacySheet = spreadsheet.getSheetByName('Presencas');
    if (legacySheet) {
      legacySheet.setName(sheetName);
      sheet = legacySheet;
    }
  }

  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
  }

  const existingHeaders = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  const mustWriteHeaders = existingHeaders.join('') === '' || existingHeaders.join('|') !== headers.join('|');
  if (mustWriteHeaders) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }

  return sheet;
}

function formatTextColumns_(sheet, columnNumbers) {
  columnNumbers.forEach(function(columnNumber) {
    sheet.getRange(1, columnNumber, sheet.getMaxRows(), 1).setNumberFormat('@');
  });
}

function repairCpfTextColumn_(sheet, columnNumber) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return;
  }

  const range = sheet.getRange(2, columnNumber, lastRow - 1, 1);
  const values = range.getValues();
  const repairedValues = values.map(function(row) {
    const cpf = normalizeStoredCpf_(row[0]);
    return [cpf.length === 11 ? cpf : row[0]];
  });

  range.setNumberFormat('@');
  range.setValues(repairedValues);
}

function appendRowWithTextColumns_(sheet, values, textColumnNumbers) {
  const nextRow = sheet.getLastRow() + 1;
  const preparedValues = values.slice();

  textColumnNumbers.forEach(function(columnNumber) {
    sheet.getRange(nextRow, columnNumber).setNumberFormat('@');
    preparedValues[columnNumber - 1] = String(preparedValues[columnNumber - 1] || '');
  });

  sheet.getRange(nextRow, 1, 1, preparedValues.length).setValues([preparedValues]);
}

function getSheet_(sheetName) {
  return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID).getSheetByName(sheetName);
}

function renderHtml_(fileName, data) {
  const template = HtmlService.createTemplateFromFile(fileName);
  Object.keys(data || {}).forEach(function(key) {
    template[key] = data[key];
  });

  return template
    .evaluate()
    .setTitle(data.appTitle || 'Aulas')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(fileName) {
  return HtmlService.createHtmlOutputFromFile(fileName).getContent();
}
