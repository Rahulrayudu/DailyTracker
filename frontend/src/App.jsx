import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

function customDebounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

const MacroCard = ({ label, value, target, unit, color, icon }) => {
  const percent = Math.min((value / (target || 1)) * 100, 100);
  return (
    <div className="bg-white/80 backdrop-blur-md p-6 rounded-[2rem] border border-white shadow-sm transition-all hover:shadow-xl hover:-translate-y-1 duration-300 relative overflow-hidden group">
      <div className={`absolute top-0 left-0 w-1 h-full ${color}`}></div>
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs uppercase text-slate-400 font-bold tracking-wider">{label}</span>
        <span className="text-xl">{icon}</span>
      </div>
      <span className="text-4xl font-extrabold block text-slate-900 tracking-tight">
        {value?.toFixed(0) || 0}<span className="text-sm font-medium text-slate-400 ml-2">{unit}</span>
      </span>
      <div className="w-full h-2 bg-slate-100 rounded-full mt-6 overflow-hidden">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          className={`${color} h-full transition-all duration-1000 ease-out relative`}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent to-white/30 animate-pulse"></div>
        </motion.div>
      </div>
      <div className="flex justify-between items-center mt-2">
        <span className="text-[10px] text-slate-400 font-medium">Target: {target?.toFixed(0) || 0} {unit}</span>
        <span className="text-[10px] font-bold text-green-600">{percent.toFixed(0)}%</span>
      </div>
    </div>
  );
};

