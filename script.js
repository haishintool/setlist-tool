/* =========================================================
   SET LIST TOOL
   script.js
========================================================= */

"use strict";

/* =========================================================
   基本設定
========================================================= */

function generateRoomId(length = 12) {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  let result = "";

  for (let i = 0; i < length; i++) {
    const randomIndex =
      Math.floor(Math.random() * chars.length);

    result += chars[randomIndex];
  }

  return result;
}

const urlParams =
  new URLSearchParams(window.location.search);

let roomId =
  urlParams.get("id");

if (!roomId) {
  roomId = generateRoomId();

  const newUrl =
    new URL(window.location.href);

  newUrl.searchParams.set("id", roomId);

  window.location.replace(newUrl.toString());
}

const API_BASE_URL =
  "https://setlist-api.halismvoice.workers.dev";

const ROOM_API_URL =
  `${API_BASE_URL}/room/${encodeURIComponent(roomId)}`;

const ROOM_WS_URL =
  ROOM_API_URL
    .replace("https://", "wss://")
    + "/ws";

const POLLING_INTERVAL = 5000;

let roomWebSocket = null;
let roomWebSocketReconnectTimer = null;

function connectRoomWebSocket() {

  if (roomWebSocket) {
    roomWebSocket.close();
  }

  roomWebSocket =
    new WebSocket(ROOM_WS_URL);

  roomWebSocket.onopen = () => {
  console.log("WebSocket connected");
};  

roomWebSocket.onmessage = async () => {
  console.log("WebSocket update received");

  await refreshState();
};

roomWebSocket.onclose = () => {
  console.log("WebSocket disconnected");

  roomWebSocketReconnectTimer =
    setTimeout(() => {
      connectRoomWebSocket();
    }, 5000);
};

}

const DEFAULT_STATE = {
  songs: [],
  currentSong: "",
listStyle: "number",
setlistMarkerImage: "",
setlistMarkerImageSize: 100,

nowPlayingFontFamily: "",
nowPlayingMarkerImage: "",
  setlistFontFamily: "",

  nowPlayingTextColor: "#ffffff",
  nowPlayingStrokeEnabled: true,
  nowPlayingStrokeColor: "#000000",
  nowPlayingStrokeWidth: 2,

  nowPlayingShadowEnabled: false,
nowPlayingShadowColor: "#000000",
nowPlayingShadowOffsetX: 3,
nowPlayingShadowOffsetY: 3,
nowPlayingShadowBlur: 6,

setlistTextColor: "#ffffff",

setlistStrokeEnabled: true,
setlistStrokeColor: "#000000",
setlistStrokeWidth: 2,

setlistShadowEnabled: false,
setlistShadowColor: "#000000",
setlistShadowOffsetX: 3,
setlistShadowOffsetY: 3,
setlistShadowBlur: 6,

  visibleSongs: 10,
  scrollSpeed: 20,
  setlistLineHeight: 1.2,  
};

/* =========================================================
   状態管理
========================================================= */

let state = { ...DEFAULT_STATE };
let lastSavedData = JSON.stringify(state);
let lastFocusedElement = null;
let isSaving = false;
let saveRequested = false;
let isLoading = false;
let autoScrollAnimationId = null;
let autoScrollLastTime = null;
let autoScrollResetTimer = null;
let nowPlayingAnimation = null;
let nowPlayingResizeTimer = null;
let lastNowPlayingSong = "";
let nowPlayingClearTimer = null;

/* =========================================================
   HTML要素取得
========================================================= */

/* index.html側 */

const songCount =
  document.getElementById("songCount");

const numberStyleButton =
  document.getElementById("numberStyleButton");

const bulletStyleButton =
  document.getElementById("bulletStyleButton");

const imageStyleButton =
  document.getElementById("imageStyleButton");

const setlistMarkerImageControls =
  document.getElementById(
    "setlistMarkerImageControls"
  );

const setlistMarkerImageInput =
  document.getElementById(
    "setlistMarkerImageInput"
  );  

const nowPlayingMarkerImageInput =
  document.getElementById(
    "nowPlayingMarkerImageInput"
  );

const setlistMarkerImageSize =
  document.getElementById(
    "setlistMarkerImageSize"
  );

const setlistMarkerImageSizeValue =
  document.getElementById(
    "setlistMarkerImageSizeValue"
  );  

const nowPlayingFontPreset =
  document.getElementById(
    "nowPlayingFontPreset"
  );

const nowPlayingFontInput =
  document.getElementById(
    "nowPlayingFontInput"
  );

const applyNowPlayingFontButton =
  document.getElementById(
    "applyNowPlayingFontButton"
  );

const setlistFontPreset =
  document.getElementById(
    "setlistFontPreset"
  );

const setlistFontInput =
  document.getElementById(
    "setlistFontInput"
  );

  const visibleSongsInput =
  document.getElementById("visibleSongsInput");

const scrollSpeedInput =
  document.getElementById("scrollSpeedInput");

const scrollSpeedValue =
  document.getElementById("scrollSpeedValue");

const setlistLineHeightInput =
  document.getElementById("setlistLineHeightInput");

const setlistLineHeightValue =
  document.getElementById("setlistLineHeightValue");

const applySetlistFontButton =
  document.getElementById(
    "applySetlistFontButton"
  );

const copyNowPlayingUrlButton =
  document.getElementById("copyNowPlayingUrlButton");

const copySetlistUrlButton =
  document.getElementById("copySetlistUrlButton");

const copyRoomUrlStatus =
  document.getElementById("copyRoomUrlStatus");

const setlistTabButton =
  document.getElementById(
    "setlistTabButton"
  );

const nowPlayingTabButton =
  document.getElementById(
    "nowPlayingTabButton"
  );

const setlistTab =
  document.getElementById(
    "setlistTab"
  );

const nowPlayingTab =
  document.getElementById(
    "nowPlayingTab"
  );  

/* display.html側 */

const displaySetlist =
  document.getElementById("displaySetlist");

/* nowplaying.html側 */

const currentSongElement =
  document.getElementById("currentSong");

const currentSongShadow =
  document.getElementById("currentSongShadow");  

  const currentSongStroke =
  document.getElementById(
    "currentSongStroke"
  );

const currentSongFill =
  document.getElementById(
    "currentSongFill"
  );

const currentSongMarkerImage =
  document.getElementById(
    "currentSongMarkerImage"
  );  

const nowPlayingRow =
  document.querySelector(
    ".nowPlayingRow"
  );  

  const previewNowPlaying =
  document.querySelector(
    ".previewNowPlaying"
  );

const previewNowPlayingShadow =
  document.getElementById(
    "previewNowPlayingShadow"
  );  

const previewNowPlayingStroke =
  document.getElementById(
    "previewNowPlayingStroke"
  );

  const previewSetlistShadow =
  document.getElementById(
    "previewSetlistShadow"
  );

const previewSetlistStroke =
  document.getElementById(
    "previewSetlistStroke"
  );

const previewSetlistFill =
  document.getElementById(
    "previewSetlistFill"
  );

const previewNowPlayingMarkerImage =
  document.getElementById(
    "previewNowPlayingMarkerImage"
  );

const nowPlayingShadowEnabled =
  document.getElementById(
    "nowPlayingShadowEnabled"
  );

const nowPlayingShadowColor =
  document.getElementById(
    "nowPlayingShadowColor"
  );

const nowPlayingShadowColorValue =
  document.getElementById(
    "nowPlayingShadowColorValue"
  );

const nowPlayingShadowOffsetX =
  document.getElementById(
    "nowPlayingShadowOffsetX"
  );

const nowPlayingShadowOffsetXValue =
  document.getElementById(
    "nowPlayingShadowOffsetXValue"
  );

const nowPlayingShadowOffsetY =
  document.getElementById(
    "nowPlayingShadowOffsetY"
  );

const nowPlayingShadowOffsetYValue =
  document.getElementById(
    "nowPlayingShadowOffsetYValue"
  );

const nowPlayingShadowBlur =
  document.getElementById(
    "nowPlayingShadowBlur"
  );

const nowPlayingShadowBlurValue =
  document.getElementById(
    "nowPlayingShadowBlurValue"
  );  

const nowPlayingGlowBlur =
  document.getElementById(
    "nowPlayingGlowBlur"
  );

const nowPlayingGlowColor =
  document.getElementById(
    "nowPlayingGlowColor"
  );  

const previewNowPlayingFill =
  document.getElementById(
    "previewNowPlayingFill"
  );  

const previewSetlist =
  document.querySelector(
    ".previewSetlist"
  );

  const nowPlayingTextColor =
  document.getElementById(
    "nowPlayingTextColor"
  );

const nowPlayingTextColorValue =
  document.getElementById(
    "nowPlayingTextColorValue"
  );

const nowPlayingStrokeEnabled =
  document.getElementById(
    "nowPlayingStrokeEnabled"
  );

const nowPlayingStrokeColor =
  document.getElementById(
    "nowPlayingStrokeColor"
  );

const nowPlayingStrokeColorValue =
  document.getElementById(
    "nowPlayingStrokeColorValue"
  );

const nowPlayingStrokeWidth =
  document.getElementById(
    "nowPlayingStrokeWidth"
  );

const nowPlayingStrokeWidthValue =
  document.getElementById(
    "nowPlayingStrokeWidthValue"
  );  

