/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./public/index.html", "./public/**/*.js"],
  theme: {
    extend: {
      fontFamily: { display: ['Sora', 'sans-serif'], body: ['Inter', 'sans-serif'] }
    }
  },
  plugins: []
}
