const bcrypt = require("bcryptjs");
const hash = "$2a$10$CwTycUXWue0Thq9StjUM0uJ8r2Yh8e0Wz9l9wz1Yx0n1Qx9VvY6yO";
const passwords = ["password123", "12345678", "clinic123", "password", "123456", "admin123"];

passwords.forEach(pw => {
  if (bcrypt.compareSync(pw, hash)) {
    console.log(`Match found! Password is: ${pw}`);
  }
});
