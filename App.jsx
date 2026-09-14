import React, { useState, useEffect, useRef, useLayoutEffect, useCallback, useMemo } from 'react';

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
  {n:12, title:"Wild Competition",        sub:"Compete to Enter the Top 20 Alliances",                 done:"2026-09-08T00:00:00Z"},
];

const ANCHOR_START = new Date("2026-09-08T13:10:00Z"); // Chapter 13 opens here

const CHAIN = [
  {n:13, title:"None Shall Pass",       sub:"Your Alliance Controlled a Level 2 Pass at the End",     hours:120},
  {n:14, title:"Barbarian Buster",      sub:"All Governors Defeated 40,000 Lvl 18+ Barbarian Troops", hours:120},
  {n:15, title:"Vanishing Threats",     sub:"Your Alliance Defeated 100 Lvl 3+ Barbarian Forts",      hours:96,
    bonus:[{label:"Level 3 Pass", hoursAfter:24}]},
  {n:16, title:"Glory of the Shrines",  sub:"Your Alliance Controlled a Shrine at the End",           hours:168,
    bonus:[{label:"Shrine", hoursAfter:24}]},
  {n:17, title:"Feudal Age",            sub:"200 Governors Entered the Feudal Age",                   hours:120},
  {n:18, title:"Coup de Grace",         sub:"Your Alliance Defeated 50 Lvl 4+ Barbarian Forts",       hours:96},
  {n:19, title:"Ultimate Clarity",      sub:"Explored All Fog Blocks in the Kingdom",                 hours:168},
  {n:20, title:"The Great Empire",      sub:"8 Alliances Have 90 Members",                            hours:240,
    bonus:[{label:"Lost Temple", hoursAfter:24}]},
  {n:21, title:"The Last Golden Apple", sub:"Your Alliance Controlled the Lost Temple at the End",    hours:240},
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
  { n:1, title:"Stage 1 — Kill Marauders", sub:"Defeat Marauders roaming the Lost Kingdom map to prepare your kingdom for war.",
    start:new Date("2026-11-10T00:00:00Z"), end:new Date("2026-11-12T00:00:00Z") },
  { n:2, title:"Stage 2 — Train Troops", sub:"Train troops to build up your army's strength ahead of KvK.",
    start:new Date("2026-11-12T00:00:00Z"), end:new Date("2026-11-14T00:00:00Z") },
  { n:3, title:"Stage 3 — Destroy Marauder Encampments", sub:"Destroy Marauder Encampments for rewards and to weaken the battlefield ahead of KvK.",
    start:new Date("2026-11-14T00:00:00Z"), end:new Date("2026-11-16T00:00:00Z") },
];

const KVK1_MAP_OPEN = {
  title:"Lost Kingdom Map Opens",
  sub:"The Lost Kingdom map opens and Kingdom vs Kingdom battle begins.",
  start:new Date("2026-11-16T00:00:00Z"),
  end:null,
};

/* =====================================================================
   SCHEDULE EVENTS — unchanged data, only the presentation changes
   ===================================================================== */

