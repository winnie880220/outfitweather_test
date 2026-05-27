/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { BottomActionBar } from "./components/BottomActionBar";
import { FeelSliderField } from "./components/FeelSliderField";
import { FEEL_TONES } from "./lib/feel-metrics";
import { OutfitStatsPanel } from "./components/OutfitStatsPanel";
import { TaiwanOutfitMap, type MapViewMode } from "./components/TaiwanOutfitMap";
import { LocationRegionPicker } from "./components/LocationRegionPicker";
import { OutfitColorChip } from "./components/OutfitColorChip";
import {
  FeedbackOutfitCard,
  type FeedbackOutfitContext,
} from "./components/FeedbackOutfitCard";
import {
  FeedbackShareOverlay,
  formatShareDateLabel,
  type FeedbackShareSnapshot,
} from "./components/FeedbackShareOverlay";
import { resolveSharePhotoDataUrl } from "./lib/feedback-share-image";
import { PendingFeedbackBanner } from "./components/PendingFeedbackBanner";
import { ReminderSettingsPanel } from "./components/ReminderSettings";
import { WeatherSummaryCard } from "./components/WeatherSummaryCard";
import { OutfitPhotoTagOverlay } from "./components/OutfitPhotoTagOverlay";
import { OutfitPhotoDisplay } from "./components/OutfitPhotoDisplay";
import { motion, AnimatePresence } from "motion/react";
import {
  ApiError,
  analyzeOutfit,
  buildRecordFromWeather,
  createRecord,
  toggleOutfitFavorite,
  fetchUserFavorites,
  fetchCurrentWeather,
  fetchOutfitInsights,
  fetchRegionColorFills,
  reverseGeocode,
  updateRecord,
} from "./lib/api";
import type {
  InspirationItem,
  OutfitAnalysis,
  OutfitInsights,
  RegionColorFill,
} from "./lib/api";
import {
  buildUserLocationFromPicker,
  isTaipeiWholeAreaPicker,
  parseLocationToPickerValue,
  TAIPEI_DISTRICTS,
  TAIPEI_COUNTY,
  TAIPEI_WHOLE_AREA,
  taipeiDistrictFromPicker,
  type LocationPickerValue,
} from "../lib/location-picker";
import { buildRecordWeatherMetrics } from "../lib/weather-metrics";
import { limitOutfitColors } from "../lib/outfit-colors";
import {
  isSameRegion,
  locationPickerToRegion,
  mapRegionToLocation,
  regionKey,
  regionLabel,
  TAIPEI_WHOLE_REGION,
  type MapRegion,
} from "../lib/map-region";
import {
  parseTaipeiDistrict,
  TAIPEI_DISTRICT_CENTROIDS,
  type TaipeiDistrict,
} from "../lib/taipei-district";
import { parseLocationToCounty, type TaiwanCounty } from "../lib/taiwan-county";
import { captureVideoFrame, compressDataUrl } from "./lib/image";
import { hydratePendingRecordFromNotion } from "./lib/pending-record-hydrate";
import { buildRecordUrl, clearRecordFromUrl, getRecordIdFromUrl } from "./lib/record-url";
import {
  cancelEveningReminder,
  maybeShowPendingReminderNotification,
  scheduleEveningReminder,
} from "./lib/reminder";
import {
  addInspirationFavorite,
  favoritesStateFromCards,
  isInspirationFavorite,
  listFavoriteCards,
  loadInspirationFavorites,
  removeInspirationFavorite,
  saveInspirationFavorites,
  type InspirationFavoritesState,
} from "./lib/inspiration-favorites";
import { InspirationFeedScreen } from "./screens/InspirationFeedScreen";
import { FavoritesScreen } from "./screens/FavoritesScreen";
import {
  clearPendingRecord,
  DEFAULT_REMINDER,
  expireStalePending,
  isPendingValidToday,
  loadSession,
  markPendingFeedbackComplete,
  resetAppSession,
  saveSession,
  setPendingRecord,
  formatTimeFromIso,
  type ActiveUserRecord,
  type ReminderSettings,
} from "./lib/session-storage";
import { addMapContribution } from "./lib/map-contributions";
import type {
  ParsedOutfitImage,
  UserGender,
  UserLocation,
  WeatherData,
} from "./types/api";
import { USER_GENDER_OPTIONS, isUserGender } from "./lib/user-gender";
import { 
  Home, 
  Sparkles, 
  Camera, 
  Smile, 
  Shirt, 
  MapPin, 
  ArrowRight, 
  ChevronRight, 
  Heart,
  Droplets,
  Thermometer,
  CloudRain,
  Clock,
  Globe,
  Upload,
  Wind,
  User,
  LogOut,
} from "lucide-react";

function haversineKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const toRad = (n: number) => (n * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const aa =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
}

function inferTaipeiDistrictByCoords(
  lat: number,
  lon: number
): TaipeiDistrict | null {
  let nearest: TaipeiDistrict | null = null;
  let bestKm = Number.POSITIVE_INFINITY;
  for (const district of TAIPEI_DISTRICTS) {
    const [dLat, dLon] = TAIPEI_DISTRICT_CENTROIDS[district];
    const km = haversineKm(lat, lon, dLat, dLon);
    if (km < bestKm) {
      bestKm = km;
      nearest = district;
    }
  }
  // 台北市範圍內到行政區質心通常不會太遠，超出門檻代表不在台北
  return bestKm <= 12 ? nearest : null;
}

function getInsightTempDelta(weather: WeatherData | null | undefined): 1 | 2 {
  if (
    !weather ||
    typeof weather.tempMin !== "number" ||
    Number.isNaN(weather.tempMin) ||
    typeof weather.tempMax !== "number" ||
    Number.isNaN(weather.tempMax)
  ) {
    return 1;
  }
  const spread = Math.abs(weather.tempMax - weather.tempMin);
  return spread >= 8 ? 2 : 1;
}

function isRateLimitedError(error: unknown): boolean {
  if (error instanceof ApiError) {
    if (error.status === 429) return true;
    const msg = error.message.toLowerCase();
    return msg.includes("rate limit") || msg.includes("rate limited");
  }
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return msg.includes("rate limit") || msg.includes("rate limited") || msg.includes("429");
  }
  return false;
}

// --- Types ---
type Screen = "welcome" | "home" | "inspiration" | "favorites" | "record" | "feedback";

type Outfit = InspirationItem;

// --- Mock Data ---
const INITIAL_WARDROBE: Outfit[] = [
  {
    id: "w1",
    emoji: "👗",
    bg: "#f0e8df",
    match: "-",
    temp: "22°C",
    who: "我",
    date: "昨天",
    location: "台北",
    feelMetrics: { breathability: 60, wrapping: 50, stuffiness: 40 },
    tags: [],
    colors: [],
    humidity: "65%"
  },
  {
    id: "w2",
    emoji: "🧣",
    bg: "#e8e4dc",
    match: "-",
    temp: "18°C",
    who: "我",
    date: "3天前",
    location: "新北",
    feelMetrics: { breathability: 40, wrapping: 65, stuffiness: 25 },
    tags: [],
    colors: [],
    humidity: "55%"
  },
  {
    id: "w3",
    emoji: "👕",
    bg: "#e6ebe4",
    match: "-",
    temp: "29°C",
    who: "我",
    date: "上週",
    location: "台北",
    feelMetrics: { breathability: 30, wrapping: 45, stuffiness: 85 },
    tags: [],
    colors: [],
    humidity: "82%"
  }
];

// --- Components ---

const Toast = ({ message, onClear }: { message: string; onClear: () => void }) => {
  useEffect(() => {
    const timer = setTimeout(onClear, 2000);
    return () => clearTimeout(timer);
  }, [onClear, message]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <motion.div
      role="status"
      aria-live="polite"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      transition={{ duration: 0.2 }}
      className="app-toast"
    >
      {message}
    </motion.div>,
    document.body
  );
};

const AppDialogOverlay = ({
  open,
  onDismiss,
  children,
  labelledBy,
  describedBy,
}: {
  open: boolean;
  onDismiss: () => void;
  children: React.ReactNode;
  labelledBy: string;
  describedBy: string;
}) => {
  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          key="app-dialog-overlay"
          className="app-dialog-overlay fixed inset-0 flex items-center justify-center p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          role="presentation"
          onClick={onDismiss}
        >
          <motion.div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={labelledBy}
            aria-describedby={describedBy}
            initial={{ scale: 0.96, y: 8 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.96, y: 8 }}
            transition={{ duration: 0.18 }}
            className="app-dialog-panel w-full max-w-[300px] rounded-2xl bg-white p-5 shadow-xl ring-1 ring-stone-200/80"
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
};

