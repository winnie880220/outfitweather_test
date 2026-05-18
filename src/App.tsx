/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { BottomActionBar } from "./components/BottomActionBar";
import { FeelSliderField } from "./components/FeelSliderField";
import { FEEL_TONES } from "./lib/feel-metrics";
import { OutfitStatsPanel } from "./components/OutfitStatsPanel";
import {
  FeedbackOutfitCard,
  type FeedbackOutfitContext,
} from "./components/FeedbackOutfitCard";
import { PendingFeedbackBanner } from "./components/PendingFeedbackBanner";
import { ReminderSettingsPanel } from "./components/ReminderSettings";
import { WeatherSummaryCard } from "./components/WeatherSummaryCard";
import { motion, AnimatePresence } from "motion/react";
import {
  analyzeOutfit,
  buildRecordFromWeather,
  toggleOutfitFavorite,
  fetchUserFavorites,
  ensureActiveUserRecordApi,
  fetchCurrentWeather,
  fetchOutfitInsights,
  formatGeoLabel,
  reverseGeocode,
  searchLocations,
  updateRecord,
} from "./lib/api";
import type { InspirationItem, OutfitInsights } from "./lib/api";
import { captureVideoFrame, compressDataUrl } from "./lib/image";
import { buildRecordUrl, clearRecordFromUrl, getRecordIdFromUrl } from "./lib/record-url";
import {
  cancelEveningReminder,
  maybeShowPendingReminderNotification,
  scheduleEveningReminder,
} from "./lib/reminder";
import {
  addInspirationFavorite,
  clearInspirationFavorites,
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
import type {
  GeoSearchResult,
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
  Sun,
  Cloud,
  Upload,
  Wind,
  User,
  LogOut,
} from "lucide-react";

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
    humidity: "82%"
  }
];

// --- Components ---

