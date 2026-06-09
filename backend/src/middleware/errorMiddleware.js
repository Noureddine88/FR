export const notFound = (req, res, next) => {
  const error = new Error(`Page introuvable : ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
};

export const errorHandler = (error, req, res, next) => {
  const statusCode = error.statusCode || 500;
  res.status(statusCode).json({
    message: error.message || 'Erreur interne du serveur. Veuillez réessayer ou contacter le support.',
    details: process.env.NODE_ENV === 'production' ? undefined : error.stack,
  });
};
