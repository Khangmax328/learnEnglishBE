const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');

const authRoutes = require('./routes/authRoutes');
const textRoutes = require('./routes/textRoutes');

dotenv.config();
const app = express();

app.use(express.json());
// app.use(cors({
//   origin: [
//     'http://localhost:3000',
//     'https://learn-english-fe.vercel.app',
//     'https://learn-english-ej6bk5gil-khangmax328s-projects.vercel.app' 
//   ],
//   methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
//   allowedHeaders: ['Content-Type', 'Authorization'],
// }));

app.use(cors({
  origin: '*',
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));


if (!process.env.OPENAI_API_KEY || !process.env.OPENAI_API_KEY.trim()) {
  console.error('Missing OPENAI_API_KEY in .env');
  process.exit(1);
}

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

app.use('/api/auth', authRoutes);
app.use('/api/texts', textRoutes);

app.listen(process.env.PORT, () => {
  console.log(`Server is running on port ${process.env.PORT}`);
});