const EVENTS = [
  
  { title:"Dhalruk's Puzzle Box",          start:"2026-08-31", end:"2026-09-01", color:"teal" },
  { title:"Realm of Mystique",             start:"2026-08-31", end:"2026-09-01", color:"indigo" },
  { title:"AOO Registration",              start:"2026-09-02", end:"2026-09-04", color:"gray" },
  { title:"Golden Kingdom",                start:"2026-09-02", end:"2026-09-04", color:"gold" },
  { title:"Ark of Osiris",                 start:"2026-09-05", end:"2026-09-06", color:"tan" },
  { title:"Champions of Olympia",          start:"2026-09-05", end:"2026-09-06", color:"tan" },
  { title:"20 Gold Head Event",            start:"2026-09-04", end:"2026-09-05", color:"gold" },
  { title:"Egg / Hammer Event",            start:"2026-09-04", end:"2026-09-05", color:"teal" },

  { title:"Mightiest Governor (Archer)",   start:"2026-09-07", end:"2026-09-12", color:"gold" },
  { title:"Ceroli Crisis",                 start:"2026-09-07", end:"2026-09-09", color:"teal" },
  { title:"Wheel of Fortune (Archer)",     start:"2026-09-08", end:"2026-09-10", color:"purple" },
  { title:"Champions of Olympia",          start:"2026-09-12", end:"2026-09-13", color:"tan" },

  { title:"Armament, Reveal Thyself",      start:"2026-09-14", end:"2026-09-15", color:"violet" },
  { title:"Realm of Mystique",             start:"2026-09-14", end:"2026-09-15", color:"indigo" },
  { title:"AOO Registration",              start:"2026-09-16", end:"2026-09-18", color:"gray" },
  { title:"Golden Kingdom",                start:"2026-09-16", end:"2026-09-18", color:"gold" },
  { title:"Ark of Osiris",                 start:"2026-09-19", end:"2026-09-20", color:"tan" },
  { title:"Champions of Olympia",          start:"2026-09-19", end:"2026-09-20", color:"tan" },
  { title:"20 Gold Head Event",            start:"2026-09-18", end:"2026-09-19", color:"gold" },
  { title:"Egg / Hammer Event",            start:"2026-09-18", end:"2026-09-19", color:"teal" },

  { title:"Mightiest Governor (Leadership)", start:"2026-09-21", end:"2026-09-26", color:"gold" },
  { title:"Ceroli Crisis",                 start:"2026-09-21", end:"2026-09-23", color:"teal" },
  { title:"Wheel of Fortune (Leadership)", start:"2026-09-22", end:"2026-09-24", color:"purple" },
  { title:"Champions of Olympia",          start:"2026-09-26", end:"2026-09-27", color:"tan" },
  { title:"More Than Gems",                start:"2026-09-26", end:"2026-09-27", color:"maroon" },

  { title:"Esmeralda's House",             start:"2026-09-28", end:"2026-09-29", color:"maroon" },
  { title:"Realm of Mystique",             start:"2026-09-28", end:"2026-09-29", color:"indigo" },
  { title:"AOO Registration",              start:"2026-09-30", end:"2026-10-02", color:"gray" },
  { title:"Golden Kingdom",                start:"2026-09-30", end:"2026-10-02", color:"gold" },
  { title:"Ark of Osiris",                 start:"2026-10-03", end:"2026-10-04", color:"tan" },
  { title:"Champions of Olympia",          start:"2026-10-03", end:"2026-10-04", color:"tan" },
  { title:"20 Gold Head Event",            start:"2026-10-02", end:"2026-10-03", color:"gold" },
  { title:"Egg / Hammer Event",            start:"2026-10-02", end:"2026-10-03", color:"teal" },

  { title:"Mightiest Governor (Cavalry)",  start:"2026-10-05", end:"2026-10-10", color:"gold" },
  { title:"Ceroli Crisis",                 start:"2026-10-05", end:"2026-10-07", color:"teal" },
  { title:"Wheel of Fortune (Cavalry)",    start:"2026-10-06", end:"2026-10-08", color:"purple" },
  { title:"Champions of Olympia",          start:"2026-10-10", end:"2026-10-11", color:"tan" },

  { title:"Armament, Reveal Thyself",      start:"2026-10-12", end:"2026-10-13", color:"violet" },
  { title:"Realm of Mystique",             start:"2026-10-12", end:"2026-10-13", color:"indigo" },
  { title:"AOO Registration",              start:"2026-10-14", end:"2026-10-16", color:"gray" },
  { title:"Golden Kingdom",                start:"2026-10-14", end:"2026-10-16", color:"gold" },
  { title:"Ark of Osiris",                 start:"2026-10-17", end:"2026-10-18", color:"tan" },
  { title:"Champions of Olympia",          start:"2026-10-17", end:"2026-10-18", color:"tan" },
  { title:"20 Gold Head Event",            start:"2026-10-16", end:"2026-10-17", color:"gold" },
  { title:"Egg / Hammer Event",            start:"2026-10-16", end:"2026-10-17", color:"teal" },

  { title:"Mightiest Governor (Infantry)", start:"2026-10-19", end:"2026-10-24", color:"gold" },
  { title:"Ceroli Crisis",                 start:"2026-10-19", end:"2026-10-21", color:"teal" },
  { title:"Wheel of Fortune (Infantry)",   start:"2026-10-20", end:"2026-10-22", color:"purple" },
  { title:"Champions of Olympia",          start:"2026-10-24", end:"2026-10-25", color:"tan" },
  { title:"More Than Gems",                start:"2026-10-24", end:"2026-10-25", color:"maroon" },

  { title:"Dhalruk's Puzzle Box",          start:"2026-10-26", end:"2026-10-27", color:"teal" },
  { title:"Realm of Mystique",             start:"2026-10-26", end:"2026-10-27", color:"indigo" },
  { title:"AOO Registration",              start:"2026-10-28", end:"2026-10-30", color:"gray" },
  { title:"Golden Kingdom",                start:"2026-10-28", end:"2026-10-30", color:"gold" },
  { title:"Ark of Osiris",                 start:"2026-10-31", end:"2026-11-01", color:"tan" },
  { title:"Champions of Olympia",          start:"2026-10-31", end:"2026-11-01", color:"tan" },
  { title:"20 Gold Head Event",            start:"2026-10-30", end:"2026-10-31", color:"gold" },
  { title:"Egg / Hammer Event",            start:"2026-10-30", end:"2026-10-31", color:"teal" },

  { title:"Mightiest Governor (Archer)",   start:"2026-11-02", end:"2026-11-07", color:"gold" },
  { title:"Ceroli Crisis",                 start:"2026-11-02", end:"2026-11-04", color:"teal" },
  { title:"Wheel of Fortune (Archer)",     start:"2026-11-03", end:"2026-11-05", color:"purple" },
  { title:"Champions of Olympia",          start:"2026-11-07", end:"2026-11-08", color:"tan" },

  { title:"Armament, Reveal Thyself",      start:"2026-11-09", end:"2026-11-10", color:"violet" },
  { title:"Realm of Mystique",             start:"2026-11-09", end:"2026-11-10", color:"indigo" },
  { title:"AOO Registration",              start:"2026-11-11", end:"2026-11-13", color:"gray" },
  { title:"Golden Kingdom",                start:"2026-11-11", end:"2026-11-13", color:"gold" },
  { title:"Ark of Osiris",                 start:"2026-11-14", end:"2026-11-15", color:"tan" },
  { title:"Champions of Olympia",          start:"2026-11-14", end:"2026-11-15", color:"tan" },
  { title:"20 Gold Head Event",            start:"2026-11-13", end:"2026-11-14", color:"gold" },
  { title:"Egg / Hammer Event",            start:"2026-11-13", end:"2026-11-14", color:"teal" },

  { title:"Mightiest Governor (Leadership)", start:"2026-11-16", end:"2026-11-21", color:"gold" },
  { title:"Ceroli Crisis",                 start:"2026-11-16", end:"2026-11-18", color:"teal" },
  { title:"Wheel of Fortune (Leadership)", start:"2026-11-17", end:"2026-11-19", color:"purple" },
  { title:"Champions of Olympia",          start:"2026-11-21", end:"2026-11-22", color:"tan" },
  { title:"More Than Gems",                start:"2026-11-21", end:"2026-11-22", color:"maroon" },

  { title:"Esmeralda's House",             start:"2026-11-23", end:"2026-11-24", color:"maroon" },
  { title:"Realm of Mystique",             start:"2026-11-23", end:"2026-11-24", color:"indigo" },
  { title:"AOO Registration",              start:"2026-11-25", end:"2026-11-27", color:"gray" },
  { title:"Golden Kingdom",                start:"2026-11-25", end:"2026-11-27", color:"gold" },
  { title:"Ark of Osiris",                 start:"2026-11-28", end:"2026-11-29", color:"tan" },
  { title:"Champions of Olympia",          start:"2026-11-28", end:"2026-11-29", color:"tan" },
  { title:"20 Gold Head Event",            start:"2026-11-27", end:"2026-11-28", color:"gold" },
  { title:"Egg / Hammer Event",            start:"2026-11-27", end:"2026-11-28", color:"teal" },

  { title:"Mightiest Governor (Cavalry)",  start:"2026-11-30", end:"2026-12-05", color:"gold" },
  { title:"Ceroli Crisis",                 start:"2026-11-30", end:"2026-12-02", color:"teal" },
  { title:"Wheel of Fortune (Cavalry)",    start:"2026-12-01", end:"2026-12-03", color:"purple" },
  { title:"Champions of Olympia",          start:"2026-12-05", end:"2026-12-06", color:"tan" },

  { title:"Armament, Reveal Thyself",      start:"2026-12-07", end:"2026-12-08", color:"violet" },
  { title:"Realm of Mystique",             start:"2026-12-07", end:"2026-12-08", color:"indigo" },
  { title:"AOO Registration",              start:"2026-12-09", end:"2026-12-11", color:"gray" },
  { title:"Golden Kingdom",                start:"2026-12-09", end:"2026-12-11", color:"gold" },
  { title:"Ark of Osiris",                 start:"2026-12-12", end:"2026-12-13", color:"tan" },
  { title:"Champions of Olympia",          start:"2026-12-12", end:"2026-12-13", color:"tan" },
  { title:"20 Gold Head Event",            start:"2026-12-11", end:"2026-12-12", color:"gold" },
  { title:"Egg / Hammer Event",            start:"2026-12-11", end:"2026-12-12", color:"teal" },

  { title:"Mightiest Governor (Infantry)", start:"2026-12-14", end:"2026-12-19", color:"gold" },
  { title:"Ceroli Crisis",                 start:"2026-12-14", end:"2026-12-16", color:"teal" },
  { title:"Wheel of Fortune (Infantry)",   start:"2026-12-15", end:"2026-12-17", color:"purple" },
  { title:"Champions of Olympia",          start:"2026-12-19", end:"2026-12-20", color:"tan" },
  { title:"More Than Gems",                start:"2026-12-19", end:"2026-12-20", color:"maroon" },

  { title:"Dhalruk's Puzzle Box",          start:"2026-12-21", end:"2026-12-22", color:"teal" },
  { title:"Realm of Mystique",             start:"2026-12-21", end:"2026-12-22", color:"indigo" },
  { title:"AOO Registration",              start:"2026-12-23", end:"2026-12-25", color:"gray" },
  { title:"Golden Kingdom",                start:"2026-12-23", end:"2026-12-25", color:"gold" },
  { title:"Ark of Osiris",                 start:"2026-12-26", end:"2026-12-27", color:"tan" },
  { title:"Champions of Olympia",          start:"2026-12-26", end:"2026-12-27", color:"tan" },
  { title:"20 Gold Head Event",            start:"2026-12-25", end:"2026-12-26", color:"gold" },
  { title:"Egg / Hammer Event",            start:"2026-12-25", end:"2026-12-26", color:"teal" },

  { title:"Mightiest Governor (Archer)",   start:"2026-12-28", end:"2027-01-02", color:"gold" },
  { title:"Ceroli Crisis",                 start:"2026-12-28", end:"2026-12-30", color:"teal" },
  { title:"Wheel of Fortune (Archer)",     start:"2026-12-29", end:"2026-12-31", color:"purple" },
  { title:"Champions of Olympia",          start:"2027-01-02", end:"2027-01-03", color:"tan" },

  { title:"Armament, Reveal Thyself",      start:"2027-01-04", end:"2027-01-05", color:"violet" },
  { title:"Realm of Mystique",             start:"2027-01-04", end:"2027-01-05", color:"indigo" },
  { title:"AOO Registration",              start:"2027-01-05", end:"2027-01-07", color:"gray" },
  { title:"Golden Kingdom",                start:"2027-01-05", end:"2027-01-07", color:"gold" },
  { title:"20 Gold Head Event",            start:"2027-01-08", end:"2027-01-09", color:"gold" },
  { title:"Egg / Hammer Event",            start:"2027-01-08", end:"2027-01-09", color:"teal" },
  { title:"Ark of Osiris",                 start:"2027-01-09", end:"2027-01-10", color:"tan" },
  { title:"Champions of Olympia",          start:"2027-01-09", end:"2027-01-10", color:"tan" },

  { title:"Mightiest Governor (Leadership)", start:"2027-01-11", end:"2027-01-16", color:"gold" },
  { title:"Ceroli Crisis",                 start:"2027-01-11", end:"2027-01-13", color:"teal" },
  { title:"Wheel of Fortune (Leadership)", start:"2027-01-12", end:"2027-01-14", color:"purple" },
  { title:"Champions of Olympia",          start:"2027-01-16", end:"2027-01-17", color:"tan" },
  { title:"More Than Gems",                start:"2027-01-16", end:"2027-01-17", color:"maroon" },

  { title:"Esmeralda's House",             start:"2027-01-18", end:"2027-01-19", color:"maroon" },
  { title:"Realm of Mystique",             start:"2027-01-18", end:"2027-01-19", color:"indigo" },
  { title:"AOO Registration",              start:"2027-01-19", end:"2027-01-21", color:"gray" },
  { title:"Golden Kingdom",                start:"2027-01-19", end:"2027-01-21", color:"gold" },
  { title:"20 Gold Head Event",            start:"2027-01-22", end:"2027-01-23", color:"gold" },
  { title:"Egg / Hammer Event",            start:"2027-01-22", end:"2027-01-23", color:"teal" },
  { title:"Ark of Osiris",                 start:"2027-01-23", end:"2027-01-24", color:"tan" },
  { title:"Champions of Olympia",          start:"2027-01-23", end:"2027-01-24", color:"tan" },

  { title:"Mightiest Governor (Cavalry)",  start:"2027-01-25", end:"2027-01-30", color:"gold" },
  { title:"Ceroli Crisis",                 start:"2027-01-25", end:"2027-01-27", color:"teal" },
  { title:"Wheel of Fortune (Cavalry)",    start:"2027-01-26", end:"2027-01-28", color:"purple" },
  { title:"Champions of Olympia",          start:"2027-01-30", end:"2027-01-31", color:"tan" },

  { title:"Armament, Reveal Thyself",      start:"2027-02-01", end:"2027-02-02", color:"violet" },
  { title:"Realm of Mystique",             start:"2027-02-01", end:"2027-02-02", color:"indigo" },
  { title:"AOO Registration",              start:"2027-02-02", end:"2027-02-04", color:"gray" },
  { title:"Golden Kingdom",                start:"2027-02-02", end:"2027-02-04", color:"gold" },
  { title:"20 Gold Head Event",            start:"2027-02-05", end:"2027-02-06", color:"gold" },
  { title:"Egg / Hammer Event",            start:"2027-02-05", end:"2027-02-06", color:"teal" },
  { title:"Ark of Osiris",                 start:"2027-02-06", end:"2027-02-07", color:"tan" },
  { title:"Champions of Olympia",          start:"2027-02-06", end:"2027-02-07", color:"tan" },

  { title:"Mightiest Governor (Infantry)", start:"2027-02-08", end:"2027-02-13", color:"gold" },
  { title:"Ceroli Crisis",                 start:"2027-02-08", end:"2027-02-10", color:"teal" },
  { title:"Wheel of Fortune (Infantry)",   start:"2027-02-09", end:"2027-02-11", color:"purple" },
  { title:"Champions of Olympia",          start:"2027-02-13", end:"2027-02-14", color:"tan" },
  { title:"More Than Gems",                start:"2027-02-13", end:"2027-02-14", color:"maroon" },

  { title:"Dhalruk's Puzzle Box",          start:"2027-02-15", end:"2027-02-16", color:"teal" },
  { title:"Realm of Mystique",             start:"2027-02-15", end:"2027-02-16", color:"indigo" },
  { title:"AOO Registration",              start:"2027-02-16", end:"2027-02-18", color:"gray" },
  { title:"Golden Kingdom",                start:"2027-02-16", end:"2027-02-18", color:"gold" },
  { title:"20 Gold Head Event",            start:"2027-02-19", end:"2027-02-20", color:"gold" },
  { title:"Egg / Hammer Event",            start:"2027-02-19", end:"2027-02-20", color:"teal" },
  { title:"Ark of Osiris",                 start:"2027-02-20", end:"2027-02-21", color:"tan" },
  { title:"Champions of Olympia",          start:"2027-02-20", end:"2027-02-21", color:"tan" },

  { title:"Mightiest Governor (Archer)",   start:"2027-02-22", end:"2027-02-27", color:"gold" },
  { title:"Ceroli Crisis",                 start:"2027-02-22", end:"2027-02-24", color:"teal" },
  { title:"Wheel of Fortune (Archer)",     start:"2027-02-23", end:"2027-02-25", color:"purple" },
  { title:"Champions of Olympia",          start:"2027-02-27", end:"2027-02-28", color:"tan" },

  { title:"Armament, Reveal Thyself",      start:"2027-03-01", end:"2027-03-02", color:"violet" },
  { title:"Realm of Mystique",             start:"2027-03-01", end:"2027-03-02", color:"indigo" },
  { title:"AOO Registration",              start:"2027-03-03", end:"2027-03-05", color:"gray" },
  { title:"Golden Kingdom",                start:"2027-03-03", end:"2027-03-05", color:"gold" },
  { title:"20 Gold Head Event",            start:"2027-03-05", end:"2027-03-06", color:"gold" },
  { title:"Egg / Hammer Event",            start:"2027-03-05", end:"2027-03-06", color:"teal" },
  { title:"Ark of Osiris",                 start:"2027-03-06", end:"2027-03-07", color:"tan" },
  { title:"Champions of Olympia",          start:"2027-03-06", end:"2027-03-07", color:"tan" },

  { title:"Mightiest Governor (Leadership)", start:"2027-03-08", end:"2027-03-13", color:"gold" },
  { title:"Ceroli Crisis",                 start:"2027-03-08", end:"2027-03-10", color:"teal" },
  { title:"Wheel of Fortune (Leadership)", start:"2027-03-09", end:"2027-03-11", color:"purple" },
  { title:"Champions of Olympia",          start:"2027-03-13", end:"2027-03-14", color:"tan" },
  { title:"More Than Gems",                start:"2027-03-13", end:"2027-03-14", color:"maroon" },

  { title:"Esmeralda's House",             start:"2027-03-15", end:"2027-03-16", color:"maroon" },
  { title:"Realm of Mystique",             start:"2027-03-15", end:"2027-03-16", color:"indigo" },
  { title:"AOO Registration",              start:"2027-03-17", end:"2027-03-19", color:"gray" },
  { title:"Golden Kingdom",                start:"2027-03-17", end:"2027-03-19", color:"gold" },
  { title:"20 Gold Head Event",            start:"2027-03-19", end:"2027-03-20", color:"gold" },
  { title:"Egg / Hammer Event",            start:"2027-03-19", end:"2027-03-20", color:"teal" },
  { title:"Ark of Osiris",                 start:"2027-03-20", end:"2027-03-21", color:"tan" },
  { title:"Champions of Olympia",          start:"2027-03-20", end:"2027-03-21", color:"tan" },

  { title:"Mightiest Governor (Cavalry)",  start:"2027-03-22", end:"2027-03-27", color:"gold" },
  { title:"Ceroli Crisis",                 start:"2027-03-22", end:"2027-03-24", color:"teal" },
  { title:"Wheel of Fortune (Cavalry)",    start:"2027-03-23", end:"2027-03-25", color:"purple" },
  { title:"Champions of Olympia",          start:"2027-03-27", end:"2027-03-28", color:"tan" },

  { title:"Armament, Reveal Thyself",      start:"2027-03-29", end:"2027-03-30", color:"violet" },
  { title:"Realm of Mystique",             start:"2027-03-29", end:"2027-03-30", color:"indigo" },
  { title:"AOO Registration",              start:"2027-03-31", end:"2027-04-02", color:"gray" },
  { title:"Golden Kingdom",                start:"2027-03-31", end:"2027-04-02", color:"gold" },
  { title:"20 Gold Head Event",            start:"2027-04-02", end:"2027-04-03", color:"gold" },
  { title:"Egg / Hammer Event",            start:"2027-04-02", end:"2027-04-03", color:"teal" },
  { title:"Ark of Osiris",                 start:"2027-04-03", end:"2027-04-04", color:"tan" },
  { title:"Champions of Olympia",          start:"2027-04-03", end:"2027-04-04", color:"tan" },

  { title:"Mightiest Governor (Infantry)", start:"2027-04-05", end:"2027-04-10", color:"gold" },
  { title:"Ceroli Crisis",                 start:"2027-04-05", end:"2027-04-07", color:"teal" },
  { title:"Wheel of Fortune (Infantry)",   start:"2027-04-06", end:"2027-04-08", color:"purple" },
  { title:"Champions of Olympia",          start:"2027-04-10", end:"2027-04-11", color:"tan" },
  { title:"More Than Gems",                start:"2027-04-10", end:"2027-04-11", color:"maroon" },

  { title:"Dhalruk's Puzzle Box",          start:"2027-04-12", end:"2027-04-13", color:"teal" },
  { title:"Realm of Mystique",             start:"2027-04-12", end:"2027-04-13", color:"indigo" },
  { title:"AOO Registration",              start:"2027-04-14", end:"2027-04-16", color:"gray" },
  { title:"Golden Kingdom",                start:"2027-04-14", end:"2027-04-16", color:"gold" },
  { title:"20 Gold Head Event",            start:"2027-04-16", end:"2027-04-17", color:"gold" },
  { title:"Egg / Hammer Event",            start:"2027-04-16", end:"2027-04-17", color:"teal" },
  { title:"Ark of Osiris",                 start:"2027-04-17", end:"2027-04-18", color:"tan" },
  { title:"Champions of Olympia",          start:"2027-04-17", end:"2027-04-18", color:"tan" },

  { title:"Mightiest Governor (Archer)",   start:"2027-04-19", end:"2027-04-24", color:"gold" },
  { title:"Ceroli Crisis",                 start:"2027-04-19", end:"2027-04-21", color:"teal" },
  { title:"Wheel of Fortune (Archer)",     start:"2027-04-20", end:"2027-04-22", color:"purple" },
  { title:"Champions of Olympia",          start:"2027-04-24", end:"2027-04-25", color:"tan" },

  { title:"Armament, Reveal Thyself",      start:"2027-04-26", end:"2027-04-27", color:"violet" },
  { title:"Realm of Mystique",             start:"2027-04-26", end:"2027-04-27", color:"indigo" },
  { title:"AOO Registration",              start:"2027-04-28", end:"2027-04-30", color:"gray" },
  { title:"Golden Kingdom",                start:"2027-04-28", end:"2027-04-30", color:"gold" },
  { title:"20 Gold Head Event",            start:"2027-04-30", end:"2027-05-01", color:"gold" },
  { title:"Egg / Hammer Event",            start:"2027-04-30", end:"2027-05-01", color:"teal" },
  { title:"Ark of Osiris",                 start:"2027-05-01", end:"2027-05-02", color:"tan" },
  { title:"Champions of Olympia",          start:"2027-05-01", end:"2027-05-02", color:"tan" },

  { title:"Mightiest Governor (Leadership)", start:"2027-05-03", end:"2027-05-08", color:"gold" },
  { title:"Ceroli Crisis",                 start:"2027-05-03", end:"2027-05-05", color:"teal" },
  { title:"Wheel of Fortune (Leadership)", start:"2027-05-04", end:"2027-05-06", color:"purple" },
  { title:"Champions of Olympia",          start:"2027-05-08", end:"2027-05-09", color:"tan" },
  { title:"More Than Gems",                start:"2027-05-08", end:"2027-05-09", color:"maroon" },

  { title:"Esmeralda's House",             start:"2027-05-10", end:"2027-05-11", color:"maroon" },
  { title:"Realm of Mystique",             start:"2027-05-10", end:"2027-05-11", color:"indigo" },
  { title:"AOO Registration",              start:"2027-05-12", end:"2027-05-14", color:"gray" },
  { title:"Golden Kingdom",                start:"2027-05-12", end:"2027-05-14", color:"gold" },
  { title:"20 Gold Head Event",            start:"2027-05-14", end:"2027-05-15", color:"gold" },
  { title:"Egg / Hammer Event",            start:"2027-05-14", end:"2027-05-15", color:"teal" },
  { title:"Ark of Osiris",                 start:"2027-05-15", end:"2027-05-16", color:"tan" },
  { title:"Champions of Olympia",          start:"2027-05-15", end:"2027-05-16", color:"tan" },

  { title:"Mightiest Governor (Cavalry)",  start:"2027-05-17", end:"2027-05-22", color:"gold" },
  { title:"Ceroli Crisis",                 start:"2027-05-17", end:"2027-05-19", color:"teal" },
  { title:"Wheel of Fortune (Cavalry)",    start:"2027-05-18", end:"2027-05-20", color:"purple" },
  { title:"Champions of Olympia",          start:"2027-05-22", end:"2027-05-23", color:"tan" },

  { title:"Armament, Reveal Thyself",      start:"2027-05-24", end:"2027-05-25", color:"violet" },
  { title:"Realm of Mystique",             start:"2027-05-24", end:"2027-05-25", color:"indigo" },
  { title:"AOO Registration",              start:"2027-05-26", end:"2027-05-28", color:"gray" },
  { title:"Golden Kingdom",                start:"2027-05-26", end:"2027-05-28", color:"gold" },
  { title:"20 Gold Head Event",            start:"2027-05-28", end:"2027-05-29", color:"gold" },
  { title:"Egg / Hammer Event",            start:"2027-05-28", end:"2027-05-29", color:"teal" },
  { title:"Ark of Osiris",                 start:"2027-05-29", end:"2027-05-30", color:"tan" },
  { title:"Champions of Olympia",          start:"2027-05-29", end:"2027-05-30", color:"tan" },

  { title:"Mightiest Governor (Infantry)", start:"2027-05-31", end:"2027-06-05", color:"gold" },
  { title:"Ceroli Crisis",                 start:"2027-05-31", end:"2027-06-02", color:"teal" },
  { title:"Wheel of Fortune (Infantry)",   start:"2027-06-01", end:"2027-06-03", color:"purple" },
  { title:"Champions of Olympia",          start:"2027-06-05", end:"2027-06-06", color:"tan" },
  { title:"More Than Gems",                start:"2027-06-05", end:"2027-06-06", color:"maroon" },

  { title:"Dhalruk's Puzzle Box",          start:"2027-06-07", end:"2027-06-08", color:"teal" },
  { title:"Realm of Mystique",             start:"2027-06-07", end:"2027-06-08", color:"indigo" },
  { title:"AOO Registration",              start:"2027-06-09", end:"2027-06-11", color:"gray" },
  { title:"Golden Kingdom",                start:"2027-06-09", end:"2027-06-11", color:"gold" },
  { title:"20 Gold Head Event",            start:"2027-06-11", end:"2027-06-12", color:"gold" },
  { title:"Egg / Hammer Event",            start:"2027-06-11", end:"2027-06-12", color:"teal" },
  { title:"Ark of Osiris",                 start:"2027-06-12", end:"2027-06-13", color:"tan" },
  { title:"Champions of Olympia",          start:"2027-06-12", end:"2027-06-13", color:"tan" },

  { title:"Mightiest Governor (Archer)",   start:"2027-06-14", end:"2027-06-19", color:"gold" },
  { title:"Ceroli Crisis",                 start:"2027-06-14", end:"2027-06-16", color:"teal" },
  { title:"Wheel of Fortune (Archer)",     start:"2027-06-15", end:"2027-06-17", color:"purple" },
  { title:"Champions of Olympia",          start:"2027-06-19", end:"2027-06-20", color:"tan" },

  { title:"Armament, Reveal Thyself",      start:"2027-06-21", end:"2027-06-22", color:"violet" },
  { title:"Realm of Mystique",             start:"2027-06-21", end:"2027-06-22", color:"indigo" },
  { title:"AOO Registration",              start:"2027-06-23", end:"2027-06-25", color:"gray" },
  { title:"Golden Kingdom",                start:"2027-06-23", end:"2027-06-25", color:"gold" },
  { title:"20 Gold Head Event",            start:"2027-06-25", end:"2027-06-26", color:"gold" },
  { title:"Egg / Hammer Event",            start:"2027-06-25", end:"2027-06-26", color:"teal" },
  { title:"Ark of Osiris",                 start:"2027-06-26", end:"2027-06-27", color:"tan" },
  { title:"Champions of Olympia",          start:"2027-06-26", end:"2027-06-27", color:"tan" },

  { title:"Mightiest Governor (Leadership)", start:"2027-06-28", end:"2027-07-03", color:"gold" },
  { title:"Ceroli Crisis",                 start:"2027-06-28", end:"2027-06-30", color:"teal" },
  { title:"Wheel of Fortune (Leadership)", start:"2027-06-29", end:"2027-07-01", color:"purple" },
  { title:"Champions of Olympia",          start:"2027-07-03", end:"2027-07-04", color:"tan" },
  { title:"More Than Gems",                start:"2027-07-03", end:"2027-07-04", color:"maroon" },

  { title:"Esmeralda's House",             start:"2027-07-05", end:"2027-07-06", color:"maroon" },
  { title:"Realm of Mystique",             start:"2027-07-05", end:"2027-07-06", color:"indigo" },
  { title:"AOO Registration",              start:"2027-07-07", end:"2027-07-09", color:"gray" },
  { title:"Golden Kingdom",                start:"2027-07-07", end:"2027-07-09", color:"gold" },
  { title:"20 Gold Head Event",            start:"2027-07-09", end:"2027-07-10", color:"gold" },
  { title:"Egg / Hammer Event",            start:"2027-07-09", end:"2027-07-10", color:"teal" },
  { title:"Ark of Osiris",                 start:"2027-07-10", end:"2027-07-11", color:"tan" },
  { title:"Champions of Olympia",          start:"2027-07-10", end:"2027-07-11", color:"tan" },

  { title:"Mightiest Governor (Cavalry)",  start:"2027-07-12", end:"2027-07-17", color:"gold" },
  { title:"Ceroli Crisis",                 start:"2027-07-12", end:"2027-07-14", color:"teal" },
  { title:"Wheel of Fortune (Cavalry)",    start:"2027-07-13", end:"2027-07-15", color:"purple" },
  { title:"Champions of Olympia",          start:"2027-07-17", end:"2027-07-18", color:"tan" },

  { title:"Armament, Reveal Thyself",      start:"2027-07-19", end:"2027-07-20", color:"violet" },
  { title:"Realm of Mystique",             start:"2027-07-19", end:"2027-07-20", color:"indigo" },
  { title:"AOO Registration",              start:"2027-07-21", end:"2027-07-23", color:"gray" },
  { title:"Golden Kingdom",                start:"2027-07-21", end:"2027-07-23", color:"gold" },
  { title:"20 Gold Head Event",            start:"2027-07-23", end:"2027-07-24", color:"gold" },
  { title:"Egg / Hammer Event",            start:"2027-07-23", end:"2027-07-24", color:"teal" },
  { title:"Ark of Osiris",                 start:"2027-07-24", end:"2027-07-25", color:"tan" },
  { title:"Champions of Olympia",          start:"2027-07-24", end:"2027-07-25", color:"tan" },

  { title:"Mightiest Governor (Infantry)", start:"2027-07-26", end:"2027-07-31", color:"gold" },
  { title:"Ceroli Crisis",                 start:"2027-07-26", end:"2027-07-28", color:"teal" },
  { title:"Wheel of Fortune (Infantry)",   start:"2027-07-27", end:"2027-07-29", color:"purple" },
  { title:"Champions of Olympia",          start:"2027-07-31", end:"2027-08-01", color:"tan" },
  { title:"More Than Gems",                start:"2027-07-31", end:"2027-08-01", color:"maroon" },

  { title:"Dhalruk's Puzzle Box",          start:"2027-08-02", end:"2027-08-03", color:"teal" },
  { title:"Realm of Mystique",             start:"2027-08-02", end:"2027-08-03", color:"indigo" },
  { title:"AOO Registration",              start:"2027-08-04", end:"2027-08-06", color:"gray" },
  { title:"Golden Kingdom",                start:"2027-08-04", end:"2027-08-06", color:"gold" },
  { title:"20 Gold Head Event",            start:"2027-08-06", end:"2027-08-07", color:"gold" },
  { title:"Egg / Hammer Event",            start:"2027-08-06", end:"2027-08-07", color:"teal" },
  { title:"Ark of Osiris",                 start:"2027-08-07", end:"2027-08-08", color:"tan" },
  { title:"Champions of Olympia",          start:"2027-08-07", end:"2027-08-08", color:"tan" },

  { title:"Mightiest Governor (Archer)",   start:"2027-08-09", end:"2027-08-14", color:"gold" },
  { title:"Ceroli Crisis",                 start:"2027-08-09", end:"2027-08-11", color:"teal" },
  { title:"Wheel of Fortune (Archer)",     start:"2027-08-10", end:"2027-08-12", color:"purple" },
  { title:"Champions of Olympia",          start:"2027-08-14", end:"2027-08-15", color:"tan" },

  { title:"Armament, Reveal Thyself",      start:"2027-08-16", end:"2027-08-17", color:"violet" },
  { title:"Realm of Mystique",             start:"2027-08-16", end:"2027-08-17", color:"indigo" },
  { title:"AOO Registration",              start:"2027-08-18", end:"2027-08-20", color:"gray" },
  { title:"Golden Kingdom",                start:"2027-08-18", end:"2027-08-20", color:"gold" },
  { title:"20 Gold Head Event",            start:"2027-08-20", end:"2027-08-21", color:"gold" },
  { title:"Egg / Hammer Event",            start:"2027-08-20", end:"2027-08-21", color:"teal" },
  { title:"Ark of Osiris",                 start:"2027-08-21", end:"2027-08-22", color:"tan" },
  { title:"Champions of Olympia",          start:"2027-08-21", end:"2027-08-22", color:"tan" },

  { title:"Mightiest Governor (Leadership)", start:"2027-08-23", end:"2027-08-28", color:"gold" },
  { title:"Ceroli Crisis",                 start:"2027-08-23", end:"2027-08-25", color:"teal" },
  { title:"Wheel of Fortune (Leadership)", start:"2027-08-24", end:"2027-08-26", color:"purple" },
  { title:"Champions of Olympia",          start:"2027-08-28", end:"2027-08-29", color:"tan" },
  { title:"More Than Gems",                start:"2027-08-28", end:"2027-08-29", color:"maroon" },

  { title:"Esmeralda's House",             start:"2027-08-30", end:"2027-08-31", color:"maroon" },
  { title:"Realm of Mystique",             start:"2027-08-30", end:"2027-08-31", color:"indigo" },
  { title:"AOO Registration",              start:"2027-09-01", end:"2027-09-03", color:"gray" },
  { title:"Golden Kingdom",                start:"2027-09-01", end:"2027-09-03", color:"gold" },
  { title:"20 Gold Head Event",            start:"2027-09-03", end:"2027-09-04", color:"gold" },
  { title:"Egg / Hammer Event",            start:"2027-09-03", end:"2027-09-04", color:"teal" },
  { title:"Ark of Osiris",                 start:"2027-09-04", end:"2027-09-05", color:"tan" },
  { title:"Champions of Olympia",          start:"2027-09-04", end:"2027-09-05", color:"tan" },

  { title:"Mightiest Governor (Cavalry)",  start:"2027-09-06", end:"2027-09-11", color:"gold" },
  { title:"Ceroli Crisis",                 start:"2027-09-06", end:"2027-09-08", color:"teal" },
  { title:"Wheel of Fortune (Cavalry)",    start:"2027-09-07", end:"2027-09-09", color:"purple" },
  { title:"Champions of Olympia",          start:"2027-09-11", end:"2027-09-12", color:"tan" },

  { title:"Armament, Reveal Thyself",      start:"2027-09-13", end:"2027-09-14", color:"violet" },
  { title:"Realm of Mystique",             start:"2027-09-13", end:"2027-09-14", color:"indigo" },
  { title:"AOO Registration",              start:"2027-09-15", end:"2027-09-17", color:"gray" },
  { title:"Golden Kingdom",                start:"2027-09-15", end:"2027-09-17", color:"gold" },
  { title:"20 Gold Head Event",            start:"2027-09-17", end:"2027-09-18", color:"gold" },
  { title:"Egg / Hammer Event",            start:"2027-09-17", end:"2027-09-18", color:"teal" },
  { title:"Ark of Osiris",                 start:"2027-09-18", end:"2027-09-19", color:"tan" },
  { title:"Champions of Olympia",          start:"2027-09-18", end:"2027-09-19", color:"tan" },

  { title:"Mightiest Governor (Infantry)", start:"2027-09-20", end:"2027-09-25", color:"gold" },
  { title:"Ceroli Crisis",                 start:"2027-09-20", end:"2027-09-22", color:"teal" },
  { title:"Wheel of Fortune (Infantry)",   start:"2027-09-21", end:"2027-09-23", color:"purple" },
  { title:"Champions of Olympia",          start:"2027-09-25", end:"2027-09-26", color:"tan" },
  { title:"More Than Gems",                start:"2027-09-25", end:"2027-09-26", color:"maroon" },

  { title:"Dhalruk's Puzzle Box",          start:"2027-09-27", end:"2027-09-28", color:"teal" },
  { title:"Realm of Mystique",             start:"2027-09-27", end:"2027-09-28", color:"indigo" },
  { title:"AOO Registration",              start:"2027-09-29", end:"2027-10-01", color:"gray" },
  { title:"Golden Kingdom",                start:"2027-09-29", end:"2027-10-01", color:"gold" },
  { title:"20 Gold Head Event",            start:"2027-10-01", end:"2027-10-02", color:"gold" },
  { title:"Egg / Hammer Event",            start:"2027-10-01", end:"2027-10-02", color:"teal" },
  { title:"Ark of Osiris",                 start:"2027-10-02", end:"2027-10-03", color:"tan" },
  { title:"Champions of Olympia",          start:"2027-10-02", end:"2027-10-03", color:"tan" },

  { title:"Mightiest Governor (Archer)",   start:"2027-10-04", end:"2027-10-09", color:"gold" },
  { title:"Ceroli Crisis",                 start:"2027-10-04", end:"2027-10-06", color:"teal" },
  { title:"Wheel of Fortune (Archer)",     start:"2027-10-05", end:"2027-10-07", color:"purple" },
  { title:"Champions of Olympia",          start:"2027-10-09", end:"2027-10-10", color:"tan" },

  { title:"Armament, Reveal Thyself",      start:"2027-10-11", end:"2027-10-12", color:"violet" },
  { title:"Realm of Mystique",             start:"2027-10-11", end:"2027-10-12", color:"indigo" },
  { title:"AOO Registration",              start:"2027-10-13", end:"2027-10-15", color:"gray" },
  { title:"Golden Kingdom",                start:"2027-10-13", end:"2027-10-15", color:"gold" },
  { title:"20 Gold Head Event",            start:"2027-10-15", end:"2027-10-16", color:"gold" },
  { title:"Egg / Hammer Event",            start:"2027-10-15", end:"2027-10-16", color:"teal" },
  { title:"Ark of Osiris",                 start:"2027-10-16", end:"2027-10-17", color:"tan" },
  { title:"Champions of Olympia",          start:"2027-10-16", end:"2027-10-17", color:"tan" },

  { title:"Mightiest Governor (Leadership)", start:"2027-10-18", end:"2027-10-23", color:"gold" },
  { title:"Ceroli Crisis",                 start:"2027-10-18", end:"2027-10-20", color:"teal" },
  { title:"Wheel of Fortune (Leadership)", start:"2027-10-19", end:"2027-10-21", color:"purple" },
  { title:"Champions of Olympia",          start:"2027-10-23", end:"2027-10-24", color:"tan" },
  { title:"More Than Gems",                start:"2027-10-23", end:"2027-10-24", color:"maroon" },

  { title:"Esmeralda's House",             start:"2027-10-25", end:"2027-10-26", color:"maroon" },
  { title:"Realm of Mystique",             start:"2027-10-25", end:"2027-10-26", color:"indigo" },
  { title:"AOO Registration",              start:"2027-10-27", end:"2027-10-29", color:"gray" },
  { title:"Golden Kingdom",                start:"2027-10-27", end:"2027-10-29", color:"gold" },
  { title:"20 Gold Head Event",            start:"2027-10-29", end:"2027-10-30", color:"gold" },
  { title:"Egg / Hammer Event",            start:"2027-10-29", end:"2027-10-30", color:"teal" },
  { title:"Ark of Osiris",                 start:"2027-10-30", end:"2027-10-31", color:"tan" },
  { title:"Champions of Olympia",          start:"2027-10-30", end:"2027-10-31", color:"tan" },

  { title:"Mightiest Governor (Cavalry)",  start:"2027-11-01", end:"2027-11-06", color:"gold" },
  { title:"Ceroli Crisis",                 start:"2027-11-01", end:"2027-11-03", color:"teal" },
  { title:"Wheel of Fortune (Cavalry)",    start:"2027-11-02", end:"2027-11-04", color:"purple" },
  { title:"Champions of Olympia",          start:"2027-11-06", end:"2027-11-07", color:"tan" },

  { title:"Armament, Reveal Thyself",      start:"2027-11-08", end:"2027-11-09", color:"violet" },
  { title:"Realm of Mystique",             start:"2027-11-08", end:"2027-11-09", color:"indigo" },
  { title:"AOO Registration",              start:"2027-11-10", end:"2027-11-12", color:"gray" },
  { title:"Golden Kingdom",                start:"2027-11-10", end:"2027-11-12", color:"gold" },
  { title:"20 Gold Head Event",            start:"2027-11-12", end:"2027-11-13", color:"gold" },
  { title:"Egg / Hammer Event",            start:"2027-11-12", end:"2027-11-13", color:"teal" },
  { title:"Ark of Osiris",                 start:"2027-11-13", end:"2027-11-14", color:"tan" },
  { title:"Champions of Olympia",          start:"2027-11-13", end:"2027-11-14", color:"tan" },

  { title:"Mightiest Governor (Infantry)", start:"2027-11-15", end:"2027-11-20", color:"gold" },
  { title:"Ceroli Crisis",                 start:"2027-11-15", end:"2027-11-17", color:"teal" },
  { title:"Wheel of Fortune (Infantry)",   start:"2027-11-16", end:"2027-11-18", color:"purple" },
  { title:"Champions of Olympia",          start:"2027-11-20", end:"2027-11-21", color:"tan" },
  { title:"More Than Gems",                start:"2027-11-20", end:"2027-11-21", color:"maroon" },

  { title:"Dhalruk's Puzzle Box",          start:"2027-11-22", end:"2027-11-23", color:"teal" },
  { title:"Realm of Mystique",             start:"2027-11-22", end:"2027-11-23", color:"indigo" },
  { title:"AOO Registration",              start:"2027-11-24", end:"2027-11-26", color:"gray" },
  { title:"Golden Kingdom",                start:"2027-11-24", end:"2027-11-26", color:"gold" },
  { title:"20 Gold Head Event",            start:"2027-11-26", end:"2027-11-27", color:"gold" },
  { title:"Egg / Hammer Event",            start:"2027-11-26", end:"2027-11-27", color:"teal" },
  { title:"Ark of Osiris",                 start:"2027-11-27", end:"2027-11-28", color:"tan" },
  { title:"Champions of Olympia",          start:"2027-11-27", end:"2027-11-28", color:"tan" },

  { title:"Mightiest Governor (Archer)",   start:"2027-11-29", end:"2027-12-04", color:"gold" },
  { title:"Ceroli Crisis",                 start:"2027-11-29", end:"2027-12-01", color:"teal" },
  { title:"Wheel of Fortune (Archer)",     start:"2027-11-30", end:"2027-12-02", color:"purple" },
  { title:"Champions of Olympia",          start:"2027-12-04", end:"2027-12-05", color:"tan" },

  { title:"Armament, Reveal Thyself",      start:"2027-12-06", end:"2027-12-07", color:"violet" },
  { title:"Realm of Mystique",             start:"2027-12-06", end:"2027-12-07", color:"indigo" },
  { title:"AOO Registration",              start:"2027-12-08", end:"2027-12-10", color:"gray" },
  { title:"Golden Kingdom",                start:"2027-12-08", end:"2027-12-10", color:"gold" },
  { title:"20 Gold Head Event",            start:"2027-12-10", end:"2027-12-11", color:"gold" },
  { title:"Egg / Hammer Event",            start:"2027-12-10", end:"2027-12-11", color:"teal" },
  { title:"Ark of Osiris",                 start:"2027-12-11", end:"2027-12-12", color:"tan" },
  { title:"Champions of Olympia",          start:"2027-12-11", end:"2027-12-12", color:"tan" },

  { title:"Mightiest Governor (Leadership)", start:"2027-12-13", end:"2027-12-18", color:"gold" },
  { title:"Ceroli Crisis",                 start:"2027-12-13", end:"2027-12-15", color:"teal" },
  { title:"Wheel of Fortune (Leadership)", start:"2027-12-14", end:"2027-12-16", color:"purple" },
  { title:"Champions of Olympia",          start:"2027-12-18", end:"2027-12-19", color:"tan" },
  { title:"More Than Gems",                start:"2027-12-18", end:"2027-12-19", color:"maroon" },

  { title:"Esmeralda's House",             start:"2027-12-20", end:"2027-12-21", color:"maroon" },
  { title:"Realm of Mystique",             start:"2027-12-20", end:"2027-12-21", color:"indigo" },
  { title:"AOO Registration",              start:"2027-12-22", end:"2027-12-24", color:"gray" },
  { title:"Golden Kingdom",                start:"2027-12-22", end:"2027-12-24", color:"gold" },
  { title:"20 Gold Head Event",            start:"2027-12-24", end:"2027-12-25", color:"gold" },
  { title:"Egg / Hammer Event",            start:"2027-12-24", end:"2027-12-25", color:"teal" },
  { title:"Ark of Osiris",                 start:"2027-12-25", end:"2027-12-26", color:"tan" },
  { title:"Champions of Olympia",          start:"2027-12-25", end:"2027-12-26", color:"tan" },

  { title:"Mightiest Governor (Cavalry)",  start:"2027-12-27", end:"2028-01-01", color:"gold" },
  { title:"Ceroli Crisis",                 start:"2027-12-27", end:"2027-12-29", color:"teal" },
  { title:"Wheel of Fortune (Cavalry)",    start:"2027-12-28", end:"2027-12-30", color:"purple" },
  { title:"Champions of Olympia",          start:"2028-01-01", end:"2028-01-02", color:"tan" },

  { title:"Armament, Reveal Thyself",      start:"2028-01-03", end:"2028-01-04", color:"violet" },
  { title:"Realm of Mystique",             start:"2028-01-03", end:"2028-01-04", color:"indigo" },
  { title:"AOO Registration",              start:"2028-01-05", end:"2028-01-07", color:"gray" },
  { title:"Golden Kingdom",                start:"2028-01-05", end:"2028-01-07", color:"gold" },
  { title:"20 Gold Head Event",            start:"2028-01-07", end:"2028-01-08", color:"gold" },
  { title:"Egg / Hammer Event",            start:"2028-01-07", end:"2028-01-08", color:"teal" },
  { title:"Ark of Osiris",                 start:"2028-01-08", end:"2028-01-09", color:"tan" },
  { title:"Champions of Olympia",          start:"2028-01-08", end:"2028-01-09", color:"tan" },

  { title:"Mightiest Governor (Infantry)", start:"2028-01-10", end:"2028-01-15", color:"gold" },
  { title:"Ceroli Crisis",                 start:"2028-01-10", end:"2028-01-12", color:"teal" },
  { title:"Wheel of Fortune (Infantry)",   start:"2028-01-11", end:"2028-01-13", color:"purple" },
  { title:"Champions of Olympia",          start:"2028-01-15", end:"2028-01-16", color:"tan" },
  { title:"More Than Gems",                start:"2028-01-15", end:"2028-01-16", color:"maroon" },

  { title:"Dhalruk's Puzzle Box",          start:"2028-01-17", end:"2028-01-18", color:"teal" },
  { title:"Realm of Mystique",             start:"2028-01-17", end:"2028-01-18", color:"indigo" },
  { title:"AOO Registration",              start:"2028-01-19", end:"2028-01-21", color:"gray" },
  { title:"Golden Kingdom",                start:"2028-01-19", end:"2028-01-21", color:"gold" },
  { title:"20 Gold Head Event",            start:"2028-01-21", end:"2028-01-22", color:"gold" },
  { title:"Egg / Hammer Event",            start:"2028-01-21", end:"2028-01-22", color:"teal" },
  { title:"Ark of Osiris",                 start:"2028-01-22", end:"2028-01-23", color:"tan" },
  { title:"Champions of Olympia",          start:"2028-01-22", end:"2028-01-23", color:"tan" },

  { title:"Mightiest Governor (Archer)",   start:"2028-01-24", end:"2028-01-29", color:"gold" },
  { title:"Ceroli Crisis",                 start:"2028-01-24", end:"2028-01-26", color:"teal" },
  { title:"Wheel of Fortune (Archer)",     start:"2028-01-25", end:"2028-01-27", color:"purple" },
  { title:"Champions of Olympia",          start:"2028-01-29", end:"2028-01-30", color:"tan" },

  { title:"Armament, Reveal Thyself",      start:"2028-01-31", end:"2028-02-01", color:"violet" },
  { title:"Realm of Mystique",             start:"2028-01-31", end:"2028-02-01", color:"indigo" },
  { title:"AOO Registration",              start:"2028-02-02", end:"2028-02-04", color:"gray" },
  { title:"Golden Kingdom",                start:"2028-02-02", end:"2028-02-04", color:"gold" },
  { title:"20 Gold Head Event",            start:"2028-02-04", end:"2028-02-05", color:"gold" },
  { title:"Egg / Hammer Event",            start:"2028-02-04", end:"2028-02-05", color:"teal" },
  { title:"Ark of Osiris",                 start:"2028-02-05", end:"2028-02-06", color:"tan" },
  { title:"Champions of Olympia",          start:"2028-02-05", end:"2028-02-06", color:"tan" },

  { title:"Mightiest Governor (Leadership)", start:"2028-02-07", end:"2028-02-12", color:"gold" },
  { title:"Ceroli Crisis",                 start:"2028-02-07", end:"2028-02-09", color:"teal" },
  { title:"Wheel of Fortune (Leadership)", start:"2028-02-08", end:"2028-02-10", color:"purple" },
  { title:"Champions of Olympia",          start:"2028-02-12", end:"2028-02-13", color:"tan" },
  { title:"More Than Gems",                start:"2028-02-12", end:"2028-02-13", color:"maroon" },

  { title:"Esmeralda's House",             start:"2028-02-14", end:"2028-02-15", color:"maroon" },
  { title:"Realm of Mystique",             start:"2028-02-14", end:"2028-02-15", color:"indigo" },
  { title:"AOO Registration",              start:"2028-02-16", end:"2028-02-18", color:"gray" },
  { title:"Golden Kingdom",                start:"2028-02-16", end:"2028-02-18", color:"gold" },
  { title:"20 Gold Head Event",            start:"2028-02-18", end:"2028-02-19", color:"gold" },
  { title:"Egg / Hammer Event",            start:"2028-02-18", end:"2028-02-19", color:"teal" },
  { title:"Ark of Osiris",                 start:"2028-02-19", end:"2028-02-20", color:"tan" },
  { title:"Champions of Olympia",          start:"2028-02-19", end:"2028-02-20", color:"tan" },

  { title:"Mightiest Governor (Cavalry)",  start:"2028-02-21", end:"2028-02-26", color:"gold" },
  { title:"Ceroli Crisis",                 start:"2028-02-21", end:"2028-02-23", color:"teal" },
  { title:"Wheel of Fortune (Cavalry)",    start:"2028-02-22", end:"2028-02-24", color:"purple" },
  { title:"Champions of Olympia",          start:"2028-02-26", end:"2028-02-27", color:"tan" },

  { title:"Armament, Reveal Thyself",      start:"2028-02-28", end:"2028-02-29", color:"violet" },
  { title:"Realm of Mystique",             start:"2028-02-28", end:"2028-02-29", color:"indigo" },
  { title:"AOO Registration",              start:"2028-03-01", end:"2028-03-03", color:"gray" },
  { title:"Golden Kingdom",                start:"2028-03-01", end:"2028-03-03", color:"gold" },
  { title:"20 Gold Head Event",            start:"2028-03-03", end:"2028-03-04", color:"gold" },
  { title:"Egg / Hammer Event",            start:"2028-03-03", end:"2028-03-04", color:"teal" },
  { title:"Ark of Osiris",                 start:"2028-03-04", end:"2028-03-05", color:"tan" },
  { title:"Champions of Olympia",          start:"2028-03-04", end:"2028-03-05", color:"tan" },

  { title:"Mightiest Governor (Infantry)", start:"2028-03-06", end:"2028-03-11", color:"gold" },
  { title:"Ceroli Crisis",                 start:"2028-03-06", end:"2028-03-08", color:"teal" },
  { title:"Wheel of Fortune (Infantry)",   start:"2028-03-07", end:"2028-03-09", color:"purple" },
  { title:"Champions of Olympia",          start:"2028-03-11", end:"2028-03-12", color:"tan" },
  { title:"More Than Gems",                start:"2028-03-11", end:"2028-03-12", color:"maroon" },

  { title:"Dhalruk's Puzzle Box",          start:"2028-03-13", end:"2028-03-14", color:"teal" },
  { title:"Realm of Mystique",             start:"2028-03-13", end:"2028-03-14", color:"indigo" },
  { title:"AOO Registration",              start:"2028-03-15", end:"2028-03-17", color:"gray" },
  { title:"Golden Kingdom",                start:"2028-03-15", end:"2028-03-17", color:"gold" },
  { title:"20 Gold Head Event",            start:"2028-03-17", end:"2028-03-18", color:"gold" },
  { title:"Egg / Hammer Event",            start:"2028-03-17", end:"2028-03-18", color:"teal" },
  { title:"Ark of Osiris",                 start:"2028-03-18", end:"2028-03-19", color:"tan" },
  { title:"Champions of Olympia",          start:"2028-03-18", end:"2028-03-19", color:"tan" },

  { title:"Mightiest Governor (Archer)",   start:"2028-03-20", end:"2028-03-25", color:"gold" },
  { title:"Ceroli Crisis",                 start:"2028-03-20", end:"2028-03-22", color:"teal" },
  { title:"Wheel of Fortune (Archer)",     start:"2028-03-21", end:"2028-03-23", color:"purple" },
  { title:"Champions of Olympia",          start:"2028-03-25", end:"2028-03-26", color:"tan" },

  { title:"Armament, Reveal Thyself",      start:"2028-03-27", end:"2028-03-28", color:"violet" },
  { title:"Realm of Mystique",             start:"2028-03-27", end:"2028-03-28", color:"indigo" },
  { title:"AOO Registration",              start:"2028-03-29", end:"2028-03-31", color:"gray" },
  { title:"Golden Kingdom",                start:"2028-03-29", end:"2028-03-31", color:"gold" },
  { title:"20 Gold Head Event",            start:"2028-03-31", end:"2028-04-01", color:"gold" },
  { title:"Egg / Hammer Event",            start:"2028-03-31", end:"2028-04-01", color:"teal" },
  { title:"Ark of Osiris",                 start:"2028-04-01", end:"2028-04-02", color:"tan" },
  { title:"Champions of Olympia",          start:"2028-04-01", end:"2028-04-02", color:"tan" },

  { title:"Mightiest Governor (Leadership)", start:"2028-04-03", end:"2028-04-08", color:"gold" },
  { title:"Ceroli Crisis",                 start:"2028-04-03", end:"2028-04-05", color:"teal" },
  { title:"Wheel of Fortune (Leadership)", start:"2028-04-04", end:"2028-04-06", color:"purple" },
  { title:"Champions of Olympia",          start:"2028-04-08", end:"2028-04-09", color:"tan" },
  { title:"More Than Gems",                start:"2028-04-08", end:"2028-04-09", color:"maroon" },

  { title:"Esmeralda's House",             start:"2028-04-10", end:"2028-04-11", color:"maroon" },
  { title:"Realm of Mystique",             start:"2028-04-10", end:"2028-04-11", color:"indigo" },
  { title:"AOO Registration",              start:"2028-04-12", end:"2028-04-14", color:"gray" },
  { title:"Golden Kingdom",                start:"2028-04-12", end:"2028-04-14", color:"gold" },
  { title:"20 Gold Head Event",            start:"2028-04-14", end:"2028-04-15", color:"gold" },
  { title:"Egg / Hammer Event",            start:"2028-04-14", end:"2028-04-15", color:"teal" },
  { title:"Ark of Osiris",                 start:"2028-04-15", end:"2028-04-16", color:"tan" },
  { title:"Champions of Olympia",          start:"2028-04-15", end:"2028-04-16", color:"tan" },

  { title:"Mightiest Governor (Cavalry)",  start:"2028-04-17", end:"2028-04-22", color:"gold" },
  { title:"Ceroli Crisis",                 start:"2028-04-17", end:"2028-04-19", color:"teal" },
  { title:"Wheel of Fortune (Cavalry)",    start:"2028-04-18", end:"2028-04-20", color:"purple" },
  { title:"Champions of Olympia",          start:"2028-04-22", end:"2028-04-23", color:"tan" },

  { title:"Armament, Reveal Thyself",      start:"2028-04-24", end:"2028-04-25", color:"violet" },
  { title:"Realm of Mystique",             start:"2028-04-24", end:"2028-04-25", color:"indigo" },
  { title:"AOO Registration",              start:"2028-04-26", end:"2028-04-28", color:"gray" },
  { title:"Golden Kingdom",                start:"2028-04-26", end:"2028-04-28", color:"gold" },
  { title:"20 Gold Head Event",            start:"2028-04-28", end:"2028-04-29", color:"gold" },
  { title:"Egg / Hammer Event",            start:"2028-04-28", end:"2028-04-29", color:"teal" },
  { title:"Ark of Osiris",                 start:"2028-04-29", end:"2028-04-30", color:"tan" },
  { title:"Champions of Olympia",          start:"2028-04-29", end:"2028-04-30", color:"tan" },

  { title:"Mightiest Governor (Infantry)", start:"2028-05-01", end:"2028-05-06", color:"gold" },
  { title:"Ceroli Crisis",                 start:"2028-05-01", end:"2028-05-03", color:"teal" },
  { title:"Wheel of Fortune (Infantry)",   start:"2028-05-02", end:"2028-05-04", color:"purple" },
  { title:"Champions of Olympia",          start:"2028-05-06", end:"2028-05-07", color:"tan" },
  { title:"More Than Gems",                start:"2028-05-06", end:"2028-05-07", color:"maroon" },
  { title:"Dhalruk's Puzzle Box",          start:"2028-05-08", end:"2028-05-09", color:"teal" },
  { title:"Realm of Mystique",             start:"2028-05-08", end:"2028-05-09", color:"indigo" },
  { title:"AOO Registration",              start:"2028-05-10", end:"2028-05-12", color:"gray" },
  { title:"Golden Kingdom",                start:"2028-05-10", end:"2028-05-12", color:"gold" },
  { title:"20 Gold Head Event",            start:"2028-05-12", end:"2028-05-13", color:"gold" },
  { title:"Egg / Hammer Event",            start:"2028-05-12", end:"2028-05-13", color:"teal" },
  { title:"Ark of Osiris",                 start:"2028-05-13", end:"2028-05-14", color:"tan" },
  { title:"Champions of Olympia",          start:"2028-05-13", end:"2028-05-14", color:"tan" },

  { title:"Mightiest Governor (Archer)",   start:"2028-05-15", end:"2028-05-20", color:"gold" },
  { title:"Ceroli Crisis",                 start:"2028-05-15", end:"2028-05-17", color:"teal" },
  { title:"Wheel of Fortune (Archer)",     start:"2028-05-16", end:"2028-05-18", color:"purple" },
  { title:"Champions of Olympia",          start:"2028-05-20", end:"2028-05-21", color:"tan" },
  { title:"Armament, Reveal Thyself",      start:"2028-05-22", end:"2028-05-23", color:"violet" },
  { title:"Realm of Mystique",             start:"2028-05-22", end:"2028-05-23", color:"indigo" },
  { title:"AOO Registration",              start:"2028-05-24", end:"2028-05-26", color:"gray" },
  { title:"Golden Kingdom",                start:"2028-05-24", end:"2028-05-26", color:"gold" },
  { title:"20 Gold Head Event",            start:"2028-05-26", end:"2028-05-27", color:"gold" },
  { title:"Egg / Hammer Event",            start:"2028-05-26", end:"2028-05-27", color:"teal" },
  { title:"Ark of Osiris",                 start:"2028-05-27", end:"2028-05-28", color:"tan" },
  { title:"Champions of Olympia",          start:"2028-05-27", end:"2028-05-28", color:"tan" },

  { title:"Mightiest Governor (Leadership)", start:"2028-05-29", end:"2028-06-03", color:"gold" },
  { title:"Ceroli Crisis",                 start:"2028-05-29", end:"2028-05-31", color:"teal" },
  { title:"Wheel of Fortune (Leadership)", start:"2028-05-30", end:"2028-06-01", color:"purple" },
  { title:"Champions of Olympia",          start:"2028-06-03", end:"2028-06-04", color:"tan" },
  { title:"More Than Gems",                start:"2028-06-03", end:"2028-06-04", color:"maroon" },
  { title:"Esmeralda's House",             start:"2028-06-05", end:"2028-06-06", color:"maroon" },
  { title:"Realm of Mystique",             start:"2028-06-05", end:"2028-06-06", color:"indigo" },
  { title:"AOO Registration",              start:"2028-06-07", end:"2028-06-09", color:"gray" },
  { title:"Golden Kingdom",                start:"2028-06-07", end:"2028-06-09", color:"gold" },
  { title:"20 Gold Head Event",            start:"2028-06-09", end:"2028-06-10", color:"gold" },
  { title:"Egg / Hammer Event",            start:"2028-06-09", end:"2028-06-10", color:"teal" },
  { title:"Ark of Osiris",                 start:"2028-06-10", end:"2028-06-11", color:"tan" },
  { title:"Champions of Olympia",          start:"2028-06-10", end:"2028-06-11", color:"tan" },

  { title:"Mightiest Governor (Cavalry)",  start:"2028-06-12", end:"2028-06-17", color:"gold" },
  { title:"Ceroli Crisis",                 start:"2028-06-12", end:"2028-06-14", color:"teal" },
  { title:"Wheel of Fortune (Cavalry)",    start:"2028-06-13", end:"2028-06-15", color:"purple" },
  { title:"Champions of Olympia",          start:"2028-06-17", end:"2028-06-18", color:"tan" },
  { title:"Armament, Reveal Thyself",      start:"2028-06-19", end:"2028-06-20", color:"violet" },
  { title:"Realm of Mystique",             start:"2028-06-19", end:"2028-06-20", color:"indigo" },
  { title:"AOO Registration",              start:"2028-06-21", end:"2028-06-23", color:"gray" },
  { title:"Golden Kingdom",                start:"2028-06-21", end:"2028-06-23", color:"gold" },
  { title:"20 Gold Head Event",            start:"2028-06-23", end:"2028-06-24", color:"gold" },
  { title:"Egg / Hammer Event",            start:"2028-06-23", end:"2028-06-24", color:"teal" },
  { title:"Ark of Osiris",                 start:"2028-06-24", end:"2028-06-25", color:"tan" },
  { title:"Champions of Olympia",          start:"2028-06-24", end:"2028-06-25", color:"tan" },

  { title:"Mightiest Governor (Infantry)", start:"2028-06-26", end:"2028-07-01", color:"gold" },
  { title:"Ceroli Crisis",                 start:"2028-06-26", end:"2028-06-28", color:"teal" },
  { title:"Wheel of Fortune (Infantry)",   start:"2028-06-27", end:"2028-06-29", color:"purple" },
  { title:"Champions of Olympia",          start:"2028-07-01", end:"2028-07-02", color:"tan" },
  { title:"More Than Gems",                start:"2028-07-01", end:"2028-07-02", color:"maroon" },
  { title:"Dhalruk's Puzzle Box",          start:"2028-07-03", end:"2028-07-04", color:"teal" },
  { title:"Realm of Mystique",             start:"2028-07-03", end:"2028-07-04", color:"indigo" },
  { title:"AOO Registration",              start:"2028-07-05", end:"2028-07-07", color:"gray" },
  { title:"Golden Kingdom",                start:"2028-07-05", end:"2028-07-07", color:"gold" },
  { title:"20 Gold Head Event",            start:"2028-07-07", end:"2028-07-08", color:"gold" },
  { title:"Egg / Hammer Event",            start:"2028-07-07", end:"2028-07-08", color:"teal" },
  { title:"Ark of Osiris",                 start:"2028-07-08", end:"2028-07-09", color:"tan" },
  { title:"Champions of Olympia",          start:"2028-07-08", end:"2028-07-09", color:"tan" },

  { title:"Mightiest Governor (Archer)",   start:"2028-07-10", end:"2028-07-15", color:"gold" },
  { title:"Ceroli Crisis",                 start:"2028-07-10", end:"2028-07-12", color:"teal" },
  { title:"Wheel of Fortune (Archer)",     start:"2028-07-11", end:"2028-07-13", color:"purple" },
  { title:"Champions of Olympia",          start:"2028-07-15", end:"2028-07-16", color:"tan" },
  { title:"Armament, Reveal Thyself",      start:"2028-07-17", end:"2028-07-18", color:"violet" },
  { title:"Realm of Mystique",             start:"2028-07-17", end:"2028-07-18", color:"indigo" },
  { title:"AOO Registration",              start:"2028-07-19", end:"2028-07-21", color:"gray" },
  { title:"Golden Kingdom",                start:"2028-07-19", end:"2028-07-21", color:"gold" },
  { title:"20 Gold Head Event",            start:"2028-07-21", end:"2028-07-22", color:"gold" },
  { title:"Egg / Hammer Event",            start:"2028-07-21", end:"2028-07-22", color:"teal" },
  { title:"Ark of Osiris",                 start:"2028-07-22", end:"2028-07-23", color:"tan" },
  { title:"Champions of Olympia",          start:"2028-07-22", end:"2028-07-23", color:"tan" },

  { title:"Mightiest Governor (Leadership)", start:"2028-07-24", end:"2028-07-29", color:"gold" },
  { title:"Ceroli Crisis",                 start:"2028-07-24", end:"2028-07-26", color:"teal" },
  { title:"Wheel of Fortune (Leadership)", start:"2028-07-25", end:"2028-07-27", color:"purple" },
  { title:"Champions of Olympia",          start:"2028-07-29", end:"2028-07-30", color:"tan" },
  { title:"More Than Gems",                start:"2028-07-29", end:"2028-07-30", color:"maroon" },
  { title:"Esmeralda's House",             start:"2028-07-31", end:"2028-08-01", color:"maroon" },
  { title:"Realm of Mystique",             start:"2028-07-31", end:"2028-08-01", color:"indigo" },
  { title:"AOO Registration",              start:"2028-08-02", end:"2028-08-04", color:"gray" },
  { title:"Golden Kingdom",                start:"2028-08-02", end:"2028-08-04", color:"gold" },
  { title:"20 Gold Head Event",            start:"2028-08-04", end:"2028-08-05", color:"gold" },
  { title:"Egg / Hammer Event",            start:"2028-08-04", end:"2028-08-05", color:"teal" },
  { title:"Ark of Osiris",                 start:"2028-08-05", end:"2028-08-06", color:"tan" },
  { title:"Champions of Olympia",          start:"2028-08-05", end:"2028-08-06", color:"tan" },

  { title:"Mightiest Governor (Cavalry)",  start:"2028-08-07", end:"2028-08-12", color:"gold" },
  { title:"Ceroli Crisis",                 start:"2028-08-07", end:"2028-08-09", color:"teal" },
  { title:"Wheel of Fortune (Cavalry)",    start:"2028-08-08", end:"2028-08-10", color:"purple" },
  { title:"Champions of Olympia",          start:"2028-08-12", end:"2028-08-13", color:"tan" },
  { title:"Armament, Reveal Thyself",      start:"2028-08-14", end:"2028-08-15", color:"violet" },
  { title:"Realm of Mystique",             start:"2028-08-14", end:"2028-08-15", color:"indigo" },
  { title:"AOO Registration",              start:"2028-08-16", end:"2028-08-18", color:"gray" },
  { title:"Golden Kingdom",                start:"2028-08-16", end:"2028-08-18", color:"gold" },
  { title:"20 Gold Head Event",            start:"2028-08-18", end:"2028-08-19", color:"gold" },
  { title:"Egg / Hammer Event",            start:"2028-08-18", end:"2028-08-19", color:"teal" },
  { title:"Ark of Osiris",                 start:"2028-08-19", end:"2028-08-20", color:"tan" },
  { title:"Champions of Olympia",          start:"2028-08-19", end:"2028-08-20", color:"tan" },

  { title:"Mightiest Governor (Infantry)", start:"2028-08-21", end:"2028-08-26", color:"gold" },
  { title:"Ceroli Crisis",                 start:"2028-08-21", end:"2028-08-23", color:"teal" },
  { title:"Wheel of Fortune (Infantry)",   start:"2028-08-22", end:"2028-08-24", color:"purple" },
  { title:"Champions of Olympia",          start:"2028-08-26", end:"2028-08-27", color:"tan" },
  { title:"More Than Gems",                start:"2028-08-26", end:"2028-08-27", color:"maroon" },
  { title:"Dhalruk's Puzzle Box",          start:"2028-08-28", end:"2028-08-29", color:"teal" },
  { title:"Realm of Mystique",             start:"2028-08-28", end:"2028-08-29", color:"indigo" },
  { title:"AOO Registration",              start:"2028-08-30", end:"2028-09-01", color:"gray" },
  { title:"Golden Kingdom",                start:"2028-08-30", end:"2028-09-01", color:"gold" },
  { title:"20 Gold Head Event",            start:"2028-09-01", end:"2028-09-02", color:"gold" },
  { title:"Egg / Hammer Event",            start:"2028-09-01", end:"2028-09-02", color:"teal" },
  { title:"Ark of Osiris",                 start:"2028-09-02", end:"2028-09-03", color:"tan" },
  { title:"Champions of Olympia",          start:"2028-09-02", end:"2028-09-03", color:"tan" },

  { title:"Mightiest Governor (Archer)",   start:"2028-09-04", end:"2028-09-09", color:"gold" },
  { title:"Ceroli Crisis",                 start:"2028-09-04", end:"2028-09-06", color:"teal" },
  { title:"Wheel of Fortune (Archer)",     start:"2028-09-05", end:"2028-09-07", color:"purple" },
  { title:"Champions of Olympia",          start:"2028-09-09", end:"2028-09-10", color:"tan" },
  { title:"Armament, Reveal Thyself",      start:"2028-09-11", end:"2028-09-12", color:"violet" },
  { title:"Realm of Mystique",             start:"2028-09-11", end:"2028-09-12", color:"indigo" },
  { title:"AOO Registration",              start:"2028-09-13", end:"2028-09-15", color:"gray" },
  { title:"Golden Kingdom",                start:"2028-09-13", end:"2028-09-15", color:"gold" },
  { title:"20 Gold Head Event",            start:"2028-09-15", end:"2028-09-16", color:"gold" },
  { title:"Egg / Hammer Event",            start:"2028-09-15", end:"2028-09-16", color:"teal" },
  { title:"Ark of Osiris",                 start:"2028-09-16", end:"2028-09-17", color:"tan" },
  { title:"Champions of Olympia",          start:"2028-09-16", end:"2028-09-17", color:"tan" },

  { title:"Mightiest Governor (Leadership)", start:"2028-09-18", end:"2028-09-23", color:"gold" },
  { title:"Ceroli Crisis",                 start:"2028-09-18", end:"2028-09-20", color:"teal" },
  { title:"Wheel of Fortune (Leadership)", start:"2028-09-19", end:"2028-09-21", color:"purple" },
  { title:"Champions of Olympia",          start:"2028-09-23", end:"2028-09-24", color:"tan" },
  { title:"More Than Gems",                start:"2028-09-23", end:"2028-09-24", color:"maroon" },
  { title:"Esmeralda's House",             start:"2028-09-25", end:"2028-09-26", color:"maroon" },
  { title:"Realm of Mystique",             start:"2028-09-25", end:"2028-09-26", color:"indigo" },
  { title:"AOO Registration",              start:"2028-09-27", end:"2028-09-29", color:"gray" },
  { title:"Golden Kingdom",                start:"2028-09-27", end:"2028-09-29", color:"gold" },
  { title:"20 Gold Head Event",            start:"2028-09-29", end:"2028-09-30", color:"gold" },
  { title:"Egg / Hammer Event",            start:"2028-09-29", end:"2028-09-30", color:"teal" },
  { title:"Ark of Osiris",                 start:"2028-09-30", end:"2028-10-01", color:"tan" },
  { title:"Champions of Olympia",          start:"2028-09-30", end:"2028-10-01", color:"tan" },

  { title:"Mightiest Governor (Cavalry)",  start:"2028-10-02", end:"2028-10-07", color:"gold" },
  { title:"Ceroli Crisis",                 start:"2028-10-02", end:"2028-10-04", color:"teal" },
  { title:"Wheel of Fortune (Cavalry)",    start:"2028-10-03", end:"2028-10-05", color:"purple" },
  { title:"Champions of Olympia",          start:"2028-10-07", end:"2028-10-08", color:"tan" },
  { title:"Armament, Reveal Thyself",      start:"2028-10-09", end:"2028-10-10", color:"violet" },
  { title:"Realm of Mystique",             start:"2028-10-09", end:"2028-10-10", color:"indigo" },
  { title:"AOO Registration",              start:"2028-10-11", end:"2028-10-13", color:"gray" },
  { title:"Golden Kingdom",                start:"2028-10-11", end:"2028-10-13", color:"gold" },
  { title:"20 Gold Head Event",            start:"2028-10-13", end:"2028-10-14", color:"gold" },
  { title:"Egg / Hammer Event",            start:"2028-10-13", end:"2028-10-14", color:"teal" },
  { title:"Ark of Osiris",                 start:"2028-10-14", end:"2028-10-15", color:"tan" },
  { title:"Champions of Olympia",          start:"2028-10-14", end:"2028-10-15", color:"tan" },

  { title:"Mightiest Governor (Infantry)", start:"2028-10-16", end:"2028-10-21", color:"gold" },
  { title:"Ceroli Crisis",                 start:"2028-10-16", end:"2028-10-18", color:"teal" },
  { title:"Wheel of Fortune (Infantry)",   start:"2028-10-17", end:"2028-10-19", color:"purple" },
  { title:"Champions of Olympia",          start:"2028-10-21", end:"2028-10-22", color:"tan" },
  { title:"More Than Gems",                start:"2028-10-21", end:"2028-10-22", color:"maroon" },
  { title:"Dhalruk's Puzzle Box",          start:"2028-10-23", end:"2028-10-24", color:"teal" },
  { title:"Realm of Mystique",             start:"2028-10-23", end:"2028-10-24", color:"indigo" },
  { title:"AOO Registration",              start:"2028-10-25", end:"2028-10-27", color:"gray" },
  { title:"Golden Kingdom",                start:"2028-10-25", end:"2028-10-27", color:"gold" },
  { title:"20 Gold Head Event",            start:"2028-10-27", end:"2028-10-28", color:"gold" },
  { title:"Egg / Hammer Event",            start:"2028-10-27", end:"2028-10-28", color:"teal" },
  { title:"Ark of Osiris",                 start:"2028-10-28", end:"2028-10-29", color:"tan" },
  { title:"Champions of Olympia",          start:"2028-10-28", end:"2028-10-29", color:"tan" },

  { title:"Mightiest Governor (Archer)",   start:"2028-10-30", end:"2028-11-04", color:"gold" },
  { title:"Ceroli Crisis",                 start:"2028-10-30", end:"2028-11-01", color:"teal" },
  { title:"Wheel of Fortune (Archer)",     start:"2028-10-31", end:"2028-11-02", color:"purple" },
  { title:"Champions of Olympia",          start:"2028-11-04", end:"2028-11-05", color:"tan" },
  { title:"Armament, Reveal Thyself",      start:"2028-11-06", end:"2028-11-07", color:"violet" },
  { title:"Realm of Mystique",             start:"2028-11-06", end:"2028-11-07", color:"indigo" },
  { title:"AOO Registration",              start:"2028-11-08", end:"2028-11-10", color:"gray" },
  { title:"Golden Kingdom",                start:"2028-11-08", end:"2028-11-10", color:"gold" },
  { title:"20 Gold Head Event",            start:"2028-11-10", end:"2028-11-11", color:"gold" },
  { title:"Egg / Hammer Event",            start:"2028-11-10", end:"2028-11-11", color:"teal" },
  { title:"Ark of Osiris",                 start:"2028-11-11", end:"2028-11-12", color:"tan" },
  { title:"Champions of Olympia",          start:"2028-11-11", end:"2028-11-12", color:"tan" },
  
];