const Toast = ({ message, onClear }: { message: string; onClear: () => void }) => {
  useEffect(() => {
    const timer = setTimeout(onClear, 2000);
    return () => clearTimeout(timer);
  }, [onClear]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 50 }}
      className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-stone-800 text-white px-5 py-2.5 rounded-full text-sm font-medium whitespace-nowrap shadow-lg"
    >
      {message}
    </motion.div>
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
  <AnimatePresence>
    {open ? (
      <motion.div
        className="fixed inset-0 z-[60] flex items-center justify-center p-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        role="presentation"
        onClick={onCancel}
      >
        <motion.div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="exit-dialog-title"
          aria-describedby="exit-dialog-desc"
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 8 }}
          transition={{ duration: 0.18 }}
          className="w-full max-w-[300px] rounded-2xl bg-white p-5 shadow-xl ring-1 ring-stone-200/80"
          onClick={(e) => e.stopPropagation()}
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
        </motion.div>
      </motion.div>
    ) : null}
  </AnimatePresence>
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
  locationInput,
  setLocationInput,
  userLocation,
  setUserLocation,
  startApp,
  showToast,
}: {
  userName: string;
  setUserName: (v: string) => void;
  userGender: UserGender | null;
  setUserGender: (v: UserGender | null) => void;
  locationInput: string;
  setLocationInput: (v: string) => void;
  userLocation: UserLocation | null;
  setUserLocation: (v: UserLocation | null) => void;
  startApp: () => void;
  showToast: (msg: string) => void;
}) => {
  const [suggestions, setSuggestions] = useState<GeoSearchResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const locationWrapRef = useRef<HTMLDivElement>(null);

  const canStart =
    userName.trim().length > 0 && userGender !== null && userLocation !== null;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (locationWrapRef.current && !locationWrapRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (userLocation && locationInput === userLocation.name) return;

    const q = locationInput.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await searchLocations(q);
        setSuggestions(results);
        setShowDropdown(results.length > 0);
        if (results.length === 0 && q.length >= 2) {
          showToast("找不到相符地點，請換關鍵字或按右側定位");
        }
      } catch (error) {
        setSuggestions([]);
        setShowDropdown(false);
        const msg = error instanceof Error ? error.message : "地點搜尋失敗";
        showToast(msg.includes("fetch") ? "地點服務連線失敗，請稍後再試" : msg);
      } finally {
        setSearching(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [locationInput, userLocation]);

  const handleSelectSuggestion = (item: GeoSearchResult) => {
    const name = formatGeoLabel(item);
    setLocationInput(name);
    setUserLocation({ name, lat: parseFloat(item.lat), lon: parseFloat(item.lon) });
    setShowDropdown(false);
    setSuggestions([]);
  };

  const handleLocationInputChange = (value: string) => {
    setLocationInput(value);
    if (userLocation && value !== userLocation.name) {
      setUserLocation(null);
    }
  };

  const handleUseCurrentLocation = () => {
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
          setLocationInput(name);
          setUserLocation({ name, lat, lon });
          setShowDropdown(false);
          setSuggestions([]);
        } catch (error) {
          const msg = error instanceof Error ? error.message : "";
          showToast(
            msg
              ? `無法解析位置：${msg}`
              : "無法解析目前位置，請手動輸入地點"
          );
        } finally {
          setLocating(false);
        }
      },
      (err) => {
        const code = (err as GeolocationPositionError)?.code;
        if (code === 1) {
          showToast("請在瀏覽器允許定位權限後再試");
        } else if (code === 3) {
          showToast("定位逾時，請到戶外或改用手動輸入");
        } else {
          showToast("無法取得定位，請允許權限或手動輸入");
        }
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  };

  const previewLocation = userLocation?.name?.trim() || locationInput.trim();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="welcome-screen screen-scroll app-scroll"
    >
      <motion.div
        className="welcome-ambient"
        aria-hidden
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
      >
        <span className="welcome-ambient-blob welcome-ambient-blob--sun" />
        <span className="welcome-ambient-blob welcome-ambient-blob--sky" />
      </motion.div>

      <motion.div className="app-inset welcome-body">
        <motion.header
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="welcome-hero"
        >
          <motion.div className="welcome-hero-icons" aria-hidden>
            <motion.span
              className="welcome-hero-icon welcome-hero-icon--sun"
              initial={{ opacity: 0, x: -10, scale: 0.85 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ delay: 0.08, duration: 0.4 }}
            >
              <Sun size={17} strokeWidth={1.75} />
            </motion.span>
            <motion.span
              className="welcome-hero-icon welcome-hero-icon--main"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.14, duration: 0.45, type: "spring", stiffness: 260, damping: 22 }}
            >
              <Shirt size={28} strokeWidth={1.5} />
            </motion.span>
            <motion.span
              className="welcome-hero-icon welcome-hero-icon--cloud"
              initial={{ opacity: 0, x: 10, scale: 0.85 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.4 }}
            >
              <Cloud size={17} strokeWidth={1.75} />
            </motion.span>
          </motion.div>

          <h1 className="welcome-title">衣氣象</h1>
          <p className="welcome-subtitle">Outfit Weather</p>
          <p className="welcome-tagline">依天氣記錄穿搭，晚上回饋穿著體感</p>
        </motion.header>

        <AnimatePresence initial={false}>
          {canStart && (
            <motion.div
              key="welcome-preview"
              initial={{ opacity: 0, y: 10, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, y: -6, height: 0 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="welcome-preview-wrap"
            >
              <p className="welcome-preview">
                <User size={14} className="shrink-0 text-[#8b7355]" aria-hidden />
                <span className="min-w-0 truncate">
                  嗨，<strong className="font-semibold text-stone-800">{userName.trim()}</strong>
                  <span className="text-stone-400"> · </span>
                  <span className="text-stone-600">{previewLocation}</span>
                </span>
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
          className="welcome-setup-card"
          ref={locationWrapRef}
        >
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18, duration: 0.35 }}
          >
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
          </motion.div>

          <div className="welcome-field-divider" aria-hidden />

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.21, duration: 0.35 }}
          >
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
          </motion.div>

          <div className="welcome-field-divider" aria-hidden />

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.24, duration: 0.35 }}
          >
            <label htmlFor="welcome-location" className="welcome-field-label">
              你的地點
            </label>
            <input
              id="welcome-location"
              className="welcome-field-input"
              placeholder="例如：台北"
              value={locationInput}
              onChange={(e) => handleLocationInputChange(e.target.value)}
              onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
              autoComplete="off"
            />

            <button
              type="button"
              onClick={handleUseCurrentLocation}
              disabled={locating}
              className="welcome-locate-btn"
            >
              <MapPin size={14} className="shrink-0" />
              {locating ? "定位中..." : "使用我目前定位"}
            </button>
          </motion.div>

          <AnimatePresence>
            {showDropdown && (
              <motion.ul
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="app-scroll welcome-suggestions"
              >
                {searching && (
                  <li className="px-4 py-3 text-sm text-stone-400">搜尋中...</li>
                )}
                {!searching &&
                  suggestions.map((item) => (
                    <li key={item.place_id}>
                      <button
                        type="button"
                        onClick={() => handleSelectSuggestion(item)}
                        className="welcome-suggestion-item"
                      >
                        <MapPin size={14} className="shrink-0 text-[#8b7355] mt-0.5" />
                        <span className="line-clamp-2">{formatGeoLabel(item)}</span>
                      </button>
                    </li>
                  ))}
              </motion.ul>
            )}
          </AnimatePresence>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28, duration: 0.38 }}
          className="welcome-actions"
        >
          <button
            type="button"
            onClick={startApp}
            disabled={!canStart}
            className={`welcome-start-btn ${canStart ? "welcome-start-btn--ready btn-gradient-primary" : ""}`}
          >
            開始
            <ArrowRight size={17} className={canStart ? "welcome-start-arrow" : ""} />
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
                請先填寫名字、性別和地點
              </motion.p>
            ) : (
              <motion.p
                key="ready"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="welcome-hint welcome-hint--ready"
              >
                準備好了，進去看看今天的天氣
              </motion.p>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </motion.div>
  );
};

