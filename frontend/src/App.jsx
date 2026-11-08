import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import {
  Activity, AlertCircle, Apple, ArrowLeft, BarChart3, Check, ChevronDown,
  Droplets, Dumbbell, Flame, Home, Info, MessageCircle, Plus, Salad, Scale,
  Search, Sparkles, Sprout, User2, Wheat, X,
} from 'lucide-react';

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
  const Icon = icon;
  return (
    <div className="bg-white/80 backdrop-blur-md p-6 rounded-[2rem] border border-white shadow-sm transition-all hover:shadow-xl hover:-translate-y-1 duration-300 relative overflow-hidden group">
      <div className={`absolute top-0 left-0 w-1 h-full ${color}`}></div>
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs uppercase text-slate-400 font-bold tracking-wider">{label}</span>
        <span className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/5 text-slate-300"><Icon size={18} strokeWidth={1.8} /></span>
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

const DEFAULT_PROFILE_FORM = {
  age: '', sex: 'male', height: '', weight: '', activity_level: 'sedentary',
  diet_type: 'non-veg', goal: 'maintain', target_weight_kg: '',
  routine_timezone: 'Asia/Kolkata', wake_time: '06:30', work_start_time: '09:00',
  work_end_time: '18:00', breakfast_time: '08:00', lunch_time: '13:00',
  snack_time: '16:30', dinner_time: '20:00', sleep_time: '22:30',
};

const APP_TABS = [
  { id: 'home', Icon: Home, label: 'Home' },
  { id: 'coach', Icon: MessageCircle, label: 'Coach' },
  { id: 'train', Icon: Dumbbell, label: 'Train' },
  { id: 'insights', Icon: BarChart3, label: 'Insights' },
  { id: 'profile', Icon: User2, label: 'Profile' },
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

function InsightsTab({ data, loading, days, onDaysChange }) {
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

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div><p className="text-xs font-bold uppercase tracking-[.22em] text-green-600">Patterns over time</p><h2 className="mt-2 text-3xl font-extrabold tracking-tight">Your insights</h2><p className="mt-2 text-sm text-slate-400">Nutrition, weigh-ins and workouts from your local logs, grouped by India Standard Time.</p></div>
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
            <div className="glass-card p-5"><p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Workouts</p><p className="mt-3 text-3xl font-extrabold text-violet-300">{summary.workout_minutes || 0}<span className="ml-2 text-xs text-slate-500">minutes</span></p><p className="mt-2 text-xs text-slate-500">{summary.workout_count || 0} sessions in this period</p></div>
          </div>

          <section className="glass-card p-5 md:p-7">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><h3 className="text-lg font-extrabold">Calories by day</h3><p className="mt-1 text-xs text-slate-500">The line marks your current profile target. Empty days are not counted as zero intake.</p></div><span className="text-xs font-semibold text-orange-300">Orange bars · intake</span></div>
            {caloriesLogged ? <div className="w-full overflow-x-auto"><svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="min-w-[640px] w-full" role="img" aria-label="Daily calories compared with your target">
              <title>Daily calories compared with your calorie target</title>
              {[0, 0.5, 1].map(tick => { const y = chartTop + plotHeight * tick; return <g key={tick}><line x1={chartLeft} x2={chartWidth - chartRight} y1={y} y2={y} stroke="rgba(255,255,255,.09)"/><text x={chartLeft - 8} y={y + 4} textAnchor="end" fill="#8490AA" fontSize="10">{Math.round(calorieMaximum * (1 - tick))}</text></g>; })}
              {summary.calorie_target > 0 && <><line x1={chartLeft} x2={chartWidth - chartRight} y1={calorieY(summary.calorie_target)} y2={calorieY(summary.calorie_target)} stroke="#34F5C5" strokeWidth="2" strokeDasharray="6 5"/><text x={chartWidth - chartRight} y={calorieY(summary.calorie_target) - 7} textAnchor="end" fill="#34F5C5" fontSize="10">Target {summary.calorie_target}</text></>}
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

          <div className="grid gap-6 xl:grid-cols-[1.2fr_.8fr]">
            <section className="glass-card p-5 md:p-7">
              <div className="mb-5 flex items-end justify-between gap-3"><div><h3 className="text-lg font-extrabold">Weight trend</h3><p className="mt-1 text-xs text-slate-500">Only days with a weigh-in are plotted.</p></div>{summary.weight_change_kg != null && <span className={`text-sm font-extrabold ${summary.weight_change_kg <= 0 ? 'text-emerald-300' : 'text-amber-300'}`}>{summary.weight_change_kg > 0 ? '+' : ''}{summary.weight_change_kg.toFixed(1)} kg</span>}</div>
              {weightPoints.length >= 2 ? <div className="w-full overflow-x-auto"><svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="min-w-[540px] w-full" role="img" aria-label="Weight trend from recorded weigh-ins">
                <title>Weight trend</title>
                {[0, 0.5, 1].map(tick => { const y = chartTop + plotHeight * tick; const value = weightMax - ((weightMax - weightMin) * tick); return <g key={tick}><line x1={chartLeft} x2={chartWidth - chartRight} y1={y} y2={y} stroke="rgba(255,255,255,.09)"/><text x={chartLeft - 8} y={y + 4} textAnchor="end" fill="#8490AA" fontSize="10">{value.toFixed(1)}</text></g>; })}
                <polyline points={weightPoints.map(point => `${point.x},${point.y}`).join(' ')} fill="none" stroke="#34F5C5" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round"/>
                {weightPoints.map(point => <g key={`${point.item.date}-${point.x}`}><circle cx={point.x} cy={point.y} r="5" fill="#34F5C5" stroke="#08111D" strokeWidth="2"><title>{point.item.date}: {point.item.weight_kg} kg</title></circle></g>)}
                {daily.map((day, index) => index % labelEvery === 0 && <text key={day.date} x={chartLeft + index * barStep + barStep / 2} y={chartHeight - 10} textAnchor="middle" fill="#8490AA" fontSize="9">{days > 14 ? day.date.slice(8) : day.day}</text>)}
              </svg></div> : <p className="rounded-xl bg-slate-900/40 p-8 text-center text-sm text-slate-400">Add at least two weigh-ins in Home to see a trend line.</p>}
            </section>

            <section className="glass-card p-5 md:p-7">
              <h3 className="text-lg font-extrabold">Daily check-in</h3><p className="mt-1 text-xs text-slate-500">Recent days · IST</p>
              <div className="mt-4 max-h-[330px] space-y-2 overflow-y-auto pr-1">
                {[...daily].reverse().map(day => <div key={day.date} className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-slate-900/30 px-3 py-3">
                  <div className="min-w-0"><p className="text-xs font-bold">{new Date(`${day.date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</p><p className="mt-1 truncate text-[10px] text-slate-500">{day.workout_count ? `${day.workout_count} workout · ${day.workout_minutes} min` : day.water_ml ? `${(day.water_ml / 1000).toFixed(1)} L water` : 'No activity logged'}</p></div>
                  <span className="shrink-0 text-xs font-extrabold text-orange-300">{day.calories ? `${Math.round(day.calories)} kcal` : '—'}</span>
                </div>)}
              </div>
              <div className="mt-4 rounded-xl bg-slate-900/40 p-4"><p className="text-[10px] uppercase tracking-wider text-slate-500">Average water on logged days</p><p className="mt-1 text-lg font-extrabold text-cyan-300">{summary.average_water_ml ? `${(summary.average_water_ml / 1000).toFixed(2)} L/day` : 'No water logs yet'}</p></div>
            </section>
          </div>
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

function ProfileTab({ form, updateField, profile, weeklyPlan, planLoading, saving, onSave, onSuggestTimes }) {
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
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.22em] text-green-600">Personal health plan · IST</p>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight">Profile & routine</h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">Add your measurements, goal and usual schedule. The app uses them to estimate daily targets and shape a practical starter week.</p>
        </div>
        <button onClick={onSave} disabled={saving} className="rounded-xl bg-green-500 px-6 py-3 text-sm font-extrabold text-slate-950 disabled:opacity-60">
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
                { label: 'BMR · resting estimate', value: profile.bmr, unit: 'kcal/day', tone: 'text-violet-300' },
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
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [profForm, setProfForm] = useState({ ...DEFAULT_PROFILE_FORM });
  const [profileDirty, setProfileDirty] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [weeklyPlan, setWeeklyPlan] = useState(null);
  const [weeklyPlanLoading, setWeeklyPlanLoading] = useState(false);
  const [insightDays, setInsightDays] = useState(7);
  const [insightData, setInsightData] = useState(null);
  const [insightsLoading, setInsightsLoading] = useState(false);

  const [aiChips, setAiChips] = useState([]);
  const [isParsing, setIsParsing] = useState(false);

  const [chatMessages, setChatMessages] = useState([{ role: 'coach', text: "Hello! I'm your AI Health Coach. How can I help you today?" }]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatAbortRef = useRef(null);

  const [workoutPlan, setWorkoutPlan] = useState(null);
  const [workoutLoading, setWorkoutLoading] = useState(false);
  const [workoutPrefs, setWorkoutPrefs] = useState({ equipment: 'Gym', duration: '45' });
  const [trainView, setTrainView] = useState('planner');
  const [workoutTemplates, setWorkoutTemplates] = useState([]);
  const [exerciseLibrary, setExerciseLibrary] = useState([]);
  const [exerciseQuery, setExerciseQuery] = useState('');
  const [exerciseGroup, setExerciseGroup] = useState('Any');
  const [workoutSessions, setWorkoutSessions] = useState([]);
  const [activeWorkout, setActiveWorkout] = useState(null);
  const [workoutElapsed, setWorkoutElapsed] = useState(0);
  const [workoutSaving, setWorkoutSaving] = useState(false);

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

  const addWater = async (amount = Number(waterAmount)) => {
    try { await axios.post(`${API_BASE}/tracking/water`, { amount_ml: amount }); await loadAllData(); notify(`${amount} ml water logged.`); }
    catch (e) { notify(e.response?.data?.detail || 'Could not log water.', 'error'); }
  };

  const addWeight = async () => {
    const value = Number(weightInput);
    if (!value || value <= 0) { notify('Enter a valid weight in kilograms.', 'error'); return; }
    try { await axios.post(`${API_BASE}/tracking/weight`, { weight_kg: value }); setWeightInput(''); await loadAllData(); notify('Weight entry saved.'); }
    catch (e) { notify(e.response?.data?.detail || 'Could not save weight.', 'error'); }
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
        const basis = res.data.source === 'database' ? 'I matched this to the local food catalog' : 'I estimated the nutrition';
        setFoodMessages(prev => [...prev, { role: 'assistant', text: `${basis} for ${res.data.food_description}. Please review the values below before saving.` }]);
      }
    } catch (e) {
      const detail = e.response?.data?.detail || 'I could not estimate that just now. Please try again.';
      setFoodMessages(prev => [...prev, { role: 'assistant', text: detail }]);
      notify(detail, 'error');
    } finally { setFoodThinking(false); }
  };

  const saveFoodDraft = async () => {
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
      setFoodMessages([]); setFoodContext(''); setFoodDraft(null); setAiChips([]);
      notify('Nutrition saved and added to today’s totals.');
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
          if (last?.role === 'coach') next[next.length - 1] = { ...last, text: e.message || 'Sorry, I could not connect to the coach. Please try again.' };
          return next;
        });
      }
    } finally {
      chatAbortRef.current = null;
      setChatLoading(false);
    }
  };

  const generateWorkout = async () => {
    setWorkoutLoading(true);
    setWorkoutPlan(null);
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
    try {
      const [templatesRes, exercisesRes, sessionsRes] = await Promise.all([
        axios.get(`${API_BASE}/workouts/templates?equipment=${encodeURIComponent(workoutPrefs.equipment)}`),
        axios.get(`${API_BASE}/exercises`),
        axios.get(`${API_BASE}/workouts/sessions?limit=10`)
      ]);
      setWorkoutTemplates(templatesRes.data);
      setExerciseLibrary(exercisesRes.data);
      setWorkoutSessions(sessionsRes.data);
    } catch (e) {
      console.error('Workout data loading error:', e);
      notify('Could not load workout library.', 'error');
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
      exercises: plan.exercises.map(exercise => ({
        ...exercise,
        completed: false,
        actualSets: Array.from({ length: Math.max(1, Math.min(Number(exercise.sets) || 1, 8)) }, () => ({ reps: '', weight: '', rpe: '' }))
      }))
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

  const filteredExercises = exerciseLibrary.filter(exercise => {
    const matchesQuery = !exerciseQuery || `${exercise.name} ${exercise.instructions} ${exercise.muscle_group}`.toLowerCase().includes(exerciseQuery.toLowerCase());
    return matchesQuery && (exerciseGroup === 'Any' || exercise.muscle_group === exerciseGroup);
  });

  useEffect(() => { loadFoodCollections(); }, []);

  return (
    <div className="app-shell min-h-screen bg-[#FBFBFF] font-poppins text-slate-900">
      <header className="bg-white/70 backdrop-blur-md border-b border-slate-100 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between">
          <button type="button" aria-label="Open profile" className="group flex items-center gap-3 sm:gap-4 bg-transparent p-0 text-left shadow-none" onClick={() => { setActiveTab('profile'); setShowLogPage(false); }}>
            <img src="/brand-mark.svg" alt="" width="48" height="48" className="h-10 w-10 sm:h-12 sm:w-12 rounded-2xl shadow-lg transition-transform group-hover:scale-105 duration-300" />
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
              className="space-y-10"
            >
              <div className="flex items-center gap-4 mb-6">
                <button aria-label="Back to Home" onClick={() => setShowLogPage(false)} className="p-3 rounded-full bg-white shadow-sm border border-slate-100 text-slate-600 hover:bg-slate-50 transition-all hover:scale-110"><ArrowLeft size={19} /></button>
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
                  <div className="absolute top-0 right-0 p-4 opacity-[.08]"><Salad size={78} strokeWidth={1.25} /></div>
                  <div className="flex items-center gap-2 text-green-700">
                    <Sparkles size={20} strokeWidth={1.8} />
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
                        {foodThinking && <div className="flex items-center gap-3 rounded-2xl bg-white/90 border border-green-100 px-4 py-3 text-sm text-slate-600 shadow-sm" role="status" aria-live="polite"><i className="w-4 h-4 shrink-0 rounded-full border-2 border-green-500/25 border-t-green-600 animate-spin"/><span>Understanding the food, checking the portion, and estimating nutrition…</span></div>}
                      </div>
                    )}
                    {foodDraft && (
                      <div className="w-full max-w-xl rounded-2xl bg-white p-5 border border-green-100 shadow-sm">
                        <div className="flex items-start justify-between gap-3 mb-4">
                          <div><p className="text-sm font-bold text-slate-800">Nutrition estimate</p><p className="text-xs text-slate-500 mt-1">Estimated for {foodDraft.food_description}</p></div>
                          <span className={`text-[10px] uppercase tracking-wide rounded-full px-2 py-1 ${foodDraft.source === 'database' ? 'bg-emerald-50 text-emerald-700' : foodDraft.source === 'user-edited' ? 'bg-sky-50 text-sky-700' : 'bg-amber-50 text-amber-700'}`}>{foodDraft.source === 'database' ? 'Local catalog' : foodDraft.source === 'user-edited' ? 'Edited by you' : 'AI estimate'}</span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                          {['calories', 'protein', 'carbs', 'fats', 'fiber'].map((key) => (
                            <label key={key} className="text-[10px] uppercase tracking-wide text-slate-500 font-bold">{key === 'calories' ? 'kcal' : `${key} (g)`}
                              <input type="number" min="0" step="0.1" value={foodDraft[key]} onChange={e => setFoodDraft(prev => ({ ...prev, [key]: e.target.value, source: 'user-edited', food_item_id: null }))} className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 text-sm text-slate-800 outline-none focus:border-green-400" />
                            </label>
                          ))}
                        </div>
                        <p className="mt-3 text-xs text-slate-500">{foodDraft.source === 'database' ? 'Scaled from your local food catalog serving; edit any value if needed.' : foodDraft.source === 'user-edited' ? 'You changed this estimate. The saved entry will be marked as user-edited.' : 'AI estimate for the described portion. Review and adjust before saving.'}</p>
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
                          {foodThinking ? <i className="w-5 h-5 rounded-full border-2 border-white/40 border-t-white animate-spin" aria-label="Thinking"/> : '↑'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="flex items-center gap-2 text-slate-800">
                    <Search size={21} strokeWidth={1.8} />
                    <span className="text-sm font-bold uppercase tracking-widest">Nutrition Database</span>
                  </div>
                  <div className="flex flex-wrap gap-2" role="tablist" aria-label="Food lists">
                    {[['search', 'Search'], ['favorites', '★ Favorites'], ['recent', 'Recent']].map(([mode, label]) => (
                      <button key={mode} role="tab" aria-selected={foodListMode === mode}
                        onClick={() => { setFoodListMode(mode); setSelectedFood(null); }}
                        className={`rounded-full px-4 py-2 text-xs font-bold transition-colors ${foodListMode === mode ? 'bg-emerald-600 text-white shadow-md shadow-emerald-200' : 'bg-white text-slate-500 border border-slate-200 hover:border-emerald-300'}`}>
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
                      placeholder="Search foods: roti, chapati, dahi, kela…"
                      className="w-full p-4 pl-12 bg-white rounded-2xl border border-slate-100 shadow-sm outline-none text-sm focus:border-green-300 transition-all"
                    />
                    <span className="absolute left-4 top-4 text-slate-400">{searchLoading ? <i className="block w-4 h-4 rounded-full border-2 border-green-500/30 border-t-green-500 animate-spin"/> : <Search size={17} strokeWidth={1.8} />}</span>
                  </div>
                  <div className="max-h-[400px] overflow-y-auto space-y-3 pr-2">
                    {(searchLoading || foodCollectionsLoading) && <div className="flex items-center justify-center gap-3 text-slate-400 text-sm py-10"><i className="w-4 h-4 rounded-full border-2 border-green-500/30 border-t-green-500 animate-spin"/>{searchLoading ? 'Searching nutrition database…' : 'Loading your food lists…'}</div>}
                    {!searchLoading && !foodCollectionsLoading && foodRows.length === 0 && (
                      <div className="text-center text-slate-400 text-sm py-10">
                        {foodListMode === 'search' && searchQuery.length >= 2 ? 'No foods found. Try another name or log the food manually.' : foodListMode === 'favorites' ? 'Your favorite foods will show up here. Tap the star on a food to save it.' : foodListMode === 'recent' ? 'Foods you choose from the catalog will appear here after you log them.' : 'Search for a food, or choose Favorites or Recent.'}
                      </div>
                    )}
                    {foodRows.map(food => (
                      <div 
                        key={food.id} 
                        onClick={() => selectFood(food)}
                        className="p-4 bg-white rounded-2xl border border-slate-100 hover:border-green-300 cursor-pointer transition-all flex justify-between items-center shadow-sm group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="grid h-8 w-8 place-items-center rounded-lg bg-slate-50 text-rose-300 group-hover:bg-green-50 transition-colors"><Apple size={16} strokeWidth={1.8} /></div>
                          <div>
                            <p className="text-sm font-bold text-slate-800">{food.name}</p>
                            <p className="text-xs text-slate-400">{food.serving_size} · {food.source_version ? `USDA FDC ${food.source_version}` : food.source || 'Local estimate'}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-slate-700">{food.calories} kcal</p>
                          <p className="text-[10px] text-slate-400 uppercase font-bold">P:{food.protein}g C:{food.carbs}g F:{food.fats}g · Fiber:{food.fiber || 0}g</p>
                        </div>
                        <button type="button" aria-label={favoriteFoods.some(item => item.id === food.id) ? `Remove ${food.name} from favorites` : `Add ${food.name} to favorites`}
                          onClick={event => toggleFoodFavorite(food, event)}
                          className={`ml-3 rounded-full p-2 text-lg transition-colors ${favoriteFoods.some(item => item.id === food.id) ? 'text-amber-500 hover:bg-amber-50' : 'text-slate-300 hover:bg-amber-50 hover:text-amber-500'}`}>
                          {favoriteFoods.some(item => item.id === food.id) ? '★' : '☆'}
                        </button>
                      </div>
                    ))}
                  </div>

                  {selectedFood && (
                    <div className="glass-card p-5 space-y-4">
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
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6 bg-white p-5 sm:p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                    <div className="space-y-1">
                      <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Welcome back!</h2>
                      <p className="text-sm text-slate-500 font-medium">Here's your health snapshot for today.</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-2xl border border-slate-100">
                      <button onClick={() => {
                        const d = new Date(selectedDate);
                        d.setDate(d.getDate() - 1);
                        setSelectedDate(d.toISOString().split('T')[0]);
                      }} aria-label="Previous day" className="p-2 text-slate-400 hover:text-green-600 transition-colors"><ArrowLeft size={17} /></button>
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
                      }} aria-label="Next day" className="p-2 text-slate-400 hover:text-green-600 transition-colors"><ChevronDown size={17} className="-rotate-90" /></button>
                      </div>
                      <button onClick={() => setShowLogPage(true)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-green-500 px-4 py-3 text-sm font-extrabold text-slate-950"><Plus size={17} />Log food</button>
                    </div>
                  </div>

                  <details className="nutrition-accordion glass-card">
                    <summary className="nutrition-accordion-summary">
                      <span className="nutrition-summary-icon"><Flame size={19} strokeWidth={1.8} /></span>
                      <span className="min-w-0 flex-1"><span className="block text-sm font-extrabold">Nutrition today</span><span className="mt-1 block truncate text-xs text-slate-500">{Math.round(summary.total_calories)} kcal logged{profile?.calorie_target ? ` · ${Math.max(0, Math.round(profile.calorie_target - summary.total_calories))} kcal to target` : ' · set up a profile for a target'}</span></span>
                      <span className="hidden sm:block text-xs font-semibold text-slate-500">Calories · protein · carbs · fats · fiber</span>
                      <ChevronDown size={19} className="nutrition-chevron" />
                    </summary>
                    <div className="nutrition-accordion-content grid grid-cols-2 md:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-5">
                      <MacroCard label="Calories" value={summary.total_calories} target={profile?.calorie_target || 2000} unit="kcal" color="bg-[#FF8A65]" icon={Flame} />
                      <MacroCard label="Protein" value={summary.total_protein} target={profile?.protein_target || 100} unit="g" color="bg-[#34F5C5]" icon={Dumbbell} />
                      <MacroCard label="Carbs" value={summary.total_carbs} target={profile?.carb_target || 200} unit="g" color="bg-[#38BDF8]" icon={Wheat} />
                      <MacroCard label="Fats" value={summary.total_fats} target={profile?.fat_target || 60} unit="g" color="bg-[#FBBF24]" icon={Droplets} />
                      <MacroCard label="Fiber" value={summary.total_fiber} target={28} unit="g" color="bg-[#A78BFA]" icon={Sprout} />
                    </div>
                  </details>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <section className="glass-card p-6 space-y-4">
                      <div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-widest text-slate-500">Hydration</p><p className="text-3xl font-extrabold mt-2">{(tracking.water_total_ml / 1000).toFixed(2)}<span className="text-sm text-slate-400 ml-2">L today</span></p></div><Droplets size={26} className="text-cyan-300" strokeWidth={1.7} /></div>
                      <div className="flex flex-wrap gap-2">{[150, 250, 500].map(amount => <button key={amount} onClick={() => addWater(amount)} className="glass-chip px-4 py-2 text-sm font-bold text-cyan-200">+{amount} ml</button>)}</div>
                      <div className="flex gap-2"><input aria-label="Custom water amount in milliliters" type="number" min="1" value={waterAmount} onChange={e => setWaterAmount(e.target.value)} className="min-w-0 flex-1 rounded-xl border px-3 py-2"/><button onClick={() => addWater()} className="rounded-xl bg-green-500 px-4 py-2 text-sm font-bold">Log water</button></div>
                    </section>
                    <section className="glass-card p-6 space-y-4">
                      <div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-widest text-slate-500">Weight</p><p className="text-3xl font-extrabold mt-2">{tracking.latest_weight_kg ? `${tracking.latest_weight_kg.toFixed(1)}` : '—'}<span className="text-sm text-slate-400 ml-2">kg latest this day</span></p></div><Scale size={26} className="text-violet-300" strokeWidth={1.7} /></div>
                      <div className="flex gap-2"><input aria-label="Weight in kilograms" type="number" min="1" max="700" step="0.1" placeholder="Weight in kg" value={weightInput} onChange={e => setWeightInput(e.target.value)} className="min-w-0 flex-1 rounded-xl border px-3 py-2"/><button onClick={addWeight} className="rounded-xl bg-green-500 px-4 py-2 text-sm font-bold">Save weight</button></div>
                      <p className="text-xs text-slate-500">{tracking.weight_logs.length} weigh-in{tracking.weight_logs.length === 1 ? '' : 's'} recorded for this day.</p>
                    </section>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                    <div className="lg:col-span-2 space-y-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xl font-bold text-slate-800 tracking-tight">Daily Activity Log</h3>
                        <button 
                          onClick={() => setShowLogPage(true)}
                          className="bg-green-500 text-white px-6 py-3 rounded-full font-bold shadow-lg shadow-green-200 hover:bg-green-600 transition-all flex items-center gap-2 text-sm hover:scale-105 active:scale-95"
                        >
                          <Plus size={18} /> Log Food
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
                            <Salad size={44} className="mx-auto mb-5 text-emerald-300" strokeWidth={1.5} />
                            <p className="text-lg font-medium mb-2">No logs for this date.</p>
                            <p className="text-sm opacity-70">Time to fuel up your body!</p>
                          </div>
                        ) : (
                          logs.map(log => (
                            <motion.div key={log.id} layout className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex items-center justify-between hover:border-green-200 transition-all group">
                              <div className="flex items-center gap-4">
                                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-50 text-slate-400 group-hover:bg-green-50 transition-colors"><Activity size={19} strokeWidth={1.8} /></div>
                                <div>
                                  <p className="text-sm font-bold text-slate-800">{log.note || log.category}</p>
                                  <p className="text-[11px] text-slate-400 font-medium">{new Date(log.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} • {log.source}</p>
                                  {log.category === 'nutrition' && <p className="text-[11px] text-slate-500 mt-1">P {Number(log.protein || 0).toFixed(1)}g · C {Number(log.carbs || 0).toFixed(1)}g · F {Number(log.fats || 0).toFixed(1)}g · Fiber {Number(log.fiber || 0).toFixed(1)}g</p>}
                                </div>
                              </div>
                              <div className="flex items-center gap-6">
                                {log.calories > 0 && <span className="text-sm font-extrabold text-slate-700">{log.calories} kcal</span>}
                                <button aria-label={`Delete ${log.note || log.category}`} onClick={() => deleteLog(log.id)} className="text-slate-300 hover:text-red-400 transition-colors"><X size={17} /></button>
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
                />
              )}

              {activeTab === 'coach' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="coach-page max-w-3xl mx-auto flex flex-col">
                  <div className="flex-1 overflow-y-auto space-y-4 mb-6 px-4">
                    {chatMessages.map((msg, i) => (
                      <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] p-4 rounded-2xl text-sm ${msg.role === 'user' ? 'bg-green-500 text-white rounded-tr-none shadow-md' : 'bg-white border border-slate-100 text-slate-800 rounded-tl-none shadow-sm'}`}>
                          {msg.text}
                        </div>
                      </div>
                    ))}
                    {chatLoading && <div className="flex items-center gap-3 px-4 py-2 text-sm text-slate-400" role="status" aria-live="polite"><span className="flex gap-1"><i className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce [animation-delay:-0.2s]"/><i className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce [animation-delay:-0.1s]"/><i className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce"/></span>Coach is replying…</div>}
                  </div>
                  <div className="flex gap-3 p-3 bg-white rounded-full border border-slate-100 shadow-xl">
                    <input 
                      value={chatInput} 
                      onChange={e => setChatInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleChat())}
                      disabled={chatLoading}
                      placeholder="Ask your coach about nutrition or training..." 
                      className="flex-1 bg-transparent px-4 py-2 text-sm outline-none"
                    />
                    {chatLoading ? <button onClick={stopChat} aria-label="Stop AI response" className="shrink-0 px-5 h-12 rounded-full bg-rose-500 text-white text-sm font-bold hover:bg-rose-600 transition-colors shadow-lg shadow-rose-200">■ Stop</button> : <button onClick={handleChat} disabled={!chatInput.trim()} aria-label="Send message" className="bg-green-500 text-white w-12 h-12 rounded-full flex items-center justify-center font-bold hover:bg-green-600 transition-all shadow-lg shadow-green-200 disabled:opacity-40 disabled:shadow-none">↑</button>}
                  </div>
                </motion.div>
              )}

              {activeTab === 'train' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="max-w-4xl mx-auto space-y-10">
                  <div className="flex flex-wrap gap-2 rounded-2xl bg-white p-2 border border-slate-100 shadow-sm" role="tablist" aria-label="Workout sections">
                    {[["planner", "Planner"], ["library", "Exercise library"], ["history", "History"]].map(([view, label]) => (
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

                  {trainView === 'planner' && <>
                    <div className="bg-white p-5 sm:p-8 lg:p-12 rounded-[2.5rem] shadow-sm border border-slate-100 text-center space-y-6 sm:space-y-8">
                      <div>
                        <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight">Workout Planner</h2>
                        <p className="text-slate-500 max-w-lg mx-auto mt-3">Choose a ready-made routine or ask the local AI to create a plan from the exercise library.</p>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto text-left">
                        <label className="space-y-2 block text-xs font-bold text-slate-400 uppercase tracking-wider">Equipment
                          <select value={workoutPrefs.equipment} onChange={e => setWorkoutPrefs({...workoutPrefs, equipment: e.target.value})} className="mt-2 w-full p-4 bg-slate-50 rounded-2xl border border-slate-100 outline-none text-sm text-slate-800 normal-case">
                            <option value="Gym">Gym</option><option value="Home">Home</option><option value="Dumbbells">Dumbbells only</option><option value="None">Bodyweight</option>
                          </select>
                        </label>
                        <label className="space-y-2 block text-xs font-bold text-slate-400 uppercase tracking-wider">Duration (minutes)
                          <input type="number" min="10" max="180" value={workoutPrefs.duration} onChange={e => setWorkoutPrefs({...workoutPrefs, duration: e.target.value})} className="mt-2 w-full p-4 bg-slate-50 rounded-2xl border border-slate-100 outline-none text-sm text-slate-800" />
                        </label>
                      </div>
                      <button onClick={generateWorkout} disabled={workoutLoading} className="px-10 py-4 bg-green-500 text-white rounded-full font-extrabold shadow-xl shadow-green-200 hover:bg-green-600 transition-all disabled:bg-slate-300">
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
                            <button onClick={() => { setWorkoutPlan(template); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="mt-auto rounded-xl bg-emerald-50 text-emerald-800 px-4 py-3 text-sm font-bold hover:bg-emerald-100">Preview routine</button>
                          </article>
                        ))}
                        {!workoutTemplates.length && <p className="text-sm text-slate-400">Loading templates…</p>}
                      </div>
                    </section>

                    {workoutPlan && (
                      <section className="rounded-[2rem] bg-white p-7 sm:p-10 border border-slate-100 shadow-sm space-y-6">
                        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-5">
                          <div><h3 className="text-2xl font-extrabold text-slate-900">{workoutPlan.workout_name}</h3><p className="mt-2 text-sm text-slate-500">{workoutPlan.reasoning}</p></div>
                          <span className="rounded-full bg-emerald-50 text-emerald-700 px-3 py-1.5 text-xs font-bold">{workoutPlan.source === 'template' ? 'Template' : 'AI plan'}</span>
                        </div>
                        {workoutPlan.warm_up && <p className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900"><b>Warm-up:</b> {workoutPlan.warm_up}</p>}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {workoutPlan.exercises?.map((ex, i) => (
                            <article key={`${ex.exercise_id}-${i}`} className="rounded-2xl bg-slate-50 p-5 border border-slate-100">
                              <div className="flex justify-between gap-3"><div><p className="font-bold text-slate-800">{ex.name}</p><p className="text-xs text-slate-500 mt-1">{ex.sets} sets · {ex.reps} reps · rest {ex.rest}</p></div><span className="text-xs rounded-full bg-white px-3 py-1 h-fit font-bold text-slate-600">RPE {ex.rpe}</span></div>
                              {ex.instructions && <p className="mt-3 text-xs leading-relaxed text-slate-500">{ex.instructions}</p>}
                            </article>
                          ))}
                        </div>
                        {!activeWorkout ? <button onClick={() => startWorkout(workoutPlan)} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-extrabold shadow-lg hover:bg-slate-800">Start workout</button> : <p className="text-center text-sm font-bold text-emerald-700">A workout session is already in progress.</p>}
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
                              <div className="mt-4 space-y-2">
                                {exercise.actualSets.map((set, setIndex) => (
                                  <div key={setIndex} className="workout-set-row grid grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-2">
                                    <span className="text-xs font-bold text-slate-400">Set {setIndex + 1}</span>
                                    <input type="number" min="0" max="1000" step="1" value={set.reps} onChange={e => updateWorkoutSet(exerciseIndex, setIndex, 'reps', e.target.value)} placeholder="Reps" aria-label={`${exercise.name} set ${setIndex + 1} reps`} className="w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"/>
                                    <input type="number" min="0" max="2000" step="0.5" value={set.weight} onChange={e => updateWorkoutSet(exerciseIndex, setIndex, 'weight', e.target.value)} placeholder="Load kg" aria-label={`${exercise.name} set ${setIndex + 1} load in kilograms`} className="w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"/>
                                    <input type="number" min="1" max="10" step="1" value={set.rpe} onChange={e => updateWorkoutSet(exerciseIndex, setIndex, 'rpe', e.target.value)} placeholder="RPE" aria-label={`${exercise.name} set ${setIndex + 1} effort`} className="w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"/>
                                  </div>
                                ))}
                              </div>
                            </article>
                          ))}
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3"><button onClick={completeWorkout} disabled={workoutSaving} className="flex-1 rounded-xl bg-emerald-600 px-5 py-4 text-sm font-extrabold text-white disabled:opacity-60">{workoutSaving ? 'Saving workout…' : 'Complete and save'}</button><button onClick={discardWorkout} disabled={workoutSaving} className="rounded-xl border border-slate-200 px-5 py-4 text-sm font-bold text-slate-500 disabled:opacity-60">Discard session</button></div>
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
                      <div className="space-y-4">{workoutSessions.map(session => <article key={session.id} className="rounded-2xl bg-white p-6 border border-slate-100 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-extrabold text-slate-900">{session.workout_type}</h3><p className="mt-1 text-xs text-slate-400">{new Date(session.date).toLocaleString()} · {session.duration_mins} min</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{session.sets.length} sets logged</span></div>{session.note && <p className="mt-3 text-sm text-slate-500">{session.note}</p>}{session.sets.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{session.sets.map((set,index) => <span key={`${session.id}-${index}`} className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">{set.exercise_name} · {set.reps} reps{set.weight != null ? ` · ${set.weight} kg` : ''}</span>)}</div>}</article>)}</div>
                    </section>
                  )}
                </motion.div>
              )}

              {activeTab === 'insights' && (
                <InsightsTab data={insightData} loading={insightsLoading} days={insightDays} onDaysChange={setInsightDays} />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <nav aria-label="Main sections" className="app-tab-nav fixed bottom-0 left-0 right-0 z-30 flex justify-center">
        <div className="tab-icon-bar">
          {APP_TABS.map(({ id, Icon, label }) => (
            <button
              key={id}
              type="button"
              aria-current={activeTab === id ? 'page' : undefined}
              onClick={() => { setActiveTab(id); setShowLogPage(false); }}
              className={`tab-icon-button flex flex-col items-center justify-center gap-1 rounded-2xl transition-all ${activeTab === id ? 'is-active text-green-600 bg-green-50 shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
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
