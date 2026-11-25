// Harcourt Kanban settings. Edit these values, then commit.
//
// SUPABASE_URL and SUPABASE_ANON_KEY come from your Supabase project:
//   Project Settings > API. The "anon public" key is designed to be public;
//   your cards are protected by the sign-in and the rules in supabase/schema.sql.
// Leave them empty to run in demo mode (cards saved on this device only).

window.HARCOURT_CONFIG = {
  SUPABASE_URL: "https://zidhwrlcnzclaqkekyrl.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_6ikEp27M9AhW_vOCfdtaPA_zOv3tMKb",

  // Names for assigning jobs to people, e.g. ["Ben", "Sam"].
  // Leave empty to switch assigning off (no "Who" box or person filter).
  PEOPLE: [],

  // Each room is its own board. Add, remove or reorder as you like.
  ROOMS: [
    "Kitchen", "Dining Room", "Hall", "Living Room", "Porch", "Landing",
    "Bathroom", "Study", "Studio", "Bedroom", "Front Garden", "Back Garden",
    "Under the stairs", "Shed", "Side of the house"
  ],

  // Card colour for each room. Jobs for the whole house use WHOLE_HOUSE_COLOUR.
  // Pick dark-ish colours so the white writing on them stays readable.
  ROOM_COLOURS: {
    "Kitchen":           "#dc2626",
    "Dining Room":       "#c2410c",
    "Hall":              "#a16207",
    "Living Room":       "#db2777",
    "Porch":             "#4d7c0f",
    "Landing":           "#0e7490",
    "Bathroom":          "#0369a1",
    "Study":             "#4338ca",
    "Studio":            "#6d28d9",
    "Bedroom":           "#a21caf",
    "Front Garden":      "#15803d",
    "Back Garden":       "#0f766e",
    "Under the stairs":  "#57534e",
    "Shed":              "#92400e",
    "Side of the house": "#64748b"
  },
  WHOLE_HOUSE_COLOUR: "#1e293b",

  COLUMNS: [
    { id: "todo",  name: "To do" },
    { id: "doing", name: "Doing" },
    { id: "done",  name: "Done" }
  ],

  CATEGORIES: [
    { id: "cleaning", name: "Cleaning",  colour: "#1d6fe0" },
    { id: "garden",   name: "Garden",    colour: "#13823b" },
    { id: "repairs",  name: "Repairs",   colour: "#c2410c" },
    { id: "bills",    name: "Bills",     colour: "#7c3aed" },
    { id: "shopping", name: "Shopping",  colour: "#be185d" },
    { id: "admin",    name: "Admin",     colour: "#475569" }
  ]
};
