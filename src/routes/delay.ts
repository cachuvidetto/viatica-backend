// backend/src/utils/delay.ts
export const randomDelay = () =>
  new Promise(r => setTimeout(r, 400 + Math.random() * 400));