const HomeScreen = ({
  userName,
  setScreen,
  weather,
  loading,
  insights,
  insightsLoading,
  showPendingBanner,
  onContinuePending,
  onRequestExit,
}: {
  userName: string;
  setScreen: (s: Screen) => void;
  weather: WeatherData | null;
  loading: boolean;
  insights: OutfitInsights | null;
  insightsLoading: boolean;
  showPendingBanner: boolean;
  onContinuePending: () => void;
  onRequestExit: () => void;
}) => (
  <div className="screen-scroll app-scroll app-screen-gradient">
    <div className="app-inset pt-4 pb-[var(--nav-safe-bottom)]">
      {showPendingBanner ? (
        <PendingFeedbackBanner onContinue={onContinuePending} />
      ) : null}
      <header className="mb-3 flex items-center justify-between gap-2">
        <span className="min-w-0 shrink text-sm font-medium text-stone-800">嗨，{userName}！</span>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="glass-pill flex max-w-[11rem] items-center gap-1 truncate rounded-full px-2.5 py-1 text-[11px] text-stone-600">
            <MapPin size={12} className="shrink-0 text-stone-500" />
            <span className="truncate">
              {loading ? "定位中..." : weather?.locationName || "定位失敗"}
            </span>
          </span>
          <AppExitButton onClick={onRequestExit} />
        </div>
      </header>

      <div className="flex flex-col gap-3">
      {loading ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card-strong flex flex-col items-center justify-center rounded-2xl p-10 animate-pulse"
        >
          <div className="mb-3 h-10 w-10 rounded-full bg-stone-200/80" />
          <div className="h-3 w-20 rounded bg-stone-200/80" />
        </motion.div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <WeatherSummaryCard
            weather={weather}
            metrics={[
              { label: "濕度", val: `${weather?.humidity || 0}%` },
              { label: "降雨", val: `${weather?.rainProb || 0}%` },
              { label: "體感", val: `${Math.round(weather?.apparentTemp || 0)}°` },
              { label: "UV", val: `${weather?.uvIndex || 0}` },
            ]}
          />
        </motion.div>
      )}

        <OutfitStatsPanel insights={insights} loading={insightsLoading} />

        <BottomActionBar
          solo
          primaryLabel="看大家的穿搭"
          onPrimary={() => setScreen("inspiration")}
        />
      </div>
    </div>
  </div>
);


