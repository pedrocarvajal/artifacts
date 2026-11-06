(function () {
  "use strict";

  const THRESHOLD_MS = 350;
  const RECORDING_MS = 2200;
  const TRANSCRIBING_MS = 1900;
  const REFINING_MS = 2400;
  const CANCEL_RECORDING_MS = 1400;
  const TOAST_MS = 3000;

  const RAW_TEXT = "Eh, o sea, llego a las siete y media, avísame si hay cambios.";
  const REFINED_TEXT = "Llego a las siete y media. Avísame si hay cambios.";
  const WAVE_LEVELS = [0.28, 0.5, 0.72, 0.4, 0.86, 0.58, 0.35, 0.66, 1, 0.74, 0.46, 0.9, 0.62, 0.32, 0.78, 0.52, 0.94, 0.68, 0.38, 0.82, 0.56, 0.3, 0.7, 0.48, 0.88, 0.6];

  const ICON_STATES = {
    idle: "idle",
    arming: "idle",
    recording: "recording",
    "too-short": "idle",
    canceled: "idle",
    transcribing: "transcribing",
    copied: "transcribing",
    refining: "transcribing",
    refined: "idle",
    "error-mic": "error",
    "error-permissions": "error",
    "error-no-speech": "error",
    "error-offline": "error",
    "error-auth": "error",
    "error-timeout": "error",
    "error-ollama": "error"
  };

  const MENUBAR_LABELS = {
    idle: "Otypeless: inactivo",
    recording: "Otypeless: grabando",
    transcribing: "Otypeless: transcribiendo",
    error: "Otypeless: error"
  };

  const ERRORS = {
    "error-mic": {
      tone: "danger",
      icon: "mic",
      title: "Micrófono bloqueado",
      subtitle: "No se puede grabar.",
      message: "Otypeless no tiene acceso al micrófono. Actívalo en Ajustes del Sistema › Privacidad y seguridad › Micrófono.",
      footLeft: "No se subió audio.",
      footRight: "Permiso del sistema",
      settingsNote: "En la app, esto abre Ajustes del Sistema › Privacidad y seguridad › Micrófono.",
      actions: [
        { label: "Abrir Ajustes", action: "settings", icon: "settings", primary: true },
        { label: "Reintentar", action: "retry", icon: "retry" }
      ],
      announcement: "Error: micrófono bloqueado. Activa el acceso en Ajustes del Sistema, Privacidad y seguridad, Micrófono."
    },
    "error-permissions": {
      tone: "danger",
      icon: "key",
      title: "Falta un permiso",
      subtitle: "El atajo global no responde.",
      message: "Activa Accesibilidad y Monitorización de entrada para Otypeless en Ajustes del Sistema › Privacidad y seguridad.",
      footLeft: "No se detectó ⌘.",
      footRight: "Permiso del sistema",
      settingsNote: "En la app, esto abre Ajustes del Sistema › Privacidad y seguridad.",
      actions: [
        { label: "Abrir Ajustes", action: "settings", icon: "settings", primary: true },
        { label: "Reintentar", action: "retry", icon: "retry" }
      ],
      announcement: "Error: falta un permiso. Activa Accesibilidad y Monitorización de entrada en Ajustes del Sistema."
    },
    "error-no-speech": {
      tone: "warning",
      icon: "mic",
      title: "No se detectó voz",
      subtitle: "La toma quedó vacía.",
      message: "Habla después de que aparezca la onda y acerca el micrófono. No se copió nada.",
      footLeft: "No se copió nada.",
      footRight: "Toma sin voz",
      actions: [
        { label: "Reintentar", action: "retry", icon: "retry", primary: true },
        { label: "Volver a inactivo", action: "home" }
      ],
      announcement: "Aviso: no se detectó voz. No se copió nada."
    },
    "error-offline": {
      tone: "danger",
      icon: "wifi-off",
      title: "Sin conexión",
      subtitle: "La transcripción necesita red.",
      message: "Comprueba la conexión y reintenta. El audio no se transcribió.",
      footLeft: "No se copió nada.",
      footRight: "Requiere red",
      actions: [
        { label: "Reintentar", action: "retry", icon: "retry", primary: true },
        { label: "Volver a inactivo", action: "home" }
      ],
      announcement: "Error: sin conexión. La transcripción necesita red."
    },
    "error-auth": {
      tone: "danger",
      icon: "lock",
      title: "Autenticación fallida",
      subtitle: "El servicio rechazó la clave.",
      message: "Revisa la API key del proveedor de ASR en Ajustes › Proveedores y vuelve a intentarlo.",
      footLeft: "No se copió nada.",
      footRight: "Clave rechazada",
      settingsNote: "En la app, esto abre Ajustes › Proveedores.",
      actions: [
        { label: "Abrir Ajustes", action: "settings", icon: "settings", primary: true },
        { label: "Reintentar", action: "retry", icon: "retry" }
      ],
      announcement: "Error: autenticación fallida. Revisa la clave del proveedor de ASR."
    },
    "error-timeout": {
      tone: "danger",
      icon: "clock",
      title: "La nube no respondió",
      subtitle: "Tiempo de espera agotado.",
      message: "La transcripción superó los 15 s y se canceló. Reintenta; si se repite, revisa la conexión.",
      footLeft: "No se copió nada.",
      footRight: "Límite de 15 s",
      actions: [
        { label: "Reintentar", action: "retry", icon: "retry", primary: true },
        { label: "Volver a inactivo", action: "home" }
      ],
      announcement: "Error: la transcripción superó el tiempo de espera. No se copió nada."
    },
    "error-ollama": {
      tone: "warning",
      icon: "sparkles",
      title: "No se pudo refinar",
      subtitle: "El texto crudo sigue copiado.",
      message: "Ollama Cloud no está disponible. Conserva el texto crudo o reintenta el refinado.",
      footLeft: "La copia inicial no se pierde.",
      footRight: "Crudo en el portapapeles",
      actions: [
        { label: "Copiar crudo", action: "copy-raw", icon: "copy", primary: true },
        { label: "Reintentar refinado", action: "refine-retry", icon: "retry" }
      ],
      announcement: "Aviso: no se pudo refinar. El texto crudo sigue en el portapapeles."
    }
  };

  const dom = {};
  let stateName = "idle";
  let isPlaying = false;
  let sequenceToken = 0;
  let refineTimer = null;
  let recordingTimer = null;
  let holdTimer = null;
  let toastTimer = null;
  let liveTimer = null;
  let soundEnabled = false;
  let audioContext = null;
  let motionTouched = false;
  const hold = { active: false, recording: false, startedAt: 0, source: null };

  function getElement(id) {
    return document.getElementById(id);
  }

  function iconMarkup(name) {
    return `<svg class="icon" aria-hidden="true"><use href="#i-${name}"></use></svg>`;
  }

  function actionButton(action) {
    const icon = action.icon ? iconMarkup(action.icon) : "";
    return `<button class="button${action.primary ? " button--primary" : ""}" type="button" data-action="${action.action}">${icon}<span>${action.label}</span></button>`;
  }

  function footMarkup(left, right) {
    return `<div class="hud__foot"><span>${left}</span><span>${right}</span></div>`;
  }

  function previewMarkup(text, left, right) {
    return `<div class="preview"><p class="preview__text">${text}</p><div class="preview__meta"><span>${left}</span><span>${right}</span></div></div>`;
  }

  function hudShell(view) {
    const badge = view.badge ? `<span class="hud__badge">${view.badge}</span>` : "";
    const actionsClass = view.actionsClass ? ` ${view.actionsClass}` : "";
    return `<div class="hud__head">
      <span class="hud__icon" aria-hidden="true">${iconMarkup(view.icon)}</span>
      <div class="hud__titles">
        <h3 class="hud__title" id="hud-title" tabindex="-1">${view.title}</h3>
        <p class="hud__subtitle">${view.subtitle}</p>
      </div>
      ${badge}
    </div>
    ${view.body ? `<div class="hud__body">${view.body}</div>` : ""}
    ${view.actions ? `<div class="hud__actions${actionsClass}">${view.actions}</div>` : ""}
    ${view.foot || ""}`;
  }

  function buildView(state, options) {
    if (state === "arming") {
      const body = `<div class="arming">
        <div class="keycap" aria-hidden="true">⌘</div>
        <div class="threshold">
          <div class="threshold__labels"><span>Umbral</span><span>350 ms</span></div>
          <div class="threshold__track"><span class="threshold__fill"></span></div>
        </div>
        <p class="arming__hint">Suelta antes de 350 ms para no grabar.</p>
      </div>`;
      return {
        tone: "neutral",
        live: Boolean(options.live),
        html: hudShell({
          icon: "key",
          title: "Mantén ⌘",
          subtitle: "La grabación empieza a los 350 ms.",
          body
        }),
        announcement: "Preparando. La grabación empieza a los 350 milisegundos."
      };
    }

    if (state === "recording") {
      const bars = WAVE_LEVELS.map((level, index) => `<span style="--level:${level};--index:${index}"></span>`).join("");
      const body = `<div class="recording">
        <div class="recording__meta">
          <span class="recording__live"><span class="recording__dot" aria-hidden="true"></span>En vivo</span>
          <time class="recording__timer" id="recording-time" aria-hidden="true">0:00.0</time>
        </div>
        <div class="waveform" aria-hidden="true">${bars}</div>
        <p class="recording__prompt">Suelta para copiar</p>
        <p class="recording__hint"><span class="kbd">Esc</span> u otra tecla para cancelar</p>
      </div>`;
      return {
        tone: "record",
        live: false,
        html: hudShell({
          icon: "mic",
          title: "Grabando",
          subtitle: "El audio está en memoria; todavía no se sube.",
          body,
          actions: actionButton({ label: "Cancelar", action: "cancel-recording", icon: "x-circle" }),
          actionsClass: "hud__actions--center",
          foot: footMarkup("Búfer de 300 ms", "Aún sin subir")
        }),
        announcement: "Grabando. Suelta para copiar. Esc u otra tecla para cancelar."
      };
    }

    if (state === "too-short") {
      return {
        tone: "neutral",
        live: false,
        html: hudShell({
          icon: "hourglass",
          title: "Demasiado corto",
          subtitle: "La toma no se transcribió.",
          body: `<p class="hud__message">La pulsación no llegó a 350 ms. No se grabó ni se copió nada.</p>`,
          actions: [
            actionButton({ label: "Reintentar", action: "retry", icon: "retry", primary: true }),
            actionButton({ label: "Volver a inactivo", action: "home" })
          ].join(""),
          foot: footMarkup("Búfer descartado", "Ningún dato salió del Mac")
        }),
        announcement: "Demasiado corto. La pulsación no llegó a 350 milisegundos y no se copió nada."
      };
    }

    if (state === "canceled") {
      return {
        tone: "neutral",
        live: false,
        html: hudShell({
          icon: "x-circle",
          title: "Cancelado",
          subtitle: "La grabación se descartó.",
          body: `<p class="hud__message">No se subió audio ni se copió texto.</p>`,
          actions: [
            actionButton({ label: "Reintentar", action: "retry", icon: "retry", primary: true }),
            actionButton({ label: "Volver a inactivo", action: "home" })
          ].join(""),
          foot: footMarkup("Sin datos enviados", "Portapapeles intacto")
        }),
        announcement: "Cancelado. No se copió nada."
      };
    }

    if (state === "transcribing") {
      const body = `<ol class="steps">
        <li class="steps__item is-active"><span class="steps__marker" aria-hidden="true"></span>Subir audio</li>
        <li class="steps__item"><span class="steps__marker" aria-hidden="true"></span>Transcribir en la nube</li>
        <li class="steps__item"><span class="steps__marker" aria-hidden="true"></span>Copiar al portapapeles</li>
      </ol>
      <div class="progress" role="progressbar" aria-label="Transcripción en curso"><span></span></div>`;
      return {
        tone: "accent",
        live: false,
        html: hudShell({
          icon: "cloud-upload",
          title: "Transcribiendo en la nube",
          subtitle: "La transcripción ocurre fuera del Mac.",
          badge: "En la nube",
          body,
          foot: footMarkup("El audio se descarta al terminar", "ASR · nube")
        }),
        announcement: "Transcribiendo en la nube."
      };
    }

    if (state === "copied" || state === "refining") {
      const body = `${previewMarkup(RAW_TEXT, "Texto crudo", "Provisional")}
        <div class="statusline"><span class="spinner" aria-hidden="true"></span><span>Refinando con Ollama Cloud…</span></div>
        <p class="hud__hint">Se reemplazará solo si no cambiaste el portapapeles.</p>`;
      return {
        tone: "success",
        live: false,
        html: hudShell({
          icon: "check-circle",
          title: "Copiado",
          subtitle: "El texto crudo ya está en el portapapeles.",
          badge: "Ollama Cloud",
          body,
          actions: [
            actionButton({ label: "Copiar crudo", action: "copy-raw", icon: "copy" }),
            actionButton({ label: "Volver a inactivo", action: "home" })
          ].join("")
        }),
        announcement: "Copiado. El texto crudo está en el portapapeles. Refinando con Ollama Cloud."
      };
    }

    if (state === "refined") {
      const body = `${previewMarkup(REFINED_TEXT, "Texto refinado", "Final")}
        <div class="statusline statusline--success">${iconMarkup("check")}<span>Refinado</span></div>
        <p class="hud__hint">Se reemplazó el crudo porque el portapapeles no había cambiado.</p>`;
      return {
        tone: "success",
        live: false,
        html: hudShell({
          icon: "check-circle",
          title: "Copiado",
          subtitle: "El texto refinado está en el portapapeles.",
          body,
          actions: [
            actionButton({ label: "Copiar de nuevo", action: "copy-refined", icon: "copy" }),
            actionButton({ label: "Volver a inactivo", action: "home" })
          ].join("")
        }),
        announcement: "Refinado. El texto refinado está en el portapapeles."
      };
    }

    const error = ERRORS[state];
    if (error) {
      let body = `<p class="hud__message">${error.message}</p>`;
      if (state === "error-ollama") {
        body += previewMarkup(RAW_TEXT, "En el portapapeles", "Crudo");
      }
      return {
        tone: error.tone,
        live: false,
        html: hudShell({
          icon: error.icon,
          title: error.title,
          subtitle: error.subtitle,
          body,
          actions: error.actions.map(actionButton).join(""),
          foot: footMarkup(error.footLeft, error.footRight)
        }),
        announcement: error.announcement,
        assertive: true
      };
    }

    return {
      tone: "neutral",
      live: false,
      html: hudShell({
        icon: "x-circle",
        title: "Estado no disponible",
        subtitle: "Vuelve a inactivo para continuar."
      }),
      announcement: "Estado no disponible."
    };
  }

  function updatePressed(state) {
    document.querySelectorAll("[data-state]").forEach(function (button) {
      button.setAttribute("aria-pressed", button.dataset.state === state ? "true" : "false");
    });
  }

  function updateIconGrid(iconState) {
    document.querySelectorAll(".icon-state").forEach(function (item) {
      const active = item.dataset.iconState === iconState;
      item.classList.toggle("is-active", active);
      const current = item.querySelector(".icon-state__now");
      if (current) {
        current.setAttribute("aria-hidden", active ? "false" : "true");
      }
    });
  }

  function announce(text, assertive) {
    if (!text) {
      return;
    }
    const target = assertive ? dom.liveAssertive : dom.livePolite;
    const other = assertive ? dom.livePolite : dom.liveAssertive;
    other.textContent = "";
    target.textContent = "";
    window.clearTimeout(liveTimer);
    liveTimer = window.setTimeout(function () {
      target.textContent = text;
    }, 20);
  }

  function setState(state, options) {
    const settings = options || {};
    stateName = state;
    stopRecordingTimer();
    hideToast();

    dom.desktop.dataset.state = state;
    const iconState = ICON_STATES[state] || "idle";
    dom.desktop.dataset.iconState = iconState;
    dom.menubarIcon.dataset.iconState = iconState;
    dom.menubarIcon.setAttribute("aria-label", MENUBAR_LABELS[iconState]);
    updateIconGrid(iconState);
    updatePressed(state);

    if (state === "idle") {
      dom.hudAnchor.hidden = true;
      dom.hud.innerHTML = "";
      dom.idleNote.hidden = false;
      if (!settings.silent) {
        announce("Inactivo.");
      }
      return;
    }

    const view = buildView(state, settings);
    dom.idleNote.hidden = true;
    dom.hudAnchor.hidden = false;
    dom.hud.dataset.state = state;
    dom.hud.dataset.tone = view.tone;
    dom.hud.dataset.live = view.live ? "true" : "false";
    dom.hud.innerHTML = view.html;

    if (state === "recording") {
      startRecordingTimer();
    }
    if (!settings.silent) {
      announce(view.announcement, view.assertive);
    }
    if (settings.feedback) {
      playFeedback(settings.feedback);
    }
    if (settings.focus) {
      const title = dom.hud.querySelector("#hud-title");
      if (title) {
        title.focus({ preventScroll: true });
      }
    }
  }

  function startRecordingTimer() {
    stopRecordingTimer();
    const startedAt = performance.now();
    updateRecordingTimer(0);
    recordingTimer = window.setInterval(function () {
      if (stateName !== "recording") {
        stopRecordingTimer();
        return;
      }
      updateRecordingTimer(performance.now() - startedAt);
    }, 100);
  }

  function stopRecordingTimer() {
    if (recordingTimer !== null) {
      window.clearInterval(recordingTimer);
      recordingTimer = null;
    }
  }

  function updateRecordingTimer(milliseconds) {
    const timer = getElement("recording-time");
    if (!timer) {
      return;
    }
    const tenths = Math.floor(milliseconds / 100);
    const minutes = Math.floor(tenths / 600);
    const seconds = Math.floor((tenths % 600) / 10);
    const fraction = tenths % 10;
    timer.textContent = `${minutes}:${String(seconds).padStart(2, "0")}.${fraction}`;
  }

  function showToast(message) {
    window.clearTimeout(toastTimer);
    dom.toast.textContent = message;
    dom.toast.hidden = false;
    toastTimer = window.setTimeout(function () {
      dom.toast.hidden = true;
      toastTimer = null;
    }, TOAST_MS);
  }

  function hideToast() {
    window.clearTimeout(toastTimer);
    toastTimer = null;
    if (dom.toast) {
      dom.toast.hidden = true;
    }
  }

  function updatePlayButton() {
    dom.playLabel.textContent = isPlaying ? "Detener" : "Reproducir dictado";
    dom.playIcon.setAttribute("href", isPlaying ? "#i-stop" : "#i-play");
    if (isPlaying) {
      dom.play.setAttribute("aria-label", "Detener reproducción");
    } else {
      dom.play.removeAttribute("aria-label");
    }
  }

  function beginSequence() {
    sequenceToken += 1;
    isPlaying = true;
    updatePlayButton();
    return sequenceToken;
  }

  function finishSequence() {
    isPlaying = false;
    updatePlayButton();
  }

  function invalidateSequence() {
    sequenceToken += 1;
    isPlaying = false;
    if (refineTimer !== null) {
      window.clearTimeout(refineTimer);
      refineTimer = null;
    }
    updatePlayButton();
  }

  function stopAll() {
    abortHold();
    stopRecordingTimer();
    invalidateSequence();
    hideToast();
  }

  function wait(milliseconds, token) {
    return new Promise(function (resolve) {
      window.setTimeout(function () {
        resolve(token === sequenceToken);
      }, milliseconds);
    });
  }

  function scheduleRefine(delay) {
    window.clearTimeout(refineTimer);
    const token = sequenceToken;
    refineTimer = window.setTimeout(function () {
      refineTimer = null;
      if (token !== sequenceToken) {
        return;
      }
      setState("refined");
      finishSequence();
    }, delay);
  }

  async function startHappyPath() {
    stopAll();
    const token = beginSequence();
    setState("arming", { live: true });
    if (!(await wait(THRESHOLD_MS, token))) {
      return;
    }
    setState("recording", { feedback: "start" });
    if (!(await wait(RECORDING_MS, token))) {
      return;
    }
    setState("transcribing", { feedback: "stop" });
    if (!(await wait(TRANSCRIBING_MS, token))) {
      return;
    }
    setState("copied", { feedback: "copied" });
    if (!(await wait(REFINING_MS, token))) {
      return;
    }
    setState("refined");
    finishSequence();
  }

  async function startCancelPath() {
    stopAll();
    const token = beginSequence();
    setState("arming", { live: true });
    if (!(await wait(THRESHOLD_MS, token))) {
      return;
    }
    setState("recording", { feedback: "start" });
    if (!(await wait(CANCEL_RECORDING_MS, token))) {
      return;
    }
    setState("canceled");
    finishSequence();
  }

  async function transcribeAfterHold() {
    stopAll();
    const token = beginSequence();
    setState("transcribing", { feedback: "stop" });
    if (!(await wait(TRANSCRIBING_MS, token))) {
      return;
    }
    setState("copied", { feedback: "copied" });
    if (!(await wait(REFINING_MS, token))) {
      return;
    }
    setState("refined");
    finishSequence();
  }

  function startHold(source) {
    if (hold.active) {
      return;
    }
    stopAll();
    hold.active = true;
    hold.recording = false;
    hold.startedAt = performance.now();
    hold.source = source;
    dom.hold.classList.add("is-pressed");
    setState("arming", { live: true });
    holdTimer = window.setTimeout(function () {
      if (!hold.active) {
        return;
      }
      hold.recording = true;
      setState("recording", { feedback: "start" });
    }, THRESHOLD_MS);
  }

  function clearHoldTimer() {
    if (holdTimer !== null) {
      window.clearTimeout(holdTimer);
      holdTimer = null;
    }
  }

  function abortHold() {
    clearHoldTimer();
    hold.active = false;
    hold.recording = false;
    if (dom.hold) {
      dom.hold.classList.remove("is-pressed");
    }
  }

  function endHold() {
    if (!hold.active) {
      return;
    }
    const elapsed = performance.now() - hold.startedAt;
    const recorded = hold.recording || elapsed >= THRESHOLD_MS;
    clearHoldTimer();
    hold.active = false;
    hold.recording = false;
    dom.hold.classList.remove("is-pressed");
    if (!recorded) {
      setState("too-short");
      return;
    }
    transcribeAfterHold();
  }

  function settingsMessage() {
    const error = ERRORS[stateName];
    return error && error.settingsNote
      ? error.settingsNote
      : "En la app, esto abre los Ajustes del Sistema.";
  }

  function ensureAudioContext() {
    if (!soundEnabled) {
      return null;
    }
    if (!audioContext) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) {
        return null;
      }
      audioContext = new AudioContextClass();
    }
    if (audioContext.state === "suspended") {
      audioContext.resume().catch(function () {});
    }
    return audioContext;
  }

  function playNote(context, frequency, offset, duration, volume) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const start = context.currentTime + offset;
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  function playFeedback(kind) {
    const context = ensureAudioContext();
    if (!context) {
      return;
    }
    if (kind === "start") {
      playNote(context, 620, 0, 0.055, 0.035);
      return;
    }
    if (kind === "stop") {
      playNote(context, 480, 0, 0.055, 0.03);
      return;
    }
    if (kind === "copied") {
      playNote(context, 880, 0, 0.07, 0.028);
      playNote(context, 1175, 0.07, 0.08, 0.022);
      return;
    }
    if (kind === "error") {
      playNote(context, 392, 0, 0.09, 0.03);
      playNote(context, 311, 0.09, 0.12, 0.026);
    }
  }

  function onHoldKeydown(event) {
    if (event.key !== " " && event.key !== "Enter") {
      return;
    }
    event.preventDefault();
    if (!event.repeat && !hold.active) {
      startHold("keyboard");
    }
  }

  function onHoldKeyup(event) {
    if (event.key !== " " && event.key !== "Enter") {
      return;
    }
    event.preventDefault();
    endHold();
  }

  function onDocumentKeydown(event) {
    if (event.defaultPrevented || event.repeat) {
      return;
    }

    if (stateName === "recording") {
      if (
        event.key === "Tab" ||
        event.key === "Shift" ||
        event.key === "Control" ||
        event.key === "Alt" ||
        event.key === "Meta"
      ) {
        return;
      }
      if (hold.active && (event.key === " " || event.key === "Enter")) {
        return;
      }
      event.preventDefault();
      stopAll();
      setState("canceled");
      return;
    }

    if (stateName === "arming" && event.key === "Escape") {
      event.preventDefault();
      abortHold();
      stopAll();
      setState("canceled");
    }
  }

  function bindEvents() {
    dom.play.addEventListener("click", function () {
      if (isPlaying) {
        stopAll();
        setState("idle");
        return;
      }
      startHappyPath();
    });

    dom.playCancel.addEventListener("click", function () {
      startCancelPath();
    });

    document.querySelectorAll("[data-state]").forEach(function (button) {
      button.addEventListener("click", function () {
        stopAll();
        const nextState = button.dataset.state;
        if (nextState === "copied") {
          setState("copied");
          scheduleRefine(REFINING_MS);
          return;
        }
        setState(nextState);
      });
    });

    dom.hud.addEventListener("click", function (event) {
      const button = event.target.closest("[data-action]");
      if (!button) {
        return;
      }
      const action = button.dataset.action;
      if (action === "home") {
        stopAll();
        setState("idle");
        dom.hold.focus({ preventScroll: true });
        return;
      }
      if (action === "retry") {
        startHappyPath();
        dom.play.focus({ preventScroll: true });
        return;
      }
      if (action === "cancel-recording") {
        stopAll();
        setState("canceled", { focus: true });
        return;
      }
      if (action === "copy-raw") {
        showToast("Texto crudo copiado (simulado).");
        return;
      }
      if (action === "copy-refined") {
        showToast("Texto refinado copiado (simulado).");
        return;
      }
      if (action === "settings") {
        showToast(settingsMessage());
        return;
      }
      if (action === "refine-retry") {
        stopAll();
        setState("copied");
        scheduleRefine(REFINING_MS);
        dom.play.focus({ preventScroll: true });
      }
    });

    dom.hold.addEventListener("pointerdown", function (event) {
      if (event.pointerType === "mouse" && event.button !== 0) {
        return;
      }
      dom.hold.focus({ preventScroll: true });
      startHold("pointer");
      try {
        dom.hold.setPointerCapture(event.pointerId);
      } catch (error) {
        return;
      }
    });

    dom.hold.addEventListener("pointerup", function () {
      endHold();
    });

    dom.hold.addEventListener("pointercancel", function () {
      if (!hold.active) {
        return;
      }
      abortHold();
      stopAll();
      setState("canceled");
    });

    dom.hold.addEventListener("keydown", onHoldKeydown);
    dom.hold.addEventListener("keyup", onHoldKeyup);
    dom.hold.addEventListener("blur", function () {
      if (hold.active && hold.source === "keyboard") {
        endHold();
      }
    });
    dom.hold.addEventListener("click", function (event) {
      if (event.detail !== 0 || hold.active) {
        return;
      }
      startHold("assistive");
      window.setTimeout(function () {
        if (hold.active && hold.source === "assistive") {
          endHold();
        }
      }, 700);
    });

    document.addEventListener("keydown", onDocumentKeydown);

    dom.theme.addEventListener("change", function () {
      document.documentElement.dataset.theme = dom.theme.checked ? "dark" : "light";
    });

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    dom.motion.checked = motionQuery.matches;
    dom.motion.addEventListener("change", function () {
      motionTouched = true;
      document.documentElement.dataset.motion = dom.motion.checked ? "reduced" : "normal";
    });
    if (typeof motionQuery.addEventListener === "function") {
      motionQuery.addEventListener("change", function (event) {
        if (!motionTouched) {
          dom.motion.checked = event.matches;
        }
      });
    }

    dom.sound.addEventListener("change", function () {
      soundEnabled = dom.sound.checked;
      if (soundEnabled) {
        ensureAudioContext();
        playFeedback("start");
      }
    });
  }

  function init() {
    dom.desktop = getElement("desktop");
    dom.stage = getElement("stage");
    dom.menubarIcon = getElement("menubar-icon");
    dom.hudAnchor = getElement("hud-anchor");
    dom.hud = getElement("hud");
    dom.idleNote = getElement("idle-note");
    dom.toast = getElement("toast");
    dom.play = getElement("play");
    dom.playLabel = getElement("play-label");
    dom.playIcon = getElement("play-icon");
    dom.playCancel = getElement("play-cancel");
    dom.hold = getElement("hold");
    dom.theme = getElement("theme-toggle");
    dom.motion = getElement("motion-toggle");
    dom.sound = getElement("sound-toggle");
    dom.livePolite = getElement("live-polite");
    dom.liveAssertive = getElement("live-assertive");

    dom.theme.checked = document.documentElement.dataset.theme === "dark";
    bindEvents();
    updatePlayButton();
    setState("idle", { silent: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
