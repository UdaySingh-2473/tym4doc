# TYM4DOC

This is a full-stack booking system I built to simplify how patients, doctors, and clinics interact. The goal was to create something that feels premium and "just works," whether you're a patient looking for a quick appointment or an admin managing a whole clinic.

## Why this project?

Healthcare scheduling is often clunky. I wanted to build a platform that handles the entire flow—from finding a doctor and verifying your email to secure payments—without the user feeling overwhelmed. 

### What's inside:

*   **Dashboards that make sense**: Whether you're logged in as a patient, doctor, or clinic, the UI is tailored to exactly what you need to see. No clutter.
*   **Themed for comfort**: Full support for Dark and Light modes. It automatically persists your preference so it's ready when you come back.
*   **Responsive from the ground up**: I spent a lot of time making sure it looks great on everything. It's fully optimized even for tiny mobile screens (230px range).
*   **Secure and Reliable**: JWT-based auth, password resets via email, and integrated Razorpay for handling payments securely.
*   **Support when you need it**: A built-in support system so users can get help without leaving the app.

## The Tech Behind It

I used the MERN stack (MongoDB, Express, React, Node) because of how well they play together for real-time apps. 
- **Frontend**: React with Vite for speed. I kept the styling in Vanilla CSS to have absolute control over the look and feel.
- **Backend**: Node/Express managing the API and Socket.io for real-time notifications.
- **Payments**: Razorpay handles the heavy lifting for transactions.
- **Storage**: Profile images and assets are managed via Cloudinary.

## Getting it running locally

If you want to poke around the code or run it yourself, here's the quick version:

###  Backend
1. Go into the `backend` folder and run `npm install`.
2. Create a `.env` file (you can use `.env.example` as a starting point).
3. You'll need credentials for MongoDB, Razorpay, Cloudinary, and an email account for SMTP (Nodemailer).
4. Run `npm run dev` to start the server on port 5000.

###  Frontend
1. Go into the `frontend` folder and run `npm install`.
2. Make sure your `.env` points to the backend API (`http://localhost:5000/api`).
3. Run `npm run dev` and open `http://localhost:5173`.

## A quick look at the API

The backend is structured logically:
- `/api/auth`: Handles all the login, registration, and email verification logic.
- `/api/appointments`: The core of the app—booking, cancelling, and fetching schedules.
- `/api/support`: Where the help requests are processed.



---
*Built with care by the TYM4DOC Team.*