const setlistTextColor =
  document.getElementById(
    "setlistTextColor"
  );

const setlistTextColorValue =
  document.getElementById(
    "setlistTextColorValue"
  );  

const setlistStrokeEnabled =
  document.getElementById(
    "setlistStrokeEnabled"
  );

const setlistStrokeColor =
  document.getElementById(
    "setlistStrokeColor"
  );

const setlistStrokeColorValue =
  document.getElementById(
    "setlistStrokeColorValue"
  );

const setlistStrokeWidth =
  document.getElementById(
    "setlistStrokeWidth"
  );

const setlistStrokeWidthValue =
  document.getElementById(
    "setlistStrokeWidthValue"
  );  

const setlistShadowEnabled =
  document.getElementById(
    "setlistShadowEnabled"
  );

const setlistShadowColor =
  document.getElementById(
    "setlistShadowColor"
  );

const setlistShadowColorValue =
  document.getElementById(
    "setlistShadowColorValue"
  );

const setlistShadowOffsetX =
  document.getElementById(
    "setlistShadowOffsetX"
  );

const setlistShadowOffsetXValue =
  document.getElementById(
    "setlistShadowOffsetXValue"
  );

const setlistShadowOffsetY =
  document.getElementById(
    "setlistShadowOffsetY"
  );

const setlistShadowOffsetYValue =
  document.getElementById(
    "setlistShadowOffsetYValue"
  );

const setlistShadowBlur =
  document.getElementById(
    "setlistShadowBlur"
  );

const setlistShadowBlurValue =
  document.getElementById(
    "setlistShadowBlurValue"
  );  

const editorTabButton =
  document.getElementById("editorTabButton");

const editorTab =
  document.getElementById("editorTab");

const setlistEditor =
  document.getElementById("setlistEditor");

const editorSongInput =
  document.getElementById(
    "editorSongInput"
  );

const sendNowPlayingButton =
  document.getElementById(
    "sendNowPlayingButton"
  );

const addCurrentSongButton =
  document.getElementById(
    "addCurrentSongButton"
  );  

const editorSongCount =
  document.getElementById("editorSongCount");

const updateEditorButton =
  document.getElementById("updateEditorButton");  

const setlistMarkerImageButton =
  document.getElementById(
    "setlistMarkerImageButton"
  );

const nowPlayingMarkerImageButton =
  document.getElementById(
    "nowPlayingMarkerImageButton"
  );  

const setlistMarkerImageName =
  document.getElementById(
    "setlistMarkerImageName"
  );    

const nowPlayingMarkerImageName =
  document.getElementById(
    "nowPlayingMarkerImageName"
  );  

const clearNowPlayingMarkerImageButton =
  document.getElementById(
    "clearNowPlayingMarkerImageButton"
  );  

/* =========================================================
   保存データ
========================================================= */

async function loadState() {
  try {
    const response = await fetch(ROOM_API_URL, {
      cache: "no-store"
    });

if (response.status === 404) {
  return { ...DEFAULT_STATE };
}

if (!response.ok) {
  throw new Error(
    `読み込みに失敗しました: ${response.status}`
  );
}

    const data = await response.json();

    return normalizeState({
      ...DEFAULT_STATE,
      ...data
    });

  } catch (error) {

    console.warn(
      "APIから状態を取得できませんでした。",
      error
    );

    return { ...DEFAULT_STATE };
  }
}

async function saveState() {
  if (isSaving) {
    saveRequested = true;
    return;
  }

  isSaving = true;

  try {
    do {
      saveRequested = false;

      const savedData =
        JSON.stringify(state);

      const response =
        await fetch(ROOM_API_URL, {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json"
          },
          body: savedData
        });

      if (!response.ok) {
        throw new Error(
          `保存に失敗しました: ${response.status}`
        );
      }

      lastSavedData = savedData;
    } while (saveRequested);
  } catch (error) {
    console.warn(
      "APIへの保存に失敗しました。",
      error
    );
  } finally {
    isSaving = false;
  }
}

async function updateState(newState) {
  const latestState =
    await loadState();

  state = normalizeState({
    ...latestState,
    ...newState
  });

  render();

  await saveState();
}

function normalizeState(targetState) {
  const songs =
    Array.isArray(targetState.songs)
      ? targetState.songs
          .filter(
            (song) =>
              typeof song === "string"
          )
          .map(
            (song) => song.trim()
          )
          .filter(Boolean)
      : [];

  const currentSong =
    typeof targetState.currentSong === "string"
      ? targetState.currentSong.trim()
      : "";

const listStyle =
  targetState.listStyle === "bullet" ||
  targetState.listStyle === "image"
    ? targetState.listStyle
    : "number";

const setlistMarkerImage =
  typeof targetState.setlistMarkerImage === "string" &&
  targetState.setlistMarkerImage.startsWith("data:image/")
    ? targetState.setlistMarkerImage
    : "";    

const setlistMarkerImageSize =
  Number.isFinite(
    Number(targetState.setlistMarkerImageSize)
  )
    ? Math.min(
        300,
        Math.max(
          20,
          Number(targetState.setlistMarkerImageSize)
        )
      )
    : DEFAULT_STATE.setlistMarkerImageSize; 

const nowPlayingFontFamily =
  typeof targetState.nowPlayingFontFamily === "string" &&
  targetState.nowPlayingFontFamily.trim()
    ? targetState.nowPlayingFontFamily.trim()
    : DEFAULT_STATE.nowPlayingFontFamily;

const nowPlayingMarkerImage =
  typeof targetState.nowPlayingMarkerImage === "string" &&
  targetState.nowPlayingMarkerImage.startsWith("data:image/")
    ? targetState.nowPlayingMarkerImage
    : "";    

const setlistFontFamily =
  typeof targetState.setlistFontFamily === "string" &&
  targetState.setlistFontFamily.trim()
    ? targetState.setlistFontFamily.trim()
    : DEFAULT_STATE.setlistFontFamily;

const visibleSongs =
  Number.isFinite(Number(targetState.visibleSongs))
    ? Number(targetState.visibleSongs)
    : DEFAULT_STATE.visibleSongs;

const scrollSpeed =
  Number.isFinite(Number(targetState.scrollSpeed))
    ? Number(targetState.scrollSpeed)
    : DEFAULT_STATE.scrollSpeed;    

const setlistLineHeight =
  Number.isFinite(
    Number(targetState.setlistLineHeight)
  )
    ? Number(targetState.setlistLineHeight)
    : DEFAULT_STATE.setlistLineHeight;

const nowPlayingTextColor =
  typeof targetState.nowPlayingTextColor === "string" &&
  /^#[0-9a-fA-F]{6}$/.test(
    targetState.nowPlayingTextColor
  )
    ? targetState.nowPlayingTextColor
    : DEFAULT_STATE.nowPlayingTextColor;

const nowPlayingStrokeEnabled =
  typeof targetState.nowPlayingStrokeEnabled === "boolean"
    ? targetState.nowPlayingStrokeEnabled
    : DEFAULT_STATE.nowPlayingStrokeEnabled;

const nowPlayingStrokeColor =
  typeof targetState.nowPlayingStrokeColor === "string" &&
  /^#[0-9a-fA-F]{6}$/.test(
    targetState.nowPlayingStrokeColor
  )
    ? targetState.nowPlayingStrokeColor
    : DEFAULT_STATE.nowPlayingStrokeColor;

const nowPlayingStrokeWidth =
  Number.isInteger(
    targetState.nowPlayingStrokeWidth
  ) &&
  targetState.nowPlayingStrokeWidth >= 0 &&
  targetState.nowPlayingStrokeWidth <= 20
    ? targetState.nowPlayingStrokeWidth
    : DEFAULT_STATE.nowPlayingStrokeWidth;    

const nowPlayingShadowEnabled =
  typeof targetState.nowPlayingShadowEnabled === "boolean"
    ? targetState.nowPlayingShadowEnabled
    : DEFAULT_STATE.nowPlayingShadowEnabled;

const nowPlayingShadowColor =
  typeof targetState.nowPlayingShadowColor === "string" &&
  /^#[0-9a-fA-F]{6}$/.test(
    targetState.nowPlayingShadowColor
  )
    ? targetState.nowPlayingShadowColor
    : DEFAULT_STATE.nowPlayingShadowColor;

const nowPlayingShadowOffsetX =
  Number.isInteger(
    targetState.nowPlayingShadowOffsetX
  ) &&
  targetState.nowPlayingShadowOffsetX >= -20 &&
  targetState.nowPlayingShadowOffsetX <= 20
    ? targetState.nowPlayingShadowOffsetX
    : DEFAULT_STATE.nowPlayingShadowOffsetX;

const nowPlayingShadowOffsetY =
  Number.isInteger(
    targetState.nowPlayingShadowOffsetY
  ) &&
  targetState.nowPlayingShadowOffsetY >= -20 &&
  targetState.nowPlayingShadowOffsetY <= 20
    ? targetState.nowPlayingShadowOffsetY
    : DEFAULT_STATE.nowPlayingShadowOffsetY;

const nowPlayingShadowBlur =
  Number.isInteger(
    targetState.nowPlayingShadowBlur
  ) &&
  targetState.nowPlayingShadowBlur >= 0 &&
  targetState.nowPlayingShadowBlur <= 30
    ? targetState.nowPlayingShadowBlur
    : DEFAULT_STATE.nowPlayingShadowBlur;