const EVENT_COLOR_LABEL = {
  teal:"Collection event", indigo:"Mystique event", gray:"Alliance registration",
  gold:"Kingdom-wide event", tan:"Cross-kingdom battle", purple:"Wheel of Fortune",
  maroon:"Rewards event", violet:"Armament event",
};

function toISODate(d) { return d.toISOString().slice(0, 10); }
function parseISODate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
function addDaysUTC(d, n) { return new Date(d.getTime() + n * 86400000); }

/* =====================================================================
   COUNTER CONFIG
   ===================================================================== */

const COUNTER_BASE    = "https://countapi.mileshilliard.com/api/v1";
const COUNTER_KEY     = "monument_rok_xtit_kingdom_timeline_members";
const COUNTER_HIT_URL = `${COUNTER_BASE}/hit/${COUNTER_KEY}`;
const COUNTER_GET_URL = `${COUNTER_BASE}/get/${COUNTER_KEY}`;
const COUNTED_FLAG    = "muster_counted";
const GATE_SEEN_FLAG  = "muster_gate_seen";
const POLL_MS         = 30000;

/* =====================================================================
   HELPERS
   ===================================================================== */

function fmtShort(d) {
  const opts  = {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit', hour12:false, timeZone:'UTC'};
  const parts = new Intl.DateTimeFormat('en-US', opts).formatToParts(d);
  const get   = t => (parts.find(p => p.type === t) || {}).value || '';
  return `${get('month')} ${get('day')}, ${get('hour')}:${get('minute')} UTC`;
}

function fmtClock(d) {
  const opts  = {year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false, timeZone:'UTC'};
  const parts = new Intl.DateTimeFormat('en-CA', opts).formatToParts(d);
  const get   = t => parts.find(p => p.type === t).value;
  return `${get('year')}-${get('month')}-${get('day')}  ${get('hour')}:${get('minute')}:${get('second')} UTC`;
}

function fmtDayHeading(d) {
  const opts = {weekday:'long', month:'long', day:'numeric', timeZone:'UTC'};
  return new Intl.DateTimeFormat('en-US', opts).format(d);
}

const formatCount = n => Number(n).toLocaleString('en-US');

async function fetchCounterValue(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error('Counter request failed: ' + res.status);
  const data  = await res.json();
  const value = data.value ?? data.count;
  if (value === undefined) throw new Error('Unexpected counter response shape');
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
  arrowLeft: p => <svg viewBox="0 0 24 24" fill="none" {...p}><path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  arrowRight:p => <svg viewBox="0 0 24 24" fill="none" {...p}><path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
};

/* =====================================================================
   OPERATION (chapter) CARD — the "front line" stepper card, used for KvK
   ===================================================================== */

function StageCard({ item, now }) {
  let status;
  if (now < item.start) status = 'upcoming';
  else if (item.end === null || now < item.end) status = 'live';
  else status = 'done';

  const badgeText = status === 'upcoming' ? 'Upcoming'
                  : status === 'live'     ? 'In progress'
                  :                         'Complete';

  let countdown;
  if (status === 'upcoming') countdown = <><CountdownHTML ms={item.start - now} /> until it starts</>;
  else if (status === 'live' && item.end !== null) countdown = <><CountdownHTML ms={item.end - now} /> left</>;
  else if (status === 'live') countdown = <>In progress — no fixed end date yet</>;
  else countdown = <>Completed {fmtShort(item.end)}</>;

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
          <span>Starts {fmtShort(item.start)}</span>
          <span>·</span>
          <span>{item.end === null ? 'Open-ended' : `Ends ${fmtShort(item.end)}`}</span>
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
          <p><span className="label">Opens</span> {fmtShort(chapter.start)}</p>
          <p><span className="label">Ends</span> {fmtShort(chapter.end)}</p>
          {(chapter.bonus || []).map((b, i) => (
            <p className="bonus-line" key={i}><Icon.key width={14} height={14} /> {b.label} opens {fmtShort(b.time)}</p>
          ))}
        </div>
      </Collapsible>
    </div>
  );
}

