import React, { useState, useEffect, useRef, useLayoutEffect, useCallback, useMemo, useContext } from 'react';
import * as XLSX from 'xlsx';

/* =====================================================================
   DATA — update this section when the event schedule changes
   ===================================================================== */

const HISTORY = [
  {n:1,  title:"The Bud Awakens",         sub:"20,000 Governors Entered the Bronze Age",               done:"2026-08-17T00:00:00Z"},
  {n:2,  title:"Uncovering Clouds",       sub:"All Governors Explored 30,000,000 Fog Blocks Together", done:"2026-08-18T00:00:00Z"},
  {n:3,  title:"Cruel Conflict",          sub:"200,000 Barbarian Troops Were Defeated",                done:"2026-08-18T00:00:00Z"},
  {n:4,  title:"Iron Age",                sub:"4,000 Governors Entered the Iron Age",                  done:"2026-08-18T00:00:00Z"},
  {n:5,  title:"First Sanctums",          sub:"65 Sanctums Occupied For The First Time",               done:"2026-08-20T00:00:00Z"},
  {n:6,  title:"Clarion Call",            sub:"Your Alliance Defeated 40 Lvl 1+ Barbarian Forts",      done:"2026-08-24T00:00:00Z"},
  {n:7,  title:"The Family",              sub:"30 Alliances Have 65 Members",                          done:"2026-08-24T00:00:00Z"},
  {n:8,  title:"Initial Expansion",       sub:"500 Alliance Flags Built in the Kingdom",               done:"2026-08-25T00:00:00Z"},
  {n:9,  title:"Blessings of the Altars", sub:"Your Alliance Controlled an Altar at the End",          done:"2026-08-30T00:00:00Z"},
  {n:10, title:"Dark Age",                sub:"1,000 Governors Entered the Dark Age",                  done:"2026-08-30T00:00:00Z"},
  {n:11, title:"Siegecraft",              sub:"Your Alliance Defeated 100 Lvl 2+ Barbarian Forts",     done:"2026-09-03T00:00:00Z"},
  {n:12, title:"Wild Competition",        sub:"Compete to Enter the Top 20 Alliances",                 done:"2026-09-08T10:51:42Z", exact:true},
];

const ANCHOR_START = new Date("2026-09-08T10:51:42Z"); // Chapter 13 opens here

const CHAIN = [
  {n:13, title:"None Shall Pass",       sub:"Your Alliance Controlled a Level 2 Pass at the End of the Countdown", hours:120},
  {n:14, title:"Barbarian Buster",      sub:"All Governors Defeated 40,000 Lvl 18+ Barbarian Troops Together",     hours:120},
  {n:15, title:"Vanishing Threats",     sub:"Your Alliance Defeated 100 Lvl 3 or above Barbarian Forts",           hours:96,
    bonus:[{labelKey:"bonus_shrine", hoursAfter:24}]},
  {n:16, title:"Glory of the Shrines",  sub:"Your Alliance Controlled a Shrine at the End of the Countdown",      hours:168,
    bonus:[{labelKey:"bonus_level_3_pass", hoursAfter:24}]},
  {n:17, title:"Feudal Age",            sub:"200 Governors Entered the Feudal Age",                                hours:120},
  {n:18, title:"Coup de Grace",         sub:"Your Alliance Defeated 50 Lvl 4 or above Barbarian Forts",            hours:96},
  {n:19, title:"Ultimate Clarity",      sub:"Explored All Fog Blocks in the Kingdom",                              hours:48},
  {n:20, title:"The Great Empire",      sub:"8 Alliances Have 90 Members",                                         hours:240,
    bonus:[{labelKey:"bonus_lost_temple", hoursAfter:24}]},
  {n:21, title:"The Last Golden Apple", sub:"Your Alliance Controlled the Lost Temple at the End of the Countdown", hours:240},
];

// Compute start/end for every chained chapter automatically
(function buildChain(){
  let cursor = new Date(ANCHOR_START);
  CHAIN.forEach(ch => {
    ch.start = new Date(cursor);
    ch.end   = new Date(cursor.getTime() + ch.hours * 3600 * 1000);
    if (ch.bonus) {
      ch.bonus.forEach(b => { b.time = new Date(ch.end.getTime() + b.hoursAfter * 3600 * 1000); });
    }
    cursor = new Date(ch.end);
  });
})();

const SEASON_END = CHAIN[CHAIN.length - 1].end;

/* ---------- KvK 1 ---------- */
const KVK1_ESTIMATED = true; // flip to false once every date below is official

const KVK1_STAGES = [
  { n:1, titleKey:"kvk_stage_1_title", subKey:"kvk_stage_1_sub",
    start:new Date("2026-11-10T00:00:00Z"), end:new Date("2026-11-12T00:00:00Z") },
  { n:2, titleKey:"kvk_stage_2_title", subKey:"kvk_stage_2_sub",
    start:new Date("2026-11-12T00:00:00Z"), end:new Date("2026-11-14T00:00:00Z") },
  { n:3, titleKey:"kvk_stage_3_title", subKey:"kvk_stage_3_sub",
    start:new Date("2026-11-14T00:00:00Z"), end:new Date("2026-11-16T00:00:00Z") },
];

const KVK1_MAP_OPEN = {
  titleKey:"kvk_stage_4_title",
  subKey:"kvk_stage_4_sub",
  start:new Date("2026-11-16T00:00:00Z"),
  end:null,
};

/* =====================================================================
   SCHEDULE EVENTS — unchanged data, only the presentation changes
   ===================================================================== */

const EVENTS = (() => {
  const out = [];
  const START = Date.UTC(2026, 8, 28);   // Monday 28 Sep 2026 (first week in the screenshots)
  const WEEKS = 67;                      // covers 28 Sep 2026 → 9 Jan 2028
  const DAY = 86400000;

  const mighty = ['Cavalry', 'Infantry', 'Archer', 'Leadership'];
  const special      = ["Esmeralda's House", 'Armament, Reveal Thyself', "Dhalruk's Puzzle Box", 'Armament, Reveal Thyself'];
  const specialColor = ['maroon', 'purple', 'teal', 'purple'];

  // d1 / d2 = day offsets from Monday (0 = Mon ... 6 = Sun)
  const add = (title, color, weekStart, d1, d2) => out.push({
    title,
    color,
    start: toISODate(addDaysUTC(weekStart, d1)),
    end:   toISODate(addDaysUTC(weekStart, d2)),
  });

  for (let w = 0; w < WEEKS; w++) {
    const ws = new Date(START + w * 7 * DAY);

    if (w % 2 === 0) {
      // ---- Week type A: Esmeralda / Armament / Dhalruk week ----
      const k = (w / 2) % 4;
      add(special[k], specialColor[k], ws, 0, 1);
      add('Realm of Mystique',     'indigo', ws, 0, 1);
      add('AOO Registration',      'gray',   ws, 2, 4);
      add('Golden Kingdom',        'gold',   ws, 2, 4);
      add('20 Gold Head Event',    'gold',   ws, 4, 5);
      add('Egg / Hammer Event',    'teal',   ws, 4, 5);
      add('Ark of Osiris',         'gray',   ws, 5, 6);
      add('Champions of Olympia',  'gray',   ws, 5, 6);
    } else {
      // ---- Week type B: Mightiest Governor week ----
      const k = (w - 1) / 2;
      const type = mighty[k % 4];
      add(`Mightiest Governor (${type})`, 'gold',   ws, 0, 5);
      add('Ceroli Crisis',                'teal',   ws, 0, 2);
      add(`Wheel of Fortune (${type})`,   'purple', ws, 1, 3);
      add('Champions of Olympia',         'gray',   ws, 5, 6);
      if (k % 2 === 0) add('More Than Gems', 'maroon', ws, 5, 6);
    }
  }
  // Schedule cutoff: the game's data stops thinning out after Dec 2027
  const KEEP_AFTER_CUTOFF = ['Armament, Reveal Thyself', 'Realm of Mystique', 'Golden Kingdom'];
  return out.filter(e =>
    !(e.start >= '2028-01-02' && !KEEP_AFTER_CUTOFF.includes(e.title)) &&
    !(e.title === 'Champions of Olympia' && e.start > '2027-12-26')
  );
})();


// (Removed unused EVENT_COLOR_LABEL.)

function toISODate(d) { return d.toISOString().slice(0, 10); }
function parseISODate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
function addDaysUTC(d, n) { return new Date(d.getTime() + n * 86400000); }

/* =====================================================================
   COUNTER CONFIG
   ===================================================================== */

// Using Firebase for the visitor counter as well
const COUNTER_URL = 'https://xtit-dkp-tracker-default-rtdb.firebaseio.com/visitor_count.json';
const COUNTED_FLAG    = "muster_counted";
const GATE_SEEN_FLAG  = "muster_gate_seen_v2";
const POLL_MS         = 30000;

/* =====================================================================
   HELPERS
   ===================================================================== */

function fmtShort(d) {
  const opts  = {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit', hourCycle:'h23', timeZone:'UTC'};
  const parts = new Intl.DateTimeFormat('en-US', opts).formatToParts(d);
  const get   = t => (parts.find(p => p.type === t) || {}).value || '';
  return `${get('month')} ${get('day')}, ${get('hour')}:${get('minute')} UTC`;
}

// (Removed unused fmtClock helper.)

// Used for history rows where the game only shows a date, not a time.
function fmtDateOnly(d) {
  return new Intl.DateTimeFormat('en-US', {month:'short', day:'numeric', timeZone:'UTC'}).format(d) + ' UTC';
}

function fmtDayHeading(d) {
  const opts = {weekday:'long', month:'long', day:'numeric', timeZone:'UTC'};
  return new Intl.DateTimeFormat('en-US', opts).format(d);
}

// --- Rise of Kingdoms–style helpers ---
function fmtRoKTime(d) {
  const opts  = {month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hourCycle:'h23', timeZone:'UTC'};
  const parts = new Intl.DateTimeFormat('en-CA', opts).formatToParts(d);
  const get   = t => parts.find(p => p.type === t).value;
  return `${get('month')}/${get('day')} ${get('hour')}:${get('minute')}`;
}

function fmtWeekdayUpper(d) {
  return new Intl.DateTimeFormat('en-US', {weekday:'long', timeZone:'UTC'})
    .format(d)
    .toUpperCase();
}

function getCurrentChapterName(now) {
  const live = CHAIN.find(ch => now >= ch.start && now < ch.end);
  if (live) return live.title;
  if (now < CHAIN[0].start) return CHAIN[0].title;
  return CHAIN[CHAIN.length - 1].title;
}

const formatCount = n => Number(n).toLocaleString('en-US');

async function fetchCounterValue(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error('Counter request failed: ' + res.status);
  const value = await res.json();
  if (value === null || value === undefined) return 0;
  return Number(value);
}

function CountdownHTML({ ms }) {
  if (ms <= 0) return <><span className="num">0</span> minutes</>;
  const totalMinutes = Math.floor(ms / 60000);
  const days    = Math.floor(totalMinutes / 1440);
  const hours   = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const parts   = [];
  if (days) parts.push(<span key="d"><span className="num">{days}</span> {days === 1 ? "day" : "days"}</span>);
  if (hours || days) parts.push(<span key="h"><span className="num">{hours}</span> {hours === 1 ? "hour" : "hours"}</span>);
  parts.push(<span key="m"><span className="num">{minutes}</span> {minutes === 1 ? "minute" : "minutes"}</span>);
  return <>{parts.map((p, i) => <React.Fragment key={i}>{i > 0 ? ', ' : ''}{p}</React.Fragment>)}</>;
}

function Collapsible({ open, className = '', children }) {
  const ref = useRef(null);
  const [height, setHeight] = useState(0);

  useLayoutEffect(() => {
    if (ref.current) setHeight(ref.current.scrollHeight);
  }, [open, children]);

  return (
    <div
      ref={ref}
      className={`${className}${open ? ' open' : ''}`}
      style={{ maxHeight: open ? height + 'px' : null }}
    >
      {children}
    </div>
  );
}

/* small inline icon set — no external icon dependency */
const Icon = {
  pulse:   p => <svg viewBox="0 0 24 24" fill="none" {...p}><path d="M3 12h4l2.5-7L13 19l2.5-7H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  archive: p => <svg viewBox="0 0 24 24" fill="none" {...p}><rect x="3" y="4" width="18" height="4" rx="1" stroke="currentColor" strokeWidth="2"/><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8" stroke="currentColor" strokeWidth="2"/><path d="M10 13h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>,
  shield:  p => <svg viewBox="0 0 24 24" fill="none" {...p}><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/></svg>,
  calendar:p => <svg viewBox="0 0 24 24" fill="none" {...p}><rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="2"/><path d="M3 9h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>,
  users:   p => <svg viewBox="0 0 24 24" fill="none" {...p}><circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="2"/><path d="M2 20c0-3 3-5 7-5s7 2 7 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M16 4.5c1.7.3 3 1.9 3 3.5s-1.3 3.2-3 3.5M20 20c0-2.3-1.7-4.1-4-4.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>,
  chevron: p => <svg viewBox="0 0 24 24" fill="none" {...p}><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  info:    p => <svg viewBox="0 0 24 24" fill="none" {...p}><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/><path d="M12 11v5M12 8h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>,
  key:     p => <svg viewBox="0 0 24 24" fill="none" {...p}><circle cx="8" cy="15" r="4" stroke="currentColor" strokeWidth="2"/><path d="M11 12l8-8M16 4l3 3M13 7l2.5 2.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>,
  calc:    p => <svg viewBox="0 0 24 24" fill="none" {...p}><rect x="4" y="2" width="16" height="20" rx="2" stroke="currentColor" strokeWidth="2"/><path d="M8 6h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 19h.01M12 19h.01M16 19h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>,
  plus:    p => <svg viewBox="0 0 24 24" fill="none" {...p}><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>,
  close:   p => <svg viewBox="0 0 24 24" fill="none" {...p}><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>,
  menu:    p => <svg viewBox="0 0 24 24" fill="none" {...p}><path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>,
  arrowLeft: p => <svg viewBox="0 0 24 24" fill="none" {...p}><path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  arrowRight:p => <svg viewBox="0 0 24 24" fill="none" {...p}><path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  target:  p => <svg viewBox="0 0 24 24" fill="none" {...p}><circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="2"/><circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2"/><circle cx="12" cy="12" r="0.5" fill="currentColor"/></svg>,
  chat:    p => <svg viewBox="0 0 24 24" fill="none" {...p}><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  translate: p => <svg viewBox="0 0 24 24" fill="none" {...p}><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/><path d="M3 12h18" stroke="currentColor" strokeWidth="2"/><path d="M12 3c2.5 2.5 3.5 5.6 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.6-3.5-9s1-6.5 3.5-9Z" stroke="currentColor" strokeWidth="2"/></svg>,
  sparkle: p => <svg viewBox="0 0 24 24" fill="none" {...p}><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/><path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15Z" fill="currentColor"/></svg>,
  reply:   p => <svg viewBox="0 0 24 24" fill="none" {...p}><path d="M9 7l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M3 13h10a6 6 0 016 6v1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  trash:   p => <svg viewBox="0 0 24 24" fill="none" {...p}><path d="M4 7h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M10 4h4a1 1 0 011 1v2H9V5a1 1 0 011-1Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/><path d="M6 7l1 13a1 1 0 001 1h8a1 1 0 001-1l1-13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>,
  logout:  p => <svg viewBox="0 0 24 24" fill="none" {...p}><path d="M14 4h4a1 1 0 011 1v14a1 1 0 01-1 1h-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M10 8l-4 4 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M6 12h9" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>,
};

/* =====================================================================
   RISE OF KINGDOMS ICON SET — used by the Global Chat icon picker.
   All icons are hand-drawn SVG in the app's visual style — no unicode
   emojis, all fresh & thematically war/kingdom themed.
   ===================================================================== */
const RoKIcons = {
  sword: p => <svg viewBox="0 0 24 24" fill="none" {...p}><path d="M14.5 3L21 9.5l-2 2-2.5-2.5L4 21.5l-1.5-1.5L15 7.5 12.5 5l2-2Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><path d="M18 6l2 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>,
  shield: p => <svg viewBox="0 0 24 24" fill="none" {...p}><path d="M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6l8-3Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/><path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  crown: p => <svg viewBox="0 0 24 24" fill="none" {...p}><path d="M3 8l3 3 3-5 3 5 3-5 3 5 3-3v11H3V8Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg>,
  castle: p => <svg viewBox="0 0 24 24" fill="none" {...p}><path d="M3 21V9l2-2V3h3v3h2V3h3v3h2V3h3v4l2 2v12H3Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/><path d="M10 21v-5a2 2 0 014 0v5" stroke="currentColor" strokeWidth="1.6"/></svg>,
  fire: p => <svg viewBox="0 0 24 24" fill="none" {...p}><path d="M12 3c3 5 6 7 6 12a6 6 0 01-12 0c0-3 2-5 3-7 0 2 1 3 2 3 0-3-1-5 1-8Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg>,
  skull: p => <svg viewBox="0 0 24 24" fill="none" {...p}><path d="M5 11a7 7 0 0114 0c0 3-2 4-2 6H7c0-2-2-3-2-6Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/><circle cx="9" cy="11" r="1.4" fill="currentColor"/><circle cx="15" cy="11" r="1.4" fill="currentColor"/><path d="M9 20v-2M12 20v-2M15 20v-2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>,
  bow: p => <svg viewBox="0 0 24 24" fill="none" {...p}><path d="M20 4L4 20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><path d="M20 4c-6 0-12 6-12 12l4 4c6 0 12-6 12-12l-4-4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg>,
  horse: p => <svg viewBox="0 0 24 24" fill="none" {...p}><path d="M5 20l1-5 4-7 2-5 2 3h4l2 3-3 2v9h-3v-4h-4v4H5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/></svg>,
  hammer: p => <svg viewBox="0 0 24 24" fill="none" {...p}><path d="M14 3l7 7-2 2-2-1-8 8-3-3 8-8-1-2 1-3Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg>,
  gem: p => <svg viewBox="0 0 24 24" fill="none" {...p}><path d="M6 3h12l3 6-9 12L3 9l3-6Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/><path d="M3 9h18M9 3l3 6 3-6M12 9v12" stroke="currentColor" strokeWidth="1.4"/></svg>,
  chest: p => <svg viewBox="0 0 24 24" fill="none" {...p}><rect x="3" y="8" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="1.8"/><path d="M3 12h18M10 8V5a2 2 0 012-2 2 2 0 012 2v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><circle cx="12" cy="15" r="1.4" fill="currentColor"/></svg>,
  dragon: p => <svg viewBox="0 0 24 24" fill="none" {...p}><path d="M3 12c3-4 6-4 8-3 1-3 4-5 8-5l-2 3 3 1-3 2 2 3h-4c-1 3-4 5-8 5l-2 3 1-4c-2-1-3-3-3-5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/><circle cx="16" cy="9" r="0.7" fill="currentColor"/></svg>,
  helmet: p => <svg viewBox="0 0 24 24" fill="none" {...p}><path d="M4 13a8 8 0 0116 0v6l-2 2-2-2v-3h-8v3l-2 2-2-2v-6Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/><path d="M9 12h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>,
  banner: p => <svg viewBox="0 0 24 24" fill="none" {...p}><path d="M6 3v18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><path d="M6 3h13l-3 5 3 5H6" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg>,
  crossSword: p => <svg viewBox="0 0 24 24" fill="none" {...p}><path d="M4 4l16 16M20 4L4 20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><path d="M4 4l3 3M17 4l3 3M4 20l3-3M17 20l3-3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>,
  axe: p => <svg viewBox="0 0 24 24" fill="none" {...p}><path d="M12 4v17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><path d="M12 5c4 0 7 3 7 5l-3 1c-1-2-3-3-4-3V5ZM12 5C8 5 5 8 5 10l3 1c1-2 3-3 4-3V5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/></svg>,
  target: p => <svg viewBox="0 0 24 24" fill="none" {...p}><circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8"/><circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/></svg>,
  bolt: p => <svg viewBox="0 0 24 24" fill="none" {...p}><path d="M13 2L4 14h7l-1 8 9-12h-7l1-8Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg>,
  heart: p => <svg viewBox="0 0 24 24" fill="none" {...p}><path d="M12 20s-7-4.5-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.5-7 10-7 10Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg>,
  star: p => <svg viewBox="0 0 24 24" fill="none" {...p}><path d="M12 3l2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.4l6.1-.9L12 3Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg>,

  /* --- Extended RoK set --- */
  commander: p => <svg viewBox="0 0 24 24" fill="none" {...p}><path d="M5 20c0-3 3-5 7-5s7 2 7 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.8"/><path d="M8 4l4-2 4 2" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg>,

  rally: p => <svg viewBox="0 0 24 24" fill="none" {...p}><path d="M6 3v18M18 3v18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><path d="M6 4h12v8H6z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/><path d="M9 8h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>,

  peaceShield: p => <svg viewBox="0 0 24 24" fill="none" {...p}><path d="M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6l8-3Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/><path d="M9 10l2 2-2 2M15 10l-2 2 2 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>,

  speedup: p => <svg viewBox="0 0 24 24" fill="none" {...p}><circle cx="10" cy="12" r="7" stroke="currentColor" strokeWidth="1.8"/><path d="M10 8v4l3 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><path d="M19 8l3 4-3 4M17 12h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>,

  teleport: p => <svg viewBox="0 0 24 24" fill="none" {...p}><ellipse cx="12" cy="12" rx="9" ry="5" stroke="currentColor" strokeWidth="1.8"/><ellipse cx="12" cy="12" rx="5" ry="9" stroke="currentColor" strokeWidth="1.8"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/></svg>,

  hospital: p => <svg viewBox="0 0 24 24" fill="none" {...p}><path d="M12 3L3 21h18L12 3Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/><path d="M12 10v6M9 13h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>,

  scout: p => <svg viewBox="0 0 24 24" fill="none" {...p}><circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="1.8"/><circle cx="11" cy="11" r="2" stroke="currentColor" strokeWidth="1.6"/><path d="M15.5 15.5L21 21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>,

  alliance: p => <svg viewBox="0 0 24 24" fill="none" {...p}><path d="M3 8l5 2 4-3 4 3 5-2v10l-5 2-4-3-4 3-5-2V8Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/><path d="M8 10v8M16 10v8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>,

  wood: p => <svg viewBox="0 0 24 24" fill="none" {...p}><path d="M12 3l6 8h-4l4 6H6l4-6H6l6-8Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/><path d="M12 17v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>,

  food: p => <svg viewBox="0 0 24 24" fill="none" {...p}><path d="M12 21V8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><path d="M12 12c-2 0-4-2-4-5 2 0 4 2 4 5ZM12 12c2 0 4-2 4-5-2 0-4 2-4 5ZM12 17c-2 0-4-2-4-5 2 0 4 2 4 5ZM12 17c2 0 4-2 4-5-2 0-4 2-4 5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/></svg>,

  stone: p => <svg viewBox="0 0 24 24" fill="none" {...p}><path d="M5 15l2-7h10l2 7-3 4H8l-3-4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/><path d="M7 8l3 3M17 8l-3 3M12 11v8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>,

  coins: p => <svg viewBox="0 0 24 24" fill="none" {...p}><ellipse cx="12" cy="7" rx="7" ry="3" stroke="currentColor" strokeWidth="1.8"/><path d="M5 7v5c0 1.7 3.1 3 7 3s7-1.3 7-3V7" stroke="currentColor" strokeWidth="1.8"/><path d="M5 12v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5" stroke="currentColor" strokeWidth="1.8"/></svg>,

  gems: p => <svg viewBox="0 0 24 24" fill="none" {...p}><path d="M4 6h8l2 4-6 6-4-6 2-4Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/><path d="M14 8h6l2 4-6 7-4-7 2-4Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/></svg>,

  book: p => <svg viewBox="0 0 24 24" fill="none" {...p}><path d="M4 4h12a3 3 0 013 3v13H7a3 3 0 01-3-3V4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/><path d="M4 17a3 3 0 013-3h12" stroke="currentColor" strokeWidth="1.8"/><path d="M9 8h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>,

  gear: p => <svg viewBox="0 0 24 24" fill="none" {...p}><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M6 6l2 2M16 16l2 2M6 18l2-2M16 8l2-2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>,

  warDrum: p => <svg viewBox="0 0 24 24" fill="none" {...p}><ellipse cx="12" cy="9" rx="8" ry="4" stroke="currentColor" strokeWidth="1.8"/><path d="M4 9v6c0 2.2 3.6 4 8 4s8-1.8 8-4V9" stroke="currentColor" strokeWidth="1.8"/><path d="M8 5l-3 3M16 5l3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>,

  barbarian: p => <svg viewBox="0 0 24 24" fill="none" {...p}><path d="M6 8l-2-3M18 8l2-3M4 10c0 4 3 7 8 7s8-3 8-7v-1l-2-2-2 2-2-2-2 2-2-2-2 2-2-2v1Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/><circle cx="10" cy="11" r="0.9" fill="currentColor"/><circle cx="14" cy="11" r="0.9" fill="currentColor"/></svg>,

  pass: p => <svg viewBox="0 0 24 24" fill="none" {...p}><path d="M4 21V8l2-2V3h3v3h6V3h3v3l2 2v13" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/><path d="M9 21v-6a3 3 0 016 0v6" stroke="currentColor" strokeWidth="1.8"/><path d="M3 21h18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>,

  temple: p => <svg viewBox="0 0 24 24" fill="none" {...p}><path d="M12 3l9 6H3l9-6Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/><path d="M4 9h16v12H4z" stroke="currentColor" strokeWidth="1.8"/><path d="M9 21v-6h6v6" stroke="currentColor" strokeWidth="1.8"/><path d="M8 12h.01M12 12h.01M16 12h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>,

  medal: p => <svg viewBox="0 0 24 24" fill="none" {...p}><circle cx="12" cy="14" r="5" stroke="currentColor" strokeWidth="1.8"/><path d="M12 12l1 2 2 .3-1.5 1.5.4 2-1.9-1-1.9 1 .4-2L9 14.3l2-.3 1-2Z" fill="currentColor"/><path d="M8 9L5 3M16 9l3-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>,

  power: p => <svg viewBox="0 0 24 24" fill="none" {...p}><path d="M12 3v12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M6 9l6-6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M5 18h14M5 21h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>,

  hourglass: p => <svg viewBox="0 0 24 24" fill="none" {...p}><path d="M6 3h12M6 21h12M7 3v3c0 3 5 4 5 6s-5 3-5 6v3M17 3v3c0 3-5 4-5 6s5 3 5 6v3" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg>,

  ruin: p => <svg viewBox="0 0 24 24" fill="none" {...p}><path d="M5 21h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><path d="M7 21V9l5-3 5 3v12" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/><path d="M7 12l4-2M17 14l-4-2" stroke="currentColor" strokeWidth="1.4"/></svg>,
};

// Turn URLs inside a plain-text chunk into clickable <a> tags.
// Handles http://, https://, and www.-only links.
function linkifyText(text, keyPrefix) {
  if (typeof text !== 'string' || !text) return text;
  const urlRe = /((?:https?:\/\/|www\.)[^\s<>"'`]+)/gi;
  const out = [];
  let last = 0;
  let m;
  let i = 0;
  try {
    while ((m = urlRe.exec(text)) !== null) {
      if (m.index > last) out.push(text.slice(last, m.index));
      const raw = m[0];
      // Strip trailing punctuation that usually belongs to the sentence,
      // not the URL itself (e.g. "see https://x.com/foo.")
      let url = raw;
      let trailing = '';
      const trailMatch = url.match(/[.,;:!?)\]}'"]+$/);
      if (trailMatch) {
        trailing = trailMatch[0];
        url = url.slice(0, -trailing.length);
      }
      if (!url) {
        out.push(raw);
      } else {
        const href = /^www\./i.test(url) ? 'https://' + url : url;
        out.push(
          <a
            key={`${keyPrefix}-url-${i++}`}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="chat-msg-link"
            onClick={(e) => e.stopPropagation()}
          >
            {url}
          </a>
        );
        if (trailing) out.push(trailing);
      }
      last = m.index + raw.length;
    }
  } catch (e) {
    return text;
  }
  if (last < text.length) out.push(text.slice(last));
  return out.length ? out : text;
}

// Robust text renderer — never crashes, never returns undefined/empty.
// Handles:
//   • null / undefined / non-string input
//   • zero-width Unicode chars (BOM, \u200B-\u200D, \uFEFF)
//   • empty/whitespace-only strings
//   • malformed "[[icon]]" tokens
//   • clickable URLs (http://, https://, www.)
function renderMessageText(text) {
  if (text === null || text === undefined) return '';

  let str;
  try {
    str = typeof text === 'string' ? text : String(text);
  } catch (e) {
    return '';
  }
  if (!str) return '';

  // Strip zero-width / invisible characters that would render as
  // blank-looking message bubbles.
  str = str.replace(/[\u200B-\u200D\u2060\uFEFF]/g, '');

  if (!str) return '';

  const re = /\[\[([a-z][a-z0-9]*)\]\]/g;
  const parts = [];
  let last = 0;
  let m;
  let pi = 0;

  try {
    while ((m = re.exec(str)) !== null) {
      if (m.index > last) {
        parts.push(linkifyText(str.slice(last, m.index), `t${pi++}`));
      }
      const name = m[1];
      const Comp = RoKIcons[name];
      if (Comp) {
        parts.push(
          <span key={`rok-${m.index}`} className="chat-rok-icon" title={`:${name}:`} aria-label={name}>
            <Comp width={18} height={18} />
          </span>
        );
      } else {
        parts.push(m[0]);
      }
      last = m.index + m[0].length;
    }
  } catch (e) {
    return str;
  }
  if (last < str.length) {
    parts.push(linkifyText(str.slice(last), `t${pi++}`));
  }
  return parts.length ? parts : str;
}

// Quick check: does a message's text render as visually empty?
function isMessageTextEmpty(text) {
  if (text === null || text === undefined) return true;
  let str;
  try { str = typeof text === 'string' ? text : String(text); }
  catch (e) { return true; }
  if (!str) return true;
  str = str.replace(/[\u200B-\u200D\u2060\uFEFF]/g, '');
  return !str.trim();
}

/* =====================================================================
   LANGUAGES / TRANSLATIONS
   ===================================================================== */

const LANG_STORAGE_KEY = 'xtit_lang';

const LANGUAGES = [
  { code:'en', label:'English',          short:'EN', flag:'🇬🇧' },
  { code:'tr', label:'Türkçe',           short:'TR', flag:'🇹🇷' },
  { code:'vi', label:'Tiếng Việt',       short:'VI', flag:'🇻🇳' },
  { code:'ko', label:'한국어',            short:'KO', flag:'🇰🇷' },
  { code:'ja', label:'日本語',            short:'JA', flag:'🇯🇵' },
  { code:'id', label:'Bahasa Indonesia', short:'ID', flag:'🇮🇩' },
  { code:'ar', label:'العربية',          short:'AR', flag:'🇸🇦' },
  { code:'ru', label:'Русский',          short:'RU', flag:'🇷🇺' },
  { code:'pt', label:'Português',        short:'PT', flag:'🇧🇷' },
  { code:'es', label:'Español',          short:'ES', flag:'🇪🇸' },
];

const TRANSLATIONS = {
  en: {
    nav_activity:"Activity",
    activity_title:"Kingdom Activity",
    activity_tab_farms:"Farms & Alliance Help",
    activity_tab_fort:"Barbarian Fort",
    activity_upload_desc:"Upload a governor stats file to update the Farms & Alliance Help leaderboard.",
    activity_upload_btn:"Upload file",
    activity_uploading:"Reading file…",
    activity_owner_login:"Owner Login",
    activity_updated:"Data from",
    activity_no_data:"No file uploaded yet.",
    activity_no_results:"No players match your search.",
    activity_col_helps:"Alliance Help",
    activity_col_resources:"Resources Farmed",
    activity_total_helps:"Total Helps",
    activity_total_resources:"Total Resources",
    activity_players:"Players",
    activity_whole_kingdom:"Kingdom-Wide Totals",
    fort_download_btn:"Download",
    fort_download_excel:"Excel (.xlsx)",
    fort_download_csv:"CSV (.csv)",
    fort_copy_clipboard:"Copy to clipboard",
    fort_share_btn:"Share…",
    fort_copied_msg:"Copied to clipboard.",
    fort_copy_failed:"Could not copy. Try again.",
    activity_search:"Search player…",
    activity_loaded:"Loaded {count} players for {date} — everyone can now see it.",
    activity_missing_helps:" (No Alliance Helps column found — helps will show as 0.)",
    activity_missing_resources:" (No Resources Gathered column found — resources will show as 0.)",
    activity_save_failed:"Loaded locally, but could not save it for other visitors. Check your connection and try again.",
    activity_soon:"Coming Soon",
    activity_soon_note:"Barbarian Fort tracking is on the way.",
    fort_upload_desc:"Upload screenshots of the Barbarian Fort ranking. Names and fort counts are read automatically (OCR) and merged into the leaderboard.",
    fort_upload_btn:"Upload screenshots",
    fort_scanning:"Scanning {i} / {n}",
    fort_loading_engine:"Loading the scanner…",
    fort_lang_label:"Text language",
    fort_lang_all:"Auto-Detect All Languages",
    fort_lang_en:"English (Latin letters)",
    fort_lang_ja:"English + Japanese",
    fort_lang_zh:"English + Chinese",
    fort_lang_ko:"English + Korean",
    fort_lang_ru:"English + Russian",
    fort_lang_cjk:"English + Japanese + Chinese",
    fort_merge_label:"Same player in several screenshots",
    fort_merge_max:"Keep the highest number (overlapping screenshots)",
    fort_merge_add:"Add the numbers together",
    fort_scan_done:"Scanned {n} screenshot(s): {found} players read — {added} new, {updated} updated.",
    fort_scan_failed_files:" Nothing readable in: {files}.",
    fort_scan_failed:"Nothing readable in the selected screenshot(s). Try another text language.",
    fort_save_failed:"Scanned, but could not save for other visitors. Check your connection and try again.",
    fort_no_data:"No Barbarian Fort data yet.",
    fort_col_name:"Name",
    fort_col_forts:"Forts Destroyed",
    fort_edit_title:"Edit player",
    fort_name_label:"Player name",
    fort_forts_label:"Forts destroyed",
    fort_confirm_remove:"Remove \"{name}\" from the leaderboard?",
    fort_clear_btn:"Clear leaderboard",
    fort_confirm_clear:"Delete the entire Barbarian Fort leaderboard? This can't be undone.",
    fort_updated:"Last updated",
    fort_players:"players",
    fort_add_desc:"Add each governor manually — type their name and how many Barbarian Forts they destroyed. If the same governor is already on the board, the higher fort count is kept.",
    fort_add_name_placeholder:"Governor name…",
    fort_add_forts_placeholder:"Forts destroyed",
    fort_add_btn:"Add player",
    fort_added_msg:"Added {name} with {forts} fort(s).",
    fort_updated_msg:"Updated {name} — kept the higher fort count.",
    fort_add_invalid:"Please enter a valid governor name and a fort count of 0 or more.",
    fort_login_title:"Barbarian Fort — Owner Login",
    fort_login_prompt:"Enter the Barbarian Fort password to unlock the add/edit tools.",
    activity_col_helps_gained:"Helps Gained",
    activity_col_resources_gained:"Resources Gained",
    nav_overview:"Overview", nav_history:"History", nav_kvk:"KVK", nav_dkp:"DKP", nav_calendar:"Calendar", nav_calculator:"Calculator", nav_visitors:"Visitors", nav_feedback:"Feedback",
    about_toggle:"How this page works",
    about_intro:"XTiT is your all-in-one Kingdom 4161 companion — live chapter tracking, event calendars, alliance DKP, and a global chat with commanders from every alliance.",
    about_li_overview:"Overview — Live chapter tracking, countdowns, and unlock bonuses (Shrines, Level 3 Passes, Lost Temple).",
    about_li_history:"History — Every past chapter and completed milestone with its exact UTC timestamp.",
    about_li_kvk:"KVK — Kingdom vs Kingdom war-front schedule with live countdowns and stage breakdowns.",
    about_li_chat:"Global Chat — Real-time chat between every alliance in the kingdom, with translation into 35+ languages.",
    about_li_dkp:"DKP Tracker — Upload governor stat files and compare two snapshots to see power, KP, and deaths gained.",
    about_li_calendar:"Calendar — Recurring event schedule with color-coded categories and a day-by-day agenda.",
    about_li_calculator:"Calculator — Quick planner for AP, XP, Gems, and VIP points based on your inventory.",
    about_li_visitors:"Visitors — Total check-ins from commanders around the kingdom, plus a direct Discord contact.",
    about_footer:"All times are shown in UTC and refresh automatically — no need to reload the page.",
    gate_title:"Kingdom Event Tracker", gate_desc:"Too many features to make your life easier.",
    gate_btn:"Press to enter", gate_checked_in:"commanders have checked in", gate_connecting:"Connecting...",
    banner_season_over:"All chapters have concluded — the season has ended.",
    coming_up:"Coming up",
    history_title:"History", history_count_suffix:"chapters completed so far",
    kvk_title:"War Front — Kingdom vs Kingdom", kvk_estimated:"Estimated",
    kvk_note:"These dates are estimates and will update automatically once official dates are announced.",
    calendar_title:"Event calendar", jump_today:"Jump to today", no_events_day:"No scheduled events this day.",
    calculator_title:"Point calculator", calculator_note:"Enter your inventory counts to calculate total AP, XP, Gems, and VIP points.",
    ap_title:"Action points", xp_title:"Experience points", gems_title:"Gems", vip_title:"VIP points",
    visitors_title:"Visitors", total_visitors:"Total Visitors", checked_in_note:"Commanders who have checked in.", unavailable_now:"Unavailable right now",
    contact_question:"Questions, suggestions, or found a bug?", contact_title:"Connect with me on Discord",
    discord_btn:"Message me on Discord", contact_note:"Reach out any time with requests, feedback, or issues with the site.",
    dkp_title:"DKP tracker", dkp_welcome:"Welcome to the DKP Tracker.",
    dkp_summary_title:"Kingdom-wide totals",
    dkp_summary_note:"Combined stats for every governor between the two selected snapshots.",
    dkp_desc1:"This section tracks Kingdom 4161's KvK performance by comparing data from two different points in time (snapshots).",
    dkp_desc2:"Snapshots are recorded before and after KvK battles to measure each governor's progress across the kingdom.",
    dkp_desc3:"Select two snapshots below to see how much each governor gained in power, kills, and more.",
    dkp_top_title:"Top Performer",
    dkp_top_note:"The governor with the highest selected stat.",
    dkp_gov_modal_title:"Governor Details",
    dkp_gov_id:"ID",
    dkp_gov_change:"Change",
    owner_login:"Owner Login", owner_only:"Owner only", upload_desc:"Upload a new governor stats file for a specific date.",
    upload_btn:"Upload governor file", uploading_btn:"Reading file…",
    snapshots_label:"Snapshots", total_suffix:"total",
    from_label:"From", to_label:"To", sort_label:"Sort by", search_placeholder:"Search governor…",
    sort_kp_gained:"KP Gained", sort_power_gained:"Power Gained", sort_dead_gained:"Dead Gained",
    sort_total_kp:"Total KP", sort_total_power:"Total Power", sort_total_dead:"Total Dead",
    slide_left:"← Slide Left", slide_right:"Slide Right →", column_settings:"Column Settings",
    col_governor:"Governor", col_power:"Power", col_kp:"KP", col_dead:"Dead",
    col_power_gained:"Power Gained", col_kp_gained:"KP Gained", col_dead_gained:"Dead Gained",
    col_dkp_progress:"DKP Gained (KP + Deaths)",
    dkp_earned:"DKP Earned",
    dkp_required:"DKP Required",
    dkp_enemy_only_note:"Only kills against other kingdoms count toward DKP progress. Kills against your own kingdom never count.",
    load_more:"Load more", remaining_suffix:"remaining",
    dkp_kvk_toggle_label:"KVK DKP Progress",
    dkp_kvk_active:"ACTIVE",
    dkp_kvk_inactive:"INACTIVE",
    dkp_kvk_toggle_help:"Runs 24/7 while ON — every kill and every death between your two selected snapshots counts toward DKP, with no time restrictions, no reset-date limits, and no KVK-window checks. Turn OFF when KVK ends so progress stops counting.",
    dkp_kvk_turn_on:"Turn ON",
    dkp_kvk_turn_off:"Turn OFF",
    dkp_kvk_saving:"Saving…",
    dkp_reset_title:"Reset DKP Progress",
    dkp_reset_help_active:"Permanently reset from {date}. All progress before this date is gone forever. Only snapshots dated {date} or later will count.",
    dkp_reset_help_inactive:"Zero out DKP for everyone. Snapshots from today onward will count.",
    dkp_reset_btn:"Reset Progress (Permanent)",
    dkp_reset_btn_busy:"Resetting permanently…",
    dkp_kvk_status_off:"KVK DKP Progress is turned OFF by the owner. Progress will show 0% until the owner enables it.",
    dkp_kvk_status_on:"KVK DKP Progress is ACTIVE. Every kill and death between the selected snapshots is counting toward DKP.",
    dkp_progress_on_short:"Progress tracking is ON — running 24/7.",
    dkp_progress_off_short:"Progress tracking is OFF.",
    dkp_reset_modal_title:"Reset DKP Progress?",
    dkp_reset_modal_title_busy:"Resetting DKP…",
    dkp_reset_modal_body:"This will PERMANENTLY reset DKP progress for everyone. Historical snapshots remain in the dropdowns, but any comparison starting before {date} will show 0% DKP progress. All previous progress is gone forever. To count new progress, select a 'From' snapshot dated {date} or later.",
    dkp_reset_modal_warning:"This cannot be undone. All progress will be gone forever. You'll get 10 seconds to cancel.",
    dkp_reset_modal_confirm:"Yes, Reset Everyone",
    dkp_reset_modal_countdown:"Resetting DKP for everyone in {n}…",
    dkp_reset_modal_countdown_help:"Click Cancel to stop — nothing is saved until the countdown ends.",
    no_snapshots:"No snapshots uploaded yet. Upload your first governor file above to get started.",
    footer_note:"All times UTC · updates automatically, no need to refresh.", footer_built_by:"Built by XTiT",
    install_btn:"Install",
    owner_login_prompt:"Enter the owner password to unlock the upload tools.", password_placeholder:"Enter password...",
    cancel_btn:"Cancel", login_btn:"Login",
    confirm_action_title:"Confirm Action", remove_btn:"Remove",
    month_1:"January", month_2:"February", month_3:"March", month_4:"April", month_5:"May", month_6:"June",
    month_7:"July", month_8:"August", month_9:"September", month_10:"October", month_11:"November", month_12:"December",
    dow_mon:"M", dow_tue:"T", dow_wed:"W", dow_thu:"T", dow_fri:"F", dow_sat:"S", dow_sun:"S",
    stage_upcoming:"Upcoming", stage_live:"In progress", stage_complete:"Complete",
    stage_starts:"Starts", stage_ends:"Ends", stage_open_ended:"Open-ended",
    stage_until_starts:"until it starts", stage_left:"left", stage_no_fixed_end:"In progress — no fixed end date yet", stage_completed_prefix:"Completed",
    label_opens:"Opens", label_ends:"Ends", bonus_opens_suffix:"opens",
    ops_chapter:"Chapter", ops_in_progress:"In progress", ops_opened:"Opened", ops_ends:"Ends", ops_left:"left",
    capture_is_open:"is open", capture_go_capture:"Go capture it", capture_opens:"Opens",
    ops_opens_next:"Opens next", ops_until_opens:"until it opens",
    ops_season_complete:"Season complete", ops_all_concluded:"All chapters concluded", ops_last_ended:"The last chapter ended",
    skip_link:"Skip to current chapter",
    toast_season_complete:"Season complete", toast_all_concluded:"All chapters have concluded.", toast_chapter_begun:"has begun",
    tag_new:"new", tag_left:"left", governors_suffix:"governors",
    msg_pick_date:"Pick a date for this file first.", msg_could_not_read:"Could not read that file.",
    msg_save_failed:"Loaded locally, but could not save it for other visitors. Check your connection and try again.",
    confirm_remove_snapshot:"Remove the {date} snapshot? This can't be undone.",
    install_title:"Add to home screen", install_which_device:"Which device are you using?", install_pick_device:"Pick your device to see the exact steps.",
    install_iphone_ipad:"iPhone / iPad", install_android:"Android", install_computer:"Computer",
    install_which_browser:"Which browser?", install_safari_or_chrome:"Safari or Chrome?", install_safari:"Safari", install_chrome:"Chrome",
    install_chrome_or_samsung:"Chrome or Samsung Internet?", install_samsung:"Samsung Internet",
    install_chrome_or_other:"Chrome, or something else?", install_other_browser:"Other browser", install_back:"Back",
    language_label:"Language",
    msg_loaded_governors:"Loaded {count} governors for {date} — everyone can now see it.",
    msg_missing_optional:" (No {cols} column(s) in this file — those will show as 0.)",
    msg_missing_critical:" Warning: could not find column(s) for {cols} — those values will be 0 for every governor.",
    aria_prev_month:"Previous month", aria_next_month:"Next month", aria_close:"Close", aria_dismiss:"Dismiss",
    aria_sections:"Sections", title_remove:"Remove {date}",
    aria_items_owned:"Number of {amount} {unit} items owned",
    err_incorrect_password:"Incorrect password. Try again.",
    err_admin_wrong_section:"Admin password detected. Please log in through the Activity → Barbarian Fort section.",
    fort_login_btn:"Admin / Owner Login",
    nav_chat:"Global Chat",
    chat_title:"Global Chat",
    chat_loading:"Loading messages…",
    chat_empty:"No messages yet — be the first to say hello!",
    chat_anonymous:"Anonymous",
    chat_placeholder:"Type a message…",
    chat_send:"Send",
    chat_name_title:"Pick a display name",
    chat_name_prompt:"Choose a name other commanders will see next to your messages.",
    chat_name_placeholder:"Enter your name...",
    chat_name_confirm:"Start chatting",
    chat_notice:"All messages are automatically deleted every Monday at 00:00 UTC.",
    chat_delete_msg_title:"Delete Message?",
    chat_delete_msg_body:"Are you sure you want to delete this message?",
    chat_delete_yes:"Yes, Delete",
    chat_delete_no:"No, Cancel",
    chat_delete_all_btn:"Delete All My Messages",
    chat_delete_all_title:"Delete All Your Messages?",
    chat_delete_all_body:"Are you sure you want to delete all of your messages from the Global Chat?",
    chat_delete_all_yes:"Yes, Delete All",
    chat_filtered_msg:"That message contains language that isn't allowed here. Please rephrase it.",
    chat_translate_lang_btn:"Translate language",
    chat_select_translate_lang:"Choose your translation language",
    chat_translate_lang_desc:"Messages you translate will be shown in this language. You can change it anytime.",
    chat_translate_btn:"Translate",
    chat_hide_translation_btn:"Hide translation",
    chat_translating:"Translating…",
    chat_translate_error:"Translation failed. Try again.",
    chat_translated_label:"Translated",
    owner_badge:"Owner",
    chat_owner_login_btn:"Owner Login",
    chat_owner_logout_btn:"Log out (Owner)",
    chat_admin_panel_btn:"Admin Panel",
    chat_admin_panel_title:"Global Chat — Admin Panel",
    chat_admin_intro:"Manage Global Chat users and messages. These controls are only visible to the owner.",
    chat_admin_users_label:"Active chat users",
    chat_admin_no_users:"No messages from regular users yet.",
    chat_admin_messages_suffix:"messages",
    chat_admin_ban_btn:"Ban & delete messages",
    chat_admin_unban_btn:"Unban",
    chat_admin_banned_label:"Banned names",
    chat_admin_no_banned:"No one is currently banned.",
    chat_admin_confirm_ban:"Ban \"{name}\" and delete all of their messages? They won't be able to send new messages while banned.",
    chat_admin_confirm_unban:"Unban \"{name}\"? They will be able to chat again.",
    chat_banned_error:"That name has been banned from Global Chat by the owner.",
    chat_change_name_btn:"Change display name",
    save_btn:"Save",
    chat_emoji_btn:"Kingdom icons",
    chat_reply_btn:"Reply",
    chat_replying_to:"Replying to",
    chat_clear_reply_btn:"Cancel reply",
    chat_jump_to_reply:"Jump to the message this is replying to",
    chat_view_replies:"Jump to this message",
    chat_reply_singular:"reply",
    chat_replies_plural:"replies",
    chat_announce_make:"Make announcement",
    chat_announce_on:"Announcement mode ON",
    chat_announce_placeholder:"Write an announcement for everyone…",
    chat_announce_send:"Announce",
    chat_announcement_label:"Announcement",
    chat_announce_hint:"Only you (the owner) can post announcements.",
    chat_img_send_btn:"Send image",
    chat_img_guide_btn:"Image size guide",
    chat_img_guide_title:"Image size guide",
    chat_img_max:"Max size:",
    chat_img_max_val:"5 MB per image",
    chat_img_recommended:"Recommended:",
    chat_img_recommended_val:"under 3 MB",
    chat_img_formats:"Formats:",
    chat_img_formats_val:"JPG, PNG, GIF, WebP",
    chat_img_tip_camera:"📷 Photos from your phone work great",
    chat_img_tip_screenshot:"🖼️ Screenshots are always fine",
    chat_img_auto_shrink:"Larger images are automatically shrunk before upload.",
    chat_img_too_large:"Image too large — max 5 MB. Please choose a smaller image.",
    chat_img_failed:"Upload failed. Please try again.",
    chat_reply_image:"image",
    chat_cooldown_send:"Next message",
    chat_cooldown_image:"Image cooldown",
    chat_online_label:"Commanders online",
    chat_slow_mode_msg:"Slow mode — try again in {n}s.",
    chat_slow_mode_img:"Image slow mode — try again in {n}s.",
    chat_typing_one:"is typing…",
    chat_typing_and:"and",
    chat_typing_are:"are typing…",
    chat_typing_others:"others are typing…",
    bonus_shrine:"Shrine",
    bonus_level_3_pass:"Level 3 Pass",
    bonus_lost_temple:"Lost Temple",
    kvk_stage_1_title:"Stage 1 — The Lost Secret",
    kvk_stage_1_sub:"Kill Marauders to uncover the lost secrets — be prepared to fight",
    kvk_stage_2_title:"Stage 2 — Prepare for Battle",
    kvk_stage_2_sub:"Train Troops — be prepared for the coming war",
    kvk_stage_3_title:"Stage 3 — Clash of Civilizations",
    kvk_stage_3_sub:"Attack Marauder Encampments / Marauder Forts — be prepared for battle",
    kvk_stage_4_title:"Stage 4 — Lost Kingdom Opens",
    kvk_stage_4_sub:"KVK begins — the Lost Kingdom is open, enter and fight",
    g_tap_the:"Tap the",
    g_btn_share:"Share",
    g_icon_safari_bar:"icon in the Safari bar",
    g_scroll_tap:"Scroll down and tap",
    g_btn_add_home:"Add to Home Screen",
    g_tap:"Tap",
    g_btn_add:"Add",
    g_in_top_corner:"in the top corner",
    g_icon_next_address:"icon next to the address bar",
    g_menu_top_right:"menu in the top right",
    g_confirm_tap:"Confirm and tap",
    g_btn_menu:"Menu",
    g_icon_bottom_right:"icon in the bottom right",
    g_btn_add_page_to:"Add page to",
    g_btn_home_screen:"Home screen",
    g_then:"then",
    g_look_for:"Look for the",
    g_btn_install:"Install",
    g_icon_address_bar:"icon in the address bar",
    g_dont_see_open:"Don't see it? Open the",
    g_menu_word:"menu",
    g_choose:"Choose",
    g_btn_install_muster:"Install XTiT",
    g_look_install_icon:"Look for an install icon in your browser's toolbar",
    g_or_check_menu:"Or check the browser menu for",
    fort_week_label:"Week",
    fort_governor_label:"Governor",
    fort_alliance_label:"Alliance",
    fort_forts_label_short:"Forts",
    fort_gov_id_label:"Governor ID",
    fort_gov_id_placeholder:"e.g. 123456789",
    fort_alliance_placeholder:"Alliance name…",
    fort_all_alliances:"All Alliances",
    fort_no_alliance:"No Alliance",
    fort_search_player:"Search player…",
    fort_show_deleted:"Show Deleted",
    fort_hide_deleted:"Hide Deleted",
    fort_deleted_tag:"Deleted",
    fort_restore_title:"Restore player",
    fort_alliances_label:"Alliances",
    fort_players_label:"Players",
    fort_all_weeks_total:"All Weeks",
    fort_upload_normal_opt:"Normal file — does NOT count toward DKP",
    fort_upload_kvk_opt:"KVK stats file — COUNTS toward DKP",
    fort_badge_kvk:"KVK",
    fort_badge_normal:"NORMAL",
    fort_image_unavailable:"Image unavailable",
    chat_pick_reaction:"Pick a reaction",
    chat_scroll_latest:"Scroll to latest messages",
    chat_send_failed:"Could not send. Please try again.",
    chat_loading_more:"Loading…",
    gov_owner_label:"Owner",
    dkp_earned_tip:"Earned",
    dkp_required_tip:"Required",
    dkp_power_tip:"power",
    dkp_normal_tip:"Normal file — DKP not counted",
    feedback_survey_title:"How was your experience with our website?",
    feedback_survey_sub:"Your feedback helps us improve — it only takes a second.",
    feedback_good:"Good",
    feedback_notbad:"Not Bad",
    feedback_bad:"Bad",
    feedback_more_title:"Thanks! Want to tell us more?",
    feedback_more_sub:"Add a suggestion, idea, or question — or just skip this.",
    feedback_text_placeholder:"Optional — share your thoughts, ideas, or questions…",
    feedback_sending:"Sending…",
    feedback_send:"Send",
    feedback_no_thanks:"No thank you",
    feedback_thanks_detailed:"Thanks for your detailed feedback!",
    feedback_thanks_simple:"Thanks for your feedback!",
    feedback_recorded:"Your response has been recorded.",
    feedback_skip:"Skip for now",
    feedback_loading:"Loading feedback…",
    feedback_empty_title:"No feedback yet",
    feedback_empty_text:"Visitor ratings from the exit survey will appear here as soon as people rate the site.",
    feedback_total_ratings:"Total Ratings",
    feedback_satisfaction:"Satisfaction / 100",
    feedback_today:"Today",
    feedback_last_7:"Last 7 days",
    feedback_last_30:"Last 30 days",
    feedback_recent:"Recent Responses",
    feedback_with_message:"with a message",
    admin_exit_survey:"Exit Feedback Survey",
    admin_no_feedback:"No feedback collected yet.",
    admin_loading:"Loading…",
    admin_total:"total",
    admin_last_7:"in last 7 days",
    admin_satisfaction:"Satisfaction",
  },
  tr: {
nav_overview:"Genel Bakış", nav_history:"Geçmiş", nav_kvk:"KVK", nav_dkp:"DKP", nav_calendar:"Takvim", nav_calculator:"Hesap Makinesi", nav_visitors:"Ziyaretçiler",
    nav_activity:"Etkinlik",
    activity_title:"Krallık Etkinliği",
    activity_tab_farms:"Çiftlikler ve İttifak Yardımı",
    activity_tab_fort:"Barbar Kalesi",
    activity_upload_desc:"Çiftlikler ve İttifak Yardımı liderlik tablosunu güncellemek için bir vali istatistik dosyası yükleyin.",
    activity_upload_btn:"Dosya yükle",
    activity_uploading:"Dosya okunuyor…",
    activity_owner_login:"Sahip Girişi",
    activity_updated:"Veri tarihi",
    activity_no_data:"Henüz dosya yüklenmedi.",
    activity_no_results:"Aramanızla eşleşen oyuncu yok.",
    activity_col_helps:"İttifak Yardımı",
    activity_col_resources:"Toplanan Kaynaklar",
    activity_total_helps:"Toplam Yardım",
    activity_total_resources:"Toplam Kaynak",
    activity_players:"Oyuncular",
    activity_whole_kingdom:"Krallık Geneli Toplamlar",
    fort_download_btn:"İndir",
    fort_download_excel:"Excel (.xlsx)",
    fort_download_csv:"CSV (.csv)",
    fort_copy_clipboard:"Panoya kopyala",
    fort_share_btn:"Paylaş…",
    fort_copied_msg:"Panoya kopyalandı.",
    fort_copy_failed:"Kopyalanamadı. Tekrar deneyin.",
    activity_search:"Oyuncu ara…",
    activity_loaded:"{date} için {count} oyuncu yüklendi — artık herkes görebilir.",
    activity_missing_helps:" (İttifak Yardımı sütunu bulunamadı — yardımlar 0 olarak gösterilecek.)",
    activity_missing_resources:" (Toplanan Kaynaklar sütunu bulunamadı — kaynaklar 0 olarak gösterilecek.)",
    activity_save_failed:"Yerel olarak yüklendi, ancak diğer ziyaretçiler için kaydedilemedi. Bağlantınızı kontrol edip tekrar deneyin.",
    activity_soon:"Yakında",
    activity_soon_note:"Barbar Kalesi takibi yolda.",
    activity_col_helps_gained:"Kazanılan Yardım",
    activity_col_resources_gained:"Kazanılan Kaynak",
    fort_no_data:"Henüz Barbar Kalesi verisi yok.",
    fort_col_name:"İsim",
    fort_col_forts:"Yıkılan Kaleler",
    fort_edit_title:"Oyuncuyu düzenle",
    fort_name_label:"Oyuncu adı",
    fort_forts_label:"Yıkılan kaleler",
    fort_confirm_remove:"\"{name}\" liderlik tablosundan kaldırılsın mı?",
    fort_clear_btn:"Liderlik tablosunu temizle",
    fort_confirm_clear:"Tüm Barbar Kalesi liderlik tablosu silinsin mi? Bu geri alınamaz.",
    fort_updated:"Son güncelleme",
    fort_players:"oyuncu",
    fort_save_failed:"Kaydedilemedi. Bağlantınızı kontrol edip tekrar deneyin.",
    fort_add_desc:"Her valiyi manuel olarak ekleyin — adını ve kaç Barbar Kalesi yıktığını yazın. Aynı vali zaten tabloda varsa, daha yüksek kale sayısı korunur.",
    fort_add_name_placeholder:"Vali adı…",
    fort_add_forts_placeholder:"Yıkılan kaleler",
    fort_add_btn:"Oyuncu ekle",
    fort_added_msg:"{name} {forts} kale ile eklendi.",
    fort_updated_msg:"{name} güncellendi — daha yüksek kale sayısı korundu.",
    fort_add_invalid:"Lütfen geçerli bir vali adı ve 0 veya daha yüksek bir kale sayısı girin.",
    fort_login_title:"Barbar Kalesi — Sahip Girişi",
    fort_login_prompt:"Ekleme/düzenleme araçlarının kilidini açmak için Barbar Kalesi şifresini girin.",
    nav_activity:"Etkinlik",
    activity_title:"Krallık Etkinliği",
    activity_tab_farms:"Çiftlikler ve İttifak Yardımı",
    activity_tab_fort:"Barbar Kalesi",
    activity_upload_desc:"Çiftlikler ve İttifak Yardımı liderlik tablosunu güncellemek için bir vali istatistik dosyası yükleyin.",
    activity_upload_btn:"Dosya yükle",
    activity_uploading:"Dosya okunuyor…",
    activity_owner_login:"Sahip Girişi",
    activity_updated:"Veri tarihi",
    activity_no_data:"Henüz dosya yüklenmedi.",
    activity_no_results:"Aramanızla eşleşen oyuncu yok.",
    activity_col_helps:"İttifak Yardımı",
    activity_col_resources:"Toplanan Kaynaklar",
    activity_total_helps:"Toplam Yardım",
    activity_total_resources:"Toplam Kaynak",
    activity_players:"Oyuncular",
    activity_search:"Oyuncu ara…",
    activity_loaded:"{date} için {count} oyuncu yüklendi — artık herkes görebilir.",
    activity_missing_helps:" (İttifak Yardımı sütunu bulunamadı — yardımlar 0 olarak gösterilecek.)",
    activity_missing_resources:" (Toplanan Kaynaklar sütunu bulunamadı — kaynaklar 0 olarak gösterilecek.)",
    activity_save_failed:"Yerel olarak yüklendi, ancak diğer ziyaretçiler için kaydedilemedi. Bağlantınızı kontrol edip tekrar deneyin.",
    activity_soon:"Yakında",
    activity_soon_note:"Barbar Kalesi takibi yolda.",
    activity_col_helps_gained:"Kazanılan Yardım",
    activity_col_resources_gained:"Kazanılan Kaynak",
    fort_no_data:"Henüz Barbar Kalesi verisi yok.",
    fort_col_name:"İsim",
    fort_col_forts:"Yıkılan Kaleler",
    fort_edit_title:"Oyuncuyu düzenle",
    fort_name_label:"Oyuncu adı",
    fort_forts_label:"Yıkılan kaleler",
    fort_confirm_remove:"\"{name}\" liderlik tablosundan kaldırılsın mı?",
    fort_clear_btn:"Liderlik tablosunu temizle",
    fort_confirm_clear:"Tüm Barbar Kalesi liderlik tablosu silinsin mi? Bu geri alınamaz.",
    fort_updated:"Son güncelleme",
    fort_players:"oyuncu",
    fort_save_failed:"Kaydedilemedi. Bağlantınızı kontrol edip tekrar deneyin.",
    fort_add_desc:"Her valiyi manuel olarak ekleyin — adını ve kaç Barbar Kalesi yıktığını yazın. Aynı vali zaten tabloda varsa, daha yüksek kale sayısı korunur.",
    fort_add_name_placeholder:"Vali adı…",
    fort_add_forts_placeholder:"Yıkılan kaleler",
    fort_add_btn:"Oyuncu ekle",
    fort_added_msg:"{name} {forts} kale ile eklendi.",
    fort_updated_msg:"{name} güncellendi — daha yüksek kale sayısı korundu.",
    fort_add_invalid:"Lütfen geçerli bir vali adı ve 0 veya daha yüksek bir kale sayısı girin.",
    fort_login_title:"Barbar Kalesi — Sahip Girişi",
    fort_login_prompt:"Ekleme/düzenleme araçlarının kilidini açmak için Barbar Kalesi şifresini girin.",
    fort_no_data:"Henüz Barbarian Fort verisi yok.",
    fort_col_name:"İsim",
    fort_col_forts:"Yıkılan Kaleler",
    fort_edit_title:"Oyuncuyu düzenle",
    fort_name_label:"Oyuncu adı",
    fort_forts_label:"Yıkılan kaleler",
    fort_confirm_remove:"\"{name}\" liderlik tablosundan kaldırılsın mı?",
    fort_clear_btn:"Liderlik tablosunu temizle",
    fort_confirm_clear:"Tüm Barbarian Fort liderlik tablosu silinsin mi? Bu geri alınamaz.",
    fort_updated:"Son güncelleme",
    fort_players:"oyuncu",
    fort_save_failed:"Tarandı, ancak diğer ziyaretçiler için kaydedilemedi. Bağlantınızı kontrol edip tekrar deneyin.",
    fort_add_desc:"Her valiyi manuel olarak ekleyin — adını ve kaç Barbarian Fort yıktığını yazın. Aynı vali zaten tabloda varsa, daha yüksek kale sayısı korunur.",
    fort_add_name_placeholder:"Vali adı…",
    fort_add_forts_placeholder:"Yıkılan kaleler",
    fort_add_btn:"Oyuncu ekle",
    fort_added_msg:"{name} {forts} kale ile eklendi.",
    fort_updated_msg:"{name} güncellendi — daha yüksek kale sayısı korundu.",
    fort_add_invalid:"Lütfen geçerli bir vali adı ve 0 veya daha yüksek bir kale sayısı girin.",
    fort_login_title:"Barbarian Fort — Sahip Girişi",
    fort_login_prompt:"Ekleme/düzenleme araçlarının kilidini açmak için Barbarian Fort şifresini girin.",
    about_toggle:"Bu sayfa nasıl çalışır",
    about_intro:"XTiT, etkinliklerden haberdar olmanızı ve ittifakınızın ilerlemesini takip etmenizi sağlayan hepsi bir arada krallık yardımcınızdır.",
    about_li_overview:"Genel Bakış — Canlı bölüm takibi ve geri sayımlar.",
    about_li_history:"Geçmiş — Geçmiş bölümler ve tamamlanan etkinlikler.",
    about_li_kvk:"KVK — Krallıklar Arası Savaş cephesi programı.",
    about_li_chat:"Global Sohbet — Krallıktaki tüm ittifaklar arasında gerçek zamanlı sohbet, 35+ dile çeviri ile.",
    about_li_dkp:"DKP Takip — Vali istatistiklerini yükleyin ve KvK performansını takip edin.",
    about_li_calendar:"Takvim — Tekrarlanan etkinlik programı.",
    about_li_calculator:"Hesap Makinesi — Hızlı AP, XP, Gem ve VIP puan planlayıcısı.",
    about_li_visitors:"Ziyaretçiler — Kaç komutanın giriş yaptığını görün.",
    about_footer:"Tüm saatler UTC olarak gösterilir. Sayfa otomatik olarak yenilenir.",
    gate_title:"Krallık Etkinlik Takipçisi", gate_desc:"Hayatınızı kolaylaştıracak çok fazla özellik.",
    gate_btn:"Girmek için basın", gate_checked_in:"komutan giriş yaptı", gate_connecting:"Bağlanıyor...",
    banner_season_over:"Tüm bölümler tamamlandı — sezon sona erdi.",
    coming_up:"Sırada",
    history_title:"Geçmiş", history_count_suffix:"bölüm şimdiye kadar tamamlandı",
    kvk_title:"Savaş Cephesi — Krallıklar Arası Savaş", kvk_estimated:"Tahmini",
    kvk_note:"Bu tarihler tahminidir ve resmi tarihler açıklandığında otomatik olarak güncellenecektir.",
    calendar_title:"Etkinlik takvimi", jump_today:"Bugüne git", no_events_day:"Bu gün için planlanmış etkinlik yok.",
    calculator_title:"Puan hesaplayıcı", calculator_note:"Toplam AP, XP, Gem ve VIP puanlarını hesaplamak için envanter sayılarınızı girin.",
    ap_title:"Aksiyon puanı", xp_title:"Deneyim puanı", gems_title:"Elmas", vip_title:"VIP puanı",
    visitors_title:"Ziyaretçiler", total_visitors:"Toplam Ziyaretçi", checked_in_note:"Giriş yapan komutanlar.", unavailable_now:"Şu anda kullanılamıyor",
    contact_question:"Sorular, öneriler veya bir hata mı buldunuz?", contact_title:"Discord'da benimle bağlantı kurun",
    discord_btn:"Discord'dan mesaj gönder", contact_note:"İstek, geri bildirim veya siteyle ilgili sorunlar için istediğiniz zaman ulaşın.",
    dkp_title:"DKP takipçisi", dkp_welcome:"DKP Takipçisine hoş geldiniz.",
    dkp_summary_title:"Krallık geneli toplamlar",
    dkp_summary_note:"Seçilen iki anlık görüntü arasındaki tüm valilerin birleşik istatistikleri.",
    dkp_desc1:"Bu bölüm, iki farklı zaman noktasındaki verileri (anlık görüntüler) karşılaştırarak Krallık 4161'in KvK performansını takip eder.",
    dkp_desc2:"Anlık görüntüler, her valinin krallık genelindeki ilerlemesini ölçmek için KvK savaşlarından önce ve sonra kaydedilir.",
    dkp_desc3:"Her valinin güç, öldürme ve daha fazlasında ne kadar kazandığını görmek için aşağıdan iki anlık görüntü seçin.",
    dkp_top_title:"En İyi Performans",
    dkp_top_note:"Seçilen istatistikte en yüksek değere sahip vali.",
    dkp_gov_modal_title:"Vali Detayları",
    dkp_gov_id:"ID",
    dkp_gov_change:"Değişim",
    owner_login:"Sahip Girişi", owner_only:"Sadece sahip", upload_desc:"Belirli bir tarih için yeni bir vali istatistik dosyası yükleyin.",
    upload_btn:"Vali dosyası yükle", uploading_btn:"Dosya okunuyor…",
    snapshots_label:"Anlık Görüntüler", total_suffix:"toplam",
    from_label:"Başlangıç", to_label:"Bitiş", sort_label:"Sırala", search_placeholder:"Vali ara…",
    sort_kp_gained:"Kazanılan KP", sort_power_gained:"Kazanılan Güç", sort_dead_gained:"Kazanılan Ölü",
    sort_total_kp:"Toplam KP", sort_total_power:"Toplam Güç", sort_total_dead:"Toplam Ölü",
    slide_left:"← Sola Kaydır", slide_right:"Sağa Kaydır →", column_settings:"Sütun Ayarları",
    col_governor:"Vali", col_power:"Güç", col_kp:"KP", col_dead:"Ölü",
    col_power_gained:"Kazanılan Güç", col_kp_gained:"Kazanılan KP", col_dead_gained:"Kazanılan Ölü",
    load_more:"Daha fazla yükle", remaining_suffix:"kaldı",
    dkp_kvk_toggle_label:"KVK DKP İlerlemesi",
    dkp_kvk_active:"AKTİF",
    dkp_kvk_inactive:"KAPALI",
    dkp_kvk_toggle_help:"KVK başladığı anda AÇ — iki anlık görüntü arasındaki her öldürme ve her ölüm DKP'ye sayılır. KVK bittiğinde KAPAT, böylece ilerleme sayılmaz.",
    dkp_kvk_turn_on:"AÇ",
    dkp_kvk_turn_off:"KAPAT",
    dkp_kvk_saving:"Kaydediliyor…",
    dkp_reset_title:"DKP İlerlemesini Sıfırla",
    dkp_reset_help_active:"Şu tarihten itibaren sıfırlandı: {date}. Daha önceki tüm anlık görüntüler gizli.",
    dkp_reset_help_inactive:"Herkes için DKP'yi sıfırla. Bugünden itibaren olan anlık görüntüler sayılacak.",
    dkp_reset_btn:"İlerlemeyi Sıfırla",
    dkp_reset_btn_busy:"Sıfırlanıyor…",
    dkp_kvk_status_off:"⚠️ KVK DKP İlerlemesi sahip tarafından KAPATILDI. Sahip etkinleştirene kadar ilerleme %0 olarak gösterilir.",
    dkp_kvk_status_on:"✅ KVK DKP İlerlemesi AKTİF. Seçilen anlık görüntüler arasındaki her öldürme ve ölüm DKP'ye sayılıyor.",
    dkp_reset_modal_title:"DKP İlerlemesi Sıfırlansın mı?",
    dkp_reset_modal_title_busy:"DKP sıfırlanıyor…",
    dkp_reset_modal_body:"Bu, herkes için DKP ilerlemesini sıfırlar. Bugünden önceki tüm anlık görüntüler Başlangıç / Bitiş menülerinden gizlenir ve {date} veya sonrası yeni bir anlık görüntü yükleyene kadar DKP %0 gösterir.",
    dkp_reset_modal_warning:"Bu geri alınamaz. İptal etmek için 10 saniyen var.",
    dkp_reset_modal_confirm:"Evet, Herkesi Sıfırla",
    dkp_reset_modal_countdown:"Herkes için DKP {n} içinde sıfırlanıyor…",
    dkp_reset_modal_countdown_help:"Durdurmak için İptal'e tıkla — geri sayım bitene kadar hiçbir şey kaydedilmez.",
    no_snapshots:"Henüz anlık görüntü yüklenmedi. Başlamak için yukarıdan ilk vali dosyanızı yükleyin.",
    footer_note:"Tüm saatler UTC · otomatik güncellenir, yenilemeye gerek yok.", footer_built_by:"XTiT tarafından yapıldı",
    install_btn:"Yükle",
    owner_login_prompt:"Yükleme araçlarının kilidini açmak için sahip şifresini girin.", password_placeholder:"Şifre girin...",
    cancel_btn:"İptal", login_btn:"Giriş yap",
    confirm_action_title:"İşlemi Onayla", remove_btn:"Kaldır",
    month_1:"Ocak", month_2:"Şubat", month_3:"Mart", month_4:"Nisan", month_5:"Mayıs", month_6:"Haziran",
    month_7:"Temmuz", month_8:"Ağustos", month_9:"Eylül", month_10:"Ekim", month_11:"Kasım", month_12:"Aralık",
    dow_mon:"P", dow_tue:"S", dow_wed:"Ç", dow_thu:"P", dow_fri:"C", dow_sat:"C", dow_sun:"P",
    stage_upcoming:"Yaklaşan", stage_live:"Devam ediyor", stage_complete:"Tamamlandı",
    stage_starts:"Başlıyor", stage_ends:"Bitiyor", stage_open_ended:"Süresiz",
    stage_until_starts:"başlamasına kadar", stage_left:"kaldı", stage_no_fixed_end:"Devam ediyor — sabit bitiş tarihi yok", stage_completed_prefix:"Tamamlandı",
    label_opens:"Açılış", label_ends:"Bitiş", bonus_opens_suffix:"açılıyor",
    ops_chapter:"Bölüm", ops_in_progress:"Devam ediyor", ops_opened:"Açıldı", ops_ends:"Bitiyor", ops_left:"kaldı",
    capture_is_open:"açık", capture_go_capture:"Hemen ele geçirin", capture_opens:"Açılıyor",
    ops_opens_next:"Sırada açılacak", ops_until_opens:"açılmasına kadar",
    ops_season_complete:"Sezon tamamlandı", ops_all_concluded:"Tüm bölümler tamamlandı", ops_last_ended:"Son bölüm şu tarihte sona erdi:",
    skip_link:"Mevcut bölüme atla",
    toast_season_complete:"Sezon tamamlandı", toast_all_concluded:"Tüm bölümler tamamlandı.", toast_chapter_begun:"başladı",
    tag_new:"yeni", tag_left:"ayrıldı", governors_suffix:"vali",
    msg_pick_date:"Önce bu dosya için bir tarih seçin.", msg_could_not_read:"Bu dosya okunamadı.",
    msg_save_failed:"Yerel olarak yüklendi, ancak diğer ziyaretçiler için kaydedilemedi. Bağlantınızı kontrol edip tekrar deneyin.",
    confirm_remove_snapshot:"{date} anlık görüntüsü kaldırılsın mı? Bu işlem geri alınamaz.",
    install_title:"Ana ekrana ekle", install_which_device:"Hangi cihazı kullanıyorsunuz?", install_pick_device:"Tam adımları görmek için cihazınızı seçin.",
    install_iphone_ipad:"iPhone / iPad", install_android:"Android", install_computer:"Bilgisayar",
    install_which_browser:"Hangi tarayıcı?", install_safari_or_chrome:"Safari mi Chrome mu?", install_safari:"Safari", install_chrome:"Chrome",
    install_chrome_or_samsung:"Chrome mu Samsung Internet mi?", install_samsung:"Samsung Internet",
    install_chrome_or_other:"Chrome mu, yoksa başka bir şey mi?", install_other_browser:"Diğer tarayıcı", install_back:"Geri",
    language_label:"Dil",
    msg_loaded_governors:"{date} tarihi için {count} vali yüklendi — artık herkes görebilir.",
    msg_missing_optional:" (Bu dosyada {cols} sütunu yok — bu değerler 0 olarak görünecek.)",
    msg_missing_critical:" Uyarı: {cols} için sütun(lar) bulunamadı — bu değerler her vali için 0 olacak.",
    aria_prev_month:"Önceki ay", aria_next_month:"Sonraki ay", aria_close:"Kapat", aria_dismiss:"Kapat",
    aria_sections:"Bölümler", title_remove:"{date} kaldır",
    aria_items_owned:"{amount} {unit} kalemine sahip olma sayısı",
    err_incorrect_password:"Yanlış şifre. Tekrar deneyin.",
    nav_chat:"Global Sohbet",
    chat_title:"Global Sohbet",
    chat_loading:"Mesajlar yükleniyor…",
    chat_empty:"Henüz mesaj yok — ilk merhaba diyen sen ol!",
    chat_anonymous:"Anonim",
    chat_placeholder:"Bir mesaj yaz…",
    chat_send:"Gönder",
    chat_name_title:"Görünen ad seç",
    chat_name_prompt:"Diğer komutanların mesajlarının yanında göreceği bir isim seç.",
    chat_name_placeholder:"Adını gir...",
    chat_name_confirm:"Sohbete başla",
    chat_notice:"Tüm mesajlar her Pazartesi 00:00 UTC'de otomatik silinir.",
    chat_delete_msg_title:"Mesaj silinsin mi?",
    chat_delete_msg_body:"Bu mesajı silmek istediğinden emin misin?",
    chat_delete_yes:"Evet, Sil",
    chat_delete_no:"Hayır, İptal",
    chat_delete_all_btn:"Tüm Mesajlarımı Sil",
    chat_delete_all_title:"Tüm mesajlarınız silinsin mi?",
    chat_delete_all_body:"Global Sohbetteki tüm mesajlarınızı silmek istediğinizden emin misiniz?",
    chat_delete_all_yes:"Evet, Hepsini Sil",
    chat_filtered_msg:"Bu mesaj burada izin verilmeyen bir dil içeriyor. Lütfen yeniden ifade edin.",
    chat_translate_lang_btn:"Çeviri dili",
    chat_select_translate_lang:"Çeviri dilinizi seçin",
    chat_translate_lang_desc:"Çevirdiğiniz mesajlar bu dilde gösterilecek. İstediğiniz zaman değiştirebilirsiniz.",
    chat_translate_btn:"Çevir",
    chat_hide_translation_btn:"Çeviriyi gizle",
    chat_translating:"Çevriliyor…",
    chat_translate_error:"Çeviri başarısız. Tekrar deneyin.",
    chat_translated_label:"Çevrildi",
    owner_badge:"Sahip",
    chat_owner_login_btn:"Sahip Girişi",
    chat_owner_logout_btn:"Çıkış yap (Sahip)",
    chat_admin_panel_btn:"Yönetici Paneli",
    chat_admin_panel_title:"Global Sohbet — Yönetici Paneli",
    chat_admin_intro:"Global Sohbet kullanıcılarını ve mesajlarını yönetin. Bu kontroller yalnızca sahibe görünür.",
    chat_admin_users_label:"Aktif sohbet kullanıcıları",
    chat_admin_no_users:"Henüz normal kullanıcıdan mesaj yok.",
    chat_admin_messages_suffix:"mesaj",
    chat_admin_ban_btn:"Yasakla ve mesajları sil",
    chat_admin_unban_btn:"Yasağı kaldır",
    chat_admin_banned_label:"Yasaklı isimler",
    chat_admin_no_banned:"Şu anda yasaklı kimse yok.",
    chat_admin_confirm_ban:"\"{name}\" yasaklansın ve tüm mesajları silinsin mi? Yasaklıyken yeni mesaj gönderemezler.",
    chat_admin_confirm_unban:"\"{name}\" yasağı kaldırılsın mı? Tekrar sohbet edebilecekler.",
    chat_banned_error:"Bu isim sahip tarafından Global Sohbetten yasaklandı.",
    chat_not_translated_owner:"Sahip mesajları yazıldığı gibi gösterilir ve çevrilmez.",
    chat_change_name_btn:"Görünen adı değiştir",
    save_btn:"Kaydet",
    chat_emoji_btn:"Krallık simgeleri",
    chat_reply_btn:"Yanıtla",
    chat_replying_to:"Yanıtlanıyor",
    chat_clear_reply_btn:"Yanıtı iptal et",
    chat_jump_to_reply:"Yanıtlanan mesaja git",
    chat_view_replies:"Bu mesaja git",
    chat_reply_singular:"yanıt",
    chat_replies_plural:"yanıt",
    chat_announce_make:"Duyuru yap",
    chat_announce_on:"Duyuru modu AÇIK",
    chat_announce_placeholder:"Herkese bir duyuru yaz…",
    chat_announce_send:"Duyur",
    chat_announcement_label:"Duyuru",
    chat_announce_hint:"Duyuruları yalnızca sen (sahip) gönderebilirsin.",
    bonus_shrine:"Tapınak",
    bonus_level_3_pass:"Seviye 3 Geçit",
    bonus_lost_temple:"Kayıp Tapınak",
    kvk_stage_1_title:"Aşama 1 — Kayıp Sır",
    kvk_stage_1_sub:"Kayıp sırları ortaya çıkarmak için Yağmacıları öldür — savaşa hazır ol",
    kvk_stage_2_title:"Aşama 2 — Savaşa Hazırlan",
    kvk_stage_2_sub:"Asker Yetiştir — yaklaşan savaşa hazır ol",
    kvk_stage_3_title:"Aşama 3 — Medeniyetler Çatışması",
    kvk_stage_3_sub:"Yağmacı Kamplarına / Yağmacı Kalelerine saldır — savaşa hazır ol",
    kvk_stage_4_title:"Aşama 4 — Kayıp Krallık Açılıyor",
    kvk_stage_4_sub:"KVK başlıyor — Kayıp Krallık açık, gir ve savaş",
    g_tap_the:"Şuna dokun:",
    g_btn_share:"Paylaş",
    g_icon_safari_bar:"Safari çubuğundaki simge",
    g_scroll_tap:"Aşağı kaydır ve şuna dokun:",
    g_btn_add_home:"Ana Ekrana Ekle",
    g_tap:"Dokun:",
    g_btn_add:"Ekle",
    g_in_top_corner:"üst köşede",
    g_icon_next_address:"adres çubuğunun yanındaki simge",
    g_menu_top_right:"sağ üstteki menü",
    g_confirm_tap:"Onayla ve dokun:",
    g_btn_menu:"Menü",
    g_icon_bottom_right:"alt sağdaki simge",
    g_btn_add_page_to:"Sayfayı şuraya ekle:",
    g_btn_home_screen:"Ana ekran",
    g_then:"sonra",
    g_look_for:"Şunu ara:",
    g_btn_install:"Yükle",
    g_icon_address_bar:"adres çubuğundaki simge",
    g_dont_see_open:"Görmüyor musun? Şunu aç:",
    g_menu_word:"menü",
    g_choose:"Seç:",
    g_btn_install_muster:"XTiT'i Yükle",
    g_look_install_icon:"Tarayıcının araç çubuğunda bir yükleme simgesi ara",
    g_or_check_menu:"Veya tarayıcı menüsünde şunu ara:",
    chat_img_send_btn:"Resim gönder",
    chat_img_guide_btn:"Resim boyutu kılavuzu",
    chat_img_guide_title:"Resim boyutu kılavuzu",
    chat_img_max:"Maksimum boyut:",
    chat_img_max_val:"Resim başına 5 MB",
    chat_img_recommended:"Önerilen:",
    chat_img_recommended_val:"3 MB altı",
    chat_img_formats:"Formatlar:",
    chat_img_formats_val:"JPG, PNG, GIF, WebP",
    chat_img_tip_camera:"📷 Telefonundan çekilen fotoğraflar harika çalışır",
    chat_img_tip_screenshot:"🖼️ Ekran görüntüleri her zaman uygundur",
    chat_img_auto_shrink:"Daha büyük resimler yüklemeden önce otomatik olarak küçültülür.",
    chat_img_too_large:"Resim çok büyük — maksimum 5 MB. Lütfen daha küçük bir resim seç.",
    chat_img_failed:"Yükleme başarısız. Lütfen tekrar dene.",
    chat_reply_image:"resim",
    chat_cooldown_send:"Sonraki mesaj",
    chat_cooldown_image:"Resim bekleme süresi",
    chat_online_label:"Çevrimiçi komutanlar",
    chat_slow_mode_msg:"Yavaş mod — {n}sn sonra tekrar dene.",
    chat_slow_mode_img:"Resim yavaş modu — {n}sn sonra tekrar dene.",
    chat_typing_one:"yazıyor…",
    chat_typing_and:"ve",
    chat_typing_are:"yazıyor…",
    chat_typing_others:"kişi daha yazıyor…",
    fort_week_label:"Hafta",
    fort_governor_label:"Vali",
    fort_alliance_label:"İttifak",
    fort_forts_label_short:"Kale",
    fort_alliance_placeholder:"İttifak adı…",
    fort_all_alliances:"Tüm İttifaklar",
    fort_no_alliance:"İttifak Yok",
    fort_search_player:"Oyuncu ara…",
    fort_show_deleted:"Silinenleri Göster",
    fort_hide_deleted:"Silinenleri Gizle",
    fort_deleted_tag:"Silindi",
    fort_restore_title:"Oyuncuyu geri yükle",
    fort_alliances_label:"İttifaklar",
    fort_players_label:"Oyuncular",
    fort_all_weeks_total:"Tüm Haftalar",
    fort_upload_normal_opt:"Normal dosya — DKP'ye sayılmaz",
    fort_upload_kvk_opt:"KVK istatistik dosyası — DKP'ye SAYILIR",
    fort_badge_kvk:"KVK",
    fort_badge_normal:"NORMAL",
    fort_image_unavailable:"Görsel kullanılamıyor",
    chat_pick_reaction:"Bir tepki seç",
    chat_scroll_latest:"En son mesajlara git",
    chat_send_failed:"Gönderilemedi. Lütfen tekrar deneyin.",
    chat_loading_more:"Yükleniyor…",
    gov_owner_label:"Sahip",
    dkp_earned_tip:"Kazanılan",
    dkp_required_tip:"Gerekli",
    dkp_power_tip:"güç",
    dkp_normal_tip:"Normal dosya — DKP sayılmadı",
    feedback_survey_title:"Web sitemizle ilgili deneyiminiz nasıldı?",
    feedback_survey_sub:"Geri bildiriminiz geliştirmemize yardımcı olur — sadece bir saniye sürer.",
    feedback_good:"İyi",
    feedback_notbad:"Fena Değil",
    feedback_bad:"Kötü",
    feedback_more_title:"Teşekkürler! Daha fazlasını anlatmak ister misiniz?",
    feedback_more_sub:"Bir öneri, fikir veya soru ekleyin — ya da atlayın.",
    feedback_text_placeholder:"İsteğe bağlı — düşüncelerinizi, fikirlerinizi veya sorularınızı paylaşın…",
    feedback_sending:"Gönderiliyor…",
    feedback_send:"Gönder",
    feedback_no_thanks:"Hayır, teşekkürler",
    feedback_thanks_detailed:"Detaylı geri bildiriminiz için teşekkürler!",
    feedback_thanks_simple:"Geri bildiriminiz için teşekkürler!",
    feedback_recorded:"Yanıtınız kaydedildi.",
    feedback_skip:"Şimdilik atla",
    feedback_loading:"Geri bildirim yükleniyor…",
    feedback_empty_title:"Henüz geri bildirim yok",
    feedback_empty_text:"Çıkış anketinden ziyaretçi puanları, insanlar siteyi değerlendirdiğinde burada görünecek.",
    feedback_total_ratings:"Toplam Puanlama",
    feedback_satisfaction:"Memnuniyet / 100",
    feedback_today:"Bugün",
    feedback_last_7:"Son 7 gün",
    feedback_last_30:"Son 30 gün",
    feedback_recent:"Son Yanıtlar",
    feedback_with_message:"mesajlı",
    admin_exit_survey:"Çıkış Geri Bildirim Anketi",
    admin_no_feedback:"Henüz geri bildirim toplanmadı.",
    admin_loading:"Yükleniyor…",
    admin_total:"toplam",
    admin_last_7:"son 7 günde",
    admin_satisfaction:"Memnuniyet",
  },
  vi: {
nav_overview:"Tổng quan", nav_history:"Lịch sử", nav_kvk:"KVK", nav_dkp:"DKP", nav_calendar:"Lịch", nav_calculator:"Máy tính", nav_visitors:"Khách truy cập",
    nav_activity:"Hoạt động",
    activity_title:"Hoạt động Vương quốc",
    activity_tab_farms:"Nông trại & Hỗ trợ Liên minh",
    activity_tab_fort:"Pháo Đài Man Tộc",
    activity_upload_desc:"Tải lên tệp số liệu tổng trấn để cập nhật bảng xếp hạng Nông trại & Hỗ trợ Liên minh.",
    activity_upload_btn:"Tải tệp lên",
    activity_uploading:"Đang đọc tệp…",
    activity_owner_login:"Đăng nhập chủ sở hữu",
    activity_updated:"Dữ liệu ngày",
    activity_no_data:"Chưa có tệp nào được tải lên.",
    activity_no_results:"Không có người chơi nào khớp với tìm kiếm.",
    activity_col_helps:"Hỗ trợ Liên minh",
    activity_col_resources:"Tài nguyên đã thu",
    activity_total_helps:"Tổng Hỗ trợ",
    activity_total_resources:"Tổng Tài nguyên",
    activity_players:"Người chơi",
    activity_whole_kingdom:"Tổng cộng Toàn Vương quốc",
    fort_download_btn:"Tải xuống CSV",
    activity_search:"Tìm người chơi…",
    activity_loaded:"Đã tải {count} người chơi cho ngày {date} — mọi người đều có thể xem.",
    activity_missing_helps:" (Không tìm thấy cột Hỗ trợ Liên minh — hỗ trợ sẽ hiển thị là 0.)",
    activity_missing_resources:" (Không tìm thấy cột Tài nguyên đã thu — tài nguyên sẽ hiển thị là 0.)",
    activity_save_failed:"Đã tải cục bộ, nhưng không thể lưu cho người khác xem. Kiểm tra kết nối và thử lại.",
    activity_soon:"Sắp ra mắt",
    activity_soon_note:"Tính năng theo dõi Pháo Đài Man Tộc đang được phát triển.",
    activity_col_helps_gained:"Hỗ trợ đã tăng",
    activity_col_resources_gained:"Tài nguyên đã tăng",
    fort_no_data:"Chưa có dữ liệu Pháo Đài Man Tộc.",
    fort_col_name:"Tên",
    fort_col_forts:"Pháo Đài Đã Phá",
    fort_edit_title:"Chỉnh sửa người chơi",
    fort_name_label:"Tên người chơi",
    fort_forts_label:"Pháo đài đã phá",
    fort_confirm_remove:"Xóa \"{name}\" khỏi bảng xếp hạng?",
    fort_clear_btn:"Xóa bảng xếp hạng",
    fort_confirm_clear:"Xóa toàn bộ bảng xếp hạng Pháo Đài Man Tộc? Không thể hoàn tác.",
    fort_updated:"Cập nhật lần cuối",
    fort_players:"người chơi",
    fort_save_failed:"Không thể lưu. Kiểm tra kết nối và thử lại.",
    fort_add_desc:"Thêm từng tổng trấn thủ công — nhập tên và số Pháo Đài Man Tộc họ đã phá. Nếu cùng một tổng trấn đã có trên bảng, số pháo đài cao hơn sẽ được giữ.",
    fort_add_name_placeholder:"Tên tổng trấn…",
    fort_add_forts_placeholder:"Pháo đài đã phá",
    fort_add_btn:"Thêm người chơi",
    fort_added_msg:"Đã thêm {name} với {forts} pháo đài.",
    fort_updated_msg:"Đã cập nhật {name} — giữ số pháo đài cao hơn.",
    fort_add_invalid:"Vui lòng nhập tên tổng trấn hợp lệ và số pháo đài từ 0 trở lên.",
    fort_login_title:"Pháo Đài Man Tộc — Đăng Nhập Chủ Sở Hữu",
    fort_login_prompt:"Nhập mật khẩu Pháo Đài Man Tộc để mở khóa công cụ thêm/chỉnh sửa.",
    about_toggle:"Trang này hoạt động như thế nào",
    about_intro:"XTiT là trợ thủ vương quốc toàn diện của bạn — giúp bạn cập nhật sự kiện và theo dõi tiến trình của liên minh.",
    about_li_overview:"Tổng quan — Theo dõi chương hiện tại và đếm ngược trực tiếp.",
    about_li_history:"Lịch sử — Các chương đã qua và sự kiện đã hoàn thành.",
    about_li_kvk:"KVK — Lịch trình chiến trường Kingdom vs Kingdom.",
    about_li_chat:"Global Chat — Trò chuyện thời gian thực giữa mọi liên minh trong vương quốc, dịch sang hơn 35 ngôn ngữ.",
    about_li_dkp:"Theo dõi DKP — Tải lên số liệu tổng trấn và theo dõi hiệu suất KvK.",
    about_li_calendar:"Lịch — Lịch trình sự kiện định kỳ.",
    about_li_calculator:"Máy tính — Công cụ tính nhanh AP, XP, Đá quý và điểm VIP.",
    about_li_visitors:"Khách truy cập — Xem có bao nhiêu chỉ huy đã check-in.",
    about_footer:"Tất cả thời gian hiển thị theo UTC. Trang tự động làm mới.",
    gate_title:"Trình Theo Dõi Sự Kiện Vương Quốc", gate_desc:"Quá nhiều tính năng giúp cuộc sống của bạn dễ dàng hơn.",
    gate_btn:"Nhấn để vào", gate_checked_in:"chỉ huy đã check-in", gate_connecting:"Đang kết nối...",
    banner_season_over:"Tất cả các chương đã kết thúc — mùa giải đã hoàn tất.",
    coming_up:"Sắp diễn ra",
    history_title:"Lịch sử", history_count_suffix:"chương đã hoàn thành cho đến nay",
    kvk_title:"Chiến trường — Kingdom vs Kingdom", kvk_estimated:"Ước tính",
    kvk_note:"Các ngày này là ước tính và sẽ tự động cập nhật khi có ngày chính thức.",
    calendar_title:"Lịch sự kiện", jump_today:"Về hôm nay", no_events_day:"Không có sự kiện nào trong ngày này.",
    calculator_title:"Máy tính điểm", calculator_note:"Nhập số lượng vật phẩm của bạn để tính tổng AP, XP, Đá quý và điểm VIP.",
    ap_title:"Điểm hành động", xp_title:"Điểm kinh nghiệm", gems_title:"Đá quý", vip_title:"Điểm VIP",
    visitors_title:"Khách truy cập", total_visitors:"Tổng số khách truy cập", checked_in_note:"Các chỉ huy đã check-in.", unavailable_now:"Hiện không khả dụng",
    contact_question:"Câu hỏi, góp ý, hoặc phát hiện lỗi?", contact_title:"Kết nối với tôi trên Discord",
    discord_btn:"Nhắn tin cho tôi trên Discord", contact_note:"Liên hệ bất cứ lúc nào với yêu cầu, phản hồi hoặc vấn đề về trang web.",
    dkp_title:"Trình theo dõi DKP", dkp_welcome:"Chào mừng đến với Trình theo dõi DKP.",
    dkp_summary_title:"Tổng cộng toàn vương quốc",
    dkp_summary_note:"Thống kê tổng hợp của tất cả tổng trấn giữa hai ảnh chụp nhanh đã chọn.",
    dkp_desc1:"Phần này theo dõi hiệu suất KvK của Vương quốc 4161 bằng cách so sánh dữ liệu từ hai thời điểm khác nhau (ảnh chụp nhanh).",
    dkp_desc2:"Ảnh chụp nhanh được ghi lại trước và sau các trận KvK để đo tiến trình của từng tổng trấn trong vương quốc.",
    dkp_desc3:"Chọn hai ảnh chụp nhanh bên dưới để xem mỗi tổng trấn đã tăng bao nhiêu về sức mạnh, số kill và hơn thế nữa.",
    dkp_top_title:"Thành Tích Cao Nhất",
    dkp_top_note:"Tổng trấn có chỉ số được chọn cao nhất.",
    dkp_gov_modal_title:"Chi Tiết Tổng Trấn",
    dkp_gov_id:"ID",
    dkp_gov_change:"Thay đổi",
    owner_login:"Đăng nhập chủ sở hữu", owner_only:"Chỉ dành cho chủ sở hữu", upload_desc:"Tải lên tệp số liệu tổng trấn mới cho một ngày cụ thể.",
    upload_btn:"Tải lên tệp tổng trấn", uploading_btn:"Đang đọc tệp…",
    snapshots_label:"Ảnh chụp nhanh", total_suffix:"tổng cộng",
    from_label:"Từ", to_label:"Đến", sort_label:"Sắp xếp theo", search_placeholder:"Tìm tổng trấn…",
    sort_kp_gained:"KP tăng", sort_power_gained:"Sức mạnh tăng", sort_dead_gained:"Tử vong tăng",
    sort_total_kp:"Tổng KP", sort_total_power:"Tổng sức mạnh", sort_total_dead:"Tổng tử vong",
    slide_left:"← Trượt trái", slide_right:"Trượt phải →", column_settings:"Cài đặt cột",
    col_governor:"Tổng trấn", col_power:"Sức mạnh", col_kp:"KP", col_dead:"Tử vong",
    col_power_gained:"Sức mạnh tăng", col_kp_gained:"KP tăng", col_dead_gained:"Tử vong tăng",
    load_more:"Tải thêm", remaining_suffix:"còn lại",
    dkp_kvk_toggle_label:"Tiến độ DKP KVK",
    dkp_kvk_active:"ĐANG BẬT",
    dkp_kvk_inactive:"ĐANG TẮT",
    dkp_kvk_toggle_help:"BẬT ngay khi KVK bắt đầu — mọi kill và mọi death giữa hai ảnh chụp sẽ được tính vào DKP. TẮT khi KVK kết thúc để ngừng tính.",
    dkp_kvk_turn_on:"BẬT",
    dkp_kvk_turn_off:"TẮT",
    dkp_kvk_saving:"Đang lưu…",
    dkp_reset_title:"Đặt lại Tiến độ DKP",
    dkp_reset_help_active:"Hiện đã đặt lại từ {date}. Mọi ảnh chụp trước đó đều bị ẩn.",
    dkp_reset_help_inactive:"Đặt lại DKP cho mọi người. Ảnh chụp từ hôm nay trở đi sẽ được tính.",
    dkp_reset_btn:"Đặt lại Tiến độ",
    dkp_reset_btn_busy:"Đang đặt lại…",
    dkp_kvk_status_off:"⚠️ Tiến độ DKP KVK đã bị chủ sở hữu TẮT. Tiến độ sẽ hiển thị 0% cho đến khi chủ sở hữu bật lại.",
    dkp_kvk_status_on:"✅ Tiến độ DKP KVK ĐANG BẬT. Mọi kill và death giữa các ảnh chụp đã chọn đều được tính vào DKP.",
    dkp_reset_modal_title:"Đặt lại Tiến độ DKP?",
    dkp_reset_modal_title_busy:"Đang đặt lại DKP…",
    dkp_reset_modal_body:"Thao tác này sẽ đặt lại tiến độ DKP cho mọi người. Mọi ảnh chụp trước hôm nay sẽ bị ẩn khỏi menu Từ / Đến, và DKP sẽ hiển thị 0% cho đến khi bạn tải lên ảnh chụp mới vào {date} hoặc sau đó.",
    dkp_reset_modal_warning:"Không thể hoàn tác. Bạn sẽ có 10 giây để hủy.",
    dkp_reset_modal_confirm:"Có, Đặt lại Tất cả",
    dkp_reset_modal_countdown:"Đặt lại DKP cho mọi người trong {n}…",
    dkp_reset_modal_countdown_help:"Nhấn Hủy để dừng — không có gì được lưu cho đến khi đếm ngược kết thúc.",
    no_snapshots:"Chưa có ảnh chụp nhanh nào được tải lên. Hãy tải lên tệp tổng trấn đầu tiên ở trên để bắt đầu.",
    footer_note:"Tất cả thời gian theo UTC · tự động cập nhật, không cần làm mới.", footer_built_by:"Được xây dựng bởi XTiT",
    install_btn:"Cài đặt",
    owner_login_prompt:"Nhập mật khẩu chủ sở hữu để mở khóa công cụ tải lên.", password_placeholder:"Nhập mật khẩu...",
    cancel_btn:"Hủy", login_btn:"Đăng nhập",
    confirm_action_title:"Xác nhận hành động", remove_btn:"Xóa",
    month_1:"Tháng 1", month_2:"Tháng 2", month_3:"Tháng 3", month_4:"Tháng 4", month_5:"Tháng 5", month_6:"Tháng 6",
    month_7:"Tháng 7", month_8:"Tháng 8", month_9:"Tháng 9", month_10:"Tháng 10", month_11:"Tháng 11", month_12:"Tháng 12",
    dow_mon:"T2", dow_tue:"T3", dow_wed:"T4", dow_thu:"T5", dow_fri:"T6", dow_sat:"T7", dow_sun:"CN",
    stage_upcoming:"Sắp diễn ra", stage_live:"Đang diễn ra", stage_complete:"Hoàn thành",
    stage_starts:"Bắt đầu", stage_ends:"Kết thúc", stage_open_ended:"Không giới hạn",
    stage_until_starts:"cho đến khi bắt đầu", stage_left:"còn lại", stage_no_fixed_end:"Đang diễn ra — chưa có ngày kết thúc cố định", stage_completed_prefix:"Đã hoàn thành",
    label_opens:"Mở", label_ends:"Kết thúc", bonus_opens_suffix:"mở",
    ops_chapter:"Chương", ops_in_progress:"Đang diễn ra", ops_opened:"Đã mở", ops_ends:"Kết thúc", ops_left:"còn lại",
    capture_is_open:"đã mở", capture_go_capture:"Hãy chiếm lấy", capture_opens:"Mở",
    ops_opens_next:"Sắp mở", ops_until_opens:"cho đến khi mở",
    ops_season_complete:"Mùa giải kết thúc", ops_all_concluded:"Tất cả các chương đã kết thúc", ops_last_ended:"Chương cuối cùng đã kết thúc vào",
    skip_link:"Chuyển đến chương hiện tại",
    toast_season_complete:"Mùa giải kết thúc", toast_all_concluded:"Tất cả các chương đã kết thúc.", toast_chapter_begun:"đã bắt đầu",
    tag_new:"mới", tag_left:"đã rời", governors_suffix:"tổng trấn",
    msg_pick_date:"Vui lòng chọn ngày cho tệp này trước.", msg_could_not_read:"Không thể đọc tệp này.",
    msg_save_failed:"Đã tải cục bộ, nhưng không thể lưu cho những người khác xem. Kiểm tra kết nối và thử lại.",
    confirm_remove_snapshot:"Xóa ảnh chụp nhanh {date}? Không thể hoàn tác.",
    install_title:"Thêm vào màn hình chính", install_which_device:"Bạn đang dùng thiết bị nào?", install_pick_device:"Chọn thiết bị của bạn để xem các bước chính xác.",
    install_iphone_ipad:"iPhone / iPad", install_android:"Android", install_computer:"Máy tính",
    install_which_browser:"Trình duyệt nào?", install_safari_or_chrome:"Safari hay Chrome?", install_safari:"Safari", install_chrome:"Chrome",
    install_chrome_or_samsung:"Chrome hay Samsung Internet?", install_samsung:"Samsung Internet",
    install_chrome_or_other:"Chrome, hay trình duyệt khác?", install_other_browser:"Trình duyệt khác", install_back:"Quay lại",
    language_label:"Ngôn ngữ",
    msg_loaded_governors:"Đã tải {count} tổng trấn cho ngày {date} — mọi người đều có thể xem.",
    msg_missing_optional:" (Tệp này không có cột {cols} — các giá trị đó sẽ hiển thị là 0.)",
    msg_missing_critical:" Cảnh báo: không tìm thấy cột cho {cols} — các giá trị đó sẽ là 0 cho mọi tổng trấn.",
    aria_prev_month:"Tháng trước", aria_next_month:"Tháng sau", aria_close:"Đóng", aria_dismiss:"Đóng",
    aria_sections:"Các mục", title_remove:"Xóa {date}",
    aria_items_owned:"Số lượng {amount} {unit} sở hữu",
    err_incorrect_password:"Sai mật khẩu. Vui lòng thử lại.",
    bonus_shrine:"Đền Thờ",
    bonus_level_3_pass:"Cổng Cấp 3",
    bonus_lost_temple:"Đền Thờ Thất Lạc",
    kvk_stage_1_title:"Giai đoạn 1 — Bí Mật Đã Mất",
    kvk_stage_1_sub:"Giết Kẻ Cướp để khám phá bí mật đã mất — hãy sẵn sàng chiến đấu",
    kvk_stage_2_title:"Giai đoạn 2 — Chuẩn Bị Chiến Đấu",
    kvk_stage_2_sub:"Huấn Luyện Quân Đội — hãy sẵn sàng cho cuộc chiến sắp tới",
    kvk_stage_3_title:"Giai đoạn 3 — Cuộc Đụng Độ Của Các Nền Văn Minh",
    kvk_stage_3_sub:"Tấn Công Doanh Trại / Pháo Đài Kẻ Cướp — hãy sẵn sàng chiến đấu",
    kvk_stage_4_title:"Giai đoạn 4 — Vương Quốc Thất Lạc Mở Cửa",
    kvk_stage_4_sub:"KVK bắt đầu — Vương Quốc Thất Lạc đã mở, hãy tiến vào và chiến đấu",
    g_tap_the:"Nhấn vào",
    g_btn_share:"Chia sẻ",
    g_icon_safari_bar:"biểu tượng trên thanh Safari",
    g_scroll_tap:"Cuộn xuống và nhấn",
    g_btn_add_home:"Thêm vào Màn hình chính",
    g_tap:"Nhấn",
    g_btn_add:"Thêm",
    g_in_top_corner:"ở góc trên",
    g_icon_next_address:"biểu tượng bên cạnh thanh địa chỉ",
    g_menu_top_right:"menu ở góc trên bên phải",
    g_confirm_tap:"Xác nhận và nhấn",
    g_btn_menu:"Menu",
    g_icon_bottom_right:"biểu tượng ở góc dưới bên phải",
    g_btn_add_page_to:"Thêm trang vào",
    g_btn_home_screen:"Màn hình chính",
    g_then:"sau đó",
    g_look_for:"Tìm",
    g_btn_install:"Cài đặt",
    g_icon_address_bar:"biểu tượng trên thanh địa chỉ",
    g_dont_see_open:"Không thấy? Mở",
    g_menu_word:"menu",
    g_choose:"Chọn",
    g_btn_install_muster:"Cài đặt XTiT",
    g_look_install_icon:"Tìm biểu tượng cài đặt trên thanh công cụ trình duyệt",
    g_or_check_menu:"Hoặc kiểm tra menu trình duyệt để tìm",
    save_btn:"Lưu",
    nav_chat:"Trò chuyện Toàn cầu",
    chat_title:"Trò chuyện Toàn cầu",
    chat_loading:"Đang tải tin nhắn…",
    chat_empty:"Chưa có tin nhắn — hãy là người đầu tiên chào!",
    chat_anonymous:"Ẩn danh",
    chat_placeholder:"Nhập tin nhắn…",
    chat_send:"Gửi",
    chat_name_title:"Chọn tên hiển thị",
    chat_name_prompt:"Chọn tên mà các chỉ huy khác sẽ thấy bên cạnh tin nhắn của bạn.",
    chat_name_placeholder:"Nhập tên của bạn...",
    chat_name_confirm:"Bắt đầu trò chuyện",
    chat_notice:"Tất cả tin nhắn được tự động xóa vào thứ Hai hàng tuần lúc 00:00 UTC.",
    chat_delete_msg_title:"Xóa tin nhắn?",
    chat_delete_msg_body:"Bạn có chắc muốn xóa tin nhắn này không?",
    chat_delete_yes:"Có, Xóa",
    chat_delete_no:"Không, Hủy",
    chat_delete_all_btn:"Xóa tất cả tin nhắn của tôi",
    chat_delete_all_title:"Xóa tất cả tin nhắn của bạn?",
    chat_delete_all_body:"Bạn có chắc muốn xóa tất cả tin nhắn của mình khỏi Trò chuyện Toàn cầu không?",
    chat_delete_all_yes:"Có, Xóa tất cả",
    chat_filtered_msg:"Tin nhắn đó chứa ngôn ngữ không được phép ở đây. Vui lòng diễn đạt lại.",
    chat_translate_lang_btn:"Ngôn ngữ dịch",
    chat_select_translate_lang:"Chọn ngôn ngữ dịch của bạn",
    chat_translate_lang_desc:"Tin nhắn bạn dịch sẽ hiển thị bằng ngôn ngữ này. Bạn có thể thay đổi bất cứ lúc nào.",
    chat_translate_btn:"Dịch",
    chat_hide_translation_btn:"Ẩn bản dịch",
    chat_translating:"Đang dịch…",
    chat_translate_error:"Dịch thất bại. Thử lại.",
    chat_translated_label:"Đã dịch",
    owner_badge:"Chủ sở hữu",
    chat_owner_login_btn:"Đăng nhập Chủ sở hữu",
    chat_owner_logout_btn:"Đăng xuất (Chủ sở hữu)",
    chat_admin_panel_btn:"Bảng Quản trị",
    chat_admin_panel_title:"Trò chuyện Toàn cầu — Bảng Quản trị",
    chat_admin_intro:"Quản lý người dùng và tin nhắn Trò chuyện Toàn cầu. Các điều khiển này chỉ chủ sở hữu thấy.",
    chat_admin_users_label:"Người dùng trò chuyện đang hoạt động",
    chat_admin_no_users:"Chưa có tin nhắn từ người dùng thường.",
    chat_admin_messages_suffix:"tin nhắn",
    chat_admin_ban_btn:"Cấm & xóa tin nhắn",
    chat_admin_unban_btn:"Bỏ cấm",
    chat_admin_banned_label:"Tên bị cấm",
    chat_admin_no_banned:"Hiện không có ai bị cấm.",
    chat_admin_confirm_ban:"Cấm \"{name}\" và xóa tất cả tin nhắn của họ? Họ sẽ không thể gửi tin nhắn mới khi bị cấm.",
    chat_admin_confirm_unban:"Bỏ cấm \"{name}\"? Họ sẽ có thể trò chuyện lại.",
    chat_banned_error:"Tên đó đã bị chủ sở hữu cấm khỏi Trò chuyện Toàn cầu.",
    chat_change_name_btn:"Đổi tên hiển thị",
    chat_emoji_btn:"Biểu tượng vương quốc",
    chat_reply_btn:"Trả lời",
    chat_replying_to:"Đang trả lời",
    chat_clear_reply_btn:"Hủy trả lời",
    chat_jump_to_reply:"Chuyển đến tin nhắn được trả lời",
    chat_view_replies:"Chuyển đến tin nhắn này",
    chat_reply_singular:"trả lời",
    chat_replies_plural:"trả lời",
    chat_announce_make:"Tạo thông báo",
    chat_announce_on:"Chế độ thông báo BẬT",
    chat_announce_placeholder:"Viết thông báo cho mọi người…",
    chat_announce_send:"Thông báo",
    chat_announcement_label:"Thông báo",
    chat_announce_hint:"Chỉ bạn (chủ sở hữu) mới có thể đăng thông báo.",
    chat_img_send_btn:"Gửi ảnh",
    chat_img_guide_btn:"Hướng dẫn kích thước ảnh",
    chat_img_guide_title:"Hướng dẫn kích thước ảnh",
    chat_img_max:"Kích thước tối đa:",
    chat_img_max_val:"5 MB mỗi ảnh",
    chat_img_recommended:"Đề xuất:",
    chat_img_recommended_val:"dưới 3 MB",
    chat_img_formats:"Định dạng:",
    chat_img_formats_val:"JPG, PNG, GIF, WebP",
    chat_img_tip_camera:"📷 Ảnh chụp từ điện thoại của bạn hoạt động tốt",
    chat_img_tip_screenshot:"🖼️ Ảnh chụp màn hình luôn ổn",
    chat_img_auto_shrink:"Ảnh lớn hơn sẽ tự động được thu nhỏ trước khi tải lên.",
    chat_img_too_large:"Ảnh quá lớn — tối đa 5 MB. Vui lòng chọn ảnh nhỏ hơn.",
    chat_img_failed:"Tải lên thất bại. Vui lòng thử lại.",
    chat_reply_image:"ảnh",
    chat_cooldown_send:"Tin nhắn tiếp theo",
    chat_cooldown_image:"Thời gian chờ ảnh",
    chat_online_label:"Chỉ huy trực tuyến",
    chat_slow_mode_msg:"Chế độ chậm — thử lại sau {n} giây.",
    chat_slow_mode_img:"Chế độ chậm ảnh — thử lại sau {n} giây.",
    chat_typing_one:"đang nhập…",
    chat_typing_and:"và",
    chat_typing_are:"đang nhập…",
    chat_typing_others:"người khác đang nhập…",
    fort_week_label:"Tuần",
    fort_governor_label:"Tổng trấn",
    fort_alliance_label:"Liên minh",
    fort_forts_label_short:"Pháo đài",
    fort_alliance_placeholder:"Tên liên minh…",
    fort_all_alliances:"Tất cả Liên minh",
    fort_no_alliance:"Không có Liên minh",
    fort_search_player:"Tìm người chơi…",
    fort_show_deleted:"Hiện Đã xóa",
    fort_hide_deleted:"Ẩn Đã xóa",
    fort_deleted_tag:"Đã xóa",
    fort_restore_title:"Khôi phục người chơi",
    fort_alliances_label:"Liên minh",
    fort_players_label:"Người chơi",
    fort_all_weeks_total:"Tất cả các tuần",
    fort_upload_normal_opt:"Tệp thường — KHÔNG tính vào DKP",
    fort_upload_kvk_opt:"Tệp thống kê KVK — TÍNH vào DKP",
    fort_badge_kvk:"KVK",
    fort_badge_normal:"THƯỜNG",
    fort_image_unavailable:"Hình ảnh không khả dụng",
    chat_pick_reaction:"Chọn một biểu cảm",
    chat_scroll_latest:"Cuộn đến tin nhắn mới nhất",
    chat_send_failed:"Không gửi được. Vui lòng thử lại.",
    chat_loading_more:"Đang tải…",
    gov_owner_label:"Chủ sở hữu",
    dkp_earned_tip:"Đã kiếm",
    dkp_required_tip:"Yêu cầu",
    dkp_power_tip:"sức mạnh",
    dkp_normal_tip:"Tệp thường — không tính DKP",
    feedback_survey_title:"Trải nghiệm của bạn với trang web của chúng tôi như thế nào?",
    feedback_survey_sub:"Phản hồi của bạn giúp chúng tôi cải thiện — chỉ mất một giây.",
    feedback_good:"Tốt",
    feedback_notbad:"Không Tệ",
    feedback_bad:"Tệ",
    feedback_more_title:"Cảm ơn! Muốn cho chúng tôi biết thêm?",
    feedback_more_sub:"Thêm gợi ý, ý tưởng hoặc câu hỏi — hoặc bỏ qua.",
    feedback_text_placeholder:"Tùy chọn — chia sẻ suy nghĩ, ý tưởng hoặc câu hỏi của bạn…",
    feedback_sending:"Đang gửi…",
    feedback_send:"Gửi",
    feedback_no_thanks:"Không, cảm ơn",
    feedback_thanks_detailed:"Cảm ơn phản hồi chi tiết của bạn!",
    feedback_thanks_simple:"Cảm ơn phản hồi của bạn!",
    feedback_recorded:"Phản hồi của bạn đã được ghi lại.",
    feedback_skip:"Bỏ qua bây giờ",
    feedback_loading:"Đang tải phản hồi…",
    feedback_empty_title:"Chưa có phản hồi",
    feedback_empty_text:"Đánh giá của khách truy cập từ khảo sát thoát sẽ xuất hiện ở đây ngay khi mọi người đánh giá trang web.",
    feedback_total_ratings:"Tổng Đánh giá",
    feedback_satisfaction:"Hài lòng / 100",
    feedback_today:"Hôm nay",
    feedback_last_7:"7 ngày qua",
    feedback_last_30:"30 ngày qua",
    feedback_recent:"Phản hồi Gần đây",
    feedback_with_message:"có tin nhắn",
    admin_exit_survey:"Khảo sát Phản hồi Thoát",
    admin_no_feedback:"Chưa thu thập phản hồi.",
    admin_loading:"Đang tải…",
    admin_total:"tổng cộng",
    admin_last_7:"trong 7 ngày qua",
    admin_satisfaction:"Hài lòng",
  },
  ko: {
nav_overview:"개요", nav_history:"히스토리", nav_kvk:"KVK", nav_dkp:"DKP", nav_calendar:"캘린더", nav_calculator:"계산기", nav_visitors:"방문자",
    nav_activity:"활동",
    activity_title:"왕국 활동",
    activity_tab_farms:"농장 & 동맹 지원",
    activity_tab_fort:"야만인 요새",
    activity_upload_desc:"농장 & 동맹 지원 리더보드를 업데이트하려면 총독 통계 파일을 업로드하세요.",
    activity_upload_btn:"파일 업로드",
    activity_uploading:"파일 읽는 중…",
    activity_owner_login:"소유자 로그인",
    activity_updated:"데이터 날짜",
    activity_no_data:"아직 업로드된 파일이 없습니다.",
    activity_no_results:"검색과 일치하는 플레이어가 없습니다.",
    activity_col_helps:"동맹 지원",
    activity_col_resources:"수집한 자원",
    activity_total_helps:"총 지원",
    activity_total_resources:"총 자원",
    activity_players:"플레이어",
    activity_whole_kingdom:"왕국 전체 합계",
    fort_download_btn:"다운로드",
    fort_download_excel:"Excel (.xlsx)",
    fort_download_csv:"CSV (.csv)",
    fort_copy_clipboard:"클립보드에 복사",
    fort_share_btn:"공유…",
    fort_copied_msg:"클립보드에 복사되었습니다.",
    fort_copy_failed:"복사하지 못했습니다. 다시 시도하세요.",
    activity_search:"플레이어 검색…",
    activity_loaded:"{date}에 대해 {count}명의 플레이어를 불러왔습니다 — 이제 모두가 볼 수 있습니다.",
    activity_missing_helps:" (동맹 지원 열이 없습니다 — 지원은 0으로 표시됩니다.)",
    activity_missing_resources:" (수집한 자원 열이 없습니다 — 자원은 0으로 표시됩니다.)",
    activity_save_failed:"로컬에는 로드되었지만 다른 방문자용으로 저장할 수 없습니다. 연결을 확인하고 다시 시도하세요.",
    activity_soon:"곧 출시",
    activity_soon_note:"야만인 요새 추적 기능이 준비 중입니다.",
    activity_col_helps_gained:"획득 지원",
    activity_col_resources_gained:"획득 자원",
    fort_no_data:"아직 야만인 요새 데이터가 없습니다.",
    fort_col_name:"이름",
    fort_col_forts:"파괴한 요새",
    fort_edit_title:"플레이어 편집",
    fort_name_label:"플레이어 이름",
    fort_forts_label:"파괴한 요새",
    fort_confirm_remove:"리더보드에서 \"{name}\"을(를) 제거할까요?",
    fort_clear_btn:"리더보드 지우기",
    fort_confirm_clear:"야만인 요새 리더보드 전체를 삭제할까요? 되돌릴 수 없습니다.",
    fort_updated:"마지막 업데이트",
    fort_players:"명의 플레이어",
    fort_save_failed:"저장할 수 없습니다. 연결을 확인하고 다시 시도하세요.",
    fort_add_desc:"각 총독을 수동으로 추가하세요 — 이름과 파괴한 야만인 요새 수를 입력하세요. 이미 보드에 있는 총독이면 더 높은 요새 수가 유지됩니다.",
    fort_add_name_placeholder:"총독 이름…",
    fort_add_forts_placeholder:"파괴한 요새",
    fort_add_btn:"플레이어 추가",
    fort_added_msg:"{name}을(를) {forts}개의 요새와 함께 추가했습니다.",
    fort_updated_msg:"{name} 업데이트됨 — 더 높은 요새 수를 유지했습니다.",
    fort_add_invalid:"유효한 총독 이름과 0 이상의 요새 수를 입력하세요.",
    fort_login_title:"야만인 요새 — 소유자 로그인",
    fort_login_prompt:"추가/편집 도구를 잠금 해제하려면 야만인 요새 비밀번호를 입력하세요.",
    fort_no_data:"아직 야만인 요새 데이터가 없습니다.",
    fort_col_name:"이름",
    fort_col_forts:"파괴한 요새",
    fort_edit_title:"플레이어 편집",
    fort_name_label:"플레이어 이름",
    fort_forts_label:"파괴한 요새",
    fort_confirm_remove:"리더보드에서 \"{name}\"을(를) 제거할까요?",
    fort_clear_btn:"리더보드 지우기",
    fort_confirm_clear:"야만인 요새 리더보드 전체를 삭제할까요? 되돌릴 수 없습니다.",
    fort_updated:"마지막 업데이트",
    fort_players:"명의 플레이어",
    fort_save_failed:"스캔했지만 다른 방문자를 위해 저장할 수 없습니다. 연결을 확인하고 다시 시도하세요.",
    fort_add_desc:"각 총독을 수동으로 추가하세요 — 이름과 파괴한 야만인 요새 수를 입력하세요. 이미 보드에 있는 총독이면 더 높은 요새 수가 유지됩니다.",
    fort_add_name_placeholder:"총독 이름…",
    fort_add_forts_placeholder:"파괴한 요새",
    fort_add_btn:"플레이어 추가",
    fort_added_msg:"{name}을(를) {forts}개의 요새와 함께 추가했습니다.",
    fort_updated_msg:"{name} 업데이트됨 — 더 높은 요새 수를 유지했습니다.",
    fort_add_invalid:"유효한 총독 이름과 0 이상의 요새 수를 입력하세요.",
    fort_login_title:"야만인 요새 — 소유자 로그인",
    fort_login_prompt:"추가/편집 도구를 잠금 해제하려면 야만인 요새 비밀번호를 입력하세요.",
    about_toggle:"이 페이지 사용법",
    about_intro:"XTiT는 이벤트 소식을 알려주고 동맹의 진행 상황을 추적해주는 올인원 왕국 도우미입니다.",
    about_li_overview:"개요 — 현재 챕터 실시간 추적 및 카운트다운.",
    about_li_history:"히스토리 — 지난 챕터 및 완료된 이벤트.",
    about_li_kvk:"KVK — 왕국 간 전쟁 전선 일정.",
    about_li_chat:"글로벌 채팅 — 왕국 내 모든 동맹 간의 실시간 채팅, 35개 이상 언어 번역 지원.",
    about_li_dkp:"DKP 트래커 — 총독 통계를 업로드하고 KvK 성과를 추적하세요.",
    about_li_calendar:"캘린더 — 반복되는 이벤트 일정.",
    about_li_calculator:"계산기 — AP, XP, 보석, VIP 포인트 빠른 계산기.",
    about_li_visitors:"방문자 — 체크인한 사령관 수를 확인하세요.",
    about_footer:"모든 시간은 UTC 기준으로 표시됩니다. 페이지는 자동으로 새로고침됩니다.",
    gate_title:"왕국 이벤트 트래커", gate_desc:"당신의 삶을 편하게 해줄 다양한 기능들.",
    gate_btn:"입장하려면 누르세요", gate_checked_in:"명의 사령관이 체크인했습니다", gate_connecting:"연결 중...",
    banner_season_over:"모든 챕터가 종료되었습니다 — 시즌이 끝났습니다.",
    coming_up:"다가오는 일정",
    history_title:"히스토리", history_count_suffix:"챕터가 지금까지 완료됨",
    kvk_title:"전선 — 왕국 간 전쟁", kvk_estimated:"예상",
    kvk_note:"이 날짜는 예상치이며 공식 날짜가 발표되면 자동으로 업데이트됩니다.",
    calendar_title:"이벤트 캘린더", jump_today:"오늘로 이동", no_events_day:"이 날에는 예정된 이벤트가 없습니다.",
    calculator_title:"포인트 계산기", calculator_note:"재고 수량을 입력하여 총 AP, XP, 보석, VIP 포인트를 계산하세요.",
    ap_title:"액션 포인트", xp_title:"경험치 포인트", gems_title:"보석", vip_title:"VIP 포인트",
    visitors_title:"방문자", total_visitors:"총 방문자 수", checked_in_note:"체크인한 사령관들.", unavailable_now:"현재 사용할 수 없음",
    contact_question:"질문, 제안 또는 버그를 발견하셨나요?", contact_title:"디스코드에서 저와 연결하세요",
    discord_btn:"디스코드로 메시지 보내기", contact_note:"요청, 피드백 또는 사이트 문제가 있으면 언제든지 연락하세요.",
    dkp_title:"DKP 트래커", dkp_welcome:"DKP 트래커에 오신 것을 환영합니다.",
    dkp_summary_title:"왕국 전체 합계",
    dkp_summary_note:"선택한 두 스냅샷 사이의 모든 총독의 통합 통계입니다.",
    dkp_desc1:"이 섹션은 두 시점의 데이터(스냅샷)를 비교하여 4161 왕국의 KvK 성과를 추적합니다.",
    dkp_desc2:"스냅샷은 KvK 전투 전후에 기록되어 왕국 전체에서 각 총독의 진행 상황을 측정합니다.",
    dkp_desc3:"아래에서 두 스냅샷을 선택하여 각 총독이 전투력, 킬 등에서 얼마나 성장했는지 확인하세요.",
    dkp_top_title:"최고 성과자",
    dkp_top_note:"선택한 통계에서 가장 높은 총독입니다.",
    dkp_gov_modal_title:"총독 상세 정보",
    dkp_gov_id:"ID",
    dkp_gov_change:"변화",
    owner_login:"소유자 로그인", owner_only:"소유자 전용", upload_desc:"특정 날짜의 새 총독 통계 파일을 업로드하세요.",
    upload_btn:"총독 파일 업로드", uploading_btn:"파일 읽는 중…",
    snapshots_label:"스냅샷", total_suffix:"총계",
    from_label:"시작", to_label:"종료", sort_label:"정렬 기준", search_placeholder:"총독 검색…",
    sort_kp_gained:"획득 KP", sort_power_gained:"획득 전투력", sort_dead_gained:"획득 전사자",
    sort_total_kp:"총 KP", sort_total_power:"총 전투력", sort_total_dead:"총 전사자",
    slide_left:"← 왼쪽으로", slide_right:"오른쪽으로 →", column_settings:"열 설정",
    col_governor:"총독", col_power:"전투력", col_kp:"KP", col_dead:"전사자",
    col_power_gained:"획득 전투력", col_kp_gained:"획득 KP", col_dead_gained:"획득 전사자",
    load_more:"더 보기", remaining_suffix:"남음",
    dkp_kvk_toggle_label:"KVK DKP 진행 상황",
    dkp_kvk_active:"활성",
    dkp_kvk_inactive:"비활성",
    dkp_kvk_toggle_help:"KVK 시작 시 ON으로 전환하세요 — 두 스냅샷 사이의 모든 킬과 사망이 DKP에 집계됩니다. KVK 종료 시 OFF로 전환하세요.",
    dkp_kvk_turn_on:"켜기",
    dkp_kvk_turn_off:"끄기",
    dkp_kvk_saving:"저장 중…",
    dkp_reset_title:"DKP 진행 상황 초기화",
    dkp_reset_help_active:"{date}부터 초기화되었습니다. 이전 스냅샷은 모두 숨겨집니다.",
    dkp_reset_help_inactive:"모두를 위해 DKP를 초기화합니다. 오늘 이후 스냅샷부터 계산됩니다.",
    dkp_reset_btn:"진행 상황 초기화",
    dkp_reset_btn_busy:"초기화 중…",
    dkp_kvk_status_off:"⚠️ KVK DKP 진행 상황이 소유자에 의해 꺼져 있습니다. 소유자가 활성화할 때까지 진행률이 0%로 표시됩니다.",
    dkp_kvk_status_on:"✅ KVK DKP 진행 상황이 활성화되었습니다. 선택한 스냅샷 사이의 모든 킬과 사망이 DKP에 집계됩니다.",
    dkp_reset_modal_title:"DKP 진행 상황을 초기화할까요?",
    dkp_reset_modal_title_busy:"DKP 초기화 중…",
    dkp_reset_modal_body:"모든 사람의 DKP 진행 상황이 초기화됩니다. 오늘 이전의 모든 스냅샷이 From / To 드롭다운에서 숨겨지고, {date} 이후의 새 스냅샷을 업로드할 때까지 DKP가 0%로 표시됩니다.",
    dkp_reset_modal_warning:"이 작업은 되돌릴 수 없습니다. 취소할 수 있는 시간은 10초입니다.",
    dkp_reset_modal_confirm:"예, 모두 초기화",
    dkp_reset_modal_countdown:"모두의 DKP가 {n} 후에 초기화됩니다…",
    dkp_reset_modal_countdown_help:"중지하려면 취소를 클릭하세요 — 카운트다운이 끝나기 전에는 저장되지 않습니다.",
    no_snapshots:"아직 업로드된 스냅샷이 없습니다. 시작하려면 위에서 첫 번째 총독 파일을 업로드하세요.",
    footer_note:"모든 시간은 UTC 기준 · 자동 업데이트되며 새로고침이 필요 없습니다.", footer_built_by:"XTiT 제작",
    install_btn:"설치",
    owner_login_prompt:"업로드 도구의 잠금을 해제하려면 소유자 비밀번호를 입력하세요.", password_placeholder:"비밀번호 입력...",
    cancel_btn:"취소", login_btn:"로그인",
    confirm_action_title:"작업 확인", remove_btn:"삭제",
    month_1:"1월", month_2:"2월", month_3:"3월", month_4:"4월", month_5:"5월", month_6:"6월",
    month_7:"7월", month_8:"8월", month_9:"9월", month_10:"10월", month_11:"11월", month_12:"12월",
    dow_mon:"월", dow_tue:"화", dow_wed:"수", dow_thu:"목", dow_fri:"금", dow_sat:"토", dow_sun:"일",
    stage_upcoming:"예정", stage_live:"진행 중", stage_complete:"완료",
    stage_starts:"시작", stage_ends:"종료", stage_open_ended:"기한 없음",
    stage_until_starts:"시작까지", stage_left:"남음", stage_no_fixed_end:"진행 중 — 고정된 종료일 없음", stage_completed_prefix:"완료됨",
    label_opens:"시작", label_ends:"종료", bonus_opens_suffix:"오픈",
    ops_chapter:"챕터", ops_in_progress:"진행 중", ops_opened:"시작됨", ops_ends:"종료", ops_left:"남음",
    capture_is_open:"오픈됨", capture_go_capture:"지금 점령하세요", capture_opens:"오픈",
    ops_opens_next:"다음 시작", ops_until_opens:"시작까지",
    ops_season_complete:"시즌 종료", ops_all_concluded:"모든 챕터 종료됨", ops_last_ended:"마지막 챕터 종료:",
    skip_link:"현재 챕터로 건너뛰기",
    toast_season_complete:"시즌 종료", toast_all_concluded:"모든 챕터가 종료되었습니다.", toast_chapter_begun:"시작되었습니다",
    tag_new:"신규", tag_left:"이탈", governors_suffix:"명의 총독",
    msg_pick_date:"먼저 이 파일의 날짜를 선택하세요.", msg_could_not_read:"파일을 읽을 수 없습니다.",
    msg_save_failed:"로컬에는 로드되었지만 다른 방문자용으로 저장할 수 없습니다. 연결을 확인하고 다시 시도하세요.",
    confirm_remove_snapshot:"{date} 스냅샷을 삭제하시겠습니까? 되돌릴 수 없습니다.",
    install_title:"홈 화면에 추가", install_which_device:"어떤 기기를 사용하시나요?", install_pick_device:"정확한 단계를 보려면 기기를 선택하세요.",
    install_iphone_ipad:"iPhone / iPad", install_android:"Android", install_computer:"컴퓨터",
    install_which_browser:"어떤 브라우저인가요?", install_safari_or_chrome:"Safari인가요, Chrome인가요?", install_safari:"Safari", install_chrome:"Chrome",
    install_chrome_or_samsung:"Chrome인가요, Samsung Internet인가요?", install_samsung:"Samsung Internet",
    install_chrome_or_other:"Chrome인가요, 다른 브라우저인가요?", install_other_browser:"다른 브라우저", install_back:"뒤로",
    language_label:"언어",
    msg_loaded_governors:"{date}에 대해 {count}명의 총독을 불러왔습니다 — 이제 모두가 볼 수 있습니다.",
    msg_missing_optional:" ({cols} 열이 이 파일에 없습니다 — 해당 값은 0으로 표시됩니다.)",
    msg_missing_critical:" 경고: {cols}에 대한 열을 찾을 수 없습니다 — 모든 총독에 대해 해당 값은 0이 됩니다.",
    aria_prev_month:"이전 달", aria_next_month:"다음 달", aria_close:"닫기", aria_dismiss:"닫기",
    aria_sections:"섹션", title_remove:"{date} 삭제",
    aria_items_owned:"보유한 {amount} {unit} 항목 수",
    err_incorrect_password:"비밀번호가 틀렸습니다. 다시 시도하세요.",
    bonus_shrine:"성소",
    bonus_level_3_pass:"레벨 3 패스",
    bonus_lost_temple:"잃어버린 신전",
    kvk_stage_1_title:"1단계 — 잃어버린 비밀",
    kvk_stage_1_sub:"잃어버린 비밀을 밝히기 위해 약탈자들을 처치하세요 — 전투를 준비하세요",
    kvk_stage_2_title:"2단계 — 전투 준비",
    kvk_stage_2_sub:"군대를 훈련시키세요 — 다가올 전쟁에 대비하세요",
    kvk_stage_3_title:"3단계 — 문명의 충돌",
    kvk_stage_3_sub:"약탈자 야영지 / 약탈자 요새를 공격하세요 — 전투를 준비하세요",
    kvk_stage_4_title:"4단계 — 잃어버린 왕국 개방",
    kvk_stage_4_sub:"KVK 시작 — 잃어버린 왕국이 열렸습니다, 진입하여 싸우세요",
    g_tap_the:"다음을 탭하세요:",
    g_btn_share:"공유",
    g_icon_safari_bar:"Safari 바의 아이콘",
    g_scroll_tap:"아래로 스크롤하고 탭하세요:",
    g_btn_add_home:"홈 화면에 추가",
    g_tap:"탭:",
    g_btn_add:"추가",
    g_in_top_corner:"상단 모서리",
    g_icon_next_address:"주소 표시줄 옆의 아이콘",
    g_menu_top_right:"오른쪽 상단의 메뉴",
    g_confirm_tap:"확인하고 탭하세요:",
    g_btn_menu:"메뉴",
    g_icon_bottom_right:"오른쪽 하단의 아이콘",
    g_btn_add_page_to:"페이지 추가:",
    g_btn_home_screen:"홈 화면",
    g_then:"그런 다음",
    g_look_for:"다음을 찾으세요:",
    g_btn_install:"설치",
    g_icon_address_bar:"주소 표시줄의 아이콘",
    g_dont_see_open:"안 보이나요? 다음을 여세요:",
    g_menu_word:"메뉴",
    g_choose:"선택:",
    g_btn_install_muster:"XTiT 설치",
    g_look_install_icon:"브라우저 도구 모음에서 설치 아이콘을 찾으세요",
    g_or_check_menu:"또는 브라우저 메뉴에서 다음을 확인하세요:",
    save_btn:"저장",
    nav_chat:"글로벌 채팅",
    chat_title:"글로벌 채팅",
    chat_loading:"메시지 로딩 중…",
    chat_empty:"아직 메시지가 없습니다 — 첫 인사를 건네보세요!",
    chat_anonymous:"익명",
    chat_placeholder:"메시지를 입력하세요…",
    chat_send:"보내기",
    chat_name_title:"표시 이름 선택",
    chat_name_prompt:"다른 사령관들이 메시지 옆에서 보게 될 이름을 선택하세요.",
    chat_name_placeholder:"이름 입력...",
    chat_name_confirm:"채팅 시작",
    chat_notice:"모든 메시지는 매주 월요일 00:00 UTC에 자동 삭제됩니다.",
    chat_delete_msg_title:"메시지를 삭제할까요?",
    chat_delete_msg_body:"이 메시지를 삭제하시겠습니까?",
    chat_delete_yes:"예, 삭제",
    chat_delete_no:"아니요, 취소",
    chat_delete_all_btn:"내 모든 메시지 삭제",
    chat_delete_all_title:"모든 메시지를 삭제할까요?",
    chat_delete_all_body:"글로벌 채팅에서 모든 메시지를 삭제하시겠습니까?",
    chat_delete_all_yes:"예, 모두 삭제",
    chat_filtered_msg:"해당 메시지에 허용되지 않는 언어가 포함되어 있습니다. 다시 표현해 주세요.",
    chat_translate_lang_btn:"번역 언어",
    chat_select_translate_lang:"번역 언어 선택",
    chat_translate_lang_desc:"번역한 메시지가 이 언어로 표시됩니다. 언제든지 변경할 수 있습니다.",
    chat_translate_btn:"번역",
    chat_hide_translation_btn:"번역 숨기기",
    chat_translating:"번역 중…",
    chat_translate_error:"번역 실패. 다시 시도하세요.",
    chat_translated_label:"번역됨",
    owner_badge:"소유자",
    chat_owner_login_btn:"소유자 로그인",
    chat_owner_logout_btn:"로그아웃 (소유자)",
    chat_admin_panel_btn:"관리자 패널",
    chat_admin_panel_title:"글로벌 채팅 — 관리자 패널",
    chat_admin_intro:"글로벌 채팅 사용자와 메시지를 관리합니다. 이 컨트롤은 소유자만 볼 수 있습니다.",
    chat_admin_users_label:"활성 채팅 사용자",
    chat_admin_no_users:"아직 일반 사용자의 메시지가 없습니다.",
    chat_admin_messages_suffix:"메시지",
    chat_admin_ban_btn:"차단 및 메시지 삭제",
    chat_admin_unban_btn:"차단 해제",
    chat_admin_banned_label:"차단된 이름",
    chat_admin_no_banned:"현재 차단된 사람이 없습니다.",
    chat_admin_confirm_ban:"\"{name}\"을(를) 차단하고 모든 메시지를 삭제할까요? 차단 중에는 새 메시지를 보낼 수 없습니다.",
    chat_admin_confirm_unban:"\"{name}\"의 차단을 해제할까요? 다시 채팅할 수 있습니다.",
    chat_banned_error:"해당 이름은 소유자에 의해 글로벌 채팅에서 차단되었습니다.",
    chat_change_name_btn:"표시 이름 변경",
    chat_emoji_btn:"왕국 아이콘",
    chat_reply_btn:"답장",
    chat_replying_to:"답장 대상",
    chat_clear_reply_btn:"답장 취소",
    chat_jump_to_reply:"답장한 메시지로 이동",
    chat_view_replies:"이 메시지로 이동",
    chat_reply_singular:"답장",
    chat_replies_plural:"답장",
    chat_announce_make:"공지 만들기",
    chat_announce_on:"공지 모드 켜짐",
    chat_announce_placeholder:"모두에게 공지를 작성하세요…",
    chat_announce_send:"공지",
    chat_announcement_label:"공지",
    chat_announce_hint:"공지는 소유자만 게시할 수 있습니다.",
    chat_img_send_btn:"이미지 보내기",
    chat_img_guide_btn:"이미지 크기 가이드",
    chat_img_guide_title:"이미지 크기 가이드",
    chat_img_max:"최대 크기:",
    chat_img_max_val:"이미지당 5MB",
    chat_img_recommended:"권장:",
    chat_img_recommended_val:"3MB 이하",
    chat_img_formats:"형식:",
    chat_img_formats_val:"JPG, PNG, GIF, WebP",
    chat_img_tip_camera:"📷 휴대폰 사진도 잘 작동합니다",
    chat_img_tip_screenshot:"🖼️ 스크린샷은 언제나 괜찮습니다",
    chat_img_auto_shrink:"큰 이미지는 업로드 전에 자동으로 축소됩니다.",
    chat_img_too_large:"이미지가 너무 큽니다 — 최대 5MB. 더 작은 이미지를 선택하세요.",
    chat_img_failed:"업로드 실패. 다시 시도하세요.",
    chat_reply_image:"이미지",
    chat_cooldown_send:"다음 메시지",
    chat_cooldown_image:"이미지 쿨다운",
    chat_online_label:"온라인 사령관",
    chat_slow_mode_msg:"슬로우 모드 — {n}초 후 다시 시도하세요.",
    chat_slow_mode_img:"이미지 슬로우 모드 — {n}초 후 다시 시도하세요.",
    chat_typing_one:"입력 중…",
    chat_typing_and:"및",
    chat_typing_are:"입력 중…",
    chat_typing_others:"명이 입력 중…",
    fort_week_label:"주",
    fort_governor_label:"총독",
    fort_alliance_label:"동맹",
    fort_forts_label_short:"요새",
    fort_alliance_placeholder:"동맹 이름…",
    fort_all_alliances:"모든 동맹",
    fort_no_alliance:"동맹 없음",
    fort_search_player:"플레이어 검색…",
    fort_show_deleted:"삭제됨 표시",
    fort_hide_deleted:"삭제됨 숨기기",
    fort_deleted_tag:"삭제됨",
    fort_restore_title:"플레이어 복원",
    fort_alliances_label:"동맹",
    fort_players_label:"플레이어",
    fort_all_weeks_total:"모든 주",
    fort_upload_normal_opt:"일반 파일 — DKP에 포함되지 않음",
    fort_upload_kvk_opt:"KVK 통계 파일 — DKP에 포함됨",
    fort_badge_kvk:"KVK",
    fort_badge_normal:"일반",
    fort_image_unavailable:"이미지를 사용할 수 없음",
    chat_pick_reaction:"반응 선택",
    chat_scroll_latest:"최신 메시지로 스크롤",
    chat_send_failed:"전송 실패. 다시 시도하세요.",
    chat_loading_more:"로딩 중…",
    gov_owner_label:"소유자",
    dkp_earned_tip:"획득",
    dkp_required_tip:"필요",
    dkp_power_tip:"전투력",
    dkp_normal_tip:"일반 파일 — DKP 미포함",
    feedback_survey_title:"저희 웹사이트 경험은 어떠셨나요?",
    feedback_survey_sub:"귀하의 피드백은 개선에 도움이 됩니다 — 1초면 충분합니다.",
    feedback_good:"좋음",
    feedback_notbad:"괜찮음",
    feedback_bad:"나쁨",
    feedback_more_title:"감사합니다! 더 알려주시겠어요?",
    feedback_more_sub:"제안, 아이디어 또는 질문을 추가하거나 건너뛰세요.",
    feedback_text_placeholder:"선택 사항 — 생각, 아이디어 또는 질문을 공유하세요…",
    feedback_sending:"전송 중…",
    feedback_send:"보내기",
    feedback_no_thanks:"괜찮습니다",
    feedback_thanks_detailed:"자세한 피드백 감사합니다!",
    feedback_thanks_simple:"피드백 감사합니다!",
    feedback_recorded:"응답이 기록되었습니다.",
    feedback_skip:"지금 건너뛰기",
    feedback_loading:"피드백 로딩 중…",
    feedback_empty_title:"아직 피드백 없음",
    feedback_empty_text:"종료 설문조사의 방문자 평가는 사람들이 사이트를 평가하는 대로 여기에 표시됩니다.",
    feedback_total_ratings:"총 평가",
    feedback_satisfaction:"만족도 / 100",
    feedback_today:"오늘",
    feedback_last_7:"지난 7일",
    feedback_last_30:"지난 30일",
    feedback_recent:"최근 응답",
    feedback_with_message:"메시지 포함",
    admin_exit_survey:"종료 피드백 설문조사",
    admin_no_feedback:"아직 수집된 피드백이 없습니다.",
    admin_loading:"로딩 중…",
    admin_total:"총계",
    admin_last_7:"지난 7일 동안",
    admin_satisfaction:"만족도",
  },
  ja: {
nav_overview:"概要", nav_history:"履歴", nav_kvk:"KVK", nav_dkp:"DKP", nav_calendar:"カレンダー", nav_calculator:"計算機", nav_visitors:"訪問者",
    nav_activity:"アクティビティ",
    activity_title:"王国アクティビティ",
    activity_tab_farms:"農場＆同盟支援",
    activity_tab_fort:"蛮族の砦",
    activity_upload_desc:"農場＆同盟支援のリーダーボードを更新するには、総督の統計ファイルをアップロードしてください。",
    activity_upload_btn:"ファイルをアップロード",
    activity_uploading:"ファイルを読み込み中…",
    activity_owner_login:"オーナーログイン",
    activity_updated:"データ日付",
    activity_no_data:"まだファイルがアップロードされていません。",
    activity_no_results:"検索に一致するプレイヤーがいません。",
    activity_col_helps:"同盟支援",
    activity_col_resources:"採集した資源",
    activity_total_helps:"合計支援",
    activity_total_resources:"合計資源",
    activity_players:"プレイヤー",
    activity_whole_kingdom:"王国全体の合計",
    fort_download_btn:"ダウンロード",
    fort_download_excel:"Excel (.xlsx)",
    fort_download_csv:"CSV (.csv)",
    fort_copy_clipboard:"クリップボードにコピー",
    fort_share_btn:"共有…",
    fort_copied_msg:"クリップボードにコピーしました。",
    fort_copy_failed:"コピーできませんでした。もう一度お試しください。",
    activity_search:"プレイヤーを検索…",
    activity_loaded:"{date}の{count}人のプレイヤーを読み込みました — 誰でも見られるようになりました。",
    activity_missing_helps:"（同盟支援の列が見つかりません — 支援は0として表示されます。）",
    activity_missing_resources:"（採集した資源の列が見つかりません — 資源は0として表示されます。）",
    activity_save_failed:"ローカルには読み込まれましたが、他の訪問者向けに保存できませんでした。接続を確認して再試行してください。",
    activity_soon:"近日公開",
    activity_soon_note:"蛮族の砦の追跡機能を準備中です。",
    activity_col_helps_gained:"獲得した支援",
    activity_col_resources_gained:"獲得した資源",
    fort_no_data:"蛮族の砦データはまだありません。",
    fort_col_name:"名前",
    fort_col_forts:"破壊した砦",
    fort_edit_title:"プレイヤーを編集",
    fort_name_label:"プレイヤー名",
    fort_forts_label:"破壊した砦",
    fort_confirm_remove:"リーダーボードから「{name}」を削除しますか？",
    fort_clear_btn:"リーダーボードをクリア",
    fort_confirm_clear:"蛮族の砦のリーダーボード全体を削除しますか？元に戻せません。",
    fort_updated:"最終更新",
    fort_players:"人のプレイヤー",
    fort_save_failed:"保存できませんでした。接続を確認してもう一度お試しください。",
    fort_add_desc:"各総督を手動で追加します — 名前と破壊した蛮族の砦の数を入力してください。すでにボードにある総督の場合は、より高い砦数が保持されます。",
    fort_add_name_placeholder:"総督の名前…",
    fort_add_forts_placeholder:"破壊した砦",
    fort_add_btn:"プレイヤーを追加",
    fort_added_msg:"{name}を{forts}個の砦で追加しました。",
    fort_updated_msg:"{name}を更新 — より高い砦数を保持しました。",
    fort_add_invalid:"有効な総督名と0以上の砦数を入力してください。",
    fort_login_title:"蛮族の砦 — オーナーログイン",
    fort_login_prompt:"追加/編集ツールのロックを解除するには、蛮族の砦のパスワードを入力してください。",
    fort_no_data:"蛮族の砦データはまだありません。",
    fort_col_name:"名前",
    fort_col_forts:"破壊した砦",
    fort_edit_title:"プレイヤーを編集",
    fort_name_label:"プレイヤー名",
    fort_forts_label:"破壊した砦",
    fort_confirm_remove:"リーダーボードから「{name}」を削除しますか？",
    fort_clear_btn:"リーダーボードをクリア",
    fort_confirm_clear:"蛮族の砦のリーダーボード全体を削除しますか？元に戻せません。",
    fort_updated:"最終更新",
    fort_players:"人のプレイヤー",
    fort_save_failed:"スキャンしましたが、他の訪問者用に保存できませんでした。接続を確認してもう一度お試しください。",
    fort_add_desc:"各総督を手動で追加します — 名前と破壊した蛮族の砦の数を入力してください。すでにボードにある総督の場合は、より高い砦数が保持されます。",
    fort_add_name_placeholder:"総督の名前…",
    fort_add_forts_placeholder:"破壊した砦",
    fort_add_btn:"プレイヤーを追加",
    fort_added_msg:"{name}を{forts}個の砦で追加しました。",
    fort_updated_msg:"{name}を更新 — より高い砦数を保持しました。",
    fort_add_invalid:"有効な総督名と0以上の砦数を入力してください。",
    fort_login_title:"蛮族の砦 — オーナーログイン",
    fort_login_prompt:"追加/編集ツールのロックを解除するには、蛮族の砦のパスワードを入力してください。",
    about_toggle:"このページの使い方",
    about_intro:"XTiTは、イベント情報の更新と同盟の進捗管理ができるオールインワンの王国サポートツールです。",
    about_li_overview:"概要 — 現在のチャプターのリアルタイム追跡とカウントダウン。",
    about_li_history:"履歴 — 過去のチャプターと完了したイベント。",
    about_li_kvk:"KVK — 王国対王国の戦線スケジュール。",
    about_li_chat:"グローバルチャット — 王国の全同盟間のリアルタイムチャット、35以上の言語に翻訳対応。",
    about_li_dkp:"DKPトラッカー — 総督の統計をアップロードしてKvKの成果を追跡。",
    about_li_calendar:"カレンダー — 定期イベントのスケジュール。",
    about_li_calculator:"計算機 — AP、XP、宝石、VIPポイントのクイック計算。",
    about_li_visitors:"訪問者 — チェックインした司令官の数を確認。",
    about_footer:"すべての時間はUTC表示です。ページは自動的に更新されます。",
    gate_title:"王国イベントトラッカー", gate_desc:"生活をもっと楽にするたくさんの機能。",
    gate_btn:"押して入る", gate_checked_in:"人の司令官がチェックインしました", gate_connecting:"接続中...",
    banner_season_over:"すべてのチャプターが終了しました — シーズンは終わりました。",
    coming_up:"次の予定",
    history_title:"履歴", history_count_suffix:"チャプターがこれまでに完了",
    kvk_title:"戦線 — 王国対王国", kvk_estimated:"予測",
    kvk_note:"これらの日付は予測であり、公式日程が発表され次第自動的に更新されます。",
    calendar_title:"イベントカレンダー", jump_today:"今日にジャンプ", no_events_day:"この日に予定されているイベントはありません。",
    calculator_title:"ポイント計算機", calculator_note:"在庫数を入力して、合計AP、XP、宝石、VIPポイントを計算します。",
    ap_title:"行動力", xp_title:"経験値", gems_title:"宝石", vip_title:"VIPポイント",
    visitors_title:"訪問者", total_visitors:"総訪問者数", checked_in_note:"チェックインした司令官たち。", unavailable_now:"現在利用できません",
    contact_question:"質問、提案、またはバグを見つけましたか？", contact_title:"Discordでつながりましょう",
    discord_btn:"Discordでメッセージを送る", contact_note:"リクエスト、フィードバック、サイトの問題があればいつでもご連絡ください。",
    dkp_title:"DKPトラッカー", dkp_welcome:"DKPトラッカーへようこそ。",
    dkp_summary_title:"王国全体の合計",
    dkp_summary_note:"選択した2つのスナップショット間の全総督の合計統計。",
    dkp_desc1:"このセクションでは、2つの異なる時点のデータ（スナップショット）を比較して、王国4161のKvK成績を追跡します。",
    dkp_desc2:"スナップショットはKvK戦の前後に記録され、各総督の王国全体での進捗を測定します。",
    dkp_desc3:"以下から2つのスナップショットを選択して、各総督が戦力、キル数などでどれだけ成長したかを確認してください。",
    dkp_top_title:"トップパフォーマー",
    dkp_top_note:"選択した統計で最も高い総督。",
    dkp_gov_modal_title:"総督の詳細",
    dkp_gov_id:"ID",
    dkp_gov_change:"変化",
    owner_login:"オーナーログイン", owner_only:"オーナー専用", upload_desc:"特定の日付の新しい総督統計ファイルをアップロードします。",
    upload_btn:"総督ファイルをアップロード", uploading_btn:"ファイルを読み込み中…",
    snapshots_label:"スナップショット", total_suffix:"合計",
    from_label:"開始", to_label:"終了", sort_label:"並び替え", search_placeholder:"総督を検索…",
    sort_kp_gained:"獲得KP", sort_power_gained:"獲得戦力", sort_dead_gained:"獲得戦死者数",
    sort_total_kp:"合計KP", sort_total_power:"合計戦力", sort_total_dead:"合計戦死者数",
    slide_left:"← 左へスライド", slide_right:"右へスライド →", column_settings:"列設定",
    col_governor:"総督", col_power:"戦力", col_kp:"KP", col_dead:"戦死者",
    col_power_gained:"獲得戦力", col_kp_gained:"獲得KP", col_dead_gained:"獲得戦死者",
    load_more:"もっと読み込む", remaining_suffix:"残り",
    dkp_kvk_toggle_label:"KVK DKP 進行状況",
    dkp_kvk_active:"有効",
    dkp_kvk_inactive:"無効",
    dkp_kvk_toggle_help:"KVKが始まったらすぐにONにしてください — 2つのスナップショット間のすべてのキルとデスがDKPに加算されます。KVK終了時にOFFにしてください。",
    dkp_kvk_turn_on:"ONにする",
    dkp_kvk_turn_off:"OFFにする",
    dkp_kvk_saving:"保存中…",
    dkp_reset_title:"DKP進行状況をリセット",
    dkp_reset_help_active:"{date}からリセット済み。以前のスナップショットはすべて非表示です。",
    dkp_reset_help_inactive:"全員のDKPをリセットします。今日以降のスナップショットからカウントされます。",
    dkp_reset_btn:"進行状況をリセット",
    dkp_reset_btn_busy:"リセット中…",
    dkp_kvk_status_off:"⚠️ KVK DKP進行状況はオーナーによってOFFになっています。オーナーが有効にするまで進行率は0%と表示されます。",
    dkp_kvk_status_on:"✅ KVK DKP進行状況は有効です。選択したスナップショット間のすべてのキルとデスがDKPに加算されています。",
    dkp_reset_modal_title:"DKP進行状況をリセットしますか？",
    dkp_reset_modal_title_busy:"DKPをリセット中…",
    dkp_reset_modal_body:"全員のDKP進行状況がリセットされます。今日より前のすべてのスナップショットはFrom / Toドロップダウンから非表示になり、{date}以降の新しいスナップショットをアップロードするまでDKPは0%と表示されます。",
    dkp_reset_modal_warning:"これは元に戻せません。キャンセルするまで10秒あります。",
    dkp_reset_modal_confirm:"はい、全員をリセット",
    dkp_reset_modal_countdown:"全員のDKPを{n}後にリセットします…",
    dkp_reset_modal_countdown_help:"停止するにはキャンセルをクリック — カウントダウンが終わるまで何も保存されません。",
    no_snapshots:"まだスナップショットがアップロードされていません。上から最初の総督ファイルをアップロードして開始してください。",
    footer_note:"すべての時間はUTC · 自動更新、再読み込み不要。", footer_built_by:"XTiT制作",
    install_btn:"インストール",
    owner_login_prompt:"アップロードツールのロックを解除するにはオーナーパスワードを入力してください。", password_placeholder:"パスワードを入力...",
    cancel_btn:"キャンセル", login_btn:"ログイン",
    confirm_action_title:"操作の確認", remove_btn:"削除",
    month_1:"1月", month_2:"2月", month_3:"3月", month_4:"4月", month_5:"5月", month_6:"6月",
    month_7:"7月", month_8:"8月", month_9:"9月", month_10:"10月", month_11:"11月", month_12:"12月",
    dow_mon:"月", dow_tue:"火", dow_wed:"水", dow_thu:"木", dow_fri:"金", dow_sat:"土", dow_sun:"日",
    stage_upcoming:"予定", stage_live:"進行中", stage_complete:"完了",
    stage_starts:"開始", stage_ends:"終了", stage_open_ended:"未定",
    stage_until_starts:"開始まで", stage_left:"残り", stage_no_fixed_end:"進行中 — 終了日未定", stage_completed_prefix:"完了",
    label_opens:"開始", label_ends:"終了", bonus_opens_suffix:"開放",
    ops_chapter:"チャプター", ops_in_progress:"進行中", ops_opened:"開始済み", ops_ends:"終了", ops_left:"残り",
    capture_is_open:"開放中", capture_go_capture:"今すぐ占領しよう", capture_opens:"開放",
    ops_opens_next:"次に開始", ops_until_opens:"開始まで",
    ops_season_complete:"シーズン終了", ops_all_concluded:"すべてのチャプターが終了しました", ops_last_ended:"最後のチャプターは次の時刻に終了しました:",
    skip_link:"現在のチャプターへスキップ",
    toast_season_complete:"シーズン終了", toast_all_concluded:"すべてのチャプターが終了しました。", toast_chapter_begun:"が始まりました",
    tag_new:"新規", tag_left:"離脱", governors_suffix:"人の総督",
    msg_pick_date:"先にこのファイルの日付を選択してください。", msg_could_not_read:"このファイルを読み込めませんでした。",
    msg_save_failed:"ローカルには読み込まれましたが、他の訪問者向けに保存できませんでした。接続を確認して再試行してください。",
    confirm_remove_snapshot:"{date}のスナップショットを削除しますか？元に戻せません。",
    install_title:"ホーム画面に追加", install_which_device:"使用しているデバイスは？", install_pick_device:"正確な手順を見るためにデバイスを選択してください。",
    install_iphone_ipad:"iPhone / iPad", install_android:"Android", install_computer:"パソコン",
    install_which_browser:"どのブラウザ？", install_safari_or_chrome:"SafariかChromeか？", install_safari:"Safari", install_chrome:"Chrome",
    install_chrome_or_samsung:"ChromeかSamsung Internetか？", install_samsung:"Samsung Internet",
    install_chrome_or_other:"Chrome、それとも他のブラウザ？", install_other_browser:"他のブラウザ", install_back:"戻る",
    language_label:"言語",
    msg_loaded_governors:"{date}の{count}人の総督データを読み込みました — 全員が見られるようになりました。",
    msg_missing_optional:" （このファイルに{cols}列がありません — それらの値は0として表示されます。）",
    msg_missing_critical:" 警告：{cols}の列が見つかりませんでした — それらの値はすべての総督で0になります。",
    aria_prev_month:"前の月", aria_next_month:"次の月", aria_close:"閉じる", aria_dismiss:"閉じる",
    aria_sections:"セクション", title_remove:"{date}を削除",
    aria_items_owned:"所有している{amount} {unit}の数",
    err_incorrect_password:"パスワードが違います。もう一度お試しください。",
    bonus_shrine:"聖域",
    bonus_level_3_pass:"レベル3パス",
    bonus_lost_temple:"失われた神殿",
    kvk_stage_1_title:"ステージ1 — 失われた秘密",
    kvk_stage_1_sub:"失われた秘密を明らかにするために略奪者を倒せ — 戦いに備えよ",
    kvk_stage_2_title:"ステージ2 — 戦いの準備",
    kvk_stage_2_sub:"軍隊を訓練せよ — 来たる戦争に備えよ",
    kvk_stage_3_title:"ステージ3 — 文明の衝突",
    kvk_stage_3_sub:"略奪者の野営地 / 略奪者の砦を攻撃せよ — 戦いに備えよ",
    kvk_stage_4_title:"ステージ4 — 失われた王国の開放",
    kvk_stage_4_sub:"KVK開幕 — 失われた王国が開放された、参戦して戦え",
    g_tap_the:"次をタップ:",
    g_btn_share:"共有",
    g_icon_safari_bar:"Safariバーのアイコン",
    g_scroll_tap:"下にスクロールしてタップ:",
    g_btn_add_home:"ホーム画面に追加",
    g_tap:"タップ:",
    g_btn_add:"追加",
    g_in_top_corner:"上部の角に",
    g_icon_next_address:"アドレスバーの隣のアイコン",
    g_menu_top_right:"右上のメニュー",
    g_confirm_tap:"確認してタップ:",
    g_btn_menu:"メニュー",
    g_icon_bottom_right:"右下のアイコン",
    g_btn_add_page_to:"ページを追加:",
    g_btn_home_screen:"ホーム画面",
    g_then:"次に",
    g_look_for:"次を探してください:",
    g_btn_install:"インストール",
    g_icon_address_bar:"アドレスバーのアイコン",
    g_dont_see_open:"見つかりませんか？次を開いてください:",
    g_menu_word:"メニュー",
    g_choose:"選択:",
    g_btn_install_muster:"XTiTをインストール",
    g_look_install_icon:"ブラウザのツールバーでインストールアイコンを探してください",
    g_or_check_menu:"またはブラウザのメニューで次を確認してください:",
    save_btn:"保存",
    nav_chat:"グローバルチャット",
    chat_title:"グローバルチャット",
    chat_loading:"メッセージを読み込み中…",
    chat_empty:"まだメッセージがありません — 最初に挨拶しましょう！",
    chat_anonymous:"匿名",
    chat_placeholder:"メッセージを入力…",
    chat_send:"送信",
    chat_name_title:"表示名を選択",
    chat_name_prompt:"他の司令官がメッセージの横に表示する名前を選んでください。",
    chat_name_placeholder:"名前を入力...",
    chat_name_confirm:"チャットを開始",
    chat_notice:"すべてのメッセージは毎週月曜日00:00 UTCに自動削除されます。",
    chat_delete_msg_title:"メッセージを削除しますか？",
    chat_delete_msg_body:"このメッセージを削除してもよろしいですか？",
    chat_delete_yes:"はい、削除",
    chat_delete_no:"いいえ、キャンセル",
    chat_delete_all_btn:"自分のメッセージをすべて削除",
    chat_delete_all_title:"すべてのメッセージを削除しますか？",
    chat_delete_all_body:"グローバルチャットからすべてのメッセージを削除してもよろしいですか？",
    chat_delete_all_yes:"はい、すべて削除",
    chat_filtered_msg:"そのメッセージには許可されていない言葉が含まれています。言い換えてください。",
    chat_translate_lang_btn:"翻訳言語",
    chat_select_translate_lang:"翻訳言語を選択",
    chat_translate_lang_desc:"翻訳したメッセージはこの言語で表示されます。いつでも変更できます。",
    chat_translate_btn:"翻訳",
    chat_hide_translation_btn:"翻訳を隠す",
    chat_translating:"翻訳中…",
    chat_translate_error:"翻訳に失敗しました。もう一度お試しください。",
    chat_translated_label:"翻訳済み",
    owner_badge:"オーナー",
    chat_owner_login_btn:"オーナーログイン",
    chat_owner_logout_btn:"ログアウト（オーナー）",
    chat_admin_panel_btn:"管理パネル",
    chat_admin_panel_title:"グローバルチャット — 管理パネル",
    chat_admin_intro:"グローバルチャットのユーザーとメッセージを管理します。これらのコントロールはオーナーのみ表示されます。",
    chat_admin_users_label:"アクティブなチャットユーザー",
    chat_admin_no_users:"まだ一般ユーザーからのメッセージはありません。",
    chat_admin_messages_suffix:"メッセージ",
    chat_admin_ban_btn:"禁止してメッセージを削除",
    chat_admin_unban_btn:"禁止を解除",
    chat_admin_banned_label:"禁止された名前",
    chat_admin_no_banned:"現在禁止されている人はいません。",
    chat_admin_confirm_ban:"「{name}」を禁止してすべてのメッセージを削除しますか？禁止中は新しいメッセージを送信できません。",
    chat_admin_confirm_unban:"「{name}」の禁止を解除しますか？再びチャットできるようになります。",
    chat_banned_error:"その名前はオーナーによってグローバルチャットから禁止されました。",
    chat_change_name_btn:"表示名を変更",
    chat_emoji_btn:"王国アイコン",
    chat_reply_btn:"返信",
    chat_replying_to:"返信先",
    chat_clear_reply_btn:"返信をキャンセル",
    chat_jump_to_reply:"返信したメッセージに移動",
    chat_view_replies:"このメッセージに移動",
    chat_reply_singular:"返信",
    chat_replies_plural:"返信",
    chat_announce_make:"お知らせを作成",
    chat_announce_on:"お知らせモードON",
    chat_announce_placeholder:"みんなへのお知らせを書いてください…",
    chat_announce_send:"お知らせ",
    chat_announcement_label:"お知らせ",
    chat_announce_hint:"お知らせはオーナーのみ投稿できます。",
    chat_img_send_btn:"画像を送信",
    chat_img_guide_btn:"画像サイズガイド",
    chat_img_guide_title:"画像サイズガイド",
    chat_img_max:"最大サイズ:",
    chat_img_max_val:"画像あたり5MB",
    chat_img_recommended:"推奨:",
    chat_img_recommended_val:"3MB以下",
    chat_img_formats:"形式:",
    chat_img_formats_val:"JPG、PNG、GIF、WebP",
    chat_img_tip_camera:"📷 携帯の写真も問題ありません",
    chat_img_tip_screenshot:"🖼️ スクリーンショットはいつでもOK",
    chat_img_auto_shrink:"大きな画像はアップロード前に自動的に縮小されます。",
    chat_img_too_large:"画像が大きすぎます — 最大5MB。小さい画像を選んでください。",
    chat_img_failed:"アップロードに失敗しました。もう一度お試しください。",
    chat_reply_image:"画像",
    chat_cooldown_send:"次のメッセージ",
    chat_cooldown_image:"画像クールダウン",
    chat_online_label:"オンラインの司令官",
    chat_slow_mode_msg:"スローモード — {n}秒後にもう一度お試しください。",
    chat_slow_mode_img:"画像スローモード — {n}秒後にもう一度お試しください。",
    chat_typing_one:"入力中…",
    chat_typing_and:"と",
    chat_typing_are:"が入力中…",
    chat_typing_others:"人が入力中…",
    fort_week_label:"週",
    fort_governor_label:"総督",
    fort_alliance_label:"同盟",
    fort_forts_label_short:"砦",
    fort_alliance_placeholder:"同盟名…",
    fort_all_alliances:"すべての同盟",
    fort_no_alliance:"同盟なし",
    fort_search_player:"プレイヤーを検索…",
    fort_show_deleted:"削除済みを表示",
    fort_hide_deleted:"削除済みを非表示",
    fort_deleted_tag:"削除済み",
    fort_restore_title:"プレイヤーを復元",
    fort_alliances_label:"同盟",
    fort_players_label:"プレイヤー",
    fort_all_weeks_total:"すべての週",
    fort_upload_normal_opt:"通常ファイル — DKPに加算されません",
    fort_upload_kvk_opt:"KVK統計ファイル — DKPに加算されます",
    fort_badge_kvk:"KVK",
    fort_badge_normal:"通常",
    fort_image_unavailable:"画像を利用できません",
    chat_pick_reaction:"リアクションを選択",
    chat_scroll_latest:"最新のメッセージにスクロール",
    chat_send_failed:"送信できませんでした。もう一度お試しください。",
    chat_loading_more:"読み込み中…",
    gov_owner_label:"オーナー",
    dkp_earned_tip:"獲得",
    dkp_required_tip:"必要",
    dkp_power_tip:"戦力",
    dkp_normal_tip:"通常ファイル — DKP未加算",
    feedback_survey_title:"当サイトの体験はいかがでしたか？",
    feedback_survey_sub:"フィードバックは改善に役立ちます — ほんの一秒で完了します。",
    feedback_good:"良い",
    feedback_notbad:"普通",
    feedback_bad:"悪い",
    feedback_more_title:"ありがとうございます！さらに詳しく教えていただけますか？",
    feedback_more_sub:"提案、アイデア、質問を追加するか、スキップしてください。",
    feedback_text_placeholder:"任意 — ご意見、アイデア、質問を共有してください…",
    feedback_sending:"送信中…",
    feedback_send:"送信",
    feedback_no_thanks:"いいえ、結構です",
    feedback_thanks_detailed:"詳細なフィードバックをありがとうございます！",
    feedback_thanks_simple:"フィードバックをありがとうございます！",
    feedback_recorded:"回答が記録されました。",
    feedback_skip:"今はスキップ",
    feedback_loading:"フィードバックを読み込み中…",
    feedback_empty_title:"まだフィードバックはありません",
    feedback_empty_text:"離脱アンケートの訪問者評価は、サイトを評価した時点でここに表示されます。",
    feedback_total_ratings:"総評価数",
    feedback_satisfaction:"満足度 / 100",
    feedback_today:"今日",
    feedback_last_7:"過去7日間",
    feedback_last_30:"過去30日間",
    feedback_recent:"最近の回答",
    feedback_with_message:"メッセージ付き",
    admin_exit_survey:"離脱フィードバックアンケート",
    admin_no_feedback:"まだフィードバックが収集されていません。",
    admin_loading:"読み込み中…",
    admin_total:"合計",
    admin_last_7:"過去7日間で",
    admin_satisfaction:"満足度",
  },
  id: {
nav_overview:"Ikhtisar", nav_history:"Riwayat", nav_kvk:"KVK", nav_dkp:"DKP", nav_calendar:"Kalender", nav_calculator:"Kalkulator", nav_visitors:"Pengunjung",
    nav_activity:"Aktivitas",
    activity_title:"Aktivitas Kerajaan",
    activity_tab_farms:"Pertanian & Bantuan Aliansi",
    activity_tab_fort:"Benteng Barbar",
    activity_upload_desc:"Unggah file statistik gubernur untuk memperbarui papan peringkat Pertanian & Bantuan Aliansi.",
    activity_upload_btn:"Unggah file",
    activity_uploading:"Membaca file…",
    activity_owner_login:"Login Pemilik",
    activity_updated:"Data tanggal",
    activity_no_data:"Belum ada file yang diunggah.",
    activity_no_results:"Tidak ada pemain yang cocok dengan pencarian Anda.",
    activity_col_helps:"Bantuan Aliansi",
    activity_col_resources:"Sumber Daya Terkumpul",
    activity_total_helps:"Total Bantuan",
    activity_total_resources:"Total Sumber Daya",
    activity_players:"Pemain",
    activity_whole_kingdom:"Total Seluruh Kerajaan",
    fort_download_btn:"Unduh",
    fort_download_excel:"Excel (.xlsx)",
    fort_download_csv:"CSV (.csv)",
    fort_copy_clipboard:"Salin ke clipboard",
    fort_share_btn:"Bagikan…",
    fort_copied_msg:"Disalin ke clipboard.",
    fort_copy_failed:"Gagal menyalin. Coba lagi.",
    activity_search:"Cari pemain…",
    activity_loaded:"Memuat {count} pemain untuk {date} — semua orang sekarang bisa melihatnya.",
    activity_missing_helps:" (Kolom Bantuan Aliansi tidak ditemukan — bantuan akan ditampilkan sebagai 0.)",
    activity_missing_resources:" (Kolom Sumber Daya Terkumpul tidak ditemukan — sumber daya akan ditampilkan sebagai 0.)",
    activity_save_failed:"Dimuat secara lokal, tetapi tidak dapat disimpan untuk pengunjung lain. Periksa koneksi Anda dan coba lagi.",
    activity_soon:"Segera Hadir",
    activity_soon_note:"Pelacakan Benteng Barbar sedang dalam pengembangan.",
    activity_col_helps_gained:"Bantuan Diperoleh",
    activity_col_resources_gained:"Sumber Daya Diperoleh",
    fort_no_data:"Belum ada data Benteng Barbar.",
    fort_col_name:"Nama",
    fort_col_forts:"Benteng Dihancurkan",
    fort_edit_title:"Edit pemain",
    fort_name_label:"Nama pemain",
    fort_forts_label:"Benteng dihancurkan",
    fort_confirm_remove:"Hapus \"{name}\" dari papan peringkat?",
    fort_clear_btn:"Bersihkan papan peringkat",
    fort_confirm_clear:"Hapus seluruh papan peringkat Benteng Barbar? Tidak dapat dibatalkan.",
    fort_updated:"Terakhir diperbarui",
    fort_players:"pemain",
    fort_save_failed:"Gagal menyimpan. Periksa koneksi dan coba lagi.",
    fort_add_desc:"Tambahkan setiap gubernur secara manual — ketik nama dan berapa banyak Benteng Barbar yang mereka hancurkan. Jika gubernur yang sama sudah ada di papan, jumlah benteng yang lebih tinggi akan dipertahankan.",
    fort_add_name_placeholder:"Nama gubernur…",
    fort_add_forts_placeholder:"Benteng dihancurkan",
    fort_add_btn:"Tambah pemain",
    fort_added_msg:"Menambahkan {name} dengan {forts} benteng.",
    fort_updated_msg:"{name} diperbarui — jumlah benteng yang lebih tinggi dipertahankan.",
    fort_add_invalid:"Silakan masukkan nama gubernur yang valid dan jumlah benteng 0 atau lebih.",
    fort_login_title:"Benteng Barbar — Login Pemilik",
    fort_login_prompt:"Masukkan kata sandi Benteng Barbar untuk membuka kunci alat tambah/edit.",
    fort_no_data:"Belum ada data Benteng Barbar.",
    fort_col_name:"Nama",
    fort_col_forts:"Benteng Dihancurkan",
    fort_edit_title:"Edit pemain",
    fort_name_label:"Nama pemain",
    fort_forts_label:"Benteng dihancurkan",
    fort_confirm_remove:"Hapus \"{name}\" dari papan peringkat?",
    fort_clear_btn:"Bersihkan papan peringkat",
    fort_confirm_clear:"Hapus seluruh papan peringkat Benteng Barbar? Tidak dapat dibatalkan.",
    fort_updated:"Terakhir diperbarui",
    fort_players:"pemain",
    fort_save_failed:"Dipindai, tetapi tidak dapat disimpan untuk pengunjung lain. Periksa koneksi Anda dan coba lagi.",
    fort_add_desc:"Tambahkan setiap gubernur secara manual — ketik nama dan berapa banyak Benteng Barbar yang mereka hancurkan. Jika gubernur yang sama sudah ada di papan, jumlah benteng yang lebih tinggi akan dipertahankan.",
    fort_add_name_placeholder:"Nama gubernur…",
    fort_add_forts_placeholder:"Benteng dihancurkan",
    fort_add_btn:"Tambah pemain",
    fort_added_msg:"Menambahkan {name} dengan {forts} benteng.",
    fort_updated_msg:"{name} diperbarui — jumlah benteng yang lebih tinggi dipertahankan.",
    fort_add_invalid:"Silakan masukkan nama gubernur yang valid dan jumlah benteng 0 atau lebih.",
    fort_login_title:"Benteng Barbar — Login Pemilik",
    fort_login_prompt:"Masukkan kata sandi Benteng Barbar untuk membuka kunci alat tambah/edit.",
    about_toggle:"Cara kerja halaman ini",
    about_intro:"XTiT adalah pendamping kerajaan serba guna Anda — memberi info terkini tentang event dan melacak kemajuan aliansi Anda.",
    about_li_overview:"Ikhtisar — Pelacakan chapter langsung dan hitung mundur.",
    about_li_history:"Riwayat — Chapter sebelumnya dan event yang telah selesai.",
    about_li_kvk:"KVK — Jadwal garis depan Kingdom vs Kingdom.",
    about_li_chat:"Global Chat — Obrolan real-time antar semua aliansi di kerajaan, dengan terjemahan ke 35+ bahasa.",
    about_li_dkp:"Pelacak DKP — Unggah statistik gubernur dan lacak performa KvK.",
    about_li_calendar:"Kalender — Jadwal event berulang.",
    about_li_calculator:"Kalkulator — Perencana cepat poin AP, XP, Gem, dan VIP.",
    about_li_visitors:"Pengunjung — Lihat berapa banyak komandan yang telah check-in.",
    about_footer:"Semua waktu ditampilkan dalam UTC. Halaman ini menyegarkan secara otomatis.",
    gate_title:"Pelacak Event Kerajaan", gate_desc:"Terlalu banyak fitur untuk mempermudah hidup Anda.",
    gate_btn:"Tekan untuk masuk", gate_checked_in:"komandan telah check-in", gate_connecting:"Menghubungkan...",
    banner_season_over:"Semua chapter telah selesai — musim telah berakhir.",
    coming_up:"Akan datang",
    history_title:"Riwayat", history_count_suffix:"chapter telah selesai sejauh ini",
    kvk_title:"Garis Depan — Kingdom vs Kingdom", kvk_estimated:"Estimasi",
    kvk_note:"Tanggal ini adalah perkiraan dan akan diperbarui otomatis setelah tanggal resmi diumumkan.",
    calendar_title:"Kalender event", jump_today:"Lompat ke hari ini", no_events_day:"Tidak ada event terjadwal pada hari ini.",
    calculator_title:"Kalkulator poin", calculator_note:"Masukkan jumlah inventaris Anda untuk menghitung total poin AP, XP, Gem, dan VIP.",
    ap_title:"Poin aksi", xp_title:"Poin pengalaman", gems_title:"Gem", vip_title:"Poin VIP",
    visitors_title:"Pengunjung", total_visitors:"Total Pengunjung", checked_in_note:"Komandan yang telah check-in.", unavailable_now:"Tidak tersedia saat ini",
    contact_question:"Pertanyaan, saran, atau menemukan bug?", contact_title:"Hubungi saya di Discord",
    discord_btn:"Kirim pesan di Discord", contact_note:"Hubungi kapan saja untuk permintaan, masukan, atau masalah dengan situs ini.",
    dkp_title:"Pelacak DKP", dkp_welcome:"Selamat datang di Pelacak DKP.",
    dkp_summary_title:"Total seluruh kerajaan",
    dkp_summary_note:"Statistik gabungan untuk setiap gubernur antara dua snapshot yang dipilih.",
    dkp_desc1:"Bagian ini melacak performa KvK Kingdom 4161 dengan membandingkan data dari dua titik waktu berbeda (snapshot).",
    dkp_desc2:"Snapshot dicatat sebelum dan sesudah pertempuran KvK untuk mengukur kemajuan setiap gubernur di seluruh kerajaan.",
    dkp_desc3:"Pilih dua snapshot di bawah untuk melihat seberapa banyak kemajuan setiap gubernur dalam power, kill, dan lainnya.",
    dkp_top_title:"Performa Terbaik",
    dkp_top_note:"Gubernur dengan statistik terpilih tertinggi.",
    dkp_gov_modal_title:"Detail Gubernur",
    dkp_gov_id:"ID",
    dkp_gov_change:"Perubahan",
    owner_login:"Login Pemilik", owner_only:"Hanya pemilik", upload_desc:"Unggah file statistik gubernur baru untuk tanggal tertentu.",
    upload_btn:"Unggah file gubernur", uploading_btn:"Membaca file…",
    snapshots_label:"Snapshot", total_suffix:"total",
    from_label:"Dari", to_label:"Sampai", sort_label:"Urutkan berdasarkan", search_placeholder:"Cari gubernur…",
    sort_kp_gained:"KP Didapat", sort_power_gained:"Power Didapat", sort_dead_gained:"Kematian Didapat",
    sort_total_kp:"Total KP", sort_total_power:"Total Power", sort_total_dead:"Total Kematian",
    slide_left:"← Geser Kiri", slide_right:"Geser Kanan →", column_settings:"Pengaturan Kolom",
    col_governor:"Gubernur", col_power:"Power", col_kp:"KP", col_dead:"Kematian",
    col_power_gained:"Power Didapat", col_kp_gained:"KP Didapat", col_dead_gained:"Kematian Didapat",
    load_more:"Muat lebih banyak", remaining_suffix:"tersisa",
    dkp_kvk_toggle_label:"Progres DKP KVK",
    dkp_kvk_active:"AKTIF",
    dkp_kvk_inactive:"NONAKTIF",
    dkp_kvk_toggle_help:"NYALAKAN saat KVK dimulai — setiap kill dan setiap kematian antara dua snapshot akan dihitung ke DKP. MATIKAN saat KVK berakhir.",
    dkp_kvk_turn_on:"Nyalakan",
    dkp_kvk_turn_off:"Matikan",
    dkp_kvk_saving:"Menyimpan…",
    dkp_reset_title:"Reset Progres DKP",
    dkp_reset_help_active:"Saat ini direset dari {date}. Semua snapshot sebelumnya disembunyikan.",
    dkp_reset_help_inactive:"Reset DKP untuk semua orang. Snapshot dari hari ini dan seterusnya akan dihitung.",
    dkp_reset_btn:"Reset Progres",
    dkp_reset_btn_busy:"Mereset…",
    dkp_kvk_status_off:"⚠️ Progres DKP KVK dimatikan oleh pemilik. Progres akan menampilkan 0% hingga pemilik mengaktifkannya.",
    dkp_kvk_status_on:"✅ Progres DKP KVK AKTIF. Setiap kill dan kematian antara snapshot yang dipilih dihitung ke DKP.",
    dkp_reset_modal_title:"Reset Progres DKP?",
    dkp_reset_modal_title_busy:"Mereset DKP…",
    dkp_reset_modal_body:"Ini akan mereset progres DKP untuk semua orang. Semua snapshot sebelum hari ini akan disembunyikan dari dropdown Dari / Ke, dan DKP akan menampilkan 0% hingga Anda mengunggah snapshot baru pada {date} atau setelahnya.",
    dkp_reset_modal_warning:"Ini tidak dapat dibatalkan. Anda memiliki 10 detik untuk membatalkan.",
    dkp_reset_modal_confirm:"Ya, Reset Semua",
    dkp_reset_modal_countdown:"Mereset DKP untuk semua orang dalam {n}…",
    dkp_reset_modal_countdown_help:"Klik Batal untuk berhenti — tidak ada yang disimpan hingga hitungan selesai.",
    no_snapshots:"Belum ada snapshot yang diunggah. Unggah file gubernur pertama Anda di atas untuk memulai.",
    footer_note:"Semua waktu UTC · diperbarui otomatis, tidak perlu refresh.", footer_built_by:"Dibuat oleh XTiT",
    install_btn:"Instal",
    owner_login_prompt:"Masukkan kata sandi pemilik untuk membuka kunci alat unggah.", password_placeholder:"Masukkan kata sandi...",
    cancel_btn:"Batal", login_btn:"Masuk",
    confirm_action_title:"Konfirmasi Tindakan", remove_btn:"Hapus",
    month_1:"Januari", month_2:"Februari", month_3:"Maret", month_4:"April", month_5:"Mei", month_6:"Juni",
    month_7:"Juli", month_8:"Agustus", month_9:"September", month_10:"Oktober", month_11:"November", month_12:"Desember",
    dow_mon:"Sen", dow_tue:"Sel", dow_wed:"Rab", dow_thu:"Kam", dow_fri:"Jum", dow_sat:"Sab", dow_sun:"Min",
    stage_upcoming:"Akan datang", stage_live:"Berlangsung", stage_complete:"Selesai",
    stage_starts:"Mulai", stage_ends:"Berakhir", stage_open_ended:"Tanpa batas",
    stage_until_starts:"sampai dimulai", stage_left:"tersisa", stage_no_fixed_end:"Berlangsung — belum ada tanggal akhir pasti", stage_completed_prefix:"Selesai",
    label_opens:"Dibuka", label_ends:"Berakhir", bonus_opens_suffix:"dibuka",
    ops_chapter:"Chapter", ops_in_progress:"Berlangsung", ops_opened:"Dibuka", ops_ends:"Berakhir", ops_left:"tersisa",
    capture_is_open:"telah dibuka", capture_go_capture:"Segera rebut", capture_opens:"Dibuka",
    ops_opens_next:"Dibuka berikutnya", ops_until_opens:"sampai dibuka",
    ops_season_complete:"Musim selesai", ops_all_concluded:"Semua chapter telah selesai", ops_last_ended:"Chapter terakhir berakhir pada",
    skip_link:"Lompat ke chapter saat ini",
    toast_season_complete:"Musim selesai", toast_all_concluded:"Semua chapter telah selesai.", toast_chapter_begun:"telah dimulai",
    tag_new:"baru", tag_left:"keluar", governors_suffix:"gubernur",
    msg_pick_date:"Pilih tanggal untuk file ini terlebih dahulu.", msg_could_not_read:"Tidak dapat membaca file ini.",
    msg_save_failed:"Dimuat secara lokal, tetapi tidak dapat disimpan untuk pengunjung lain. Periksa koneksi Anda dan coba lagi.",
    confirm_remove_snapshot:"Hapus snapshot {date}? Tindakan ini tidak dapat dibatalkan.",
    install_title:"Tambahkan ke layar utama", install_which_device:"Perangkat apa yang Anda gunakan?", install_pick_device:"Pilih perangkat Anda untuk melihat langkah-langkah yang tepat.",
    install_iphone_ipad:"iPhone / iPad", install_android:"Android", install_computer:"Komputer",
    install_which_browser:"Browser apa?", install_safari_or_chrome:"Safari atau Chrome?", install_safari:"Safari", install_chrome:"Chrome",
    install_chrome_or_samsung:"Chrome atau Samsung Internet?", install_samsung:"Samsung Internet",
    install_chrome_or_other:"Chrome, atau browser lain?", install_other_browser:"Browser lain", install_back:"Kembali",
    language_label:"Bahasa",
    msg_loaded_governors:"Memuat {count} gubernur untuk {date} — sekarang semua orang bisa melihatnya.",
    msg_missing_optional:" (Tidak ada kolom {cols} di file ini — nilai tersebut akan ditampilkan sebagai 0.)",
    msg_missing_critical:" Peringatan: tidak dapat menemukan kolom untuk {cols} — nilai tersebut akan menjadi 0 untuk setiap gubernur.",
    aria_prev_month:"Bulan sebelumnya", aria_next_month:"Bulan berikutnya", aria_close:"Tutup", aria_dismiss:"Tutup",
    aria_sections:"Bagian", title_remove:"Hapus {date}",
    aria_items_owned:"Jumlah item {amount} {unit} yang dimiliki",
    err_incorrect_password:"Kata sandi salah. Coba lagi.",
    bonus_shrine:"Kuil",
    bonus_level_3_pass:"Pass Level 3",
    bonus_lost_temple:"Kuil yang Hilang",
    kvk_stage_1_title:"Tahap 1 — Rahasia yang Hilang",
    kvk_stage_1_sub:"Bunuh Perampok untuk mengungkap rahasia yang hilang — bersiaplah untuk bertempur",
    kvk_stage_2_title:"Tahap 2 — Persiapan Pertempuran",
    kvk_stage_2_sub:"Latih Pasukan — bersiaplah untuk perang yang akan datang",
    kvk_stage_3_title:"Tahap 3 — Benturan Peradaban",
    kvk_stage_3_sub:"Serang Perkemahan / Benteng Perampok — bersiaplah untuk bertempur",
    kvk_stage_4_title:"Tahap 4 — Kerajaan yang Hilang Terbuka",
    kvk_stage_4_sub:"KVK dimulai — Kerajaan yang Hilang terbuka, masuk dan bertempurlah",
    g_tap_the:"Ketuk",
    g_btn_share:"Bagikan",
    g_icon_safari_bar:"ikon di bilah Safari",
    g_scroll_tap:"Gulir ke bawah dan ketuk",
    g_btn_add_home:"Tambahkan ke Layar Utama",
    g_tap:"Ketuk",
    g_btn_add:"Tambah",
    g_in_top_corner:"di sudut atas",
    g_icon_next_address:"ikon di samping bilah alamat",
    g_menu_top_right:"menu di kanan atas",
    g_confirm_tap:"Konfirmasi dan ketuk",
    g_btn_menu:"Menu",
    g_icon_bottom_right:"ikon di kanan bawah",
    g_btn_add_page_to:"Tambahkan halaman ke",
    g_btn_home_screen:"Layar utama",
    g_then:"lalu",
    g_look_for:"Cari",
    g_btn_install:"Instal",
    g_icon_address_bar:"ikon di bilah alamat",
    g_dont_see_open:"Tidak melihatnya? Buka",
    g_menu_word:"menu",
    g_choose:"Pilih",
    g_btn_install_muster:"Instal XTiT",
    g_look_install_icon:"Cari ikon instal di bilah alat browser Anda",
    g_or_check_menu:"Atau periksa menu browser untuk",
    save_btn:"Simpan",
    nav_chat:"Obrolan Global",
    chat_title:"Obrolan Global",
    chat_loading:"Memuat pesan…",
    chat_empty:"Belum ada pesan — jadilah yang pertama menyapa!",
    chat_anonymous:"Anonim",
    chat_placeholder:"Ketik pesan…",
    chat_send:"Kirim",
    chat_name_title:"Pilih nama tampilan",
    chat_name_prompt:"Pilih nama yang akan dilihat komandan lain di samping pesan Anda.",
    chat_name_placeholder:"Masukkan nama Anda...",
    chat_name_confirm:"Mulai mengobrol",
    chat_notice:"Semua pesan otomatis dihapus setiap Senin pukul 00:00 UTC.",
    chat_delete_msg_title:"Hapus Pesan?",
    chat_delete_msg_body:"Apakah Anda yakin ingin menghapus pesan ini?",
    chat_delete_yes:"Ya, Hapus",
    chat_delete_no:"Tidak, Batal",
    chat_delete_all_btn:"Hapus Semua Pesan Saya",
    chat_delete_all_title:"Hapus Semua Pesan Anda?",
    chat_delete_all_body:"Apakah Anda yakin ingin menghapus semua pesan Anda dari Obrolan Global?",
    chat_delete_all_yes:"Ya, Hapus Semua",
    chat_filtered_msg:"Pesan itu mengandung bahasa yang tidak diizinkan di sini. Mohon diubah.",
    chat_translate_lang_btn:"Bahasa terjemahan",
    chat_select_translate_lang:"Pilih bahasa terjemahan Anda",
    chat_translate_lang_desc:"Pesan yang Anda terjemahkan akan ditampilkan dalam bahasa ini. Anda dapat mengubahnya kapan saja.",
    chat_translate_btn:"Terjemahkan",
    chat_hide_translation_btn:"Sembunyikan terjemahan",
    chat_translating:"Menerjemahkan…",
    chat_translate_error:"Terjemahan gagal. Coba lagi.",
    chat_translated_label:"Diterjemahkan",
    owner_badge:"Pemilik",
    chat_owner_login_btn:"Login Pemilik",
    chat_owner_logout_btn:"Keluar (Pemilik)",
    chat_admin_panel_btn:"Panel Admin",
    chat_admin_panel_title:"Obrolan Global — Panel Admin",
    chat_admin_intro:"Kelola pengguna dan pesan Obrolan Global. Kontrol ini hanya terlihat oleh pemilik.",
    chat_admin_users_label:"Pengguna obrolan aktif",
    chat_admin_no_users:"Belum ada pesan dari pengguna biasa.",
    chat_admin_messages_suffix:"pesan",
    chat_admin_ban_btn:"Ban & hapus pesan",
    chat_admin_unban_btn:"Buka ban",
    chat_admin_banned_label:"Nama yang dibanned",
    chat_admin_no_banned:"Tidak ada yang dibanned saat ini.",
    chat_admin_confirm_ban:"Ban \"{name}\" dan hapus semua pesannya? Mereka tidak akan bisa mengirim pesan baru selama dibanned.",
    chat_admin_confirm_unban:"Buka ban \"{name}\"? Mereka akan bisa mengobrol lagi.",
    chat_banned_error:"Nama itu telah dibanned dari Obrolan Global oleh pemilik.",
    chat_change_name_btn:"Ganti nama tampilan",
    chat_emoji_btn:"Ikon kerajaan",
    chat_reply_btn:"Balas",
    chat_replying_to:"Membalas",
    chat_clear_reply_btn:"Batal balas",
    chat_jump_to_reply:"Lompat ke pesan yang dibalas",
    chat_view_replies:"Lompat ke pesan ini",
    chat_reply_singular:"balasan",
    chat_replies_plural:"balasan",
    chat_announce_make:"Buat pengumuman",
    chat_announce_on:"Mode pengumuman AKTIF",
    chat_announce_placeholder:"Tulis pengumuman untuk semua orang…",
    chat_announce_send:"Umumkan",
    chat_announcement_label:"Pengumuman",
    chat_announce_hint:"Hanya Anda (pemilik) yang bisa memposting pengumuman.",
    chat_img_send_btn:"Kirim gambar",
    chat_img_guide_btn:"Panduan ukuran gambar",
    chat_img_guide_title:"Panduan ukuran gambar",
    chat_img_max:"Ukuran maks:",
    chat_img_max_val:"5 MB per gambar",
    chat_img_recommended:"Direkomendasikan:",
    chat_img_recommended_val:"di bawah 3 MB",
    chat_img_formats:"Format:",
    chat_img_formats_val:"JPG, PNG, GIF, WebP",
    chat_img_tip_camera:"📷 Foto dari ponsel Anda bekerja dengan baik",
    chat_img_tip_screenshot:"🖼️ Tangkapan layar selalu aman",
    chat_img_auto_shrink:"Gambar yang lebih besar otomatis diperkecil sebelum diunggah.",
    chat_img_too_large:"Gambar terlalu besar — maks 5 MB. Pilih gambar yang lebih kecil.",
    chat_img_failed:"Unggah gagal. Coba lagi.",
    chat_reply_image:"gambar",
    chat_cooldown_send:"Pesan berikutnya",
    chat_cooldown_image:"Cooldown gambar",
    chat_online_label:"Komandan online",
    chat_slow_mode_msg:"Mode lambat — coba lagi dalam {n}d.",
    chat_slow_mode_img:"Mode lambat gambar — coba lagi dalam {n}d.",
    chat_typing_one:"sedang mengetik…",
    chat_typing_and:"dan",
    chat_typing_are:"sedang mengetik…",
    chat_typing_others:"orang lain sedang mengetik…",
    fort_week_label:"Minggu",
    fort_governor_label:"Gubernur",
    fort_alliance_label:"Aliansi",
    fort_forts_label_short:"Benteng",
    fort_alliance_placeholder:"Nama aliansi…",
    fort_all_alliances:"Semua Aliansi",
    fort_no_alliance:"Tanpa Aliansi",
    fort_search_player:"Cari pemain…",
    fort_show_deleted:"Tampilkan Dihapus",
    fort_hide_deleted:"Sembunyikan Dihapus",
    fort_deleted_tag:"Dihapus",
    fort_restore_title:"Pulihkan pemain",
    fort_alliances_label:"Aliansi",
    fort_players_label:"Pemain",
    fort_all_weeks_total:"Semua Minggu",
    fort_upload_normal_opt:"File normal — TIDAK dihitung untuk DKP",
    fort_upload_kvk_opt:"File statistik KVK — DIHITUNG untuk DKP",
    fort_badge_kvk:"KVK",
    fort_badge_normal:"NORMAL",
    fort_image_unavailable:"Gambar tidak tersedia",
    chat_pick_reaction:"Pilih reaksi",
    chat_scroll_latest:"Gulir ke pesan terbaru",
    chat_send_failed:"Gagal mengirim. Coba lagi.",
    chat_loading_more:"Memuat…",
    gov_owner_label:"Pemilik",
    dkp_earned_tip:"Diperoleh",
    dkp_required_tip:"Diperlukan",
    dkp_power_tip:"kekuatan",
    dkp_normal_tip:"File normal — DKP tidak dihitung",
    feedback_survey_title:"Bagaimana pengalaman Anda dengan situs web kami?",
    feedback_survey_sub:"Masukan Anda membantu kami meningkat — hanya butuh satu detik.",
    feedback_good:"Bagus",
    feedback_notbad:"Lumayan",
    feedback_bad:"Buruk",
    feedback_more_title:"Terima kasih! Ingin memberi tahu lebih banyak?",
    feedback_more_sub:"Tambahkan saran, ide, atau pertanyaan — atau lewati saja.",
    feedback_text_placeholder:"Opsional — bagikan pemikiran, ide, atau pertanyaan Anda…",
    feedback_sending:"Mengirim…",
    feedback_send:"Kirim",
    feedback_no_thanks:"Tidak, terima kasih",
    feedback_thanks_detailed:"Terima kasih atas masukan mendetail Anda!",
    feedback_thanks_simple:"Terima kasih atas masukan Anda!",
    feedback_recorded:"Respons Anda telah dicatat.",
    feedback_skip:"Lewati untuk sekarang",
    feedback_loading:"Memuat masukan…",
    feedback_empty_title:"Belum ada masukan",
    feedback_empty_text:"Penilaian pengunjung dari survei keluar akan muncul di sini segera setelah orang menilai situs.",
    feedback_total_ratings:"Total Penilaian",
    feedback_satisfaction:"Kepuasan / 100",
    feedback_today:"Hari ini",
    feedback_last_7:"7 hari terakhir",
    feedback_last_30:"30 hari terakhir",
    feedback_recent:"Respons Terbaru",
    feedback_with_message:"dengan pesan",
    admin_exit_survey:"Survei Masukan Keluar",
    admin_no_feedback:"Belum ada masukan yang dikumpulkan.",
    admin_loading:"Memuat…",
    admin_total:"total",
    admin_last_7:"dalam 7 hari terakhir",
    admin_satisfaction:"Kepuasan",
  },
  ar: {
nav_overview:"نظرة عامة", nav_history:"السجل", nav_kvk:"KVK", nav_dkp:"DKP", nav_calendar:"التقويم", nav_calculator:"الحاسبة", nav_visitors:"الزوار",
    nav_activity:"النشاط",
    activity_title:"نشاط المملكة",
    activity_tab_farms:"المزارع ومساعدة التحالف",
    activity_tab_fort:"حصن البرابرة",
    activity_upload_desc:"ارفع ملف إحصائيات الحاكم لتحديث لوحة متصدري المزارع ومساعدة التحالف.",
    activity_upload_btn:"رفع الملف",
    activity_uploading:"جارٍ قراءة الملف…",
    activity_owner_login:"تسجيل دخول المالك",
    activity_updated:"بيانات تاريخ",
    activity_no_data:"لم يتم رفع أي ملف بعد.",
    activity_no_results:"لا يوجد لاعبون يطابقون بحثك.",
    activity_col_helps:"مساعدة التحالف",
    activity_col_resources:"الموارد المجمّعة",
    activity_total_helps:"إجمالي المساعدات",
    activity_total_resources:"إجمالي الموارد",
    activity_players:"اللاعبون",
    activity_whole_kingdom:"إجماليات المملكة بأكملها",
    fort_download_btn:"تنزيل",
    fort_download_excel:"Excel (.xlsx)",
    fort_download_csv:"CSV (.csv)",
    fort_copy_clipboard:"نسخ إلى الحافظة",
    fort_share_btn:"مشاركة…",
    fort_copied_msg:"تم النسخ إلى الحافظة.",
    fort_copy_failed:"تعذر النسخ. حاول مرة أخرى.",
    activity_search:"ابحث عن لاعب…",
    activity_loaded:"تم تحميل {count} لاعبًا بتاريخ {date} — يمكن للجميع رؤيته الآن.",
    activity_missing_helps:" (لم يتم العثور على عمود مساعدة التحالف — سيتم عرض المساعدات كـ 0.)",
    activity_missing_resources:" (لم يتم العثور على عمود الموارد المجمّعة — سيتم عرض الموارد كـ 0.)",
    activity_save_failed:"تم التحميل محليًا، ولكن تعذر حفظه للزوار الآخرين. تحقق من اتصالك وحاول مرة أخرى.",
    activity_soon:"قريبًا",
    activity_soon_note:"ميزة تتبع حصن البرابرة قيد التطوير.",
    activity_col_helps_gained:"المساعدات المكتسبة",
    activity_col_resources_gained:"الموارد المكتسبة",
    fort_no_data:"لا توجد بيانات حصن البرابرة بعد.",
    fort_col_name:"الاسم",
    fort_col_forts:"الحصون المدمّرة",
    fort_edit_title:"تعديل اللاعب",
    fort_name_label:"اسم اللاعب",
    fort_forts_label:"الحصون المدمّرة",
    fort_confirm_remove:"إزالة \"{name}\" من لوحة المتصدرين؟",
    fort_clear_btn:"مسح لوحة المتصدرين",
    fort_confirm_clear:"حذف لوحة متصدري حصن البرابرة بالكامل؟ لا يمكن التراجع.",
    fort_updated:"آخر تحديث",
    fort_players:"لاعبًا",
    fort_save_failed:"تعذر الحفظ. تحقق من اتصالك وحاول مرة أخرى.",
    fort_add_desc:"أضف كل حاكم يدويًا — اكتب اسمه وعدد حصون البرابرة التي دمّرها. إذا كان الحاكم موجودًا بالفعل، فسيتم الاحتفاظ بالعدد الأعلى.",
    fort_add_name_placeholder:"اسم الحاكم…",
    fort_add_forts_placeholder:"الحصون المدمّرة",
    fort_add_btn:"إضافة لاعب",
    fort_added_msg:"تمت إضافة {name} مع {forts} حصن.",
    fort_updated_msg:"تم تحديث {name} — تم الاحتفاظ بالعدد الأعلى.",
    fort_add_invalid:"الرجاء إدخال اسم حاكم صالح وعدد حصون 0 أو أكثر.",
    fort_login_title:"حصن البرابرة — تسجيل دخول المالك",
    fort_login_prompt:"أدخل كلمة مرور حصن البرابرة لفتح أدوات الإضافة/التعديل.",
    fort_no_data:"لا توجد بيانات حصن البرابرة بعد.",
    fort_col_name:"الاسم",
    fort_col_forts:"الحصون المدمّرة",
    fort_edit_title:"تعديل اللاعب",
    fort_name_label:"اسم اللاعب",
    fort_forts_label:"الحصون المدمّرة",
    fort_confirm_remove:"إزالة \"{name}\" من لوحة المتصدرين؟",
    fort_clear_btn:"مسح لوحة المتصدرين",
    fort_confirm_clear:"حذف لوحة متصدري حصن البرابرة بالكامل؟ لا يمكن التراجع.",
    fort_updated:"آخر تحديث",
    fort_players:"لاعبًا",
    fort_save_failed:"تم الفحص، لكن تعذر الحفظ للزوار الآخرين. تحقق من اتصالك وحاول مرة أخرى.",
    fort_add_desc:"أضف كل حاكم يدويًا — اكتب اسمه وعدد حصون البرابرة التي دمّرها. إذا كان الحاكم موجودًا بالفعل، فسيتم الاحتفاظ بالعدد الأعلى.",
    fort_add_name_placeholder:"اسم الحاكم…",
    fort_add_forts_placeholder:"الحصون المدمّرة",
    fort_add_btn:"إضافة لاعب",
    fort_added_msg:"تمت إضافة {name} مع {forts} حصن.",
    fort_updated_msg:"تم تحديث {name} — تم الاحتفاظ بالعدد الأعلى.",
    fort_add_invalid:"الرجاء إدخال اسم حاكم صالح وعدد حصون 0 أو أكثر.",
    fort_login_title:"حصن البرابرة — تسجيل دخول المالك",
    fort_login_prompt:"أدخل كلمة مرور حصن البرابرة لفتح أدوات الإضافة/التعديل.",
    about_toggle:"كيف تعمل هذه الصفحة",
    about_intro:"XTiT هو رفيقك الشامل للمملكة — يبقيك على اطلاع بالأحداث ويتتبع تقدم تحالفك.",
    about_li_overview:"نظرة عامة — تتبع مباشر للفصل الحالي والعد التنازلي.",
    about_li_history:"السجل — الفصول السابقة والأحداث المكتملة.",
    about_li_kvk:"KVK — جدول جبهة المملكة ضد المملكة.",
    about_li_chat:"الدردشة العامة — دردشة مباشرة بين جميع التحالفات في المملكة، مع ترجمة إلى أكثر من 35 لغة.",
    about_li_dkp:"متتبع DKP — قم برفع إحصائيات الحكام وتتبع أداء KvK.",
    about_li_calendar:"التقويم — جدول الأحداث المتكررة.",
    about_li_calculator:"الحاسبة — مخطط سريع لنقاط AP وXP والجواهر ونقاط VIP.",
    about_li_visitors:"الزوار — شاهد عدد القادة الذين سجلوا الدخول.",
    about_footer:"جميع الأوقات معروضة بتوقيت UTC. يتم تحديث الصفحة تلقائيًا.",
    gate_title:"متتبع أحداث المملكة", gate_desc:"الكثير من الميزات لتسهيل حياتك.",
    gate_btn:"اضغط للدخول", gate_checked_in:"قائد سجل الدخول", gate_connecting:"جارٍ الاتصال...",
    banner_season_over:"انتهت جميع الفصول — انتهى الموسم.",
    coming_up:"قادم",
    history_title:"السجل", history_count_suffix:"فصل اكتمل حتى الآن",
    kvk_title:"الجبهة — حرب المملكة ضد المملكة", kvk_estimated:"تقديري",
    kvk_note:"هذه التواريخ تقديرية وسيتم تحديثها تلقائيًا بمجرد الإعلان عن التواريخ الرسمية.",
    calendar_title:"تقويم الأحداث", jump_today:"الانتقال لليوم", no_events_day:"لا توجد أحداث مجدولة في هذا اليوم.",
    calculator_title:"حاسبة النقاط", calculator_note:"أدخل كميات مخزونك لحساب إجمالي نقاط AP وXP والجواهر ونقاط VIP.",
    ap_title:"نقاط الحركة", xp_title:"نقاط الخبرة", gems_title:"الجواهر", vip_title:"نقاط VIP",
    visitors_title:"الزوار", total_visitors:"إجمالي الزوار", checked_in_note:"القادة الذين سجلوا الدخول.", unavailable_now:"غير متاح حاليًا",
    contact_question:"أسئلة أو اقتراحات أو وجدت خطأ؟", contact_title:"تواصل معي على Discord",
    discord_btn:"راسلني على Discord", contact_note:"تواصل في أي وقت للطلبات أو الملاحظات أو مشاكل الموقع.",
    dkp_title:"متتبع DKP", dkp_welcome:"مرحبًا بك في متتبع DKP.",
    dkp_summary_title:"الإجماليات على مستوى المملكة",
    dkp_summary_note:"إحصائيات مجمعة لكل حاكم بين اللقطتين المحددتين.",
    dkp_desc1:"يتتبع هذا القسم أداء KvK للمملكة 4161 من خلال مقارنة البيانات من نقطتين زمنيتين مختلفتين (لقطات).",
    dkp_desc2:"يتم تسجيل اللقطات قبل وبعد معارك KvK لقياس تقدم كل حاكم عبر المملكة.",
    dkp_desc3:"اختر لقطتين أدناه لمعرفة مقدار تقدم كل حاكم في القوة والقتلى والمزيد.",
    dkp_top_title:"الأفضل أداءً",
    dkp_top_note:"الحاكم صاحب أعلى إحصائية محددة.",
    dkp_gov_modal_title:"تفاصيل الحاكم",
    dkp_gov_id:"المعرف",
    dkp_gov_change:"التغيير",
    owner_login:"تسجيل دخول المالك", owner_only:"للمالك فقط", upload_desc:"قم برفع ملف إحصائيات حاكم جديد لتاريخ محدد.",
    upload_btn:"رفع ملف الحاكم", uploading_btn:"جارٍ قراءة الملف…",
    snapshots_label:"اللقطات", total_suffix:"الإجمالي",
    from_label:"من", to_label:"إلى", sort_label:"الترتيب حسب", search_placeholder:"ابحث عن حاكم…",
    sort_kp_gained:"KP المكتسبة", sort_power_gained:"القوة المكتسبة", sort_dead_gained:"الوفيات المكتسبة",
    sort_total_kp:"إجمالي KP", sort_total_power:"إجمالي القوة", sort_total_dead:"إجمالي الوفيات",
    slide_left:"← تمرير لليسار", slide_right:"تمرير لليمين →", column_settings:"إعدادات الأعمدة",
    col_governor:"الحاكم", col_power:"القوة", col_kp:"KP", col_dead:"الوفيات",
    col_power_gained:"القوة المكتسبة", col_kp_gained:"KP المكتسبة", col_dead_gained:"الوفيات المكتسبة",
    load_more:"تحميل المزيد", remaining_suffix:"متبقي",
    dkp_kvk_toggle_label:"تقدم DKP لـ KVK",
    dkp_kvk_active:"نشط",
    dkp_kvk_inactive:"غير نشط",
    dkp_kvk_toggle_help:"شغّله فور بدء KVK — كل قتل وكل وفاة بين اللقطتين سيُحسبان في DKP. أطفئه عند انتهاء KVK.",
    dkp_kvk_turn_on:"تشغيل",
    dkp_kvk_turn_off:"إيقاف",
    dkp_kvk_saving:"جارٍ الحفظ…",
    dkp_reset_title:"إعادة تعيين تقدم DKP",
    dkp_reset_help_active:"تمت إعادة التعيين من {date}. جميع اللقطات السابقة مخفية.",
    dkp_reset_help_inactive:"إعادة تعيين DKP للجميع. سيتم احتساب اللقطات من اليوم فصاعدًا.",
    dkp_reset_btn:"إعادة تعيين التقدم",
    dkp_reset_btn_busy:"جارٍ إعادة التعيين…",
    dkp_kvk_status_off:"⚠️ تم إيقاف تقدم DKP لـ KVK من قِبل المالك. سيعرض التقدم 0% حتى يقوم المالك بتفعيله.",
    dkp_kvk_status_on:"✅ تقدم DKP لـ KVK نشط. كل قتل ووفاة بين اللقطات المحددة يُحسبان في DKP.",
    dkp_reset_modal_title:"إعادة تعيين تقدم DKP؟",
    dkp_reset_modal_title_busy:"جارٍ إعادة تعيين DKP…",
    dkp_reset_modal_body:"سيؤدي هذا إلى إعادة تعيين تقدم DKP للجميع. سيتم إخفاء جميع اللقطات قبل اليوم من قوائم من / إلى، وسيعرض DKP 0% حتى ترفع لقطة جديدة بتاريخ {date} أو لاحقًا.",
    dkp_reset_modal_warning:"لا يمكن التراجع عن هذا. لديك 10 ثوانٍ للإلغاء.",
    dkp_reset_modal_confirm:"نعم، إعادة تعيين الجميع",
    dkp_reset_modal_countdown:"إعادة تعيين DKP للجميع خلال {n}…",
    dkp_reset_modal_countdown_help:"اضغط إلغاء للإيقاف — لن يتم حفظ أي شيء حتى انتهاء العد التنازلي.",
    no_snapshots:"لم يتم رفع أي لقطات بعد. قم برفع أول ملف حاكم أعلاه للبدء.",
    footer_note:"جميع الأوقات بتوقيت UTC · تحديث تلقائي، لا حاجة للتحديث اليدوي.", footer_built_by:"بُني بواسطة XTiT",
    install_btn:"تثبيت",
    owner_login_prompt:"أدخل كلمة مرور المالك لفتح أدوات الرفع.", password_placeholder:"أدخل كلمة المرور...",
    cancel_btn:"إلغاء", login_btn:"تسجيل الدخول",
    confirm_action_title:"تأكيد الإجراء", remove_btn:"إزالة",
    month_1:"يناير", month_2:"فبراير", month_3:"مارس", month_4:"أبريل", month_5:"مايو", month_6:"يونيو",
    month_7:"يوليو", month_8:"أغسطس", month_9:"سبتمبر", month_10:"أكتوبر", month_11:"نوفمبر", month_12:"ديسمبر",
    dow_mon:"ن", dow_tue:"ث", dow_wed:"ر", dow_thu:"خ", dow_fri:"ج", dow_sat:"س", dow_sun:"ح",
    stage_upcoming:"قادم", stage_live:"قيد التقدم", stage_complete:"مكتمل",
    stage_starts:"يبدأ", stage_ends:"ينتهي", stage_open_ended:"غير محدد",
    stage_until_starts:"حتى البدء", stage_left:"متبقٍ", stage_no_fixed_end:"قيد التقدم — لا يوجد تاريخ انتهاء محدد", stage_completed_prefix:"اكتمل",
    label_opens:"يفتح", label_ends:"ينتهي", bonus_opens_suffix:"يفتح",
    ops_chapter:"الفصل", ops_in_progress:"قيد التقدم", ops_opened:"بدأ", ops_ends:"ينتهي", ops_left:"متبقٍ",
    capture_is_open:"مفتوح", capture_go_capture:"اذهب للاستيلاء عليه", capture_opens:"يفتح",
    ops_opens_next:"يفتح لاحقًا", ops_until_opens:"حتى الفتح",
    ops_season_complete:"انتهى الموسم", ops_all_concluded:"انتهت جميع الفصول", ops_last_ended:"انتهى الفصل الأخير في",
    skip_link:"الانتقال إلى الفصل الحالي",
    toast_season_complete:"انتهى الموسم", toast_all_concluded:"انتهت جميع الفصول.", toast_chapter_begun:"قد بدأ",
    tag_new:"جديد", tag_left:"غادر", governors_suffix:"حاكمًا",
    msg_pick_date:"اختر تاريخًا لهذا الملف أولاً.", msg_could_not_read:"تعذرت قراءة هذا الملف.",
    msg_save_failed:"تم التحميل محليًا، ولكن تعذر حفظه ليراه الزوار الآخرون. تحقق من اتصالك وحاول مرة أخرى.",
    confirm_remove_snapshot:"إزالة لقطة {date}؟ لا يمكن التراجع عن هذا.",
    install_title:"إضافة إلى الشاشة الرئيسية", install_which_device:"ما الجهاز الذي تستخدمه؟", install_pick_device:"اختر جهازك لرؤية الخطوات الدقيقة.",
    install_iphone_ipad:"iPhone / iPad", install_android:"Android", install_computer:"كمبيوتر",
    install_which_browser:"ما المتصفح؟", install_safari_or_chrome:"Safari أم Chrome؟", install_safari:"Safari", install_chrome:"Chrome",
    install_chrome_or_samsung:"Chrome أم Samsung Internet؟", install_samsung:"Samsung Internet",
    install_chrome_or_other:"Chrome، أم متصفح آخر؟", install_other_browser:"متصفح آخر", install_back:"رجوع",
    language_label:"اللغة",
    msg_loaded_governors:"تم تحميل {count} حاكمًا لتاريخ {date} — يمكن للجميع رؤيته الآن.",
    msg_missing_optional:" (لا يوجد عمود {cols} في هذا الملف — ستظهر هذه القيم كـ 0.)",
    msg_missing_critical:" تحذير: تعذر العثور على عمود لـ {cols} — ستكون هذه القيم 0 لكل حاكم.",
    aria_prev_month:"الشهر السابق", aria_next_month:"الشهر التالي", aria_close:"إغلاق", aria_dismiss:"إغلاق",
    aria_sections:"الأقسام", title_remove:"إزالة {date}",
    aria_items_owned:"عدد عناصر {amount} {unit} المملوكة",
    err_incorrect_password:"كلمة مرور غير صحيحة. حاول مرة أخرى.",
    bonus_shrine:"الضريح",
    bonus_level_3_pass:"ممر المستوى 3",
    bonus_lost_temple:"المعبد المفقود",
    kvk_stage_1_title:"المرحلة 1 — السر المفقود",
    kvk_stage_1_sub:"اقتل السُّلاب للكشف عن الأسرار المفقودة — كن مستعدًا للقتال",
    kvk_stage_2_title:"المرحلة 2 — الاستعداد للمعركة",
    kvk_stage_2_sub:"درّب القوات — كن مستعدًا للحرب القادمة",
    kvk_stage_3_title:"المرحلة 3 — صدام الحضارات",
    kvk_stage_3_sub:"اهجم على مخيمات / حصون السُّلاب — كن مستعدًا للمعركة",
    kvk_stage_4_title:"المرحلة 4 — افتتاح المملكة المفقودة",
    kvk_stage_4_sub:"يبدأ KVK — المملكة المفقودة مفتوحة، ادخل وقاتل",
    g_tap_the:"اضغط على",
    g_btn_share:"مشاركة",
    g_icon_safari_bar:"الأيقونة في شريط Safari",
    g_scroll_tap:"مرر للأسفل واضغط",
    g_btn_add_home:"إضافة إلى الشاشة الرئيسية",
    g_tap:"اضغط",
    g_btn_add:"إضافة",
    g_in_top_corner:"في الزاوية العلوية",
    g_icon_next_address:"الأيقونة بجانب شريط العنوان",
    g_menu_top_right:"القائمة في أعلى اليمين",
    g_confirm_tap:"أكد واضغط",
    g_btn_menu:"القائمة",
    g_icon_bottom_right:"الأيقونة في أسفل اليمين",
    g_btn_add_page_to:"أضف الصفحة إلى",
    g_btn_home_screen:"الشاشة الرئيسية",
    g_then:"ثم",
    g_look_for:"ابحث عن",
    g_btn_install:"تثبيت",
    g_icon_address_bar:"الأيقونة في شريط العنوان",
    g_dont_see_open:"لا تراها؟ افتح",
    g_menu_word:"القائمة",
    g_choose:"اختر",
    g_btn_install_muster:"تثبيت XTiT",
    g_look_install_icon:"ابحث عن أيقونة تثبيت في شريط أدوات المتصفح",
    g_or_check_menu:"أو تحقق من قائمة المتصفح للحصول على",
    save_btn:"حفظ",
    nav_chat:"الدردشة العامة",
    chat_title:"الدردشة العامة",
    chat_loading:"جارٍ تحميل الرسائل…",
    chat_empty:"لا توجد رسائل بعد — كن أول من يلقي التحية!",
    chat_anonymous:"مجهول",
    chat_placeholder:"اكتب رسالة…",
    chat_send:"إرسال",
    chat_name_title:"اختر اسم العرض",
    chat_name_prompt:"اختر اسمًا سيراه القادة الآخرون بجانب رسائلك.",
    chat_name_placeholder:"أدخل اسمك...",
    chat_name_confirm:"ابدأ الدردشة",
    chat_notice:"يتم حذف جميع الرسائل تلقائيًا كل يوم اثنين الساعة 00:00 UTC.",
    chat_delete_msg_title:"حذف الرسالة؟",
    chat_delete_msg_body:"هل أنت متأكد أنك تريد حذف هذه الرسالة؟",
    chat_delete_yes:"نعم، احذف",
    chat_delete_no:"لا، إلغاء",
    chat_delete_all_btn:"حذف جميع رسائلي",
    chat_delete_all_title:"حذف جميع رسائلك؟",
    chat_delete_all_body:"هل أنت متأكد أنك تريد حذف جميع رسائلك من الدردشة العامة؟",
    chat_delete_all_yes:"نعم، احذف الكل",
    chat_filtered_msg:"تحتوي هذه الرسالة على لغة غير مسموح بها هنا. يرجى إعادة صياغتها.",
    chat_translate_lang_btn:"لغة الترجمة",
    chat_select_translate_lang:"اختر لغة الترجمة",
    chat_translate_lang_desc:"سيتم عرض الرسائل التي تترجمها بهذه اللغة. يمكنك تغييرها في أي وقت.",
    chat_translate_btn:"ترجم",
    chat_hide_translation_btn:"إخفاء الترجمة",
    chat_translating:"جارٍ الترجمة…",
    chat_translate_error:"فشلت الترجمة. حاول مرة أخرى.",
    chat_translated_label:"مترجمة",
    owner_badge:"المالك",
    chat_owner_login_btn:"تسجيل دخول المالك",
    chat_owner_logout_btn:"تسجيل الخروج (المالك)",
    chat_admin_panel_btn:"لوحة الإدارة",
    chat_admin_panel_title:"الدردشة العامة — لوحة الإدارة",
    chat_admin_intro:"إدارة مستخدمي ورسائل الدردشة العامة. تظهر هذه عناصر التحكم للمالك فقط.",
    chat_admin_users_label:"مستخدمو الدردشة النشطون",
    chat_admin_no_users:"لا توجد رسائل من المستخدمين العاديين بعد.",
    chat_admin_messages_suffix:"رسالة",
    chat_admin_ban_btn:"حظر وحذف الرسائل",
    chat_admin_unban_btn:"إلغاء الحظر",
    chat_admin_banned_label:"الأسماء المحظورة",
    chat_admin_no_banned:"لا أحد محظور حاليًا.",
    chat_admin_confirm_ban:"حظر \"{name}\" وحذف جميع رسائله؟ لن يتمكنوا من إرسال رسائل جديدة أثناء الحظر.",
    chat_admin_confirm_unban:"إلغاء حظر \"{name}\"؟ سيتمكنون من الدردشة مرة أخرى.",
    chat_banned_error:"تم حظر هذا الاسم من الدردشة العامة من قبل المالك.",
    chat_change_name_btn:"تغيير اسم العرض",
    chat_emoji_btn:"أيقونات المملكة",
    chat_reply_btn:"رد",
    chat_replying_to:"الرد على",
    chat_clear_reply_btn:"إلغاء الرد",
    chat_jump_to_reply:"الانتقال إلى الرسالة التي تم الرد عليها",
    chat_view_replies:"الانتقال إلى هذه الرسالة",
    chat_reply_singular:"رد",
    chat_replies_plural:"ردود",
    chat_announce_make:"إنشاء إعلان",
    chat_announce_on:"وضع الإعلان مُفعّل",
    chat_announce_placeholder:"اكتب إعلانًا للجميع…",
    chat_announce_send:"أعلن",
    chat_announcement_label:"إعلان",
    chat_announce_hint:"أنت فقط (المالك) يمكنك نشر الإعلانات.",
    chat_img_send_btn:"إرسال صورة",
    chat_img_guide_btn:"دليل حجم الصورة",
    chat_img_guide_title:"دليل حجم الصورة",
    chat_img_max:"الحد الأقصى:",
    chat_img_max_val:"5 ميغابايت لكل صورة",
    chat_img_recommended:"موصى به:",
    chat_img_recommended_val:"أقل من 3 ميغابايت",
    chat_img_formats:"الصيغ:",
    chat_img_formats_val:"JPG، PNG، GIF، WebP",
    chat_img_tip_camera:"📷 الصور من هاتفك تعمل بشكل رائع",
    chat_img_tip_screenshot:"🖼️ لقطات الشاشة مقبولة دائمًا",
    chat_img_auto_shrink:"يتم تصغير الصور الأكبر تلقائيًا قبل الرفع.",
    chat_img_too_large:"الصورة كبيرة جدًا — الحد الأقصى 5 ميغابايت. الرجاء اختيار صورة أصغر.",
    chat_img_failed:"فشل الرفع. يرجى المحاولة مرة أخرى.",
    chat_reply_image:"صورة",
    chat_cooldown_send:"الرسالة التالية",
    chat_cooldown_image:"تبريد الصورة",
    chat_online_label:"القادة المتصلون",
    chat_slow_mode_msg:"الوضع البطيء — حاول مرة أخرى خلال {n} ثانية.",
    chat_slow_mode_img:"الوضع البطيء للصور — حاول مرة أخرى خلال {n} ثانية.",
    chat_typing_one:"يكتب…",
    chat_typing_and:"و",
    chat_typing_are:"يكتبون…",
    chat_typing_others:"آخرون يكتبون…",
    fort_week_label:"الأسبوع",
    fort_governor_label:"الحاكم",
    fort_alliance_label:"التحالف",
    fort_forts_label_short:"الحصون",
    fort_alliance_placeholder:"اسم التحالف…",
    fort_all_alliances:"جميع التحالفات",
    fort_no_alliance:"بدون تحالف",
    fort_search_player:"ابحث عن لاعب…",
    fort_show_deleted:"إظهار المحذوفة",
    fort_hide_deleted:"إخفاء المحذوفة",
    fort_deleted_tag:"محذوف",
    fort_restore_title:"استعادة اللاعب",
    fort_alliances_label:"التحالفات",
    fort_players_label:"اللاعبون",
    fort_all_weeks_total:"جميع الأسابيع",
    fort_upload_normal_opt:"ملف عادي — لا يُحتسب في DKP",
    fort_upload_kvk_opt:"ملف إحصائيات KVK — يُحتسب في DKP",
    fort_badge_kvk:"KVK",
    fort_badge_normal:"عادي",
    fort_image_unavailable:"الصورة غير متوفرة",
    chat_pick_reaction:"اختر تفاعلاً",
    chat_scroll_latest:"التمرير إلى أحدث الرسائل",
    chat_send_failed:"تعذر الإرسال. حاول مرة أخرى.",
    chat_loading_more:"جارٍ التحميل…",
    gov_owner_label:"المالك",
    dkp_earned_tip:"المكتسب",
    dkp_required_tip:"المطلوب",
    dkp_power_tip:"القوة",
    dkp_normal_tip:"ملف عادي — لا يُحتسب DKP",
    feedback_survey_title:"كيف كانت تجربتك مع موقعنا؟",
    feedback_survey_sub:"ملاحظاتك تساعدنا على التحسين — لا تستغرق سوى ثانية.",
    feedback_good:"جيد",
    feedback_notbad:"ليس سيئاً",
    feedback_bad:"سيء",
    feedback_more_title:"شكراً! هل تريد إخبارنا المزيد؟",
    feedback_more_sub:"أضف اقتراحاً أو فكرة أو سؤالاً — أو تخطَّ ذلك.",
    feedback_text_placeholder:"اختياري — شارك أفكارك أو اقتراحاتك أو أسئلتك…",
    feedback_sending:"جارٍ الإرسال…",
    feedback_send:"إرسال",
    feedback_no_thanks:"لا، شكراً",
    feedback_thanks_detailed:"شكراً على ملاحظاتك المفصلة!",
    feedback_thanks_simple:"شكراً على ملاحظاتك!",
    feedback_recorded:"تم تسجيل ردك.",
    feedback_skip:"تخطّي الآن",
    feedback_loading:"جارٍ تحميل الملاحظات…",
    feedback_empty_title:"لا توجد ملاحظات بعد",
    feedback_empty_text:"ستظهر تقييمات الزوار من استبيان الخروج هنا بمجرد تقييم الأشخاص للموقع.",
    feedback_total_ratings:"إجمالي التقييمات",
    feedback_satisfaction:"الرضا / 100",
    feedback_today:"اليوم",
    feedback_last_7:"آخر 7 أيام",
    feedback_last_30:"آخر 30 يوماً",
    feedback_recent:"الردود الأخيرة",
    feedback_with_message:"مع رسالة",
    admin_exit_survey:"استبيان ملاحظات الخروج",
    admin_no_feedback:"لم يتم جمع أي ملاحظات بعد.",
    admin_loading:"جارٍ التحميل…",
    admin_total:"الإجمالي",
    admin_last_7:"في آخر 7 أيام",
    admin_satisfaction:"الرضا",
  },
  ru: {
nav_overview:"Обзор", nav_history:"История", nav_kvk:"KVK", nav_dkp:"DKP", nav_calendar:"Календарь", nav_calculator:"Калькулятор", nav_visitors:"Посетители",
    nav_activity:"Активность",
    activity_title:"Активность королевства",
    activity_tab_farms:"Фермы и помощь альянсу",
    activity_tab_fort:"Варварский форт",
    activity_upload_desc:"Загрузите файл статистики губернаторов, чтобы обновить таблицу лидеров Ферм и Помощи альянсу.",
    activity_upload_btn:"Загрузить файл",
    activity_uploading:"Чтение файла…",
    activity_owner_login:"Вход владельца",
    activity_updated:"Данные за",
    activity_no_data:"Файл ещё не загружен.",
    activity_no_results:"Нет игроков, соответствующих запросу.",
    activity_col_helps:"Помощь альянсу",
    activity_col_resources:"Собрано ресурсов",
    activity_total_helps:"Всего помощи",
    activity_total_resources:"Всего ресурсов",
    activity_players:"Игроки",
    activity_whole_kingdom:"Итоги по всему королевству",
    fort_download_btn:"Скачать",
    fort_download_excel:"Excel (.xlsx)",
    fort_download_csv:"CSV (.csv)",
    fort_copy_clipboard:"Копировать в буфер",
    fort_share_btn:"Поделиться…",
    fort_copied_msg:"Скопировано в буфер обмена.",
    fort_copy_failed:"Не удалось скопировать. Попробуйте снова.",
    activity_search:"Поиск игрока…",
    activity_loaded:"Загружено {count} игроков за {date} — теперь это видят все.",
    activity_missing_helps:" (Столбец «Помощь альянсу» не найден — помощь будет показана как 0.)",
    activity_missing_resources:" (Столбец «Собрано ресурсов» не найден — ресурсы будут показаны как 0.)",
    activity_save_failed:"Загружено локально, но не удалось сохранить для других посетителей. Проверьте соединение и попробуйте снова.",
    activity_soon:"Скоро",
    activity_soon_note:"Отслеживание Варварских фортов в разработке.",
    activity_col_helps_gained:"Прирост помощи",
    activity_col_resources_gained:"Прирост ресурсов",
    fort_no_data:"Данных о Варварских фортах пока нет.",
    fort_col_name:"Имя",
    fort_col_forts:"Уничтожено фортов",
    fort_edit_title:"Изменить игрока",
    fort_name_label:"Имя игрока",
    fort_forts_label:"Уничтожено фортов",
    fort_confirm_remove:"Удалить \"{name}\" из таблицы лидеров?",
    fort_clear_btn:"Очистить таблицу лидеров",
    fort_confirm_clear:"Удалить всю таблицу лидеров Варварских фортов? Это нельзя отменить.",
    fort_updated:"Последнее обновление",
    fort_players:"игроков",
    fort_save_failed:"Не удалось сохранить. Проверьте соединение и попробуйте снова.",
    fort_add_desc:"Добавляйте каждого губернатора вручную — введите имя и сколько Варварских фортов он уничтожил. Если губернатор уже в таблице, сохранится большее число.",
    fort_add_name_placeholder:"Имя губернатора…",
    fort_add_forts_placeholder:"Уничтожено фортов",
    fort_add_btn:"Добавить игрока",
    fort_added_msg:"Добавлен {name} с {forts} фортами.",
    fort_updated_msg:"Обновлён {name} — сохранено большее число.",
    fort_add_invalid:"Введите корректное имя губернатора и число фортов 0 или больше.",
    fort_login_title:"Варварский форт — вход владельца",
    fort_login_prompt:"Введите пароль Варварского форта, чтобы разблокировать инструменты.",
    fort_no_data:"Данных о Варварских фортах пока нет.",
    fort_col_name:"Имя",
    fort_col_forts:"Уничтожено фортов",
    fort_edit_title:"Изменить игрока",
    fort_name_label:"Имя игрока",
    fort_forts_label:"Уничтожено фортов",
    fort_confirm_remove:"Удалить \"{name}\" из таблицы лидеров?",
    fort_clear_btn:"Очистить таблицу лидеров",
    fort_confirm_clear:"Удалить всю таблицу лидеров Варварских фортов? Это нельзя отменить.",
    fort_updated:"Последнее обновление",
    fort_players:"игроков",
    fort_save_failed:"Отсканировано, но не удалось сохранить для других посетителей. Проверьте соединение и попробуйте снова.",
    fort_add_desc:"Добавляйте каждого губернатора вручную — введите имя и сколько Варварских фортов он уничтожил. Если губернатор уже в таблице, сохранится большее число.",
    fort_add_name_placeholder:"Имя губернатора…",
    fort_add_forts_placeholder:"Уничтожено фортов",
    fort_add_btn:"Добавить игрока",
    fort_added_msg:"Добавлен {name} с {forts} фортами.",
    fort_updated_msg:"Обновлён {name} — сохранено большее число.",
    fort_add_invalid:"Введите корректное имя губернатора и число фортов 0 или больше.",
    fort_login_title:"Варварский форт — вход владельца",
    fort_login_prompt:"Введите пароль Варварского форта, чтобы разблокировать инструменты.",
    about_toggle:"Как работает эта страница",
    about_intro:"XTiT — ваш универсальный помощник королевства, который держит вас в курсе событий и отслеживает прогресс вашего альянса.",
    about_li_overview:"Обзор — Отслеживание текущей главы и обратный отсчёт в реальном времени.",
    about_li_history:"История — Прошедшие главы и завершённые события.",
    about_li_kvk:"KVK — Расписание фронта Kingdom vs Kingdom.",
    about_li_chat:"Глобальный чат — Общение в реальном времени между всеми альянсами королевства с переводом на 35+ языков.",
    about_li_dkp:"Трекер DKP — Загружайте статистику губернаторов и отслеживайте результаты KvK.",
    about_li_calendar:"Календарь — Расписание повторяющихся событий.",
    about_li_calculator:"Калькулятор — Быстрый расчёт очков AP, XP, самоцветов и VIP.",
    about_li_visitors:"Посетители — Узнайте, сколько командиров зашло на сайт.",
    about_footer:"Все время указано в UTC. Страница обновляется автоматически.",
    gate_title:"Трекер событий королевства", gate_desc:"Слишком много функций, чтобы облегчить вам жизнь.",
    gate_btn:"Нажмите, чтобы войти", gate_checked_in:"командиров зашло", gate_connecting:"Подключение...",
    banner_season_over:"Все главы завершены — сезон окончен.",
    coming_up:"Скоро",
    history_title:"История", history_count_suffix:"глав завершено на данный момент",
    kvk_title:"Фронт — Kingdom vs Kingdom", kvk_estimated:"Предварительно",
    kvk_note:"Эти даты являются предварительными и будут автоматически обновлены после объявления официальных дат.",
    calendar_title:"Календарь событий", jump_today:"Перейти к сегодня", no_events_day:"В этот день событий не запланировано.",
    calculator_title:"Калькулятор очков", calculator_note:"Введите количество предметов в инвентаре, чтобы рассчитать общее число очков AP, XP, самоцветов и VIP.",
    ap_title:"Очки действия", xp_title:"Очки опыта", gems_title:"Самоцветы", vip_title:"Очки VIP",
    visitors_title:"Посетители", total_visitors:"Всего посетителей", checked_in_note:"Командиры, которые зашли на сайт.", unavailable_now:"Сейчас недоступно",
    contact_question:"Вопросы, предложения или нашли ошибку?", contact_title:"Свяжитесь со мной в Discord",
    discord_btn:"Написать в Discord", contact_note:"Обращайтесь в любое время с запросами, отзывами или проблемами на сайте.",
    dkp_title:"Трекер DKP", dkp_welcome:"Добро пожаловать в трекер DKP.",
    dkp_summary_title:"Итоги по всему королевству",
    dkp_summary_note:"Суммарная статистика всех губернаторов между двумя выбранными снимками.",
    dkp_desc1:"Этот раздел отслеживает результаты KvK королевства 4161, сравнивая данные из двух разных моментов времени (снимков).",
    dkp_desc2:"Снимки записываются до и после битв KvK, чтобы измерить прогресс каждого губернатора по всему королевству.",
    dkp_desc3:"Выберите два снимка ниже, чтобы увидеть, насколько вырос каждый губернатор по силе, убийствам и другим показателям.",
    dkp_top_title:"Лучший результат",
    dkp_top_note:"Губернатор с наивысшим выбранным показателем.",
    dkp_gov_modal_title:"Детали губернатора",
    dkp_gov_id:"ID",
    dkp_gov_change:"Изменение",
    owner_login:"Вход владельца", owner_only:"Только для владельца", upload_desc:"Загрузите новый файл статистики губернаторов за определённую дату.",
    upload_btn:"Загрузить файл губернатора", uploading_btn:"Чтение файла…",
    snapshots_label:"Снимки", total_suffix:"всего",
    from_label:"С", to_label:"По", sort_label:"Сортировать по", search_placeholder:"Поиск губернатора…",
    sort_kp_gained:"Прирост KP", sort_power_gained:"Прирост силы", sort_dead_gained:"Прирост потерь",
    sort_total_kp:"Всего KP", sort_total_power:"Всего силы", sort_total_dead:"Всего потерь",
    slide_left:"← Влево", slide_right:"Вправо →", column_settings:"Настройки столбцов",
    col_governor:"Губернатор", col_power:"Сила", col_kp:"KP", col_dead:"Потери",
    col_power_gained:"Прирост силы", col_kp_gained:"Прирост KP", col_dead_gained:"Прирост потерь",
    load_more:"Загрузить ещё", remaining_suffix:"осталось",
    dkp_kvk_toggle_label:"Прогресс DKP за KVK",
    dkp_kvk_active:"АКТИВЕН",
    dkp_kvk_inactive:"ОТКЛЮЧЁН",
    dkp_kvk_toggle_help:"Включите сразу при старте KVK — каждое убийство и каждая смерть между двумя снимками идут в DKP. Отключите по окончании KVK.",
    dkp_kvk_turn_on:"Включить",
    dkp_kvk_turn_off:"Отключить",
    dkp_kvk_saving:"Сохранение…",
    dkp_reset_title:"Сбросить прогресс DKP",
    dkp_reset_help_active:"Сброшено с {date}. Все более ранние снимки скрыты.",
    dkp_reset_help_inactive:"Сбросить DKP для всех. Будут учитываться снимки начиная с сегодняшнего дня.",
    dkp_reset_btn:"Сбросить прогресс",
    dkp_reset_btn_busy:"Сброс…",
    dkp_kvk_status_off:"⚠️ Прогресс DKP за KVK отключён владельцем. Прогресс будет показывать 0%, пока владелец не включит его.",
    dkp_kvk_status_on:"✅ Прогресс DKP за KVK АКТИВЕН. Каждое убийство и смерть между выбранными снимками идут в DKP.",
    dkp_reset_modal_title:"Сбросить прогресс DKP?",
    dkp_reset_modal_title_busy:"Сброс DKP…",
    dkp_reset_modal_body:"Это сбросит прогресс DKP для всех. Все снимки до сегодняшнего дня будут скрыты из выпадающих списков «С» / «По», и DKP будет показывать 0%, пока вы не загрузите новый снимок от {date} или позже.",
    dkp_reset_modal_warning:"Это нельзя отменить. У вас будет 10 секунд, чтобы отменить.",
    dkp_reset_modal_confirm:"Да, сбросить для всех",
    dkp_reset_modal_countdown:"Сброс DKP для всех через {n}…",
    dkp_reset_modal_countdown_help:"Нажмите «Отмена», чтобы остановить — ничего не сохраняется до окончания отсчёта.",
    no_snapshots:"Снимки ещё не загружены. Загрузите первый файл губернатора выше, чтобы начать.",
    footer_note:"Всё время в UTC · обновляется автоматически, обновление страницы не требуется.", footer_built_by:"Создано XTiT",
    install_btn:"Установить",
    owner_login_prompt:"Введите пароль владельца, чтобы разблокировать инструменты загрузки.", password_placeholder:"Введите пароль...",
    cancel_btn:"Отмена", login_btn:"Войти",
    confirm_action_title:"Подтвердите действие", remove_btn:"Удалить",
    month_1:"Январь", month_2:"Февраль", month_3:"Март", month_4:"Апрель", month_5:"Май", month_6:"Июнь",
    month_7:"Июль", month_8:"Август", month_9:"Сентябрь", month_10:"Октябрь", month_11:"Ноябрь", month_12:"Декабрь",
    dow_mon:"Пн", dow_tue:"Вт", dow_wed:"Ср", dow_thu:"Чт", dow_fri:"Пт", dow_sat:"Сб", dow_sun:"Вс",
    stage_upcoming:"Предстоит", stage_live:"В процессе", stage_complete:"Завершено",
    stage_starts:"Начало", stage_ends:"Конец", stage_open_ended:"Без ограничения",
    stage_until_starts:"до начала", stage_left:"осталось", stage_no_fixed_end:"В процессе — без фиксированной даты окончания", stage_completed_prefix:"Завершено",
    label_opens:"Открытие", label_ends:"Окончание", bonus_opens_suffix:"откроется",
    ops_chapter:"Глава", ops_in_progress:"В процессе", ops_opened:"Открыто", ops_ends:"Окончание", ops_left:"осталось",
    capture_is_open:"открыто", capture_go_capture:"Захватите сейчас", capture_opens:"Открытие",
    ops_opens_next:"Открывается следующей", ops_until_opens:"до открытия",
    ops_season_complete:"Сезон завершён", ops_all_concluded:"Все главы завершены", ops_last_ended:"Последняя глава завершилась",
    skip_link:"Перейти к текущей главе",
    toast_season_complete:"Сезон завершён", toast_all_concluded:"Все главы завершены.", toast_chapter_begun:"началась",
    tag_new:"новый", tag_left:"выбыл", governors_suffix:"губернаторов",
    msg_pick_date:"Сначала выберите дату для этого файла.", msg_could_not_read:"Не удалось прочитать этот файл.",
    msg_save_failed:"Загружено локально, но не удалось сохранить для других посетителей. Проверьте соединение и попробуйте снова.",
    confirm_remove_snapshot:"Удалить снимок {date}? Это действие нельзя отменить.",
    install_title:"Добавить на главный экран", install_which_device:"Какое устройство вы используете?", install_pick_device:"Выберите устройство, чтобы увидеть точные шаги.",
    install_iphone_ipad:"iPhone / iPad", install_android:"Android", install_computer:"Компьютер",
    install_which_browser:"Какой браузер?", install_safari_or_chrome:"Safari или Chrome?", install_safari:"Safari", install_chrome:"Chrome",
    install_chrome_or_samsung:"Chrome или Samsung Internet?", install_samsung:"Samsung Internet",
    install_chrome_or_other:"Chrome или другой браузер?", install_other_browser:"Другой браузер", install_back:"Назад",
    language_label:"Язык",
    msg_loaded_governors:"Загружено {count} губернаторов за {date} — теперь это видно всем.",
    msg_missing_optional:" (В этом файле нет столбца {cols} — эти значения будут показаны как 0.)",
    msg_missing_critical:" Предупреждение: не удалось найти столбец(ы) для {cols} — эти значения будут равны 0 для каждого губернатора.",
    aria_prev_month:"Предыдущий месяц", aria_next_month:"Следующий месяц", aria_close:"Закрыть", aria_dismiss:"Закрыть",
    aria_sections:"Разделы", title_remove:"Удалить {date}",
    aria_items_owned:"Количество предметов {amount} {unit}",
    err_incorrect_password:"Неверный пароль. Попробуйте снова.",
    bonus_shrine:"Святилище",
    bonus_level_3_pass:"Проход 3 уровня",
    bonus_lost_temple:"Затерянный храм",
    kvk_stage_1_title:"Этап 1 — Потерянный секрет",
    kvk_stage_1_sub:"Убивайте мародёров, чтобы раскрыть потерянные секреты — будьте готовы к бою",
    kvk_stage_2_title:"Этап 2 — Подготовка к битве",
    kvk_stage_2_sub:"Тренируйте войска — будьте готовы к предстоящей войне",
    kvk_stage_3_title:"Этап 3 — Столкновение цивилизаций",
    kvk_stage_3_sub:"Атакуйте лагеря / форты мародёров — будьте готовы к бою",
    kvk_stage_4_title:"Этап 4 — Потерянное королевство открывается",
    kvk_stage_4_sub:"KVK начинается — Потерянное королевство открыто, входите и сражайтесь",
    g_tap_the:"Нажмите на",
    g_btn_share:"Поделиться",
    g_icon_safari_bar:"значок на панели Safari",
    g_scroll_tap:"Прокрутите вниз и нажмите",
    g_btn_add_home:"Добавить на главный экран",
    g_tap:"Нажмите",
    g_btn_add:"Добавить",
    g_in_top_corner:"в верхнем углу",
    g_icon_next_address:"значок рядом с адресной строкой",
    g_menu_top_right:"меню в правом верхнем углу",
    g_confirm_tap:"Подтвердите и нажмите",
    g_btn_menu:"Меню",
    g_icon_bottom_right:"значок в правом нижнем углу",
    g_btn_add_page_to:"Добавить страницу в",
    g_btn_home_screen:"Главный экран",
    g_then:"затем",
    g_look_for:"Найдите",
    g_btn_install:"Установить",
    g_icon_address_bar:"значок в адресной строке",
    g_dont_see_open:"Не видите? Откройте",
    g_menu_word:"меню",
    g_choose:"Выберите",
    g_btn_install_muster:"Установить XTiT",
    g_look_install_icon:"Поищите значок установки на панели инструментов браузера",
    g_or_check_menu:"Или проверьте меню браузера на наличие",
    save_btn:"Сохранить",
    nav_chat:"Глобальный чат",
    chat_title:"Глобальный чат",
    chat_loading:"Загрузка сообщений…",
    chat_empty:"Сообщений пока нет — поздоровайтесь первым!",
    chat_anonymous:"Аноним",
    chat_placeholder:"Введите сообщение…",
    chat_send:"Отправить",
    chat_name_title:"Выберите отображаемое имя",
    chat_name_prompt:"Выберите имя, которое другие командиры увидят рядом с вашими сообщениями.",
    chat_name_placeholder:"Введите имя...",
    chat_name_confirm:"Начать общение",
    chat_notice:"Все сообщения автоматически удаляются каждый понедельник в 00:00 UTC.",
    chat_delete_msg_title:"Удалить сообщение?",
    chat_delete_msg_body:"Вы уверены, что хотите удалить это сообщение?",
    chat_delete_yes:"Да, удалить",
    chat_delete_no:"Нет, отмена",
    chat_delete_all_btn:"Удалить все мои сообщения",
    chat_delete_all_title:"Удалить все ваши сообщения?",
    chat_delete_all_body:"Вы уверены, что хотите удалить все свои сообщения из Глобального чата?",
    chat_delete_all_yes:"Да, удалить все",
    chat_filtered_msg:"Это сообщение содержит недопустимые выражения. Пожалуйста, перефразируйте.",
    chat_translate_lang_btn:"Язык перевода",
    chat_select_translate_lang:"Выберите язык перевода",
    chat_translate_lang_desc:"Переведённые сообщения будут отображаться на этом языке. Вы можете изменить его в любое время.",
    chat_translate_btn:"Перевести",
    chat_hide_translation_btn:"Скрыть перевод",
    chat_translating:"Перевод…",
    chat_translate_error:"Не удалось перевести. Попробуйте снова.",
    chat_translated_label:"Переведено",
    owner_badge:"Владелец",
    chat_owner_login_btn:"Вход владельца",
    chat_owner_logout_btn:"Выйти (владелец)",
    chat_admin_panel_btn:"Панель администратора",
    chat_admin_panel_title:"Глобальный чат — Панель администратора",
    chat_admin_intro:"Управляйте пользователями и сообщениями Глобального чата. Эти элементы управления видит только владелец.",
    chat_admin_users_label:"Активные пользователи чата",
    chat_admin_no_users:"Пока нет сообщений от обычных пользователей.",
    chat_admin_messages_suffix:"сообщений",
    chat_admin_ban_btn:"Забанить и удалить сообщения",
    chat_admin_unban_btn:"Разбанить",
    chat_admin_banned_label:"Забаненные имена",
    chat_admin_no_banned:"Сейчас никто не забанен.",
    chat_admin_confirm_ban:"Забанить \"{name}\" и удалить все его сообщения? Они не смогут отправлять новые сообщения, пока забанены.",
    chat_admin_confirm_unban:"Разбанить \"{name}\"? Они снова смогут общаться.",
    chat_banned_error:"Это имя забанено в Глобальном чате владельцем.",
    chat_change_name_btn:"Изменить отображаемое имя",
    chat_emoji_btn:"Иконки королевства",
    chat_reply_btn:"Ответить",
    chat_replying_to:"Ответ",
    chat_clear_reply_btn:"Отменить ответ",
    chat_jump_to_reply:"Перейти к сообщению, на которое отвечают",
    chat_view_replies:"Перейти к этому сообщению",
    chat_reply_singular:"ответ",
    chat_replies_plural:"ответов",
    chat_announce_make:"Создать объявление",
    chat_announce_on:"Режим объявления ВКЛ",
    chat_announce_placeholder:"Напишите объявление для всех…",
    chat_announce_send:"Объявить",
    chat_announcement_label:"Объявление",
    chat_announce_hint:"Только вы (владелец) можете публиковать объявления.",
    chat_img_send_btn:"Отправить изображение",
    chat_img_guide_btn:"Руководство по размеру изображения",
    chat_img_guide_title:"Руководство по размеру изображения",
    chat_img_max:"Макс. размер:",
    chat_img_max_val:"5 МБ на изображение",
    chat_img_recommended:"Рекомендуется:",
    chat_img_recommended_val:"менее 3 МБ",
    chat_img_formats:"Форматы:",
    chat_img_formats_val:"JPG, PNG, GIF, WebP",
    chat_img_tip_camera:"📷 Фото с телефона отлично подходят",
    chat_img_tip_screenshot:"🖼️ Скриншоты всегда подходят",
    chat_img_auto_shrink:"Большие изображения автоматически сжимаются перед загрузкой.",
    chat_img_too_large:"Изображение слишком большое — макс. 5 МБ. Выберите меньшее.",
    chat_img_failed:"Не удалось загрузить. Попробуйте снова.",
    chat_reply_image:"изображение",
    chat_cooldown_send:"Следующее сообщение",
    chat_cooldown_image:"Перезарядка изображения",
    chat_online_label:"Командиры онлайн",
    chat_slow_mode_msg:"Медленный режим — попробуйте через {n}с.",
    chat_slow_mode_img:"Медленный режим изображений — попробуйте через {n}с.",
    chat_typing_one:"печатает…",
    chat_typing_and:"и",
    chat_typing_are:"печатают…",
    chat_typing_others:"других печатают…",
    fort_week_label:"Неделя",
    fort_governor_label:"Губернатор",
    fort_alliance_label:"Альянс",
    fort_forts_label_short:"Форты",
    fort_alliance_placeholder:"Название альянса…",
    fort_all_alliances:"Все альянсы",
    fort_no_alliance:"Без альянса",
    fort_search_player:"Поиск игрока…",
    fort_show_deleted:"Показать удалённых",
    fort_hide_deleted:"Скрыть удалённых",
    fort_deleted_tag:"Удалён",
    fort_restore_title:"Восстановить игрока",
    fort_alliances_label:"Альянсы",
    fort_players_label:"Игроки",
    fort_all_weeks_total:"Все недели",
    fort_upload_normal_opt:"Обычный файл — НЕ идёт в DKP",
    fort_upload_kvk_opt:"Файл статистики KVK — ИДЁТ в DKP",
    fort_badge_kvk:"KVK",
    fort_badge_normal:"ОБЫЧНЫЙ",
    fort_image_unavailable:"Изображение недоступно",
    chat_pick_reaction:"Выберите реакцию",
    chat_scroll_latest:"Прокрутить к последним сообщениям",
    chat_send_failed:"Не удалось отправить. Попробуйте снова.",
    chat_loading_more:"Загрузка…",
    gov_owner_label:"Владелец",
    dkp_earned_tip:"Заработано",
    dkp_required_tip:"Требуется",
    dkp_power_tip:"сила",
    dkp_normal_tip:"Обычный файл — DKP не учитывается",
    feedback_survey_title:"Как вам наш сайт?",
    feedback_survey_sub:"Ваш отзыв помогает нам стать лучше — это займёт секунду.",
    feedback_good:"Хорошо",
    feedback_notbad:"Неплохо",
    feedback_bad:"Плохо",
    feedback_more_title:"Спасибо! Хотите рассказать больше?",
    feedback_more_sub:"Добавьте предложение, идею или вопрос — или пропустите.",
    feedback_text_placeholder:"Необязательно — поделитесь мыслями, идеями или вопросами…",
    feedback_sending:"Отправка…",
    feedback_send:"Отправить",
    feedback_no_thanks:"Нет, спасибо",
    feedback_thanks_detailed:"Спасибо за подробный отзыв!",
    feedback_thanks_simple:"Спасибо за отзыв!",
    feedback_recorded:"Ваш ответ записан.",
    feedback_skip:"Пропустить сейчас",
    feedback_loading:"Загрузка отзывов…",
    feedback_empty_title:"Отзывов пока нет",
    feedback_empty_text:"Оценки посетителей из опроса при выходе появятся здесь, как только люди оценят сайт.",
    feedback_total_ratings:"Всего оценок",
    feedback_satisfaction:"Удовлетворённость / 100",
    feedback_today:"Сегодня",
    feedback_last_7:"За 7 дней",
    feedback_last_30:"За 30 дней",
    feedback_recent:"Последние ответы",
    feedback_with_message:"с сообщением",
    admin_exit_survey:"Опрос при выходе",
    admin_no_feedback:"Отзывы пока не собраны.",
    admin_loading:"Загрузка…",
    admin_total:"всего",
    admin_last_7:"за 7 дней",
    admin_satisfaction:"Удовлетворённость",
  },
  pt: {
nav_overview:"Visão geral", nav_history:"Histórico", nav_kvk:"KVK", nav_dkp:"DKP", nav_calendar:"Calendário", nav_calculator:"Calculadora", nav_visitors:"Visitantes",
    nav_activity:"Atividade",
    activity_title:"Atividade do Reino",
    activity_tab_farms:"Fazendas e Ajuda de Aliança",
    activity_tab_fort:"Forte Bárbaro",
    activity_upload_desc:"Envie um arquivo de estatísticas de governador para atualizar a tabela de líderes de Fazendas e Ajuda de Aliança.",
    activity_upload_btn:"Enviar arquivo",
    activity_uploading:"Lendo arquivo…",
    activity_owner_login:"Login do Proprietário",
    activity_updated:"Dados de",
    activity_no_data:"Nenhum arquivo enviado ainda.",
    activity_no_results:"Nenhum jogador corresponde à sua busca.",
    activity_col_helps:"Ajuda de Aliança",
    activity_col_resources:"Recursos Coletados",
    activity_total_helps:"Total de Ajudas",
    activity_total_resources:"Total de Recursos",
    activity_players:"Jogadores",
    activity_whole_kingdom:"Totais do Reino Inteiro",
    fort_download_btn:"Baixar",
    fort_download_excel:"Excel (.xlsx)",
    fort_download_csv:"CSV (.csv)",
    fort_copy_clipboard:"Copiar para área de transferência",
    fort_share_btn:"Compartilhar…",
    fort_copied_msg:"Copiado para a área de transferência.",
    fort_copy_failed:"Não foi possível copiar. Tente novamente.",
    activity_search:"Buscar jogador…",
    activity_loaded:"Carregados {count} jogadores para {date} — todos podem ver agora.",
    activity_missing_helps:" (Coluna de Ajuda de Aliança não encontrada — as ajudas serão mostradas como 0.)",
    activity_missing_resources:" (Coluna de Recursos Coletados não encontrada — os recursos serão mostrados como 0.)",
    activity_save_failed:"Carregado localmente, mas não foi possível salvar para outros visitantes. Verifique sua conexão e tente novamente.",
    activity_soon:"Em breve",
    activity_soon_note:"O rastreamento do Forte Bárbaro está a caminho.",
    activity_col_helps_gained:"Ajudas Ganhas",
    activity_col_resources_gained:"Recursos Ganhos",
    fort_no_data:"Ainda não há dados do Forte Bárbaro.",
    fort_col_name:"Nome",
    fort_col_forts:"Fortes Destruídos",
    fort_edit_title:"Editar jogador",
    fort_name_label:"Nome do jogador",
    fort_forts_label:"Fortes destruídos",
    fort_confirm_remove:"Remover \"{name}\" da tabela de líderes?",
    fort_clear_btn:"Limpar tabela de líderes",
    fort_confirm_clear:"Excluir toda a tabela de líderes do Forte Bárbaro? Isso não pode ser desfeito.",
    fort_updated:"Última atualização",
    fort_players:"jogadores",
    fort_save_failed:"Não foi possível salvar. Verifique sua conexão e tente novamente.",
    fort_add_desc:"Adicione cada governador manualmente — digite o nome e quantos Fortes Bárbaros ele destruiu. Se o mesmo governador já estiver na tabela, o maior número é mantido.",
    fort_add_name_placeholder:"Nome do governador…",
    fort_add_forts_placeholder:"Fortes destruídos",
    fort_add_btn:"Adicionar jogador",
    fort_added_msg:"{name} adicionado com {forts} fortes.",
    fort_updated_msg:"{name} atualizado — maior número mantido.",
    fort_add_invalid:"Insira um nome de governador válido e um número de fortes igual ou maior que 0.",
    fort_login_title:"Forte Bárbaro — Login do Proprietário",
    fort_login_prompt:"Digite a senha do Forte Bárbaro para desbloquear as ferramentas de adicionar/editar.",
    fort_no_data:"Ainda não há dados do Forte Bárbaro.",
    fort_col_name:"Nome",
    fort_col_forts:"Fortes Destruídos",
    fort_edit_title:"Editar jogador",
    fort_name_label:"Nome do jogador",
    fort_forts_label:"Fortes destruídos",
    fort_confirm_remove:"Remover \"{name}\" da tabela de líderes?",
    fort_clear_btn:"Limpar tabela de líderes",
    fort_confirm_clear:"Excluir toda a tabela de líderes do Forte Bárbaro? Isso não pode ser desfeito.",
    fort_updated:"Última atualização",
    fort_players:"jogadores",
    fort_save_failed:"Digitalizado, mas não foi possível salvar para outros visitantes. Verifique sua conexão e tente novamente.",
    fort_add_desc:"Adicione cada governador manualmente — digite o nome e quantos Fortes Bárbaros ele destruiu. Se o mesmo governador já estiver na tabela, o maior número é mantido.",
    fort_add_name_placeholder:"Nome do governador…",
    fort_add_forts_placeholder:"Fortes destruídos",
    fort_add_btn:"Adicionar jogador",
    fort_added_msg:"{name} adicionado com {forts} fortes.",
    fort_updated_msg:"{name} atualizado — maior número mantido.",
    fort_add_invalid:"Insira um nome de governador válido e um número de fortes igual ou maior que 0.",
    fort_login_title:"Forte Bárbaro — Login do Proprietário",
    fort_login_prompt:"Digite a senha do Forte Bárbaro para desbloquear as ferramentas de adicionar/editar.",
    about_toggle:"Como esta página funciona",
    about_intro:"XTiT é seu companheiro completo do reino — mantendo você atualizado sobre eventos e acompanhando o progresso da sua aliança.",
    about_li_overview:"Visão geral — Acompanhamento ao vivo do capítulo atual e contagens regressivas.",
    about_li_history:"Histórico — Capítulos anteriores e eventos concluídos.",
    about_li_kvk:"KVK — Cronograma da frente de guerra Kingdom vs Kingdom.",
    about_li_chat:"Chat Global — Conversa em tempo real entre todas as alianças do reino, com tradução para mais de 35 idiomas.",
    about_li_dkp:"Rastreador DKP — Envie estatísticas dos governadores e acompanhe o desempenho no KvK.",
    about_li_calendar:"Calendário — Cronograma de eventos recorrentes.",
    about_li_calculator:"Calculadora — Planejador rápido de pontos de AP, XP, Gemas e VIP.",
    about_li_visitors:"Visitantes — Veja quantos comandantes já fizeram check-in.",
    about_footer:"Todos os horários são exibidos em UTC. A página atualiza automaticamente.",
    gate_title:"Rastreador de Eventos do Reino", gate_desc:"Recursos demais para facilitar sua vida.",
    gate_btn:"Pressione para entrar", gate_checked_in:"comandantes fizeram check-in", gate_connecting:"Conectando...",
    banner_season_over:"Todos os capítulos foram concluídos — a temporada terminou.",
    coming_up:"Em breve",
    history_title:"Histórico", history_count_suffix:"capítulos concluídos até agora",
    kvk_title:"Frente de guerra — Kingdom vs Kingdom", kvk_estimated:"Estimado",
    kvk_note:"Estas datas são estimativas e serão atualizadas automaticamente assim que as datas oficiais forem anunciadas.",
    calendar_title:"Calendário de eventos", jump_today:"Ir para hoje", no_events_day:"Nenhum evento agendado para este dia.",
    calculator_title:"Calculadora de pontos", calculator_note:"Insira as quantidades do seu inventário para calcular o total de pontos de AP, XP, Gemas e VIP.",
    ap_title:"Pontos de ação", xp_title:"Pontos de experiência", gems_title:"Gemas", vip_title:"Pontos VIP",
    visitors_title:"Visitantes", total_visitors:"Total de visitantes", checked_in_note:"Comandantes que fizeram check-in.", unavailable_now:"Indisponível no momento",
    contact_question:"Dúvidas, sugestões ou encontrou um bug?", contact_title:"Conecte-se comigo no Discord",
    discord_btn:"Envie-me uma mensagem no Discord", contact_note:"Entre em contato a qualquer momento com pedidos, feedback ou problemas no site.",
    dkp_title:"Rastreador DKP", dkp_welcome:"Bem-vindo ao Rastreador DKP.",
    dkp_summary_title:"Totais do reino inteiro",
    dkp_summary_note:"Estatísticas combinadas de todos os governadores entre os dois snapshots selecionados.",
    dkp_desc1:"Esta seção rastreia o desempenho do KvK do Reino 4161 comparando dados de dois momentos diferentes (snapshots).",
    dkp_desc2:"Os snapshots são registrados antes e depois das batalhas KvK para medir o progresso de cada governador em todo o reino.",
    dkp_desc3:"Selecione dois snapshots abaixo para ver o quanto cada governador ganhou em poder, mortes e mais.",
    dkp_top_title:"Melhor Desempenho",
    dkp_top_note:"O governador com a estatística selecionada mais alta.",
    dkp_gov_modal_title:"Detalhes do Governador",
    dkp_gov_id:"ID",
    dkp_gov_change:"Mudança",
    owner_login:"Login do proprietário", owner_only:"Somente proprietário", upload_desc:"Envie um novo arquivo de estatísticas de governador para uma data específica.",
    upload_btn:"Enviar arquivo de governador", uploading_btn:"Lendo arquivo…",
    snapshots_label:"Snapshots", total_suffix:"total",
    from_label:"De", to_label:"Até", sort_label:"Ordenar por", search_placeholder:"Buscar governador…",
    sort_kp_gained:"KP Ganho", sort_power_gained:"Poder Ganho", sort_dead_gained:"Mortes Ganhas",
    sort_total_kp:"KP Total", sort_total_power:"Poder Total", sort_total_dead:"Mortes Totais",
    slide_left:"← Deslizar esquerda", slide_right:"Deslizar direita →", column_settings:"Configurações de coluna",
    col_governor:"Governador", col_power:"Poder", col_kp:"KP", col_dead:"Mortes",
    col_power_gained:"Poder Ganho", col_kp_gained:"KP Ganho", col_dead_gained:"Mortes Ganhas",
    load_more:"Carregar mais", remaining_suffix:"restantes",
    dkp_kvk_toggle_label:"Progresso DKP do KVK",
    dkp_kvk_active:"ATIVO",
    dkp_kvk_inactive:"INATIVO",
    dkp_kvk_toggle_help:"Ative assim que o KVK começar — cada kill e cada morte entre os dois snapshots conta para o DKP. Desative ao final do KVK.",
    dkp_kvk_turn_on:"Ativar",
    dkp_kvk_turn_off:"Desativar",
    dkp_kvk_saving:"Salvando…",
    dkp_reset_title:"Redefinir Progresso DKP",
    dkp_reset_help_active:"Redefinido a partir de {date}. Todos os snapshots anteriores ficam ocultos.",
    dkp_reset_help_inactive:"Zerar o DKP para todos. Os snapshots a partir de hoje serão contados.",
    dkp_reset_btn:"Redefinir Progresso",
    dkp_reset_btn_busy:"Redefinindo…",
    dkp_kvk_status_off:"⚠️ O progresso DKP do KVK foi DESATIVADO pelo proprietário. O progresso mostrará 0% até que o proprietário o ative.",
    dkp_kvk_status_on:"✅ O progresso DKP do KVK está ATIVO. Cada kill e morte entre os snapshots selecionados está contando para o DKP.",
    dkp_reset_modal_title:"Redefinir Progresso DKP?",
    dkp_reset_modal_title_busy:"Redefinindo DKP…",
    dkp_reset_modal_body:"Isso redefinirá o progresso DKP para todos. Todos os snapshots anteriores a hoje serão ocultados dos menus De / Até, e o DKP mostrará 0% até você enviar um novo snapshot em {date} ou depois.",
    dkp_reset_modal_warning:"Isso não pode ser desfeito. Você tem 10 segundos para cancelar.",
    dkp_reset_modal_confirm:"Sim, Redefinir Todos",
    dkp_reset_modal_countdown:"Redefinindo DKP para todos em {n}…",
    dkp_reset_modal_countdown_help:"Clique em Cancelar para parar — nada é salvo até o contador terminar.",
    no_snapshots:"Nenhum snapshot enviado ainda. Envie seu primeiro arquivo de governador acima para começar.",
    footer_note:"Todos os horários em UTC · atualiza automaticamente, sem necessidade de atualizar a página.", footer_built_by:"Criado por XTiT",
    install_btn:"Instalar",
    owner_login_prompt:"Digite a senha do proprietário para desbloquear as ferramentas de upload.", password_placeholder:"Digite a senha...",
    cancel_btn:"Cancelar", login_btn:"Entrar",
    confirm_action_title:"Confirmar ação", remove_btn:"Remover",
    month_1:"Janeiro", month_2:"Fevereiro", month_3:"Março", month_4:"Abril", month_5:"Maio", month_6:"Junho",
    month_7:"Julho", month_8:"Agosto", month_9:"Setembro", month_10:"Outubro", month_11:"Novembro", month_12:"Dezembro",
    dow_mon:"Seg", dow_tue:"Ter", dow_wed:"Qua", dow_thu:"Qui", dow_fri:"Sex", dow_sat:"Sáb", dow_sun:"Dom",
    stage_upcoming:"Em breve", stage_live:"Em andamento", stage_complete:"Concluído",
    stage_starts:"Início", stage_ends:"Fim", stage_open_ended:"Sem prazo definido",
    stage_until_starts:"até começar", stage_left:"restantes", stage_no_fixed_end:"Em andamento — sem data de término fixa", stage_completed_prefix:"Concluído",
    label_opens:"Abre", label_ends:"Termina", bonus_opens_suffix:"abre",
    ops_chapter:"Capítulo", ops_in_progress:"Em andamento", ops_opened:"Aberto", ops_ends:"Termina", ops_left:"restantes",
    capture_is_open:"está aberto", capture_go_capture:"Vá capturar agora", capture_opens:"Abre",
    ops_opens_next:"Abre em seguida", ops_until_opens:"até abrir",
    ops_season_complete:"Temporada concluída", ops_all_concluded:"Todos os capítulos foram concluídos", ops_last_ended:"O último capítulo terminou em",
    skip_link:"Ir para o capítulo atual",
    toast_season_complete:"Temporada concluída", toast_all_concluded:"Todos os capítulos foram concluídos.", toast_chapter_begun:"começou",
    tag_new:"novo", tag_left:"saiu", governors_suffix:"governadores",
    msg_pick_date:"Escolha uma data para este arquivo primeiro.", msg_could_not_read:"Não foi possível ler este arquivo.",
    msg_save_failed:"Carregado localmente, mas não foi possível salvar para outros visitantes. Verifique sua conexão e tente novamente.",
    confirm_remove_snapshot:"Remover o snapshot de {date}? Isso não pode ser desfeito.",
    install_title:"Adicionar à tela inicial", install_which_device:"Qual dispositivo você está usando?", install_pick_device:"Escolha seu dispositivo para ver os passos exatos.",
    install_iphone_ipad:"iPhone / iPad", install_android:"Android", install_computer:"Computador",
    install_which_browser:"Qual navegador?", install_safari_or_chrome:"Safari ou Chrome?", install_safari:"Safari", install_chrome:"Chrome",
    install_chrome_or_samsung:"Chrome ou Samsung Internet?", install_samsung:"Samsung Internet",
    install_chrome_or_other:"Chrome, ou outro navegador?", install_other_browser:"Outro navegador", install_back:"Voltar",
    language_label:"Idioma",
    msg_loaded_governors:"Carregados {count} governadores para {date} — todos podem ver agora.",
    msg_missing_optional:" (Sem coluna {cols} neste arquivo — esses valores aparecerão como 0.)",
    msg_missing_critical:" Aviso: não foi possível encontrar coluna(s) para {cols} — esses valores serão 0 para todos os governadores.",
    aria_prev_month:"Mês anterior", aria_next_month:"Próximo mês", aria_close:"Fechar", aria_dismiss:"Fechar",
    aria_sections:"Seções", title_remove:"Remover {date}",
    aria_items_owned:"Número de itens {amount} {unit} possuídos",
    err_incorrect_password:"Senha incorreta. Tente novamente.",
    bonus_shrine:"Santuário",
    bonus_level_3_pass:"Passagem Nível 3",
    bonus_lost_temple:"Templo Perdido",
    kvk_stage_1_title:"Estágio 1 — O Segredo Perdido",
    kvk_stage_1_sub:"Mate Saqueadores para revelar os segredos perdidos — esteja preparado para lutar",
    kvk_stage_2_title:"Estágio 2 — Prepare-se para a Batalha",
    kvk_stage_2_sub:"Treine Tropas — esteja preparado para a guerra que virá",
    kvk_stage_3_title:"Estágio 3 — Choque de Civilizações",
    kvk_stage_3_sub:"Ataque Acampamentos / Fortes de Saqueadores — esteja preparado para a batalha",
    kvk_stage_4_title:"Estágio 4 — Reino Perdido se Abre",
    kvk_stage_4_sub:"KVK começa — o Reino Perdido está aberto, entre e lute",
    g_tap_the:"Toque no",
    g_btn_share:"Compartilhar",
    g_icon_safari_bar:"ícone na barra do Safari",
    g_scroll_tap:"Role para baixo e toque em",
    g_btn_add_home:"Adicionar à Tela de Início",
    g_tap:"Toque em",
    g_btn_add:"Adicionar",
    g_in_top_corner:"no canto superior",
    g_icon_next_address:"ícone ao lado da barra de endereços",
    g_menu_top_right:"menu no canto superior direito",
    g_confirm_tap:"Confirme e toque em",
    g_btn_menu:"Menu",
    g_icon_bottom_right:"ícone no canto inferior direito",
    g_btn_add_page_to:"Adicionar página a",
    g_btn_home_screen:"Tela inicial",
    g_then:"depois",
    g_look_for:"Procure o",
    g_btn_install:"Instalar",
    g_icon_address_bar:"ícone na barra de endereços",
    g_dont_see_open:"Não vê? Abra o",
    g_menu_word:"menu",
    g_choose:"Escolha",
    g_btn_install_muster:"Instalar XTiT",
    g_look_install_icon:"Procure um ícone de instalação na barra de ferramentas do navegador",
    g_or_check_menu:"Ou verifique o menu do navegador para",
    save_btn:"Salvar",
    nav_chat:"Chat Global",
    chat_title:"Chat Global",
    chat_loading:"Carregando mensagens…",
    chat_empty:"Ainda não há mensagens — seja o primeiro a dizer olá!",
    chat_anonymous:"Anônimo",
    chat_placeholder:"Digite uma mensagem…",
    chat_send:"Enviar",
    chat_name_title:"Escolha um nome de exibição",
    chat_name_prompt:"Escolha um nome que outros comandantes verão ao lado das suas mensagens.",
    chat_name_placeholder:"Digite seu nome...",
    chat_name_confirm:"Começar a conversar",
    chat_notice:"Todas as mensagens são excluídas automaticamente toda segunda-feira às 00:00 UTC.",
    chat_delete_msg_title:"Excluir Mensagem?",
    chat_delete_msg_body:"Tem certeza de que deseja excluir esta mensagem?",
    chat_delete_yes:"Sim, Excluir",
    chat_delete_no:"Não, Cancelar",
    chat_delete_all_btn:"Excluir Todas as Minhas Mensagens",
    chat_delete_all_title:"Excluir Todas as Suas Mensagens?",
    chat_delete_all_body:"Tem certeza de que deseja excluir todas as suas mensagens do Chat Global?",
    chat_delete_all_yes:"Sim, Excluir Tudo",
    chat_filtered_msg:"Essa mensagem contém linguagem não permitida aqui. Por favor, reformule.",
    chat_translate_lang_btn:"Idioma de tradução",
    chat_select_translate_lang:"Escolha seu idioma de tradução",
    chat_translate_lang_desc:"As mensagens que você traduzir serão exibidas neste idioma. Você pode alterá-lo a qualquer momento.",
    chat_translate_btn:"Traduzir",
    chat_hide_translation_btn:"Ocultar tradução",
    chat_translating:"Traduzindo…",
    chat_translate_error:"Falha na tradução. Tente novamente.",
    chat_translated_label:"Traduzido",
    owner_badge:"Proprietário",
    chat_owner_login_btn:"Login do Proprietário",
    chat_owner_logout_btn:"Sair (Proprietário)",
    chat_admin_panel_btn:"Painel de Admin",
    chat_admin_panel_title:"Chat Global — Painel de Admin",
    chat_admin_intro:"Gerencie usuários e mensagens do Chat Global. Esses controles só são visíveis ao proprietário.",
    chat_admin_users_label:"Usuários ativos do chat",
    chat_admin_no_users:"Ainda não há mensagens de usuários comuns.",
    chat_admin_messages_suffix:"mensagens",
    chat_admin_ban_btn:"Banir e excluir mensagens",
    chat_admin_unban_btn:"Desbanir",
    chat_admin_banned_label:"Nomes banidos",
    chat_admin_no_banned:"Ninguém está banido no momento.",
    chat_admin_confirm_ban:"Banir \"{name}\" e excluir todas as suas mensagens? Eles não poderão enviar novas mensagens enquanto estiverem banidos.",
    chat_admin_confirm_unban:"Desbanir \"{name}\"? Eles poderão conversar novamente.",
    chat_banned_error:"Esse nome foi banido do Chat Global pelo proprietário.",
    chat_change_name_btn:"Alterar nome de exibição",
    chat_emoji_btn:"Ícones do reino",
    chat_reply_btn:"Responder",
    chat_replying_to:"Respondendo a",
    chat_clear_reply_btn:"Cancelar resposta",
    chat_jump_to_reply:"Ir para a mensagem respondida",
    chat_view_replies:"Ir para esta mensagem",
    chat_reply_singular:"resposta",
    chat_replies_plural:"respostas",
    chat_announce_make:"Criar anúncio",
    chat_announce_on:"Modo anúncio ATIVADO",
    chat_announce_placeholder:"Escreva um anúncio para todos…",
    chat_announce_send:"Anunciar",
    chat_announcement_label:"Anúncio",
    chat_announce_hint:"Apenas você (o proprietário) pode postar anúncios.",
    chat_img_send_btn:"Enviar imagem",
    chat_img_guide_btn:"Guia de tamanho de imagem",
    chat_img_guide_title:"Guia de tamanho de imagem",
    chat_img_max:"Tamanho máx:",
    chat_img_max_val:"5 MB por imagem",
    chat_img_recommended:"Recomendado:",
    chat_img_recommended_val:"menos de 3 MB",
    chat_img_formats:"Formatos:",
    chat_img_formats_val:"JPG, PNG, GIF, WebP",
    chat_img_tip_camera:"📷 Fotos do seu celular funcionam muito bem",
    chat_img_tip_screenshot:"🖼️ Capturas de tela são sempre boas",
    chat_img_auto_shrink:"Imagens maiores são reduzidas automaticamente antes do upload.",
    chat_img_too_large:"Imagem muito grande — máx 5 MB. Escolha uma imagem menor.",
    chat_img_failed:"Falha no upload. Tente novamente.",
    chat_reply_image:"imagem",
    chat_cooldown_send:"Próxima mensagem",
    chat_cooldown_image:"Recarga de imagem",
    chat_online_label:"Comandantes online",
    chat_slow_mode_msg:"Modo lento — tente novamente em {n}s.",
    chat_slow_mode_img:"Modo lento de imagem — tente novamente em {n}s.",
    chat_typing_one:"está digitando…",
    chat_typing_and:"e",
    chat_typing_are:"estão digitando…",
    chat_typing_others:"outros estão digitando…",
    fort_week_label:"Semana",
    fort_governor_label:"Governador",
    fort_alliance_label:"Aliança",
    fort_forts_label_short:"Fortes",
    fort_alliance_placeholder:"Nome da aliança…",
    fort_all_alliances:"Todas as Alianças",
    fort_no_alliance:"Sem Aliança",
    fort_search_player:"Buscar jogador…",
    fort_show_deleted:"Mostrar Excluídos",
    fort_hide_deleted:"Ocultar Excluídos",
    fort_deleted_tag:"Excluído",
    fort_restore_title:"Restaurar jogador",
    fort_alliances_label:"Alianças",
    fort_players_label:"Jogadores",
    fort_all_weeks_total:"Todas as Semanas",
    fort_upload_normal_opt:"Arquivo normal — NÃO conta para DKP",
    fort_upload_kvk_opt:"Arquivo de estatísticas KVK — CONTA para DKP",
    fort_badge_kvk:"KVK",
    fort_badge_normal:"NORMAL",
    fort_image_unavailable:"Imagem indisponível",
    chat_pick_reaction:"Escolha uma reação",
    chat_scroll_latest:"Rolar para as mensagens mais recentes",
    chat_send_failed:"Não foi possível enviar. Tente novamente.",
    chat_loading_more:"Carregando…",
    gov_owner_label:"Proprietário",
    dkp_earned_tip:"Ganho",
    dkp_required_tip:"Necessário",
    dkp_power_tip:"poder",
    dkp_normal_tip:"Arquivo normal — DKP não contado",
    feedback_survey_title:"Como foi sua experiência com nosso site?",
    feedback_survey_sub:"Seu feedback nos ajuda a melhorar — leva apenas um segundo.",
    feedback_good:"Bom",
    feedback_notbad:"Razoável",
    feedback_bad:"Ruim",
    feedback_more_title:"Obrigado! Quer nos contar mais?",
    feedback_more_sub:"Adicione uma sugestão, ideia ou pergunta — ou apenas pule.",
    feedback_text_placeholder:"Opcional — compartilhe seus pensamentos, ideias ou perguntas…",
    feedback_sending:"Enviando…",
    feedback_send:"Enviar",
    feedback_no_thanks:"Não, obrigado",
    feedback_thanks_detailed:"Obrigado pelo feedback detalhado!",
    feedback_thanks_simple:"Obrigado pelo seu feedback!",
    feedback_recorded:"Sua resposta foi registrada.",
    feedback_skip:"Pular por agora",
    feedback_loading:"Carregando feedback…",
    feedback_empty_title:"Ainda sem feedback",
    feedback_empty_text:"As avaliações dos visitantes da pesquisa de saída aparecerão aqui assim que as pessoas avaliarem o site.",
    feedback_total_ratings:"Total de Avaliações",
    feedback_satisfaction:"Satisfação / 100",
    feedback_today:"Hoje",
    feedback_last_7:"Últimos 7 dias",
    feedback_last_30:"Últimos 30 dias",
    feedback_recent:"Respostas Recentes",
    feedback_with_message:"com mensagem",
    admin_exit_survey:"Pesquisa de Feedback de Saída",
    admin_no_feedback:"Nenhum feedback coletado ainda.",
    admin_loading:"Carregando…",
    admin_total:"total",
    admin_last_7:"nos últimos 7 dias",
    admin_satisfaction:"Satisfação",
  },
  es: {
nav_overview:"Resumen", nav_history:"Historial", nav_kvk:"KVK", nav_dkp:"DKP", nav_calendar:"Calendario", nav_calculator:"Calculadora", nav_visitors:"Visitantes",
    nav_activity:"Actividad",
    activity_title:"Actividad del Reino",
    activity_tab_farms:"Granjas y Ayuda de Alianza",
    activity_tab_fort:"Fuerte Bárbaro",
    activity_upload_desc:"Sube un archivo de estadísticas de gobernador para actualizar la tabla de clasificación de Granjas y Ayuda de Alianza.",
    activity_upload_btn:"Subir archivo",
    activity_uploading:"Leyendo archivo…",
    activity_owner_login:"Inicio de sesión del propietario",
    activity_updated:"Datos de",
    activity_no_data:"Aún no se ha subido ningún archivo.",
    activity_no_results:"Ningún jugador coincide con tu búsqueda.",
    activity_col_helps:"Ayuda de Alianza",
    activity_col_resources:"Recursos Recolectados",
    activity_total_helps:"Total de Ayudas",
    activity_total_resources:"Total de Recursos",
    activity_players:"Jugadores",
    activity_whole_kingdom:"Totales de todo el Reino",
    fort_download_btn:"Descargar",
    fort_download_excel:"Excel (.xlsx)",
    fort_download_csv:"CSV (.csv)",
    fort_copy_clipboard:"Copiar al portapapeles",
    fort_share_btn:"Compartir…",
    fort_copied_msg:"Copiado al portapapeles.",
    fort_copy_failed:"No se pudo copiar. Inténtalo de nuevo.",
    activity_search:"Buscar jugador…",
    activity_loaded:"Cargados {count} jugadores para {date} — ahora todos pueden verlo.",
    activity_missing_helps:" (Columna de Ayuda de Alianza no encontrada — las ayudas se mostrarán como 0.)",
    activity_missing_resources:" (Columna de Recursos Recolectados no encontrada — los recursos se mostrarán como 0.)",
    activity_save_failed:"Cargado localmente, pero no se pudo guardar para otros visitantes. Verifica tu conexión e inténtalo de nuevo.",
    activity_soon:"Próximamente",
    activity_soon_note:"El seguimiento del Fuerte Bárbaro está en camino.",
    activity_col_helps_gained:"Ayudas Ganadas",
    activity_col_resources_gained:"Recursos Ganados",
    fort_no_data:"Aún no hay datos del Fuerte Bárbaro.",
    fort_col_name:"Nombre",
    fort_col_forts:"Fuertes Destruidos",
    fort_edit_title:"Editar jugador",
    fort_name_label:"Nombre del jugador",
    fort_forts_label:"Fuertes destruidos",
    fort_confirm_remove:"¿Eliminar a \"{name}\" de la tabla de clasificación?",
    fort_clear_btn:"Limpiar tabla de clasificación",
    fort_confirm_clear:"¿Eliminar toda la tabla de clasificación del Fuerte Bárbaro? Esto no se puede deshacer.",
    fort_updated:"Última actualización",
    fort_players:"jugadores",
    fort_save_failed:"No se pudo guardar. Verifica tu conexión e inténtalo de nuevo.",
    fort_add_desc:"Añade cada gobernador manualmente — escribe su nombre y cuántos Fuertes Bárbaros destruyó. Si el mismo gobernador ya está en la tabla, se conserva el número más alto.",
    fort_add_name_placeholder:"Nombre del gobernador…",
    fort_add_forts_placeholder:"Fuertes destruidos",
    fort_add_btn:"Añadir jugador",
    fort_added_msg:"Añadido {name} con {forts} fuertes.",
    fort_updated_msg:"{name} actualizado — se conservó el número más alto.",
    fort_add_invalid:"Introduce un nombre de gobernador válido y un número de fuertes de 0 o más.",
    fort_login_title:"Fuerte Bárbaro — Inicio de sesión del propietario",
    fort_login_prompt:"Introduce la contraseña del Fuerte Bárbaro para desbloquear las herramientas de añadir/editar.",
    fort_no_data:"Aún no hay datos del Fuerte Bárbaro.",
    fort_col_name:"Nombre",
    fort_col_forts:"Fuertes Destruidos",
    fort_edit_title:"Editar jugador",
    fort_name_label:"Nombre del jugador",
    fort_forts_label:"Fuertes destruidos",
    fort_confirm_remove:"¿Eliminar a \"{name}\" de la tabla de clasificación?",
    fort_clear_btn:"Limpiar tabla de clasificación",
    fort_confirm_clear:"¿Eliminar toda la tabla de clasificación del Fuerte Bárbaro? Esto no se puede deshacer.",
    fort_updated:"Última actualización",
    fort_players:"jugadores",
    fort_save_failed:"Escaneado, pero no se pudo guardar para otros visitantes. Verifica tu conexión e inténtalo de nuevo.",
    fort_add_desc:"Añade cada gobernador manualmente — escribe su nombre y cuántos Fuertes Bárbaros destruyó. Si el mismo gobernador ya está en la tabla, se conserva el número más alto.",
    fort_add_name_placeholder:"Nombre del gobernador…",
    fort_add_forts_placeholder:"Fuertes destruidos",
    fort_add_btn:"Añadir jugador",
    fort_added_msg:"Añadido {name} con {forts} fuertes.",
    fort_updated_msg:"{name} actualizado — se conservó el número más alto.",
    fort_add_invalid:"Introduce un nombre de gobernador válido y un número de fuertes de 0 o más.",
    fort_login_title:"Fuerte Bárbaro — Inicio de sesión del propietario",
    fort_login_prompt:"Introduce la contraseña del Fuerte Bárbaro para desbloquear las herramientas de añadir/editar.",
    about_toggle:"Cómo funciona esta página",
    about_intro:"XTiT es tu compañero completo del reino — te mantiene al día con los eventos y rastrea el progreso de tu alianza.",
    about_li_overview:"Resumen — Seguimiento en vivo del capítulo actual y cuentas regresivas.",
    about_li_history:"Historial — Capítulos pasados y eventos completados.",
    about_li_kvk:"KVK — Calendario del frente de guerra Kingdom vs Kingdom.",
    about_li_chat:"Chat Global — Conversación en tiempo real entre todas las alianzas del reino, con traducción a más de 35 idiomas.",
    about_li_dkp:"Rastreador DKP — Sube estadísticas de gobernadores y sigue el rendimiento del KvK.",
    about_li_calendar:"Calendario — Calendario de eventos recurrentes.",
    about_li_calculator:"Calculadora — Planificador rápido de puntos AP, XP, Gemas y VIP.",
    about_li_visitors:"Visitantes — Ve cuántos comandantes se han registrado.",
    about_footer:"Todas las horas se muestran en UTC. La página se actualiza automáticamente.",
    gate_title:"Rastreador de Eventos del Reino", gate_desc:"Demasiadas funciones para facilitarte la vida.",
    gate_btn:"Presiona para entrar", gate_checked_in:"comandantes se han registrado", gate_connecting:"Conectando...",
    banner_season_over:"Todos los capítulos han concluido — la temporada ha terminado.",
    coming_up:"Próximamente",
    history_title:"Historial", history_count_suffix:"capítulos completados hasta ahora",
    kvk_title:"Frente de guerra — Kingdom vs Kingdom", kvk_estimated:"Estimado",
    kvk_note:"Estas fechas son estimadas y se actualizarán automáticamente cuando se anuncien las fechas oficiales.",
    calendar_title:"Calendario de eventos", jump_today:"Ir a hoy", no_events_day:"No hay eventos programados este día.",
    calculator_title:"Calculadora de puntos", calculator_note:"Ingresa las cantidades de tu inventario para calcular el total de puntos AP, XP, Gemas y VIP.",
    ap_title:"Puntos de acción", xp_title:"Puntos de experiencia", gems_title:"Gemas", vip_title:"Puntos VIP",
    visitors_title:"Visitantes", total_visitors:"Total de visitantes", checked_in_note:"Comandantes que se han registrado.", unavailable_now:"No disponible en este momento",
    contact_question:"¿Preguntas, sugerencias o encontraste un error?", contact_title:"Conéctate conmigo en Discord",
    discord_btn:"Envíame un mensaje en Discord", contact_note:"Contáctame en cualquier momento con solicitudes, comentarios o problemas del sitio.",
    dkp_title:"Rastreador DKP", dkp_welcome:"Bienvenido al Rastreador DKP.",
    dkp_summary_title:"Totales de todo el reino",
    dkp_summary_note:"Estatísticas combinadas de todos los gobernadores entre las dos instantáneas seleccionadas.",
    dkp_desc1:"Esta sección rastrea el rendimiento KvK del Reino 4161 comparando datos de dos momentos diferentes (instantáneas).",
    dkp_desc2:"Las instantáneas se registran antes y después de las batallas KvK para medir el progreso de cada gobernador en todo el reino.",
    dkp_desc3:"Selecciona dos instantáneas a continuación para ver cuánto ha ganado cada gobernador en poder, muertes y más.",
    dkp_top_title:"Mejor Rendimiento",
    dkp_top_note:"El gobernador con la estadística seleccionada más alta.",
    dkp_gov_modal_title:"Detalles del Gobernador",
    dkp_gov_id:"ID",
    dkp_gov_change:"Cambio",
    owner_login:"Inicio de sesión del propietario", owner_only:"Solo propietario", upload_desc:"Sube un nuevo archivo de estadísticas de gobernador para una fecha específica.",
    upload_btn:"Subir archivo de gobernador", uploading_btn:"Leyendo archivo…",
    snapshots_label:"Instantáneas", total_suffix:"total",
    from_label:"Desde", to_label:"Hasta", sort_label:"Ordenar por", search_placeholder:"Buscar gobernador…",
    sort_kp_gained:"KP ganados", sort_power_gained:"Poder ganado", sort_dead_gained:"Muertes ganadas",
    sort_total_kp:"KP total", sort_total_power:"Poder total", sort_total_dead:"Muertes totales",
    slide_left:"← Deslizar izquierda", slide_right:"Deslizar derecha →", column_settings:"Configuración de columnas",
    col_governor:"Gobernador", col_power:"Poder", col_kp:"KP", col_dead:"Muertes",
    col_power_gained:"Poder ganado", col_kp_gained:"KP ganados", col_dead_gained:"Muertes ganadas",
    load_more:"Cargar más", remaining_suffix:"restantes",
    dkp_kvk_toggle_label:"Progreso DKP de KVK",
    dkp_kvk_active:"ACTIVO",
    dkp_kvk_inactive:"INACTIVO",
    dkp_kvk_toggle_help:"Actívalo en cuanto empiece el KVK — cada baja y cada muerte entre las dos instantáneas cuenta para el DKP. Desactívalo al terminar el KVK.",
    dkp_kvk_turn_on:"Activar",
    dkp_kvk_turn_off:"Desactivar",
    dkp_kvk_saving:"Guardando…",
    dkp_reset_title:"Restablecer Progreso DKP",
    dkp_reset_help_active:"Restablecido a partir de {date}. Todas las instantáneas anteriores quedan ocultas.",
    dkp_reset_help_inactive:"Poner a cero el DKP para todos. Se contarán las instantáneas desde hoy en adelante.",
    dkp_reset_btn:"Restablecer Progreso",
    dkp_reset_btn_busy:"Restableciendo…",
    dkp_kvk_status_off:"⚠️ El progreso DKP de KVK está DESACTIVADO por el propietario. El progreso mostrará 0% hasta que el propietario lo active.",
    dkp_kvk_status_on:"✅ El progreso DKP de KVK está ACTIVO. Cada baja y muerte entre las instantáneas seleccionadas está contando para el DKP.",
    dkp_reset_modal_title:"¿Restablecer Progreso DKP?",
    dkp_reset_modal_title_busy:"Restableciendo DKP…",
    dkp_reset_modal_body:"Esto restablecerá el progreso DKP para todos. Todas las instantáneas anteriores a hoy se ocultarán de los menús Desde / Hasta, y el DKP mostrará 0% hasta que subas una nueva instantánea del {date} o posterior.",
    dkp_reset_modal_warning:"Esto no se puede deshacer. Tendrás 10 segundos para cancelar.",
    dkp_reset_modal_confirm:"Sí, Restablecer a Todos",
    dkp_reset_modal_countdown:"Restableciendo DKP para todos en {n}…",
    dkp_reset_modal_countdown_help:"Haz clic en Cancelar para detener — nada se guarda hasta que termine la cuenta atrás.",
    no_snapshots:"Aún no se han subido instantáneas. Sube tu primer archivo de gobernador arriba para comenzar.",
    footer_note:"Todas las horas en UTC · se actualiza automáticamente, no es necesario recargar.", footer_built_by:"Creado por XTiT",
    install_btn:"Instalar",
    owner_login_prompt:"Ingresa la contraseña del propietario para desbloquear las herramientas de carga.", password_placeholder:"Ingresa la contraseña...",
    cancel_btn:"Cancelar", login_btn:"Iniciar sesión",
    confirm_action_title:"Confirmar acción", remove_btn:"Eliminar",
    month_1:"Enero", month_2:"Febrero", month_3:"Marzo", month_4:"Abril", month_5:"Mayo", month_6:"Junio",
    month_7:"Julio", month_8:"Agosto", month_9:"Septiembre", month_10:"Octubre", month_11:"Noviembre", month_12:"Diciembre",
    dow_mon:"L", dow_tue:"M", dow_wed:"X", dow_thu:"J", dow_fri:"V", dow_sat:"S", dow_sun:"D",
    stage_upcoming:"Próximo", stage_live:"En curso", stage_complete:"Completo",
    stage_starts:"Comienza", stage_ends:"Termina", stage_open_ended:"Sin fecha límite",
    stage_until_starts:"hasta que comience", stage_left:"restantes", stage_no_fixed_end:"En curso — sin fecha de fin fija", stage_completed_prefix:"Completado",
    label_opens:"Abre", label_ends:"Termina", bonus_opens_suffix:"abre",
    ops_chapter:"Capítulo", ops_in_progress:"En curso", ops_opened:"Abierto", ops_ends:"Termina", ops_left:"restantes",
    capture_is_open:"está abierto", capture_go_capture:"Ve a capturarlo", capture_opens:"Abre",
    ops_opens_next:"Abre a continuación", ops_until_opens:"hasta que abra",
    ops_season_complete:"Temporada completa", ops_all_concluded:"Todos los capítulos han concluido", ops_last_ended:"El último capítulo terminó el",
    skip_link:"Ir al capítulo actual",
    toast_season_complete:"Temporada completa", toast_all_concluded:"Todos los capítulos han concluido.", toast_chapter_begun:"ha comenzado",
    tag_new:"nuevo", tag_left:"salió", governors_suffix:"gobernadores",
    msg_pick_date:"Elige una fecha para este archivo primero.", msg_could_not_read:"No se pudo leer este archivo.",
    msg_save_failed:"Se cargó localmente, pero no se pudo guardar para otros visitantes. Verifica tu conexión e inténtalo de nuevo.",
    confirm_remove_snapshot:"¿Eliminar la instantánea de {date}? Esto no se puede deshacer.",
    install_title:"Añadir a la pantalla de inicio", install_which_device:"¿Qué dispositivo estás usando?", install_pick_device:"Elige tu dispositivo para ver los pasos exactos.",
    install_iphone_ipad:"iPhone / iPad", install_android:"Android", install_computer:"Computadora",
    install_which_browser:"¿Qué navegador?", install_safari_or_chrome:"¿Safari o Chrome?", install_safari:"Safari", install_chrome:"Chrome",
    install_chrome_or_samsung:"¿Chrome o Samsung Internet?", install_samsung:"Samsung Internet",
    install_chrome_or_other:"¿Chrome, u otro navegador?", install_other_browser:"Otro navegador", install_back:"Atrás",
    language_label:"Idioma",
    msg_loaded_governors:"Se cargaron {count} gobernadores para {date} — ahora todos pueden verlo.",
    msg_missing_optional:" (No hay columna {cols} en este archivo — esos valores se mostrarán como 0.)",
    msg_missing_critical:" Advertencia: no se pudo encontrar columna(s) para {cols} — esos valores serán 0 para todos los gobernadores.",
    aria_prev_month:"Mes anterior", aria_next_month:"Mes siguiente", aria_close:"Cerrar", aria_dismiss:"Cerrar",
    aria_sections:"Secciones", title_remove:"Eliminar {date}",
    aria_items_owned:"Número de artículos {amount} {unit} en posesión",
    err_incorrect_password:"Contraseña incorrecta. Inténtalo de nuevo.",
    bonus_shrine:"Santuario",
    bonus_level_3_pass:"Paso Nivel 3",
    bonus_lost_temple:"Templo Perdido",
    kvk_stage_1_title:"Etapa 1 — El Secreto Perdido",
    kvk_stage_1_sub:"Mata a los Merodeadores para descubrir los secretos perdidos — prepárate para luchar",
    kvk_stage_2_title:"Etapa 2 — Prepárate para la Batalla",
    kvk_stage_2_sub:"Entrena Tropas — prepárate para la guerra que viene",
    kvk_stage_3_title:"Etapa 3 — Choque de Civilizaciones",
    kvk_stage_3_sub:"Ataca Campamentos / Fuertes de Merodeadores — prepárate para la batalla",
    kvk_stage_4_title:"Etapa 4 — El Reino Perdido se Abre",
    kvk_stage_4_sub:"KVK comienza — el Reino Perdido está abierto, entra y lucha",
    g_tap_the:"Toca el",
    g_btn_share:"Compartir",
    g_icon_safari_bar:"icono en la barra de Safari",
    g_scroll_tap:"Desplázate hacia abajo y toca",
    g_btn_add_home:"Añadir a la pantalla de inicio",
    g_tap:"Toca",
    g_btn_add:"Añadir",
    g_in_top_corner:"en la esquina superior",
    g_icon_next_address:"icono junto a la barra de direcciones",
    g_menu_top_right:"menú en la esquina superior derecha",
    g_confirm_tap:"Confirma y toca",
    g_btn_menu:"Menú",
    g_icon_bottom_right:"icono en la esquina inferior derecha",
    g_btn_add_page_to:"Añadir página a",
    g_btn_home_screen:"Pantalla de inicio",
    g_then:"luego",
    g_look_for:"Busca el",
    g_btn_install:"Instalar",
    g_icon_address_bar:"icono en la barra de direcciones",
    g_dont_see_open:"¿No lo ves? Abre el",
    g_menu_word:"menú",
    g_choose:"Elige",
    g_btn_install_muster:"Instalar XTiT",
    g_look_install_icon:"Busca un icono de instalación en la barra de herramientas del navegador",
    g_or_check_menu:"O revisa el menú del navegador para",
    save_btn:"Guardar",
    nav_chat:"Chat Global",
    chat_title:"Chat Global",
    chat_loading:"Cargando mensajes…",
    chat_empty:"Aún no hay mensajes — ¡sé el primero en saludar!",
    chat_anonymous:"Anónimo",
    chat_placeholder:"Escribe un mensaje…",
    chat_send:"Enviar",
    chat_name_title:"Elige un nombre para mostrar",
    chat_name_prompt:"Elige un nombre que otros comandantes verán junto a tus mensajes.",
    chat_name_placeholder:"Ingresa tu nombre...",
    chat_name_confirm:"Empezar a chatear",
    chat_notice:"Todos los mensajes se eliminan automáticamente cada lunes a las 00:00 UTC.",
    chat_delete_msg_title:"¿Eliminar mensaje?",
    chat_delete_msg_body:"¿Estás seguro de que quieres eliminar este mensaje?",
    chat_delete_yes:"Sí, eliminar",
    chat_delete_no:"No, cancelar",
    chat_delete_all_btn:"Eliminar todos mis mensajes",
    chat_delete_all_title:"¿Eliminar todos tus mensajes?",
    chat_delete_all_body:"¿Estás seguro de que quieres eliminar todos tus mensajes del Chat Global?",
    chat_delete_all_yes:"Sí, eliminar todo",
    chat_filtered_msg:"Ese mensaje contiene lenguaje no permitido aquí. Por favor, reformúlalo.",
    chat_translate_lang_btn:"Idioma de traducción",
    chat_select_translate_lang:"Elige tu idioma de traducción",
    chat_translate_lang_desc:"Los mensajes que traduzcas se mostrarán en este idioma. Puedes cambiarlo en cualquier momento.",
    chat_translate_btn:"Traducir",
    chat_hide_translation_btn:"Ocultar traducción",
    chat_translating:"Traduciendo…",
    chat_translate_error:"La traducción falló. Inténtalo de nuevo.",
    chat_translated_label:"Traducido",
    owner_badge:"Propietario",
    chat_owner_login_btn:"Inicio de sesión del propietario",
    chat_owner_logout_btn:"Cerrar sesión (Propietario)",
    chat_admin_panel_btn:"Panel de Admin",
    chat_admin_panel_title:"Chat Global — Panel de Admin",
    chat_admin_intro:"Gestiona usuarios y mensajes del Chat Global. Estos controles solo los ve el propietario.",
    chat_admin_users_label:"Usuarios activos del chat",
    chat_admin_no_users:"Aún no hay mensajes de usuarios normales.",
    chat_admin_messages_suffix:"mensajes",
    chat_admin_ban_btn:"Banear y eliminar mensajes",
    chat_admin_unban_btn:"Desbanear",
    chat_admin_banned_label:"Nombres baneados",
    chat_admin_no_banned:"Nadie está baneado actualmente.",
    chat_admin_confirm_ban:"¿Banear a \"{name}\" y eliminar todos sus mensajes? No podrán enviar nuevos mensajes mientras estén baneados.",
    chat_admin_confirm_unban:"¿Desbanear a \"{name}\"? Podrán volver a chatear.",
    chat_banned_error:"Ese nombre ha sido baneado del Chat Global por el propietario.",
    chat_change_name_btn:"Cambiar nombre para mostrar",
    chat_emoji_btn:"Iconos del reino",
    chat_reply_btn:"Responder",
    chat_replying_to:"Respondiendo a",
    chat_clear_reply_btn:"Cancelar respuesta",
    chat_jump_to_reply:"Ir al mensaje respondido",
    chat_view_replies:"Ir a este mensaje",
    chat_reply_singular:"respuesta",
    chat_replies_plural:"respuestas",
    chat_announce_make:"Crear anuncio",
    chat_announce_on:"Modo anuncio ACTIVADO",
    chat_announce_placeholder:"Escribe un anuncio para todos…",
    chat_announce_send:"Anunciar",
    chat_announcement_label:"Anuncio",
    chat_announce_hint:"Solo tú (el propietario) puedes publicar anuncios.",
    chat_img_send_btn:"Enviar imagen",
    chat_img_guide_btn:"Guía de tamaño de imagen",
    chat_img_guide_title:"Guía de tamaño de imagen",
    chat_img_max:"Tamaño máx:",
    chat_img_max_val:"5 MB por imagen",
    chat_img_recommended:"Recomendado:",
    chat_img_recommended_val:"menos de 3 MB",
    chat_img_formats:"Formatos:",
    chat_img_formats_val:"JPG, PNG, GIF, WebP",
    chat_img_tip_camera:"📷 Las fotos de tu teléfono funcionan muy bien",
    chat_img_tip_screenshot:"🖼️ Las capturas de pantalla siempre están bien",
    chat_img_auto_shrink:"Las imágenes más grandes se reducen automáticamente antes de subirse.",
    chat_img_too_large:"Imagen demasiado grande — máx 5 MB. Elige una imagen más pequeña.",
    chat_img_failed:"La subida falló. Inténtalo de nuevo.",
    chat_reply_image:"imagen",
    chat_cooldown_send:"Siguiente mensaje",
    chat_cooldown_image:"Enfriamiento de imagen",
    chat_online_label:"Comandantes en línea",
    chat_slow_mode_msg:"Modo lento — inténtalo de nuevo en {n}s.",
    chat_slow_mode_img:"Modo lento de imagen — inténtalo de nuevo en {n}s.",
    chat_typing_one:"está escribiendo…",
    chat_typing_and:"y",
    chat_typing_are:"están escribiendo…",
    chat_typing_others:"otros están escribiendo…",
    fort_week_label:"Semana",
    fort_governor_label:"Gobernador",
    fort_alliance_label:"Alianza",
    fort_forts_label_short:"Fuertes",
    fort_alliance_placeholder:"Nombre de la alianza…",
    fort_all_alliances:"Todas las Alianzas",
    fort_no_alliance:"Sin Alianza",
    fort_search_player:"Buscar jugador…",
    fort_show_deleted:"Mostrar Eliminados",
    fort_hide_deleted:"Ocultar Eliminados",
    fort_deleted_tag:"Eliminado",
    fort_restore_title:"Restaurar jugador",
    fort_alliances_label:"Alianzas",
    fort_players_label:"Jugadores",
    fort_all_weeks_total:"Todas las Semanas",
    fort_upload_normal_opt:"Archivo normal — NO cuenta para DKP",
    fort_upload_kvk_opt:"Archivo de estadísticas KVK — SÍ cuenta para DKP",
    fort_badge_kvk:"KVK",
    fort_badge_normal:"NORMAL",
    fort_image_unavailable:"Imagen no disponible",
    chat_pick_reaction:"Elige una reacción",
    chat_scroll_latest:"Desplazarse a los mensajes más recientes",
    chat_send_failed:"No se pudo enviar. Inténtalo de nuevo.",
    chat_loading_more:"Cargando…",
    gov_owner_label:"Propietario",
    dkp_earned_tip:"Ganado",
    dkp_required_tip:"Requerido",
    dkp_power_tip:"poder",
    dkp_normal_tip:"Archivo normal — DKP no contado",
    feedback_survey_title:"¿Cómo fue tu experiencia con nuestro sitio web?",
    feedback_survey_sub:"Tu opinión nos ayuda a mejorar — solo toma un segundo.",
    feedback_good:"Bueno",
    feedback_notbad:"Regular",
    feedback_bad:"Malo",
    feedback_more_title:"¡Gracias! ¿Quieres contarnos más?",
    feedback_more_sub:"Añade una sugerencia, idea o pregunta — o simplemente omítelo.",
    feedback_text_placeholder:"Opcional — comparte tus pensamientos, ideas o preguntas…",
    feedback_sending:"Enviando…",
    feedback_send:"Enviar",
    feedback_no_thanks:"No, gracias",
    feedback_thanks_detailed:"¡Gracias por tu opinión detallada!",
    feedback_thanks_simple:"¡Gracias por tu opinión!",
    feedback_recorded:"Tu respuesta ha sido registrada.",
    feedback_skip:"Omitir por ahora",
    feedback_loading:"Cargando opiniones…",
    feedback_empty_title:"Aún no hay opiniones",
    feedback_empty_text:"Las valoraciones de los visitantes de la encuesta de salida aparecerán aquí en cuanto la gente valore el sitio.",
    feedback_total_ratings:"Total de Valoraciones",
    feedback_satisfaction:"Satisfacción / 100",
    feedback_today:"Hoy",
    feedback_last_7:"Últimos 7 días",
    feedback_last_30:"Últimos 30 días",
    feedback_recent:"Respuestas Recientes",
    feedback_with_message:"con mensaje",
    admin_exit_survey:"Encuesta de Opinión de Salida",
    admin_no_feedback:"Aún no se ha recopilado ninguna opinión.",
    admin_loading:"Cargando…",
    admin_total:"total",
    admin_last_7:"en los últimos 7 días",
    admin_satisfaction:"Satisfacción",
  },
};

const LanguageContext = React.createContext({ lang:'en', t:k=>k, setLang:()=>{} });
function useT() { return useContext(LanguageContext); }

function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    try { return localStorage.getItem(LANG_STORAGE_KEY) || 'en'; } catch { return 'en'; }
  });
  const setLang = (code) => {
    setLangState(code);
    try { localStorage.setItem(LANG_STORAGE_KEY, code); } catch (e) {}
  };
  const t = useCallback(
    (key) => (TRANSLATIONS[lang] && TRANSLATIONS[lang][key]) || TRANSLATIONS.en[key] || key,
    [lang]
  );
  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

function LanguageSwitcher() {
  const { lang, setLang, t } = useT();
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth <= 900 : false
  );
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 900);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Close on outside click / tap and on Escape
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown, { passive: true });
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const current = LANGUAGES.find(l => l.code === lang) || LANGUAGES[0];

  return (
    <div className="lang-select-wrap" ref={wrapRef}>
      <button
        type="button"
        className={`lang-select${open ? ' lang-select-open' : ''}`}
        onClick={() => setOpen(o => !o)}
        aria-label={t('language_label')}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="lang-select-label">
          {isMobile ? (current.short || current.label.slice(0, 2)) : current.label}
        </span>
        <svg className="lang-select-caret" viewBox="0 0 24 24" fill="none" width="12" height="12" aria-hidden="true">
          <polyline points="6 9 12 15 18 9" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && (
        <div className="lang-select-menu" role="listbox">
          {LANGUAGES.map(l => (
            <button
              key={l.code}
              type="button"
              role="option"
              aria-selected={l.code === lang}
              className={`lang-select-option${l.code === lang ? ' selected' : ''}`}
              onClick={() => { setLang(l.code); setOpen(false); }}
            >
              <span className="lang-select-option-label">{l.label}</span>
              {l.code === lang && (
                <svg viewBox="0 0 24 24" fill="none" width="14" height="14" aria-hidden="true">
                  <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* =====================================================================
   OPERATION (chapter) CARD — the "front line" stepper card, used for KvK
   ===================================================================== */

function StageCard({ item, now }) {
  const { t } = useT();
  let status;
  if (now < item.start) status = 'upcoming';
  else if (item.end === null || now < item.end) status = 'live';
  else status = 'done';

  const badgeText = status === 'upcoming' ? t('stage_upcoming')
                  : status === 'live'     ? t('stage_live')
                  :                         t('stage_complete');

  let countdown;
  if (status === 'upcoming') countdown = <><CountdownHTML ms={item.start - now} /> {t('stage_until_starts')}</>;
  else if (status === 'live' && item.end !== null) countdown = <><CountdownHTML ms={item.end - now} /> {t('stage_left')}</>;
  else if (status === 'live') countdown = <>{t('stage_no_fixed_end')}</>;
  else countdown = <>{t('stage_completed_prefix')} {fmtShort(item.end)}</>;

  return (
    <div className={`stage-card ${status}${item.highlight ? ' highlight' : ''}`}>
      <div className="stage-rail">
        <span className="stage-dot" />
        {!item.last && <span className="stage-line" />}
      </div>
      <div className="stage-body">
        <div className="stage-top">
          <span className="stage-index">{item.n}</span>
          <span className={`pill ${status}`}>{badgeText}</span>
        </div>
        <h3 className="stage-title">{item.title}</h3>
        <p className="stage-sub">{item.sub}</p>
        <div className="stage-meta">
          <span>{t('stage_starts')} {fmtShort(item.start)}</span>
          <span>·</span>
          <span>{item.end === null ? t('stage_open_ended') : `${t('stage_ends')} ${fmtShort(item.end)}`}</span>
        </div>
        <div className="stage-countdown">{countdown}</div>
      </div>
    </div>
  );
}

/* =====================================================================
   UPCOMING ROW
   ===================================================================== */

function UpcomingRow({ chapter, isOpen, onToggle }) {
  const { t } = useT();
  return (
    <div className={`row-card${isOpen ? ' open' : ''}`}>
      <div
        className="row-head"
        tabIndex={0}
        role="button"
        aria-expanded={isOpen}
        onClick={onToggle}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } }}
      >
        <span className="row-index">{chapter.n}</span>
        <div className="row-titles">
          <div className="row-title">{chapter.title}</div>
          <div className="row-sub">{chapter.sub}</div>
        </div>
        <span className="row-date">{fmtShort(chapter.start)}</span>
        <Icon.chevron className="row-chevron" width={16} height={16} />
      </div>
      <Collapsible open={isOpen} className="row-body">
        <div className="row-body-inner">
          <p><span className="label">{t('label_opens')}</span> {fmtShort(chapter.start)}</p>
          <p><span className="label">{t('label_ends')}</span> {fmtShort(chapter.end)}</p>
          {(chapter.bonus || []).map((b, i) => (
            <p className="bonus-line" key={i}><Icon.key width={14} height={14} /> {t(b.labelKey)} {t('bonus_opens_suffix')} {fmtShort(b.time)}</p>
          ))}
        </div>
      </Collapsible>
    </div>
  );
}

/* =====================================================================
   INSTALL MODAL
   ===================================================================== */

const getGuides = (t) => ({
  'iphone-safari': (
    <ol>
      <li>{t('g_tap_the')} <span className="step-icon">{t('g_btn_share')}</span> {t('g_icon_safari_bar')}</li>
      <li>{t('g_scroll_tap')} <span className="step-icon">{t('g_btn_add_home')}</span></li>
      <li>{t('g_tap')} <span className="step-icon">{t('g_btn_add')}</span> {t('g_in_top_corner')}</li>
    </ol>
  ),
  'iphone-chrome': (
    <ol>
      <li>{t('g_tap_the')} <span className="step-icon">{t('g_btn_share')}</span> {t('g_icon_next_address')}</li>
      <li>{t('g_scroll_tap')} <span className="step-icon">{t('g_btn_add_home')}</span></li>
      <li>{t('g_tap')} <span className="step-icon">{t('g_btn_add')}</span> {t('g_in_top_corner')}</li>
    </ol>
  ),
  'android-chrome': (
    <ol>
      <li>{t('g_tap_the')} <span className="step-icon">⋮</span> {t('g_menu_top_right')}</li>
      <li>{t('g_tap')} <span className="step-icon">{t('g_btn_add_home')}</span></li>
      <li>{t('g_confirm_tap')} <span className="step-icon">{t('g_btn_add')}</span></li>
    </ol>
  ),
  'android-samsung': (
    <ol>
      <li>{t('g_tap_the')} <span className="step-icon">{t('g_btn_menu')}</span> {t('g_icon_bottom_right')}</li>
      <li>{t('g_tap')} <span className="step-icon">{t('g_btn_add_page_to')}</span></li>
      <li>{t('g_tap')} <span className="step-icon">{t('g_btn_home_screen')}</span>{t('g_then')}<span className="step-icon">{t('g_btn_add')}</span></li>
    </ol>
  ),
  'desktop-chrome': (
    <ol>
      <li>{t('g_look_for')} <span className="step-icon">{t('g_btn_install')}</span> {t('g_icon_address_bar')}</li>
      <li>{t('g_dont_see_open')} <span className="step-icon">⋮</span> {t('g_menu_word')}</li>
      <li>{t('g_choose')} <span className="step-icon">{t('g_btn_install_muster')}</span></li>
    </ol>
  ),
  'desktop-other': (
    <ol>
      <li>{t('g_look_install_icon')}</li>
      <li>{t('g_or_check_menu')} <span className="step-icon">{t('g_btn_install')}</span> / <span className="step-icon">{t('g_btn_add_home')}</span></li>
    </ol>
  ),
});

const BACK_TARGET = {
  'iphone-safari':   'iphone-browser',
  'iphone-chrome':   'iphone-browser',
  'android-chrome':  'android-browser',
  'android-samsung': 'android-browser',
  'desktop-chrome':  'desktop-browser',
  'desktop-other':   'desktop-browser',
};

function InstallModal({ screen, onClose, onNavigate }) {
  const { t } = useT();
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!screen) return null;

  let titleText = t('install_title');
  let bodyContent = null;

  if (screen === 'device') {
    titleText = t('install_which_device');
    bodyContent = (
      <>
        <p className="modal-prompt">{t('install_pick_device')}</p>
        <div className="modal-choices">
          <button className="choice-btn" onClick={() => onNavigate('iphone-browser')}>{t('install_iphone_ipad')}</button>
          <button className="choice-btn" onClick={() => onNavigate('android-browser')}>{t('install_android')}</button>
          <button className="choice-btn" onClick={() => onNavigate('desktop-browser')}>{t('install_computer')}</button>
        </div>
      </>
    );
  } else if (screen === 'iphone-browser') {
    titleText = t('install_which_browser');
    bodyContent = (
      <>
        <button className="modal-back" onClick={() => onNavigate('device')}><Icon.arrowLeft width={14} height={14}/> {t('install_back')}</button>
        <p className="modal-prompt">{t('install_safari_or_chrome')}</p>
        <div className="modal-choices">
          <button className="choice-btn" onClick={() => onNavigate('iphone-safari')}>{t('install_safari')}</button>
          <button className="choice-btn" onClick={() => onNavigate('iphone-chrome')}>{t('install_chrome')}</button>
        </div>
      </>
    );
  } else if (screen === 'android-browser') {
    titleText = t('install_which_browser');
    bodyContent = (
      <>
        <button className="modal-back" onClick={() => onNavigate('device')}><Icon.arrowLeft width={14} height={14}/> {t('install_back')}</button>
        <p className="modal-prompt">{t('install_chrome_or_samsung')}</p>
        <div className="modal-choices">
          <button className="choice-btn" onClick={() => onNavigate('android-chrome')}>{t('install_chrome')}</button>
          <button className="choice-btn" onClick={() => onNavigate('android-samsung')}>{t('install_samsung')}</button>
        </div>
      </>
    );
  } else if (screen === 'desktop-browser') {
    titleText = t('install_which_browser');
    bodyContent = (
      <>
        <button className="modal-back" onClick={() => onNavigate('device')}><Icon.arrowLeft width={14} height={14}/> {t('install_back')}</button>
        <p className="modal-prompt">{t('install_chrome_or_other')}</p>
        <div className="modal-choices">
          <button className="choice-btn" onClick={() => onNavigate('desktop-chrome')}>{t('install_chrome')}</button>
          <button className="choice-btn" onClick={() => onNavigate('desktop-other')}>{t('install_other_browser')}</button>
        </div>
      </>
    );
  } else if (getGuides(t)[screen]) {
    titleText = t('install_title');
    bodyContent = (
      <>
        <button className="modal-back" onClick={() => onNavigate(BACK_TARGET[screen])}><Icon.arrowLeft width={14} height={14}/> {t('install_back')}</button>
        {getGuides(t)[screen]}
      </>
    );
  }

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }} role="dialog" aria-modal="true">
      <div className="modal-card">
        <div className="modal-header">
          <h3>{titleText}</h3>
          <button className="modal-x" onClick={onClose} aria-label={t('aria_close')}><Icon.close width={16} height={16}/></button>
        </div>
        <div className="modal-body">{bodyContent}</div>
      </div>
    </div>
  );
}

/* =====================================================================
   CALENDAR — month grid with a day-agenda beneath it
   ===================================================================== */

const EVENTS_PARSED = EVENTS.map(ev => ({
  ev, s: parseISODate(ev.start).getTime(), e: parseISODate(ev.end).getTime(),
}));
function eventsOnDate(dUTC) {
  const t = dUTC.getTime();
  return EVENTS_PARSED.filter(x => t >= x.s && t <= x.e).map(x => x.ev);
}

function CalendarPanel() {
  const { t } = useT();
  const today = useMemo(() => new Date(), []);
  const [viewYear, setViewYear]   = useState(today.getUTCFullYear());
  const [viewMonth, setViewMonth] = useState(today.getUTCMonth());
  const [selectedISO, setSelectedISO] = useState(toISODate(today));

  const monthNames = [t('month_1'),t('month_2'),t('month_3'),t('month_4'),t('month_5'),t('month_6'),t('month_7'),t('month_8'),t('month_9'),t('month_10'),t('month_11'),t('month_12')];
  const dayNames   = [t('dow_mon'),t('dow_tue'),t('dow_wed'),t('dow_thu'),t('dow_fri'),t('dow_sat'),t('dow_sun')];

  const goPrev  = () => { if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); } else setViewMonth(m => m - 1); };
  const goNext  = () => { if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); } else setViewMonth(m => m + 1); };
  const goToday = () => { setViewYear(today.getUTCFullYear()); setViewMonth(today.getUTCMonth()); setSelectedISO(toISODate(today)); };

  const firstOfMonth = new Date(Date.UTC(viewYear, viewMonth, 1));
  const firstWeekday = (firstOfMonth.getUTCDay() + 6) % 7;
  const gridStart    = addDaysUTC(firstOfMonth, -firstWeekday);

  const daysInMonth = new Date(Date.UTC(viewYear, viewMonth + 1, 0)).getUTCDate();
  const lastOfMonth = new Date(Date.UTC(viewYear, viewMonth, daysInMonth));
  const lastWeekday = (lastOfMonth.getUTCDay() + 6) % 7;
  const gridEnd      = addDaysUTC(lastOfMonth, 6 - lastWeekday);

  const totalDays = Math.round((gridEnd - gridStart) / 86400000) + 1;
  const cells = Array.from({ length: totalDays }, (_, i) => addDaysUTC(gridStart, i));

  const isToday = d => toISODate(d) === toISODate(today);
  const isSelected = d => toISODate(d) === selectedISO;

  const selectedDate = parseISODate(selectedISO);
  const agenda = eventsOnDate(selectedDate).sort((a, b) => a.title.localeCompare(b.title));

  return (
    <div className="cal">
      <div className="cal-nav">
        <button className="icon-btn" type="button" onClick={goPrev} aria-label={t('aria_prev_month')}><Icon.arrowLeft width={18} height={18}/></button>
        <div className="cal-label">{monthNames[viewMonth]} <span className="cal-year">{viewYear}</span></div>
        <button className="icon-btn" type="button" onClick={goNext} aria-label={t('aria_next_month')}><Icon.arrowRight width={18} height={18}/></button>
      </div>

      <div className="cal-grid">
        <div className="cal-dow-row">
          {dayNames.map((dn, i) => <div className="cal-dow" key={i}>{dn}</div>)}
        </div>
        <div className="cal-days">
          {cells.map((d, i) => {
            const inMonth = d.getUTCMonth() === viewMonth;
            const evs = eventsOnDate(d);
            const dots = [...new Set(evs.map(e => e.color))].slice(0, 4);
            return (
              <button
                key={i}
                type="button"
                className={`cal-day${inMonth ? '' : ' dim'}${isToday(d) ? ' is-today' : ''}${isSelected(d) ? ' is-selected' : ''}`}
                onClick={() => setSelectedISO(toISODate(d))}
              >
                <span className="cal-day-num">{d.getUTCDate()}</span>
                {dots.length > 0 && (
                  <span className="cal-day-dots">
                    {dots.map((c, j) => <span key={j} className={`dot dot-${c}`} />)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <button className="today-btn" type="button" onClick={goToday}>{t('jump_today')}</button>

      <div className="agenda">
        <div className="agenda-heading">{fmtDayHeading(selectedDate)}</div>
        {agenda.length === 0 ? (
          <p className="agenda-empty">{t('no_events_day')}</p>
        ) : (
          <div className="agenda-list">
            {agenda.map((ev, i) => (
              <div className="agenda-item" key={i}>
                <span className={`dot dot-${ev.color}`} />
                <div className="agenda-text">
                  <div className="agenda-title">{ev.title}</div>
                  <div className="agenda-range">{ev.start} – {ev.end}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* =====================================================================
   CALCULATOR — quick AP / XP planning tool
   ===================================================================== */

function InventoryCalculator({ title, unit, denominations }) {
  const { t } = useT();
  const [counts, setCounts] = useState(() => Object.fromEntries(denominations.map(d => [d, ''])));

  const setCount = (d, v) => {
    if (v !== '' && !/^\d*$/.test(v)) return; // whole items only
    setCounts(c => ({ ...c, [d]: v }));
  };

  const total = denominations.reduce((sum, d) => sum + d * (parseInt(counts[d], 10) || 0), 0);

  return (
    <div className="calc-card">
      <div className="calc-card-top">
        <h3 className="calc-title">{title}</h3>
        <div className="calc-total">
          <span className="calc-total-num">{formatCount(total)}</span>
          <span className="calc-total-unit">{unit}</span>
        </div>
      </div>
      <div className="calc-tiles">
        {denominations.map(d => (
          <div className="calc-tile" key={d}>
            <span className="calc-tile-value">{formatCount(d)}</span>
            <input
              type="text" inputMode="numeric" pattern="[0-9]*"
              className="calc-tile-input"
              value={counts[d]}
              onChange={e => setCount(d, e.target.value)}
              placeholder="0"
              aria-label={t('aria_items_owned').replace('{amount}', formatCount(d)).replace('{unit}', unit)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function CalculatorPanel() {
  const { t } = useT();
  return (
    <div className="calc-wrap">
      <InventoryCalculator title={t('ap_title')} unit="AP" denominations={[50, 100, 500, 1000]} />
      <InventoryCalculator title={t('xp_title')} unit="XP" denominations={[100, 500, 1000, 5000, 10000, 20000, 50000]} />
      <InventoryCalculator title={t('gems_title')} unit="Gems" denominations={[5, 10, 50, 100, 200, 500, 650, 1000, 2000, 10000]} />
<InventoryCalculator title={t('vip_title')} unit="VIP" denominations={[5, 10, 50, 100, 200, 500, 1000, 5000]} />
    </div>
  );
}

/* =====================================================================
   DKP TRACKER — manual KP scan-based DKP tracking
   ===================================================================== */

// Using Firebase Realtime Database (free, 1GB storage)
const DKP_KV_URL = 'https://xtit-dkp-tracker-default-rtdb.firebaseio.com/dkp_snapshots.json';
const DKP_POLL_MS      = 30000;

// (KVK tracking is now controlled per-snapshot by the file type chosen at upload.)

/* =====================================================================
   DKP REQUIRED — TIERED, POWER-SCALED SYSTEM
   ---------------------------------------------------------------------
   The required DKP scales with a governor's power, so higher-power
   players (who have more troops, better gear, and can fight harder)
   are expected to contribute proportionally more.

   Tiers (power ceiling → multiplier):
       0 – 20M   →  ×2.0   (new & low-power players)
      20 – 40M   →  ×2.5
      40 – 60M   →  ×3.0
      60 – 80M   →  ×3.5
      80 – 120M  →  ×4.0
      120M+      →  ×4.5   (top of the kingdom)

   Edit the numbers below to match your kingdom's rule — the DKP bars
   rescale automatically.
   ===================================================================== */
var DKP_POWER_TIERS = [
  { maxPower: 20000000,  multiplier: 2.0 },
  { maxPower: 40000000,  multiplier: 2.5 },
  { maxPower: 60000000,  multiplier: 3.0 },
  { maxPower: 80000000,  multiplier: 3.5 },
  { maxPower: 120000000, multiplier: 4.0 },
  { maxPower: Infinity,  multiplier: 4.5 }
];

function getDkpMultiplier(power) {
  var p = Number(power) || 0;
  for (var i = 0; i < DKP_POWER_TIERS.length; i++) {
    if (p <= DKP_POWER_TIERS[i].maxPower) {
      return DKP_POWER_TIERS[i].multiplier;
    }
  }
  return DKP_POWER_TIERS[DKP_POWER_TIERS.length - 1].multiplier;
}

function computeRequiredDkp(power) {
  var p = Number(power) || 0;
  if (p <= 0) return 0;
  return Math.round(p * getDkpMultiplier(p));
}

// Global Chat — stored in the same Firebase Realtime Database
const CHAT_URL          = 'https://xtit-dkp-tracker-default-rtdb.firebaseio.com/global_chat.json';
const CHAT_META_URL     = 'https://xtit-dkp-tracker-default-rtdb.firebaseio.com/global_chat_meta.json';
const CHAT_POLL_MS      = 3000;
const CHAT_NAME_KEY     = 'xtit_chat_name';
const CHAT_USER_ID_KEY  = 'xtit_chat_user_id';
const CHAT_MAX_MESSAGES = 300;

/* ---------- Exit Feedback Survey (owner sees results in Admin Panel) ---------- */
const FEEDBACK_URL       = 'https://xtit-dkp-tracker-default-rtdb.firebaseio.com/exit_feedback.json';
const FEEDBACK_SHOWN_KEY = 'xtit_feedback_shown_v1';

async function loadFeedbackRemote() {
  try {
    const res = await fetch(FEEDBACK_URL, { cache: 'no-store' });
    if (res.status === 404) return [];
    if (!res.ok) throw new Error('Feedback fetch failed: ' + res.status);
    const data = await res.json();
    if (!data || typeof data !== 'object') return [];
    return Object.entries(data).map(([id, v]) => ({ id, ...(v || {}) }));
  } catch (e) {
    return null;
  }
}

async function submitFeedbackRemote(choice) {
  try {
    const res = await fetch(FEEDBACK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ choice, ts: Date.now() }),
    });
    if (!res.ok) return null;
    // Firebase POST returns the newly-created key as { name: "-Mxyz..." }
    const data = await res.json().catch(() => null);
    return (data && data.name) ? data.name : null;
  } catch (e) {
    return null;
  }
}

// Attach optional free-text feedback to an existing rating record.
async function updateFeedbackText(id, text) {
  if (!id || !text) return false;
  try {
    const base = FEEDBACK_URL.replace(/\.json$/, '');
    const res = await fetch(`${base}/${id}.json`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: String(text).slice(0, 500) }),
    });
    return res.ok;
  } catch (e) {
    return false;
  }
}

function getOrCreateChatUserId() {
  try {
    let id = localStorage.getItem(CHAT_USER_ID_KEY);
    if (!id) {
      id = 'u_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem(CHAT_USER_ID_KEY, id);
    }
    return id;
  } catch (e) {
    return 'u_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
}
// (Removed unused CHAT_RESET_MS — reset window now comes from getNextMondayUTC.)

/* ---------- banned users (owner/admin moderation) ---------- */
const BANNED_NAMES_URL = 'https://xtit-dkp-tracker-default-rtdb.firebaseio.com/chat_banned_names.json';

function toFirebaseKey(str) {
  return String(str).trim().replace(/[.#$\[\]\/]/g, '_').slice(0, 120);
}

const PRESENCE_URL = 'https://xtit-dkp-tracker-default-rtdb.firebaseio.com/chat_presence';
const PRESENCE_PING_MS = 15000; // ping every 15s
const PRESENCE_STALE_MS = 45000; // considered offline after 45s without a ping

async function pingPresence(userId, name) {
  try {
    await fetch(`${PRESENCE_URL}/${userId}.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name || '', ts: Date.now() }),
    });
    return true;
  } catch (e) { return false; }
}

async function loadPresence() {
  try {
    const res = await fetch(`${PRESENCE_URL}.json`, { cache: 'no-store' });
    if (res.status === 404) return {};
    if (!res.ok) throw new Error('Presence fetch failed: ' + res.status);
    const data = await res.json();
    return data && typeof data === 'object' ? data : {};
  } catch (e) { return {}; }
}

function countOnline(presence) {
  if (!presence) return 0;
  const now = Date.now();
  let count = 0;
  Object.values(presence).forEach(p => {
    if (p && typeof p.ts === 'number' && (now - p.ts) < PRESENCE_STALE_MS) count++;
  });
  return count;
}

/* ---------- rate limiting (per-user, server-persisted) ---------- */
const RATE_LIMIT_URL    = 'https://xtit-dkp-tracker-default-rtdb.firebaseio.com/chat_rate_limits';
const TEXT_RATE_MS      = 10000; // 10s between text messages
const IMAGE_RATE_MS     = 60000; // 60s between images

async function loadUserRate(userId) {
  try {
    const res = await fetch(`${RATE_LIMIT_URL}/${userId}.json`, { cache: 'no-store' });
    if (res.status === 404) return { textAt: 0, imageAt: 0 };
    if (!res.ok) throw new Error('rate fetch failed: ' + res.status);
    const data = await res.json();
    if (!data || typeof data !== 'object') return { textAt: 0, imageAt: 0 };
    return {
      textAt:  typeof data.textAt  === 'number' ? data.textAt  : 0,
      imageAt: typeof data.imageAt === 'number' ? data.imageAt : 0,
    };
  } catch (e) {
    // Fail open — never block a user because Firebase hiccuped.
    return { textAt: 0, imageAt: 0 };
  }
}

async function saveUserRate(userId, patch) {
  try {
    // PATCH only touches the given fields — no race with other writes.
    await fetch(`${RATE_LIMIT_URL}/${userId}.json`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    return true;
  } catch (e) {
    return false;
  }
}

/* ---------- typing indicator ---------- */
const TYPING_URL      = 'https://xtit-dkp-tracker-default-rtdb.firebaseio.com/chat_typing';
const TYPING_TTL_MS   = 4000;  // a typing entry is valid for 4s
const TYPING_THROTTLE = 1500;  // send at most one ping every 1.5s while typing

async function pingTyping(userId, name) {
  try {
    await fetch(`${TYPING_URL}/${userId}.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name || '', ts: Date.now() }),
    });
    return true;
  } catch (e) { return false; }
}

async function clearTyping(userId) {
  try {
    await fetch(`${TYPING_URL}/${userId}.json`, {
      method: 'DELETE',
      keepalive: true,
    });
    return true;
  } catch (e) { return false; }
}

async function loadTyping() {
  try {
    const res = await fetch(`${TYPING_URL}.json`, { cache: 'no-store' });
    if (res.status === 404) return {};
    if (!res.ok) throw new Error('Typing fetch failed: ' + res.status);
    const data = await res.json();
    return data && typeof data === 'object' ? data : {};
  } catch (e) { return {}; }
}

// Returns the list of names (excluding myUserId) who are currently typing
// and haven't gone stale.
function getActiveTypers(typingMap, myUserId) {
  if (!typingMap) return [];
  const now = Date.now();
  return Object.entries(typingMap)
    .filter(([id, entry]) =>
      id !== myUserId &&
      entry && typeof entry.ts === 'number' &&
      (now - entry.ts) < TYPING_TTL_MS &&
      typeof entry.name === 'string' && entry.name.trim()
    )
    .map(([, entry]) => entry.name);
}

async function loadBannedNames() {
  try {
    const res = await fetch(BANNED_NAMES_URL, { cache: 'no-store' });
    if (res.status === 404) return {};
    if (!res.ok) throw new Error('Banned names fetch failed: ' + res.status);
    const data = await res.json();
    return data && typeof data === 'object' ? data : {};
  } catch (e) {
    return {};
  }
}

async function banChatName(name) {
  try {
    const key = toFirebaseKey(name);
    const res = await fetch(`https://xtit-dkp-tracker-default-rtdb.firebaseio.com/chat_banned_names/${key}.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(true),
    });
    return res.ok;
  } catch (e) {
    console.error('Ban error:', e);
    return false;
  }
}

async function unbanChatName(name) {
  try {
    const key = toFirebaseKey(name);
    const res = await fetch(`https://xtit-dkp-tracker-default-rtdb.firebaseio.com/chat_banned_names/${key}.json`, {
      method: 'DELETE',
    });
    return res.ok;
  } catch (e) {
    console.error('Unban error:', e);
    return false;
  }
}

/* ---------- chat translation ---------- */
const CHAT_TRANSLATE_LANG_KEY = 'xtit_chat_translate_lang';

const CHAT_LANGUAGES = [
  { code:'en',    label:'English' },
  { code:'tr',    label:'Türkçe' },
  { code:'vi',    label:'Tiếng Việt' },
  { code:'ko',    label:'한국어' },
  { code:'ja',    label:'日本語' },
  { code:'id',    label:'Bahasa Indonesia' },
  { code:'ms',    label:'Bahasa Melayu' },
  { code:'ar',    label:'العربية' },
  { code:'ru',    label:'Русский' },
  { code:'uk',    label:'Українська' },
  { code:'pt',    label:'Português' },
  { code:'es',    label:'Español' },
  { code:'fr',    label:'Français' },
  { code:'de',    label:'Deutsch' },
  { code:'it',    label:'Italiano' },
  { code:'pl',    label:'Polski' },
  { code:'nl',    label:'Nederlands' },
  { code:'sv',    label:'Svenska' },
  { code:'no',    label:'Norsk' },
  { code:'da',    label:'Dansk' },
  { code:'fi',    label:'Suomi' },
  { code:'cs',    label:'Čeština' },
  { code:'sk',    label:'Slovenčina' },
  { code:'ro',    label:'Română' },
  { code:'hu',    label:'Magyar' },
  { code:'bg',    label:'Български' },
  { code:'el',    label:'Ελληνικά' },
  { code:'he',    label:'עברית' },
  { code:'fa',    label:'فارسی' },
  { code:'hi',    label:'हिन्दी' },
  { code:'bn',    label:'বাংলা' },
  { code:'ur',    label:'اردو' },
  { code:'th',    label:'ไทย' },
  { code:'zh-CN', label:'中文（简体）' },
  { code:'zh-TW', label:'中文（繁體）' },
];

// Free, key-less translation endpoints (the same ones Google's own web
// translate widget uses). sl=auto lets it auto-detect the source language.
// Mobile carriers/browsers sometimes block or time out on one specific
// Google host, so we try a short list of equivalent mirrors in order and
// fall back automatically instead of failing outright.
const TRANSLATE_ENDPOINTS = [
  'https://translate.googleapis.com/translate_a/single',
  'https://translate.google.com/translate_a/single',
];

function buildTranslateUrl(base, text, targetLang) {
  const params = `client=gtx&sl=auto&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(text)}`;
  return `${base}?${params}`;
}

async function fetchWithTimeout(url, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { signal: controller.signal, cache: 'no-store' });
  } finally {
    clearTimeout(timer);
  }
}

// translate_a/single splits long or multi-sentence text into several
// segments — join ALL of them, in order. Grabbing only the first
// segment (the old bug) is what produced garbled one/two-letter output.
function parseGoogleTranslateResponse(data) {
  if (!Array.isArray(data) || !Array.isArray(data[0])) return '';
  return data[0]
    .filter(seg => Array.isArray(seg) && typeof seg[0] === 'string')
    .map(seg => seg[0])
    .join('');
}

async function translateViaGoogle(text, targetLang) {
  let lastError = null;
  for (const endpoint of TRANSLATE_ENDPOINTS) {
    // Give each mirror two quick attempts before moving on — a single
    // dropped mobile-network request shouldn't sink the whole endpoint.
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const url = buildTranslateUrl(endpoint, text, targetLang);
        const res = await fetchWithTimeout(url, 7000);
        if (!res.ok) throw new Error('Translate request failed: ' + res.status);
        const data = await res.json();
        const translated = parseGoogleTranslateResponse(data);
        const detectedLang = data?.[2] || null;
        if (!translated || !translated.trim()) throw new Error('Empty translation');
        return { translated, detectedLang };
      } catch (e) {
        lastError = e;
      }
    }
  }
  throw lastError || new Error('Google translation failed');
}

// Free, key-less fallback used only if every Google mirror fails
// (e.g. a mobile carrier is blocking Google's translate endpoints).
async function translateViaMyMemory(text, targetLang) {
  const langPair = `autodetect|${targetLang}`;
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(langPair)}`;
  const res = await fetchWithTimeout(url, 8000);
  if (!res.ok) throw new Error('MyMemory request failed: ' + res.status);
  const data = await res.json();
  const translated = data?.responseData?.translatedText;
  if (!translated || !translated.trim()) throw new Error('Empty MyMemory translation');
  return { translated, detectedLang: null };
}

async function translateChatText(text, targetLang) {
  try {
    return await translateViaGoogle(text, targetLang);
  } catch (e) {
    return await translateViaMyMemory(text, targetLang);
  }
}

async function loadDkpStateRemote() {
  try {
    const res = await fetch(DKP_KV_URL, { cache: 'no-store' });
    if (res.status === 404) return { snapshots: {}, meta: {} };
    if (!res.ok) throw new Error('DKP fetch failed: ' + res.status);
    const parsed = await res.json();
    if (!parsed || typeof parsed.snapshots !== 'object') return { snapshots: {}, meta: {} };
    if (typeof parsed.meta !== 'object' || !parsed.meta) parsed.meta = {};
    return parsed;
  } catch (e) {
    return null;
  }
}
async function saveDkpStateRemote(state) {
  try {
    const res = await fetch(DKP_KV_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state),
    });
    if (!res.ok) {
      console.error('DKP save failed:', res.status, await res.text().catch(() => ''));
      return false;
    }
    return true;
  } catch (e) {
    console.error('DKP save error:', e);
    return false;
  }
}

/* ---------- chat profanity filter ---------- */
const BANNED_WORDS = [
  'fuck','fucking','fucker','fuk','fck','shit','shyt','bitch','bastard',
  'asshole','ass','dick','pussy','cock','cunt','whore','slut',
  'nigger','nigga','faggot','fag','retard','retarded',
  'rape','rapist','porn','pornhub','xxx','blowjob','handjob',
  'cum','jizz','dildo','anal','boobs','tits','nsfw','hentai',
  'nude','nudes','sex','horny','molest','pedo','pedophile','kys'
];

const LEET_MAP = { '0':'o', '1':'i', '3':'e', '4':'a', '5':'s', '7':'t', '@':'a', '$':'s', '!':'i' };

function normalizeToken(token) {
  return token
    .toLowerCase()
    .split('')
    .map(ch => LEET_MAP[ch] || ch)
    .join('')
    .replace(/[^a-z]/g, '');
}

function containsBannedWord(text) {
  const tokens = text.split(/\s+/).filter(Boolean).map(normalizeToken).filter(Boolean);
  if (tokens.some(t => BANNED_WORDS.includes(t))) return true;
  if (tokens.some(t => BANNED_WORDS.some(w => w.length >= 4 && t.includes(w)))) return true;
  const merged = tokens.join('');
  if (BANNED_WORDS.some(w => w.length >= 4 && merged.includes(w))) return true;
  return false;
}

/* ---------- global chat storage (Firebase Realtime Database) ---------- */
async function loadChatMessages() {
  try {
    const res = await fetch(`${CHAT_URL}?orderBy=%22%24key%22&limitToLast=${CHAT_MAX_MESSAGES}`, { cache: 'no-store' });
    if (res.status === 404) return [];
    if (!res.ok) throw new Error('Chat fetch failed: ' + res.status);
    const data = await res.json();
    if (!data || typeof data !== 'object') return [];
    return Object.entries(data)
      .map(([id, msg]) => ({ id, ...msg }))
      .sort((a, b) => a.ts - b.ts);
  } catch (e) {
    return null;
  }
}

async function sendChatMessage(name, text, extra = {}) {
  const message = { name, text, ts: Date.now(), ...extra };
  try {
    const res = await fetch(CHAT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    });
    return res.ok;
  } catch (e) {
    console.error('Chat send error:', e);
    return false;
  }
}

const IMGBB_KEY = '3de1ec56ff42a451ae0357ab764c2020';

async function uploadImageToImgBB(file) {
  const formData = new FormData();
  formData.append('image', file);
  const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`, {
    method: 'POST',
    body: formData,
  });
  const data = await res.json();
  if (!data.success || !data.data || !data.data.url) {
    throw new Error('Upload failed');
  }
  return data.data.url;
}

async function deleteChatMessage(id) {
  try {
    const res = await fetch(`https://xtit-dkp-tracker-default-rtdb.firebaseio.com/global_chat/${id}.json`, {
      method: 'DELETE',
    });
    return res.ok;
  } catch (e) {
    console.error('Chat delete error:', e);
    return false;
  }
}

/* ---------- message reactions (RoK icons, per-message) ---------- */
const REACTION_ICONS = ['sword', 'shield', 'crown', 'fire', 'heart', 'star'];

async function setMessageReactions(messageId, reactions) {
  try {
    const res = await fetch(`https://xtit-dkp-tracker-default-rtdb.firebaseio.com/global_chat/${messageId}/reactions.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reactions),
    });
    return res.ok;
  } catch (e) {
    console.error('Reaction save error:', e);
    return false;
  }
}

/* ---------- global chat 24h auto-reset (server-side timer, not per-browser) ---------- */
async function loadChatMeta() {
  try {
    const res = await fetch(CHAT_META_URL, { cache: 'no-store' });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error('Chat meta fetch failed: ' + res.status);
    const data = await res.json();
    return data && data.resetAt ? data : null;
  } catch (e) {
    return undefined; // network error, NOT "no meta"
  }
}

async function saveChatMeta(meta) {
  try {
    const res = await fetch(CHAT_META_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(meta),
    });
    return res.ok;
  } catch (e) {
    console.error('Chat meta save error:', e);
    return false;
  }
}

async function clearAllChatMessages() {
  try {
    const res = await fetch(CHAT_URL, { method: 'DELETE' });
    return res.ok;
  } catch (e) {
    console.error('Chat clear error:', e);
    return false;
  }
}

// Reads the shared reset timestamp from Firebase. If it's missing or has
// expired, wipes the chat and starts a fresh 24h window. Any visitor's
// browser can trigger this check, so the reset fires automatically without
// the owner doing anything, and it's anchored to the stored timestamp
// rather than any single user's session.
async function ensureChatResetWindow() {
  const nextMonday = getNextMondayUTC();
  const meta = await loadChatMeta();
  if (meta === undefined) return null; // never wipe on a failed read
  // Only trust the stored timestamp if it EXACTLY matches the current
  // next-Monday-00:00-UTC boundary. Anything else (e.g. a leftover 24h
  // rolling value from a previous version) is treated as stale, so the
  // chat is wiped immediately and re-anchored to Monday.
  if (meta && meta.resetAt === nextMonday) {
    return nextMonday;
  }
  await clearAllChatMessages();
  await saveChatMeta({ resetAt: nextMonday });
  return nextMonday;
}

function formatTimeLeft(ms) {
  if (ms <= 0) return '0m';
  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

// Returns the epoch ms of the next Monday at 00:00:00 UTC (Rise of Kingdoms weekly reset).
function getNextMondayUTC() {
  const d = new Date();
  const day = d.getUTCDay();               // 0 = Sunday, 1 = Monday, ...
  const daysUntil = day === 1 ? 7 : (8 - day) % 7;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + daysUntil, 0, 0, 0, 0);
}

/* =====================================================================
   SMART TIMESTAMP — "just now", "5m ago", "18:04", "Yesterday 22:11",
   "Mon 09:33", "Sep 12" — auto-formats based on how long ago the
   message was sent. Falls back gracefully on very old messages.
   ===================================================================== */
function fmtMsgTime(ts, nowOverride) {
  const now = nowOverride || Date.now();
  const diff = now - ts;
  const d = new Date(ts);
  const nd = new Date(now);

  if (diff < 0) return 'just now';

  // Under 60s → "just now"
  if (diff < 60_000) return 'just now';

  // Under 60min → "12m ago"
  if (diff < 3_600_000) {
    const m = Math.floor(diff / 60_000);
    return `${m}m ago`;
  }

  const sameDay = d.getFullYear() === nd.getFullYear()
    && d.getMonth()    === nd.getMonth()
    && d.getDate()     === nd.getDate();

  const timeStr = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(d);

  // Earlier today → "18:04"
  if (sameDay) return timeStr;

  // Yesterday → "Yesterday 22:11"
  const y = new Date(nd); y.setDate(y.getDate() - 1);
  const isYesterday = d.getFullYear() === y.getFullYear()
    && d.getMonth()    === y.getMonth()
    && d.getDate()     === y.getDate();
  if (isYesterday) return `Yesterday ${timeStr}`;

  // Within the last 7 days → "Mon 09:33"
  const daysAgo = Math.floor(diff / 86_400_000);
  if (daysAgo < 7) {
    const wd = new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(d);
    return `${wd} ${timeStr}`;
  }

  // Older than a week → "Sep 12" (or "Sep 12, 2024" if a different year)
  if (d.getFullYear() !== nd.getFullYear()) {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    }).format(d);
  }
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(d);
}

/* ---------- governor file parsing ---------- */
const COLUMN_ALIASES = {
  id:        ['character id', 'governor id', 'id'],
  username:  ['username', 'name', 'governor name'],
  power:     ['power'],
  highest:   ['highest power'],
  kp:        ['total kill points', 'kill points', 'kp'],
  resources: ['resources gathered', 'resources'],
  t5k:       ['t5 kills', 'tier 5 kills'],
  t4k:       ['t4 kills', 'tier 4 kills'],
  t3k:       ['t3 kills', 'tier 3 kills'],
  t2k:       ['t2 kills', 'tier 2 kills'],
  t1k:       ['t1 kills', 'tier 1 kills'],
  t5d:       ['t5 deaths', 'tier 5 deaths'],
  t4d:       ['t4 deaths', 'tier 4 deaths'],
  t3d:       ['t3 deaths', 'tier 3 deaths'],
  t2d:       ['t2 deaths', 'tier 2 deaths'],
  t1d:       ['t1 deaths', 'tier 1 deaths'],
};

function normalizeHeader(h) {
  return String(h || '')
    .trim()
    .toLowerCase()
    .replace(/[_\-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function findColumnIndex(headerRow, aliases) {
  const norm = headerRow.map(normalizeHeader);
  // 1) exact match
  for (const alias of aliases) {
    const idx = norm.indexOf(alias);
    if (idx !== -1) return idx;
  }
  // 2) fallback: substring match, handles headers like "Total Kill Points (KP)"
  for (const alias of aliases) {
    const idx = norm.findIndex(h => h.includes(alias));
    if (idx !== -1) return idx;
  }
  return -1;
}

async function parseGovernorFile(file) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  if (!rows.length) throw new Error('File is empty');

  const header = rows[0];
  const col = {
    id:        findColumnIndex(header, COLUMN_ALIASES.id),
    username:  findColumnIndex(header, COLUMN_ALIASES.username),
    power:     findColumnIndex(header, COLUMN_ALIASES.power),
    highest:   findColumnIndex(header, COLUMN_ALIASES.highest),
    kp:        findColumnIndex(header, COLUMN_ALIASES.kp),
    resources: findColumnIndex(header, COLUMN_ALIASES.resources),
    t5k:       findColumnIndex(header, COLUMN_ALIASES.t5k),
    t4k:       findColumnIndex(header, COLUMN_ALIASES.t4k),
    t3k:       findColumnIndex(header, COLUMN_ALIASES.t3k),
    t2k:       findColumnIndex(header, COLUMN_ALIASES.t2k),
    t1k:       findColumnIndex(header, COLUMN_ALIASES.t1k),
    t5d:       findColumnIndex(header, COLUMN_ALIASES.t5d),
    t4d:       findColumnIndex(header, COLUMN_ALIASES.t4d),
    t3d:       findColumnIndex(header, COLUMN_ALIASES.t3d),
    t2d:       findColumnIndex(header, COLUMN_ALIASES.t2d),
    t1d:       findColumnIndex(header, COLUMN_ALIASES.t1d),
  };
  if (col.id === -1 || col.username === -1) {
    throw new Error('Could not find Character ID / Username columns in this file');
  }

  const CRITICAL_COLUMNS = ['power', 'kp'];
  const allMissing = Object.entries(col)
    .filter(([key, idx]) => idx === -1 && key !== 'id' && key !== 'username')
    .map(([key]) => key);
  const missingCritical = allMissing.filter(k => CRITICAL_COLUMNS.includes(k));
  const missingOptional = allMissing.filter(k => !CRITICAL_COLUMNS.includes(k));

  const deathCols = ['t1d', 't2d', 't3d', 't4d', 't5d'];
  const hasDeathData = deathCols.some(k => col[k] !== -1);

  const toNum = v => { const n = parseInt(String(v).replace(/[^\d-]/g, ''), 10); return Number.isFinite(n) ? n : 0; };

  const governors = {};
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r[col.id] === '' || r[col.id] === undefined) continue;
    const id = String(r[col.id]).trim();
    governors[id] = {
      id,
      username:  String(r[col.username] ?? '').trim(),
      power:     col.power     !== -1 ? toNum(r[col.power])     : 0,
      highest:   col.highest   !== -1 ? toNum(r[col.highest])   : 0,
      kp:        col.kp        !== -1 ? toNum(r[col.kp])        : 0,
      resources: col.resources !== -1 ? toNum(r[col.resources]) : 0,
      t5k:       col.t5k       !== -1 ? toNum(r[col.t5k])       : 0,
      t4k:       col.t4k       !== -1 ? toNum(r[col.t4k])       : 0,
      t3k:       col.t3k       !== -1 ? toNum(r[col.t3k])       : 0,
      t2k:       col.t2k       !== -1 ? toNum(r[col.t2k])       : 0,
      t1k:       col.t1k       !== -1 ? toNum(r[col.t1k])       : 0,
      t5d:       col.t5d       !== -1 ? toNum(r[col.t5d])       : 0,
      t4d:       col.t4d       !== -1 ? toNum(r[col.t4d])       : 0,
      t3d:       col.t3d       !== -1 ? toNum(r[col.t3d])       : 0,
      t2d:       col.t2d       !== -1 ? toNum(r[col.t2d])       : 0,
      t1d:       col.t1d       !== -1 ? toNum(r[col.t1d])       : 0,
    };
  }
  if (Object.keys(governors).length === 0) throw new Error('No governor rows found in this file');
  return { governors, missingCritical, missingOptional, hasDeathData };
}

/* ---------- owner-only scan control ---------- */
const OWNER_PASSWORD    = 'XTiT333'; // <-- change this to whatever you want
const OWNER_SESSION_KEY = 'xtit_dkp_owner_unlocked_v2';

/* ---------- Barbarian Fort — separate password --------------------
   Independent from the main owner login so trusted officers can add
   fort data without getting access to any other owner tool. */
const FORT_OWNER_PASSWORD    = '2837';
const FORT_OWNER_SESSION_KEY = 'xtit_fort_owner_unlocked';

function isOwnerUnlocked() {
  try { return sessionStorage.getItem(OWNER_SESSION_KEY) === '1'; } catch (e) { return false; }
}

/* =====================================================================
   OWNER CONTEXT — single source of truth for admin/owner state, shared
   by every panel (DKP, Chat, etc). Log in once per session anywhere and
   every panel picks it up immediately. Highest-permission account.
   ===================================================================== */

const OwnerContext = React.createContext({
  isOwner: false,
  requireOwnerLogin: async () => false,
  logout: () => {},
});
function useOwner() { return useContext(OwnerContext); }

function OwnerProvider({ children }) {
  const { t } = useT();
  const [isOwner, setIsOwner] = useState(() => isOwnerUnlocked());
  const [prompt, setPrompt]   = useState(null);
  const [pwValue, setPwValue] = useState('');

  const requireOwnerLogin = () => {
    if (isOwnerUnlocked()) { setIsOwner(true); return Promise.resolve(true); }
    return new Promise((resolve) => {
      setPwValue('');
      setPrompt({
        error: null,
        onConfirm: (entered) => {
          if (entered === OWNER_PASSWORD) {
            try { sessionStorage.setItem(OWNER_SESSION_KEY, '1'); } catch (e) {}
            setIsOwner(true);
            setPrompt(null);
            resolve(true);
          } else {
            setPrompt(prev => ({ ...prev, error: t('err_incorrect_password') }));
          }
        },
        onCancel: () => { setPrompt(null); resolve(false); },
      });
    });
  };

  const logout = () => {
    try { sessionStorage.removeItem(OWNER_SESSION_KEY); } catch (e) {}
    setIsOwner(false);
  };

  return (
    <OwnerContext.Provider value={{ isOwner, requireOwnerLogin, logout }}>
      {children}
      {prompt && (
        <div className="modal-overlay" onClick={() => prompt.onCancel()}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{t('owner_login')}</h3>
              <button className="modal-x" onClick={() => prompt.onCancel()}><Icon.close width={16} height={16}/></button>
            </div>
            <div className="modal-body">
              <p className="modal-prompt">{t('owner_login_prompt')}</p>
              <input
                type="password"
                className="modal-input"
                value={pwValue}
                onChange={e => setPwValue(e.target.value)}
                placeholder={t('password_placeholder')}
                autoFocus
                onKeyDown={e => { if (e.key === 'Enter') prompt.onConfirm(pwValue); }}
              />
              {prompt.error && (
                <p style={{ color: 'var(--danger)', fontSize: '0.8rem', margin: '0 0 10px 0' }}>{prompt.error}</p>
              )}
              <div className="modal-actions">
                <button className="btn-secondary" onClick={() => prompt.onCancel()}>{t('cancel_btn')}</button>
                <button className="btn-primary" onClick={() => prompt.onConfirm(pwValue)}>{t('login_btn')}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </OwnerContext.Provider>
  );
}

function DkpPanel() {
  const { t } = useT();
  const { isOwner, requireOwnerLogin } = useOwner();
  const [state, setState]             = useState({ snapshots: {}, meta: {} });
  const [uploadType, setUploadType]   = useState('normal'); // 'normal' | 'kvk'
  const [uploadDate, setUploadDate]   = useState(() => toISODate(new Date()));
  const [uploading, setUploading]   = useState(false);
  const [uploadMsg, setUploadMsg]   = useState(null);
  const [fromDate, setFromDate]     = useState('');
  const [toDate, setToDate]         = useState('');
  const [sortKey, setSortKey]       = useState('kpGained');
  const [sortDir, setSortDir]       = useState('desc');
  const [search, setSearch]         = useState('');
  const [visibleCols, setVisibleCols] = useState({
    power: true, kp: true, deaths: true,
    powerGained: true, kpGained: true, deathsGained: true,
    dkpProgress: true
  });
  const fileInputRef = useRef(null);
  const [confirmPrompt, setConfirmPrompt] = useState(null);
  const [selectedGovernor, setSelectedGovernor] = useState(null);

  const COL_LABELS = {
    power: t('col_power'), kp: t('col_kp'), deaths: t('col_dead'),
    powerGained: t('col_power_gained'), kpGained: t('col_kp_gained'), deathsGained: t('col_dead_gained'),
    dkpProgress: t('col_dkp_progress')
  };

  const getGridTemplate = () => {
    let cols = '36px minmax(120px, 1fr)'; // # and Governor
    if (visibleCols.power) cols += ' minmax(90px, auto)';
    if (visibleCols.kp) cols += ' minmax(90px, auto)';
    if (visibleCols.deaths) cols += ' minmax(90px, auto)';
    if (visibleCols.powerGained) cols += ' minmax(120px, auto)';
    if (visibleCols.kpGained) cols += ' minmax(110px, auto)';
    if (visibleCols.deathsGained) cols += ' minmax(120px, auto)';
    if (visibleCols.dkpProgress) cols += ' minmax(170px, auto)';
    return cols;
  };

  const toggleCol = (key) => {
    setVisibleCols(prev => ({ ...prev, [key]: !prev[key] }));
  };
  const tableScrollRef = useRef(null); // <-- Add this line
  const slideLockRef = useRef(false);
  const slideTable = (dir) => {
    const el = tableScrollRef.current;
    if (!el || slideLockRef.current) return;
    const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
    const target = Math.min(maxScroll, Math.max(0, el.scrollLeft + dir * 200));
    slideLockRef.current = true;
    el.scrollTo({ left: target, behavior: 'smooth' });
    setTimeout(() => { slideLockRef.current = false; }, 260);
  };

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDir(d => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  // load the shared snapshot data on mount, then keep polling so every
  // visitor sees new uploads without refreshing
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const remote = await loadDkpStateRemote();
      if (!cancelled && remote) {
        setState(remote);
      }
    };
    load();
    const id = setInterval(load, DKP_POLL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const dates = useMemo(() => {
    // Always show all snapshots — the reset only affects DKP progress,
    // not the historical snapshot list.
    return Object.keys(state.snapshots).sort();
  }, [state.snapshots]);

  useEffect(() => {
    if (dates.length === 0) return;

    // Only auto-pick sensible defaults when the user's current choice is
    // missing or no longer exists. Once they've picked a pair, we leave it
    // alone — even as new snapshots arrive from the 30s poll.
    const fromStillValid = fromDate && dates.includes(fromDate);
    const toStillValid   = toDate   && dates.includes(toDate);

    if (fromStillValid && toStillValid) return;

    if (dates.length === 1) {
      setFromDate(dates[0]);
      setToDate(dates[0]);
    } else {
      if (!fromStillValid) setFromDate(dates[dates.length - 2]);
      if (!toStillValid)   setToDate(dates[dates.length - 1]);
    }
  }, [dates, fromDate, toDate]); // eslint-disable-line react-hooks/exhaustive-deps

  const triggerUpload = async () => {
    if (!isOwner) {
      const authenticated = await requireOwnerLogin();
      if (!authenticated) return;
    }
if (fileInputRef.current) fileInputRef.current.click();
  };

  const onFileChosen = async e => {
const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (!uploadDate) { setUploadMsg({ type: 'error', text: t('msg_pick_date') }); return; }
    setUploading(true);
    setUploadMsg(null);
    try {
      const { governors, missingCritical, missingOptional, hasDeathData } = await parseGovernorFile(file);
      const fresh = await loadDkpStateRemote();
      if (!fresh) throw new Error('Could not reach the database. Nothing was changed, try again.');
      const nextMeta = { ...(fresh.meta || {}), [uploadDate]: { hasDeathData, isKvkStats: uploadType === 'kvk' } };
      const nextState = { snapshots: { ...fresh.snapshots, [uploadDate]: governors }, meta: nextMeta };
      setState(nextState);
      // Auto-select the new upload as "To" (and the previous snapshot as "From")
      const sortedDates = Object.keys(nextState.snapshots).sort();
      const idx = sortedDates.indexOf(uploadDate);
      setToDate(uploadDate);
      setFromDate(idx > 0 ? sortedDates[idx - 1] : uploadDate);
      const saved = await saveDkpStateRemote(nextState);
      const missingNote = missingOptional.length
        ? t('msg_missing_optional').replace('{cols}', missingOptional.join(', '))
        : '';
      const criticalNote = missingCritical.length
        ? t('msg_missing_critical').replace('{cols}', missingCritical.join(', '))
        : '';
      const loadedText = t('msg_loaded_governors')
        .replace('{count}', formatCount(Object.keys(governors).length))
        .replace('{date}', uploadDate);
      setUploadMsg(saved
        ? { type: missingCritical.length ? 'error' : 'success', text: `${loadedText}${criticalNote}${missingNote}` }
        : { type: 'error', text: t('msg_save_failed') });
    } catch (err) {
      setUploadMsg({ type: 'error', text: err.message || t('msg_could_not_read') });
    } finally {
      setUploading(false);
    }
  };

  const removeSnapshot = (date) => {
    setConfirmPrompt({
      message: t('confirm_remove_snapshot').replace('{date}', date),
      onConfirm: async () => {
        const fresh = await loadDkpStateRemote();
        if (!fresh) { setConfirmPrompt(null); return; }
        const nextSnapshots = { ...fresh.snapshots };
        delete nextSnapshots[date];
        const nextMeta = { ...(fresh.meta || {}) };
        delete nextMeta[date];
        const nextState = { snapshots: nextSnapshots, meta: nextMeta };
        setState(nextState);
        await saveDkpStateRemote(nextState);
        setConfirmPrompt(null);
      },
      onCancel: () => setConfirmPrompt(null)
    });
  };

  const [visibleCount, setVisibleCount] = useState(50);

  useEffect(() => {
    setVisibleCount(50);
  }, [fromDate, toDate, sortKey, search]);

  const snapListRef = useCallback((el) => {
    if (el) el.scrollTop = el.scrollHeight;
  }, [dates.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const fromSnap = state.snapshots[fromDate] || {};
  const toSnap   = state.snapshots[toDate]   || {};

  const fromHasDeaths = !!(state.meta && state.meta[fromDate] && state.meta[fromDate].hasDeathData);
  const toHasDeaths   = !!(state.meta && state.meta[toDate]   && state.meta[toDate].hasDeathData);
  const deathTotalAvailable  = toHasDeaths;
  const deathGainedAvailable = fromHasDeaths && toHasDeaths;
  // DKP progress only counts when BOTH the "From" AND "To" snapshots were
  // uploaded as KVK stats files. If EITHER side is a normal file, progress is 0%.
  const fromIsKvk = !!(state.meta && state.meta[fromDate] && state.meta[fromDate].isKvkStats);
  const toIsKvk   = !!(state.meta && state.meta[toDate]   && state.meta[toDate].isKvkStats);
  const isKvkActive = fromIsKvk && toIsKvk;

  const rows = useMemo(() => {
    const ids = new Set([...Object.keys(fromSnap), ...Object.keys(toSnap)]);
    const out = [];
    ids.forEach(id => {
      const a = fromSnap[id];
      const b = toSnap[id];
      const cur = b || a;
      if (!cur) return;
      const bothPresent = !!a && !!b;
      
      // Use the HIGHEST power between the two snapshots.
      // This ensures the DKP requirement automatically scales UP
      // when the governor's power increases in future uploads.
      const powerA = a ? a.power : 0;
      const powerB = b ? b.power : 0;
      const currentPower = Math.max(powerA, powerB);
      
      const kpGained = bothPresent ? (b.kp - a.kp) : null;

      /* -------------------------------------------------------------
         KVK DKP CALCULATION — ENEMY KINGDOMS ONLY
         -------------------------------------------------------------
         A governor earns DKP progress ONLY from kills against OTHER
         kingdoms. Kills against their own kingdom NEVER count.

         Rise of Kingdoms only awards kill points for killing troops
         of other kingdoms — you cannot gain KP by attacking your own
         kingdom. So the delta of the `kp` column between two
         snapshots IS ALREADY the enemy-only value. Nothing needs to
         be subtracted here in normal operation.

         `friendlyKillsGained` is a placeholder for the future — if
         your stat export ever includes a dedicated "Friendly KP" or
         "Own-Kingdom KP" column, plug it in there and it will be
         subtracted automatically (because KVK_FRIENDLY_KILLS_COUNT
         is false by default).
         ------------------------------------------------------------- */
      /* -------------------------------------------------------------
         KVK DKP CALCULATION — ENEMY KINGDOMS ONLY
         -------------------------------------------------------------
         1. Rise of Kingdoms only exports TOTAL Kill Points — it does
            not separate enemy-kingdom KP from own-kingdom KP.
         2. Therefore, the ONLY reliable way to isolate enemy-kingdom
            kills is to require that BOTH snapshots fall inside the
            KVK window.
         3. If the snapshots are outside that window (e.g. two pre-KVK
            farming days), no KP is counted — the progress stays at 0.
         ------------------------------------------------------------- */
      /* =================================================================
         OWNER-CONTROLLED KVK DKP
         -----------------------------------------------------------------
         The owner flips a single ON/OFF switch (stored in Firebase at
         dkp_kvk_enabled.json). When it's ON, every kill and every death
         between the two snapshots counts toward DKP — no filtering by
         who was fought, no window check. When it's OFF, DKP is 0%.
         ================================================================= */
      /* =================================================================
         DKP PROGRESS — ONLY KP GAINED + DEATHS GAINED
         -----------------------------------------------------------------
         A governor's DKP progress is ONLY:
             (KP gained between the two snapshots)
           + (deaths gained between the two snapshots)

         • Only POSITIVE gains count.
         • Only counted when BOTH snapshots are KVK stats files.
         • No power comparison, no percentages, no required targets.
         ================================================================= */
      const isKvkFile = isKvkActive;

      // KP gained — positive values only
      const kpPart = (isKvkFile && kpGained != null && kpGained > 0) ? kpGained : 0;

      // Deaths gained — positive values only, and only when both snapshots
      // actually carried death columns.
      let deathsPart = 0;
      if (isKvkFile && bothPresent && deathGainedAvailable) {
        const deathsDelta =
          (b.t1d - a.t1d) + (b.t2d - a.t2d) + (b.t3d - a.t3d) +
          (b.t4d - a.t4d) + (b.t5d - a.t5d);
        if (deathsDelta > 0) deathsPart = deathsDelta;
      }

      // DKP earned = KP gained + deaths gained. That's it.
      const dkpEarned = kpPart + deathsPart;

      // How much DKP this governor NEEDS = current power × multiplier.
      // Higher power → higher target.
      const dkpRequired = isKvkFile ? computeRequiredDkp(currentPower) : 0;

      // Progress = earned / required, capped at 100% for the bar.
      const dkpProgressPct = dkpRequired > 0
        ? Math.min(100, (dkpEarned / dkpRequired) * 100)
        : 0;

      out.push({
        id,
        username: cur.username,
        power: currentPower,
        powerGained: bothPresent ? (b.power - a.power) : null,
        kp: b ? b.kp : (a ? a.kp : 0),
        kpGained,
        resourcesGained: bothPresent ? (b.resources - a.resources) : null,
        deaths: deathTotalAvailable ? ((cur.t1d || 0) + (cur.t2d || 0) + (cur.t3d || 0) + (cur.t4d || 0) + (cur.t5d || 0)) : null,
        deathsGained: (bothPresent && deathGainedAvailable)
          ? ((b.t1d - a.t1d) + (b.t2d - a.t2d) + (b.t3d - a.t3d) + (b.t4d - a.t4d) + (b.t5d - a.t5d))
          : null,
        dkpEarned,
        dkpRequired,
        dkpProgressPct,
        isKvkFile,      // handy for debugging / future use
        inFrom: !!a,
        inTo: !!b,
      });
    });
    const q = search.trim().toLowerCase();
    const filtered = q ? out.filter(r => r.username.toLowerCase().includes(q) || r.id.includes(q)) : out;
    const dir = sortDir === 'asc' ? -1 : 1;
    return filtered.sort((x, y) => {
      const xvRaw = x[sortKey];
      const yvRaw = y[sortKey];
      const xv = (xvRaw === null || xvRaw === undefined) ? -Infinity : xvRaw;
      const yv = (yvRaw === null || yvRaw === undefined) ? -Infinity : yvRaw;
      if (xv === yv) return 0;
      return (yv > xv ? 1 : -1) * dir;
    });
  }, [fromSnap, toSnap, search, sortKey, sortDir, deathTotalAvailable, deathGainedAvailable, isKvkActive]);

  const visibleRows = useMemo(() => rows.slice(0, visibleCount), [rows, visibleCount]);

  const summary = useMemo(() => {
    if (rows.length === 0) return null;
    const active = rows.filter(r => r.inFrom && r.inTo);
    const totalKpGained = rows.reduce((s, r) => s + (r.kpGained || 0), 0);
    const totalPowerGained = rows.reduce((s, r) => s + (r.powerGained || 0), 0);
    const totalDeadGained = deathGainedAvailable
      ? rows.reduce((s, r) => s + (r.deathsGained || 0), 0)
      : null;
    const inactiveCount = active.filter(r => (r.kpGained || 0) === 0 && (r.powerGained || 0) <= 0).length;
    return {
      totalGovernors: rows.length,
      activeCount: active.length,
      totalKpGained,
      totalPowerGained,
      totalDeadGained,
      inactiveCount,
    };
  }, [rows, deathGainedAvailable]);

  const topPerformer = useMemo(() => {
    if (rows.length === 0) return null;

    // Only governors present in both snapshots qualify for "gained" categories.
    const isGained = sortKey === 'kpGained' || sortKey === 'powerGained' || sortKey === 'deathsGained';
    const pool = isGained ? rows.filter(r => r.inFrom && r.inTo) : rows;

    // Is this category actually available? (deaths may be missing from files)
    if (sortKey === 'deathsGained' && !deathGainedAvailable) return null;
    if (sortKey === 'deaths'       && !deathTotalAvailable)  return null;

    const candidates = pool.filter(r => r[sortKey] !== null && r[sortKey] !== undefined);
    if (candidates.length === 0) return null;

    const top = [...candidates].sort((a, b) => (b[sortKey] || 0) - (a[sortKey] || 0))[0];
    if (!top) return null;

    const labelMap = {
      kpGained:     t('sort_kp_gained'),
      powerGained:  t('sort_power_gained'),
      deathsGained: t('sort_dead_gained'),
      kp:           t('sort_total_kp'),
      power:        t('sort_total_power'),
      deaths:       t('sort_total_dead'),
    };
    const highlightedLabel = labelMap[sortKey] || sortKey;

    // Build the full stat line for this governor, excluding the category
    // that's already shown big at the top.
    const statDefs = [
      { key: 'power',        label: t('sort_total_power'),  signed: false },
      { key: 'kp',           label: t('sort_total_kp'),     signed: false },
      { key: 'deaths',       label: t('sort_total_dead'),   signed: false },
      { key: 'powerGained',  label: t('sort_power_gained'), signed: true  },
      { key: 'kpGained',     label: t('sort_kp_gained'),    signed: true  },
      { key: 'deathsGained', label: t('sort_dead_gained'),  signed: true  },
    ];

    const stats = statDefs
      .filter(d => d.key !== sortKey)                 // already shown big
      .map(d => ({ label: d.label, value: top[d.key], signed: d.signed }))
      .filter(d => d.value !== null && d.value !== undefined);

    return {
      id: top.id,
      name: top.username,
      value: top[sortKey],
      label: highlightedLabel,
      isSigned: isGained,
      stats,
    };
  }, [rows, sortKey, t, deathGainedAvailable, deathTotalAvailable]);

  return (
    <div className="dkp-wrap">
      <div className="dkp-instructions">
        <p><b>{t('dkp_welcome')}</b> {t('dkp_desc1')}</p>
        <p>{t('dkp_desc2')}</p>
        <p>{t('dkp_desc3')}</p>
        
        {!isOwner && (
          <button 
            type="button" 
            onClick={() => requireOwnerLogin()} 
            style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '0.8rem', padding: 0, textDecoration: 'underline', marginTop: '10px', display: 'block' }}
          >
            {t('owner_login')}
          </button>
        )}
      </div>

      {isOwner && (
        <div className="dkp-scan-card">
          <div className="dkp-scan-top"><span className="pill upcoming">{t('owner_only')}</span></div>

          {/* (KVK tracking is now controlled by the file type you pick when uploading.) */}

          <p className="dkp-scan-desc">{t('upload_desc')}</p>
          <div className="dkp-scan-actions" style={{ alignItems: 'center' }}>
            <select
              className="dkp-name-input"
              value={uploadType}
              onChange={e => setUploadType(e.target.value)}
              disabled={uploading}
            >
              <option value="normal">{t('fort_upload_normal_opt')}</option>
              <option value="kvk">{t('fort_upload_kvk_opt')}</option>
            </select>
            <input
              type="date"
              className="dkp-name-input"
              value={uploadDate}
              onChange={e => setUploadDate(e.target.value)}
            />
            <button className="btn-primary" type="button" onClick={triggerUpload} disabled={uploading}>
              {uploading ? t('uploading_btn') : t('upload_btn')}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              style={{ display: 'none' }}
              onChange={onFileChosen}
            />
          </div>
          {uploadMsg && (
            <p className="muted-line" style={{ color: uploadMsg.type === 'error' ? 'var(--danger)' : 'var(--live)', marginTop: 10 }}>
              {uploadMsg.text}
            </p>
          )}
        </div>
      )}

      {dates.length === 0 ? (
        <p className="muted-line">{t('no_snapshots')}</p>
      ) : (
        <>
          {isOwner && (
            <div className="dkp-scan-card">
              <div className="dkp-scan-top" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="pill done">{t('snapshots_label')}</span>
                <span className="muted-line" style={{ margin: 0, fontSize: '0.75rem' }}>{dates.length} {t('total_suffix')}</span>
              </div>
              <div className="dkp-snapshot-list" ref={snapListRef}>
                {dates.map(d => {
                  const snapMeta = (state.meta && state.meta[d]) || {};
                  return (
                  <div key={d} className="dkp-snapshot-item">
                    <span className="dkp-snapshot-date" style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d}</span>
                      <span
                        style={{
                          fontSize: '0.62rem',
                          fontWeight: 700,
                          padding: '1px 7px',
                          borderRadius: '20px',
                          letterSpacing: '0.05em',
                          flexShrink: 0,
                          background: snapMeta.isKvkStats ? 'rgba(63,205,184,0.15)' : 'rgba(154,162,176,0.12)',
                          color:      snapMeta.isKvkStats ? 'var(--live)'     : 'var(--text-faint)',
                          border:     snapMeta.isKvkStats ? '1px solid rgba(63,205,184,0.4)' : '1px solid var(--border-strong)',
                        }}
                      >
                        {snapMeta.isKvkStats ? t('fort_badge_kvk') : t('fort_badge_normal')}
                      </span>
                    </span>
                    <span className="dkp-snapshot-count">{formatCount(Object.keys(state.snapshots[d]).length)} {t('governors_suffix')}</span>
                    <button className="dkp-snapshot-remove" type="button" onClick={() => removeSnapshot(d)} title={t('title_remove').replace('{date}', d)}>
                      <Icon.close width={14} height={14} />
                    </button>
                  </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="dkp-scan-card">
            <div className="dkp-scan-actions" style={{ flexWrap: 'wrap' }}>
              <label className="muted-line" style={{ margin: 0 }}>
                {t('from_label')}{' '}
                <select className="dkp-name-input" style={{ display: 'inline-block', width: 'auto' }} value={fromDate} onChange={e => setFromDate(e.target.value)}>
                  {dates.map(d => {
                    const m = (state.meta && state.meta[d]) || {};
                    return (
                      <option key={d} value={d}>
                        {d} · {m.isKvkStats ? t('fort_badge_kvk') : t('fort_badge_normal')}
                      </option>
                    );
                  })}
                </select>
              </label>
              <label className="muted-line" style={{ margin: 0 }}>
                {t('to_label')}{' '}
                <select className="dkp-name-input" style={{ display: 'inline-block', width: 'auto' }} value={toDate} onChange={e => setToDate(e.target.value)}>
                  {dates.map(d => {
                    const m = (state.meta && state.meta[d]) || {};
                    return (
                      <option key={d} value={d}>
                        {d} · {m.isKvkStats ? t('fort_badge_kvk') : t('fort_badge_normal')}
                      </option>
                    );
                  })}
                </select>
              </label>
              {/* NEW SORT DROPDOWN */}
              <label className="muted-line" style={{ margin: 0 }}>
                {t('sort_label')}{' '}
                <select className="dkp-name-input" style={{ display: 'inline-block', width: 'auto' }} value={sortKey} onChange={e => setSortKey(e.target.value)}>
                  <option value="kpGained">{t('sort_kp_gained')}</option>
                  <option value="powerGained">{t('sort_power_gained')}</option>
                  <option value="deathsGained">{t('sort_dead_gained')}</option>
                  <option value="kp">{t('sort_total_kp')}</option>
                  <option value="power">{t('sort_total_power')}</option>
                  <option value="deaths">{t('sort_total_dead')}</option>
                </select>
              </label>
              {/* END NEW SORT DROPDOWN */}
              <input
                type="text"
                className="dkp-name-input"
                placeholder={t('search_placeholder')}
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>

          {summary && summary.totalGovernors > 0 && (
            <>
              <div className="section-label">{t('dkp_summary_title')}</div>
              <p className="muted-line" style={{ marginTop: -8 }}>{t('dkp_summary_note')}</p>
              <div className="dkp-summary-grid">
                <div className="dkp-summary-card">
                  <span className="dkp-summary-label">{t('activity_players')}</span>
                <span className="dkp-summary-value">{formatCount(summary.totalGovernors)}</span>
                <span className="dkp-summary-sub">
                  {summary.activeCount} / {summary.totalGovernors}
                </span>
              </div>
              <div className="dkp-summary-card dkp-summary-top">
                <span className="dkp-summary-label">{t('sort_kp_gained')}</span>
                <span className="dkp-summary-value accent">
                  +{formatCount(summary.totalKpGained)}
                </span>
              </div>
              <div className="dkp-summary-card">
                <span className="dkp-summary-label">{t('sort_power_gained')}</span>
                <span className="dkp-summary-value">
                  +{formatCount(summary.totalPowerGained)}
                </span>
              </div>
              {summary.totalDeadGained !== null && (
                <div className="dkp-summary-card">
                  <span className="dkp-summary-label">{t('sort_dead_gained')}</span>
                  <span className="dkp-summary-value">
                    {summary.totalDeadGained >= 0 ? '+' : ''}
                    {formatCount(summary.totalDeadGained)}
                  </span>
                </div>
              )}
              </div>
            </>
          )}

          {topPerformer && (
            <>
              <div className="section-label">{t('dkp_top_title')}</div>
              <p className="muted-line" style={{ marginTop: -8 }}>{t('dkp_top_note')}</p>
              <div className="dkp-top-grid">
                <div className="dkp-top-card">
                  <div className="dkp-top-header">
                    <div className="dkp-top-header-main">
                      <span className="dkp-top-label">{topPerformer.label}</span>
                      <span className="dkp-top-name" title={topPerformer.id}>{topPerformer.name}</span>
                    </div>
                    <span className="dkp-top-value">
                      {topPerformer.isSigned && topPerformer.value >= 0 ? '+' : ''}
                      {formatCount(topPerformer.value)}
                    </span>
                  </div>

                  {topPerformer.stats.length > 0 && (
                    <div className="dkp-top-stats">
                      {topPerformer.stats.map((s, i) => (
                        <div className="dkp-top-stat" key={i}>
                          <span className="dkp-top-stat-label">{s.label}</span>
                          <span className={`dkp-top-stat-value${s.signed ? ' accent' : ''}`}>
                            {s.signed && s.value >= 0 ? '+' : ''}{formatCount(s.value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          <div className="dkp-table-nav">
            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="button" onClick={() => slideTable(-1)}>{t('slide_left')}</button>
              <button type="button" onClick={() => slideTable(1)}>{t('slide_right')}</button>
            </div>
            
            <details className="dkp-col-settings">
              <summary>{t('column_settings')}</summary>
              <div className="dkp-col-panel">
                {Object.keys(visibleCols).map(key => (
                  <label key={key} className="dkp-col-toggle">
                    <input type="checkbox" checked={visibleCols[key]} onChange={() => toggleCol(key)} />
                    <span>{COL_LABELS[key]}</span>
                  </label>
                ))}
              </div>
            </details>
          </div>
          <div className="dkp-table-scroll" ref={tableScrollRef}>
            <div className="dkp-table">
              <div className="dkp-table-head" style={{ gridTemplateColumns: getGridTemplate() }}>
                <span>#</span><span>{t('col_governor')}</span>
                {visibleCols.power && <span onClick={() => toggleSort('power')} style={{ cursor: 'pointer' }}>{t('col_power')}{sortKey === 'power' ? (sortDir === 'desc' ? ' ↓' : ' ↑') : ''}</span>}
                {visibleCols.kp && <span onClick={() => toggleSort('kp')} style={{ cursor: 'pointer' }}>{t('col_kp')}{sortKey === 'kp' ? (sortDir === 'desc' ? ' ↓' : ' ↑') : ''}</span>}
                {visibleCols.deaths && <span onClick={() => toggleSort('deaths')} style={{ cursor: 'pointer' }}>{t('col_dead')}{sortKey === 'deaths' ? (sortDir === 'desc' ? ' ↓' : ' ↑') : ''}</span>}
                {visibleCols.powerGained && <span onClick={() => toggleSort('powerGained')} style={{ cursor: 'pointer' }}>{t('col_power_gained')}{sortKey === 'powerGained' ? (sortDir === 'desc' ? ' ↓' : ' ↑') : ''}</span>}
                {visibleCols.kpGained && <span onClick={() => toggleSort('kpGained')} style={{ cursor: 'pointer' }}>{t('col_kp_gained')}{sortKey === 'kpGained' ? (sortDir === 'desc' ? ' ↓' : ' ↑') : ''}</span>}
                {visibleCols.deathsGained && <span onClick={() => toggleSort('deathsGained')} style={{ cursor: 'pointer' }}>{t('col_dead_gained')}{sortKey === 'deathsGained' ? (sortDir === 'desc' ? ' ↓' : ' ↑') : ''}</span>}
                {visibleCols.dkpProgress && <span onClick={() => toggleSort('dkpEarned')} style={{ cursor: 'pointer' }}>{t('col_dkp_progress')}{sortKey === 'dkpEarned' ? (sortDir === 'desc' ? ' ↓' : ' ↑') : ''}</span>}
              </div>
              {visibleRows.map((r, i) => (
                <div className="dkp-table-row" key={r.id} style={{ gridTemplateColumns: getGridTemplate() }}>
                  <span className={`dkp-rank${i < 3 ? ' top' + (i + 1) : ''}`}>{i + 1}</span>
                  <span className="dkp-name" title={r.id}>
                    <button
                      type="button"
                      className="dkp-name-text dkp-name-btn"
                      onClick={() => setSelectedGovernor(r)}
                    >
                      {r.username}
                    </button>
                    {(!r.inFrom || !r.inTo) && <span className="tag">{!r.inFrom ? t('tag_new') : t('tag_left')}</span>}
                  </span>
                  {visibleCols.power && <span className="dkp-baseline">{formatCount(r.power)}</span>}
                  {visibleCols.kp && <span className="dkp-baseline">{formatCount(r.kp)}</span>}
                  {visibleCols.deaths && <span className="dkp-baseline">{r.deaths === null ? 'N/A' : formatCount(r.deaths)}</span>}
                  {visibleCols.powerGained && <span className="dkp-gained">{r.powerGained === null ? '—' : (r.powerGained >= 0 ? '+' : '') + formatCount(r.powerGained)}</span>}
                  {visibleCols.kpGained && <span className="dkp-gained">{r.kpGained === null ? '—' : (r.kpGained >= 0 ? '+' : '') + formatCount(r.kpGained)}</span>}
                  {visibleCols.deathsGained && <span className="dkp-gained">{r.deathsGained === null ? 'N/A' : (r.deathsGained >= 0 ? '+' : '') + formatCount(r.deathsGained)}</span>}
                  {visibleCols.dkpProgress && (
                    <span className="dkp-dkp-cell">
                      {r.isKvkFile ? (
                        <>
                          <span
                            className={`dkp-dkp-bar${r.dkpProgressPct >= 100 ? ' complete' : ''}`}
                            title={
                              `${t('dkp_earned_tip')}: ${formatCount(r.dkpEarned)} DKP` +
                              ` (KP: ${formatCount(r.kpGained || 0)} + ${t('col_dead')}: ${formatCount(r.deathsGained || 0)})` +
                              `\n${t('dkp_required_tip')}: ${formatCount(r.dkpRequired)} DKP` +
                              ` (${t('dkp_power_tip')} ${formatCount(r.power)} × ${getDkpMultiplier(r.power)})`
                            }
                          >
                            <span
                              className="dkp-dkp-fill"
                              style={{ width: r.dkpProgressPct + '%' }}
                            />
                          </span>
                          <span className="dkp-dkp-pct">
                            {Math.round(r.dkpProgressPct)}%
                            <span className="dkp-dkp-sub">
                              {formatCount(r.dkpEarned)} / {formatCount(r.dkpRequired)}
                            </span>
                          </span>
                        </>
                      ) : (
                        <span className="dkp-dkp-earned" title={t('dkp_normal_tip')}>—</span>
                      )}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {visibleCount < rows.length && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 14 }}>
              <button
                type="button"
                className="btn-primary"
                onClick={() => setVisibleCount(v => v + 50)}
              >
                {t('load_more')} ({formatCount(rows.length - visibleCount)} {t('remaining_suffix')})
              </button>
            </div>
          )}
        </>
      )}

      {/* Custom Confirmation Modal */}
      {confirmPrompt && (
        <div className="modal-overlay" onClick={() => confirmPrompt.onCancel()}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{t('confirm_action_title')}</h3>
              <button className="modal-x" onClick={() => confirmPrompt.onCancel()}>
                <Icon.close width={16} height={16}/>
              </button>
            </div>
            <div className="modal-body">
              <p className="modal-prompt">{confirmPrompt.message}</p>
              <div className="modal-actions">
                <button className="btn-secondary" onClick={() => confirmPrompt.onCancel()}>{t('cancel_btn')}</button>
                <button className="btn-danger" onClick={() => confirmPrompt.onConfirm()}>{t('remove_btn')}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Governor details modal — opens when you tap/click a name */}
      {selectedGovernor && (() => {
        const gid = selectedGovernor.id;
        const a = fromSnap[gid];      // entry in the "From" snapshot (may be undefined)
        const b = toSnap[gid];        // entry in the "To" snapshot   (may be undefined)
        const cur = b || a;
        if (!cur) return null;

        const both = !!a && !!b;
        const deathsOf = (s) =>
          s ? ((s.t1d || 0) + (s.t2d || 0) + (s.t3d || 0) + (s.t4d || 0) + (s.t5d || 0)) : null;

        const rows = [
          {
            key: 'power',
            label: t('col_power'),
            from: a ? a.power : null,
            to:   b ? b.power : null,
            gained: both ? (b.power - a.power) : null,
          },
          {
            key: 'kp',
            label: t('col_kp'),
            from: a ? a.kp : null,
            to:   b ? b.kp : null,
            gained: both ? (b.kp - a.kp) : null,
          },
        ];

        // Only add the Deaths row when we actually have death data.
        if (deathTotalAvailable || (both && deathGainedAvailable)) {
          rows.push({
            key: 'deaths',
            label: t('col_dead'),
            from: (a && fromHasDeaths) ? deathsOf(a) : null,
            to:   (b && toHasDeaths)   ? deathsOf(b) : null,
            gained: (both && deathGainedAvailable) ? (deathsOf(b) - deathsOf(a)) : null,
          });
        }

        return (
          <div className="modal-overlay" onClick={() => setSelectedGovernor(null)}>
            <div className="modal-card gov-modal-card" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3>{t('dkp_gov_modal_title')}</h3>
                <button className="modal-x" onClick={() => setSelectedGovernor(null)} aria-label={t('aria_close')}>
                  <Icon.close width={16} height={16}/>
                </button>
              </div>
              <div className="gov-body">
                {/* Identity block — who this governor is */}
                <div className="gov-identity">
                  <div className="gov-identity-name">
                    {cur.username}
                    {(!a || !b) && (
                      <span className="tag">{!a ? t('tag_new') : t('tag_left')}</span>
                    )}
                  </div>
                  <div className="gov-identity-id">{t('dkp_gov_id')}: {gid}</div>
                </div>

                {/* Comparison table — what changed between snapshots */}
                <div className="gov-table">
                  <div className="gov-table-head">
                    <span></span>
                    <span title={fromDate}>{t('from_label')}</span>
                    <span title={toDate}>{t('to_label')}</span>
                    <span>{t('dkp_gov_change')}</span>
                  </div>

                  {rows.map(r => {
                    const negative = r.gained !== null && r.gained < 0;
                    return (
                      <div className="gov-table-row" key={r.key}>
                        <span className="gov-table-label">{r.label}</span>
                        <span className="gov-table-num">
                          {r.from === null ? '—' : formatCount(r.from)}
                        </span>
                        <span className="gov-table-num">
                          {r.to === null ? '—' : formatCount(r.to)}
                        </span>
                        <span className={`gov-table-delta${negative ? ' neg' : ''}`}>
                          {r.gained === null
                            ? '—'
                            : (r.gained >= 0 ? '+' : '') + formatCount(r.gained)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

/* =====================================================================
   GLOBAL CHAT
   ===================================================================== */

function ChatPanel() {
  const { t, lang } = useT();
  const { isOwner, requireOwnerLogin, logout: ownerLogout } = useOwner();
  const [messages, setMessages] = useState([]);
  const [loaded, setLoaded]     = useState(false);
  const [input, setInput]       = useState('');
  const [sending, setSending]   = useState(false);
  const [name, setName] = useState(() => {
    try { return localStorage.getItem(CHAT_NAME_KEY) || ''; } catch { return ''; }
  });
  const [chatUserId] = useState(() => getOrCreateChatUserId());
  const [namePrompt, setNamePrompt] = useState(!name);
  const [nameInput, setNameInput]   = useState('');
  const [nameError, setNameError]   = useState(null);
  const [filterError, setFilterError] = useState(null);
  const [resetAt, setResetAt]       = useState(null);
  const [nowTick, setNowTick]       = useState(() => Date.now());
  const [deleteTarget, setDeleteTarget]       = useState(null);
  const [deleteAllPrompt, setDeleteAllPrompt] = useState(false);
  const [deletingAll, setDeletingAll]         = useState(false);
  const [bannedNames, setBannedNames] = useState({});
  const [adminOpen, setAdminOpen]   = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [imageInfoOpen, setImageInfoOpen] = useState(false);
  const [announcementMode, setAnnouncementMode] = useState(false);
  const [replyTarget, setReplyTarget] = useState(null);
  const [highlightId, setHighlightId] = useState(null);
  const [imageCooldownUntil, setImageCooldownUntil] = useState(0);
  const [textCooldownUntil, setTextCooldownUntil]   = useState(0);
  const [cooldownTick, setCooldownTick]             = useState(Date.now());
  const [onlineCount, setOnlineCount]               = useState(0);
  const [typers, setTypers]                         = useState([]);
  const [lightboxImage, setLightboxImage]           = useState(null);
  const [isAtBottom, setIsAtBottom]                 = useState(true);
  const [unseenCount, setUnseenCount]               = useState(0);
  const [reactionPicker, setReactionPicker]         = useState(null); // { msgId, x, y }
  const [removingIds, setRemovingIds]               = useState(() => new Set());
  const [brokenImages, setBrokenImages]             = useState(() => new Set());
  const listRef   = useRef(null);
  const bottomRef = useRef(null);
  const inputElRef = useRef(null);
  const msgRefs   = useRef({});
  const lastTypingPingRef = useRef(0);
  const typingStopTimerRef = useRef(null);
  const longPressTimerRef  = useRef(null);
  const longPressDataRef   = useRef(null);
  const isAtBottomRef      = useRef(true);
  const prevMsgLenRef      = useRef(0);
  const resetAtRef         = useRef(null);

  // Insert a RoK icon token into the input at the caret (or append it).
  const insertRoKIcon = (iconName) => {
    const token = `[[${iconName}]]`;
    const el = inputElRef.current;
    const current = input;
    let next, pos;
    if (el && typeof el.selectionStart === 'number') {
      const start = el.selectionStart;
      const end = el.selectionEnd;
      next = (current.slice(0, start) + token + current.slice(end)).slice(0, 500);
      pos = start + token.length;
    } else {
      next = (current + token).slice(0, 500);
      pos = next.length;
    }
    setInput(next);
    setPickerOpen(false);
    requestAnimationFrame(() => {
      try {
        if (el) {
          el.focus();
          el.setSelectionRange(pos, pos);
          // Nudge scrollLeft so the caret is visible on long inputs
          el.scrollLeft = el.scrollWidth;
        }
      } catch (e) {}
    });
  };

  // Keep the banned-names list fresh so bans/unbans take effect for
  // everyone without needing a page refresh.
  const refreshBanned = useCallback(async () => {
    const list = await loadBannedNames();
    setBannedNames(list || {});
  }, []);
  useEffect(() => {
    let cancelled = false;
    const poll = async () => { if (!cancelled) await refreshBanned(); };
    poll();
    const id = setInterval(poll, CHAT_POLL_MS * 3);
    return () => { cancelled = true; clearInterval(id); };
  }, [refreshBanned]);

  // --- translation ---
  const [chatLang, setChatLangState] = useState(() => {
    try { return localStorage.getItem(CHAT_TRANSLATE_LANG_KEY) || lang || 'en'; } catch { return lang || 'en'; }
  });
  const [langPickerOpen, setLangPickerOpen] = useState(false);
  const [translations, setTranslations]     = useState({}); // { [msgId]: { lang, text, loading, error } }
  const messagesRef     = useRef(messages);
  const prevChatLangRef = useRef(chatLang);

  useEffect(() => { messagesRef.current = messages; }, [messages]);

  // How many replies has each message received?
  const replyCounts = useMemo(() => {
    const map = {};
    messages.forEach(m => {
      const rid = m.replyTo && m.replyTo.id;
      if (rid) map[rid] = (map[rid] || 0) + 1;
    });
    return map;
  }, [messages]);

  // The most recent owner announcement — always pinned at the top of
  // the chat until the owner posts a newer one.
  const latestAnnouncement = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i] && messages[i].isAnnouncement) return messages[i];
    }
    return null;
  }, [messages]);

  // Plain-text preview of the pinned announcement (strip [[icon]] tokens
  // so the banner text stays short and clean).
  const latestAnnouncementPreview = useMemo(() => {
    if (!latestAnnouncement) return '';
    const raw = String(latestAnnouncement.text || '')
      .replace(/\[\[[a-z][a-z0-9]*\]\]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    return raw.length > 140 ? raw.slice(0, 140) + '…' : raw;
  }, [latestAnnouncement]);

  // Scroll to a message and briefly flash it so the user sees where it is.
  const jumpToMessage = useCallback((id) => {
    const el = msgRefs.current[id];
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightId(id);
    clearTimeout(jumpToMessage._t);
    jumpToMessage._t = setTimeout(() => setHighlightId(null), 2200);
  }, []);

  const setChatLang = (code) => {
    setChatLangState(code);
    try { localStorage.setItem(CHAT_TRANSLATE_LANG_KEY, code); } catch (e) {}
    setLangPickerOpen(false);
  };

  const runTranslate = useCallback(async (msg) => {
    const targetLang = chatLang;
    setTranslations(prev => ({ ...prev, [msg.id]: { ...(prev[msg.id] || {}), loading: true, error: null } }));
    try {
      const { translated } = await translateChatText(msg.text, targetLang);
      setTranslations(prev => ({ ...prev, [msg.id]: { lang: targetLang, text: translated, loading: false, error: null } }));
    } catch (e) {
      setTranslations(prev => ({ ...prev, [msg.id]: { ...(prev[msg.id] || {}), loading: false, error: true } }));
    }
  }, [chatLang]);

  const toggleTranslate = (msg) => {
    const entry = translations[msg.id];
    if (entry && entry.text && entry.lang === chatLang) {
      setTranslations(prev => { const next = { ...prev }; delete next[msg.id]; return next; });
    } else {
      runTranslate(msg);
    }
  };

  // When the preferred language changes, automatically re-translate any
  // messages that are currently shown translated, so the switch is instant.
  useEffect(() => {
    if (prevChatLangRef.current === chatLang) return;
    prevChatLangRef.current = chatLang;
    const expandedIds = Object.keys(translations).filter(id => translations[id] && (translations[id].text || translations[id].loading));
    expandedIds.forEach(id => {
      const msg = messagesRef.current.find(m => m.id === id);
      if (msg) runTranslate(msg);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatLang]);

  const currentChatLangLabel = (CHAT_LANGUAGES.find(l => l.code === chatLang) || {}).label || chatLang;

  const refreshMessages = useCallback(async () => {
    const msgs = await loadChatMessages();
    if (msgs) {
      setMessages(msgs.slice(-CHAT_MAX_MESSAGES));
      setLoaded(true);
    }
  }, []);

  // Poll for new messages
  useEffect(() => {
    let cancelled = false;
    const poll = async () => { if (!cancelled) await refreshMessages(); };
    poll();
    const id = setInterval(poll, CHAT_POLL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, [refreshMessages]);

  // Server-anchored 24h reset: checked on load and every minute after, so
  // the wipe happens automatically for everyone, based on the stored
  // timestamp rather than the local browser session.
  useEffect(() => {
    let cancelled = false;
    const checkReset = async () => {
      const next = await ensureChatResetWindow();
      if (cancelled || !next) return;
      if (resetAtRef.current && next > resetAtRef.current) refreshMessages();
      resetAtRef.current = next;
      setResetAt(next);
    };
    checkReset();
    const id = setInterval(checkReset, 60000);
    return () => { cancelled = true; clearInterval(id); };
  }, [refreshMessages]);

  // Keeps the "resets in Xh Ym" label fresh
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);

  // Sync the "at bottom" ref so the auto-scroll effect reads a fresh value
  useEffect(() => { isAtBottomRef.current = isAtBottom; }, [isAtBottom]);

  // Auto-scroll to the bottom when new messages arrive — only if the user
  // is already near the bottom. Otherwise, bump the unseen counter so the
  // floating "new messages" button appears.
  useEffect(() => {
    const prevLen = prevMsgLenRef.current;
    const newLen  = messages.length;

    // First batch of messages — jump to the bottom instantly.
    if (prevLen === 0 && newLen > 0) {
      prevMsgLenRef.current = newLen;
      requestAnimationFrame(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
      });
      return;
    }

    prevMsgLenRef.current = newLen;

    if (newLen > prevLen) {
      if (isAtBottomRef.current) {
        requestAnimationFrame(() => {
          bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
        });
        setUnseenCount(0);
      } else {
        setUnseenCount(c => Math.min(c + (newLen - prevLen), 99));
      }
    }
  }, [messages]);

  // Escape closes the lightbox
  useEffect(() => {
    if (!lightboxImage) return;
    const onKey = (e) => { if (e.key === 'Escape') setLightboxImage(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxImage]);

  // Escape closes the reaction picker
  useEffect(() => {
    if (!reactionPicker) return;
    const onKey = (e) => { if (e.key === 'Escape') setReactionPicker(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [reactionPicker]);

  // Cancel any pending long-press when the component unmounts
  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    };
  }, []);

  // Reset announcement & reply state when the chat panel unmounts
  useEffect(() => {
    return () => {
      setAnnouncementMode(false);
      setReplyTarget(null);
    };
  }, []);

  // Fast ticker for cooldown countdowns (0.5s updates)
  const cooldownActive = imageCooldownUntil > Date.now() || textCooldownUntil > Date.now();
  useEffect(() => {
    if (!cooldownActive) return;
    setCooldownTick(Date.now());
    const id = setInterval(() => setCooldownTick(Date.now()), 500);
    return () => clearInterval(id);
  }, [cooldownActive]);

  // Restore cooldowns from the server on mount and whenever the user
  // identity changes. This survives page refreshes, so refreshing the
  // browser does NOT bypass the wait.
  useEffect(() => {
    if (!chatUserId) return;
    let cancelled = false;
    loadUserRate(chatUserId).then(rate => {
      if (cancelled) return;
      const textUntil  = (rate.textAt  || 0) + TEXT_RATE_MS;
      const imageUntil = (rate.imageAt || 0) + IMAGE_RATE_MS;
      setTextCooldownUntil(prev  => Math.max(prev,  textUntil  > Date.now() ? textUntil  : 0));
      setImageCooldownUntil(prev => Math.max(prev, imageUntil > Date.now() ? imageUntil : 0));
    });
    return () => { cancelled = true; };
  }, [chatUserId]);

  // Poll typing state every 1.5s so we see other people's pings
  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      if (cancelled) return;
      const map = await loadTyping();
      if (!cancelled) setTypers(getActiveTypers(map, chatUserId));
    };
    poll();
    const id = setInterval(poll, 1500);
    return () => { cancelled = true; clearInterval(id); };
  }, [chatUserId]);

  // Clear our own typing flag when we leave the chat
  useEffect(() => {
    return () => {
      clearTyping(chatUserId);
    };
  }, [chatUserId]);

  // Presence: ping every 15s while present, delete immediately on leave.
  // Uses fetch(..., { keepalive: true }) so the DELETE survives page unload
  // (works on tab close, browser close, navigation away, and SPA unmount).
  useEffect(() => {
    if (!name) return; // wait until a display name is set

    const url = `${PRESENCE_URL}/${chatUserId}.json`;
    let cancelled = false;

    const ping = async () => {
      if (cancelled) return;
      await pingPresence(chatUserId, name);
      const presence = await loadPresence();
      if (!cancelled) setOnlineCount(countOnline(presence));
    };

    // Fire-and-forget delete — keepalive makes the browser send this
    // even as the page is being destroyed.
    const goOffline = () => {
      try {
        fetch(url, { method: 'DELETE', keepalive: true }).catch(() => {});
      } catch (e) { /* ignore */ }
    };

    // Go online immediately
    ping();
    const id = setInterval(ping, PRESENCE_PING_MS);

    // Go offline on: page unload, tab close, browser close, navigation away, backgrounding
    const onPageHide = () => goOffline();
    const onBeforeUnload = () => goOffline();

    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('beforeunload', onBeforeUnload);

    return () => {
      cancelled = true;
      clearInterval(id);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('beforeunload', onBeforeUnload);
      goOffline(); // also clean up when the chat panel unmounts (SPA tab switch)
    };
  }, [chatUserId, name]);

  // Live countdown values
  const imageSecondsLeft = Math.max(0, Math.ceil((imageCooldownUntil - cooldownTick) / 1000));
  const textSecondsLeft  = Math.max(0, Math.ceil((textCooldownUntil  - cooldownTick) / 1000));

  // --- scroll-to-bottom ---
  const handleListScroll = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    setIsAtBottom(prev => (prev === nearBottom ? prev : nearBottom));
    if (nearBottom) setUnseenCount(0);
  }, []);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    setUnseenCount(0);
  }, []);

  // --- reactions ---
  const toggleReaction = useCallback((msgId, iconName) => {
    const msg = messages.find(m => m.id === msgId);
    if (!msg) return;
    const current = msg.reactions || {};
    const users = Array.isArray(current[iconName]) ? current[iconName] : [];
    const hasMine = users.includes(chatUserId);
    const newUsers = hasMine
      ? users.filter(u => u !== chatUserId)
      : [...users, chatUserId];
    const next = { ...current };
    if (newUsers.length === 0) delete next[iconName];
    else next[iconName] = newUsers;

    // Optimistic update so the UI reacts instantly
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, reactions: next } : m));
    setReactionPicker(null);
    setMessageReactions(msgId, next);
  }, [messages, chatUserId]);

  const openReactionPicker = useCallback((msgId, x, y) => {
    const pickerW = 6 * 44 + 12;  // 6 icons × 44px + padding
    const pickerH = 48;
    const px = Math.min(Math.max(x, 8), window.innerWidth  - pickerW - 8);
    const py = Math.min(Math.max(y - pickerH - 10, 8), window.innerHeight - pickerH - 8);
    setReactionPicker({ msgId, x: px, y: py });
  }, []);

  const handleMsgContextMenu = useCallback((e, msgId) => {
    e.preventDefault();
    openReactionPicker(msgId, e.clientX, e.clientY);
  }, [openReactionPicker]);

  const startLongPress = useCallback((e, msgId) => {
    const touch = e.touches?.[0];
    if (!touch) return;
    const startX = touch.clientX;
    const startY = touch.clientY;
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressDataRef.current = { msgId, startX, startY };
    longPressTimerRef.current = setTimeout(() => {
      const d = longPressDataRef.current;
      if (!d) return;
      openReactionPicker(d.msgId, d.startX, d.startY);
      longPressDataRef.current = null;
    }, 500);
  }, [openReactionPicker]);

  const cancelLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    longPressDataRef.current = null;
  }, []);

  const saveName = () => {
    const trimmed = nameInput.trim().slice(0, 24);
    if (!trimmed) return;
    if (containsBannedWord(trimmed)) {
      setNameError(t('chat_filtered_msg'));
      return;
    }
    setNameError(null);
    setName(trimmed);
    try { localStorage.setItem(CHAT_NAME_KEY, trimmed); } catch (e) {}
    setNamePrompt(false);
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;
    if (textSecondsLeft > 0) return;

    // Server-side rate limit — catches refresh bypass + multi-tab.
    // Owners bypass everything (useful for moderation).
    if (!isOwner) {
      const rate = await loadUserRate(chatUserId);
      const serverWait = (rate.textAt || 0) + TEXT_RATE_MS - Date.now();
      if (serverWait > 0) {
        setTextCooldownUntil(Date.now() + serverWait);
        setFilterError(t('chat_slow_mode_msg').replace('{n}', String(Math.ceil(serverWait / 1000))));
        return;
      }
    }

    if (!isOwner && bannedNames && bannedNames[toFirebaseKey(name)]) {
      setFilterError(t('chat_banned_error'));
      return;
    }
    if (containsBannedWord(text)) {
      setFilterError(t('chat_filtered_msg'));
      return;
    }
    setFilterError(null);
    setSending(true);
    setInput('');
    const replyTo = replyTarget
      ? {
          id:   replyTarget.id,
          name: replyTarget.name || '',
          text: replyTarget.isImage ? 'image' : String(replyTarget.text || '').slice(0, 80),
          ...(replyTarget.isImage ? { isImage: true } : {}),
        }
      : undefined;
    const ok = await sendChatMessage(name, text.slice(0, 500), {
      isOwner,
      lang: chatLang,
      userId: chatUserId,
      ...(isOwner && announcementMode ? { isAnnouncement: true } : {}),
      ...(replyTo ? { replyTo } : {}),
    });
    setSending(false);
    if (!ok) {
      setInput(text);
      setFilterError(t('chat_send_failed'));
      return;
    }
    setReplyTarget(null);
    setAnnouncementMode(false);
    if (ok) {
      refreshMessages();
      const now = Date.now();
      setTextCooldownUntil(now + TEXT_RATE_MS);
      saveUserRate(chatUserId, { textAt: now }); // persist to server
      // We're no longer typing
      clearTimeout(typingStopTimerRef.current);
      clearTyping(chatUserId);
      lastTypingPingRef.current = 0;
    }
  };

  const confirmDelete = (msg) => setDeleteTarget(msg);
  const cancelDelete  = () => setDeleteTarget(null);
  const performDelete = async () => {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    setDeleteTarget(null);

    // 1. Lock the element's current height so the collapse transition
    //    has a fixed start value to animate from.
    const el = msgRefs.current[id];
    if (el) {
      el.style.height = el.offsetHeight + 'px';
      el.style.overflow = 'hidden';
      // Force reflow so the browser picks up the fixed height before
      // we add the .removing class.
      void el.offsetHeight;
    }

    // 2. Trigger the fade + collapse animation.
    setRemovingIds(prev => { const next = new Set(prev); next.add(id); return next; });

    // 3. Wait for the animation to finish (matches CSS duration).
    await new Promise(r => setTimeout(r, 280));

    // 4. Now actually remove it from state + Firebase.
    setMessages(prev => prev.filter(m => m.id !== id));
    setRemovingIds(prev => { const next = new Set(prev); next.delete(id); return next; });
    delete msgRefs.current[id];
    await deleteChatMessage(id);
  };

  const performDeleteAll = async () => {
    setDeleteAllPrompt(false);
    setDeletingAll(true);

    const mine = messages.filter(m => m.userId ? m.userId === chatUserId : m.name === name);
    const mineIds = new Set(mine.map(m => m.id));

    // Lock each element's height so the collapse runs smoothly
    mineIds.forEach(id => {
      const el = msgRefs.current[id];
      if (el) {
        el.style.height = el.offsetHeight + 'px';
        el.style.overflow = 'hidden';
      }
    });
    void document.body.offsetHeight; // single reflow for all

    // Animate all of them out together
    setRemovingIds(mineIds);

    await new Promise(r => setTimeout(r, 280));

    // Remove from state + Firebase
    setMessages(prev => prev.filter(m => !mineIds.has(m.id)));
    setRemovingIds(new Set());
    mineIds.forEach(id => { delete msgRefs.current[id]; });
    await Promise.all(mine.map(m => deleteChatMessage(m.id)));
    setDeletingAll(false);
    refreshMessages();
  };

  const handleKeyDown = e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const hasOwnMessages = messages.some(m => m.userId ? m.userId === chatUserId : m.name === name);
  const timeLeftLabel  = resetAt ? formatTimeLeft(resetAt - nowTick) : null;

  return (
    <div className="chat-wrap">
      <div className="chat-header-row">
        <div className="chat-notice">
          <Icon.info width={14} height={14} />
          <span>{t('chat_notice')}{timeLeftLabel ? ` (${timeLeftLabel})` : ''}</span>
        </div>
        <div className="chat-header-actions">
          <span className="chat-online-badge" title={t('chat_online_label')}>
            <span className="chat-online-dot" />
            {onlineCount}
          </span>
          {hasOwnMessages && (
            <button
              type="button"
              className="chat-lang-btn chat-clear-all-btn"
              onClick={() => setDeleteAllPrompt(true)}
              disabled={deletingAll}
              title={t('chat_delete_all_btn')}
              aria-label={t('chat_delete_all_btn')}
            >
              <Icon.trash width={14} height={14} />
            </button>
          )}
          {isOwner ? (
            <>
              <button type="button" className="chat-lang-btn admin-btn" onClick={() => setAdminOpen(true)}>
                <Icon.shield width={14} height={14} />
                <span>{t('chat_admin_panel_btn')}</span>
              </button>
              <button type="button" className="chat-lang-btn" onClick={ownerLogout} title={t('chat_owner_logout_btn')}>
                <Icon.logout width={14} height={14} />
              </button>
            </>
          ) : (
            <button type="button" className="chat-lang-btn" onClick={() => requireOwnerLogin()} title={t('chat_owner_login_btn')}>
              <Icon.key width={14} height={14} />
            </button>
          )}
          {name && (
            <button
              type="button"
              className="chat-lang-btn"
              onClick={() => { setNameInput(name); setNameError(null); setNamePrompt(true); }}
              title={t('chat_change_name_btn')}
            >
              <Icon.users width={14} height={14} />
              <span>{name}</span>
            </button>
          )}
          <button
            type="button"
            className="chat-lang-btn"
            onClick={() => setLangPickerOpen(true)}
            title={t('chat_translate_lang_btn')}
          >
            <Icon.translate width={14} height={14} />
            <span>{currentChatLangLabel}</span>
          </button>
        </div>
      </div>

      {/* Pinned announcement — always visible until the owner posts a new one */}
      {latestAnnouncement && (
        <button
          type="button"
          className="chat-pin-banner"
          onClick={() => jumpToMessage(latestAnnouncement.id)}
          title={t('chat_jump_to_reply')}
        >
          <Icon.sparkle width={14} height={14} />
          <span className="chat-pin-banner-text">
            <b>{latestAnnouncement.name || t('chat_anonymous')}:</b>{' '}
            {latestAnnouncementPreview}
          </span>
          <span className="chat-pin-banner-time">
            {fmtMsgTime(latestAnnouncement.ts, nowTick)}
          </span>
        </button>
      )}

      <div className="chat-list-wrap">
      <div className="chat-list" ref={listRef} onScroll={handleListScroll}>
        {!loaded ? (
          <p className="muted-line">{t('chat_loading')}</p>
        ) : messages.length === 0 ? (
          <p className="muted-line">{t('chat_empty')}</p>
        ) : (
          messages.map((m, i) => {
            const isMine = m.userId ? m.userId === chatUserId : m.name === name;
            const tr = translations[m.id];
            const isTranslated = !!(tr && tr.text && tr.lang === chatLang);
            const isLoading    = !!(tr && tr.loading);
            const replyCount = replyCounts[m.id] || 0;
            const isAnnouncement = !!m.isAnnouncement;

            // Visible reactions (only those with at least one user)
            const reactionEntries = m.reactions
              ? Object.entries(m.reactions).filter(([k, arr]) => Array.isArray(arr) && arr.length > 0)
              : [];

            return (
            <div
              className={`chat-msg${isMine ? ' own' : ''}${m.isOwner ? ' from-owner' : ''}${isAnnouncement ? ' announcement' : ''}${highlightId === m.id ? ' highlight' : ''}${removingIds.has(m.id) ? ' removing' : ''}`}
              key={m.id}
              ref={el => { msgRefs.current[m.id] = el; }}
              onContextMenu={(e) => handleMsgContextMenu(e, m.id)}
              onTouchStart={(e) => startLongPress(e, m.id)}
              onTouchEnd={cancelLongPress}
              onTouchMove={cancelLongPress}
              onTouchCancel={cancelLongPress}
            >
              {isAnnouncement && (
                <div className="chat-msg-announce-banner">
                  <Icon.sparkle width={13} height={13} />
                  <span>{t('chat_announcement_label')}</span>
                </div>
              )}
              <div className="chat-msg-head">
                <span className="chat-msg-name">{m.name || t('chat_anonymous')}</span>
                {m.lang && (
                  <span className="chat-msg-lang" title={m.lang.toUpperCase()}>
                    {m.lang.toUpperCase()}
                  </span>
                )}
                {m.isOwner && <span className="chat-owner-badge" title={t('owner_badge')}>★ {t('owner_badge')}</span>}
                <span className="chat-msg-time" title={new Date(m.ts).toLocaleString()}>
                  {fmtMsgTime(m.ts, nowTick)}
                </span>
                {(isMine || isOwner) && (
                  <button
                    type="button"
                    className="chat-msg-delete"
                    onClick={() => confirmDelete(m)}
                    aria-label={t('chat_delete_msg_title')}
                  >
                    <Icon.close width={12} height={12} />
                  </button>
                )}
              </div>
              {m.replyTo && (
                <button
                  type="button"
                  className="chat-msg-reply-preview"
                  title={t('chat_jump_to_reply')}
                  onClick={() => jumpToMessage(m.replyTo.id)}
                >
                  <span className="chat-msg-reply-name">
                    <Icon.reply width={10} height={10} /> {m.replyTo.name || t('chat_anonymous')}
                  </span>
                  <span className="chat-msg-reply-text">
                    {m.replyTo.isImage
                      ? t('chat_reply_image')
                      : renderMessageText(m.replyTo.text)}
                  </span>
                </button>
              )}

              {(() => {
                // Only treat it as an image if the text is actually a URL.
                const isRealImage =
                  m.isImage &&
                  typeof m.text === 'string' &&
                  /^https:\/\/i\.ibb\.co\//i.test(m.text.trim());

                if (isRealImage && !brokenImages.has(m.id)) {
                  return (
                    <img
                      src={m.text}
                      alt="shared"
                      className="chat-msg-image"
                      loading="lazy"
                      onError={() => {
                        setBrokenImages(prev => {
                          const next = new Set(prev);
                          next.add(m.id);
                          return next;
                        });
                      }}
                      onClick={() => setLightboxImage(m.text)}
                    />
                  );
                }
                if (isRealImage && brokenImages.has(m.id)) {
                  return (
                    <div className="chat-msg-image broken-fallback">
                      {t('fort_image_unavailable')}
                    </div>
                  );
                }

                // Fall back to text. Show a subtle placeholder if the
                // message really has no content, so the bubble doesn't
                // collapse to an empty frame.
                const rendered = renderMessageText(m.text);
                const empty =
                  !rendered ||
                  (typeof rendered === 'string' && !rendered.trim()) ||
                  isMessageTextEmpty(m.text);

                return (
                  <div className={`chat-msg-text${empty ? ' empty' : ''}`}>
                    {empty ? '·' : rendered}
                  </div>
                );
              })()}

              {reactionEntries.length > 0 && (
                <div className="chat-reactions-bar">
                  {reactionEntries.map(([iconName, users]) => {
                    const Comp = RoKIcons[iconName];
                    if (!Comp) return null;
                    const isMine = users.includes(chatUserId);
                    return (
                      <button
                        key={iconName}
                        type="button"
                        className={`chat-reaction-pill${isMine ? ' mine' : ''}`}
                        onClick={() => toggleReaction(m.id, iconName)}
                        title={`:${iconName}: · ${users.length}`}
                      >
                        <Comp width={13} height={13} />
                        <span>{users.length}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {replyCount > 0 && (
                <button
                  type="button"
                  className="chat-msg-replies-badge"
                  onClick={() => jumpToMessage(m.id)}
                  title={t('chat_view_replies')}
                >
                  <Icon.reply width={10} height={10} />
                  <span>{replyCount} {replyCount === 1 ? t('chat_reply_singular') : t('chat_replies_plural')}</span>
                </button>
              )}

              {/* Every message — owner, user, or announcement — can be translated
                  by anyone except the person who wrote it. Image messages are
                  skipped since there's no text to translate. */}
              {!isMine && !m.isImage && (
                <>
                  <div className="chat-translate-row">
                    <button
                      type="button"
                      className="chat-translate-btn"
                      onClick={() => toggleTranslate(m)}
                      disabled={isLoading}
                    >
                      <Icon.translate width={12} height={12} />
                      {isLoading
                        ? t('chat_translating')
                        : isTranslated
                          ? t('chat_hide_translation_btn')
                          : t('chat_translate_btn')}
                    </button>
                    {tr && tr.error && (
                      <span className="chat-translate-error">{t('chat_translate_error')}</span>
                    )}
                  </div>
                  {isTranslated && (
                    <div className={`chat-translated-box${isAnnouncement ? ' announcement-translated' : ''}`}>
                      <span className="chat-translated-label">{t('chat_translated_label')}</span>
                      {tr.text}
                    </div>
                  )}
                </>
              )}

              {/* Reply action — available on every message */}
              <div className="chat-msg-actions">
                <button
                  type="button"
                  className="chat-reply-btn"
                  onClick={() => setReplyTarget(m)}
                  title={t('chat_reply_btn')}
                  aria-label={t('chat_reply_btn')}
                >
                  <Icon.reply width={12} height={12} />
                  <span>{t('chat_reply_btn')}</span>
                </button>
              </div>
            </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Floating "new messages / jump to latest" button */}
      {!isAtBottom && (
        <button
          type="button"
          className="chat-scroll-fab"
          onClick={scrollToBottom}
          aria-label={t('chat_scroll_latest')}
        >
          <Icon.chevron width={14} height={14} />
          {unseenCount > 0 && (
            <span className="chat-scroll-fab-count">
              {unseenCount === 1 ? '1 new' : `${unseenCount} new`}
            </span>
          )}
        </button>
      )}
      </div>

      {filterError && (
        <p className="chat-filter-error" role="alert">{filterError}</p>
      )}

      {replyTarget && (
        <div className="chat-reply-bar">
          <div className="chat-reply-bar-info">
            <span className="chat-reply-bar-label">
              <Icon.reply width={12} height={12} /> {t('chat_replying_to')} <b>{replyTarget.name || t('chat_anonymous')}</b>
            </span>
            <span className="chat-reply-bar-text">
              {replyTarget.isImage
                ? t('chat_reply_image')
                : renderMessageText(String(replyTarget.text || '').slice(0, 80))}
            </span>
          </div>
          <button
            type="button"
            className="chat-reply-bar-x"
            onClick={() => setReplyTarget(null)}
            aria-label={t('chat_clear_reply_btn')}
            title={t('chat_clear_reply_btn')}
          >
            <Icon.close width={12} height={12} />
          </button>
        </div>
      )}

      {typers.length > 0 && (
        <div className="chat-typing-indicator">
          <span className="chat-typing-dots">
            <span /><span /><span />
          </span>
          <span className="chat-typing-text">
            {typers.length === 1
              ? `${typers[0]} ${t('chat_typing_one')}`
              : typers.length === 2
                ? `${typers[0]} ${t('chat_typing_and')} ${typers[1]} ${t('chat_typing_are')}`
                : `${typers[0]} ${t('chat_typing_and')} ${typers.length - 1} ${t('chat_typing_others')}`}
          </span>
        </div>
      )}

      {isOwner && (
        <button
          type="button"
          className={`chat-announce-toggle${announcementMode ? ' active' : ''}`}
          onClick={() => setAnnouncementMode(m => !m)}
          title={t('chat_announce_hint')}
          aria-pressed={announcementMode}
        >
          <Icon.sparkle width={14} height={14} />
          <span>{announcementMode ? t('chat_announce_on') : t('chat_announce_make')}</span>
        </button>
      )}

      {(imageSecondsLeft > 0 || textSecondsLeft > 0) && (
        <div className="chat-cooldown-row">
          {textSecondsLeft > 0 && (
            <span className="chat-cooldown-chip">
              <span className="chat-cooldown-dot" />
              {t('chat_cooldown_send')} · {textSecondsLeft}s
            </span>
          )}
          {imageSecondsLeft > 0 && (
            <span className="chat-cooldown-chip">
              <span className="chat-cooldown-dot" />
              {t('chat_cooldown_image')} · {imageSecondsLeft}s
            </span>
          )}
        </div>
      )}

      <div className={`chat-input-row${announcementMode ? ' announcing' : ''}`}>
        <input
          ref={inputElRef}
          type="text"
          className="chat-input"
          value={input}
          onChange={e => {
            const v = e.target.value;
            setInput(v);
            if (filterError) setFilterError(null);

            // Typing indicator: ping at most once every TYPING_THROTTLE ms
            if (v.trim() && name) {
              const now = Date.now();
              if (now - lastTypingPingRef.current > TYPING_THROTTLE) {
                lastTypingPingRef.current = now;
                pingTyping(chatUserId, name);
              }
              // Auto-clear 3s after the last keystroke
              clearTimeout(typingStopTimerRef.current);
              typingStopTimerRef.current = setTimeout(() => {
                clearTyping(chatUserId);
                lastTypingPingRef.current = 0;
              }, 3000);
            } else if (!v.trim()) {
              // Input emptied — clear right away
              clearTimeout(typingStopTimerRef.current);
              clearTyping(chatUserId);
              lastTypingPingRef.current = 0;
            }
          }}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            clearTimeout(typingStopTimerRef.current);
            clearTyping(chatUserId);
            lastTypingPingRef.current = 0;
          }}
          placeholder={announcementMode ? t('chat_announce_placeholder') : t('chat_placeholder')}
          maxLength={500}
        />
        {(
          <>
            <label
              className={`chat-emoji-btn chat-attach-btn${input.length > 0 ? ' is-hidden' : ''}`}
              style={{
                cursor: imageSecondsLeft > 0 ? 'not-allowed' : 'pointer',
                opacity: imageSecondsLeft > 0 ? 0.45 : 1,
              }}
              title={imageSecondsLeft > 0 ? `${imageSecondsLeft}s` : t('chat_img_send_btn')}
              onClick={(e) => { if (imageSecondsLeft > 0) e.preventDefault(); }}
            >
              <input
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (!file) return;
                  if (imageSecondsLeft > 0) {
                    setFilterError(t('chat_slow_mode_img').replace('{n}', String(imageSecondsLeft)));
                    return;
                  }

                  // Server-side image rate limit
                  if (!isOwner) {
                    const rate = await loadUserRate(chatUserId);
                    const serverWait = (rate.imageAt || 0) + IMAGE_RATE_MS - Date.now();
                    if (serverWait > 0) {
                      setImageCooldownUntil(Date.now() + serverWait);
                      setFilterError(t('chat_slow_mode_img').replace('{n}', String(Math.ceil(serverWait / 1000))));
                      return;
                    }
                  }

                  if (!isOwner && bannedNames && bannedNames[toFirebaseKey(name)]) {
                    setFilterError(t('chat_banned_error'));
                    return;
                  }

                  if (file.size > 5 * 1024 * 1024) {
                    setFilterError(t('chat_img_too_large'));
                    return;
                  }
                  setSending(true);
                  try {
                    const url = await uploadImageToImgBB(file);
                    const replyTo = replyTarget
                      ? {
                          id: replyTarget.id,
                          name: replyTarget.name || '',
                          text: replyTarget.isImage ? 'image' : String(replyTarget.text || '').slice(0, 80),
                          ...(replyTarget.isImage ? { isImage: true } : {}),
                        }
                      : undefined;
                    await sendChatMessage(name, url, {
                      isOwner, lang: chatLang, userId: chatUserId,
                      isImage: true,
                      ...(replyTo ? { replyTo } : {}),
                    });
                    setReplyTarget(null);
                    refreshMessages();
                    const now = Date.now();
                    setImageCooldownUntil(now + IMAGE_RATE_MS);
                    saveUserRate(chatUserId, { imageAt: now }); // persist to server
                  } catch (err) {
                    setFilterError(t('chat_img_failed'));
                  } finally {
                    setSending(false);
                  }
                }}
              />
              <Icon.plus width={16} height={16} />
            </label>
            <button
              type="button"
              className={`chat-image-info-btn chat-attach-btn${input.length > 0 ? ' is-hidden' : ''}`}
              onClick={() => setImageInfoOpen(true)}
              title={t('chat_img_guide_btn')}
              aria-label={t('chat_img_guide_btn')}
            >
              <Icon.info width={14} height={14} />
            </button>
          </>
        )}
        <div className="chat-emoji-wrap">
          <button
            type="button"
            className="chat-emoji-btn"
            onClick={() => setPickerOpen(o => !o)}
            title={t('chat_emoji_btn')}
            aria-label={t('chat_emoji_btn')}
            aria-expanded={pickerOpen}
          >
            <Icon.sparkle width={16} height={16} />
          </button>
          {pickerOpen && (
            <>
              <div className="chat-emoji-overlay" onClick={() => setPickerOpen(false)} />
              <div className="chat-emoji-panel" role="dialog" aria-label={t('chat_emoji_btn')}>
                {Object.entries(RoKIcons).map(([name, Comp]) => (
                  <button
                    key={name}
                    type="button"
                    className="chat-emoji-item"
                    onClick={() => insertRoKIcon(name)}
                    title={`:${name}:`}
                    aria-label={name}
                  >
                    <Comp width={20} height={20} />
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        <button
          className={`btn-primary chat-send-btn${textSecondsLeft > 0 ? ' cooling' : ''}`}
          type="button"
          onClick={handleSend}
          disabled={sending || !input.trim() || textSecondsLeft > 0}
        >
          {textSecondsLeft > 0 ? (
            <span className="chat-send-countdown">
              <span className="chat-send-countdown-ring" />
              {textSecondsLeft}s
            </span>
          ) : (
            announcementMode ? t('chat_announce_send') : t('chat_send')
          )}
        </button>
      </div>

      {/* Delete-all now lives in the header actions row. */}

      {imageInfoOpen && (
        <div className="modal-overlay" onClick={() => setImageInfoOpen(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{t('chat_img_guide_title')}</h3>
              <button className="modal-x" onClick={() => setImageInfoOpen(false)} aria-label={t('aria_close')}>
                <Icon.close width={16} height={16}/>
              </button>
            </div>
            <div className="modal-body">
              <dl className="chat-img-guide-list">
                <div className="chat-img-guide-row">
                  <dt>{t('chat_img_max')}</dt>
                  <dd>{t('chat_img_max_val')}</dd>
                </div>
                <div className="chat-img-guide-row">
                  <dt>{t('chat_img_recommended')}</dt>
                  <dd>{t('chat_img_recommended_val')}</dd>
                </div>
                <div className="chat-img-guide-row">
                  <dt>{t('chat_img_formats')}</dt>
                  <dd>{t('chat_img_formats_val')}</dd>
                </div>
              </dl>

              <ul className="chat-img-guide-tips">
                <li>
                  <svg viewBox="0 0 24 24" fill="none" width={14} height={14} aria-hidden="true">
                    <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span>{String(t('chat_img_tip_camera')).replace(/^[^\p{L}\p{N}]+/u, '')}</span>
                </li>
                <li>
                  <svg viewBox="0 0 24 24" fill="none" width={14} height={14} aria-hidden="true">
                    <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span>{String(t('chat_img_tip_screenshot')).replace(/^[^\p{L}\p{N}]+/u, '')}</span>
                </li>
              </ul>

              <p className="chat-img-guide-note">{t('chat_img_auto_shrink')}</p>
            </div>
          </div>
        </div>
      )}

      {namePrompt && (
        <div className="modal-overlay">
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3>{t('chat_name_title')}</h3></div>
            <div className="modal-body">
              <p className="modal-prompt">{t('chat_name_prompt')}</p>
              <input
                type="text"
                className="modal-input"
                value={nameInput}
                onChange={e => { setNameInput(e.target.value); if (nameError) setNameError(null); }}
                placeholder={t('chat_name_placeholder')}
                maxLength={24}
                autoFocus
                onKeyDown={e => { if (e.key === 'Enter') saveName(); }}
              />
              {nameError && (
                <p style={{ color: 'var(--danger)', fontSize: '0.8rem', margin: '0 0 10px 0' }}>{nameError}</p>
              )}
              <div className="modal-actions">
                {name && (
                  <button className="btn-secondary" onClick={() => setNamePrompt(false)}>{t('cancel_btn')}</button>
                )}
                <button className="btn-primary" onClick={saveName}>
                  {name ? t('save_btn') : t('chat_name_confirm')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {langPickerOpen && (
        <div className="modal-overlay" onClick={() => setLangPickerOpen(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{t('chat_select_translate_lang')}</h3>
              <button className="modal-x" onClick={() => setLangPickerOpen(false)} aria-label={t('aria_close')}><Icon.close width={16} height={16}/></button>
            </div>
            <div className="modal-body">
              <p className="modal-prompt">{t('chat_translate_lang_desc')}</p>
              <div className="chat-lang-list">
                {CHAT_LANGUAGES.map(l => (
                  <button
                    key={l.code}
                    type="button"
                    className={`chat-lang-option${chatLang === l.code ? ' selected' : ''}`}
                    onClick={() => setChatLang(l.code)}
                  >
                    <span>{l.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="modal-overlay" onClick={cancelDelete}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{t('chat_delete_msg_title')}</h3>
              <button className="modal-x" onClick={cancelDelete} aria-label={t('aria_close')}><Icon.close width={16} height={16}/></button>
            </div>
            <div className="modal-body">
              <p className="modal-prompt">{t('chat_delete_msg_body')}</p>
              <div className="modal-actions">
                <button className="btn-secondary" onClick={cancelDelete}>{t('chat_delete_no')}</button>
                <button className="btn-danger" onClick={performDelete}>{t('chat_delete_yes')}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteAllPrompt && (
        <div className="modal-overlay" onClick={() => setDeleteAllPrompt(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{t('chat_delete_all_title')}</h3>
              <button className="modal-x" onClick={() => setDeleteAllPrompt(false)} aria-label={t('aria_close')}><Icon.close width={16} height={16}/></button>
            </div>
            <div className="modal-body">
              <p className="modal-prompt">{t('chat_delete_all_body')}</p>
              <div className="modal-actions">
                <button className="btn-secondary" onClick={() => setDeleteAllPrompt(false)}>{t('chat_delete_no')}</button>
                <button className="btn-danger" onClick={performDeleteAll}>{t('chat_delete_all_yes')}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isOwner && adminOpen && (
        <ChatAdminModal
          messages={messages}
          bannedNames={bannedNames}
          onClose={() => setAdminOpen(false)}
          onChanged={async () => { await refreshBanned(); await refreshMessages(); }}
          t={t}
        />
      )}

      {/* Reaction picker — right-click or long-press a message to open */}
      {reactionPicker && (
        <>
          <div className="chat-reaction-picker-overlay" onClick={() => setReactionPicker(null)} />
          <div
            className="chat-reaction-picker"
            style={{ left: reactionPicker.x + 'px', top: reactionPicker.y + 'px' }}
            role="dialog"
            aria-label={t('chat_pick_reaction')}
          >
            {REACTION_ICONS.map(iconName => {
              const Comp = RoKIcons[iconName];
              if (!Comp) return null;
              return (
                <button
                  key={iconName}
                  type="button"
                  className="chat-reaction-choice"
                  onClick={() => toggleReaction(reactionPicker.msgId, iconName)}
                  title={`:${iconName}:`}
                  aria-label={iconName}
                >
                  <Comp width={20} height={20} />
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Fullscreen image lightbox — click anywhere outside to close */}
      {lightboxImage && (
        <div
          className="chat-lightbox"
          onClick={() => setLightboxImage(null)}
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            className="chat-lightbox-close"
            onClick={(e) => { e.stopPropagation(); setLightboxImage(null); }}
            aria-label={t('aria_close')}
          >
            <Icon.close width={20} height={20} />
          </button>
          <img
            src={lightboxImage}
            alt=""
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

/* ---------- Admin panel: manage Global Chat users & messages ---------- */
function ChatAdminModal({ messages, bannedNames, onClose, onChanged, t }) {
  const [confirmAction, setConfirmAction] = useState(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [feedbackLoaded, setFeedbackLoaded] = useState(false);

  // Load exit-feedback responses (owner-only panel)
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const data = await loadFeedbackRemote();
      if (cancelled) return;
      setFeedback(data || []);
      setFeedbackLoaded(true);
    };
    load();
    const id = setInterval(load, 30000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const feedbackStats = useMemo(() => {
    const list = feedback || [];
    const good   = list.filter(f => f.choice === 'good').length;
    const notbad = list.filter(f => f.choice === 'notbad').length;
    const bad    = list.filter(f => f.choice === 'bad').length;
    const total  = list.length;
    const pct = (n) => (total > 0 ? Math.round((n / total) * 100) : 0);
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recent  = list.filter(f => f.ts && f.ts >= weekAgo).length;
    // A simple "satisfaction score": Good = 100, Not Bad = 60, Bad = 0
    const score = total > 0
      ? Math.round((good * 100 + notbad * 60 + bad * 0) / total)
      : 0;
    return {
      good, notbad, bad, total, recent, score,
      goodPct: pct(good), notbadPct: pct(notbad), badPct: pct(bad),
    };
  }, [feedback]);

  const userStats = useMemo(() => {
    const map = new Map();
    messages.forEach(m => {
      if (m.isOwner) return;
      const key = m.name || t('chat_anonymous');
      if (!map.has(key)) map.set(key, { name: key, count: 0 });
      map.get(key).count += 1;
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [messages, t]);

  const bannedList = Object.keys(bannedNames || {});

  const askBan = (userName) => {
    setConfirmAction({
      message: t('chat_admin_confirm_ban').replace('{name}', userName),
      run: async () => {
        setBusy(true);
        await banChatName(userName);
        await Promise.all(messages.filter(m => m.name === userName).map(m => deleteChatMessage(m.id)));
        setBusy(false);
        setConfirmAction(null);
        onChanged();
      },
    });
  };

  const askUnban = (bannedKey) => {
    setConfirmAction({
      message: t('chat_admin_confirm_unban').replace('{name}', bannedKey),
      run: async () => {
        setBusy(true);
        await unbanChatName(bannedKey);
        setBusy(false);
        setConfirmAction(null);
        onChanged();
      },
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card admin-modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{t('chat_admin_panel_title')}</h3>
          <button className="modal-x" onClick={onClose} aria-label={t('aria_close')}><Icon.close width={16} height={16}/></button>
        </div>
        <div className="modal-body">
          <p className="modal-prompt">{t('chat_admin_intro')}</p>

          {/* ---------- EXIT FEEDBACK SURVEY ---------- */}
          <div className="admin-section-label">{t('admin_exit_survey')}</div>
          {!feedbackLoaded ? (
            <p className="muted-line" style={{ margin: '0 0 14px' }}>{t('admin_loading')}</p>
          ) : feedbackStats.total === 0 ? (
            <p className="muted-line" style={{ margin: '0 0 14px' }}>{t('admin_no_feedback')}</p>
          ) : (
            <>
              <div className="feedback-stats-grid">
                <div className="feedback-stat-card feedback-stat-good">
                  <span className="feedback-stat-emoji">👍</span>
                  <span className="feedback-stat-value">{feedbackStats.good}</span>
                  <span className="feedback-stat-label">{t('feedback_good')}</span>
                  <span className="feedback-stat-pct">{feedbackStats.goodPct}%</span>
                </div>
                <div className="feedback-stat-card feedback-stat-ok">
                  <span className="feedback-stat-emoji">😐</span>
                  <span className="feedback-stat-value">{feedbackStats.notbad}</span>
                  <span className="feedback-stat-label">{t('feedback_notbad')}</span>
                  <span className="feedback-stat-pct">{feedbackStats.notbadPct}%</span>
                </div>
                <div className="feedback-stat-card feedback-stat-bad">
                  <span className="feedback-stat-emoji">👎</span>
                  <span className="feedback-stat-value">{feedbackStats.bad}</span>
                  <span className="feedback-stat-label">{t('feedback_bad')}</span>
                  <span className="feedback-stat-pct">{feedbackStats.badPct}%</span>
                </div>
              </div>
              <div className="feedback-summary-row">
                <span><b>{feedbackStats.total}</b> {t('admin_total')}</span>
                <span>·</span>
                <span><b>{feedbackStats.recent}</b> {t('admin_last_7')}</span>
                <span>·</span>
                <span>{t('admin_satisfaction')} <b>{feedbackStats.score}</b>/100</span>
              </div>
            </>
          )}

          <div className="admin-section-label">{t('chat_admin_users_label')}</div>
          {userStats.length === 0 ? (
            <p className="muted-line" style={{ margin: '0 0 14px' }}>{t('chat_admin_no_users')}</p>
          ) : (
            <div className="admin-list">
              {userStats.map(u => (
                <div className="admin-list-row" key={u.name}>
                  <span className="admin-list-name">{u.name}</span>
                  <span className="admin-list-count">{u.count} {t('chat_admin_messages_suffix')}</span>
                  <button className="dkp-btn-danger" type="button" disabled={busy} onClick={() => askBan(u.name)}>
                    {t('chat_admin_ban_btn')}
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="admin-section-label">{t('chat_admin_banned_label')}</div>
          {bannedList.length === 0 ? (
            <p className="muted-line" style={{ margin: 0 }}>{t('chat_admin_no_banned')}</p>
          ) : (
            <div className="admin-list">
              {bannedList.map(key => (
                <div className="admin-list-row" key={key}>
                  <span className="admin-list-name">{key}</span>
                  <button className="dkp-btn-secondary" type="button" disabled={busy} onClick={() => askUnban(key)}>
                    {t('chat_admin_unban_btn')}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {confirmAction && (
        <div className="modal-overlay" onClick={() => setConfirmAction(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{t('confirm_action_title')}</h3>
              <button className="modal-x" onClick={() => setConfirmAction(null)}><Icon.close width={16} height={16}/></button>
            </div>
            <div className="modal-body">
              <p className="modal-prompt">{confirmAction.message}</p>
              <div className="modal-actions">
                <button className="btn-secondary" onClick={() => setConfirmAction(null)}>{t('cancel_btn')}</button>
                <button className="btn-danger" onClick={confirmAction.run} disabled={busy}>{t('remove_btn')}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* =====================================================================
   APP
   ===================================================================== */

/* =====================================================================
   KINGDOM ACTIVITY — Farms & Alliance Help leaderboard + Barbarian Fort
   ===================================================================== */

const ACTIVITY_URL = 'https://xtit-dkp-tracker-default-rtdb.firebaseio.com/kingdom_activity.json';
const ACTIVITY_POLL_MS = 30000;

const ACTIVITY_COLUMN_ALIASES = {
  id:        ['character id', 'governor id', 'id'],
  username:  ['username', 'name', 'governor name'],
  helps:     ['alliance helps', 'alliance help', 'helps'],
  resources: ['resources gathered', 'resources'],
};

const ActivityIcon = p => (
  <svg viewBox="0 0 24 24" fill="none" {...p}>
    <path d="M3 20h18M6 20v-6M12 20V6M18 20v-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

async function parseActivityFile(file) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  if (!rows.length) throw new Error('File is empty');

  const header = rows[0];
  const col = {};
  Object.keys(ACTIVITY_COLUMN_ALIASES).forEach(k => {
    col[k] = findColumnIndex(header, ACTIVITY_COLUMN_ALIASES[k]);
  });
  if (col.id === -1 || col.username === -1) {
    throw new Error('Could not find Character ID / Username columns in this file');
  }
  if (col.helps === -1 && col.resources === -1) {
    throw new Error('Could not find Alliance Helps or Resources Gathered columns in this file');
  }

  const toNum = v => {
    const n = parseInt(String(v).replace(/[^\d-]/g, ''), 10);
    return Number.isFinite(n) ? n : 0;
  };

  const players = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r[col.id] === '' || r[col.id] === undefined) continue;
    players.push({
      id:        String(r[col.id]).trim(),
      name:      String(r[col.username] ?? '').trim(),
      helps:     col.helps     !== -1 ? toNum(r[col.helps])     : 0,
      resources: col.resources !== -1 ? toNum(r[col.resources]) : 0,
    });
  }
  if (players.length === 0) throw new Error('No player rows found in this file');
  return { players, missingHelps: col.helps === -1, missingResources: col.resources === -1 };
}

async function loadActivityRemote() {
  try {
    const res = await fetch(ACTIVITY_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error('Activity fetch failed: ' + res.status);
    const d = await res.json();
    if (!d) return { snapshots: {} };

    // New multi-snapshot format: { snapshots: { date: { players: [...] } } }
    if (d.snapshots && typeof d.snapshots === 'object') {
      const cleaned = {};
      Object.entries(d.snapshots).forEach(([date, snap]) => {
        if (snap && snap.players) {
          cleaned[date] = {
            players: Array.isArray(snap.players) ? snap.players : Object.values(snap.players),
          };
        }
      });
      return { snapshots: cleaned };
    }

    // Legacy single-snapshot format: { date, players }
    if (d.date && d.players) {
      return { snapshots: { [d.date]: { players: Object.values(d.players) } } };
    }

    return { snapshots: {} };
  } catch (e) {
    return null;
  }
}

async function saveActivityRemote(payload) {
  try {
    const res = await fetch(ACTIVITY_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch (e) {
    return false;
  }
}

function ActivityPanel() {
  const { t } = useT();
  const { isOwner, requireOwnerLogin } = useOwner();
  const [tab, setTab]                 = useState('farms');
  const [snapshots, setSnapshots]     = useState({});   // { date: { players: [] } }
  const [fromDate, setFromDate]       = useState('');
  const [toDate, setToDate]           = useState('');
  const [loaded, setLoaded]           = useState(false);
  const [uploadDate, setUploadDate]   = useState(() => toISODate(new Date()));
  const [uploading, setUploading]     = useState(false);
  const [msg, setMsg]                 = useState(null);
  const [deletePrompt, setDeletePrompt] = useState(null); // { date }
  const [deleting, setDeleting]         = useState(false);
  const [search, setSearch]           = useState('');
  const [sortKey, setSortKey]         = useState('helpsGained');
  const [visibleCount, setVisibleCount] = useState(50);
  const fileRef = useRef(null);
  const tableScrollRef = useRef(null);
  const slideLockRef = useRef(false);

  const slideTable = (dir) => {
    const el = tableScrollRef.current;
    if (!el || slideLockRef.current) return;
    const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
    const target = Math.min(maxScroll, Math.max(0, el.scrollLeft + dir * 200));
    slideLockRef.current = true;
    el.scrollTo({ left: target, behavior: 'smooth' });
    setTimeout(() => { slideLockRef.current = false; }, 260);
  };

  // Load shared snapshots, keep polling so everyone sees new uploads
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const remote = await loadActivityRemote();
      if (cancelled || !remote) return;
      setSnapshots(remote.snapshots || {});
      setLoaded(true);
    };
    load();
    const id = setInterval(load, ACTIVITY_POLL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const dates = useMemo(() => Object.keys(snapshots).sort(), [snapshots]);

  // Auto-select sensible From / To defaults whenever the snapshot list changes
  useEffect(() => {
    if (dates.length === 0) return;
    const fromValid = fromDate && dates.includes(fromDate);
    const toValid   = toDate   && dates.includes(toDate);
    if (fromValid && toValid) return;
    if (dates.length === 1) {
      if (!fromValid) setFromDate(dates[0]);
      if (!toValid)   setToDate(dates[0]);
    } else {
      if (!fromValid) setFromDate(dates[dates.length - 2]);
      if (!toValid)   setToDate(dates[dates.length - 1]);
    }
  }, [dates]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setVisibleCount(50); }, [search, sortKey, fromDate, toDate]);

  const actSnapListRef = useCallback((el) => {
    if (el) el.scrollTop = el.scrollHeight;
  }, [dates.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const fromPlayers = useMemo(() => {
    const snap = snapshots[fromDate];
    const arr = snap && Array.isArray(snap.players) ? snap.players : [];
    return Object.fromEntries(arr.map(p => [p.id, p]));
  }, [snapshots, fromDate]);

  const toPlayers = useMemo(() => {
    const snap = snapshots[toDate];
    const arr = snap && Array.isArray(snap.players) ? snap.players : [];
    return Object.fromEntries(arr.map(p => [p.id, p]));
  }, [snapshots, toDate]);

  const rows = useMemo(() => {
    const ids = new Set([...Object.keys(fromPlayers), ...Object.keys(toPlayers)]);
    const out = [];
    ids.forEach(id => {
      const a = fromPlayers[id];
      const b = toPlayers[id];
      const cur = b || a;
      if (!cur) return;
      const both = !!a && !!b;
      out.push({
        id,
        name: cur.name,
        helps: b ? (b.helps || 0) : (a ? (a.helps || 0) : 0),
        resources: b ? (b.resources || 0) : (a ? (a.resources || 0) : 0),
        helpsGained:     both ? ((b.helps || 0) - (a.helps || 0)) : null,
        resourcesGained: both ? ((b.resources || 0) - (a.resources || 0)) : null,
        inFrom: !!a,
        inTo: !!b,
      });
    });
    const q = search.trim().toLowerCase();
    const filtered = q ? out.filter(r => (r.name || '').toLowerCase().includes(q) || String(r.id).includes(q)) : out;
    return filtered.sort((x, y) => {
      const xv = (x[sortKey] === null || x[sortKey] === undefined) ? -Infinity : x[sortKey];
      const yv = (y[sortKey] === null || y[sortKey] === undefined) ? -Infinity : y[sortKey];
      if (xv === yv) return 0;
      return yv > xv ? 1 : -1;
    });
  }, [fromPlayers, toPlayers, search, sortKey]);

  const totals = useMemo(() => ({
    players:   rows.length,
    helps:     rows.reduce((s, r) => s + (r.helps || 0), 0),
    resources: rows.reduce((s, r) => s + (r.resources || 0), 0),
  }), [rows]);

  const triggerUpload = () => { if (fileRef.current) fileRef.current.click(); };

  const performDeleteActivity = async (dateToRemove) => {
    setDeleting(true);
    const fresh = await loadActivityRemote();
    if (!fresh) { setDeleting(false); setDeletePrompt(null); return; }
    const next = { ...fresh.snapshots };
    delete next[dateToRemove];
    setSnapshots(next);
    if (fromDate === dateToRemove) setFromDate('');
    if (toDate   === dateToRemove) setToDate('');
    await saveActivityRemote({ snapshots: next });
    setDeleting(false);
    setDeletePrompt(null);
  };

  const onFileChosen = async e => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    setMsg(null);
    try {
      const { players: newPlayers, missingHelps, missingResources } = await parseActivityFile(file);
      const fresh = await loadActivityRemote();
      if (!fresh) throw new Error('Could not reach the database. Nothing was changed, try again.');
      const next = { ...fresh.snapshots, [uploadDate]: { players: newPlayers } };
      setSnapshots(next);
      // Auto-update To (and From if empty) so the user immediately sees their new upload
      setToDate(uploadDate);
      if (!fromDate) setFromDate(uploadDate);
      setLoaded(true);
      const saved = await saveActivityRemote({ snapshots: next });
      const loadedText = t('activity_loaded')
        .replace('{count}', formatCount(newPlayers.length))
        .replace('{date}', uploadDate);
      const notes = (missingHelps ? t('activity_missing_helps') : '') + (missingResources ? t('activity_missing_resources') : '');
      setMsg(saved
        ? { type: 'success', text: loadedText + notes }
        : { type: 'error', text: t('activity_save_failed') });
    } catch (err) {
      setMsg({ type: 'error', text: err.message || t('msg_could_not_read') });
    } finally {
      setUploading(false);
    }
  };

  const fmtGained = (v) => {
    if (v === null || v === undefined) return '—';
    return (v >= 0 ? '+' : '') + formatCount(v);
  };

  return (
    <div className="act-wrap">
      <div className="act-tabs" role="tablist">
        <button
          type="button" role="tab" aria-selected={tab === 'farms'}
          className={`act-tab${tab === 'farms' ? ' active' : ''}`}
          onClick={() => setTab('farms')}
        >
          {t('activity_tab_farms')}
        </button>
        <button
          type="button" role="tab" aria-selected={tab === 'fort'}
          className={`act-tab${tab === 'fort' ? ' active' : ''}`}
          onClick={() => setTab('fort')}
        >
          {t('activity_tab_fort')}
        </button>
      </div>

      {tab === 'farms' && (
        <>
          {isOwner ? (
            <div className="dkp-scan-card">
              <div className="dkp-scan-top"><span className="pill upcoming">{t('owner_only')}</span></div>
              <p className="dkp-scan-desc">{t('activity_upload_desc')}</p>
              <div className="dkp-scan-actions">
                <input
                  type="date" className="dkp-name-input"
                  value={uploadDate} onChange={e => setUploadDate(e.target.value)}
                />
                <button className="btn-primary" type="button" onClick={triggerUpload} disabled={uploading}>
                  {uploading ? t('activity_uploading') : t('activity_upload_btn')}
                </button>
                <input
                  ref={fileRef} type="file" accept=".xlsx,.xls,.csv"
                  style={{ display: 'none' }} onChange={onFileChosen}
                />
              </div>
              {msg && (
                <p className="muted-line" style={{ color: msg.type === 'error' ? 'var(--danger)' : 'var(--live)', marginTop: 10, marginBottom: 0 }}>
                  {msg.text}
                </p>
              )}
            </div>
          ) : (
            <button type="button" className="act-owner-link" onClick={() => requireOwnerLogin()}>
              {t('activity_owner_login')}
            </button>
          )}

          {/* Snapshot list — owner can delete */}
          {dates.length > 0 && (
            <div className="dkp-scan-card">
              <div className="dkp-scan-top" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="pill done">{t('snapshots_label')}</span>
                <span className="muted-line" style={{ margin: 0, fontSize: '0.75rem' }}>{dates.length} {t('total_suffix')}</span>
              </div>
              <div className="dkp-snapshot-list" ref={actSnapListRef}>
                {dates.map(d => (
                  <div key={d} className="dkp-snapshot-item">
                    <span className="dkp-snapshot-date" style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d}</span>
                    </span>
                    <span className="dkp-snapshot-count">
                      {formatCount((snapshots[d].players || []).length)} {t('governors_suffix')}
                    </span>
                    {isOwner && (
                      <button
                        className="dkp-snapshot-remove"
                        type="button"
                        onClick={() => setDeletePrompt({ date: d })}
                        title={t('title_remove').replace('{date}', d)}
                      >
                        <Icon.close width={14} height={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Filter bar — From / To / Sort By / Search */}
          {dates.length > 0 && (
            <div className="dkp-scan-card">
              <div className="dkp-scan-actions" style={{ flexWrap: 'wrap' }}>
                <label className="muted-line" style={{ margin: 0 }}>
                  {t('from_label')}{' '}
                  <select className="dkp-name-input" style={{ display: 'inline-block', width: 'auto' }} value={fromDate} onChange={e => setFromDate(e.target.value)}>
                    {dates.map(d => (<option key={d} value={d}>{d}</option>))}
                  </select>
                </label>
                <label className="muted-line" style={{ margin: 0 }}>
                  {t('to_label')}{' '}
                  <select className="dkp-name-input" style={{ display: 'inline-block', width: 'auto' }} value={toDate} onChange={e => setToDate(e.target.value)}>
                    {dates.map(d => (<option key={d} value={d}>{d}</option>))}
                  </select>
                </label>
                <label className="muted-line" style={{ margin: 0 }}>
                  {t('sort_label')}{' '}
                  <select className="dkp-name-input" style={{ display: 'inline-block', width: 'auto' }} value={sortKey} onChange={e => setSortKey(e.target.value)}>
                    <option value="helpsGained">{t('activity_col_helps_gained')}</option>
                    <option value="resourcesGained">{t('activity_col_resources_gained')}</option>
                    <option value="helps">{t('activity_total_helps')}</option>
                    <option value="resources">{t('activity_total_resources')}</option>
                  </select>
                </label>
                <input
                  type="text"
                  className="dkp-name-input"
                  placeholder={t('activity_search')}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
            </div>
          )}

          {!loaded ? (
            <p className="muted-line">{t('chat_loading')}</p>
          ) : dates.length === 0 ? (
            <p className="muted-line">{t('activity_no_data')}</p>
          ) : (
            <>
              <div className="act-summary-header">
                <span className="act-summary-header-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" width={16} height={16}>
                    <path d="M3 20h18M6 20v-6M12 20V6M18 20v-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </span>
                <span className="act-summary-header-text">
                  {t('activity_whole_kingdom')}
                </span>
                <span className="act-summary-header-rule" aria-hidden="true" />
              </div>
              <div className="dkp-summary-grid">
                <div className="dkp-summary-card">
                  <span className="dkp-summary-label">{t('activity_players')}</span>
                  <span className="dkp-summary-value">{formatCount(totals.players)}</span>
                  {toDate && <span className="dkp-summary-sub">{t('activity_updated')} {toDate}</span>}
                </div>
                <div className="dkp-summary-card dkp-summary-top">
                  <span className="dkp-summary-label">{t('activity_total_helps')}</span>
                  <span className="dkp-summary-value accent">{formatCount(totals.helps)}</span>
                </div>
                <div className="dkp-summary-card">
                  <span className="dkp-summary-label">{t('activity_total_resources')}</span>
                  <span className="dkp-summary-value">{formatCount(totals.resources)}</span>
                </div>
              </div>

              <div className="dkp-table-nav">
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button type="button" onClick={() => slideTable(-1)}>{t('slide_left')}</button>
                  <button type="button" onClick={() => slideTable(1)}>{t('slide_right')}</button>
                </div>
              </div>

              <div className="dkp-table-scroll" ref={tableScrollRef}>
                <div className="act-table">
                  <div className="act-head">
                    <span>#</span>
                    <span>{t('col_governor')}</span>
                    <span>{t('activity_total_helps')}</span>
                    <span>{t('activity_total_resources')}</span>
                    <span>{t('activity_col_helps_gained')}</span>
                    <span>{t('activity_col_resources_gained')}</span>
                  </div>

                  {rows.length === 0 ? (
                    <p className="act-empty">{t('activity_no_results')}</p>
                  ) : (
                    rows.slice(0, visibleCount).map((p, i) => (
                      <div className="act-row" key={p.id}>
                        <span className={`dkp-rank${i < 3 && !search.trim() ? ' top' + (i + 1) : ''}`}>{i + 1}</span>
                        <span className="act-name" title={p.id}>{p.name}</span>
                        <span className="act-num">{formatCount(p.helps)}</span>
                        <span className="act-num">{formatCount(p.resources)}</span>
                        <span className={`act-gained${p.helpsGained !== null && p.helpsGained < 0 ? ' neg' : ''}`}>{fmtGained(p.helpsGained)}</span>
                        <span className={`act-gained${p.resourcesGained !== null && p.resourcesGained < 0 ? ' neg' : ''}`}>{fmtGained(p.resourcesGained)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {visibleCount < rows.length && (
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <button type="button" className="btn-primary" onClick={() => setVisibleCount(v => v + 50)}>
                    {t('load_more')} ({formatCount(rows.length - visibleCount)} {t('remaining_suffix')})
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}

      {tab === 'fort' && <FortPanel />}

      {deletePrompt && (
        <div className="modal-overlay" onClick={() => setDeletePrompt(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{t('confirm_action_title')}</h3>
              <button className="modal-x" onClick={() => setDeletePrompt(null)}>
                <Icon.close width={16} height={16}/>
              </button>
            </div>
            <div className="modal-body">
              <p className="modal-prompt">
                {t('confirm_remove_snapshot').replace('{date}', deletePrompt.date)}
              </p>
              <div className="modal-actions">
                <button className="btn-secondary" onClick={() => setDeletePrompt(null)}>{t('cancel_btn')}</button>
                <button className="btn-danger" onClick={() => performDeleteActivity(deletePrompt.date)} disabled={deleting}>
                  {t('remove_btn')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* =====================================================================
   BARBARIAN FORT — screenshot OCR leaderboard
   ===================================================================== */

const FORT_URL      = 'https://xtit-dkp-tracker-default-rtdb.firebaseio.com/barbarian_fort.json';
const FORT_POLL_MS  = 30000;
const TESSERACT_SRC = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';

const FORT_OCR_LANGS = [
  { value: 'eng+jpn+chi_sim+chi_tra+kor+rus', labelKey: 'fort_lang_all' }
];

const PencilIcon = p => (
  <svg viewBox="0 0 24 24" fill="none" {...p}>
    <path d="M4 20h4L19 9l-4-4L4 16v4Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
    <path d="M13.5 6.5l4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

/* ---------- load the OCR engine on demand ---------- */
let tesseractPromise = null;
function loadTesseract() {
  if (typeof window !== 'undefined' && window.Tesseract) return Promise.resolve(window.Tesseract);
  if (tesseractPromise) return tesseractPromise;
  tesseractPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = TESSERACT_SRC;
    s.async = true;
    s.onload = () => (window.Tesseract ? resolve(window.Tesseract) : reject(new Error('OCR engine failed to load')));
    s.onerror = () => { tesseractPromise = null; reject(new Error('Could not load the OCR engine. Check your connection.')); };
    document.head.appendChild(s);
  });
  return tesseractPromise;
}

/* ---------- image prep: upscale + turn white UI text into black-on-white ---------- */
async function fortPrepareImage(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('Could not open ' + file.name));
      i.src = url;
    });
    const origW = img.naturalWidth, origH = img.naturalHeight;
    const scale = Math.min(2, Math.max(0.4, 2000 / origW));
    const width = Math.round(origW * scale), height = Math.round(origH * scale);
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, width, height);
    const frame = ctx.getImageData(0, 0, width, height);
    const px = frame.data;
    for (let i = 0; i < px.length; i += 4) {
      // White text has high R, G AND B; the blue background has a low red channel.
      const v = Math.min(px[i], px[i + 1], px[i + 2]);
      const tt = Math.min(1, Math.max(0, (v - 100) / 80));
      const out = 255 - Math.round(tt * 255);
      px[i] = px[i + 1] = px[i + 2] = out;
      px[i + 3] = 255;
    }
    ctx.putImageData(frame, 0, 0);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    return { blob, width, height, origW, origH };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/* ---------- turn OCR words into { name, forts } rows ---------- */
const FORT_CJK = /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/;
const FORT_DIGIT_FIX = { O: '0', o: '0', l: '1', I: '1', '|': '1', S: '5', B: '8', g: '9' };

function fortJoinWords(parts) {
  let out = '';
  parts.forEach((p, i) => {
    if (i === 0) { out = p.text; return; }
    const prev = parts[i - 1];
    const tight = (FORT_CJK.test(prev.text.slice(-1)) || FORT_CJK.test(p.text.charAt(0)))
      && (p.x0 - prev.x1) < prev.h * 0.18;
    out += (tight ? '' : ' ') + p.text;
  });
  return out.replace(/\s+/g, ' ').trim();
}

function parseFortRows(rawWords, W) {
  const words = (rawWords || [])
    .map(w => {
      const b = w.bbox || {};
      return {
        text: String(w.text || '').trim(),
        conf: (typeof w.confidence === 'number') ? w.confidence : (w.conf || 60),
        x0: b.x0, x1: b.x1, y0: b.y0, y1: b.y1,
        cx: (b.x0 + b.x1) / 2, cy: (b.y0 + b.y1) / 2,
        h: Math.max(1, b.y1 - b.y0),
      };
    })
    .filter(w =>
      w.text &&
      Number.isFinite(w.cx) && Number.isFinite(w.cy) &&
      Number.isFinite(w.x0) && Number.isFinite(w.x1)
    );

  if (words.length === 0) return [];

  // Whole-image row-height estimate (used as a sanity check).
  const allH = words.map(w => w.h).sort((a, b) => a - b);
  const medianH = allH[Math.floor(allH.length / 2)] || 20;

  const toInt = (txt) => {
    const s = String(txt).replace(/[,.\s]/g, '');
    if (!s) return null;
    let fixed = '';
    for (const ch of s) fixed += (/\d/.test(ch) ? ch : (FORT_DIGIT_FIX[ch] || ch));
    if (!/^\d{1,5}$/.test(fixed)) return null;
    return parseInt(fixed, 10);
  };

  // ------------------------------------------------------------------
  // Step 1 — find every fort-count on the right side of the image.
  // This includes handling the "one tall vertical blob" case where
  // Tesseract reads 9,7,6,5,4,3 as a single long token.
  // ------------------------------------------------------------------
  const rightMin = W * 0.45;   // anything to the right of this is a candidate
  const rightWords = words.filter(w => w.cx > rightMin);

  const candidates = [];
  rightWords.forEach(w => {
    // Case A: the whole token is one number.
    const direct = toInt(w.text);
    if (direct !== null && direct > 0 && w.h < medianH * 2.0) {
      candidates.push({ w, n: direct });
      return;
    }

    // Case B: merged vertical blob — split its digits across its height.
    if (w.h < medianH * 1.8) return;
    const digitChars = [];
    for (const ch of String(w.text)) {
      if (/\d/.test(ch)) digitChars.push(ch);
      else if (FORT_DIGIT_FIX[ch]) digitChars.push(FORT_DIGIT_FIX[ch]);
    }
    if (digitChars.length < 2 || digitChars.length > 20) return;
    const step = w.h / digitChars.length;
    digitChars.forEach((ch, i) => {
      const n = parseInt(ch, 10);
      if (!Number.isFinite(n) || n <= 0) return;
      candidates.push({
        w: { ...w, cy: w.y0 + step * (i + 0.5), h: step },
        n,
      });
    });
  });

  // Sort candidates top-to-bottom.
  candidates.sort((a, b) => a.w.cy - b.w.cy);

  // ------------------------------------------------------------------
  // Step 2 — group the candidates into distinct rows.
  // Use adaptive tolerance: at least half a median word height, so
  // even when rows are very close together they still stay separate.
  // ------------------------------------------------------------------
  const yTol = Math.max(medianH * 0.55, 8);
  const counts = [];
  candidates.forEach(c => {
    const last = counts[counts.length - 1];
    if (last && Math.abs(c.w.cy - last.w.cy) <= yTol) {
      if (c.w.cx > last.w.cx) counts[counts.length - 1] = c;
    } else {
      counts.push(c);
    }
  });

  if (counts.length === 0) return [];

  // ------------------------------------------------------------------
  // Step 3 — estimate row pitch (distance between two fort-count rows).
  // ------------------------------------------------------------------
  let pitch;
  if (counts.length >= 2) {
    const gaps = [];
    for (let i = 1; i < counts.length; i++) gaps.push(counts[i].w.cy - counts[i - 1].w.cy);
    gaps.sort((a, b) => a - b);
    pitch = gaps[Math.floor(gaps.length / 2)];
  } else {
    pitch = medianH * 5;
  }

  // ------------------------------------------------------------------
  // Step 4 — attach a name to each fort-count row.
  // Walk words on the same horizontal band. Skip avatars (left of
  // the name column), skip the fort-count token itself, skip pure
  // symbols. Keep every readable Latin / CJK / digit chunk.
  // ------------------------------------------------------------------
  const nameLeft  = W * 0.11;      // avatars occupy roughly 0–11% of the width
  const nameRightPad = W * 0.015;  // gap between name and fort-count
  const bandTol   = Math.max(pitch * 0.45, medianH * 1.2);

  const rows = [];
  counts.forEach(c => {
    const parts = words
      .filter(w =>
        w !== c.w &&
        w.cx >= nameLeft &&
        w.cx <= c.w.x0 - nameRightPad &&
        Math.abs(w.cy - c.w.cy) <= bandTol &&
        /[\p{L}\p{N}]/u.test(w.text)
      )
      .sort((a, b) => a.x0 - b.x0);

    let name = fortJoinWords(parts);
    // Strip leading/trailing junk punctuation.
    name = name.replace(/^[\s|_~\-–—.,:;]+/, '').replace(/[\s|_~\-–—.,:;]+$/, '').trim();
    // Strip a lone trailing level code like "OD " or "K1 " (RoK puts these
    // before/after names, not part of the identity).
    if (name.length >= 2) {
      rows.push({ name: name.slice(0, 40), forts: c.n });
    }
  });

  return rows;
}

/* Bulletproof fallback parser — uses the raw OCR text, one line at a time.
   Each ranking line looks like "1  ダンタイン  9" or "Kiss Me Baby 7".
   We just grab the trailing integer as the fort count and everything
   before it (minus a possible leading rank number) as the name. */
function parseFortRowsFromText(fullText) {
  if (!fullText || typeof fullText !== 'string') return [];
  const lines = fullText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const rows = [];
  lines.forEach(line => {
    const m = line.match(/^(.*?)[\s\t.]+(\d{1,4})\s*$/);
    if (!m) return;
    let name = m[1].trim();
    const forts = parseInt(m[2], 10);
    if (!Number.isFinite(forts) || forts <= 0) return;
    if (!name) return;

    // Strip a leading rank number ("1", "1.", "1)") from the name.
    name = name.replace(/^\d{1,3}[\s.)\-]+/, '').trim();
    if (name.length < 1) return;

    // Skip header / label noise that Tesseract sometimes returns.
    const lower = name.toLowerCase();
    if (lower === 'name') return;
    if (lower.startsWith('forts')) return;
    if (lower === 'forts destroyed') return;
    if (lower === 'name of governor') return;
    if (lower === 'ranking') return;
    if (/^\d+$/.test(name)) return; // just a number, no name

    rows.push({ name: name.slice(0, 40), forts });
  });
  return rows;
}

async function scanFortScreenshot(worker, file) {
  const info = await fortPrepareImage(file);

  // Try the preprocessed image first, then fall back to the raw file.
  // For each attempt, try `words` first, and if that yields nothing,
  // try `lines` (some Tesseract builds populate lines but not words).
  const tryOnce = async (src, width) => {
    const r = await worker.recognize(src);
    const data = r && r.data ? r.data : {};

    // Collect candidate tokens from words OR lines.
    let raw = [];
    if (Array.isArray(data.words) && data.words.length) {
      raw = data.words;
    } else if (Array.isArray(data.lines) && data.lines.length) {
      // Lines have bbox on the whole line; we still want word-level
      // granularity, so break each line's text into pseudo-words
      // spread evenly across the line's bbox.
      raw = [];
      data.lines.forEach(line => {
        const b = line.bbox || {};
        const txt = String(line.text || '').trim();
        if (!txt || !b.x0) return;
        const chunks = txt.split(/\s+/).filter(Boolean);
        if (chunks.length === 0) return;
        const totalLen = chunks.reduce((s, c) => s + c.length, 0) || 1;
        let cx = b.x0;
        const lineW = b.x1 - b.x0;
        chunks.forEach(c => {
          const wFrac = c.length / totalLen;
          const wW = lineW * wFrac;
          raw.push({
            text: c,
            confidence: line.confidence || 60,
            bbox: { x0: cx, x1: cx + wW, y0: b.y0, y1: b.y1 },
          });
          cx += wW;
        });
      });
    }
    return parseFortRows(raw, width);
  };

  // For each image source, run BOTH parsers and keep the result that
  // returned the most rows. The word-based parser wins when it works
  // (it has real bboxes), but the text-based parser is the safety net
  // that catches every line even when Tesseract merges the column of
  // fort numbers into a single tall vertical token.
  const tryBoth = async (src, width) => {
    const r = await worker.recognize(src);
    const data = r && r.data ? r.data : {};

    // --- Word-level tokens ---
    let raw = [];
    if (Array.isArray(data.words) && data.words.length) {
      raw = data.words;
    } else if (Array.isArray(data.lines) && data.lines.length) {
      raw = [];
      data.lines.forEach(line => {
        const b = line.bbox || {};
        const txt = String(line.text || '').trim();
        if (!txt || !b.x0) return;
        const chunks = txt.split(/\s+/).filter(Boolean);
        if (chunks.length === 0) return;
        const totalLen = chunks.reduce((s, c) => s + c.length, 0) || 1;
        let cx = b.x0;
        const lineW = b.x1 - b.x0;
        chunks.forEach(c => {
          const wFrac = c.length / totalLen;
          const wW = lineW * wFrac;
          raw.push({
            text: c,
            confidence: line.confidence || 60,
            bbox: { x0: cx, x1: cx + wW, y0: b.y0, y1: b.y1 },
          });
          cx += wW;
        });
      });
    }
    let wordRows = [];
    try { wordRows = parseFortRows(raw, width); } catch (e) {}

    // --- Raw text lines ---
    let textRows = [];
    try { textRows = parseFortRowsFromText(data.text); } catch (e) {}

    // Word-parser wins ties (better name fidelity), but if the text
    // parser found MORE players, that's what we want.
    return wordRows.length >= textRows.length ? wordRows : textRows;
  };

  let rows = [];
  try { rows = await tryBoth(info.blob, info.width); } catch (e) {}

  if (rows.length === 0) {
    try { rows = await tryBoth(file, info.origW); } catch (e) {}
  }
  return rows;
}

/* ---------- combine players (same player in many screenshots = one row) ---------- */
function fortKey(name) {
  return String(name || '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

function fortSimilarity(a, b) {
  if (a === b) return 1;
  if (!a || !b) return 0;
  const m = a.length, n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return 1 - prev[n] / Math.max(m, n);
}

function sortFortPlayers(list) {
  return [...list].sort((a, b) => (b.forts - a.forts) || String(a.name).localeCompare(String(b.name)));
}

/* Builds a { normalizedUsername -> { id, username } } lookup from every
   DKP/Activity snapshot, so Fort OCR results can be matched to a real
   governor ID instead of relying purely on fuzzy name matching. */
function buildGovernorLookup(dkpState) {
  if (!dkpState || !dkpState.snapshots) return {};
  const lookup = {};
  Object.keys(dkpState.snapshots).sort().forEach(date => {
    const snap = dkpState.snapshots[date];
    Object.values(snap).forEach(g => {
      if (g && g.username) {
        lookup[fortKey(g.username)] = { id: g.id, username: g.username };
      }
    });
  });
  return lookup;
}

function mergeFortPlayers(existing, incoming, mode, govLookup) {
  const list = existing.map(p => ({ ...p }));
  let added = 0, updated = 0;

  // Pre-calculate keys for the governor lookup for faster iteration
  const govKeys = govLookup ? Object.keys(govLookup) : [];

  incoming.forEach(inc => {
    const k = fortKey(inc.name);
    if (!k) return;

    let bestGovMatch = null;
    let bestGovScore = 0;

    // 1. Search the entire uploaded Excel database for the closest match
    if (govKeys.length > 0) {
      govKeys.forEach(govKey => {
        const score = fortSimilarity(k, govKey);
        // Lower threshold for OCR mismatches (e.g., 0.65), but stricter for short names
        const threshold = Math.min(k.length, govKey.length) >= 5 ? 0.65 : 0.8;
        if (score >= threshold && score > bestGovScore) {
          bestGovScore = score;
          bestGovMatch = govLookup[govKey];
        }
      });
    }

    // If we found a strong match in the kingdom database, use its exact name & ID.
    // Otherwise, keep the OCR-read name as-is instead of discarding the player —
    // discarding unmatched players was causing screenshots with several
    // players to only save one (the sole one that happened to fuzzy-match).
    const incGovId = bestGovMatch ? bestGovMatch.id : null;
    const incName  = bestGovMatch ? bestGovMatch.username : inc.name;

    let bestRow = null;
    let bestRowScore = 0;

    // 2. Try to match this against rows ALREADY in the Fort leaderboard
    if (incGovId) {
      bestRow = list.find(p => p.governorId === incGovId) || null;
      if (bestRow) bestRowScore = 1; // Exact ID match
    }

    if (!bestRow) {
      // Fall back to fuzzy name matching against existing rows
      list.forEach(p => {
        const pk = fortKey(p.name);
        const s = fortSimilarity(fortKey(incName), pk);
        const need = Math.min(fortKey(incName).length, pk.length) >= 5 ? 0.8 : 1;
        if (s >= need && s > bestRowScore) { 
          bestRow = p; 
          bestRowScore = s; 
        }
      });
    }

    if (bestRow) {
      const before = bestRow.forts;
      bestRow.forts = mode === 'add' ? bestRow.forts + inc.forts : Math.max(bestRow.forts, inc.forts);
      if (incGovId && !bestRow.governorId) bestRow.governorId = incGovId;
      if (bestGovMatch) bestRow.name = incName; // Adopt canonical name from Excel
      if (bestRow.forts !== before) updated++;
    } else {
      list.push({ 
        name: incName, 
        forts: inc.forts, 
        ...(incGovId ? { governorId: incGovId } : {}) 
      });
      added++;
    }
  });

  return { list: sortFortPlayers(list), added, updated };
}

/* ---------- shared storage (Firebase, same as the rest of the site) ---------- */
async function loadFortRemote() {
  try {
    const res = await fetch(FORT_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error('Fort fetch failed: ' + res.status);
    const d = await res.json();
    if (!d || !d.players) return { players: [], updatedAt: (d && d.updatedAt) || null };
    const arr = Array.isArray(d.players) ? d.players : Object.values(d.players);
    return {
      players: sortFortPlayers(arr.filter(p => p && p.name).map(p => normalizeFortPlayer(p))),
      updatedAt: d.updatedAt || null,
    };
  } catch (e) {
    return null;
  }
}

async function saveFortRemote(players) {
  try {
    const res = await fetch(FORT_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ players, updatedAt: Date.now() }),
    });
    return res.ok;
  } catch (e) {
    return false;
  }
}

/* ---------- Fort Governor Reference (for OCR matching) ---------- */
const FORT_REF_URL = 'https://xtit-dkp-tracker-default-rtdb.firebaseio.com/fort_governor_ref.json';

async function loadFortRefRemote() {
  try {
    const res = await fetch(FORT_REF_URL, { cache: 'no-store' });
    if (res.status === 404) return {};
    if (!res.ok) throw new Error('Ref fetch failed');
    const d = await res.json();
    return d && typeof d === 'object' ? d : {};
  } catch (e) {
    return {};
  }
}

async function saveFortRefRemote(refs) {
  try {
    const res = await fetch(FORT_REF_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(refs),
    });
    return res.ok;
  } catch (e) {
    return false;
  }
}

function fortHue(name) {
  let h = 0;
  for (const ch of String(name)) h = (h * 31 + ch.codePointAt(0)) % 360;
  return h;
}

/* ---------- WEEK HELPERS ---------- */
// Monday 00:00 UTC of the week containing `date`, as "YYYY-MM-DD".
function getWeekKey(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay();             // 0=Sun, 1=Mon, ...
  const diff = day === 0 ? -6 : 1 - day; // days back to Monday
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}
function getCurrentWeekKey() {
  return getWeekKey(new Date());
}
function formatWeekLabel(weekKey) {
  if (weekKey === 'all')    return 'All Weeks';
  if (weekKey === 'legacy') return 'Legacy — no week';
  const monday = new Date(weekKey + 'T00:00:00Z');
  const sunday = new Date(monday.getTime() + 6 * 86400000);
  const fmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  return `${fmt.format(monday)} – ${fmt.format(sunday)}`;
}
// Ensure a player entry has a weekly map. Legacy entries (no weekly data)
// get their total filed under a "legacy" bucket so nothing is lost.
function normalizeFortPlayer(p) {
  const raw = p || {};
  const weekly = (raw.weekly && typeof raw.weekly === 'object') ? { ...raw.weekly } : {};
  if (Object.keys(weekly).length === 0 && Number(raw.forts) > 0) {
    weekly['legacy'] = Number(raw.forts);
  }
  const total = Object.values(weekly).reduce((s, v) => s + (Number(v) || 0), 0);
  return {
    name: String(raw.name || ''),
    forts: total,
    weekly,
    alliance: String(raw.alliance || ''),
    deleted: !!raw.deleted,
    ...(raw.governorId ? { governorId: raw.governorId } : {}),
  };
}
function fortsInWeek(player, weekKey) {
  if (weekKey === 'all') return Number(player.forts) || 0;
  const w = player.weekly || {};
  return Number(w[weekKey]) || 0;
}

function getFortWeekOptions() {
  const options = [];
  const now = new Date();
  // Generate a range of weeks from 4 weeks ago to 8 weeks in the future
  for (let i = -4; i <= 8; i++) {
    const d = new Date(now.getTime() + i * 7 * 86400000);
    const weekKey = getWeekKey(d);
    if (!options.find(o => o.key === weekKey)) {
      options.push({ key: weekKey, label: formatWeekLabel(weekKey) });
    }
  }
  return options.sort((a, b) => a.key.localeCompare(b.key));
}

/* ---------- the panel ---------- */
function FortPanel() {
  const { t } = useT();
  const { isOwner } = useOwner();
  const [players, setPlayers]           = useState([]);
  const [updatedAt, setUpdatedAt]       = useState(null);
  const [loaded, setLoaded]             = useState(false);
  const [msg, setMsg]                   = useState(null);
  const [visibleCount, setVisibleCount] = useState(50);
  const [edit, setEdit]                 = useState(null);
  const [editAllianceSuggestOpen, setEditAllianceSuggestOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState(null);
  const [clearPrompt, setClearPrompt]   = useState(false);
  // Manual add-form state
  const [addName, setAddName]           = useState('');
  const [addAlliance, setAddAlliance]   = useState('');
  const [allianceSuggestOpen, setAllianceSuggestOpen] = useState(false);
  const [addForts, setAddForts]         = useState('');
  const [addGovId, setAddGovId]         = useState('');
  const [addWeek, setAddWeek]           = useState(() => getCurrentWeekKey());
  const [adding, setAdding]             = useState(false);
  const [currentWeekKey, setCurrentWeekKey] = useState(() => getCurrentWeekKey());
  const [searchQuery, setSearchQuery]   = useState('');
  const [allianceFilter, setAllianceFilter] = useState('all');
  const [showDeleted, setShowDeleted]   = useState(false);

  // Automatically update the current week highlight when the week rolls over.
  // Checks every minute so the border shifts without needing a page refresh.
  useEffect(() => {
    const interval = setInterval(() => {
      const newWeekKey = getCurrentWeekKey();
      if (newWeekKey !== currentWeekKey) {
        setCurrentWeekKey(newWeekKey);
      }
    }, 60000); // Check every 60 seconds
    return () => clearInterval(interval);
  }, [currentWeekKey]);
  const [selectedWeek, setSelectedWeek] = useState('all');

  /* ---- Fort-specific owner auth (uses FORT_OWNER_PASSWORD, not the
     main owner password) ---- */
  const [fortOwner, setFortOwner] = useState(() => {
    try { return sessionStorage.getItem(FORT_OWNER_SESSION_KEY) === '1'; } catch (e) { return false; }
  });
  const [fortPwPrompt, setFortPwPrompt] = useState(null);
  const [fortPwValue, setFortPwValue]   = useState('');
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);

  const requireFortLogin = async () => {
    // If the global owner is logged in, or the fort admin is already logged in, allow access.
    if (isOwner || fortOwner) return true;

    return new Promise((resolve) => {
      setFortPwValue('');
      setFortPwPrompt({
        error: null,
        onConfirm: (entered) => {
          // Accept EITHER the owner password (XTiT333) OR the admin password (2837)
          if (entered === OWNER_PASSWORD || entered === FORT_OWNER_PASSWORD) {
            try { sessionStorage.setItem(FORT_OWNER_SESSION_KEY, '1'); } catch (e) {}
            setFortOwner(true);
            setFortPwPrompt(null);
            resolve(true);
          } else {
            setFortPwPrompt(prev => ({ ...prev, error: t('err_incorrect_password') }));
          }
        },
        onCancel: () => { setFortPwPrompt(null); resolve(false); },
      });
    });
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const remote = await loadFortRemote();
      if (cancelled || !remote) return;
      setPlayers(remote.players.map(normalizeFortPlayer));
      setUpdatedAt(remote.updatedAt);
      setLoaded(true);
    };
    load();
    const id = setInterval(load, FORT_POLL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  // (Governor lookup / OCR reference file removed — the panel is manual now.)

  const persist = async (next) => {
    const normalized = next.map(normalizeFortPlayer);
    const sorted = sortFortPlayers(normalized);
    setPlayers(sorted);
    setLoaded(true);
    const ok = await saveFortRemote(sorted);
    if (ok) setUpdatedAt(Date.now());
    return ok;
  };

  /* Manual add — the owner types a governor name and fort count.
     If the same governor is already on the board (case-insensitive),
     we keep the HIGHER of the two fort counts instead of duplicating. */
  const addPlayer = async () => {
    const name     = addName.trim().slice(0, 40);
    const alliance = addAlliance.trim().slice(0, 40);
    const forts    = parseInt(addForts, 10);
    const govId    = addGovId.replace(/\D/g, '').slice(0, 15);
    // Snap the picked day to the Monday of its week
    const week     = addWeek
      ? getWeekKey(new Date(addWeek + 'T00:00:00Z'))
      : getCurrentWeekKey();
    if (!name || !Number.isFinite(forts) || forts < 0) {
      setMsg({ type: 'error', text: t('fort_add_invalid') });
      return;
    }
    setAdding(true);
    setMsg(null);

    // Start from freshest data so we never stomp on a concurrent edit.
    const remote = await loadFortRemote();
    const base   = (remote ? remote.players : players).map(normalizeFortPlayer);

    const key = fortKey(name);
    const idx = base.findIndex(p =>
      (govId && p.governorId && String(p.governorId) === govId) ||
      fortKey(p.name) === key
    );

    let next;
    if (idx !== -1) {
      // Same governor — ADD to that week's bucket (weeks can grow over time).
      next = base.map((p, i) => {
        if (i !== idx) return p;
        const weekly = { ...(p.weekly || {}) };
        weekly[week] = (Number(weekly[week]) || 0) + forts;
        const total = Object.values(weekly).reduce((s, v) => s + (Number(v) || 0), 0);
        return {
          ...p,
          name: name || p.name,
          alliance: alliance || p.alliance || '',
          ...(govId ? { governorId: govId } : {}),
          weekly,
          forts: total,
          deleted: false,
        };
      });
    } else {
      next = [...base, { name, alliance, forts, weekly: { [week]: forts }, deleted: false, ...(govId ? { governorId: govId } : {}) }];
    }

    const ok = await persist(next);
    setAdding(false);
    if (ok) {
      setAddName('');
      setAddAlliance('');
      setAddForts('');
      setAddGovId('');
      setMsg({
        type: 'success',
        text: (idx !== -1 ? t('fort_updated_msg') : t('fort_added_msg'))
          .replace('{name}', name)
          .replace('{forts}', String(forts)),
      });
    } else {
      setMsg({ type: 'error', text: t('fort_save_failed') });
    }
  };

  const saveEdit = async () => {
    if (!edit) return;
    const name     = edit.name.trim().slice(0, 40);
    const alliance = (edit.alliance || '').trim().slice(0, 40);
    const govId    = String(edit.governorId || '').replace(/\D/g, '').slice(0, 15);
    const forts    = parseInt(edit.forts, 10);
    if (!name || !Number.isFinite(forts) || forts < 0) return;
    const key = fortKey(edit.origName);
    const next = players.map(p => {
      if (fortKey(p.name) !== key) return p;
      const weekly = { ...(p.weekly || {}) };
      if (selectedWeek !== 'all') {
        weekly[selectedWeek] = forts;
      } else {
        const others = Object.entries(weekly)
          .filter(([k]) => k !== 'legacy')
          .reduce((s, [, v]) => s + (Number(v) || 0), 0);
        weekly.legacy = Math.max(0, forts - others);
      }
      return { ...p, name, alliance, weekly, governorId: govId };
    });
    setEdit(null);
    const ok = await persist(next);
    if (!ok) setMsg({ type: 'error', text: t('fort_save_failed') });
  };

  const removePlayer = async () => {
    const target = removeTarget;
    setRemoveTarget(null);
    if (!target) return;
    // Soft delete — mark as deleted so it can be restored later
    const next = players.map(p =>
     (fortKey(p.name) === fortKey(target.name))
        ? { ...p, deleted: true }
        : p
    );
    await persist(next);
  };

  const restorePlayer = async (player) => {
    const next = players.map(p =>
      (fortKey(p.name) === fortKey(player.name))
        ? { ...p, deleted: false }
        : p
    );
    await persist(next);
  };

  const clearAll = async () => {
    setClearPrompt(false);
    await persist([]);
  };

  /* ---------- EXPORT HELPERS (CSV / Excel / Clipboard / Share) ---------- */
  const fortFilenameBase = () => `barbarian-fort-${toISODate(new Date())}`;
  const getExportList = () => (fortPanelWeekRows || []).filter(p => !p.deleted);

  const buildFortCSV = () => {
    const esc = (s) => `"${String(s).replace(/"/g, '""')}"`;
    const lines = ['Rank,Name,Governor ID,Forts Destroyed'];
    getExportList().forEach((p, i) => lines.push(`${i + 1},${esc(p.name)},${esc(p.governorId || '')},${p.forts}`));
    return '\uFEFF' + lines.join('\r\n');
  };

  const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadCSV = () => {
    if (getExportList().length === 0) return;
    downloadBlob(
      new Blob([buildFortCSV()], { type: 'text/csv;charset=utf-8;' }),
      `${fortFilenameBase()}.csv`
    );
  };

  const downloadXLSX = () => {
    if (getExportList().length === 0) return;
    const rows = [['Rank', 'Name', 'Governor ID', 'Forts Destroyed']];
    getExportList().forEach((p, i) => rows.push([i + 1, p.name, p.governorId || '', p.forts]));
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 6 }, { wch: 30 }, { wch: 16 }, { wch: 16 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Barbarian Fort');
    XLSX.writeFile(wb, `${fortFilenameBase()}.xlsx`);
  };

  const copyFortToClipboard = async () => {
    if (getExportList().length === 0) return;
    const text = getExportList()
      .map((p, i) => `${i + 1}. ${p.name} — ${p.forts}`)
      .join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setMsg({ type: 'success', text: t('fort_copied_msg') });
      setTimeout(() => setMsg(null), 2500);
    } catch (e) {
      setMsg({ type: 'error', text: t('fort_copy_failed') });
      setTimeout(() => setMsg(null), 2500);
    }
  };

  const shareFortList = async () => {
    if (getExportList().length === 0) return;
    const csv = buildFortCSV();
    try {
      const file = new File([csv], `${fortFilenameBase()}.csv`, { type: 'text/csv' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: t('activity_tab_fort'),
        });
        return;
      }
      const text = getExportList().map((p, i) => `${i + 1}. ${p.name} — ${p.forts}`).join('\n');
      await navigator.share({ title: t('activity_tab_fort'), text });
    } catch (e) {
      /* user cancelled — silent */
    }
  };

  const canShareFiles = typeof navigator !== 'undefined'
    && typeof navigator.share === 'function';

  const fortUnlocked = isOwner || fortOwner;

  // Filled in by the week-filter IIFE just below; used by the row map.
  let fortPanelWeekRows = players;

  return (
    <div className="fort-wrap">
      {fortUnlocked ? (
        <div className="dkp-scan-card">
          <div className="dkp-scan-top"><span className="pill upcoming">{t('owner_only')}</span></div>
          <p className="dkp-scan-desc">{t('fort_add_desc')}</p>

          <div className="fort-add-form">
            <div className="fort-add-field fort-add-week">
              <label className="fort-add-label" htmlFor="fortAddWeek">{t('fort_week_label')}</label>
              <select
                id="fortAddWeek"
                className="dkp-name-input"
                value={addWeek}
                onChange={e => setAddWeek(e.target.value || getCurrentWeekKey())}
                disabled={adding}
              >
                {getFortWeekOptions().map(opt => {
                  const isCurrent = opt.key === currentWeekKey;
                  return (
                    <option
                      key={opt.key}
                      value={opt.key}
                      className={isCurrent ? 'current-week-option' : ''}
                      style={isCurrent ? {
                        fontWeight: 700,
                        color: '#F0A83B',
                        backgroundColor: 'rgba(240,168,59,0.18)',
                      } : undefined}
                    >
                      {opt.label}
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="fort-add-field fort-add-name">
              <label className="fort-add-label" htmlFor="fortAddName">{t('fort_governor_label')}</label>
              <input
                id="fortAddName"
                type="text"
                className="dkp-name-input"
                placeholder={t('fort_add_name_placeholder')}
                value={addName}
                onChange={e => setAddName(e.target.value)}
                maxLength={40}
                disabled={adding}
                onKeyDown={e => { if (e.key === 'Enter') addPlayer(); }}
              />
            </div>

            <div className="fort-add-field fort-add-govid">
              <label className="fort-add-label" htmlFor="fortAddGovId">{t('fort_gov_id_label')}</label>
              <input
                id="fortAddGovId"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                className="dkp-name-input"
                placeholder={t('fort_gov_id_placeholder')}
                value={addGovId}
                onChange={e => setAddGovId(e.target.value.replace(/\D/g, '').slice(0, 15))}
                disabled={adding}
                autoComplete="off"
                onKeyDown={e => { if (e.key === 'Enter') addPlayer(); }}
              />
            </div>

            <div className="fort-add-field fort-add-alliance">
              <label className="fort-add-label" htmlFor="fortAddAlliance">{t('fort_alliance_label')}</label>
              {(() => {
                // Live-filter the alliance list against what's being typed.
                // Tapping a suggestion fills the field instantly.
                const allAlliances = Array.from(
                  new Set(
                    players
                      .filter(p => !p.deleted)
                      .map(p => (p.alliance || '').trim())
                      .filter(Boolean)
                  )
                ).sort((a, b) => a.localeCompare(b));

                const q = addAlliance.trim().toLowerCase();
                const filteredAlliances = q
                  ? allAlliances.filter(a => a.toLowerCase().includes(q))
                  : allAlliances;

                const exactMatch = allAlliances.some(a => a.toLowerCase() === q);
                const showSuggestions =
                  allianceSuggestOpen &&
                  !adding &&
                  !exactMatch &&
                  filteredAlliances.length > 0;

                return (
                  <div className="fort-alliance-autocomplete">
                    <input
                      id="fortAddAlliance"
                      type="text"
                      className="dkp-name-input"
                      placeholder={t('fort_alliance_placeholder')}
                      value={addAlliance}
                      onChange={e => {
                        setAddAlliance(e.target.value);
                        setAllianceSuggestOpen(true);
                      }}
                      onFocus={() => setAllianceSuggestOpen(true)}
                      onBlur={() => {
                        // Delay so a click on a suggestion still registers.
                        setTimeout(() => setAllianceSuggestOpen(false), 120);
                      }}
                      maxLength={40}
                      disabled={adding}
                      autoComplete="off"
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          setAllianceSuggestOpen(false);
                          addPlayer();
                        } else if (e.key === 'Escape') {
                          setAllianceSuggestOpen(false);
                        }
                      }}
                    />
                    {showSuggestions && (
                      <div className="fort-alliance-suggest" role="listbox">
                        {filteredAlliances.map(a => (
                          <button
                            key={a}
                            type="button"
                            role="option"
                            className="fort-alliance-suggest-item"
                            onMouseDown={e => e.preventDefault()}
                            onClick={() => {
                              setAddAlliance(a);
                              setAllianceSuggestOpen(false);
                            }}
                          >
                            {a}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            <div className="fort-add-field fort-add-forts">
              <label className="fort-add-label" htmlFor="fortAddForts">{t('fort_forts_label_short')}</label>
              <input
                id="fortAddForts"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                className="dkp-name-input"
                placeholder={t('fort_add_forts_placeholder')}
                value={addForts}
                onChange={e => setAddForts(e.target.value.replace(/\D/g, '').slice(0, 5))}
                disabled={adding}
                onKeyDown={e => { if (e.key === 'Enter') addPlayer(); }}
              />
            </div>

            <div className="fort-add-field fort-add-submit">
              <span className="fort-add-label" aria-hidden="true">&nbsp;</span>
              <button
                className="btn-primary"
                type="button"
                onClick={addPlayer}
                disabled={adding || !addName.trim() || !addForts}
              >
                <Icon.plus width={14} height={14} />
                <span>{t('fort_add_btn')}</span>
              </button>
            </div>
          </div>

          {msg && (
            <p className={`fort-add-msg ${msg.type === 'error' ? 'error' : 'success'}`}>
              {msg.text}
            </p>
          )}

          {players.length > 0 && (
            <div className="fort-owner-tools">
              <button type="button" className="dkp-btn-danger" onClick={() => setClearPrompt(true)} disabled={adding}>
                {t('fort_clear_btn')}
              </button>
            </div>
          )}
        </div>
      ) : (
        <button type="button" className="act-owner-link" onClick={() => requireFortLogin()}>
          {t('fort_login_btn')}
        </button>
      )}

      {!loaded ? (
        <p className="muted-line">{t('chat_loading')}</p>
      ) : players.length === 0 ? (
        <p className="muted-line">{t('fort_no_data')}</p>
      ) : (
        <>
          {/* Alliance count strip */}
          {(() => {
            const activePlayers = players.filter(p => !p.deleted);
            const alliances = new Set(
              activePlayers.map(p => (p.alliance || '').trim()).filter(Boolean)
            );
            return (
              <div className="fort-alliance-count">
                <span className="fort-alliance-count-item">
                  <span className="fort-alliance-count-label">{t('fort_alliances_label')}</span>
                  <span className="fort-alliance-count-value">{alliances.size}</span>
                </span>
                <span className="fort-alliance-count-item">
                  <span className="fort-alliance-count-label">{t('fort_players_label')}</span>
                  <span className="fort-alliance-count-value">{activePlayers.length}</span>
                </span>
              </div>
            );
          })()}

          {/* Search + Alliance filter + Show deleted */}
          {(() => {
            const allAlliances = Array.from(
              new Set(
                players
                  .filter(p => !p.deleted)
                  .map(p => (p.alliance || '').trim())
                  .filter(Boolean)
              )
            ).sort((a, b) => a.localeCompare(b));
            const deletedCount = players.filter(p => p.deleted).length;
            return (
              <div className="fort-search-bar">
                <input
                  type="text"
                  className="dkp-name-input fort-search-input"
                  placeholder={t('fort_search_player')}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
                <select
                  className="dkp-name-input fort-alliance-filter"
                  value={allianceFilter}
                  onChange={e => setAllianceFilter(e.target.value)}
                >
                  <option value="all">{t('fort_all_alliances')}</option>
                  <option value="__none__">{t('fort_no_alliance')}</option>
                  {allAlliances.map(a => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
                {deletedCount > 0 && (
                  <button
                    type="button"
                    className={`fort-show-deleted-btn${showDeleted ? ' active' : ''}`}
                    onClick={() => setShowDeleted(v => !v)}
                    title="Toggle deleted players"
                  >
                    {showDeleted ? t('fort_hide_deleted') : t('fort_show_deleted')} ({deletedCount})
                  </button>
                )}
              </div>
            );
          })()}

          {/* Week filter — lets everyone see per-week stats */}
          {(() => {
            const activePlayers = players.filter(p => !p.deleted);
            const allWeeks = (() => {
              const set = new Set();
              activePlayers.forEach(p => {
                const w = p.weekly || {};
                Object.keys(w).forEach(k => { if (Number(w[k]) > 0) set.add(k); });
              });
              return Array.from(set).sort().reverse();
            })();
            const weekRows = (() => {
              // 1. Base pool: active players + (optionally) deleted ones
              let pool = showDeleted ? players : activePlayers;

              // 2. Search filter
              const q = searchQuery.trim().toLowerCase();
              if (q) {
                pool = pool.filter(p =>
                  String(p.name || '').toLowerCase().includes(q) ||
                  String(p.alliance || '').toLowerCase().includes(q)
                );
              }

              // 3. Alliance filter
              if (allianceFilter !== 'all') {
                if (allianceFilter === '__none__') {
                  pool = pool.filter(p => !(p.alliance || '').trim());
                } else {
                  pool = pool.filter(p => (p.alliance || '').trim() === allianceFilter);
                }
              }

              // 4. Week filter
              const withScores = pool.map(p => ({ ...p, fortsThisWeek: fortsInWeek(p, selectedWeek) }));
              const filtered = selectedWeek === 'all'
                ? withScores
                : withScores.filter(p => p.fortsThisWeek > 0);
              const reMapped = filtered.map(p => ({ ...p, forts: p.fortsThisWeek }));
              return [...reMapped].sort((a, b) => (b.forts - a.forts) || String(a.name).localeCompare(String(b.name)));
            })();
            fortPanelWeekRows = weekRows; // expose for the map below
            return (
              <div className="fort-week-filter">
                <label className="fort-week-filter-label" htmlFor="fortWeekSelect">{t('sort_label')}</label>
                <select
                  id="fortWeekSelect"
                  className="dkp-name-input fort-week-select"
                  value={selectedWeek}
                  onChange={e => setSelectedWeek(e.target.value)}
                >
                  <option value="all">
                    {t('fort_all_weeks_total')} — {formatCount(activePlayers.reduce((s, p) => s + (Number(p.forts) || 0), 0))} {t('total_suffix')}
                  </option>
                  {allWeeks.map(wk => {
                    const tot = activePlayers.reduce((s, p) => s + fortsInWeek(p, wk), 0);
                    const isCurrent = wk === currentWeekKey;
                    return (
                      <option
                        key={wk}
                        value={wk}
                        style={isCurrent ? {
                          fontWeight: 700,
                          color: '#F0A83B',
                          backgroundColor: 'rgba(240,168,59,0.18)',
                        } : undefined}
                      >
                        {`${formatWeekLabel(wk)} — ${formatCount(tot)}`}
                      </option>
                    );
                  })}
                </select>
              </div>
            );
          })()}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <p className="muted-line" style={{ margin: 0 }}>
              {formatCount(fortPanelWeekRows.length)} {t('fort_players')}
              {updatedAt ? ` · ${t('fort_updated')} ${fmtShort(new Date(updatedAt))}` : ''}
            </p>
            <div className="fort-download-container">
              <button
                type="button"
                className="dkp-btn-secondary fort-download-btn"
                onClick={() => setDownloadMenuOpen(o => !o)}
                aria-haspopup="menu"
                aria-expanded={downloadMenuOpen}
              >
                <svg viewBox="0 0 24 24" fill="none" width={14} height={14} aria-hidden="true">
                  <path d="M12 3v12M6 10l6 6 6-6M5 21h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                {t('fort_download_btn')}
                <svg viewBox="0 0 24 24" fill="none" width={10} height={10} aria-hidden="true" style={{ marginLeft: 2 }}>
                  <polyline points="6 9 12 15 18 9" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>

              {downloadMenuOpen && (
                <>
                  <div
                    className="fort-download-overlay"
                    onClick={() => setDownloadMenuOpen(false)}
                  />
                  <div
                    className="fort-download-menu"
                    role="menu"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => { downloadXLSX(); setDownloadMenuOpen(false); }}
                      className="fort-download-item"
                    >
                      <svg viewBox="0 0 24 24" fill="none" width={14} height={14} aria-hidden="true">
                        <path d="M4 4h16v16H4zM8 8h8M8 12h8M8 16h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      {t('fort_download_excel')}
                    </button>

                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => { downloadCSV(); setDownloadMenuOpen(false); }}
                      className="fort-download-item"
                    >
                      <svg viewBox="0 0 24 24" fill="none" width={14} height={14} aria-hidden="true">
                        <path d="M12 3v12M6 10l6 6 6-6M5 21h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      {t('fort_download_csv')}
                    </button>

                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => { copyFortToClipboard(); setDownloadMenuOpen(false); }}
                      className="fort-download-item"
                    >
                      <svg viewBox="0 0 24 24" fill="none" width={14} height={14} aria-hidden="true">
                        <rect x="8" y="8" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.8"/>
                        <path d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2" stroke="currentColor" strokeWidth="1.8"/>
                      </svg>
                      {t('fort_copy_clipboard')}
                    </button>

                    {canShareFiles && (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => { shareFortList(); setDownloadMenuOpen(false); }}
                        className="fort-download-item"
                      >
                        <svg viewBox="0 0 24 24" fill="none" width={14} height={14} aria-hidden="true">
                          <circle cx="18" cy="5" r="3" stroke="currentColor" strokeWidth="1.8"/>
                          <circle cx="6" cy="12" r="3" stroke="currentColor" strokeWidth="1.8"/>
                          <circle cx="18" cy="19" r="3" stroke="currentColor" strokeWidth="1.8"/>
                          <path d="M8.6 10.6l6.8-4M8.6 13.4l6.8 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                        </svg>
                        {t('fort_share_btn')}
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className={`fort-board${fortUnlocked ? ' has-actions' : ''}`}>
            <div className="fort-board-head">
              <span />
              <span />
              <span>{t('fort_col_name')}</span>
              <span className="fort-head-count">{t('fort_col_forts')}</span>
              {fortUnlocked && <span />}
            </div>

            {fortPanelWeekRows.slice(0, visibleCount).map((p, i) => (
              <div
                className={`fort-row${p.deleted ? ' fort-row-deleted' : ''}`}
                key={`${fortKey(p.name)}-${i}`}
              >
                <span className="fort-rank">
                  {i < 3 && !p.deleted
                    ? <span className={`fort-medal fort-medal-${i + 1}`}>{i + 1}</span>
                    : <span className="fort-rank-num">{i + 1}</span>}
                </span>
                <span className="fort-avatar" style={{ background: `hsl(${fortHue(p.name)}, 42%, 36%)` }}>
                  {Array.from(String(p.name).trim())[0] || '?'}
                </span>
                <span className="fort-name-cell">
                  <span className="fort-name" title={p.name}>{p.name}</span>
                  {p.governorId && (
                    <span className="fort-id-tag" title="Governor ID">ID {p.governorId}</span>
                  )}
                  {p.alliance && (
                    <span className="fort-alliance-tag" title={p.alliance}>
                      {p.alliance}
                    </span>
                  )}
                  {p.deleted && (
                    <span className="fort-deleted-tag">{t('fort_deleted_tag')}</span>
                  )}
                </span>
                <span className="fort-count">{formatCount(p.forts)}</span>
                {fortUnlocked && (
                  <span className="fort-actions">
                    {p.deleted ? (
                      <button
                        type="button"
                        className="fort-icon-btn fort-restore-btn"
                        title={t('fort_restore_title')}
                        aria-label={t('fort_restore_title')}
                        onClick={() => restorePlayer(p)}
                      >
                        <svg viewBox="0 0 24 24" fill="none" width={13} height={13}>
                          <path d="M3 12a9 9 0 1 0 3-6.7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M3 4v5h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="fort-icon-btn"
                          title={t('fort_edit_title')}
                          aria-label={t('fort_edit_title')}
                          onClick={() => setEdit({
                            origName: p.name,
                            origForts: p.forts,
                            name: p.name,
                            alliance: p.alliance || '',
                            governorId: p.governorId || '',
                            forts: String(p.forts),
                          })}
                        >
                          <PencilIcon width={13} height={13} />
                        </button>
                        <button
                          type="button"
                          className="fort-icon-btn"
                          title={t('remove_btn')}
                          aria-label={t('remove_btn')}
                          onClick={() => setRemoveTarget(p)}
                        >
                          <Icon.trash width={13} height={13} />
                        </button>
                      </>
                    )}
                  </span>
                )}
              </div>
            ))}
          </div>

          {visibleCount < fortPanelWeekRows.length && (
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <button type="button" className="btn-primary" onClick={() => setVisibleCount(v => v + 50)}>
                {t('load_more')} ({formatCount(fortPanelWeekRows.length - visibleCount)} {t('remaining_suffix')})
              </button>
            </div>
          )}
        </>
      )}

      {/* Edit player */}
      {edit && (
        <div className="modal-overlay" onClick={() => setEdit(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{t('fort_edit_title')}</h3>
              <button className="modal-x" onClick={() => setEdit(null)} aria-label={t('aria_close')}><Icon.close width={16} height={16}/></button>
            </div>
            <div className="modal-body">
              <p className="modal-prompt" style={{ marginBottom: 6 }}>{t('fort_name_label')}</p>
              <input
                type="text" className="modal-input" maxLength={40}
                value={edit.name}
                onChange={e => setEdit({ ...edit, name: e.target.value })}
              />
              <p className="modal-prompt" style={{ marginBottom: 6 }}>{t('fort_gov_id_label')}</p>
              <input
                type="text" inputMode="numeric" className="modal-input" maxLength={15}
                placeholder={t('fort_gov_id_placeholder')}
                value={edit.governorId || ''}
                onChange={e => setEdit({ ...edit, governorId: e.target.value.replace(/\D/g, '').slice(0, 15) })}
              />
              <p className="modal-prompt" style={{ marginBottom: 6 }}>{t('fort_alliance_label')}</p>
              {(() => {
                // Live-filter the alliance list against what's being typed.
                // Same behaviour as the Add-player form — identical look
                // on desktop and mobile.
                const allAlliances = Array.from(
                  new Set(
                    players
                      .filter(p => !p.deleted)
                      .map(p => (p.alliance || '').trim())
                      .filter(Boolean)
                  )
                ).sort((a, b) => a.localeCompare(b));

                const q = (edit.alliance || '').trim().toLowerCase();
                const filteredAlliances = q
                  ? allAlliances.filter(a => a.toLowerCase().includes(q))
                  : allAlliances;

                const exactMatch = allAlliances.some(a => a.toLowerCase() === q);
                const showSuggestions =
                  editAllianceSuggestOpen &&
                  !exactMatch &&
                  filteredAlliances.length > 0;

                return (
                  <div className="fort-alliance-autocomplete" style={{ marginBottom: 12 }}>
                    <input
                      type="text"
                      className="modal-input"
                      style={{ marginBottom: 0 }}
                      maxLength={40}
                      placeholder={t('fort_alliance_placeholder')}
                      value={edit.alliance || ''}
                      onChange={e => {
                        setEdit({ ...edit, alliance: e.target.value });
                        setEditAllianceSuggestOpen(true);
                      }}
                      onFocus={() => setEditAllianceSuggestOpen(true)}
                      onBlur={() => {
                        // Delay so a tap on a suggestion still registers
                        setTimeout(() => setEditAllianceSuggestOpen(false), 120);
                      }}
                      autoComplete="off"
                      onKeyDown={e => {
                        if (e.key === 'Escape') setEditAllianceSuggestOpen(false);
                        if (e.key === 'Enter')  saveEdit();
                      }}
                    />
                    {showSuggestions && (
                      <div className="fort-alliance-suggest" role="listbox">
                        {filteredAlliances.map(a => (
                          <button
                            key={a}
                            type="button"
                            role="option"
                            className="fort-alliance-suggest-item"
                            onMouseDown={e => e.preventDefault()}
                            onClick={() => {
                              setEdit({ ...edit, alliance: a });
                              setEditAllianceSuggestOpen(false);
                            }}
                          >
                            {a}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
              <p className="modal-prompt" style={{ marginBottom: 6 }}>{t('fort_forts_label')}</p>
              <input
                type="text" inputMode="numeric" className="modal-input"
                value={edit.forts}
                onChange={e => setEdit({ ...edit, forts: e.target.value.replace(/\D/g, '').slice(0, 5) })}
                onKeyDown={e => { if (e.key === 'Enter') saveEdit(); }}
              />
              <div className="modal-actions">
                <button className="btn-secondary" onClick={() => setEdit(null)}>{t('cancel_btn')}</button>
                <button className="btn-primary" onClick={saveEdit}>{t('save_btn')}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Remove one player */}
      {removeTarget && (
        <div className="modal-overlay" onClick={() => setRemoveTarget(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{t('confirm_action_title')}</h3>
              <button className="modal-x" onClick={() => setRemoveTarget(null)} aria-label={t('aria_close')}><Icon.close width={16} height={16}/></button>
            </div>
            <div className="modal-body">
              <p className="modal-prompt">{t('fort_confirm_remove').replace('{name}', removeTarget.name)}</p>
              <div className="modal-actions">
                <button className="btn-secondary" onClick={() => setRemoveTarget(null)}>{t('cancel_btn')}</button>
                <button className="btn-danger" onClick={removePlayer}>{t('remove_btn')}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Clear everything */}
      {clearPrompt && (
        <div className="modal-overlay" onClick={() => setClearPrompt(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{t('confirm_action_title')}</h3>
              <button className="modal-x" onClick={() => setClearPrompt(false)} aria-label={t('aria_close')}><Icon.close width={16} height={16}/></button>
            </div>
            <div className="modal-body">
              <p className="modal-prompt">{t('fort_confirm_clear')}</p>
              <div className="modal-actions">
                <button className="btn-secondary" onClick={() => setClearPrompt(false)}>{t('cancel_btn')}</button>
                <button className="btn-danger" onClick={clearAll}>{t('fort_clear_btn')}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Barbarian Fort password prompt — separate from the main owner login */}
      {fortPwPrompt && (
        <div className="modal-overlay" onClick={() => fortPwPrompt.onCancel()}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{t('fort_login_title')}</h3>
              <button className="modal-x" onClick={() => fortPwPrompt.onCancel()}><Icon.close width={16} height={16}/></button>
            </div>
            <div className="modal-body">
              <p className="modal-prompt">{t('fort_login_prompt')}</p>
              <input
                type="password"
                className="modal-input"
                value={fortPwValue}
                onChange={e => setFortPwValue(e.target.value)}
                placeholder={t('password_placeholder')}
                autoFocus
                onKeyDown={e => { if (e.key === 'Enter') fortPwPrompt.onConfirm(fortPwValue); }}
              />
              {fortPwPrompt.error && (
                <p style={{ color: 'var(--danger)', fontSize: '0.8rem', margin: '0 0 10px 0' }}>{fortPwPrompt.error}</p>
              )}
              <div className="modal-actions">
                <button className="btn-secondary" onClick={() => fortPwPrompt.onCancel()}>{t('cancel_btn')}</button>
                <button className="btn-primary" onClick={() => fortPwPrompt.onConfirm(fortPwValue)}>{t('login_btn')}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* =====================================================================
   EXIT FEEDBACK POPUP — friendly, one-time-per-device survey
   ===================================================================== */

function ExitFeedbackPopup({ onClose, onSubmitted, mandatory = true }) {
  const { t } = useT();
  // step: 'rate' → 'text' → 'thanks'
  const [step, setStep]         = useState('rate');
  const [choice, setChoice]     = useState(null);
  const [text, setText]         = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedbackId, setFeedbackId] = useState(null);
  const [sendingText, setSendingText] = useState(false);
  const textareaRef = useRef(null);

  // Step 1 — save the rating immediately, then move to optional text step.
  const submitChoice = async (c) => {
    if (submitting) return;
    setSubmitting(true);
    setChoice(c);
    const id = await submitFeedbackRemote(c);
    setFeedbackId(id);
    setSubmitting(false);
    // Mark the survey as completed on this device the moment the user
    // submits a rating — even if they skip the optional text step.
    if (onSubmitted) onSubmitted();
    setStep('text');
    // autofocus the textarea once it's mounted
    setTimeout(() => { try { textareaRef.current?.focus(); } catch (e) {} }, 120);
  };

  // Step 2a — user typed something and pressed Send.
  const sendText = async () => {
    if (sendingText) return;
    setSendingText(true);
    const trimmed = text.trim();
    if (feedbackId && trimmed) {
      await updateFeedbackText(feedbackId, trimmed);
    }
    setSendingText(false);
    setStep('thanks');
    setTimeout(onClose, 1700);
  };

  // Step 2b — user pressed "No thank you".
  const skipText = () => {
    setStep('thanks');
    setTimeout(onClose, 1300);
  };

  return (
    <div
      className="feedback-overlay"
      onClick={mandatory ? undefined : onClose}
      role="dialog"
      aria-modal="true"
    >
      <div className="feedback-card" onClick={e => e.stopPropagation()}>
        {!mandatory && step !== 'thanks' && (
          <button className="feedback-close" onClick={onClose} aria-label="Close">
            <Icon.close width={16} height={16} />
          </button>
        )}

        {step === 'rate' && (
          <>
            <div className="feedback-header">
              <h3 className="feedback-title">{t('feedback_survey_title')}</h3>
              <p className="feedback-sub">{t('feedback_survey_sub')}</p>
            </div>
            <div className="feedback-options">
              <button type="button" className="feedback-option feedback-option-good"
                onClick={() => submitChoice('good')} disabled={submitting}>
                <span className="feedback-emoji">👍</span>
                <span className="feedback-label">{t('feedback_good')}</span>
              </button>
              <button type="button" className="feedback-option feedback-option-ok"
                onClick={() => submitChoice('notbad')} disabled={submitting}>
                <span className="feedback-emoji">😐</span>
                <span className="feedback-label">{t('feedback_notbad')}</span>
              </button>
              <button type="button" className="feedback-option feedback-option-bad"
                onClick={() => submitChoice('bad')} disabled={submitting}>
                <span className="feedback-emoji">👎</span>
                <span className="feedback-label">{t('feedback_bad')}</span>
              </button>
            </div>
          </>
        )}

        {step === 'text' && (
          <div className="feedback-text-step">
            <div className="feedback-text-head">
              <span className="feedback-text-emoji">
                {choice === 'good' ? '👍' : choice === 'notbad' ? '😐' : '👎'}
              </span>
              <h3 className="feedback-title">{t('feedback_more_title')}</h3>
              <p className="feedback-sub">
                {t('feedback_more_sub')}
              </p>
            </div>

            <textarea
              ref={textareaRef}
              className="feedback-textarea"
              value={text}
              onChange={e => setText(e.target.value.slice(0, 500))}
              placeholder={t('feedback_text_placeholder')}
              rows={4}
              maxLength={500}
              disabled={sendingText}
              onKeyDown={e => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  sendText();
                }
              }}
            />
            <div className="feedback-text-count">
              {text.length} / 500
            </div>

            <div className="feedback-text-actions">
              <button
                type="button"
                className="btn-primary feedback-text-send"
                onClick={sendText}
                disabled={sendingText || !text.trim()}
              >
                {sendingText ? t('feedback_sending') : t('feedback_send')}
              </button>
              <button
                type="button"
                className="feedback-text-skip"
                onClick={skipText}
                disabled={sendingText}
              >
                {t('feedback_no_thanks')}
              </button>
            </div>
          </div>
        )}

        {step === 'thanks' && (
          <div className="feedback-thanks">
            <div className="feedback-thanks-icon">
              <svg viewBox="0 0 24 24" fill="none" width={28} height={28}>
                <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h3 className="feedback-title">
              {text.trim() ? t('feedback_thanks_detailed') : t('feedback_thanks_simple')}
            </h3>
            <p className="feedback-sub">{t('feedback_recorded')}</p>
          </div>
        )}

        {/* Small, quiet escape hatch — never trap the user 100% */}
        {mandatory && step !== 'thanks' && (
          <button
            type="button"
            className="feedback-skip-link"
            onClick={onClose}
          >
            {t('feedback_skip')}
          </button>
        )}
      </div>
    </div>
  );
}

/* =====================================================================
   FEEDBACK PANEL — owner-only dashboard for exit-survey ratings
   ===================================================================== */

function FeedbackPanel() {
  const { t } = useT();
  const [feedback, setFeedback] = useState(null);
  const [loaded, setLoaded]     = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const data = await loadFeedbackRemote();
      if (!cancelled) {
        setFeedback(data || []);
        setLoaded(true);
      }
    };
    load();
    const id = setInterval(load, 30000); // keep it fresh while open
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const stats = useMemo(() => {
    const list = feedback || [];
    const good   = list.filter(f => f.choice === 'good').length;
    const notbad = list.filter(f => f.choice === 'notbad').length;
    const bad    = list.filter(f => f.choice === 'bad').length;
    const total  = list.length;
    const pct    = (n) => (total > 0 ? Math.round((n / total) * 100) : 0);

    const now = Date.now();
    const dayMs   = 24 * 60 * 60 * 1000;
    const today    = list.filter(f => f.ts && (now - f.ts) < dayMs).length;
    const thisWeek = list.filter(f => f.ts && (now - f.ts) < 7  * dayMs).length;
    const thisMonth= list.filter(f => f.ts && (now - f.ts) < 30 * dayMs).length;

    // Simple weighted score: Good=100, Not Bad=60, Bad=0
    const score = total > 0
      ? Math.round((good * 100 + notbad * 60 + bad * 0) / total)
      : 0;

    const withText = list.filter(f => typeof f.text === 'string' && f.text.trim().length > 0).length;
    const sorted = [...list].sort((a, b) => (b.ts || 0) - (a.ts || 0));

    return {
      good, notbad, bad, total,
      goodPct: pct(good), notbadPct: pct(notbad), badPct: pct(bad),
      today, thisWeek, thisMonth, score, sorted, withText,
    };
  }, [feedback]);

  if (!loaded) {
    return <p className="muted-line">{t('feedback_loading')}</p>;
  }

  if (stats.total === 0) {
    return (
      <div className="feedback-empty">
        <div className="feedback-empty-icon">
          <svg viewBox="0 0 24 24" fill="none" width={30} height={30}>
            <path
              d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z"
              stroke="currentColor" strokeWidth="1.6"
              strokeLinecap="round" strokeLinejoin="round"
            />
          </svg>
        </div>
        <h3>{t('feedback_empty_title')}</h3>
        <p>{t('feedback_empty_text')}</p>
      </div>
    );
  }

  const rows = [
    { key: 'good',   emoji: '👍', label: t('feedback_good'),    count: stats.good,   pct: stats.goodPct   },
    { key: 'notbad', emoji: '😐', label: t('feedback_notbad'), count: stats.notbad, pct: stats.notbadPct },
    { key: 'bad',    emoji: '👎', label: t('feedback_bad'),     count: stats.bad,    pct: stats.badPct    },
  ];

  return (
    <div className="feedback-dash">
      {/* --- Big summary --- */}
      <div className="feedback-hero">
        <div className="feedback-hero-block">
          <span className="feedback-hero-num">{formatCount(stats.total)}</span>
          <span className="feedback-hero-label">{t('feedback_total_ratings')}</span>
        </div>
        <div className="feedback-hero-divider" />
        <div className="feedback-hero-block">
          <span className="feedback-hero-num accent">{stats.score}</span>
          <span className="feedback-hero-label">{t('feedback_satisfaction')}</span>
        </div>
      </div>

      {/* --- Breakdown with bars --- */}
      <div className="feedback-breakdown">
        {rows.map(row => (
          <div className={`feedback-row feedback-row-${row.key}`} key={row.key}>
            <div className="feedback-row-head">
              <span className="feedback-row-emoji">{row.emoji}</span>
              <span className="feedback-row-label">{row.label}</span>
              <span className="feedback-row-count">
                <b>{formatCount(row.count)}</b>
                <span className="feedback-row-pct">({row.pct}%)</span>
              </span>
            </div>
            <div className="feedback-row-bar">
              <span className="feedback-row-fill" style={{ width: row.pct + '%' }} />
            </div>
          </div>
        ))}
      </div>

      {/* --- Time-based stats --- */}
      <div className="feedback-time-grid">
        <div className="feedback-time-card">
          <span className="feedback-time-label">{t('feedback_today')}</span>
          <span className="feedback-time-value">{formatCount(stats.today)}</span>
        </div>
        <div className="feedback-time-card">
          <span className="feedback-time-label">{t('feedback_last_7')}</span>
          <span className="feedback-time-value">{formatCount(stats.thisWeek)}</span>
        </div>
        <div className="feedback-time-card">
          <span className="feedback-time-label">{t('feedback_last_30')}</span>
          <span className="feedback-time-value">{formatCount(stats.thisMonth)}</span>
        </div>
      </div>

      {/* --- Recent responses --- */}
      <div className="section-label" style={{ marginTop: 6 }}>
        {t('feedback_recent')}
        {stats.withText > 0 && (
          <span className="tag" style={{ marginLeft: 8 }}>
            {formatCount(stats.withText)} {t('feedback_with_message')}
          </span>
        )}
      </div>
      <div className="feedback-list">
        {stats.sorted.slice(0, 100).map(f => {
          const cls   = f.choice === 'good' ? 'good' : f.choice === 'notbad' ? 'ok' : 'bad';
          const emoji = f.choice === 'good' ? '👍' : f.choice === 'notbad' ? '😐' : '👎';
          const label = f.choice === 'good' ? t('feedback_good') : f.choice === 'notbad' ? t('feedback_notbad') : t('feedback_bad');
          const hasText = typeof f.text === 'string' && f.text.trim().length > 0;
          return (
            <div className={`feedback-list-row feedback-list-${cls}${hasText ? ' has-text' : ''}`} key={f.id}>
              <div className="feedback-list-head">
                <span className="feedback-list-emoji">{emoji}</span>
                <span className="feedback-list-label">{label}</span>
                <span className="feedback-list-time">
                  {f.ts ? fmtMsgTime(f.ts, Date.now()) : '—'}
                </span>
              </div>
              {hasText && (
                <div className="feedback-list-text">{f.text}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const ChatPanelM       = React.memo(ChatPanel);
const DkpPanelM        = React.memo(DkpPanel);
const ActivityPanelM   = React.memo(ActivityPanel);
const CalendarPanelM   = React.memo(CalendarPanel);
const CalculatorPanelM = React.memo(CalculatorPanel);

const NAV_ITEMS = [
  { id: 'timeline',    labelKey: 'nav_overview',   icon: Icon.pulse    },
  { id: 'completed',   labelKey: 'nav_history',    icon: Icon.archive  },
  { id: 'kvk',         labelKey: 'nav_kvk',        icon: Icon.shield   },
  { id: 'chat',        labelKey: 'nav_chat',       icon: Icon.chat     },
{ id: 'activity',   labelKey: 'nav_activity',   icon: ActivityIcon  },
  { id: 'dkp',labelKey: 'nav_dkp',        icon: Icon.target   },
  { id: 'schedule',    labelKey: 'nav_calendar',   icon: Icon.calendar },
  { id: 'calculator',  labelKey: 'nav_calculator', icon: Icon.calc     },
  { id: 'members',     labelKey: 'nav_visitors',   icon: Icon.users    },
  { id: 'feedback',    labelKey: 'nav_feedback',   icon: Icon.chat, ownerOnly: true },
];

function AppInner() {
  const { t, lang } = useT();
  const { isOwner } = useOwner();
  const [now, setNow]                 = useState(() => new Date());
  const [activeTab, setActiveTab]     = useState('timeline');
  const [gateVisible, setGateVisible] = useState(() => {
    try { return localStorage.getItem(GATE_SEEN_FLAG) !== '1'; } catch { return true; }
  });
  const [gateHidden, setGateHidden]   = useState(() => {
    try { return localStorage.getItem(GATE_SEEN_FLAG) === '1'; } catch { return false; }
  });
  const [count, setCount]             = useState(null);
  const [countAvailable, setCountAvailable] = useState(true);
  // (Removed unused countedIn state.)
  const [aboutOpen, setAboutOpen]     = useState(false);
  const [openUpCards, setOpenUpCards] = useState(() => new Set());
  const [toastContent, setToastContent] = useState(null);
  const [toastShown, setToastShown]     = useState(false);
  const [installScreen, setInstallScreen] = useState(null);
  const [installBtnHidden, setInstallBtnHidden] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const deferredPromptRef  = useRef(null);
  const lastLiveChapterRef = useRef(undefined);
  const toastTimerRef      = useRef(null);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // =====================================================================
  // EDGE-SWIPE GESTURE — swipe from the left screen edge to open the
  // burger drawer, and swipe left on the open drawer to close it.
  // Mobile-only (burger nav is hidden above 900px anyway).
  // =====================================================================
  useEffect(() => {
    const EDGE_ZONE       = 28;  // px from the left edge that can start an "open" swipe
    const OPEN_THRESHOLD   = 55; // px dragged right to trigger opening
    const CLOSE_THRESHOLD  = 55; // px dragged left to trigger closing
    let startX = null, startY = null, tracking = false, mode = null;

    const onTouchStart = (e) => {
      if (window.innerWidth > 900) { tracking = false; return; }
      const t = e.touches[0];
      if (!t) return;
      startX = t.clientX;
      startY = t.clientY;
      if (!mobileNavOpen && startX <= EDGE_ZONE) {
        tracking = true; mode = 'open';
      } else if (mobileNavOpen) {
        tracking = true; mode = 'close';
      } else {
        tracking = false; mode = null;
      }
    };

    const onTouchMove = (e) => {
      if (!tracking) return;
      const t = e.touches[0];
      if (!t) return;
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      if (Math.abs(dy) > Math.abs(dx)) return; // vertical scroll — ignore
      if (mode === 'open' && dx > OPEN_THRESHOLD) {
        setMobileNavOpen(true);
        tracking = false;
      } else if (mode === 'close' && dx < -CLOSE_THRESHOLD) {
        setMobileNavOpen(false);
        tracking = false;
      }
    };

    const onTouchEnd = () => { tracking = false; mode = null; };

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    window.addEventListener('touchcancel', onTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [mobileNavOpen]);

  // =====================================================================
  // UNIVERSAL KEYBOARD DETECTION
  // ---------------------------------------------------------------------
  // Hides the mobile burger nav the instant ANY text field is focused,
  // on every mobile browser (iOS Safari, Chrome Android, Firefox Mobile,
  // Samsung Internet, Opera, Edge, etc). No device sniffing needed.
  //
  // Detects the keyboard via FIVE independent signals — if any one of
  // them fires, the burger hides. If all are silent, it stays put.
  //
  //   1. focusin  — fires when any focusable element gains focus
  //   2. focusout — fires when focus leaves (we wait 250ms, then verify)
  //   3. touchstart — an early hint on Android where focus fires late
  //   4. visualViewport resize/scroll — iOS + modern Android signal
  //   5. window resize — legacy fallback for older Android browsers
  //
  // The class is added to BOTH <html> and <body> so any CSS selector
  // matches regardless of which ancestor the browser attaches it to.
  // =====================================================================
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    let closeTimer = null;

    // What counts as "something a mobile keyboard would pop up for"?
    const isEditable = (el) => {
      if (!el || el.disabled || el.readOnly) return false;
      const tag = (el.tagName || '').toUpperCase();
      if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
      if (el.isContentEditable === true) return true;
      if (tag === 'INPUT') {
        const type = (el.type || 'text').toLowerCase();
        // Input types that never open a soft keyboard on mobile:
        if (['button','checkbox','color','file','hidden','image','radio','range','reset','submit'].includes(type)) return false;
        return true;
      }
      return false;
    };

    const showBurger = () => {
      if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
      html.classList.add('keyboard-open');
      body.classList.add('keyboard-open');
    };

    const hideBurgerAfterDelay = () => {
      // The OS keyboard takes ~200–350ms to animate closed. Wait it out,
      // then double-check nothing editable is still focused.
      if (closeTimer) clearTimeout(closeTimer);
      closeTimer = setTimeout(() => {
        if (!isEditable(document.activeElement)) {
          html.classList.remove('keyboard-open');
          body.classList.remove('keyboard-open');
        }
      }, 250);
    };

    // --- Signal 1 & 2: focus events (universal) ---
    const onFocusIn  = (e) => { if (isEditable(e.target)) showBurger(); };
    const onFocusOut = () => { hideBurgerAfterDelay(); };

    // --- Signal 3: touchstart on an editable (early Android hint) ---
    const onTouchStart = (e) => { if (isEditable(e.target)) showBurger(); };

    // --- Signal 4: visualViewport height change (iOS + modern Android) ---
    const vv = window.visualViewport;
    let lastVVHeight = vv ? vv.height : 0;
    const onVisualViewport = () => {
      if (!vv) return;
      const shrunk = (lastVVHeight - vv.height) > 100;
      const grew   = (vv.height - lastVVHeight) > 100;
      lastVVHeight = vv.height;
      if (shrunk || isEditable(document.activeElement)) showBurger();
      else if (grew && !isEditable(document.activeElement)) hideBurgerAfterDelay();
    };

    // --- Signal 5: window resize (legacy Android fallback) ---
    let lastInnerHeight = window.innerHeight;
    const onWindowResize = () => {
      const shrunk = (lastInnerHeight - window.innerHeight) > 120;
      lastInnerHeight = window.innerHeight;
      if (shrunk || isEditable(document.activeElement)) showBurger();
      else if (!isEditable(document.activeElement)) hideBurgerAfterDelay();
    };

    document.addEventListener('focusin',   onFocusIn,  true);
    document.addEventListener('focusout',  onFocusOut, true);
    document.addEventListener('touchstart', onTouchStart, { passive: true, capture: true });
    if (vv) {
      vv.addEventListener('resize', onVisualViewport);
      vv.addEventListener('scroll', onVisualViewport);
    }
    window.addEventListener('resize', onWindowResize);

    return () => {
      if (closeTimer) clearTimeout(closeTimer);
      document.removeEventListener('focusin',   onFocusIn,  true);
      document.removeEventListener('focusout',  onFocusOut, true);
      document.removeEventListener('touchstart', onTouchStart, true);
      if (vv) {
        vv.removeEventListener('resize', onVisualViewport);
        vv.removeEventListener('scroll', onVisualViewport);
      }
      window.removeEventListener('resize', onWindowResize);
      html.classList.remove('keyboard-open');
      body.classList.remove('keyboard-open');
    };
  }, []);

  useEffect(() => {
    if (gateHidden) document.documentElement.classList.remove('gate-locked');
    else            document.documentElement.classList.add('gate-locked');
  }, [gateHidden]);

  useEffect(() => {
    document.documentElement.lang = lang;
    // Keep the page LAYOUT always LTR so grids/flex/fixed elements never flip or overflow.
    // RTL is applied to text only, via the .lang-rtl class (see styles.css).
    document.documentElement.dir = 'ltr';
    document.documentElement.classList.toggle('lang-rtl', ['ar','he','fa','ur'].includes(lang));
    document.documentElement.setAttribute('translate', 'no');
    document.documentElement.classList.add('notranslate');
document.body.setAttribute('translate', 'no');
document.body.classList.add('notranslate');
if (!document.querySelector('meta[name="google"][content="notranslate"]')) {
  const m = document.createElement('meta');
  m.name = 'google';
  m.content = 'notranslate';
  document.head.appendChild(m);
}
  }, [lang]);

  // =====================================================================
  // FEEDBACK TIMER — a silent 10-second countdown starts the moment the
  // user enters the site. If they stay on the page for the full 10
  // seconds, the survey popup appears automatically. If they close the
  // tab or navigate away before then, nothing happens and the countdown
  // starts fresh the next time they visit.
  //
  // The popup only appears once per device — as soon as the user submits
  // a rating, we save a flag in localStorage so refreshing, closing the
  // browser, or returning later never brings it back.
  //
  // The user can still skip via the small "Skip for now" link; skipping
  // does NOT mark it as completed, so they'll be asked again next time.
  // =====================================================================
  useEffect(() => {
    if (!gateHidden) return; // don't start counting until the user has entered

    // Already answered on this device? Never ask again.
    let alreadyCompleted = false;
    try { alreadyCompleted = localStorage.getItem(FEEDBACK_SHOWN_KEY) === '1'; } catch (e) {}
    if (alreadyCompleted) return;

    // Silent 10-second background timer — nothing is shown while it runs.
    const timer = setTimeout(() => {
      // Re-check in case it was completed while the timer was pending.
      let done = false;
      try { done = localStorage.getItem(FEEDBACK_SHOWN_KEY) === '1'; } catch (e) {}
      if (done) return;
      setFeedbackOpen(true);
    }, 10000);

    // If the user leaves (component unmounts / page unloads) before the
    // timer fires, clear it so the popup never appears for that visit.
    return () => clearTimeout(timer);
  }, [gateHidden]);

  const refreshCount = useCallback(async () => {
    try {
      const value = await fetchCounterValue(COUNTER_URL);
      setCount(value);
      setCountAvailable(true);
    } catch (e) {
      setCountAvailable(false);
    }
  }, []);

  useEffect(() => {
    refreshCount();
    const id = setInterval(refreshCount, POLL_MS);
    return () => clearInterval(id);
  }, [refreshCount]);

  useEffect(() => {
    const live = CHAIN.find(ch => now >= ch.start && now < ch.end);
    const seasonOver = now >= SEASON_END;
    const currentLiveNum = live ? live.n : (seasonOver ? 'season-over' : null);

    if (lastLiveChapterRef.current !== undefined && currentLiveNum !== lastLiveChapterRef.current) {
      if (seasonOver && currentLiveNum === 'season-over') {
        showToast(t('toast_season_complete'), t('toast_all_concluded'));
      } else if (live) {
        showToast(`${t('ops_chapter')} ${live.n} ${t('toast_chapter_begun')}`, live.title);
      }
    }
    lastLiveChapterRef.current = currentLiveNum;
  }, [now, t]);

  const showToast = (title, body) => {
    clearTimeout(toastTimerRef.current);
    setToastContent({ title, body });
    setToastShown(true);
    toastTimerRef.current = setTimeout(() => setToastShown(false), 6000);
  };

  useEffect(() => () => clearTimeout(toastTimerRef.current), []);

  useEffect(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true;
    if (isStandalone) { setInstallBtnHidden(true); return; }

    const onBeforeInstall = e => { e.preventDefault(); deferredPromptRef.current = e; setInstallBtnHidden(false); };
    const onInstalled = () => setInstallBtnHidden(true);

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const enterSite = async () => {
    try { localStorage.setItem(GATE_SEEN_FLAG, '1'); } catch (e) {}
    setGateHidden(true);
    setTimeout(() => setGateVisible(false), 400);

    try {
      // 1. Get the current count
      const currentCount = await fetchCounterValue(COUNTER_URL);
      const newCount = currentCount + 1;
      
      // 2. Save the new count to Firebase
      await fetch(COUNTER_URL, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ '.sv': { increment: 1 } }),
      });
      
      setCount(newCount);
      setCountAvailable(true);
    } catch (e) {
      setCountAvailable(false);
    }
  };

  const handleInstallClick = async () => {
    if (deferredPromptRef.current) {
      deferredPromptRef.current.prompt();
      try { await deferredPromptRef.current.userChoice; } catch (e) {}
      deferredPromptRef.current = null;
      return;
    }
    setInstallScreen('device');
  };

  const seasonOver    = now >= SEASON_END;
  const live          = CHAIN.find(ch => now >= ch.start && now < ch.end);
  const doneChain     = CHAIN.filter(ch => now >= ch.end);
  const upcomingChain = CHAIN.filter(ch => now < ch.start);

  const currentLiveNum = live ? live.n : (seasonOver ? 'season-over' : null);
  const heroJustChanged = lastLiveChapterRef.current !== undefined
    && String(lastLiveChapterRef.current) !== String(currentLiveNum)
    && lastLiveChapterRef.current !== currentLiveNum;

  const doneRows = [
    ...HISTORY.map(h => ({ n: h.n, title: h.title, date: new Date(h.done), dateOnly: !h.exact })),
    ...doneChain.map(c => ({ n: c.n, title: c.title, date: c.end, dateOnly: false })),
  ];

  const kvkItems = [
    ...KVK1_STAGES.map((s, i) => ({ n: String(s.n), title: t(s.titleKey), sub: t(s.subKey), start: s.start, end: s.end, highlight: false })),
    { n: '4', title: t(KVK1_MAP_OPEN.titleKey), sub: t(KVK1_MAP_OPEN.subKey), start: KVK1_MAP_OPEN.start, end: KVK1_MAP_OPEN.end, highlight: true, last: true },
  ];

  const toggleUpCard = id => {
    setOpenUpCards(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // (Removed unused membersNoteText)

  const progressPct = live ? Math.round(Math.min(100, Math.max(0, ((now - live.start) / (live.end - live.start)) * 100))) : 0;

  return (
    <>
      <div className={`toast${toastShown ? ' show' : ''}`} role="status" aria-live="polite">
        {toastContent && (
          <>
            <span className="toast-dot" />
            <span className="toast-text"><b>{toastContent.title}</b>{toastContent.body}</span>
            <button className="toast-x" onClick={() => setToastShown(false)} aria-label={t('aria_dismiss')}><Icon.close width={14} height={14}/></button>
          </>
        )}
      </div>

      {installScreen && (
        <InstallModal screen={installScreen} onClose={() => setInstallScreen(null)} onNavigate={setInstallScreen} />
      )}

      {feedbackOpen && (
        <ExitFeedbackPopup
          onClose={() => setFeedbackOpen(false)}
          onSubmitted={() => {
            // Mark the survey as completed on this device so it never
            // appears again — refreshes, restarts, and future visits
            // all skip it.
            try { localStorage.setItem(FEEDBACK_SHOWN_KEY, '1'); } catch (e) {}
          }}
        />
      )}

      {gateVisible && (
        <div className={`gate${gateHidden ? ' gate-hidden' : ''}`} role="dialog" aria-modal="true" aria-labelledby="gateTitle">
              <div className="gate-card">
                <div className="gate-header">
                  <div className="gate-logo">XTiT</div>
                  <h2 className="gate-title" id="gateTitle">{t('gate_title')}</h2>
                  <p className="gate-desc">{t('gate_desc')}</p>
                </div>
                <button className="btn-primary gate-btn" type="button" onClick={enterSite}>{t('gate_btn')}</button>
                <p className="gate-count-line" style={{ margin: 0 }}>
                  {countAvailable && count !== null && <span className="count-number">{formatCount(count)}</span>}
                  <span>{countAvailable && count !== null ? t('gate_checked_in') : t('gate_connecting')}</span>
                </p>
              </div>
        </div>
      )}

      <div className="site" id="siteContent">
        <a className="skip-link" href="#heroSlot">{t('skip_link')}</a>

        <header className="topbar">
          <div className="topbar-inner">
            <div className="brand">
              <button
                className="mobile-menu-btn"
                type="button"
                onClick={() => setMobileNavOpen(o => !o)}
                aria-expanded={mobileNavOpen}
                aria-label={t('aria_sections')}
              >
                {mobileNavOpen ? <Icon.close width={20} height={20}/> : <Icon.menu width={20} height={20}/>}
              </button>
              <span className="brand-mark">X</span>
              <span className="brand-name">XTiT</span>
              <span className="brand-kingdom">4161</span>
            </div>
            <nav className="topnav" aria-label={t('aria_sections')}>
              {NAV_ITEMS.filter(item => !item.ownerOnly || isOwner).map(item => (
                <button
                  key={item.id}
                  className={`topnav-btn${activeTab === item.id ? ' active' : ''}`}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                >
                  <item.icon width={16} height={16} />
                  {t(item.labelKey)}
                </button>
              ))}
            </nav>
            <div className="topbar-actions">
              {!installBtnHidden && (
                <button className="install-pill" type="button" onClick={handleInstallClick}>
                  <Icon.plus width={14} height={14}/> <span>{t('install_btn')}</span>
                </button>
              )}
              <LanguageSwitcher />
            </div>
          </div>
        </header>

        <main className="content">

          {/* ----- Overview ----- */}
          <section className={`panel${activeTab === 'timeline' ? ' active' : ''}`}>
            <div className={`about${aboutOpen ? ' open' : ''}`}>
              <button className="about-toggle" onClick={() => setAboutOpen(o => !o)} aria-expanded={aboutOpen}>
                <Icon.info width={16} height={16}/>
                <span>{t('about_toggle')}</span>
                <Icon.chevron className="chevron" width={16} height={16}/>
              </button>
              <Collapsible open={aboutOpen} className="about-body">
                <div className="about-body-inner">
                  <p>{t('about_intro')}</p>
                  <ul>
                    <li>{t('about_li_overview')}</li>
                    <li>{t('about_li_history')}</li>
                    <li>{t('about_li_kvk')}</li>
                    <li>{t('about_li_chat')}</li>
                    <li>{t('about_li_dkp')}</li>
                    <li>{t('about_li_calendar')}</li>
                    <li>{t('about_li_calculator')}</li>
                    <li>{t('about_li_visitors')}</li>
                  </ul>
                  <p>{t('about_footer')}</p>
                </div>
              </Collapsible>
            </div>

            <div className="rok-clock-card notranslate" translate="no">
              <div className="rok-clock-top">
                <span className="rok-clock-title">{getCurrentChapterName(now)}</span>
                <span className="rok-clock-day">{fmtWeekdayUpper(now)}</span>
              </div>
              <div className="rok-clock-time">UTC {fmtRoKTime(now)}</div>
            </div>

            {seasonOver && <div className="banner">{t('banner_season_over')}</div>}

            <div id="heroSlot">
              {live ? (
                <div className={`ops-card${heroJustChanged ? ' just-changed' : ''}`}>
                  <div className="ops-top">
                    <span className="ops-index">{t('ops_chapter')} {live.n}</span>
                    <span className="pill live">{t('ops_in_progress')}</span>
                  </div>
                  <h2 className="ops-title">{live.title}</h2>
                  <p className="ops-desc">{live.sub}</p>
                  <div className="ops-progress">
                    <div className="ops-track"><div className="ops-fill" style={{ width: progressPct + '%' }} /></div>
                    <span className="ops-pct">{progressPct}%</span>
                  </div>
                  <div className="ops-meta">
                    <span>{t('ops_opened')} {fmtShort(live.start)}</span>
                    <span>{t('ops_ends')} {fmtShort(live.end)}</span>
                  </div>
                  <div className="ops-countdown"><CountdownHTML ms={live.end - now} /> {t('ops_left')}</div>

                  {(live.bonus || []).map((b, i) => {
                    const opened = now >= b.time;
                    return opened ? (
                      <div className="capture opened" key={i}>
                        <span className="capture-label">{t(b.labelKey)} {t('capture_is_open')}</span>
                        <span className="capture-status">{t('capture_go_capture')}</span>
                      </div>
                    ) : (
                      <div className="capture" key={i}>
                        <span className="capture-label"><Icon.key width={14} height={14}/> {t(b.labelKey)}</span>
                        <span className="capture-status">{t('capture_opens')} {fmtShort(b.time)} · <CountdownHTML ms={b.time - now} /> {t('ops_left')}</span>
                      </div>
                    );
                  })}
                </div>
              ) : upcomingChain.length ? (
                <div className="ops-card">
                  <div className="ops-top">
                    <span className="ops-index">{t('ops_chapter')} {upcomingChain[0].n}</span>
                    <span className="pill upcoming">{t('ops_opens_next')}</span>
                  </div>
                  <h2 className="ops-title">{upcomingChain[0].title}</h2>
                  <p className="ops-desc">{upcomingChain[0].sub}</p>
                  <div className="ops-meta"><span>{t('capture_opens')} {fmtShort(upcomingChain[0].start)}</span></div>
                  <div className="ops-countdown"><CountdownHTML ms={upcomingChain[0].start - now} /> {t('ops_until_opens')}</div>
                </div>
              ) : (
                <div className="ops-card">
                  <div className="ops-top"><span className="pill done">{t('ops_season_complete')}</span></div>
                  <h2 className="ops-title">{t('ops_all_concluded')}</h2>
                  <p className="ops-desc">{t('ops_last_ended')} {fmtShort(SEASON_END)}.</p>
                </div>
              )}
            </div>

            {upcomingChain.length > 0 && (
              <>
                <div className="section-label">{t('coming_up')}</div>
                <div className="row-list">
                  {upcomingChain.map(ch => (
                    <UpcomingRow
                      key={ch.n}
                      chapter={ch}
                      isOpen={openUpCards.has('up-' + ch.n)}
                      onToggle={() => toggleUpCard('up-' + ch.n)}
                    />
                  ))}
                </div>
              </>
            )}
          </section>

          {/* ----- History ----- */}
          <section className={`panel${activeTab === 'completed' ? ' active' : ''}`}>
            <div className="section-label">{t('history_title')}</div>
            <p className="muted-line">{doneRows.length} {t('history_count_suffix')}</p>
            <div className="history-list">
              {doneRows.map((r, i) => (
                <div className="history-row" key={i}>
                  <span className="history-index">{r.n}</span>
                  <span className="history-title">{r.title}</span>
                  <span className="history-date">{r.dateOnly ? fmtDateOnly(r.date) : fmtShort(r.date)}</span>
                </div>
              ))}
            </div>
          </section>

          {/* ----- War Front (KvK) ----- */}
          <section className={`panel${activeTab === 'kvk' ? ' active' : ''}`}>
            <div className="section-label">
              {t('kvk_title')}
              {KVK1_ESTIMATED && <span className="tag">{t('kvk_estimated')}</span>}
            </div>
            <p className="muted-line">{t('kvk_note')}</p>
            <div className="stage-list">
              {kvkItems.map((item, i) => <StageCard key={i} item={item} now={now} />)}
            </div>
          </section>

          {/* ----- Calendar ----- */}
          <section className={`panel${activeTab === 'schedule' ? ' active' : ''}`}>
            <div className="section-label">{t('calendar_title')}</div>
            <CalendarPanelM />
          </section>

          {/* ----- Visitors ----- */}
          <section className={`panel${activeTab === 'members' ? ' active' : ''}`}>
            <div className="section-label">{t('visitors_title')}</div>
            <div className="stat-card">
              <p className="stat-eyebrow">{t('total_visitors')}</p>
              <div className="stat-number-row">
                {countAvailable && count !== null
                  ? <span className="stat-number">{formatCount(count)}</span>
                  : <span className="stat-fallback">{t('unavailable_now')}</span>}
              </div>
              <p className="stat-note">{t('checked_in_note')}</p>
            </div>

            <div className="contact-card">
              <p className="stat-eyebrow">{t('contact_question')}</p>
              <h3 className="contact-title">{t('contact_title')}</h3>
              <p className="contact-handle">@xtit_3</p>
              <a className="btn-primary contact-btn" href="https://discord.com/users/1000748729197940868" target="_blank" rel="noopener noreferrer" onClick={e => { const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent); if (isMobile) { e.preventDefault(); window.location.href = "discord://-//users/1000748729197940868"; setTimeout(() => { window.open("https://discord.com/users/1000748729197940868", "_blank"); }, 800); } }}>{t('discord_btn')}</a>
              <p className="stat-note">{t('contact_note')}</p>
            </div>
          </section>

          {/* ----- Calculator ----- */}
          <section className={`panel${activeTab === 'calculator' ? ' active' : ''}`}>
            <div className="section-label">{t('calculator_title')}</div>
            <p className="muted-line">{t('calculator_note')}</p>
            <CalculatorPanelM />
          </section>

          {/* ----- Global Chat ----- */}
          <section className={`panel${activeTab === 'chat' ? ' active' : ''}`}>
            <div className="section-label">{t('chat_title')}</div>
            {activeTab === 'chat' && <ChatPanelM />}
          </section>

          {/* ----- Kingdom Activity ----- */}
          <section className={`panel${activeTab === 'activity' ? ' active' : ''}`}>
            <div className="section-label">{t('activity_title')}</div>
            {activeTab === 'activity' && <ActivityPanelM />}
          </section>

          {/* ----- DKP Tracker ----- */}
          <section className={`panel${activeTab === 'dkp' ? ' active' : ''}`}>
            <div className="section-label">{t('dkp_title')}</div>
            {activeTab === 'dkp' && <DkpPanelM />}
          </section>

          {/* ----- Feedback Survey — OWNER ONLY ----- */}
          {isOwner && (
            <section className={`panel${activeTab === 'feedback' ? ' active' : ''}`}>
              <div className="section-label">{t('nav_feedback')}</div>
              <p className="muted-line">
                Ratings collected from the exit-survey popup. Only you can see this page.
              </p>
              {activeTab === 'feedback' && <FeedbackPanel />}
            </section>
          )}

        </main>

        <nav className="bottomnav" aria-label={t('aria_sections')}>
          {!mobileNavOpen && <div className="edge-swipe-hint" aria-hidden="true" />}
          {mobileNavOpen && (
            <>
              <div className="bottomnav-overlay" onClick={() => setMobileNavOpen(false)} />
              <div className="bottomnav-sheet">
                {NAV_ITEMS.filter(item => !item.ownerOnly || isOwner).map(item => (
                  <button
                    key={item.id}
                    className={`bottomnav-item${activeTab === item.id ? ' active' : ''}`}
                    type="button"
                    onClick={() => { setActiveTab(item.id); setMobileNavOpen(false); }}
                  >
                    <item.icon width={20} height={20} />
                    <span>{t(item.labelKey)}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </nav>

        <footer className="site-footer">
          <p>{t('footer_note')}</p>
          <p className="footer-signature">{t('footer_built_by')}</p>
        </footer>
      </div>
    </>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <OwnerProvider>
        <AppInner />
      </OwnerProvider>
    </LanguageProvider>
  );
}