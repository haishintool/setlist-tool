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
  nowPlayingFontFamily: "",
  setlistFontFamily: "",

  nowPlayingTextColor: "#ffffff",
  nowPlayingStrokeEnabled: true,
  nowPlayingStrokeColor: "#000000",
  nowPlayingStrokeWidth: 2,

  visibleSongs: 10,
  scrollSpeed: 20,
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

const applySetlistFontButton =
  document.getElementById(
    "applySetlistFontButton"
  );

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

const displaySetlist =
  document.getElementById("displaySetlist");

/* nowplaying.html側 */

const currentSongElement =
  document.getElementById("currentSong");

  const previewNowPlaying =
  document.querySelector(
    ".previewNowPlaying"
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
    targetState.listStyle === "bullet"
      ? "bullet"
      : "number";

const nowPlayingFontFamily =
  typeof targetState.nowPlayingFontFamily === "string" &&
  targetState.nowPlayingFontFamily.trim()
    ? targetState.nowPlayingFontFamily.trim()
    : DEFAULT_STATE.nowPlayingFontFamily;

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
  targetState.nowPlayingStrokeWidth <= 10
    ? targetState.nowPlayingStrokeWidth
    : DEFAULT_STATE.nowPlayingStrokeWidth;    

return {
  songs,
  currentSong,
  listStyle,
  nowPlayingFontFamily,
  setlistFontFamily,
  nowPlayingTextColor,
  nowPlayingStrokeEnabled,
  nowPlayingStrokeColor,
  nowPlayingStrokeWidth,
  visibleSongs,
  scrollSpeed,
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
  renderScrollControls();
  renderActionButtons();
  renderPreview();
}

function renderPreview() {
if (previewNowPlaying) {
  previewNowPlaying.style.fontFamily =
    createFontStack(
      state.nowPlayingFontFamily
    );

  previewNowPlaying.style.color =
    state.nowPlayingTextColor;
}

if (state.nowPlayingStrokeEnabled) {
  previewNowPlaying.style.webkitTextStroke =
    `${state.nowPlayingStrokeWidth}px ${state.nowPlayingStrokeColor}`;
} else {
  previewNowPlaying.style.webkitTextStroke =
    "0px transparent";
}

if (previewSetlist) {
  previewSetlist.style.fontFamily =
    createFontStack(
      state.setlistFontFamily
    );

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

    if (item.type === "spacer") {
      listItem.classList.add(
        "loopSpacer"
      );

      listItem.setAttribute(
        "aria-hidden",
        "true"
      );
    } else {
      listItem.textContent =
        item.title;

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
  "32px";

displaySetlist.style.lineHeight =
  "48px";

displaySetlist.style.paddingBottom =
  "0";

const scrollContainer =
  displaySetlist.parentElement;

if (scrollContainer) {
  const lineHeight = 48;
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
    state.nowPlayingFontFamily
  );

  currentSongElement.style.color =
  state.nowPlayingTextColor;

currentSongElement.style.fontSize =
  "60px";

  currentSongElement.style.fontWeight =
    "700";

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