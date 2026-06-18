const d = new Date();
console.log("Now:", d);
const three = new Date(d.getFullYear(), d.getMonth() + 3, 1);
console.log("Three months later:", three);
console.log(
  "Start of current month:",
  new Date(d.getFullYear(), d.getMonth(), 1),
);
console.log(
  "End of current month:",
  new Date(d.getFullYear(), d.getMonth() + 1, 0),
);
