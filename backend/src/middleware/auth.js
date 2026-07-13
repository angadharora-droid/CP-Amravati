import jwt from 'jsonwebtoken';

export function sign(admin) {
  return jwt.sign(
    { sub: admin._id.toString(), email: admin.email, name: admin.name },
    process.env.JWT_SECRET,
    { expiresIn: '12h' }
  );
}

export function requireAdmin(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) return res.status(401).json({ message: 'Not signed in.' });

  try {
    req.admin = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ message: 'Session expired. Sign in again.' });
  }
}
