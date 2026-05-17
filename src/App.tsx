/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { BottomActionBar } from "./components/BottomActionBar";
import { FeelMetricsChips } from "./components/FeelMetricsChips";
import { FEEL_TONES, FEEL_TRACK_EMPTY } from "./lib/feel-metrics";
import { OutfitPhotoDisplay } from "./components/OutfitPhotoDisplay";
import { OutfitStatsPanel } from "./components/OutfitStatsPanel";
import {
  FeedbackOutfitCard,
  type FeedbackOutfitContext,
} from "./components/FeedbackOutfitCard";
import { PendingFeedbackBanner } from "./components/PendingFeedbackBanner";
import { ReminderSettingsPanel } from "./components/ReminderSettings";
import { motion, AnimatePresence, useMotionValue, useTransform } from "motion/react";
import {
  analyzeOutfit,
  buildRecordFromWeather,
  createRecord,
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
  buildInspirationDeck,
  buildInspirationRangeKey,
  clearInspirationSwipe,
  loadInspirationSwipe,
  isInspirationCardSaved,
  recordInspirationSwipe,
  syncInspirationSwipeRange,
  type InspirationSwipeState,
} from "./lib/inspiration-swipe";
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
  type ReminderSettings,
} from "./lib/session-storage";
import type { GeoSearchResult, ParsedOutfitImage, UserLocation, WeatherData } from "./types/api";
import { 
  Home, 
  Sparkles, 
  Camera, 
  Smile, 
  Shirt, 
  MapPin, 
  ArrowRight, 
  ChevronRight, 
  X, 
  Heart,
  Droplets,
  Thermometer,
  CloudRain,
  Clock,
  Globe,
  Sun,
  Upload,
  Wind,
  User,
  LogOut,
} from "lucide-react";

// --- Types ---
type Screen = "welcome" | "home" | "inspiration" | "record" | "feedback";

type Outfit = InspirationItem;

