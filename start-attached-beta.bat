cd /d "%~dp0"
call npm install
start cmd /k node ./server/editor.js --workspace=../genfanad-content-maps --assets=../genfanad-content-assets
timeout /T 5 /NOBREAK
start "" http://localhost:7781/