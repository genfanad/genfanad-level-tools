call npm install
start cmd /k node ./server/editor.js --workspace=../genfanad-content-raw
timeout /T 5 /NOBREAK
start "" http://localhost:7781/