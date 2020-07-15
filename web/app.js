const SECTOR_SIZE = 18
const NUM_PIECES = 4

const urlParams = new URLSearchParams(window.location.search)

function getRoom() {
  var result = urlParams.get('room')
  if (!result) {
    result = Math.random().toString(36).substring(3)
  }
  if (result.length >= 30) {
    result = result.substring(0, 29)
  }
  return result
}

function getName() {
  var result = urlParams.get('name')
  while (!result) {
    result = prompt("Please enter your name", "")
  }
  return result
}

const room = getRoom()
const name = getName()

const idCookie = document.cookie.split('; ').find(row => row.startsWith('id'))
const id = idCookie? idCookie.split('=')[1] : Math.random().toString(36).substring(3)
if (!idCookie) {
  document.cookie = `id=${id}; expires=Fri, 31 Dec 9999 23:59:59 GMT`
}

var started = false
var playersInGame = []

const ws = new WebSocket("ws://" + location.host)
ws.onmessage = function (event) {
  console.log("Got message: " + event.data)
  msg = JSON.parse(event.data)
  if (msg.room == room) {
    if (msg.content) {
      addMessage(msg.id, msg.name, msg.chat, msg.content)
    }
    reloadState()
  }
}
ws.onclose = function(e) {
  console.log('Socket is closed. Reconnect will be attempted in 1 second.', e.reason)
  setTimeout(connect, 1000)
}

function getColor(player) {
  return ['dimgrey', 'red', 'blue', 'green', 'orange', 'purple', 'brown', 'gold', 'maroon', 'turquoise', 'indigo', 'midnightblue', 'salmon'][player]
}

function updateCell(cell, label, state, l, r, t, b, highlight=null) {
  cell.innerHTML = `
<div class="slot"
    <span class="label">${label}</span>
    <span class="marble" style="color: ${state.board[label] != null && state.board[label] != highlight? getColor(state.board[label]) : "white"}">
      ${state.board[label] != null && state.board[label] == highlight? '◯' : '⬤'}
    </span>
</div>`
  cell.className = "slotCell"

  if (l) cell.style.borderLeft = '0px'
  if (r) cell.style.borderRight = '0px'
  if (t) cell.style.borderTop = '0px'
  if (b) cell.style.borderBottom = '0px'

  if (highlight != null) {
    cell.style.backgroundColor = getColor(highlight)
  }

  if (state.board[label] != null) {
    cell.style.color = getColor(state.board[label])
  }
}

function updateBoard(state) {
  // Clear board
  while (board.rows.length) {
    board.deleteRow(0)
  }
  for (i = 0; i < 8; i++) {
    board.insertRow()
  }

  // Fill in board
  let rows = board.rows
  for (p = 0; p < state.numPlayers; p++) {
    let prevP = (p + state.numPlayers - 1) % state.numPlayers

    let home = rows[7].insertCell(0);
    updateCell(home, prevP * SECTOR_SIZE, state, false, true, true, false, prevP)
    for (i = 1; i < 8; i++) {
      updateCell(rows[7 - i].insertCell(0), i + prevP * SECTOR_SIZE, state, false, false, i < 7, true)
    }
    for (i = 0; i < 7; i++) {
      updateCell(rows[i + 1].insertCell(0), i + 8 + prevP * SECTOR_SIZE, state, i == 6, false, true, i < 6)
    }
    rows[0].cells[0].colSpan = 2
    for (i = 0; i < 7; i++) {
      rows[i].insertCell(0)
    }
    updateCell(rows[7].insertCell(0), 15 + prevP * SECTOR_SIZE, state, true, true, false, false)
    rows[0].insertCell(0)
    let lot = rows[1].insertCell(0)
    lot.className = 'lotCell'
    lot.style.backgroundColor = getColor(p)
    let lotCount = state.lot[p]
    if (lotCount == 0) {
      lot.innerHTML = '⬤⬤<br>⬤⬤'
    } else if (lotCount == 1) {
      lot.innerHTML = '⬤⬤<br>⬤◯'
    } else if (lotCount == 2) {
      lot.innerHTML = '⬤⬤<br>◯◯'
    } else if (lotCount == 3) {
      lot.innerHTML = '⬤◯<br>◯◯'
    } else {
      lot.innerHTML = '◯◯<br>◯◯'
    }
    rows[2].insertCell(0)
    for (i = 0; i < NUM_PIECES; i++) {
      let cell = rows[6 - i].insertCell(0)
      updateCell(cell, "F" + p + i, state, false, false, i < NUM_PIECES - 1, true, p)
    }
    updateCell(rows[7].insertCell(0), 16 + prevP * SECTOR_SIZE, state, true, true, true, false)
    for (i = 0; i < 7; i++) {
      rows[i].insertCell(0)
    }
    updateCell(rows[7].insertCell(0), 17 + prevP * SECTOR_SIZE, state, true, true, false, false)
  }

  // Fill in header
  board.deleteTHead()
  let head = board.createTHead()
  for (p = state.numPlayers - 1; p >= 0; p--) {
    let headCell = document.createElement('th')
    headCell.innerHTML = playersInGame[p]
    headCell.colSpan = 3
    head.append(headCell)
    let spaceCell = document.createElement('th')
    spaceCell.colSpan = 2
    head.append(spaceCell)
  }
}