// --- Mock Data ---
const INSPIRATION_CARDS: Outfit[] = [
  {
    id: "1",
    emoji: "🧥",
    bg: "#ebe6dc",
    match: "97%",
    temp: "26°C・多雲",
    who: "Mei",
    date: "昨天",
    location: "基隆",
    feelMetrics: { breathability: 45, wrapping: 55, stuffiness: 72 },
    tags: ["防曬外套", "T恤"],
    humidity: "78%"
  },
  {
    id: "2",
    emoji: "👗",
    bg: "#f0e8df",
    match: "94%",
    temp: "25°C・多雲",
    who: "小芸",
    date: "3天前",
    location: "台北",
    feelMetrics: { breathability: 68, wrapping: 50, stuffiness: 38 },
    tags: ["薄外套", "連身裙"],
    humidity: "75%"
  },
  {
    id: "3",
    emoji: "🧤",
    bg: "#e8e4dc",
    match: "88%",
    temp: "24°C・陰",
    who: "Jade",
    date: "2天前",
    location: "新北",
    feelMetrics: { breathability: 55, wrapping: 42, stuffiness: 28 },
    tags: ["薄長袖", "長褲"],
    humidity: "82%"
  }
];

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
  locationInput,
  setLocationInput,
  userLocation,
  setUserLocation,
  startApp,
  showToast,
}: {
  userName: string;
  setUserName: (v: string) => void;
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

  const canStart = userName.trim().length > 0 && userLocation !== null;

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

  return (
  <div className="flex min-h-min flex-col items-center justify-center px-8 py-10 pb-16">
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center"
    >
      <h1 className="text-5xl font-medium tracking-tight text-stone-800 leading-none">衣氣象</h1>
      <p className="mt-2 text-xs uppercase tracking-widest text-stone-500">Outfit Weather</p>
    </motion.div>

    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.2 }}
      className="glass-card-strong mt-10 w-full rounded-2xl p-5"
    >
      <label className="text-[10px] text-slate-400 uppercase tracking-wider mb-2 block font-semibold">你的名字</label>
      <input 
        className="text-2xl font-medium text-slate-800 w-full outline-none placeholder:text-slate-200"
        placeholder="輸入名字..."
        value={userName}
        onChange={(e) => setUserName(e.target.value)}
        autoFocus
      />
    </motion.div>

    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.3 }}
      className="glass-card-strong relative mb-4 mt-4 w-full rounded-2xl p-5"
      ref={locationWrapRef}
    >
      <label className="text-[10px] text-slate-400 uppercase tracking-wider mb-2 block font-semibold">你的地點</label>
      <input
        className="text-2xl font-medium text-slate-800 w-full outline-none placeholder:text-slate-200"
        placeholder="例如：台北"
        value={locationInput}
        onChange={(e) => handleLocationInputChange(e.target.value)}
        onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
      />

      <button
        type="button"
        onClick={handleUseCurrentLocation}
        disabled={locating}
        className="glass-pill mt-4 flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium text-stone-600 transition-colors hover:bg-white/80 disabled:opacity-60"
      >
        <MapPin size={13} />
        {locating ? "定位中..." : "使用我目前定位"}
      </button>

      <AnimatePresence>
        {showDropdown && (
          <motion.ul
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="app-scroll absolute left-0 right-0 top-full mt-1 z-20 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden max-h-48 overflow-y-auto"
          >
            {searching && (
              <li className="px-4 py-3 text-sm text-slate-400">搜尋中...</li>
            )}
            {!searching &&
              suggestions.map((item) => (
                <li key={item.place_id}>
                  <button
                    type="button"
                    onClick={() => handleSelectSuggestion(item)}
                    className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 border-b border-slate-50 last:border-0 flex items-start gap-2"
                  >
                    <MapPin size={14} className="text-[#378ADD] shrink-0 mt-0.5" />
                    <span className="line-clamp-2">{formatGeoLabel(item)}</span>
                  </button>
                </li>
              ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </motion.div>

    <button
      onClick={startApp}
      disabled={!canStart}
      className={`flex w-full items-center justify-center gap-2 rounded-xl py-4 text-base font-medium transition-all ${
        canStart
          ? "btn-gradient-primary text-white"
          : "cursor-not-allowed bg-white/40 text-slate-400"
      }`}
    >
      開始 <ArrowRight size={16} />
    </button>

    {!canStart && (
      <p className="text-center text-xs text-slate-400 mt-3">請先填寫名字和地點</p>
    )}
  </div>
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
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card-strong flex items-center justify-between gap-3 rounded-2xl px-4 py-3"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-light tabular-nums leading-none text-stone-800">
                {Math.round(weather?.temp || 0)}°
              </span>
              <span className="truncate text-sm font-medium text-stone-500">
                {weather?.condition || "—"}
              </span>
            </div>
            <p className="mt-1 truncate text-[10px] font-medium text-stone-400">
              <MapPin size={10} className="mr-0.5 inline -mt-px" />
              {weather?.locationName || "未知地點"}
            </p>
          </div>
          <div className="grid shrink-0 grid-cols-2 gap-x-3 gap-y-1.5 text-right">
            {[
              { label: "濕度", val: `${weather?.humidity || 0}%` },
              { label: "降雨", val: `${weather?.rainProb || 0}%` },
              { label: "體感", val: `${Math.round(weather?.apparentTemp || 0)}°` },
              { label: "UV", val: `${weather?.uvIndex || 0}` },
            ].map((item) => (
              <div key={item.label} className="leading-tight">
                <div className="text-[10px] font-medium text-stone-400">{item.label}</div>
                <div className="text-xs font-semibold tabular-nums text-stone-700">{item.val}</div>
              </div>
            ))}
          </div>
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

const InspirationEmptyState = ({
  variant,
  onRecord,
  onRequestExit,
}: {
  variant: "no-data" | "exhausted";
  onRecord: () => void;
  onRequestExit: () => void;
}) => (
  <div className="inspiration-layout app-screen-gradient">
    <div className="flex justify-end px-6 pt-3">
      <AppExitButton onClick={onRequestExit} />
    </div>
    <div className="inspiration-empty-body">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/70 text-stone-500 ring-1 ring-stone-200/70">
        {variant === "exhausted" ? (
          <Sparkles size={28} strokeWidth={1.5} className="text-[#8b7355]" />
        ) : (
          <Shirt size={28} strokeWidth={1.5} />
        )}
      </div>
      <h2 className="text-base font-semibold text-stone-800">
        {variant === "exhausted" ? "本區間靈感已瀏覽完畢" : "此溫度區間還沒有穿搭靈感"}
      </h2>
      <p className="mx-auto mt-2 max-w-[280px] text-sm leading-relaxed text-stone-500">
        {variant === "exhausted"
          ? "溫度變化後會推薦新穿搭。收藏過的穿搭會排在堆疊最後，再次略過則會移除。"
          : "成為第一筆相似天氣的穿搭記錄，幫助大家找到靈感。"}
      </p>
      {variant === "no-data" ? (
        <button
          type="button"
          onClick={onRecord}
          className="mt-6 px-6 py-3 bg-stone-800 text-white rounded-xl text-sm font-semibold transition-transform active:scale-[0.98]"
        >
          成為第一筆穿搭記錄
        </button>
      ) : null}
    </div>
  </div>
);

const InspirationScreen = ({
  cards,
  deckExhausted,
  currentCardIsSaved,
  handleNextInspiration,
  setScreen,
  weather,
  insights,
  onRequestExit,
}: {
  cards: Outfit[];
  deckExhausted?: boolean;
  currentCardIsSaved?: boolean;
  handleNextInspiration: (liked: boolean) => void;
  setScreen: (s: Screen) => void;
  weather: WeatherData | null;
  insights: OutfitInsights | null;
  onRequestExit: () => void;
}) => {
  if (cards.length === 0) {
    return (
      <InspirationEmptyState
        variant={deckExhausted ? "exhausted" : "no-data"}
        onRecord={() => setScreen("record")}
        onRequestExit={onRequestExit}
      />
    );
  }

  const currentCard = cards[0];
  const nextCard = cards[1] ?? cards[0];
  
  return (
    <div className="inspiration-layout app-screen-gradient">
      <header className="inspiration-header mb-1 mt-3 flex items-center justify-between gap-2 px-6">
          <span className="font-semibold text-stone-800">今日靈感</span>
          <div className="flex shrink-0 items-center gap-1.5">
            <span className="glass-pill rounded-full px-2.5 py-1 text-[11px] font-medium text-stone-600">
              {insights ? `${insights.tempMin}–${insights.tempMax}°C` : `${Math.round(weather?.temp || 26)}°`}{" "}
              相似天氣
            </span>
            <AppExitButton onClick={onRequestExit} />
          </div>
        </header>

      <div className="inspiration-main app-inset min-h-0">
        <div className="inspiration-cards">
            <div
              aria-hidden
              className="inspiration-card inspiration-card-stack inspiration-card-back overflow-hidden rounded-3xl"
            >
              <div className="inspiration-card-photo-cell">
              <OutfitPhotoDisplay
                photoUrl={nextCard.photoUrl}
                emoji={nextCard.emoji}
                bg={nextCard.bg}
                objectFit="cover"
                className="inspiration-card-photo-flex"
              />
              </div>
              <div className="inspiration-card-content shrink-0 p-3">
                <div className="text-base font-bold text-stone-800">{nextCard.temp}</div>
                <div className="text-xs text-stone-500">{nextCard.who}・{nextCard.location}</div>
              </div>
            </div>
            <div className="inspiration-card-stage">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={currentCard.id}
                initial={{ scale: 0.96, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ x: 300, rotate: 12, opacity: 0 }}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                onDragEnd={(_, info) => {
                  if (info.offset.x > 100) handleNextInspiration(true);
                  else if (info.offset.x < -100) handleNextInspiration(false);
                }}
                className="inspiration-card inspiration-card-stack h-full w-full cursor-grab overflow-hidden rounded-3xl active:cursor-grabbing"
                style={{ height: "100%" }}
              >
                <div className="inspiration-card-photo-cell">
                  <OutfitPhotoDisplay
                    photoUrl={currentCard.photoUrl}
                    emoji={currentCard.emoji}
                    bg={currentCard.bg}
                    objectFit="cover"
                    className="inspiration-card-photo-flex"
                  />
                  <div className="pointer-events-none absolute top-3 right-3 z-10 rounded-full bg-stone-800/90 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur-sm">
                    {currentCard.match} 匹配
                  </div>
                </div>
                <div className="inspiration-card-content p-4">
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.22 }}>
                    <div className="text-xl font-bold text-stone-900">{currentCard.temp}</div>
                    <div className="mt-0.5 text-xs text-stone-500">
                      {currentCard.who}・{currentCard.location}・{currentCard.date}
                    </div>
                    {currentCard.tags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {currentCard.tags.map((tag, i) => (
                          <span
                            key={i}
                            className="rounded-full border border-stone-200/80 bg-white/80 px-2.5 py-1 text-[10px] font-medium text-stone-600"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    <FeelMetricsChips metrics={currentCard.feelMetrics} compact />
                  </motion.div>
                </div>
              </motion.div>
            </AnimatePresence>
            </div>
        </div>
      </div>

      <div className="inspiration-action-dock">
        <div className="app-inset">
          <BottomActionBar
            primaryLabel="我穿好了，來記錄"
            onPrimary={() => setScreen("record")}
            left={{
              icon: <X size={24} />,
              onClick: () => handleNextInspiration(false),
              ariaLabel: "略過",
              className: "border-stone-200 text-stone-400",
            }}
            right={{
              icon: (
                <Heart
                  size={24}
                  fill={currentCardIsSaved ? "#e11d48" : "none"}
                  stroke={currentCardIsSaved ? "#e11d48" : "currentColor"}
                  strokeWidth={2}
                />
              ),
              onClick: () => handleNextInspiration(true),
              ariaLabel: currentCardIsSaved ? "已收藏" : "喜歡",
              className: currentCardIsSaved
                ? "border-rose-300 bg-rose-50 text-rose-500 hover:bg-rose-100"
                : "border-stone-400 text-[#8b7355] hover:bg-stone-50",
            }}
          />
        </div>
      </div>
    </div>
  );
};

const RecordScreen = ({
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

  const startCamera = async () => {
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

  const hasPhoto = outfitImage !== null;

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

      <div className="glass-card-strong mb-3 flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-light tabular-nums leading-none text-stone-800">
              {Math.round(weather?.temp || 0)}°
            </span>
            <span className="truncate text-sm font-medium text-stone-500">
              {weather?.condition || "—"}
            </span>
          </div>
          <p className="mt-1 truncate text-[10px] font-medium text-stone-400">
            <MapPin size={10} className="mr-0.5 inline -mt-px" />
            {weather?.locationName || "未知地點"}
          </p>
        </div>
        <div className="grid shrink-0 grid-cols-2 gap-x-3 gap-y-1.5 text-right">
          {[
            { label: "濕度", val: `${weather?.humidity || 0}%` },
            { label: "降雨", val: `${weather?.rainProb || 0}%` },
            { label: "體感", val: `${Math.round(weather?.apparentTemp || 0)}°` },
            { label: "時間", val: currentTime || "--:--" },
          ].map((item) => (
            <div key={item.label} className="leading-tight">
              <div className="text-[10px] font-medium text-stone-400">{item.label}</div>
              <div className="text-xs font-semibold tabular-nums text-stone-700">{item.val}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="relative mb-3 w-full">
        <motion.div 
          whileTap={{ scale: 0.98 }}
          onClick={() => !hasPhoto && !recordSaving && setShowActionSheet(true)}
          className={`h-56 rounded-3xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all overflow-hidden ${hasPhoto ? "bg-[#E1F5EE] border-[#1D9E75]" : isCameraOpen ? "bg-black border-none" : "bg-slate-50 border-slate-200 hover:border-[#378ADD]"}`}
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
          ) : hasPhoto && outfitImage ? (
            <div className="relative w-full h-full bg-slate-100">
              <img
                src={outfitImage.previewUrl}
                alt="今日穿搭"
                className="w-full h-full object-contain object-center rounded-3xl"
              />
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/50 to-transparent p-3 text-center">
                <div className="text-xs font-bold text-white">照片已選取 · 氣象已綁定</div>
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
          {showActionSheet && (
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

      {hasPhoto && (
        <ReminderSettingsPanel
          reminder={reminder}
          onChange={onReminderChange}
          showToast={showToast}
          className="mb-4 mt-0 w-full"
        />
      )}

      <div className="pt-6 pb-2">
        <BottomActionBar
          solo
          primaryLabel={recordSaving ? "AI 分析並寫入中…" : "完成記錄"}
          onPrimary={saveToWardrobe}
          disabled={!hasPhoto}
          loading={recordSaving}
        />
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
    const bText = newMetrics.breathability > 70 ? "極佳" : newMetrics.breathability > 40 ? "舒適" : "不通風";
    const sText = newMetrics.snugness > 70 ? "緊緻" : newMetrics.snugness > 40 ? "合身" : "寬鬆";
    const stText = newMetrics.stuffiness > 70 ? "極悶熱" : newMetrics.stuffiness > 40 ? "微悶" : "乾爽";
    
    setFeedbackDesc(`透氣${bText}(${newMetrics.breathability}%)・${sText}感(${newMetrics.snugness}%)・${stText}(${newMetrics.stuffiness}%)`);
  };

  const SliderField = ({ label, value, color, onChange, icon }: { label: string, value: number, color: string, onChange: (v: number) => void, icon: React.ReactNode }) => (
    <div className="mb-6 last:mb-0 group">
      <div className="flex justify-between items-center mb-2">
        <label className="flex items-center gap-2 text-sm font-bold text-stone-700 transition-colors group-hover:text-stone-900">
          <div
            className="rounded-lg p-1.5 text-stone-400 transition-colors"
            style={{
              color: value > 10 ? color : undefined,
              backgroundColor: value > 10 ? `${color}18` : "rgba(255,255,255,0.6)",
            }}
          >
            {icon}
          </div>
          {label}
        </label>
        <motion.span
          key={value}
          initial={{ scale: 1.1, opacity: 0.8 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-xs font-black font-mono tabular-nums"
          style={{ color: value > 10 ? color : "#a8a29e" }}
        >
          {value}%
        </motion.span>
      </div>
      <div className="relative h-8 flex items-center">
        <input 
          type="range" 
          min="0" 
          max="100" 
          value={value} 
          onChange={(e) => onChange(parseInt(e.target.value))}
          className="h-2.5 w-full cursor-pointer appearance-none rounded-lg"
          style={{
            background: `linear-gradient(to right, ${color} ${value}%, ${FEEL_TRACK_EMPTY} ${value}%)`,
            color,
          }}
        />
      </div>
    </div>
  );

  if (!needsFeedback) {
    return (
      <div className="screen-scroll app-scroll app-screen-gradient">
        <div className="app-inset flex justify-end px-4 pt-4">
          <AppExitButton onClick={onRequestExit} />
        </div>
        <div className="app-inset px-6 pb-[var(--nav-safe-bottom)] pt-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/70 text-stone-500 ring-1 ring-stone-200/70">
            <Smile size={28} strokeWidth={1.5} />
          </div>
          <h2 className="text-base font-semibold text-stone-800">今日沒有需要回饋的穿搭了</h2>
          <p className="mx-auto mt-2 max-w-[260px] text-sm leading-relaxed text-stone-500">
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

      <div className="glass-card-strong mb-5 w-full rounded-2xl p-6">
        <SliderField
          label="透氣度"
          value={metrics.breathability}
          color={FEEL_TONES.breathability}
          icon={<Wind size={14} />}
          onChange={(v) => updateMetric("breathability", v)}
        />
        <SliderField
          label="包裹感"
          value={metrics.snugness}
          color={FEEL_TONES.wrapping}
          icon={<User size={14} />}
          onChange={(v) => updateMetric("snugness", v)}
        />
        <SliderField
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
          生成的感受標籤
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
  const [outfitList, setOutfitList] = useState<Outfit[]>(INITIAL_WARDROBE);
  const [inspirationSwipe, setInspirationSwipe] = useState<InspirationSwipeState | null>(() =>
    loadInspirationSwipe()
  );
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

  useEffect(() => {
    const expired = expireStalePending();
    const session = loadSession();

    if (session.userName) setUserName(session.userName);
    if (session.userLocation) {
      setUserLocation(session.userLocation);
      setLocationInput(session.userLocation.name);
    }
    setReminder(session.reminder);

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

    const canAutoStart = Boolean(session.userName.trim() && session.userLocation);
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

  const inspirationCards =
    outfitInsights && outfitInsights.inspiration.length > 0
      ? outfitInsights.inspiration
      : INSPIRATION_CARDS;

  const inspirationRangeKey = useMemo(
    () => buildInspirationRangeKey(outfitInsights, weather?.temp),
    [outfitInsights, weather?.temp]
  );

  useEffect(() => {
    if (!inspirationRangeKey) return;
    setInspirationSwipe(syncInspirationSwipeRange(inspirationRangeKey));
  }, [inspirationRangeKey]);

  const visibleInspirationCards = useMemo(
    () => buildInspirationDeck(inspirationCards, inspirationSwipe, inspirationRangeKey),
    [inspirationCards, inspirationSwipe, inspirationRangeKey]
  );

  const startApp = () => {
    if (!userName.trim() || !userLocation) return;
    saveSession({ userName: userName.trim(), userLocation, reminder });
    void loadWeather(userLocation.lat, userLocation.lon, userLocation.name);
    setScreen("home");
  };

  const handleNextInspiration = (liked: boolean) => {
    const current = visibleInspirationCards[0];
    if (!current || !inspirationRangeKey) return;
    const wasSaved = isInspirationCardSaved(inspirationSwipe, current.id);
    const next = recordInspirationSwipe(current.id, liked, inspirationRangeKey);
    setInspirationSwipe(next);
    if (liked) {
      showToast(wasSaved ? "已在收藏中，已移至堆疊最後 ♡" : "已收藏，移至堆疊最後 ♡");
    } else if (wasSaved) {
      showToast("已從收藏移除並略過");
    } else {
      showToast("已略過這套穿搭");
    }
  };

  const performExitApp = () => {
    resetAppSession();
    clearInspirationSwipe();
    void cancelEveningReminder();

    setUserName("");
    setUserLocation(null);
    setLocationInput("");
    setWeather(null);
    setOutfitInsights(null);
    setInspirationSwipe(null);
    setOutfitImage(null);
    setNotionPageId(null);
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

      const { id } = await createRecord({
        ...buildRecordFromWeather(userName, weather, toStartedAtIso(currentTime)),
        upperBodyTags: upperBodyTags.length ? upperBodyTags : undefined,
        lowerBodyTags: lowerBodyTags.length ? lowerBodyTags : undefined,
        photoBase64: outfitImage.base64,
        photoMimeType: outfitImage.mimeType,
      });
      setNotionPageId(id);
      setPendingRecord(id, {
        photoPreviewUrl: outfitImage.previewUrl,
        locationName: weather.locationName,
        temp: weather.temp,
        condition: weather.condition,
        recordedTime: currentTime || formatTimeFromIso(new Date().toISOString()),
      });
      setHasPendingFeedback(true);
      void loadOutfitInsights(weather.temp);

      const scheduled = await scheduleEveningReminder(id, reminder);
      const link = buildRecordUrl(id);
      try {
        await navigator.clipboard.writeText(link);
        showToast(
          scheduled
            ? "已記錄！晚間會提醒；連結已複製，可晚上開啟填體感"
            : "已記錄！連結已複製，可晚上開啟填寫體感"
        );
      } catch {
        showToast(
          scheduled
            ? "穿搭已記錄！晚間會提醒你填寫體感 →"
            : "穿搭已記錄！接下來填寫今日體感 →"
        );
      }
      setTimeout(() => setScreen("feedback"), 1000);
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
      notionPageId ?? loadSession().pendingRecord?.pageId ?? null;

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
            {screen === "home" ? (
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
            ) : screen === "inspiration" ? (
              <InspirationScreen
                cards={visibleInspirationCards}
                deckExhausted={
                  inspirationCards.length > 0 && visibleInspirationCards.length === 0
                }
                currentCardIsSaved={
                  visibleInspirationCards[0]
                    ? isInspirationCardSaved(inspirationSwipe, visibleInspirationCards[0].id)
                    : false
                }
                handleNextInspiration={handleNextInspiration}
                setScreen={setScreen}
                weather={weather}
                insights={outfitInsights}
                onRequestExit={() => setShowExitConfirm(true)}
              />
            ) : (
        <AnimatePresence mode="wait" initial={false}>
          <motion.div 
            key={screen}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
            className="app-screen-gradient app-screen-page"
            style={{ position: "relative" }}
          >
            {screen === "welcome" && (
              <WelcomeScreen
                userName={userName}
                setUserName={setUserName}
                locationInput={locationInput}
                setLocationInput={setLocationInput}
                userLocation={userLocation}
                setUserLocation={setUserLocation}
                startApp={startApp}
                showToast={showToast}
              />
            )}
            {screen === "record" && (
              <RecordScreen
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
            )}
        </div>
        </div>

        {/* Global Nav Bar */}
        {screen !== "welcome" && (
          <div className="app-nav-dock">
            <nav className="glass-nav app-inset flex rounded-2xl px-2 py-3">
              {[
                { id: "home", icon: <Home size={20} />, label: "首頁" },
                { id: "inspiration", icon: <Sparkles size={20} />, label: "靈感" },
                { id: "record", icon: <Camera size={20} />, label: "記錄" },
                { id: "feedback", icon: <Smile size={20} />, label: "回饋" }
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

