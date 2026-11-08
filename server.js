const app = require('./app');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Choe Gi Ngultrum running at http://localhost:${PORT}`);
  console.log(`Tagline: "Your Money, Our Transparency."`);
  console.log(`Closing: "Your Money. Our Transparency. Our Accountability."`);
});
