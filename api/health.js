module.exports = function health(req, res) {
  res.status(200).json({
    status: 'ok',
    time: new Date().toISOString()
  });
};
