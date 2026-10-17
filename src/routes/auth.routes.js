import express from 'express';
import passport from 'passport';

import {
  login,
  cadastrar,
  logout,
  googleCallback,
} from '../controllers/auth.controller.js';


const router = express.Router();


// Login tradicional

router.post(
  '/login',
  login
);


// Cadastro

router.post(
  '/cadastro',
  cadastrar
);


// Logout

router.post(
  '/logout',
  logout
);


// ─────────────────────────────
// Google OAuth
// ─────────────────────────────

router.get(
  '/google',

  passport.authenticate(
    'google',
    {
      scope: [
        'profile',
        'email',
        'openid',
      ],
    }
  )
);


router.get(
  '/google/callback',

  passport.authenticate(
    'google',
    {
      session: true,
      failureRedirect: '/login.html',
    }
  ),

  googleCallback
);


export default router;