/* =====================================================================
   INSTALL MODAL
   ===================================================================== */

const GUIDES = {
  'iphone-safari': (
    <ol>
      <li>Tap the <span className="step-icon">Share</span> icon in the Safari toolbar</li>
      <li>Scroll down and tap <span className="step-icon">Add to Home Screen</span></li>
      <li>Tap <span className="step-icon">Add</span> in the top corner</li>
    </ol>
  ),
  'iphone-chrome': (
    <ol>
      <li>Tap the <span className="step-icon">Share</span> icon next to the address bar</li>
      <li>Scroll down and tap <span className="step-icon">Add to Home Screen</span></li>
      <li>Tap <span className="step-icon">Add</span> in the top corner</li>
    </ol>
  ),
  'android-chrome': (
    <ol>
      <li>Tap the <span className="step-icon">⋮</span> menu, top-right</li>
      <li>Tap <span className="step-icon">Add to Home screen</span></li>
      <li>Confirm by tapping <span className="step-icon">Add</span></li>
    </ol>
  ),
  'android-samsung': (
    <ol>
      <li>Tap the <span className="step-icon">Menu</span> icon, bottom-right</li>
      <li>Tap <span className="step-icon">Add page to</span></li>
      <li>Tap <span className="step-icon">Home screen</span>, then <span className="step-icon">Add</span></li>
    </ol>
  ),
  'desktop-chrome': (
    <ol>
      <li>Look for the <span className="step-icon">Install</span> icon in the address bar</li>
      <li>If you don't see it, open the <span className="step-icon">⋮</span> menu</li>
      <li>Choose <span className="step-icon">Install Muster…</span></li>
    </ol>
  ),
  'desktop-other': (
    <ol>
      <li>Look for an install icon in your browser's address bar</li>
      <li>Or check your browser menu for <span className="step-icon">Install</span> / <span className="step-icon">Add to Home screen</span></li>
    </ol>
  ),
};

