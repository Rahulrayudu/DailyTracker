import React from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';

const FRONT_MUSCLES = [
  { name: 'Shoulders', shape: 'M91 91 Q103 84 116 91 L110 111 Q99 115 88 106 Z M144 91 Q157 84 169 91 L172 106 Q161 115 150 111 Z' },
  { name: 'Chest', shape: 'M104 108 Q117 101 129 110 L127 143 Q113 149 101 138 Z M131 110 Q143 101 156 108 L159 138 Q147 149 133 143 Z' },
  { name: 'Biceps', shape: 'M78 116 Q87 111 92 120 L84 158 Q79 163 73 158 L68 137 Z M168 120 Q174 111 182 116 L192 137 L187 158 Q181 163 176 158 Z' },
  { name: 'Forearms', shape: 'M67 161 Q75 158 81 163 L76 197 Q71 205 64 199 L59 187 Z M179 163 Q185 158 193 161 L201 187 L196 199 Q189 205 184 197 Z' },
  { name: 'Core', shape: 'M107 146 Q129 140 153 146 L156 204 Q149 214 130 214 Q111 214 104 204 Z' },
  { name: 'Quads', shape: 'M101 267 Q115 260 128 270 L126 333 Q117 344 103 337 L96 300 Z M132 270 Q145 260 159 267 L164 300 L157 337 Q143 344 134 333 Z' },
  { name: 'Calves', shape: 'M101 349 Q112 342 122 348 L119 405 Q114 416 105 409 L99 379 Z M138 348 Q148 342 159 349 L161 379 L155 409 Q146 416 141 405 Z' },
];

const BACK_MUSCLES = [
  { name: 'Shoulders', shape: 'M91 91 Q103 84 116 91 L110 112 Q99 115 88 106 Z M144 91 Q157 84 169 91 L172 106 Q161 115 150 112 Z' },
  { name: 'Triceps', shape: 'M78 116 Q87 111 92 120 L84 158 Q79 163 73 158 L68 137 Z M168 120 Q174 111 182 116 L192 137 L187 158 Q181 163 176 158 Z' },
  { name: 'Forearms', shape: 'M67 161 Q75 158 81 163 L76 197 Q71 205 64 199 L59 187 Z M179 163 Q185 158 193 161 L201 187 L196 199 Q189 205 184 197 Z' },
  { name: 'Back', shape: 'M105 108 Q117 101 129 109 L127 178 Q117 190 105 181 L99 141 Z M131 109 Q143 101 155 108 L161 141 L155 181 Q143 190 133 178 Z' },
  { name: 'Glutes', shape: 'M101 207 Q114 199 129 207 L127 258 Q115 266 101 254 Z M132 207 Q146 199 159 207 L159 254 Q145 266 134 258 Z' },
  { name: 'Hamstrings', shape: 'M101 267 Q115 260 128 270 L126 333 Q117 344 103 337 L96 300 Z M132 270 Q145 260 159 267 L164 300 L157 337 Q143 344 134 333 Z' },
  { name: 'Calves', shape: 'M101 349 Q112 342 122 348 L119 405 Q114 416 105 409 L99 379 Z M138 348 Q148 342 159 349 L161 379 L155 409 Q146 416 141 405 Z' },
];