const setlistTextColor =
  /^#[0-9a-fA-F]{6}$/.test(
    targetState.setlistTextColor
  )
    ? targetState.setlistTextColor
    : DEFAULT_STATE.setlistTextColor;

const setlistStrokeEnabled =
  typeof targetState.setlistStrokeEnabled ===
  "boolean"
    ? targetState.setlistStrokeEnabled
    : DEFAULT_STATE.setlistStrokeEnabled;

const setlistStrokeColor =
  /^#[0-9a-fA-F]{6}$/.test(
    targetState.setlistStrokeColor
  )
    ? targetState.setlistStrokeColor
    : DEFAULT_STATE.setlistStrokeColor;

const setlistStrokeWidth =
  Number.isInteger(
    targetState.setlistStrokeWidth
  ) &&
  targetState.setlistStrokeWidth >= 0 &&
  targetState.setlistStrokeWidth <= 20
    ? targetState.setlistStrokeWidth
    : DEFAULT_STATE.setlistStrokeWidth;

const setlistShadowEnabled =
  typeof targetState.setlistShadowEnabled ===
  "boolean"
    ? targetState.setlistShadowEnabled
    : DEFAULT_STATE.setlistShadowEnabled;

const setlistShadowColor =
  /^#[0-9a-fA-F]{6}$/.test(
    targetState.setlistShadowColor
  )
    ? targetState.setlistShadowColor
    : DEFAULT_STATE.setlistShadowColor;

const setlistShadowOffsetX =
  Number.isInteger(
    targetState.setlistShadowOffsetX
  ) &&
  targetState.setlistShadowOffsetX >= -20 &&
  targetState.setlistShadowOffsetX <= 20
    ? targetState.setlistShadowOffsetX
    : DEFAULT_STATE.setlistShadowOffsetX;

const setlistShadowOffsetY =
  Number.isInteger(
    targetState.setlistShadowOffsetY
  ) &&
  targetState.setlistShadowOffsetY >= -20 &&
  targetState.setlistShadowOffsetY <= 20
    ? targetState.setlistShadowOffsetY
    : DEFAULT_STATE.setlistShadowOffsetY;

const setlistShadowBlur =
  Number.isInteger(
    targetState.setlistShadowBlur
  ) &&
  targetState.setlistShadowBlur >= 0 &&
  targetState.setlistShadowBlur <= 30
    ? targetState.setlistShadowBlur
    : DEFAULT_STATE.setlistShadowBlur;    

return {
  songs,
  currentSong,
  listStyle,
  setlistMarkerImage,  
  setlistMarkerImageSize,
  nowPlayingFontFamily,
  nowPlayingMarkerImage,
  setlistFontFamily,
  nowPlayingTextColor,
  nowPlayingStrokeEnabled,
  nowPlayingStrokeColor,
  nowPlayingStrokeWidth,
  nowPlayingShadowEnabled,
  nowPlayingShadowColor,
  nowPlayingShadowOffsetX,
  nowPlayingShadowOffsetY,
  nowPlayingShadowBlur,

  setlistTextColor,

setlistStrokeEnabled,
setlistStrokeColor,
setlistStrokeWidth,

setlistShadowEnabled,
setlistShadowColor,
setlistShadowOffsetX,
setlistShadowOffsetY,
setlistShadowBlur,

  visibleSongs,
  scrollSpeed,
  setlistLineHeight,
};
}

/* =========================================================
   全体描画
========================================================= */

function render() {
  renderControlPage();
  renderDisplayPage();
  renderNowPlaying();
}

/* =========================================================
   index.html 描画
========================================================= */

function renderControlPage() {
  if (!setlistTab) {
    return;
  }

  renderSongCount();
  renderListStyleButtons();
  renderFontControls();
  renderScrollControls();
  renderPreview();
  renderEditor();
}

function renderPreview() {
  if (previewNowPlaying) {
    const nowPlayingFontStack =
      createFontStack(
        state.nowPlayingFontFamily
      );

    if (previewNowPlayingShadow) {
      previewNowPlayingShadow.style.fontFamily =
        nowPlayingFontStack;
      
previewNowPlayingShadow.style.fontSize = "32px";

      previewNowPlayingShadow.style.color =
        "transparent";

      previewNowPlayingShadow.style.webkitTextStroke =
        "0px transparent";

previewNowPlayingShadow.style.textShadow =
  state.nowPlayingShadowEnabled
    ? `${state.nowPlayingShadowOffsetX}px ${state.nowPlayingShadowOffsetY}px ${state.nowPlayingShadowBlur}px ${state.nowPlayingShadowColor}`
    : "none";

previewNowPlayingShadow.style.visibility =
  state.nowPlayingShadowEnabled
    ? "visible"
    : "hidden";
    }

    if (previewNowPlayingStroke) {
      previewNowPlayingStroke.style.fontFamily =
        nowPlayingFontStack;

previewNowPlayingStroke.style.fontSize = "32px";

      previewNowPlayingStroke.style.color =
        "transparent";

      previewNowPlayingStroke.style.webkitTextStroke =
        state.nowPlayingStrokeEnabled
          ? `${state.nowPlayingStrokeWidth}px ${state.nowPlayingStrokeColor}`
          : "0px transparent";

      previewNowPlayingStroke.style.visibility =
        state.nowPlayingStrokeEnabled
          ? "visible"
          : "hidden";
    }

    if (previewNowPlayingFill) {
      previewNowPlayingFill.style.fontFamily =
        nowPlayingFontStack;

previewNowPlayingFill.style.fontSize = "32px";

      previewNowPlayingFill.style.color =
        state.nowPlayingTextColor;

      previewNowPlayingFill.style.webkitTextStroke =
        "0px transparent";
    }

  if (previewNowPlayingMarkerImage) {
  const hasMarkerImage =
    Boolean(state.nowPlayingMarkerImage);

  previewNowPlayingMarkerImage.hidden =
    !hasMarkerImage;

  if (hasMarkerImage) {
    previewNowPlayingMarkerImage.src =
      state.nowPlayingMarkerImage;
  } else {
    previewNowPlayingMarkerImage.removeAttribute(
      "src"
    );
  }
}  
  }

  if (previewSetlist) {
    previewSetlist.style.fontFamily =
      createFontStack(
        state.setlistFontFamily
      );

    previewSetlist.style.lineHeight =
    state.setlistLineHeight;  

    const isNumber =
      state.listStyle === "number";

    previewSetlist.classList.toggle(
      "numberStyle",
      isNumber
    );

    previewSetlist.classList.toggle(
      "bulletStyle",
      !isNumber
    );
  }

let previewMarkerHtml;

if (
  state.listStyle === "image" &&
  state.setlistMarkerImage
) {
previewMarkerHtml =
  `<img
    class="setlistMarkerImage"
    src="${state.setlistMarkerImage}"
    alt=""
style="
  width: ${state.setlistMarkerImageSize / 100}em;
  height: ${state.setlistMarkerImageSize / 100}em;
"
  >`;
} else {
  const previewMarker =
    state.listStyle === "number"
      ? "1."
      : "・";

  previewMarkerHtml =
    `<span class="setlistMarker">${previewMarker}</span>`;
}

const previewTitle =
  "曲名サンプル";

const previewTitleHtml =
  `${previewMarkerHtml}<span class="setlistTitle">${previewTitle}</span>`;

if (previewSetlistShadow) {
  previewSetlistShadow.innerHTML =
    previewTitleHtml;

  previewSetlistShadow.style.color =
    "transparent";

  previewSetlistShadow.style.webkitTextStroke =
    "0px transparent";

  previewSetlistShadow.style.textShadow =
    state.setlistShadowEnabled
      ? `${state.setlistShadowOffsetX}px ${state.setlistShadowOffsetY}px ${state.setlistShadowBlur}px ${state.setlistShadowColor}`
      : "none";

  previewSetlistShadow.style.visibility =
    state.setlistShadowEnabled
      ? "visible"
      : "hidden";
}

if (previewSetlistStroke) {
  previewSetlistStroke.innerHTML =
    previewTitleHtml;

  previewSetlistStroke.style.color =
    "transparent";

  previewSetlistStroke.style.webkitTextStroke =
    state.setlistStrokeEnabled
      ? `${state.setlistStrokeWidth}px ${state.setlistStrokeColor}`
      : "0px transparent";

  previewSetlistStroke.style.visibility =
    state.setlistStrokeEnabled
      ? "visible"
      : "hidden";
}

if (previewSetlistFill) {
  previewSetlistFill.innerHTML =
    previewTitleHtml;

  previewSetlistFill.style.color =
    state.setlistTextColor;

  previewSetlistFill.style.webkitTextStroke =
    "0px transparent";
}

  if (nowPlayingTextColor) {
    nowPlayingTextColor.value =
      state.nowPlayingTextColor;
  }

  if (nowPlayingTextColorValue) {
    nowPlayingTextColorValue.textContent =
      state.nowPlayingTextColor.toUpperCase();
  }

  if (nowPlayingStrokeEnabled) {
    nowPlayingStrokeEnabled.checked =
      state.nowPlayingStrokeEnabled;
  }

  if (nowPlayingStrokeColor) {
    nowPlayingStrokeColor.value =
      state.nowPlayingStrokeColor;
  }

  if (nowPlayingStrokeColorValue) {
    nowPlayingStrokeColorValue.textContent =
      state.nowPlayingStrokeColor.toUpperCase();
  }

  if (nowPlayingStrokeWidth) {
    nowPlayingStrokeWidth.value =
      state.nowPlayingStrokeWidth;
  }

  if (nowPlayingStrokeWidthValue) {
    nowPlayingStrokeWidthValue.textContent =
      `${state.nowPlayingStrokeWidth}px`;
  }

  if (nowPlayingShadowEnabled) {
  nowPlayingShadowEnabled.checked =
    state.nowPlayingShadowEnabled;
}

if (nowPlayingShadowColor) {
  nowPlayingShadowColor.value =
    state.nowPlayingShadowColor;
}

if (nowPlayingShadowColorValue) {
  nowPlayingShadowColorValue.textContent =
    state.nowPlayingShadowColor.toUpperCase();
}

if (nowPlayingShadowOffsetX) {
  nowPlayingShadowOffsetX.value =
    state.nowPlayingShadowOffsetX;
}

if (nowPlayingShadowOffsetXValue) {
  nowPlayingShadowOffsetXValue.textContent =
    `${state.nowPlayingShadowOffsetX}px`;
}

if (nowPlayingShadowOffsetY) {
  nowPlayingShadowOffsetY.value =
    state.nowPlayingShadowOffsetY;
}

if (nowPlayingShadowOffsetYValue) {
  nowPlayingShadowOffsetYValue.textContent =
    `${state.nowPlayingShadowOffsetY}px`;
}

if (nowPlayingShadowBlur) {
  nowPlayingShadowBlur.value =
    state.nowPlayingShadowBlur;
}

if (nowPlayingShadowBlurValue) {
  nowPlayingShadowBlurValue.textContent =
    `${state.nowPlayingShadowBlur}px`;
}

if (setlistTextColor) {
  setlistTextColor.value =
    state.setlistTextColor;
}

if (setlistTextColorValue) {
  setlistTextColorValue.textContent =
    state.setlistTextColor.toUpperCase();
}

if (setlistStrokeEnabled) {
  setlistStrokeEnabled.checked =
    state.setlistStrokeEnabled;
}

if (setlistStrokeColor) {
  setlistStrokeColor.value =
    state.setlistStrokeColor;
}

if (setlistStrokeColorValue) {
  setlistStrokeColorValue.textContent =
    state.setlistStrokeColor.toUpperCase();
}

if (setlistStrokeWidth) {
  setlistStrokeWidth.value =
    state.setlistStrokeWidth;
}

if (setlistStrokeWidthValue) {
  setlistStrokeWidthValue.textContent =
    `${state.setlistStrokeWidth}px`;
}

if (setlistShadowEnabled) {
  setlistShadowEnabled.checked =
    state.setlistShadowEnabled;
}

if (setlistShadowColor) {
  setlistShadowColor.value =
    state.setlistShadowColor;
}

if (setlistShadowColorValue) {
  setlistShadowColorValue.textContent =
    state.setlistShadowColor.toUpperCase();
}

if (setlistShadowOffsetX) {
  setlistShadowOffsetX.value =
    state.setlistShadowOffsetX;
}

if (setlistShadowOffsetXValue) {
  setlistShadowOffsetXValue.textContent =
    `${state.setlistShadowOffsetX}px`;
}

if (setlistShadowOffsetY) {
  setlistShadowOffsetY.value =
    state.setlistShadowOffsetY;
}

if (setlistShadowOffsetYValue) {
  setlistShadowOffsetYValue.textContent =
    `${state.setlistShadowOffsetY}px`;
}

if (setlistShadowBlur) {
  setlistShadowBlur.value =
    state.setlistShadowBlur;
}

if (setlistShadowBlurValue) {
  setlistShadowBlurValue.textContent =
    `${state.setlistShadowBlur}px`;
}

}