const RecordScreen = ({
  hasUploadedToday,
  uploadedPhotoUrl,
  onGoToFeedback,
  outfitImage,
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
  onGoToFeedback: () => void;
  outfitImage: ParsedOutfitImage | null;
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
    <div className="screen-scroll app-scroll app-screen-gradient">
      <div className="app-inset pt-4 pb-[var(--nav-safe-bottom)]">
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-semibold text-stone-800">記錄今日穿搭</h2>
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
        className="mb-3"
        weather={weather}
        metrics={[
          { label: "濕度", val: `${weather?.humidity || 0}%` },
          { label: "降雨", val: `${weather?.rainProb || 0}%` },
          { label: "體感", val: `${Math.round(weather?.apparentTemp || 0)}°` },
          { label: "時間", val: currentTime || "--:--" },
        ]}
      />

      <div className="relative mb-3 w-full">
        <motion.div
          whileTap={hasUploadedToday ? undefined : { scale: 0.98 }}
          onClick={() =>
            !hasUploadedToday && !hasPhoto && !recordSaving && setShowActionSheet(true)
          }
          className={`h-56 rounded-3xl border-2 flex flex-col items-center justify-center transition-all overflow-hidden ${
            hasUploadedToday
              ? "border-[#1D9E75] bg-[#E1F5EE] cursor-default"
              : hasPhoto
                ? "border-dashed border-[#1D9E75] bg-[#E1F5EE] cursor-pointer"
                : isCameraOpen
                  ? "border-none bg-black cursor-pointer"
                  : "border-dashed border-slate-200 bg-slate-50 cursor-pointer hover:border-[#378ADD]"
          }`}
        >
          {isCameraOpen ? (
            <div className="relative w-full h-full">
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                className="w-full h-full object-cover rounded-3xl"
              />
              <button 
                onClick={capturePhoto}
                className="absolute bottom-4 left-1/2 -translate-x-1/2 w-12 h-12 bg-white rounded-full border-4 border-slate-300 flex items-center justify-center shadow-lg active:scale-90 transition-transform"
              >
                <div className="w-8 h-8 bg-slate-100 rounded-full border border-slate-200" />
              </button>
            </div>
          ) : hasPhoto && photoPreviewUrl ? (
            <div className="relative w-full h-full bg-slate-100">
              <img
                src={photoPreviewUrl}
                alt="今日穿搭"
                className="w-full h-full object-contain object-center rounded-3xl"
              />
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/50 to-transparent p-3 text-center">
                <div className="text-xs font-bold text-white">
                  {hasUploadedToday ? "照片已上傳" : "照片已選取 · 氣象已綁定"}
                </div>
                {!hasUploadedToday && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onClearImage();
                    }}
                    className="mt-1 text-[10px] text-white/90 underline"
                  >
                    重新拍攝
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center">
              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm mx-auto mb-3">
                <Camera size={24} className="text-slate-400" />
              </div>
              <div className="text-sm font-medium text-slate-600">點擊拍照 / 上傳今日穿搭</div>
              <div className="text-[11px] text-slate-400 mt-1">系統自動綁定當下氣象數據</div>
            </div>
          )}
        </motion.div>

        <AnimatePresence>
          {showActionSheet && !hasUploadedToday && (
            <>
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowActionSheet(false)}
                className="absolute inset-0 bg-white/80 backdrop-blur-sm z-20 rounded-3xl"
              />
              <motion.div 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 20, opacity: 0 }}
                className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 p-8"
              >
                <button 
                  onClick={startCamera}
                  className="w-full py-4 bg-stone-800 text-white rounded-2xl flex items-center justify-center gap-2 font-bold shadow-lg"
                >
                  <Camera size={20} /> 開啟自拍鏡頭
                </button>
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-4 bg-white border border-slate-200 text-slate-700 rounded-2xl flex items-center justify-center gap-2 font-bold shadow-md"
                >
                  <Upload size={20} /> 從相簿上傳
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="image/*" 
                  onChange={handleFileChange}
                />
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      {!hasUploadedToday && hasPhoto && (
        <ReminderSettingsPanel
          reminder={reminder}
          onChange={onReminderChange}
          showToast={showToast}
          className="mb-4 mt-0 w-full"
        />
      )}

      {!hasUploadedToday && hasPhoto && (
        <label className="record-photo-consent mb-4 flex cursor-pointer gap-3 px-4 py-3.5">
          <input
            type="checkbox"
            checked={photoShareConsent}
            onChange={(e) => setPhotoShareConsent(e.target.checked)}
            className="record-photo-consent__checkbox mt-0.5 h-4 w-4 shrink-0 rounded"
          />
          <span className="record-photo-consent__text text-xs leading-relaxed">
            我已了解：這張穿搭照片可能會出現在其他使用者的
            <span className="font-semibold">靈感參考</span>
            中，協助大家在相近天氣下選擇穿搭（僅分享照片與天氣資訊，不含個人名字）。
          </span>
        </label>
      )}

      <div className="pt-2 pb-2">
        {hasUploadedToday ? (
          <>
            <BottomActionBar solo primaryLabel="前往回饋" onPrimary={onGoToFeedback} />
            <p className="mt-3 text-center text-xs leading-relaxed text-stone-400">
              你需要完成體感回饋才可以上傳新穿搭
            </p>
          </>
        ) : (
          <BottomActionBar
            solo
            primaryLabel={recordSaving ? "AI 分析並寫入中…" : "完成記錄"}
            onPrimary={handleCompleteRecord}
            disabled={!hasPhoto}
            loading={recordSaving}
          />
        )}
      </div>
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
  submitFeedback: (metrics: {
    breathability: number;
    snugness: number;
    stuffiness: number;
  }) => void;
  onRequestExit: () => void;
}) => {
  const [metrics, setMetrics] = useState({
    breathability: 50,
    snugness: 50,
    stuffiness: 50
  });

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

      <div className="feedback-sliders glass-card-strong mb-5 w-full rounded-2xl p-6">
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
      </div>

      <div
        className={`glass-card mb-4 w-full rounded-xl p-4 transition-opacity ${feelSet ? "opacity-100 scale-100" : "opacity-30 scale-[0.98] animate-pulse"}`}
      >
        <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-stone-400">
          你的感受
        </div>
        <div className="flex items-center gap-2 text-sm font-bold text-stone-800">
          {feelSet ? (
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: FEEL_TONES.wrapping }} />
          ) : (
            <span className="h-2 w-2 rounded-full bg-stone-300" />
          )}
          {feedbackDesc}
        </div>
      </div>
      <div className="pt-6 pb-2">
        <BottomActionBar
          solo
          primaryLabel={feelSet ? "貢獻這份體感數據" : "請先調整下方滑桿"}
          onPrimary={() => submitFeedback(metrics)}
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
  const [recordSaving, setRecordSaving] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [feelSet, setFeelSet] = useState(false);
  const [feedbackDesc, setFeedbackDesc] = useState("尚未標記");
  const [toastMsg, setToastMsg] = useState("");
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [currentTime, setCurrentTime] = useState("");

  const showToast = (msg: string) => setToastMsg(msg);

  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [locationInput, setLocationInput] = useState("");
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [notionPageId, setNotionPageId] = useState<string | null>(null);
  /** 當日＋氣溫區間的 active 列（收藏／記錄／回饋皆寫入此列） */
  const [activeUserRecord, setActiveUserRecord] = useState<ActiveUserRecord | null>(
    null
  );
  const [outfitInsights, setOutfitInsights] = useState<OutfitInsights | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [reminder, setReminder] = useState<ReminderSettings>(DEFAULT_REMINDER);
  const [hasPendingFeedback, setHasPendingFeedback] = useState(false);
  const sessionHydrated = useRef(false);

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

  const loadWeather = async (lat: number, lon: number, displayName?: string) => {
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
  };


  const loadOutfitInsights = useCallback(async (temp: number) => {
    try {
      setInsightsLoading(true);
      const data = await fetchOutfitInsights(temp, 1);
      setOutfitInsights(data);
    } catch (error) {
      console.warn("Outfit insights:", error);
      setOutfitInsights(null);
    } finally {
      setInsightsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (weather) {
      void loadOutfitInsights(weather.temp);
    }
  }, [weather?.temp, loadOutfitInsights]);

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

  const syncActiveUserRecord = useCallback(async () => {
    const trimmed = userName.trim();
    if (!trimmed || !weather) return null;

    try {
      const session = loadSession();
      const result = await ensureActiveUserRecordApi({
        userName: trimmed,
        temp: weather.temp,
        ...(typeof weather.tempMin === "number" ? { tempMin: weather.tempMin } : {}),
        ...(typeof weather.tempMax === "number" ? { tempMax: weather.tempMax } : {}),
        location: weather.locationName ?? userLocation?.name,
        gender: userGender,
        weather: weather.condition,
        humidity: weather.humidity,
        rainProb: weather.rainProb,
        apparentTemp: weather.apparentTemp,
        uvIndex: weather.uvIndex,
        activeUserRecord: session.activeUserRecord,
      });

      const prev = session.activeUserRecord;
      const active: ActiveUserRecord = {
        pageId: result.pageId,
        date: result.date,
        tempBand: result.tempBand,
      };
      saveSession({ activeUserRecord: active });
      setActiveUserRecord(active);

      if (!prev || prev.pageId !== active.pageId) {
        const pending = loadSession().pendingRecord;
        if (pending && pending.pageId !== active.pageId) {
          clearPendingRecord();
          setHasPendingFeedback(false);
        }
      }

      const currentPageId = notionPageId ?? loadSession().pendingRecord?.pageId;
      if (!currentPageId || currentPageId === prev?.pageId) {
        setNotionPageId(active.pageId);
      }

      return active;
    } catch (error) {
      console.warn("ensureActiveUserRecord:", error);
      return null;
    }
  }, [userName, weather, userGender, userLocation, notionPageId]);

  useEffect(() => {
    if (!sessionHydrated.current) return;
    const trimmed = userName.trim();
    if (!trimmed || !weather) return;
    void syncActiveUserRecord();
  }, [
    weather?.temp,
    weather?.condition,
    weather?.locationName,
    userName,
    userGender,
    syncActiveUserRecord,
  ]);

  useEffect(() => {
    const expired = expireStalePending();
    const session = loadSession();

    if (session.userName) setUserName(session.userName);
    if (session.gender) setUserGender(session.gender);
    if (session.userLocation) {
      setUserLocation(session.userLocation);
      setLocationInput(session.userLocation.name);
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
      setNotionPageId(session.pendingRecord!.pageId);
    }

    setHasPendingFeedback(isPendingValidToday(loadSession().pendingRecord));

    if (expired) {
      setTimeout(() => showToast("昨日的紀錄已過期，請重新拍照"), 0);
    }

    const canAutoStart = Boolean(
      session.userName.trim() && session.gender && session.userLocation
    );
    if (canAutoStart && session.userLocation) {
      void loadWeather(
        session.userLocation.lat,
        session.userLocation.lon,
        session.userLocation.name
      );
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
      if (
        isPendingValidToday(session.pendingRecord) &&
        session.reminder.enabled &&
        session.pendingRecord
      ) {
        void maybeShowPendingReminderNotification(
          session.pendingRecord.pageId,
          session.reminder
        );
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

  const feedbackOutfit = useMemo((): FeedbackOutfitContext => {
    const pending = loadSession().pendingRecord;
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
  }, [outfitImage, weather, currentTime]);

  const inspirationCards = outfitInsights?.inspiration ?? [];

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
    if (targetUserName && trimmedName === targetUserName) {
      showToast("無法收藏自己的穿搭");
      return;
    }
    if (favoriteBusyId === card.id) return;
    const saved = isInspirationFavorite(inspirationFavorites, card.id);
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
    if (!userName.trim() || !userGender || !userLocation) return;
    saveSession({
      userName: userName.trim(),
      gender: userGender,
      userLocation,
      reminder,
    });
    void loadWeather(userLocation.lat, userLocation.lon, userLocation.name);
    setScreen("home");
  };

  const performExitApp = () => {
    resetAppSession();
    if (userName.trim()) clearInspirationFavorites(userName);
    void cancelEveningReminder();

    setUserName("");
    setUserLocation(null);
    setLocationInput("");
    setWeather(null);
    setOutfitInsights(null);
    setInspirationFavorites({ items: {} });
    setOutfitImage(null);
    setNotionPageId(null);
    setActiveUserRecord(null);
    setHasPendingFeedback(false);
    setReminder(DEFAULT_REMINDER);
    setScreen("welcome");
    setShowExitConfirm(false);
    showToast("已返回初始頁面");
  };

  const onOutfitImageReady = (img: ParsedOutfitImage) => {
    setRecordSaving(false);
    setOutfitImage(img);
    const now = new Date();
    setCurrentTime(
      `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`
    );
    showToast("照片上傳成功");
  };

  const clearOutfitImage = () => {
    setRecordSaving(false);
    setOutfitImage(null);
  };

  const saveToWardrobe = async () => {
    if (!outfitImage || !weather || recordSaving) return;

    setRecordSaving(true);
    let upperBodyTags: string[] = [];
    let lowerBodyTags: string[] = [];

    try {
      try {
        const analysis = await analyzeOutfit(outfitImage.base64, outfitImage.mimeType);
        upperBodyTags = analysis.upperBodyTags;
        lowerBodyTags = analysis.lowerBodyTags;
        const upper = upperBodyTags.length ? upperBodyTags.join("、") : "—";
        const lower = lowerBodyTags.length ? lowerBodyTags.join("、") : "—";
        showToast(`AI 辨識：上著 ${upper}｜下著 ${lower}`);
      } catch (error) {
        console.warn("Gemini analyze:", error);
        const msg = error instanceof Error ? error.message : "";
        if (msg.includes("額度") || msg.includes("429") || msg.includes("quota")) {
          showToast("Gemini 額度不足，仍會儲存照片與天氣（無 AI 標籤）");
        } else {
          showToast(msg || "AI 辨識失敗，仍會儲存照片與天氣");
        }
      }

      let pageId =
        loadSession().activeUserRecord?.pageId ??
        activeUserRecord?.pageId ??
        notionPageId;

      if (!pageId) {
        const active = await syncActiveUserRecord();
        pageId = active?.pageId ?? null;
      }

      if (!pageId) {
        showToast("無法建立今日紀錄列，請稍後再試");
        return;
      }

      await updateRecord(pageId, {
        ...buildRecordFromWeather(
          userName,
          weather,
          toStartedAtIso(currentTime),
          userGender ?? loadSession().gender ?? undefined
        ),
        upperBodyTags: upperBodyTags.length ? upperBodyTags : undefined,
        lowerBodyTags: lowerBodyTags.length ? lowerBodyTags : undefined,
        photoBase64: outfitImage.base64,
        photoMimeType: outfitImage.mimeType,
      });
      setNotionPageId(pageId);
      setPendingRecord(pageId, {
        photoPreviewUrl: outfitImage.previewUrl,
        locationName: weather.locationName,
        temp: weather.temp,
        condition: weather.condition,
        recordedTime: currentTime || formatTimeFromIso(new Date().toISOString()),
      });
      setHasPendingFeedback(true);
      setOutfitImage(null);
      setShowActionSheet(false);
      setIsCameraOpen(false);
      void loadOutfitInsights(weather.temp);

      await scheduleEveningReminder(pageId, reminder);
      const link = buildRecordUrl(pageId);
      void navigator.clipboard.writeText(link).catch(() => {});
      showToast("已記錄，你可以前往回饋穿搭體感");
    } catch (error) {
      console.warn("Notion create record:", error);
      const msg = error instanceof Error ? error.message : "";
      if (msg.includes("expected to be")) {
        showToast(
          "Notion 欄位類型不符：請確認 Upper Body Tags 為 Multi-select、Lower Body Tags 為 Select"
        );
      } else {
        showToast(msg ? `Notion 同步失敗：${msg}` : "Notion 同步失敗");
      }
    } finally {
      setRecordSaving(false);
    }
  };

  const submitFeedback = async (metrics: {
    breathability: number;
    snugness: number;
    stuffiness: number;
  }) => {
    if (!feelSet) return;

    const pageId =
      notionPageId ??
      loadSession().pendingRecord?.pageId ??
      loadSession().activeUserRecord?.pageId ??
      activeUserRecord?.pageId ??
      null;

    if (!pageId) {
      showToast("找不到今日穿搭紀錄，請重新拍照或開啟晚間連結");
      return;
    }

    try {
      await updateRecord(pageId, {
        breathability: metrics.breathability,
        wrapping: metrics.snugness,
        stuffiness: metrics.stuffiness,
      });
      markPendingFeedbackComplete();
      clearPendingRecord();
      setHasPendingFeedback(false);
      setOutfitImage(null);
      void cancelEveningReminder();
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
      humidity: `${weather?.humidity || 78}%`
    };
    
    setOutfitList([newOutfit, ...outfitList]);
    showToast("體感數據已記錄，謝謝你的貢獻 🌏");
    setTimeout(() => setScreen("home"), 1000);
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
              className="app-screen-gradient app-screen-page"
            >
              {screen === "welcome" && (
              <WelcomeScreen
                userName={userName}
                setUserName={setUserName}
                userGender={userGender}
                setUserGender={setUserGender}
                locationInput={locationInput}
                setLocationInput={setLocationInput}
                userLocation={userLocation}
                setUserLocation={setUserLocation}
                startApp={startApp}
                showToast={showToast}
              />
              )}
              {screen === "home" && (
                <HomeScreen
                  userName={userName}
                  setScreen={setScreen}
                  weather={weather}
                  loading={weatherLoading}
                  insights={outfitInsights}
                  insightsLoading={insightsLoading}
                  showPendingBanner={hasPendingFeedback}
                  onContinuePending={continuePendingFeedback}
                  onRequestExit={() => setShowExitConfirm(true)}
                />
              )}
              {screen === "inspiration" && (
                <InspirationFeedScreen
                  cards={inspirationCards}
                  currentUserName={userName}
                  insightsLoading={insightsLoading}
                  favorites={inspirationFavorites}
                  favoriteBusyId={favoriteBusyId}
                  onToggleFavorite={handleToggleFavorite}
                  onGoRecord={() => setScreen("record")}
                  weather={weather}
                  insights={outfitInsights}
                  onRequestExit={() => setShowExitConfirm(true)}
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
                  onRequestExit={() => setShowExitConfirm(true)}
                />
              )}
              {screen === "record" && (
              <RecordScreen
                hasUploadedToday={hasPendingFeedback}
                uploadedPhotoUrl={feedbackOutfit.photoUrl}
                onGoToFeedback={continuePendingFeedback}
                outfitImage={outfitImage}
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
                onRequestExit={() => setShowExitConfirm(true)}
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
                onRequestExit={() => setShowExitConfirm(true)}
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
                  onClick={() => setScreen(tab.id as Screen)}
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
          {toastMsg && <Toast message={toastMsg} onClear={() => setToastMsg("")} />}
        </AnimatePresence>

        <ExitConfirmDialog
          open={showExitConfirm}
          onCancel={() => setShowExitConfirm(false)}
          onConfirm={performExitApp}
        />
      </div>
    </div>
  );
}

