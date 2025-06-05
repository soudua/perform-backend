import express from 'express';
import cors from 'cors';
import usersRoutes from './routes/users.js';
import informationRoutes from './routes/information.js';
import clientsRoutes from './routes/clients.js';
import absencesRoutes from './routes/absences.js';

const app = express();
const PORT = process.env.PORT || 4000;

// Configure CORS with specific origins
app.use(cors({
  origin: [
    'https://soudua.github.io',  // Your GitHub Pages domain
    'http://localhost:5173'      // Your local development frontend
  ],
  credentials: true
}));
app.use(express.json()); // to parse JSON body
app.use('/api/users', usersRoutes);
app.use('/api/information', informationRoutes);
app.use('/api/clients', clientsRoutes);
app.use('/api/absences', absencesRoutes);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

export default app;
