function generateRandomNumber(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateRandomString(length) {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

function generateRandomBoolean() {
  return Math.random() >= 0.5;
}

// Example usage:
// console.log("Random Number (1-100):", generateRandomNumber(1, 100));
// console.log("Random String (10 chars):", generateRandomString(10));
// console.log("Random Boolean:", generateRandomBoolean());