function renderSongCount() {
  if (!songCount) {
    return;
  }

  const count = state.songs.length;
  const unit =
    count === 1 ? "SONG" : "SONGS";

  songCount.textContent =
    `${count} ${unit}`;
}

function renderListStyleButtons() {
  if (
    !numberStyleButton ||
    !bulletStyleButton ||
    !imageStyleButton
  ) {
    return;
  }

  const isNumber =
    state.listStyle === "number";

  const isBullet =
    state.listStyle === "bullet";

  const isImage =
    state.listStyle === "image";

  numberStyleButton.classList.toggle(
    "isActive",
    isNumber
  );

  numberStyleButton.setAttribute(
    "aria-checked",
    String(isNumber)
  );

  bulletStyleButton.classList.toggle(
    "isActive",
    isBullet
  );

  bulletStyleButton.setAttribute(
    "aria-checked",
    String(isBullet)
  );

  imageStyleButton.classList.toggle(
    "isActive",
    isImage
  );

  imageStyleButton.setAttribute(
    "aria-checked",
    String(isImage)
  );

  if (setlistMarkerImageControls) {
    setlistMarkerImageControls.hidden =
      !isImage;
  }

if (setlistMarkerImageSize) {
  setlistMarkerImageSize.value =
    state.setlistMarkerImageSize;
}

if (setlistMarkerImageSizeValue) {
setlistMarkerImageSizeValue.textContent =
  `${state.setlistMarkerImageSize}%`;
}  

}

function renderFontControls() {
  if (nowPlayingFontPreset) {
    const matchingOption =
      Array.from(
        nowPlayingFontPreset.options
      ).find(
        (option) =>
          option.value ===
          state.nowPlayingFontFamily
      );

    nowPlayingFontPreset.value =
      matchingOption
        ? state.nowPlayingFontFamily
        : "";
  }

  if (
    nowPlayingFontInput &&
    document.activeElement !==
      nowPlayingFontInput
  ) {
    nowPlayingFontInput.value =
      state.nowPlayingFontFamily;
  }

  if (setlistFontPreset) {
    const matchingOption =
      Array.from(
        setlistFontPreset.options
      ).find(
        (option) =>
          option.value ===
          state.setlistFontFamily
      );

    setlistFontPreset.value =
      matchingOption
        ? state.setlistFontFamily
        : "";
  }

  if (
    setlistFontInput &&
    document.activeElement !==
      setlistFontInput
  ) {
    setlistFontInput.value =
      state.setlistFontFamily;
  }
}

function renderScrollControls() {
  if (
    visibleSongsInput &&
    document.activeElement !==
      visibleSongsInput
  ) {
    visibleSongsInput.value =
      state.visibleSongs;
  }

  if (scrollSpeedInput) {
    scrollSpeedInput.value =
      state.scrollSpeed;
  }

  if (scrollSpeedValue) {
    scrollSpeedValue.textContent =
      state.scrollSpeed;
  }

  if (setlistLineHeightInput) {
  setlistLineHeightInput.value =
    state.setlistLineHeight;
}

if (setlistLineHeightValue) {
  setlistLineHeightValue.textContent =
    state.setlistLineHeight.toFixed(2);
}

}

function renderEditor() {
  if (!setlistEditor) {
    return;
  }

  if (
    document.activeElement !==
    setlistEditor
  ) {
    setlistEditor.value =
      state.songs.join("\n");
  }

  if (editorSongCount) {
    editorSongCount.textContent =
      `現在：${state.songs.length}曲`;
  }
}

/* =========================================================
   display.html 描画
========================================================= */

