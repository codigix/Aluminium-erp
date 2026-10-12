const errorHandler = (err, req, res, next) => {
  if (err.code === 'ECONNABORTED') {
    return;
  }
  console.error(err);
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  res.status(status).json({
    message,
    error: message,
    code: err.code && typeof err.code === 'string' && !err.code.startsWith('ER_') ? err.code : undefined,
    details: err.details || null
  });
};

const notFound = (req, res) => {
  res.status(404).json({ message: 'Route not found' });
};

module.exports = { errorHandler, notFound };
