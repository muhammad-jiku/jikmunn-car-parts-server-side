const express = require('express');

const port = process.env.PORT || 5000;
const app = express();

app.get('/', (req, res) => {
  res.send('HELLO THERE!!');
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