function renderDisplayPage() {
  if (!displaySetlist) {
    return;
  }

  const scrollContainer =
    displaySetlist.parentElement;

  stopAutoScroll();

  displaySetlist.replaceChildren();

  const shouldLoop =
    state.songs.length >
    state.visibleSongs;

  const loopItems = [];

  /* 1周目 */
  state.songs.forEach(
    (songTitle, index) => {
      loopItems.push({
        type: "song",
        title: songTitle,
        duplicate: false,
        songIndex: index
      });
    }
  );

  if (shouldLoop) {
    /* 空白は常に2行 */
    loopItems.push({
      type: "spacer"
    });

    loopItems.push({
      type: "spacer"
    });

    /* 2周目 */
    state.songs.forEach(
      (songTitle, index) => {
        loopItems.push({
          type: "song",
          title: songTitle,
          duplicate: true,
          songIndex: index
        });
      }
    );
  }

  loopItems.forEach((item) => {
    const listItem =
      document.createElement("li");

      listItem.classList.add(
  "layeredText"
);

    if (item.type === "spacer") {
      listItem.classList.add(
        "loopSpacer"
      );

      listItem.setAttribute(
        "aria-hidden",
        "true"
      );
    } else {

const itemShadow =
  document.createElement("span");

itemShadow.classList.add(
  "layeredTextShadow",
  "setlistTextShadow"
);

const itemStroke =
  document.createElement("span");

itemStroke.classList.add(
  "layeredTextStroke",
  "setlistTextStroke"
);  

const itemFill =
  document.createElement("span");

itemFill.classList.add(
  "layeredTextFill",
  "setlistTextFill"
);

let markerHtml;

if (
  state.listStyle === "image" &&
  state.setlistMarkerImage
) {
markerHtml =
  `<img
    class="setlistMarkerImage"
    src="${state.setlistMarkerImage}"
    alt=""
style="
  width: ${state.setlistMarkerImageSize / 100}em;
  height: ${state.setlistMarkerImageSize / 100}em;
"
  >`;
} else {
  const marker =
    state.listStyle === "number"
      ? `${item.songIndex + 1}.`
      : "・";

  markerHtml =
    `<span class="setlistMarker">${marker}</span>`;
}

const titleHtml =
  `${markerHtml}<span class="setlistTitle">${item.title}</span>`;

itemShadow.innerHTML =
  titleHtml;

itemStroke.innerHTML =
  titleHtml;

itemFill.innerHTML =
  titleHtml;

itemShadow.style.color =
  "transparent";

itemShadow.style.webkitTextStroke =
  "0px transparent";

itemShadow.style.textShadow =
  state.setlistShadowEnabled
    ? `${state.setlistShadowOffsetX}px ${state.setlistShadowOffsetY}px ${state.setlistShadowBlur}px ${state.setlistShadowColor}`
    : "none";

itemShadow.style.visibility =
  state.setlistShadowEnabled
    ? "visible"
    : "hidden";

itemStroke.style.color =
  "transparent";

itemStroke.style.webkitTextStroke =
  state.setlistStrokeEnabled
    ? `${state.setlistStrokeWidth}px ${state.setlistStrokeColor}`
    : "0px transparent";

itemStroke.style.visibility =
  state.setlistStrokeEnabled
    ? "visible"
    : "hidden";  

itemFill.style.color =
  state.setlistTextColor;

itemFill.style.color =
  state.setlistTextColor;

itemFill.style.webkitTextStroke =
  "0px transparent";

listItem.appendChild(
  itemShadow
);

listItem.appendChild(
  itemStroke
);

listItem.appendChild(
  itemFill
);

      if (item.duplicate) {
        listItem.setAttribute(
          "aria-hidden",
          "true"
        );

        if (item.songIndex === 0) {
          listItem.value = 1;
        }
      }
    }

    displaySetlist.appendChild(
      listItem
    );
  });

  renderDisplayStyle();

  requestAnimationFrame(() => {
    if (scrollContainer) {
      scrollContainer.scrollTop = 0;
    }

    startAutoScroll();
  });
}

function renderDisplayStyle() {
  if (!displaySetlist) {
    return;
  }

  const isNumber =
    state.listStyle === "number";

  displaySetlist.classList.toggle(
    "numberStyle",
    isNumber
  );

  displaySetlist.classList.toggle(
    "bulletStyle",
    !isNumber
  );

displaySetlist.style.fontFamily =
  createFontStack(
    state.setlistFontFamily
  );

displaySetlist.style.fontSize =
  "60px";

displaySetlist.style.lineHeight =
  state.setlistLineHeight;

displaySetlist.style.paddingBottom =
  "0";

const scrollContainer =
  displaySetlist.parentElement;

if (scrollContainer) {
const fontSize = 60;
const lineHeight =
  fontSize * state.setlistLineHeight;
  
  const rowGap = 11;
  const verticalPadding = 60;

  scrollContainer.style.height =
    `${
      state.visibleSongs * lineHeight +
      Math.max(0, state.visibleSongs - 1) * rowGap +
      verticalPadding
    }px`;

  scrollContainer.style.overflow =
    "hidden";
}

} // ←これが必要

function startAutoScroll() {
  if (!displaySetlist) {
    return;
  }

  if (
    state.songs.length <=
    state.visibleSongs
  ) {
    displaySetlist.style.transform =
      "translate3d(0, 0, 0)";

    return;
  }

  const listItems =
    displaySetlist.querySelectorAll(
      "li"
    );

  /*
    2セット目の先頭位置を取得する
  */
  const firstItem =
    listItems[0];

const duplicatedFirstItem =
  listItems[
    state.songs.length + 2
  ];

  if (
    !firstItem ||
    !duplicatedFirstItem
  ) {
    return;
  }

  const loopDistance =
    duplicatedFirstItem.offsetTop -
    firstItem.offsetTop;

  if (loopDistance <= 0) {
    return;
  }

  let position = 0;

  autoScrollLastTime = null;

  const animate = (currentTime) => {
    if (autoScrollLastTime === null) {
      autoScrollLastTime =
        currentTime;
    }

    const elapsedSeconds =
      Math.min(
        0.1,
        (
          currentTime -
          autoScrollLastTime
        ) / 1000
      );

    autoScrollLastTime =
      currentTime;

    position +=
      state.scrollSpeed *
      elapsedSeconds;

    /*
      1セット分進んだら、
      見た目が同じ位置のまま
      座標だけ先頭へ戻す
    */
    if (position >= loopDistance) {
      position -= loopDistance;
    }

    displaySetlist.style.transform =
      `translate3d(0, -${position}px, 0)`;

    autoScrollAnimationId =
      requestAnimationFrame(
        animate
      );
  };

  autoScrollAnimationId =
    requestAnimationFrame(
      animate
    );
}

function stopAutoScroll() {
  if (
    autoScrollAnimationId !== null
  ) {
    cancelAnimationFrame(
      autoScrollAnimationId
    );

    autoScrollAnimationId = null;
  }

  if (
    autoScrollResetTimer !== null
  ) {
    clearTimeout(
      autoScrollResetTimer
    );

    autoScrollResetTimer = null;
  }

  autoScrollLastTime = null;

  if (displaySetlist) {
    displaySetlist.style.transform =
      "translate3d(0, 0, 0)";
  }
}

/* =========================================================
   nowplaying.html 描画
========================================================= */

function stopNowPlayingScroll() {
  if (nowPlayingAnimation) {
    cancelAnimationFrame(nowPlayingAnimation);
    nowPlayingAnimation = null;
  }

  if (currentSongElement) {
    currentSongElement.style.transform =
      "translate3d(0,0,0)";
  }
}

function startNowPlayingScroll() {
  if (
    !currentSongElement ||
    !currentSongFill
  ) {
    return;
  }

  stopNowPlayingScroll();

  const viewport =
    currentSongElement.parentElement;

  const viewportWidth =
    viewport.clientWidth;

  const textWidth =
    currentSongFill.scrollWidth;

if (textWidth <= viewportWidth) {
  viewport.style.justifyContent =
    "flex-start";

  currentSongElement.style.transform =
    "translate3d(0,0,0)";

  currentSongElement.style.opacity =
    "1";

  return;
}

viewport.style.justifyContent =
  "flex-start";

const fontSize = 60;

const endPadding =
  fontSize * 2.5;

const distance =
  textWidth -
  viewportWidth +
  endPadding;

  const speed = 40;

  const waitStart = 3500;
  const waitEnd = 1000;
  const fadeDuration = 1500;
  const waitAfterFade = 700;

  let startTime = null;

  function animate(now) {

    if (!startTime) {
      startTime = now;
    }

    const elapsed =
      now - startTime;

    let x = 0;

if (elapsed < waitStart) {
  x = 0;
  currentSongElement.style.opacity = "1";
    } else {

      const scrollElapsed =
        elapsed - waitStart;

      const scrollTime =
        (distance / speed) * 1000;

      if (scrollElapsed < scrollTime) {

        x =
          -(scrollElapsed / scrollTime)
          * distance;

} else if (
  scrollElapsed <
  scrollTime + waitEnd
) {
  // 最後まで進んだ位置で待機
  x = -distance;
  currentSongElement.style.opacity = "1";

} else if (
  scrollElapsed <
  scrollTime + waitEnd + fadeDuration
) {
  // ゆっくり薄くして消す
  x = -distance;

  const fadeElapsed =
    scrollElapsed -
    scrollTime -
    waitEnd;

  const opacity =
    1 - fadeElapsed / fadeDuration;

  currentSongElement.style.opacity =
    String(Math.max(0, opacity));

} else if (
  scrollElapsed <
  scrollTime +
  waitEnd +
  fadeDuration +
  waitAfterFade
) {
  // フェードアウト後、そのまま待機
  x = -distance;
  currentSongElement.style.opacity = "0";

} else {
  // 先頭へ戻る
  startTime = now;
  x = 0;
  currentSongElement.style.opacity = "1";
}
    }

    currentSongElement.style.transform =
      `translate3d(${x}px,0,0)`;

    nowPlayingAnimation =
      requestAnimationFrame(
        animate
      );
  }

  nowPlayingAnimation =
    requestAnimationFrame(
      animate
    );
}

