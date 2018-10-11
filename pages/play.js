
var socket = io('/play');
var cardLastClicked;
var otherPlayerCard;
var playersInGame;
var playersInRound;
var playerId;
var allRoles = {'Built Environment': 1, 'Arts':2, 'Law':3, 'Medicine':4, 'Science':5, 'Engineering':6, 'Business':7, 'UNSW':8}

socket.on('registration request', function(){
    var uid = sessionStorage.getItem('gameUniqueId');
    if(uid == null){
        console.log("no session storage found, creating new ID");
        var randomlyGeneratedUID = Math.random().toString(36).substring(3,16) + +new Date;

        sessionStorage.setItem('gameUniqueId', randomlyGeneratedUID);
    } else {
        console.log("session storage already found");
    }
    socket.emit('register', sessionStorage.getItem('gameUniqueId'));
});

socket.on('update', function(data){
    if(document.getElementById("status")){
        document.getElementById("status").innerHTML = data + ' User(s) connected<br>';
    }
});

socket.on('player update', function(data){
    if(data > 0) {
        document.getElementById("waitingstatus").innerHTML = "You've connected to a game! Waiting for " + data + " more players";
        // alert(data)
        document.getElementById("share-link").style.visibility = "visible";
    } 
});

socket.on('nonplayer update', function(data){
    if(document.getElementById("waitingstatus")){
        document.getElementById("waitingstatus").innerHTML = "The current game is full. There are currently " + data + " players waiting.";
    }
});

socket.on('start game', function(data){
    // hide share link button
    document.getElementById("share-link").style.visibility = "hidden";
    document.querySelector("header > div[class='container text-center']").style.marginTop = "-10%";
    // remove status
    var parentOfStatus = document.getElementById("status").parentNode;
    parentOfStatus.removeChild(document.getElementById("status"));
    //remove gameWait; copy button and waitingstatus
    var parentOfWait = document.getElementById("gameWait").parentNode;
    parentOfWait.removeChild(document.getElementById("gameWait"));

    // we need to show every player what their current hand is
    var card = document.createElement("div");
    card.setAttribute("class","card");
    var card_body = document.createElement("div")
    card_body.setAttribute("class","card-body");
    
    var cardTitle = document.createElement("h5");
    var cardImage = document.createElement("img");
    var cardText = document.createElement("p");

    //edit what's in the card title
    cardTitle.style.color = "black";
    cardTitle.innerHTML = data.name;

    //add temporary placeholder image for the card
    cardImage.setAttribute("src","/images/frame-landscape.png")
    cardImage.style.width = "60%";
    cardImage.style.height = "10em";
    //edit what's in the text section of the card
    cardText.style.color = "black";
    cardText.innerHTML = "Strength: " + data.strength + "<br>Effect: " + data.description;
    card_body.appendChild(cardTitle);
    card_body.appendChild(cardImage);
    card_body.appendChild(cardText);
    card.appendChild(card_body);

    document.getElementById("gamewindow").style.visibility = "visible";
    document.getElementById("card1").appendChild(card);
    // document.getElementById("card2").appendChild(dupCard);
    document.getElementById("turnstatus").innerHTML = "It's not your turn yet.";
    // document.getElementById("playbutton").onclick = function() {
        // document.getElementById("turnstatus").innerHTML = "It's not your turn yet.";
    //     socket.emit('end turn');
    //     return false;
    // };
    

});

socket.on('remaining players', function(remainingPlayersInGame, remainingPlayersInRound, pId){
    playersInGame = remainingPlayersInGame;
    playersInRound = remainingPlayersInRound;
    playerId = pId;
});

