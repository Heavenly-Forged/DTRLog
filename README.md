# Practicum DTR System

A mobile-responsive, full-stack Daily Time Record (DTR) web application built for interns. It allows users to log their biometrics, automatically deduct lunch hours, and generate properly formatted, supervisor-ready PDF timesheets.

## Features
* **Google OAuth2 Login:** Secure authentication using Gmail.
* **Batch Weekly Entry:** Quickly log a full 5-day work week in one go.
* **Smart PDF Export:** Generates clean, paginated, and official company DTR documents.
* **Local Storage Integration:** Saves custom company headers, logos, and supervisor signatures locally.
* **Dark Mode Support:** Fully integrated system, dark, and light themes.

## Tech Stack
* **Backend:** FastAPI (Python), SQLAlchemy
* **Database:** PostgreSQL (Neon.tech)
* **Frontend:** HTML5, Tailwind CSS, Flatpickr (Vanilla JS)
* **Hosting:** Render

## Local Setup
1. Clone the repository.
2. Install dependencies: `pip install -r requirements.txt`
3. Run the server: `uvicorn main:app --reload`
4. Open `http://localhost:8000` in your browser.