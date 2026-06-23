const BACKEND_PROXY_URL = '/.netlify/functions/apps-script-proxy';

let appConfig = null;
const generatedTokens = new Map();
const lessonStates = new Map();
let youtubeApiReady = false;

const brandLogo = document.querySelector('#brandLogo');
const tokenBadge = document.querySelector('#tokenBadge');
const lessonListSection = document.querySelector('#lessonListSection');
const lessonList = document.querySelector('#lessonList');
const panels = document.querySelector('#lessonPanels');
const certificateSection = document.querySelector('#certificateSection');
const certificateForm = document.querySelector('#certificateForm');
const certificateCpf = certificateForm.elements.certificateCpf;
const certificateResult = document.querySelector('#certificateResult');
const certificateStatus = document.querySelector('#certificateStatus');
const listTemplate = document.querySelector('#lessonListTemplate');
const lessonTemplate = document.querySelector('#lessonTemplate');

window.onYouTubeIframeAPIReady = function() {
  youtubeApiReady = true;
};

const youtubeApiScript = document.createElement('script');
youtubeApiScript.src = 'https://www.youtube.com/iframe_api';
document.head.appendChild(youtubeApiScript);

initialize();

async function initialize() {
  bindNavigation();
  bindCertificateForm();
  lessonList.innerHTML = '<li class="lesson-list-item"><div><h3>Carregando aulas...</h3><p>Aguarde enquanto buscamos as informações atualizadas.</p></div></li>';

  try {
    const config = await callBackend('getPublicConfig');
    if (!config.ok) {
      throw new Error(config.message || 'Não foi possível carregar as aulas.');
    }

    appConfig = config;
    applyConfig(appConfig);
    renderLessons(appConfig.lessons || []);
  } catch (error) {
    lessonList.innerHTML = `<li class="lesson-list-item"><div><h3>Não foi possível carregar as aulas</h3><p>${escapeHtml(error.message)}</p></div></li>`;
  }
}

function applyConfig(config) {
  brandLogo.src = config.logoUrl;
  brandLogo.alt = config.organizationName;
  tokenBadge.textContent = `QR válido por ${config.tokenTtlMinutes} min`;
}

function renderLessons(lessons) {
  lessonList.innerHTML = '';
  panels.innerHTML = '';

  lessons.forEach((lesson) => {
    renderLessonListItem(lesson);
    renderLessonPanel(lesson);
  });
}

function bindNavigation() {
  document.querySelectorAll('[data-site-tab]').forEach((tab) => {
    tab.addEventListener('click', () => {
      if (tab.dataset.siteTab === 'certificate') {
        showCertificateSection();
      } else {
        showLessonsSection();
      }
    });
  });
}

function bindCertificateForm() {
  certificateCpf.addEventListener('input', () => {
    certificateCpf.value = formatCpf(certificateCpf.value);
  });

  certificateForm.addEventListener('submit', (event) => {
    event.preventDefault();
    certificateResult.hidden = true;
    certificateResult.innerHTML = '';
    certificateStatus.textContent = '';

    if (!certificateForm.reportValidity()) {
      return;
    }

    certificateForm.querySelector('button').disabled = true;
    certificateStatus.textContent = 'Verificando presenças e gerando o PDF...';

    callBackend('createCertificate', {
      cpf: certificateForm.elements.certificateCpf.value
    })
      .then((response) => {
        certificateForm.querySelector('button').disabled = false;
        if (!response.ok) {
          if (response.reason === 'INSUFFICIENT_ATTENDANCE') {
            certificateStatus.textContent = response.message;
            certificateResult.hidden = false;
            certificateResult.innerHTML = `
              <h3>Certificado ainda não disponível</h3>
              <p>CPF: ${escapeHtml(response.cpf)} · Progresso: ${response.completedLessons} de ${response.requiredLessons} aulas concluídas.</p>
              <p>Conclua pelo menos ${response.requiredLessons} aulas para emitir o certificado em PDF.</p>
            `;
            return;
          }

          throw new Error(response.message || 'Não foi possível emitir o certificado.');
        }

        certificateStatus.textContent = response.message;
        certificateResult.hidden = false;
        certificateResult.innerHTML = `
          <h3>${escapeHtml(response.name)}</h3>
          <p>CPF: ${escapeHtml(response.cpf)} · Aulas concluídas: ${response.completedLessons}</p>
          <a class="certificate-link" target="_blank" rel="noopener" href="${response.pdfUrl}">Abrir certificado em PDF</a>
        `;
      })
      .catch((error) => {
        certificateForm.querySelector('button').disabled = false;
        certificateStatus.textContent = error.message || 'Não foi possível emitir o certificado.';
      });
  });
}
function renderLessonListItem(lesson) {
  const node = listTemplate.content.cloneNode(true);
  const item = node.querySelector('.lesson-list-item');
  const openButton = node.querySelector('[data-open-lesson]');

  item.dataset.lessonId = lesson.id;
  node.querySelector('[data-list-title]').textContent = lesson.title;
  node.querySelector('[data-list-description]').textContent = lesson.description;
  node.querySelector('[data-list-duration]').textContent = lesson.durationLabel;

  openButton.addEventListener('click', () => openLesson(lesson.id));
  lessonList.appendChild(node);
}

