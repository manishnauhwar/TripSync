import User from '../models/userModal.js';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { generateToken } from '../middleware/authMiddleware.js';

export const registerUser = async (req, res) => {
    try {
      const { username, fullName, email, password, confirmPassword } = req.body;
  
      if (!username || !fullName || !email || !password || !confirmPassword) {
        return res.status(400).json({ message: 'All fields are required' });
      }
  
      if (password !== confirmPassword) {
        return res.status(400).json({ message: 'Passwords do not match' });
      }
  
      const existingUser = await User.findOne({ $or: [{ email }, { username }] });
  
      if (existingUser) {
        return res.status(400).json({ message: 'User already exists with given email or username' });
      }
  
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
  
      const user = await User.create({
        username,
        fullName,
        email,
        password: hashedPassword
      });
  
      res.status(201).json({
        message: 'User registered successfully',
        user: {
          id: user._id,
          username: user.username,
          fullName: user.fullName,
          email: user.email
        }
      });
  
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
};

export const loginUser = async (req, res) => {
  try {
    const { username_or_email, password } = req.body;

    if (!username_or_email || !password) {
      return res.status(400).json({ message: 'Please provide email/username and password' });
    }

    const user = await User.findOne({ 
      $or: [
        { email: username_or_email },
        { username: username_or_email }
      ]
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = generateToken(user._id);

    res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        username: user.username,
        fullName: user.fullName,
        email: user.email
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const googleLogin = async (req, res) => {
    try {
        const { email, name, googleId, photo } = req.body;

        if (!email || !googleId) {
            return res.status(400).json({ 
                success: false,
                message: 'Email and Google ID are required' 
            });
        }

        // Check if user exists
        let user = await User.findOne({ email });

        if (!user) {
            // Create new user if doesn't exist
            user = await User.create({
                email,
                fullName: name,
                username: email.split('@')[0],
                googleId,
                profilePicture: photo || '',
                password: await bcrypt.hash(googleId, 10)
            });
        } else if (!user.googleId) {
            // Update existing user with Google ID
            user.googleId = googleId;
            if (photo) user.profilePicture = photo;
            await user.save();
        }

        const token = generateToken(user._id);

        res.status(200).json({
            success: true,
            message: 'Google login successful',
            token,
            user: {
                id: user._id,
                username: user.username,
                fullName: user.fullName,
                email: user.email,
                profilePicture: user.profilePicture
            }
        });
    } catch (error) {
        console.error('Google login error:', error);
        res.status(500).json({ 
            success: false,
            message: error.message 
        });
    }
};

