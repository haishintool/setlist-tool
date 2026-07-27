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

const POLLING_INTERVAL = 1000;

const DEFAULT_STATE = {
  songs: [],
  currentSong: "",
  listStyle: "number",
  fontFamily: "Yu Gothic",
  fontSize: 32,
  showTitle: false
};

const MIN_FONT_SIZE = 16;
const MAX_FONT_SIZE = 96;
const FONT_SIZE_STEP = 2;

/* =========================================================
   状態管理
========================================================= */

let state = { ...DEFAULT_STATE };
let lastSavedData = JSON.stringify(state);
let lastFocusedElement = null;
let isSaving = false;
let saveRequested = false;
let isLoading = false;

/* =========================================================
   HTML要素取得
========================================================= */

/* index.html側 */

const songForm =
  document.getElementById("songForm");

const songInput =
  document.getElementById("songInput");

const songCount =
  document.getElementById("songCount");

const numberStyleButton =
  document.getElementById("numberStyleButton");

const bulletStyleButton =
  document.getElementById("bulletStyleButton");

const fontPreset =
  document.getElementById("fontPreset");

const fontInput =
  document.getElementById("fontInput");

const applyFontButton =
  document.getElementById("applyFontButton");

const decreaseFontSizeButton =
  document.getElementById("decreaseFontSizeButton");

const increaseFontSizeButton =
  document.getElementById("increaseFontSizeButton");

const fontSizeValue =
  document.getElementById("fontSizeValue");

const showTitleToggle =
  document.getElementById("showTitleToggle");

const undoButton =
  document.getElementById("undoButton");

const clearButton =
  document.getElementById("clearButton");

const copyRoomUrlButton =
  document.getElementById("copyRoomUrlButton");

const copyRoomUrlStatus =
  document.getElementById("copyRoomUrlStatus");

/* 削除確認モーダル */

const confirmModal =
  document.getElementById("confirmModal");

const confirmClearButton =
  document.getElementById("confirmClearButton");

const cancelClearButton =
  document.getElementById("cancelClearButton");

const closeModalButtons =
  document.querySelectorAll("[data-close-modal]");

/* display.html側 */

const displayTitle =
  document.getElementById("displayTitle");

const displaySetlist =
  document.getElementById("displaySetlist");

/* nowplaying.html側 */

const currentSongElement =
  document.getElementById("currentSong");

const nowPlayingSetlist =
  document.getElementById(
    "nowPlayingSetlist"
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

  state = normalizeState({
    ...state,
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
    targetState.listStyle === "bullet"
      ? "bullet"
      : "number";

  const fontFamily =
    typeof targetState.fontFamily === "string" &&
    targetState.fontFamily.trim()
      ? targetState.fontFamily.trim()
      : DEFAULT_STATE.fontFamily;

  const rawFontSize =
    Number(targetState.fontSize);

  const fontSize =
    Number.isFinite(rawFontSize)
      ? clamp(
          rawFontSize,
          MIN_FONT_SIZE,
          MAX_FONT_SIZE
        )
      : DEFAULT_STATE.fontSize;

  const showTitle =
    targetState.showTitle !== false;

  return {
    songs,
    currentSong,
    listStyle,
    fontFamily,
    fontSize,
    showTitle
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
  if (!songForm) {
    return;
  }

  renderSongCount();
  renderListStyleButtons();
  renderFontControls();
  renderFontSizeControls();
  renderTitleToggle();
  renderActionButtons();
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
    !bulletStyleButton
  ) {
    return;
  }

  const isNumber =
    state.listStyle === "number";

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
    !isNumber
  );

  bulletStyleButton.setAttribute(
    "aria-checked",
    String(!isNumber)
  );
}

function renderFontControls() {
  if (fontPreset) {
    const matchingOption =
      Array.from(fontPreset.options).find(
        (option) =>
          option.value === state.fontFamily
      );

    fontPreset.value =
      matchingOption
        ? state.fontFamily
        : "";
  }

  if (
    fontInput &&
    document.activeElement !== fontInput
  ) {
    fontInput.value =
      state.fontFamily;
  }
}

function renderFontSizeControls() {
  if (fontSizeValue) {
    fontSizeValue.textContent =
      `${state.fontSize}px`;
  }

  if (decreaseFontSizeButton) {
    decreaseFontSizeButton.disabled =
      state.fontSize <= MIN_FONT_SIZE;
  }

  if (increaseFontSizeButton) {
    increaseFontSizeButton.disabled =
      state.fontSize >= MAX_FONT_SIZE;
  }
}

function renderTitleToggle() {
  if (!showTitleToggle) {
    return;
  }

  showTitleToggle.checked =
    state.showTitle;
}

function renderActionButtons() {
  const hasSongs =
    state.songs.length > 0;

  if (undoButton) {
    undoButton.disabled =
      !hasSongs;
  }

  if (clearButton) {
    clearButton.disabled =
      !hasSongs;
  }
}

/* =========================================================
   display.html 描画
========================================================= */

function renderDisplayPage() {
  if (!displaySetlist) {
    return;
  }

  displaySetlist.replaceChildren();

  state.songs.forEach((songTitle) => {
    const listItem =
      document.createElement("li");

    listItem.textContent =
      songTitle;

    displaySetlist.appendChild(
      listItem
    );
  });

  renderDisplayStyle();
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
      state.fontFamily
    );

  displaySetlist.style.fontSize =
    `${state.fontSize}px`;

if (displayTitle) {
  displayTitle.style.display =
    state.showTitle ? "" : "none";

  displayTitle.style.fontFamily =
    createFontStack(
      state.fontFamily
    );
}
}