function renderLessonPanel(lesson) {
  const node = lessonTemplate.content.cloneNode(true);
  const article = node.querySelector('.lesson');
  const playerShell = node.querySelector('[data-youtube-shell]');
  const playerBox = node.querySelector('[data-youtube-player]');
  const startButton = node.querySelector('[data-start-button]');
  const backButton = node.querySelector('[data-back-button]');
  const status = node.querySelector('[data-status]');
  const qrPanel = node.querySelector('[data-qr-panel]');
  const qrImage = node.querySelector('[data-qr-image]');
  const registrationLink = node.querySelector('[data-registration-link]');

  article.dataset.lessonId = lesson.id;
  article.id = `panel-${lesson.id}`;
  article.hidden = true;
  playerBox.id = `youtube-${lesson.id}`;

  node.querySelector('[data-title]').textContent = lesson.title;
  node.querySelector('[data-description]').textContent = lesson.description;
  node.querySelector('[data-duration]').textContent = lesson.durationLabel;

  startButton.addEventListener('click', () => {
    startYouTubeLesson(lesson, playerShell, playerBox, startButton, status, qrPanel, qrImage, registrationLink);
  });

  backButton.addEventListener('click', () => showLessonList(lesson.id));
  panels.appendChild(node);
}

function openLesson(lessonId) {
  setActiveSiteTab('lessons');
  certificateSection.hidden = true;
  lessonListSection.hidden = true;
  panels.hidden = false;

  document.querySelectorAll('.lesson-panel').forEach((panel) => {
    panel.hidden = panel.dataset.lessonId !== lessonId;
  });
}

function showLessonList(currentLessonId) {
  const state = lessonStates.get(currentLessonId);
  if (state && state.player && typeof state.player.pauseVideo === 'function') {
    state.player.pauseVideo();
  }

  panels.hidden = true;
  document.querySelectorAll('.lesson-panel').forEach((panel) => {
    panel.hidden = true;
  });
  lessonListSection.hidden = false;
}

function showLessonsSection() {
  pauseAllPlayers();
  setActiveSiteTab('lessons');
  certificateSection.hidden = true;
  panels.hidden = true;
  document.querySelectorAll('.lesson-panel').forEach((panel) => {
    panel.hidden = true;
  });
  lessonListSection.hidden = false;
}

function showCertificateSection() {
  pauseAllPlayers();
  setActiveSiteTab('certificate');
  lessonListSection.hidden = true;
  panels.hidden = true;
  document.querySelectorAll('.lesson-panel').forEach((panel) => {
    panel.hidden = true;
  });
  certificateSection.hidden = false;
}

function setActiveSiteTab(tabName) {
  document.querySelectorAll('[data-site-tab]').forEach((tab) => {
    tab.setAttribute('aria-selected', tab.dataset.siteTab === tabName ? 'true' : 'false');
  });
}

function pauseAllPlayers() {
  lessonStates.forEach((state) => {
    if (state && state.player && typeof state.player.pauseVideo === 'function') {
      state.player.pauseVideo();
    }
  });
}

function startYouTubeLesson(lesson, playerShell, playerBox, startButton, status, qrPanel, qrImage, registrationLink) {
  const existingState = lessonStates.get(lesson.id);
  if (existingState && existingState.started) {
    return;
  }

  if (!youtubeApiReady || !window.YT || !YT.Player) {
    status.textContent = 'O player do YouTube ainda está carregando. Tente novamente em alguns segundos.';
    return;
  }

  playerShell.hidden = false;
  startButton.hidden = true;
  status.textContent = 'Aperte play no vídeo para iniciar a contagem do tempo assistido.';

  const state = {
    started: true,
    player: null,
    duration: 0,
    watchedSeconds: 0,
    lastCurrentTime: 0,
    intervalId: null,
    qrReleased: false
  };
  lessonStates.set(lesson.id, state);

  state.player = new YT.Player(playerBox.id, {
    videoId: lesson.youtubeVideoId,
    playerVars: {
      rel: 0,
      modestbranding: 1,
      playsinline: 1
    },
    events: {
      onReady: (event) => {
        state.duration = Number(event.target.getDuration() || lesson.watchSecondsBeforeQr || 0);
      },
      onStateChange: (event) => {
        handlePlayerStateChange(event, lesson, state, status, qrPanel, qrImage, registrationLink);
      }
    }
  });
}

