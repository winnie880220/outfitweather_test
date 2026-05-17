/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform } from "motion/react";
import {
  createFeedback,
  createOutfit,
  fetchCurrentWeather,
  formatGeoLabel,
  reverseGeocode,
  searchLocations,
} from "./lib/api";
import type { GeoSearchResult, UserLocation, WeatherData } from "./types/api";
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
  User
} from "lucide-react";

// --- Types ---
type Screen = "welcome" | "home" | "inspiration" | "record" | "feedback";

interface Outfit {
  id: string;
  emoji: string;
  bg: string;
  match: string;
  temp: string;
  who: string;
  date: string;
  feel: string;
  feelColor: string;
  tags: string[];
  humidity: string;
  location: string;
}

// --- Mock Data ---
const INSPIRATION_CARDS: Outfit[] = [
  {
    id: "1",
    emoji: "🧥",
    bg: "#e8f4ff",
    match: "97%",
    temp: "26°C・多雲",
    who: "Mei",
    date: "昨天",
    location: "基隆",
    feel: "略感悶熱",
    feelColor: "#378ADD",
    tags: ["防曬外套", "T恤"],
    humidity: "78%"
  },
  {
    id: "2",
    emoji: "👗",
    bg: "#fef3e2",
    match: "94%",
    temp: "25°C・多雲",
    who: "小芸",
    date: "3天前",
    location: "台北",
    feel: "體感剛好",
    feelColor: "#1D9E75",
    tags: ["薄外套", "連身裙"],
    humidity: "75%"
  },
  {
    id: "3",
    emoji: "🧤",
    bg: "#f0e8ff",
    match: "88%",
    temp: "24°C・陰",
    who: "Jade",
    date: "2天前",
    location: "新北",
    feel: "稍感涼意",
    feelColor: "#534AB7",
    tags: ["薄長袖", "長褲"],
    humidity: "82%"
  }
];

const INITIAL_WARDROBE: Outfit[] = [
  {
    id: "w1",
    emoji: "👗",
    bg: "#fef3e2",
    match: "-",
    temp: "22°C",
    who: "我",
    date: "昨天",
    location: "台北",
    feel: "剛剛好",
    feelColor: "#1D9E75",
    tags: [],
    humidity: "65%"
  },
  {
    id: "w2",
    emoji: "🧣",
    bg: "#f0e8ff",
    match: "-",
    temp: "18°C",
    who: "我",
    date: "3天前",
    location: "新北",
    feel: "有點冷",
    feelColor: "#378ADD",
    tags: [],
    humidity: "55%"
  },
  {
    id: "w3",
    emoji: "👕",
    bg: "#e8f5ee",
    match: "-",
    temp: "29°C",
    who: "我",
    date: "上週",
    location: "台北",
    feel: "非常悶",
    feelColor: "#D85A30",
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
      className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-[#0C447C] text-white px-5 py-2.5 rounded-full text-sm font-medium whitespace-nowrap shadow-lg"
    >
      {message}
    </motion.div>
  );
};

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
      } catch {
        setSuggestions([]);
        setShowDropdown(false);
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
        } catch {
          showToast("無法解析目前位置，請手動輸入地點");
        } finally {
          setLocating(false);
        }
      },
      () => {
        showToast("無法取得定位，請允許權限或手動輸入");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  };

  return (
  <motion.div className="flex-1 flex flex-col justify-center items-center px-8 bg-slate-50">
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center"
    >
      <h1 className="text-5xl font-medium tracking-tight text-slate-900 leading-none">衣氣象</h1>
      <p className="text-xs tracking-widest text-slate-400 mt-2 uppercase">Outfit Weather</p>
    </motion.div>

    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.2 }}
      className="w-full bg-white border border-slate-200 rounded-2xl p-5 mt-10 shadow-sm"
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
      className="w-full bg-white border border-slate-200 rounded-2xl p-5 mt-4 mb-4 shadow-sm relative"
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
        className="mt-4 flex items-center gap-1.5 text-xs font-medium text-[#378ADD] bg-[#E6F1FB] px-3 py-2 rounded-full hover:bg-[#d4e8f9] transition-colors disabled:opacity-60"
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
            className="absolute left-0 right-0 top-full mt-1 z-20 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden max-h-48 overflow-y-auto"
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
      className={`w-full py-4 rounded-xl text-base font-medium flex items-center justify-center gap-2 transition-colors shadow-md ${
        canStart
          ? "bg-[#0C447C] text-white hover:bg-[#0a3a69]"
          : "bg-slate-200 text-slate-400 cursor-not-allowed"
      }`}
    >
      開始 <ArrowRight size={16} />
    </button>

    {!canStart && (
      <p className="text-center text-xs text-slate-400 mt-3">請先填寫名字和地點</p>
    )}
  </motion.div>
  );
};