socket.on('your turn', function(currentPlayer, card1, card){
    document.getElementById("turnstatus").innerHTML = "It's your turn!";

    // only show the end turn button if it's the current player's turn

    document.getElementById("playbutton").style.visibility = "visible";

    // var card1 = document.getElementById("card1").childNodes;
    var card2 = document.getElementById("card2");

    var cardData = document.createElement("div");
    cardData.setAttribute("class","card");
    cardData.setAttribute("onclick","saveInfo(this)");
    var card_body = document.createElement("div")
    card_body.setAttribute("class","card-body");
    

    var cardTitle = document.createElement("h5");
    var cardImage = document.createElement("img");
    var cardText = document.createElement("p");

    cardTitle.style.color = "black";
    cardTitle.innerHTML = card.name;

    cardImage.setAttribute("src","/images/frame-landscape.png")
    cardImage.style.width = "60%";
    cardImage.style.height = "10em";
    cardText.style.color = "black";
    // cardText.appendChild(text);
    cardText.innerHTML = "Strength: " + card.strength + "<br>Effect: " + card.description;
    card_body.appendChild(cardTitle);
    card_body.appendChild(cardImage);
    card_body.appendChild(cardText);
    cardData.appendChild(card_body);

    card2.appendChild(cardData)

    // only allow current player be able to click anything
    document.querySelector("div[id='card1'] > div").setAttribute("onclick", "saveInfo(this)");
});

function copyToClipboard() {
    var textArea = document.createElement("textarea")

    textArea.value = window.location.href;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('Copy');

    document.body.removeChild(textArea);
}

function endTurn() {
    if (!cardLastClicked && !otherPlayerCard) {
        // player has not selected anything
        // let player know that they cannot proceed until they select a card
        alert("You cannot proceed until you have chosen a card to play");
        return;
    }
    document.getElementById("playbutton").style.visibility = "hidden";
    document.getElementById("turnstatus").innerHTML = "It's not your turn yet.";

    // cardLastClicked stores:
    // {
    //     "name":"..",
    //     "cardNum":".."
    // }

    var playedCard;
    var otherCard;
    switch (cardLastClicked.name) {
        case "Built Environment":
            playedCard = 1;
            break;
        case "Arts":
            playedCard = 2;
            break;
        case "Law":
            playedCard = 3;
            break;
        case "Medicine":
            playedCard = 4;
            break;
        case "Science":
            playedCard = 5;
            break;
        case "Engineering":
            playedCard = 6;
            break;
        case "Business":
            playedCard = 7;
            break;
        default:
            playedCard = 8;
    }  
    switch (otherPlayerCard.name) {
        case "Built Environment":
            otherCard = 1;
            break;
        case "Arts":
            otherCard = 2;
            break;
        case "Law":
            otherCard = 3;
            break;
        case "Medicine":
            otherCard = 4;
            break;
        case "Science":
            otherCard = 5;
            break;
        case "Engineering":
            otherCard = 6;
            break;
        case "Business":
            otherCard = 7;
            break;
        default:
            otherCard = 8;
    }
    console.log(playedCard);
    console.log(otherCard);

    // we need to delete the card that has been chosen
    // we use cardLastClicked.cardNum to determine which children to remove
    // if card1 is removed, we should move card2 data over to card1 and then delete card2
    var card2Clone;
    if (cardLastClicked.cardNum == "card1") {
        card2Clone = (document.getElementById("card2").childNodes)[0].cloneNode(true);
        // remove card1
        var tempCard = document.getElementById("card1");
        while (tempCard.firstChild) {
            tempCard.removeChild(tempCard.firstChild);
        }
        card1.appendChild(card2Clone);
    }
    var cardToRemove = document.getElementById("card2");
    while (cardToRemove.firstChild) {
        cardToRemove.removeChild(cardToRemove.firstChild);
    } 
    socket.emit('play card', playedCard, otherCard);
    console.log("emitted played card:"+playedCard+","+otherCard);
    
}

socket.on('select player', function(playedCard, playerList){
    console.log(playedCard);
    switch (playedCard){
        case 1: 
            builtEnvironment(playerList);
            break;
        case 3:
            law(playerList);
            break;
        default:
            console.log("Emitting BLANK target player message");
            socket.emit('target player', player, cardLastClicked, null);
            break;
    }
});