const ExitConfirmDialog = ({
  open,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) => (
  <AppDialogOverlay
    open={open}
    onDismiss={onCancel}
    labelledBy="exit-dialog-title"
    describedBy="exit-dialog-desc"
  >
    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-stone-100 text-stone-600">
      <LogOut size={22} strokeWidth={1.75} />
    </div>
    <h2 id="exit-dialog-title" className="text-center text-base font-semibold text-stone-800">
      確定要離開嗎？
    </h2>
    <p id="exit-dialog-desc" className="mt-2 text-center text-sm leading-relaxed text-stone-500">
      離開後將回到初始頁面，你的名稱與地點等身分資料<strong className="font-semibold text-stone-700">無法保留</strong>，需重新設定。
    </p>
    <div className="mt-5 flex gap-2">
      <button
        type="button"
        onClick={onCancel}
        className="flex-1 rounded-xl border border-stone-200 bg-white py-2.5 text-sm font-semibold text-stone-600 transition-colors hover:bg-stone-50"
      >
        取消
      </button>
      <button
        type="button"
        onClick={onConfirm}
        className="flex-1 rounded-xl bg-stone-800 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-stone-900 active:scale-[0.98]"
      >
        確定離開
      </button>
    </div>
  </AppDialogOverlay>
);

const PendingExitBlockDialog = ({
  open,
  onCancel,
  onGoFeedback,
}: {
  open: boolean;
  onCancel: () => void;
  onGoFeedback: () => void;
}) => (
  <AppDialogOverlay
    open={open}
    onDismiss={onCancel}
    labelledBy="pending-exit-title"
    describedBy="pending-exit-desc"
  >
    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-stone-100 text-stone-600">
      <Smile size={22} strokeWidth={1.75} />
    </div>
    <h2
      id="pending-exit-title"
      className="text-center text-base font-semibold text-stone-800"
    >
      請先完成體感回饋
    </h2>
    <p
      id="pending-exit-desc"
      className="mt-2 text-center text-sm leading-relaxed text-stone-500"
    >
      你今日已上傳穿搭照片，請先完成體感回饋後再離開，資料才會完整保存。
    </p>
    <div className="mt-5 flex gap-2">
      <button
        type="button"
        onClick={onCancel}
        className="flex-1 rounded-xl border border-stone-200 bg-white py-2.5 text-sm font-semibold text-stone-600 transition-colors hover:bg-stone-50"
      >
        稍後再說
      </button>
      <button
        type="button"
        onClick={onGoFeedback}
        className="flex-1 rounded-xl bg-stone-800 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-stone-900 active:scale-[0.98]"
      >
        前往回饋
      </button>
    </div>
  </AppDialogOverlay>
);

const AppExitButton = ({ onClick }: { onClick: () => void }) => (
  <button type="button" onClick={onClick} className="app-exit-btn" aria-label="離開並返回初始頁">
    <LogOut size={12} strokeWidth={2} />
    離開
  </button>
);

// --- Sub-screens ---

const WelcomeScreen = ({
  userName,
  setUserName,
  userGender,
  setUserGender,
  startApp,
}: {
  userName: string;
  setUserName: (v: string) => void;
  userGender: UserGender | null;
  setUserGender: (v: UserGender | null) => void;
  startApp: () => void;
}) => {
  const canStart = userName.trim().length > 0 && userGender !== null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="welcome-screen screen-scroll app-scroll"
    >
      <div className="welcome-bg" aria-hidden />

      <motion.div
        className="app-inset welcome-body"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="welcome-shell">
          <div className="welcome-emblem-anchor" aria-hidden>
            <motion.div
              className="welcome-emblem"
              initial={{ opacity: 0, scale: 0.88 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.06, duration: 0.42, type: "spring", stiffness: 280, damping: 22 }}
            >
              <Shirt size={26} strokeWidth={1.35} className="welcome-emblem-icon" />
            </motion.div>
          </div>

          <motion.div
            className="welcome-card"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
          >
            <header className="welcome-brand">
              <p className="welcome-eyebrow">衣氣象</p>
              <h1 className="welcome-title">Outfit Weather</h1>
              <p className="welcome-tagline">依天氣記錄穿搭，晚上回饋穿著體感</p>
            </header>

            <div className="welcome-form">
              <div className="welcome-field">
                <label htmlFor="welcome-name" className="welcome-field-label">
                  你的名字
                </label>
                <input
                  id="welcome-name"
                  className="welcome-field-input"
                  placeholder="輸入名字"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  autoComplete="name"
                  autoFocus
                />
              </div>

              <div className="welcome-field">
                <label htmlFor="welcome-gender" className="welcome-field-label">
                  性別
                </label>
                <select
                  id="welcome-gender"
                  className="welcome-field-select"
                  value={userGender ?? ""}
                  onChange={(e) => {
                    const value = e.target.value;
                    setUserGender(isUserGender(value) ? value : null);
                  }}
                  required
                >
                  <option value="" disabled>
                    請選擇
                  </option>
                  {USER_GENDER_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <AnimatePresence initial={false}>
              {canStart ? (
                <motion.p
                  key="welcome-preview"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="welcome-preview-wrap"
                >
                  <span className="welcome-preview">
                    <User size={13} className="shrink-0 text-[#8b7355]" aria-hidden />
                    <span className="min-w-0 truncate">
                      嗨，<strong>{userName.trim()}</strong>
                      <span className="text-stone-400"> · </span>
                      {userGender}
                    </span>
                  </span>
                </motion.p>
              ) : null}
            </AnimatePresence>

            <button
              type="button"
              onClick={startApp}
              disabled={!canStart}
              className={`welcome-start-btn ${canStart ? "welcome-start-btn--ready" : ""}`}
            >
              開始
              {canStart ? <ArrowRight size={16} className="welcome-start-arrow" /> : null}
            </button>

            <AnimatePresence mode="wait" initial={false}>
              {!canStart ? (
                <motion.p
                  key="hint"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="welcome-hint"
                >
                  請先填寫名字與性別
                </motion.p>
              ) : (
                <motion.p
                  key="ready"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="welcome-hint welcome-hint--ready"
                >
                  進入首頁後會先定位，也可自行切換地區
                </motion.p>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </motion.div>
    </motion.div>
  );
};

const HomeScreen = ({
  userName,
  mapWeather,
  mapWeatherLoading,
  locationPicker,
  onLocationPickerChange,
  locating,
  onRequestLocate,
  regionColorFills,
  userCounty,
  userDistrict,
  mapView,
  onMapViewChange,
  locateFocusTick,
  selectedRegion,
  onSelectRegion,
  regionInsights,
  regionInsightsLoading,
  onOpenRegionInspiration,
  showPendingBanner,
  onContinuePending,
  onRequestExit,
}: {
  userName: string;
  mapWeather: WeatherData | null;
  mapWeatherLoading: boolean;
  locationPicker: LocationPickerValue;
  onLocationPickerChange: (value: LocationPickerValue) => void;
  locating: boolean;
  onRequestLocate: () => void;
  regionColorFills: RegionColorFill[];
  userCounty: TaiwanCounty | null;
  userDistrict: TaipeiDistrict | null;
  mapView: MapViewMode;
  onMapViewChange: (view: MapViewMode) => void;
  locateFocusTick: number;
  selectedRegion: MapRegion | null;
  onSelectRegion: (region: MapRegion | null) => void;
  regionInsights: OutfitInsights | null;
  regionInsightsLoading: boolean;
  onOpenRegionInspiration: () => void;
  showPendingBanner: boolean;
  onContinuePending: () => void;
  onRequestExit: () => void;
}) => (
  <div className="home-map-screen app-screen-gradient flex min-h-0 flex-col">
    <div className="app-inset flex min-h-0 flex-1 flex-col pt-3 pb-[var(--nav-safe-bottom)]">
      {showPendingBanner ? (
        <PendingFeedbackBanner onContinue={onContinuePending} />
      ) : null}
      <header className="mb-2 flex shrink-0 items-center justify-between gap-2">
        <span className="min-w-0 text-sm font-medium text-stone-800">嗨，{userName}！</span>
        <AppExitButton onClick={onRequestExit} />
      </header>

      <div className="home-location-toolbar mb-2 shrink-0">
        <LocationRegionPicker
          compact
          value={locationPicker}
          onChange={onLocationPickerChange}
          locating={locating}
          onRequestLocate={onRequestLocate}
        />
      </div>

      <div className="home-map-stack relative flex min-h-0 flex-1 flex-col">
        <TaiwanOutfitMap
          regionColorFills={regionColorFills}
          weather={mapWeather}
          weatherLoading={mapWeatherLoading}
          userCounty={userCounty}
          userDistrict={userDistrict}
          mapView={mapView}
          onMapViewChange={onMapViewChange}
          locateFocusTick={locateFocusTick}
          selectedRegion={selectedRegion}
          onSelectRegion={onSelectRegion}
        />

        <AnimatePresence>
          {selectedRegion ? (
            <motion.div
              key="region-sheet"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="home-region-sheet-overlay absolute inset-0 z-[600] flex flex-col"
            >
              <button
                type="button"
                className="home-region-sheet-backdrop min-h-0 flex-1 w-full cursor-default border-0 bg-stone-900/10 p-0"
                aria-label="關閉區域排行榜"
                onClick={() => onSelectRegion(null)}
              />
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 16 }}
                transition={{ duration: 0.22 }}
                className="home-county-sheet shrink-0"
              >
                <div className="home-county-sheet__head">
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-400">
                      此區穿搭
                    </p>
                    <h2 className="text-base font-bold text-stone-800">
                      {regionLabel(selectedRegion)}
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => onSelectRegion(null)}
                    className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold text-stone-500 ring-1 ring-stone-200/90"
                  >
                    關閉
                  </button>
                </div>
                <div className="px-3 pb-3">
                  <OutfitStatsPanel
                    insights={regionInsights}
                    loading={regionInsightsLoading}
                  />
                  <div className="mt-2">
                    <BottomActionBar
                      solo
                      primaryLabel={`看${regionLabel(selectedRegion)}穿搭靈感`}
                      onPrimary={onOpenRegionInspiration}
                    />
                  </div>
                </div>
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  </div>
);


const RecordScreen = ({
  hasUploadedToday,
  uploadedPhotoUrl,
  uploadedOutfitTags,
  onGoToFeedback,
  outfitImage,
  outfitAnalysisPreview,
  outfitAnalysisLoading,
  onImageReady,
  onClearImage,
  currentTime,
  saveToWardrobe,
  recordSaving,
  weather,
  isCameraOpen,
  setIsCameraOpen,
  showActionSheet,
  setShowActionSheet,
  showToast,
  reminder,
  onReminderChange,
  onRequestExit,
}: {
  hasUploadedToday: boolean;
  uploadedPhotoUrl?: string;
  uploadedOutfitTags: OutfitAnalysis | null;
  onGoToFeedback: () => void;
  outfitImage: ParsedOutfitImage | null;
  outfitAnalysisPreview: OutfitAnalysis | null;
  outfitAnalysisLoading: boolean;
  onImageReady: (img: ParsedOutfitImage) => void;
  onClearImage: () => void;
  currentTime: string;
  saveToWardrobe: () => void;
  recordSaving: boolean;
  weather: WeatherData | null;
  isCameraOpen: boolean;
  setIsCameraOpen: (v: boolean) => void;
  showActionSheet: boolean;
  setShowActionSheet: (v: boolean) => void;
  showToast: (msg: string) => void;
  reminder: ReminderSettings;
  onReminderChange: (next: ReminderSettings) => void;
  onRequestExit: () => void;
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photoShareConsent, setPhotoShareConsent] = useState(false);

  const startCamera = async () => {
    if (hasUploadedToday) return;
    try {
      setIsCameraOpen(true);
      setShowActionSheet(false);
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Camera error:", err);
      setIsCameraOpen(false);
    }
  };

  const capturePhoto = async () => {
    if (!videoRef.current) return;
    const stream = videoRef.current.srcObject as MediaStream;
    stream?.getTracks().forEach((track) => track.stop());
    setIsCameraOpen(false);
    try {
      const img = await captureVideoFrame(videoRef.current);
      onImageReady(img);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "拍照失敗");
    }
  };

  const openPhotoLibrary = () => {
    setShowActionSheet(false);
    window.setTimeout(() => fileInputRef.current?.click(), 0);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setShowActionSheet(false);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const img = await compressDataUrl(reader.result as string);
        onImageReady(img);
      } catch (error) {
        showToast(error instanceof Error ? error.message : "圖片讀取失敗");
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const photoPreviewUrl = hasUploadedToday
    ? uploadedPhotoUrl
    : outfitImage?.previewUrl;
  const hasPhoto = Boolean(photoPreviewUrl);

  useEffect(() => {
    if (!hasPhoto) setPhotoShareConsent(false);
  }, [hasPhoto]);

  const handleCompleteRecord = () => {
    if (!photoShareConsent) {
      showToast("請先勾選照片分享說明，再完成記錄");
      return;
    }
    saveToWardrobe();
  };

  return (
    <div
      className={`record-screen-layout app-screen-gradient ${
        hasPhoto && !hasUploadedToday ? "record-screen-layout--with-extras" : ""
      }`}
    >
      <div className="record-screen-top app-inset">
      <header className="record-screen-header flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-stone-800">記錄今日穿搭</h2>
        <div className="flex shrink-0 items-center gap-2">
          {isCameraOpen ? (
            <button
              type="button"
              onClick={() => {
                const stream = videoRef.current?.srcObject as MediaStream;
                stream?.getTracks().forEach((track) => track.stop());
                setIsCameraOpen(false);
              }}
              className="text-xs font-medium italic text-slate-400 underline"
            >
              取消
            </button>
          ) : null}
          <AppExitButton onClick={onRequestExit} />
        </div>
      </header>

      <WeatherSummaryCard
        compact
        className="record-screen-weather"
        weather={weather}
        metrics={buildRecordWeatherMetrics(weather)}
      />
      </div>

      <div className="record-screen-photo min-h-0 w-full flex-1">
        <div className="app-inset record-screen-photo-inset">
        <input
          type="file"
          ref={fileInputRef}
          className="sr-only"
          accept="image/*"
          onChange={handleFileChange}
        />

        <motion.div
          whileTap={hasUploadedToday ? undefined : { scale: 0.98 }}
          onClick={() =>
            !hasUploadedToday &&
            !hasPhoto &&
            !recordSaving &&
            !showActionSheet &&
            setShowActionSheet(true)
          }
          className={`record-photo-frame flex h-full w-full flex-col overflow-hidden transition-all ${
            hasPhoto || isCameraOpen
              ? "record-photo-frame--filled"
              : "record-photo-frame--empty items-center justify-center"
          } ${
            hasUploadedToday
              ? "record-photo-frame--uploaded cursor-default"
              : hasPhoto
                ? "record-photo-frame--selected cursor-pointer"
                : isCameraOpen
                  ? "!border-0 bg-black cursor-pointer"
                  : "border-dashed border-stone-200/80 bg-slate-50/80 cursor-pointer hover:border-stone-300"
          }`}
        >
          <span
            className={`record-photo-time-badge ${isCameraOpen ? "record-photo-time-badge--on-dark" : ""}`}
            aria-label={`記錄時間 ${currentTime || "--:--"}`}
          >
            {currentTime || "--:--"}
          </span>
          {isCameraOpen ? (
            <div className="record-photo-stage relative h-full min-h-0 w-full flex-1 overflow-hidden bg-black">
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                className="h-full w-full object-cover"
              />
              <button 
                onClick={capturePhoto}
                className="absolute bottom-4 left-1/2 -translate-x-1/2 w-12 h-12 bg-white rounded-full border-4 border-slate-300 flex items-center justify-center shadow-lg active:scale-90 transition-transform"
              >
                <div className="w-8 h-8 bg-slate-100 rounded-full border border-slate-200" />
              </button>
            </div>
          ) : hasPhoto && photoPreviewUrl ? (
            <>
              <div className="record-photo-stage relative w-full min-h-0 flex-1 overflow-hidden bg-[#faf7f2]">
                <OutfitPhotoDisplay
                  photoUrl={photoPreviewUrl}
                  emoji="🧥"
                  objectFit="contain"
                  bg="#faf7f2"
                  className="h-full w-full min-h-0"
                />
                {(() => {
                  const tags =
                    outfitAnalysisPreview ?? uploadedOutfitTags;
                  const showOverlay =
                    outfitAnalysisLoading ||
                    outfitAnalysisPreview ||
                    (hasUploadedToday &&
                      tags &&
                      (tags.upperBodyTags.length > 0 ||
                        tags.lowerBodyTags.length > 0 ||
                        (tags.colors?.length ?? 0) > 0));
                  if (!showOverlay) return null;
                  return (
                    <OutfitPhotoTagOverlay
                      upperBodyTags={tags?.upperBodyTags ?? []}
                      lowerBodyTags={tags?.lowerBodyTags ?? []}
                      tagAnchors={tags?.tagAnchors}
                      loading={outfitAnalysisLoading && !outfitAnalysisPreview}
                    />
                  );
                })()}
              </div>
              <div
                className={`record-photo-meta shrink-0 text-center ${
                  outfitAnalysisLoading ? "pointer-events-none opacity-0" : ""
                }`}
              >
                <p className="record-photo-meta__status">
                  {hasUploadedToday
                    ? "照片已上傳"
                    : outfitAnalysisPreview ||
                        (uploadedOutfitTags &&
                          (uploadedOutfitTags.upperBodyTags.length > 0 ||
                            uploadedOutfitTags.lowerBodyTags.length > 0))
                      ? "AI 已標註穿搭單品"
                      : "已選取照片，氣象已綁定"}
                </p>
                {(() => {
                  const palette = limitOutfitColors(
                    outfitAnalysisPreview?.colors ??
                      uploadedOutfitTags?.colors ??
                      []
                  );
                  if (!palette.length || outfitAnalysisLoading) return null;
                  return (
                    <div className="mt-1.5 flex flex-wrap justify-center gap-1.5">
                      {palette.map((color) => (
                        <OutfitColorChip key={color} name={color} variant="on-photo" />
                      ))}
                    </div>
                  );
                })()}
                {!hasUploadedToday && !outfitAnalysisLoading && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onClearImage();
                    }}
                    className="record-photo-meta__retake"
                  >
                    重新拍攝
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="record-photo-empty text-center">
              <div className="record-photo-empty__icon mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm">
                <Camera size={24} className="text-stone-400" />
              </div>
              <p className="text-sm font-medium text-stone-600">點擊拍照或上傳今日穿搭</p>
              <p className="record-photo-empty__hint mt-1">自動綁定此刻天氣</p>
            </div>
          )}

          <AnimatePresence>
            {showActionSheet && !hasUploadedToday && !hasPhoto && (
              <motion.div
                key="record-photo-action-sheet"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="record-photo-action-sheet"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  aria-label="關閉"
                  className="record-photo-action-sheet__backdrop border-0 p-0"
                  onClick={() => setShowActionSheet(false)}
                />
                <motion.div
                  initial={{ y: 12, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 12, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="record-photo-action-sheet__actions"
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void startCamera();
                    }}
                    className="flex w-full items-center justify-center gap-2 bg-stone-800 py-3.5 text-sm font-bold text-white shadow-lg"
                  >
                    <Camera size={20} /> 開啟自拍鏡頭
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openPhotoLibrary();
                    }}
                    className="flex w-full items-center justify-center gap-2 border border-slate-200 bg-white py-3.5 text-sm font-bold text-slate-700 shadow-md"
                  >
                    <Upload size={20} /> 從相簿上傳
                  </button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
        </div>
      </div>

      {!hasUploadedToday && hasPhoto ? (
        <div className="record-screen-extras app-inset shrink-0">
          <div className="record-screen-stack">
            <label className="record-panel record-photo-consent flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={photoShareConsent}
                onChange={(e) => setPhotoShareConsent(e.target.checked)}
                className="record-photo-consent__checkbox mt-0.5 h-4 w-4 shrink-0 rounded"
              />
              <span className="record-photo-consent__text">
                我同意此照片可作為其他使用者的
                <span className="font-semibold text-stone-700">穿搭靈感</span>
                （僅照片與天氣，不含姓名）。
              </span>
            </label>
            <ReminderSettingsPanel
              compact
              reminder={reminder}
              onChange={onReminderChange}
              showToast={showToast}
              className="w-full"
            />
          </div>
        </div>
      ) : null}

      <div className="record-screen-dock app-inset">
        {hasUploadedToday ? (
          <>
            <BottomActionBar
              solo
              buttonRadius="card"
              primaryLabel="前往回饋"
              onPrimary={onGoToFeedback}
            />
            <p className="record-screen-dock-hint">
              你需要完成體感回饋才可以上傳新穿搭
            </p>
          </>
        ) : (
          <BottomActionBar
            solo
            buttonRadius="card"
            primaryLabel={
              recordSaving
                ? outfitAnalysisLoading
                  ? "AI 分析穿搭中…"
                  : "寫入記錄中…"
                : "完成記錄"
            }
            onPrimary={handleCompleteRecord}
            disabled={!hasPhoto || recordSaving}
            loading={recordSaving}
          />
        )}
      </div>
    </div>
  );
};


const FeedbackScreen = ({
  needsFeedback,
  feedbackOutfit,
  feedbackDesc,
  setFeedbackDesc,
  feelSet,
  setFeelSet,
  submitFeedback,
  onRequestExit,
}: {
  needsFeedback: boolean;
  feedbackOutfit: FeedbackOutfitContext;
  feedbackDesc: string;
  setFeedbackDesc: (v: string) => void;
  feelSet: boolean;
  setFeelSet: (v: boolean) => void;
  submitFeedback: (
    metrics: {
      breathability: number;
      snugness: number;
      stuffiness: number;
    },
    feelNote?: string
  ) => void;
  onRequestExit: () => void;
}) => {
  const [metrics, setMetrics] = useState({
    breathability: 50,
    snugness: 50,
    stuffiness: 50,
  });
  const [feelNote, setFeelNote] = useState("");

  const updateMetric = (key: keyof typeof metrics, value: number) => {
    const newMetrics = { ...metrics, [key]: value };
    setMetrics(newMetrics);
    setFeelSet(true);
    
    // Generate description based on the three metrics
    const bLabel =
      newMetrics.breathability > 70
        ? "透氣極佳"
        : newMetrics.breathability > 40
          ? "透氣舒適"
          : "不通風";
    const sText = newMetrics.snugness > 70 ? "緊緻" : newMetrics.snugness > 40 ? "合身" : "寬鬆";
    const stText = newMetrics.stuffiness > 70 ? "極悶熱" : newMetrics.stuffiness > 40 ? "微悶" : "乾爽";

    setFeedbackDesc(`${bLabel}(${newMetrics.breathability}%)・${sText}感(${newMetrics.snugness}%)・${stText}(${newMetrics.stuffiness}%)`);
  };

  if (!needsFeedback) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden app-screen-gradient">
        <div className="flex shrink-0 justify-end px-6 pt-3">
          <AppExitButton onClick={onRequestExit} />
        </div>
        <div className="app-empty-body">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/70 text-stone-500 ring-1 ring-stone-200/70">
            <Smile size={28} strokeWidth={1.5} />
          </div>
          <h2 className="text-base font-semibold text-stone-800">今日沒有需要回饋的穿搭了</h2>
          <p className="mx-auto mt-2 max-w-[280px] text-sm leading-relaxed text-stone-500">
            今天的體感已記錄完成，或尚未建立今日穿搭。可先至「記錄」拍照上傳。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="screen-scroll app-scroll app-screen-gradient">
      <div className="app-inset pt-4 pb-[var(--nav-safe-bottom)]">
      <header className="mb-4 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="font-semibold text-stone-800">今日體感回饋</h2>
          <span className="text-[10px] font-medium text-stone-400">拖動滑桿調整數值</span>
        </div>
        <AppExitButton onClick={onRequestExit} />
      </header>

      <FeedbackOutfitCard outfit={feedbackOutfit} className="mb-4 w-full" />

      <div className="feedback-sliders glass-card-strong mb-4 w-full rounded-2xl p-6">
        <FeelSliderField
          label="透氣度"
          value={metrics.breathability}
          color={FEEL_TONES.breathability}
          icon={<Wind size={14} />}
          onChange={(v) => updateMetric("breathability", v)}
        />
        <FeelSliderField
          label="包裹感"
          value={metrics.snugness}
          color={FEEL_TONES.wrapping}
          icon={<User size={14} />}
          onChange={(v) => updateMetric("snugness", v)}
        />
        <FeelSliderField
          label="悶熱感"
          value={metrics.stuffiness}
          color={FEEL_TONES.stuffiness}
          icon={<Thermometer size={14} />}
          onChange={(v) => updateMetric("stuffiness", v)}
        />
        <div
          className={`feedback-slider-summary mt-4 border-t border-stone-200/70 pt-3 transition-opacity ${feelSet ? "opacity-100" : "opacity-45"}`}
        >
          <div className="mb-1 text-[10px] font-medium text-stone-400">滑桿摘要</div>
          <p className="text-xs leading-relaxed text-stone-600">
            {feelSet ? feedbackDesc : "拖動滑桿後會顯示摘要"}
          </p>
        </div>
      </div>

      <div className="feedback-feel-note glass-card mb-4 w-full rounded-xl p-4">
        <label
          htmlFor="feel-note-input"
          className="mb-2 block text-xs font-semibold text-stone-600"
        >
          穿搭小故事（場景/心情）
          <span className="ml-1 font-normal text-stone-400">（選填）</span>
        </label>
        <textarea
          id="feel-note-input"
          value={feelNote}
          onChange={(e) => setFeelNote(e.target.value)}
          placeholder="例如：我今天真漂亮"
          rows={3}
          maxLength={200}
          className="feedback-feel-note__input w-full resize-none rounded-xl border border-stone-200/90 bg-white/80 px-3 py-2.5 text-sm leading-relaxed text-stone-700 placeholder:text-stone-400 focus:border-stone-300 focus:outline-none focus:ring-2 focus:ring-stone-200/80"
        />
        <p className="mt-1.5 text-right text-[10px] text-stone-400">
          {feelNote.length}/200
        </p>
      </div>

      <div className="pt-2 pb-2">
        <BottomActionBar
          solo
          primaryLabel={feelSet ? "貢獻這份體感數據" : "請先調整滑桿"}
          onPrimary={() => submitFeedback(metrics, feelNote.trim() || undefined)}
          disabled={!feelSet}
        />
      </div>
      </div>
    </div>
  );
};