function renderNowPlaying() {
  if (!currentSongElement) {
    return;
  }

const currentSong =
  state.currentSong || "";

const isNewSong =
  Boolean(currentSong) &&
  currentSong !== lastNowPlayingSong;  

if (!currentSong && lastNowPlayingSong) {
  nowPlayingRow?.classList.add(
    "isFadeOut"
  );

  if (nowPlayingClearTimer !== null) {
    clearTimeout(nowPlayingClearTimer);
  }

  nowPlayingClearTimer =
    window.setTimeout(() => {
      if (currentSongShadow) {
        currentSongShadow.textContent = "";
      }

      if (currentSongStroke) {
        currentSongStroke.textContent = "";
      }

      if (currentSongFill) {
        currentSongFill.textContent = "";
      }

      if (currentSongMarkerImage) {
        currentSongMarkerImage.hidden = true;
        currentSongMarkerImage.removeAttribute(
          "src"
        );
      }

      nowPlayingRow?.classList.remove(
        "isFadeOut"
      );

      lastNowPlayingSong = "";
      nowPlayingClearTimer = null;
    }, 500);

  return;
}

if (currentSong) {
  if (nowPlayingClearTimer !== null) {
    clearTimeout(nowPlayingClearTimer);
    nowPlayingClearTimer = null;
  }
  nowPlayingRow?.classList.remove(
    "isFadeOut"
  );

}

const hasSong =
  currentSong.length > 0;

if (currentSongMarkerImage) {
  const hasMarkerImage =
    Boolean(state.nowPlayingMarkerImage);

  const showMarker =
    hasMarkerImage && hasSong;

  currentSongMarkerImage.hidden =
    !showMarker;

  if (showMarker) {
    currentSongMarkerImage.src =
      state.nowPlayingMarkerImage;
  } else {
    currentSongMarkerImage.removeAttribute(
      "src"
    );
  }
}

if (currentSongStroke) {
  currentSongStroke.textContent =
    currentSong;
}

if (currentSongShadow) {
  currentSongShadow.textContent =
    currentSong;
}

if (currentSongFill) {
  currentSongFill.textContent =
    currentSong;
}

const nowPlayingFontStack =
  createFontStack(
    state.nowPlayingFontFamily
  );

if (nowPlayingGlowColor) {
  nowPlayingGlowColor.setAttribute(
    "flood-color",
    state.nowPlayingShadowColor
  );
}  

if (currentSongShadow) {
  currentSongShadow.style.fontFamily =
    nowPlayingFontStack;

  currentSongShadow.style.fontSize =
    "60px";

  currentSongShadow.style.fontWeight =
    "400";

  /*
    縁取り込みの文字シルエットを
    シャドウ色で作る
  */
  currentSongShadow.style.color =
    state.nowPlayingShadowColor;

  currentSongShadow.style.webkitTextStroke =
    state.nowPlayingStrokeEnabled
      ? `${state.nowPlayingStrokeWidth}px ${state.nowPlayingShadowColor}`
      : "0px transparent";

  /*
    文字レイヤー自体を指定位置へ移動する
  */
  currentSongShadow.style.transform =
    state.nowPlayingShadowEnabled
      ? `translate(
          ${state.nowPlayingShadowOffsetX}px,
          ${state.nowPlayingShadowOffsetY}px
        )`
      : "translate(0, 0)";

  /*
    移動後の文字全体をぼかす
  */
currentSongShadow.style.transform =
  state.nowPlayingShadowEnabled
    ? `translate(
        ${state.nowPlayingShadowOffsetX}px,
        ${state.nowPlayingShadowOffsetY}px
      )`
    : "translate(0, 0)";

currentSongShadow.style.filter =
  state.nowPlayingShadowEnabled &&
  state.nowPlayingShadowBlur > 0
    ? `blur(${state.nowPlayingShadowBlur}px)`
    : "none";

currentSongShadow.style.textShadow = "none";

  currentSongShadow.style.visibility =
    state.nowPlayingShadowEnabled
      ? "visible"
      : "hidden";
}

if (currentSongStroke) {
  currentSongStroke.style.fontFamily =
    nowPlayingFontStack;

  currentSongStroke.style.color =
    "transparent";

  currentSongStroke.style.webkitTextStroke =
    state.nowPlayingStrokeEnabled
      ? `${state.nowPlayingStrokeWidth}px ${state.nowPlayingStrokeColor}`
      : "0px transparent";

  currentSongStroke.style.fontSize =
    "60px";

  currentSongStroke.style.fontWeight =
    "400";

  currentSongStroke.style.visibility =
    state.nowPlayingStrokeEnabled
      ? "visible"
      : "hidden";
}

if (currentSongFill) {
  currentSongFill.style.fontFamily =
    nowPlayingFontStack;

  currentSongFill.style.color =
    state.nowPlayingTextColor;

  currentSongFill.style.webkitTextStroke =
  "0px transparent";

  currentSongFill.style.fontSize =
    "60px";

  currentSongFill.style.fontWeight =
    "400";
}

if (isNewSong && nowPlayingRow) {
  nowPlayingRow.classList.remove(
    "isFadeOut"
  );

  nowPlayingRow.animate(
    [
      { opacity: 0 },
      { opacity: 1 }
    ],
    {
      duration: 1000,
      easing: "ease",
      fill: "none"
    }
  );
}

lastNowPlayingSong = currentSong;

if (document.fonts?.ready) {
  document.fonts.ready.then(() => {
    startNowPlayingScroll();
  });
} else {
  startNowPlayingScroll();
}

}

/* =========================================================
   Now Playing操作
========================================================= */

function setCurrentSong(songTitle) {
  const normalizedTitle =
    String(songTitle ?? "").trim();

  updateState({
    currentSong: normalizedTitle
  });
}

function clearCurrentSong() {
  updateState({
    currentSong: ""
  });
}

/*
  現在の曲をセットリストへ追加し、
  Now Playingを空にする。
*/

function finishCurrentSong() {
  if (!state.currentSong) {
    return;
  }

  updateState({
    songs: [
      ...state.songs,
      state.currentSong
    ],
    currentSong: ""
  });
}

/*
  プレイヤー側や開発者ツールの
  コンソールから呼び出せるようにする。
*/

window.setCurrentSong =
  setCurrentSong;

window.clearCurrentSong =
  clearCurrentSong;

window.finishCurrentSong =
  finishCurrentSong;

/* =========================================================
   フォント操作
========================================================= */

function applyNowPlayingFont(
  fontName
) {
  const normalizedFontName =
    String(fontName ?? "").trim();

  if (!normalizedFontName) {
    return;
  }

  updateState({
    nowPlayingFontFamily:
      normalizedFontName
  });
}

function applySetlistFont(
  fontName
) {
  const normalizedFontName =
    String(fontName ?? "").trim();

  if (!normalizedFontName) {
    return;
  }

  updateState({
    setlistFontFamily:
      normalizedFontName
  });
}

/* =========================================================
   タブ切り替え
========================================================= */

function switchSettingsTab(tabName) {
  const isSetlist =
    tabName === "setlist";

  const isNowPlaying =
    tabName === "nowPlaying";

  const isEditor =
    tabName === "editor";

if (setlistTab) {
  setlistTab.hidden =
    !isSetlist;
}

if (nowPlayingTab) {
  nowPlayingTab.hidden =
    !isNowPlaying;
}

if (editorTab) {
  editorTab.hidden =
    !isEditor;
}

  setlistTabButton?.classList.toggle(
    "isActive",
    isSetlist
  );

  nowPlayingTabButton?.classList.toggle(
    "isActive",
    isNowPlaying
  );

  editorTabButton?.classList.toggle(
    "isActive",
    isEditor
  );
}

/* =========================================================
   index.html イベント
========================================================= */

setlistTabButton?.addEventListener(
  "click",
  () => {
    switchSettingsTab(
      "setlist"
    );
  }
);

nowPlayingTabButton?.addEventListener(
  "click",
  () => {
    switchSettingsTab(
      "nowPlaying"
    );
  }
);

editorTabButton?.addEventListener(
  "click",
  () => {
    switchSettingsTab("editor");
  }
);

setlistEditor?.addEventListener(
  "input",
  () => {
    const songs =
      setlistEditor.value
        .split("\n")
        .map((song) => song.trim())
        .filter(Boolean);

    if (editorSongCount) {
      editorSongCount.textContent =
        `現在：${songs.length}曲`;
    }
  }
);

updateEditorButton?.addEventListener(
  "click",
  async () => {
    if (!setlistEditor) {
      return;
    }

    const songs =
      setlistEditor.value
        .split("\n")
        .map((song) => song.trim())
        .filter(Boolean);

    await updateState({
      songs
    });
  }
);

numberStyleButton?.addEventListener(
  "click",
  () => {
    updateState({
      listStyle: "number"
    });
  }
);

bulletStyleButton?.addEventListener(
  "click",
  () => {
    updateState({
      listStyle: "bullet"
    });
  }
);

imageStyleButton?.addEventListener(
  "click",
  () => {
    updateState({
      listStyle: "image"
    });
  }
);

setlistMarkerImageButton?.addEventListener(
  "click",
  () => {
    setlistMarkerImageInput?.click();
  }
);

nowPlayingMarkerImageButton?.addEventListener(
  "click",
  () => {
    nowPlayingMarkerImageInput?.click();
  }
);

clearNowPlayingMarkerImageButton?.addEventListener(
  "click",
  async () => {
    await updateState({
      nowPlayingMarkerImage: ""
    });

    nowPlayingMarkerImageInput.value = "";

    if (nowPlayingMarkerImageName) {
      nowPlayingMarkerImageName.textContent =
        "未選択（PNG・JPEG・WebP・GIF対応）";
    }
  }
);

