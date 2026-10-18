// Choices shown on the "Your preferences" step. Ids are stored in the
// itinerary data, so rename labels freely but keep ids stable.

export const budgets = [
  { id: "lt400", label: "Under $400", hint: "Hostels, tuk-tuks, rice & curry" },
  { id: "400_700", label: "$400 – 700", hint: "Guesthouses & a shared van" },
  { id: "700_1000", label: "$700 – 1,000", hint: "Boutique stays, a few splurges" },
  { id: "1000_1500", label: "$1,000 – 1,500", hint: "Villas with pools" },
  { id: "gt1500", label: "$1,500+", hint: "Treat yourself" },
] as const;

export const stays = [
  { id: "hostel", label: "Hostel", hint: "Cheap & social" },
  { id: "boutique", label: "Boutique hotel", hint: "Pretty & comfy" },
  { id: "villa", label: "Villa with pool", hint: "Whole crew together" },
  { id: "mix", label: "A mix", hint: "Depends on the stop" },
] as const;

export const sharedRooms = [
  { id: "yes", label: "Happy to share" },
  { id: "depends", label: "With the right people" },
  { id: "no", label: "Need my own room" },
] as const;

export const interests = [
  { id: "surfing", label: "Surfing" },
  { id: "safari", label: "Wildlife safari" },
  { id: "hiking", label: "Hiking" },
  { id: "beaches", label: "Beaches" },
  { id: "tea", label: "Tea country" },
  { id: "food", label: "Food" },
  { id: "culture", label: "Temples & culture" },
  { id: "photography", label: "Photography" },
  { id: "nightlife", label: "Nightlife" },
  { id: "wellness", label: "Wellness & spa" },
  { id: "snorkeling", label: "Snorkelling & diving" },
  { id: "trains", label: "Scenic trains" },
  { id: "shopping", label: "Shopping" },
] as const;

export const earlyMornings = [
  { id: "yes", label: "Up for 4am sunrise hikes", hint: "Set the alarm" },
  { id: "some", label: "Once or twice", hint: "If it's worth it" },
  { id: "no", label: "Let me sleep", hint: "Holidays start at 9" },
] as const;

export const transport = [
  { id: "van", label: "Private van", hint: "Door to door" },
  { id: "train", label: "Scenic train", hint: "At least once" },
  { id: "tuktuk", label: "Tuk-tuks", hint: "For the chaos" },
  { id: "any", label: "Don't mind", hint: "Whatever works" },
] as const;

export const dietary = [
  { id: "vegetarian", label: "Vegetarian" },
  { id: "vegan", label: "Vegan" },
  { id: "pescatarian", label: "Pescatarian" },
  { id: "halal", label: "Halal" },
  { id: "no-pork", label: "No pork" },
  { id: "no-beef", label: "No beef" },
  { id: "gluten-free", label: "Gluten-free" },
  { id: "nut-allergy", label: "Nut allergy" },
  { id: "lactose-free", label: "Lactose-free" },
] as const;

export const flexibility = [
  { id: "exact", label: "Exact dates", hint: "These are my dates" },
  { id: "few_days", label: "± a couple of days", hint: "Some wiggle room" },
  { id: "very", label: "Very flexible", hint: "Whatever the group picks" },
] as const;

const ids = <T extends readonly { id: string }[]>(list: T) =>
  list.map((x) => x.id) as unknown as [T[number]["id"], ...T[number]["id"][]];

export const budgetIds = ids(budgets);
export const stayIds = ids(stays);
export const sharedRoomIds = ids(sharedRooms);
export const interestIds = ids(interests);
export const earlyMorningIds = ids(earlyMornings);
export const transportIds = ids(transport);
export const dietaryIds = ids(dietary);
export const flexibilityIds = ids(flexibility);
