/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}", // هذا السطر يغطي كل ملفات الـ JS/JSX داخل مجلد src
    "./public/index.html",         // إذا كنت تستخدم ملف HTML خارج مجلد src
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
