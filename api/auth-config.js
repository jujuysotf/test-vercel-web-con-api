module.exports = function authConfig(_req, res) {
  const clientId = (process.env.VITE_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || '').trim();
  res.status(200).json({
    clientId: clientId || null,
    message: clientId
      ? 'Client ID de Google listo'
      : 'Falta VITE_GOOGLE_CLIENT_ID',
  });
};
