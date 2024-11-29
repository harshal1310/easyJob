const jwt = require('jsonwebtoken');
const SECRET_KEY = 1234
function authenticateToken(req, res, next) {
  const token = req.cookies.token;

  if (!token) return res.render('login');

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.render('login', { message: '' });

    req.user = user;
    next();
  });
}

module.exports = authenticateToken;