function BodyFigure({ side, selectedMuscle, onSelect }) {
  const regions = side === 'front' ? FRONT_MUSCLES : BACK_MUSCLES;
  const onKeyDown = (event, muscle) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(muscle);
    }
  };

  return (
    <svg className="muscle-map-figure" viewBox="0 0 260 450" role="group" aria-label={`${side === 'front' ? 'Front' : 'Back'} muscle map. Select a highlighted muscle group.`}>
      <defs>
        <linearGradient id={`body-base-${side}`} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#CBD5E1" stopOpacity=".8" />
          <stop offset="1" stopColor="#64748B" stopOpacity=".62" />
        </linearGradient>
        <linearGradient id={`body-active-${side}`} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#67F7D2" />
          <stop offset="1" stopColor="#38BDF8" />
        </linearGradient>
      </defs>
      <g fill={`url(#body-base-${side})`} stroke="#DCE6F5" strokeOpacity=".5" strokeWidth="1.5">
        <ellipse cx="130" cy="37" rx="24" ry="30" />
        <path d="M116 65h28v25h-28z" />
        <path d="M97 87 Q84 88 76 99 L65 119 L57 184 Q55 199 67 205 L82 202 L91 158 L99 139 L101 214 L87 255 L95 269 L107 266 L130 244 L153 266 L165 269 L173 255 L159 214 L161 139 L169 158 L178 202 L193 205 Q205 199 203 184 L195 119 L184 99 Q176 88 163 87 Q146 80 130 84 Q114 80 97 87Z" />
        <path d="M100 263 Q112 258 128 265 L125 333 Q121 346 103 341 L94 301Z" />
        <path d="M132 265 Q148 258 160 263 L166 301 L157 341 Q139 346 135 333Z" />
        <path d="M101 341 Q111 338 122 344 L118 408 Q116 422 105 420 Q97 419 98 407Z" />
        <path d="M138 344 Q149 338 159 341 L162 407 Q163 419 155 420 Q144 422 142 408Z" />
        <path d="M99 419 Q112 414 122 419 L124 429 Q121 434 97 433Z M140 419 Q150 414 161 419 L163 433 Q139 434 136 429Z" />
      </g>
      {regions.map(({ name, shape }) => {
        const selected = selectedMuscle === name;
        return (
          <path
            key={`${side}-${name}`}
            d={shape}
            role="button"
            tabIndex="0"
            aria-label={`Train ${name}`}
            aria-pressed={selected}
            onClick={() => onSelect(name)}
            onKeyDown={event => onKeyDown(event, name)}
            className={`muscle-map-region ${selected ? 'is-selected' : ''}`}
            fill={selected ? `url(#body-active-${side})` : 'rgba(148,163,184,.28)'}
            stroke={selected ? '#A7F3D0' : 'rgba(226,232,240,.5)'}
            strokeWidth={selected ? '1.7' : '1'}
          />
        );
      })}
      <text x="130" y="447" textAnchor="middle" className="muscle-map-caption">{side.toUpperCase()} VIEW</text>
    </svg>
  );
}

