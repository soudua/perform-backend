import express from 'express';
import cors from 'cors';
import usersRoutes from './routes/users.js';
import informationRoutes from './routes/information.js';
import clientsRoutes from './routes/clients.js';
import absencesRoutes from './routes/absences.js';

const app = express();
const PORT = process.env.PORT || 4000;

// Add a test route to verify the server is running
app.get('/', (req, res) => {
  res.json({ status: 'Backend is running!', environment: process.env.NODE_ENV });
});

// Configure CORS with specific origins
app.use(cors({
  origin: [
    'https://soudua.github.io',
    'https://soudua.github.io/Perform-testing-site',
    'http://localhost:5173',
    'http://localhost:4173'  // Vite preview mode
  ],
  credentials: true
}));
app.use(express.json()); // to parse JSON body

// Mount routes
app.use('/api/users', usersRoutes);
app.use('/api/information', informationRoutes);
app.use('/api/clients', clientsRoutes);
app.use('/api/absences', absencesRoutes);

// Start the server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
});

export default app;
