@echo off
echo Starting all services...

:: Start the Task Risk Predictor service
start "Task Risk Predictor" cmd /k "cd task-risk-predictor && uvicorn main:app --port 8001"

:: Start the Team Behavior Profiler service
start "Team Behavior Profiler" cmd /k "cd team-behavior-profiler && uvicorn main:app --port 8002"

:: Start the npm development server
npm run dev

echo All services are booting up!
pause