function handlePlayerStateChange(event, lesson, state, status, qrPanel, qrImage, registrationLink) {
  if (event.data === YT.PlayerState.PLAYING) {
    state.duration = Number(state.player.getDuration() || state.duration || lesson.watchSecondsBeforeQr || 0);
    state.lastCurrentTime = Number(state.player.getCurrentTime() || 0);
    startWatchTracker(lesson, state, status, qrPanel, qrImage, registrationLink);
    return;
  }

  if (event.data === YT.PlayerState.PAUSED || event.data === YT.PlayerState.BUFFERING) {
    stopWatchTracker(state);
    return;
  }

  if (event.data === YT.PlayerState.ENDED) {
    stopWatchTracker(state);
    releaseQrCodeOnce(lesson, state, status, qrPanel, qrImage, registrationLink);
  }
}

function startWatchTracker(lesson, state, status, qrPanel, qrImage, registrationLink) {
  if (state.intervalId) {
    return;
  }

  state.intervalId = setInterval(() => {
    const currentTime = Number(state.player.getCurrentTime() || 0);
    const delta = currentTime - state.lastCurrentTime;
    state.lastCurrentTime = currentTime;

    if (delta > 0 && delta <= 1.5) {
      state.watchedSeconds += delta;
    }

    updateWatchStatus(lesson, state, status);

    if (hasRequiredWatchTime(lesson, state)) {
      stopWatchTracker(state);
      releaseQrCodeOnce(lesson, state, status, qrPanel, qrImage, registrationLink);
    }
  }, 1000);
}

function stopWatchTracker(state) {
  if (!state.intervalId) {
    return;
  }

  clearInterval(state.intervalId);
  state.intervalId = null;
}

function hasRequiredWatchTime(lesson, state) {
  const requiredPercent = Number(lesson.watchPercentRequired || 0.95);
  const duration = Number(state.duration || lesson.watchSecondsBeforeQr || 0);
  if (!duration) {
    return false;
  }

  return state.watchedSeconds >= duration * requiredPercent;
}

function updateWatchStatus(lesson, state, status) {
  const duration = Number(state.duration || lesson.watchSecondsBeforeQr || 0);
  const requiredSeconds = Math.ceil(duration * Number(lesson.watchPercentRequired || 0.95));
  const watchedSeconds = Math.min(Math.floor(state.watchedSeconds), requiredSeconds);
  status.textContent = `Tempo assistido: ${formatSeconds(watchedSeconds)} de ${formatSeconds(requiredSeconds)}.`;
}

function releaseQrCodeOnce(lesson, state, status, qrPanel, qrImage, registrationLink) {
  if (state.qrReleased) {
    return;
  }

  state.qrReleased = true;
  releaseQrCode(lesson, status, qrPanel, qrImage, registrationLink);
}

function releaseQrCode(lesson, status, qrPanel, qrImage, registrationLink) {
  if (generatedTokens.has(lesson.id)) {
    const cached = generatedTokens.get(lesson.id);
    showQr(cached, status, qrPanel, qrImage, registrationLink);
    return;
  }

  status.textContent = 'Gerando QR code...';
  callBackend('createAttendanceToken', {
    lessonId: lesson.id
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(response.message || 'Não foi possível gerar o QR code.');
      }

      generatedTokens.set(lesson.id, response);
      showQr(response, status, qrPanel, qrImage, registrationLink);
    })
    .catch((error) => {
      status.textContent = error.message || 'Não foi possível gerar o QR code.';
    });
}

function showQr(response, status, qrPanel, qrImage, registrationLink) {
  qrImage.src = response.qrImageUrl;
  registrationLink.href = response.registrationUrl;
  qrPanel.hidden = false;
  status.textContent = 'QR code liberado. Ele é de uso único.';
}

async function callBackend(action, params) {
  const url = new URL(BACKEND_PROXY_URL, window.location.origin);
  url.searchParams.set('action', action);

  Object.keys(params || {}).forEach((key) => {
    url.searchParams.set(key, params[key]);
  });

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Accept: 'application/json'
    }
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error((payload && payload.message) || 'Não foi possível comunicar com o backend.');
  }

  return payload;
}

function formatSeconds(totalSeconds) {
  const normalizedSeconds = Math.max(0, Math.floor(Number(totalSeconds || 0)));
  const minutes = Math.floor(normalizedSeconds / 60);
  const seconds = normalizedSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatCpf(value) {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  return digits
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}