export default function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [profile, setProfile] = useState(null);
  const [logs, setLogs] = useState([]);
  const [summary, setSummary] = useState({ total_calories: 0, total_protein: 0, total_carbs: 0, total_fats: 0, total_fiber: 0, by_meal: {} });
  const [input, setInput] = useState("");
  const [category, setCategory] = useState("nutrition");
  const [loading, setLoading] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [profForm, setProfForm] = useState({
    age: 25, sex: "male", height: 175, weight: 70, activity_level: "moderate", diet_type: "non-veg", goal: "maintain"
  });

  const [aiChips, setAiChips] = useState([]);
  const [isParsing, setIsParsing] = useState(false);

  const [chatMessages, setChatMessages] = useState([{ role: 'coach', text: "Hello! I'm your AI Health Coach. How can I help you today?" }]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  const [workoutPlan, setWorkoutPlan] = useState(null);
  const [workoutLoading, setWorkoutLoading] = useState(false);
  const [workoutPrefs, setWorkoutPrefs] = useState({ equipment: 'Gym', duration: '45' });

  const [showLogPage, setShowLogPage] = useState(false);
  const [toast, setToast] = useState(null);
  const [foodMessages, setFoodMessages] = useState([]);
  const [foodContext, setFoodContext] = useState("");
  const [foodDraft, setFoodDraft] = useState(null);
  const [foodThinking, setFoodThinking] = useState(false);
  const [selectedMeal, setSelectedMeal] = useState('Snack');
  const [selectedFood, setSelectedFood] = useState(null);
  const [foodServings, setFoodServings] = useState('1');
  const [manualEntryOpen, setManualEntryOpen] = useState(false);
  const [manualFood, setManualFood] = useState({ name: '', portion: '1 serving', calories: '', protein: '', carbs: '', fats: '', fiber: '' });

  const notify = (message, type = 'success') => {
    setToast({ message, type, id: Date.now() });
  };

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), 3600);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => { loadAllData(); }, [selectedDate]);

  const loadAllData = async (dateStr = selectedDate) => {
    try {
      const [profRes, logsRes, sumRes] = await Promise.all([
        axios.get(`${API_BASE}/profile`),
        axios.get(`${API_BASE}/logs?date_filter=${dateStr}`),
        axios.get(`${API_BASE}/summary?date_filter=${dateStr}`)
      ]);
      setProfile(profRes.data);
      setLogs(logsRes.data);
      setSummary(sumRes.data);
    } catch (e) { console.error("Loading error", e); }
  };

  const fetchAiChips = async (text) => {
    if (!text || text.length < 3) {
      setAiChips([]);
      return;
    }
    setIsParsing(true);
    try {
      const res = await axios.get(`${API_BASE}/ai/parse-live?text=${encodeURIComponent(text)}`);
      setAiChips(res.data);
    } catch (e) {
      console.error("Live parsing error", e);
    } finally {
      setIsParsing(false);
    }
  };

  const debouncedParse = React.useMemo(
    () => customDebounce((text) => fetchAiChips(text), 500),
    []
  );

  const handleInputChange = (val) => {
    setInput(val);
    debouncedParse(val);
  };

  const handleLog = async (customData = null) => {
    if (!input && !customData) return;
    setLoading(true);
    try {
      const payload = customData || { category, note: input, value: null };
      await axios.post(`${API_BASE}/logs`, payload);
      setInput("");
      setAiChips([]);
      await loadAllData();
      notify('Food added to your daily log.');
    } catch (e) { notify(e.response?.data?.detail || 'Could not save this food. Please try again.', 'error'); } finally { setLoading(false); }
  };

  const submitFoodMessage = async () => {
    const message = input.trim();
    if (!message || foodThinking) return;
    const combinedText = foodContext ? `${foodContext}\nAdditional details: ${message}` : message;
    setFoodContext(combinedText);
    setFoodMessages(prev => [...prev, { role: 'user', text: message }]);
    setInput('');
    setFoodThinking(true);
    setFoodDraft(null);
    try {
      const res = await axios.post(`${API_BASE}/ai/food-draft`, { text: combinedText });
      if (res.data.status === 'clarification') {
        setFoodMessages(prev => [...prev, { role: 'assistant', text: res.data.question || 'How much did you have?' }]);
      } else {
        setFoodDraft(res.data);
        setFoodMessages(prev => [...prev, { role: 'assistant', text: `I estimated the nutrition for ${res.data.food_description}. Please review the values below before saving.` }]);
      }
    } catch (e) {
      const detail = e.response?.data?.detail || 'I could not estimate that just now. Please try again.';
      setFoodMessages(prev => [...prev, { role: 'assistant', text: detail }]);
      notify(detail, 'error');
    } finally { setFoodThinking(false); }
  };

  const saveFoodDraft = async () => {
    if (!foodDraft) return;
    setLoading(true);
    try {
      await axios.post(`${API_BASE}/logs`, {
        category: 'nutrition', note: foodDraft.food_description, source: 'AI-estimated',
        meal: selectedMeal,
        calories: Number(foodDraft.calories), protein: Number(foodDraft.protein),
        carbs: Number(foodDraft.carbs), fats: Number(foodDraft.fats), fiber: Number(foodDraft.fiber)
      });
      await loadAllData();
      setFoodMessages([]); setFoodContext(''); setFoodDraft(null); setAiChips([]);
      notify('Nutrition saved and added to today’s totals.');
    } catch (e) { notify(e.response?.data?.detail || 'Could not save the nutrition estimate.', 'error'); }
    finally { setLoading(false); }
  };

  const searchFood = async (q) => {
    setSearchQuery(q);
    if (q.length < 2) { setSearchResults([]); return; }
    try {
      const res = await axios.get(`${API_BASE}/search-food?q=${encodeURIComponent(q)}`);
      setSearchResults(res.data);
    } catch (e) { console.error("Search error", e); notify('Food search is unavailable right now.', 'error'); }
  };

  const selectFood = (food) => {
    setSelectedFood(food);
    setFoodServings('1');
  };

  const saveSelectedFood = async () => {
    const servings = Number(foodServings);
    if (!selectedFood || !Number.isFinite(servings) || servings <= 0) {
      notify('Enter a serving amount greater than zero.', 'error');
      return;
    }
    setLoading(true);
    try {
      await axios.post(`${API_BASE}/logs`, {
        category: 'nutrition', meal: selectedMeal,
        note: `${servings} × ${selectedFood.name} (${selectedFood.serving_size})`, source: 'database',
        calories: Number(selectedFood.calories || 0) * servings,
        protein: Number(selectedFood.protein || 0) * servings,
        carbs: Number(selectedFood.carbs || 0) * servings,
        fats: Number(selectedFood.fats || 0) * servings,
        fiber: Number(selectedFood.fiber || 0) * servings
      });
      setSelectedFood(null);
      await loadAllData();
      notify(`${selectedFood.name} added to ${selectedMeal.toLowerCase()}.`);
    } catch (e) { notify(e.response?.data?.detail || 'Could not add this food.', 'error'); }
    finally { setLoading(false); }
  };

  const saveManualFood = async () => {
    const requiredNumbers = ['calories', 'protein', 'carbs', 'fats', 'fiber'];
    const missing = requiredNumbers.some(key => manualFood[key] === '' || !Number.isFinite(Number(manualFood[key])) || Number(manualFood[key]) < 0);
    if (!manualFood.name.trim() || !manualFood.portion.trim() || missing) {
      notify('Add a food name, portion, and valid nutrition values for every field.', 'error');
      return;
    }
    setLoading(true);
    try {
      await axios.post(`${API_BASE}/logs`, {
        category: 'nutrition', meal: selectedMeal, note: `${manualFood.name.trim()} (${manualFood.portion.trim()})`, source: 'user-edited',
        calories: Number(manualFood.calories), protein: Number(manualFood.protein),
        carbs: Number(manualFood.carbs), fats: Number(manualFood.fats), fiber: Number(manualFood.fiber)
      });
      setManualFood({ name: '', portion: '1 serving', calories: '', protein: '', carbs: '', fats: '', fiber: '' });
      setManualEntryOpen(false);
      await loadAllData();
      notify('Manual food entry saved to your log.');
    } catch (e) { notify(e.response?.data?.detail || 'Could not save this manual entry.', 'error'); }
    finally { setLoading(false); }
  };

  const deleteLog = async (id) => {
    if (!window.confirm("Delete this log?")) return;
    try {
      await axios.delete(`${API_BASE}/logs/${id}`);
      await loadAllData();
      notify('Log entry deleted.');
    } catch (e) { 
      console.error("Delete error:", e);
      notify("Could not delete item. It may have already been removed.", 'error'); 
    }
  };

  const handleChat = async () => {
    if (!chatInput) return;
    const userMsg = { role: 'user', text: chatInput };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput("");
    setChatLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/coach/chat`, { text: userMsg.text });
      setChatMessages(prev => [...prev, { role: 'coach', text: res.data.response }]);
    } catch (e) {
      setChatMessages(prev => [...prev, { role: 'coach', text: "Sorry, my brain is resting. Try again!" }]);
    } finally { setChatLoading(false); }
  };

  const generateWorkout = async () => {
    setWorkoutLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/workouts/plan`, workoutPrefs);
      setWorkoutPlan(res.data);
    } catch (e) {
      notify("Failed to generate workout. Try again!", 'error');
    } finally {
      setWorkoutLoading(false);
    }
  };

  const saveProfile = async () => {
    try {
      await axios.post(`${API_BASE}/profile`, profForm);
      setShowProfileModal(false);
      await loadAllData();
      notify('Profile saved.');
    } catch (e) { notify("Failed to save profile.", 'error'); }
  };

  return (
    <div className="app-shell min-h-screen bg-[#FBFBFF] font-poppins text-slate-900">
      <header className="bg-white/70 backdrop-blur-md border-b border-slate-100 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4 cursor-pointer group" onClick={() => setShowProfileModal(true)}>
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-2xl text-white shadow-lg transition-transform group-hover:scale-110 duration-300">🌿</div>
            <div className="transition-opacity group-hover:opacity-80">
              <h1 className="text-xl font-extrabold text-slate-900 leading-tight tracking-tight">LocalHealth Pro</h1>
              <p className="text-sm text-slate-500 font-medium">{profile ? `Goal: ${profile.goal}` : "Setup Profile"}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs font-bold text-green-600 bg-green-100/50 px-4 py-1.5 rounded-full uppercase tracking-wider border border-green-200">Premium AI</span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 relative">
        <AnimatePresence mode="wait">
          {showLogPage ? (
            <motion.div 
              key="log-page"
              initial={{ opacity: 0, x: 20 }} 
              animate={{ opacity: 1, x: 0 }} 
              exit={{ opacity: 0, x: 20 }} 
              className="space-y-10"
            >
              <div className="flex items-center gap-4 mb-6">
                <button onClick={() => setShowLogPage(false)} className="p-3 rounded-full bg-white shadow-sm border border-slate-100 text-slate-600 hover:bg-slate-50 transition-all hover:scale-110">←</button>
                <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Log Your Nutrition</h2>
              </div>

              <div className="glass-card flex flex-wrap items-center justify-between gap-4 px-6 py-4">
                <div><p className="text-sm font-bold text-slate-800">Add this to a meal</p><p className="text-xs text-slate-500 mt-1">Choose where this food belongs in today’s log.</p></div>
                <select aria-label="Meal" value={selectedMeal} onChange={e => setSelectedMeal(e.target.value)} className="min-h-11 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold">
                  {['Breakfast', 'Lunch', 'Dinner', 'Snack'].map(meal => <option key={meal} value={meal}>{meal}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-8 rounded-[2.5rem] border border-green-100 shadow-sm space-y-6 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-10 text-6xl">🥗</div>
                  <div className="flex items-center gap-2 text-green-700">
                    <span className="text-2xl">🤖</span>
                    <span className="text-sm font-bold uppercase tracking-widest">AI Assistant</span>
                  </div>
                  <p className="text-sm text-green-600 font-medium">Describe your meal in plain English. I'll calculate the nutrition for you!</p>
                  
                  <div className="flex flex-col items-center gap-4">
                    {foodMessages.length > 0 && (
                      <div className="w-full max-w-xl max-h-56 overflow-y-auto space-y-3 rounded-2xl bg-white/80 p-4 border border-green-100">
                        {foodMessages.map((message, index) => (
                          <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <p className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm ${message.role === 'user' ? 'bg-green-600 text-white rounded-br-sm' : 'bg-green-50 text-slate-700 rounded-bl-sm'}`}>{message.text}</p>
                          </div>
                        ))}
                        {foodThinking && <p className="text-xs text-green-700 animate-pulse">Checking portion and nutrition…</p>}
                      </div>
                    )}
                    {foodDraft && (
                      <div className="w-full max-w-xl rounded-2xl bg-white p-5 border border-green-100 shadow-sm">
                        <div className="flex items-start justify-between gap-3 mb-4">
                          <div><p className="text-sm font-bold text-slate-800">Nutrition estimate</p><p className="text-xs text-slate-500 mt-1">Estimated for {foodDraft.food_description}</p></div>
                          <span className="text-[10px] uppercase tracking-wide rounded-full bg-amber-50 text-amber-700 px-2 py-1">Review estimate</span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                          {['calories', 'protein', 'carbs', 'fats', 'fiber'].map((key) => (
                            <label key={key} className="text-[10px] uppercase tracking-wide text-slate-500 font-bold">{key === 'calories' ? 'kcal' : `${key} (g)`}
                              <input type="number" min="0" step="0.1" value={foodDraft[key]} onChange={e => setFoodDraft(prev => ({ ...prev, [key]: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 text-sm text-slate-800 outline-none focus:border-green-400" />
                            </label>
                          ))}
                        </div>
                        <div className="flex justify-end gap-2 mt-4">
                          <button onClick={() => setFoodDraft(null)} className="px-4 py-2 rounded-full text-xs font-bold text-slate-500 hover:bg-slate-50">Edit details</button>
                          <button onClick={saveFoodDraft} disabled={loading} className="px-5 py-2 rounded-full bg-green-600 text-white text-xs font-bold hover:bg-green-700 disabled:opacity-60">{loading ? 'Saving…' : 'Confirm & save'}</button>
                        </div>
                      </div>
                    )}
                    <AnimatePresence>
                      {aiChips.length > 0 && (
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }} 
                          animate={{ opacity: 1, y: 0 }} 
                          className="flex flex-wrap justify-center gap-2"
                        >
                          {aiChips.map((chip, i) => (
                            <motion.div 
                              key={i} 
                              initial={{ scale: 0 }} 
                              animate={{ scale: 1 }} 
                              className="bg-white px-4 py-1.5 rounded-full border border-green-200 text-green-700 text-xs font-bold shadow-sm"
                            >
                              ✨ {chip.quantity} {chip.item}
                            </motion.div>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div className="bg-white rounded-full p-2 shadow-xl border border-slate-100 flex items-center gap-2 w-full max-w-xl">
                      <input 
                        value={input} 
                        onChange={e => handleInputChange(e.target.value)}
                        onKeyPress={e => e.key === 'Enter' && submitFoodMessage()}
                        placeholder="e.g. 2 chapati and dal" 
                        className="flex-1 bg-transparent px-4 py-3 text-sm outline-none"
                      />
                      <div className="relative">
                        {isParsing && (
                          <div className="absolute -left-6 top-1/2 -translate-y-1/2 w-3 h-3 bg-green-400 rounded-full animate-ping" />
                        )}
                        <button 
                          onClick={submitFoodMessage} 
                          disabled={foodThinking || loading}
                          className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold transition-all ${loading ? 'bg-slate-300' : 'bg-green-500 hover:bg-green-600 shadow-lg shadow-green-200'}`}
                        >
                          {foodThinking ? '…' : '↑'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="flex items-center gap-2 text-slate-800">
                    <span className="text-2xl">🔍</span>
                    <span className="text-sm font-bold uppercase tracking-widest">Nutrition Database</span>
                  </div>
                  <div className="relative">
                    <input 
                      value={searchQuery} 
                      onChange={e => searchFood(e.target.value)} 
                      placeholder="Search for a specific food..." 
                      className="w-full p-4 pl-12 bg-white rounded-2xl border border-slate-100 shadow-sm outline-none text-sm focus:border-green-300 transition-all"
                    />
                    <span className="absolute left-4 top-4 text-slate-400 text-lg">🔍</span>
                  </div>
                  <div className="max-h-[400px] overflow-y-auto space-y-3 pr-2">
                    {searchResults.length === 0 && searchQuery.length >= 2 && <div className="text-center text-slate-400 text-sm py-10">No foods found in database.</div>}
                    {searchResults.map(food => (
                      <div 
                        key={food.id} 
                        onClick={() => selectFood(food)}
                        className="p-4 bg-white rounded-2xl border border-slate-100 hover:border-green-300 cursor-pointer transition-all flex justify-between items-center shadow-sm group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-xs group-hover:bg-green-50 transition-colors">🍎</div>
                          <div>
                            <p className="text-sm font-bold text-slate-800">{food.name}</p>
                            <p className="text-xs text-slate-400">{food.serving_size}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-slate-700">{food.calories} kcal</p>
                          <p className="text-[10px] text-slate-400 uppercase font-bold">P:{food.protein}g C:{food.carbs}g F:{food.fats}g · Fiber:{food.fiber || 0}g</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {selectedFood && (
                    <div className="glass-card p-5 space-y-4">
                      <div className="flex items-start justify-between gap-3">
                        <div><p className="font-bold text-slate-800">{selectedFood.name}</p><p className="text-xs text-slate-500">Values per {selectedFood.serving_size}</p></div>
                        <button aria-label="Cancel food selection" onClick={() => setSelectedFood(null)} className="text-slate-400 px-2">✕</button>
                      </div>
                      <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">Number of servings
                        <input type="number" min="0.1" step="0.1" value={foodServings} onChange={e => setFoodServings(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 text-base" />
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-slate-500">
                        {['calories', 'protein', 'carbs', 'fats', 'fiber'].map(key => <span key={key} className="rounded-xl bg-slate-50 px-3 py-2">{key === 'calories' ? 'Calories' : key}: <b className="text-slate-800">{(Number(selectedFood[key] || 0) * (Number(foodServings) || 0)).toFixed(key === 'calories' ? 0 : 1)}{key === 'calories' ? ' kcal' : ' g'}</b></span>)}
                      </div>
                      <button onClick={saveSelectedFood} disabled={loading} className="w-full rounded-xl bg-green-500 px-5 py-3 text-sm font-bold text-white disabled:opacity-60">{loading ? 'Adding…' : `Add to ${selectedMeal}`}</button>
                    </div>
                  )}

                  <div className="glass-card p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div><p className="font-bold text-slate-800">Food not listed?</p><p className="text-xs text-slate-500 mt-1">Enter the portion and nutrition values yourself.</p></div>
                      <button onClick={() => setManualEntryOpen(open => !open)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-green-700">{manualEntryOpen ? 'Close' : 'Add manually'}</button>
                    </div>
                    {manualEntryOpen && (
                      <div className="mt-5 space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <label className="text-xs font-bold text-slate-500">Food name<input value={manualFood.name} onChange={e => setManualFood(prev => ({...prev, name: e.target.value}))} placeholder="e.g. Homemade vegetable pulao" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm" /></label>
                          <label className="text-xs font-bold text-slate-500">Portion<input value={manualFood.portion} onChange={e => setManualFood(prev => ({...prev, portion: e.target.value}))} placeholder="e.g. 1 bowl (250 g)" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm" /></label>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                          {['calories', 'protein', 'carbs', 'fats', 'fiber'].map(key => <label key={key} className="text-[10px] uppercase tracking-wide text-slate-500 font-bold">{key === 'calories' ? 'Calories (kcal)' : `${key} (g)`}<input type="number" min="0" step="0.1" value={manualFood[key]} onChange={e => setManualFood(prev => ({...prev, [key]: e.target.value}))} className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 text-sm" /></label>)}
                        </div>
                        <button onClick={saveManualFood} disabled={loading} className="w-full rounded-xl bg-green-500 px-5 py-3 text-sm font-bold text-white disabled:opacity-60">{loading ? 'Saving…' : 'Save manual entry'}</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key={activeTab}
              initial={{ opacity: 0, y: 10 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0, y: -10 }} 
              transition={{ duration: 0.2 }}
              className="space-y-10"
            >
              {activeTab === 'home' && (
                <>
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                    <div className="space-y-1">
                      <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Welcome back!</h2>
                      <p className="text-sm text-slate-500 font-medium">Here's your health snapshot for today.</p>
                    </div>
                    <div className="flex items-center gap-4 bg-slate-50 p-2 rounded-2xl border border-slate-100">
                      <button onClick={() => {
                        const d = new Date(selectedDate);
                        d.setDate(d.getDate() - 1);
                        setSelectedDate(d.toISOString().split('T')[0]);
                      }} className="p-2 text-slate-400 hover:text-green-600 transition-colors">←</button>
                      <input 
                        type="date" 
                        value={selectedDate} 
                        onChange={e => setSelectedDate(e.target.value)}
                        className="text-sm font-bold text-slate-600 bg-transparent outline-none text-center cursor-pointer"
                      />
                      <button onClick={() => {
                        const d = new Date(selectedDate);
                        d.setDate(d.getDate() + 1);
                        setSelectedDate(d.toISOString().split('T')[0]);
                      }} className="p-2 text-slate-400 hover:text-green-600 transition-colors">→</button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                    <MacroCard label="Calories" value={summary.total_calories} target={profile?.calorie_target || 2000} unit="kcal" color="bg-[#FF8A65]" icon="🔥" />
                    <MacroCard label="Protein" value={summary.total_protein} target={profile?.protein_target || 100} unit="g" color="bg-[#34F5C5]" icon="💪" />
                    <MacroCard label="Carbs" value={summary.total_carbs} target={profile?.carb_target || 200} unit="g" color="bg-[#38BDF8]" icon="🍞" />
                    <MacroCard label="Fats" value={summary.total_fats} target={profile?.fat_target || 60} unit="g" color="bg-[#FBBF24]" icon="🥑" />
                    <MacroCard label="Fiber" value={summary.total_fiber} target={28} unit="g" color="bg-[#A78BFA]" icon="🌾" />
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                    <div className="lg:col-span-2 space-y-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xl font-bold text-slate-800 tracking-tight">Daily Activity Log</h3>
                        <button 
                          onClick={() => setShowLogPage(true)}
                          className="bg-green-500 text-white px-6 py-3 rounded-full font-bold shadow-lg shadow-green-200 hover:bg-green-600 transition-all flex items-center gap-2 text-sm hover:scale-105 active:scale-95"
                        >
                          <span className="text-lg">➕</span> Log Food
                        </button>
                      </div>

                      {Object.keys(summary.by_meal || {}).length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
                          {Object.entries(summary.by_meal).map(([meal, totals]) => (
                            <div key={meal} className="glass-card px-5 py-4">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-sm font-bold text-slate-800">{meal}</p>
                                <p className="text-sm font-extrabold text-[#FF8A65]">{Math.round(totals.calories)} kcal</p>
                              </div>
                              <p className="text-[11px] text-slate-500 mt-2">Protein {totals.protein.toFixed(1)}g · Carbs {totals.carbs.toFixed(1)}g · Fat {totals.fats.toFixed(1)}g · Fiber {totals.fiber.toFixed(1)}g</p>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      <div className="space-y-4">
                        {logs.length === 0 ? (
                          <div className="bg-white p-16 rounded-[2.5rem] text-center border border-slate-100 text-slate-400 shadow-sm">
                            <div className="text-6xl mb-6">🥗</div>
                            <p className="text-lg font-medium mb-2">No logs for this date.</p>
                            <p className="text-sm opacity-70">Time to fuel up your body!</p>
                          </div>
                        ) : (
                          logs.map(log => (
                            <motion.div key={log.id} layout className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex items-center justify-between hover:border-green-200 transition-all group">
                              <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-lg group-hover:bg-green-50 transition-colors">📝</div>
                                <div>
                                  <p className="text-sm font-bold text-slate-800">{log.note || log.category}</p>
                                  <p className="text-[11px] text-slate-400 font-medium">{new Date(log.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} • {log.source}</p>
                                  {log.category === 'nutrition' && <p className="text-[11px] text-slate-500 mt-1">P {Number(log.protein || 0).toFixed(1)}g · C {Number(log.carbs || 0).toFixed(1)}g · F {Number(log.fats || 0).toFixed(1)}g · Fiber {Number(log.fiber || 0).toFixed(1)}g</p>}
                                </div>
                              </div>
                              <div className="flex items-center gap-6">
                                {log.calories > 0 && <span className="text-sm font-extrabold text-slate-700">{log.calories} kcal</span>}
                                <button onClick={() => deleteLog(log.id)} className="text-slate-300 hover:text-red-400 transition-colors text-lg">✕</button>
                              </div>
                            </motion.div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
                        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest">Quick Insights</h3>
                        <div className="p-5 bg-slate-50 rounded-3xl border border-slate-100">
                          <p className="text-sm text-slate-500 leading-relaxed font-medium">
                            {profile ? `You are currently targeting ${profile.calorie_target?.toFixed(0)} kcal for your ${profile.goal} goal.` : "Setup your profile to see AI insights."}
                          </p>
                        </div>
                        <button onClick={() => setActiveTab('coach')} className="w-full py-4 bg-slate-900 text-white rounded-2xl text-sm font-bold hover:bg-slate-800 transition-all shadow-xl shadow-slate-200">
                          Chat with Coach 🤖
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {activeTab === 'coach' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="max-w-3xl mx-auto h-[calc(100vh-300px)] flex flex-col">
                  <div className="flex-1 overflow-y-auto space-y-4 mb-6 px-4">
                    {chatMessages.map((msg, i) => (
                      <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] p-4 rounded-2xl text-sm ${msg.role === 'user' ? 'bg-green-500 text-white rounded-tr-none shadow-md' : 'bg-white border border-slate-100 text-slate-800 rounded-tl-none shadow-sm'}`}>
                          {msg.text}
                        </div>
                      </div>
                    ))}
                    {chatLoading && <div className="text-xs text-slate-400 animate-pulse px-4">Coach is thinking...</div>}
                  </div>
                  <div className="flex gap-3 p-3 bg-white rounded-full border border-slate-100 shadow-xl">
                    <input 
                      value={chatInput} 
                      onChange={e => setChatInput(e.target.value)}
                      onKeyPress={e => e.key === 'Enter' && handleChat()}
                      placeholder="Ask your coach about nutrition or training..." 
                      className="flex-1 bg-transparent px-4 py-2 text-sm outline-none"
                    />
                    <button onClick={handleChat} className="bg-green-500 text-white w-12 h-12 rounded-full flex items-center justify-center font-bold hover:bg-green-600 transition-all shadow-lg shadow-green-200">↑</button>
                  </div>
                </motion.div>
              )}

              {activeTab === 'train' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="max-w-4xl mx-auto space-y-10">
                  <div className="bg-white p-12 rounded-[3rem] shadow-sm border border-slate-100 text-center space-y-8">
                    <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight">AI Workout Planner</h2>
                    <p className="text-slate-500 max-w-lg mx-auto text-lg leading-relaxed">Generate a scientific training plan based on your profile, available equipment, and time.</p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-2xl mx-auto text-left">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase block ml-1 tracking-wider">Equipment</label>
                        <select 
                          value={workoutPrefs.equipment} 
                          onChange={e => setWorkoutPrefs({...workoutPrefs, equipment: e.target.value})}
                          className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-100 outline-none text-sm focus:border-green-300 transition-all"
                        >
                          <option value="Gym">Gym</option>
                          <option value="Home">Home</option>
                          <option value="Dumbbells">Dumbbells only</option>
                          <option value="None">Bodyweight</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase block ml-1 tracking-wider">Duration (min)</label>
                        <input 
                          type="number" 
                          value={workoutPrefs.duration} 
                          onChange={e => setWorkoutPrefs({...workoutPrefs, duration: e.target.value})}
                          className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-100 outline-none text-sm focus:border-green-300 transition-all"
                        />
                      </div>
                    </div>
                    
                    <button 
                      onClick={generateWorkout} 
                      disabled={workoutLoading}
                      className="px-16 py-5 bg-green-500 text-white rounded-full font-extrabold shadow-xl shadow-green-200 hover:bg-green-600 transition-all disabled:bg-slate-300 text-lg"
                    >
                      {workoutLoading ? 'Designing your plan...' : 'Generate My Plan'}
                    </button>
                  </div>

                  <AnimatePresence>
                    {workoutPlan && (
                      <motion.div 
                        initial={{ opacity: 0, y: 20 }} 
                        animate={{ opacity: 1, y: 0 }} 
                        className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 space-y-8"
                      >
                        <div className="flex justify-between items-center border-b border-slate-100 pb-8">
                          <div>
                            <h3 className="text-3xl font-extrabold text-slate-900 tracking-tight">{workoutPlan.workout_name}</h3>
                            <p className="text-sm text-slate-500 mt-2 leading-relaxed">{workoutPlan.reasoning}</p>
                          </div>
                          <span className="text-xs bg-green-100 text-green-700 px-4 py-1.5 rounded-full font-bold uppercase tracking-widest">AI Planned</span>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {workoutPlan?.exercises?.map((ex, i) => (
                            <div key={i} className="p-5 bg-slate-50 rounded-3xl border border-slate-100 flex justify-between items-center hover:bg-slate-100 transition-all group">
                              <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm text-lg group-hover:scale-110 transition-transform">💪</div>
                                <div>
                                  <p className="text-sm font-bold text-slate-800">{ex.name}</p>
                                  <p className="text-xs text-slate-400">{ex.sets} sets • {ex.reps} reps • {ex.rest} rest</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <span className="text-xs font-bold text-slate-600 bg-slate-200 px-3 py-1 rounded-full">RPE {ex.rpe}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                        
                        <button 
                          onClick={() => {
                            notify("Workout tracking session starting.", 'info');
                            setActiveTab('home');
                          }} 
                          className="w-full py-5 bg-slate-900 text-white rounded-3xl font-extrabold shadow-xl hover:bg-slate-800 transition-all text-lg"
                        >
                          Start Tracking Session
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}

              {activeTab === 'insights' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="max-w-2xl mx-auto text-center py-20 space-y-8">
                  <div className="text-8xl mb-8 animate-bounce">📈</div>
                  <h3 className="text-4xl font-extrabold text-slate-900 tracking-tight">Analytics Coming Soon</h3>
                  <p className="text-lg text-slate-500 max-w-md mx-auto leading-relaxed">We're building the pattern detection engine to correlate your sleep, workouts, and nutrition.</p>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-slate-100 px-6 py-3 flex justify-center z-30">
        <div className="flex items-center gap-8 max-w-2xl w-full justify-center">
          {[
            { id: 'home', icon: '🏠', label: 'Home' },
            { id: 'coach', icon: '🤖', label: 'Coach' },
            { id: 'train', icon: '💪', label: 'Train' },
            { id: 'insights', icon: '📈', label: 'Insights' },
          ].map(tab => (
            <button 
              key={tab.id} 
              onClick={() => {
                setActiveTab(tab.id);
                setShowLogPage(false);
              }}
              className={`flex flex-col items-center gap-1 transition-all px-6 py-3 rounded-2xl ${activeTab === tab.id ? 'text-green-600 bg-green-50 scale-110 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <span className="text-3xl">{tab.icon}</span>
              <span className="text-[10px] font-extrabold uppercase tracking-tighter">{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Profile Modal */}
      {showProfileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white w-full max-w-lg rounded-[2.5rem] p-10 shadow-2xl">
            <h2 className="text-3xl font-extrabold text-slate-900 mb-8 tracking-tight">Your Profile</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase block">Age</label>
                <input type="number" value={profForm.age} onChange={e => setProfForm({...profForm, age: parseInt(e.target.value)})} className="w-full p-3 bg-slate-50 rounded-xl border border-slate-100 outline-none text-sm focus:border-green-300 transition-all" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase block">Sex</label>
                <select value={profForm.sex} onChange={e => setProfForm({...profForm, sex: e.target.value})} className="w-full p-3 bg-slate-50 rounded-xl border border-slate-100 outline-none text-sm focus:border-green-300 transition-all">
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase block">Height (cm)</label>
                <input type="number" value={profForm.height} onChange={e => setProfForm({...profForm, height: parseFloat(e.target.value)})} className="w-full p-3 bg-slate-50 rounded-xl border border-slate-100 outline-none text-sm focus:border-green-300 transition-all" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase block">Weight (kg)</label>
                <input type="number" value={profForm.weight} onChange={e => setProfForm({...profForm, weight: parseFloat(e.target.value)})} className="w-full p-3 bg-slate-50 rounded-xl border border-slate-100 outline-none text-sm focus:border-green-300 transition-all" />
              </div>
              <div className="col-span-1 md:col-span-2 space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase block">Activity Level</label>
                <select value={profForm.activity_level} onChange={e => setProfForm({...profForm, activity_level: e.target.value})} className="w-full p-3 bg-slate-50 rounded-xl border border-slate-100 outline-none text-sm focus:border-green-300 transition-all">
                  <option value="sedentary">Sedentary (Office job)</option>
                  <option value="light">Light (1-3 days/week)</option>
                  <option value="moderate">Moderate (3-5 days/week)</option>
                  <option value="active">Active (6-7 days/week)</option>
                  <option value="very_active">Extra Active (Physical job)</option>
                </select>
              </div>
              <div className="col-span-1 md:col-span-2 space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase block">Goal</label>
                <select value={profForm.goal} onChange={e => setProfForm({...profForm, goal: e.target.value})} className="w-full p-3 bg-slate-50 rounded-xl border border-slate-100 outline-none text-sm focus:border-green-300 transition-all">
                  <option value="lose">Weight Loss</option>
                  <option value="maintain">Maintenance</option>
                  <option value="gain">Muscle Gain</option>
                </select>
              </div>
            </div>
            <div className="flex gap-4">
              <button onClick={() => setShowProfileModal(false)} className="flex-1 py-4 text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors">Cancel</button>
              <button onClick={saveProfile} className="flex-1 py-4 bg-green-500 text-white rounded-2xl text-sm font-bold shadow-lg shadow-green-200 hover:bg-green-600 transition-all">Save Profile</button>
            </div>
          </motion.div>
        </div>
      )}
      <AnimatePresence>
        {toast && (
          <motion.div key={toast.id} initial={{ opacity: 0, y: -12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8 }} role="status" aria-live="polite" className={`fixed top-24 right-5 z-[70] max-w-sm rounded-2xl px-5 py-4 text-sm font-semibold text-white shadow-xl ${toast.type === 'error' ? 'bg-rose-600' : toast.type === 'info' ? 'bg-slate-800' : 'bg-emerald-600'}`}>
            <span className="mr-2">{toast.type === 'error' ? '⚠' : toast.type === 'info' ? 'ℹ' : '✓'}</span>{toast.message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
