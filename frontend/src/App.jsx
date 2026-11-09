import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import {
  Activity, AlertCircle, Apple, ArrowLeft, BarChart3, Check, ChevronDown,
  Droplets, Dumbbell, Flame, Home, Info, MessageCircle, Plus, Scale,
  Search, Sparkles, Sprout, Trash2, User2, Wheat, X,
} from 'lucide-react';
import MuscleMap from './components/MuscleMap';

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

function parseWorkoutTimestamp(value) {
  const timestamp = String(value || '');
  return new Date(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(timestamp) ? timestamp : `${timestamp}Z`);
}

function formatTrackingTime(value) {
  return parseWorkoutTimestamp(value).toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit',
  });
}

function istRangeStart(days) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const dateParts = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return Date.UTC(Number(dateParts.year), Number(dateParts.month) - 1, Number(dateParts.day) - (days - 1)) - (330 * 60 * 1000);
}

function indiaDateString(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const dateParts = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${dateParts.year}-${dateParts.month}-${dateParts.day}`;
}

function addCalendarDays(dateString, offset) {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + offset)).toISOString().slice(0, 10);
}

const MacroCard = ({ label, value, target, unit, color, icon }) => {
  const currentValue = Math.max(0, Number(value) || 0);
  const targetValue = Math.max(1, Number(target) || 1);
  const rawPercent = (currentValue / targetValue) * 100;
  const percent = Math.min(rawPercent, 100);
  const overTarget = rawPercent > 100;
  const Icon = icon;
  return (
    <div className={`macro-card bg-white/80 backdrop-blur-md p-6 rounded-[2rem] border border-white shadow-sm transition-all hover:shadow-xl hover:-translate-y-1 duration-300 relative overflow-hidden group ${overTarget ? 'is-over-target' : rawPercent >= 80 ? 'is-near-target' : ''}`} style={{ '--data-color': color }}>
      <div className="macro-card-accent absolute top-0 left-0 w-1 h-full" aria-hidden="true" />
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs uppercase text-slate-400 font-bold tracking-wider">{label}</span>
        <span className="macro-card-icon grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/5"><Icon size={18} strokeWidth={1.8} aria-hidden="true" /></span>
      </div>
      <span className="num macro-card-value text-4xl font-extrabold block tracking-tight">
        {currentValue.toFixed(0)}<span className="macro-card-unit text-sm font-medium ml-2">{unit}</span>
      </span>
      <div className="macro-card-track w-full h-2 rounded-full mt-6 overflow-hidden" role="progressbar" aria-label={`${label} target progress`} aria-valuemin="0" aria-valuemax={targetValue} aria-valuenow={Math.min(currentValue, targetValue)} aria-valuetext={overTarget ? `Over by ${Math.round(currentValue - targetValue)} ${unit}` : `${Math.round(rawPercent)} percent of target`}>
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          className="macro-card-progress h-full transition-all duration-1000 ease-out relative"
        />
      </div>
      <div className="flex justify-between items-center mt-2">
        <span className="macro-card-target text-xs font-medium">Target {targetValue.toFixed(0)} {unit}</span>
        <span className="macro-card-status text-xs font-bold" aria-live="polite">{overTarget ? `Over by ${Math.round(currentValue - targetValue)} ${unit}` : `${Math.round(rawPercent)}%`}</span>
      </div>
    </div>
  );
};

const DEFAULT_PROFILE_FORM = {
  age: '', sex: 'male', height: '', weight: '', activity_level: 'sedentary',
  diet_type: 'non-veg', goal: 'maintain', target_weight_kg: '',
  routine_timezone: 'Asia/Kolkata', wake_time: '06:30', work_start_time: '09:00',
  work_end_time: '18:00', breakfast_time: '08:00', lunch_time: '13:00',
  snack_time: '16:30', dinner_time: '20:00', sleep_time: '22:30',
};

const APP_TABS = [
  { id: 'home', Icon: Home, label: 'Home', color: 'var(--c-today)' },
  { id: 'coach', Icon: MessageCircle, label: 'Coach', color: 'var(--c-coach)' },
  { id: 'train', Icon: Dumbbell, label: 'Train', color: 'var(--c-workout)' },
  { id: 'insights', Icon: BarChart3, label: 'Insights', color: 'var(--c-insights)' },
  { id: 'profile', Icon: User2, label: 'Profile', color: 'var(--c-today)' },
];

const profileToForm = (profile) => {
  if (!profile) return { ...DEFAULT_PROFILE_FORM };
  const asTime = (value, fallback) => value ? String(value).slice(0, 5) : fallback;
  return {
    ...DEFAULT_PROFILE_FORM,
    age: profile.age ?? '',
    sex: profile.sex === 'female' ? 'female' : 'male',
    height: profile.height ?? '',
    weight: profile.weight ?? '',
    activity_level: ['sedentary', 'light', 'moderate', 'active', 'very_active'].includes(profile.activity_level) ? profile.activity_level : 'sedentary',
    diet_type: ['veg', 'eggetarian', 'non-veg', 'vegan'].includes(profile.diet_type) ? profile.diet_type : 'non-veg',
    goal: ['lose', 'maintain', 'gain'].includes(profile.goal) ? profile.goal : 'maintain',
    target_weight_kg: profile.target_weight_kg ?? '',
    routine_timezone: 'Asia/Kolkata',
    wake_time: asTime(profile.wake_time, DEFAULT_PROFILE_FORM.wake_time),
    work_start_time: asTime(profile.work_start_time, DEFAULT_PROFILE_FORM.work_start_time),
    work_end_time: asTime(profile.work_end_time, DEFAULT_PROFILE_FORM.work_end_time),
    breakfast_time: asTime(profile.breakfast_time, DEFAULT_PROFILE_FORM.breakfast_time),
    lunch_time: asTime(profile.lunch_time, DEFAULT_PROFILE_FORM.lunch_time),
    snack_time: asTime(profile.snack_time, DEFAULT_PROFILE_FORM.snack_time),
    dinner_time: asTime(profile.dinner_time, DEFAULT_PROFILE_FORM.dinner_time),
    sleep_time: asTime(profile.sleep_time, DEFAULT_PROFILE_FORM.sleep_time),
  };
};

function suggestRoutineMealTimes(form) {
  const toMinutes = value => {
    const [hours, minutes] = String(value || '00:00').split(':').map(Number);
    return (hours * 60) + minutes;
  };
  const asTime = value => {
    const normalized = ((Math.round(value) % 1440) + 1440) % 1440;
    return `${String(Math.floor(normalized / 60)).padStart(2, '0')}:${String(normalized % 60).padStart(2, '0')}`;
  };
  const between = (value, minimum, maximum) => maximum < minimum
    ? Math.max(0, Math.min(value, maximum))
    : Math.max(minimum, Math.min(value, maximum));

  const wake = toMinutes(form.wake_time);
  let bedtime = toMinutes(form.sleep_time);
  if (bedtime <= wake) bedtime += 1440;
  let workStart = toMinutes(form.work_start_time);
  if (workStart < wake) workStart += 1440;
  let workEnd = toMinutes(form.work_end_time);
  while (workEnd <= workStart) workEnd += 1440;

  const breakfast = between(wake + 60, wake + 30, bedtime - 180);
  const lunch = between((workStart + workEnd) / 2, breakfast + 180, bedtime - 180);
  const dinner = between(Math.max(workEnd + 60, bedtime - 180), lunch + 180, bedtime - 60);
  const snack = between((lunch + dinner) / 2, lunch + 90, dinner - 60);

  return {
    breakfast_time: asTime(breakfast),
    lunch_time: asTime(lunch),
    snack_time: asTime(snack),
    dinner_time: asTime(dinner),
  };
}

function WorkoutProgressChart({ title, points, color, unit, emptyMessage }) {
  const chartWidth = 560;
  const chartHeight = 210;
  const left = 48;
  const right = 18;
  const top = 16;
  const bottom = 38;
  const plotWidth = chartWidth - left - right;
  const plotHeight = chartHeight - top - bottom;
  const maxValue = Math.max(1, ...points.map(point => point.value)) * 1.12;
  const xFor = index => points.length <= 1 ? left + plotWidth / 2 : left + index * plotWidth / (points.length - 1);
  const yFor = value => top + plotHeight - (value / maxValue) * plotHeight;
  const coordinates = points.map((point, index) => `${xFor(index)},${yFor(point.value)}`).join(' ');
  const labelEvery = Math.max(1, Math.ceil(points.length / 6));

  return (
    <article className="workout-progress-card">
      <div className="workout-progress-card-heading"><h4>{title}</h4><span>{unit}</span></div>
      {points.length ? <div className="workout-progress-chart-scroll"><svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img" aria-label={`${title} progress over recent workout sessions`}>
        {[0, 0.5, 1].map(tick => {
          const value = maxValue * (1 - tick);
          const y = top + plotHeight * tick;
          return <g key={tick}><line x1={left} x2={chartWidth - right} y1={y} y2={y} stroke="rgba(255,255,255,.09)"/><text x={left - 8} y={y + 4} textAnchor="end" fill="#8490AA" fontSize="10">{Math.round(value * 10) / 10}</text></g>;
        })}
        {points.length > 1 && <polyline points={coordinates} fill="none" stroke={color} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round"/>}
        {points.map((point, index) => <g key={`${point.date}-${index}`}><circle cx={xFor(index)} cy={yFor(point.value)} r="5" fill={color} stroke="#08111D" strokeWidth="2"><title>{point.date}: {point.value} {unit}</title></circle>{(index % labelEvery === 0 || index === points.length - 1) && <text x={xFor(index)} y={chartHeight - 10} textAnchor="middle" fill="#8490AA" fontSize="9">{point.label}</text>}</g>)}
      </svg></div> : <p className="workout-progress-empty">{emptyMessage}</p>}
    </article>
  );
}

function InsightsTab({ data, loading, days, onDaysChange, sessions = [], records = [] }) {
  const [selectedExerciseId, setSelectedExerciseId] = useState('');
  const daily = data?.daily || [];
  const summary = data?.summary || {};
  const chartWidth = 760;
  const chartHeight = 250;
  const chartLeft = 48;
  const chartRight = 18;
  const chartTop = 22;
  const chartBottom = 34;
  const plotHeight = chartHeight - chartTop - chartBottom;
  const plotWidth = chartWidth - chartLeft - chartRight;
  const calorieMaximum = Math.max(summary.calorie_target || 0, ...daily.map(day => day.calories || 0), 1000) * 1.15;
  const calorieY = value => chartTop + plotHeight - (Math.min(value, calorieMaximum) / calorieMaximum) * plotHeight;
  const barStep = daily.length ? plotWidth / daily.length : plotWidth;
  const labelEvery = daily.length > 14 ? 5 : daily.length > 7 ? 3 : 1;
  const dateIndex = new Map(daily.map((day, index) => [day.date, index]));
  const weights = data?.weight_series || [];
  const weightValues = weights.map(item => item.weight_kg);
  const weightMin = weightValues.length ? Math.min(...weightValues) - 0.5 : 0;
  const weightMax = weightValues.length ? Math.max(...weightValues) + 0.5 : 1;
  const weightPoints = weights.map(item => {
    const index = dateIndex.get(item.date) ?? 0;
    const x = chartLeft + index * barStep + barStep / 2;
    const y = chartTop + plotHeight - ((item.weight_kg - weightMin) / (weightMax - weightMin || 1)) * plotHeight;
    return { x, y, item };
  });
  const caloriesLogged = daily.some(day => day.calories > 0);
  const workoutCutoff = istRangeStart(days);
  const inRangeSessions = sessions.filter(session => parseWorkoutTimestamp(session.date).getTime() >= workoutCutoff);
  const exerciseOptionsById = new Map();
  inRangeSessions.forEach(session => session.sets?.forEach(set => {
    if (set.exercise_id != null && set.exercise_name) exerciseOptionsById.set(String(set.exercise_id), { id: String(set.exercise_id), name: set.exercise_name });
  }));
  const exerciseOptions = [...exerciseOptionsById.values()].sort((a, b) => a.name.localeCompare(b.name));
  const selectedExercise = exerciseOptions.find(exercise => exercise.id === selectedExerciseId) || exerciseOptions[0];
  const exerciseProgress = selectedExercise ? inRangeSessions
    .map(session => {
      const sets = (session.sets || []).filter(set => String(set.exercise_id) === selectedExercise.id && Number(set.reps) > 0);
      if (!sets.length) return null;
      const weightedSets = sets.filter(set => set.weight != null && Number.isFinite(Number(set.weight)));
      const bestWeight = weightedSets.length ? Math.max(...weightedSets.map(set => Number(set.weight))) : null;
      const bestReps = Math.max(...sets.map(set => Number(set.reps)));
      return {
        date: session.date,
        label: parseWorkoutTimestamp(session.date).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric', timeZone: 'Asia/Kolkata' }),
        bestWeight,
        bestReps,
      };
    })
    .filter(Boolean)
    .sort((a, b) => parseWorkoutTimestamp(a.date).getTime() - parseWorkoutTimestamp(b.date).getTime()) : [];
  const loadProgressPoints = exerciseProgress.filter(point => point.bestWeight != null).map(point => ({ ...point, value: point.bestWeight }));
  const repProgressPoints = exerciseProgress.map(point => ({ ...point, value: point.bestReps }));
  const selectedPersonalRecord = selectedExercise
    ? records.find(record => String(record.exercise_id) === selectedExercise.id)
    : null;
  const workoutVolumePoints = inRangeSessions.map(session => {
    const volume = (session.sets || []).reduce((total, set) => {
      if (set.weight == null || Number(set.reps) <= 0 || !Number.isFinite(Number(set.weight))) return total;
      return total + Number(set.weight) * Number(set.reps);
    }, 0);
    return volume > 0 ? {
      date: session.date,
      label: parseWorkoutTimestamp(session.date).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric', timeZone: 'Asia/Kolkata' }),
      value: Math.round(volume),
    } : null;
  }).filter(Boolean).sort((a, b) => parseWorkoutTimestamp(a.date).getTime() - parseWorkoutTimestamp(b.date).getTime());
  const firstRangeDate = indiaDateString(new Date(workoutCutoff));
  const weeklyBuckets = new Map();
  for (let offset = 0; offset < days; offset += 1) {
    const date = addCalendarDays(firstRangeDate, offset);
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
    const weekStart = addCalendarDays(date, -((weekday + 6) % 7));
    const bucket = weeklyBuckets.get(weekStart) || { weekStart, rangeDays: 0, sessions: 0 };
    bucket.rangeDays += 1;
    weeklyBuckets.set(weekStart, bucket);
  }
  inRangeSessions.forEach(session => {
    const date = indiaDateString(parseWorkoutTimestamp(session.date));
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
    const weekStart = addCalendarDays(date, -((weekday + 6) % 7));
    const bucket = weeklyBuckets.get(weekStart);
    if (bucket) bucket.sessions += 1;
  });
  const weeklyTrainingPoints = [...weeklyBuckets.values()].sort((a, b) => a.weekStart.localeCompare(b.weekStart)).map(bucket => ({
    date: bucket.weekStart,
    label: `Wk ${new Date(`${bucket.weekStart}T00:00:00Z`).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric', timeZone: 'UTC' })}`,
    value: bucket.sessions,
  }));
  const muscleVolumeByGroup = new Map();
  inRangeSessions.forEach(session => (session.sets || []).forEach(set => {
    if (Number(set.reps) <= 0 || !set.muscle_group) return;
    const group = muscleVolumeByGroup.get(set.muscle_group) || { muscle_group: set.muscle_group, sets: 0, reps: 0, loadVolume: 0, loadedSets: 0 };
    const reps = Number(set.reps);
    group.sets += 1;
    group.reps += reps;
    if (set.weight != null && Number.isFinite(Number(set.weight))) {
      group.loadVolume += Number(set.weight) * reps;
      group.loadedSets += 1;
    }
    muscleVolumeByGroup.set(set.muscle_group, group);
  }));
  const muscleVolumeRows = [...muscleVolumeByGroup.values()].sort((a, b) => b.sets - a.sets || a.muscle_group.localeCompare(b.muscle_group));
  const maxMuscleSets = Math.max(1, ...muscleVolumeRows.map(group => group.sets));
  const todayIst = indiaDateString();
  const dateOrdinal = dateString => {
    const [year, month, day] = dateString.split('-').map(Number);
    return Date.UTC(year, month - 1, day) / 86400000;
  };
  const recoveryGroups = new Map();
  const recentWorkoutCutoff = istRangeStart(7);
  sessions.forEach(session => {
    const timestamp = parseWorkoutTimestamp(session.date);
    const time = timestamp.getTime();
    if (!Number.isFinite(time) || time > Date.now()) return;
    const sessionDate = indiaDateString(timestamp);
    (session.sets || []).forEach(set => {
      if (Number(set.reps) <= 0 || !set.muscle_group) return;
      const group = recoveryGroups.get(set.muscle_group) || { muscle_group: set.muscle_group, lastTime: 0, lastDate: '', setsLast7Days: 0 };
      if (time > group.lastTime) {
        group.lastTime = time;
        group.lastDate = sessionDate;
      }
      if (time >= recentWorkoutCutoff) group.setsLast7Days += 1;
      recoveryGroups.set(set.muscle_group, group);
    });
  });
  const recoveryRows = [...recoveryGroups.values()]
    .map(group => ({ ...group, daysAgo: Math.max(0, dateOrdinal(todayIst) - dateOrdinal(group.lastDate)) }))
    .sort((a, b) => a.daysAgo - b.daysAgo || a.muscle_group.localeCompare(b.muscle_group));

  return (
    <div className="insights-page min-w-0 space-y-8">
      <div className="insights-page-heading flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="section-heading"><p className="text-xs font-bold uppercase tracking-[.22em] text-green-600">Patterns over time</p><h2 className="mt-2 text-3xl font-extrabold tracking-tight">Your insights</h2><p className="mt-2 text-sm text-slate-400">Nutrition, weigh-ins and workouts from your local logs, grouped by India Standard Time.</p></div>
        <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Look back
          <select value={days} onChange={event => onDaysChange(Number(event.target.value))} className="ml-3 rounded-xl border border-slate-200 px-3 py-2 text-sm normal-case">
            <option value={7}>7 days</option><option value={30}>30 days</option><option value={90}>90 days</option>
          </select>
        </label>
      </div>

      {loading ? <div className="glass-card animate-pulse p-10 text-center text-sm text-slate-400">Gathering your recent activity…</div> : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <div className="glass-card p-5"><p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Average logged calories</p><p className="mt-3 text-3xl font-extrabold text-orange-300">{summary.average_calories || 0}<span className="ml-2 text-xs text-slate-500">kcal/day</span></p><p className="mt-2 text-xs text-slate-500">Across {summary.logged_days || 0} logged days</p></div>
            <div className="glass-card p-5"><p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Calorie target</p><p className="mt-3 text-3xl font-extrabold text-emerald-300">{summary.calorie_target || 0}<span className="ml-2 text-xs text-slate-500">kcal/day</span></p><p className="mt-2 text-xs text-slate-500">Set from your Profile</p></div>
            <div className="glass-card p-5"><p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Goal days</p><p className="mt-3 text-3xl font-extrabold">{summary.goal_days || 0}<span className="ml-2 text-xs text-slate-500">/ {summary.logged_days || 0}</span></p><p className="mt-2 text-xs text-slate-500">{summary.goal_label || 'Log nutrition to track your goal'}</p></div>
            <div className="glass-card p-5"><p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Workouts</p><p className="mt-3 text-3xl font-extrabold text-rose-300">{summary.workout_minutes || 0}<span className="ml-2 text-xs text-slate-500">minutes</span></p><p className="mt-2 text-xs text-slate-500">{summary.workout_count || 0} sessions in this period</p></div>
          </div>

          <section className="glass-card p-5 md:p-7">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><h3 className="text-lg font-extrabold">Calories by day</h3><p className="mt-1 text-xs text-slate-500">The line marks your current profile target. Empty days are not counted as zero intake.</p></div><span className="text-xs font-semibold text-orange-300">Orange bars · intake</span></div>
            {caloriesLogged ? <div className="w-full overflow-x-auto"><svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="min-w-[640px] w-full" role="img" aria-label="Daily calories compared with your target">
              <title>Daily calories compared with your calorie target</title>
              {[0, 0.5, 1].map(tick => { const y = chartTop + plotHeight * tick; return <g key={tick}><line x1={chartLeft} x2={chartWidth - chartRight} y1={y} y2={y} stroke="rgba(255,255,255,.09)"/><text x={chartLeft - 8} y={y + 4} textAnchor="end" fill="#8490AA" fontSize="10">{Math.round(calorieMaximum * (1 - tick))}</text></g>; })}
              {summary.calorie_target > 0 && <><line x1={chartLeft} x2={chartWidth - chartRight} y1={calorieY(summary.calorie_target)} y2={calorieY(summary.calorie_target)} stroke="#FBBF24" strokeWidth="2" strokeDasharray="6 5"/><text x={chartWidth - chartRight} y={calorieY(summary.calorie_target) - 7} textAnchor="end" fill="#FBBF24" fontSize="10">Target {summary.calorie_target}</text></>}
              {daily.map((day, index) => {
                const width = Math.max(3, barStep * 0.58);
                const height = day.calories > 0 ? Math.max(2, chartTop + plotHeight - calorieY(day.calories)) : 0;
                const x = chartLeft + index * barStep + (barStep - width) / 2;
                const label = days > 14 ? day.date.slice(8) : day.day;
                return <g key={day.date}><rect x={x} y={chartTop + plotHeight - height} width={width} height={height} rx="4" fill={day.calories ? 'url(#calorieBar)' : 'transparent'} opacity=".92"><title>{day.date}: {day.calories ? `${Math.round(day.calories)} kcal` : 'no food logged'}</title></rect>{index % labelEvery === 0 && <text x={x + width / 2} y={chartHeight - 10} textAnchor="middle" fill="#8490AA" fontSize="9">{label}</text>}</g>;
              })}
              <defs><linearGradient id="calorieBar" x1="0" x2="0" y1="0" y2="1"><stop stopColor="#FFB36B"/><stop offset="1" stopColor="#FF765D"/></linearGradient></defs>
            </svg></div> : <p className="rounded-xl bg-slate-900/40 p-8 text-center text-sm text-slate-400">No food entries in this period yet. Log meals on Home to start the trend.</p>}
          </section>

          <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(280px,.8fr)]">
            <section className="glass-card min-w-0 p-5 md:p-7">
              <div className="mb-5 flex items-end justify-between gap-3"><div><h3 className="text-lg font-extrabold">Weight trend</h3><p className="mt-1 text-xs text-slate-500">Only days with a weigh-in are plotted.</p></div>{summary.weight_change_kg != null && <span className={`text-sm font-extrabold ${summary.weight_change_kg <= 0 ? 'text-emerald-300' : 'text-amber-300'}`}>{summary.weight_change_kg > 0 ? '+' : ''}{summary.weight_change_kg.toFixed(1)} kg</span>}</div>
              {weightPoints.length > 0 ? <div className="w-full min-w-0 overflow-x-auto"><svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="min-w-[540px] w-full" role="img" aria-label="Weight trend from recorded weigh-ins">
                <title>Weight trend</title>
                {[0, 0.5, 1].map(tick => { const y = chartTop + plotHeight * tick; const value = weightMax - ((weightMax - weightMin) * tick); return <g key={tick}><line x1={chartLeft} x2={chartWidth - chartRight} y1={y} y2={y} stroke="rgba(255,255,255,.09)"/><text x={chartLeft - 8} y={y + 4} textAnchor="end" fill="#8490AA" fontSize="10">{value.toFixed(1)}</text></g>; })}
                <polyline points={weightPoints.map(point => `${point.x},${point.y}`).join(' ')} fill="none" stroke="#E879F9" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round"/>
                {weightPoints.map(point => <g key={`${point.item.date}-${point.x}`}><circle cx={point.x} cy={point.y} r="5" fill="#E879F9" stroke="#070B14" strokeWidth="2"><title>{point.item.date}: {point.item.weight_kg} kg</title></circle></g>)}
                {daily.map((day, index) => index % labelEvery === 0 && <text key={day.date} x={chartLeft + index * barStep + barStep / 2} y={chartHeight - 10} textAnchor="middle" fill="#8490AA" fontSize="9">{days > 14 ? day.date.slice(8) : day.day}</text>)}
              </svg></div> : <p className="rounded-xl bg-slate-900/40 p-8 text-center text-sm text-slate-400">Log a weigh-in on Home to start your weight trend.</p>}
            </section>

            <section className="glass-card min-w-0 p-5 md:p-7">
              <h3 className="text-lg font-extrabold">Daily check-in</h3><p className="mt-1 text-xs text-slate-500">Recent days · IST</p>
              <div className="mt-4 max-h-[330px] space-y-2 overflow-y-auto pr-1">
                {[...daily].reverse().map(day => <div key={day.date} className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-slate-900/30 px-3 py-3">
                  <div className="min-w-0"><p className="text-xs font-bold">{new Date(`${day.date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</p><p className="mt-1 truncate text-[10px] text-slate-500">{[day.workout_count ? `${day.workout_count} workout · ${day.workout_minutes} min` : null, day.water_ml ? `${(day.water_ml / 1000).toFixed(1)} L water` : null, day.weight_kg ? `${Number(day.weight_kg).toFixed(1)} kg` : null].filter(Boolean).join(' · ') || 'No activity logged'}</p></div>
                  <span className="shrink-0 text-xs font-extrabold text-orange-300">{day.calories ? `${Math.round(day.calories)} kcal` : '—'}</span>
                </div>)}
              </div>
              <div className="mt-4 rounded-xl bg-slate-900/40 p-4"><p className="text-[10px] uppercase tracking-wider text-slate-500">Average water on logged days</p><p className="mt-1 text-lg font-extrabold text-cyan-300">{summary.average_water_ml ? `${(summary.average_water_ml / 1000).toFixed(2)} L/day` : 'No water logs yet'}</p></div>
            </section>
          </div>

          <section className="glass-card workout-progress-section p-5 md:p-7">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div><p className="text-xs font-bold uppercase tracking-[.18em] text-emerald-300">Strength tracking</p><h3 className="mt-1 text-lg font-extrabold">Exercise progress</h3><p className="mt-1 text-xs text-slate-500">Best logged load and reps for each session in the selected period.</p></div>
              {exerciseOptions.length > 0 && <label className="text-xs font-bold text-slate-500">Exercise
                <select value={selectedExercise?.id || ''} onChange={event => setSelectedExerciseId(event.target.value)} className="mt-1 block min-w-56 rounded-xl border border-slate-200 px-3 py-2 text-sm">
                  {exerciseOptions.map(exercise => <option key={exercise.id} value={exercise.id}>{exercise.name}</option>)}
                </select>
              </label>}
            </div>
            {!exerciseOptions.length ? <p className="rounded-xl bg-slate-900/40 p-8 text-center text-sm text-slate-400">No completed exercise sets in this period yet. Finish a tracked workout to see your progress here.</p> : (
              <>
                <div className="workout-pr-grid">
                  <article><span>All-time load PR</span><strong>{selectedPersonalRecord?.best_load_kg != null ? `${selectedPersonalRecord.best_load_kg} kg` : '—'}</strong><p>{selectedPersonalRecord?.best_load_date ? `Logged ${parseWorkoutTimestamp(selectedPersonalRecord.best_load_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Kolkata' })}` : 'No external load recorded yet'}</p></article>
                  <article><span>All-time rep PR</span><strong>{selectedPersonalRecord?.best_reps != null ? `${selectedPersonalRecord.best_reps} reps` : '—'}</strong><p>{selectedPersonalRecord?.best_reps_date ? `Logged ${parseWorkoutTimestamp(selectedPersonalRecord.best_reps_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Kolkata' })}` : 'No completed rep sets recorded yet'}</p></article>
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  <WorkoutProgressChart title="Best logged load" points={loadProgressPoints} color="#38BDF8" unit="kg" emptyMessage="No external load recorded for this exercise. Reps are charted alongside." />
                  <WorkoutProgressChart title="Best set reps" points={repProgressPoints} color="#34F5C5" unit="reps" emptyMessage="No completed reps recorded for this exercise in this period." />
                </div>
              </>
            )}
            <div className="mt-5"><div className="mb-2"><h4 className="text-sm font-extrabold">Loaded workout volume</h4><p className="mt-1 text-xs text-slate-500">Total reps × logged load per session · bodyweight-only sets are excluded.</p></div><WorkoutProgressChart title="Volume by workout" points={workoutVolumePoints} color="#A78BFA" unit="kg × reps" emptyMessage="Log reps and load for weighted sets to see session volume." /></div>
          </section>

          <section className="glass-card workout-balance-section p-5 md:p-7">
            <div className="mb-5"><p className="text-xs font-bold uppercase tracking-[.18em] text-sky-300">Training rhythm</p><h3 className="mt-1 text-lg font-extrabold">Weekly frequency and muscle volume</h3><p className="mt-1 text-xs text-slate-500">Completed sessions and logged work sets in the selected period.</p></div>
            <div className="grid gap-4 xl:grid-cols-2">
              <WorkoutProgressChart title="Sessions per calendar week" points={weeklyTrainingPoints} color="#FBBF24" unit="sessions" emptyMessage="Complete a tracked workout to build your weekly frequency view." />
              <div className="workout-muscle-volume-card">
                <div className="workout-progress-card-heading"><h4>Completed sets by muscle</h4><span>SET VOLUME</span></div>
                {muscleVolumeRows.length ? <div className="workout-muscle-volume-list">
                  {muscleVolumeRows.map(group => <div key={group.muscle_group} className="workout-muscle-volume-row">
                    <div className="workout-muscle-volume-main"><div className="workout-muscle-volume-label"><b>{group.muscle_group}</b><span>{group.sets} {group.sets === 1 ? 'set' : 'sets'} · {group.reps} reps</span></div><div className="workout-muscle-volume-track"><span style={{ width: `${Math.max(6, (group.sets / maxMuscleSets) * 100)}%` }} /></div></div>
                    <small>{group.loadedSets ? `${Math.round(group.loadVolume).toLocaleString()} kg × reps · ${group.loadedSets} loaded ${group.loadedSets === 1 ? 'set' : 'sets'}` : 'Bodyweight'}</small>
                  </div>)}
                </div> : <p className="workout-progress-empty">Logged exercise sets will appear here by muscle group.</p>}
              </div>
            </div>
          </section>

          <section className="glass-card muscle-recovery-section p-5 md:p-7">
            <div className="mb-5"><p className="text-xs font-bold uppercase tracking-[.18em] text-cyan-300">Based on your logs</p><h3 className="mt-1 text-lg font-extrabold">Muscle training recency</h3><p className="mt-1 text-xs text-slate-500">See when each muscle group was last trained and its logged sets over the past 7 days.</p></div>
            {recoveryRows.length ? <>
              <div className="muscle-recovery-list">
                {recoveryRows.map(group => <article key={group.muscle_group} className="muscle-recovery-row">
                  <div className="muscle-recovery-copy"><strong>{group.muscle_group}</strong><span>{group.daysAgo === 0 ? 'Trained today' : group.daysAgo === 1 ? 'Last trained yesterday' : `Last trained ${group.daysAgo} days ago`}</span></div>
                  <div className="muscle-recovery-meta"><span className={`muscle-recency-badge ${group.daysAgo <= 1 ? 'is-recent' : 'is-rested'}`}>{group.daysAgo <= 1 ? 'Recent' : 'No recent session'}</span><small>{group.setsLast7Days} {group.setsLast7Days === 1 ? 'set' : 'sets'} · 7 days</small></div>
                </article>)}
              </div>
              <p className="muscle-recovery-note"><Info size={14} aria-hidden="true" />Training recency is only a log summary; it can’t measure soreness, recovery, or readiness.</p>
            </> : <p className="workout-progress-empty">Complete a tracked workout with exercise sets to see muscle-specific training recency.</p>}
          </section>
        </>
      )}
    </div>
  );
}

const ProfileField = ({ label, children, hint }) => (
  <label className="block space-y-2 text-xs font-bold uppercase tracking-wide text-slate-400">
    <span>{label}</span>
    {children}
    {hint && <span className="block normal-case font-medium tracking-normal text-slate-500">{hint}</span>}
  </label>
);

function DailyTrackingEntries({ kind, entries = [], editingId, editValue, setEditValue, onStartEdit, onCancelEdit, onSaveEdit, onDelete }) {
  if (!entries.length) return null;
  const isWeight = kind === 'weight';
  const title = isWeight ? 'Weigh-ins for this date' : 'Water entries for this date';
  return (
    <div className="tracking-log-list" aria-label={title}>
      <p className="tracking-log-heading">{title}</p>
      {entries.map(entry => <div key={entry.id} className="tracking-log-row">
        {editingId === entry.id ? <>
          <input
            aria-label={isWeight ? 'Edit weight in kilograms' : 'Edit water amount in milliliters'}
            type="number" min={isWeight ? '1' : '1'} max={isWeight ? '700' : '5000'}
            step={isWeight ? '0.1' : '1'} value={editValue}
            onChange={event => setEditValue(event.target.value)}
            className="tracking-log-edit-input"
          />
          <span className="tracking-log-unit">{isWeight ? 'kg' : 'ml'}</span>
          <button type="button" onClick={() => onSaveEdit(entry.id)} className="tracking-entry-action is-save" aria-label="Save change"><Check size={16} /></button>
          <button type="button" onClick={onCancelEdit} className="tracking-entry-action" aria-label="Cancel edit"><X size={16} /></button>
        </> : <>
          <div className="tracking-log-description"><strong>{isWeight ? `${Number(entry.weight_kg).toFixed(1)} kg` : `${entry.amount_ml} ml`}</strong><span>{formatTrackingTime(entry.timestamp)}</span></div>
          <button type="button" onClick={() => onStartEdit(entry)} className="tracking-entry-action tracking-entry-edit">Edit</button>
          {!isWeight && onDelete && <button type="button" onClick={() => onDelete(entry.id)} className="tracking-entry-action tracking-entry-delete" aria-label={`Delete ${entry.amount_ml} ml water entry`}><Trash2 size={15} /></button>}
        </>}
      </div>)}
    </div>
  );
}

function AIStatusIndicator({ status, loading, onRefresh }) {
  const statusKey = loading ? 'checking' : status?.status || 'unknown';
  const message = loading ? 'Checking local AI…' : status?.message || 'Ollama status has not been checked.';
  return (
    <div className={`ai-status-indicator is-${statusKey}`} role="status" aria-live="polite">
      <span className="ai-status-dot" aria-hidden="true" />
      <div className="ai-status-copy">
        <strong>{message}</strong>
        {status?.model_name && <span>Configured model · {status.model_name}</span>}
        {statusKey === 'api_unreachable' && <span>The LocalHealth API could not be reached.</span>}
      </div>
      <button type="button" onClick={onRefresh} disabled={loading} className="ai-status-refresh">Refresh</button>
    </div>
  );
}

function MealPlannerPanel({ profile, plan, loading, saving, onGenerate, onSwap, onAdjustPortion, onLogMeal }) {
  const [showGroceries, setShowGroceries] = useState(false);
  const [swapSelections, setSwapSelections] = useState({});
  const profileMealTimes = { Breakfast: profile.breakfast_time, Lunch: profile.lunch_time, Snack: profile.snack_time, Dinner: profile.dinner_time };
  const staleSchedule = plan && Object.entries(profileMealTimes).some(([meal, value]) => plan.meal_times?.[meal] && plan.meal_times[meal] !== String(value || '').slice(0, 5));
  const stalePlan = plan && (plan.diet_type !== profile.diet_type || Number(plan.daily_target_calories) !== Number(profile.calorie_target) || staleSchedule);

  useEffect(() => { setSwapSelections({}); }, [plan?.updated_at, plan?.id]);

  return (
    <details className="glass-card profile-accordion meal-planner-accordion">
      <summary className="profile-accordion-summary">
        <div><p className="text-xs font-bold uppercase tracking-[.18em] text-green-500">Meal planner · 7 days</p><h3 className="mt-1 text-lg font-extrabold">Meals and grocery list</h3><p className="mt-1 text-xs text-slate-500">{plan ? `${plan.diet_type} · ${plan.daily_target_calories} kcal/day target` : 'Build a week from your goal, diet, and meal times.'}</p></div>
        <ChevronDown size={19} className="profile-accordion-chevron" />
      </summary>
      <div className="profile-accordion-content space-y-5">
        {loading ? (
          <div className="animate-pulse rounded-xl bg-slate-700/30 p-8 text-center text-sm text-slate-400">Loading your saved meals…</div>
        ) : !plan ? (
          <div className="rounded-xl bg-slate-900/40 p-5">
            <p className="text-sm text-slate-300">Create a seven-day meal plan using foods in your local catalog. You can swap meals and get one combined grocery list.</p>
            <button type="button" onClick={onGenerate} disabled={saving} className="btn btn-today mt-4 rounded-xl px-5 py-3 text-sm font-extrabold disabled:opacity-60">{saving ? 'Building your meal plan…' : 'Create my meal plan'}</button>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><p className="text-sm font-bold">{plan.start_date} to {plan.end_date} · IST</p><p className="mt-1 text-xs text-slate-500">Meals use catalog nutrition and portion estimates. Adjust portions to match your appetite.</p></div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setShowGroceries(value => !value)} className="rounded-xl border border-white/10 px-4 py-2 text-xs font-bold text-emerald-300">{showGroceries ? 'Hide grocery list' : `Grocery list · ${plan.grocery_list?.length || 0} items`}</button>
                <button type="button" onClick={onGenerate} disabled={saving} className="rounded-xl border border-white/10 px-4 py-2 text-xs font-bold text-slate-300 disabled:opacity-60">{saving ? 'Updating…' : 'Regenerate week'}</button>
              </div>
            </div>

            {stalePlan && <p className="rounded-xl border border-amber-400/20 bg-amber-400/10 p-3 text-xs text-amber-200">Your Profile goal or diet preference has changed since this plan was created. Regenerate it to apply the new settings.</p>}

            {showGroceries && <section className="rounded-2xl border border-white/10 bg-slate-950/30 p-4 sm:p-5">
              <div className="mb-4"><h4 className="font-extrabold">Consolidated grocery list</h4><p className="mt-1 text-xs text-slate-500">Amounts combine ingredients across all seven days.</p></div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[...new Set((plan.grocery_list || []).map(item => item.category))].map(category => (
                  <div key={category}><p className="mb-2 text-[10px] font-extrabold uppercase tracking-wider text-slate-500">{category}</p><ul className="space-y-2">{plan.grocery_list.filter(item => item.category === category).map(item => <li key={`${category}-${item.name}-${item.unit}`} className="flex items-center justify-between gap-3 rounded-lg bg-white/5 px-3 py-2 text-xs"><span>{item.name}</span><b className="shrink-0 text-emerald-300">{item.amount} {item.unit}</b></li>)}</ul></div>
                ))}
              </div>
            </section>}

            <div className="space-y-3">
              {plan.days?.map(day => <details key={day.date} open={day.date === plan.today} className="meal-plan-day rounded-2xl border border-white/10 bg-slate-950/25">
                <summary className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div><p className="font-extrabold">{day.day} <span className="ml-2 text-xs font-medium text-slate-500">{new Date(`${day.date}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span></p><p className="mt-1 text-xs text-slate-500">Target {day.target_calories} kcal · Planned {Math.round(day.totals.calories)} kcal · P {Math.round(day.totals.protein)} g</p></div>
                  <ChevronDown size={17} className="profile-accordion-chevron" />
                </summary>
                <div className="space-y-3 border-t border-white/5 p-3 sm:p-4">
                  {day.meals.map(meal => {
                    const key = `${day.date}-${meal.meal_type}`;
                    const selectedRecipe = swapSelections[key] || meal.recipe_id;
                    return <article key={meal.meal_type} className="rounded-xl border border-white/5 bg-white/[.025] p-3 sm:p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0"><p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-300">{meal.meal_type} · {meal.time}</p><h4 className="mt-1 font-bold">{meal.name}</h4><p className="mt-1 text-xs text-slate-500">{Math.round(meal.nutrition.calories)} kcal · P {meal.nutrition.protein} g · C {meal.nutrition.carbs} g · F {meal.nutrition.fats} g · Fiber {meal.nutrition.fiber} g</p></div>
                        <div className="flex flex-wrap items-center gap-2">{!meal.logged && <div className="flex items-center gap-1 rounded-lg border border-white/10 px-1 py-1"><button type="button" aria-label={`Reduce ${meal.meal_type.toLowerCase()} portion`} onClick={() => onAdjustPortion(day.date, meal.meal_type, Math.max(0.5, Number((meal.portion_factor - 0.1).toFixed(2))))} disabled={saving || meal.portion_factor <= 0.5} className="h-8 w-8 rounded-md text-slate-300 disabled:opacity-40">−</button><span className="min-w-12 text-center text-[10px] font-bold text-slate-400">{meal.portion_factor.toFixed(1)}×</span><button type="button" aria-label={`Increase ${meal.meal_type.toLowerCase()} portion`} onClick={() => onAdjustPortion(day.date, meal.meal_type, Math.min(2.5, Number((meal.portion_factor + 0.1).toFixed(2))))} disabled={saving || meal.portion_factor >= 2.5} className="h-8 w-8 rounded-md text-slate-300 disabled:opacity-40">+</button></div>}{meal.logged ? <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-[10px] font-extrabold text-emerald-300">Added to log</span> : day.date === plan.today ? <button type="button" onClick={() => onLogMeal(day.date, meal.meal_type)} disabled={saving} className="rounded-lg bg-emerald-500/15 px-3 py-2 text-xs font-bold text-emerald-300 disabled:opacity-50">Add to food log</button> : null}</div>
                      </div>
                      <details className="mt-3">
                        <summary className="text-xs font-semibold text-slate-400">Ingredients and portions</summary>
                        <ul className="mt-2 grid gap-1 text-xs text-slate-500 sm:grid-cols-2">{meal.ingredients.map(item => <li key={`${item.name}-${item.unit}`}>{item.amount} {item.unit} {item.name}</li>)}</ul>
                      </details>
                      {!meal.logged && (meal.swap_options?.length || 0) > 1 && <div className="mt-3 flex gap-2">
                      <select aria-label={`Choose a ${meal.meal_type.toLowerCase()} replacement`} value={selectedRecipe} onChange={event => setSwapSelections(previous => ({ ...previous, [key]: event.target.value }))} className="min-w-0 flex-1 rounded-lg border border-white/10 px-3 py-2 text-xs">{meal.swap_options.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}</select>
                        <button type="button" onClick={() => onSwap(day.date, meal.meal_type, selectedRecipe)} disabled={saving || selectedRecipe === meal.recipe_id} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-slate-300 disabled:opacity-40">Swap</button>
                      </div>}
                    </article>;
                  })}
                </div>
              </details>)}
            </div>
          </>
        )}
      </div>
    </details>
  );
}

function ProfileTab({ form, updateField, profile, weeklyPlan, planLoading, saving, onSave, onSuggestTimes, mealPlan, mealPlanLoading, mealPlanSaving, onGenerateMealPlan, onSwapMeal, onAdjustMealPortion, onLogPlannedMeal }) {
  const inputClass = 'w-full rounded-xl border border-slate-200 px-3 py-3 text-sm';
  const numberField = (name, label, props = {}) => (
    <ProfileField key={name} label={label}>
      <input className={inputClass} type="number" value={form[name]} onChange={event => updateField(name, event.target.value)} {...props} />
    </ProfileField>
  );
  const timeField = (name, label) => (
    <ProfileField key={name} label={label}>
      <input className={inputClass} type="time" value={form[name]} onChange={event => updateField(name, event.target.value)} />
    </ProfileField>
  );

  return (
    <div className="space-y-8">
      <div className="profile-page-heading flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="section-heading">
          <p className="text-xs font-bold uppercase tracking-[.22em] text-green-600">Personal health plan · IST</p>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight">Profile & routine</h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">Add your measurements, goal and usual schedule. The app uses them to estimate daily targets and shape a practical starter week.</p>
        </div>
        <button onClick={onSave} disabled={saving} className="btn btn-today rounded-xl px-6 py-3 text-sm font-extrabold disabled:opacity-60">
          {saving ? 'Saving profile…' : profile ? 'Save changes' : 'Build my plan'}
        </button>
      </div>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_.9fr]">
        <details open={!profile} className="glass-card profile-accordion">
          <summary className="profile-accordion-summary">
            <div><h3 className="text-lg font-extrabold">About you and your goal</h3><p className="mt-1 text-xs text-slate-500">{profile ? `${profile.age} years · ${Number(profile.height).toFixed(0)} cm · ${Number(profile.weight).toFixed(1)} kg · ${profile.goal}` : 'Add measurements and choose a goal to set up your plan.'}</p></div>
            <ChevronDown size={19} className="profile-accordion-chevron" />
          </summary>
          <div className="profile-accordion-content">
            <p className="mb-5 text-xs text-slate-500">Measurements are used for estimates only. Update your weight as it changes.</p>
            <div className="profile-fields-grid grid grid-cols-2 gap-4">
              {numberField('age', 'Age', { min: 18, max: 100, step: 1, placeholder: 'e.g. 30', required: true })}
              <ProfileField label="BMR formula input">
                <select className={inputClass} value={form.sex} onChange={event => updateField('sex', event.target.value)}>
                  <option value="male">Male</option><option value="female">Female</option>
                </select>
                <span className="block normal-case font-medium tracking-normal text-slate-500">Used only by the BMR estimate.</span>
              </ProfileField>
              {numberField('height', 'Height (cm)', { min: 101, max: 250, step: 0.1, placeholder: 'e.g. 170', required: true })}
              {numberField('weight', 'Current weight (kg)', { min: 30, max: 350, step: 0.1, placeholder: 'e.g. 72', required: true })}
              <ProfileField label="Goal">
                <select className={inputClass} value={form.goal} onChange={event => updateField('goal', event.target.value)}>
                  <option value="lose">Lose weight</option><option value="maintain">Maintain weight</option><option value="gain">Gain weight</option>
                </select>
              </ProfileField>
              {numberField('target_weight_kg', form.goal === 'lose' ? 'Target weight (kg) · required' : 'Target weight (kg) · optional', { min: 20, max: 350, step: 0.1, placeholder: form.goal === 'lose' ? 'Set your target' : 'Optional' })}
              <ProfileField label="Usual activity level">
                <select className={inputClass} value={form.activity_level} onChange={event => updateField('activity_level', event.target.value)}>
                  <option value="sedentary">Mostly sitting / desk work</option><option value="light">Light activity 1–3 days/week</option>
                  <option value="moderate">Moderate activity 3–5 days/week</option><option value="active">Hard exercise 6–7 days/week</option>
                  <option value="very_active">Very active job or training</option>
                </select>
              </ProfileField>
              <ProfileField label="Food preference">
                <select className={inputClass} value={form.diet_type} onChange={event => updateField('diet_type', event.target.value)}>
                  <option value="veg">Vegetarian</option><option value="eggetarian">Eggetarian</option><option value="non-veg">Non-vegetarian</option><option value="vegan">Vegan</option>
                </select>
              </ProfileField>
            </div>
          </div>
        </details>

        <details className="glass-card profile-accordion">
          <summary className="profile-accordion-summary">
            <div><h3 className="text-lg font-extrabold">Daily routine</h3><p className="mt-1 text-xs text-slate-500">Work {form.work_start_time}–{form.work_end_time} IST · Meals {form.breakfast_time}, {form.lunch_time}, {form.dinner_time}</p></div>
            <ChevronDown size={19} className="profile-accordion-chevron" />
          </summary>
          <div className="profile-accordion-content">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-slate-500">Edit your usual schedule. Times are in India Standard Time.</p><div className="flex items-center gap-2"><span className="rounded-full border border-green-400/20 bg-green-400/10 px-3 py-1 text-[10px] font-extrabold tracking-wider text-green-500">IST</span><button type="button" onClick={onSuggestTimes} className="rounded-lg border border-white/10 px-3 py-2 text-[11px] font-bold text-emerald-300">Suggest meal times</button></div></div>
            <div className="profile-fields-grid grid grid-cols-2 gap-4">
              {timeField('wake_time', 'Wake up')}
              {timeField('sleep_time', 'Bedtime')}
              {timeField('work_start_time', 'Work starts')}
              {timeField('work_end_time', 'Work ends')}
              {timeField('breakfast_time', 'Breakfast')}
              {timeField('lunch_time', 'Lunch')}
              {timeField('snack_time', 'Snack')}
              {timeField('dinner_time', 'Dinner')}
            </div>
            <p className="mt-5 rounded-xl bg-slate-900/40 p-4 text-xs leading-relaxed text-slate-400">Meal times update automatically when wake, work or bedtime changes. You can edit any meal time afterward; use “Suggest meal times” to apply the schedule again. Meal timing is flexible—adjust it to fit your appetite, work and culture.</p>
          </div>
        </details>
      </section>

      {profile ? (
        <>
          <section>
            <div className="mb-4 flex items-end justify-between gap-4"><div><h3 className="text-xl font-extrabold">Estimated daily targets</h3><p className="mt-1 text-xs text-slate-500">Recalculate by saving when your measurements or activity change.</p></div><span className="text-xs font-semibold text-slate-500">Starting estimates</span></div>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
              {[
                { label: 'BMR · resting estimate', value: profile.bmr, unit: 'kcal/day', tone: 'text-orange-300' },
                { label: 'Maintenance estimate', value: profile.maintenance_calories, unit: 'kcal/day', tone: 'text-sky-300' },
                { label: 'Daily goal target', value: profile.calorie_target, unit: 'kcal/day', tone: 'text-emerald-300' },
                { label: 'BMI · screening value', value: profile.bmi, unit: '', tone: 'text-amber-300' },
              ].map(metric => <div key={metric.label} className="glass-card p-5"><p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">{metric.label}</p><p className={`mt-3 text-3xl font-extrabold ${metric.tone}`}>{metric.value == null ? '—' : Number(metric.value).toFixed(metric.label.startsWith('BMI') ? 1 : 0)}<span className="ml-2 text-xs font-semibold text-slate-500">{metric.unit}</span></p></div>)}
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr]">
              <div className="glass-card p-5">
                <p className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Goal progress</p>
                <p className="mt-3 text-sm text-slate-300">Current <b className="text-white">{Number(profile.weight).toFixed(1)} kg</b>{profile.target_weight_kg ? <> → target <b className="text-white">{Number(profile.target_weight_kg).toFixed(1)} kg</b></> : ' · no target weight set'}{profile.weight_to_goal_kg != null && <> · <b className="text-emerald-300">{Number(profile.weight_to_goal_kg).toFixed(1)} kg</b> to goal</>}</p>
                <p className="mt-2 text-xs text-slate-500">{profile.goal === 'lose' ? `Estimated daily reduction from maintenance: ${profile.daily_deficit || 0} kcal.` : profile.goal === 'gain' ? 'Small estimated surplus above maintenance.' : 'Daily target is set to estimated maintenance.'}</p>
              </div>
              <div className="glass-card p-5">
                <p className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Starting macro targets</p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold"><span className="rounded-lg bg-emerald-400/10 px-3 py-2 text-emerald-300">Protein {Number(profile.protein_target || 0).toFixed(0)} g</span><span className="rounded-lg bg-sky-400/10 px-3 py-2 text-sky-300">Carbs {Number(profile.carb_target || 0).toFixed(0)} g</span><span className="rounded-lg bg-amber-400/10 px-3 py-2 text-amber-300">Fat {Number(profile.fat_target || 0).toFixed(0)} g</span></div>
                <p className="mt-2 text-xs text-slate-500">Approximate 25/45/30 calorie split; personal needs can differ.</p>
              </div>
            </div>
            <p className="mt-4 text-xs leading-relaxed text-slate-500">BMR uses the Mifflin–St Jeor equation; maintenance applies an activity multiplier. These are population-based estimates, not a diagnosis or a guaranteed rate of change. BMI is a screening measure and may not reflect body composition. For medical conditions, pregnancy, medication changes or a tailored target, work with a qualified clinician or dietitian.</p>
          </section>

          <details className="glass-card profile-accordion weekly-plan-accordion">
            <summary className="profile-accordion-summary">
              <div><p className="text-xs font-bold uppercase tracking-[.18em] text-green-500">Next 7 days · IST</p><h3 className="mt-1 text-lg font-extrabold">Your starter week</h3><p className="mt-1 text-xs text-slate-500">{weeklyPlan?.days?.[0]?.calories || profile.calorie_target} kcal/day · {weeklyPlan?.activity_summary?.strength_sessions ?? 2} strength sessions</p></div>
              <ChevronDown size={19} className="profile-accordion-chevron" />
            </summary>
            <div className="profile-accordion-content">
            {planLoading ? <div className="animate-pulse rounded-xl bg-slate-700/30 p-8 text-center text-sm text-slate-400">Building your week…</div> : weeklyPlan ? (
              <>
                <div className="mb-5 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl bg-slate-900/40 p-4"><p className="text-[10px] uppercase tracking-wider text-slate-500">Daily calorie target</p><p className="mt-1 text-lg font-extrabold text-emerald-300">{weeklyPlan.days?.[0]?.calories || 0} kcal</p></div>
                  <div className="rounded-xl bg-slate-900/40 p-4"><p className="text-[10px] uppercase tracking-wider text-slate-500">Planned aerobic activity</p><p className="mt-1 text-lg font-extrabold">{weeklyPlan.activity_summary.aerobic_minutes} min</p></div>
                  <div className="rounded-xl bg-slate-900/40 p-4"><p className="text-[10px] uppercase tracking-wider text-slate-500">Strength sessions</p><p className="mt-1 text-lg font-extrabold">{weeklyPlan.activity_summary.strength_sessions} days</p></div>
                </div>
                <div className="grid gap-3 lg:grid-cols-2">
                  {weeklyPlan.days?.map(day => <div key={day.date} className="flex flex-col justify-between gap-3 rounded-xl border border-white/10 bg-slate-900/30 p-4 sm:flex-row sm:items-center">
                    <div><p className="text-sm font-extrabold">{day.day} <span className="ml-2 text-xs font-medium text-slate-500">{new Date(`${day.date}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span></p><p className="mt-1 text-xs text-emerald-300">{day.activity}{day.aerobic_minutes ? ` · ${day.aerobic_minutes} min` : ''}{day.strength_minutes ? ` · ${day.strength_minutes} min strength` : ''}</p><p className="mt-1 text-xs text-slate-500">{day.focus}</p></div>
                    <span className="shrink-0 rounded-lg bg-white/5 px-3 py-2 text-xs font-bold">{day.calories} kcal</span>
                  </div>)}
                </div>
                <div className="mt-6 grid gap-5 lg:grid-cols-2">
                  <div><p className="mb-3 text-xs font-extrabold uppercase tracking-wider text-slate-500">Meal reminders</p><div className="flex flex-wrap gap-2">{weeklyPlan.meal_schedule?.filter(item => !['Wake', 'Sleep'].includes(item.meal)).map(item => <span key={item.meal} className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs"><b className="text-slate-200">{item.meal}</b><span className="ml-2 text-emerald-300">{item.time}</span></span>)}</div></div>
                  <div><p className="mb-3 text-xs font-extrabold uppercase tracking-wider text-slate-500">Work hours</p><p className="text-sm text-slate-300">{weeklyPlan.work_schedule.start}–{weeklyPlan.work_schedule.end} IST <span className="text-xs text-slate-500">· Wake {weeklyPlan.meal_schedule?.[0]?.time} · Sleep {weeklyPlan.meal_schedule?.at(-1)?.time}</span></p></div>
                </div>
              </>
            ) : <p className="rounded-xl bg-slate-900/40 p-6 text-sm text-slate-400">Save your profile to generate a personal seven-day routine and calorie schedule.</p>}
            </div>
          </details>
          <MealPlannerPanel
            profile={profile}
            plan={mealPlan}
            loading={mealPlanLoading}
            saving={mealPlanSaving}
            onGenerate={onGenerateMealPlan}
            onSwap={onSwapMeal}
            onAdjustPortion={onAdjustMealPortion}
            onLogMeal={onLogPlannedMeal}
          />
        </>
      ) : <div className="glass-card p-5 text-sm text-slate-400">Save your measurements and goal to calculate your starting targets and weekly plan.</div>}
    </div>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [profile, setProfile] = useState(null);
  const [logs, setLogs] = useState([]);
  const [summary, setSummary] = useState({ total_calories: 0, total_protein: 0, total_carbs: 0, total_fats: 0, total_fiber: 0, by_meal: {} });
  const [tracking, setTracking] = useState({ water_total_ml: 0, water_logs: [], weight_logs: [], latest_weight_kg: null });
  const [waterAmount, setWaterAmount] = useState('250');
  const [weightInput, setWeightInput] = useState('');
  const [editingWaterLogId, setEditingWaterLogId] = useState(null);
  const [waterEditValue, setWaterEditValue] = useState('');
  const [editingWeightLogId, setEditingWeightLogId] = useState(null);
  const [weightEditValue, setWeightEditValue] = useState('');
  const weightAccordionRef = useRef(null);
  const [input, setInput] = useState("");
  const [category, setCategory] = useState("nutrition");
  const [loading, setLoading] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [favoriteFoods, setFavoriteFoods] = useState([]);
  const [recentFoods, setRecentFoods] = useState([]);
  const [foodListMode, setFoodListMode] = useState('search');
  const [foodCollectionsLoading, setFoodCollectionsLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => indiaDateString());
  const [todayDate, setTodayDate] = useState(() => indiaDateString());
  const selectCalendarDate = value => {
    if (value) setSelectedDate(value > indiaDateString() ? indiaDateString() : value);
  };
  const moveSelectedDate = offset => {
    const nextDate = addCalendarDays(selectedDate, offset);
    setSelectedDate(nextDate > indiaDateString() ? indiaDateString() : nextDate);
  };
  const [profForm, setProfForm] = useState({ ...DEFAULT_PROFILE_FORM });
  const [profileDirty, setProfileDirty] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [weeklyPlan, setWeeklyPlan] = useState(null);
  const [weeklyPlanLoading, setWeeklyPlanLoading] = useState(false);
  const [mealPlan, setMealPlan] = useState(null);
  const [mealPlanLoading, setMealPlanLoading] = useState(false);
  const [mealPlanSaving, setMealPlanSaving] = useState(false);
  const [insightDays, setInsightDays] = useState(7);
  const [insightData, setInsightData] = useState(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [ollamaStatus, setOllamaStatus] = useState(null);
  const [ollamaStatusLoading, setOllamaStatusLoading] = useState(false);

  const [aiChips, setAiChips] = useState([]);
  const [isParsing, setIsParsing] = useState(false);

  const [chatMessages, setChatMessages] = useState([{ role: 'coach', text: "Hello! I'm your AI Health Coach. How can I help you today?" }]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatAbortRef = useRef(null);

  const [workoutPlan, setWorkoutPlan] = useState(null);
  const [newPlanExerciseId, setNewPlanExerciseId] = useState('');
  const [workoutLoading, setWorkoutLoading] = useState(false);
  const [workoutPrefs, setWorkoutPrefs] = useState({ equipment: 'Gym', duration: '45' });
  const [workoutFocus, setWorkoutFocus] = useState('');
  const [trainView, setTrainView] = useState('map');
  const [workoutTemplates, setWorkoutTemplates] = useState([]);
  const [exerciseLibrary, setExerciseLibrary] = useState([]);
  const [exerciseLoading, setExerciseLoading] = useState(false);
  const [exerciseQuery, setExerciseQuery] = useState('');
  const [exerciseGroup, setExerciseGroup] = useState('Any');
  const [exerciseEquipment, setExerciseEquipment] = useState('Any');
  const [selectedMuscle, setSelectedMuscle] = useState('Chest');
  const [workoutSessions, setWorkoutSessions] = useState([]);
  const [workoutRecords, setWorkoutRecords] = useState([]);
  const [activeWorkout, setActiveWorkout] = useState(null);
  const [workoutElapsed, setWorkoutElapsed] = useState(0);
  const [workoutSaving, setWorkoutSaving] = useState(false);

  const [showLogPage, setShowLogPage] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const fabLongPressTimerRef = useRef(null);
  const fabLongPressedRef = useRef(false);
  const [toast, setToast] = useState(null);
  const [foodMessages, setFoodMessages] = useState([]);
  const [foodContext, setFoodContext] = useState("");
  const [foodPendingQuestion, setFoodPendingQuestion] = useState(null);
  const [foodDrafts, setFoodDrafts] = useState([]);
  const [foodThinking, setFoodThinking] = useState(false);
  const [selectedMeal, setSelectedMeal] = useState('Snack');
  const [foodEntryMode, setFoodEntryMode] = useState('describe');
  const [selectedFood, setSelectedFood] = useState(null);
  const [foodServings, setFoodServings] = useState('1');
  const [manualEntryOpen, setManualEntryOpen] = useState(false);
  const [manualFood, setManualFood] = useState({ name: '', portion: '1 serving', calories: '', protein: '', carbs: '', fats: '', fiber: '' });

  const refreshOllamaStatus = useCallback(async () => {
    setOllamaStatusLoading(true);
    try {
      const response = await axios.get(`${API_BASE}/ai/status`, { timeout: 5000 });
      setOllamaStatus(response.data);
    } catch {
      setOllamaStatus({ status: 'api_unreachable', ollama_running: false, model_installed: false, model_loaded: false, message: 'Could not check the local AI service.' });
    } finally {
      setOllamaStatusLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab !== 'coach' && !showLogPage) return undefined;
    refreshOllamaStatus();
    const timer = setInterval(refreshOllamaStatus, 30_000);
    return () => clearInterval(timer);
  }, [activeTab, showLogPage, refreshOllamaStatus]);

  useEffect(() => {
    const timer = setInterval(() => {
      const currentToday = indiaDateString();
      if (currentToday !== todayDate) {
        setTodayDate(currentToday);
        setSelectedDate(current => current === todayDate ? currentToday : current > currentToday ? currentToday : current);
      }
    }, 60_000);
    return () => clearInterval(timer);
  }, [todayDate]);

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
      const [profRes, logsRes, sumRes, trackingRes] = await Promise.all([
        axios.get(`${API_BASE}/profile`),
        axios.get(`${API_BASE}/logs?date_filter=${dateStr}`),
        axios.get(`${API_BASE}/summary?date_filter=${dateStr}`),
        axios.get(`${API_BASE}/tracking/daily?date_filter=${dateStr}`)
      ]);
      setProfile(profRes.data);
      if (!profileDirty) setProfForm(profileToForm(profRes.data));
      setLogs(logsRes.data);
      setSummary(sumRes.data);
      setTracking(trackingRes.data);
    } catch (e) { console.error("Loading error", e); }
  };

  const generateMealPlan = async () => {
    setMealPlanSaving(true);
    try {
      const response = await axios.post(`${API_BASE}/meal-plans/generate`, {});
      setMealPlan(response.data);
      notify('Your seven-day meal plan and grocery list are ready.');
    } catch (e) {
      notify(e.response?.data?.detail || 'Could not build a meal plan. Check your Profile and food catalog.', 'error');
    } finally { setMealPlanSaving(false); }
  };

  const swapMealPlan = async (planDate, mealType, recipeId) => {
    if (!mealPlan?.id) return;
    setMealPlanSaving(true);
    try {
      const response = await axios.post(`${API_BASE}/meal-plans/${mealPlan.id}/swap`, {
        plan_date: planDate, meal_type: mealType, recipe_id: recipeId,
      });
      setMealPlan(response.data);
      notify(`${mealType} meal updated and grocery quantities recalculated.`);
    } catch (e) {
      notify(e.response?.data?.detail || 'Could not swap this meal.', 'error');
    } finally { setMealPlanSaving(false); }
  };

  const adjustMealPlanPortion = async (planDate, mealType, portionFactor) => {
    if (!mealPlan?.id) return;
    setMealPlanSaving(true);
    try {
      const response = await axios.post(`${API_BASE}/meal-plans/${mealPlan.id}/portion`, {
        plan_date: planDate, meal_type: mealType, portion_factor: portionFactor,
      });
      setMealPlan(response.data);
      notify(`${mealType} portion updated; nutrition and groceries recalculated.`);
    } catch (e) {
      notify(e.response?.data?.detail || 'Could not update this meal portion.', 'error');
    } finally { setMealPlanSaving(false); }
  };

  const logPlannedMeal = async (planDate, mealType) => {
    if (!mealPlan?.id) return;
    setMealPlanSaving(true);
    try {
      const response = await axios.post(`${API_BASE}/meal-plans/${mealPlan.id}/log`, {
        plan_date: planDate, meal_type: mealType,
      });
      setMealPlan(response.data.meal_plan);
      await loadAllData();
      notify(`${mealType} added to your food log.`);
    } catch (e) {
      notify(e.response?.data?.detail || 'Could not add this planned meal to your log.', 'error');
    } finally { setMealPlanSaving(false); }
  };

  const addWater = async (amount = Number(waterAmount)) => {
    try { await axios.post(`${API_BASE}/tracking/water`, { amount_ml: amount, logged_date: selectedDate }); await loadAllData(); notify(`${amount} ml water logged.`); }
    catch (e) { notify(e.response?.data?.detail || 'Could not log water.', 'error'); }
  };

  const addWeight = async () => {
    const value = Number(weightInput);
    if (!value || value <= 0) { notify('Enter a valid weight in kilograms.', 'error'); return; }
    try { await axios.post(`${API_BASE}/tracking/weight`, { weight_kg: value, logged_date: selectedDate }); setWeightInput(''); await loadAllData(); notify('Weight entry saved.'); }
    catch (e) { notify(e.response?.data?.detail || 'Could not save weight.', 'error'); }
  };

  const startFabLongPress = () => {
    fabLongPressedRef.current = false;
    clearTimeout(fabLongPressTimerRef.current);
    fabLongPressTimerRef.current = setTimeout(() => {
      fabLongPressedRef.current = true;
      setQuickAddOpen(true);
    }, 500);
  };

  const endFabLongPress = () => clearTimeout(fabLongPressTimerRef.current);

  const openQuickAddDefault = () => {
    if (fabLongPressedRef.current) {
      fabLongPressedRef.current = false;
      return;
    }
    setActiveTab('home');
    setQuickAddOpen(false);
    openFoodLogger();
  };

  const openFoodLogger = (meal = 'Snack') => {
    setSelectedMeal(meal);
    setFoodEntryMode('describe');
    setShowLogPage(true);
  };

  const runQuickAction = action => {
    setQuickAddOpen(false);
    if (action === 'food') {
      setActiveTab('home');
      openFoodLogger();
    } else if (action === 'water') {
      addWater(250);
    } else if (action === 'weight') {
      setActiveTab('home');
      setShowLogPage(false);
      window.setTimeout(() => {
        if (weightAccordionRef.current) weightAccordionRef.current.open = true;
        document.getElementById('home-weight-input')?.focus();
      }, 100);
    } else if (action === 'workout') {
      setActiveTab('train');
      setShowLogPage(false);
      setTrainView('planner');
    } else if (action === 'mood') {
      setActiveTab('coach');
      setShowLogPage(false);
      setChatInput('I would like to check in about how I am feeling today.');
    }
  };

  useEffect(() => {
    if (!quickAddOpen) return undefined;
    const closeOnEscape = event => { if (event.key === 'Escape') setQuickAddOpen(false); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [quickAddOpen]);

  const saveWaterEdit = async logId => {
    const amount = Number(waterEditValue);
    if (!Number.isInteger(amount) || amount < 1 || amount > 5000) { notify('Water amount must be between 1 and 5000 ml.', 'error'); return; }
    try {
      await axios.put(`${API_BASE}/tracking/water/${logId}`, { amount_ml: amount });
      setEditingWaterLogId(null);
      await loadAllData();
      notify('Water entry updated.');
    } catch (e) { notify(e.response?.data?.detail || 'Could not update this water entry.', 'error'); }
  };

  const deleteWaterLog = async logId => {
    if (!window.confirm('Delete this water entry?')) return;
    try {
      await axios.delete(`${API_BASE}/tracking/water/${logId}`);
      await loadAllData();
      notify('Water entry deleted.');
    } catch (e) { notify(e.response?.data?.detail || 'Could not delete this water entry.', 'error'); }
  };

  const saveWeightEdit = async logId => {
    const value = Number(weightEditValue);
    if (!value || value <= 0 || value > 700) { notify('Enter a weight between 1 and 700 kg.', 'error'); return; }
    try {
      await axios.put(`${API_BASE}/tracking/weight/${logId}`, { weight_kg: value });
      setEditingWeightLogId(null);
      await loadAllData();
      notify('Weigh-in updated.');
    } catch (e) { notify(e.response?.data?.detail || 'Could not update this weigh-in.', 'error'); }
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
    const context = foodContext.trim();
    setFoodMessages(prev => [...prev, { role: 'user', text: message }]);
    setInput('');
    setFoodThinking(true);
    setFoodDrafts([]);
    try {
      const res = await axios.post(`${API_BASE}/ai/food-draft`, {
        text: message,
        ...(context ? {
          context,
          clarification_type: foodPendingQuestion?.type,
          previous_question: foodPendingQuestion?.question,
        } : {}),
      });
      if (res.data.status === 'conversation') {
        setFoodContext('');
        setFoodPendingQuestion(null);
        setFoodDrafts([]);
        setFoodMessages(prev => [...prev, { role: 'assistant', text: res.data.reply || 'Hi! Tell me what you ate and roughly how much.' }]);
      } else if (res.data.status === 'clarification') {
        const question = res.data.question || 'What portion did you have? A size like mini, single, or one small bowl is enough.';
        setFoodContext(context || message);
        setFoodPendingQuestion({ type: res.data.clarification_type || 'missing_portion', question });
        const corrections = (res.data.corrections || []).map(item => `“${item.original}” → “${item.corrected}”`).join(', ');
        const correctionNote = corrections ? ` I read the spelling as ${corrections}.` : '';
        setFoodMessages(prev => [...prev, { role: 'assistant', text: `${question}${correctionNote}` }]);
      } else {
        setFoodContext('');
        setFoodPendingQuestion(null);
        const drafts = Array.isArray(res.data.items) && res.data.items.length ? res.data.items : [res.data];
        setFoodDrafts(drafts);
        const corrections = (res.data.corrections || []).map(item => `“${item.original}” → “${item.corrected}”`).join(', ');
        const correctionNote = corrections ? ` I corrected the spelling: ${corrections}.` : '';
        const responseText = drafts.length > 1
          ? `I separated your message into ${drafts.length} food entries. Review and save each item separately.${correctionNote}`
          : `I ${drafts[0].source === 'database' ? 'matched this to the local food catalog' : 'estimated the nutrition'} for ${drafts[0].food_description}. Review the values before saving.${correctionNote}`;
        setFoodMessages(prev => [...prev, { role: 'assistant', text: responseText }]);
      }
    } catch (e) {
      const detail = e.response?.data?.detail || 'I could not estimate that just now. Please try again.';
      setFoodDrafts([]);
      setFoodMessages(prev => [...prev, { role: 'assistant', text: detail }]);
      notify(detail, 'error');
    } finally { setFoodThinking(false); refreshOllamaStatus(); }
  };

  const saveFoodDraft = async draftIndex => {
    const foodDraft = foodDrafts[draftIndex];
    if (!foodDraft) return;
    const nutrientKeys = ['calories', 'protein', 'carbs', 'fats', 'fiber'];
    if (nutrientKeys.some(key => foodDraft[key] === '' || foodDraft[key] == null)) {
      notify('Fill in every nutrition value before saving.', 'error');
      return;
    }
    const nutrients = Object.fromEntries(nutrientKeys.map(key => [key, Number(foodDraft[key])]));
    if (Object.values(nutrients).some(value => !Number.isFinite(value) || value < 0) || nutrients.calories > 10000 || Object.entries(nutrients).some(([key, value]) => key !== 'calories' && value > 1000)) {
      notify('Enter valid nutrition values within the allowed ranges.', 'error');
      return;
    }
    if (!Object.values(nutrients).some(value => value > 0) || (foodDraft.source === 'AI-estimated' && nutrients.calories <= 0)) {
      notify('This estimate is empty. Add real nutrition values or try describing the portion again.', 'error');
      return;
    }
    setLoading(true);
    try {
      await axios.post(`${API_BASE}/logs`, {
        category: 'nutrition', note: foodDraft.food_description,
        source: foodDraft.source || 'AI-estimated',
        ...(foodDraft.source === 'database' && foodDraft.food_item_id ? { food_item_id: foodDraft.food_item_id } : {}),
        meal: selectedMeal,
        ...nutrients
      });
      await loadAllData();
      const remainingDrafts = foodDrafts.filter((_, index) => index !== draftIndex);
      setFoodDrafts(remainingDrafts);
      if (!remainingDrafts.length) {
        setFoodMessages([]);
        setFoodContext('');
        setFoodPendingQuestion(null);
        setAiChips([]);
      }
      notify(`${foodDraft.food_description} saved as its own food log.`);
    } catch (e) { notify(e.response?.data?.detail || 'Could not save the nutrition estimate.', 'error'); }
    finally { setLoading(false); }
  };

  const searchFood = async (q) => {
    setFoodListMode('search');
    setSearchQuery(q);
    if (q.length < 2) { setSearchResults([]); setSearchLoading(false); return; }
    setSearchLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/search-food?q=${encodeURIComponent(q)}`);
      setSearchResults(res.data);
    } catch (e) { console.error("Search error", e); notify('Food search is unavailable right now.', 'error'); }
    finally { setSearchLoading(false); }
  };

  const loadFoodCollections = async () => {
    setFoodCollectionsLoading(true);
    try {
      const [favoritesRes, recentRes] = await Promise.all([
        axios.get(`${API_BASE}/foods/favorites`),
        axios.get(`${API_BASE}/foods/recent`)
      ]);
      setFavoriteFoods(favoritesRes.data);
      setRecentFoods(recentRes.data);
    } catch (e) {
      console.error('Could not load favorite and recent foods:', e);
    } finally {
      setFoodCollectionsLoading(false);
    }
  };

  const toggleFoodFavorite = async (food, event) => {
    event.stopPropagation();
    const isFavorite = favoriteFoods.some(item => item.id === food.id);
    try {
      await axios.request({
        method: isFavorite ? 'delete' : 'put',
        url: `${API_BASE}/foods/${food.id}/favorite`
      });
      await loadFoodCollections();
      notify(isFavorite ? `${food.name} removed from favorites.` : `${food.name} added to favorites.`);
    } catch (e) {
      notify(e.response?.data?.detail || 'Could not update favorites.', 'error');
    }
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
        food_item_id: selectedFood.id,
        calories: Number(selectedFood.calories || 0) * servings,
        protein: Number(selectedFood.protein || 0) * servings,
        carbs: Number(selectedFood.carbs || 0) * servings,
        fats: Number(selectedFood.fats || 0) * servings,
        fiber: Number(selectedFood.fiber || 0) * servings
      });
      setSelectedFood(null);
      await loadAllData();
      await loadFoodCollections();
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

  const stopChat = () => chatAbortRef.current?.abort();

  const handleChat = async () => {
    const message = chatInput.trim();
    if (!message || chatLoading) return;
    const userMsg = { role: 'user', text: message };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput("");
    setChatLoading(true);
    const controller = new AbortController();
    chatAbortRef.current = controller;
    setChatMessages(prev => [...prev, { role: 'coach', text: '' }]);
    try {
      const response = await fetch(`${API_BASE}/coach/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: message }),
        signal: controller.signal
      });
      if (!response.ok || !response.body) throw new Error(`Coach request failed (${response.status})`);
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let complete = false;
      while (!complete) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';
        for (const event of events) {
          const data = event.split('\n').find(line => line.startsWith('data: '))?.slice(6);
          if (!data) continue;
          if (data === '[DONE]') { complete = true; break; }
          const payload = JSON.parse(data);
          if (payload.error) throw new Error(payload.error);
          if (payload.token) setChatMessages(prev => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last?.role === 'coach') next[next.length - 1] = { ...last, text: last.text + payload.token };
            return next;
          });
        }
      }
    } catch (e) {
      if (e.name === 'AbortError') {
        setChatMessages(prev => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last?.role === 'coach') next[next.length - 1] = { ...last, text: last.text || 'Response stopped.' };
          return next;
        });
      } else {
        setChatMessages(prev => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last?.role === 'coach') next[next.length - 1] = { ...last, role: 'error', text: e.message || 'Sorry, I could not connect to the coach. Please try again.' };
          return next;
        });
      }
    } finally {
      chatAbortRef.current = null;
      setChatLoading(false);
      refreshOllamaStatus();
    }
  };

  const generateWorkout = async () => {
    setWorkoutLoading(true);
    setWorkoutPlan(null);
    setNewPlanExerciseId('');
    try {
      const res = await axios.post(`${API_BASE}/workouts/plan`, { ...workoutPrefs, muscle_group: workoutFocus || null });
      setWorkoutPlan(res.data);
    } catch (e) {
      notify(e.response?.data?.detail || 'Failed to generate workout. Try again!', 'error');
    } finally {
      setWorkoutLoading(false);
    }
  };

  const buildFocusedWorkout = muscle => {
    const equipmentMap = { Any: 'Any', Bodyweight: 'None', Dumbbells: 'Dumbbells', Gym: 'Gym' };
    setWorkoutPrefs(current => ({ ...current, equipment: equipmentMap[exerciseEquipment] || 'Any' }));
    setWorkoutFocus(muscle === 'All muscles' ? '' : muscle);
    setWorkoutPlan(null);
    setTrainView('planner');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    notify(muscle === 'All muscles' ? 'Full-body workout is ready to configure.' : `${muscle} focus is ready for your AI workout.`, 'info');
  };

  const replacePlanExercise = (index, exerciseId) => {
    const replacement = exerciseLibrary.find(exercise => String(exercise.id) === String(exerciseId));
    if (!replacement || !workoutPlan) return;
    setWorkoutPlan(current => current ? {
      ...current,
      exercises: current.exercises.map((exercise, exerciseIndex) => exerciseIndex === index
        ? { ...exercise, exercise_id: replacement.id, name: replacement.name, instructions: replacement.instructions }
        : exercise)
    } : current);
    notify(`Replaced with ${replacement.name}.`, 'success');
  };

  const removePlanExercise = index => {
    if (!workoutPlan) return;
    if (workoutPlan.exercises.length <= 1) {
      notify('Keep at least one exercise in the workout.', 'info');
      return;
    }
    const removedName = workoutPlan.exercises[index]?.name;
    setWorkoutPlan(current => current ? { ...current, exercises: current.exercises.filter((_, exerciseIndex) => exerciseIndex !== index) } : current);
    notify(`${removedName || 'Exercise'} removed from the plan.`, 'info');
  };

  const addPlanExercise = () => {
    if (!workoutPlan || !newPlanExerciseId) return;
    const exercise = planExerciseOptions.find(item => String(item.id) === String(newPlanExerciseId));
    if (!exercise) return;
    if (workoutPlan.exercises.some(item => item.exercise_id === exercise.id)) {
      notify('That exercise is already in the plan.', 'info');
      return;
    }
    setWorkoutPlan(current => current ? {
      ...current,
      exercises: [...current.exercises, {
        exercise_id: exercise.id,
        name: exercise.name,
        sets: 3,
        reps: '8-12',
        rest: '60-90 sec',
        rpe: 6,
        instructions: exercise.instructions,
      }]
    } : current);
    setNewPlanExerciseId('');
    notify(`${exercise.name} added to the plan.`);
  };

  const saveProfile = async () => {
    if (profForm.goal === 'lose' && !profForm.target_weight_kg) {
      notify('Add a target weight below your current weight to build a loss plan.', 'error');
      return;
    }
    setProfileSaving(true);
    try {
      const payload = {
        ...profForm,
        age: Number(profForm.age),
        height: Number(profForm.height),
        weight: Number(profForm.weight),
        target_weight_kg: profForm.target_weight_kg === '' ? null : Number(profForm.target_weight_kg),
      };
      const response = await axios.post(`${API_BASE}/profile`, payload);
      setProfile(response.data);
      setProfForm(profileToForm(response.data));
      setProfileDirty(false);
      const planResponse = await axios.get(`${API_BASE}/profile/weekly-plan`);
      setWeeklyPlan(planResponse.data);
      await loadAllData();
      notify('Profile and weekly plan saved.');
    } catch (e) {
      const detail = e.response?.data?.detail;
      const message = Array.isArray(detail) ? detail.map(issue => issue.msg).join(' ') : detail;
      notify(message || 'Could not save your profile. Check the measurements and target weight.', 'error');
    } finally {
      setProfileSaving(false);
    }
  };

  const updateProfileField = (field, value) => {
    setProfForm(previous => {
      const next = { ...previous, [field]: value };
      if (['wake_time', 'work_start_time', 'work_end_time', 'sleep_time'].includes(field)) {
        return { ...next, ...suggestRoutineMealTimes(next) };
      }
      return next;
    });
    setProfileDirty(true);
  };

  const suggestProfileMealTimes = () => {
    setProfForm(previous => ({ ...previous, ...suggestRoutineMealTimes(previous) }));
    setProfileDirty(true);
  };

  const loadWorkoutData = async () => {
    setExerciseLoading(true);
    try {
      const [templatesRes, exercisesRes, sessionsRes] = await Promise.all([
        axios.get(`${API_BASE}/workouts/templates?equipment=${encodeURIComponent(workoutPrefs.equipment)}`),
        axios.get(`${API_BASE}/exercises`),
        axios.get(`${API_BASE}/workouts/sessions?limit=100`)
      ]);
      setWorkoutTemplates(templatesRes.data);
      setExerciseLibrary(exercisesRes.data);
      setWorkoutSessions(sessionsRes.data);
    } catch (e) {
      console.error('Workout data loading error:', e);
      notify('Could not load workout library.', 'error');
    } finally {
      setExerciseLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'train') loadWorkoutData();
  }, [activeTab, workoutPrefs.equipment]);

  useEffect(() => {
    if (activeTab !== 'profile' || !profile) return;
    let cancelled = false;
    setWeeklyPlanLoading(true);
    axios.get(`${API_BASE}/profile/weekly-plan`)
      .then(response => { if (!cancelled) setWeeklyPlan(response.data); })
      .catch(error => {
        if (!cancelled) {
          setWeeklyPlan(null);
          console.error('Weekly plan loading error:', error);
        }
      })
      .finally(() => { if (!cancelled) setWeeklyPlanLoading(false); });
    return () => { cancelled = true; };
  }, [activeTab, profile?.id, profile?.calorie_target]);

  useEffect(() => {
    if (activeTab !== 'profile' || !profile) return;
    let cancelled = false;
    setMealPlanLoading(true);
    axios.get(`${API_BASE}/meal-plans/current`)
      .then(response => { if (!cancelled) setMealPlan(response.data); })
      .catch(error => {
        if (!cancelled) {
          setMealPlan(null);
          console.error('Saved meal plan loading error:', error);
        }
      })
      .finally(() => { if (!cancelled) setMealPlanLoading(false); });
    return () => { cancelled = true; };
  }, [activeTab, profile?.id]);

  useEffect(() => {
    if (activeTab !== 'insights') return;
    let cancelled = false;
    setInsightsLoading(true);
    axios.get(`${API_BASE}/insights?days=${insightDays}`)
      .then(response => { if (!cancelled) setInsightData(response.data); })
      .catch(error => {
        if (!cancelled) {
          setInsightData(null);
          notify(error.response?.data?.detail || 'Could not load your insights.', 'error');
        }
      })
      .finally(() => { if (!cancelled) setInsightsLoading(false); });
    return () => { cancelled = true; };
  }, [activeTab, insightDays, profile?.id, profile?.calorie_target]);

  useEffect(() => {
    if (activeTab !== 'insights') return;
    let cancelled = false;
    axios.get(`${API_BASE}/workouts/sessions?limit=100`)
      .then(response => { if (!cancelled) setWorkoutSessions(response.data); })
      .catch(error => { if (!cancelled) console.error('Exercise progress loading error:', error); });
    axios.get(`${API_BASE}/workouts/records`)
      .then(response => { if (!cancelled) setWorkoutRecords(response.data); })
      .catch(error => { if (!cancelled) console.error('Personal record loading error:', error); });
    return () => { cancelled = true; };
  }, [activeTab]);

  const activeWorkoutStartedAt = activeWorkout?.startedAt;
  useEffect(() => {
    if (!activeWorkoutStartedAt) return undefined;
    const updateElapsed = () => setWorkoutElapsed(Math.floor((Date.now() - activeWorkoutStartedAt) / 1000));
    updateElapsed();
    const timer = setInterval(updateElapsed, 1000);
    return () => clearInterval(timer);
  }, [activeWorkoutStartedAt]);

  const startWorkout = (plan) => {
    if (!plan?.exercises?.length) {
      notify('This plan has no exercises to track.', 'error');
      return;
    }
    setActiveWorkout({
      workoutName: plan.workout_name,
      startedAt: Date.now(),
      exercises: plan.exercises.map(exercise => {
        const previousSession = workoutSessions.find(session => session.sets?.some(set => Number(set.exercise_id) === Number(exercise.exercise_id)));
        const previousSets = previousSession?.sets
          .filter(set => Number(set.exercise_id) === Number(exercise.exercise_id))
          .sort((left, right) => left.set_number - right.set_number) || [];
        return {
          ...exercise,
          previousWorkout: previousSession ? { date: previousSession.date, sets: previousSets } : null,
          completed: false,
          actualSets: Array.from({ length: Math.max(1, Math.min(Number(exercise.sets) || 1, 8)) }, () => ({ reps: '', weight: '', rpe: '' }))
        };
      })
    });
    setWorkoutElapsed(0);
    notify('Workout started. Log the reps and weight you complete.', 'info');
  };

  const updateWorkoutExercise = (exerciseIndex, patch) => {
    setActiveWorkout(current => ({
      ...current,
      exercises: current.exercises.map((exercise, index) => index === exerciseIndex ? { ...exercise, ...patch } : exercise)
    }));
  };

  const updateWorkoutSet = (exerciseIndex, setIndex, key, value) => {
    const exercise = activeWorkout?.exercises[exerciseIndex];
    if (!exercise) return;
    const actualSets = exercise.actualSets.map((set, index) => index === setIndex ? { ...set, [key]: value } : set);
    updateWorkoutExercise(exerciseIndex, { actualSets });
  };

  const completeWorkout = async () => {
    if (!activeWorkout || workoutSaving) return;
    const completed = activeWorkout.exercises.filter(exercise => exercise.completed);
    if (!completed.length) {
      notify('Mark at least one exercise complete before saving.', 'error');
      return;
    }
    const invalidSet = completed.some(exercise => exercise.actualSets.some(set => {
      if (set.reps !== '' && (!Number.isInteger(Number(set.reps)) || Number(set.reps) <= 0)) return true;
      if (set.weight !== '' && (!Number.isFinite(Number(set.weight)) || Number(set.weight) < 0)) return true;
      return set.rpe !== '' && (!Number.isInteger(Number(set.rpe)) || Number(set.rpe) < 1 || Number(set.rpe) > 10);
    }));
    if (invalidSet) {
      notify('Check set entries: reps must be whole numbers, load non-negative, and RPE from 1 to 10.', 'error');
      return;
    }
    const sets = completed.flatMap(exercise => exercise.actualSets
      .map((set, index) => ({ set, index }))
      .filter(({ set }) => set.reps !== '' && Number(set.reps) > 0)
      .map(({ set, index }) => ({
        exercise_id: exercise.exercise_id,
        set_number: index + 1,
        reps: Number(set.reps),
        weight: set.weight === '' ? null : Number(set.weight),
        rpe: set.rpe === '' ? null : Math.min(10, Math.max(1, Math.round(Number(set.rpe))))
      })));
    const duration = Math.max(1, Math.round((Date.now() - activeWorkout.startedAt) / 60000));
    setWorkoutSaving(true);
    try {
      await axios.post(`${API_BASE}/workouts/log`, {
        workout_type: activeWorkout.workoutName,
        duration_mins: duration,
        note: `Completed ${completed.length} of ${activeWorkout.exercises.length} planned exercises.`,
        sets
      });
      setActiveWorkout(null);
      await loadWorkoutData();
      notify('Workout saved to your history.');
    } catch (e) {
      notify(e.response?.data?.detail || 'Could not save the workout.', 'error');
    } finally {
      setWorkoutSaving(false);
    }
  };

  const discardWorkout = () => {
    setActiveWorkout(null);
    setWorkoutElapsed(0);
    notify('Workout session discarded.', 'info');
  };

  const foodRows = foodListMode === 'favorites'
    ? favoriteFoods
    : foodListMode === 'recent'
      ? recentFoods
      : searchResults;

  const foodLogs = logs.filter(log => log.category === 'nutrition');
  const foodLogsByMeal = foodLogs.reduce((groups, log) => {
    const meal = ['Breakfast', 'Lunch', 'Dinner', 'Snack'].includes(log.meal) ? log.meal : 'Snack';
    if (!groups[meal]) groups[meal] = [];
    groups[meal].push(log);
    return groups;
  }, {});
  const mealLogOrder = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
  const filteredExercises = exerciseLibrary.filter(exercise => {
    const matchesQuery = !exerciseQuery || `${exercise.name} ${exercise.instructions} ${exercise.muscle_group}`.toLowerCase().includes(exerciseQuery.toLowerCase());
    return matchesQuery && (exerciseGroup === 'Any' || exercise.muscle_group === exerciseGroup);
  });
  const planEquipment = workoutPlan?.equipment || workoutPrefs.equipment;
  const planEquipmentOptions = {
    Any: ['Gym', 'Dumbbells', 'Home', 'None'],
    Gym: ['Gym', 'Dumbbells', 'Home', 'None'],
    Home: ['Home', 'None'],
    Dumbbells: ['Dumbbells', 'Home', 'None'],
    None: ['None', 'Home'],
  }[planEquipment] || ['Gym', 'Dumbbells', 'Home', 'None'];
  const planFocusGroup = workoutPlan?.muscle_group || workoutFocus;
  const planExerciseOptions = exerciseLibrary.filter(exercise =>
    planEquipmentOptions.includes(exercise.equipment) && (!planFocusGroup || exercise.muscle_group === planFocusGroup)
  );

  useEffect(() => { loadFoodCollections(); }, []);

  return (
    <div className="app-shell min-h-screen bg-[#070B14] font-poppins text-slate-900">
      <header className="bg-white/70 backdrop-blur-md border-b border-slate-100 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between">
          <button type="button" aria-label="Open profile" className="group flex items-center gap-3 sm:gap-4 bg-transparent p-0 text-left shadow-none" onClick={() => { setActiveTab('profile'); setShowLogPage(false); }}>
            <img src="/brand-mark.svg" alt="LocalHealth Pro pulse rings logo" width="48" height="48" className="h-10 w-10 sm:h-12 sm:w-12 rounded-2xl shadow-lg transition-transform group-hover:scale-105 duration-300" />
            <div className="transition-opacity group-hover:opacity-80">
              <h1 className="text-base sm:text-xl font-extrabold text-slate-900 leading-tight tracking-tight">LocalHealth Pro</h1>
              <p className="max-w-[170px] truncate text-xs sm:text-sm text-slate-500 font-medium">{profile ? `Goal: ${profile.goal}` : "Setup Profile"}</p>
            </div>
          </button>
          <div className="flex items-center gap-4">
            <span className="hidden sm:inline-flex text-xs font-bold text-green-600 bg-green-100/50 px-4 py-1.5 rounded-full uppercase tracking-wider border border-green-200">Premium AI</span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-5 sm:py-8 lg:py-10 relative">
        <AnimatePresence mode="wait">
          {showLogPage ? (
            <motion.div 
              key="log-page"
              initial={{ opacity: 0, x: 20 }} 
              animate={{ opacity: 1, x: 0 }} 
              exit={{ opacity: 0, x: 20 }} 
              className="app-screen screen-food space-y-5"
            >
              <div className="food-log-page-heading">
                <button type="button" aria-label="Back to Home" onClick={() => setShowLogPage(false)} className="food-back-button"><ArrowLeft size={19} /></button>
                <div className="section-heading"><p className="food-page-eyebrow">FOOD LOG</p><h2>Log food</h2><p>Add to {selectedMeal.toLowerCase()}.</p></div>
              </div>

              <div className="food-log-controls">
                <div className="food-meal-picker" role="group" aria-label="Choose meal">
                  {mealLogOrder.map(meal => <button type="button" key={meal} aria-pressed={selectedMeal === meal} onClick={() => setSelectedMeal(meal)} className={`food-meal-option ${selectedMeal === meal ? 'is-selected' : ''}`}>{meal}</button>)}
                </div>
                <div className="food-entry-mode" role="group" aria-label="Food entry method">
                  <button type="button" aria-pressed={foodEntryMode === 'describe'} onClick={() => setFoodEntryMode('describe')} className={foodEntryMode === 'describe' ? 'is-selected' : ''}><Sparkles size={15} />Describe food</button>
                  <button type="button" aria-pressed={foodEntryMode === 'search'} onClick={() => setFoodEntryMode('search')} className={foodEntryMode === 'search' ? 'is-selected' : ''}><Search size={15} />Search foods</button>
                </div>
              </div>

              <div className="food-log-layout">
                {foodEntryMode === 'describe' && (
                <section className="food-assistant-card" aria-label="Describe and review food">
                  <div className="food-composer-section food-composer-section-first">
                    <label htmlFor="food-log-message">What did you eat?</label>
                    <div className="food-composer">
                      <textarea id="food-log-message" value={input} onChange={e => handleInputChange(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitFoodMessage(); } }} placeholder="e.g. 2 chapati and a small bowl of dal" rows={2} />
                      <button type="button" onClick={submitFoodMessage} disabled={foodThinking || loading} className="food-submit-button btn btn-food">{foodThinking ? <><i className="w-4 h-4 rounded-full border-2 border-current/30 border-t-current animate-spin" /> Checking…</> : <><Sparkles size={17} /> Review nutrition</>}</button>
                    </div>
                    <p className="food-composer-hint">Add one food or a whole meal. You can adjust the nutrition before saving.</p>
                    {isParsing && <p className="food-parsing-hint" role="status">Understanding your message…</p>}
                    <AnimatePresence>
                      {aiChips.length > 0 && (
                        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} className="food-understanding-chips" aria-label="Foods understood so far">
                          <span>Understood:</span>{aiChips.map((chip, i) => <span key={i} className="food-understanding-chip"><Check size={12} /> {chip.quantity} {chip.item}</span>)}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {foodMessages.length > 0 && (
                    <div className="food-chat-window" aria-label="Food assistant conversation" aria-live="polite">
                      {foodMessages.map((message, index) => (
                        <div key={index} className={`food-chat-row ${message.role === 'user' ? 'is-user' : 'is-assistant'}`}>
                          {message.role !== 'user' && <span className="food-chat-avatar"><Sparkles size={14} /></span>}
                          <p className="food-chat-bubble">{message.text}</p>
                        </div>
                      ))}
                      {foodThinking && <div className="food-thinking-message" role="status" aria-live="polite"><i className="w-4 h-4 shrink-0 rounded-full border-2 border-emerald-300/25 border-t-emerald-300 animate-spin"/><span>Checking your foods and portions…</span></div>}
                    </div>
                  )}

                  {foodDrafts.map((foodDraft, draftIndex) => {
                    const nutrientLabels = { calories: ['Calories', 'kcal'], protein: ['Protein', 'g'], carbs: ['Carbs', 'g'], fats: ['Fat', 'g'], fiber: ['Fibre', 'g'] };
                    return (
                      <article key={`${foodDraft.food_description}-${draftIndex}`} className="food-draft-card">
                        <div className="food-draft-heading">
                          <span className="food-draft-icon"><Check size={19} /></span>
                          <div className="food-draft-title"><p>{foodDrafts.length > 1 ? `FOOD ${draftIndex + 1} OF ${foodDrafts.length}` : 'READY TO REVIEW'}</p><h4>{foodDraft.food_description}</h4><span>Check the estimate, then add it to your meal.</span></div>
                          <span className={`food-source-badge ${foodDraft.source === 'database' ? 'is-catalog' : foodDraft.source === 'user-edited' ? 'is-edited' : 'is-ai'}`}>{foodDraft.source === 'database' ? 'Catalog' : foodDraft.source === 'user-edited' ? 'Your edit' : 'AI estimate'}</span>
                        </div>
                        <div className="food-nutrition-section-title"><strong>Nutrition for this portion</strong><span>Tap a value to change it</span></div>
                        <div className="food-nutrition-grid">
                          {['calories', 'protein', 'carbs', 'fats', 'fiber'].map(key => (
                            <label key={key} className={`food-nutrient-field nutrient-${key}`}><span>{nutrientLabels[key][0]}</span><div><input aria-label={`${nutrientLabels[key][0]} in ${nutrientLabels[key][1]}`} type="number" min="0" step="0.1" value={foodDraft[key]} onChange={e => setFoodDrafts(previous => previous.map((item, index) => index === draftIndex ? { ...item, [key]: e.target.value, source: 'user-edited', food_item_id: null } : item))} /><small>{nutrientLabels[key][1]}</small></div></label>
                          ))}
                        </div>
                        <p className="food-estimate-note">{foodDraft.source === 'database' ? 'Estimated from your local food list.' : foodDraft.source === 'user-edited' ? 'Your changes will be saved with this entry.' : 'AI estimate. Adjust it if it doesn’t look right.'}</p>
                        <div className="food-draft-actions">
                          <button type="button" onClick={() => setFoodDrafts(previous => previous.filter((_, index) => index !== draftIndex))} className="food-remove-draft">Remove</button>
                      <button type="button" onClick={() => saveFoodDraft(draftIndex)} disabled={loading} className="food-save-draft btn btn-food">{loading ? 'Saving…' : foodDrafts.length > 1 ? 'Save this food' : `Add to ${selectedMeal}`}</button>
                        </div>
                      </article>
                    );
                  })}

                  <details className="food-ai-details">
                    <summary><span><Sparkles size={15} /> AI estimate status</span><span>{ollamaStatusLoading ? 'Checking…' : ollamaStatus?.ollama_running ? 'Available' : 'View status'}</span></summary>
                    <div className="food-ai-details-body"><AIStatusIndicator status={ollamaStatus} loading={ollamaStatusLoading} onRefresh={refreshOllamaStatus} /></div>
                  </details>
                </section>
                )}

                {foodEntryMode === 'search' && <section className="food-database-panel" aria-labelledby="food-database-title">
                  <div className="food-database-heading"><span className="food-database-icon"><Search size={19} /></span><h3 id="food-database-title">Search foods</h3></div>
                  <div className="flex flex-wrap gap-2" role="tablist" aria-label="Food lists">
                    {[['search', 'Search'], ['favorites', '★ Favorites'], ['recent', 'Recent']].map(([mode, label]) => (
                      <button key={mode} role="tab" aria-selected={foodListMode === mode}
                        onClick={() => { setFoodListMode(mode); setSelectedFood(null); }}
                        className={`food-list-tab ${foodListMode === mode ? 'is-active' : ''}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="relative">
                    <input 
                      value={searchQuery}
                      onFocus={() => setFoodListMode('search')}
                      onChange={e => searchFood(e.target.value)}
                      disabled={foodListMode !== 'search'}
                      placeholder="Try apple, roti, dal, or dahi…"
                      aria-label="Search foods in the nutrition list"
                      className="food-database-search w-full p-4 pl-12 bg-white rounded-2xl border border-slate-100 shadow-sm outline-none text-sm focus:border-green-300 transition-all"
                    />
                    <span className="absolute left-4 top-4 text-slate-400 pointer-events-none">{searchLoading ? <i className="block w-4 h-4 rounded-full border-2 border-green-500/30 border-t-green-500 animate-spin"/> : <Search size={17} strokeWidth={1.8} />}</span>
                  </div>
                  <div className="max-h-[400px] overflow-y-auto space-y-3 pr-2">
                    {(searchLoading || foodCollectionsLoading) && <div className="flex items-center justify-center gap-3 text-slate-400 text-sm py-10"><i className="w-4 h-4 rounded-full border-2 border-green-500/30 border-t-green-500 animate-spin"/>{searchLoading ? 'Searching nutrition database…' : 'Loading your food lists…'}</div>}
                    {!searchLoading && !foodCollectionsLoading && foodRows.length === 0 && (
                      <div className="food-database-empty">
                        <Search size={22} />
                        <p>{foodListMode === 'search' && searchQuery.length >= 2 ? 'No matching foods yet' : foodListMode === 'favorites' ? 'Your saved foods will appear here' : foodListMode === 'recent' ? 'Foods you add from this list will appear here' : 'Search by food name to get started'}</p>
                        <span>{foodListMode === 'search' && searchQuery.length >= 2 ? 'Try another name, or use the assistant to log it.' : foodListMode === 'favorites' ? 'Tap the star beside a food to save it here.' : foodListMode === 'recent' ? 'You can also describe your meal in the assistant.' : 'You can also describe your meal in the assistant.'}</span>
                      </div>
                    )}
                    {foodRows.map(food => (
                      <div key={food.id} className="food-result-card">
                        <button type="button" onClick={() => selectFood(food)} className="food-result-main">
                          <span className="food-result-icon"><Apple size={17} /></span>
                          <span className="food-result-description"><strong>{food.name}</strong><small>{food.serving_size} · {food.source_version ? `USDA data ${food.source_version}` : food.source || 'Local estimate'}</small></span>
                          <span className="food-result-calories"><strong>{food.calories}</strong><small>kcal</small></span>
                        </button>
                        <button type="button" aria-label={favoriteFoods.some(item => item.id === food.id) ? `Remove ${food.name} from favorites` : `Add ${food.name} to favorites`}
                          onClick={event => toggleFoodFavorite(food, event)}
                          className={`food-result-favorite ${favoriteFoods.some(item => item.id === food.id) ? 'is-favorite' : ''}`}>
                          {favoriteFoods.some(item => item.id === food.id) ? '★' : '☆'}
                        </button>
                      </div>
                    ))}
                  </div>

                  {selectedFood && (
                    <div className="food-selected-card space-y-4">
                      <div className="flex items-start justify-between gap-3">
                        <div><p className="font-bold text-slate-800">{selectedFood.name}</p><p className="text-xs text-slate-500">Values per {selectedFood.serving_size}</p></div>
                        <button aria-label="Cancel food selection" onClick={() => setSelectedFood(null)} className="text-slate-400 px-2"><X size={17} /></button>
                      </div>
                      <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">Number of servings
                        <input type="number" min="0.1" step="0.1" value={foodServings} onChange={e => setFoodServings(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 text-base" />
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-slate-500">
                        {['calories', 'protein', 'carbs', 'fats', 'fiber'].map(key => <span key={key} className="rounded-xl bg-slate-50 px-3 py-2">{key === 'calories' ? 'Calories' : key}: <b className="text-slate-800">{(Number(selectedFood[key] || 0) * (Number(foodServings) || 0)).toFixed(key === 'calories' ? 0 : 1)}{key === 'calories' ? ' kcal' : ' g'}</b></span>)}
                      </div>
                      <button onClick={saveSelectedFood} disabled={loading} className="btn btn-food w-full rounded-xl px-5 py-3 text-sm font-bold disabled:opacity-60">{loading ? 'Adding…' : `Add to ${selectedMeal}`}</button>
                    </div>
                  )}

                  <div className="food-manual-entry-card">
                    <div className="flex items-center justify-between gap-3">
                      <div><p className="font-bold text-slate-800">Can’t find your food?</p><p className="text-xs text-slate-500 mt-1">Enter its name, portion, and nutrition values.</p></div>
                      <button type="button" onClick={() => setManualEntryOpen(open => !open)} className="food-manual-toggle">{manualEntryOpen ? 'Close' : 'Add manually'}</button>
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
                        <button onClick={saveManualFood} disabled={loading} className="btn btn-food w-full rounded-xl px-5 py-3 text-sm font-bold disabled:opacity-60">{loading ? 'Saving…' : 'Save manual entry'}</button>
                      </div>
                    )}
                  </div>
                </section>}
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key={activeTab}
              initial={{ opacity: 0, y: 10 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0, y: -10 }} 
              transition={{ duration: 0.2 }}
              className={`app-screen screen-${activeTab} space-y-10`}
            >
              {activeTab === 'home' && (
                <>
                  <div className="home-page-heading">
                    <div className="home-heading-copy"><h2>Your day</h2></div>
                    <div className="home-toolbar">
                      <div className="home-date-control">
                        <button type="button" onClick={() => moveSelectedDate(-1)} aria-label="Previous day" className="home-date-nav-button"><ArrowLeft size={16} /></button>
                        <input
                          type="date"
                          value={selectedDate}
                          max={todayDate}
                          onChange={e => selectCalendarDate(e.target.value)}
                          className="home-date-picker"
                          aria-label="Selected day"
                        />
                        <button type="button" onClick={() => moveSelectedDate(1)} disabled={selectedDate >= todayDate} aria-label="Next day" className="home-date-nav-button"><ChevronDown size={16} className="-rotate-90" /></button>
                      </div>
                      <button onClick={() => openFoodLogger()} className="btn btn-food home-log-food-button"><Plus size={16} />Log food</button>
                    </div>
                  </div>

                  <details className="nutrition-accordion glass-card">
                    <summary className="nutrition-accordion-summary">
                      <span className="nutrition-summary-icon"><Flame size={19} strokeWidth={1.8} /></span>
                      <span className="min-w-0 flex-1"><span className="block text-sm font-extrabold">Nutrition summary</span><span className={`mt-1 block truncate text-xs text-slate-500 ${profile?.calorie_target && summary.total_calories > profile.calorie_target ? 'calorie-over-target' : ''}`}>{Math.round(summary.total_calories)} kcal logged{profile?.calorie_target ? ` · ${summary.total_calories > profile.calorie_target ? `Over by ${Math.round(summary.total_calories - profile.calorie_target)} kcal` : `${Math.max(0, Math.round(profile.calorie_target - summary.total_calories))} kcal left`}` : ' · add a profile to set a target'}</span></span>
                      <span className="text-xs font-semibold text-slate-500">Tap to see all nutrients</span>
                      <ChevronDown size={19} className="nutrition-chevron" />
                    </summary>
                    <div className="nutrition-accordion-content grid grid-cols-2 md:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-5">
                      <MacroCard label="Calories" value={summary.total_calories} target={profile?.calorie_target || 2000} unit="kcal" color="var(--d-calories)" icon={Flame} />
                      <MacroCard label="Protein" value={summary.total_protein} target={profile?.protein_target || 100} unit="g" color="var(--d-protein)" icon={Dumbbell} />
                      <MacroCard label="Carbs" value={summary.total_carbs} target={profile?.carb_target || 200} unit="g" color="var(--d-carbs)" icon={Wheat} />
                      <MacroCard label="Fats" value={summary.total_fats} target={profile?.fat_target || 60} unit="g" color="var(--d-fat)" icon={Droplets} />
                      <MacroCard label="Fiber" value={summary.total_fiber} target={28} unit="g" color="var(--d-fiber)" icon={Sprout} />
                    </div>
                  </details>

                  <div className="tracking-accordion-list">
                    <details className="tracking-accordion glass-card">
                      <summary className="tracking-accordion-summary">
                        <span className="tracking-summary-icon is-water"><Droplets size={19} /></span>
                        <span className="tracking-summary-copy"><strong>Hydration</strong><span>{(tracking.water_total_ml / 1000).toFixed(2)} L · {tracking.water_logs.length} {tracking.water_logs.length === 1 ? 'entry' : 'entries'}</span></span>
                        <Plus size={20} className="tracking-plus" aria-hidden="true" />
                      </summary>
                      <div className="tracking-accordion-content">
                        <div className="flex flex-wrap gap-2">{[150, 250, 500].map(amount => <button key={amount} onClick={() => addWater(amount)} className="glass-chip px-4 py-2 text-sm font-bold text-cyan-200">+{amount} ml</button>)}</div>
                        <div className="flex gap-2"><input aria-label="Custom water amount in milliliters" type="number" min="1" value={waterAmount} onChange={e => setWaterAmount(e.target.value)} className="min-w-0 flex-1 rounded-xl border px-3 py-2"/><button onClick={() => addWater()} className="btn btn-secondary rounded-xl px-4 py-2 text-sm font-bold">Log water</button></div>
                        <DailyTrackingEntries
                          kind="water" entries={tracking.water_logs}
                          editingId={editingWaterLogId} editValue={waterEditValue} setEditValue={setWaterEditValue}
                          onStartEdit={entry => { setEditingWaterLogId(entry.id); setWaterEditValue(String(entry.amount_ml)); }}
                          onCancelEdit={() => setEditingWaterLogId(null)} onSaveEdit={saveWaterEdit} onDelete={deleteWaterLog}
                        />
                      </div>
                    </details>
                    <details ref={weightAccordionRef} className="tracking-accordion glass-card">
                      <summary className="tracking-accordion-summary">
                        <span className="tracking-summary-icon is-weight"><Scale size={19} /></span>
                        <span className="tracking-summary-copy"><strong>Weight</strong><span>{tracking.latest_weight_kg ? `${tracking.latest_weight_kg.toFixed(1)} kg · ${tracking.weight_logs.length} weigh-in${tracking.weight_logs.length === 1 ? '' : 's'}` : 'No weigh-in for this day'}</span></span>
                        <Plus size={20} className="tracking-plus" aria-hidden="true" />
                      </summary>
                      <div className="tracking-accordion-content">
                        <div className="flex gap-2"><input id="home-weight-input" aria-label="Weight in kilograms" type="number" min="1" max="700" step="0.1" placeholder="Weight in kg" value={weightInput} onChange={e => setWeightInput(e.target.value)} className="min-w-0 flex-1 rounded-xl border px-3 py-2"/><button onClick={addWeight} className="btn btn-secondary rounded-xl px-4 py-2 text-sm font-bold">Save weight</button></div>
                        <DailyTrackingEntries
                          kind="weight" entries={tracking.weight_logs}
                          editingId={editingWeightLogId} editValue={weightEditValue} setEditValue={setWeightEditValue}
                          onStartEdit={entry => { setEditingWeightLogId(entry.id); setWeightEditValue(String(entry.weight_kg)); }}
                          onCancelEdit={() => setEditingWeightLogId(null)} onSaveEdit={saveWeightEdit}
                        />
                      </div>
                    </details>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                    <div className="lg:col-span-2 space-y-6">
                      <div className="food-day-heading">
                        <div><h3>Food for the day</h3><p>{foodLogs.length} {foodLogs.length === 1 ? 'entry' : 'entries'} · open a meal to see its foods</p></div>
                      </div>
                      <div className="meal-log-list">
                        {mealLogOrder.map(meal => {
                          const entries = foodLogsByMeal[meal] || [];
                          const totals = entries.reduce((sum, log) => ({
                            calories: sum.calories + Number(log.calories || 0),
                            protein: sum.protein + Number(log.protein || 0),
                            carbs: sum.carbs + Number(log.carbs || 0),
                            fats: sum.fats + Number(log.fats || 0),
                            fiber: sum.fiber + Number(log.fiber || 0),
                          }), { calories: 0, protein: 0, carbs: 0, fats: 0, fiber: 0 });
                          return <details key={meal} className="meal-log-accordion glass-card">
                            <summary className="meal-log-summary">
                              <span className="meal-log-icon"><Activity size={17} /></span>
                              <span className="meal-log-title">{meal}</span>
                              <span className="meal-log-count">{entries.length} {entries.length === 1 ? 'food' : 'foods'}</span>
                              <strong className="meal-log-calories">{Math.round(totals.calories)} kcal</strong>
                              <Plus size={19} className="meal-log-plus" aria-hidden="true" />
                            </summary>
                            <div className="meal-log-content">
                              {entries.length ? <>
                                <p className="meal-log-macros">Protein {totals.protein.toFixed(1)} g · Carbs {totals.carbs.toFixed(1)} g · Fat {totals.fats.toFixed(1)} g · Fiber {totals.fiber.toFixed(1)} g</p>
                                {entries.map(log => <motion.div key={log.id} layout className="meal-log-item">
                                  <div className="meal-log-item-copy">
                                    <strong>{log.note || log.category}</strong>
                                    <span>{formatTrackingTime(log.timestamp)} · {log.source || 'Food log'}</span>
                                    <small>P {Number(log.protein || 0).toFixed(1)} g · C {Number(log.carbs || 0).toFixed(1)} g · F {Number(log.fats || 0).toFixed(1)} g · Fiber {Number(log.fiber || 0).toFixed(1)} g</small>
                                  </div>
                                  <div className="meal-log-item-actions"><strong>{Math.round(Number(log.calories || 0))} kcal</strong><button type="button" aria-label={`Delete ${log.note || log.category}`} onClick={() => deleteLog(log.id)}><Trash2 size={16} /></button></div>
                                </motion.div>)}
                              </> : <div className="meal-log-empty"><span>No food logged for {meal.toLowerCase()} yet.</span><button type="button" onClick={() => openFoodLogger(meal)}><Plus size={15} />Add food</button></div>}
                            </div>
                          </details>;
                        })}
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
                        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest">Your calorie goal</h3>
                        <div className="p-5 bg-slate-50 rounded-3xl border border-slate-100">
                          <p className="text-sm text-slate-500 leading-relaxed font-medium">
                            {profile ? `Your daily target is ${profile.calorie_target?.toFixed(0)} kcal to support your ${profile.goal} goal.` : "Add your age, height, weight and goal in Profile to calculate a daily target."}
                          </p>
                        </div>
                        <button onClick={() => setActiveTab('coach')} className="w-full py-4 bg-slate-900 text-white rounded-2xl text-sm font-bold hover:bg-slate-800 transition-all shadow-xl shadow-slate-200">
                          <MessageCircle size={17} className="mr-2 inline" />Chat with Coach
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {activeTab === 'profile' && (
                <ProfileTab
                  form={profForm}
                  updateField={updateProfileField}
                  profile={profile}
                  weeklyPlan={weeklyPlan}
                  planLoading={weeklyPlanLoading}
                  saving={profileSaving}
                  onSave={saveProfile}
                  onSuggestTimes={suggestProfileMealTimes}
                  mealPlan={mealPlan}
                  mealPlanLoading={mealPlanLoading}
                  mealPlanSaving={mealPlanSaving}
                  onGenerateMealPlan={generateMealPlan}
                  onSwapMeal={swapMealPlan}
                  onAdjustMealPortion={adjustMealPlanPortion}
                  onLogPlannedMeal={logPlannedMeal}
                />
              )}

              {activeTab === 'coach' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="coach-page max-w-3xl mx-auto flex flex-col">
                  <div className="coach-page-heading section-heading mb-4 px-4"><p>AI COACH</p><h2>Ask your coach</h2></div>
                  <div className="mb-3 px-4"><AIStatusIndicator status={ollamaStatus} loading={ollamaStatusLoading} onRefresh={refreshOllamaStatus} /></div>
                  <div className="flex-1 overflow-y-auto space-y-4 mb-6 px-4">
                    {chatMessages.map((msg, i) => (
                      <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] p-4 rounded-2xl text-sm ${msg.role === 'user' ? 'coach-user-message text-white rounded-tr-none shadow-md' : msg.role === 'error' ? 'bg-rose-500/10 border border-rose-400/20 text-rose-200 rounded-tl-none' : 'bg-white border border-slate-100 text-slate-800 rounded-tl-none shadow-sm'}`}>
                          {msg.role === 'error' && <strong className="mb-1 block text-[10px] uppercase tracking-wider">AI connection issue</strong>}
                          {msg.text}
                        </div>
                      </div>
                    ))}
                    {chatLoading && <div className="flex items-center gap-3 px-4 py-2 text-sm text-slate-400" role="status" aria-live="polite"><span className="flex gap-1"><i className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce [animation-delay:-0.2s]"/><i className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce [animation-delay:-0.1s]"/><i className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce"/></span>Coach is replying…</div>}
                  </div>
                  <div className="coach-composer flex gap-3 p-3 bg-white rounded-full border border-slate-100 shadow-xl">
                    <input 
                      value={chatInput} 
                      onChange={e => setChatInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleChat())}
                      disabled={chatLoading}
                      placeholder="Ask your coach about nutrition or training..." 
                      className="coach-composer-input flex-1 bg-transparent px-4 py-2 text-sm outline-none"
                    />
                    {chatLoading ? <button onClick={stopChat} aria-label="Stop AI response" className="btn btn-danger shrink-0 px-5 h-12 rounded-full text-sm font-bold">■ Stop</button> : <button onClick={handleChat} disabled={!chatInput.trim()} aria-label="Send message" className="btn btn-coach text-white w-12 h-12 rounded-full flex items-center justify-center font-bold disabled:opacity-40 disabled:shadow-none">↑</button>}
                  </div>
                </motion.div>
              )}

              {activeTab === 'train' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="train-page max-w-6xl mx-auto space-y-8">
                  <div className="flex flex-wrap gap-2 rounded-2xl bg-white p-2 border border-slate-100 shadow-sm" role="tablist" aria-label="Workout sections">
                    {[["map", "Muscle map"], ["planner", "AI planner"], ["library", "Exercise library"], ["history", "History"]].map(([view, label]) => (
                      <button key={view} role="tab" aria-selected={trainView === view} onClick={() => setTrainView(view)}
                        className={`rounded-xl px-3 sm:px-5 py-3 text-sm font-bold transition-colors ${trainView === view ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>
                        {label}
                      </button>
                    ))}
                  </div>

                  {activeWorkout && trainView !== 'planner' && (
                    <button onClick={() => setTrainView('planner')} className="w-full rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-left text-sm font-bold text-emerald-800">
                      Workout in progress · {Math.floor(workoutElapsed / 60)}:{String(workoutElapsed % 60).padStart(2, '0')} · Resume session
                    </button>
                  )}

                  {trainView === 'map' && (
                    <MuscleMap
                      selectedMuscle={selectedMuscle}
                      onSelectMuscle={setSelectedMuscle}
                      equipment={exerciseEquipment}
                      onEquipmentChange={setExerciseEquipment}
                      onBuildFocusedWorkout={buildFocusedWorkout}
                      query={exerciseQuery}
                      onQueryChange={setExerciseQuery}
                      exercises={exerciseLibrary}
                      loading={exerciseLoading}
                    />
                  )}

                  {trainView === 'planner' && <>
                    <div className="bg-white p-5 sm:p-8 lg:p-12 rounded-[2.5rem] shadow-sm border border-slate-100 text-center space-y-6 sm:space-y-8">
                      <div>
                        {workoutFocus && <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-xs font-bold text-emerald-300"><span>Focused on {workoutFocus}</span><button type="button" aria-label="Clear muscle focus" onClick={() => setWorkoutFocus('')} className="workout-focus-clear grid h-5 w-5 place-items-center rounded-full text-emerald-200 hover:bg-white/10"><X size={13} /></button></div>}
                        <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight">Workout Planner</h2>
                        <p className="text-slate-500 max-w-lg mx-auto mt-3">{workoutFocus ? `Create a ${workoutFocus.toLowerCase()} session with exercises matched to your available equipment.` : 'Choose a ready-made routine or ask the local AI to create a plan from the exercise library.'}</p>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto text-left">
                        <label className="space-y-2 block text-xs font-bold text-slate-400 uppercase tracking-wider">Equipment
                          <select value={workoutPrefs.equipment} onChange={e => setWorkoutPrefs({...workoutPrefs, equipment: e.target.value})} className="mt-2 w-full p-4 bg-slate-50 rounded-2xl border border-slate-100 outline-none text-sm text-slate-800 normal-case">
                            <option value="Any">Any equipment</option><option value="Gym">Gym</option><option value="Home">Home</option><option value="Dumbbells">Dumbbells only</option><option value="None">Bodyweight</option>
                          </select>
                        </label>
                        <label className="space-y-2 block text-xs font-bold text-slate-400 uppercase tracking-wider">Duration (minutes)
                          <input type="number" min="10" max="180" value={workoutPrefs.duration} onChange={e => setWorkoutPrefs({...workoutPrefs, duration: e.target.value})} className="mt-2 w-full p-4 bg-slate-50 rounded-2xl border border-slate-100 outline-none text-sm text-slate-800" />
                        </label>
                      </div>
                      <button onClick={generateWorkout} disabled={workoutLoading} className="btn btn-workout px-10 py-4 rounded-full font-extrabold transition-all disabled:opacity-60">
                        {workoutLoading ? <span className="inline-flex items-center gap-3"><i className="w-5 h-5 rounded-full border-2 border-white/40 border-t-white animate-spin"/>Building your plan…</span> : 'Generate AI plan'}
                      </button>
                      <p className="text-xs text-slate-400">Plans use exercises from your local library. Use a comfortable range and stop if you feel pain.</p>
                    </div>

                    <section className="space-y-4">
                      <div><h3 className="text-xl font-extrabold text-slate-900">Ready-made templates</h3><p className="text-sm text-slate-500 mt-1">Simple routines you can use without waiting for AI.</p></div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {workoutTemplates.map(template => (
                          <article key={template.workout_name} className="rounded-3xl bg-white p-6 border border-slate-100 shadow-sm flex flex-col gap-4">
                            <div><span className="text-[10px] uppercase tracking-widest font-bold text-emerald-700">{template.equipment} · {template.duration} min</span><h4 className="mt-2 font-extrabold text-slate-900">{template.workout_name}</h4><p className="mt-2 text-xs leading-relaxed text-slate-500">{template.reasoning}</p></div>
                            <p className="text-xs text-slate-500">{template.exercises.length} exercises · 3 sets each</p>
                            <button onClick={() => { setWorkoutFocus(''); setWorkoutPlan(template); setNewPlanExerciseId(''); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="mt-auto rounded-xl bg-emerald-50 text-emerald-800 px-4 py-3 text-sm font-bold hover:bg-emerald-100">Preview routine</button>
                          </article>
                        ))}
                        {!workoutTemplates.length && <p className="text-sm text-slate-400">Loading templates…</p>}
                      </div>
                    </section>

                    {workoutPlan && (
                      <section className="rounded-[2rem] bg-white p-7 sm:p-10 border border-slate-100 shadow-sm space-y-6">
                        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-5">
                          <div><h3 className="text-2xl font-extrabold text-slate-900">{workoutPlan.workout_name}</h3><p className="mt-2 text-sm text-slate-500">{workoutPlan.reasoning}</p></div>
                          <div className="flex flex-wrap items-center gap-2">{workoutPlan.muscle_group && <span className="rounded-full border border-emerald-300/15 bg-emerald-300/10 px-3 py-1.5 text-xs font-bold text-emerald-300">{workoutPlan.muscle_group} focus</span>}<span className="rounded-full bg-emerald-50 text-emerald-700 px-3 py-1.5 text-xs font-bold">{workoutPlan.source === 'template' ? 'Template' : 'AI plan'}</span></div>
                        </div>
                        {workoutPlan.warm_up && <p className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900"><b>Warm-up:</b> {workoutPlan.warm_up}</p>}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {workoutPlan.exercises?.map((ex, i) => (
                            <article key={`${ex.exercise_id}-${i}`} className="rounded-2xl bg-slate-50 p-5 border border-slate-100">
                              <div className="flex justify-between gap-3"><div><p className="font-bold text-slate-800">{ex.name}</p><p className="text-xs text-slate-500 mt-1">{ex.sets} sets · {ex.reps} reps · rest {ex.rest}</p></div><span className="text-xs rounded-full bg-white px-3 py-1 h-fit font-bold text-slate-600">RPE {ex.rpe}</span></div>
                              {ex.instructions && <p className="mt-3 text-xs leading-relaxed text-slate-500">{ex.instructions}</p>}
                              {!activeWorkout && <div className="workout-plan-exercise-actions">
                                <label><span>Replace with</span><select value="" onChange={event => replacePlanExercise(i, event.target.value)} aria-label={`Replace ${ex.name} with another exercise`}>
                                  <option value="">Choose exercise</option>
                                  {planExerciseOptions.filter(candidate => candidate.id !== ex.exercise_id && !workoutPlan.exercises.some((planned, plannedIndex) => plannedIndex !== i && planned.exercise_id === candidate.id)).map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.name} · {candidate.equipment === 'None' ? 'Bodyweight' : candidate.equipment}</option>)}
                                </select></label>
                                <button type="button" onClick={() => removePlanExercise(i)} disabled={workoutPlan.exercises.length <= 1} aria-label={`Remove ${ex.name}`} title={workoutPlan.exercises.length <= 1 ? 'Keep at least one exercise' : `Remove ${ex.name}`}><X size={15} /><span>Remove</span></button>
                              </div>}
                            </article>
                          ))}
                        </div>
                        {!activeWorkout && <div className="workout-plan-add-box">
                          <div><h4>Customize this workout</h4><p>Add, replace, or remove movements before starting.</p></div>
                          <div className="workout-plan-add-row"><select value={newPlanExerciseId} onChange={event => setNewPlanExerciseId(event.target.value)} aria-label="Choose an exercise to add">
                            <option value="">Choose an exercise to add</option>
                            {planExerciseOptions.filter(candidate => !workoutPlan.exercises.some(planned => planned.exercise_id === candidate.id)).map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.name} · {candidate.equipment === 'None' ? 'Bodyweight' : candidate.equipment}</option>)}
                          </select><button type="button" onClick={addPlanExercise} disabled={!newPlanExerciseId}><Plus size={16} />Add exercise</button></div>
                        </div>}
                        {!activeWorkout ? <button onClick={() => startWorkout(workoutPlan)} className="btn btn-workout w-full py-4 rounded-2xl font-extrabold shadow-lg">Start workout</button> : <p className="text-center text-sm font-bold text-emerald-700">A workout session is already in progress.</p>}
                      </section>
                    )}

                    {activeWorkout && (
                      <section className="rounded-[2rem] bg-white p-6 sm:p-9 border border-emerald-200 shadow-lg shadow-emerald-100/50 space-y-6">
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-5">
                          <div><p className="text-xs uppercase tracking-widest font-bold text-emerald-700">Workout in progress</p><h3 className="mt-1 text-2xl font-extrabold text-slate-900">{activeWorkout.workoutName}</h3></div>
                          <span className="rounded-xl bg-slate-900 px-4 py-2 font-mono text-lg font-bold text-white">{Math.floor(workoutElapsed / 60)}:{String(workoutElapsed % 60).padStart(2, '0')}</span>
                        </div>
                        <p className="text-sm text-slate-500">Mark each exercise you complete. Enter actual reps, load, and effort for each set; planned values are not saved as completed work.</p>
                        <div className="space-y-4">
                          {activeWorkout.exercises.map((exercise, exerciseIndex) => (
                            <article key={`${exercise.exercise_id}-${exerciseIndex}`} className={`rounded-2xl border p-4 ${exercise.completed ? 'border-emerald-200 bg-emerald-50/60' : 'border-slate-100 bg-slate-50'}`}>
                              <label className="flex items-center gap-3 font-bold text-slate-800"><input type="checkbox" checked={exercise.completed} onChange={e => updateWorkoutExercise(exerciseIndex, { completed: e.target.checked })} className="h-5 w-5 accent-emerald-600"/>{exercise.name}<span className="ml-auto text-xs font-medium text-slate-500">Plan: {exercise.sets} × {exercise.reps}</span></label>
                              {exercise.previousWorkout && <p className="mt-2 text-xs text-slate-400">Previous session · {new Date(exercise.previousWorkout.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</p>}
                              <div className="mt-4 space-y-2">
                                {exercise.actualSets.map((set, setIndex) => {
                                  const previousSet = exercise.previousWorkout?.sets?.[setIndex];
                                  const previousLoad = previousSet?.weight != null ? `${previousSet.weight} kg` : 'Bodyweight';
                                  return <div key={setIndex} className="workout-set-entry">
                                    <div className="workout-set-row grid grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-2">
                                      <span className="text-xs font-bold text-slate-400">Set {setIndex + 1}</span>
                                      <input type="number" min="0" max="1000" step="1" value={set.reps} onChange={e => updateWorkoutSet(exerciseIndex, setIndex, 'reps', e.target.value)} placeholder={previousSet ? `Last ${previousSet.reps}` : 'Reps'} aria-label={`${exercise.name} set ${setIndex + 1} reps`} className="w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"/>
                                      <input type="number" min="0" max="2000" step="0.5" value={set.weight} onChange={e => updateWorkoutSet(exerciseIndex, setIndex, 'weight', e.target.value)} placeholder={previousSet ? (previousSet.weight != null ? `Last ${previousSet.weight} kg` : 'Bodyweight') : 'Load kg'} aria-label={`${exercise.name} set ${setIndex + 1} load in kilograms`} className="w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"/>
                                      <input type="number" min="1" max="10" step="1" value={set.rpe} onChange={e => updateWorkoutSet(exerciseIndex, setIndex, 'rpe', e.target.value)} placeholder={previousSet?.rpe ? `Last ${previousSet.rpe}` : 'RPE'} aria-label={`${exercise.name} set ${setIndex + 1} effort`} className="w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"/>
                                    </div>
                                    {previousSet && <p className="workout-previous-set">Previous: {previousSet.reps} reps · {previousLoad}{previousSet.rpe ? ` · RPE ${previousSet.rpe}` : ''}</p>}
                                  </div>;
                                })}
                              </div>
                            </article>
                          ))}
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3"><button onClick={completeWorkout} disabled={workoutSaving} className="btn btn-workout flex-1 rounded-xl px-5 py-4 font-extrabold disabled:opacity-60">{workoutSaving ? 'Saving workout…' : 'Complete and save'}</button><button onClick={discardWorkout} disabled={workoutSaving} className="btn btn-secondary rounded-xl px-5 py-4 font-bold disabled:opacity-60">Discard session</button></div>
                      </section>
                    )}
                  </>}

                  {trainView === 'library' && (
                    <section className="space-y-6">
                      <div><h2 className="text-3xl font-extrabold text-slate-900">Exercise library</h2><p className="text-slate-500 mt-2">Browse movements, equipment needs, and basic form cues.</p></div>
                      <div className="grid grid-cols-1 sm:grid-cols-[1fr_220px] gap-3">
                        <input value={exerciseQuery} onChange={e => setExerciseQuery(e.target.value)} placeholder="Search exercise or muscle group" className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"/>
                        <select value={exerciseGroup} onChange={e => setExerciseGroup(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"><option>Any</option>{[...new Set(exerciseLibrary.map(exercise => exercise.muscle_group))].sort().map(group => <option key={group}>{group}</option>)}</select>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {filteredExercises.map(exercise => <article key={exercise.id} className="rounded-2xl bg-white p-6 border border-slate-100 shadow-sm"><div className="flex justify-between gap-3"><h3 className="font-extrabold text-slate-900">{exercise.name}</h3><span className="h-fit rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-bold text-emerald-700">{exercise.difficulty}</span></div><p className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-400">{exercise.muscle_group} · {exercise.equipment}</p><p className="mt-4 text-sm leading-relaxed text-slate-600">{exercise.instructions}</p><p className="mt-3 text-xs text-amber-800"><b>Watch for:</b> {exercise.common_mistakes}</p></article>)}
                        {!filteredExercises.length && <p className="text-sm text-slate-400">No exercises match that search.</p>}
                      </div>
                    </section>
                  )}

                  {trainView === 'history' && (
                    <section className="space-y-6">
                      <div><h2 className="text-3xl font-extrabold text-slate-900">Workout history</h2><p className="text-slate-500 mt-2">Your latest saved sessions and logged sets.</p></div>
                      {!workoutSessions.length && <div className="rounded-3xl bg-white p-12 text-center text-slate-400 border border-slate-100">Completed sessions will appear here.</div>}
                      <div className="space-y-4">{workoutSessions.slice(0, 10).map(session => <article key={session.id} className="rounded-2xl bg-white p-6 border border-slate-100 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-extrabold text-slate-900">{session.workout_type}</h3><p className="mt-1 text-xs text-slate-400">{new Date(session.date).toLocaleString()} · {session.duration_mins} min</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{session.sets.length} sets logged</span></div>{session.note && <p className="mt-3 text-sm text-slate-500">{session.note}</p>}{session.sets.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{session.sets.map((set,index) => <span key={`${session.id}-${index}`} className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">{set.exercise_name} · {set.reps} reps{set.weight != null ? ` · ${set.weight} kg` : ''}</span>)}</div>}</article>)}</div>
                    </section>
                  )}
                </motion.div>
              )}

              {activeTab === 'insights' && (
                <InsightsTab data={insightData} loading={insightsLoading} days={insightDays} onDaysChange={setInsightDays} sessions={workoutSessions} records={workoutRecords} />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {!showLogPage && <>
        <AnimatePresence>
          {quickAddOpen && <motion.div className="quick-add-menu" role="menu" aria-label="Quick actions" initial={{ opacity: 0, y: 10, scale: .97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: .98 }}>
            <p className="quick-add-title">Quick add</p>
            {[
              { id: 'food', label: 'Log a meal', detail: 'AI or manual entry', Icon: Apple, color: 'var(--c-food)' },
              { id: 'water', label: 'Log water', detail: 'Add 250 ml for the selected day', Icon: Droplets, color: 'var(--d-water)' },
              { id: 'weight', label: 'Log weight', detail: 'Enter a weigh-in for this day', Icon: Scale, color: 'var(--d-weight)' },
              { id: 'workout', label: 'Plan a workout', detail: 'Open the workout planner', Icon: Dumbbell, color: 'var(--c-workout)' },
              { id: 'mood', label: 'Mood check-in', detail: 'Talk it through with Coach', Icon: MessageCircle, color: 'var(--c-coach)' },
            ].map(({ id, label, detail, Icon, color }) => <button key={id} type="button" role="menuitem" onClick={() => runQuickAction(id)} className="quick-add-item" style={{ '--quick-color': color }}>
              <span className="quick-add-item-icon"><Icon size={19} aria-hidden="true" /></span><span><strong>{label}</strong><small>{detail}</small></span><span className="quick-add-chevron">›</span>
            </button>)}
          </motion.div>}
        </AnimatePresence>
        <button type="button" className="fab-add-button" aria-label="Log a meal; press and hold for quick actions" aria-expanded={quickAddOpen} title="Log a meal · hold for quick actions" onPointerDown={startFabLongPress} onPointerUp={endFabLongPress} onPointerLeave={endFabLongPress} onPointerCancel={() => { endFabLongPress(); fabLongPressedRef.current = false; }} onContextMenu={event => event.preventDefault()} onClick={openQuickAddDefault}>
          <Plus size={27} strokeWidth={2.5} aria-hidden="true" />
        </button>
      </>}

      <nav aria-label="Main sections" className="app-tab-nav fixed bottom-0 left-0 right-0 z-30 flex justify-center">
        <div className="tab-icon-bar">
          {APP_TABS.map(({ id, Icon, label, color }) => (
            <button
              key={id}
              type="button"
              aria-current={activeTab === id ? 'page' : undefined}
              onClick={() => { setActiveTab(id); setShowLogPage(false); setQuickAddOpen(false); }}
              style={{ '--tab-color': color }}
              className={`tab-icon-button flex flex-col items-center justify-center gap-1 rounded-2xl transition-all ${activeTab === id ? 'is-active' : ''}`}
            >
              <Icon size={21} strokeWidth={activeTab === id ? 2.2 : 1.8} />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </nav>

      <AnimatePresence>
        {toast && (
          <motion.div key={toast.id} initial={{ opacity: 0, y: -12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8 }} role="status" aria-live="polite" className={`toast-card fixed top-24 right-5 z-[70] max-w-sm rounded-2xl px-5 py-4 text-sm font-semibold text-white shadow-xl ${toast.type === 'error' ? 'bg-rose-600' : toast.type === 'info' ? 'bg-slate-800' : 'bg-emerald-600'}`}>
            <span className="mr-2 inline-flex align-middle">{toast.type === 'error' ? <AlertCircle size={17} /> : toast.type === 'info' ? <Info size={17} /> : <Check size={17} />}</span>{toast.message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