function reloadState() {
  console.log("Reloading state")
  $.ajax({url: `state.json?room=${room}&id=${id}`, cache: false}).done(
    function (s) {
      console.log("Got state: " + s)
      state = JSON.parse(s)
      playersInGame = state.playersInGame
      started = state.turn != null
      if (started) {
        turn.innerHTML = `${playersInGame[state.turn]}'s turn`
        hand.innerHTML = "Current hand: " + state.hand
        turn.style.color = getColor(state.turn)
        startEndGame.innerHTML = "End Game"
      } else {
        turn.innerHTML = ""
        hand.innerHTML = ""
        startEndGame.innerHTML = "Start Game"
      }
      playersInRoom.innerHTML = ""
      state.playersInRoom.forEach(
        function (p, i) {
          playersInRoom.innerHTML += (i? ",  " : "") + p
        })
      aiPlayers.value = state.aiPlayers
      randomPlayers.value = state.randomPlayers
      actions.innerHTML = ""
      state.actions.forEach(
	function (a, i) {
	  actions.innerHTML +=
	    `<li><a href="javascript:void(0);" ping="action?room=${room}&id=${id}&action=${i}" class="action">${a}</a></li>`
	})
      updateBoard(state.board)
    })
}

function addMessage(id, name, chat, msg) {
  messagesOut.innerHTML +=`
<span style="${id != null? `color:${getColor(id)}` : ""}">
  <b>${name? name + ": " : ""}</b>
  <span style="${chat? "" : "font-style:italic;"}${id != null? "" : "font-weight:bold;"}">
    ${msg}
  </span>
</span><br>`
  messagesOut.scrollTop = messagesOut.scrollHeight
}

function connect() {
  console.log("Connecting")
  $.ajax({url: `register?room=${room}&id=${id}&name=${name}`, cache: false}).done(reloadState)
}

function disconnect() {
  console.log("Disconnecting")
  $.ajax({url: `unregister?room=${room}&id=${id}`, cache: false})
}

function initLink() {
  let url = new URL(window.location)
  joinLink.value = `${url.origin}${url.pathname}?room=${room}`
}

function copyLink() {
  joinLink.select()
  joinLink.setSelectionRange(0, 99999) // For mobile devices
  document.execCommand("copy");
}

function updateAutoPlayers() {
  $.ajax({url: `autoplayers?room=${room}&ai=${aiPlayers.value}&random=${randomPlayers.value}`, cache: false})
}

function handleStartEndGame() {
  if (started) {
    if (confirm("Really end the game?  This will end the game for all players.")) {
      $.ajax({url: "end?room=" + room, cache: false})
    }
  } else {
    $.ajax({url: "start?room=" + room, cache: false})
  }
}

function handleChat() {
  if (event.key == 'Enter') {
    ws.send(`${room}:${id}:${chatIn.value}`)
    chatIn.value = ""
  }
}
