@echo off

:: Backend kurulumu ve başlatma
echo Backend hazirlaniyor...
cd backend
python -m venv venv
call venv\Scripts\activate
pip install -r requirements.txt
start python app.py

:: Frontend kurulumu ve başlatma
echo Frontend hazirlaniyor...
cd ../frontend
call npm install
call npm start 