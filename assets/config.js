// generated from site.config.json
export const CONFIG = {
 "store": {
  "name": "Convenience Liquors",
  "legalName": "CONVENIENCE LIQUORS",
  "owner": "Ketan",
  "domain": "convenienceliquors.com",
  "siteUrl": "https://convenienceliquors.com",
  "tagline": "Wine, spirits & beer in Parsippany, NJ",
  "address": {
   "street": "1129 U.S. 46",
   "locality": "Parsippany",
   "region": "NJ",
   "postalCode": "07054",
   "country": "US",
   "landmark": "Troy Hills Shopping Center"
  },
  "phone": "(973) 334-4700",
  "phoneE164": "+19733344700",
  "email": "orders@convenienceliquors.com",
  "emailNote": "PLACEHOLDER — owner to confirm the inbox that should receive web orders",
  "geo": {
   "lat": 40.861862,
   "lng": -74.387626
  },
  "mapsUrl": "https://www.google.com/maps/search/?api=1&query=Convenience+Liquors+1129+US-46+Parsippany+NJ+07054",
  "mapsEmbedUrl": "https://maps.google.com/maps?q=40.861862,-74.387626&z=15&output=embed"
 },
 "hours": {
  "note": "Owner-confirmed hours. Edit here; displayed hours and pickup/delivery slots update on rebuild.",
  "timezone": "America/New_York",
  "days": [
   {
    "day": "Sunday",
    "open": "10:00",
    "close": "21:00"
   },
   {
    "day": "Monday",
    "open": "09:30",
    "close": "21:30"
   },
   {
    "day": "Tuesday",
    "open": "09:30",
    "close": "21:30"
   },
   {
    "day": "Wednesday",
    "open": "09:30",
    "close": "21:30"
   },
   {
    "day": "Thursday",
    "open": "09:30",
    "close": "21:30"
   },
   {
    "day": "Friday",
    "open": "09:30",
    "close": "21:30"
   },
   {
    "day": "Saturday",
    "open": "09:00",
    "close": "21:30"
   }
  ],
  "lastSlotMinutesBeforeClose": 30,
  "slotLengthMinutes": 30,
  "minLeadMinutes": 30,
  "daysAhead": 6
 },
 "catalog": {
  "outOfStock": {
   "mode": "hide",
   "modeOptions": "show = list with 'Out of stock' badge, sorted last | hide = remove from site entirely",
   "sortLast": true,
   "allowRequest": true,
   "requestNote": "Out-of-stock items can still be requested; the store will confirm availability before your order is ready."
  },
  "excludeHempThc": true,
  "pageSize": 24
 },
 "fulfillment": {
  "pickup": {
   "enabled": true
  },
  "delivery": {
   "enabled": true,
   "fee": 5.99,
   "minimumOrder": 15,
   "minimumAppliesTo": "subtotal before delivery fee",
   "radiusMiles": 5,
   "mode": "radius",
   "modeOptions": "radius = geocode the address and measure straight-line miles from store.geo (falls back to ZIP centroid) | zips = only allowedZips",
   "geocoder": "nominatim",
   "geocoderOptions": "nominatim (free OpenStreetMap, ~1 req/sec, no key) | zip (ZIP centroid only, offline) — swap in Google/Mapbox later in src/assets/delivery.js",
   "allowedZips": [
    "07054",
    "07034",
    "07058",
    "07045",
    "07936",
    "07981",
    "07046",
    "07004",
    "07927",
    "07068",
    "07005",
    "07082",
    "07878"
   ]
  }
 },
 "orders": {
  "submitMode": "mailto",
  "webhookUrl": "",
  "payment": {
   "online": false,
   "note": "Payment is collected in store at pickup, or at the door on delivery. No online payment processor is integrated."
  }
 },
 "legal": {
  "minAge": 21,
  "footerNotice": "Must be 21+. Please drink responsibly.",
  "ageGateDays": 30
 },
 "topSlug": {
  "wine": "wine",
  "spirits": "spirits",
  "beer": "beer",
  "mixers": "mixers-more"
 },
 "taxonomy": {
  "wine": {
   "label": "Wine",
   "subs": [
    "Red Wine",
    "White Wine",
    "Rosé",
    "Sparkling & Champagne",
    "Dessert & Fortified",
    "Sake & Fruit Wine",
    "Other Wine"
   ]
  },
  "spirits": {
   "label": "Spirits",
   "subs": [
    "Whiskey",
    "Vodka",
    "Tequila & Mezcal",
    "Rum",
    "Gin",
    "Cognac & Brandy",
    "Liqueurs & Cordials",
    "Soju & Asian Spirits",
    "Other Spirits"
   ]
  },
  "beer": {
   "label": "Beer & Seltzer",
   "subs": [
    "Domestic Beer",
    "Imported Beer",
    "Craft Beer",
    "Hard Seltzer & RTD",
    "Cider",
    "Non-Alcoholic"
   ]
  },
  "mixers": {
   "label": "Mixers & More",
   "subs": [
    "Cocktail Mixers",
    "Soda, Water & Juice",
    "Snacks & Candy",
    "Bar Tools & Gifts"
   ]
  }
 }
};