setlistMarkerImageInput?.addEventListener(
  "change",
  () => {
    const file =
      setlistMarkerImageInput.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      alert("画像ファイルを選択してください。");
      setlistMarkerImageInput.value = "";
      return;
    }

if (setlistMarkerImageName) {
setlistMarkerImageName.textContent =
  `✓ ${file.name}（PNG・JPEG・WebP・GIF対応）`;
}

    const reader = new FileReader();

    reader.addEventListener("load", async () => {
      if (typeof reader.result !== "string") {
        return;
      }

      await updateState({
        setlistMarkerImage: reader.result,
        listStyle: "image"
      });
    });

    reader.addEventListener("error", () => {
      alert("画像を読み込めませんでした。");
    });

    reader.readAsDataURL(file);
  }
);

nowPlayingMarkerImageInput?.addEventListener(
  "change",
  () => {
    const file =
      nowPlayingMarkerImageInput.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      alert("画像ファイルを選択してください。");
      nowPlayingMarkerImageInput.value = "";
      return;
    }

    if (nowPlayingMarkerImageName) {
      nowPlayingMarkerImageName.textContent =
        `✓ ${file.name}（PNG・JPEG・WebP・GIF対応）`;
    }

    const reader = new FileReader();

    reader.addEventListener("load", async () => {
      if (typeof reader.result !== "string") {
        return;
      }

      await updateState({
        nowPlayingMarkerImage: reader.result
      });
    });

    reader.addEventListener("error", () => {
      alert("画像を読み込めませんでした。");
    });

    reader.readAsDataURL(file);
  }
);

nowPlayingFontPreset?.addEventListener(
  "change",
  () => {
    if (!nowPlayingFontPreset.value) {
      return;
    }

    applyNowPlayingFont(
      nowPlayingFontPreset.value
    );
  }
);

applyNowPlayingFontButton?.addEventListener(
  "click",
  () => {
    if (!nowPlayingFontInput) {
      return;
    }

    applyNowPlayingFont(
      nowPlayingFontInput.value
    );
  }
);

nowPlayingTextColor?.addEventListener(
  "input",
  () => {
    if (nowPlayingTextColorValue) {
      nowPlayingTextColorValue.textContent =
        nowPlayingTextColor.value.toUpperCase();
    }

    if (previewNowPlaying) {
      previewNowPlaying.style.color =
        nowPlayingTextColor.value;
    }
  }
);

setlistTextColor?.addEventListener(
  "input",
  () => {
    if (setlistTextColorValue) {
      setlistTextColorValue.textContent =
        setlistTextColor.value.toUpperCase();
    }

    state.setlistTextColor =
      setlistTextColor.value;

    renderPreview();
  }
);

setlistStrokeEnabled?.addEventListener(
  "change",
  async () => {
    state.setlistStrokeEnabled =
      setlistStrokeEnabled.checked;

    renderPreview();

    await updateState({
      setlistStrokeEnabled:
        setlistStrokeEnabled.checked,
    });
  }
);

setlistStrokeColor?.addEventListener(
  "input",
  () => {
    if (setlistStrokeColorValue) {
      setlistStrokeColorValue.textContent =
        setlistStrokeColor.value.toUpperCase();
    }

    state.setlistStrokeColor =
      setlistStrokeColor.value;

    renderPreview();
  }
);

setlistStrokeColor?.addEventListener(
  "change",
  async () => {
    await updateState({
      setlistStrokeColor:
        setlistStrokeColor.value,
    });
  }
);

setlistStrokeWidth?.addEventListener(
  "input",
  () => {
    if (setlistStrokeWidthValue) {
      setlistStrokeWidthValue.textContent =
        `${setlistStrokeWidth.value}px`;
    }

    state.setlistStrokeWidth =
      Number(setlistStrokeWidth.value);

    renderPreview();
  }
);

setlistStrokeWidth?.addEventListener(
  "change",
  async () => {
    await updateState({
      setlistStrokeWidth:
        Number(setlistStrokeWidth.value),
    });
  }
);

if (setlistStrokeEnabled) {
  setlistStrokeEnabled.checked =
    state.setlistStrokeEnabled;
}

if (setlistStrokeColor) {
  setlistStrokeColor.value =
    state.setlistStrokeColor;
}

if (setlistStrokeColorValue) {
  setlistStrokeColorValue.textContent =
    state.setlistStrokeColor.toUpperCase();
}

if (setlistStrokeWidth) {
  setlistStrokeWidth.value =
    state.setlistStrokeWidth;
}

if (setlistStrokeWidthValue) {
  setlistStrokeWidthValue.textContent =
    `${state.setlistStrokeWidth}px`;
}

setlistTextColor?.addEventListener(
  "change",
  async () => {
    await updateState({
      setlistTextColor:
        setlistTextColor.value,
    });
  }
);

nowPlayingStrokeColor?.addEventListener(
  "input",
  () => {
    if (nowPlayingStrokeColorValue) {
      nowPlayingStrokeColorValue.textContent =
        nowPlayingStrokeColor.value.toUpperCase();
    }

    if (
      previewNowPlaying &&
      nowPlayingStrokeEnabled?.checked
    ) {
      previewNowPlaying.style.webkitTextStroke =
        `${nowPlayingStrokeWidth.value}px ${nowPlayingStrokeColor.value}`;
    }
  }
);

nowPlayingStrokeWidth?.addEventListener(
  "input",
  () => {
    if (nowPlayingStrokeWidthValue) {
      nowPlayingStrokeWidthValue.textContent =
        `${nowPlayingStrokeWidth.value}px`;
    }

    if (
      previewNowPlaying &&
      nowPlayingStrokeEnabled?.checked
    ) {
      previewNowPlaying.style.webkitTextStroke =
        `${nowPlayingStrokeWidth.value}px ${nowPlayingStrokeColor.value}`;
    }
  }
);

nowPlayingStrokeEnabled?.addEventListener(
  "change",
  () => {
    if (!previewNowPlaying) {
      return;
    }

    if (nowPlayingStrokeEnabled.checked) {
      previewNowPlaying.style.webkitTextStroke =
        `${nowPlayingStrokeWidth.value}px ${nowPlayingStrokeColor.value}`;
    } else {
      previewNowPlaying.style.webkitTextStroke =
        "0px transparent";
    }
  }
);

nowPlayingTextColor?.addEventListener(
  "change",
  async () => {
    await updateState({
      nowPlayingTextColor:
        nowPlayingTextColor.value
    });
  }
);

nowPlayingStrokeEnabled?.addEventListener(
  "change",
  async () => {
    await updateState({
      nowPlayingStrokeEnabled:
        nowPlayingStrokeEnabled.checked,
    });
  }
);

function updateNowPlayingShadowPreview() {
  if (!previewNowPlayingShadow) {
    return;
  }

  previewNowPlayingShadow.style.textShadow =
    nowPlayingShadowEnabled.checked
      ? `${nowPlayingShadowOffsetX.value}px ${nowPlayingShadowOffsetY.value}px ${nowPlayingShadowBlur.value}px ${nowPlayingShadowColor.value}`
      : "none";
}

nowPlayingShadowEnabled?.addEventListener(
  "change",
  async () => {
    updateNowPlayingShadowPreview();

    await updateState({
      nowPlayingShadowEnabled:
        nowPlayingShadowEnabled.checked,
    });
  }
);

setlistShadowEnabled?.addEventListener(
  "change",
  async () => {

    state.setlistShadowEnabled =
      setlistShadowEnabled.checked;

    renderPreview();

    await updateState({
      setlistShadowEnabled:
        setlistShadowEnabled.checked,
    });
  }
);

nowPlayingShadowColor?.addEventListener(
  "input",
  () => {
    if (nowPlayingShadowColorValue) {
      nowPlayingShadowColorValue.textContent =
        nowPlayingShadowColor.value.toUpperCase();
    }

    updateNowPlayingShadowPreview();
  }
);

nowPlayingShadowColor?.addEventListener(
  "change",
  async () => {
    await updateState({
      nowPlayingShadowColor:
        nowPlayingShadowColor.value,
    });
  }
);

setlistShadowColor?.addEventListener(
  "input",
  () => {
    if (setlistShadowColorValue) {
      setlistShadowColorValue.textContent =
        setlistShadowColor.value.toUpperCase();
    }

    state.setlistShadowColor =
      setlistShadowColor.value;

    renderPreview();
  }
);

setlistShadowColor?.addEventListener(
  "change",
  async () => {
    await updateState({
      setlistShadowColor:
        setlistShadowColor.value,
    });
  }
);

nowPlayingShadowOffsetX?.addEventListener(
  "input",
  () => {
    if (nowPlayingShadowOffsetXValue) {
      nowPlayingShadowOffsetXValue.textContent =
        `${nowPlayingShadowOffsetX.value}px`;
    }

    updateNowPlayingShadowPreview();
  }
);

nowPlayingShadowOffsetX?.addEventListener(
  "change",
  async () => {
    await updateState({
      nowPlayingShadowOffsetX: Number(
        nowPlayingShadowOffsetX.value
      ),
    });
  }
);

setlistShadowOffsetX?.addEventListener(
  "input",
  () => {
    if (setlistShadowOffsetXValue) {
      setlistShadowOffsetXValue.textContent =
        `${setlistShadowOffsetX.value}px`;
    }

    state.setlistShadowOffsetX =
      Number(setlistShadowOffsetX.value);

    renderPreview();
  }
);

setlistShadowOffsetX?.addEventListener(
  "change",
  async () => {
    await updateState({
      setlistShadowOffsetX: Number(
        setlistShadowOffsetX.value
      ),
    });
  }
);