export default function MuscleMap({
  selectedMuscle,
  onSelectMuscle,
  equipment,
  onEquipmentChange,
  onBuildFocusedWorkout,
  query,
  onQueryChange,
  exercises,
  loading,
}) {
  const [side, setSide] = React.useState('front');
  const visibleExercises = exercises.filter(exercise => {
    const matchesMuscle = selectedMuscle === 'All muscles' || exercise.muscle_group === selectedMuscle;
    const matchesQuery = !query || `${exercise.name} ${exercise.instructions} ${exercise.muscle_group}`.toLowerCase().includes(query.toLowerCase());
    const matchesEquipment = equipment === 'Any' || (equipment === 'Bodyweight'
      ? ['None', 'Home'].includes(exercise.equipment)
      : equipment === 'Dumbbells'
        ? ['Dumbbells', 'None', 'Home'].includes(exercise.equipment)
        : ['Gym', 'Dumbbells', 'None', 'Home'].includes(exercise.equipment));
    return matchesMuscle && matchesQuery && matchesEquipment;
  });
  const changeSide = view => {
    setSide(view);
    const visibleGroups = view === 'front'
      ? ['Chest', 'Shoulders', 'Biceps', 'Forearms', 'Core', 'Quads', 'Calves']
      : ['Shoulders', 'Triceps', 'Forearms', 'Back', 'Glutes', 'Hamstrings', 'Calves'];
    if (selectedMuscle !== 'All muscles' && !visibleGroups.includes(selectedMuscle)) {
      onSelectMuscle(view === 'front' ? 'Chest' : 'Back');
    }
  };

  return (
    <section className="muscle-explorer space-y-5" aria-label="Explore exercises by muscle group">
      <div className="muscle-explorer-heading">
        <div>
          <span className="muscle-eyebrow">Explore training</span>
          <h2>Choose a muscle to train</h2>
          <p>Tap a muscle on the map to find exercises you can do with your equipment.</p>
        </div>
        <div className="muscle-view-toggle" role="group" aria-label="Body map view">
          {['front', 'back'].map(view => (
            <button key={view} type="button" aria-pressed={side === view} onClick={() => changeSide(view)} className={side === view ? 'is-active' : ''}>
              {view === 'front' ? 'Front' : 'Back'}
            </button>
          ))}
        </div>
      </div>

      <div className="muscle-explorer-grid">
        <div className="muscle-map-card">
          <div className="muscle-map-topline"><span>BODY MAP</span><span className="map-live-dot">INTERACTIVE</span></div>
          <BodyFigure side={side} selectedMuscle={selectedMuscle} onSelect={onSelectMuscle} />
          <div className="muscle-map-quick-picks" aria-label="Muscle group shortcuts">
            {['All muscles', ...(side === 'front' ? ['Chest', 'Shoulders', 'Biceps', 'Forearms', 'Core', 'Quads', 'Calves'] : ['Shoulders', 'Triceps', 'Forearms', 'Back', 'Glutes', 'Hamstrings', 'Calves'])].map(muscle => (
              <button key={muscle} type="button" aria-pressed={selectedMuscle === muscle} onClick={() => onSelectMuscle(muscle)} className={selectedMuscle === muscle ? 'is-active' : ''}>
                {muscle}
              </button>
            ))}
          </div>
        </div>

        <div className="muscle-results-panel">
          <div className="muscle-results-title">
            <div><span className="muscle-eyebrow">YOUR SESSION FOCUS</span><h3>{selectedMuscle}</h3></div>
            <span className="muscle-result-count">{visibleExercises.length} {visibleExercises.length === 1 ? 'exercise' : 'exercises'}</span>
          </div>
          <label className="muscle-search">
            <Search size={17} aria-hidden="true" />
            <input value={query} onChange={event => onQueryChange(event.target.value)} placeholder="Search exercises" aria-label="Search exercises" />
          </label>
          <label className="muscle-equipment-select">
            <SlidersHorizontal size={16} aria-hidden="true" />
            <span>Equipment</span>
            <select value={equipment} onChange={event => onEquipmentChange(event.target.value)} aria-label="Filter by available equipment">
              <option value="Any">Any equipment</option>
              <option value="Bodyweight">Bodyweight</option>
              <option value="Dumbbells">Dumbbells</option>
              <option value="Gym">Gym equipment</option>
            </select>
          </label>
          <div className="muscle-exercise-list" aria-live="polite">
            {loading && <p className="muscle-empty-state">Loading your exercise library…</p>}
            {!loading && visibleExercises.map(exercise => (
              <article key={exercise.id} className="muscle-exercise-card">
                <div className="muscle-exercise-heading">
                  <div><h4>{exercise.name}</h4><span>{exercise.muscle_group} · {exercise.equipment === 'None' ? 'Bodyweight' : exercise.equipment}</span></div>
                  <span className="muscle-difficulty">{exercise.difficulty}</span>
                </div>
                <p>{exercise.instructions}</p>
                {exercise.common_mistakes && <small>FORM CUE <b>{exercise.common_mistakes}</b></small>}
              </article>
            ))}
            {!loading && visibleExercises.length === 0 && <div className="muscle-empty-state"><span>No matching exercises yet</span><p>Try another muscle group or equipment filter.</p></div>}
          </div>
          <button type="button" className="muscle-build-button" onClick={() => onBuildFocusedWorkout(selectedMuscle)} disabled={loading}>
            {selectedMuscle === 'All muscles' ? 'Create a full-body AI workout' : `Build a ${selectedMuscle} AI workout`}
          </button>
        </div>
      </div>
    </section>
  );
}
