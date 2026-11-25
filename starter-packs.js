// Starter packs: ready-made sets of repeating house jobs.
// Open them from the ⋯ menu > "Add starter jobs". Edit freely.
//
// Each job:
//   title, room (must match a room in config.js, or "" for whole house),
//   category, size ("quick" | "hour" | "big"), repeat, notes (optional)
//   and when it's first due:
//     in: N          -> N days from today (spread jobs out so they don't all land at once)
//     month, day     -> the next time that date comes round (for seasonal jobs)

window.HARCOURT_STARTER_PACKS = [
  {
    name: "Weekly and monthly routines",
    jobs: [
      { title: "Put the bins out", room: "Front Garden", category: "cleaning", size: "quick", repeat: "weekly", in: 1, notes: "Check which bin is due this week." },
      { title: "Clean the bathroom", room: "Bathroom", category: "cleaning", size: "hour", repeat: "weekly", in: 3 },
      { title: "Hoover downstairs", room: "Living Room", category: "cleaning", size: "hour", repeat: "weekly", in: 5 },
      { title: "Change the bed sheets", room: "Bedroom", category: "cleaning", size: "quick", repeat: "fortnightly", in: 6 },
      { title: "Wipe down the hob and microwave", room: "Kitchen", category: "cleaning", size: "quick", repeat: "weekly", in: 2 },
      { title: "Test smoke and CO alarms", room: "Landing", category: "admin", size: "quick", repeat: "monthly", in: 4, notes: "Press the test button on each one." },
      { title: "Clean out the fridge", room: "Kitchen", category: "cleaning", size: "hour", repeat: "monthly", in: 9 },
      { title: "Descale the kettle", room: "Kitchen", category: "cleaning", size: "quick", repeat: "monthly", in: 12 },
      { title: "Clean the washing machine drawer and filter", room: "Kitchen", category: "cleaning", size: "quick", repeat: "monthly", in: 16 },
      { title: "Clean the dishwasher filter", room: "Kitchen", category: "cleaning", size: "quick", repeat: "monthly", in: 20 },
      { title: "Weed the side passage", room: "Side of the house", category: "garden", size: "quick", repeat: "monthly", in: 24 }
    ]
  },
  {
    name: "Seasonal and yearly maintenance",
    jobs: [
      { title: "Clean the oven", room: "Kitchen", category: "cleaning", size: "big", repeat: "quarterly", in: 10 },
      { title: "Clean the extractor fan filter", room: "Kitchen", category: "cleaning", size: "quick", repeat: "quarterly", in: 18 },
      { title: "Clean the windows", room: "", category: "cleaning", size: "big", repeat: "quarterly", in: 26 },
      { title: "Check the sealant round the bath and shower", room: "Bathroom", category: "repairs", size: "quick", repeat: "6-monthly", in: 14, notes: "Look for gaps, mould or peeling. Reseal if needed." },
      { title: "Flip and rotate the mattress", room: "Bedroom", category: "cleaning", size: "quick", repeat: "6-monthly", in: 30 },
      { title: "Book the boiler service", room: "", category: "repairs", size: "quick", repeat: "yearly", month: 9, day: 1, notes: "Best done before the heating season starts." },
      { title: "Bleed the radiators", room: "", category: "repairs", size: "hour", repeat: "yearly", month: 10, day: 1 },
      { title: "Find and test the stopcock", room: "Under the stairs", category: "repairs", size: "quick", repeat: "yearly", month: 1, day: 15, notes: "Turn it off and on so it doesn't seize. Worth knowing where it is in an emergency." },
      { title: "Clear the gutters", room: "", category: "repairs", size: "big", repeat: "yearly", month: 11, day: 20, notes: "After the leaves have come down." },
      { title: "Check the shed roof and felt", room: "Shed", category: "repairs", size: "hour", repeat: "yearly", month: 10, day: 15 },
      { title: "Check home insurance renewal", room: "", category: "bills", size: "hour", repeat: "yearly", in: 45, notes: "Change the due date to a few weeks before your renewal date." },
      { title: "Check energy tariff and meter readings", room: "", category: "bills", size: "quick", repeat: "quarterly", in: 21 }
    ]
  },
  {
    name: "Garden through the year",
    jobs: [
      { title: "Mow the front lawn", room: "Front Garden", category: "garden", size: "hour", repeat: "fortnightly", month: 4, day: 1, notes: "Roughly April to October. Skip in winter." },
      { title: "Mow the back lawn", room: "Back Garden", category: "garden", size: "hour", repeat: "fortnightly", month: 4, day: 3, notes: "Roughly April to October. Skip in winter." },
      { title: "Service the lawnmower", room: "Shed", category: "garden", size: "hour", repeat: "yearly", month: 3, day: 1 },
      { title: "Clean the patio", room: "Back Garden", category: "garden", size: "big", repeat: "yearly", month: 4, day: 15 },
      { title: "Treat the shed and fence", room: "Shed", category: "garden", size: "big", repeat: "yearly", month: 5, day: 15, notes: "Needs a dry spell of a few days." },
      { title: "Cut back the hedges", room: "Front Garden", category: "garden", size: "big", repeat: "yearly", month: 9, day: 10, notes: "Avoid March to August: nesting birds are protected." },
      { title: "Drain and store the hosepipe", room: "Back Garden", category: "garden", size: "quick", repeat: "yearly", month: 10, day: 25 },
      { title: "Rake the leaves", room: "Back Garden", category: "garden", size: "hour", repeat: "yearly", month: 11, day: 15 }
    ]
  }
];
