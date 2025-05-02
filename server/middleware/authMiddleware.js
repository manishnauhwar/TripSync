import jwt from 'jsonwebtoken';
import User from '../models/userModal.js';

const JWT_SECRET = 'Manish7248';

export const generateToken = (userId) => {
  return jwt.sign({ id: userId }, JWT_SECRET, {
    expiresIn: '30d'
  });
};

export const protect = async (req, res, next) => {
  let token;
  console.log('Authorization header:', req.headers.authorization);
  
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      console.log('Token extracted:', token ? 'Token found' : 'No token');
      
      const decoded = jwt.verify(token, JWT_SECRET);
      console.log('Token decoded:', decoded);
    
      req.userId = decoded.id;
      
      next();
    } catch (error) {
      console.error('Token verification failed:', error.message);
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }
  
  if (!token) {
    console.error('No token provided in request');
    return res.status(401).json({ message: 'Not authorized, no token' });
  }
};

export const authenticateUser = async (req, res, next) => {
  let token;
  console.log('Auth middleware - path:', req.path);
  console.log('Auth middleware - headers:', req.headers.authorization ? 'Auth header present' : 'No auth header');
  
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      console.log('Auth middleware - token extracted:', token.substring(0, 10) + '...');
      
      const decoded = jwt.verify(token, JWT_SECRET);
      console.log('Auth middleware - token decoded, user ID:', decoded.id);
      
      const user = await User.findById(decoded.id).select('-password');
      
      if (!user) {
        console.error('Auth middleware - User not found with ID:', decoded.id);
        return res.status(404).json({ message: 'User not found' });
      }
      
      console.log('Auth middleware - User found:', user.username);
      req.user = user;
      next();
    } catch (error) {
      console.error('Auth middleware - Token verification failed:', error.message);
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }
  
  if (!token) {
    console.error('Auth middleware - No token provided');
    return res.status(401).json({ message: 'Not authorized, no token' });
  }
};

export const optionalAuthUser = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      req.isAuthenticated = false;
      return next();
    }
    
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      req.isAuthenticated = false;
      return next();
    }
    
    req.user = user;
    req.isAuthenticated = true;
    next();
  } catch (error) {
    req.isAuthenticated = false;
    next();
  }
}; 