const BACK_TARGET = {
  'iphone-safari':   'iphone-browser',
  'iphone-chrome':   'iphone-browser',
  'android-chrome':  'android-browser',
  'android-samsung': 'android-browser',
  'desktop-chrome':  'desktop-browser',
  'desktop-other':   'desktop-browser',
};

function InstallModal({ screen, onClose, onNavigate }) {
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!screen) return null;

  let titleText = 'Add to home screen';
  let bodyContent = null;

  if (screen === 'device') {
    titleText = 'Which device are you using?';
    bodyContent = (
      <>
        <p className="modal-prompt">Pick your device to see the exact steps.</p>
        <div className="modal-choices">
          <button className="choice-btn" onClick={() => onNavigate('iphone-browser')}>iPhone / iPad</button>
          <button className="choice-btn" onClick={() => onNavigate('android-browser')}>Android</button>
          <button className="choice-btn" onClick={() => onNavigate('desktop-browser')}>Computer</button>
        </div>
      </>
    );
  } else if (screen === 'iphone-browser') {
    titleText = 'Which browser?';
    bodyContent = (
      <>
        <button className="modal-back" onClick={() => onNavigate('device')}><Icon.arrowLeft width={14} height={14}/> Back</button>
        <p className="modal-prompt">Safari or Chrome?</p>
        <div className="modal-choices">
          <button className="choice-btn" onClick={() => onNavigate('iphone-safari')}>Safari</button>
          <button className="choice-btn" onClick={() => onNavigate('iphone-chrome')}>Chrome</button>
        </div>
      </>
    );
  } else if (screen === 'android-browser') {
    titleText = 'Which browser?';
    bodyContent = (
      <>
        <button className="modal-back" onClick={() => onNavigate('device')}><Icon.arrowLeft width={14} height={14}/> Back</button>
        <p className="modal-prompt">Chrome or Samsung Internet?</p>
        <div className="modal-choices">
          <button className="choice-btn" onClick={() => onNavigate('android-chrome')}>Chrome</button>
          <button className="choice-btn" onClick={() => onNavigate('android-samsung')}>Samsung Internet</button>
        </div>
      </>
    );
  } else if (screen === 'desktop-browser') {
    titleText = 'Which browser?';
    bodyContent = (
      <>
        <button className="modal-back" onClick={() => onNavigate('device')}><Icon.arrowLeft width={14} height={14}/> Back</button>
        <p className="modal-prompt">Chrome, or something else?</p>
        <div className="modal-choices">
          <button className="choice-btn" onClick={() => onNavigate('desktop-chrome')}>Chrome</button>
          <button className="choice-btn" onClick={() => onNavigate('desktop-other')}>Other browser</button>
        </div>
      </>
    );
  } else if (GUIDES[screen]) {
    titleText = 'Add to home screen';
    bodyContent = (
      <>
        <button className="modal-back" onClick={() => onNavigate(BACK_TARGET[screen])}><Icon.arrowLeft width={14} height={14}/> Back</button>
        {GUIDES[screen]}
      </>
    );
  }

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }} role="dialog" aria-modal="true">
      <div className="modal-card">
        <div className="modal-header">
          <h3>{titleText}</h3>
          <button className="modal-x" onClick={onClose} aria-label="Close"><Icon.close width={16} height={16}/></button>
        </div>
        <div className="modal-body">{bodyContent}</div>
      </div>
    </div>
  );
}