const HomeScreen = ({ userName, setScreen, weather, loading }: { userName: string, setScreen: (s: Screen) => void, weather: WeatherData | null, loading: boolean }) => (
  <div className="flex-1 flex flex-col pt-4 overflow-y-auto pb-32">
    <header className="px-6 flex justify-between items-center mb-4">
      <span className="text-sm font-medium text-slate-800">嗨，{userName}！</span>
      <span className="text-[11px] text-slate-400 flex items-center gap-1">
        <MapPin size={12} className="text-[#378ADD]" /> {loading ? "定位中..." : weather?.locationName || "定位失敗"}
      </span>
    </header>
    
    <div className="flex justify-center gap-1.5 px-6 mb-6">
      {[true, true, false, false, false].map((done, i) => (
        <div 
          key={i} 
          className={`h-1.5 rounded-full ${i === 1 ? "w-6 bg-[#378ADD]" : "w-1.5 bg-slate-200"} ${done && i < 1 ? "bg-[#1D9E75]" : ""}`} 
        />
      ))}
    </div>

    {loading ? (
      <div className="mx-4 bg-slate-50 border border-slate-100 rounded-3xl p-12 mb-6 flex flex-col items-center justify-center animate-pulse">
        <div className="w-12 h-12 bg-slate-200 rounded-full mb-4" />
        <div className="h-4 w-24 bg-slate-200 rounded" />
      </div>
    ) : (
      <div className="mx-4 bg-[#E6F1FB] border border-[#B5D4F4] rounded-3xl p-6 mb-6 shadow-sm">
        <div className="flex items-center gap-1.5 text-xs text-[#185FA5] font-medium mb-2">
          <MapPin size={13} /> {weather?.locationName || "未知地點"}
        </div>
        <div className="text-6xl font-medium text-[#0C447C] mb-1">{Math.round(weather?.temp || 0)}°</div>
        <div className="text-sm text-[#185FA5] mb-4">{weather?.condition}</div>
        
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "濕度", val: `${weather?.humidity || 0}%` },
            { label: "降雨機率", val: `${weather?.rainProb || 0}%` },
            { label: "體感溫度", val: `${Math.round(weather?.apparentTemp || 0)}°` },
            { label: "UV 指數", val: `${weather?.uvIndex || 0}` }
          ].map((item, i) => (
            <div key={i} className="bg-white/60 rounded-xl p-2.5">
              <div className="text-[10px] text-[#185FA5] font-semibold uppercase">{item.label}</div>
              <div className="text-base font-bold text-[#0C447C]">{item.val}</div>
            </div>
          ))}
        </div>
      </div>
    )}

    <div className="px-4 mb-6">
      <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
        <h4 className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-3 text-center">當前氣候穿搭率最高 (TOP 3)</h4>
        <div className="grid grid-cols-2 gap-3">
          {/* Left: Upper */}
          <div className="space-y-1.5">
            <div className="text-[9px] text-slate-300 font-bold uppercase tracking-widest text-center mb-1">上著</div>
            {[
              { emoji: "🧥", name: "薄外套", rate: "72%" },
              { emoji: "👕", name: "長袖 Tee", rate: "48%" },
              { emoji: "👔", name: "襯衫", rate: "35%" }
            ].map((item, i) => (
              <div key={i} className="bg-slate-50 rounded-xl p-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="text-lg">{item.emoji}</div>
                  <div className="text-[10px] font-bold text-slate-700 truncate max-w-[45px]">{item.name}</div>
                </div>
                <div className="text-[9px] font-black text-[#1D9E75]">{item.rate}</div>
              </div>
            ))}
          </div>
          {/* Right: Lower */}
          <div className="space-y-1.5">
            <div className="text-[9px] text-slate-300 font-bold uppercase tracking-widest text-center mb-1">下著</div>
            {[
              { emoji: "👖", name: "九分褲", rate: "65%" },
              { emoji: "👖", name: "牛仔褲", rate: "52%" },
              { emoji: "👗", name: "長裙", rate: "28%" }
            ].map((item, i) => (
              <div key={i} className="bg-slate-50 rounded-xl p-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="text-lg">{item.emoji}</div>
                  <div className="text-[10px] font-bold text-slate-700 truncate max-w-[45px]">{item.name}</div>
                </div>
                <div className="text-[9px] font-black text-[#1D9E75]">{item.rate}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>

    <div className="px-6 mb-2">
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">今天跟你天氣相似的人怎麼穿？</h3>
    </div>

    <div className="flex-1 flex flex-col justify-end p-6">
      <button 
        onClick={() => setScreen("inspiration")}
        className="w-full py-4 bg-[#0C447C] text-white rounded-xl text-base font-medium flex items-center justify-center gap-2 shadow-md"
      >
        看大家的穿搭 <ChevronRight size={18} />
      </button>
    </div>
  </div>
);

const InspirationScreen = ({ inspirationIdx, handleNextInspiration, setScreen, weather }: { inspirationIdx: number, handleNextInspiration: (l: boolean) => void, setScreen: (s: Screen) => void, weather: WeatherData | null }) => {
  const currentCard = INSPIRATION_CARDS[inspirationIdx];
  const nextCard = INSPIRATION_CARDS[(inspirationIdx + 1) % INSPIRATION_CARDS.length];
  
  return (
    <div className="flex-1 flex flex-col overflow-hidden pb-32">
      <header className="px-6 mt-4 flex justify-between items-center mb-4">
        <span className="font-semibold text-slate-800">今日靈感</span>
        <span className="text-[11px] text-[#378ADD] bg-[#E6F1FB] px-2.5 py-1 rounded-full font-medium">{Math.round(weather?.temp || 26)}° 相似天氣</span>
      </header>

      <div className="flex justify-center gap-1.5 px-6 mb-4">
        {[true, true, true, false, false].map((done, i) => (
          <div 
            key={i} 
            className={`h-1.5 rounded-full ${i === 2 ? "w-6 bg-[#378ADD]" : "w-1.5 bg-slate-200"} ${done && i < 2 ? "bg-[#1D9E75]" : ""}`} 
          />
        ))}
      </div>

      <div className="flex-1 relative flex items-center justify-center p-4 bg-slate-50 overflow-hidden">
        {/* Back Card */}
        <div 
          className="absolute w-[280px] bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden transform scale-95 translate-y-4 opacity-60 z-0"
        >
           <div className="h-60 flex items-center justify-center text-8xl" style={{ backgroundColor: nextCard.bg }}>
            {nextCard.emoji}
          </div>
          <div className="p-4">
            <div className="text-lg font-bold text-slate-900">{nextCard.temp}</div>
            <div className="text-xs text-slate-400">{nextCard.who}・{nextCard.location}</div>
          </div>
        </div>

        {/* Front Card */}
        <AnimatePresence mode="popLayout">
          <motion.div 
            key={currentCard.id}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ x: 300, rotate: 20, opacity: 0 }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            onDragEnd={(_, info) => {
              if (info.offset.x > 100) handleNextInspiration(true);
              else if (info.offset.x < -100) handleNextInspiration(false);
            }}
            className="relative w-[300px] bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden z-10 cursor-grab active:cursor-grabbing"
          >
            <div className="h-72 flex items-center justify-center text-8xl relative" style={{ backgroundColor: currentCard.bg }}>
              {currentCard.emoji}
              <div className="absolute top-3 right-3 bg-[#0C447C] text-white text-[10px] font-bold px-2.5 py-1 rounded-full drop-shadow-sm">
                {currentCard.match} 匹配
              </div>
              <div 
                className="absolute bottom-3 left-3 text-[10px] text-white font-bold px-2.5 py-1 rounded-full shadow-sm"
                style={{ backgroundColor: `${currentCard.feelColor}BF` }}
              >
                {currentCard.feel}
              </div>
            </div>
            <div className="p-5">
              <div className="text-xl font-bold text-slate-900">{currentCard.temp}</div>
              <div className="text-xs text-slate-400 mt-0.5">{currentCard.who}・{currentCard.location}・{currentCard.date}</div>
              <div className="flex gap-1.5 mt-3">
                {currentCard.tags.map((tag, i) => (
                  <span key={i} className="text-[10px] px-2.5 py-1 rounded-full bg-slate-50 border border-slate-100 text-slate-500 font-medium">{tag}</span>
                ))}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="px-6 py-5 flex items-center justify-between gap-4 bg-white border-t border-slate-100">
        <button 
          onClick={() => handleNextInspiration(false)}
          className="w-14 h-14 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-slate-50 active:scale-95 transition-all"
        >
          <X size={24} />
        </button>
        <button 
          onClick={() => setScreen("record")}
          className="flex-1 h-12 bg-[#0C447C] text-white rounded-full text-sm font-semibold shadow-md active:scale-95 transition-all"
        >
          我穿好了，來記錄
        </button>
        <button 
          onClick={() => handleNextInspiration(true)}
          className="w-14 h-14 rounded-full border border-[#1D9E75] flex items-center justify-center text-[#1D9E75] hover:bg-emerald-50 active:scale-95 transition-all"
        >
          <Heart size={24} fill="#1D9E75" />
        </button>
      </div>
    </div>
  );
};

const RecordScreen = ({ 
  photoUploaded, 
  handleUpload, 
  currentTime, 
  saveToWardrobe, 
  weather,
  isCameraOpen,
  setIsCameraOpen,
  showActionSheet,
  setShowActionSheet,
  setPhotoUploaded
}: { 
  photoUploaded: boolean, 
  handleUpload: () => void, 
  currentTime: string, 
  saveToWardrobe: () => void, 
  weather: WeatherData | null,
  isCameraOpen: boolean,
  setIsCameraOpen: (v: boolean) => void,
  showActionSheet: boolean,
  setShowActionSheet: (v: boolean) => void,
  setPhotoUploaded: (v: boolean) => void
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

  const capturePhoto = () => {
    if (videoRef.current) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      setIsCameraOpen(false);
      handleUpload();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleUpload();
      setShowActionSheet(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col pt-4 overflow-y-auto pb-32 relative">
      <header className="px-6 mb-4 flex justify-between items-center">
        <h2 className="font-semibold text-slate-800">記錄今日穿搭</h2>
        {isCameraOpen && (
          <button onClick={() => {
            const stream = videoRef.current?.srcObject as MediaStream;
            stream?.getTracks().forEach(track => track.stop());
            setIsCameraOpen(false);
          }} className="text-xs text-slate-400 font-medium italic underline">取消</button>
        )}
      </header>

      <div className="flex justify-center gap-1.5 px-6 mb-4">
        {[true, true, true, true, false].map((done, i) => (
          <div 
            key={i} 
            className={`h-1.5 rounded-full ${i === 3 ? "w-6 bg-[#378ADD]" : "w-1.5 bg-slate-200"} ${done && i < 3 ? "bg-[#1D9E75]" : ""}`} 
          />
        ))}
      </div>

      <div className="relative mx-4">
        <motion.div 
          whileTap={{ scale: 0.98 }}
          onClick={() => !photoUploaded && setShowActionSheet(true)}
          className={`h-56 rounded-3xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all ${photoUploaded ? "bg-[#E1F5EE] border-[#1D9E75]" : isCameraOpen ? "bg-black border-none overflow-hidden" : "bg-slate-50 border-slate-200 hover:border-[#378ADD]"}`}
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
          ) : photoUploaded ? (
            <div className="text-center">
              <div className="text-6xl mb-2">🧥</div>
              <div className="text-sm font-bold text-[#0F6E56]">照片已選取</div>
              <div className="text-[11px] text-[#1D9E75] mt-1">氣象數據自動綁定 ✓</div>
              <button onClick={(e) => { e.stopPropagation(); setPhotoUploaded(false); }} className="mt-2 text-[10px] text-slate-400 underline">重新拍攝</button>
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
                  className="w-full py-4 bg-[#0C447C] text-white rounded-2xl flex items-center justify-center gap-2 font-bold shadow-lg"
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

      <div className="m-4 bg-[#E6F1FB] border border-[#B5D4F4] rounded-2xl p-5">
        <h4 className="text-[10px] text-[#185FA5] font-bold uppercase tracking-widest mb-3">自動綁定的氣象數據</h4>
        <div className="space-y-2.5">
          {[
            { icon: <MapPin size={13} />, label: "位置", val: weather?.locationName || "未知地點" },
            { icon: <Thermometer size={13} />, label: "氣溫", val: `${Math.round(weather?.temp || 0)}°C` },
            { icon: <Droplets size={13} />, label: "濕度", val: `${weather?.humidity || 0}%` },
            { icon: <CloudRain size={13} />, label: "降雨機率", val: `${weather?.rainProb || 0}%` },
            { icon: <Clock size={13} />, label: "記錄時間", val: currentTime || "--:--" }
          ].map((row, i) => (
            <div key={i} className="flex justify-between items-center text-xs">
              <span className="text-[#185FA5] flex items-center gap-1.5">{row.icon} {row.label}</span>
              <span className="text-[#0C447C] font-bold">{row.val}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 mt-auto">
        <button 
          disabled={!photoUploaded}
          onClick={saveToWardrobe}
          className={`w-full py-4 rounded-xl text-base font-semibold shadow-md transition-all ${photoUploaded ? "bg-[#0C447C] text-white" : "bg-slate-200 text-slate-400 cursor-not-allowed opacity-50"}`}
        >
          完成記錄
        </button>
      </div>
    </div>
  );
};


const FeedbackScreen = ({ userName, feedbackDesc, setFeedbackDesc, feelSet, setFeelSet, submitFeedback }: { userName: string, feedbackDesc: string, setFeedbackDesc: (v: string) => void, feelSet: boolean, setFeelSet: (v: boolean) => void, submitFeedback: (metrics: { breathability: number; snugness: number; stuffiness: number }) => void }) => {
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
        <label className="text-sm font-bold text-slate-700 flex items-center gap-2 group-hover:text-slate-900 transition-colors">
          <div 
            className="p-1.5 rounded-lg bg-slate-50 text-slate-400 group-hover:bg-slate-100 group-hover:text-slate-600 transition-colors"
            style={{ color: value > 10 ? color : undefined }}
          >
            {icon}
          </div>
          {label}
        </label>
        <motion.span 
          key={value}
          initial={{ scale: 1.1, opacity: 0.8 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-xs font-black font-mono text-slate-400"
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
          className="w-full h-2.5 bg-slate-100 rounded-lg appearance-none cursor-pointer"
          style={{ 
            background: `linear-gradient(to right, ${color} ${value}%, #f1f5f9 ${value}%)`,
            color: color // For the custom thumb's currentColor
          }}
        />
      </div>
    </div>
  );

  return (
    <div className="flex-1 flex flex-col pt-4 overflow-y-auto pb-32">
      <header className="px-6 flex justify-between items-baseline mb-4">
        <h2 className="font-semibold text-slate-800">今日體感回饋</h2>
        <span className="text-[10px] text-slate-400 font-medium">拖動滑桿調整數值</span>
      </header>

      <div className="flex justify-center gap-1.5 px-6 mb-4">
        {[true, true, true, true, true].map((done, i) => (
          <div 
            key={i} 
            className={`h-1.5 rounded-full ${i === 4 ? "w-6 bg-[#378ADD]" : "w-1.5 bg-[#1D9E75]"}`} 
          />
        ))}
      </div>

      <div className="mx-4 bg-white border border-slate-200 rounded-2xl p-6 mb-5 shadow-sm">
        <SliderField 
          label="透氣度" 
          value={metrics.breathability} 
          color="#378ADD" 
          icon={<Wind size={14} />}
          onChange={(v) => updateMetric("breathability", v)} 
        />
        <SliderField 
          label="包裹感" 
          value={metrics.snugness} 
          color="#1D9E75" 
          icon={<User size={14} />}
          onChange={(v) => updateMetric("snugness", v)} 
        />
        <SliderField 
          label="悶熱感" 
          value={metrics.stuffiness} 
          color="#D85A30" 
          icon={<Thermometer size={14} />}
          onChange={(v) => updateMetric("stuffiness", v)} 
        />
      </div>

      <div className={`mx-4 bg-slate-50 border border-slate-100 rounded-xl p-4 mb-8 transition-opacity ${feelSet ? "opacity-100 scale-100" : "opacity-30 scale-[0.98] animate-pulse"}`}>
        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">生成的感受標籤</div>
        <div className="text-sm font-bold text-slate-800 flex items-center gap-2">
          {feelSet ? <span className="w-2 h-2 rounded-full bg-[#1D9E75]" /> : <span className="w-2 h-2 rounded-full bg-slate-300" />}
          {feedbackDesc}
        </div>
      </div>

      <div className="px-4">
        <button 
          disabled={!feelSet}
          onClick={() => submitFeedback(metrics)}
          className={`w-full py-4 rounded-xl text-sm font-bold shadow-md transition-all active:scale-[0.98] ${feelSet ? "bg-[#0C447C] text-white" : "bg-slate-200 text-slate-400 cursor-not-allowed opacity-50"}`}
        >
          {feelSet ? "貢獻這份體感數據" : "請先調整下方滑桿"}
        </button>
      </div>
    </div>
  );
};


export default function App() {
  const [screen, setScreen] = useState<Screen>("welcome");
  const [userName, setUserName] = useState("");
  const [outfitList, setOutfitList] = useState<Outfit[]>(INITIAL_WARDROBE);
  const [inspirationIdx, setInspirationIdx] = useState(0);
  const [photoUploaded, setPhotoUploaded] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [feelSet, setFeelSet] = useState(false);
  const [feedbackDesc, setFeedbackDesc] = useState("尚未標記");
  const [toastMsg, setToastMsg] = useState("");
  const [currentTime, setCurrentTime] = useState("");

  const showToast = (msg: string) => setToastMsg(msg);

  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [locationInput, setLocationInput] = useState("");
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);

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

  const startApp = () => {
    if (!userName.trim() || !userLocation) return;
    loadWeather(userLocation.lat, userLocation.lon, userLocation.name);
    setScreen("home");
  };

  const handleNextInspiration = (liked: boolean) => {
    showToast(liked ? "已收藏這套穿搭 ♡" : "略過");
    setInspirationIdx((prev) => (prev + 1) % INSPIRATION_CARDS.length);
  };

  const handleUpload = () => {
    setPhotoUploaded(true);
    const now = new Date();
    setCurrentTime(`${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`);
    showToast("照片上傳成功");
  };

  const saveToWardrobe = async () => {
    if (!photoUploaded) return;

    // POST /api/notion/outfits — 之後寫入 Notion Database
    try {
      await createOutfit({
        userName,
        location: weather?.locationName ?? "",
        temp: Math.round(weather?.temp ?? 0),
        humidity: weather?.humidity ?? 0,
        rainProb: weather?.rainProb ?? 0,
        feel: "待填寫體感",
        feelColor: "#1D9E75",
        recordedAt: currentTime,
      });
    } catch (error) {
      console.warn("Notion outfit sync:", error);
    }

    showToast("穿搭已記錄！接下來填寫今日體感 →");
    setTimeout(() => setScreen("feedback"), 1000);
  };

  const submitFeedback = async (metrics: {
    breathability: number;
    snugness: number;
    stuffiness: number;
  }) => {
    if (!feelSet) return;

    // POST /api/notion/feedback — 之後寫入 Notion Database
    try {
      await createFeedback({
        userName,
        description: feedbackDesc,
        breathability: metrics.breathability,
        snugness: metrics.snugness,
        stuffiness: metrics.stuffiness,
        weatherSnapshot: weather ?? undefined,
      });
    } catch (error) {
      console.warn("Notion feedback sync:", error);
    }
    
    // Record outfit data
    const newOutfit: Outfit = {
      id: Date.now().toString(),
      emoji: "🧥",
      bg: "#e8f4ff",
      match: "-",
      temp: `${Math.round(weather?.temp || 26)}°C`,
      who: userName,
      date: "今天",
      location: weather?.locationName?.split(" ")[1] || weather?.locationName || "台北",
      feel: feedbackDesc.split("・")[0],
      feelColor: feedbackDesc.includes("炎熱") ? "#D85A30" : feedbackDesc.includes("涼") ? "#378ADD" : "#1D9E75",
      tags: [],
      humidity: `${weather?.humidity || 78}%`
    };
    
    setOutfitList([newOutfit, ...outfitList]);
    showToast("體感數據已記錄，謝謝你的貢獻 🌏");
    setTimeout(() => setScreen("home"), 1000);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 md:py-8 font-sans">
      <div className="w-[390px] h-[820px] bg-white border border-slate-200 md:rounded-[40px] flex flex-col relative overflow-hidden">
        
        {/* Screen Content */}
        <AnimatePresence mode="wait">
          <motion.div 
            key={screen}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
            className="flex-1 flex flex-col h-full overflow-hidden"
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
            {screen === "home" && <HomeScreen userName={userName} setScreen={setScreen} weather={weather} loading={weatherLoading} />}
            {screen === "inspiration" && <InspirationScreen inspirationIdx={inspirationIdx} handleNextInspiration={handleNextInspiration} setScreen={setScreen} weather={weather} />}
            {screen === "record" && <RecordScreen 
              photoUploaded={photoUploaded} 
              handleUpload={handleUpload} 
              currentTime={currentTime} 
              saveToWardrobe={saveToWardrobe} 
              weather={weather} 
              isCameraOpen={isCameraOpen}
              setIsCameraOpen={setIsCameraOpen}
              showActionSheet={showActionSheet}
              setShowActionSheet={setShowActionSheet}
              setPhotoUploaded={setPhotoUploaded}
            />}
            {screen === "feedback" && <FeedbackScreen userName={userName} feedbackDesc={feedbackDesc} setFeedbackDesc={setFeedbackDesc} feelSet={feelSet} setFeelSet={setFeelSet} submitFeedback={submitFeedback} />}
          </motion.div>
        </AnimatePresence>

        {/* Global Nav Bar */}
        {screen !== "welcome" && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[90%] z-30">
            <nav className="bg-white/90 backdrop-blur-xl border border-slate-200/50 rounded-2xl flex py-3 px-2 shadow-[0_10px_30px_-5px_rgba(0,0,0,0.1)]">
              {[
                { id: "home", icon: <Home size={20} />, label: "首頁" },
                { id: "inspiration", icon: <Sparkles size={20} />, label: "靈感" },
                { id: "record", icon: <Camera size={20} />, label: "記錄" },
                { id: "feedback", icon: <Smile size={20} />, label: "回饋" }
              ].map((tab) => (
                <button 
                  key={tab.id}
                  onClick={() => setScreen(tab.id as Screen)}
                  className={`flex-1 flex flex-col items-center gap-1 transition-all ${screen === tab.id ? "text-[#0C447C]" : "text-slate-400 hover:text-slate-600"}`}
                >
                  <div className={`p-1.5 rounded-xl transition-all ${screen === tab.id ? "bg-[#0C447C]/5" : ""}`}>
                    {tab.icon}
                  </div>
                  <span className={`text-[9px] font-bold tracking-tight ${screen === tab.id ? "text-[#0C447C]" : "text-slate-400"}`}>{tab.label}</span>
                </button>
              ))}
            </nav>
          </div>
        )}

        {/* Toast Notification */}
        <AnimatePresence>
          {toastMsg && <Toast message={toastMsg} onClear={() => setToastMsg("")} />}
        </AnimatePresence>
      </div>
    </div>
  );
}

