# DTRLog - OJT Hours Tracker ⏱️

A modern, cloud-synced Daily Time Record (DTR) system designed for interns and students to automate practicum hour calculations, track progress, and generate official, supervisor-ready PDF timesheets.

## ✨ Key Features

* **Smart Time Calculation:** Automatically enforces strict shift boundaries (e.g., 07:30 AM - 06:30 PM). It intelligently trims early-ins and late-outs to maintain accurate net hours without manual adjustment.
* **Cloud-Synced Profiles:** User settings, custom target requirements (e.g., 300 hours), and uploaded company logos are securely stored in the cloud database and synced across all devices.
* **Google OAuth2 Login:** Secure, passwordless authentication using Google accounts.
* **Dynamic Progress Tracking:** Visual circular and linear progress bars that update instantly based on custom internship hour requirements.
* **Print-Ready PDF Exports:** Automatically formats weekly logs into clean tables, fitting multiple weeks per page to save paper, complete with auto-generated signature blocks at the bottom of each week.
* **Batch Logging & Editing:** Quickly input entire weeks of data at once, search for specific dates, and edit or delete logs on the fly.
* **Responsive UI & Dark Mode:** Built with Tailwind CSS for a seamless experience on both mobile and desktop, featuring a one-click dark/light mode toggle.

## 💻 Tech Stack

* **Backend:** Python, FastAPI, SQLAlchemy
* **Database:** PostgreSQL (Hosted on Neon)
* **Frontend:** HTML5, Vanilla JavaScript, Tailwind CSS, Flatpickr
* **Authentication:** Google OAuth2 (Authlib)
* **Deployment:** Render (Web Service)

## 🚀 Local Setup & Installation

### Prerequisites
* Python 3.9+
* PostgreSQL installed locally (or a cloud DB URL like Neon)
* Google Cloud Console account (for OAuth credentials)

### 1. Clone the Repository
```bash
git clone [https://github.com/Heavenly-Forged/DTRLog.git](https://github.com/Heavenly-Forged/DTRLog.git)
cd DTRLog
```

### 2. Create a Virtual Environment
```bash
python -m venv venv
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```
*(If you haven't created a `requirements.txt` yet, run: `pip install fastapi uvicorn sqlalchemy psycopg2-binary authlib itsdangerous pydantic`)*

### 4. Configure Environment Variables
Create a `.env` file in the root directory and add your credentials:
```ini
DATABASE_URL=postgresql://user:password@localhost/dbname
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret
SECRET_KEY=your_random_secret_session_key
```

### 5. Run the Application
```bash
uvicorn main:app --reload
```
Open your browser and navigate to `http://127.0.0.1:8000`.

## ☁️ Deployment Notes (Render & Neon)
This application is fully optimized for cloud deployment. 
1. Host the PostgreSQL database on **Neon.tech**.
2. Deploy the web service using **Render**, pointing the Build Command to `pip install -r requirements.txt` and the Start Command to `uvicorn main:app --host 0.0.0.0 --port $PORT`.
3. Ensure all environment variables from your `.env` file are added to the Render Environment Variables dashboard.

## 👨‍💻 Author
**Jiro C. Beringuela**
* GitHub: [@Heavenly-Forged](https://github.com/Heavenly-Forged)

## 📄 License
This project is open-source and available under the [MIT License](LICENSE).
