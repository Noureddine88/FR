import jwt from 'jsonwebtoken';
import { prisma } from '../config/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const protect = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) return res.status(401).json({ message: 'Vous devez être connecté pour accéder à cette ressource' });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const admin = await prisma.admin.findUnique({
      where: { id: payload.id },
      select: { id: true, email: true, role: true },
    });
    if (!admin) return res.status(401).json({ message: 'Session expirée, veuillez vous reconnecter' });
    req.admin = admin;
    return next();
  } catch {
    return res.status(401).json({ message: 'Session expirée, veuillez vous reconnecter' });
  }
});