function builtEnvironment(playerList){
    $('#gameModal').modal('show');
    document.getElementById('modal-title').innerHTML = "You've played Built Environment";
    document.getElementById('information').innerHTML = "Guess the name of a card in your opponent's hand to knock them out of the round";
    appendPlayersList(playerList);
    //Append roles
    var roleLabel = document.createElement("label");
    document.getElementById('modal-body').appendChild(roleLabel);
    roleLabel.setAttribute("for", "roleSelect");
    roleLabel.innerHTML = "Select a role:";
    var roles = document.createElement("select");
    document.getElementById('modal-body').appendChild(roles);
    roles.setAttribute("id", "roleSelect");
    roles.setAttribute("name", "roleSelect");
    roles.setAttribute("class", "form-control");
    
    for(var role in allRoles){
        if(role != "Built Environment"){
            //create an <option> to add the <select>
            var child = document.createElement("option");
            //assign values to the <option>
            child.textContent = role
            child.value = allRoles[role];
            //attach the mew <option> to the <selection>
            roles.appendChild(child);
        }
    }
    
}

function law(playerList){
    $('#gameModal').modal('show');
    document.getElementById('modal-title').innerHTML = "You've played Law";
    document.getElementById('information').innerHTML = "Select an opponent and the player with the lower rank is knocked out of the round.";
    appendPlayersList(playerList);
}

function appendPlayersList(playerList){
    //Append players
    var playersLabel = document.createElement("label");
    document.getElementById('modal-body').appendChild(playersLabel);
    playersLabel.setAttribute("for", "playerSelect");
    playersLabel.innerHTML = "Select a player:";
    var players = document.createElement("select");
    document.getElementById('modal-body').appendChild(players);
    players.setAttribute("id", "playerSelect");
    players.setAttribute("name", "playerSelect");
    players.setAttribute("class", "form-control");
    for (var p in playerList){
        if(p != playerId){
            //create an <option> to add the <select>
            var child = document.createElement("option");
            //assign values to the <option>
            child.textContent = p
            child.value = playersInRound[p];
            //attach the mew <option> to the <selection>
            players.appendChild(child);
        }
        
    }
}

function submitModal(){
    console.log("submit modal clicked!");
    console.log(cardLastClicked);
    switch (cardLastClicked.name){
        case "Built Environment": 
        //Built environment: get the values from both selects and send to backend
            var r = document.getElementById("roleSelect");
            var role = r.options[r.selectedIndex].value;
            var p = document.getElementById("playerSelect");
            var player = p.options[p.selectedIndex].value;
            console.log("Emitting target player message");
            socket.emit('target player', player, cardLastClicked, role);
            break;
        case "Law":
                //Law: get the values from player select and send to backend
            var p = document.getElementById("playerSelect");
            var player = p.options[p.selectedIndex].value;
            console.log("Emitting target player message");
            socket.emit('target player', player, cardLastClicked, null);
            break;
        default:
            break;
    }
        
}
function saveInfo(card) {
    cardChildren = card.childNodes;
    cardGrandChildren = cardChildren[0].childNodes;

    parent = card.parentNode;
    cardLastClicked = {
        "name":cardGrandChildren[0].innerHTML,
        "cardNum": parent.id
    }

    if (parent.id == "card1") {
        // other card is card2
        card2 = document.getElementById("card2");
        card2Child = card2.childNodes;
        grandchild = card2Child[0].childNodes;
        content = grandchild[0].childNodes;

        otherPlayerCard = {
            "name": content[0].innerHTML,
            "cardNum": "card2"
        }

    } else if (parent.id == "card2") {
        card1 = document.getElementById("card1");
        card1Child = card1.childNodes;
        grandchild = card1Child[0].childNodes;

        otherPlayerCard = {
            "name": grandchild[0].innerHTML,
            "cardNum": "card1"
        }
    }
    // first, we need to check if card1 or card2 was clicked

    if (parent.id == "card1") {
        // add active class
        card.classList.add("active");
        // remove active calss of other card if it exists
        card2 = document.getElementById("card2");
        if (card2.childNodes[0].classList.contains("active")) {
            card2.childNodes[0].classList.remove("active");
        }
    } else if (parent.id=="card2") {
        card.classList.add("active");
        // remove active calss of other card if it exists
        card1 = document.getElementById("card1");
        if (card1.childNodes[0].classList.contains("active")) {
            card1.childNodes[0].classList.remove("active");
        }
    }

}

window.onbeforeunload = function() {
    return "";
};