/* =========================================================
   nowplaying.html 描画
========================================================= */

function renderNowPlaying() {
  if (!currentSongElement) {
    return;
  }

const currentSong =
  state.currentSong || "";

currentSongElement.textContent =
  currentSong;

  currentSongElement.style.fontFamily =
    createFontStack(
      state.fontFamily
    );

  currentSongElement.style.fontSize =
    `${state.fontSize}px`;

  currentSongElement.style.fontWeight =
    "700";

  if (nowPlayingSetlist) {

    nowPlayingSetlist.innerHTML = "";

    state.songs.forEach(
      (songTitle, index) => {

        const item =
          document.createElement("div");

        if (state.listStyle === "number") {

          item.textContent =
            `${index + 1}. ${songTitle}`;

        } else {

          item.textContent =
            `・${songTitle}`;

        }

        item.style.fontFamily =
          createFontStack(
            state.fontFamily
          );

        item.style.fontSize =
          `${state.fontSize}px`;

        nowPlayingSetlist.appendChild(
          item
        );
      }
    );

  }

  if (displayTitle) {
    displayTitle.hidden =
      !state.showTitle;

    displayTitle.style.fontFamily =
      createFontStack(
        state.fontFamily
      );
  }
}

/* =========================================================
   セットリスト操作
========================================================= */

function addSong(songTitle) {
  const normalizedTitle =
    String(songTitle ?? "").trim();

  if (!normalizedTitle) {
    return;
  }

  updateState({
    songs: [
      ...state.songs,
      normalizedTitle
    ]
  });
}

function undoLastSong() {
  if (state.songs.length === 0) {
    return;
  }

  updateState({
    songs:
      state.songs.slice(0, -1)
  });
}

function clearAllSongs() {
  updateState({
    songs: []
  });

  closeConfirmModal();
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

function applyFont(fontName) {
  const normalizedFontName =
    String(fontName ?? "").trim();

  if (!normalizedFontName) {
    return;
  }

  updateState({
    fontFamily:
      normalizedFontName
  });
}

function changeFontSize(changeAmount) {
  const nextFontSize =
    clamp(
      state.fontSize + changeAmount,
      MIN_FONT_SIZE,
      MAX_FONT_SIZE
    );

  updateState({
    fontSize: nextFontSize
  });
}

/* =========================================================
   削除確認モーダル
========================================================= */

function openConfirmModal() {
  if (
    !confirmModal ||
    state.songs.length === 0
  ) {
    return;
  }

  lastFocusedElement =
    document.activeElement;

  confirmModal.hidden = false;

  document.body.style.overflow =
    "hidden";

  requestAnimationFrame(() => {
    confirmClearButton?.focus();
  });
}

function closeConfirmModal() {
  if (!confirmModal) {
    return;
  }

  confirmModal.hidden = true;

  document.body.style.overflow = "";

  if (
    lastFocusedElement &&
    typeof lastFocusedElement.focus ===
      "function"
  ) {
    lastFocusedElement.focus();
  }

  lastFocusedElement = null;
}

/* =========================================================
   index.html イベント
========================================================= */

songForm?.addEventListener(
  "submit",
  (event) => {
    event.preventDefault();

    if (!songInput) {
      return;
    }

    addSong(songInput.value);

    songInput.value = "";
    songInput.focus();
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

fontPreset?.addEventListener(
  "change",
  () => {
    if (!fontPreset.value) {
      return;
    }

    applyFont(fontPreset.value);
  }
);

applyFontButton?.addEventListener(
  "click",
  () => {
    if (!fontInput) {
      return;
    }

    applyFont(fontInput.value);
  }
);

fontInput?.addEventListener(
  "keydown",
  (event) => {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();

    applyFont(fontInput.value);
  }
);

decreaseFontSizeButton?.addEventListener(
  "click",
  () => {
    changeFontSize(
      -FONT_SIZE_STEP
    );
  }
);

increaseFontSizeButton?.addEventListener(
  "click",
  () => {
    changeFontSize(
      FONT_SIZE_STEP
    );
  }
);

showTitleToggle?.addEventListener(
  "change",
  () => {
    updateState({
      showTitle:
        showTitleToggle.checked
    });
  }
);

undoButton?.addEventListener(
  "click",
  () => {
    undoLastSong();
  }
);

clearButton?.addEventListener(
  "click",
  () => {
    openConfirmModal();
  }
);

confirmClearButton?.addEventListener(
  "click",
  () => {
    clearAllSongs();
  }
);

cancelClearButton?.addEventListener(
  "click",
  () => {
    closeConfirmModal();
  }
);

closeModalButtons.forEach(
  (button) => {
    button.addEventListener(
      "click",
      () => {
        closeConfirmModal();
      }
    );
  }
);

document.addEventListener(
  "keydown",
  (event) => {
    if (
      event.key === "Escape" &&
      confirmModal &&
      !confirmModal.hidden
    ) {
      closeConfirmModal();
    }
  }
);

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

if (
  displaySetlist ||
  currentSongElement
) {

window.setInterval(() => {
  refreshState();
}, POLLING_INTERVAL);

}

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

function clamp(
  value,
  minimum,
  maximum
) {
  return Math.min(
    Math.max(value, minimum),
    maximum
  );
}

function createFontStack(fontName) {
  const safeFontName =
    fontName.replace(
      /["\\]/g,
      ""
    );

  return `"${safeFontName}", "Yu Gothic", "Meiryo", sans-serif`;
}

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

  lastSavedData =
    JSON.stringify(state);

  render();

})();