nowPlayingShadowOffsetY?.addEventListener(
  "input",
  () => {
    if (nowPlayingShadowOffsetYValue) {
      nowPlayingShadowOffsetYValue.textContent =
        `${nowPlayingShadowOffsetY.value}px`;
    }

    updateNowPlayingShadowPreview();
  }
);

nowPlayingShadowOffsetY?.addEventListener(
  "change",
  async () => {
    await updateState({
      nowPlayingShadowOffsetY: Number(
        nowPlayingShadowOffsetY.value
      ),
    });
  }
);

setlistShadowOffsetY?.addEventListener(
  "input",
  () => {
    if (setlistShadowOffsetYValue) {
      setlistShadowOffsetYValue.textContent =
        `${setlistShadowOffsetY.value}px`;
    }

    state.setlistShadowOffsetY =
      Number(setlistShadowOffsetY.value);

    renderPreview();
  }
);

setlistShadowOffsetY?.addEventListener(
  "change",
  async () => {
    await updateState({
      setlistShadowOffsetY: Number(
        setlistShadowOffsetY.value
      ),
    });
  }
);

nowPlayingShadowBlur?.addEventListener(
  "input",
  () => {
    if (nowPlayingShadowBlurValue) {
      nowPlayingShadowBlurValue.textContent =
        `${nowPlayingShadowBlur.value}px`;
    }

    updateNowPlayingShadowPreview();
  }
);

nowPlayingShadowBlur?.addEventListener(
  "change",
  async () => {
    await updateState({
      nowPlayingShadowBlur: Number(
        nowPlayingShadowBlur.value
      ),
    });
  }
);

setlistShadowBlur?.addEventListener(
  "input",
  () => {
    if (setlistShadowBlurValue) {
      setlistShadowBlurValue.textContent =
        `${setlistShadowBlur.value}px`;
    }

    state.setlistShadowBlur =
      Number(setlistShadowBlur.value);

    renderPreview();
  }
);

setlistShadowBlur?.addEventListener(
  "change",
  async () => {
    await updateState({
      setlistShadowBlur: Number(
        setlistShadowBlur.value
      ),
    });
  }
);

nowPlayingStrokeColor?.addEventListener(
  "change",
  async () => {
    await updateState({
      nowPlayingStrokeColor:
        nowPlayingStrokeColor.value,
    });
  }
);

nowPlayingStrokeWidth?.addEventListener(
  "change",
  async () => {
    await updateState({
      nowPlayingStrokeWidth:
        Number(
          nowPlayingStrokeWidth.value
        ),
    });
  }
);

nowPlayingFontInput?.addEventListener(
  "keydown",
  (event) => {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();

    applyNowPlayingFont(
      nowPlayingFontInput.value
    );
  }
);

setlistFontPreset?.addEventListener(
  "change",
  () => {
    if (!setlistFontPreset.value) {
      return;
    }

    applySetlistFont(
      setlistFontPreset.value
    );
  }
);

applySetlistFontButton?.addEventListener(
  "click",
  () => {
    if (!setlistFontInput) {
      return;
    }

    applySetlistFont(
      setlistFontInput.value
    );
  }
);

setlistFontInput?.addEventListener(
  "keydown",
  (event) => {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();

    applySetlistFont(
      setlistFontInput.value
    );
  }
);

visibleSongsInput?.addEventListener(
  "change",
  async () => {
    const visibleSongs =
      Math.max(
        1,
        Number(
          visibleSongsInput.value
        ) || DEFAULT_STATE.visibleSongs
      );

    visibleSongsInput.value =
      visibleSongs;

    await updateState({
      visibleSongs
    });
  }
);

scrollSpeedInput?.addEventListener(
  "input",
  () => {
    if (scrollSpeedValue) {
      scrollSpeedValue.textContent =
        scrollSpeedInput.value;
    }
  }
);

setlistLineHeightInput?.addEventListener(
  "input",
  async () => {
    const value =
      Number(setlistLineHeightInput.value);

    state.setlistLineHeight = value;

if (setlistLineHeightValue) {
  setlistLineHeightValue.textContent =
    value.toFixed(2);
}

    renderPreview();

    await updateState({
      setlistLineHeight: value,
    });
  }
);

scrollSpeedInput?.addEventListener(
  "change",
  async () => {
    const scrollSpeed =
      Math.max(
        1,
        Number(
          scrollSpeedInput.value
        ) || DEFAULT_STATE.scrollSpeed
      );

    await updateState({
      scrollSpeed
    });
  }
);

setlistMarkerImageSize?.addEventListener(
  "input",
  () => {
    const value =
      Number(setlistMarkerImageSize.value);

    state.setlistMarkerImageSize = value;

    if (setlistMarkerImageSizeValue) {
setlistMarkerImageSizeValue.textContent =
  `${value}%`;
    }

    renderPreview();
    renderDisplayPage();
  }
);

setlistMarkerImageSize?.addEventListener(
  "change",
  async () => {
    const value =
      Number(setlistMarkerImageSize.value);

    await updateState({
      setlistMarkerImageSize: value
    });
  }
);

sendNowPlayingButton?.addEventListener(
  "click",
  async () => {
    const songTitle =
      editorSongInput?.value.trim();

    if (!songTitle) {
      return;
    }

    await setCurrentSong(songTitle);
  }
);

addCurrentSongButton?.addEventListener(
  "click",
  async () => {
    const inputSongTitle =
      editorSongInput?.value.trim();

    const songTitle =
      inputSongTitle ||
      state.currentSong;

    if (!songTitle) {
      return;
    }

    await updateState({
      songs: [
        ...state.songs,
        songTitle
      ],
      currentSong: ""
    });

    if (editorSongInput) {
      editorSongInput.value = "";
      editorSongInput.focus();
    }
  }
);

if (copyNowPlayingUrlButton) {
  copyNowPlayingUrlButton.addEventListener(
    "click",
    async () => {
      const url =
        `${window.location.origin}` +
        `${window.location.pathname.replace(/[^/]+$/, "")}` +
        `nowplaying.html?id=${encodeURIComponent(roomId)}`;

      await navigator.clipboard.writeText(url);

const originalText =
  copyNowPlayingUrlButton.textContent;

copyNowPlayingUrlButton.textContent =
  "✓ COPIED!";

setTimeout(() => {
  copyNowPlayingUrlButton.textContent =
    originalText;
}, 1000);
    }
  );
}

if (copySetlistUrlButton) {
  copySetlistUrlButton.addEventListener(
    "click",
    async () => {
      const url =
        `${window.location.origin}` +
        `${window.location.pathname.replace(/[^/]+$/, "")}` +
        `display.html?id=${encodeURIComponent(roomId)}`;

      await navigator.clipboard.writeText(url);

const originalText =
  copySetlistUrlButton.textContent;

copySetlistUrlButton.textContent =
  "✓ COPIED!";

setTimeout(() => {
  copySetlistUrlButton.textContent =
    originalText;
}, 1000);
    }
  );
}

/* =========================================================
   ページ間同期
========================================================= */

/*
  ページを再表示した時に
  最新状態を読み込む。
*/

window.addEventListener(
  "pageshow",
  () => {
    refreshState();
  }
);

/*
  OBSブラウザソースなどで
  storageイベントが発生しない場合に備え、
  1秒ごとに保存内容を確認する。
*/

window.setInterval(() => {
  refreshState();
}, POLLING_INTERVAL);

async function refreshState() {
  if (isLoading) {
    return;
  }

  isLoading = true;

  try {
    const latestState =
      await loadState();

    const latestSavedData =
      JSON.stringify(latestState);

    if (
      latestSavedData ===
      lastSavedData
    ) {
      return;
    }

    state = latestState;
    lastSavedData =
      latestSavedData;

    render();
  } finally {
    isLoading = false;
  }
}

/* =========================================================
   補助関数
========================================================= */

function createFontStack(fontName) {
  const safeFontName =
    fontName.replace(
      /["\\]/g,
      ""
    );

  return `"${safeFontName}", "Yu Gothic", "Meiryo", sans-serif`;
}

window.addEventListener(
  "resize",
  () => {
    if (nowPlayingResizeTimer) {
      clearTimeout(
        nowPlayingResizeTimer
      );
    }

    nowPlayingResizeTimer =
      setTimeout(() => {
        startNowPlayingScroll();
      }, 200);
  }
);

/* =========================================================
   初期表示
========================================================= */

(async () => {

const nowPlayingPageLink =
  document.getElementById(
    "nowPlayingPageLink"
  );

const setlistPageLink =
  document.getElementById(
    "setlistPageLink"
  );

const playerPageLink =
  document.getElementById(
    "playerPageLink"
  );

if (nowPlayingPageLink) {
  nowPlayingPageLink.href =
    `./nowplaying.html?id=${encodeURIComponent(roomId)}`;
}

if (setlistPageLink) {
  setlistPageLink.href =
    `./display.html?id=${encodeURIComponent(roomId)}`;
}

if (playerPageLink) {
  playerPageLink.href =
    `https://haishintool.github.io/youtube-player/?id=${encodeURIComponent(roomId)}`;
}

state =
  await loadState();

connectRoomWebSocket();  

lastSavedData =
  JSON.stringify(state);

render();

switchSettingsTab(
  "setlist"
);

})();