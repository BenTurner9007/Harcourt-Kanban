// Harcourt Kanban settings. Edit these values, then commit.
//
// SUPABASE_URL and SUPABASE_ANON_KEY come from your Supabase project:
//   Project Settings > API. The "anon public" key is designed to be public;
//   your cards are protected by the sign-in and the rules in supabase/schema.sql.
// Leave them empty to run in demo mode (cards saved on this device only).

window.HARCOURT_CONFIG = {
  SUPABASE_URL: "",
  SUPABASE_ANON_KEY: "",

  // The people who appear in the "Who" list.
  PEOPLE: ["Ben", "Partner"],

  // Each room is its own board. Add, remove or reorder as you like.
  ROOMS: [
    "Kitchen", "Dining Room", "Hall", "Living Room", "Porch", "Landing",
    "Bathroom", "Study", "Studio", "Bedroom", "Front Garden", "Back Garden",
    "Under the stairs", "Shed", "Side of the house"
  ],

  COLUMNS: [
    { id: "todo",  name: "To do" },
    { id: "doing", name: "Doing" },
    { id: "done",  name: "Done" }
  ],

  CATEGORIES: [
    { id: "cleaning", name: "Cleaning",  colour: "#3b82c4" },
    { id: "garden",   name: "Garden",    colour: "#3f8f4a" },
    { id: "repairs",  name: "Repairs",   colour: "#c0662b" },
    { id: "bills",    name: "Bills",     colour: "#8a5cc2" },
    { id: "shopping", name: "Shopping",  colour: "#c43f6b" },
    { id: "admin",    name: "Admin",     colour: "#6b7280" }
  ]
};
