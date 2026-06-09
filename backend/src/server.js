import dotenv from 'dotenv';
import { app } from './app.js';

dotenv.config();

const port = process.env.PORT || 5000;

app.listen(port, () => {
  console.log(`API Fourati rideaux lancée sur le port ${port}`);
});