/* =====================================================================
   CALENDAR — month grid with a day-agenda beneath it
   ===================================================================== */

function eventsOnDate(dUTC) {
  return EVENTS.filter(ev => {
    const s = parseISODate(ev.start);
    const e = parseISODate(ev.end);
    return dUTC >= s && dUTC <= e;
  });
}

function CalendarPanel() {
  const today = useMemo(() => new Date(), []);
  const [viewYear, setViewYear]   = useState(today.getUTCFullYear());
  const [viewMonth, setViewMonth] = useState(today.getUTCMonth());
  const [selectedISO, setSelectedISO] = useState(toISODate(today));

  const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const dayNames   = ["M","T","W","T","F","S","S"];

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
        <button className="icon-btn" type="button" onClick={goPrev} aria-label="Previous month"><Icon.arrowLeft width={18} height={18}/></button>
        <div className="cal-label">{monthNames[viewMonth]} <span className="cal-year">{viewYear}</span></div>
        <button className="icon-btn" type="button" onClick={goNext} aria-label="Next month"><Icon.arrowRight width={18} height={18}/></button>
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

      <button className="today-btn" type="button" onClick={goToday}>Jump to today</button>

      <div className="agenda">
        <div className="agenda-heading">{fmtDayHeading(selectedDate)}</div>
        {agenda.length === 0 ? (
          <p className="agenda-empty">No scheduled events this day.</p>
        ) : (
          <div className="agenda-list">
            {agenda.map((ev, i) => (
              <div className="agenda-item" key={i}>
                <span className={`dot dot-${ev.color}`} />
                <div className="agenda-text">
                  <div className="agenda-title">{ev.title}</div>
                  <div className="agenda-range">{ev.start} – {toISODate(addDaysUTC(parseISODate(ev.end), -1))}</div>
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
              aria-label={`Number of ${formatCount(d)} ${unit} items owned`}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function CalculatorPanel() {
  return (
    <div className="calc-wrap">
      <InventoryCalculator title="Action points" unit="AP" denominations={[50, 100, 500, 1000]} />
      <InventoryCalculator title="Experience points" unit="XP" denominations={[100, 500, 1000, 5000, 10000, 20000, 50000]} />
      <InventoryCalculator title="Gems" unit="Gems" denominations={[5, 10, 50, 100, 200, 500, 650, 1000, 2000, 10000]} />
      <InventoryCalculator title="VIP points" unit="VIP" denominations={[10, 50, 100, 500, 1000, 5000]} />
    </div>
  );
}

/* =====================================================================
   APP
   ===================================================================== */

const NAV_ITEMS = [
  { id: 'timeline',    label: 'Overview',    icon: Icon.pulse    },
  { id: 'completed',   label: 'History',     icon: Icon.archive  },
  { id: 'kvk',         label: 'War Front',   icon: Icon.shield   },
  { id: 'schedule',    label: 'Calendar',    icon: Icon.calendar },
  { id: 'calculator',  label: 'Calculator',  icon: Icon.calc     },
  { id: 'members',     label: 'Visitors',    icon: Icon.users    },
];

export default function App() {
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
  const [countedIn, setCountedIn]     = useState(() => {
    try { return localStorage.getItem(COUNTED_FLAG) === '1'; } catch { return false; }
  });
  const [aboutOpen, setAboutOpen]     = useState(false);
  const [openUpCards, setOpenUpCards] = useState(() => new Set());
  const [toastContent, setToastContent] = useState(null);
  const [toastShown, setToastShown]     = useState(false);
  const [installScreen, setInstallScreen] = useState(null);
  const [installBtnHidden, setInstallBtnHidden] = useState(false);

  const deferredPromptRef  = useRef(null);
  const lastLiveChapterRef = useRef(undefined);
  const toastTimerRef      = useRef(null);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (gateHidden) document.documentElement.classList.remove('gate-locked');
    else            document.documentElement.classList.add('gate-locked');
  }, [gateHidden]);

  const refreshCount = useCallback(async () => {
    try {
      const value = await fetchCounterValue(COUNTER_GET_URL);
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
        showToast('Season complete', 'All chapters have concluded.');
      } else if (live) {
        showToast(`Chapter ${live.n} has begun`, live.title);
      }
    }
    lastLiveChapterRef.current = currentLiveNum;
  }, [now]);

  const showToast = (title, body) => {
    clearTimeout(toastTimerRef.current);
    setToastContent({ title, body });
    setToastShown(true);
    toastTimerRef.current = setTimeout(() => setToastShown(false), 6000);
  };

  useEffect(() => () => clearTimeout(toastTimerRef.current), []);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      try {
        const swCode = "self.addEventListener('fetch', function(){});";
        const blob   = new Blob([swCode], { type: 'application/javascript' });
        const swUrl  = URL.createObjectURL(blob);
        navigator.serviceWorker.register(swUrl).catch(() => {});
      } catch (e) {}
    }

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

    if (countedIn) return;
    try {
      const value = await fetchCounterValue(COUNTER_HIT_URL);
      try { localStorage.setItem(COUNTED_FLAG, '1'); } catch (e) {}
      setCountedIn(true);
      setCount(value);
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
    ...HISTORY.map(h => ({ n: h.n, title: h.title, date: new Date(h.done) })),
    ...doneChain.map(c => ({ n: c.n, title: c.title, date: c.end })),
  ];

  const kvkItems = [
    ...KVK1_STAGES.map((s, i) => ({ n: String(s.n), title: s.title, sub: s.sub, start: s.start, end: s.end, highlight: false })),
    { n: '4', title: KVK1_MAP_OPEN.title, sub: KVK1_MAP_OPEN.sub, start: KVK1_MAP_OPEN.start, end: KVK1_MAP_OPEN.end, highlight: true, last: true },
  ];

  const toggleUpCard = id => {
    setOpenUpCards(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const membersNoteText = countedIn
    ? "You're counted in this total — it's shared with every visitor."
    : "This total is shared with every visitor.";

  const progressPct = live ? Math.round(Math.min(100, Math.max(0, ((now - live.start) / (live.end - live.start)) * 100))) : 0;

  return (
    <>
      <div className={`toast${toastShown ? ' show' : ''}`} role="status" aria-live="polite">
        {toastContent && (
          <>
            <span className="toast-dot" />
            <span className="toast-text"><b>{toastContent.title}</b>{toastContent.body}</span>
            <button className="toast-x" onClick={() => setToastShown(false)} aria-label="Dismiss"><Icon.close width={14} height={14}/></button>
          </>
        )}
      </div>

      {installScreen && (
        <InstallModal screen={installScreen} onClose={() => setInstallScreen(null)} onNavigate={setInstallScreen} />
      )}

      {gateVisible && (
        <div className={`gate${gateHidden ? ' gate-hidden' : ''}`} role="dialog" aria-modal="true" aria-labelledby="gateTitle">
          <div className="gate-card">
            <div className="gate-logo">XTiT</div>
            <h2 className="gate-title" id="gateTitle">Kingdom event tracker</h2>
            <p className="gate-desc">Live countdowns for every chapter, KvK stage, and alliance event — all in server time.</p>
            <button className="btn-primary gate-btn" type="button" onClick={enterSite}>Open tracker</button>
            <p className="gate-count-line">
              {countAvailable && count !== null && <span className="count-number">{formatCount(count)}</span>}
              <span>{countAvailable && count !== null ? 'commanders have checked in' : 'Live count unavailable — you can still enter'}</span>
            </p>
          </div>
        </div>
      )}

      <div className="site" id="siteContent">
        <a className="skip-link" href="#heroSlot">Skip to current chapter</a>

        <header className="topbar">
          <div className="topbar-inner">
            <div className="brand">
              <span className="brand-mark">X</span>
              <span className="brand-name">XTiT</span>
            </div>
            <nav className="topnav" aria-label="Sections">
              {NAV_ITEMS.map(t => (
                <button
                  key={t.id}
                  className={`topnav-btn${activeTab === t.id ? ' active' : ''}`}
                  type="button"
                  onClick={() => setActiveTab(t.id)}
                >
                  <t.icon width={16} height={16} />
                  {t.label}
                </button>
              ))}
            </nav>
            <div className="topbar-clock">{fmtClock(now)}</div>
            {!installBtnHidden && (
              <button className="install-pill" type="button" onClick={handleInstallClick}>
                <Icon.plus width={14} height={14}/> <span>Install</span>
              </button>
            )}
          </div>
        </header>

        <main className="content">

          {/* ----- Overview ----- */}
          <section className={`panel${activeTab === 'timeline' ? ' active' : ''}`}>
            <div className={`about${aboutOpen ? ' open' : ''}`}>
              <button className="about-toggle" onClick={() => setAboutOpen(o => !o)} aria-expanded={aboutOpen}>
                <Icon.info width={16} height={16}/>
                <span>How this page works</span>
                <Icon.chevron className="chevron" width={16} height={16}/>
              </button>
              <Collapsible open={aboutOpen} className="about-body">
                <div className="about-body-inner">
                  <p>XTiT tracks the current server event chapter by chapter — what's live right now, what's coming next, and what's already finished — so your alliance always knows what to do and how much time is left.</p>
                  <ul>
                    <li><b>Overview</b> — the chapter in progress, with a countdown, and what's next.</li>
                    <li><b>History</b> — every chapter that's already finished.</li>
                    <li><b>War Front</b> — the estimated Kingdom vs Kingdom schedule.</li>
                    <li><b>Calendar</b> — the recurring alliance and kingdom event schedule.</li>
                  </ul>
                  <p>Some chapters unlock a bonus capture window a day after they end — a Pass, Shrine, or Lost Temple. Your alliance needs to hold it when that timer runs out. All times are shown in UTC, and the page refreshes on its own.</p>
                </div>
              </Collapsible>
            </div>

            {seasonOver && <div className="banner">All chapters have concluded — the season has ended.</div>}

            <div id="heroSlot">
              {live ? (
                <div className={`ops-card${heroJustChanged ? ' just-changed' : ''}`}>
                  <div className="ops-top">
                    <span className="ops-index">Chapter {live.n}</span>
                    <span className="pill live">In progress</span>
                  </div>
                  <h2 className="ops-title">{live.title}</h2>
                  <p className="ops-desc">{live.sub}</p>
                  <div className="ops-progress">
                    <div className="ops-track"><div className="ops-fill" style={{ width: progressPct + '%' }} /></div>
                    <span className="ops-pct">{progressPct}%</span>
                  </div>
                  <div className="ops-meta">
                    <span>Opened {fmtShort(live.start)}</span>
                    <span>Ends {fmtShort(live.end)}</span>
                  </div>
                  <div className="ops-countdown"><CountdownHTML ms={live.end - now} /> left</div>

                  {(live.bonus || []).map((b, i) => {
                    const opened = now >= b.time;
                    return opened ? (
                      <div className="capture opened" key={i}>
                        <span className="capture-label">{b.label} is open</span>
                        <span className="capture-status">Go capture it</span>
                      </div>
                    ) : (
                      <div className="capture" key={i}>
                        <span className="capture-label"><Icon.key width={14} height={14}/> {b.label}</span>
                        <span className="capture-status">Opens {fmtShort(b.time)} · <CountdownHTML ms={b.time - now} /> left</span>
                      </div>
                    );
                  })}
                </div>
              ) : upcomingChain.length ? (
                <div className="ops-card">
                  <div className="ops-top">
                    <span className="ops-index">Chapter {upcomingChain[0].n}</span>
                    <span className="pill upcoming">Opens next</span>
                  </div>
                  <h2 className="ops-title">{upcomingChain[0].title}</h2>
                  <p className="ops-desc">{upcomingChain[0].sub}</p>
                  <div className="ops-meta"><span>Opens {fmtShort(upcomingChain[0].start)}</span></div>
                  <div className="ops-countdown"><CountdownHTML ms={upcomingChain[0].start - now} /> until it opens</div>
                </div>
              ) : (
                <div className="ops-card">
                  <div className="ops-top"><span className="pill done">Season complete</span></div>
                  <h2 className="ops-title">All chapters concluded</h2>
                  <p className="ops-desc">The last chapter ended {fmtShort(SEASON_END)}.</p>
                </div>
              )}
            </div>

            {upcomingChain.length > 0 && (
              <>
                <div className="section-label">Coming up</div>
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
            <div className="section-label">History</div>
            <p className="muted-line">{doneRows.length} chapter{doneRows.length === 1 ? '' : 's'} completed so far</p>
            <div className="history-list">
              {doneRows.map((r, i) => (
                <div className="history-row" key={i}>
                  <span className="history-index">{r.n}</span>
                  <span className="history-title">{r.title}</span>
                  <span className="history-date">{fmtShort(r.date)}</span>
                </div>
              ))}
            </div>
          </section>

          {/* ----- War Front (KvK) ----- */}
          <section className={`panel${activeTab === 'kvk' ? ' active' : ''}`}>
            <div className="section-label">
              War Front — Kingdom vs Kingdom
              {KVK1_ESTIMATED && <span className="tag">Estimated</span>}
            </div>
            <p className="muted-line">These dates are estimates and will update automatically once official dates are announced.</p>
            <div className="stage-list">
              {kvkItems.map((item, i) => <StageCard key={i} item={item} now={now} />)}
            </div>
          </section>

          {/* ----- Calendar ----- */}
          <section className={`panel${activeTab === 'schedule' ? ' active' : ''}`}>
            <div className="section-label">Event calendar</div>
            <CalendarPanel />
          </section>

          {/* ----- Visitors ----- */}
          <section className={`panel${activeTab === 'members' ? ' active' : ''}`}>
            <div className="section-label">Visitors</div>
            <div className="stat-card">
              <p className="stat-eyebrow">People who've opened this tracker</p>
              <div className="stat-number-row">
                {countAvailable && count !== null
                  ? <span className="stat-number">{formatCount(count)}</span>
                  : <span className="stat-fallback">Unavailable right now</span>}
              </div>
              <p className="stat-note">{membersNoteText}</p>
            </div>
          </section>

          {/* ----- Calculator ----- */}
          <section className={`panel${activeTab === 'calculator' ? ' active' : ''}`}>
            <div className="section-label">Point calculator</div>
            <p className="muted-line">Enter how many of each item you're holding to see your current AP and XP totals.</p>
            <CalculatorPanel />
          </section>

        </main>

        <nav className="bottomnav" aria-label="Sections">
          {NAV_ITEMS.map(t => (
            <button
              key={t.id}
              className={`bottomnav-btn${activeTab === t.id ? ' active' : ''}`}
              type="button"
              onClick={() => setActiveTab(t.id)}
            >
              <t.icon width={20} height={20} />
              <span>{t.label}</span>
            </button>
          ))}
        </nav>

        <footer className="site-footer">
          <p>All times UTC · updates automatically, no need to refresh.</p>
          <p className="footer-signature">Built by XTiT</p>
        </footer>
      </div>
    </>
  );
}