export default function App() {
  const [screen, setScreen] = useState<Screen>("welcome");
  const [userName, setUserName] = useState("");
  const [userGender, setUserGender] = useState<UserGender | null>(null);
  const [outfitList, setOutfitList] = useState<Outfit[]>(INITIAL_WARDROBE);
  const [inspirationFavorites, setInspirationFavorites] = useState<InspirationFavoritesState>({
    userName: "",
    items: {},
  });
  const [favoriteBusyId, setFavoriteBusyId] = useState<string | null>(null);
  const [outfitImage, setOutfitImage] = useState<ParsedOutfitImage | null>(null);
  const [outfitAnalysisPreview, setOutfitAnalysisPreview] =
    useState<OutfitAnalysis | null>(null);
  const [outfitAnalysisLoading, setOutfitAnalysisLoading] = useState(false);
  const [recordSaving, setRecordSaving] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [feelSet, setFeelSet] = useState(false);
  const [feedbackDesc, setFeedbackDesc] = useState("尚未標記");
  const [toastMsg, setToastMsg] = useState("");
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showPendingExitBlock, setShowPendingExitBlock] = useState(false);
  const [feedbackShareSnapshot, setFeedbackShareSnapshot] =
    useState<FeedbackShareSnapshot | null>(null);
  const [currentTime, setCurrentTime] = useState("");

  const showToast = (msg: string) => setToastMsg(msg);

  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [locationInput, setLocationInput] = useState("");
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [locationPicker, setLocationPicker] = useState<LocationPickerValue>({
    county: TAIPEI_COUNTY,
    district: TAIPEI_WHOLE_AREA,
  });
  const [locating, setLocating] = useState(false);
  const homeGeoRequested = useRef(false);
  const [notionPageId, setNotionPageId] = useState<string | null>(null);
  /** 當日＋氣溫區間的 active 列（收藏／記錄／回饋皆寫入此列） */
  const [activeUserRecord, setActiveUserRecord] = useState<ActiveUserRecord | null>(
    null
  );
  const [outfitInsights, setOutfitInsights] = useState<OutfitInsights | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [reminder, setReminder] = useState<ReminderSettings>(DEFAULT_REMINDER);
  const [hasPendingFeedback, setHasPendingFeedback] = useState(false);
  /** 待回饋 session 更新後觸發 UI 重讀（含從 Notion 還原照片） */
  const [pendingRevision, setPendingRevision] = useState(0);
  const [regionColorFills, setRegionColorFills] = useState<RegionColorFill[]>([]);
  const [mapView, setMapView] = useState<MapViewMode>("counties");
  const [selectedRegion, setSelectedRegion] = useState<MapRegion | null>(null);
  const [locateFocusTick, setLocateFocusTick] = useState(0);
  const [regionWeather, setRegionWeather] = useState<WeatherData | null>(null);
  const [regionWeatherLoading, setRegionWeatherLoading] = useState(false);
  const [regionInsights, setRegionInsights] = useState<OutfitInsights | null>(null);
  const [optimisticInspirationCards, setOptimisticInspirationCards] = useState<
    InspirationItem[]
  >([]);
  const regionInsightsRef = useRef<OutfitInsights | null>(null);
  regionInsightsRef.current = regionInsights;
  const [regionInsightsLoading, setRegionInsightsLoading] = useState(false);
  /** 從地圖「看○○穿搭靈感」進入的單次篩選（可返回首頁地區選單設定） */
  const [inspirationDrilldownRegion, setInspirationDrilldownRegion] =
    useState<MapRegion | null>(null);
  const sessionHydrated = useRef(false);
  const regionWeatherFetchKeyRef = useRef<string | null>(null);
  const regionInsightsFetchKeyRef = useRef<string | null>(null);
  const regionColorFillsKeyRef = useRef<string | null>(null);
  const regionInsightsInFlightRef = useRef<Set<string>>(new Set());
  const regionColorFillsInFlightRef = useRef<Set<string>>(new Set());
  const regionInsightsLastRequestAtRef = useRef<Map<string, number>>(new Map());
  const regionColorFillsLastRequestAtRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [screen]);

  const userCounty = useMemo((): TaiwanCounty | null => {
    if (userLocation?.name) return parseLocationToCounty(userLocation.name);
    if (weather?.locationName) return parseLocationToCounty(weather.locationName);
    return null;
  }, [userLocation?.name, weather?.locationName]);

  const userDistrict = useMemo((): TaipeiDistrict | null => {
    if (userCounty !== TAIPEI_COUNTY) return null;
    const district = taipeiDistrictFromPicker(locationPicker);
    if (district) return district;
    const loc = userLocation?.name ?? weather?.locationName ?? "";
    return parseTaipeiDistrict(loc);
  }, [
    userCounty,
    locationPicker.county,
    locationPicker.district,
    userLocation?.name,
    weather?.locationName,
  ]);

  const toStartedAtIso = (timeHm: string) => {
    const d = new Date();
    if (timeHm) {
      const [h, m] = timeHm.split(":").map(Number);
      if (!Number.isNaN(h) && !Number.isNaN(m)) {
        d.setHours(h, m, 0, 0);
      }
    }
    return d.toISOString();
  };

  const loadWeather = useCallback(async (lat: number, lon: number, displayName?: string) => {
    try {
      setWeatherLoading(true);
      const data = await fetchCurrentWeather(lat, lon, displayName);
      setWeather(data);
    } catch (error) {
      console.error("Failed to fetch weather:", error);
      showToast("天氣數據獲取失敗，請檢查網路連線");
    } finally {
      setWeatherLoading(false);
    }
  }, [showToast]);

  const loadRegionWeather = useCallback(
    async (region: MapRegion) => {
      const { lat, lon, name } = mapRegionToLocation(region);
      try {
        setRegionWeatherLoading(true);
        const data = await fetchCurrentWeather(lat, lon, name);
        setRegionWeather(data);
      } catch (error) {
        console.warn("Region weather:", error);
        setRegionWeather(null);
        showToast("該區天氣取得失敗");
      } finally {
        setRegionWeatherLoading(false);
      }
    },
    [showToast]
  );

  const applyLocationPicker = useCallback(
    (value: LocationPickerValue) => {
      setLocationPicker(value);
      const loc = buildUserLocationFromPicker(value);
      setUserLocation(loc);
      setLocationInput(loc.name);
      setSelectedRegion(null);
      setRegionWeather(null);
      regionWeatherFetchKeyRef.current = null;
      regionInsightsFetchKeyRef.current = null;
      if (value.county === TAIPEI_COUNTY) {
        setMapView("taipei-districts");
      } else {
        setMapView("counties");
      }
      void loadWeather(loc.lat, loc.lon, loc.name);
    },
    [loadWeather]
  );

  /** 地區選單為台北市時，地圖需進入台北分區模式（含 session 還原） */
  useEffect(() => {
    if (!sessionHydrated.current) return;
    setMapView(locationPicker.county === TAIPEI_COUNTY ? "taipei-districts" : "counties");
  }, [locationPicker.county]);

  const requestHomeGeolocation = useCallback(() => {
    if (!navigator.geolocation) {
      showToast("此裝置不支援定位功能");
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude: lat, longitude: lon } = pos.coords;
          const name = await reverseGeocode(lat, lon);
          const parsedFromName = parseLocationToPickerValue(name);
          const inferredDistrict = inferTaipeiDistrictByCoords(lat, lon);
          const parsed =
            parsedFromName?.county === TAIPEI_COUNTY
              ? {
                  county: TAIPEI_COUNTY,
                  district:
                    (!parsedFromName.district ||
                    parsedFromName.district === TAIPEI_WHOLE_AREA
                      ? inferredDistrict
                      : parsedFromName.district) ?? TAIPEI_WHOLE_AREA,
                }
              : parsedFromName;

          if (parsed) {
            applyLocationPicker(parsed);
            setLocateFocusTick((v) => v + 1);
          } else if (inferredDistrict) {
            applyLocationPicker({ county: TAIPEI_COUNTY, district: inferredDistrict });
            setLocateFocusTick((v) => v + 1);
          } else {
            setUserLocation({ name, lat, lon });
            setLocationInput(name);
            setSelectedRegion(null);
            void loadWeather(lat, lon, name);
            setLocateFocusTick((v) => v + 1);
          }
        } catch (error) {
          const msg = error instanceof Error ? error.message : "";
          showToast(msg ? `無法解析位置：${msg}` : "無法解析目前位置，請手動選擇地區");
          applyLocationPicker(locationPicker);
        } finally {
          setLocating(false);
        }
      },
      (err) => {
        const code = (err as GeolocationPositionError)?.code;
        if (code === 1) {
          showToast("請允許定位權限，或手動選擇地區");
        } else if (code === 3) {
          showToast("定位逾時，請手動選擇地區");
        } else {
          showToast("無法取得定位，請手動選擇地區");
        }
        setLocating(false);
        applyLocationPicker(locationPicker);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  }, [applyLocationPicker, loadWeather, locationPicker, showToast]);

  useEffect(() => {
    if (screen !== "home" || !sessionHydrated.current) return;
    if (userLocation || homeGeoRequested.current) return;
    homeGeoRequested.current = true;
    requestHomeGeolocation();
  }, [screen, userLocation, requestHomeGeolocation]);

  const loadOutfitInsights = useCallback(async (weatherSnapshot: WeatherData) => {
    try {
      setInsightsLoading(true);
      const data = await fetchOutfitInsights(
        weatherSnapshot.temp,
        getInsightTempDelta(weatherSnapshot)
      );
      setOutfitInsights(data);
    } catch (error) {
      console.warn("Outfit insights:", error);
      setOutfitInsights(null);
    } finally {
      setInsightsLoading(false);
    }
  }, []);

  const loadRegionInsights = useCallback(
    async (
      weatherSnapshot: WeatherData,
      region: MapRegion,
      opts?: { showLoading?: boolean; force?: boolean }
    ) => {
      const temp = weatherSnapshot.temp;
      if (typeof temp !== "number" || Number.isNaN(temp)) return;

      const delta = getInsightTempDelta(weatherSnapshot);
      const fetchKey = `${regionKey(region)}@${Math.round(temp)}@d${delta}`;
      const showLoading = opts?.showLoading !== false;
      const force = opts?.force === true;
      const now = Date.now();
      const lastAt = regionInsightsLastRequestAtRef.current.get(fetchKey) ?? 0;
      if (!force && now - lastAt < 2500) return;
      if (regionInsightsInFlightRef.current.has(fetchKey)) return;
      regionInsightsInFlightRef.current.add(fetchKey);
      regionInsightsLastRequestAtRef.current.set(fetchKey, now);
      try {
        if (showLoading) setRegionInsightsLoading(true);
        const district = region.level === "district" ? region.district : undefined;
        const data = await fetchOutfitInsights(temp, delta, region.county, district);
        regionInsightsFetchKeyRef.current = fetchKey;
        setRegionInsights(data);
      } catch (error) {
        console.warn("Region outfit insights:", error);
        if (isRateLimitedError(error)) {
          // 限流時保留目前畫面資料，避免閃空並減少重打。
          regionInsightsFetchKeyRef.current = fetchKey;
          regionInsightsLastRequestAtRef.current.set(fetchKey, Date.now() + 6000);
        } else {
          regionInsightsFetchKeyRef.current = fetchKey;
          setRegionInsights(null);
        }
      } finally {
        regionInsightsInFlightRef.current.delete(fetchKey);
        if (showLoading) setRegionInsightsLoading(false);
      }
    },
    []
  );

  /** 上傳／回饋後強制重抓靈感（略過快取） */
  const refreshInspirationInsights = useCallback(
    (region: MapRegion, weatherSnapshot?: WeatherData | null) => {
      const snap =
        weatherSnapshot ??
        (selectedRegion && regionWeather && isSameRegion(selectedRegion, region)
          ? regionWeather
          : weather);
      if (!snap || typeof snap.temp !== "number" || Number.isNaN(snap.temp)) return;
      regionInsightsFetchKeyRef.current = null;
      void loadRegionInsights(snap, region, { showLoading: false, force: true });
    },
    [weather, regionWeather, selectedRegion, loadRegionInsights]
  );

  const loadRegionColorFills = useCallback(async (weatherSnapshot: WeatherData) => {
    const temp = weatherSnapshot.temp;
    if (typeof temp !== "number" || Number.isNaN(temp)) return;
    const delta = getInsightTempDelta(weatherSnapshot);
    const key = `${Math.round(temp)}@d${delta}r3`;
    const now = Date.now();
    const lastAt = regionColorFillsLastRequestAtRef.current.get(key) ?? 0;
    if (now - lastAt < 2500) return;
    if (regionColorFillsInFlightRef.current.has(key)) return;
    regionColorFillsInFlightRef.current.add(key);
    regionColorFillsLastRequestAtRef.current.set(key, now);
    try {
      const { fills } = await fetchRegionColorFills(temp, delta);
      regionColorFillsKeyRef.current = key;
      setRegionColorFills(fills);
    } catch (error) {
      console.warn("Region color fills:", error);
      if (isRateLimitedError(error)) {
        // 限流時保留前一次成功填色，避免地圖瞬間全部清空。
        regionColorFillsKeyRef.current = key;
        regionColorFillsLastRequestAtRef.current.set(key, Date.now() + 6000);
      } else {
        regionColorFillsKeyRef.current = null;
        setRegionColorFills([]);
      }
    } finally {
      regionColorFillsInFlightRef.current.delete(key);
    }
  }, []);

  useEffect(() => {
    if (weather) {
      void loadOutfitInsights(weather);
    }
  }, [weather, loadOutfitInsights]);

  useEffect(() => {
    if (screen !== "home") return;

    const colorWeatherSnapshot =
      selectedRegion && regionWeather ? regionWeather : weather;
    if (!colorWeatherSnapshot) return;
    const temp = colorWeatherSnapshot.temp;
    if (typeof temp !== "number" || Number.isNaN(temp)) return;
    const delta = getInsightTempDelta(colorWeatherSnapshot);
    const key = `${Math.round(temp)}@d${delta}r3`;
    if (regionColorFillsKeyRef.current === key) return;
    void loadRegionColorFills(colorWeatherSnapshot);
  }, [
    screen,
    selectedRegion,
    regionWeather,
    weather,
    loadRegionColorFills,
  ]);

  useEffect(() => {
    if (!selectedRegion) {
      regionWeatherFetchKeyRef.current = null;
      setRegionWeather(null);
      return;
    }

    const key = regionKey(selectedRegion);
    if (regionWeatherFetchKeyRef.current !== key) {
      regionWeatherFetchKeyRef.current = key;
      regionInsightsFetchKeyRef.current = null;
      setRegionInsights(null);
      void loadRegionWeather(selectedRegion);
    }
  }, [selectedRegion, loadRegionWeather]);

  useEffect(() => {
    if (!selectedRegion || regionWeatherLoading || !regionWeather) return;

    const delta = getInsightTempDelta(regionWeather);
    const key = `${regionKey(selectedRegion)}@${Math.round(regionWeather.temp)}@d${delta}`;
    if (regionInsightsFetchKeyRef.current === key) return;

    void loadRegionInsights(regionWeather, selectedRegion, {
      showLoading: !regionInsightsRef.current,
    });
  }, [selectedRegion, regionWeatherLoading, regionWeather, loadRegionInsights]);

  const syncUserFavorites = useCallback(async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) {
      setInspirationFavorites({ userName: "", items: {} });
      return;
    }
    setInspirationFavorites(loadInspirationFavorites(trimmed));
    try {
      const cards = await fetchUserFavorites(trimmed);
      const fromServer = favoritesStateFromCards(trimmed, cards);
      setInspirationFavorites(fromServer);
      saveInspirationFavorites(fromServer);
    } catch (error) {
      console.warn("fetchUserFavorites:", error);
    }
  }, []);

  useEffect(() => {
    void syncUserFavorites(userName);
  }, [userName, syncUserFavorites]);

  useEffect(() => {
    const expired = expireStalePending();
    const session = loadSession();

    if (session.userName) setUserName(session.userName);
    if (session.gender) setUserGender(session.gender);
    if (session.userLocation) {
      setUserLocation(session.userLocation);
      setLocationInput(session.userLocation.name);
      const parsed = parseLocationToPickerValue(session.userLocation.name);
      if (parsed) {
        setLocationPicker(parsed);
        if (parsed.county === TAIPEI_COUNTY) {
          setMapView("taipei-districts");
        }
      }
      homeGeoRequested.current = true;
    }
    setReminder(session.reminder);
    if (session.activeUserRecord) {
      setActiveUserRecord(session.activeUserRecord);
    }

    const recordId = getRecordIdFromUrl();
    if (recordId) {
      setNotionPageId(recordId);
      setPendingRecord(recordId);
      clearRecordFromUrl();
    } else if (isPendingValidToday(session.pendingRecord)) {
      const pending = session.pendingRecord!;
      setNotionPageId(pending.pageId);
      if (pending.recordedTime) setCurrentTime(pending.recordedTime);
    }

    const pendingValid = isPendingValidToday(session.pendingRecord);
    setHasPendingFeedback(pendingValid);

    if (pendingValid) {
      void hydratePendingRecordFromNotion().then((updated) => {
        if (updated) setPendingRevision((n) => n + 1);
      });
    }

    if (expired) {
      setTimeout(() => showToast("昨日的紀錄已過期，請重新拍照"), 0);
    }

    const canAutoStart = Boolean(session.userName.trim() && session.gender);
    if (canAutoStart) {
      if (session.userLocation) {
        void loadWeather(
          session.userLocation.lat,
          session.userLocation.lon,
          session.userLocation.name
        );
      }
      setScreen(recordId ? "feedback" : "home");
    }

    sessionHydrated.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 僅在掛載時還原 session
  }, []);

  useEffect(() => {
    if (!sessionHydrated.current) return;
    saveSession({ userName });
  }, [userName]);

  useEffect(() => {
    if (!sessionHydrated.current) return;
    saveSession({ gender: userGender });
  }, [userGender]);

  useEffect(() => {
    if (!sessionHydrated.current) return;
    saveSession({ userLocation });
  }, [userLocation]);

  useEffect(() => {
    if (!sessionHydrated.current) return;
    saveSession({ reminder });
    if (!reminder.enabled) {
      void cancelEveningReminder();
    }
  }, [reminder]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState !== "visible") return;
      const session = loadSession();
      if (isPendingValidToday(session.pendingRecord) && session.pendingRecord) {
        setHasPendingFeedback(true);
        setNotionPageId(session.pendingRecord.pageId);
        void hydratePendingRecordFromNotion().then((updated) => {
          if (updated) setPendingRevision((n) => n + 1);
        });
        if (session.reminder.enabled) {
          void maybeShowPendingReminderNotification(
            session.pendingRecord.pageId,
            session.reminder
          );
        }
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  const handleReminderChange = (next: ReminderSettings) => {
    setReminder(next);
  };

  const refreshPendingFeedback = useCallback(() => {
    setHasPendingFeedback(isPendingValidToday(loadSession().pendingRecord));
  }, []);

  useEffect(() => {
    refreshPendingFeedback();
  }, [screen, refreshPendingFeedback]);

  useEffect(() => {
    if (!hasPendingFeedback) return;
    setOutfitImage(null);
    setRecordSaving(false);
    setShowActionSheet(false);
    setIsCameraOpen(false);
  }, [hasPendingFeedback]);

  const continuePendingFeedback = () => {
    const session = loadSession();
    if (isPendingValidToday(session.pendingRecord)) {
      setNotionPageId(session.pendingRecord!.pageId);
    }
    setScreen("feedback");
  };

  const requestExit = useCallback(() => {
    const hasPending =
      hasPendingFeedback || isPendingValidToday(loadSession().pendingRecord);
    if (!hasPending) {
      setShowExitConfirm(true);
      return;
    }
    if (screen === "feedback") {
      showToast("請先完成今日穿搭的體感回饋，再離開 App");
      return;
    }
    setShowPendingExitBlock(true);
  }, [hasPendingFeedback, screen]);

  const goFeedbackFromPendingExit = () => {
    setShowPendingExitBlock(false);
    continuePendingFeedback();
  };

  const uploadedOutfitTags = useMemo((): OutfitAnalysis | null => {
    const pending = loadSession().pendingRecord;
    if (!isPendingValidToday(pending) || !pending) return null;
    const upper = pending.upperBodyTags ?? [];
    const lower = pending.lowerBodyTags ?? [];
    const colors = pending.colors ?? [];
    if (upper.length === 0 && lower.length === 0 && colors.length === 0) return null;
    return {
      upperBodyTags: upper,
      lowerBodyTags: lower,
      colors,
      ...(pending.tagAnchors?.length ? { tagAnchors: pending.tagAnchors } : {}),
    };
  }, [pendingRevision, hasPendingFeedback]);

  const feedbackOutfit = useMemo((): FeedbackOutfitContext => {
    const pending = loadSession().pendingRecord;
    const useUploadSnapshot = isPendingValidToday(pending) && pending;

    if (useUploadSnapshot) {
      return {
        photoUrl:
          pending.photoDataUrl ??
          outfitImage?.previewUrl ??
          pending.photoPreviewUrl,
        locationName: pending.locationName,
        temp: pending.temp,
        condition: pending.condition,
        recordedTime:
          pending.recordedTime ||
          (pending.photoSavedAt ? formatTimeFromIso(pending.photoSavedAt) : undefined),
      };
    }

    return {
      photoUrl: outfitImage?.previewUrl ?? pending?.photoPreviewUrl,
      locationName: weather?.locationName ?? pending?.locationName,
      temp: weather?.temp ?? pending?.temp,
      condition: weather?.condition ?? pending?.condition,
      recordedTime:
        currentTime ||
        pending?.recordedTime ||
        (pending?.photoSavedAt ? formatTimeFromIso(pending.photoSavedAt) : undefined),
    };
  }, [outfitImage, weather, currentTime, pendingRevision]);

  const pickerInspirationRegion = useMemo(
    () => locationPickerToRegion(locationPicker),
    [locationPicker]
  );

  /** 靈感分頁預設：首頁地區選單（全區＝台北市全市） */
  const inspirationBaselineRegion = useMemo((): MapRegion => {
    if (isTaipeiWholeAreaPicker(locationPicker)) {
      return TAIPEI_WHOLE_REGION;
    }
    return pickerInspirationRegion;
  }, [locationPicker, pickerInspirationRegion]);

  const inspirationBaselineLabel = useMemo(
    () => regionLabel(inspirationBaselineRegion),
    [inspirationBaselineRegion]
  );

  /** 地圖深入瀏覽時用選定區；否則用地區選單 */
  const activeInspirationRegion = useMemo((): MapRegion => {
    return inspirationDrilldownRegion ?? inspirationBaselineRegion;
  }, [inspirationDrilldownRegion, inspirationBaselineRegion]);

  useEffect(() => {
    if (screen !== "inspiration") {
      setInspirationDrilldownRegion(null);
    }
  }, [screen]);

  const inspirationRegionLabel = useMemo(
    () => regionLabel(activeInspirationRegion),
    [activeInspirationRegion]
  );

  /** 與地圖排行榜同一區時，沿用該區天氣溫度查詢 */
  const weatherSnapshotForInspiration = useMemo((): WeatherData | null => {
    if (
      selectedRegion &&
      regionWeather &&
      isSameRegion(selectedRegion, activeInspirationRegion)
    ) {
      return regionWeather;
    }
    return weather ?? null;
  }, [selectedRegion, regionWeather, activeInspirationRegion, weather]);

  const inspirationQueryTemp = useMemo(() => {
    const t = weatherSnapshotForInspiration?.temp;
    return typeof t === "number" && !Number.isNaN(t) ? t : null;
  }, [weatherSnapshotForInspiration]);

  const activeInspirationKey = useMemo(() => {
    if (inspirationQueryTemp == null) return null;
    return `${regionKey(activeInspirationRegion)}@${Math.round(inspirationQueryTemp)}`;
  }, [activeInspirationRegion, inspirationQueryTemp]);

  /** 靈感頁／首頁「全區」時載入區域穿搭靈感 */
  useEffect(() => {
    if (!activeInspirationKey || inspirationQueryTemp == null) return;
    if (!weatherSnapshotForInspiration) return;

    const prefetchWholeTaipei =
      isTaipeiWholeAreaPicker(locationPicker) &&
      screen === "home" &&
      (!selectedRegion || isSameRegion(selectedRegion, TAIPEI_WHOLE_REGION));
    const loadForInspirationTab = screen === "inspiration";
    if (!prefetchWholeTaipei && !loadForInspirationTab) return;

    const cacheHit = regionInsightsFetchKeyRef.current === activeInspirationKey;
    const cached = regionInsightsRef.current;
    const stalePhotoCache =
      cacheHit &&
      cached != null &&
      cached.sampleCount > 0 &&
      cached.inspiration.length === 0;
    if (cacheHit && cached != null && !stalePhotoCache) return;

    void loadRegionInsights(weatherSnapshotForInspiration, activeInspirationRegion, {
      showLoading: loadForInspirationTab,
    });
  }, [
    screen,
    activeInspirationKey,
    activeInspirationRegion,
    inspirationQueryTemp,
    weatherSnapshotForInspiration,
    loadRegionInsights,
    locationPicker.county,
    locationPicker.district,
    selectedRegion,
  ]);

  useEffect(() => {
    if (!regionInsights?.inspiration.length) return;
    setOptimisticInspirationCards((prev) =>
      prev.filter(
        (o) => !regionInsights.inspiration.some((item) => item.id === o.id)
      )
    );
  }, [regionInsights]);

  const inspirationCards = useMemo(() => {
    const fromApi = regionInsights?.inspiration ?? [];
    const seen = new Set(fromApi.map((c) => c.id));
    const optimistic = optimisticInspirationCards.filter((c) => !seen.has(c.id));
    return [...optimistic, ...fromApi];
  }, [regionInsights, optimisticInspirationCards]);

  const favoriteCards = useMemo(
    () => listFavoriteCards(inspirationFavorites),
    [inspirationFavorites]
  );

  const handleToggleFavorite = async (card: InspirationItem) => {
    const trimmedName = userName.trim();
    const targetUserName = card.who?.trim();
    if (!trimmedName) {
      showToast("請先完成登入設定");
      return;
    }
    if (!card.id) {
      showToast("此穿搭缺少 Notion 紀錄，無法收藏");
      return;
    }
    const saved = isInspirationFavorite(inspirationFavorites, card.id);
    if (targetUserName && trimmedName === targetUserName && !saved) {
      showToast("無法收藏自己的穿搭");
      return;
    }
    if (favoriteBusyId === card.id) return;
    setFavoriteBusyId(card.id);
    try {
      const session = loadSession();
      const result = await toggleOutfitFavorite(trimmedName, card.id, !saved, {
        activeUserRecord: session.activeUserRecord ?? activeUserRecord,
        location: weather?.locationName ?? userLocation?.name,
        gender: userGender,
        temp: weather?.temp,
        weather: weather?.condition,
      });
      const active: ActiveUserRecord = result.activeUserRecord;
      setActiveUserRecord(active);
      saveSession({ activeUserRecord: active });
      setNotionPageId(active.pageId);
      setInspirationFavorites((prev) => {
        const base =
          prev.userName === trimmedName ? prev : loadInspirationFavorites(trimmedName);
        return saved
          ? removeInspirationFavorite(base, card.id)
          : addInspirationFavorite(base, card);
      });
      showToast(saved ? "已取消收藏" : "已加入收藏 ♡");
    } catch (error) {
      console.warn("toggleOutfitFavorite:", error);
      showToast(
        error instanceof Error && error.message
          ? error.message
          : "收藏同步失敗"
      );
    } finally {
      setFavoriteBusyId(null);
    }
  };

  const startApp = () => {
    if (!userName.trim() || !userGender) return;
    saveSession({
      userName: userName.trim(),
      gender: userGender,
      reminder,
    });
    setScreen("home");
  };

  const performExitApp = () => {
    resetAppSession();
    clearRecordFromUrl();
    void cancelEveningReminder();

    setUserName("");
    setUserGender(null);
    setUserLocation(null);
    setLocationInput("");
    setLocationPicker({ county: TAIPEI_COUNTY, district: TAIPEI_WHOLE_AREA });
    homeGeoRequested.current = false;
    setWeather(null);
    setWeatherLoading(false);
    setOutfitInsights(null);
    setInsightsLoading(false);
    setInspirationFavorites({ items: {} });
    setOutfitImage(null);
    setNotionPageId(null);
    setActiveUserRecord(null);
    setHasPendingFeedback(false);
    setPendingRevision(0);
    setReminder(DEFAULT_REMINDER);
    setFeelSet(false);
    setFeedbackDesc("尚未標記");
    setRecordSaving(false);
    setIsCameraOpen(false);
    setShowActionSheet(false);
    setFavoriteBusyId(null);
    setCurrentTime("");
    setScreen("welcome");
    setShowExitConfirm(false);
    showToast("已返回初始頁面");
  };

  const onOutfitImageReady = (img: ParsedOutfitImage) => {
    setRecordSaving(false);
    setOutfitImage(img);
    setOutfitAnalysisPreview(null);
    setOutfitAnalysisLoading(false);
    const now = new Date();
    setCurrentTime(
      `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`
    );
  };

  const clearOutfitImage = () => {
    setRecordSaving(false);
    setOutfitImage(null);
    setOutfitAnalysisPreview(null);
    setOutfitAnalysisLoading(false);
  };

  const saveToWardrobe = async () => {
    if (!outfitImage || !weather || recordSaving) return;

    setRecordSaving(true);
    setOutfitAnalysisPreview(null);
    setOutfitAnalysisLoading(true);

    let upperBodyTags: string[] = [];
    let lowerBodyTags: string[] = [];
    let savedColors: string[] = [];
    let savedTagAnchors: OutfitAnalysis["tagAnchors"];

    try {
      try {
        const analysis = await analyzeOutfit(
          outfitImage.base64,
          outfitImage.mimeType
        );
        upperBodyTags = analysis.upperBodyTags;
        lowerBodyTags = analysis.lowerBodyTags;
        savedColors = analysis.colors ?? [];
        savedTagAnchors = analysis.tagAnchors;
        setOutfitAnalysisPreview(analysis);
        setOutfitAnalysisLoading(false);
        // 讓標籤動畫播完再寫入 Notion
        await new Promise((resolve) => setTimeout(resolve, 1400));
      } catch (error) {
        setOutfitAnalysisLoading(false);
        console.warn("Gemini analyze:", error);
        const msg = error instanceof Error ? error.message : "";
        if (msg.includes("額度") || msg.includes("429") || msg.includes("quota")) {
          showToast("Gemini 額度不足，仍會儲存照片與天氣（無 AI 標籤）");
        } else {
          showToast(msg || "AI 辨識失敗，仍會儲存照片與天氣");
        }
      }

      // 每次完成記錄都建立「新的一列」穿搭（不覆寫 active 列；同 userName＋氣溫可有多筆）
      const { id: pageId } = await createRecord({
        ...buildRecordFromWeather(
          userName,
          weather,
          toStartedAtIso(currentTime),
          userGender ?? loadSession().gender ?? undefined
        ),
        upperBodyTags: upperBodyTags.length ? upperBodyTags : undefined,
        lowerBodyTags: lowerBodyTags.length ? lowerBodyTags : undefined,
        colors: savedColors.length ? savedColors : undefined,
        photoBase64: outfitImage.base64,
        photoMimeType: outfitImage.mimeType,
      });
      let photoPreviewUrl = outfitImage.previewUrl;
      let photoDataUrl = `data:${outfitImage.mimeType};base64,${outfitImage.base64}`;
      try {
        const thumb = await compressDataUrl(
          `data:${outfitImage.mimeType};base64,${outfitImage.base64}`,
          480,
          0.72
        );
        photoPreviewUrl = thumb.previewUrl;
        photoDataUrl = thumb.previewUrl;
      } catch {
        /* 沿用原預覽圖 */
      }

      setNotionPageId(pageId);
      setPendingRecord(pageId, {
        photoPreviewUrl,
        photoDataUrl,
        locationName: weather.locationName,
        temp: weather.temp,
        condition: weather.condition,
        recordedTime: currentTime || formatTimeFromIso(new Date().toISOString()),
        ...(upperBodyTags.length ? { upperBodyTags } : {}),
        ...(lowerBodyTags.length ? { lowerBodyTags } : {}),
        ...(savedColors.length ? { colors: savedColors } : {}),
        ...(savedTagAnchors?.length ? { tagAnchors: savedTagAnchors } : {}),
      });
      setPendingRevision((n) => n + 1);
      const loc = userLocation ?? loadSession().userLocation;
      if (loc && savedColors.length > 0) {
        addMapContribution(loc.lat, loc.lon, savedColors, { id: pageId });
      }
      if (weather) {
        void loadRegionColorFills(weather);
      }
      setHasPendingFeedback(true);
      setOutfitImage(null);
      setOutfitAnalysisPreview(null);
      setOutfitAnalysisLoading(false);
      setShowActionSheet(false);
      setIsCameraOpen(false);

      const inspRegion = locationPickerToRegion(locationPicker);
      const tags = [...upperBodyTags, ...lowerBodyTags];
      setOptimisticInspirationCards((prev) => {
        const next = prev.filter((c) => c.id !== pageId);
        next.unshift({
          id: pageId,
          emoji: upperBodyTags[0] ? "👕" : lowerBodyTags[0] ? "👖" : "🧥",
          bg: "#e8f4ff",
          match: "-",
          temp: `${Math.round(weather.temp)}°C・${weather.condition}`,
          who: userName.trim() || "我",
          date: "今天",
          feelMetrics: {},
          tags: tags.slice(0, 4),
          colors: savedColors.slice(0, 3),
          humidity:
            weather.humidity != null ? `${Math.round(weather.humidity)}%` : "—",
          location: weather.locationName?.split(" ")[0] || weather.locationName || "—",
          photoUrl: photoPreviewUrl,
          ...(userGender ? { gender: userGender } : {}),
        });
        return next;
      });
      refreshInspirationInsights(inspRegion, weather);
      void loadOutfitInsights(weather);

      await scheduleEveningReminder(pageId, reminder);
      const link = buildRecordUrl(pageId);
      void navigator.clipboard.writeText(link).catch(() => {});
      showToast("已記錄，你可以前往回饋穿搭體感");
    } catch (error) {
      console.warn("Notion create record:", error);
      const msg = error instanceof Error ? error.message : "";
      if (msg.includes("expected to be")) {
        showToast(
          "Notion 欄位類型不符：請確認 Upper Body Tags / color 為 Multi-select、Lower Body Tags 為 Select"
        );
      } else {
        showToast(msg ? `Notion 同步失敗：${msg}` : "Notion 同步失敗");
      }
    } finally {
      setRecordSaving(false);
    }
  };

  const dismissFeedbackShareOverlay = useCallback(() => {
    setFeedbackShareSnapshot(null);
    setFeelSet(false);
    setFeedbackDesc("尚未標記");
    setScreen("home");
  }, []);

  const submitFeedback = async (
    metrics: {
      breathability: number;
      snugness: number;
      stuffiness: number;
    },
    feelNote?: string
  ) => {
    if (!feelSet) return;

    const pending = loadSession().pendingRecord;
    const pageId =
      (isPendingValidToday(pending) ? pending!.pageId : null) ??
      notionPageId ??
      loadSession().activeUserRecord?.pageId ??
      activeUserRecord?.pageId ??
      null;

    if (!pageId) {
      showToast("找不到今日穿搭紀錄，請重新拍照或開啟晚間連結");
      return;
    }

    try {
      const note = feelNote?.trim();
      await updateRecord(pageId, {
        breathability: metrics.breathability,
        wrapping: metrics.snugness,
        stuffiness: metrics.stuffiness,
        ...(note ? { feedback: note } : {}),
      });

      const sharePhotoDataUrl = await resolveSharePhotoDataUrl([
        outfitImage?.base64 && outfitImage?.mimeType
          ? `data:${outfitImage.mimeType};base64,${outfitImage.base64}`
          : undefined,
        pending?.photoDataUrl,
        outfitImage?.previewUrl,
        feedbackOutfit.photoUrl,
        pending?.photoPreviewUrl,
      ]);

      setFeedbackShareSnapshot({
        context: {
          ...feedbackOutfit,
          photoUrl: sharePhotoDataUrl ?? feedbackOutfit.photoUrl,
        },
        analysis: uploadedOutfitTags,
        metrics,
        dateLabel: formatShareDateLabel(),
        summary: feedbackDesc,
        note: note ?? "",
        photoDataUrl: sharePhotoDataUrl,
        photoFallbackUrl: sharePhotoDataUrl,
      });

      markPendingFeedbackComplete();
      clearPendingRecord();
      setHasPendingFeedback(false);
      setOutfitImage(null);
      void cancelEveningReminder();

      if (weather) {
        refreshInspirationInsights(
          inspirationDrilldownRegion ?? locationPickerToRegion(locationPicker),
          weather
        );
        void loadOutfitInsights(weather);
      }
    } catch (error) {
      console.warn("Notion update record:", error);
      showToast(
        error instanceof Error && error.message
          ? `Notion 同步失敗：${error.message}`
          : "Notion 同步失敗"
      );
      return;
    }
    
    // Record outfit data
    const newOutfit: Outfit = {
      id: Date.now().toString(),
      emoji: "🧥",
      bg: "#ebe6dc",
      match: "-",
      temp: `${Math.round(weather?.temp || 26)}°C`,
      who: userName,
      date: "今天",
      location: weather?.locationName?.split(" ")[1] || weather?.locationName || "台北",
      feelMetrics: {
        breathability: metrics.breathability,
        wrapping: metrics.snugness,
        stuffiness: metrics.stuffiness,
      },
      tags: [],
      colors: [],
      humidity: `${weather?.humidity || 78}%`
    };
    
    setOutfitList([newOutfit, ...outfitList]);
  };

  return (
    <div className="app-shell font-sans">
      <div className="app-frame">
        <div className="app-screen-host">
        <div className="app-screen-flow">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={screen}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              className={`app-screen-page ${screen === "welcome" ? "welcome-screen-page" : "app-screen-gradient"}`}
            >
              {screen === "welcome" && (
              <WelcomeScreen
                userName={userName}
                setUserName={setUserName}
                userGender={userGender}
                setUserGender={setUserGender}
                startApp={startApp}
              />
              )}
              {screen === "home" && (
                <HomeScreen
                  userName={userName}
                  mapWeather={
                    selectedRegion ? regionWeather : weather
                  }
                  mapWeatherLoading={
                    selectedRegion ? regionWeatherLoading : weatherLoading
                  }
                  locationPicker={locationPicker}
                  onLocationPickerChange={applyLocationPicker}
                  locating={locating}
                  onRequestLocate={requestHomeGeolocation}
                  regionColorFills={regionColorFills}
                  userCounty={userCounty}
                  userDistrict={userDistrict}
                  mapView={mapView}
                  onMapViewChange={setMapView}
                  locateFocusTick={locateFocusTick}
                  selectedRegion={selectedRegion}
                  onSelectRegion={setSelectedRegion}
                  regionInsights={regionInsights}
                  regionInsightsLoading={regionInsightsLoading}
                  onOpenRegionInspiration={() => {
                    if (!selectedRegion) return;
                    setInspirationDrilldownRegion(selectedRegion);
                    setScreen("inspiration");
                  }}
                  showPendingBanner={hasPendingFeedback}
                  onContinuePending={continuePendingFeedback}
                  onRequestExit={requestExit}
                />
              )}
              {screen === "inspiration" && (
                <InspirationFeedScreen
                  cards={inspirationCards}
                  currentUserName={userName}
                  insightsLoading={regionInsightsLoading}
                  favorites={inspirationFavorites}
                  favoriteBusyId={favoriteBusyId}
                  onToggleFavorite={handleToggleFavorite}
                  onGoRecord={() => setScreen("record")}
                  weather={weather}
                  insights={regionInsights ?? outfitInsights}
                  regionLabel={inspirationRegionLabel}
                  drilldownBackLabel={
                    inspirationDrilldownRegion ? inspirationBaselineLabel : null
                  }
                  onBackFromDrilldown={
                    inspirationDrilldownRegion
                      ? () => setInspirationDrilldownRegion(null)
                      : undefined
                  }
                  onRequestExit={requestExit}
                />
              )}
              {screen === "favorites" && (
                <FavoritesScreen
                  cards={favoriteCards}
                  currentUserName={userName}
                  favorites={inspirationFavorites}
                  favoriteBusyId={favoriteBusyId}
                  onToggleFavorite={handleToggleFavorite}
                  weather={weather}
                  insights={outfitInsights}
                  onRequestExit={requestExit}
                />
              )}
              {screen === "record" && (
              <RecordScreen
                hasUploadedToday={hasPendingFeedback}
                uploadedPhotoUrl={feedbackOutfit.photoUrl}
                uploadedOutfitTags={uploadedOutfitTags}
                onGoToFeedback={continuePendingFeedback}
                outfitImage={outfitImage}
                outfitAnalysisPreview={outfitAnalysisPreview}
                outfitAnalysisLoading={outfitAnalysisLoading}
                onImageReady={onOutfitImageReady}
                onClearImage={clearOutfitImage}
                currentTime={currentTime}
                saveToWardrobe={saveToWardrobe}
                recordSaving={recordSaving}
                weather={weather}
                isCameraOpen={isCameraOpen}
                setIsCameraOpen={setIsCameraOpen}
                showActionSheet={showActionSheet}
                setShowActionSheet={setShowActionSheet}
                showToast={showToast}
                reminder={reminder}
                onReminderChange={handleReminderChange}
                onRequestExit={requestExit}
              />
            )}
            {screen === "feedback" && (
              <FeedbackScreen
                needsFeedback={hasPendingFeedback}
                feedbackOutfit={feedbackOutfit}
                feedbackDesc={feedbackDesc}
                setFeedbackDesc={setFeedbackDesc}
                feelSet={feelSet}
                setFeelSet={setFeelSet}
                submitFeedback={submitFeedback}
                onRequestExit={requestExit}
              />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
        </div>

        {/* Global Nav Bar */}
        {screen !== "welcome" && (
          <div className="app-nav-dock">
            <nav className="glass-nav app-inset flex rounded-2xl px-2 py-3">
              {[
                { id: "home", icon: <Home size={20} />, label: "首頁" },
                { id: "inspiration", icon: <Sparkles size={20} />, label: "靈感" },
                { id: "favorites", icon: <Heart size={20} />, label: "收藏" },
                { id: "record", icon: <Camera size={20} />, label: "記錄" },
                { id: "feedback", icon: <Smile size={20} />, label: "回饋" },
              ].map((tab) => (
                <button 
                  key={tab.id}
                  onClick={() => {
                    if (tab.id === "home") {
                      setSelectedRegion(null);
                    }
                    setScreen(tab.id as Screen);
                  }}
                  className={`flex-1 flex flex-col items-center gap-1 transition-all ${screen === tab.id ? "text-stone-800" : "text-stone-400 hover:text-stone-600"}`}
                >
                  <div className={`rounded-xl p-1.5 transition-all ${screen === tab.id ? "bg-stone-200/70 shadow-sm" : ""}`}>
                    {tab.icon}
                  </div>
                  <span className={`text-[9px] font-bold tracking-tight ${screen === tab.id ? "text-stone-800" : "text-stone-400"}`}>{tab.label}</span>
                </button>
              ))}
            </nav>
          </div>
        )}

        {/* Toast Notification */}
        <AnimatePresence>
          {toastMsg ? (
            <Toast key="app-toast" message={toastMsg} onClear={() => setToastMsg("")} />
          ) : null}
        </AnimatePresence>

        <ExitConfirmDialog
          open={showExitConfirm}
          onCancel={() => setShowExitConfirm(false)}
          onConfirm={performExitApp}
        />
        <PendingExitBlockDialog
          open={showPendingExitBlock}
          onCancel={() => setShowPendingExitBlock(false)}
          onGoFeedback={goFeedbackFromPendingExit}
        />
        <FeedbackShareOverlay
          open={feedbackShareSnapshot != null}
          snapshot={feedbackShareSnapshot}
          onDismiss={dismissFeedbackShareOverlay}
          onDownloadSuccess={showToast}
          onDownloadError={showToast}
        />
      </div>
    </div>
  );
}

