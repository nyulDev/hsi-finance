// Test the exact code from route.ts
const currentDate = new Date();
console.log("currentDate:", currentDate);
console.log("currentDate.getMonth():", currentDate.getMonth());
console.log("currentDate.getFullYear():", currentDate.getFullYear());

const threeMonthsLater = new Date(
  currentDate.getFullYear(),
  currentDate.getMonth() + 3,
  1,
);
console.log("threeMonthsLater:", threeMonthsLater);
console.log("threeMonthsLater month:", threeMonthsLater.getMonth());

const startOfCurrentMonth = new Date(
  currentDate.getFullYear(),
  currentDate.getMonth(),
  1,
);
console.log("startOfCurrentMonth:", startOfCurrentMonth);

const endOfCurrentMonth = new Date(
  currentDate.getFullYear(),
  currentDate.getMonth() + 1,
  0,
);
console.log("endOfCurrentMonth:", endOfCurrentMonth);

// Let's check what month we're in now
const monthNames = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];
console.log("Current month name:", monthNames[currentDate.getMonth()]);
console.log(
  "Expected three months later:",
  monthNames[(currentDate.getMonth() + 3) % 12],
);
