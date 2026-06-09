import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const signToken = (admin) =>
  jwt.sign({ id: admin.id, email: admin.email, role: admin.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  });

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Veuillez saisir votre email et votre mot de passe' });

  const admin = await prisma.admin.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!admin || !(await bcrypt.compare(password, admin.password))) {
    return res.status(401).json({ message: 'Email ou mot de passe incorrect' });
  }

  return res.json({
    token: signToken(admin),
    admin: { id: admin.id, email: admin.email, role: admin.role },
  });
});

export const bootstrapAdmin = asyncHandler(async (req, res) => {
  const existing = await prisma.admin.count();
  if (existing > 0) return res.status(409).json({ message: 'Un administrateur existe déjà. Connectez-vous ou contactez votre administrateur.' });

  const { email, password } = req.body;
  if (!email || !password || password.length < 8) {
    return res.status(400).json({ message: 'Veuillez fournir un email valide et un mot de passe d\'au moins 8 caractères' });
  }

  const admin = await prisma.admin.create({
    data: {
      email: email.toLowerCase().trim(),
      password: await bcrypt.hash(password, 12),
    },
  });

  return res.status(201).json({
    token: signToken(admin),
    admin: { id: admin.id, email: admin.email, role: admin.role },
  });
});

export const me = asyncHandler(async (req, res) => {
  res.json({ admin: req.admin });
});
